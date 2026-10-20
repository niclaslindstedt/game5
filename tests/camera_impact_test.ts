// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE IMPACT CAM'S LENS (`pwa/src/game/camera-impact.ts`): cut to a camera
// standing beside the strike, side on to his way, on the game's own lens's
// side of him; the eye held still while the aim pans with him; drawn home
// to the game's own lens on the way back.

import { describe, expect, it } from "vitest";

import type { LensPose } from "../pwa/src/game/camera-rigs.ts";
import { IMPACT_LENS, createImpactLens, frameImpact } from "../pwa/src/game/camera-impact.ts";
import type { XrayShot } from "../pwa/src/game/xray-shots.ts";

const flat = () => 0;
const strike = {
  kind: "crush" as const,
  in: 0.2,
  at: { x: 0, y: 1, z: 0 },
  way: { x: 0, y: 0, z: 30 },
};
const shot: XrayShot = { kind: "impact", strike };
/** The game's own lens: behind him and off to his right (−x). */
const home: LensPose = {
  eye: { x: -2, y: 3, z: -8 },
  target: { x: 0, y: 1, z: -4 },
  fov: 60,
  roll: 0,
};

describe("the impact cam's lens", () => {
  it("cuts to a camera side on to his way, on the game lens's side", () => {
    const st = createImpactLens();
    const pose = frameImpact(st, shot, { x: 0, y: 1, z: -6 }, home, 0, 1 / 60, flat)!;
    // No flight in: the first frame is already where it stands.
    expect(Math.hypot(pose.eye.x, pose.eye.z)).toBeCloseTo(IMPACT_LENS.arm.crush, 1);
    expect(pose.eye.x).toBeLessThan(0);
    // Mostly square to his way (+z), a little behind the strike.
    expect(Math.abs(pose.eye.x)).toBeGreaterThan(Math.abs(pose.eye.z));
    expect(pose.eye.z).toBeLessThan(0);
    expect(pose.fov).toBe(IMPACT_LENS.fov.crush);
  });

  it("holds the eye still while the aim pans with him", () => {
    const st = createImpactLens();
    const first = frameImpact(st, shot, { x: 0, y: 1, z: -6 }, home, 0, 1 / 60, flat)!;
    let pose = first;
    for (let k = 0; k < 60; k++)
      pose = frameImpact(st, shot, { x: 0, y: 1, z: -6 + k * 0.2 }, home, 0, 1 / 60, flat)!;
    expect(pose.eye).toEqual(first.eye);
    expect(pose.target.z).toBeGreaterThan(first.target.z + 1);
  });

  it("is drawn all the way home on the way back, and put down after", () => {
    const st = createImpactLens();
    frameImpact(st, shot, { x: 0, y: 1, z: 0 }, home, 0, 1 / 60, flat);
    const back = frameImpact(st, { kind: "body" }, { x: 0, y: 1, z: 1 }, home, 1, 1 / 60, flat)!;
    for (const k of ["x", "y", "z"] as const) {
      expect(back.eye[k]).toBeCloseTo(home.eye[k], 9);
      expect(back.target[k]).toBeCloseTo(home.target[k], 9);
    }
    expect(frameImpact(st, null, null, home, 0, 1 / 60, flat)).toBeNull();
    expect(st.active).toBe(false);
  });

  it("stands off the side the snow does not lift it on", () => {
    const st = createImpactLens();
    // A face rising steeply to his right (−x).
    const face = (x: number) => (x < 0 ? -x * 1.5 : 0);
    const pose = frameImpact(st, shot, null, home, 0, 1 / 60, face)!;
    expect(pose.eye.x).toBeGreaterThan(0);
    expect(pose.eye.y).toBeCloseTo(strike.at.y + IMPACT_LENS.height, 5);
  });

  it("stands off the clearer side when the near one is blocked", () => {
    const st = createImpactLens();
    // Everything off his right (−x) is blocked a metre out.
    const clear = (from: { x: number }) => (from.x < 0 ? 0.15 : 1);
    const pose = frameImpact(st, shot, null, home, 0, 1 / 60, flat, clear)!;
    expect(pose.eye.x).toBeGreaterThan(0);
  });

  it("stands wider for a person struck, so both bodies are in the frame", () => {
    const st = createImpactLens();
    const person: XrayShot = {
      kind: "impact",
      strike: { ...strike, kind: "person", person: { x: 0, z: 0.4 } },
    };
    const body = { x: 0, y: 1, z: -0.6 };
    const pose = frameImpact(st, person, body, home, 0, 1 / 60, flat)!;
    expect(pose.fov).toBe(IMPACT_LENS.fov.person);
    // Ahead of the strike rather than behind it, and far enough off that
    // the struck man, thrown on 2 m down the way, and the player are both in.
    expect(pose.eye.z).toBeGreaterThan(0);
    // Half the frame's width on a screen on its side (16:9; the fov is the height's).
    const half = Math.atan(Math.tan(((IMPACT_LENS.fov.person / 2) * Math.PI) / 180) * (16 / 9));
    const look = { x: pose.target.x - pose.eye.x, z: pose.target.z - pose.eye.z };
    for (const p of [body, { x: 0, y: 1, z: 2.4 }]) {
      const to = { x: p.x - pose.eye.x, z: p.z - pose.eye.z };
      const cos =
        (to.x * look.x + to.z * look.z) / (Math.hypot(to.x, to.z) * Math.hypot(look.x, look.z));
      expect(Math.acos(cos)).toBeLessThan(half * 0.8);
    }
  });
});

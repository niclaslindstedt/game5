// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FALL LOOK (`camera-fall.ts`): a skier falling a long way — off a
// helicopter's skid, out from under a wing — is framed from up over his
// back with the look tipped down onto where he will land, so the snow he
// is about to meet is in the picture with him; a kicker's flight never
// brings it in, and a lens under the wing never takes it.

import { describe, expect, it } from "vitest";
import {
  createBoomState,
  FRAME_AT,
  frameRig,
  RIGS,
  type BoltedRig,
  type BoomRig,
  type LensPose,
  type Rig,
  type RigPose,
} from "../pwa/src/game/camera-rigs.ts";
import { FALL, fallAhead } from "../pwa/src/game/camera-fall.ts";
import { hangIn, PARA_RIGS, paraRigPose } from "../pwa/src/game/camera-para.ts";

const DT = 1 / 60;
const G = 9.81;

/** The look's pitch, rad, positive up. */
const aimOf = (l: LensPose) =>
  Math.atan2(l.target.y - l.eye.y, Math.hypot(l.target.x - l.eye.x, l.target.z - l.eye.z));
/** Where a point stands in the frame, as a share of the vertical half-fov
 * from the axis (1 the top edge, −1 the bottom). */
const onScreen = (l: LensPose, p: { x: number; y: number; z: number }) =>
  Math.tan(Math.atan2(p.y - l.eye.y, Math.hypot(p.x - l.eye.x, p.z - l.eye.z)) - aimOf(l)) /
  Math.tan((l.fov * Math.PI) / 360);

const flat = () => 0;

/** A skier falling from `height` m over flat snow at `forward` m/s along
 * +z, framed by `rig` for `secs` s (or until he lands). */
function fall(rig: Rig, height: number, forward: number, secs: number) {
  const st = createBoomState();
  let y = height + 1;
  let vy = 0;
  let z = 0;
  let pose: RigPose | null = null;
  let lens: LensPose | null = null;
  for (let i = 0; i < secs / DT && y > 1; i++) {
    vy -= G * DT;
    y += vy * DT;
    z += forward * DT;
    pose = {
      x: 0,
      y,
      z,
      heading: 0,
      pitch: 0,
      roll: 0,
      vx: 0,
      vy,
      vz: forward,
      speed: Math.hypot(vy, forward),
      airborne: true,
      packed: 1,
      q: { x: 0, y: 0, z: 0, w: 1 },
    };
    lens = frameRig(rig, pose, st, DT, flat);
  }
  return { lens: lens!, pose: pose!, st };
}

describe("the fall look", () => {
  const chase = RIGS.chase as BoomRig;

  it("traces where the fall comes down", () => {
    const out = { x: 0, y: 0, z: 0 };
    const pose = fall(chase, 40, 10, DT).pose;
    expect(fallAhead(pose, flat, out)).toBe(true);
    // Forty metres is some 2.8 s: 28 m on at 10 m/s.
    expect(out.z).toBeGreaterThan(24);
    expect(out.z).toBeLessThan(32);
    expect(out.y).toBe(0);
  });

  it("climbs over his back and looks down at him and his landing in a long fall", () => {
    const { lens, pose, st } = fall(chase, 60, 8, 1.8);
    expect(st.fallen.share).toBeGreaterThan(0.9);
    // Up over him, behind him.
    expect(lens.eye.y - pose.y).toBeGreaterThan(3);
    expect(lens.eye.z).toBeLessThan(pose.z);
    // The look tipped well down.
    expect(aimOf(lens)).toBeLessThan(-0.6);
    // He is in the frame, and so is the snow he will land on.
    const him = onScreen(lens, { x: pose.x, y: pose.y + FRAME_AT, z: pose.z });
    expect(Math.abs(him)).toBeLessThan(0.9);
    const land = onScreen(lens, st.fallen.land);
    expect(land).toBeGreaterThan(-1);
    expect(land).toBeLessThan(him);
  });

  it("frames the landing a skiing lens leaves out of the picture", () => {
    const own = fall(chase, 60, 8, 1.8);
    const none = fall({ ...chase, fall: 0 }, 60, 8, 1.8);
    expect(onScreen(none.lens, none.st.fallen.land)).toBeLessThan(-1);
    expect(onScreen(own.lens, own.st.fallen.land)).toBeGreaterThan(-1);
  });

  it("is never brought in by a kicker's flight", () => {
    // A hop of three metres at 20 m/s: well under `FALL.from` still to fall.
    const { st } = fall(chase, 3, 20, 0.6);
    expect(FALL.from).toBeGreaterThan(4);
    expect(st.fallen.share).toBe(0);
  });

  it("tips the helmet's look down onto the landing", () => {
    const helmet = RIGS.helmet as BoltedRig;
    const falling = fall(helmet, 60, 0, 1.8).lens;
    const hop = fall(helmet, 2, 0, 0.3).lens;
    expect(aimOf(falling)).toBeLessThan(aimOf(hop) - 0.3);
  });

  it("is never taken under the paramotor's wing", () => {
    for (const r of ["chase", "far"] as const) expect((PARA_RIGS[r] as BoomRig).fall ?? 0).toBe(0);
    for (const r of ["tips", "helmet", "high"] as const)
      expect((PARA_RIGS[r] as BoltedRig).fallDown ?? 0).toBe(0);
  });
});

describe("the pilot's own cameras under the wing", () => {
  const pilot = (): RigPose => ({
    x: 10,
    y: 300,
    z: 20,
    heading: 0,
    pitch: 0,
    roll: 0,
    vx: 0,
    vy: -1,
    vz: 15,
    speed: 15,
    airborne: true,
    packed: 1,
    q: { x: 0, y: 0, z: 0, w: 1 },
  });
  // The wing six metres up the lines, leant back and over to his right.
  const wing = { x: 12, y: 305.5, z: 18 };

  it("keeps the bolted rungs on him while the booms frame up his lines", () => {
    const pose = paraRigPose(pilot(), wing);
    expect(pose.y).toBeGreaterThan(301);
    const lens = frameRig(PARA_RIGS.helmet, pose, createBoomState(), DT, () => 0);
    const eye = (PARA_RIGS.helmet as BoltedRig).eye;
    expect(lens.eye.x).toBeCloseTo(10 + eye.x, 6);
    expect(lens.eye.y).toBeCloseTo(300 + eye.y, 6);
    expect(lens.eye.z).toBeCloseTo(20 + eye.z, 6);
  });

  it("looks up the slope on the snow and down over the drop once he flies", () => {
    const ground = frameRig(
      PARA_RIGS.helmet,
      paraRigPose(pilot(), wing, 0),
      createBoomState(),
      DT,
      () => 0,
    );
    const flying = frameRig(
      PARA_RIGS.helmet,
      paraRigPose(pilot(), wing, 1),
      createBoomState(),
      DT,
      () => 0,
    );
    expect(aimOf(ground)).toBeGreaterThan(aimOf(flying) + 0.4);
    let hung = 0;
    for (let i = 0; i < 4 / DT; i++) hung = hangIn(hung, DT);
    expect(hung).toBeGreaterThan(0.9);
  });
});

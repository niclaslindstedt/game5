// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER'S COCKPIT (`cockpit-plan.ts`, drawn by `heli-cockpit.ts`)
// and its lens (`camera-heli.ts`'s HELMET rung): the pilot sat in the right
// seat inside the cabin, the controls moving the way the machine is flown,
// the hands able to reach them, the instruments reading the machine, and
// the lens bolted to the airframe.

import { describe, expect, it } from "vitest";
import { HELI, heliQuat, rotate, type HeliState } from "@engine";

import { cockpitLens, heliLens, createHeliCam, rollFor } from "../pwa/src/game/camera-heli.ts";
import {
  bodyOf,
  COCKPIT,
  cockpitFov,
  collectiveGrip,
  controlPose,
  cyclicGrip,
  gaugesOf,
  headOf,
  inCabin,
  joint,
} from "../pwa/src/game/cockpit-plan.ts";

function machine(over: Partial<HeliState> = {}): HeliState {
  return {
    mode: "flown",
    x: 100,
    y: 1500,
    z: 200,
    vx: 0,
    vy: 0,
    vz: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    disc: { pitch: 0, roll: 0, pitchRate: 0, rollRate: 0 },
    controls: { collective: 0.55, pitch: 0, roll: 0, pedal: 0 },
    yawRate: 0,
    pitchRate: 0,
    rollRate: 0,
    spool: 1,
    rotor: 0,
    tailRotor: 0,
    thrust: HELI.mass * 9.81,
    collective: 0.55,
    grounded: false,
    agl: 30,
    rider: true,
    t: 0,
    wreck: null,
    hang: 0,
    ...over,
  };
}

const flat = () => 0;
const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe("the cockpit", () => {
  it("sits the pilot in the right seat, inside the cabin, under the roof", () => {
    const E = COCKPIT.eye;
    expect(E.x).toBeGreaterThan(0.25);
    expect(inCabin(E)).toBe(true);
    expect(E.y).toBeLessThan(HELI.body.roof - 0.3);
    expect(E.y - COCKPIT.seat.top).toBeGreaterThan(0.7);
    // Outside the cabin is outside.
    expect(inCabin({ x: 0, y: 1.5, z: -3 })).toBe(false);
    expect(inCabin({ x: 1.5, y: 1.5, z: 1.5 })).toBe(false);
    expect(inCabin({ x: 0, y: 3, z: 1.5 })).toBe(false);
  });

  it("swings the cyclic the way it is pushed and raises the collective as it is pulled", () => {
    // The engine's +x is the picture's LEFT (input-model.ts), so a positive
    // roll or pedal is a turn to the left as seen, and the cockpit — laid
    // out as seen — answers it on its left.
    const rest = controlPose({ collective: 0, pitch: 0, roll: 0, pedal: 0 });
    const fwd = controlPose({ collective: 1, pitch: 1, roll: 0, pedal: 0 });
    const left = controlPose({ collective: 0, pitch: 0, roll: 1, pedal: 1 });
    expect(cyclicGrip(fwd).z).toBeGreaterThan(cyclicGrip(rest).z + 0.1);
    expect(cyclicGrip(left).x).toBeLessThan(cyclicGrip(rest).x - 0.06);
    expect(collectiveGrip(fwd).y).toBeGreaterThan(collectiveGrip(rest).y + 0.15);
    // The left pedal pushed for a left turn, the right drawn back.
    expect(left.pedalLeft).toBeGreaterThan(0);
    expect(left.pedalRight).toBeLessThan(0);
  });

  it("puts every grip within the pilot's reach at every stop", () => {
    const P = COCKPIT.pilot;
    const reach = P.upperArm + P.forearm + 0.12;
    const S = COCKPIT.seat;
    for (const c of [-1, 0, 1]) {
      for (const pull of [0, 1]) {
        const pose = controlPose({ collective: pull, pitch: c, roll: c, pedal: c });
        const right = { x: S.x + P.shoulder.half, y: P.shoulder.y, z: P.shoulder.z };
        const left = { x: S.x - P.shoulder.half, y: P.shoulder.y, z: P.shoulder.z };
        expect(dist(right, cyclicGrip(pose))).toBeLessThan(reach);
        expect(dist(left, collectiveGrip(pose))).toBeLessThan(reach);
      }
    }
  });

  it("bends a limb at a joint its two lengths away from both ends", () => {
    const root = { x: 0, y: 1, z: 0 };
    const end = { x: 0, y: 0.6, z: 0.4 };
    const k = joint(root, end, 0.3, 0.3, { x: 0, y: 0, z: 1 });
    expect(dist(root, k)).toBeCloseTo(0.3, 5);
    expect(dist(end, k)).toBeCloseTo(0.3, 5);
    expect(k.z).toBeGreaterThan(0.2);
  });

  it("reads the machine on its instruments", () => {
    const h = machine({ vz: 40, vy: 5, heading: Math.PI / 2, vx: 40 * Math.sin(Math.PI / 2) });
    h.vz = 40 * Math.cos(Math.PI / 2);
    const g = gaugesOf(h, 1450, 0);
    expect(g.ias).toBeCloseTo(40 * 1.943844, 0);
    // Turned toward the engine's +x, which is west as the picture shows it.
    expect(g.heading).toBeCloseTo(270, 5);
    expect(g.vsi).toBeCloseTo(5 * 60 * 3.28084, 0);
    expect(g.radar).toBeCloseTo(50 * 3.28084, 0);
    expect(g.nr).toBeGreaterThan(95);
    expect(g.live).toBe(true);
    const off = gaugesOf(machine({ spool: 0, mode: "parked" }), 1490, 0);
    expect(off.live).toBe(false);
    expect(off.torque).toBe(0);
    // Flown backwards, the airspeed reads nothing.
    expect(gaugesOf(machine({ vz: -10 }), 1450, 0).ias).toBe(0);
  });

  it("looks out ahead in cruise and down out of the chin at the hover", () => {
    expect(headOf(machine({ vz: 0 })).down).toBeGreaterThan(headOf(machine({ vz: 40 })).down);
    expect(headOf(machine({ vz: 40, yawRate: 0.5 })).turn).toBeGreaterThan(0);
  });

  it("widens on a tall screen, within its bounds", () => {
    expect(cockpitFov(16 / 9)).toBe(COCKPIT.fov);
    expect(cockpitFov(390 / 844)).toBeGreaterThan(COCKPIT.fov);
    expect(cockpitFov(0.2)).toBeLessThanOrEqual(COCKPIT.tallMost);
  });
});

describe("the cockpit lens", () => {
  it("is the HELMET rung, at the pilot's eyes, turned with the airframe", () => {
    const h = machine({ heading: 0.7, pitch: -0.2, roll: 0.4 });
    const at = { x: h.x, y: h.y, z: h.z, heading: h.heading, q: heliQuat(h) };
    const lens = heliLens(createHeliCam(), h, at, "helmet", flat);
    const want = rotate(heliQuat(h), bodyOf(COCKPIT.eye));
    expect(lens.eye.x).toBeCloseTo(h.x + want.x, 6);
    expect(lens.eye.y).toBeCloseTo(h.y + want.y, 6);
    expect(lens.eye.z).toBeCloseTo(h.z + want.z, 6);
    // Rolled right-side-down in the engine's frame — the picture's LEFT, the
    // engine's +x being the picture's left — the picture rolls left with it.
    expect(lens.roll).toBeLessThan(-0.25);
    expect(cockpitLens(machine(), { x: 0, y: 0, z: 0, heading: 0 }).roll).toBeCloseTo(0, 6);
  });

  it("stands a lens the right way up for any up", () => {
    const f = { x: 0, y: 0, z: 1 };
    expect(rollFor(f, { x: 0, y: 1, z: 0 })).toBeCloseTo(0, 6);
    // Up leant toward the lens's right (−x, looking along +z): a right roll.
    expect(rollFor(f, { x: -Math.sin(0.3), y: Math.cos(0.3), z: 0 })).toBeCloseTo(0.3, 6);
    expect(Math.abs(rollFor(f, { x: 0, y: -1, z: 0 }))).toBeCloseTo(Math.PI, 6);
  });

  it("keeps the nose lens on TIPS, under the chin and looking down", () => {
    const h = machine();
    const at = { x: h.x, y: h.y, z: h.z, heading: 0 };
    const lens = heliLens(createHeliCam(), h, at, "tips", flat);
    expect(lens.eye.z - h.z).toBeGreaterThan(HELI.body.nose);
    expect(lens.target.y).toBeLessThan(lens.eye.y - 5);
  });
});

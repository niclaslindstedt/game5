// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LEGS DANGLING OFF A HELICOPTER'S SKID (`skier-dangle.ts`): each leg a
// damped pendulum at the knee, hung along the gravity the seat feels,
// blown by the air past him, kept off the skid tube and off the other boot,
// and the skis turned and moved with the boots they are clamped to.

import { describe, expect, it } from "vitest";

import {
  DANGLE,
  createDangle,
  stepDangle,
  swingLegs,
  swingOf,
  type Dangle,
  type Perch,
} from "../pwa/src/game/skier-dangle.ts";
import { MOUNTS, skierPose } from "../pwa/src/game/skier-pose.ts";
import { seatedPose } from "../pwa/src/game/skier-seat.ts";
import type { V3 } from "../pwa/src/game/skier-vec.ts";

const HOVER: Perch = {
  y: -0.55,
  gravity: { x: 0, y: -9.81, z: 0 },
  air: { x: 0, y: 0, z: 0 },
  spool: 1,
  rotor: 0,
  hanging: 1,
  t: 100,
};

/** Ride the legs `seconds` at 60 frames a second under `p`, its clock
 * running; the swing's mean over the last two seconds and its spread. */
function ride(p: Perch, seconds: number, d: Dangle = createDangle()) {
  const n = Math.round(seconds * 60);
  const pitch: number[] = [];
  const side: number[] = [];
  for (let k = 1; k <= n; k++) {
    stepDangle(d, { ...p, t: p.t + k / 60 }, 1 / 60);
    if (k > n - 120) {
      pitch.push((d.legs[0].pitch + d.legs[1].pitch) / 2);
      side.push((d.legs[0].side + d.legs[1].side) / 2);
    }
  }
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  return { d, pitch: mean(pitch), side: mean(side) };
}

const STOOD = {
  hipRight: 0,
  hipAft: 0,
  lean: 0,
  steer: 0,
  crouch: 0,
  airborne: false,
  landing: 10,
  mounts: MOUNTS,
};

const dist = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe("the legs dangling off the skid", () => {
  it("hang plumb in a calm hover, swinging only a little on their own", () => {
    const r = ride(HOVER, 12);
    expect(Math.abs(r.pitch)).toBeLessThan(0.08);
    expect(Math.abs(r.side)).toBeLessThan(0.02);
  });

  it("swing to keep hanging down when the seat tilts, and back when it accelerates", () => {
    // Tilted 15° about his forward axis: down leans to his right.
    const tilt = 0.26;
    const tilted = ride(
      { ...HOVER, gravity: { x: 9.81 * Math.sin(tilt), y: -9.81 * Math.cos(tilt), z: 0 } },
      14,
    );
    expect(tilted.side).toBeGreaterThan(0.6 * tilt);
    expect(tilted.side).toBeLessThan(1.2 * tilt);
    // The seat speeding up toward his front: the feet trail behind.
    const pushed = ride({ ...HOVER, gravity: { x: 0, y: -9.81, z: -3 } }, 14);
    expect(pushed.pitch).toBeLessThan(-0.1);
  });

  it("trail well downwind at 150 km/h, more than at 60", () => {
    const fast = ride({ ...HOVER, air: { x: 150 / 3.6, y: 0, z: 0 } }, 14);
    const slow = ride({ ...HOVER, air: { x: 60 / 3.6, y: 0, z: 0 } }, 14);
    expect(fast.side).toBeGreaterThan(0.5);
    expect(fast.side).toBeGreaterThan(slow.side + 0.2);
    expect(slow.side).toBeGreaterThan(0.05);
  });

  it("never swing back through the skid tube, nor past a straight knee", () => {
    const back = ride({ ...HOVER, air: { x: 0, y: 0, z: -60 } }, 10);
    expect(back.pitch).toBeGreaterThan(DANGLE.back - DANGLE.stop.give - 1e-9);
    const fwd = ride({ ...HOVER, air: { x: 0, y: 0, z: 80 } }, 10);
    expect(fwd.pitch).toBeLessThan(DANGLE.forward + DANGLE.stop.give + 1e-9);
  });

  it("move the two legs out of step", () => {
    const { d } = ride({ ...HOVER, air: { x: 25, y: 0, z: 0 } }, 9);
    const a = d.legs[0];
    const b = d.legs[1];
    expect(Math.abs(a.side - b.side) + Math.abs(a.vs - b.vs)).toBeGreaterThan(0.005);
  });

  it("settle once the push lets go", () => {
    const d = ride({ ...HOVER, gravity: { x: 0, y: -9.81, z: 6 } }, 2).d;
    const still = ride({ ...HOVER, spool: 0 }, 10, d);
    expect(Math.abs(still.side)).toBeLessThan(0.03);
    expect(Math.abs(still.pitch)).toBeLessThan(0.08);
  });

  it("are drawn the same twice off the clock — and a still is skied to its moment", () => {
    const a = createDangle();
    const b = createDangle();
    const p = { ...HOVER, air: { x: 30, y: -4, z: 2 } };
    stepDangle(a, p, 0);
    stepDangle(b, p, 0);
    expect(a.legs).toEqual(b.legs);
    expect(Math.abs(a.legs[0].side)).toBeGreaterThan(0.1);
  });

  it("turn each lower leg about its knee and carry its ski with its boot", () => {
    const seat = { share: 1, y: -0.55 };
    const rest = seatedPose(STOOD, seat);
    const d = createDangle();
    d.legs[0] = { pitch: 0.5, side: 0.3, vp: 0, vs: 0 };
    d.legs[1] = { pitch: -0.2, side: -0.1, vp: 0, vs: 0 };
    const swing = swingOf(d, { ...HOVER, spool: 0 });
    const { pose, skis } = swingLegs(rest, swing, MOUNTS);
    const cuff = MOUNTS.foot.y - MOUNTS.ground;
    for (const i of [0, 1]) {
      // The bones keep their lengths.
      expect(dist(pose.knees[i], pose.hipJoints[i])).toBeCloseTo(
        dist(rest.knees[i], rest.hipJoints[i]),
        6,
      );
      expect(dist(pose.feet[i], pose.knees[i])).toBeCloseTo(dist(rest.feet[i], rest.knees[i]), 6);
      // The shin points where the swing says.
      const s = pose.feet[i];
      const k = pose.knees[i];
      const l = dist(s, k);
      expect(Math.asin((s.z - k.z) / l)).toBeCloseTo(d.legs[i].pitch, 1);
      // The ski's binding goes where the boot's sole went.
      const base = (p: typeof rest) => ({
        x: p.feet[i].x - p.boots[i].n.x * cuff - p.boots[i].f.x * MOUNTS.foot.z,
        y: p.feet[i].y - p.boots[i].n.y * cuff - p.boots[i].f.y * MOUNTS.foot.z,
        z: p.feet[i].z - p.boots[i].n.z * cuff - p.boots[i].f.z * MOUNTS.foot.z,
      });
      const b0 = base(rest);
      const b1 = base(pose);
      expect(b1.x - b0.x).toBeCloseTo(skis[i].dx, 6);
      expect(b1.y - b0.y).toBeCloseTo(skis[i].dy, 6);
      expect(b1.z - b0.z).toBeCloseTo(skis[i].dz, 6);
      // The ski turned as the boot: Rz(−rock)·Rx(−pitch) carries the boot's
      // forward where the swing took it.
      const f0 = rest.boots[i].f;
      const cp = Math.cos(-skis[i].pitch);
      const sp = Math.sin(-skis[i].pitch);
      const x1 = { x: f0.x, y: f0.y * cp - f0.z * sp, z: f0.y * sp + f0.z * cp };
      const cr = Math.cos(-skis[i].rock);
      const sr = Math.sin(-skis[i].rock);
      const f1 = { x: x1.x * cr - x1.y * sr, y: x1.x * sr + x1.y * cr, z: x1.z };
      expect(dist(f1, pose.boots[i].f)).toBeLessThan(1e-6);
    }
  });

  it("lie still on the snow: nothing of the swing drawn while the skis rest on it", () => {
    const seat = { share: 1, y: -0.92 };
    const rest = seatedPose(STOOD, seat);
    const d = createDangle();
    d.legs[0] = { pitch: 0.6, side: 0.4, vp: 0, vs: 0 };
    const swing = swingOf(d, { ...HOVER, hanging: 0 });
    const { pose, skis } = swingLegs(rest, swing, MOUNTS);
    for (const i of [0, 1]) expect(dist(pose.feet[i], rest.feet[i])).toBeLessThan(1e-9);
    for (const s of skis) {
      expect(Math.abs(s.dx) + Math.abs(s.dy) + Math.abs(s.dz) + Math.abs(s.pitch)).toBeLessThan(
        1e-9,
      );
    }
  });

  it("are the seated pose's when the seat carries no swing", () => {
    const seat = { share: 1, y: -0.55 };
    expect(seatedPose(STOOD, seat).hips).not.toEqual(skierPose(STOOD).hips);
    const d = createDangle();
    const legs = swingOf(d, { ...HOVER, hanging: 0 });
    const still = seatedPose(STOOD, { ...seat, legs });
    const sat = seatedPose(STOOD, seat);
    for (const i of [0, 1]) expect(dist(still.knees[i], sat.knees[i])).toBeLessThan(1e-9);
  });
});

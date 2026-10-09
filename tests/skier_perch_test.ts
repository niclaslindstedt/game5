// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER ON A HELICOPTER'S SKID, ABOVE THE KNEES (`skier-perch.ts`):
// level he sits still with his hands on his thighs; banked he sways with
// the pull, his head kept nearer level, his hands to the tube; hung off his
// hands he hangs straight under them, the arms up over his head.

import { describe, expect, it } from "vitest";

import {
  braceOf,
  createPerchReact,
  perchPose,
  REACT,
  stepPerchReact,
  type PerchFeel,
} from "../pwa/src/game/skier-perch.ts";
import { MOUNTS, skierPose } from "../pwa/src/game/skier-pose.ts";
import { seatPose } from "../pwa/src/game/skier-seat.ts";
import type { V3 } from "../pwa/src/game/skier-vec.ts";

const STOOD = skierPose({
  hipRight: 0,
  hipAft: 0,
  lean: 0,
  steer: 0,
  crouch: 0,
  airborne: false,
  landing: 10,
  mounts: MOUNTS,
});
const SEAT_Y = -0.55;
const SAT = seatPose(STOOD, { share: 1, y: SEAT_Y }, MOUNTS);
const LEVEL: PerchFeel = {
  gravity: { x: 0, y: -9.81, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  hung: 0,
  load: 0,
};
/** Banked 35° toward his right, in a level turn. */
const BANKED: PerchFeel = {
  gravity: { x: 9.81 * Math.tan(0.6) * 0.5, y: -9.81, z: 0 },
  up: { x: -Math.sin(0.6), y: Math.cos(0.6), z: 0 },
  hung: 0,
  load: 0,
};

const settle = (f: PerchFeel, seconds = 4) => {
  const r = createPerchReact();
  for (let k = 0; k < seconds * 60; k++) stepPerchReact(r, f, 1 / 60);
  return r;
};
const dist = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe("the skier on the skid", () => {
  it("sits still, his hands on his thighs, flown level", () => {
    const r = settle(LEVEL);
    expect(Math.abs(r.roll)).toBeLessThan(1e-6);
    expect(r.brace).toBe(0);
    const p = perchPose(SAT, STOOD, r, LEVEL, SEAT_Y, MOUNTS);
    expect(p.hands).toEqual(SAT.hands);
  });

  it("sways with a bank's pull, keeps his head nearer level and braces on the tube", () => {
    const r = settle(BANKED);
    expect(r.roll).toBeGreaterThan(0.05);
    expect(r.brace).toBeGreaterThan(0.5);
    const p = perchPose(SAT, STOOD, r, BANKED, SEAT_Y, MOUNTS);
    // The head rolled back from the trunk's sway toward the horizon.
    expect(p.headRoll).toBeLessThan(p.roll);
    // The hands most of the way off the thighs onto the tube.
    for (let i = 0; i < 2; i++) expect(p.hands[i].y).toBeLessThan(SAT.hands[i].y);
  });

  it("swings past and settles: a sway, not a snap", () => {
    const r = createPerchReact();
    let most = 0;
    for (let k = 0; k < 240; k++) {
      stepPerchReact(r, BANKED, 1 / 60);
      most = Math.max(most, r.roll);
    }
    const end = r.roll;
    expect(most).toBeGreaterThan(end * 1.05);
  });

  it("hangs off his hands over his head, upright under them", () => {
    const f: PerchFeel = { ...LEVEL, hung: 1, load: 1 };
    expect(braceOf(f)).toBe(1);
    const p = perchPose(SAT, STOOD, settle(f), f, SEAT_Y, MOUNTS);
    for (let i = 0; i < 2; i++) {
      expect(p.hands[i].y).toBeCloseTo(REACT.hang.reach, 6);
      expect(p.hands[i].y).toBeGreaterThan(p.head.y);
      // Each arm reaches its grip whole, never stretched.
      expect(dist(p.shoulders[i], p.elbows[i])).toBeCloseTo(0.31, 2);
      expect(dist(p.shoulders[i], p.hands[i])).toBeLessThanOrEqual(0.31 + 0.34 + 1e-6);
    }
    // Straight under them: the hips under the shoulders.
    expect(Math.abs(p.hips.z - (p.shoulders[0].z + p.shoulders[1].z) / 2)).toBeLessThan(0.12);
  });
});

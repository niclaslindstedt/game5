// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER'S BODY ON ITS LEGS (`skier-pose.ts`): tall at rest, folded into
// the tuck by the crouch, angulated into a carve with his hips inside and
// his shoulders held level over them, his head nearer level than his
// shoulders; a landing folds him down and he comes back up; the poles hang
// from his fists and a plant reaches one to the snow.

import { describe, expect, it } from "vitest";

import {
  createSkierSpring,
  MOUNTS,
  skierPose,
  stepSkierSpring,
} from "../pwa/src/game/skier-pose.ts";

const base = {
  hipRight: 0,
  hipAft: 0,
  lean: 0,
  steer: 0,
  crouch: 0,
  airborne: false,
  landing: 5,
};

describe("the body on its legs", () => {
  it("stands tall at rest and folds into the tuck", () => {
    const tall = skierPose(base);
    const tuck = skierPose({ ...base, crouch: 1 });
    // The hips stay over the feet, which the tuck raises toward the
    // origin: the trunk goes to near level and the hands come together
    // ahead of the face.
    expect(tuck.pitch).toBeGreaterThan(tall.pitch + 0.5);
    expect(tuck.hands[0].z).toBeGreaterThan(tall.hands[0].z + 0.2);
    expect(Math.abs(tuck.hands[0].x)).toBeLessThan(Math.abs(tall.hands[0].x));
    // The feet rise by the tuck's drop and the knees fold to take it.
    expect(tuck.feet[0].y).toBeCloseTo(tall.feet[0].y + MOUNTS.crouchDrop, 6);
    expect(tuck.knees[0].y - tuck.feet[0].y).toBeLessThan(tall.knees[0].y - tall.feet[0].y);
  });

  it("folds on a landing and springs back up", () => {
    const s = createSkierSpring();
    stepSkierSpring(s, -6, true, 1 / 60);
    let deepest = 0;
    for (let i = 0; i < 90; i++) {
      stepSkierSpring(s, 0, false, 1 / 60);
      deepest = Math.max(deepest, s.bump);
    }
    expect(deepest).toBeGreaterThan(0.1);
    expect(Math.abs(s.bump)).toBeLessThan(0.02);
    const folded = skierPose({ ...base, bump: 0.2 });
    expect(folded.hips.y).toBeLessThan(skierPose(base).hips.y - 0.15);
  });

  it("angulates into a carve: the hips inside, the shoulders levelled over them", () => {
    const carve = skierPose({ ...base, hipRight: -0.3, steer: -1, edge: -0.6 });
    expect(carve.hips.x).toBeLessThan(-0.25);
    // The trunk rolls AGAINST the hang, so the neck stands back toward
    // the centre from the hips: a hinge at the hip, not a lean.
    expect(carve.neck.x).toBeGreaterThan(carve.hips.x);
    const tilt = Math.atan2(carve.neck.x - carve.hips.x, carve.neck.y - carve.hips.y);
    const head = Math.atan2(carve.head.x - carve.neck.x, carve.head.y - carve.neck.y);
    expect(Math.abs(head)).toBeLessThan(Math.abs(tilt) + 0.3);
    // The feet go with the edge's tilt: the boots move across.
    expect(carve.feet[0].x).toBeLessThan(skierPose(base).feet[0].x);
  });

  it("hangs the poles from the fists, tucks them back in a tuck and plants one", () => {
    const stand = skierPose(base);
    expect(stand.poles).not.toBeNull();
    for (let i = 0; i < 2; i++) {
      const p = stand.poles![i];
      const h = stand.hands[i];
      expect(Math.hypot(p.x - h.x, p.y - h.y, p.z - h.z)).toBeCloseTo(MOUNTS.pole, 6);
      expect(p.y).toBeLessThan(h.y);
    }
    const tuck = skierPose({ ...base, crouch: 1 });
    expect(tuck.poles![1].z).toBeLessThan(tuck.hands[1].z - 0.5);
    const plant = skierPose({ ...base, plant: 1 });
    expect(plant.poles![1].y).toBeCloseTo(MOUNTS.ground, 2);
    expect(plant.poles![1].z).toBeGreaterThan(0.5);
  });
});

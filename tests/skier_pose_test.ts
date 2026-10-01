// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER'S BODY ON ITS LEGS (`skier-pose.ts`): tall at rest, folded into
// the tuck by the crouch, angulated into a carve with his hips inside and
// his shoulders held level over them, his head nearer level than his
// shoulders; a landing folds him down and he comes back up; the poles hang
// from his fists and a plant reaches one to the snow.

import { describe, expect, it } from "vitest";

import {
  createSkierSpring,
  gaitOf,
  MOUNTS,
  skierPose,
  stepSkierSpring,
  type SkierPose,
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

  it("works the poles without a twitch: every joint moves on through a whole cycle", () => {
    // Two strides (one each leg) sampled at 1/240 of a stride — about three
    // milliseconds at the skate's cadence — at the walk's stride, the
    // stride turning to a skate, the skate, the skate turning to a double
    // pole and the double pole. A hand at its fastest covers about a
    // centimetre a sample; the weight thrown from ski to ski or a pole
    // snapped from the snow to the hand would cover tens.
    const at = (p: SkierPose) => [p.hips, p.neck, ...p.hands, ...p.elbows, ...p.knees, ...p.poles!];
    for (const speed of [1, 2.3, 4, 7, 9.5]) {
      let prev: SkierPose | null = null;
      let worst = 0;
      for (let k = 0; k <= 480; k++) {
        const gait = gaitOf({
          drive: 1,
          stride: 3 + k / 240,
          speed,
          airborne: false,
          thrown: null,
        });
        const pose = skierPose({ ...base, gait });
        if (prev) {
          const a = at(prev);
          at(pose).forEach((b, j) => {
            worst = Math.max(worst, Math.hypot(b.x - a[j].x, b.y - a[j].y, b.z - a[j].z));
          });
        }
        prev = pose;
      }
      expect(worst, `at ${speed} m/s`).toBeLessThan(0.03);
    }
  });

  it("carries the weight across onto the gliding ski and swings the poles as rods", () => {
    const skate = (stride: number) =>
      skierPose({
        ...base,
        gait: gaitOf({ drive: 1, stride, speed: 4, airborne: false, thrown: null }),
      });
    // The left leg pushes the first stride: he starts it over the left ski
    // and ends it over the right, and the next push starts there.
    expect(skate(0).hips.x).toBeLessThan(-0.05);
    expect(skate(0.6).hips.x).toBeGreaterThan(0.05);
    expect(skate(1).hips.x).toBeCloseTo(skate(0.999).hips.x, 2);
    // A pole is never stretched or shrunk to reach the snow.
    for (const stride of [0, 0.2, 0.45, 0.7, 0.95]) {
      const p = skate(stride);
      for (let i = 0; i < 2; i++) {
        const tip = p.poles![i];
        const h = p.hands[i];
        expect(Math.hypot(tip.x - h.x, tip.y - h.y, tip.z - h.z)).toBeCloseTo(MOUNTS.pole, 6);
      }
    }
  });
});

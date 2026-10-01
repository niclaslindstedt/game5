// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER'S BODY ON ITS LEGS (`skier-pose.ts`): tall at rest, folded into
// the tuck by the crouch with his back rounded, angulated into a carve — an
// inclined column hinged at the hips, each shin held in its boot — his
// eyes held toward the horizon; compact in the air, into it and out of it
// as motions; a landing folds him down and he comes back up; the poles hang
// from his fists and a plant reaches one to the snow; stood still, he waits
// alive. And the rig his model is posed by (`skier-rig.ts`): the half bones
// turn half way, the hands hold the poles.

import { describe, expect, it } from "vitest";

import {
  createSkierSpring,
  gaitOf,
  MOUNTS,
  skierPose,
  stepSkierSpring,
  type SkierPose,
} from "../pwa/src/game/skier-pose.ts";
import { STANDING, skierBones } from "../pwa/src/game/skier-rig.ts";

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

  it("angulates into a carve: an inclined column with a hinge at the hips", () => {
    const carve = skierPose({ ...base, hipRight: -0.3, steer: -1, edge: -0.6 });
    expect(carve.hips.x).toBeLessThan(-0.2);
    // The legs lean in with the skis and the trunk leans in too, but less:
    // never thrown out past the vertical over the outside ski, never
    // leaning in as far as the legs.
    const feetX = (carve.feet[0].x + carve.feet[1].x) / 2;
    const feetY = (carve.feet[0].y + carve.feet[1].y) / 2;
    const legs = Math.atan2(carve.hips.x - feetX, carve.hips.y - feetY);
    const tilt = Math.atan2(carve.neck.x - carve.hips.x, carve.neck.y - carve.hips.y);
    expect(tilt).toBeLessThan(0.15);
    expect(tilt).toBeGreaterThan(legs + 0.15);
    // Each shin stands in its boot, tipped with its ski.
    for (const i of [0, 1]) {
      const shin = Math.atan2(
        carve.knees[i].x - carve.feet[i].x,
        carve.knees[i].y - carve.feet[i].y,
      );
      expect(shin).toBeCloseTo(-0.6, 1);
    }
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

  it("holds his eyes toward the horizon however far the pair is rolled", () => {
    // A pair rolled 0.6 rad into a left turn, the trunk on it: the head
    // keeps only a share of that lean in the world.
    const p = skierPose({ ...base, roll: -0.6, hipRight: -0.3, steer: -1, edge: -0.5 });
    const trunkWorld = -0.6 + p.roll;
    const headWorld = -0.6 + p.headRoll;
    expect(Math.abs(headWorld)).toBeLessThan(Math.abs(trunkWorld) * 0.5);
    // Never turned on the neck past what a neck turns.
    expect(Math.abs(p.headRoll - p.roll)).toBeLessThanOrEqual(0.5 + 1e-9);
  });

  it("rounds his back in the tuck, near straight standing", () => {
    const bend = (q: SkierPose) => {
      const a = { x: q.waist.x - q.hips.x, y: q.waist.y - q.hips.y, z: q.waist.z - q.hips.z };
      const b = { x: q.neck.x - q.waist.x, y: q.neck.y - q.waist.y, z: q.neck.z - q.waist.z };
      const c =
        (a.x * b.x + a.y * b.y + a.z * b.z) /
        (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z));
      return Math.acos(Math.min(1, c));
    };
    expect(bend(skierPose(base))).toBeLessThan(0.12);
    expect(bend(skierPose({ ...base, crouch: 1 }))).toBeGreaterThan(0.4);
  });

  it("flies compact and goes into the air and out of it as motions", () => {
    // In flight the knees stay bent: the body sinks toward the skis.
    const knee = (q: SkierPose) => {
      const h = q.hipJoints[0];
      const a = { x: q.knees[0].x - h.x, y: q.knees[0].y - h.y, z: q.knees[0].z - h.z };
      const b = {
        x: q.feet[0].x - q.knees[0].x,
        y: q.feet[0].y - q.knees[0].y,
        z: q.feet[0].z - q.knees[0].z,
      };
      return Math.acos(
        (a.x * b.x + a.y * b.y + a.z * b.z) /
          (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z)),
      );
    };
    expect(knee(skierPose({ ...base, airborne: true, lift: [-0.06, -0.06] }))).toBeGreaterThan(0.9);
    // The view's spring eases into the air and lets a load go over the
    // pop: neither jumps in one frame.
    const legs = createSkierSpring();
    stepSkierSpring(legs, 0, false, 1 / 60, 1);
    for (let i = 0; i < 60; i++) stepSkierSpring(legs, 0, false, 1 / 60, 1);
    expect(legs.load).toBeGreaterThan(0.95);
    stepSkierSpring(legs, 3, true, 1 / 60, 0);
    expect(legs.air).toBeLessThan(0.3);
    expect(legs.load).toBeGreaterThan(0.6);
  });

  it("waits alive when stood still, and not once he moves", () => {
    const at = (t: number, still: number) => skierPose({ ...base, idle: { t, still } });
    const a = at(1, 1);
    const b = at(4.5, 1);
    expect(Math.abs(a.look - b.look) + Math.abs(a.hips.x - b.hips.x)).toBeGreaterThan(0.02);
    expect(at(1, 0)).toEqual(at(4.5, 0));
  });
});

describe("the rig his model is posed by", () => {
  it("turns each half bone half way, and binds it on its parent", () => {
    // At rest every half bone stands as its parent does.
    const rest = skierBones(skierPose(STANDING));
    for (const [half, parent] of [
      ["hip_l", "pelvis"],
      ["knee_r", "thigh_r"],
      ["shoulder_l", "chest"],
      ["elbow_r", "upperarm_r"],
    ] as const) {
      expect(rest[half].y.x).toBeCloseTo(rest[parent].y.x, 6);
      expect(rest[half].y.y).toBeCloseTo(rest[parent].y.y, 6);
      expect(rest[half].z.z).toBeCloseTo(rest[parent].z.z, 6);
    }
    // Folded, the knee's half bone lies between the thigh and the shin.
    const tuck = skierBones(skierPose({ ...STANDING, crouch: 1 }));
    const ang = (u: { x: number; y: number; z: number }, v: typeof u) =>
      Math.acos(Math.min(1, u.x * v.x + u.y * v.y + u.z * v.z));
    const whole = ang(tuck.thigh_l.y, tuck.shin_l.y);
    expect(ang(tuck.thigh_l.y, tuck.knee_l.y)).toBeLessThan(whole * 0.75);
    expect(ang(tuck.knee_l.y, tuck.shin_l.y)).toBeLessThan(whole * 0.75);
  });

  it("closes each hand round its pole: the shaft runs up through the fist", () => {
    const p = skierPose({ ...STANDING, plant: 1 });
    const bones = skierBones(p);
    for (const [i, s] of [
      [0, "l"],
      [1, "r"],
    ] as const) {
      const hand = bones[`hand_${s}`];
      const pole = p.poles![i];
      const d = { x: p.hands[i].x - pole.x, y: p.hands[i].y - pole.y, z: p.hands[i].z - pole.z };
      const l = Math.hypot(d.x, d.y, d.z);
      expect((d.x * hand.z.x + d.y * hand.z.y + d.z * hand.z.z) / l).toBeCloseTo(1, 6);
    }
  });
});

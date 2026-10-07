// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER'S BODY ON ITS LEGS (`skier-pose.ts`): tall at rest, folded into
// the tuck by the crouch with his back rounded, angulated into a carve — an
// inclined column hinged at the hips, each shin held in its boot — his
// eyes held toward the horizon; compact in the air, into it and out of it
// as motions; a landing folds him down and he comes back up; the poles hang
// from his fists and a plant reaches one to the snow — one on every new turn
// at speed; his legs lean with the skis' edge and turn with their pivot, so
// a tucked skid never folds a knee past his hip; stood still, he waits
// alive; he sets off on his poles out of a start gate he waits in crouched
// over them, the poles biting the snow, and skates off an edged ski; into a
// turn his upper body goes first and the knees follow. And the rig his model is posed by (`skier-rig.ts`): the half bones
// turn half way, the hands hold the poles.

import { describe, expect, it } from "vitest";
import { createGame, NEUTRAL_INPUT, placeRun, rotate, skisById, step, TUNING } from "@engine";

import { flatLevel } from "./support/synthetic.ts";
import { groundOf, mountsOf, poseInputOf } from "../pwa/src/game/skis-body.ts";
import { standOf } from "../pwa/src/game/ski-stand.ts";
import {
  createSkierSpring,
  drawnSkiAngle,
  gaitOf,
  leadOf,
  MOUNTS,
  skierPose,
  STILL_GAIT,
  stepSkierSpring,
  type SkierPose,
  type V3,
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
    // milliseconds at the skate's cadence — at a walk up a rise (the
    // diagonal stride) and on the flat (setting off on the poles), the
    // walk turning to a skate, the skate, the skate turning to a double
    // pole and the double pole. A hand at its fastest covers about a
    // centimetre a sample; the weight thrown from ski to ski or a pole
    // snapped from the snow to the hand would cover tens.
    const at = (p: SkierPose) => [p.hips, p.neck, ...p.hands, ...p.elbows, ...p.knees, ...p.poles!];
    for (const [speed, pitch] of [
      [1, 0.12],
      [1, 0],
      [2.3, 0.12],
      [2.3, 0],
      [4, 0],
      [7, 0],
      [9.5, 0],
    ]) {
      let prev: SkierPose | null = null;
      let worst = 0;
      for (let k = 0; k <= 480; k++) {
        const gait = gaitOf({
          drive: 1,
          stride: 3 + k / 240,
          speed,
          pitch,
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
      expect(worst, `at ${speed} m/s, pitched ${pitch}`).toBeLessThan(0.03);
    }
  });

  it("carries the weight across onto the gliding ski and swings the poles as rods", () => {
    const skate = (stride: number) =>
      skierPose({
        ...base,
        gait: gaitOf({ drive: 1, stride, speed: 4, pitch: 0, airborne: false, thrown: null }),
      });
    // The left leg pushes the first stride: he starts it over the left ski
    // and ends it over the right, and the next push starts there — the
    // feet go under him, his centre the line the engine skis.
    const over = (p: ReturnType<typeof skate>, i: number) => Math.abs(p.feet[i].x - p.hips.x);
    expect(over(skate(0), 0)).toBeLessThan(over(skate(0), 1) - 0.1);
    expect(over(skate(0.6), 1)).toBeLessThan(over(skate(0.6), 0) - 0.1);
    expect(skate(1).feet[1].x).toBeCloseTo(skate(0.999).feet[1].x, 2);
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

  it("sets off on his poles, strides only up a rise, and his poles bite the snow", () => {
    const walk = (pitch: number, stride = 0) =>
      gaitOf({ drive: 1, stride, speed: 1, pitch, airborne: false, thrown: null });
    // Off a standstill on the flat or down a pitch he double-poles out —
    // the racer's push out of the gate — and only up a rise does he walk
    // his skis forward in the diagonal stride.
    expect(walk(0).stride).toBe(0);
    expect(walk(-0.12).stride).toBe(0);
    expect(walk(0).pole).toBeGreaterThan(0.9);
    expect(walk(0.12).stride).toBeGreaterThan(0.9);
    // In the middle of the push both poles are IN THE SNOW behind the
    // fists, the body over them: a pole pushed on is a pole that bites.
    const push = skierPose({ ...base, gait: walk(0, 0.2) });
    const feetZ = (push.feet[0].z + push.feet[1].z) / 2;
    for (let i = 0; i < 2; i++) {
      expect(push.poles![i].y).toBeCloseTo(MOUNTS.ground, 2);
      expect(push.poles![i].z).toBeLessThan(push.hands[i].z - 0.2);
    }
    expect(push.neck.z).toBeGreaterThan(feetZ + 0.2);
    // At the plant the trunk is already well over — he falls onto the
    // poles (measured double poling: 40–45° at the plant) — and the
    // fists are out ahead of him with the poles near upright.
    const plant = skierPose({ ...base, gait: walk(0, 0) });
    expect(plant.pitch).toBeGreaterThan(0.6);
    for (let i = 0; i < 2; i++) {
      expect(plant.hands[i].z).toBeGreaterThan(plant.neck.z);
      const p = plant.poles![i];
      const h = plant.hands[i];
      const fromUpright = Math.atan2(Math.hypot(p.x - h.x, p.z - h.z), h.y - p.y);
      expect(fromUpright).toBeLessThan(0.45);
    }
  });

  it("skates off his pushing ski's inside edge with his weight on the other", () => {
    const g = gaitOf({ drive: 1, stride: 0.4, speed: 4, pitch: 0, airborne: false, thrown: null });
    // The left ski (0) pushes the first stride: rolled onto its inside —
    // right — edge, out to the left and finishing behind him; the right
    // ski glides flat.
    expect(g.push).toBe(0);
    expect(g.tilt[0]).toBeGreaterThan(0.2);
    expect(g.tilt[1]).toBe(0);
    expect(g.out[0]).toBeLessThan(-0.1);
    expect(g.fore[0]).toBeLessThan(-0.1);
    const p = skierPose({ ...base, gait: g });
    // His hips are over the gliding ski, the pushing one driven out wide.
    expect(Math.abs(p.feet[1].x - p.hips.x)).toBeLessThan(0.12);
    expect(p.hips.x - p.feet[0].x).toBeGreaterThan(0.35);
  });

  it("waits in the start gate crouched over poles planted ahead of his boots", () => {
    const stand = skierPose(base);
    const gate = skierPose({ ...base, ready: 1, skid: 1 });
    // Lower and further over than stood — and the brake that holds him
    // under the lights is not drawn as a skid.
    expect(gate.hips.y).toBeLessThan(stand.hips.y - 0.05);
    expect(gate.pitch).toBeGreaterThan(stand.pitch + 0.25);
    const feetZ = (gate.feet[0].z + gate.feet[1].z) / 2;
    for (let i = 0; i < 2; i++) {
      expect(gate.poles![i].y).toBeCloseTo(MOUNTS.ground, 2);
      expect(gate.poles![i].z).toBeGreaterThan(feetZ + 0.3);
      expect(gate.poles![i].z).toBeGreaterThan(gate.hands[i].z);
    }
    // …and he goes into the gate and out of it at GO as motions.
    const legs = createSkierSpring();
    stepSkierSpring(legs, 0, false, 1 / 60, 0, undefined, true);
    expect(legs.ready).toBeGreaterThan(0);
    expect(legs.ready).toBeLessThan(0.1);
    for (let i = 0; i < 120; i++) stepSkierSpring(legs, 0, false, 1 / 60, 0, undefined, true);
    expect(legs.ready).toBeGreaterThan(0.99);
    stepSkierSpring(legs, 0, false, 1 / 60, 0, undefined, false);
    expect(legs.ready).toBeGreaterThan(0.9);
  });

  it("never folds a knee up past his hip, tucked and braking across the skis at speed", () => {
    // The tuck held through a skidded turn at 65 km/h: the pair rolled
    // into the turn, the skis pivoted across under him and on their edge,
    // the engine's hips hung inside. A skier braking rises out of his tuck
    // and his knees fold forward over the boots, never up by his shoulders.
    for (const skid of [0, 0.5, 1]) {
      for (const skiAngle of [-0.2, -0.45, -0.9]) {
        const p = skierPose({
          ...base,
          crouch: 1,
          skid,
          skiAngle: skiAngle * skid,
          edge: -0.3,
          roll: -0.55,
          hipRight: -0.35,
          steer: -1,
        });
        for (const i of [0, 1]) {
          expect(p.knees[i].y, `skid ${skid}, pivot ${skiAngle}`).toBeLessThan(
            p.hipJoints[i].y + 0.02,
          );
        }
      }
    }
  });

  it("leans his legs with the skis' edge, and turns them with the skis' pivot", () => {
    // Edged, flat in the hang: the boots hold the shins tipped with the
    // skis, so the hips go over to where the shins point, less what the
    // knees angulate by themselves.
    const legLean = (p: SkierPose) =>
      Math.atan2(
        p.hips.x - (p.feet[0].x + p.feet[1].x) / 2,
        p.hips.y - (p.feet[0].y + p.feet[1].y) / 2,
      );
    for (const edge of [0.3, 0.6, 0.9]) {
      const lean = legLean(skierPose({ ...base, edge }));
      expect(lean, `edge ${edge}`).toBeGreaterThan(edge - 0.45);
      expect(lean, `edge ${edge}`).toBeLessThan(edge + 0.1);
    }
    // Hung inside by the engine with the skis flat under him (the pair
    // already rolled into the turn): no more than the knees allow.
    expect(Math.abs(legLean(skierPose({ ...base, hipRight: 0.35, edge: 0 })))).toBeLessThan(0.16);
    // Pivoted across in a hockey stop, the hips stand behind the boots
    // along the skis, not off to the side of them.
    const stop = skierPose({ ...base, skiAngle: 1.2, skid: 1 });
    const along = { x: Math.sin(1.2), z: Math.cos(1.2) };
    const off = {
      x: stop.hips.x - (stop.feet[0].x + stop.feet[1].x) / 2,
      z: stop.hips.z - (stop.feet[0].z + stop.feet[1].z) / 2,
    };
    expect(Math.abs(off.x * along.z - off.z * along.x)).toBeLessThan(0.05);
  });

  it("plants a pole on each new turn, a rod swung to the snow and back without a jump", () => {
    // The spring times the plant: a turn held, then the edge over to the
    // other side starts one on the new turn's inside pole — none while
    // tucked.
    const ride = (edge: number, crouch = 0) => ({
      edge,
      speed: 12,
      crouch,
      drive: 0,
      hipRight: 0.3 * Math.sign(edge),
      roll: 0,
    });
    const legs = createSkierSpring();
    for (let i = 0; i < 60; i++) stepSkierSpring(legs, 0, false, 1 / 60, 0, ride(-0.5));
    stepSkierSpring(legs, 0, false, 1 / 60, 0, ride(0.5));
    expect(legs.plantSide).toBe(1);
    expect(legs.plantT).toBeLessThan(0.05);
    const tucked = createSkierSpring();
    for (let i = 0; i < 60; i++) stepSkierSpring(tucked, 0, false, 1 / 60, 0, ride(-0.5, 1));
    stepSkierSpring(tucked, 0, false, 1 / 60, 0, ride(0.5, 1));
    expect(tucked.plantT).toBe(Number.POSITIVE_INFINITY);
    // The plant itself, sampled finely: the pole a rod of its own length,
    // its basket on the snow at the touch, nothing moving more than a
    // couple of centimetres between neighbouring samples.
    let prev: SkierPose | null = null;
    let worst = 0;
    let lowest = Infinity;
    for (let k = 0; k <= 400; k++) {
      const p = skierPose({ ...base, plantAt: { side: 1, t: k / 400, weight: 1 } });
      const tip = p.poles![1];
      const h = p.hands[1];
      expect(Math.hypot(tip.x - h.x, tip.y - h.y, tip.z - h.z)).toBeCloseTo(MOUNTS.pole, 6);
      lowest = Math.min(lowest, tip.y);
      if (prev) {
        const a = [prev.hands[1], prev.elbows[1], prev.poles![1]];
        [h, p.elbows[1], tip].forEach((b, j) => {
          worst = Math.max(worst, Math.hypot(b.x - a[j].x, b.y - a[j].y, b.z - a[j].z));
        });
      }
      prev = p;
    }
    expect(worst).toBeLessThan(0.03);
    // On the snow at the touch, and never into it.
    expect(lowest).toBeLessThan(MOUNTS.ground + 0.02);
    expect(lowest).toBeGreaterThan(MOUNTS.ground - 0.01);
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

describe("the upper body leads a turn", () => {
  // A turn skied through the engine down the 20° pitch, the key pressed
  // at `press` s (from straight, or from a turn the other way), the pose
  // taken as the game takes it at 60 Hz: how far the head, the shoulders
  // and the knees have gone across into the new turn off the feet, m, IN
  // THE WORLD (the pair's own roll with them — what the eye sees), at each
  // frame after the press — and the lead left at the end.
  const turn = (kmh: number, from: -1 | 0) => {
    const spec = skisById("chamois");
    const mounts = mountsOf(spec);
    const state = createGame({
      level: flatLevel({ packed: 1, grade: 0.364, slopeFrom: 200, size: 4000 }),
      spec,
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
    placeRun(state, { x: 2000, z: 600, heading: 0, speed: kmh / 3.6 });
    const legs = createSkierSpring();
    const press = 1.2;
    const t0 = state.t;
    let at0: { head: number; sh: number; knee: number } | null = null;
    const frames: { t: number; head: number; sh: number; knee: number }[] = [];
    for (let i = 0; i < 2 * TUNING.physicsHz; i++) {
      const t = state.t - t0;
      step(state, { ...NEUTRAL_INPUT, steer: t < 0.2 ? 0 : t < press ? from : 1 });
      if (i % 2 === 0) continue;
      const c = state.skier;
      stepSkierSpring(legs, c.vy, c.airborne, 2 * TUNING.dt, 0, c);
      const stand = standOf(c, groundOf(c, legs), undefined, undefined, drawnSkiAngle(legs, c));
      const p = skierPose(poseInputOf(c, legs, mounts, null, false, stand));
      const mid = (a: V3, b: V3): V3 => ({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        z: (a.z + b.z) / 2,
      });
      const feet = mid(p.feet[0], p.feet[1]);
      // Across the way he was heading, positive to his right.
      const across = (v: V3): number => {
        const w = rotate(c.q, { x: v.x - feet.x, y: v.y - feet.y, z: v.z - feet.z });
        return w.x * Math.cos(c.heading) - w.z * Math.sin(c.heading);
      };
      const now = {
        head: across(p.head),
        sh: across(mid(p.shoulders[0], p.shoulders[1])),
        knee: across(mid(p.knees[0], p.knees[1])),
      };
      if (state.t - t0 <= press) at0 = now;
      else if (at0) {
        frames.push({
          t: state.t - t0 - press,
          head: now.head - at0.head,
          sh: now.sh - at0.sh,
          knee: now.knee - at0.knee,
        });
      }
    }
    return { frames, lead: leadOf(legs) };
  };

  it("moves the head and the shoulders into a turn ahead of the knees, never out of it first", () => {
    for (const [kmh, from] of [
      [40, 0],
      [70, 0],
      [60, -1],
    ] as const) {
      const { frames, lead } = turn(kmh, from);
      for (const f of frames.filter((f) => f.t < 0.25)) {
        expect(f.head, `${kmh} km/h at ${f.t.toFixed(3)} s`).toBeGreaterThan(-0.005);
        expect(f.sh, `${kmh} km/h at ${f.t.toFixed(3)} s`).toBeGreaterThan(-0.005);
      }
      for (const f of frames.filter((f) => f.t > 0.06 && f.t < 0.25)) {
        expect(f.head, `${kmh} km/h at ${f.t.toFixed(3)} s`).toBeGreaterThan(f.knee);
        expect(f.sh, `${kmh} km/h at ${f.t.toFixed(3)} s`).toBeGreaterThan(f.knee);
      }
      // …and once the legs have caught up, the lead is spent.
      expect(Math.abs(lead)).toBeLessThan(0.05);
    }
  });
});

describe("the knees, the jump and the poles held to the snow", () => {
  // How far a knee stands off its hip-to-boot line across the pair, m —
  // positive to the skier's right.
  const bow = (p: SkierPose, i: number): number => {
    const h = p.hipJoints[i];
    const f = p.feet[i];
    const k = p.knees[i];
    const dx = f.x - h.x;
    const dy = f.y - h.y;
    return ((h.x - k.x) * dy - (h.y - k.y) * dx) / Math.hypot(dx, dy);
  };

  it("bows no knee out of a turn whose roll has run past the edge", () => {
    // A right turn the engine has rolled further than the skis are edged:
    // the skis tip to the LEFT in the pair's frame, against the turn.
    const edge = 0.83;
    const roll = 0.97;
    const tilt = edge - roll;
    const p = skierPose({
      ...base,
      hipRight: 0.34,
      steer: 1,
      roll,
      edge: tilt,
      body: { tilt, roll },
    });
    const stand = skierPose(base);
    for (const i of [0, 1]) expect(bow(p, i)).toBeGreaterThan(bow(stand, i) - 0.01);
  });

  it("sinks deeper loading a jump in the tuck, and springs off it still folded", () => {
    const tuck = skierPose({ ...base, crouch: 1, tuck: 1 });
    const loading = skierPose({ ...base, crouch: 1, tuck: 1, jumpLoad: 1 });
    expect(loading.hips.y).toBeLessThan(tuck.hips.y - 0.05);
    const popped = skierPose({ ...base, crouch: 1, tuck: 1, popped: 0.18 });
    expect(popped.hips.y).toBeCloseTo(tuck.hips.y, 3);
    expect(popped.pitch).toBeCloseTo(tuck.pitch, 3);
    // Stood up, he still rises into the pop.
    const standing = skierPose({ ...base, crouch: 0.5, tuck: 0, popped: 0.18 });
    expect(standing.hips.y).toBeGreaterThan(skierPose({ ...base, crouch: 0.5, tuck: 0 }).hips.y);
  });

  it("holds a planted basket where it bit through the middle of a push", () => {
    const duty = TUNING.poles.duty;
    const pass = 2.5;
    const at = (phase: number) =>
      skierPose({
        ...base,
        gait: { ...STILL_GAIT, pole: 1, pass, phase },
      });
    const plant = at(0).poles!;
    for (const u of [0.3, 0.45, 0.6]) {
      const p = at(u * duty);
      for (const i of [0, 1]) {
        // Gone back along him by the snow passed, and on the snow.
        expect(p.poles![i].z).toBeCloseTo(plant[i].z - pass * u * duty, 2);
        expect(p.poles![i].y).toBeCloseTo(MOUNTS.ground, 2);
      }
    }
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

describe("riding switch (skier-switch.ts)", () => {
  it("is nothing at all riding forward", () => {
    expect(skierPose({ ...base, switched: 0 })).toEqual(skierPose(base));
  });

  it("turns him to look back over a shoulder: the head round past square, the trunk with it", () => {
    for (const side of [-1, 1]) {
      const pose = skierPose({ ...base, switched: side });
      const ahead = skierPose(base);
      // The head's yaw in the body frame is half the look (`headAxes`):
      // turned more than a right angle, toward the side asked.
      expect(Math.sign(pose.look)).toBe(side);
      expect(Math.abs(pose.look * 0.5)).toBeGreaterThan(Math.PI / 2);
      // The shoulders turned the same way, the hips a little lower.
      const across = (p: SkierPose) =>
        Math.atan2(-(p.shoulders[1].z - p.shoulders[0].z), p.shoulders[1].x - p.shoulders[0].x);
      expect(Math.sign(across(pose) - across(ahead))).toBe(side);
      expect(pose.hips.y).toBeLessThan(ahead.hips.y);
      // ...and the poles trail behind the way he goes: toward his tips.
      for (const i of [0, 1]) expect(pose.poles![i].z).toBeGreaterThan(pose.hands[i].z);
      // The hands DROPPED low by his sides, under where he carries them
      // riding forward; the baskets clear of the snow.
      for (const i of [0, 1]) {
        expect(pose.hands[i].y).toBeLessThan(ahead.hands[i].y);
        expect(pose.poles![i].y).toBeGreaterThan(MOUNTS.ground);
      }
    }
  });

  it("tucked switch, keeps his fists low beside his knees, never up behind his back", () => {
    const pose = skierPose({ ...base, crouch: 1, switched: 1 });
    for (const i of [0, 1]) {
      expect(pose.hands[i].y).toBeLessThan(pose.shoulders[i].y - 0.2);
      expect(pose.hands[i].z).toBeGreaterThan(pose.hips.z);
    }
  });

  it("turns his head while he rides tails first on the snow, and keeps the shoulder", () => {
    const legs = createSkierSpring();
    const ride = { edge: 0, speed: 6, crouch: 0, drive: 0, hipRight: 0.1, roll: 0, switched: true };
    for (let i = 0; i < 60; i++) stepSkierSpring(legs, 0, false, 1 / 60, 0, ride);
    expect(legs.back).toBeGreaterThan(0.9);
    const side = legs.backSide;
    // A turn the other way does not flick his head to the other shoulder.
    for (let i = 0; i < 60; i++)
      stepSkierSpring(legs, 0, false, 1 / 60, 0, { ...ride, hipRight: -0.1 });
    expect(legs.backSide).toBe(side);
    for (let i = 0; i < 60; i++)
      stepSkierSpring(legs, 0, false, 1 / 60, 0, { ...ride, switched: false });
    expect(legs.back).toBeLessThan(0.1);
  });
});

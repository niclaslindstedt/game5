// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIS ON THE SNOW, AS DRAWN (`ski-stand.ts`): turning and stopping,
// both drawn skis stay on the snow the engine stands them on — the body
// turned about its feet, the inside leg short, the pair pivoted in the
// snow's plane — where a pair drawn rolled with the body hung its outside
// ski a quarter of a metre and more in the air; the outside ski carries
// most of him, by a measured share that falls with speed; and the pose
// takes the inside leg's shortening at the pelvis and the hips, never by
// folding a knee further than a skier's folds. And at speed the pair
// CHATTERS (`ski-chatter.ts`): each ski hops up off the snow and flaps on
// the snow passed under it, out of step with the other, by as much as the
// engine says it is shaking.

import { describe, expect, it } from "vitest";
import { createGame, placeRun, skisById, step, TUNING, type GameState } from "@engine";

import { gearLift } from "../pwa/src/game/ski-gear.ts";
import { groundOf, mountsOf, poseInputOf } from "../pwa/src/game/skis-body.ts";
import { emptyStand, outsideShare, skiGaps, standOf, turnOf } from "../pwa/src/game/ski-stand.ts";
import { KNEE_MOST } from "../pwa/src/game/skier-limbs.ts";
import {
  CHATTER_LOOK,
  createChatter,
  shakeStand,
  stepChatter,
} from "../pwa/src/game/ski-chatter.ts";
import {
  createSkierSpring,
  drawnSkiAngle,
  skierPose,
  stepSkierSpring,
} from "../pwa/src/game/skier-pose.ts";
import { flatLevel } from "./support/synthetic.ts";

const PITCH = Math.tan(Math.PI / 9);
const IDLE = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };
const spec = skisById("chamois");

type Input = typeof IDLE & { carve?: boolean };

/** A move skied on a 20° groomed pitch from `kmh`, every other step handed
 * to `look` with the view's spring stepped as the game steps it. */
function ski(
  kmh: number,
  seconds: number,
  input: (t: number) => Input,
  look: (state: GameState, legs: ReturnType<typeof createSkierSpring>, t: number) => void,
  grade = PITCH,
): void {
  const level = flatLevel({ packed: 1, grade, slopeFrom: 200, size: 4000 });
  const state = createGame({ level, spec, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: 2000, z: 600, heading: 0, speed: kmh / 3.6 });
  const legs = createSkierSpring();
  const t0 = state.t;
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) {
    step(state, input(state.t - t0));
    if (i % 2 === 0) continue;
    const c = state.skier;
    stepSkierSpring(
      legs,
      c.vy,
      c.airborne,
      2 * TUNING.dt,
      c.jumpLoad / TUNING.jump.full,
      c,
      false,
      undefined,
      (gearLift(c)[0] + gearLift(c)[1]) / 2,
    );
    look(state, legs, state.t - t0);
  }
}

const linked = (t: number): Input => ({
  ...IDLE,
  steer: t < 0.3 ? 0 : Math.floor((t - 0.3) / 1.1) % 2 ? 1 : -1,
});
const hockey = (t: number): Input => ({
  ...IDLE,
  brake: t >= 0.3 ? 1 : 0,
  steer: t >= 0.5 ? 1 : 0,
});

/** The worst gap either drawn ski stands off (or into) the snow over a
 * move, m — laid as the game lays it, or as it was laid before: rolled
 * with the body, each ski pivoted on its own binding (`flat`). */
function worstGap(kmh: number, input: (t: number) => Input, flat = false, grade = PITCH): number {
  let worst = 0;
  ski(
    kmh,
    3,
    input,
    (state, legs) => {
      const c = state.skier;
      if (c.airborne) return;
      const angle = drawnSkiAngle(legs, c);
      const stand = flat
        ? { ...emptyStand(), lift: gearLift(c) }
        : standOf(c, groundOf(c, legs), undefined, undefined, angle);
      for (const g of skiGaps(c, stand, state.level, angle)) worst = Math.max(worst, Math.abs(g));
    },
    grade,
  );
  return worst;
}

describe("the skis on the snow, as drawn", () => {
  it("keeps both skis on the snow through linked turns, where a pair rolled with the body floated", () => {
    expect(worstGap(40, linked, true)).toBeGreaterThan(0.25);
    expect(worstGap(40, linked)).toBeLessThan(0.04);
  });

  it("keeps both skis flat on the snow through a hockey stop, the pair pivoted in the snow's plane", () => {
    expect(worstGap(50, hockey, true, 0)).toBeGreaterThan(0.12);
    expect(worstGap(50, hockey, false, 0)).toBeLessThan(0.05);
    expect(worstGap(50, hockey)).toBeLessThan(0.05);
  });

  it("lays the inside ski higher toward the body and the outside one lower, by the stance's rise", () => {
    let seen = 0;
    ski(45, 1.6, linked, (state, legs, t) => {
      const c = state.skier;
      if (t < 0.9 || Math.abs(c.incline) < 0.3) return;
      const stand = standOf(c, groundOf(c, legs));
      const inside = c.incline > 0 ? 1 : 0;
      expect(stand.lift[inside]).toBeGreaterThan(stand.lift[1 - inside] + 0.05);
      // The body is pivoted about the feet: its origin goes inside the turn.
      expect(Math.sign(stand.pivot.x)).toBe(Math.sign(c.incline));
      seen++;
    });
    expect(seen).toBeGreaterThan(10);
  });

  it("stands a flying skier's skis under his body, as before: no pivot in the air", () => {
    const level = flatLevel({ packed: 1 });
    const state = createGame({ level, spec, rivals: 0, countdown: 0, quiet: true });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 10, height: 3 });
    const stand = standOf(state.skier, 0, emptyStand());
    expect(Math.hypot(stand.pivot.x, stand.pivot.y)).toBeLessThan(1e-9);
    expect(Math.hypot(...stand.out)).toBeLessThan(1e-9);
  });
});

describe("the load between the skis", () => {
  it("puts most of it on the outside ski, by a measured share that falls with speed", () => {
    expect(outsideShare(3)).toBeCloseTo(0.95);
    expect(outsideShare(12)).toBeCloseTo(0.77);
    expect(outsideShare(30)).toBeCloseTo(0.66);
    let turning = 0;
    ski(45, 3, linked, (state) => {
      const c = state.skier;
      const turn = turnOf(c);
      if (Math.abs(turn) < 0.9) return;
      const share = standOf(c, 1).share;
      const outside = turn > 0 ? share[0] : share[1];
      expect(outside).toBeGreaterThan(0.6);
      expect(outside).toBeLessThan(0.97);
      expect(share[0] + share[1]).toBeCloseTo(1);
      turning++;
    });
    expect(turning).toBeGreaterThan(20);
  });

  it("shares it evenly running straight and stood still, and loads nothing off the snow", () => {
    ski(
      40,
      0.2,
      () => IDLE,
      (state) => {
        const share = standOf(state.skier, 1).share;
        expect(share[0]).toBeCloseTo(0.5, 2);
      },
    );
    const level = flatLevel({ packed: 1 });
    const state = createGame({ level, spec, rivals: 0, countdown: 0, quiet: true });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 10, height: 3 });
    step(state, IDLE);
    expect(standOf(state.skier, 0).share).toEqual([0, 0]);
  });
});

describe("the knees on an inclined stance", () => {
  /** A knee's flexion off the pose, rad (0 straight). */
  const flexion = (
    hip: { x: number; y: number; z: number },
    knee: typeof hip,
    foot: typeof hip,
  ) => {
    const a = { x: knee.x - hip.x, y: knee.y - hip.y, z: knee.z - hip.z };
    const b = { x: foot.x - knee.x, y: foot.y - knee.y, z: foot.z - knee.z };
    const dot = a.x * b.x + a.y * b.y + a.z * b.z;
    return Math.acos(dot / Math.hypot(a.x, a.y, a.z) / Math.hypot(b.x, b.y, b.z));
  };

  it("never folds a knee past a skier's, the hips bending instead, in turns, a tucked skid and a stop", () => {
    const mounts = mountsOf(spec);
    const tuckedSkid = (t: number): Input => ({
      ...IDLE,
      tuck: 1,
      steer: t >= 0.2 ? -1 : 0,
      brake: t >= 0.4 && t < 1.6 ? 0.7 : 0,
    });
    for (const [kmh, input] of [
      [45, linked],
      [65, tuckedSkid],
      [50, hockey],
    ] as const) {
      ski(kmh, 2.5, input, (state, legs) => {
        const c = state.skier;
        if (c.thrown || c.airborne) return;
        const p = skierPose(poseInputOf(c, legs, mounts, null));
        const most = KNEE_MOST.bent + (KNEE_MOST.tucked - KNEE_MOST.bent) * c.crouch;
        for (const i of [0, 1]) {
          expect(flexion(p.hipJoints[i], p.knees[i], p.feet[i])).toBeLessThan(most + 0.02);
        }
      });
    }
  });

  it("tilts the pelvis up over the inside ski, so the outside knee bends too", () => {
    const mounts = mountsOf(spec);
    let seen = 0;
    ski(45, 2.2, linked, (state, legs, t) => {
      const c = state.skier;
      if (t < 0.9 || Math.abs(c.incline) < 0.5) return;
      const p = skierPose(poseInputOf(c, legs, mounts, null));
      const inside = c.incline > 0 ? 1 : 0;
      expect(p.hipJoints[inside].y).toBeGreaterThan(p.hipJoints[1 - inside].y + 0.04);
      const outside = flexion(p.hipJoints[1 - inside], p.knees[1 - inside], p.feet[1 - inside]);
      expect(outside).toBeGreaterThan(0.45);
      seen++;
    });
    expect(seen).toBeGreaterThan(5);
  });
});

describe("the skis chattering at speed", () => {
  it("shakes the pair by the engine's chatter, up off the snow and out of step", () => {
    let still = 0;
    let shook = 0;
    let apart = 0;
    let worst = 0;
    const view = createChatter();
    ski(
      110,
      1.5,
      (t) => ({ ...IDLE, tuck: 0.6, steer: t >= 0.2 ? -0.7 : 0 }),
      (state, legs) => {
        const c = state.skier;
        stepChatter(view, c, 2 * TUNING.dt);
        const ground = groundOf(c, legs);
        const stand = standOf(c, ground);
        const lift = [...stand.lift];
        shakeStand(stand, c, ground, view);
        for (let i = 0; i < 2; i++) {
          const hop = stand.lift[i] - lift[i];
          // Only ever thrown UP, and never more than the look's whole.
          expect(hop).toBeGreaterThanOrEqual(0);
          expect(hop).toBeLessThanOrEqual(CHATTER_LOOK.lift + 1e-9);
          expect(Math.abs(stand.pitch[i])).toBeLessThanOrEqual(CHATTER_LOOK.pitch + 1e-9);
          worst = Math.max(worst, Math.abs(stand.pitch[i]));
        }
        apart = Math.max(apart, Math.abs(stand.pitch[0] - stand.pitch[1]));
        if (c.chatter > 0.3) shook++;
        else still++;
      },
    );
    expect(shook).toBeGreaterThan(still);
    expect(worst).toBeGreaterThan(0.01);
    expect(apart).toBeGreaterThan(0.01);
  });

  it("leaves a slow pair alone", () => {
    ski(
      20,
      1,
      (t) => ({ ...IDLE, steer: t >= 0.2 ? -0.7 : 0 }),
      (state, legs) => {
        const stand = standOf(state.skier, groundOf(state.skier, legs));
        const lift = [...stand.lift];
        shakeStand(stand, state.skier, 1, createChatter());
        expect(stand.lift).toEqual(lift);
        expect(stand.pitch).toEqual([0, 0]);
      },
    );
  });
});

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WITHOUT POLES — the player's hard mode (`SkierState.poles`,
// `TUNING.poles.bare`): the push is his legs' alone and never a double
// pole, a rise holds less of it, he keeps less of his balance, and the
// figure works its arms with nothing in its hands. Staged on the drag strip.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  SKIS,
  TUNING,
  climbShare,
  crashLimit,
  createGame,
  driveForce,
  placeRun,
  skateShare,
  step,
  type GameState,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";
import { reproOf, reproQuery } from "../pwa/src/game/debug-readout.ts";
import { freeGameOptions, freshRide } from "../pwa/src/game/free-ride.ts";
import { carriesPoles, DEFAULT_OUTFIT, RIVAL_OUTFITS, stepGear } from "../pwa/src/game/outfit.ts";
import { freshSettings, mergeSettings } from "../pwa/src/game/settings.ts";
import { gaitOf, skierPose } from "../pwa/src/game/skier-pose.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

const B = TUNING.poles.bare;

function stage(grade: number, poles: boolean): GameState {
  const level = flatLevel({ packed: 1, grade, slopeFrom: 200, size: 4000 });
  const state = createGame({ level, spec: SKIS, rivals: 0, countdown: 0, quiet: true, poles });
  // Up the strip's slope (it falls along +z), or along the flat.
  placeRun(state, {
    x: 2000,
    z: grade > 0 ? 1500 : 400,
    heading: grade > 0 ? Math.PI : 0,
    pitch: Math.atan(grade),
    speed: 1,
  });
  return state;
}

/** Ride `seconds` with the tuck held — the skier asked to go — and the way
 * made good along his start heading, m. */
function ride(state: GameState, seconds: number): number {
  const z0 = state.skier.z;
  const dir = Math.cos(state.skier.heading);
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) step(state, { ...NEUTRAL_INPUT, tuck: 1 });
  return (state.skier.z - z0) * dir;
}

describe("the push without poles (poles.ts)", () => {
  it("is the legs' share of the power, and skates at every speed — no double pole", () => {
    expect(driveForce(SKIS, 4, 1, 1, false)).toBeCloseTo(B.legs * driveForce(SKIS, 4, 1, 1), 6);
    expect(skateShare(TUNING.poles.skateTo + 1)).toBe(0);
    expect(skateShare(TUNING.poles.skateTo + 1, false)).toBe(1);
  });

  it("holds less of a push up a rise, and all of it with poles or on the flat", () => {
    expect(climbShare(0.2)).toBe(1);
    expect(climbShare(0, false)).toBe(1);
    expect(climbShare(B.climb.to, false)).toBeCloseTo(B.climb.least, 6);
  });

  it("is the poled skier's to the bit when the poles are on (no digest moves)", () => {
    const a = stage(0, true);
    const b = createGame({ level: a.level, spec: SKIS, rivals: 0, countdown: 0, quiet: true });
    expect(b.skier.poles).toBe(true);
  });

  it("carries him slower across the flat", () => {
    const poled = stage(0, true);
    const bare = stage(0, false);
    ride(poled, 15);
    ride(bare, 15);
    expect(bare.skier.speed).toBeLessThan(0.9 * poled.skier.speed);
    // Still a skater's pace: he is slower, not stuck.
    expect(bare.skier.speed * 3.6).toBeGreaterThan(14);
  });

  it("climbs a rise he would skate up on his poles only slowly, and not a steeper one at all", () => {
    const poled = stage(0.04, true);
    const bare = stage(0.04, false);
    const up = ride(poled, 15);
    const barely = ride(bare, 15);
    expect(up).toBeGreaterThan(40);
    expect(barely).toBeLessThan(0.75 * up);
    // An 8 % rise: up it on his poles, and a crawl without them — ten
    // seconds, before the engine's own reset calls him stuck.
    expect(ride(stage(0.08, true), 10)).toBeGreaterThan(25);
    expect(ride(stage(0.08, false), 10)).toBeLessThan(10);
  });
});

describe("the balance without poles (crash.ts)", () => {
  it("brings every threshold toward the club skier's by the share of resilience lost", () => {
    const pro = createGame({ level: flatLevel(), quiet: true }).skier;
    const bare = createGame({ level: flatLevel(), quiet: true, poles: false }).skier;
    expect(crashLimit(pro, "legsFold")).toBe(TUNING.crash.legsFold);
    const want =
      TUNING.crash.legsFold -
      (TUNING.crash.legsFold - TUNING.crash.club.legsFold) * (1 - B.balance);
    expect(crashLimit(bare, "legsFold")).toBeCloseTo(want, 6);
    expect(crashLimit(bare, "catchEdge")).toBeLessThan(crashLimit(pro, "catchEdge"));
  });
});

const BASE = {
  hipRight: 0,
  hipAft: 0,
  lean: 0,
  steer: 0,
  crouch: 0,
  airborne: false,
  landing: 10,
};
const rolling = (stride: number, speed: number, poles: boolean) =>
  gaitOf({ drive: 1, stride, speed, pitch: 0, airborne: false, thrown: null, poles });

describe("the figure without poles (skier-gait.ts, skier-bare.ts)", () => {
  it("never double-poles: it skates where a poled skier would pole", () => {
    // Rolling at 27 km/h, where a poled skier has gone over to his poles.
    const fast = 7.5;
    expect(rolling(0.2, fast, true).pole).toBeGreaterThan(0.5);
    const bare = rolling(0.2, fast, false);
    expect(bare.pole).toBe(0);
    expect(bare.skate).toBeGreaterThan(0.5);
  });

  it("walks his skis off on the flat, where a poled skier pushes off on his poles", () => {
    expect(rolling(0.2, 0.5, true).stride).toBe(0);
    expect(rolling(0.2, 0.5, false).stride).toBeGreaterThan(0.5);
  });

  it("holds nothing: no poles drawn, whatever he is doing", () => {
    expect(skierPose(BASE).poles).not.toBeNull();
    expect(skierPose({ ...BASE, poles: false }).poles).toBeNull();
    const plant = { side: 0 as const, t: 0.35, weight: 1 };
    expect(skierPose({ ...BASE, poles: false, plantAt: plant, ready: 1 }).poles).toBeNull();
  });

  it("carries his hands where a skier does riding: forward, a little wider — never winged out", () => {
    // The coaching is the same with poles or without: the hands forward,
    // a little wider than the shoulders, in sight, the elbows soft.
    const poled = skierPose(BASE);
    const bare = skierPose({ ...BASE, poles: false });
    const span = (p: typeof poled) => p.hands[1].x - p.hands[0].x;
    expect(span(bare)).toBeGreaterThan(span(poled) - 0.02);
    expect(span(bare)).toBeLessThan(span(poled) + 0.12);
    for (const i of [0, 1]) expect(bare.hands[i].z).toBeGreaterThan(bare.hips.z + 0.2);
  });

  it("waits in the gate with his hands on his knees, not over planted poles", () => {
    const p = skierPose({ ...BASE, poles: false, ready: 1 });
    for (const i of [0, 1]) {
      const d = Math.hypot(
        p.hands[i].x - p.knees[i].x,
        p.hands[i].y - p.knees[i].y,
        p.hands[i].z - p.knees[i].z,
      );
      expect(d).toBeLessThan(0.15);
    }
  });

  it("lets his arms hang by his sides stood still, and holds no fist out at the grips", () => {
    const still = skierPose({ ...BASE, poles: false, idle: { t: 0, still: 1 } });
    const riding = skierPose({ ...BASE, poles: false });
    const poled = skierPose(BASE);
    for (const i of [0, 1]) {
      expect(still.hands[i].y).toBeLessThan(riding.hands[i].y - 0.1);
      expect(still.hands[i].y).toBeLessThan(still.hips.y);
      // Riding, nearer his body and lower than a pole's grip is held.
      expect(riding.hands[i].z).toBeLessThan(poled.hands[i].z - 0.08);
      expect(riding.hands[i].y).toBeLessThan(poled.hands[i].y);
    }
  });

  it("swings his arms opposite the legs, as the free skate is coached", () => {
    // "With the left leg gliding, the right arm is extended forward,
    // forearm over the gliding ski, while the left forearm is extended to
    // the rear": through the glide after the RIGHT leg's push, the right
    // arm forward and across, the left one back past the hips.
    const speed = 6;
    const gait = rolling(1.8, speed, false);
    expect(gait.push).toBe(1);
    const p = skierPose({ ...BASE, gait, poles: false });
    expect(p.hands[1].z).toBeGreaterThan(p.hands[0].z + 0.4);
    expect(p.hands[0].z).toBeLessThan(p.hips.z);
    expect(p.hands[1].x).toBeLessThan(p.shoulders[1].x - 0.1);
    // ...and after the left leg's, the other way about.
    const next = skierPose({ ...BASE, gait: rolling(2.8, speed, false), poles: false });
    expect(next.hands[0].z).toBeGreaterThan(next.hands[1].z + 0.4);
    expect(next.hands[0].x).toBeGreaterThan(next.shoulders[0].x + 0.1);
  });

  it("swings them smoothly: no fist jumps at a change of leg, none bobs on its own", () => {
    const speed = 5;
    let last: ReturnType<typeof skierPose> | null = null;
    let low = Infinity;
    let high = -Infinity;
    for (let k = 0; k <= 200; k++) {
      const p = skierPose({ ...BASE, gait: rolling(1 + k / 100, speed, false), poles: false });
      if (last) {
        for (const i of [0, 1]) {
          const d = Math.hypot(
            p.hands[i].x - last.hands[i].x,
            p.hands[i].y - last.hands[i].y,
            p.hands[i].z - last.hands[i].z,
          );
          // A hundredth of a stride: a fist moves a few centimetres at most.
          expect(d).toBeLessThan(0.04);
        }
      }
      // The fist's height off its own shoulder: an arm swung, not shaken.
      const y = p.hands[0].y - p.shoulders[0].y;
      low = Math.min(low, y);
      high = Math.max(high, y);
      last = p;
    }
    expect(high - low).toBeLessThan(0.25);
  });
});

describe("the pick (outfit.ts, settings.ts, url-params.ts)", () => {
  it("is the DRESS card's POLES row: NONE, kept with the outfit, and poles unless picked", () => {
    expect(carriesPoles(freshSettings().outfit)).toBe(true);
    expect(carriesPoles(DEFAULT_OUTFIT)).toBe(true);
    const bare = mergeSettings({ outfit: { ...DEFAULT_OUTFIT, poles: "none" } });
    expect(carriesPoles(bare.outfit)).toBe(false);
    expect(stepGear(DEFAULT_OUTFIT, "poles", -1).poles).toBe("none");
    expect(RIVAL_OUTFITS.every(carriesPoles)).toBe(true);
  });

  it("is a link's for the visit, and a repro link carries it", () => {
    expect(readParams("").poles).toBeNull();
    expect(readParams("?poles=0").poles).toBe(false);
    expect(readParams("?poles=1").poles).toBe(true);
    const bare = createGame({ level: flatLevel(), quiet: true, poles: false });
    expect(reproQuery(reproOf(bare, "slalom", "chase"))).toContain("poles=0");
    const poled = createGame({ level: flatLevel(), quiet: true });
    expect(reproQuery(reproOf(poled, "slalom", "chase"))).not.toContain("poles");
  });

  it("stands a free ride up without poles", () => {
    expect(freeGameOptions(freshRide(), 9, { spec: SKIS, assist: { yaw: 1, air: 1 } }).poles).toBe(
      true,
    );
    expect(
      freeGameOptions(freshRide(), 9, { spec: SKIS, assist: { yaw: 1, air: 1 }, poles: false })
        .poles,
    ).toBe(false);
  });
});

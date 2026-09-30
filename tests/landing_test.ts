// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LANDING'S LOAD (`flight.ts`'s `landingLoad`, `landingTolerance`,
// `landingOff`; the `landing` wipeout in `crash.ts`): the speed into the
// slope as an equivalent fall height, stopped over the legs and the snow's
// give — and the bigger that load, the truer the skis must come down.

import { describe, expect, it } from "vitest";
import {
  SKIS,
  TUNING,
  createGame,
  fallHeight,
  landingLoad,
  landingTolerance,
  placeRun,
  step,
  type GameEvent,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

const TUCK = { steer: 0, tuck: 1, brake: 0, lean: 0, reset: false };

/** Drop a skier from `height` m (his CoG over the snow) at 70 km/h onto a
 * flat strip and report the landing and whether he was thrown by it. */
function drop(opts: { packed: number; height: number; roll?: number; snow?: number }) {
  const level = flatLevel({ packed: opts.packed });
  const state = createGame({
    level,
    spec: SKIS,
    rivals: 0,
    countdown: 0,
    quiet: true,
    snowDepth: opts.snow,
  });
  placeRun(state, {
    x: level.size / 2,
    z: 200,
    heading: 0,
    speed: 70 / 3.6,
    height: opts.height,
    roll: opts.roll ?? 0,
  });
  let land: Extract<GameEvent, { kind: "land" }> | null = null;
  let thrown: string | null = null;
  for (let i = 0; i < 4 * TUNING.physicsHz; i++) {
    step(state, TUCK);
    for (const e of state.events) {
      if (e.kind === "land" && !land) land = e;
      if (e.kind === "wipeout" && !thrown) thrown = e.cause;
    }
  }
  return { land, thrown };
}

describe("the landing's load", () => {
  it("reads the speed into the slope as the drop from rest that meets it as hard", () => {
    expect(fallHeight(Math.sqrt(2 * TUNING.g * 1.5))).toBeCloseTo(1.5, 6);
  });

  it("is softened by the snow's give and hardened by a tuck", () => {
    const groomer = landingLoad(8, 0, 0);
    expect(landingLoad(8, 0, 0.4)).toBeLessThan(groomer);
    expect(landingLoad(8, 1, 0)).toBeGreaterThan(groomer);
    expect(landingLoad(0, 0, 0)).toBe(1);
  });

  it("forgives less the bigger it is, and nothing past the buckle", () => {
    const L = TUNING.landing;
    expect(landingTolerance(1)).toBe(1 + L.slack);
    expect(landingTolerance(L.clean)).toBe(1);
    expect(landingTolerance((L.clean + L.buckle) / 2)).toBeLessThan(1);
    expect(landingTolerance(L.buckle - 1e-6)).toBeLessThan(landingTolerance(L.clean + 1));
    expect(landingTolerance(L.buckle - 1e-6)).toBeCloseTo(L.tight, 3);
    expect(landingTolerance(L.buckle)).toBe(0);
  });
});

describe("a landing ridden away, or not", () => {
  it("rides away a drop taken true on the groomer", () => {
    const { land, thrown } = drop({ packed: 1, height: 2.5 });
    expect(land).not.toBeNull();
    expect(thrown).toBeNull();
  });

  it("buckles under a big drop onto the flat groomer, however true", () => {
    const { land, thrown } = drop({ packed: 1, height: 9 });
    expect(land!.g).toBeGreaterThan(TUNING.landing.buckle);
    expect(thrown).toBe("landing");
  });

  it("rides the same big drop away into a metre of powder, the snow taking the fall", () => {
    const groomer = drop({ packed: 1, height: 9 });
    const powder = drop({ packed: 0, height: 9, snow: 2.5 });
    expect(powder.land!.g).toBeLessThan(groomer.land!.g * 0.5);
    expect(powder.thrown).toBeNull();
  });

  it("needs a big landing truer than a small one: a roll ridden off a hop throws him off a drop", () => {
    expect(drop({ packed: 1, height: 1.4, roll: 0.5 }).thrown).toBeNull();
    expect(drop({ packed: 1, height: 4, roll: 0.5 }).thrown).not.toBeNull();
  });
});

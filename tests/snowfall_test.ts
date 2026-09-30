// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW IN THE AIR AND THE SNOW IT LAYS (`engine/game/snowfall.ts`): the
// fall at a moment as a pure function of the map and the clock, the view it
// leaves, and the NEW SNOW a run builds up — slow enough that a race never
// feels it, fast enough that an hour in a storm buries the groomer — read
// by the physics through `packedUnder` / `depthUnder`.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  TUNING,
  createGame,
  depthUnder,
  freshRate,
  packedUnder,
  placeRun,
  snowAt,
  step,
  visibilityIn,
  weatherFor,
  withSky,
} from "@engine";

import { flatLevel, syntheticLevel } from "./support/synthetic.ts";

const storm = withSky(syntheticLevel(), { weather: { kind: "storm", snowfall: 0.9 } });
const flurries = withSky(syntheticLevel(), { weather: { kind: "flurries", snowfall: 0.2 } });

/** The new snow `seconds` of a sky lays, m, integrated as the engine does. */
function laid(level: typeof storm, seconds: number): number {
  let fresh = 0;
  for (let t = 0; t < seconds; t += 1) fresh += freshRate(snowAt(level, t).fall);
  return fresh;
}

describe("the fall at a moment", () => {
  it("is nothing out of a sky that does not snow", () => {
    for (const kind of ["clear", "fair", "high", "overcast", "fog"] as const) {
      const level = withSky(syntheticLevel(), { weather: kind });
      expect(snowAt(level, 30).fall).toBe(0);
      expect(snowAt(level, 30).visibility).toBeGreaterThan(5000);
    }
  });

  it("is a pure function of the map and the clock, breathing in squalls round the dealt mean", () => {
    expect(snowAt(storm, 71.5)).toEqual(snowAt(storm, 71.5));
    let lo = 1;
    let hi = 0;
    let sum = 0;
    for (let t = 0; t < 1200; t += 2) {
      const f = snowAt(storm, t).fall;
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
      lo = Math.min(lo, f);
      hi = Math.max(hi, f);
      sum += f;
    }
    expect(hi - lo).toBeGreaterThan(0.2);
    expect(sum / 600).toBeGreaterThan(0.75);
    // A flurry comes and goes.
    let quiet = 0;
    for (let t = 0; t < 1200; t += 2) if (snowAt(flurries, t).fall < 0.05) quiet++;
    expect(quiet).toBeGreaterThan(0);
  });

  it("closes the view as it thickens: kilometres in a flurry, tens of metres in a blizzard", () => {
    expect(visibilityIn(0.1)).toBeGreaterThan(1000);
    expect(visibilityIn(0.5)).toBeLessThan(300);
    expect(visibilityIn(1)).toBeLessThan(60);
    expect(visibilityIn(0.6)).toBeLessThan(visibilityIn(0.5));
  });
});

describe("the new snow", () => {
  it("builds at a real fall's rate: a blizzard's hand an hour, a flurry's millimetres", () => {
    const hour = laid(storm, 3600);
    expect(hour).toBeGreaterThan(0.04);
    expect(hour).toBeLessThan(0.1);
    expect(laid(flurries, 3600)).toBeLessThan(0.005);
    // Nothing a three-lap race can feel.
    expect(laid(storm, 200)).toBeLessThan(0.006);
  });

  it("is laid by the step, shared with the field, and the same on every run of the map", () => {
    const a = createGame({ level: storm, rivals: 2, countdown: 0, quiet: true });
    const b = createGame({ level: storm, rivals: 2, countdown: 0, quiet: true });
    for (let i = 0; i < 600; i++) {
      step(a, NEUTRAL_INPUT);
      step(b, NEUTRAL_INPUT);
    }
    expect(a.fresh).toBeGreaterThan(0);
    expect(a.fresh).toBe(b.fresh);
    for (const rival of a.rivals) expect(rival.run.fresh).toBe(a.fresh);
    const clear = createGame({ level: syntheticLevel(), countdown: 0, quiet: true });
    for (let i = 0; i < 600; i++) step(clear, NEUTRAL_INPUT);
    expect(clear.fresh).toBe(0);
  });

  it("buries the groomer and deepens the powder", () => {
    expect(packedUnder(1, 0)).toBe(1);
    expect(packedUnder(1, TUNING.snow.freshBury / 2)).toBeCloseTo(0.5, 6);
    expect(packedUnder(1, TUNING.snow.freshBury * 2)).toBe(0);
    expect(packedUnder(0, 0.1)).toBe(0);
    expect(depthUnder(1, TUNING.snow.powderSink)).toBeCloseTo(2, 6);
  });

  it("is FELT: the same skier on the same groomer is slower under an hour of storm", () => {
    const run = (fresh: number): number => {
      const state = createGame({
        level: flatLevel({ packed: 1 }),
        fresh,
        countdown: 0,
        quiet: true,
      });
      placeRun(state, { x: 1500, z: 200, heading: 0, speed: 0 });
      const input = { ...NEUTRAL_INPUT, tuck: 1 };
      for (let i = 0; i < 8 / TUNING.dt; i++) step(state, input);
      return state.skier.speed;
    };
    const groomed = run(0);
    const buried = run(0.07);
    expect(buried).toBeLessThan(groomed * 0.97);
  });

  it("reads the dealt fall when a sky is asked for by name", () => {
    const w = weatherFor("storm");
    expect(w.snowfall).toBeGreaterThanOrEqual(0.75);
    expect(w.wind).toBeGreaterThan(10);
  });
});

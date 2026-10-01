// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MAP RATING (engine/rating/): eight axes, each 0..1, folded into one
// index on weights that sum to one — and the ladder scorer that reads a run
// of ratings as a climb. What the scales ARE is a calibration against a sweep
// (`make rate COUNT=96 ARGS=--stats`) and is not asserted here; what is
// asserted is the arithmetic every ladder is argued with, and that each axis
// moves the way its name says when the thing it measures does.

import { describe, expect, it } from "vitest";

import {
  LADDER,
  RATING,
  RATING_AXES,
  characterDistance,
  leadingAxis,
  rateLadder,
  rateLevel,
  skyWeight,
  weatherFor,
  withSky,
  type MapRating,
} from "@engine";

import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const ratings = LEVEL_SEEDS.slice(0, 4).map((seed) => rateLevel(levelFor(seed)));

describe("a map's rating", () => {
  it("weighs its eight axes into one index, the weights summing to one", () => {
    const sum = RATING_AXES.reduce((acc, axis) => acc + RATING.weight[axis], 0);
    expect(sum).toBeCloseTo(1, 9);
    for (const r of ratings) {
      let index = 0;
      for (const axis of RATING_AXES) {
        expect(r.axes[axis], `${r.seed} ${axis}`).toBeGreaterThanOrEqual(0);
        expect(r.axes[axis], `${r.seed} ${axis}`).toBeLessThanOrEqual(1);
        index += r.axes[axis] * RATING.weight[axis];
      }
      expect(r.difficulty).toBeCloseTo(index, 9);
    }
  });

  it("reads the piste the map publishes", () => {
    for (const [i, r] of ratings.entries()) {
      const level = levelFor(LEVEL_SEEDS[i]);
      expect(r.seed).toBe(level.seed);
      expect(r.stats.length).toBe(level.track.length);
      expect(r.stats.kickers).toBe(level.kickers.filter((k) => k.onTrack).length);
      expect(r.stats.tightest).toBeGreaterThan(0);
      expect(r.stats.walled).toBeGreaterThanOrEqual(0);
      expect(r.stats.walled).toBeLessThanOrEqual(1);
      expect(r.stats.measured).toBe(false);
    }
  });

  it("takes a measured run over the estimate, and a slower run asks more", () => {
    const level = levelFor(LEVEL_SEEDS[0]);
    const fast = rateLevel(level, { runSeconds: RATING.scale.run.min });
    const slow = rateLevel(level, { runSeconds: RATING.scale.run.max });
    expect(fast.stats.measured).toBe(true);
    expect(fast.axes.length).toBe(0);
    expect(slow.axes.length).toBe(1);
    expect(slow.difficulty).toBeGreaterThan(fast.difficulty);
  });

  it("asks more under a heavier sky and in the dark, and moves nothing of the map", () => {
    // On the spring equinox, so a clear noon stands the sun well over
    // `RATING.scale.sunHigh` wherever the map lies: the day is the map's own
    // (every course of a ski area is dealt one, R15), and a midwinter noon
    // at a high latitude honestly reads a little dark — the sky's zero is a
    // clear sky with the sun high, not any noon at all.
    const built = levelFor(LEVEL_SEEDS[1]);
    const level = { ...built, sun: { ...built.sun, dayOfYear: 80 } };
    const clear = rateLevel(level, { sky: { weather: "clear", hour: 12 } });
    const night = rateLevel(level, { sky: { weather: { kind: "snow", snowfall: 1 }, hour: 23 } });
    expect(clear.axes.weather).toBe(0);
    expect(night.axes.weather).toBe(1);
    expect(night.difficulty).toBeGreaterThan(clear.difficulty);
    for (const axis of [
      "length",
      "bends",
      "steepness",
      "air",
      "woods",
      "traverses",
      "powder",
    ] as const) {
      expect(night.axes[axis]).toBe(clear.axes[axis]);
    }
    // The sky it reads is the one the run would be stood up under.
    expect(rateLevel(withSky(level, { weather: "fog" })).stats.weather).toBe("fog");
  });

  it("weighs a sky by how thick it is", () => {
    expect(skyWeight(weatherFor("clear"))).toBe(0);
    expect(skyWeight(weatherFor("fog", { fog: 1 }))).toBeGreaterThan(
      skyWeight(weatherFor("fog", { fog: 0.4 })),
    );
    expect(skyWeight(weatherFor("snow", { snowfall: 1 }))).toBeCloseTo(1, 9);
  });

  it("names the axis a map leads on, and how unlike two maps are", () => {
    const r = ratings[0];
    const lead = leadingAxis(r.axes);
    for (const axis of RATING_AXES) expect(r.axes[lead]).toBeGreaterThanOrEqual(r.axes[axis]);
    expect(characterDistance(r.axes, r.axes)).toBe(0);
    expect(characterDistance(ratings[0].axes, ratings[1].axes)).toBeGreaterThan(0);
  });
});

describe("the ladder scorer", () => {
  const rung = (
    name: string,
    difficulty: number,
    lead = 0,
  ): { name: string; rating: MapRating } => {
    const axes = Object.fromEntries(RATING_AXES.map((a, i) => [a, i === lead ? 1 : 0]));
    return { name, rating: { ...ratings[0], axes: axes as MapRating["axes"], difficulty } };
  };

  it("passes a ladder that climbs without a wall and never repeats a map", () => {
    const report = rateLadder([rung("a", 0.2, 0), rung("b", 0.3, 1), rung("c", 0.4, 2)]);
    expect(report.notes).toEqual([]);
    expect(report.climb).toBeCloseTo(0.1, 9);
    expect(report.wall).toBeCloseTo(0.1, 9);
  });

  it("names a step down, a wall and the same map twice", () => {
    const report = rateLadder([
      rung("a", 0.3, 0),
      rung("b", 0.25, 1),
      rung("c", 0.25 + LADDER.wall + 0.01, 2),
      rung("d", 0.8, 2),
    ]);
    expect(report.notes.some((n) => n.startsWith("b asks less than a"))).toBe(true);
    expect(report.notes.some((n) => n.startsWith("c is a wall after b"))).toBe(true);
    expect(report.notes.some((n) => n.startsWith("c and d are the same map twice"))).toBe(true);
  });
});

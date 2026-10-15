// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW OLD THE SNOW IS (`pwa/src/game/snow-age.ts`): the loose snow's surface
// a run is drawn with — new, old, wind-packed, sun-crusted, hoar, wet — dealt
// off the map's seed and its sky, never the engine's stream.

import { describe, expect, it } from "vitest";

import { weatherFor, type Level, type WeatherKind } from "@engine";

import { daysSince, SNOW_AGE_KINDS, snowAgeOf, WET_SUN } from "../pwa/src/game/snow-age.ts";
import { snowpackOf } from "../pwa/src/game/snowpack.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const deg = Math.PI / 180;

function under(kind: WeatherKind, seed = 7): Pick<Level, "seed" | "sun" | "weather"> {
  const level = syntheticLevel();
  return { seed, sun: level.sun, weather: weatherFor(kind) };
}

describe("snow age", () => {
  it("a falling sky lays new snow: no days, all fresh, nothing aged", () => {
    for (const kind of ["flurries", "snow", "storm"] as const) {
      const a = snowAgeOf(under(kind));
      expect(a.days).toBe(0);
      expect(a.fresh).toBe(1);
      expect(a.old).toBe(0);
      expect(a.crust + a.hoar + a.wet + a.wind).toBe(0);
    }
  });

  it("deals the days off the seed alone, the same twice, in the sky's band", () => {
    const sky = weatherFor("clear");
    for (let seed = 1; seed < 60; seed++) {
      const d = daysSince(seed, sky);
      expect(d).toBe(daysSince(seed, sky));
      expect(d).toBeGreaterThan(0.3);
      expect(d).toBeLessThanOrEqual(16);
    }
    for (let seed = 1; seed < 30; seed++) {
      expect(daysSince(seed, weatherFor("overcast"))).toBeLessThanOrEqual(5);
    }
  });

  it("ages monotonically: the new look fades as the old one comes", () => {
    let last = { fresh: 2, old: -1 };
    const seeds = Array.from({ length: 40 }, (_, i) => i + 1)
      .map((seed) => ({ seed, days: daysSince(seed, weatherFor("clear")) }))
      .sort((a, b) => a.days - b.days);
    for (const { seed } of seeds) {
      const a = snowAgeOf(under("clear", seed));
      expect(a.fresh).toBeLessThanOrEqual(last.fresh);
      expect(a.old).toBeGreaterThanOrEqual(last.old);
      last = a;
    }
  });

  it("wets only under a high sun, and never a falling sky", () => {
    const low = snowAgeOf(under("clear"), { elevation: WET_SUN.from - 2 * deg });
    expect(low.wet).toBe(0);
    const snowing = snowAgeOf(under("snow"), { elevation: 60 * deg });
    expect(snowing.wet).toBe(0);
  });

  it("wets in warm air whatever the sky, and keeps dry in deep cold under any sun", () => {
    expect(snowAgeOf(under("overcast"), { elevation: 5 * deg, air: 4 }).wet).toBe(1);
    expect(snowAgeOf(under("snow"), { elevation: 5 * deg, air: 3 }).wet).toBe(1);
    expect(snowAgeOf(under("clear"), { elevation: 60 * deg, air: -15 }).wet).toBe(0);
    // ...and with no air handed it, reads the map's own (the synthetic
    // slope's March noon at the slopes' altitude: cold, dry snow).
    expect(snowAgeOf(under("clear"), { elevation: 5 * deg }).wet).toBe(0);
  });

  it("every forced kind is in range, and points the noon sun level", () => {
    for (const kind of SNOW_AGE_KINDS) {
      const a = snowAgeOf(under("clear"), { force: kind });
      for (const v of [a.fresh, a.old, a.wind, a.crust, a.hoar, a.wet]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(Math.hypot(a.noon.x, a.noon.z)).toBeCloseTo(1, 6);
    }
    expect(snowAgeOf(under("clear"), { force: "hoar" }).hoar).toBe(1);
    expect(snowAgeOf(under("clear"), { force: "fresh" }).fresh).toBe(1);
  });

  it("rides on the run's snowpack, and a lab's force reaches it", () => {
    const level = syntheticLevel();
    const pack = snowpackOf(level, { age: "crust" });
    expect(pack.age?.crust).toBe(1);
    expect(snowpackOf(level).age).not.toBeNull();
  });
});

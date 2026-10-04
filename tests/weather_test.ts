// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R19 — THE WEATHER, and the night it may bring: which sky a map is dealt,
// that dealing it moves nothing the map builds, the evening start R15 now
// allows, the wind as a pure field, the moon — and the sky's colour model
// answering to all of it (`pwa/src/game/sky.ts`, three-free).

import { describe, expect, it } from "vitest";
import {
  LEVEL_RULES,
  WEATHER_KINDS,
  analyzeLevel,
  createGame,
  dealWeather,
  generateLevel,
  moonAt,
  sunAtRun,
  snows,
  sunsetOf,
  weatherFor,
  weatherOf,
  windAt,
  withSky,
  type WeatherKind,
} from "@engine";

import { skyLookAt, skyLookFor } from "../pwa/src/game/sky.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const R = LEVEL_RULES.weather;
const DAY = { hour: 12, dayOfYear: 40, latitude: 58 };

describe("R19 — the weather is dealt", () => {
  const N = 4000;
  const dealt = Array.from({ length: N }, (_, i) => dealWeather((i * 2654435761) >>> 0, DAY));

  it("deals every sky at about its odds", () => {
    for (const kind of WEATHER_KINDS) {
      const share = dealt.filter((d) => d.weather.kind === kind).length / N;
      expect(share).toBeGreaterThan(R.odds[kind] - 0.03);
      expect(share).toBeLessThan(R.odds[kind] + 0.03);
    }
    const sum = WEATHER_KINDS.reduce((a, k) => a + R.odds[k], 0);
    expect(sum).toBeCloseTo(1, 9);
  });

  it("keeps every number in its band, and a fall from a flurry to a blizzard", () => {
    const falls: number[] = [];
    for (const { weather: w } of dealt) {
      const band = R.wind[w.kind];
      expect(w.wind).toBeGreaterThanOrEqual(band.min);
      expect(w.wind).toBeLessThanOrEqual(band.max);
      if (snows(w.kind)) {
        expect(w.snowfall).toBeGreaterThanOrEqual(R.snowfall[w.kind].min);
        expect(w.snowfall).toBeLessThanOrEqual(R.snowfall[w.kind].max);
        falls.push(w.snowfall);
      } else expect(w.snowfall).toBe(0);
      if (w.kind !== "fog") expect(w.fog).toBe(0);
    }
    expect(Math.min(...falls)).toBeLessThan(0.1);
    expect(Math.max(...falls)).toBeGreaterThan(0.95);
    // A harder fall is a harder wind, and a storm a gale.
    const snow = dealt.filter((d) => d.weather.kind === "snow").map((d) => d.weather);
    const hard = snow.filter((w) => w.snowfall > 0.65);
    const soft = snow.filter((w) => w.snowfall < 0.4);
    const mean = (ws: typeof snow) => ws.reduce((a, w) => a + w.wind, 0) / ws.length;
    expect(mean(hard)).toBeGreaterThan(mean(soft) + 3);
    const storms = dealt.filter((d) => d.weather.kind === "storm").map((d) => d.weather);
    expect(mean(storms)).toBeGreaterThan(mean(hard) + 3);
  });

  it("deals a sun in the sky most days", () => {
    const sunny = dealt.filter((d) =>
      ["clear", "fair", "flurries", "high"].includes(d.weather.kind),
    );
    expect(sunny.length / N).toBeGreaterThan(0.66);
  });

  it("sends about a quarter of the maps out in the evening, from sunset into the dark", () => {
    const evenings = dealt.filter((d) => d.weather.evening);
    expect(evenings.length / N).toBeGreaterThan(R.evening - 0.03);
    expect(evenings.length / N).toBeLessThan(R.evening + 0.03);
    const sunset = sunsetOf(DAY);
    for (const d of evenings) {
      expect(d.hour - sunset).toBeGreaterThanOrEqual(LEVEL_RULES.sun.evening.min - 1e-9);
      expect(d.hour - sunset).toBeLessThanOrEqual(LEVEL_RULES.sun.evening.max + 1e-9);
    }
    for (const d of dealt.filter((x) => !x.weather.evening)) expect(d.hour).toBe(DAY.hour);
  });

  it("publishes a weather on every map, clean under R15 and R19", () => {
    let dark = 0;
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      expect(WEATHER_KINDS).toContain(level.weather.kind);
      const findings = analyzeLevel(level).findings.filter(
        (f) => f.rule === "R15" || f.rule === "R19",
      );
      expect(findings).toEqual([]);
      if (sunAtRun(level).elevation < -0.1) dark++;
    }
    // Over a wider sweep some maps are raced in the dark.
    for (let seed = 1; seed <= 12 && dark === 0; seed++) {
      const { weather, hour } = dealWeather(seed * 7919, DAY);
      if (weather.evening && hour > sunsetOf(DAY) + 1.5) dark++;
    }
    expect(dark).toBeGreaterThan(0);
  });
});

describe("a sky chosen by hand", () => {
  it("moves nothing the map builds", () => {
    const seed = LEVEL_SEEDS[1];
    const dealt = levelFor(seed);
    const fog = generateLevel(seed, { sky: { weather: "fog", hour: 22 } });
    expect(fog.weather.kind).toBe("fog");
    expect(fog.sun.hour).toBe(22);
    expect(fog.ground.data).toEqual(dealt.ground.data);
    expect(fog.packed.data).toEqual(dealt.packed.data);
    expect(fog.trees).toEqual(dealt.trees);
    expect(fog.track.points).toEqual(dealt.track.points);
    expect(fog.sun.dayOfYear).toBe(dealt.sun.dayOfYear);
  });

  it("takes a kind at its typical numbers, and named fields over them", () => {
    for (const kind of WEATHER_KINDS) {
      const w = weatherFor(kind);
      expect(w.kind).toBe(kind);
      expect(w.wind).toBeGreaterThanOrEqual(R.wind[kind].min);
      expect(w.wind).toBeLessThanOrEqual(R.wind[kind].max);
    }
    const blizzard = weatherFor("snow", { snowfall: 1 });
    expect(blizzard.wind).toBeGreaterThan(weatherFor("snow").wind);
    const level = withSky(syntheticLevel(), { weather: { kind: "snow", snowfall: 0.2 } });
    expect(weatherOf(level).snowfall).toBe(0.2);
  });

  it("reaches a race through createGame", () => {
    const game = createGame({ seed: LEVEL_SEEDS[0], sky: { weather: "overcast" }, quiet: true });
    expect(weatherOf(game.level).kind).toBe("overcast");
  });

  it("rides a hand-built map under a clear sky", () => {
    expect(weatherOf(syntheticLevel()).kind).toBe("clear");
  });
});

describe("the wind", () => {
  it("is a pure function of the map and the clock, round the dealt mean", () => {
    const level = withSky(levelFor(LEVEL_SEEDS[2]), { weather: { kind: "snow", wind: 10 } });
    const a = windAt(level, 12.5);
    const b = windAt(level, 12.5);
    expect(a).toEqual(b);
    let sum = 0;
    let lo = Infinity;
    let hi = -Infinity;
    for (let t = 0; t < 600; t += 0.5) {
      const w = windAt(level, t);
      sum += w.speed;
      lo = Math.min(lo, w.speed);
      hi = Math.max(hi, w.speed);
      expect(Math.hypot(w.x, w.z)).toBeCloseTo(w.speed, 6);
    }
    expect(sum / 1200).toBeGreaterThan(9);
    expect(sum / 1200).toBeLessThan(11);
    expect(hi - lo).toBeGreaterThan(4);
  });

  it("draws nothing from the run's stream", () => {
    const game = createGame({ seed: LEVEL_SEEDS[0], quiet: true });
    const before = game.rng.next();
    const again = createGame({ seed: LEVEL_SEEDS[0], quiet: true });
    for (let t = 0; t < 30; t++) windAt(again.level, t);
    expect(again.rng.next()).toBe(before);
  });
});

describe("the moon", () => {
  it("is full opposite the sun and new beside it", () => {
    const full = moonAt(0, 60, -15, 29.53 / 2);
    expect(full.lit).toBeCloseTo(1, 3);
    expect(full.elevation).toBeGreaterThan(0.5);
    const fresh = moonAt(12, 60, -15, 0);
    expect(fresh.lit).toBeCloseTo(0, 6);
  });
});

describe("the sky under each weather", () => {
  const noon = (kind: WeatherKind) => skyLookFor(Math.PI, 0.35, undefined, weatherFor(kind));

  it("turns the light flat and the key down under a lid", () => {
    const clear = noon("clear");
    for (const kind of ["overcast", "snow", "storm", "fog"] as const) {
      const lid = noon(kind);
      expect(lid.flat).toBeGreaterThan(0.6);
      expect(lid.glitter).toBeLessThan(0.3);
      expect(lid.keyIntensity).toBeLessThan(clear.keyIntensity * 0.35);
      expect(lid.cloud.genus).toBe(3);
    }
    expect(clear.flat).toBe(0);
    expect(clear.glitter).toBe(1);
    expect(noon("fair").cloud.genus).toBe(1);
    expect(noon("high").cloud.genus).toBe(2);
    // A flurry keeps the sun; a storm's deck is darker than an overcast's,
    // and an overcast's darker than the snow under it.
    expect(noon("flurries").keyIntensity).toBeGreaterThan(clear.keyIntensity * 0.8);
    expect(noon("flurries").snowfall).toBeGreaterThan(0);
    const sum = (c: number[]) => c[0] + c[1] + c[2];
    expect(sum(noon("storm").zenith)).toBeLessThan(sum(noon("overcast").zenith) * 0.5);
    expect(sum(noon("overcast").zenith)).toBeLessThan(sum(noon("overcast").groundLight));
    expect(noon("storm").lamps).toBeGreaterThan(0.5);
  });

  it("thickens the haze with the fall and the fog", () => {
    const light = skyLookFor(Math.PI, 0.35, undefined, weatherFor("snow", { snowfall: 0.3 }));
    const blizzard = skyLookFor(Math.PI, 0.35, undefined, weatherFor("storm", { snowfall: 1 }));
    expect(blizzard.haze).toBeGreaterThan(light.haze * 3);
    expect(blizzard.snowfall).toBe(1);
    // A blizzard leaves a few tens of metres to see by: the haze has taken
    // nineteen parts in twenty of the light by then.
    expect(1 - Math.exp(-60 * blizzard.haze)).toBeGreaterThan(0.95);
    expect(noon("fog").haze).toBeGreaterThan(noon("clear").haze * 10);
    expect(noon("fog").hazeLift).toBeLessThan(noon("clear").hazeLift);
  });

  it("goes dark after sunset: stars out, the key passed to the moon, the lamps on", () => {
    const moon = { azimuth: 0, elevation: 0.6, lit: 1 };
    const day = skyLookFor(Math.PI, 0.35, moon);
    const night = skyLookFor(Math.PI, -0.45, moon);
    expect(day.lamps).toBeLessThan(0.05);
    expect(day.stars).toBe(0);
    expect(night.night).toBeGreaterThan(0.95);
    expect(night.stars).toBeGreaterThan(0.2);
    // The Milky Way only in a dark sky: gone under a full moon, out when
    // it is down.
    expect(skyLookFor(Math.PI, -0.45).galaxy).toBeGreaterThan(0.9);
    expect(night.galaxy).toBeLessThan(0.2);
    expect(day.galaxy).toBe(0);
    expect(night.lamps).toBeGreaterThan(0.95);
    expect(night.key.y).toBeCloseTo(Math.sin(0.6), 6);
    expect(night.keyIntensity).toBeGreaterThan(0);
    // A lid hides the stars; a moonless night is darker than a moonlit one.
    expect(skyLookFor(Math.PI, -0.45, moon, weatherFor("overcast")).stars).toBe(0);
    const dark = skyLookFor(Math.PI, -0.45);
    expect(dark.ambient).toBeLessThan(night.ambient);
  });

  it("reads the level's own weather", () => {
    const level = withSky(syntheticLevel(), { weather: "fog", hour: 12 });
    expect(skyLookAt(level).fog).toBeGreaterThan(0);
  });
});

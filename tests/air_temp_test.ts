// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR TEMPERATURE (`engine/game/air-temp.ts`): the day's mean off the
// lake-ice year, the sky's own air and the day's cycle over it, the lapse
// with altitude, a snowing sky held at the snow's, the start card's knob,
// the free air aloft up to the tropopause — and none of it moving a map.

import { describe, expect, it } from "vitest";

import {
  AIR_TEMP,
  airOn,
  airTempAt,
  dealFront,
  freeAirTempAt,
  generateLevel,
  levelDigest,
  tropopauseOf,
  weatherFor,
  withSky,
  type TempLevel,
  type WeatherKind,
} from "@engine";

/** A day of the year from a month and a day of it. */
const MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const on = (month: number, day: number): number => MONTH[month - 1] + day;

/** An alpine map at 46° N, its valley floor at 1000 m and 1500 m of
 * vertical over it, on `day` at solar `hour` under `kind`. */
function map(day: number, hour: number, kind: WeatherKind = "clear", temp?: number): TempLevel {
  return {
    sun: { hour, dayOfYear: day, latitude: 46 },
    weather: { ...weatherFor(kind), ...(temp === undefined ? {} : { temp }) },
    mountain: { altitude: 1000, vertical: 1500, sea: 0 },
  };
}

describe("the air through the year and the day", () => {
  it("is well below zero at 2000 m on a January noon, above it at the base on a spring afternoon", () => {
    expect(airTempAt(map(on(1, 20), 12), undefined, 2000)).toBeLessThan(-5);
    expect(airTempAt(map(on(3, 21), 14.5))).toBeGreaterThan(0);
  });

  it("is coldest about sunrise and warmest in the afternoon", () => {
    const at = (h: number): number => airTempAt(map(on(2, 10), h));
    expect(at(14.5)).toBeGreaterThan(at(10));
    expect(at(10)).toBeGreaterThan(at(7));
    expect(at(19)).toBeLessThan(at(14.5));
    // Its mean over the day is the lake-ice year's, the sky's own air on it.
    let sum = 0;
    for (let h = 0; h < 24; h += 0.25) sum += at(h);
    expect(sum / 96).toBeCloseTo(airOn(on(2, 10), 46, 1000, "alpine") + AIR_TEMP.sky.clear, 0);
  });

  it("is colder on a clear night than an overcast one, and swings less under a lid", () => {
    const night = (kind: WeatherKind): number => airTempAt(map(on(1, 20), 4, kind));
    expect(night("clear")).toBeLessThan(night("overcast") - 2);
    const swing = (kind: WeatherKind): number =>
      airTempAt(map(on(1, 20), 14.5, kind)) - airTempAt(map(on(1, 20), 7, kind));
    expect(swing("clear")).toBeGreaterThan(swing("overcast") * 2);
    expect(swing("storm")).toBeLessThan(swing("snow"));
  });

  it("cools with altitude", () => {
    const m = map(on(1, 20), 12);
    expect(airTempAt(m, undefined, 2500)).toBeLessThan(airTempAt(m, undefined, 1800));
    expect(airTempAt(m, undefined, 1800)).toBeLessThan(airTempAt(m));
    // ...at the lake-ice year's lapse, near enough (the cycle is smaller up high).
    const drop =
      airTempAt(map(on(1, 20), 9.5), undefined, 1000) -
      airTempAt(map(on(1, 20), 9.5), undefined, 2000);
    expect(drop).toBeGreaterThan(4);
    expect(drop).toBeLessThan(8);
  });

  it("holds a snowing sky at the snow's air, never the model's warmer one", () => {
    const snowing = map(on(4, 20), 14, "snow");
    const dry = map(on(4, 20), 14, "overcast");
    expect(airTempAt(dry)).toBeGreaterThan(AIR_TEMP.snowing + 1);
    expect(airTempAt(snowing)).toBeLessThanOrEqual(AIR_TEMP.snowing + 1e-9);
  });

  it("moves with the sky's clock", () => {
    const m = map(on(2, 10), 7);
    // Five minutes of run at the default rate is an hour of sun.
    expect(airTempAt(m, 300)).toBeCloseTo(airTempAt(map(on(2, 10), 8)), 9);
    expect(airTempAt(m, 300, undefined, 0)).toBe(airTempAt(m));
  });
});

describe("the knob", () => {
  it("holds its value at the valley floor at the start hour", () => {
    for (const temp of [-20, -5, 0, 5]) {
      for (const kind of ["clear", "snow", "storm"] as const) {
        expect(airTempAt(map(on(1, 20), 10, kind, temp))).toBeCloseTo(temp, 9);
      }
    }
  });

  it("shifts the whole day: the cycle and the lapse still play over it", () => {
    const m = map(on(1, 20), 10, "clear", -5);
    const auto = map(on(1, 20), 10, "clear");
    const shift = airTempAt(m) - airTempAt(auto);
    expect(airTempAt(m, undefined, 2200) - airTempAt(auto, undefined, 2200)).toBeCloseTo(shift, 9);
    expect(airTempAt(m, 3600) - airTempAt(auto, 3600)).toBeCloseTo(shift, 9);
  });

  it("is let over a snowing sky: warm, it snows wet", () => {
    expect(airTempAt(map(on(1, 20), 10, "snow", 3))).toBeCloseTo(3, 9);
  });

  it("is carried by withSky, alone or over a sky picked, and through a front", () => {
    const level = generateLevel(7);
    const warm = withSky(level, { temp: 4 });
    expect(warm.weather!.temp).toBe(4);
    expect(warm.weather!.kind).toBe(level.weather!.kind);
    expect(airTempAt(warm)).toBeCloseTo(4, 9);
    const storm = withSky(level, { weather: "storm", temp: -12 });
    expect(storm.weather!.kind).toBe("storm");
    expect(airTempAt(storm)).toBeCloseTo(-12, 9);
    // A sky picked again over a map that has the knob keeps it.
    expect(withSky(warm, { weather: "fog" }).weather!.temp).toBe(4);
    for (const leg of dealFront(warm).legs) expect(leg.weather.temp).toBe(4);
  });

  it("moves no map's digest", () => {
    const level = generateLevel(7);
    expect(levelDigest(withSky(level, { temp: -15 }))).toBe(levelDigest(level));
    expect(levelDigest(withSky(level, { temp: 5 }))).toBe(levelDigest(level));
  });

  it("is the same answer every time it is asked", () => {
    const level = generateLevel(7);
    expect(airTempAt(level, 1234, 1800)).toBe(airTempAt(level, 1234, 1800));
  });
});

describe("the free air aloft", () => {
  it("is colder than −40 °C at 10 km in a mid-latitude winter", () => {
    expect(freeAirTempAt(map(on(1, 20), 12), undefined, 10_000)).toBeLessThan(-40);
  });

  it("cools at the standard lapse, then stands at the tropopause", () => {
    const m = map(on(7, 20), 12);
    const at = (z: number): number => freeAirTempAt(m, undefined, z);
    expect(at(4000) - at(5000)).toBeCloseTo(AIR_TEMP.free.lapse, 6);
    const top = tropopauseOf(m);
    expect(at(top + 2000)).toBe(at(top));
    expect(at(top + 6000)).toBe(at(top));
  });

  it("puts the tropopause high over the tropics, low over the poles, lower in winter", () => {
    const at = (lat: number, day: number): number =>
      tropopauseOf({ sun: { hour: 12, dayOfYear: day, latitude: lat } });
    expect(at(5, 20)).toBeGreaterThan(15_000);
    expect(at(46, 20)).toBeGreaterThan(9_500);
    expect(at(46, 20)).toBeLessThan(12_000);
    expect(at(75, 20)).toBeLessThan(9_000);
    expect(at(46, 20)).toBeLessThan(at(46, on(7, 20)));
    // The south's winter is the north's summer.
    expect(at(-46, on(7, 20))).toBeLessThan(at(-46, 20));
  });
});

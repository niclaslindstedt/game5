// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JURY'S DAY: a race is only ever run in the wind and the fall its
// discipline's jury allows (`JURY`, `juryDay`) — a gust at the start held
// under the row, a speed race's storm eased to a steady fall — while a free
// ride, a time trial and a tricks run keep the sky they were dealt; and the
// course is clean at the start of every run, the snow that falls during it
// a few millimetres.
import { describe, expect, it } from "vitest";

import {
  DISCIPLINES,
  GUST_PEAK,
  JURY,
  createGame,
  exposureAt,
  freshStep,
  juryDay,
  setDownhill,
  startGustOf,
  weatherOf,
  windAt,
  withSky,
  type Level,
} from "@engine";
import { levelFor, LEVEL_SEEDS } from "./support/levels.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const BASE = syntheticLevel();

/** The strongest wind at 10 m over the start over a long sample of the
 * clock, m/s. */
function sampledGust(level: Level): number {
  const gate = level.checkpoints[0];
  const exposed = exposureAt(level, gate.x, gate.z);
  let most = 0;
  for (let t = 0; t < 600; t += 0.25) most = Math.max(most, windAt(level, t).speed * exposed);
  return most;
}

describe("the jury's rows", () => {
  it("names every discipline the game names", () => {
    for (const d of DISCIPLINES) {
      expect(JURY[d.id].wind).toBeGreaterThan(0);
      expect(JURY[d.id].fall).toBeGreaterThan(0);
      expect(JURY[d.id].fall).toBeLessThanOrEqual(1);
    }
  });

  it("runs a speed race in less wind than a technical one, and speed skiing in the least", () => {
    expect(JURY.downhill.wind).toBeLessThan(JURY.slalom.wind);
    expect(JURY.superG.wind).toBeLessThan(JURY.giantSlalom.wind);
    for (const d of DISCIPLINES) expect(JURY.speedSki.wind).toBeLessThanOrEqual(JURY[d.id].wind);
    // Speed skiing's own rule: a run stopped at 10 km/h at 200 km/h and more.
    expect(JURY.speedSki.wind * 3.6).toBeCloseTo(10, 6);
    // A slalom is raced in falling snow; a downhill is not run in a storm.
    expect(JURY.slalom.fall).toBe(1);
    expect(JURY.downhill.fall).toBeLessThan(0.76);
  });

  it("states the strongest gust as every swell at its crest", () => {
    expect(GUST_PEAK).toBeCloseTo(1.5, 6);
  });
});

describe("the jury's day", () => {
  it("holds a gale's gusts at the start under the row, and a storm's fall under a speed race's", () => {
    const storm = withSky(setDownhill(BASE), { weather: { kind: "storm", wind: 22, snowfall: 1 } });
    const day = juryDay(storm, JURY.downhill);
    expect(startGustOf(day)).toBeLessThanOrEqual(JURY.downhill.wind + 1e-9);
    expect(sampledGust(day)).toBeLessThanOrEqual(JURY.downhill.wind + 1e-9);
    const w = weatherOf(day);
    expect(w.kind).toBe("snow");
    expect(w.snowfall).toBeLessThanOrEqual(JURY.downhill.fall);
    // The bearing the sky dealt is kept: only how hard it blows is eased.
    expect(w.windFrom).toBe(weatherOf(storm).windFrom);
  });

  it("holds the gust where the mountain exposes the start most", () => {
    for (const seed of LEVEL_SEEDS.slice(0, 2)) {
      const level = withSky(levelFor(seed), { weather: { kind: "storm", wind: 22 } });
      const day = juryDay(level, JURY.slalom);
      expect(sampledGust(day)).toBeLessThanOrEqual(JURY.slalom.wind + 1e-9);
      // A slalom is raced in a storm's fall; only the wind is eased.
      expect(weatherOf(day).kind).toBe("storm");
      expect(weatherOf(day).snowfall).toBe(weatherOf(level).snowfall);
    }
  });

  it("leaves a sky inside the row alone, and eases nothing twice", () => {
    const calm = withSky(BASE, { weather: { kind: "fair", wind: 3 } });
    expect(juryDay(calm, JURY.downhill)).toBe(calm);
    const gale = withSky(BASE, { weather: { kind: "high", wind: 20 } });
    const once = juryDay(gale, JURY.slalom);
    expect(once).not.toBe(gale);
    expect(juryDay(once, JURY.slalom)).toBe(once);
  });

  it("is what a slalom and a downhill are stood up under, a sky picked by hand included", () => {
    const sky = { weather: { kind: "storm" as const, wind: 22, snowfall: 1 } };
    const slalom = createGame({ level: BASE, mode: "slalom", rivals: 0, quiet: true, sky });
    expect(slalom.rules.jury).toBe(JURY.slalom);
    expect(startGustOf(slalom.level)).toBeLessThanOrEqual(JURY.slalom.wind + 1e-9);
    const downhill = createGame({ level: BASE, mode: "downhill", rivals: 0, quiet: true, sky });
    expect(downhill.rules.jury).toBe(JURY.downhill);
    expect(startGustOf(downhill.level)).toBeLessThanOrEqual(JURY.downhill.wind + 1e-9);
    expect(weatherOf(downhill.level).snowfall).toBeLessThanOrEqual(JURY.downhill.fall);
  });

  it("never touches a run with no jury", () => {
    const sky = { weather: { kind: "storm" as const, wind: 22, snowfall: 1 } };
    for (const mode of ["free", "timeTrial", "tricks"] as const) {
      const state = createGame({ level: BASE, mode, quiet: true, sky });
      expect(state.rules.jury).toBeUndefined();
      expect(weatherOf(state.level).wind).toBe(22);
    }
  });
});

describe("the course's snow", () => {
  it("is clean at the start of every race run, and a run's own fall lays a few millimetres", () => {
    const sky = { weather: { kind: "storm" as const, wind: 22, snowfall: 1 } };
    for (const mode of ["slalom", "downhill"] as const) {
      const state = createGame({ level: BASE, mode, rivals: 0, quiet: true, sky });
      expect(state.fresh).toBe(0);
      // Two minutes — a long slalom run, a short downhill — in the heaviest
      // fall the jury runs it in.
      let laid = 0;
      for (let t = 0; t < 120; t += 1 / 120) laid += freshStep(state.level, t, 1 / 120);
      expect(laid).toBeLessThan(0.003);
    }
  });
});

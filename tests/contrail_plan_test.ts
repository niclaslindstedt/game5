// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CONTRAILS' PLAN (`contrail-plan.ts`): who flies over a map and when,
// whether each trail forms and lasts, and how it grows — dealt off the
// map's seed and the run's clock alone. How it LOOKS is `make contrails`.

import { describe, expect, it } from "vitest";
import { withSky, type Level } from "@engine";

import {
  CONTRAIL,
  airAloft,
  contrailShow,
  contrailsAt,
  flightsBetween,
  formationTemp,
  pressureAt,
  tauAt,
  trailFrameOf,
  widthAt,
  type Flight,
} from "../pwa/src/game/contrail-plan.ts";
import { levelFor } from "./support/levels.ts";
import { glintOf, nightShow } from "../pwa/src/game/contrails.ts";

const base = levelFor(1);
/** The same map dealt another seed's flights (the plan reads the seed, the
 * day and the sky; building a map a seed would only slow the file). */
const seeded = (seed: number): Level => ({ ...base, seed });
const sky = (kind: "clear" | "fair" | "high" | "overcast"): Level =>
  withSky(base, { weather: kind });

/** The same map `days` on in its year: a warmer air under the summer's sun. */
const warmer = (level: Level, days: number): Level => ({
  ...level,
  sun: { ...level.sun, dayOfYear: level.sun.dayOfYear + days },
});

describe("the flights", () => {
  it("are the same for the same seed and moment, and another seed's are others", () => {
    const a = flightsBetween(base, 0, 1800);
    const b = flightsBetween(base, 0, 1800);
    expect(a).toEqual(b);
    const c = flightsBetween(seeded(38), 0, 1800);
    expect(c.map((f) => f.tc)).not.toEqual(a.map((f) => f.tc));
    const frame = trailFrameOf(base);
    expect(contrailsAt(base, frame, 900)).toEqual(contrailsAt(base, frame, 900));
  });

  it("come about one a minute over an hour, some close together and some apart", () => {
    let n = 0;
    let gaps = 0;
    let close = 0;
    for (const seed of [1, 38, 75]) {
      const fs = flightsBetween(seeded(seed), 0, 3600).sort((x, y) => x.tc - y.tc);
      n += fs.length;
      for (let i = 1; i < fs.length; i++) {
        const g = fs[i].tc - fs[i - 1].tc;
        if (g > 150) gaps++;
        if (g < 20) close++;
      }
    }
    const perMinute = n / 3 / 60;
    expect(perMinute).toBeGreaterThan(0.8);
    expect(perMinute).toBeLessThan(1.25);
    expect(gaps).toBeGreaterThan(0);
    expect(close).toBeGreaterThan(0);
  });

  it("cruise at a jet's speed and height", () => {
    for (const f of flightsBetween(base, 0, 3600)) {
      expect(f.speed).toBeGreaterThanOrEqual(220);
      expect(f.speed).toBeLessThanOrEqual(260);
      expect(f.altitude).toBeGreaterThan(7000);
      expect(f.altitude).toBeLessThan(12500);
    }
  });
});

describe("the air decides", () => {
  it("the free air cools with height and stops at the tropopause", () => {
    const t5 = airAloft(base, 0, 5000);
    const t9 = airAloft(base, 0, 9000);
    expect(t9).toBeLessThan(t5 - 20);
    expect(airAloft(base, 0, 16000)).toBeCloseTo(airAloft(base, 0, 15000), 5);
  });

  it("the threshold is about −40 °C saturated and −46 °C dry at cruise", () => {
    const p = pressureAt(10500);
    expect(p).toBeGreaterThan(230);
    expect(p).toBeLessThan(260);
    expect(formationTemp(p, 1)).toBeGreaterThan(-44);
    expect(formationTemp(p, 1)).toBeLessThan(-39);
    expect(formationTemp(p, 0)).toBeLessThan(-45);
    expect(formationTemp(p, 0)).toBeGreaterThan(-48);
  });

  it("no trail forms where the air is warmer than the threshold", () => {
    const all: Flight[] = [];
    for (const seed of [1, 38, 75, 112])
      for (const days of [0, 120, 170])
        all.push(...flightsBetween(warmer(seeded(seed), days), 0, 3600));
    let formed = 0;
    let not = 0;
    for (const f of all) {
      const rhw = 0;
      if (f.temp > formationTemp(pressureAt(f.altitude), 1)) expect(f.forms).toBe(false);
      if (f.temp < formationTemp(pressureAt(f.altitude), rhw)) expect(f.forms).toBe(true);
      if (f.forms) formed++;
      else not++;
    }
    expect(formed).toBeGreaterThan(0);
    expect(not).toBeGreaterThan(0);
  });

  it("a warm air mass leaves fewer trails, and only the highest", () => {
    const share = (l: Level): { share: number; low: number } => {
      const fs = flightsBetween(l, 0, 7200);
      const formed = fs.filter((f) => f.forms);
      return {
        share: formed.length / fs.length,
        low: Math.min(...formed.map((f) => f.altitude), Infinity),
      };
    };
    const cold = share(base);
    const warm = share(warmer(base, 170));
    expect(warm.share).toBeLessThan(cold.share);
    expect(warm.low).toBeGreaterThan(cold.low);
  });

  it("a trail persists only in ice-supersaturated air", () => {
    const fs = flightsBetween(sky("high"), 0, 7200);
    expect(fs.some((f) => f.persists)).toBe(true);
    for (const f of fs) {
      if (f.persists) expect(f.rhi).toBeGreaterThanOrEqual(1);
      if (f.rhi < 1) expect(f.persists).toBe(false);
      if (!f.persists && f.forms) expect(f.life).toBeLessThanOrEqual(CONTRAIL.life[1]);
    }
  });

  it("a veil of cirrus brings far more persistent trails than a clear sky", () => {
    let high = 0;
    let clear = 0;
    for (const seed of [1, 38, 75, 112, 149]) {
      const l = seeded(seed);
      high += flightsBetween(withSky(l, { weather: "high" }), 0, 7200).filter(
        (f) => f.persists,
      ).length;
      clear += flightsBetween(withSky(l, { weather: "clear" }), 0, 7200).filter(
        (f) => f.persists,
      ).length;
    }
    expect(high).toBeGreaterThan(clear * 2);
  });
});

describe("a trail through its life", () => {
  it("widens with age, fast in humid air and barely in dry", () => {
    const fs = flightsBetween(sky("high"), 0, 7200);
    const wet = fs.find((f) => f.persists)!;
    expect(widthAt(wet, 60)).toBeGreaterThan(widthAt(wet, 0));
    expect(widthAt(wet, 600)).toBeGreaterThan(widthAt(wet, 60) * 3);
    expect(widthAt(wet, 2400)).toBeGreaterThan(1000);
    const dry = fs.find((f) => f.forms && !f.persists);
    if (dry) expect(widthAt(dry, dry.life)).toBeLessThan(widthAt(dry, 0) + 30);
  });

  it("starts after a dark gap, thins as it spreads, and a short one is gone", () => {
    const fs = flightsBetween(sky("fair"), 0, 7200).filter((f) => f.forms);
    const f = fs[0];
    expect(tauAt(f, 0)).toBe(0);
    expect(tauAt(f, CONTRAIL.gap * 1.5)).toBeGreaterThan(0.2);
    const short = fs.find((x) => !x.persists);
    if (short) expect(tauAt(short, short.life + 1)).toBe(0);
    // Densest in its first seconds, before the wake spreads it.
    const lasts = fs.find((x) => x.persists);
    if (lasts) expect(tauAt(lasts, 8)).toBeGreaterThan(tauAt(lasts, 300));
  });

  it("drifts with the wind aloft and keeps its age running down its length", () => {
    const l = sky("high");
    const frame = trailFrameOf(l);
    for (let t = 600; t < 3600; t += 300) {
      for (const r of contrailsAt(l, frame, t)) {
        expect(r.ageTail).toBeGreaterThanOrEqual(r.ageHead);
        if (!r.flight.persists && r.flight.forms)
          expect(r.ageTail).toBeLessThanOrEqual(r.flight.life + 1e-6);
      }
    }
    // A humid hour builds a sky of them.
    expect(contrailsAt(l, frame, 3600).filter((r) => r.flight.persists).length).toBeGreaterThan(3);
  });

  it("is hidden under an overcast", () => {
    const l = sky("overcast");
    expect(contrailShow(l, 600)).toBe(0);
    expect(contrailsAt(l, trailFrameOf(l), 600)).toEqual([]);
    expect(contrailShow(sky("clear"), 600)).toBe(1);
  });

  it("shows a skier a few planes at once, never a sky of specks", () => {
    const l = sky("clear");
    const frame = trailFrameOf(l);
    let shown = 0;
    let moments = 0;
    for (let t = 300; t < 7200; t += 97) {
      const now = contrailsAt(l, frame, t);
      const crossing = now.filter((r) => r.plane || !r.flight.persists);
      expect(crossing.length).toBeLessThanOrEqual(CONTRAIL.busy);
      for (const r of now) if (r.plane) expect(r.slant).toBeLessThanOrEqual(CONTRAIL.glintReach);
      expect(now.filter((r) => r.plane).length).toBeLessThanOrEqual(CONTRAIL.busy);
      shown += crossing.length;
      moments++;
    }
    // A dry day: one or two on average, sometimes none.
    expect(shown / moments).toBeGreaterThan(0.5);
    expect(shown / moments).toBeLessThanOrEqual(CONTRAIL.busy);
  });

  it("is never more than the dome reads", () => {
    const l = sky("high");
    expect(contrailsAt(l, trailFrameOf(l), 5400).length).toBeLessThanOrEqual(CONTRAIL.most);
  });
});

describe("contrails by night", () => {
  const deg = Math.PI / 180;
  const look = (elevation: number, moonLit = 0, moonUp = -0.5) => ({
    elevation,
    moonLit,
    moon: { x: 0, y: moonUp, z: Math.sqrt(1 - moonUp * moonUp) },
  });

  it("show by day and in the glow after sunset, and not at all on a dark night", () => {
    expect(nightShow(look(20 * deg))).toBe(1);
    expect(nightShow(look(-2 * deg))).toBe(1);
    expect(nightShow(look(-20 * deg))).toBe(0);
    expect(nightShow(look(-20 * deg, 0.15, 0.8))).toBeLessThan(0.02);
  });

  it("are at most a faint line under a full moon high in the sky", () => {
    const v = nightShow(look(-30 * deg, 1, 0.8));
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThanOrEqual(CONTRAIL.moonShow);
  });

  it("glint only while the sun is over the plane's own horizon", () => {
    expect(glintOf(look(10 * deg))).toBe(1);
    expect(glintOf(look(-8 * deg))).toBe(0);
  });
});

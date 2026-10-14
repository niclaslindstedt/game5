// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WEATHER OVER A RUN (`engine/mapgen/front.ts`, `pwa/src/game/cloud-front.ts`):
// a free ride's front is dealt off the map's seed, moves smoothly, lays its
// snow, and touches no race.

import { describe, expect, it } from "vitest";
import {
  FRONT_RATE,
  createGame,
  dealFront,
  frontAt,
  frontEase,
  frontEaseArea,
  snowAt,
  step,
  weatherAt,
  weatherFor,
  weatherOf,
  windAt,
  withFront,
  withSky,
  type Level,
  type WeatherKind,
} from "@engine";
import { frontFieldAt } from "../pwa/src/game/cloud-front.ts";
import { columnAt, meanPass } from "../pwa/src/game/cloud-field.ts";
import { skyLookAt } from "../pwa/src/game/sky.ts";
import { syntheticLevel } from "./support/synthetic.ts";

/** A synthetic map under `kind`, its front laid on. */
function fronted(kind: WeatherKind, seed = 7): Level {
  const base = { ...syntheticLevel(), seed };
  return withFront(withSky(base, { weather: kind }));
}

/** The first seed whose front from `kind` changes the sky twice, its
 * first change into `into` when named. */
function changing(kind: WeatherKind, into?: WeatherKind): Level {
  for (let seed = 1; seed < 400; seed++) {
    const l = fronted(kind, seed);
    const legs = l.front!.legs;
    if (legs.length > 2 && (!into || legs[1].weather.kind === into)) return l;
  }
  throw new Error(`no front from ${kind}`);
}

describe("the front", () => {
  it("is dealt off the seed alone", () => {
    const a = dealFront(fronted("clear", 11));
    const b = dealFront(fronted("clear", 11));
    expect(b).toEqual(a);
    const kinds = new Set<string>();
    for (let seed = 1; seed < 60; seed++)
      kinds.add(
        dealFront(fronted("clear", seed))
          .legs.map((l) => l.weather.kind)
          .join(">"),
      );
    // Different seeds deal different fronts.
    expect(kinds.size).toBeGreaterThan(3);
  });

  it("starts from the sky dealt and never turns into a fog", () => {
    for (const kind of ["clear", "fair", "overcast", "snow", "storm", "fog"] as WeatherKind[])
      for (let seed = 1; seed < 40; seed++) {
        const l = fronted(kind, seed);
        expect(l.front!.legs[0].weather.kind).toBe(kind);
        for (const leg of l.front!.legs.slice(1)) expect(leg.weather.kind).not.toBe("fog");
      }
  });

  it("plays out over game hours, each change over most of one", () => {
    const l = changing("clear");
    const legs = l.front!.legs;
    expect(legs[1].from).toBeGreaterThanOrEqual(0.5 * FRONT_RATE - 1e-6);
    for (const leg of legs.slice(1)) {
      expect(leg.full - leg.from).toBeGreaterThanOrEqual(0.75 * FRONT_RATE - 1e-6);
      expect(leg.full - leg.from).toBeLessThanOrEqual(2 * FRONT_RATE + 1e-6);
    }
  });

  it("is the dealt sky itself on a map without one", () => {
    const base = syntheticLevel();
    expect(weatherAt(base, 5000)).toBe(weatherOf(base));
    expect(frontAt(base, 5000).share).toBe(0);
  });

  it("eases in, and its area is the integral of its ease", () => {
    expect(frontEase(0)).toBe(0);
    expect(frontEase(1)).toBe(1);
    let sum = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) sum += frontEase((i + 0.5) / n) / n;
    expect(frontEaseArea(1)).toBeCloseTo(sum, 6);
    expect(frontEaseArea(1.5)).toBeCloseTo(sum + 0.5, 6);
  });

  it("moves the fall, the wind and the cloud without a step", () => {
    for (const kind of ["clear", "overcast", "storm", "fog"] as WeatherKind[]) {
      const l = changing(kind);
      const end = l.front!.legs[l.front!.legs.length - 1].full + 600;
      // The most a second moves the fall under any of its skies held still
      // (a storm's gusts lift snow fast): the front may add little to it.
      let breath = 0;
      for (const leg of l.front!.legs) {
        const still = { ...l, front: undefined, weather: leg.weather };
        for (let t = 0; t < 400; t++)
          breath = Math.max(breath, Math.abs(snowAt(still, t + 1).fall - snowAt(still, t).fall));
      }
      let fall = snowAt(l, 0).fall;
      let wind = weatherAt(l, 0).wind;
      let pass = meanPass(frontFieldAt(l, 0).layers, 0.5);
      for (let t = 1; t <= end; t += 1) {
        const f = snowAt(l, t).fall;
        const w = weatherAt(l, t).wind;
        const p = meanPass(frontFieldAt(l, t).layers, 0.5);
        // A second's change: the squalls' own breath, never a jump.
        expect(Math.abs(f - fall)).toBeLessThan(breath + 0.01);
        expect(Math.abs(w - wind)).toBeLessThan(0.1);
        expect(Math.abs(p - pass)).toBeLessThan(0.02);
        fall = f;
        wind = w;
        pass = p;
      }
    }
  });

  it("holds every cloud column still across a second of the change", () => {
    const l = changing("high");
    const legs = l.front!.legs;
    const mid = (legs[1].from + legs[1].full) / 2;
    for (const t of [legs[1].from - 1, legs[1].from + 1, mid - 1, mid, legs[1].full]) {
      const a = frontFieldAt(l, t);
      const b = frontFieldAt(l, t + 1);
      expect(a.layers.length).toBeLessThanOrEqual(3);
      for (let k = 0; k < Math.min(a.layers.length, b.layers.length); k++) {
        if (a.layers[k].kind !== b.layers[k].kind) continue;
        let worst = 0;
        for (let x = -4000; x <= 4000; x += 400)
          for (let z = -4000; z <= 4000; z += 400)
            worst = Math.max(
              worst,
              Math.abs(columnAt(a.layers[k], x, z, t) - columnAt(b.layers[k], x, z, t + 1)),
            );
        expect(worst).toBeLessThan(0.25);
      }
    }
  });

  it("lights the sky without a jump", () => {
    const l = changing("overcast");
    const legs = l.front!.legs;
    let prev = skyLookAt(l, legs[1].from - 5, 0);
    for (let t = legs[1].from - 4; t <= legs[1].full + 5; t += 1) {
      const now = skyLookAt(l, t, 0);
      expect(Math.abs(now.flat - prev.flat)).toBeLessThan(0.02);
      expect(Math.abs(now.snowfall - prev.snowfall)).toBeLessThan(0.05);
      prev = now;
    }
  });

  it("lays new snow on a free ride as it comes in", () => {
    const base = changing("overcast", "snow");
    const state = createGame({
      level: { ...base, front: undefined },
      mode: "free",
      front: true,
      quiet: true,
    });
    expect(state.rules.front).toBe(true);
    expect(state.level.front).toBeDefined();
    const at = state.level.front!.legs[1].full;
    state.t = at;
    const before = state.fresh;
    for (let i = 0; i < 1200; i++) step(state, state.input);
    expect(state.fresh).toBeGreaterThan(before);
  });

  it("is never laid on a race, nor on a free ride that did not ask", () => {
    const base = fronted("overcast", 3);
    const plain = { ...base, front: undefined };
    const race = createGame({ level: plain, mode: "slalom", front: true, quiet: true });
    expect(race.rules.front).toBeUndefined();
    expect(race.level.front).toBeUndefined();
    const free = createGame({ level: plain, mode: "free", quiet: true });
    expect(free.level.front).toBeUndefined();
    // A race's weather and wind are the dealt ones at every moment.
    for (const t of [0, 1000, 5000]) {
      expect(weatherAt(race.level, t)).toBe(weatherOf(race.level));
      const w = windAt(race.level, t);
      expect(w.speed).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps the map a free ride started again was built on", () => {
    const base = { ...fronted("clear", 5), front: undefined };
    const first = createGame({ level: base, mode: "free", front: true, quiet: true });
    const again = createGame({ level: first.level, mode: "free", front: true, quiet: true });
    expect(again.level).toBe(first.level);
  });

  it("deals a front again off a sky picked over it", () => {
    const l = fronted("clear", 9);
    const picked = withSky(l, { weather: "storm" });
    expect(picked.front!.legs[0].weather.kind).toBe("storm");
    expect(weatherFor("storm").kind).toBe("storm");
  });
});

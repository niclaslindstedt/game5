// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIRES AS LAID OUT (`pwa/src/game/fire-plan.ts`): every part of a ski
// area's camp fires and bonfires on the drawn snow — the stones round the
// hearth, the logs leaning into it, the benches on their seats, the grill
// over a camp fire — its flames sized to its kind, its light where its
// flames are, and the instance counts the view draws bounded.

import { describe, expect, it } from "vitest";

import { FIRE_KINDS, firesOf } from "@engine";

import {
  FIRE_KIT,
  FIRE_LOOK,
  fireLayouts,
  flickerAt,
  layoutFire,
  nearestFires,
  snowFloor,
} from "../pwa/src/game/fire-plan.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const SEEDS = LEVEL_SEEDS.slice(0, 2);

describe("the fires as laid out", () => {
  it("lays every fire once a map, the same layout twice", () => {
    const level = levelFor(SEEDS[0]);
    const fires = firesOf(level);
    expect(fires.length).toBeGreaterThan(0);
    const once = fireLayouts(level, fires);
    expect(fireLayouts(level, fires)).toBe(once);
    expect(layoutFire(level, fires[0])).toEqual(once[0]);
  });

  it("stands every part on the drawn snow, never floating or buried", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      for (const f of fireLayouts(level, firesOf(level))) {
        expect(Math.abs(f.floor - snowFloor(level, f.fire.x, f.fire.z))).toBeLessThan(0.05);
        for (const s of f.stones) {
          const under = snowFloor(level, s.x, s.z);
          // A stone's middle stands over the snow, its top never a whole
          // stone over it (a grill's support stood on its end).
          expect(s.y).toBeGreaterThan(under - s.size * 0.5);
          expect(s.y).toBeLessThan(under + s.size * s.flat + 0.05);
        }
        for (const l of f.logs) {
          const low = l.y - Math.abs(l.dy) * (l.length / 2);
          const under = snowFloor(level, l.x, l.z);
          // Its low end on the snow or set a little into it — or on the
          // rows under it, a woodpile's top row under a metre up.
          expect(low).toBeGreaterThan(under - 0.25);
          expect(low).toBeLessThan(under + (Math.abs(l.dy) < 0.1 ? 1 : 0.3));
        }
      }
    }
  });

  it("puts a bench on every seat, at sitting height, on two stumps", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      for (const f of fireLayouts(level, firesOf(level))) {
        expect(f.seats.length).toBe(f.fire.seats.length);
        f.seats.forEach((s, i) => {
          const seat = f.fire.seats[i];
          expect(Math.hypot(s.x - seat.x, s.z - seat.z)).toBeLessThan(1e-6);
          expect(s.y - snowFloor(level, s.x, s.z)).toBeCloseTo(FIRE_KIT.bench.seat, 1);
          expect(s.length).toBe(seat.length);
        });
        const stumps = f.logs.filter((l) => l.dy > 0.99 && l.radius >= FIRE_KIT.bench.stump * 0.8);
        expect(stumps.length).toBe(2 * f.seats.length);
      }
    }
  });

  it("rings a camp fire with stones and a grill, and leans a bonfire's teepee", () => {
    const level = levelFor(SEEDS[0]);
    for (const f of fireLayouts(level, firesOf(level))) {
      const L = FIRE_LOOK[f.fire.kind];
      const lay = f.logs.filter((l) => l.tone > 0.5);
      expect(lay.length).toBe(L.lay.logs);
      for (const l of lay) {
        // Leaning in: its top over the hearth, short of the kind's length.
        expect(l.dy).toBeGreaterThan(0.2);
        expect(l.length).toBeLessThanOrEqual(L.lay.length + 1e-9);
      }
      if (f.fire.kind === "camp") {
        expect(f.bars.length).toBe(FIRE_KIT.grate.bars + 2);
        const ring = f.stones.filter(
          (s) => Math.hypot(s.x - f.fire.x, s.z - f.fire.z) > f.fire.radius,
        );
        expect(ring.length).toBeGreaterThanOrEqual(L.stones.count);
      } else {
        expect(f.bars.length).toBe(0);
      }
    }
  });

  it("sizes the flames to the kind", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      for (const f of fireLayouts(level, firesOf(level))) {
        const def = FIRE_KINDS[f.fire.kind];
        expect(f.tongues.length).toBe(FIRE_LOOK[f.fire.kind].flames.tongues);
        const tallest = Math.max(...f.tongues.map((t) => t.height));
        expect(tallest).toBeGreaterThan(def.flames * 0.6);
        expect(tallest).toBeLessThan(def.flames * 1.25);
        for (const t of f.tongues) {
          expect(Math.hypot(t.x - f.fire.x, t.z - f.fire.z)).toBeLessThanOrEqual(f.fire.radius);
          expect(t.width).toBeLessThan(def.radius * 2);
        }
        // Its light over its flames, a bonfire's the stronger.
        expect(f.lamp.y).toBeGreaterThan(f.floor);
        expect(f.lamp.y).toBeLessThan(f.floor + def.flames);
      }
    }
    expect(FIRE_LOOK.bonfire.light.power).toBeGreaterThan(FIRE_LOOK.camp.light.power);
  });

  it("keeps the instances a map draws bounded", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const layouts = fireLayouts(level, firesOf(level));
      const count = (pick: (f: (typeof layouts)[number]) => number): number =>
        layouts.reduce((n, f) => n + pick(f), 0);
      expect(count((f) => f.stones.length)).toBeLessThan(400);
      expect(count((f) => f.logs.length)).toBeLessThan(1200);
      expect(count((f) => f.tongues.length)).toBeLessThan(400);
      expect(
        count((f) => FIRE_LOOK[f.fire.kind].sparks.count + FIRE_LOOK[f.fire.kind].smoke.count),
      ).toBeLessThan(2000);
    }
  });

  it("deals the nearest few fires' lights, nearest first, and flickers them gently", () => {
    const level = levelFor(SEEDS[0]);
    const layouts = fireLayouts(level, firesOf(level));
    const f = layouts[0];
    const out: typeof layouts extends readonly (infer T)[] ? T[] : never = [];
    nearestFires(layouts, f.lamp.x, f.lamp.y, f.lamp.z, out);
    expect(out[0]).toBe(f);
    expect(out.length).toBeLessThanOrEqual(FIRE_KIT.lamps.most);
    nearestFires(layouts, f.lamp.x + 1e5, f.lamp.y, f.lamp.z, out);
    expect(out.length).toBe(0);
    for (let t = 0; t < 10; t += 0.37) {
      const k = flickerAt(t, 0.4);
      expect(k).toBeGreaterThan(0.65);
      expect(k).toBeLessThan(1.2);
    }
  });
});

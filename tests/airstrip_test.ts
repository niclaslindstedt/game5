// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S STRIP (`engine/game/airstrip.ts`): a rectangle of flat
// snow on the valley floor by the town, found once a map — inside the map,
// clear of the streets, the trees and every other machine's place, with no
// lip along it — on generated mountains and on a real mountainside.

import { describe, expect, it } from "vitest";
import {
  PLANE,
  STRIP_LENGTH,
  airstripOf,
  balloonSiteOf,
  generateLevel,
  helipadOf,
  loadRealFace,
  onStrip,
  sledSpotOf,
  streetMaskAt,
  villageOf,
  type Level,
} from "@engine";

import { levelFor } from "./support/levels.ts";

describe("the airstrip", () => {
  const seeds = [1, 38];

  /** Every check the strip is held to on `level`. */
  function holds(level: Level): void {
    const strip = airstripOf(level);
    expect(airstripOf(level)).toBe(strip);
    expect(strip.length).toBe(STRIP_LENGTH);
    const fx = Math.sin(strip.heading);
    const fz = Math.cos(strip.heading);
    const half = strip.length / 2;
    // Inside the map, all of it.
    for (const s of [-half, half]) {
      for (const w of [-strip.width / 2, strip.width / 2]) {
        const x = strip.x + fx * s + fz * w;
        const z = strip.z + fz * s - fx * w;
        expect(x).toBeGreaterThan(0);
        expect(z).toBeGreaterThan(0);
        expect(x).toBeLessThan(level.size);
        expect(z).toBeLessThan(level.size);
      }
    }
    // On the valley floor, no higher than the town it lies by.
    const village = villageOf(level);
    if (village) {
      const homeY = level.groundAt(village.centre.x, village.centre.z);
      expect(strip.y).toBeLessThan(homeY + 15);
    }
    // Clear of the town's streets, the trees and every other machine's place.
    const keep = [helipadOf(level), sledSpotOf(level), balloonSiteOf(level)];
    const inner = half - 0.01;
    const side = strip.width / 2 - 0.01;
    for (let s = -inner; s <= inner; s += 10) {
      for (const w of [-side, 0, side]) {
        const x = strip.x + fx * s + fz * w;
        const z = strip.z + fz * s - fx * w;
        expect(onStrip(level, x, z)).toBe(true);
        expect(streetMaskAt(level, x, z)).toBe(0);
        for (const k of keep) expect(Math.hypot(k.x - x, k.z - z)).toBeGreaterThan(10);
      }
    }
    for (const t of level.trees) {
      const dx = t.x - strip.x;
      const dz = t.z - strip.z;
      const along = dx * fx + dz * fz;
      const across = dx * fz - dz * fx;
      expect(Math.abs(along) <= half && Math.abs(across) <= strip.width / 2).toBe(false);
    }
    // Smooth enough to roll on: no lip along its centre line.
    if (!strip.fallback) {
      let last = level.groundAt(strip.x - fx * half, strip.z - fz * half);
      const mean = (level.groundAt(strip.x + fx * half, strip.z + fz * half) - last) / strip.length;
      for (let s = -half + 5; s <= half; s += 5) {
        const h = level.groundAt(strip.x + fx * s, strip.z + fz * s);
        expect(Math.abs((h - last) / 5 - mean)).toBeLessThan(PLANE.strip.step * 1.5 + 1e-6);
        last = h;
      }
    }
  }

  for (const seed of seeds) {
    it(`lies flat by the town, inside the map and clear of everything — seed ${seed}`, () => {
      holds(levelFor(seed));
    });
  }

  it("is found on a real mountainside too", async () => {
    await loadRealFace("alpine-1");
    holds(generateLevel(1, { face: "alpine-1" }));
  });
});

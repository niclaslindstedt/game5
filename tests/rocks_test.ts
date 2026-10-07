import { describe, expect, it } from "vitest";
import { generateLevel, regionOf } from "@engine";

import { REGION_LOOKS, regionLookOf } from "../pwa/src/game/region-look.ts";
import { ROCKS, rockOutcrops, rockPlanner } from "../pwa/src/game/rock-plan.ts";
import { buildOutcrop, rockMesh } from "../pwa/src/game/rock-shapes.ts";
import { levelFor } from "./support/levels.ts";

// THE CRAGS ON THE BARE FACES (`rock-plan.ts`, `rock-shapes.ts`): where
// they stand, that a tile asked alone gets what the whole map gets, and
// what they cost in triangles.

const level = levelFor(38);
const band = regionLookOf(regionOf(level).id).rock;
const all = rockOutcrops(level, band);

describe("rocks", () => {
  it("stand on a bare face, off the packed snow and clear of every trunk", () => {
    expect(all.length).toBeGreaterThan(500);
    for (const o of all) {
      expect(level.packedAt(o.x, o.z)).toBeLessThanOrEqual(ROCKS.packed);
      expect(o.bare).toBeGreaterThanOrEqual(ROCKS.least);
    }
    for (const o of all.filter((_, i) => i % Math.ceil(all.length / 40) === 0)) {
      for (const t of level.trees) {
        expect(Math.hypot(t.x - o.x, t.z - o.z)).toBeGreaterThanOrEqual(ROCKS.trunk);
      }
    }
  });

  it("are a function of the map: the same twice, and a tile asked alone gets its share of the whole", () => {
    expect(rockOutcrops(level, band)).toEqual(all);
    const plan = rockPlanner(level, band);
    const tile = { x0: 384, z0: 768, x1: 576, z1: 960 };
    const c = ROCKS.cell;
    const within = (v: number, lo: number, hi: number): boolean =>
      Math.floor(v / c) >= Math.ceil(lo / c) && Math.floor(v / c) < Math.ceil(hi / c);
    const expected = all.filter(
      (o) => within(o.x, tile.x0, tile.x1) && within(o.z, tile.z0, tile.z1),
    );
    expect(expected.length).toBeGreaterThan(0);
    expect(plan(tile)).toEqual(expected);
  });

  it("are laid only where the country shows rock", () => {
    expect(REGION_LOOKS.maritime.rock).toBeNull();
    expect(rockOutcrops(level, null)).toEqual([]);
  });

  it("cost a phone little: few triangles a crag, and fewer at a cheaper share", () => {
    const whole = rockMesh();
    const cheap = rockMesh();
    for (const o of all) {
      buildOutcrop(whole, level, o, band!.tone, 1);
      buildOutcrop(cheap, level, o, band!.tone, 0.5);
    }
    const tris = whole.pos.length / 9;
    // Under a hundred triangles a knot on average, and under 65 000 a
    // square kilometre of the map.
    expect(tris / all.length).toBeLessThan(100);
    expect(tris / (level.size / 1000) ** 2).toBeLessThan(65_000);
    expect(cheap.pos.length).toBeLessThan(whole.pos.length * 0.55);
    // Every vertex is coloured, every normal unit length.
    expect(whole.col.length).toBe(whole.pos.length);
    for (let i = 0; i < whole.nrm.length; i += 3 * 97) {
      expect(Math.hypot(whole.nrm[i], whole.nrm[i + 1], whole.nrm[i + 2])).toBeCloseTo(1, 5);
    }
  });

  it("are few in the fell, which shows rock only on its steepest crags", () => {
    const fell = generateLevel(38, { region: "fell" });
    const crags = rockOutcrops(fell, REGION_LOOKS.fell.rock);
    expect(crags.length).toBeLessThan(all.length / 4);
  });
});

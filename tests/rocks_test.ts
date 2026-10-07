import { describe, expect, it } from "vitest";
import {
  REGIONS,
  ROCKS,
  collideTrees,
  createGame,
  generateLevel,
  regionOf,
  rockBlock,
  rockSolids,
  rocksOf,
  rockyCliff,
  solidsOf,
  wallOf,
  type Cliff,
  type GameEvent,
} from "@engine";

import { REGION_LOOKS, regionLookOf } from "../pwa/src/game/region-look.ts";
import { buildOutcrop, rockMesh } from "../pwa/src/game/rock-shapes.ts";
import { levelFor } from "./support/levels.ts";

// THE CRAGS ON THE DROPS (`engine/game/rocks.ts`, drawn by `rock-shapes.ts`):
// where they stand, that a skier meets them, and what they cost in
// triangles.

const level = levelFor(38);
const band = regionLookOf(regionOf(level).id).rock;
const all = [...rocksOf(level)];

/** Whether `o` stands on cliff `c`'s face: across its edge and between
 * its lip and its foot. */
function onFace(c: Cliff, o: { x: number; z: number }): boolean {
  const dx = o.x - c.x;
  const dz = o.z - c.z;
  const down = dx * Math.sin(c.heading) + dz * Math.cos(c.heading);
  const across = dx * Math.cos(c.heading) - dz * Math.sin(c.heading);
  return Math.abs(across) < c.width / 2 + 7 && down >= 0 && down <= c.face;
}

describe("rocks", () => {
  it("stand only on the drops: a cliff's face or a wall too steep to ski, never packed snow", () => {
    expect(all.length).toBeGreaterThan(300);
    const n = { x: 0, y: 1, z: 0 };
    const cliffs = (level.cliffs ?? []).filter(rockyCliff);
    expect(cliffs.length).toBeGreaterThan(0);
    for (const o of all) {
      expect(level.packedAt(o.x, o.z)).toBeLessThanOrEqual(ROCKS.packed);
      const onCliff = cliffs.find((c) => onFace(c, o));
      if (onCliff) {
        // Every block's top under the cliff's lip.
        expect(o.y + o.height).toBeLessThanOrEqual(onCliff.y - ROCKS.lip + 1e-6);
      } else {
        level.normalAt(o.x, o.z, n);
        expect(wallOf(n)).toBeGreaterThan(0);
      }
    }
    // No drop a run is skied over carries any.
    for (const c of (level.cliffs ?? []).filter((c) => !rockyCliff(c))) {
      for (const o of all) {
        const dx = o.x - c.x;
        const dz = o.z - c.z;
        const down = dx * Math.sin(c.heading) + dz * Math.cos(c.heading);
        const across = dx * Math.cos(c.heading) - dz * Math.sin(c.heading);
        expect(Math.abs(across) < c.width / 2 && down > -2 && down < c.face + 2).toBe(false);
      }
    }
    for (const o of all.filter((_, i) => i % Math.ceil(all.length / 40) === 0)) {
      if (cliffs.some((c) => onFace(c, o))) continue;
      for (const t of level.trees) {
        expect(Math.hypot(t.x - o.x, t.z - o.z)).toBeGreaterThanOrEqual(ROCKS.trunk);
      }
    }
  });

  it("leave the steep snow a skier rides alone", () => {
    // Below the wall's slope, off the cliffs, nothing stands.
    const n = { x: 0, y: 1, z: 0 };
    const cliffs = (level.cliffs ?? []).filter(rockyCliff);
    const loose = all.filter((o) => !cliffs.some((c) => onFace(c, o)));
    for (const o of loose) {
      level.normalAt(o.x, o.z, n);
      expect(Math.hypot(n.x, n.z) / n.y).toBeGreaterThanOrEqual(ROCKS.wall);
    }
  });

  it("are a function of the map: the same list on a fresh build of the seed", () => {
    expect(rocksOf(generateLevel(38))).toEqual(all);
  });

  it("are laid only where the country shows rock, and drawn wherever they are laid", () => {
    for (const id of Object.keys(REGIONS) as (keyof typeof REGIONS)[]) {
      expect(REGIONS[id].rock).toBe(REGION_LOOKS[id].rock !== null);
    }
    expect(REGIONS.maritime.rock).toBe(false);
    expect(rocksOf(generateLevel(38, { region: "maritime" }))).toEqual([]);
  });

  it("are solid: every standing block is in what a skier is pushed out of", () => {
    const rocks = rockSolids(level);
    expect(rocks.length).toBeGreaterThan(all.length);
    const solids = solidsOf(level);
    for (const r of rocks) {
      expect(solids).toContain(r);
      expect(r.stuff).toBe("rock");
      expect(r.radius).toBeLessThanOrEqual(ROCKS.widest);
      expect(r.height).toBeGreaterThanOrEqual(ROCKS.least);
    }
    // Coarse blocks, not spikes: as wide as they are tall, near enough.
    for (const o of all.slice(0, 200)) {
      const b = rockBlock(o, 0);
      expect((2 * b.long) / b.height).toBeGreaterThanOrEqual(0.9);
    }
  });

  it("stop a skier run into one", () => {
    const state = createGame({ level, quiet: true });
    const r = [...rockSolids(level)].sort((a, b) => b.radius - a.radius)[0];
    const c = state.skier;
    // Two metres off, running straight at it at 10 m/s, at its foot.
    c.x = r.x - 2;
    c.z = r.z;
    c.y = r.y + 0.2;
    c.heading = Math.PI / 2;
    c.vx = 10;
    c.vz = 0;
    c.hitCooldown = 0;
    const events: GameEvent[] = [];
    for (let k = 0; k < 40 && events.length === 0; k++) {
      c.x += c.vx / 120;
      collideTrees(state, events);
    }
    const hit = events.find((e) => e.kind === "hit");
    expect(hit).toBeDefined();
    expect(hit && "stuff" in hit ? hit.stuff : undefined).toBe("rock");
    expect(c.vx).toBeLessThan(5);
  });

  it("cost a phone little: few triangles a crag, and fewer at a cheaper share", () => {
    const whole = rockMesh();
    const cheap = rockMesh();
    for (const o of all) {
      buildOutcrop(whole, level, o, band!.tone, 1);
      buildOutcrop(cheap, level, o, band!.tone, 0.5);
    }
    const tris = whole.pos.length / 9;
    // Under forty triangles a knot on average, and under 10 000 a square
    // kilometre of the map.
    expect(tris / all.length).toBeLessThan(40);
    expect(tris / (level.size / 1000) ** 2).toBeLessThan(10_000);
    expect(cheap.pos.length).toBeLessThan(whole.pos.length * 0.55);
    // Every vertex is coloured, every normal unit length.
    expect(whole.col.length).toBe(whole.pos.length);
    for (let i = 0; i < whole.nrm.length; i += 3 * 97) {
      expect(Math.hypot(whole.nrm[i], whole.nrm[i + 1], whole.nrm[i + 2])).toBeCloseTo(1, 5);
    }
  });

  it("are few in the fell, which shows rock only on its steepest crags", () => {
    const fell = generateLevel(38, { region: "fell" });
    const crags = rocksOf(fell);
    expect(crags.length).toBeLessThan(all.length / 4);
  });
});

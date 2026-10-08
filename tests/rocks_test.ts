import { describe, expect, it } from "vitest";
import {
  REGIONS,
  ROCKS,
  cliffWalls,
  collideTrees,
  createGame,
  generateLevel,
  onAnyCliff,
  regionOf,
  rockHash,
  rockShare,
  rockyCliff,
  solidsOf,
  wallOf,
  wallSolids,
  type GameEvent,
} from "@engine";

import { REGION_LOOKS, regionLookOf } from "../pwa/src/game/region-look.ts";
import { buildSkin, buildWall, rockMesh } from "../pwa/src/game/rock-shapes.ts";
import { levelFor } from "./support/levels.ts";

// THE ROCK ON THE DROPS (`engine/game/rocks.ts`, `cliff-wall.ts`, drawn by
// `rock-shapes.ts`): where it lies, that the cliffs' walls are met, and
// what it costs in triangles.

const level = levelFor(38);
const band = regionLookOf(regionOf(level).id).rock;
const walls = cliffWalls(level);

/** The whole map's skin at a lattice of `cell` m. */
function skinOf(cell: number) {
  const m = rockMesh();
  const n = Math.round(level.size / cell);
  buildSkin(m, level, band!.tone, rockHash(level.seed, 1), cell, 0, 0, n, n);
  return m;
}

describe("rocks", () => {
  it("lie only on the drops: a wall too steep to ski, never packed snow, never a cliff", () => {
    const n = { x: 0, y: 1, z: 0 };
    let bare = 0;
    for (let z = 10; z < level.size; z += 9) {
      for (let x = 10; x < level.size; x += 9) {
        const b = rockShare(level, x, z);
        if (b <= 0) continue;
        bare++;
        expect(level.packedAt(x, z)).toBeLessThanOrEqual(ROCKS.packed);
        expect(onAnyCliff(level, x, z, 0)).toBe(false);
        level.normalAt(x, z, n);
        expect(Math.hypot(n.x, n.z) / n.y).toBeGreaterThanOrEqual(ROCKS.wall);
        expect(b).toBe(wallOf(n));
      }
    }
    expect(bare).toBeGreaterThan(100);
  });

  it("clad every rocky cliff's face from its lip to its foot, and no drop a run goes over", () => {
    const rocky = (level.cliffs ?? []).filter(rockyCliff);
    expect(rocky.length).toBeGreaterThan(0);
    expect(walls.length).toBe(rocky.length);
    rocky.forEach((c, k) => {
      const w = walls[k];
      expect(w.x).toBe(c.x);
      expect(w.pos.length).toBe(w.rows * w.cols * 3);
      // The lip's row at the top of the hill: at the lip's height, not
      // down the face.
      const mid = Math.floor(w.cols / 2);
      const lip = w.pos[(1 * w.cols + mid) * 3 + 1];
      expect(lip).toBeGreaterThan(c.y - 0.3);
      expect(lip).toBeLessThan(c.y + 2);
      // The foot's row down at the foot.
      const foot = w.pos[((w.rows - 1) * w.cols + mid) * 3 + 1];
      expect(c.y - foot).toBeGreaterThan(c.drop * 0.6);
    });
  });

  it("are a function of the map: the same on a fresh build of the seed", () => {
    expect(cliffWalls(generateLevel(38))).toEqual(walls);
  });

  it("are laid only where the country shows rock, and drawn wherever they are laid", () => {
    for (const id of Object.keys(REGIONS) as (keyof typeof REGIONS)[]) {
      expect(REGIONS[id].rock).toBe(REGION_LOOKS[id].rock !== null);
    }
    expect(REGIONS.maritime.rock).toBe(false);
    const maritime = generateLevel(38, { region: "maritime" });
    expect(cliffWalls(maritime)).toEqual([]);
    expect(wallSolids(maritime)).toEqual([]);
  });

  it("are solid on a cliff's face: its wall is in what a skier is pushed out of", () => {
    const rocks = wallSolids(level);
    expect(rocks.length).toBeGreaterThan(walls.length * 5);
    const solids = solidsOf(level);
    for (const r of rocks) {
      expect(solids).toContain(r);
      expect(r.stuff).toBe("rock");
      expect(r.radius).toBeLessThanOrEqual(ROCKS.widest);
      expect(r.height).toBeGreaterThanOrEqual(ROCKS.least);
    }
  });

  it("stop a skier run into a cliff's wall", () => {
    const state = createGame({ level, quiet: true });
    const r = [...wallSolids(level)].sort((a, b) => b.radius - a.radius || b.height - a.height)[0];
    const c = state.skier;
    // Two metres out on the landing, running straight back at it at 10
    // m/s, at its foot.
    const cliff = (level.cliffs ?? [])
      .filter(rockyCliff)
      .sort((a, b) => Math.hypot(a.x - r.x, a.z - r.z) - Math.hypot(b.x - r.x, b.z - r.z))[0];
    const fx = Math.sin(cliff.heading);
    const fz = Math.cos(cliff.heading);
    c.x = r.x + fx * 2;
    c.z = r.z + fz * 2;
    c.y = r.y + 0.2;
    c.heading = cliff.heading + Math.PI;
    c.vx = -10 * fx;
    c.vz = -10 * fz;
    c.hitCooldown = 0;
    const events: GameEvent[] = [];
    for (let k = 0; k < 40 && events.length === 0; k++) {
      c.x += c.vx / 120;
      c.z += c.vz / 120;
      collideTrees(state, events);
    }
    const hit = events.find((e) => e.kind === "hit");
    expect(hit).toBeDefined();
    expect(hit && "stuff" in hit ? hit.stuff : undefined).toBe("rock");
    expect(-(c.vx * fx + c.vz * fz)).toBeLessThan(5);
  });

  it("cost a phone little: a few thousand triangles a square kilometre, fewer at a cheaper share", () => {
    const whole = skinOf(ROCKS.skin.cell);
    const cheap = skinOf(ROCKS.skin.cheap);
    for (const w of walls) buildWall(whole, w, band!.tone);
    const tris = whole.pos.length / 9;
    const km2 = (level.size / 1000) ** 2;
    expect(tris).toBeGreaterThan(1000);
    expect(tris / km2).toBeLessThan(10_000);
    expect(cheap.pos.length).toBeLessThan(whole.pos.length * 0.6);
    // A cliff's wall is a few hundred.
    for (const w of walls) expect(2 * (w.rows - 1) * (w.cols - 1)).toBeLessThan(600);
    // Every vertex is coloured, every normal unit length.
    expect(whole.col.length).toBe(whole.pos.length);
    for (let i = 0; i < whole.nrm.length; i += 3 * 97) {
      expect(Math.hypot(whole.nrm[i], whole.nrm[i + 1], whole.nrm[i + 2])).toBeCloseTo(1, 5);
    }
  });

  it("are little in the fell, which shows rock only on its steepest crags", () => {
    const fell = generateLevel(38, { region: "fell" });
    let alpine = 0;
    let low = 0;
    for (let z = 10; z < level.size; z += 9) {
      for (let x = 10; x < level.size; x += 9) {
        if (rockShare(level, x, z) > 0) alpine++;
        if (z < fell.size && x < fell.size && rockShare(fell, x, z) > 0) low++;
      }
    }
    expect(low).toBeLessThan(alpine / 4);
  });
});

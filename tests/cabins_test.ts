// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CABINS (`engine/game/cabins.ts`): the log buildings a ski area keeps
// beside its runs and its transport lanes. A pure function of the map —
// the same list twice and on a fresh build, nothing drawn from the stream
// and nothing that moves the map's digest — standing off every run's snow,
// clear of the lifts, the gates, the start, the finish, the pads and every
// trunk's crown, terraced into ground its kind's plinth can take, and met by
// a skier as solid walls.

import { describe, expect, it } from "vitest";

import {
  CABINS,
  CABIN_LAYOUT,
  cabinWalls,
  cabinsOf,
  clearOfLifts,
  generateLevel,
  helipadOf,
  levelDigest,
  sledSpotOf,
  solidsOf,
  type Cabin,
} from "@engine";

import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

/** The roof's corners and edges in plan, every metre or so. */
function footprint(c: Cabin): [number, number][] {
  const d = CABINS[c.kind];
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const out: [number, number][] = [];
  for (let u = -d.width / 2; u <= d.width / 2 + 1e-6; u += d.width / 4) {
    for (let v = -d.depth / 2; v <= d.depth / 2 + 1e-6; v += d.depth / 4) {
      out.push([c.x + u * fz + v * fx, c.z - u * fx + v * fz]);
    }
  }
  return out;
}

const SEEDS = LEVEL_SEEDS.slice(0, 4);

describe("cabins", () => {
  it("are the same list twice and on a fresh build of the same seed", () => {
    const level = levelFor(SEEDS[0]);
    const once = cabinsOf(level);
    expect(cabinsOf(level)).toBe(once);
    const fresh = cabinsOf(generateLevel(SEEDS[0]));
    expect(fresh).toEqual(once);
  });

  it("move no map's digest", () => {
    for (const seed of SEEDS.slice(0, 2)) {
      const level = levelFor(seed);
      const before = levelDigest(level);
      cabinsOf(level);
      solidsOf(level);
      expect(levelDigest(level)).toBe(before);
    }
  });

  it("stand here and there: a sensible number, of known kinds", () => {
    let total = 0;
    for (const seed of SEEDS) {
      const list = cabinsOf(levelFor(seed));
      expect(list.length).toBeLessThanOrEqual(CABIN_LAYOUT.most);
      total += list.length;
      for (const c of list) expect(Object.keys(CABINS)).toContain(c.kind);
      // A shed is only ever a companion: never the first of its group.
      for (const c of list) {
        if (list.find((o) => o.group === c.group) === c) expect(c.kind).not.toBe("shed");
      }
      expect(new Set(list.map((c) => c.id)).size).toBe(list.length);
    }
    // A few groups a map on average, never a village of them.
    expect(total / SEEDS.length).toBeGreaterThanOrEqual(4);
    expect(total / SEEDS.length).toBeLessThanOrEqual(CABIN_LAYOUT.most);
  });

  it("stand beside the transport lanes too, not only the runs", () => {
    let byLane = 0;
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const lanes = new Set(
        (level.resort?.runs ?? []).filter((r) => r.kind === "road").map((r) => r.id),
      );
      byLane += cabinsOf(level).filter((c) => lanes.has(c.run)).length;
    }
    expect(byLane).toBeGreaterThan(0);
  });

  it("stand off every run's snow and clear of the lifts", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      for (const c of cabinsOf(level)) {
        for (const [x, z] of footprint(c)) {
          expect(level.packedAt(x, z)).toBeLessThanOrEqual(0.25);
          expect(clearOfLifts(level, x, z)).toBe(true);
        }
        for (const lift of level.resort?.lifts ?? []) {
          for (const end of [lift.bottom, lift.top]) {
            expect(Math.hypot(end.x - c.x, end.z - c.z)).toBeGreaterThan(
              CABIN_LAYOUT.clear.station,
            );
          }
        }
      }
    }
  });

  it("keep clear of the gates, the start, the finish and the pads", () => {
    const C = CABIN_LAYOUT.clear;
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const cps = level.checkpoints;
      const finish = cps[cps.length - 1];
      const pads = [helipadOf(level), sledSpotOf(level)];
      for (const c of cabinsOf(level)) {
        for (const cp of cps) expect(Math.hypot(cp.x - c.x, cp.z - c.z)).toBeGreaterThan(C.gate);
        expect(Math.hypot(level.spawn.x - c.x, level.spawn.z - c.z)).toBeGreaterThan(C.start);
        expect(Math.hypot(finish.x - c.x, finish.z - c.z)).toBeGreaterThan(C.finish);
        for (const p of pads) expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeGreaterThan(C.pad);
      }
    }
  });

  it("have no trunk inside the walls, and stand apart from one another", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const list = cabinsOf(level);
      for (const c of list) {
        const d = CABINS[c.kind];
        const fx = Math.sin(c.heading);
        const fz = Math.cos(c.heading);
        for (const t of level.trees) {
          const dx = t.x - c.x;
          const dz = t.z - c.z;
          if (Math.abs(dx) > 30 || Math.abs(dz) > 30) continue;
          const lx = dx * fz - dz * fx;
          const lz = dx * fx + dz * fz;
          const inside =
            Math.abs(lx) < d.width / 2 + d.reach.side && Math.abs(lz) < d.depth / 2 + 1;
          expect(inside).toBe(false);
        }
        for (const o of list) {
          if (o === c) continue;
          expect(Math.hypot(o.x - c.x, o.z - c.z)).toBeGreaterThan(4);
        }
      }
    }
  });

  it("are terraced: the floor over the ground, the plinth down to it", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      for (const c of cabinsOf(level)) {
        expect(c.base).toBeLessThanOrEqual(c.y);
        expect(c.y - c.base).toBeLessThanOrEqual(CABINS[c.kind].terrace + 0.5);
        for (const [x, z] of footprint(c)) {
          const g = level.groundAt(x, z);
          expect(g).toBeLessThanOrEqual(c.y + 1e-6);
          expect(g).toBeGreaterThanOrEqual(c.base - 0.6);
        }
      }
    }
  });

  it("are solid: their walls are in what a skier is pushed out of", () => {
    const level = levelFor(SEEDS[0]);
    const list = cabinsOf(level);
    expect(list.length).toBeGreaterThan(0);
    const walls = cabinWalls(level);
    const solids = solidsOf(level);
    for (const w of walls) expect(solids).toContain(w);
    // Every metre round each building's walls is within a post's reach.
    const most = CABIN_LAYOUT.wall.gap / 2 + CABIN_LAYOUT.wall.radius + 0.05;
    for (const c of list) {
      const d = CABINS[c.kind];
      const fx = Math.sin(c.heading);
      const fz = Math.cos(c.heading);
      const mine = walls.filter((w) => Math.hypot(w.x - c.x, w.z - c.z) < d.width + d.depth);
      for (let k = 0; k < 40; k++) {
        const a = (k / 40) * 2 * Math.PI;
        const u = Math.cos(a);
        const v = Math.sin(a);
        const t = Math.min(
          d.width / 2 / Math.max(1e-6, Math.abs(u)),
          d.depth / 2 / Math.max(1e-6, Math.abs(v)),
        );
        const lx = u * t;
        const lz = v * t;
        const x = c.x + lx * fz + lz * fx;
        const z = c.z - lx * fx + lz * fz;
        const near = Math.min(...mine.map((w) => Math.hypot(w.x - x, w.z - z)));
        expect(near).toBeLessThanOrEqual(most + CABIN_LAYOUT.wall.radius);
      }
    }
  });
});

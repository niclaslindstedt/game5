// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI AREA'S OWN BUILDINGS (`engine/game/resort-buildings.ts`): the
// village round the hub at the foot of the lifts and the mountain's
// restaurant and patrol hut. Stood after every log cabin and lodge — so not
// one of those moves — a pure function of the map, off the runs' snow, out
// of the hub the crowd skates across, out of the lifts' lines and their
// queues' lanes, clear of one another and solid to a skier.

import { describe, expect, it } from "vitest";

import {
  CABINS,
  RESORT_LAYOUT,
  buildingDoor,
  buildingFront,
  cabinWalls,
  cabinsOf,
  clearOfLifts,
  felledTrees,
  generateLevel,
  isMountainBuilding,
  isResortBuilding,
  levelDigest,
  liftPlans,
  outsideHub,
  queueLane,
  resortBuildingsOf,
  insideWalls,
  type Cabin,
  type Level,
} from "@engine";

import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const SEEDS = LEVEL_SEEDS.slice(0, 4);

/** A building's roof (with its terrace) in plan, a point every metre or so. */
function roof(c: Cabin, pad = 0): [number, number][] {
  const d = CABINS[c.kind];
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const out: [number, number][] = [];
  const x0 = -d.width / 2 - d.reach.side - pad;
  const x1 = d.width / 2 + d.reach.side + pad;
  const z0 = -d.depth / 2 - d.reach.back - pad;
  const z1 = d.depth / 2 + d.reach.front + pad;
  for (let u = x0; u <= x1 + 1e-6; u += (x1 - x0) / 8) {
    for (let v = z0; v <= z1 + 1e-6; v += (z1 - z0) / 8) {
      out.push([c.x + u * fz + v * fx, c.z - u * fx + v * fz]);
    }
  }
  return out;
}

/** A building's walls in plan, a point every metre or so. */
function walls(c: Cabin): [number, number][] {
  const d = CABINS[c.kind];
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const out: [number, number][] = [];
  for (let u = -d.width / 2; u <= d.width / 2 + 1e-6; u += d.width / 8) {
    for (let v = -d.depth / 2; v <= d.depth / 2 + 1e-6; v += d.depth / 8) {
      out.push([c.x + u * fz + v * fx, c.z - u * fx + v * fz]);
    }
  }
  return out;
}

/** The log buildings of a list, as plain rows to compare. */
function logs(list: readonly Cabin[]): Cabin[] {
  return list.filter((c) => !isResortBuilding(c.kind)).map((c) => ({ ...c }));
}

describe("the ski area's buildings", () => {
  it("are the same list twice and on a fresh build, and move no digest", () => {
    const level = levelFor(SEEDS[0]);
    const before = levelDigest(level);
    const once = resortBuildingsOf(cabinsOf(level));
    expect(resortBuildingsOf(cabinsOf(generateLevel(SEEDS[0])))).toEqual(once);
    expect(levelDigest(level)).toBe(before);
  });

  it("stand a village on every ski area: the lodge, tickets, rental, school, first aid, hotels", () => {
    const seen = new Map<string, number>();
    let maps = 0;
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      if (!level.resort?.hub) continue;
      maps++;
      const list = resortBuildingsOf(cabinsOf(level));
      for (const k of new Set(list.map((c) => c.kind))) seen.set(k, (seen.get(k) ?? 0) + 1);
      expect(list.filter((c) => c.kind === "hotel").length).toBeLessThanOrEqual(
        RESORT_LAYOUT.hotels.most,
      );
      expect(new Set(list.map((c) => c.id)).size).toBe(list.length);
    }
    expect(maps).toBeGreaterThan(0);
    for (const k of ["restaurant", "ticket", "rental", "school", "firstAid", "hotel"]) {
      expect(seen.get(k) ?? 0, k).toBeGreaterThanOrEqual(Math.ceil(maps * 0.75));
    }
  });

  it("leave every log cabin and lodge where it stood", () => {
    // The cabins' own placer stands its buildings first; a list built with
    // the ski area's buildings must hold exactly the log buildings a list
    // without them would — so compare against the cabins' own rule: no log
    // building comes after the first of the ski area's.
    for (const seed of SEEDS.slice(0, 2)) {
      const list = cabinsOf(levelFor(seed));
      const first = list.findIndex((c) => isResortBuilding(c.kind));
      if (first < 0) continue;
      expect(list.slice(first).every((c) => isResortBuilding(c.kind))).toBe(true);
      expect(logs(list).length).toBe(first);
    }
  });

  it("stand off the runs' snow, out of the hub, the lifts' lines and their queues", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const hub = level.resort?.hub;
      const lanes = liftPlans(level).map((p) =>
        queueLane(p).map(({ u, v }) => ({
          x: p.lift.bottom.x + p.dx * u + p.dz * v,
          z: p.lift.bottom.z + p.dz * u - p.dx * v,
        })),
      );
      for (const c of resortBuildingsOf(cabinsOf(level))) {
        // A mountain building's terrace may stand out over a top's packed
        // pad; its walls, and every village building's roof, may not.
        const deck = isMountainBuilding(c.kind);
        for (const [x, z] of deck ? walls(c) : roof(c)) {
          expect(level.packedAt(x, z), `${c.id} ${c.kind}`).toBeLessThanOrEqual(0.25);
        }
        for (const [x, z] of roof(c)) {
          expect(clearOfLifts(level, x, z)).toBe(true);
          if (hub) expect(outsideHub(hub, x, z)).toBeGreaterThan(0);
          for (const lane of lanes) {
            for (const q of lane) expect(Math.hypot(q.x - x, q.z - z)).toBeGreaterThan(3);
          }
        }
      }
    }
  });

  it("keep their roofs apart, and no crown over one", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const all = cabinsOf(level);
      const gone = felledTrees(level);
      for (const c of resortBuildingsOf(all)) {
        for (const o of all) {
          if (o === c) continue;
          for (const [x, z] of roof(o)) {
            const d = CABINS[c.kind];
            const dx = x - c.x;
            const dz = z - c.z;
            const fx = Math.sin(c.heading);
            const fz = Math.cos(c.heading);
            const lx = dx * fz - dz * fx;
            const lz = dx * fx + dz * fz;
            const inside =
              Math.abs(lx) < d.width / 2 + d.reach.side &&
              lz > -d.depth / 2 - d.reach.back &&
              lz < d.depth / 2 + d.reach.front;
            expect(inside, `${o.id} under ${c.id}`).toBe(false);
          }
        }
        const d = CABINS[c.kind];
        const fx = Math.sin(c.heading);
        const fz = Math.cos(c.heading);
        level.trees.forEach((t, i) => {
          const dx = t.x - c.x;
          const dz = t.z - c.z;
          if (Math.abs(dx) > 70 || Math.abs(dz) > 70) return;
          const lx = dx * fz - dz * fx;
          const lz = dx * fx + dz * fz;
          // A tree inside the walls is felled; one felled for the village's
          // lots and streets stands nowhere either.
          if (insideWalls(d.width, d.depth, lx, lz)) {
            expect(gone[i], `${t.kind} inside ${c.id}`).toBe(1);
            return;
          }
          if (gone[i]) return;
          const under =
            Math.abs(lx) < d.width / 2 + d.reach.side &&
            lz > -d.depth / 2 - d.reach.back &&
            lz < d.depth / 2 + d.reach.front;
          expect(under, `${t.kind} under ${c.id} ${c.kind}`).toBe(false);
        });
      }
    }
  });

  it("are solid: walls round every one of them", () => {
    const level = levelFor(SEEDS[0]);
    const walls = cabinWalls(level);
    for (const c of resortBuildingsOf(cabinsOf(level))) {
      const d = CABINS[c.kind];
      const fx = Math.sin(c.heading);
      const fz = Math.cos(c.heading);
      for (const [lx, lz] of [
        [-d.width / 2, 0],
        [d.width / 2, 0],
        [0, d.depth / 2],
        [0, -d.depth / 2],
      ]) {
        const x = c.x + lx * fz + lz * fx;
        const z = c.z - lx * fx + lz * fz;
        const near = Math.min(...walls.map((w) => Math.hypot(w.x - x, w.z - z)));
        expect(near).toBeLessThan(1);
      }
    }
  });

  it("show a door and a front a walker can find", () => {
    const level = levelFor(SEEDS[0]);
    for (const c of resortBuildingsOf(cabinsOf(level))) {
      const door = buildingDoor(c);
      const d = CABINS[c.kind];
      expect(Math.hypot(door.x - c.x, door.z - c.z)).toBeCloseTo(d.depth / 2 + 1, 6);
      const front = buildingFront(c);
      expect(front.half).toBeGreaterThan(d.width / 2);
      // The front's middle is out before the walls, along the heading.
      const ahead = (front.x - c.x) * Math.sin(c.heading) + (front.z - c.z) * Math.cos(c.heading);
      expect(ahead).toBeGreaterThan(d.depth / 2);
    }
  });

  it("stand none on a map with no ski area", () => {
    const level: Level = { ...levelFor(SEEDS[0]), resort: undefined } as Level;
    expect(resortBuildingsOf(cabinsOf(level))).toEqual([]);
  });
});

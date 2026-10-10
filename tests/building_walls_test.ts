// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// EVERY BUILDING SOLID AS DRAWN (`building-walls.ts`): a skier driven into
// the walls of every kind of building — square and at a slant, at a crawl
// and at speed, at the middle of a wall and at its corner — never ends up
// inside its footprint, nor does any part of his body thrown; every
// building with a door has a doorway, shut by the door, that a walker
// passes through only while the run has it open; and once inside, the
// walls hold him in.

import { beforeAll, describe, expect, it } from "vitest";

import {
  BUILDING_DOORS,
  BUILDING_WALLS,
  CABINS,
  CHURCH_TOWER,
  buildingAt,
  buildingDoors,
  cabinWalls,
  cabinsOf,
  createGame,
  doorOpen,
  generateLevel,
  loadRealFace,
  NEUTRAL_INPUT,
  placeRun,
  setDoor,
  solidsOf,
  step,
  TUNING,
  wallSegmentsOf,
  type Cabin,
  type CabinKind,
  type GameState,
  type Level,
} from "@engine";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

/** A point of a building's frame in the world. */
function world(c: Cabin, lx: number, lz: number): { x: number; z: number } {
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  return { x: c.x + lx * fz + lz * fx, z: c.z - lx * fx + lz * fz };
}

/** Whether (x, z) is inside `c`'s walls by more than `m`. */
function inside(c: Cabin, x: number, z: number, m: number): boolean {
  const d = CABINS[c.kind];
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const dx = x - c.x;
  const dz = z - c.z;
  const lx = dx * fz - dz * fx;
  const lz = dx * fx + dz * fz;
  if (Math.abs(lx) >= d.width / 2 - m || Math.abs(lz) >= d.depth / 2 - m) return false;
  // The church's front corners beside its tower are the plinth's, open
  // above it: only the nave and the tower are inside.
  if (c.kind === "church" && lz > d.depth / 2 - CHURCH_TOWER.side - m)
    return Math.abs(lx) < CHURCH_TOWER.side / 2 - m;
  return true;
}

/** One building of every kind, off the corpus's maps, with its map — and
 * off a real face for a kind only a real town stands (a HALL). */
function oneOfEach(): { level: Level; c: Cabin }[] {
  const seen = new Map<CabinKind, { level: Level; c: Cabin }>();
  for (const seed of LEVEL_SEEDS) {
    const level = levelFor(seed);
    for (const c of cabinsOf(level)) if (!seen.has(c.kind)) seen.set(c.kind, { level, c });
    if (seen.size === Object.keys(CABINS).length) break;
  }
  return [...seen.values()];
}

/** The kinds `found` lacks, off the real face fell-2's town. */
function fromFace(found: { level: Level; c: Cabin }[]): { level: Level; c: Cabin }[] {
  const have = new Set(found.map((a) => a.c.kind));
  if (have.size === Object.keys(CABINS).length) return [];
  const level = generateLevel(1, { face: "fell-2" });
  const more = new Map<CabinKind, { level: Level; c: Cabin }>();
  for (const c of cabinsOf(level))
    if (!have.has(c.kind) && !more.has(c.kind)) more.set(c.kind, { level, c });
  return [...more.values()];
}

/** A free ride on `level` with the skier stood at `from` facing `to`. */
function standAt(
  level: Level,
  from: { x: number; z: number },
  to: { x: number; z: number },
): GameState {
  const state = createGame({ level, mode: "free", quiet: true });
  delete state.crowd;
  placeRun(state, { x: from.x, z: from.z, heading: Math.atan2(to.x - from.x, to.z - from.z) });
  return state;
}

/** Drive him toward `to` at `speed` m/s along the snow for `push` s (his
 * own legs, as far as the wall is concerned: the way is set every step),
 * then let him be for `rest` s; the worst intrusion into `c` seen. */
function drive(
  state: GameState,
  c: Cabin,
  to: { x: number; z: number },
  speed: number,
  push: number,
  rest = 0.5,
): string | null {
  const d = CABINS[c.kind];
  const s = state.skier;
  const ux = to.x - s.x;
  const uz = to.z - s.z;
  const len = Math.hypot(ux, uz);
  for (let i = 0; i < (push + rest) * TUNING.physicsHz; i++) {
    if (i < push * TUNING.physicsHz && !s.thrown) {
      s.vx = (ux / len) * speed;
      s.vz = (uz / len) * speed;
    }
    step(state, NEUTRAL_INPUT);
    const b = s.thrown;
    if (!b && s.y < c.y + d.ridge && inside(c, s.x, s.z, 0.05)) return `skier at step ${i}`;
    if (b) {
      for (let p = 0; p < b.points.length; p += 3) {
        if (b.points[p + 1] > c.y + d.walls) continue;
        if (inside(c, b.points[p], b.points[p + 2], 0.1)) return `body point ${p / 3} at step ${i}`;
      }
    }
  }
  return null;
}

describe("the buildings' walls", () => {
  const all = oneOfEach();
  beforeAll(async () => {
    await loadRealFace("fell-2");
    all.push(...fromFace(all));
  }, 300_000);

  it("are found for every kind of building", () => {
    expect(all.map((a) => a.c.kind).sort()).toEqual(Object.keys(CABINS).sort());
  });

  it("are slabs round every footprint, its posts in what a skier is pushed out of", () => {
    for (const { level } of all) {
      const solids = new Set(solidsOf(level));
      for (const w of cabinWalls(level)) expect(solids.has(w)).toBe(true);
      // Indexed once: a real face's town stands thousands of buildings.
      const byCabin = new Map<number, ReturnType<typeof wallSegmentsOf>[number][]>();
      for (const s of wallSegmentsOf(level)) {
        const list = byCabin.get(s.cabin) ?? [];
        list.push(s);
        byCabin.set(s.cabin, list);
      }
      const cabins = cabinsOf(level);
      for (let k = 0; k < cabins.length; k++) {
        const mine = byCabin.get(k) ?? [];
        // Four walls at the least; a door's side in two pieces and its door.
        expect(mine.length).toBeGreaterThanOrEqual(4);
        const doors = mine.filter((s) => s.door !== null);
        expect(doors.length).toBe(BUILDING_DOORS[cabins[k].kind] ? 1 : 0);
        // The walls proper stand over the eaves to the ridge.
        for (const s of mine.filter((s) => s.half === BUILDING_WALLS.wall / 2))
          expect(s.top).toBeGreaterThan(cabins[k].y + CABINS[cabins[k].kind].ridge);
      }
    }
  });

  it("stop a skier at every wall of every kind, at a crawl and at speed, square and slanting", () => {
    const bad: string[] = [];
    for (const { level, c } of all) {
      const d = CABINS[c.kind];
      // The middle of each wall, and near its corner; the way in square
      // to it and at a slant.
      for (const [nx, nz] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ]) {
        for (const along of [0, 0.4]) {
          const lx = nx !== 0 ? (nx * d.width) / 2 : along * d.width;
          const lz = nz !== 0 ? (nz * d.depth) / 2 : along * d.depth;
          for (const slant of [0, 2.5]) {
            for (const speed of [1.5, 20]) {
              const fromL = { x: lx + nx * 5 + nz * slant, z: lz + nz * 5 + nx * slant };
              const from = world(c, fromL.x, fromL.z);
              // Aimed through the wall at the building's far side.
              const to = world(c, lx - nx * 3, lz - nz * 3);
              const state = standAt(level, from, to);
              const why = drive(state, c, to, speed, speed < 5 ? 4 : 1.5);
              if (why)
                bad.push(
                  `${c.kind} n(${nx},${nz}) along ${along} slant ${slant} ${speed} m/s: ${why}`,
                );
            }
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("each have a doorway, shut by the door until the run opens it", () => {
    for (const { level, c } of all) {
      const door = buildingDoors(level).find((d) => d.id === c.id);
      if (!BUILDING_DOORS[c.kind]) {
        expect(door).toBeUndefined();
        continue;
      }
      expect(door).toBeDefined();
      const k = cabinsOf(level).indexOf(c);
      // A metre out of the door, a metre in.
      expect(buildingAt(level, door!.outside.x, door!.outside.z)).toBe(-1);
      expect(buildingAt(level, door!.inside.x, door!.inside.z)).toBe(k);
      const from = {
        x: door!.x + Math.sin(door!.heading) * 3,
        z: door!.z + Math.cos(door!.heading) * 3,
      };
      const to = door!.inside;
      // Shut: he is held outside.
      const shut = standAt(level, from, to);
      expect(drive(shut, c, to, 1.2, 4)).toBeNull();
      expect(buildingAt(level, shut.skier.x, shut.skier.z)).toBe(-1);
      // Open: he walks in.
      const open = standAt(level, from, to);
      setDoor(open, c.id, true);
      expect(doorOpen(open, c.id)).toBe(true);
      const s = open.skier;
      for (let i = 0; i < 6 * TUNING.physicsHz; i++) {
        const ux = to.x - s.x;
        const uz = to.z - s.z;
        const len = Math.hypot(ux, uz);
        if (len < 0.2) break;
        s.vx = (ux / len) * 1.2;
        s.vz = (uz / len) * 1.2;
        s.heading = Math.atan2(ux, uz);
        step(open, NEUTRAL_INPUT);
      }
      expect(buildingAt(level, s.x, s.z), `${c.kind} walked in`).toBe(k);
      // Inside, the walls hold him in: walked at the back wall, he stays.
      const back = world(c, 0, -CABINS[c.kind].depth / 2 - 3);
      for (let i = 0; i < 4 * TUNING.physicsHz; i++) {
        const ux = back.x - s.x;
        const uz = back.z - s.z;
        const len = Math.hypot(ux, uz);
        s.vx = (ux / len) * 3;
        s.vz = (uz / len) * 3;
        step(open, NEUTRAL_INPUT);
      }
      expect(buildingAt(level, s.x, s.z), `${c.kind} held in`).toBe(k);
      setDoor(open, c.id, false);
      expect(open.doors).toBeUndefined();
    }
  });

  it("stand their posts no further apart than a body", () => {
    expect(BUILDING_WALLS.post.gap).toBeLessThan(2 * BUILDING_WALLS.post.radius);
  });
});

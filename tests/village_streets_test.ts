// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S STREETS (`engine/game/village-streets.ts`, `village.ts`,
// `village-furniture.ts`, `village-place.ts`): a street plan laid below the
// hub on the valley floor — a main street, a back street, the cross streets
// between them and a road out off the map's edge — and the village's
// buildings stood along it in one compact cluster, each fronting a street
// and none standing on one. A pure function of the map, the same every
// time; packed snow for the physics only on a run dealt the day's piste,
// so no race moves.

import { describe, expect, it } from "vitest";

import {
  CABINS,
  RESORT_BUILDINGS,
  VILLAGE_KINDS,
  VILLAGE_LOTS,
  cabinsOf,
  clearOfLifts,
  createGame,
  felledTrees,
  generateLevel,
  onCarriageway,
  onStreet,
  outsideHub,
  packedSnow,
  pisteGap,
  sideReach,
  villageBuildingsOf,
  villageOf,
  villageSolids,
  type Cabin,
  type Level,
  type Village,
} from "@engine";

import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const SEEDS = LEVEL_SEEDS.slice(0, 2);

function villageFor(seed: number): { level: Level; v: Village } {
  const level = levelFor(seed);
  const v = villageOf(level);
  expect(v, `seed ${seed} has a village`).not.toBeNull();
  return { level, v: v! };
}

/** A building's footprint (its walls) in plan, a point every metre. */
function walls(c: Cabin): [number, number][] {
  const d = CABINS[c.kind];
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const out: [number, number][] = [];
  for (let a = -d.width / 2; a <= d.width / 2 + 1e-6; a += 1) {
    for (let b = -d.depth / 2; b <= d.depth / 2 + 1e-6; b += 1) {
      out.push([c.x + a * fz + b * fx, c.z - a * fx + b * fz]);
    }
  }
  return out;
}

describe("the village's streets", () => {
  it("are the same every time a map is built", () => {
    const a = villageOf(generateLevel(SEEDS[0]))!;
    const b = villageOf(generateLevel(SEEDS[0]))!;
    expect(JSON.stringify(a.streets)).toBe(JSON.stringify(b.streets));
    expect(JSON.stringify(a.lanes)).toBe(JSON.stringify(b.lanes));
    expect(JSON.stringify(a.lamps)).toBe(JSON.stringify(b.lamps));
  });

  it("join up: every junction reached, a loop round the village, a road off the map", () => {
    for (const seed of SEEDS) {
      const { level, v } = villageFor(seed);
      // Connected: from the first junction, every junction by the streets.
      const seen = new Set([v.junctions[0].id]);
      for (let grew = true; grew;) {
        grew = false;
        for (const st of v.streets) {
          if (seen.has(st.from) !== seen.has(st.to)) {
            seen.add(st.from);
            seen.add(st.to);
            grew = true;
          }
        }
      }
      expect(seen.size, `seed ${seed}`).toBe(v.junctions.length);
      // The loop: each lane leaves where the last one reached, and it
      // closes.
      const lanes = v.loop.map((id) => v.lanes.find((l) => l.id === id)!);
      expect(lanes.every(Boolean)).toBe(true);
      for (let i = 0; i < lanes.length; i++) {
        expect(lanes[(i + 1) % lanes.length].from).toBe(lanes[i].to);
      }
      // A road out, its end on the map's edge.
      const roads = v.streets.filter((s) => s.exit);
      expect(roads.length, `seed ${seed}`).toBeGreaterThan(0);
      for (const r of roads) {
        const p = r.points[r.points.length - 1];
        const edge = Math.min(p.x, p.z, level.size - p.x, level.size - p.z);
        expect(edge).toBeLessThan(1.5);
      }
      // Every kind of street the plan names.
      const kinds = new Set(v.streets.map((s) => s.kind));
      for (const k of ["main", "back", "cross", "road"]) expect(kinds.has(k as never)).toBe(true);
    }
  });

  it("stay on the map and clear of the runs, the lifts and the hub", () => {
    for (const seed of SEEDS) {
      const { level, v } = villageFor(seed);
      const hub = level.resort!.hub!;
      for (const st of v.streets) {
        const reach = Math.max(sideReach(st.section, 0), sideReach(st.section, 1));
        for (const p of st.points) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.z).toBeGreaterThanOrEqual(0);
          expect(p.x).toBeLessThanOrEqual(level.size);
          expect(p.z).toBeLessThanOrEqual(level.size);
          expect(clearOfLifts(level, p.x, p.z), `${st.id} by a lift`).toBe(true);
          expect(pisteGap(level, p.x, p.z, 40), `${st.id} on a run`).toBeGreaterThan(reach);
          if (st.kind !== "aisle")
            expect(outsideHub(hub, p.x, p.z), `${st.id} in the hub`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("carry lanes, sidewalks, crossings, bays, lamps and a bus stop", () => {
    for (const seed of SEEDS) {
      const { v } = villageFor(seed);
      // A lane each way down every street.
      expect(v.lanes.length).toBe(v.streets.length * 2);
      for (const l of v.lanes) expect(l.length).toBeGreaterThan(0);
      expect(v.walks.length).toBeGreaterThan(4);
      expect(v.crossings.length).toBeGreaterThan(2);
      expect(v.bays.some((b) => b.kind === "kerb")).toBe(true);
      expect(v.bays.some((b) => b.kind === "lot")).toBe(true);
      expect(v.lamps.length).toBeGreaterThan(10);
      expect(v.bus).not.toBeNull();
    }
  });
});

describe("the village along them", () => {
  it("stands 15–40 buildings, every kind of the base and the town", () => {
    for (const seed of SEEDS) {
      const { level } = villageFor(seed);
      const town = villageBuildingsOf(level);
      expect(town.length, `seed ${seed}`).toBeGreaterThanOrEqual(15);
      expect(town.length, `seed ${seed}`).toBeLessThanOrEqual(VILLAGE_LOTS.most);
      const kinds = new Set(town.map((c) => c.kind));
      for (const k of ["restaurant", "ticket", "rental", "school", "church", "house"]) {
        expect(kinds.has(k as never), `seed ${seed} ${k}`).toBe(true);
      }
      for (const c of town) expect(VILLAGE_KINDS).toContain(c.kind);
    }
  });

  it("fronts each on its street, none on one, all in one compact cluster", () => {
    for (const seed of SEEDS) {
      const { level, v } = villageFor(seed);
      for (const c of villageBuildingsOf(level)) {
        const st = v.streets.find((s) => s.id === c.run)!;
        expect(st, c.id).toBeDefined();
        // Its front within a lot's setback of the street's reach.
        const d = RESORT_BUILDINGS[c.kind as keyof typeof RESORT_BUILDINGS];
        let near = Infinity;
        for (const p of st.points) near = Math.min(near, Math.hypot(p.x - c.x, p.z - c.z));
        const reach = Math.max(sideReach(st.section, 0), sideReach(st.section, 1));
        const far =
          reach +
          VILLAGE_LOTS.setback.house.most +
          d.depth / 2 +
          Math.max(d.reach.front, d.reach.back) +
          3;
        expect(near, `${c.id} ${c.kind} off ${st.id}`).toBeLessThan(far);
        for (const [x, z] of walls(c))
          expect(onStreet(level, x, z), `${c.id} on a street`).toBe(false);
        expect(Math.hypot(c.x - v.centre.x, c.z - v.centre.z), c.id).toBeLessThan(320);
      }
    }
  });

  it("fells the trees on its streets and lots, and stands its lamps solid", () => {
    for (const seed of SEEDS) {
      const { level, v } = villageFor(seed);
      const gone = felledTrees(level);
      level.trees.forEach((t, i) => {
        if (onStreet(level, t.x, t.z)) expect(gone[i], `tree ${i} on a street`).toBe(1);
      });
      expect(villageSolids(level).length).toBeGreaterThanOrEqual(v.lamps.length);
      // No other building of the map stands on a street either.
      for (const c of cabinsOf(level)) {
        expect(onCarriageway(level, c.x, c.z), `${c.id} ${c.kind}`).toBe(false);
      }
    }
  });
});

describe("the streets underfoot", () => {
  it("are packed snow on a free ride, and the race's snow anywhere else", () => {
    const level = generateLevel(2, {
      region: "maritime",
      sky: { weather: { kind: "storm", snowfall: 1 } },
    });
    const v = villageOf(level)!;
    const main = v.streets.find((s) => s.kind === "main")!;
    const at = main.points[Math.floor(main.points.length / 2)];
    const free = createGame({ level, mode: "free", crowd: 0, quiet: true });
    expect(free.piste).toBeDefined();
    expect(packedSnow(free, at.x, at.z)).toBe(1);
    // A race is never dealt the day's piste: the street is the map's own
    // snow there, as it was before the village had streets.
    const race = createGame({ level, rivals: 0, countdown: 0, quiet: true });
    expect(race.piste).toBeUndefined();
    expect(packedSnow(race, at.x, at.z)).toBeLessThan(1);
  });
});

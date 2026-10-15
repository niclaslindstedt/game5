// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIRES (`engine/game/fires.ts`, `fire-burn.ts`): camp fires outside a
// ski area's huts and bonfires on its valley floor — a pure function of the
// map, moving no digest, off every run's snow, their benches facing them —
// and what riding into one does: on a free ride he burns up (and, with
// his wounds carried, dies of `fire`); safe for work he is held off it; a
// race has no fires to meet.

// What the app draws on the snow is solid here as it is in the game
// (`drawn-solids.ts`): the stations' houses, boards and signs, the fires'
// benches.
import "../pwa/src/game/drawn-solids.ts";
import { describe, expect, it } from "vitest";

import {
  CABINS,
  FIRE_KINDS,
  FIRE_LAYOUT,
  NEUTRAL_INPUT,
  TUNING,
  cabinsOf,
  createGame,
  firesOf,
  levelDigest,
  mapSolidsOf,
  outsideHub,
  placeRun,
  step,
  type Cabin,
  type Fire,
  type GameEvent,
  type GameState,
} from "@engine";

import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const SEEDS = LEVEL_SEEDS.slice(0, 2);

/** The distance in plan from (x, z) to a building's walls, m. */
function fromWalls(c: Cabin, x: number, z: number): number {
  const d = CABINS[c.kind];
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const lx = (x - c.x) * fz - (z - c.z) * fx;
  const lz = (x - c.x) * fx + (z - c.z) * fz;
  return Math.hypot(
    Math.max(0, Math.abs(lx) - d.width / 2),
    Math.max(0, Math.abs(lz) - d.depth / 2),
  );
}

describe("where the fires burn", () => {
  it("are the same list twice and move no map's digest", () => {
    const level = levelFor(SEEDS[0]);
    const before = levelDigest(level);
    const once = firesOf(level);
    expect(firesOf(level)).toBe(once);
    expect(levelDigest(level)).toBe(before);
  });

  it("stand outside a share of the huts, and two to four bonfires at the bottom", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const fires = firesOf(level);
      const camps = fires.filter((f) => f.kind === "camp");
      const bonfires = fires.filter((f) => f.kind === "bonfire");
      expect(camps.length).toBeGreaterThan(0);
      expect(bonfires.length).toBeGreaterThanOrEqual(FIRE_LAYOUT.bonfire.least);
      expect(bonfires.length).toBeLessThanOrEqual(FIRE_LAYOUT.bonfire.most);
      expect(new Set(fires.map((f) => f.id)).size).toBe(fires.length);
    }
  });

  it("a camp fire stands a few metres out from its own hut", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const cabins = cabinsOf(level);
      for (const f of firesOf(level).filter((x) => x.kind === "camp")) {
        const hut = cabins.find((c) => c.id === f.building);
        expect(hut, f.id).toBeDefined();
        expect(["hut", "cabin", "chalet", "afterski", "mountainHut", "patrol"]).toContain(
          hut!.kind,
        );
        const d = fromWalls(hut!, f.x, f.z);
        expect(d, f.id).toBeGreaterThan(FIRE_LAYOUT.camp.eaves);
        expect(d, f.id).toBeLessThan(20);
        expect(f.radius).toBe(FIRE_KINDS.camp.radius);
      }
    }
  });

  it("a bonfire is on the valley floor, out of the hub and fifteen metres from any building", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const m = level.mountain!;
      const hub = level.resort!.hub;
      for (const f of firesOf(level).filter((x) => x.kind === "bonfire")) {
        expect(f.building).toBeNull();
        expect(f.y - m.base.y, f.id).toBeLessThan(0.2 * m.vertical);
        if (hub) expect(outsideHub(hub, f.x, f.z)).toBeGreaterThanOrEqual(FIRE_LAYOUT.bonfire.hub);
        for (const c of cabinsOf(level)) {
          expect(fromWalls(c, f.x, f.z), `${f.id} ${c.id}`).toBeGreaterThanOrEqual(
            FIRE_LAYOUT.bonfire.building,
          );
        }
      }
    }
  });

  it("every fire and every bench is off the runs' snow, the benches facing it, no trunk in the ring", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const solids = mapSolidsOf(level);
      for (const f of firesOf(level)) {
        expect(level.packedAt(f.x, f.z), f.id).toBeLessThanOrEqual(0.25 + 1e-9);
        expect(f.seats.length).toBeGreaterThanOrEqual(FIRE_KINDS[f.kind].seats.least);
        for (const s of f.seats) {
          expect(level.packedAt(s.x, s.z), f.id).toBeLessThanOrEqual(0.25 + 1e-9);
          // Facing the fire: its heading points at the hearth.
          const to = Math.atan2(f.x - s.x, f.z - s.z);
          expect(Math.abs(Math.sin(to - s.heading)), f.id).toBeLessThan(1e-9);
          expect(Math.cos(to - s.heading)).toBeGreaterThan(0);
        }
        const ring = FIRE_KINDS[f.kind].seats.ring;
        for (const s of solids) {
          if (s.radius <= 0 || s.height <= 0) continue;
          expect(Math.hypot(s.x - f.x, s.z - f.z), f.id).toBeGreaterThan(ring);
        }
      }
    }
  });
});

/** A free ride on the corpus' first map, stood `back` m short of a camp
 * fire at `speed` m/s, heading straight into it. */
function rideInto(opts: { gore?: boolean; sfw?: boolean }): { state: GameState; fire: Fire } {
  const level = levelFor(SEEDS[0]);
  const fire = firesOf(level).find((f) => f.kind === "camp")!;
  const state = createGame({ level, mode: "free", quiet: true, crowd: 0, ...opts });
  const seat = fire.seats[0];
  // From the first bench's side, between it and the fire, toward the fire.
  const heading = Math.atan2(fire.x - seat.x, fire.z - seat.z);
  const back = 1.6;
  placeRun(state, {
    x: fire.x - Math.sin(heading) * back,
    z: fire.z - Math.cos(heading) * back,
    heading,
    speed: 3,
  });
  return { state, fire };
}

function ride(state: GameState, seconds: number, each?: (e: GameEvent[]) => void): GameEvent[] {
  const all: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds / TUNING.dt); i++) {
    step(state, NEUTRAL_INPUT);
    all.push(...state.events);
    each?.(state.events);
    if (state.gore && state.gore.dead >= 0) break;
  }
  return all;
}

describe("riding into a fire", () => {
  it("a free ride has fires and a race has none to meet", () => {
    const level = levelFor(SEEDS[0]);
    expect(createGame({ level, mode: "free", quiet: true, crowd: 0 }).rules.fires).toBe(true);
    expect(createGame({ level, quiet: true }).rules.fires).toBeUndefined();
  });

  it("sets him alight and throws him into it — and with his wounds carried, he dies of fire", () => {
    const { state, fire } = rideInto({ gore: true });
    const events = ride(state, 15);
    const caught = events.find((e) => e.kind === "fire" && e.what === "caught");
    expect(caught && caught.kind === "fire" && caught.fire).toBe(fire.id);
    expect(events.some((e) => e.kind === "wipeout" && e.cause === "fire")).toBe(true);
    expect(state.skier.body.injuries.some((h) => h.kind === "airwayBurn")).toBe(true);
    const death = events.find((e) => e.kind === "death");
    expect(death && death.kind === "death" && death.cause).toBe("fire");
  });

  it("without his wounds carried he burns and lies there until he is stood up, put out", () => {
    const { state } = rideInto({});
    expect(state.gore).toBeUndefined();
    ride(state, 2);
    expect(state.skier.thrown?.cause).toBe("fire");
    expect(state.burn?.burning).toBe(true);
    expect(state.burn!.flux).toBeGreaterThan(0);
    expect(state.skier.body.heat).toBeGreaterThan(0);
    const events = ride(state, 20);
    expect(events.some((e) => e.kind === "fire" && e.what === "out")).toBe(true);
    expect(state.skier.thrown).toBeNull();
    expect(state.burn).toBeUndefined();
  });

  it("safe for work, he is held off the hearth untouched", () => {
    const { state, fire } = rideInto({ sfw: true, gore: true });
    let closest = Infinity;
    const events = ride(state, 4, () => {
      const c = state.skier;
      closest = Math.min(closest, Math.hypot(c.x - fire.x, c.z - fire.z));
    });
    expect(events.some((e) => e.kind === "fire")).toBe(false);
    expect(state.burn).toBeUndefined();
    expect(state.skier.thrown).toBeNull();
    expect(state.skier.body.heat).toBe(0);
    expect(closest).toBeGreaterThanOrEqual(fire.radius + TUNING.trees.bodyRadius - 1e-6);
  });
});

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AFTERSKI LODGES: where they stand (one on the valley floor beside
// the hub, often one part way down), that they are a pure function of the
// map and move no digest, and going in and out — the machine press at the
// door, the beers inside raising the buzz, the jump press ordering the next
// one sooner, and out again with the skis on and the buzz kept.

import { describe, expect, it } from "vitest";

import {
  AFTERSKI,
  afterskiWithin,
  CABINS,
  cabinsOf,
  createGame,
  doorOf,
  generateLevel,
  isResortBuilding,
  levelDigest,
  lodgesOf,
  NEUTRAL_INPUT,
  RAGDOLL,
  standSkier,
  step,
  TUNING,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";

import { afterskiOf } from "../pwa/src/game/afterski-hud.ts";
import { movePoints, type BodyMove } from "../pwa/src/game/party-pose.ts";
import { BODY } from "../pwa/src/game/skier-mounts.ts";

import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const SEEDS = LEVEL_SEEDS.slice(0, 4);
const ENTER: SkierInput = { ...NEUTRAL_INPUT, machine: true };

function ride(state: GameState, seconds: number, input: SkierInput = NEUTRAL_INPUT): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
    step(state, input);
    events.push(...state.events);
  }
  return events;
}

/** A free ride on `seed`'s map, the crowd sent home, stood at its first
 * lodge's door. */
function atTheDoor(seed = SEEDS[0]): GameState {
  const state = createGame({ level: levelFor(seed), mode: "free", quiet: true });
  delete state.crowd;
  const door = doorOf(lodgesOf(state.level)[0]);
  standSkier(state, door.x, door.z, door.heading);
  return state;
}

describe("the afterski lodges", () => {
  it("stand on every map: the first by the hub on the valley floor, two at most", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      const lodges = lodgesOf(level);
      expect(lodges.length, `seed ${seed}`).toBeGreaterThanOrEqual(1);
      expect(lodges.length).toBeLessThanOrEqual(2);
      const m = level.mountain!;
      expect((lodges[0].y - m.base.y) / m.vertical).toBeLessThan(0.12);
      expect(lodges.map((l) => l.id)).toEqual(lodges.map((_, i) => `A${i + 1}`));
      if (lodges[1]) {
        const share = (lodges[1].y - m.base.y) / m.vertical;
        expect(share).toBeGreaterThanOrEqual(AFTERSKI.lodge.band[0] - 0.05);
        expect(share).toBeLessThanOrEqual(AFTERSKI.lodge.band[1] + 0.05);
        const apart = Math.hypot(lodges[1].x - lodges[0].x, lodges[1].z - lodges[0].z);
        expect(apart).toBeGreaterThanOrEqual(AFTERSKI.lodge.apart);
      }
    }
  });

  it("are placed after the cabins, so not one cabin moves for them", () => {
    for (const seed of SEEDS) {
      // The log buildings: the ski area's own come after every one of them
      // (`tests/resort_buildings_test.ts`).
      const all = cabinsOf(levelFor(seed)).filter((c) => !isResortBuilding(c.kind));
      const first = all.findIndex((c) => c.kind === "afterski");
      expect(first).toBeGreaterThan(-1);
      expect(all.slice(first).every((c) => c.kind === "afterski")).toBe(true);
      // ...and the cabins before them keep their own numbering.
      all.slice(0, first).forEach((c, i) => expect(c.id).toBe(`H${i + 1}`));
    }
  });

  it("are a pure function of the map and move no digest", () => {
    const seed = SEEDS[1];
    const a = lodgesOf(levelFor(seed));
    const fresh = generateLevel(seed);
    expect(lodgesOf(fresh)).toEqual(a);
    expect(levelDigest(fresh)).toBe(levelDigest(levelFor(seed)));
  });

  it("have a door on open snow a skier can stop at, off the terrace", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      for (const lodge of lodgesOf(level)) {
        const door = doorOf(lodge);
        const d = CABINS.afterski;
        const out = Math.hypot(door.x - lodge.x, door.z - lodge.z);
        expect(out).toBeCloseTo(d.depth / 2 + d.reach.front + AFTERSKI.door, 6);
        expect(door.x).toBeGreaterThan(0);
        expect(door.z).toBeLessThan(level.size);
      }
    }
  });
});

describe("going in", () => {
  it("takes a stopped skier at the door in on the machine press", () => {
    const state = atTheDoor();
    expect(afterskiWithin(state)).toBe(true);
    const events = ride(state, TUNING.dt, ENTER);
    expect(state.afterski!.inside).toBe(lodgesOf(state.level)[0].id);
    expect(events.some((e) => e.kind === "afterski" && e.phase === "in")).toBe(true);
  });

  it("is shut on a run that opens no lodge, and to a skier going past", () => {
    const race = createGame({ level: levelFor(SEEDS[0]), quiet: true });
    const door = doorOf(lodgesOf(race.level)[0]);
    standSkier(race, door.x, door.z, door.heading);
    expect(race.afterski).toBeUndefined();
    expect(afterskiWithin(race)).toBe(false);
    const fast = atTheDoor();
    fast.skier.vx = 6;
    expect(afterskiWithin(fast)).toBe(false);
    const far = atTheDoor();
    standSkier(far, far.skier.x + 40, far.skier.z, 0);
    expect(afterskiWithin(far)).toBe(false);
  });

  it("pours a beer every so often, each raising the buzz, and holds him still", () => {
    const state = atTheDoor();
    ride(state, TUNING.dt, ENTER);
    const x = state.skier.x;
    const B = AFTERSKI.beers;
    const events = ride(state, B.first + 2 * B.every + 0.5);
    const beers = events.filter((e) => e.kind === "afterski" && e.phase === "beer");
    expect(beers).toHaveLength(3);
    expect(state.afterski!.beers).toBe(3);
    expect(state.skier.buzz).toBeCloseTo(3 * B.beer, 6);
    expect(state.skier.x).toBe(x);
    // ...and never past 1.
    ride(state, 10 * B.every);
    expect(state.skier.buzz).toBe(1);
  });

  it("orders the next one at once on the jump press", () => {
    const slow = atTheDoor();
    const fast = atTheDoor();
    ride(slow, TUNING.dt, ENTER);
    ride(fast, TUNING.dt, ENTER);
    const B = AFTERSKI.beers;
    ride(slow, 12);
    ride(fast, 12, { ...NEUTRAL_INPUT, jump: true });
    expect(fast.afterski!.beers).toBeGreaterThan(slow.afterski!.beers);
    expect(fast.afterski!.beers).toBeLessThanOrEqual(Math.ceil(12 / (B.least + B.sip)) + 1);
  });

  it("lets him out on the same press, his skis on, at the door, the buzz with him", () => {
    const state = atTheDoor();
    ride(state, TUNING.dt, ENTER);
    ride(state, 20);
    const buzz = state.skier.buzz!;
    expect(buzz).toBeGreaterThan(0);
    const events = ride(state, TUNING.dt, ENTER);
    expect(state.afterski!.inside).toBeNull();
    expect(events.some((e) => e.kind === "afterski" && e.phase === "out")).toBe(true);
    const door = doorOf(lodgesOf(state.level)[0]);
    expect(Math.hypot(state.skier.x - door.x, state.skier.z - door.z)).toBeLessThan(0.5);
    expect(state.skier.thrown).toBeNull();
    expect(state.skier.buzz).toBeCloseTo(buzz, 6);
    // ...and outside he sobers up, slowly.
    ride(state, 6);
    expect(state.skier.buzz!).toBeLessThan(buzz);
    expect(state.skier.buzz!).toBeGreaterThan(buzz - 0.05);
  });
});

describe("as the HUD and the figure read it", () => {
  it("calls the lodge near its door, reads the room inside", () => {
    const state = atTheDoor();
    expect(afterskiOf(state)).toMatchObject({ kind: "call", near: true });
    ride(state, TUNING.dt, ENTER);
    ride(state, AFTERSKI.beers.first + 0.5);
    expect(afterskiOf(state)).toMatchObject({ kind: "inside", beers: 1 });
    const far = atTheDoor();
    standSkier(far, far.skier.x + 200, far.skier.z, 0);
    expect(afterskiOf(far)).toBeNull();
  });

  it("lays every move off the skis on a body of the engine's lengths", () => {
    const moves: BodyMove[] = [
      { kind: "rise", t: 0, k: 0 },
      { kind: "rise", t: 0, k: 0.5 },
      { kind: "walk", t: 0.7, pace: 1, sway: 1, carry: true },
      { kind: "pick", t: 0, k: 0.5 },
      { kind: "clip", t: 0, k: 0.3 },
      ...[0, 1, 2, 3].map((style) => ({ kind: "dance" as const, t: 1.3, style, sway: 0.5 })),
      { kind: "drink", t: 2, k: 0.5 },
    ];
    const at = (p: number[], i: number) => [p[3 * i], p[3 * i + 1], p[3 * i + 2]];
    const gap = (p: number[], i: number, j: number) => {
      const [a, b] = [at(p, i), at(p, j)];
      return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    };
    for (const m of moves) {
      const p = movePoints(m, 0);
      expect(p.every(Number.isFinite), m.kind).toBe(true);
      for (const [hip, knee, foot] of [
        [RAGDOLL.hipL, RAGDOLL.kneeL, RAGDOLL.footL],
        [RAGDOLL.hipR, RAGDOLL.kneeR, RAGDOLL.footR],
      ]) {
        expect(gap(p, hip, knee)).toBeCloseTo(BODY.thigh, 3);
        expect(gap(p, knee, foot)).toBeCloseTo(BODY.shin, 3);
        // ...and no foot in the floor.
        expect(at(p, foot)[1]).toBeGreaterThan(-0.01);
      }
    }
  });
});

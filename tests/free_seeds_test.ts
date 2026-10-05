// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREE RIDE'S OWN MOUNTAINS and the map built once: the fixed seeds the
// start card opens on and ANOTHER MOUNTAIN steps through (`FREE_SEEDS`), a
// map handed from the card's worker to the page (`portableLevel`,
// `boundLevel`), the front door's map ridden as it stands (`standingFor`),
// and the engine saying when a map would come off the ski area it already
// built (`levelIsCached`).
import { describe, expect, it } from "vitest";

import {
  boundLevel,
  createGame,
  generateLevel,
  levelDigest,
  levelIsCached,
  portableLevel,
  SKIS,
  FULL_ASSIST,
  botInput,
  step,
  type GameState,
} from "@engine";

import {
  FIRST_FREE_SEED,
  FREE_SEEDS,
  freeGameOptions,
  freshRide,
  nextFreeSeed,
  standingFor,
} from "../pwa/src/game/free-ride.ts";

const skier = { spec: SKIS, assist: FULL_ASSIST };

describe("the free ride's mountains (FREE_SEEDS)", () => {
  it("are the same distinct seeds, in the MAP row's range, the first the card's", () => {
    expect(new Set(FREE_SEEDS).size).toBe(FREE_SEEDS.length);
    for (const s of FREE_SEEDS) {
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(999_999);
    }
    expect(FIRST_FREE_SEED).toBe(FREE_SEEDS[0]);
  });

  it("ANOTHER MOUNTAIN steps through them in order, round to the first", () => {
    const walked = [FIRST_FREE_SEED];
    for (let i = 1; i < FREE_SEEDS.length; i++) walked.push(nextFreeSeed(walked[i - 1]));
    expect(walked).toEqual([...FREE_SEEDS]);
    expect(nextFreeSeed(FREE_SEEDS[FREE_SEEDS.length - 1])).toBe(FIRST_FREE_SEED);
  });

  it("a seed of the skier's own is followed by the first", () => {
    const own = 987_654;
    expect(FREE_SEEDS).not.toContain(own);
    expect(nextFreeSeed(own)).toBe(FIRST_FREE_SEED);
  });
});

describe("a map built once", () => {
  // The first mountain: the front door's and the card's.
  const level = generateLevel(FIRST_FREE_SEED);

  it("the first mountain builds on its first attempt — the quickest a map builds", () => {
    expect(level.attempt).toBe(0);
  });

  it("the engine knows a map would come off the ski area it built last", () => {
    expect(levelIsCached(FIRST_FREE_SEED)).toBe(true);
    expect(levelIsCached(FIRST_FREE_SEED, { grade: "black" })).toBe(true);
    expect(levelIsCached(FIRST_FREE_SEED, { region: "fell" })).toBe(false);
    expect(levelIsCached(FIRST_FREE_SEED + 1)).toBe(false);
    // A map of one piste is never a ski area's.
    expect(levelIsCached(FIRST_FREE_SEED, { version: 1 })).toBe(false);
  });

  it("posted across a thread and bound again, reads exactly as the map", () => {
    const posted = structuredClone(portableLevel(level));
    // Nothing of it is a function: it is data a worker can post.
    expect(Object.values(posted).some((v) => typeof v === "function")).toBe(false);
    const bound = boundLevel(posted);
    expect(levelDigest(bound)).toBe(levelDigest(level));
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 0, y: 0, z: 0 };
    for (let k = 0; k < 500; k++) {
      const x = (k * 13.37) % level.size;
      const z = (k * 71.9) % level.size;
      expect(Object.is(bound.groundAt(x, z), level.groundAt(x, z))).toBe(true);
      expect(Object.is(bound.packedAt(x, z), level.packedAt(x, z))).toBe(true);
      level.normalAt(x, z, a);
      bound.normalAt(x, z, b);
      expect(b).toEqual(a);
    }
  });

  it("a free ride on the posted map is the ride built off the seed, step for step", () => {
    const options = freeGameOptions(freshRide(), FIRST_FREE_SEED, skier);
    const ride = (game: GameState): unknown => {
      for (let i = 0; i < 600; i++) step(game, botInput(game));
      return [game.t, game.skier.speed, game.skier.contacts];
    };
    const posted = boundLevel(structuredClone(portableLevel(level)));
    expect(ride(createGame({ ...options, level: posted }))).toEqual(
      ride(createGame({ ...options })),
    );
  });

  it("the front door's map is ridden as it stands only when it is the map asked for", () => {
    const door = createGame({ seed: FIRST_FREE_SEED });
    const ride = freeGameOptions(freshRide(), FIRST_FREE_SEED, skier);
    expect(standingFor(door.level, door.rules, ride)).toBe(door.level);
    // Another country, a grade asked, another seed: another map.
    const fell = freeGameOptions({ ...freshRide(), region: "fell" }, FIRST_FREE_SEED, skier);
    expect(standingFor(door.level, door.rules, fell)).toBeUndefined();
    const red = freeGameOptions({ ...freshRide(), grade: "red" }, FIRST_FREE_SEED, skier);
    expect(standingFor(door.level, door.rules, red)).toBeUndefined();
    const other = freeGameOptions(freshRide(), nextFreeSeed(FIRST_FREE_SEED), skier);
    expect(standingFor(door.level, door.rules, other)).toBeUndefined();
    // A slalom's map has a course set over it.
    const slalom = createGame({ seed: FIRST_FREE_SEED, mode: "slalom" });
    expect(standingFor(slalom.level, slalom.rules, ride)).toBeUndefined();
  });
});

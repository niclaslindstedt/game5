// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GENERATOR'S VERSIONS, and the three things about them that are only
// true because something refuses to let them stop being true.
//
// The scheme (engine/mapgen/versions.ts): a pinned map names the version
// of the generator it was curated under, that version keeps building it,
// and everything else in the game takes the current rules. Three halves of
// it fail SILENTLY without a case here:
//
//   * A MAP POINTING AT NOTHING. A version pruned while a map still named it
//     does not throw — `generatorTraits` falls back to the current rules —
//     so the map quietly becomes a different loop.
//   * A MUSEUM. A legacy version nobody names any more costs nothing to
//     leave in, so it gets left in, and the branch it keeps alive is read
//     and worked around by every session after this one.
//   * THE RULES MOVING UNDER A PINNED MAP. Nothing in the generator knows
//     that seed 10 used to put its third checkpoint somewhere else, so every
//     map is REBUILT and held to the digest it was curated with
//     (`race_maps_test.ts`, `trick_maps_test.ts`). When
//     this goes red, read `versions.ts`'s header before touching a digest: a
//     map deliberately moved writes its new digest down; the rules moving
//     under one that did not owes a version row instead.

import { describe, expect, it } from "vitest";

import {
  CURRENT_GENERATOR_VERSION,
  GENERATOR_VERSIONS,
  GENERATOR_VERSION_IDS,
  generateLevel,
  generatorTraits,
  isGeneratorVersion,
  levelDigest,
  weatherOf,
  withSky,
} from "@engine";

import { BENCHMARK } from "../pwa/src/game/benchmark-plan.ts";
import { RACE_MAPS } from "../pwa/src/game/race-maps.ts";
import { TRICK_MAPS } from "../pwa/src/game/trick-maps.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

/** Every version something committed actually stands on: the race maps
 * (`race_maps_test.ts` holds their digests), the trick maps (`trick_maps_test.ts` holds their digests) and the
 * benchmark's race — each a map pinned so that a result on it is a result on
 * the same snow. */
const pinned = new Set([
  ...TRICK_MAPS.map((map) => map.version),
  ...Object.values(RACE_MAPS).flatMap((maps) => maps.map((map) => map.version)),
  BENCHMARK.version,
]);

describe("the generator's version registry", () => {
  it("counts up, with no version stated twice", () => {
    expect(GENERATOR_VERSION_IDS.length).toBeGreaterThan(0);
    expect(new Set(GENERATOR_VERSION_IDS).size).toBe(GENERATOR_VERSION_IDS.length);
    for (const row of GENERATOR_VERSIONS) {
      expect(Number.isInteger(row.version), `v${row.version} is not a whole number`).toBe(true);
      expect(row.note.length, `v${row.version} has no note saying what it is`).toBeGreaterThan(0);
    }
    expect(GENERATOR_VERSION_IDS, "the rows are not oldest-first").toEqual(
      [...GENERATOR_VERSION_IDS].sort((a, b) => a - b),
    );
  });

  it("names the LAST row as the current one", () => {
    expect(CURRENT_GENERATOR_VERSION).toBe(GENERATOR_VERSION_IDS[GENERATOR_VERSION_IDS.length - 1]);
    expect(Math.max(...GENERATOR_VERSION_IDS)).toBe(CURRENT_GENERATOR_VERSION);
  });

  it("hands an unknown version the current rules rather than throwing", () => {
    expect(isGeneratorVersion(CURRENT_GENERATOR_VERSION)).toBe(true);
    for (const bogus of [0, -1, 1_000_000, 1.5, "1", null, undefined]) {
      expect(isGeneratorVersion(bogus), String(bogus)).toBe(false);
    }
    expect(generatorTraits(1_000_000).version).toBe(CURRENT_GENERATOR_VERSION);
    expect(generatorTraits(undefined).version).toBe(CURRENT_GENERATOR_VERSION);
  });

  it("stamps every map with the version that built it, the current one by default", () => {
    expect(levelFor(LEVEL_SEEDS[0]).version).toBe(CURRENT_GENERATOR_VERSION);
    expect(generateLevel(LEVEL_SEEDS[0], { version: 1_000_000 }).version).toBe(
      CURRENT_GENERATOR_VERSION,
    );
  });

  it("reads the same digest off the same map twice, and a different one off another", () => {
    const a = levelFor(LEVEL_SEEDS[0]);
    expect(levelDigest(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(levelDigest(a)).toBe(levelDigest(a));
    expect(levelDigest(levelFor(LEVEL_SEEDS[1]))).not.toBe(levelDigest(a));
  });

  it("moves the digest when the day moves, and not when nothing does", () => {
    const a = levelFor(LEVEL_SEEDS[0]);
    expect(levelDigest(withSky(a, {}))).toBe(levelDigest(a));
    expect(levelDigest(withSky(a, { hour: a.sun.hour + 1 }))).not.toBe(levelDigest(a));
    const other = weatherOf(a).kind === "fog" ? "clear" : "fog";
    expect(levelDigest(withSky(a, { weather: other }))).not.toBe(levelDigest(a));
  });
});

describe("what the pinned maps stand on", () => {
  it("gives every map a version this build can still build", () => {
    for (const version of pinned) {
      expect(
        isGeneratorVersion(version),
        `a pinned map names generator v${version}, which this build no longer carries — ` +
          "either restore the row in engine/mapgen/versions.ts or move the map onto a " +
          "version that exists (a curation: re-rate, re-time, re-name, write the new digest)",
      ).toBe(true);
    }
  });

  it("keeps no legacy version nothing pinned names any more", () => {
    const stale = GENERATOR_VERSION_IDS.filter(
      (version) => version !== CURRENT_GENERATOR_VERSION && !pinned.has(version),
    );
    expect(
      stale,
      `nothing pinned names generator v${stale.join(", v")} any more — delete the row from ` +
        "engine/mapgen/versions.ts and every trait branch that only existed for it",
    ).toEqual([]);
  });
});

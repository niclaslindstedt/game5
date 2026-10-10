// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GENERATOR'S WORD ON ITS OWN PROGRESS (`engine/mapgen/progress.ts`):
// told at its landmarks, never backwards, at one only when a map is
// accepted — and drawing nothing, so a map built with someone listening is
// the very map built without.

import { describe, expect, it } from "vitest";

import { generateLevel, levelDigest } from "@engine";
import { pinnedAsk } from "../pwa/src/game/pinned.ts";
import { RACE_MAPS } from "../pwa/src/game/race-maps.ts";
import { TRICK_MAPS, trickAsk } from "../pwa/src/game/trick-maps.ts";

function heard(build: (progress: (share: number) => void) => unknown): number[] {
  const shares: number[] = [];
  build((share) => shares.push(share));
  return shares;
}

function held(shares: number[]): void {
  expect(shares.length).toBeGreaterThan(2);
  for (let i = 1; i < shares.length; i++) expect(shares[i]).toBeGreaterThan(shares[i - 1]);
  expect(shares[0]).toBeGreaterThan(0);
  expect(shares[shares.length - 2]).toBeLessThan(1);
  expect(shares[shares.length - 1]).toBe(1);
}

describe("map progress", () => {
  it("climbs to one on a ski area, and builds the pinned map unchanged", () => {
    const pin = RACE_MAPS.slalom?.[0];
    if (!pin) throw new Error("no slalom race map");
    let digest = "";
    held(
      heard((progress) => {
        digest = levelDigest(generateLevel(pin.seed, { ...pinnedAsk(pin), progress }));
      }),
    );
    expect(digest).toBe(pin.digest);
  });

  it("climbs to one on a map of one piste, and moves nothing it builds", () => {
    const map = TRICK_MAPS[0];
    let told = "";
    held(
      heard((progress) => {
        told = levelDigest(generateLevel(map.seed, { ...trickAsk(map), progress }));
      }),
    );
    expect(told).toBe(levelDigest(generateLevel(map.seed, trickAsk(map))));
    expect(told).toBe(map.digest);
  });

  it("says nothing for a search that finds no map", () => {
    const shares: number[] = [];
    expect(() =>
      generateLevel(1, { attempts: 0, progress: (s) => shares.push(s), version: 1 }),
    ).toThrow();
    expect(shares).toEqual([]);
  });
});

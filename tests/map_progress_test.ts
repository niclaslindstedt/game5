// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GENERATOR'S WORD ON ITS OWN PROGRESS (`engine/mapgen/progress.ts`):
// told at its landmarks, never backwards, at one only when a map is
// accepted, with the stage it is on — and drawing nothing, so a map built
// with someone listening is the very map built without.

import { describe, expect, it } from "vitest";

import { generateLevel, levelDigest, type MapWork } from "@engine";
import { pinnedAsk } from "../pwa/src/game/pinned.ts";
import { RACE_MAPS } from "../pwa/src/game/race-maps.ts";
import { TRICK_MAPS, trickAsk } from "../pwa/src/game/trick-maps.ts";

/** Every share told, and every stage and attempt beside it. */
const works: MapWork[] = [];
function heard(build: (progress: (share: number, work?: MapWork) => void) => unknown): number[] {
  const shares: number[] = [];
  works.length = 0;
  build((share, work) => {
    shares.push(share);
    if (work) works.push(work);
  });
  return shares;
}

/** The stages, in the order a search reaches them. */
const STAGES = [
  "mountain",
  "pads",
  "walked",
  "graded",
  "access",
  "features",
  "woods",
  "courses",
  "checked",
];

function held(shares: number[]): void {
  expect(shares.length).toBeGreaterThan(2);
  // Never backwards; told again at the same share only for a new stage.
  for (let i = 1; i < shares.length; i++) expect(shares[i]).toBeGreaterThanOrEqual(shares[i - 1]);
  expect(works.length).toBe(shares.length);
  // An attempt's stages come in order, its share through it never falling.
  for (let i = 1; i < works.length; i++) {
    if (works[i].attempt !== works[i - 1].attempt) continue;
    expect(STAGES.indexOf(works[i].stage)).toBeGreaterThanOrEqual(
      STAGES.indexOf(works[i - 1].stage),
    );
    expect(works[i].part).toBeGreaterThanOrEqual(works[i - 1].part);
  }
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

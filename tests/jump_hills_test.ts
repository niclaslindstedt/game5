// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SKI JUMPING'S OWN HILLS (`pwa/src/game/jump-hills.ts`): each a seed's map
// in its country held to its digest, and the hill R43 cuts on it held to
// its own — so a rule moving the hill under a map that did not move is a
// red suite too; the line its box draws; both classes of hill among them,
// spread over the countries and the skies a jury lets a contest go ahead
// in, some at night; none of them a trick map; each jumped on its own day
// as a contest; the card's answer remembered; and the line the tricks card
// bills the format in. The normal hills are rebuilt here, the large in
// `jump_hills_large_test.ts`, so neither file runs past a minute.

import { describe, expect, it } from "vitest";

import { mergeSettings } from "../pwa/src/game/settings.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { TRICK_MAPS } from "../pwa/src/game/trick-maps.ts";
import { checkHill } from "./support/jump-hills.ts";
import {
  JUMP_HILLS,
  cardMaps,
  cardPick,
  hillBilling,
  hillSizes,
  isJumpHill,
  jumpHillFor,
} from "../pwa/src/game/jump-hills.ts";

const where = (m: { seed: number; region?: string }): string => `${m.seed}/${m.region ?? "alpine"}`;

describe("ski jumping's hills", () => {
  it("are nine, each its own map and its own day, both classes among them", () => {
    expect(JUMP_HILLS).toHaveLength(9);
    expect(new Set(JUMP_HILLS.map((h) => h.id)).size).toBe(9);
    expect(new Set(JUMP_HILLS.map(where)).size).toBe(9);
    expect(new Set(JUMP_HILLS.map((h) => h.hill))).toEqual(new Set(["normal", "large"]));
    expect(new Set(JUMP_HILLS.map((h) => h.region ?? "alpine")).size).toBe(4);
    expect(new Set(JUMP_HILLS.map((h) => h.day.weather)).size).toBeGreaterThanOrEqual(5);
    // Some contests are under the arena's floodlights; none in a storm,
    // which a jury would not let go ahead.
    expect(JUMP_HILLS.filter((h) => h.day.hour >= 18).length).toBeGreaterThanOrEqual(2);
    expect(JUMP_HILLS.some((h) => h.day.weather === "storm")).toBe(false);
  });

  it("stand on no trick map's ground", () => {
    const tricks = new Set(TRICK_MAPS.map(where));
    for (const h of JUMP_HILLS) expect(tricks.has(where(h)), h.id).toBe(false);
  });

  for (const row of JUMP_HILLS.filter((h) => h.hill === "normal")) {
    it(`${row.id} builds its map and its hill, and is jumped on its own day`, () => checkHill(row));
  }
});

describe("the trick map card for ski jumping", () => {
  it("offers the hills to a ski jump and the trick maps to everything else", () => {
    expect(cardMaps("skiJump")).toBe(JUMP_HILLS);
    expect(cardMaps("aerials")).toBe(TRICK_MAPS);
    expect(cardMaps("tricks")).toBe(TRICK_MAPS);
    const picks = { trickMap: "tricks-3", jumpHill: JUMP_HILLS[4].id };
    expect(cardPick("skiJump", picks)).toBe(JUMP_HILLS[4]);
    expect(cardPick("slopestyle", picks)).toBe(TRICK_MAPS[2]);
  });

  it("is the first hill on a fresh app and any hill by its id", () => {
    expect(jumpHillFor(null)).toBe(JUMP_HILLS[0]);
    expect(jumpHillFor(JUMP_HILLS[6].id)).toBe(JUMP_HILLS[6]);
    expect(jumpHillFor("tricks-1")).toBe(JUMP_HILLS[0]);
    expect(isJumpHill(JUMP_HILLS[8].id)).toBe(true);
    expect(isJumpHill("tricks-1")).toBe(false);
  });

  it("is remembered apart from the trick map, and a stale one is not", () => {
    const kept = mergeSettings({ jumpHill: JUMP_HILLS[2].id, trickMap: "tricks-5" });
    expect(kept.jumpHill).toBe(JUMP_HILLS[2].id);
    expect(kept.trickMap).toBe("tricks-5");
    expect(mergeSettings({ jumpHill: "hill-99" }).jumpHill).toBeNull();
    expect(mergeSettings({}).jumpHill).toBeNull();
  });

  it("bills each box with its own hill, and the format with both sizes", () => {
    const normal = JUMP_HILLS.find((h) => h.hill === "normal")!;
    const large = JUMP_HILLS.find((h) => h.hill === "large")!;
    expect(hillBilling(normal)).toBe("HS 106 · TRIAL + 2 ROUNDS");
    expect(hillBilling(large)).toBe("HS 140 · TRIAL + 2 ROUNDS");
    expect(hillSizes()).toEqual([106, 140]);
    expect(STRINGS.freestyleSkiJump(hillSizes(), 50, 30)).toBe("HS 106 / 140 · 50 · FINAL OF 30");
  });
});

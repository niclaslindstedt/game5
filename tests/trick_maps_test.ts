// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRICK MAPS (`pwa/src/game/trick-maps.ts`): six seeds with their trick
// field, each held to its digest and its drawn loop like a campaign map;
// each ridden on a day of its own — the date, the hour and the sky reach the
// run — every one carrying the three sizes of kicker; the card's answer is
// remembered, a stale one is not; and the words the card reads them in.

import { describe, expect, it } from "vitest";

import { SKIS, FULL_ASSIST, createGame, levelDigest, weatherOf } from "@engine";
import { CAMPAIGN_ROUTES } from "../pwa/src/game/campaign-routes.ts";
import { routeOf } from "../pwa/src/game/route-shape.ts";
import { mergeSettings } from "../pwa/src/game/settings.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import {
  TRICK_MAPS,
  buildTrickMap,
  isTrickMap,
  trickGameOptions,
  trickMapFor,
  tricksTile,
} from "../pwa/src/game/trick-maps.ts";

const SKIER = { spec: SKIS, assist: FULL_ASSIST, damage: false };

describe("the six trick maps", () => {
  it("are six, each its own seed and its own day", () => {
    expect(TRICK_MAPS).toHaveLength(6);
    expect(new Set(TRICK_MAPS.map((m) => m.id)).size).toBe(6);
    expect(new Set(TRICK_MAPS.map((m) => m.seed)).size).toBe(6);
    expect(new Set(TRICK_MAPS.map((m) => m.day.weather)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(TRICK_MAPS.map((m) => m.day.dayOfYear)).size).toBe(6);
  });

  for (const map of TRICK_MAPS) {
    it(`${map.id} builds the map it was pinned on, and is ridden on its own day`, () => {
      const built = buildTrickMap(map);
      expect(built.version).toBe(map.version);
      expect(levelDigest(built), `${map.id}'s digest moved`).toBe(map.digest);
      expect(CAMPAIGN_ROUTES[map.id], `${map.id}'s line — run \`make routes\``).toBe(
        routeOf(built),
      );
      const field = (built.kickers ?? []).filter((k) => k.trick);
      for (const size of ["low", "medium", "high"] as const) {
        expect(
          field.some((k) => k.size === size),
          `${map.id} has no ${size} kicker`,
        ).toBe(true);
      }
      const state = createGame({ ...trickGameOptions(map, SKIER, built), quiet: true });
      expect(state.rules.tricks).toBe(true);
      expect(state.level.sun.dayOfYear).toBe(map.day.dayOfYear);
      expect(state.level.sun.hour).toBeCloseTo(map.day.hour, 6);
      expect(weatherOf(state.level).kind).toBe(map.day.weather);
      // The map is the same ground whatever day it is ridden on.
      expect(state.level.ground).toBe(built.ground);
    });
  }
});

describe("the trick map card's answer", () => {
  it("is the first map on a fresh app and any map by its id", () => {
    expect(trickMapFor(null)).toBe(TRICK_MAPS[0]);
    expect(trickMapFor("tricks-4")).toBe(TRICK_MAPS[3]);
    expect(trickMapFor("summit-1")).toBe(TRICK_MAPS[0]);
    expect(isTrickMap("tricks-6")).toBe(true);
    expect(isTrickMap("foothills-1")).toBe(false);
  });

  it("is remembered, and a stale one is not", () => {
    expect(mergeSettings({ trickMap: "tricks-3" }).trickMap).toBe("tricks-3");
    expect(mergeSettings({ trickMap: "tricks-99" }).trickMap).toBeNull();
    expect(mergeSettings({}).trickMap).toBeNull();
  });

  it("bills the front door's tile with the map, or the seed a link pinned", () => {
    expect(tricksTile("tricks-2", null).map).toBe(TRICK_MAPS[1].name);
    expect(tricksTile("tricks-2", 7).map).toBe("SEED 7");
    expect(STRINGS.menuTricksLine("Bluebird", 120)).toBe("BLUEBIRD · 2 MIN");
  });

  it("reads a day as the sky, the hour and the date", () => {
    expect(STRINGS.tricksDay("CLEAR", 12.5, 55)).toBe("CLEAR · 12:30 · 24 FEB");
    expect(STRINGS.tricksDay("SNOW", 20, 1)).toBe("SNOW · 20:00 · 1 JAN");
    expect(STRINGS.tricksDay("FAIR", 9.25, 365)).toBe("FAIR · 09:15 · 31 DEC");
  });
});

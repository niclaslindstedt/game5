// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RACE MAPS (`pwa/src/game/race-maps.ts`): every discipline with maps of
// its own carries nine, each its own seed — none a campaign shelf's or a
// trick map's — each held to its digest, its version, its country, its grade
// and its drawn line like a campaign map, its course set inside the
// discipline's band; a measured run of the discipline is on the one its
// level card picked, a fresh app on the first; and the pick is remembered,
// a stale one not.

import { describe, expect, it } from "vitest";

import {
  DISCIPLINE_RULES,
  createGame,
  levelDigest,
  regionOf,
  superGCourseOf,
  weatherOf,
} from "@engine";
import {
  CAMPAIGN_LEVELS,
  buildCampaignLevel,
  campaignSky,
  chosenFor,
  pinnedFor,
  pinnedPress,
} from "../pwa/src/game/campaign.ts";
import { CAMPAIGN_ROUTES } from "../pwa/src/game/campaign-routes.ts";
import { RACE_MAPS, findRaceMap, raceMapsFor } from "../pwa/src/game/race-maps.ts";
import { routeOf } from "../pwa/src/game/route-shape.ts";
import { mergeSettings } from "../pwa/src/game/settings.ts";
import { TRICK_MAPS } from "../pwa/src/game/trick-maps.ts";

const SUPER_G = RACE_MAPS.superG ?? [];
const TAKEN = new Set([...CAMPAIGN_LEVELS.map((l) => l.seed), ...TRICK_MAPS.map((m) => m.seed)]);

describe("the race maps", () => {
  it("are nine a discipline, each its own seed, none the campaign's or a trick map's", () => {
    for (const [discipline, rows] of Object.entries(RACE_MAPS)) {
      expect(rows, discipline).toHaveLength(9);
      expect(new Set(rows!.map((r) => r.id)).size).toBe(9);
      expect(new Set(rows!.map((r) => r.seed)).size).toBe(9);
      for (const row of rows!) {
        expect(row.mode).toBe(discipline);
        expect(TAKEN.has(row.seed), `${row.id}'s seed ${row.seed} is taken`).toBe(false);
      }
    }
    // Spread over the race countries and the day.
    expect(new Set(SUPER_G.map((r) => r.region ?? "alpine")).size).toBeGreaterThanOrEqual(3);
    expect(SUPER_G.some((r) => r.day.hour >= 18 || r.day.hour < 6)).toBe(true);
  });

  for (const row of SUPER_G) {
    it(`${row.id} builds the map it was pinned on, its super-G inside the band`, () => {
      const built = buildCampaignLevel(row);
      expect(built.version).toBe(row.version);
      expect(levelDigest(built), `${row.id}'s digest moved`).toBe(row.digest);
      expect(regionOf(built).id).toBe(row.region ?? "alpine");
      expect(built.grade).toBe(row.grade);
      expect(built.resort?.course).toBe(row.course);
      // The course a super-G off this seed would choose for itself.
      expect(superGCourseOf(built)).toBe(row.course);
      expect(CAMPAIGN_ROUTES[row.id], `${row.id}'s line — run \`make routes\``).toBe(
        routeOf(built),
      );
      const state = createGame({
        seed: row.seed,
        level: built,
        mode: "superG",
        sky: campaignSky(row),
        quiet: true,
      });
      const sg = state.level.superG!;
      const G = DISCIPLINE_RULES.superG;
      expect(sg.vertical).toBeGreaterThanOrEqual(G.vertical.min);
      expect(sg.vertical).toBeLessThanOrEqual(G.vertical.max);
      expect(sg.turns).toBeGreaterThanOrEqual(Math.ceil(G.changes * sg.vertical));
      expect(state.level.sun.hour).toBeCloseTo(row.day.hour, 1);
      // The jury may ease the wind; the sky stays the row's.
      expect(weatherOf(state.level).kind).toBe(row.day.weather);
    });
  }
});

describe("a measured super-G", () => {
  it("is on the map its level card picked, a fresh app on the first", () => {
    const picks = { level: null, raceMap: {} };
    expect(raceMapsFor("superG")).toBe(SUPER_G);
    expect(pinnedFor(chosenFor(picks, "superG"), "superG", null)).toBe(SUPER_G[0]);
    const third = SUPER_G[2];
    const chosen = chosenFor({ level: null, raceMap: { superG: third.id } }, "superG");
    expect(pinnedFor(chosen, "superG", null)).toBe(third);
    expect(pinnedPress(null, chosen, "superG", null)).toEqual([third, "superG", false]);
    // ...a campaign id is not one of its maps, and a link's seed takes the pin off.
    expect(pinnedFor(CAMPAIGN_LEVELS[0].id, "superG", null)).toBe(SUPER_G[0]);
    expect(pinnedFor(third.id, "superG", 38)).toBeNull();
    // The slalom keeps the campaign's maps, and the campaign's pick.
    expect(
      chosenFor({ level: CAMPAIGN_LEVELS[0].id, raceMap: { superG: third.id } }, "slalom"),
    ).toBe(CAMPAIGN_LEVELS[0].id);
  });

  it("is remembered by discipline, and a stale pick is not", () => {
    const id = SUPER_G[4].id;
    expect(findRaceMap(id)).toBe(SUPER_G[4]);
    expect(mergeSettings({ raceMap: { superG: id } }).raceMap).toEqual({ superG: id });
    expect(mergeSettings({ raceMap: { superG: "nowhere-3" } }).raceMap).toEqual({});
    expect(mergeSettings({ raceMap: { slalom: id } }).raceMap).toEqual({});
    expect(mergeSettings({}).raceMap).toEqual({});
  });
});

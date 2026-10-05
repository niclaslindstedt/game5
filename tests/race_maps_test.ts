// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RACE MAPS (`pwa/src/game/race-maps.ts`): every built discipline's
// nine, each held to its digest, its course and its drawn loop like a
// campaign map; the discipline's course set on every one inside its rule's
// bands and billed by the figures its box quotes; the card's answer per
// discipline remembered, a stale one not; which map a measured run is on;
// and the pause card's line that raises the mountain again in a free ride.

import { describe, expect, it } from "vitest";

import { CAMPAIGN_LEVELS, NO_PICKS, pinnedFor } from "../pwa/src/game/campaign.ts";
import {
  RACE_MAPS,
  disciplineOf,
  findRaceMap,
  mergeRacePicks,
  raceMapsOf,
} from "../pwa/src/game/race-maps.ts";
import { mergeSettings } from "../pwa/src/game/settings.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { TRICK_MAPS } from "../pwa/src/game/trick-maps.ts";
import { holdRaceMaps } from "./support/race-maps.ts";

const BUILT = ["slalom", "superG", "downhill", "speedSki", "skiCross"] as const;

/** Seeds the campaign's shelves and the trick maps already race. */
const TAKEN = new Set([...CAMPAIGN_LEVELS.map((l) => l.seed), ...TRICK_MAPS.map((m) => m.seed)]);

describe("every built discipline's nine", () => {
  for (const discipline of BUILT) {
    const maps = RACE_MAPS[discipline] ?? [];
    it(`${discipline}: nine, each its own seed and none the campaign's or a trick map's`, () => {
      expect(maps).toHaveLength(9);
      expect(new Set(maps.map((m) => m.id)).size).toBe(9);
      expect(new Set(maps.map((m) => m.seed)).size).toBe(9);
      for (const map of maps) {
        expect(map.id.startsWith(`${discipline}-`), map.id).toBe(true);
        expect(map.mode, map.id).toBe(discipline);
        expect(map.laps, map.id).toBe(1);
        expect(TAKEN.has(map.seed), `${map.id}'s seed ${map.seed} is raced elsewhere`).toBe(false);
        expect(findRaceMap(map.id)).toBe(map);
      }
      // More than one country, and more than one sky.
      expect(new Set(maps.map((m) => m.region ?? "alpine")).size).toBeGreaterThan(1);
      expect(new Set(maps.map((m) => m.day.weather)).size).toBeGreaterThan(2);
    });
  }
  it("are the nine a mode's level card offers, and the time trial keeps the campaign's", () => {
    expect(raceMapsOf("slalom")).toBe(RACE_MAPS.slalom);
    expect(raceMapsOf("downhill")).toBe(RACE_MAPS.downhill);
    expect(raceMapsOf("superG")).toBe(RACE_MAPS.superG);
    expect(raceMapsOf("speedSki")).toBe(RACE_MAPS.speedSki);
    expect(raceMapsOf("skiCross")).toBe(RACE_MAPS.skiCross);
    expect(raceMapsOf("timeTrial")).toBeNull();
    expect(raceMapsOf("free")).toBeNull();
    expect(disciplineOf("downhill")).toBe("downhill");
    expect(disciplineOf("tricks")).toBeNull();
  });
});

// Each map built and held to its row: the slalom's here, the downhill's in
// `race_maps_downhill_test.ts` and the super-G's in
// `race_maps_superg_test.ts`, so no file waits on all twenty-seven.
holdRaceMaps("slalom");

describe("the level card's answer, per discipline", () => {
  const [slalom1, slalom2] = RACE_MAPS.slalom ?? [];
  const downhill3 = (RACE_MAPS.downhill ?? [])[2];

  it("puts a race on its discipline's pick, its first by default, and a link on its seed", () => {
    expect(pinnedFor(NO_PICKS, "slalom", null)).toBe(slalom1);
    expect(pinnedFor(NO_PICKS, "downhill", null)).toBe((RACE_MAPS.downhill ?? [])[0]);
    const picks = { level: null, raceMap: { slalom: slalom2.id, downhill: downhill3.id } };
    expect(pinnedFor(picks, "slalom", null)).toBe(slalom2);
    expect(pinnedFor(picks, "downhill", null)).toBe(downhill3);
    // One discipline's map is never another's.
    expect(pinnedFor({ level: null, raceMap: { slalom: downhill3.id } }, "slalom", null)).toBe(
      slalom1,
    );
    expect(pinnedFor(picks, "slalom", 38)).toBeNull();
    // The time trial still rides the campaign's maps.
    expect(pinnedFor(picks, "timeTrial", null)).toBe(CAMPAIGN_LEVELS[0]);
  });

  it("is remembered per discipline, and a stale or misplaced one is not", () => {
    expect(mergeSettings({}).raceMap).toEqual({});
    const kept = mergeSettings({ raceMap: { slalom: slalom2.id, downhill: downhill3.id } });
    expect(kept.raceMap).toEqual({ slalom: slalom2.id, downhill: downhill3.id });
    expect(mergeRacePicks({ slalom: downhill3.id, downhill: "nowhere-1" })).toEqual({});
    expect(mergeRacePicks("slalom-1")).toEqual({});
  });

  it("bills a box with the course's drop and length", () => {
    expect(STRINGS.levelsFigures(181.6, 523)).toBe("182 M DROP · 523 M");
    expect(STRINGS.levelsFigures(1033, 2866)).toBe("1033 M DROP · 2.9 KM");
  });
});

describe("the pause card's mountain", () => {
  it("names the seed, the country and the grade the free ride raises it with", () => {
    expect(STRINGS.pauseMountain(46, STRINGS.regionNames.continental, STRINGS.gradeNames.red)).toBe(
      "FREE RIDE IT · SEED 46 · CONTINENTAL · RED",
    );
  });
});

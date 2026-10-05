// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A DISCIPLINE'S RACE MAPS HELD TO THEIR ROWS (`pwa/src/game/race-maps.ts`):
// each built on the generator it names and held to its digest, its course,
// its grade, the day and the loop its box bills, and the course set over it
// held to the figures the box quotes and to its discipline's rule. Shared by
// `race_maps_test.ts` (the slalom's) and `race_maps_downhill_test.ts`, one
// discipline a file, because building a map is the dearest thing the engine
// does and eighteen of them in one file would be the slowest file in the
// suite.

import { describe, expect, it } from "vitest";

import { DISCIPLINE_RULES, createGame, levelDigest, weatherOf, withSky } from "@engine";
import { buildCampaignLevel, campaignSky } from "../../pwa/src/game/campaign.ts";
import { CAMPAIGN_ROUTES } from "../../pwa/src/game/campaign-routes.ts";
import { RACE_MAPS, type RaceMap } from "../../pwa/src/game/race-maps.ts";
import { routeOf } from "../../pwa/src/game/route-shape.ts";

/** The run a race map is raced as, set over the map it builds. */
function raced(map: RaceMap) {
  const built = buildCampaignLevel(map);
  const state = createGame({ seed: map.seed, level: built, mode: map.mode, quiet: true });
  return { built, level: state.level };
}

export function holdRaceMaps(discipline: "slalom" | "downhill"): void {
  describe(`the ${discipline}'s maps, built`, () => {
    for (const map of RACE_MAPS[discipline] ?? []) {
      it(`${map.id} (seed ${map.seed}) builds the map it was pinned on, with a ${discipline} on it`, () => {
        const { built, level } = raced(map);
        expect(built.version).toBe(map.version);
        expect(built.resort?.course, `${map.id} races another course`).toBe(map.course);
        expect(built.grade, `${map.id}'s box signs the wrong colour`).toBe(map.grade);
        expect(levelDigest(built), `${map.id}'s digest moved — read race-maps.ts's header`).toBe(
          map.digest,
        );
        const sky = campaignSky(map);
        const day = sky ? withSky(built, sky) : built;
        expect(weatherOf(day).kind, `${map.id}'s box bills the wrong sky`).toBe(map.day.weather);
        expect(day.sun.hour, `${map.id}'s box bills the wrong hour`).toBeCloseTo(map.day.hour, 1);
        expect(CAMPAIGN_ROUTES[map.id], `${map.id}'s line — run \`make routes\``).toBe(
          routeOf(built),
        );
        // The course its box bills, set over it inside its rule.
        const set = discipline === "slalom" ? level.slalom : level.downhill;
        expect(set, `${map.id} carries no ${discipline}`).toBeDefined();
        expect(set!.vertical).toBeCloseTo(map.figures.vertical, 0);
        expect(set!.to - set!.from).toBeCloseTo(map.figures.length, 0);
        if (discipline === "slalom") {
          const { min, max } = DISCIPLINE_RULES.slalom.vertical;
          expect(set!.vertical, `${map.id}'s stretch is no slalom hill`).toBeGreaterThanOrEqual(
            min,
          );
          expect(set!.vertical).toBeLessThanOrEqual(max);
        } else {
          const { min, max } = DISCIPLINE_RULES.downhill.vertical;
          expect(set!.vertical).toBeGreaterThanOrEqual(min);
          expect(set!.vertical).toBeLessThanOrEqual(max);
        }
      });
    }
  });
}

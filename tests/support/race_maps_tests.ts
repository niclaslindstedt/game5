// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A DISCIPLINE'S RACE MAPS HELD TO THEIR ROWS (`pwa/src/game/race-maps.ts`):
// each built on the generator it names and held to its digest, its course,
// its grade, the day and the loop its box bills, and the course set over it
// held to the figures the box quotes and to its discipline's rule. Shared by
// `race_maps_test.ts` (the slalom's), `race_maps_downhill_test.ts`,
// `race_maps_superg_test.ts`, `race_maps_giantslalom_test.ts`,
// `race_maps_speedski_test.ts` and
// `race_maps_skicross_test.ts`, one
// discipline a file, because building a map is the dearest thing the engine
// does and twenty-seven of them in one file would be the slowest file in the
// suite.

import { describe, expect, it } from "vitest";

import {
  DISCIPLINE_RULES,
  createGame,
  levelDigest,
  setSpeedSki,
  speedSkiAim,
  weatherOf,
  withSky,
} from "@engine";
import { buildPinnedLevel, pinnedSky } from "../../pwa/src/game/pinned.ts";
import { MAP_ROUTES } from "../../pwa/src/game/map-routes.ts";
import { RACE_MAPS, type RaceMap } from "../../pwa/src/game/race-maps.ts";
import { routeOf } from "../../pwa/src/game/route-shape.ts";

/** The run a race map is raced as, set over the map it builds. */
function raced(map: RaceMap) {
  const built = buildPinnedLevel(map);
  const state = createGame({ seed: map.seed, level: built, mode: map.mode, quiet: true });
  return { built, level: state.level };
}

export function holdRaceMaps(
  discipline: "slalom" | "giantSlalom" | "superG" | "downhill" | "speedSki" | "skiCross",
): void {
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
        const sky = pinnedSky(map);
        const day = sky ? withSky(built, sky) : built;
        expect(weatherOf(day).kind, `${map.id}'s box bills the wrong sky`).toBe(map.day.weather);
        expect(day.sun.hour, `${map.id}'s box bills the wrong hour`).toBeCloseTo(map.day.hour, 1);
        // A speed race's box draws its track — the final's, top to bottom.
        const drawn = discipline === "speedSki" ? setSpeedSki(built, 2) : built;
        expect(MAP_ROUTES[map.id], `${map.id}'s line — run \`make routes\``).toBe(routeOf(drawn));
        if (discipline === "speedSki") {
          // The FINAL's track its box bills, its speed inside the band.
          const final = drawn.speedSki!;
          expect(final.vertical).toBeCloseTo(map.figures.vertical, 0);
          expect(final.to - final.from).toBeCloseTo(map.figures.length, 0);
          const { min, max } = DISCIPLINE_RULES.speedSki.speed;
          expect(speedSkiAim(drawn)).toBeGreaterThanOrEqual(min);
          expect(speedSkiAim(drawn)).toBeLessThanOrEqual(max);
          expect(level.speedSki?.run).toBe(1);
          return;
        }
        // The course its box bills, set over it inside its rule.
        const set = discipline === "slalom" ? level.slalom : level[discipline];
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
          const { min, max } = DISCIPLINE_RULES[discipline].vertical;
          expect(set!.vertical).toBeGreaterThanOrEqual(min);
          expect(set!.vertical).toBeLessThanOrEqual(max);
        }
        // A super-G and a giant slalom turn the racer at least as often as
        // its rule asks.
        const turning = level.superG ?? level.giantSlalom;
        if (turning) {
          const G = DISCIPLINE_RULES[level.superG ? "superG" : "giantSlalom"];
          expect(turning.turns).toBeGreaterThanOrEqual(Math.ceil(G.changes * turning.vertical));
        }
      });
    }
  });
}

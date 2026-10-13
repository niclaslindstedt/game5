// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE PARK (R44, R45) on generated mountains: laid over a built summer
// map off its own salt, so no map it is laid on moves; its trails held by
// the analyzer (graded, benched, never climbing, clear of trunks, ending
// beside a bottom station), the race line inside its bands, the surface the
// map answers with the trails' own, the questions every reader asks of it
// and the summer ground's tread kinds. The regions and the real faces are
// `bike_park_regions_test.ts`.
import { describe, expect, it } from "vitest";
import {
  BIKE_PARK_RULES,
  KIND_SURFACE,
  bikeTrailAt,
  bikeTrailById,
  bikeTrailHeads,
  bikeTreadAt,
  createGame,
  levelDigest,
  nearestBikeTrailPoint,
  setBikePark,
  summerGroundAt,
} from "@engine";
import { holdsPark, quietPoints } from "./support/bike-park.ts";
import { levelFor } from "./support/levels.ts";

const B = BIKE_PARK_RULES;
const SLOW = 240_000;

describe("the bike park on generated mountains", () => {
  for (const seed of [1, 38]) {
    it(
      `is laid and holds R44 and R45 — seed ${seed}`,
      () => {
        const base = levelFor(seed);
        const before = levelDigest(base);
        const level = setBikePark(base);
        holdsPark(level);
        // Laid off its own salt: the map it was laid on has not moved, and is
        // the park's base.
        expect(levelDigest(base)).toBe(before);
        expect(level.bikePark?.base).toBe(base);
        expect(setBikePark(base)).toBe(level);
        // A race line on each of these, inside its bands.
        const race = level.bikePark?.trails.find((t) => t.kind === "race");
        expect(race).toBeDefined();
        if (!race) return;
        const from = race.points.find((p) => p.s >= race.start) ?? race.points[0];
        const drop = from.y - race.points[race.points.length - 1].y;
        expect(drop).toBeGreaterThanOrEqual(B.race.vertical.least);
        expect(drop).toBeLessThanOrEqual(B.race.vertical.most + 1e-6);
        const mean = drop / (race.length - from.s);
        expect(mean).toBeGreaterThanOrEqual(B.race.mean[0]);
        expect(mean).toBeLessThanOrEqual(B.race.mean[1]);
      },
      SLOW,
    );
  }

  it(
    "is a pure function of the map",
    () => {
      const a = setBikePark(levelFor(1)).bikePark;
      // A copy of the same map is another key to the memo: laid afresh.
      const b = setBikePark({ ...levelFor(1) }).bikePark;
      expect(b).not.toBe(a);
      expect(b?.trails.map((t) => [t.id, t.grade, t.points.length, t.features.length])).toEqual(
        a?.trails.map((t) => [t.id, t.grade, t.points.length, t.features.length]),
      );
      expect(b?.trails[0].points[200]).toEqual(a?.trails[0].points[200]);
    },
    SLOW,
  );

  it(
    "answers the ground with its trails and every question off them",
    () => {
      const level = setBikePark(levelFor(1));
      const park = level.bikePark;
      if (!park) throw new Error("no park");
      for (const t of park.trails) {
        let own = 0;
        const quiet = quietPoints(t).filter((_, i) => i % 23 === 0);
        for (const p of quiet) {
          // The map's ground IS the bench away from a feature.
          expect(Math.abs(level.groundAt(p.x, p.z) - p.y)).toBeLessThan(0.12);
          const hit = bikeTrailAt(level, p.x, p.z);
          expect(hit).not.toBeNull();
          if (hit?.trail.id === t.id) own++;
          const near = nearestBikeTrailPoint(level, p.x + 0.3, p.z);
          expect(near?.distance).toBeLessThan(0.5);
          // The summer ground names the tread a tyre is on.
          const kind = summerGroundAt(level, p.x, p.z);
          expect(kind).toBe(bikeTreadAt(level, p.x, p.z));
          if (t.tread === "gravel") expect(kind).toBe("flow");
          else expect(["trail", "rocks", "roots"]).toContain(kind);
        }
        // Trails cross; nearly every station is still its own trail's.
        expect(own / quiet.length).toBeGreaterThan(0.85);
      }
      expect(KIND_SURFACE.flow).toBe("fines");
      expect(KIND_SURFACE.rocks).toBe("rock");
      expect(KIND_SURFACE.roots).toBe("roots");
      // Off every trail it answers nothing.
      expect(bikeTrailAt(level, 1, 1)).toBeNull();
      expect(bikeTreadAt(level, 1, 1)).toBeNull();
      // The heads off one lift are its apron's.
      const lift = park.aprons[0].lift;
      for (const h of bikeTrailHeads(level, lift))
        expect(bikeTrailById(level, h.trail)?.lift).toBe(lift);
    },
    SLOW,
  );

  it(
    "is laid for a summer free ride and never otherwise",
    () => {
      const level = levelFor(1);
      const before = levelDigest(level);
      const summer = createGame({ level, mode: "free", summer: true, quiet: true });
      expect(summer.level.bikePark).toBeDefined();
      const winter = createGame({ level, mode: "free", quiet: true });
      expect(winter.level.bikePark).toBeUndefined();
      const race = createGame({ level, mode: "slalom", summer: true, quiet: true });
      expect(race.level.bikePark).toBeUndefined();
      expect(levelDigest(level)).toBe(before);
    },
    SLOW,
  );
});

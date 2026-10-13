// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// What every bike park is held to in the suite (R44, R45): the analyzer's
// verdict, its trails' treads, and its heads — shared by the generated
// mountains' file and the regions' and real faces'.
import { expect } from "vitest";
import {
  BIKE_PARK_RULES,
  analyzeBikePark,
  bikeTrailById,
  bikeTrailHeads,
  type BikeTrail,
  type Level,
} from "@engine";

/** The stations of `t` at least `clear` m from any feature and from its ends. */
export function quietPoints(t: BikeTrail, clear = 6) {
  return t.points.filter(
    (p, i) =>
      i > 30 &&
      i < t.points.length - 30 &&
      !t.features.some((f) => p.s >= f.from - clear && p.s <= f.to + clear),
  );
}

/** Everything the analyzer holds, and the park's own shape. */
export function holdsPark(level: Level): void {
  const park = level.bikePark;
  expect(park).toBeDefined();
  if (!park) return;
  const a = analyzeBikePark(level);
  expect(a.findings.filter((f) => f.severity === "error")).toEqual([]);
  const trails = park.trails.filter((t) => t.kind === "trail");
  expect(trails.length).toBeGreaterThanOrEqual(2);
  expect(trails.length).toBeLessThanOrEqual(BIKE_PARK_RULES.park.most);
  for (const t of park.trails) {
    expect(t.tread).toBe(
      t.kind === "trail" && (t.grade === "green" || t.grade === "blue") ? "gravel" : "dirt",
    );
    for (let i = 0; i + 1 < t.points.length; i++)
      expect(t.points[i + 1].s).toBeGreaterThan(t.points[i].s);
  }
  // Every head is on an apron and names a trail of the park.
  const heads = bikeTrailHeads(level);
  expect(heads.length).toBe(park.trails.length);
  for (const h of heads) expect(bikeTrailById(level, h.trail)).not.toBeNull();
}

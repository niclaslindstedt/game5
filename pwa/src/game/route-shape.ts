// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A MAP'S LOOP AS A LINE ON A CARD — the shape drawn behind every campaign
// box, so a shelf's six maps read as six different rides before a word on
// any of them has been read.
//
// TWO HALVES, one format. `routeOf` turns a built map into the line: the
// loop resampled to `ROUTE_POINTS` stations, fitted into a `ROUTE_BOX`-unit
// square with its aspect kept (north up the card, as the level map and the
// minimap draw it), and written as an SVG path with one decimal. Building a
// map costs most of a second, so the app never calls it: `make routes`
// (`scripts/campaign-routes.mjs`) runs it over every pinned map and writes
// `campaign-routes.ts`, and `tests/generator_version_test.ts` — which
// rebuilds every pinned map anyway — holds each line to the map it is a
// picture of. A generated table is never hand-edited.
//
// DOM-free and three-free, so the script, the test and the card read one
// statement of it.

import type { Level } from "@engine";

/** Stations the loop is drawn through: a map's tightest corner still
 * reads, and a shelf's six lines stay a few hundred bytes each. */
export const ROUTE_POINTS = 72;

/** The square the line is fitted into, in SVG user units. */
export const ROUTE_BOX = 100;

/** The stroke the card draws the line with, in the same units. */
export const ROUTE_STROKE = 3;

/** The loop of a built map as a closed SVG path in the `ROUTE_BOX` square. */
export function routeOf(level: Pick<Level, "track">): string {
  const pts = level.track.points;
  const picked = Array.from(
    { length: ROUTE_POINTS },
    (_, i) => pts[Math.floor((i * pts.length) / ROUTE_POINTS)],
  );
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of picked) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  // Inset by half a stroke so the line is never clipped by its own box.
  const inner = ROUTE_BOX - ROUTE_STROKE;
  const span = Math.max(maxX - minX, maxZ - minZ, 1);
  const k = inner / span;
  const ox = (ROUTE_BOX - (maxX - minX) * k) / 2;
  const oy = (ROUTE_BOX - (maxZ - minZ) * k) / 2;
  const at = (v: number): string => (Math.round(v * 10) / 10).toString();
  return (
    picked
      .map(
        (p, i) => `${i === 0 ? "M" : "L"}${at(ox + (p.x - minX) * k)} ${at(oy + (maxZ - p.z) * k)}`,
      )
      .join("") + "Z"
  );
}

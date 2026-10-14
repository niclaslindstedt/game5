// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE DRAWING STANDS ON THE SNOW, MADE SOLID — the pieces a host lays
// out of its own plans (a lift station's house and booth, a sign's post,
// a map board, a wind tunnel's arches, a fire's benches and woodpile) handed
// to the engine as posts, so a body meets what it sees rather than passing
// through it. The engine never learns how they are drawn: a host registers
// ONE source (`setDrawnSolids`), a pure function of the map, before it
// builds any run, and `solidsOf` (`posts.ts`) appends what it says after
// every solid of the engine's own — so every trunk keeps its index.
//
// No source, nothing: the suite, the sim and the labs run without one, so
// no digest moves. A source must be a pure function of the map (no clock,
// no stream), so a run, its ghost and its replay meet the same posts.

import type { Level } from "../mapgen/types.ts";
import type { Upright } from "./upright-grid.ts";

/** A host's solids for a map: posts, each a vertical cylinder from its
 * foot (`y`) up `height` m. */
export type DrawnSolids = (level: Level) => readonly Upright[];

let source: DrawnSolids | null = null;
const cache = new WeakMap<Level, readonly Upright[]>();

/** Register the host's source of solids (`null` takes it away). Set once,
 * before the first run is built: a map's solids are kept once asked. */
export function setDrawnSolids(next: DrawnSolids | null): void {
  source = next;
}

/** The host's solids on `level`, none without a source. Kept per map. */
export function drawnSolidsOf(level: Level): readonly Upright[] {
  if (!source) return [];
  let list = cache.get(level);
  if (!list) {
    list = source(level);
    cache.set(level, list);
  }
  return list;
}

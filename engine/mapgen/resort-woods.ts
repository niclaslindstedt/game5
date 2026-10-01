// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R14 ON A RESORT — THE WOODS BY HEIGHT: thick low on the mountain,
// thinning up through the ecotone to the tree line, bare above it, and kept
// off the runs, the lifts and the village.
//
// The mountain before the resorts grows its woods wherever a slow noise
// says woods, at the same density from the valley floor to the krummholz.
// A real mountain is not wooded like that. Forest cover falls with height
// on an S-curve, not a line: CLOSED forest — crowns touching, few glades —
// up to the TIMBERLINE, then an ECOTONE where the woods break into
// patches, groups and lone trees, to the TREE LINE, the highest upright
// trees two or three metres tall; above it nothing stands. The ecotone is
// a hundred to a hundred and fifty metres of height in the high ranges,
// thinner on a northern fell where the birch ends abruptly, wider in a
// heavy-snow range whose upper woods are parkland. Trees shrink the same
// way: the tallest low on the mountain, a third of that at the timberline,
// stunted at the line. And the valley floor is cleared — meadow and
// village, with the forest's edge above it.
//
// So a spot's woods are kept at `logistic(d)` of the rule's density, where
// `d` is how far under the tree line it stands — half at the ecotone's
// midpoint, near none at the line — and below the timberline the glades
// close: the slow noise's woods are pulled toward the thick of a wood, so
// the lower mountain reads as forest with pistes cut through it and the
// upper as islands of trees on open snow. The numbers are a region's row.

import { smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import type { RegionId } from "./regions.ts";

/** One region's woods by height (R14, R21): the ecotone's midpoint and
 * steepness under the tree line (m), how far under the line the glades
 * close (m), and the height curve's reach (m). */
export type WoodsRow = {
  readonly mid: number;
  readonly steep: number;
  readonly closed: number;
  readonly reach: number;
};

/** The research's ecotones: the alpine's half cover seventy metres under
 * the line, the fell's abrupt birch edge, the continental's wide band and
 * the maritime's parkland. */
export const WOODS: Readonly<Record<RegionId, WoodsRow>> = {
  alpine: { mid: 70, steep: 22, closed: 260, reach: 250 },
  fell: { mid: 40, steep: 15, closed: 160, reach: 160 },
  continental: { mid: 100, steep: 35, closed: 320, reach: 280 },
  maritime: { mid: 120, steep: 40, closed: 300, reach: 260 },
};

/** R14 — how much of the woods stand `d` metres under the tree line (`keep`)
 * and how far toward the thick of a wood the glades close there (`close`),
 * both 0..1. */
export function woodsAtDepth(row: WoodsRow, d: number): { keep: number; close: number } {
  if (d <= 0) return { keep: 0, close: 0 };
  const keep = 1 / (1 + Math.exp(-(d - row.mid) / row.steep));
  const close = 0.75 * smoothstep(row.mid * 2, row.closed, d);
  return { keep, close };
}

/** R14 — the tallest a tree `d` metres under the tree line grows, as a share
 * of the height band: the krummholz's at the line, the whole band by the
 * curve's reach and below. */
export function tallAtDepth(row: WoodsRow, d: number): number {
  if (d <= 0) return 0;
  return 1 - Math.exp(-d / row.reach) * 0.92;
}

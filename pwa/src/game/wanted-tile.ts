// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WANTED LEVEL AS THE HUD READS IT (`wanted.ts`) — DOM-free, so the
// suite reads it: how many of the five stars are lit, whether they flash
// (the army searching where he was last seen rather than seeing him), how
// much of their search is left before he has lost them and whether he is
// hidden under the trees, the survival timer, and how the hunt ended.
// `hud-wanted.tsx` draws it.

import { WANTED, survivedOf, underCover, type GameState, type WantedEnd } from "@engine";

/** How long the stars and the stopped timer stay up after he lost them, s. */
export const LOST_HOLD = 5;

export type WantedTile = {
  /** Stars lit, 0..`of`; `of` the five drawn. */
  stars: number;
  of: number;
  /** The army searching rather than seeing him: the lit stars flash. */
  flashing: boolean;
  /** While they search, the share of it still to run before he has lost
   * them (1 at its start, 0 when the stars drop); null while seen. */
  search: number | null;
  /** On foot, still, under a crown: hidden from the air. */
  hidden: boolean;
  /** Seconds survived this hunt — still counting while it runs. */
  survived: number;
  /** How it ended (null while it runs). */
  ended: WantedEnd | null;
};

/** The tile for a run the army hunts, or null: never hunted, or long
 * enough since he lost them. */
export function wantedTile(state: GameState): WantedTile | null {
  const w = state.wanted;
  if (!w) return null;
  if (w.ended === "escaped" && state.t - w.endedAt > LOST_HOLD) return null;
  const flashing = w.ended === null && w.stars > 0 && !w.seen;
  const lose = WANTED.lose[w.stars] ?? 0;
  return {
    stars: w.stars,
    of: WANTED.maxStars,
    flashing,
    search: flashing && lose > 0 ? Math.max(0, 1 - w.unseen / lose) : null,
    hidden: w.ended === null && w.stars > 0 && underCover(state),
    survived: survivedOf(w, state.t),
    ended: w.ended,
  };
}

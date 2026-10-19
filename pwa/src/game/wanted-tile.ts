// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WANTED LEVEL AS THE HUD READS IT (`wanted.ts`) — DOM-free, so the
// suite reads it: how many of the five stars are lit, whether they flash
// (the army searching where he was last seen rather than seeing him), the
// survival timer, and how the hunt ended. `hud-wanted.tsx` draws it.

import { WANTED, survivedOf, type GameState, type WantedEnd } from "@engine";

/** How long the stars and the stopped timer stay up after he lost them, s. */
export const LOST_HOLD = 5;

export type WantedTile = {
  /** Stars lit, 0..`of`; `of` the five drawn. */
  stars: number;
  of: number;
  /** The army searching rather than seeing him: the lit stars flash. */
  flashing: boolean;
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
  return {
    stars: w.stars,
    of: WANTED.maxStars,
    flashing: w.ended === null && w.stars > 0 && !w.seen,
    survived: survivedOf(w, state.t),
    ended: w.ended,
  };
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SCORE AS READ — what the HUD's combo tile over the nose is drawn from,
// taken off the state with the rest of the snapshot. DOM-free, so the tests
// read it. Nothing here decides a point: the numbers are `tricks.ts`'s and
// the words are `strings.ts`'s (`comboLine`); this only says which of them
// is up.

import type { GameState } from "@engine";

import { comboLine } from "./strings.ts";

/** How long the last combo's result stays up after it closed, s of run
 * clock — long enough to read, gone before the next kicker. */
const LAST_HOLD = 2.5;

export type TrickTile = {
  /** Points banked this run. */
  score: number;
  /** Seconds left before the buzzer. */
  left: number;
  /** The combo in hand — its elements as one line, its base and its
   * multiplier — or null when there is none. */
  combo: { line: string; base: number; mult: number } | null;
  /** The last combo closed, while it is fresh: what it paid (or lost). */
  last: { points: number; bailed: boolean; line: string; at: number } | null;
};

/** The tile, on a run that counts tricks; null on any other. */
export function comboTile(state: GameState): TrickTile | null {
  if (!state.rules.tricks) return null;
  const k = state.tricks;
  const fresh = k.lastAt > 0 && state.t - k.lastAt < LAST_HOLD;
  return {
    score: k.score,
    left: Math.max(0, state.rules.limit - state.progress.time),
    combo: k.base > 0 ? { line: comboLine(k.parts), base: k.base, mult: k.mult } : null,
    last:
      fresh && k.base === 0
        ? { points: k.last, bailed: k.lastBailed, line: comboLine(k.lastParts), at: k.lastAt }
        : null,
  };
}

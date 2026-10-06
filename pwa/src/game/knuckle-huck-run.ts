// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A KNUCKLE HUCK FROM THE APP'S SIDE (R38): one JAM a run — the hits ridden
// off the platform until the buzzer — what the HUD reads of it (the clock
// left, the hits, the place on the session's board as it stands), the last
// hit as the judges called it, and at the buzzer the session's mark and the
// board. Nothing here judges or deals: the engine does both (`jam.ts`).
//
// DOM-free and storage-free: `tests/knuckle_huck_hud_test.ts` reads it.

import {
  jamBoard,
  jamLeft,
  readTrick,
  sessionScore,
  KNUCKLE_HUCK,
  type GameState,
  type TrickRead,
} from "@engine";

/** A ROW OF THE SESSION'S BOARD on the plate. */
export type JamBoardRow = {
  place: number;
  id: number;
  you: boolean;
  hits: number;
  falls: number;
  score: number;
};

/** A KNUCKLE HUCK AS THE HUD READS IT. */
export type JamHud = {
  /** The jam's clock left, s. */
  left: number;
  /** The hits ridden so far, and the riders in the session. */
  hits: number;
  riders: number;
  /** His place on the board as it stands now, from 1. */
  place: number;
  /** His session's mark as it stands, 0 before his first hit. */
  score: number;
  /** THE LAST HIT as the judges called it — its trick (null for none), its
   * impression and whether it was a fall — and how long ago it ended, s;
   * null before the first. */
  last: { trick: TrickRead | null; impression: number; fell: boolean; ago: number } | null;
  /** The buzzer has gone: the session is over and the board final. */
  done: boolean;
  /** The board, best first — at the buzzer; empty while the jam is on. */
  board: JamBoardRow[];
};

/** The knuckle huck's readouts at this step, or null on any other run. */
export function jamOf(state: GameState): JamHud | null {
  const j = state.jam;
  if (!j || !state.level.knuckleHuck) return null;
  const t = state.progress.time;
  const rows = jamBoard(state.seed, j.hits, t);
  const hit = j.hits[j.hits.length - 1];
  const done = j.closed;
  return {
    left: jamLeft(state),
    hits: j.hits.length,
    riders: KNUCKLE_HUCK.field + 1,
    place: rows.findIndex((r) => r.id === -1) + 1,
    score: sessionScore(state.seed, -1, j.hits),
    last: hit
      ? {
          trick: hit.trick ? readTrick(hit.trick) : null,
          impression: hit.impression,
          fell: hit.fell,
          ago: t - hit.t,
        }
      : null,
    done,
    board: done
      ? rows.map((r, i) => ({
          place: i + 1,
          id: r.id,
          you: r.id === -1,
          hits: r.hits,
          falls: r.falls,
          score: r.score,
        }))
      : [],
  };
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A BIG AIR CONTEST FROM THE APP'S SIDE (R37): one jump a run — the
// qualification's, then the final's — what the HUD reads of the jump on
// the snow, what the panel gave it, the board, what the plate offers next,
// and the CONTEST the next run is stood up with (`CreateGameOptions.bigAir`).
//
// THE CONTEST RIDES THE RUN, as a ski cross's bracket does: each run on the
// snow carries the contest as it stood before its jump (`GameState.bigAir`),
// so a restart and a replay stand the same jump up again, and the contest
// after it is that one with this run's jump filed (`contestAfter`). Nothing
// here judges or deals: the engine does both (`judge.ts`,
// `big-air-contest.ts`).
//
// DOM-free and storage-free: `tests/big_air_hud_test.ts` reads it.

import {
  boardOf,
  contestAfter,
  jumpOf,
  jumpsIn,
  nextPhase,
  placeOf,
  readTrick,
  judgeRun,
  type BigAirContest,
  type BigAirPhase,
  type GameState,
  type TrickRead,
} from "@engine";

import { boardWindow } from "./contest-board.ts";

/** WHAT THE PLATE OFFERS after a jump: the phase's next jump, the final
 * (through at `place`), or the contest over for him — out of the
 * qualification at `place`, or the final done at `place`. */
export type BigAirNext =
  | { kind: "jump"; jump: number }
  | { kind: "final"; place: number }
  | { kind: "out"; place: number }
  | { kind: "done"; place: number };

/** A ROW OF THE BOARD on the plate: his place, who, the score of each jump
 * taken so far (never a blank for one still to come), his total and whether
 * a jump was a fall. */
export type BigAirBoardRow = {
  place: number;
  id: number;
  you: boolean;
  scores: number[];
  fell: boolean[];
  total: number;
};

/** A BIG AIR RUN AS THE HUD READS IT. */
export type BigAirHud = {
  phase: BigAirPhase;
  /** This run's jump in its phase, from 1, of how many. */
  jump: number;
  of: number;
  /** THE JUMP JUDGED once the run is over: the panel's score, the trick it
   * was read as (null for no jump) and whether it was a fall — null while
   * the run is on. */
  judged: { score: number; trick: TrickRead | null; fell: boolean } | null;
  /** The phase's board after this jump, best first — the player's row and
   * the best around him. Empty while the run is on. */
  board: BigAirBoardRow[];
  /** What the plate offers once the jump is judged — null before. */
  next: BigAirNext | null;
};

/** The big air readouts at this step, or null on any other run. */
export function bigAirOf(state: GameState): BigAirHud | null {
  const c = state.bigAir;
  if (!c || !state.level.bigAir) return null;
  const phase = nextPhase(c) ?? "final";
  const done = phase === "final" ? (c.final?.length ?? 0) : c.qualification.length;
  const jump = judgeRun(state);
  const after = jump ? contestAfter(state) : null;
  const f = jump ? jumpOf(state.tricks.flights) : null;
  return {
    phase,
    jump: done + 1,
    of: jumpsIn(phase),
    judged: jump ? { score: jump.score, trick: f ? readTrick(f) : null, fell: jump.fell } : null,
    board: after ? boardRows(after, phase) : [],
    next: after ? nextOf(after, phase) : null,
  };
}

/** The phase's board with the field as far as the player has jumped. */
function boardRows(c: BigAirContest, phase: BigAirPhase): BigAirBoardRow[] {
  const mine = (phase === "final" ? c.final : c.qualification) ?? [];
  const rows = boardOf(c, phase, mine.length).map((r, i) => ({
    place: i + 1,
    id: r.id,
    you: r.id === -1,
    scores: r.jumps.map((j) => j.score),
    fell: r.jumps.map((j) => j.fell),
    total: r.total,
  }));
  return boardWindow(rows);
}

/** What comes after the jump just filed in `phase`. */
function nextOf(c: BigAirContest, phase: BigAirPhase): BigAirNext {
  const going = nextPhase(c);
  if (going === phase) {
    const mine = (phase === "final" ? c.final : c.qualification) ?? [];
    return { kind: "jump", jump: mine.length + 1 };
  }
  if (going === "final") return { kind: "final", place: placeOf(c, "qualification") };
  return phase === "final"
    ? { kind: "done", place: placeOf(c, "final") }
    : { kind: "out", place: placeOf(c, "qualification") };
}

/** THE CONTEST THE NEXT RUN IS STOOD UP WITH: this run's jump filed —
 * or null where the run is still on, or the contest is over for him. */
export function nextContest(state: GameState): BigAirContest | null {
  const after = contestAfter(state);
  return after && nextPhase(after) !== null ? after : null;
}

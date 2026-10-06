// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A MOGULS CONTEST FROM THE APP'S SIDE (R42): one run down the course a run
// on the snow — the qualification's, then final 1's and final 2's — what
// the HUD reads of the run (the phase, the clock against the pace, the
// airs so far), the formal score once it is over (the turns, the air, the
// speed), the board, what the plate offers next, and the CONTEST the next
// run is stood up with (`CreateGameOptions.moguls`).
//
// THE CONTEST RIDES THE RUN, as the halfpipe's does (`halfpipe-run.ts`):
// each run on the snow carries the contest as it stood before it
// (`GameState.moguls`), so a restart and a replay stand the same run up
// again, and the contest after it is that one with this run filed
// (`mogulsContestAfter`). Nothing here judges or deals: the engine does
// both (`moguls-judge.ts`, `moguls-contest.ts`).
//
// DOM-free and storage-free: `tests/moguls_hud_test.ts` reads it.

import {
  judgeMogulsRun,
  mogulBoard,
  mogulPhase,
  mogulPlace,
  mogulsContestAfter,
  paceTimeOf,
  type GameState,
  type MogulPhase,
  type MogulScore,
  type MogulsContest,
} from "@engine";

/** WHAT THE PLATE OFFERS after a run: the next final (through at
 * `place`), or the contest over for him at `place` — out of a phase, or
 * final 2 done. */
export type MogulsNext =
  | { kind: "final"; phase: MogulPhase; place: number }
  | { kind: "out"; place: number }
  | { kind: "done"; place: number };

/** A ROW OF THE BOARD on the plate: his place, who, the three parts, the
 * total, whether the run was out. */
export type MogulsBoardRow = {
  place: number;
  id: number;
  you: boolean;
  turns: number;
  air: number;
  speed: number;
  total: number;
  fell: boolean;
};

/** A MOGULS RUN AS THE HUD READS IT. */
export type MogulsHud = {
  phase: MogulPhase;
  /** The course's pace time, s — the speed score's 16 points. */
  pace: number;
  /** The airs taken so far (flights off an air bump). */
  airs: number;
  /** THE RUN SCORED once it is over — null while it is on. */
  judged: MogulScore | null;
  /** The phase's board after this run, best first — the player's row and
   * the best around him. Empty while the run is on. */
  board: MogulsBoardRow[];
  /** What the plate offers once the run is judged — null before. */
  next: MogulsNext | null;
};

/** How many of the board the plate shows. */
const BOARD_ROWS = 8;

/** The moguls readouts at this step, or null on any other run. */
export function mogulsOf(state: GameState): MogulsHud | null {
  const c = state.moguls;
  if (!c || !state.level.moguls) return null;
  const phase = mogulPhase(c) ?? "final2";
  const pace = paceTimeOf(state);
  const run = judgeMogulsRun(state);
  const after = run ? mogulsContestAfter(state) : null;
  return {
    phase,
    pace,
    airs: airsOf(state),
    judged: run?.sheet ?? null,
    board: after ? boardRows(after, phase, pace) : [],
    next: after ? nextOf(after, phase, pace) : null,
  };
}

/** The flights off an air bump so far. */
function airsOf(state: GameState): number {
  const course = state.level.moguls;
  const f = state.level.bumps;
  if (!course || !f) return 0;
  const fx = Math.sin(f.heading);
  const fz = Math.cos(f.heading);
  return state.tricks.flights.filter((fl) => {
    if (fl.x === undefined || fl.z === undefined) return false;
    const along = (fl.x - f.x) * fx + (fl.z - f.z) * fz;
    return course.airs.some((a) => along > a.foot - 3 && along < a.landed);
  }).length;
}

/** The phase's board with the player's run filed. */
function boardRows(c: MogulsContest, phase: MogulPhase, pace: number): MogulsBoardRow[] {
  const rows = mogulBoard(c, phase, pace).map((r, i) => ({
    place: i + 1,
    id: r.id,
    you: r.id === -1,
    turns: r.run?.turns ?? 0,
    air: r.run?.air ?? 0,
    speed: r.run?.speed ?? 0,
    total: r.run?.score ?? 0,
    fell: r.run?.fell ?? false,
  }));
  const you = rows.findIndex((r) => r.you);
  const top = rows.slice(0, BOARD_ROWS);
  return you >= BOARD_ROWS ? [...top.slice(0, BOARD_ROWS - 1), rows[you]] : top;
}

/** What comes after the run just filed in `phase`. */
function nextOf(c: MogulsContest, phase: MogulPhase, pace: number): MogulsNext {
  const place = mogulPlace(c, phase, pace);
  const going = mogulPhase(c);
  if (going) return { kind: "final", phase: going, place };
  return phase === "final2" ? { kind: "done", place } : { kind: "out", place };
}

/** THE CONTEST THE NEXT RUN IS STOOD UP WITH: this run filed — or null
 * where the run is still on, or the contest is over for him. */
export function nextMogulsContest(state: GameState): MogulsContest | null {
  const after = mogulsContestAfter(state);
  return after && mogulPhase(after) !== null ? after : null;
}

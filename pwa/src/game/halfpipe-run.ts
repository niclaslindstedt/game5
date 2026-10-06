// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A HALFPIPE CONTEST FROM THE APP'S SIDE (R41): one run down the pipe a
// run on the snow — the qualification's, then the final's — what the HUD
// reads of the run (the phase, which run, the hits so far and the last
// one's height over the coping), what the judges gave it, the board, what
// the plate offers next, and the CONTEST the next run is stood up with
// (`CreateGameOptions.halfpipe`).
//
// THE CONTEST RIDES THE RUN, as slopestyle's does (`slopestyle-run.ts`):
// each run on the snow carries the contest as it stood before it
// (`GameState.halfpipe`), so a restart and a replay stand the same run up
// again, and the contest after it is that one with this run filed
// (`pipeContestAfter`). Nothing here judges or deals: the engine does both
// (`halfpipe-judge.ts`, `halfpipe-contest.ts`).
//
// DOM-free and storage-free: `tests/halfpipe_hud_test.ts` reads it.

import {
  hitsOf,
  judgePipeRun,
  pipeBoard,
  pipeContestAfter,
  pipePhase,
  pipePlace,
  pipeRunsIn,
  type GameState,
  type PipeContest,
  type PipePhase,
  type PipeScore,
} from "@engine";

/** WHAT THE PLATE OFFERS after a run: the phase's next run, the final
 * (through at `place`), or the contest over for him — out of the
 * qualification at `place`, or the final done at `place`. */
export type PipeNext =
  | { kind: "run"; run: number }
  | { kind: "final"; place: number }
  | { kind: "out"; place: number }
  | { kind: "done"; place: number };

/** A ROW OF THE BOARD on the plate: his place, who, each run's score so
 * far, which were falls, and the best of them. */
export type PipeBoardRow = {
  place: number;
  id: number;
  you: boolean;
  scores: number[];
  fell: boolean[];
  total: number;
};

/** A HALFPIPE RUN AS THE HUD READS IT. */
export type HalfpipeHud = {
  phase: PipePhase;
  /** This run in its phase, from 1, of how many. */
  run: number;
  of: number;
  /** The hits so far, and the last one's height over the coping, m (null
   * before the first). */
  hits: number;
  over: number | null;
  /** THE RUN JUDGED once it is over — null while it is on. */
  judged: PipeScore | null;
  /** The phase's board after this run, best first — the player's row and
   * the best around him. Empty while the run is on. */
  board: PipeBoardRow[];
  /** What the plate offers once the run is judged — null before. */
  next: PipeNext | null;
};

/** How many of the board the plate shows. */
const BOARD_ROWS = 8;

/** The halfpipe readouts at this step, or null on any other run. */
export function halfpipeOf(state: GameState): HalfpipeHud | null {
  const c = state.halfpipe;
  if (!c || !state.level.halfpipe) return null;
  const phase = pipePhase(c) ?? "final";
  const done = phase === "final" ? (c.final?.length ?? 0) : c.qualification.length;
  const hits = hitsOf(state);
  const run = judgePipeRun(state);
  const after = run ? pipeContestAfter(state) : null;
  return {
    phase,
    run: done + 1,
    of: pipeRunsIn(phase),
    hits: hits.length,
    over: hits.length > 0 ? hits[hits.length - 1].over : null,
    judged: run?.sheet ?? null,
    board: after ? boardRows(after, phase) : [],
    next: after ? nextOf(after, phase) : null,
  };
}

/** The phase's board with the field as far as the player has skied. */
function boardRows(c: PipeContest, phase: PipePhase): PipeBoardRow[] {
  const mine = (phase === "final" ? c.final : c.qualification) ?? [];
  const rows = pipeBoard(c, phase, mine.length).map((r, i) => ({
    place: i + 1,
    id: r.id,
    you: r.id === -1,
    scores: r.runs.map((j) => j.score),
    fell: r.runs.map((j) => j.fell),
    total: r.total,
  }));
  const you = rows.findIndex((r) => r.you);
  const top = rows.slice(0, BOARD_ROWS);
  return you >= BOARD_ROWS ? [...top.slice(0, BOARD_ROWS - 1), rows[you]] : top;
}

/** What comes after the run just filed in `phase`. */
function nextOf(c: PipeContest, phase: PipePhase): PipeNext {
  const going = pipePhase(c);
  if (going === phase) {
    const mine = (phase === "final" ? c.final : c.qualification) ?? [];
    return { kind: "run", run: mine.length + 1 };
  }
  if (going === "final") return { kind: "final", place: pipePlace(c, "qualification") };
  return phase === "final"
    ? { kind: "done", place: pipePlace(c, "final") }
    : { kind: "out", place: pipePlace(c, "qualification") };
}

/** THE CONTEST THE NEXT RUN IS STOOD UP WITH: this run filed — or null
 * where the run is still on, or the contest is over for him. */
export function nextPipeContest(state: GameState): PipeContest | null {
  const after = pipeContestAfter(state);
  return after && pipePhase(after) !== null ? after : null;
}

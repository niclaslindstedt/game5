// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SLOPESTYLE CONTEST FROM THE APP'S SIDE (R38): one run of the whole
// course a run on the snow — the qualification's, then the final's — what
// the HUD reads of the run (the phase, which run, which of the six sections
// he is in), what the judges gave it section by section, the board, what
// the plate offers next, and the CONTEST the next run is stood up with
// (`CreateGameOptions.slopestyle`).
//
// THE CONTEST RIDES THE RUN, as big air's does (`big-air-run.ts`): each run
// on the snow carries the contest as it stood before it
// (`GameState.slopestyle`), so a restart and a replay stand the same run up
// again, and the contest after it is that one with this run filed
// (`slopeContestAfter`). Nothing here judges or deals: the engine does both
// (`slopestyle-judge.ts`, `slopestyle-contest.ts`).
//
// DOM-free and storage-free: `tests/slopestyle_hud_test.ts` reads it.

import {
  judgeSlopeRun,
  nearestTrackPoint,
  runsIn,
  slopeBoard,
  slopeContestAfter,
  slopePhase,
  slopePlace,
  type GameState,
  type SlopeContest,
  type SlopePhase,
  type SlopeScore,
} from "@engine";

import { boardWindow } from "./contest-board.ts";

/** WHAT THE PLATE OFFERS after a run: the phase's next run, the final
 * (through at `place`), or the contest over for him — out of the
 * qualification at `place`, or the final done at `place`. */
export type SlopeNext =
  | { kind: "run"; run: number }
  | { kind: "final"; place: number }
  | { kind: "out"; place: number }
  | { kind: "done"; place: number };

/** A ROW OF THE BOARD on the plate: his place, who, each run's score so
 * far, which were falls, and the best of them. */
export type SlopeBoardRow = {
  place: number;
  id: number;
  you: boolean;
  scores: number[];
  fell: boolean[];
  total: number;
};

/** A SLOPESTYLE RUN AS THE HUD READS IT. */
export type SlopestyleHud = {
  phase: SlopePhase;
  /** This run in its phase, from 1, of how many. */
  run: number;
  of: number;
  /** The section he is in, from 1 (0 above the first), of how many, and
   * whether it is a rail section or a jump. */
  section: number;
  sections: number;
  kind: "rail" | "jump" | null;
  /** THE RUN JUDGED once it is over — null while it is on. */
  judged: SlopeScore | null;
  /** The phase's board after this run, best first — the player's row and
   * the best around him. Empty while the run is on. */
  board: SlopeBoardRow[];
  /** What the plate offers once the run is judged — null before. */
  next: SlopeNext | null;
};

/** The slopestyle readouts at this step, or null on any other run. */
export function slopestyleOf(state: GameState): SlopestyleHud | null {
  const c = state.slopestyle;
  const course = state.level.slopestyle;
  if (!c || !course) return null;
  const phase = slopePhase(c) ?? "final";
  const done = phase === "final" ? (c.final?.length ?? 0) : c.qualification.length;
  const s = nearestTrackPoint(state.level, state.skier.x, state.skier.z).s;
  let section = 0;
  course.sections.forEach((k, i) => {
    if (s >= k.from) section = i + 1;
  });
  const run = judgeSlopeRun(state);
  const after = run ? slopeContestAfter(state) : null;
  return {
    phase,
    run: done + 1,
    of: runsIn(phase),
    section,
    sections: course.sections.length,
    kind: section > 0 ? course.sections[section - 1].kind : null,
    judged: run?.sheet ?? null,
    board: after ? boardRows(after, phase) : [],
    next: after ? nextOf(after, phase) : null,
  };
}

/** The phase's board with the field as far as the player has skied. */
function boardRows(c: SlopeContest, phase: SlopePhase): SlopeBoardRow[] {
  const mine = (phase === "final" ? c.final : c.qualification) ?? [];
  const rows = slopeBoard(c, phase, mine.length).map((r, i) => ({
    place: i + 1,
    id: r.id,
    you: r.id === -1,
    scores: r.runs.map((j) => j.score),
    fell: r.runs.map((j) => j.fell),
    total: r.total,
  }));
  return boardWindow(rows);
}

/** What comes after the run just filed in `phase`. */
function nextOf(c: SlopeContest, phase: SlopePhase): SlopeNext {
  const going = slopePhase(c);
  if (going === phase) {
    const mine = (phase === "final" ? c.final : c.qualification) ?? [];
    return { kind: "run", run: mine.length + 1 };
  }
  if (going === "final") return { kind: "final", place: slopePlace(c, "qualification") };
  return phase === "final"
    ? { kind: "done", place: slopePlace(c, "final") }
    : { kind: "out", place: slopePlace(c, "qualification") };
}

/** THE CONTEST THE NEXT RUN IS STOOD UP WITH: this run filed — or null
 * where the run is still on, or the contest is over for him. */
export function nextSlopeContest(state: GameState): SlopeContest | null {
  const after = slopeContestAfter(state);
  return after && slopePhase(after) !== null ? after : null;
}

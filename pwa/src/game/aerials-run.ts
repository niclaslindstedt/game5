// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN AERIALS CONTEST FROM THE APP'S SIDE (R41): one jump a run on the snow
// — the qualification's, then final 1's and final 2's — what the HUD reads
// of it (the phase, the jump declared and the flips thrown of it), the
// formal score once it is over (the air, the form and the landing times
// the DD), the board, what the plate offers next, and the CONTEST the next
// jump is stood up with (`CreateGameOptions.aerials`).
//
// THE CONTEST RIDES THE RUN, as the moguls' does (`moguls-run.ts`): each
// jump carries the contest as it stood before it (`GameState.aerials`), so
// a restart and a replay stand the same jump up again, and the contest
// after it is that one with this jump filed (`aerialsContestAfter`) — the
// next jump declared off it (the same, unless the finals' rule bars it).
// Nothing here judges or deals: the engine does both (`aerials-judge.ts`,
// `aerials-contest.ts`).
//
// DOM-free and storage-free: `tests/aerials_hud_test.ts` reads it.

import {
  AERIAL_JUMPS,
  aerialBoard,
  aerialJump,
  aerialPhase,
  aerialPlace,
  aerialsContestAfter,
  flipsOf,
  judgeAerialRun,
  type AerialPhase,
  type AerialSheet,
  type AerialsContest,
  type GameState,
} from "@engine";

/** WHAT THE PLATE OFFERS after a jump: the next final (through at `place`,
 * on the jump it will declare), or the contest over for him at `place`. */
export type AerialsNext =
  | { kind: "final"; phase: AerialPhase; place: number; plan: string }
  | { kind: "out"; place: number }
  | { kind: "done"; place: number };

/** A ROW OF THE BOARD on the plate: his place, who, the jump, the score,
 * whether it was a DID NOT FINISH. */
export type AerialsBoardRow = {
  place: number;
  id: number;
  you: boolean;
  plan: string;
  score: number;
  dnf: boolean;
};

/** AN AERIALS JUMP AS THE HUD READS IT. */
export type AerialsHud = {
  phase: AerialPhase;
  /** The jump declared, its DD (the chart's), and its flips. */
  plan: string;
  dd: number;
  flips: number;
  /** The flips asked of the flight so far. */
  thrown: number;
  /** THE JUMP SCORED once it is over — null while it is on. */
  judged: AerialSheet | null;
  /** The phase's board after this jump, best first — the player's row and
   * the best around him. Empty while the jump is on. */
  board: AerialsBoardRow[];
  next: AerialsNext | null;
};

/** How many of the board the plate shows. */
const BOARD_ROWS = 8;

/** The aerials readouts at this step, or null on any other run. */
export function aerialsOf(state: GameState): AerialsHud | null {
  const c = state.aerials;
  const f = state.aerial;
  if (!c || !f || !state.level.aerials) return null;
  const phase = aerialPhase(c) ?? "final2";
  const run = judgeAerialRun(state);
  const after = run ? aerialsContestAfter(state) : null;
  return {
    phase,
    plan: f.plan,
    dd: aerialJump(f.plan)?.men ?? 0,
    flips: flipsOf(f.plan)?.length ?? 0,
    thrown: f.flips,
    judged: run?.sheet ?? null,
    board: after ? boardRows(after, phase) : [],
    next: after ? nextOf(after, phase) : null,
  };
}

function boardRows(c: AerialsContest, phase: AerialPhase): AerialsBoardRow[] {
  const rows = aerialBoard(c, phase).map((r, i) => ({
    place: i + 1,
    id: r.id,
    you: r.id === -1,
    plan: r.jump?.plan ?? "",
    score: r.jump?.score ?? 0,
    dnf: r.jump?.dnf != null,
  }));
  const you = rows.findIndex((r) => r.you);
  const top = rows.slice(0, BOARD_ROWS);
  return you >= BOARD_ROWS ? [...top.slice(0, BOARD_ROWS - 1), rows[you]] : top;
}

function nextOf(c: AerialsContest, phase: AerialPhase): AerialsNext {
  const place = aerialPlace(c, phase);
  const going = aerialPhase(c);
  if (going) return { kind: "final", phase: going, place, plan: c.plan };
  return phase === "final2" ? { kind: "done", place } : { kind: "out", place };
}

/** THE CONTEST THE NEXT JUMP IS STOOD UP WITH: this jump filed — or null
 * where the jump is still on, or the contest is over for him. */
export function nextAerialsContest(state: GameState): AerialsContest | null {
  const after = aerialsContestAfter(state);
  return after && aerialPhase(after) !== null ? after : null;
}

/** THE JUMPS THE PICKER OFFERS, easiest first: every jump of the chart by
 * its DD. */
export const AERIAL_PICKS: readonly string[] = AERIAL_JUMPS.slice()
  .sort((a, b) => a.men - b.men || a.code.localeCompare(b.code))
  .map((j) => j.code);

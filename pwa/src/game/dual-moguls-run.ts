// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A DUAL MOGULS CONTEST FROM THE APP'S SIDE (R43): the qualification, then
// the duals, one run on the snow at a time — what the HUD reads of a run
// (the round, the lane, the start's call, who is in the other lane), the
// qualification scored or the dual's votes once it is over, what the plate
// offers next, and the CONTEST the next run is stood up with
// (`CreateGameOptions.dualMoguls`).
//
// THE CONTEST RIDES THE RUN, as the moguls' does (`moguls-run.ts`): each
// run on the snow carries the contest as it stood before it
// (`GameState.dualMoguls`), so a restart and a replay stand the same run —
// the same dual — up again, and the contest after it is that one with
// this run filed (`dualContestAfter`). Nothing here judges or deals: the
// engine does both (`dual-judge.ts`, `dual-bracket.ts`).
//
// DOM-free and storage-free: `tests/dual_moguls_hud_test.ts` reads it.

import {
  DUAL_MOGULS,
  dualContestAfter,
  dualPlace,
  dualStandings,
  judgeDuel,
  judgeMoguls,
  nextDuel,
  qualificationBoard,
  type DualContest,
  type DualRound,
  type DualVotes,
  type GameState,
  type MogulScore,
} from "@engine";

/** WHAT THE PLATE OFFERS after a run: the next dual (`duel`, its round),
 * or the contest over for him at `place` — out of it, or the big final
 * skied. */
export type DualNext =
  | { kind: "duel"; round: DualRound }
  | { kind: "out"; place: number }
  | { kind: "done"; place: number };

/** A DUAL MOGULS RUN AS THE HUD READS IT. */
export type DualHud = {
  /** The qualification, or a dual's round. */
  round: "qualify" | DualRound;
  /** His lane, the blue or the red — null on the qualification, which is
   * skied alone in the blue. */
  lane: "blue" | "red" | null;
  /** The start's call: "blue course ready", then "red course ready" —
   * then the gates drop with no word. Null otherwise. */
  call: "blue" | "red" | null;
  /** The skier in the other lane: his bib (the start list's id), his seed;
   * null on the qualification. */
  rival: { id: number; seed: number } | null;
  /** HIS SEED in the ladder, once he has one. */
  seed: number | null;
  /** THE QUALIFICATION SCORED once it is over — null while it is on, and
   * on a dual. */
  judged: MogulScore | null;
  /** THE DUAL DECIDED once both runs are over: the votes, his lane's index
   * in them, who went out — null while it is on. */
  votes: DualVotes | null;
  you: 0 | 1;
  out: [boolean, boolean];
  /** The qualification's board after this run, best first — his row and
   * the best around him. Empty on a dual and while the run is on. */
  board: { place: number; id: number | null; score: number; fell: boolean }[];
  /** What the plate offers once the run is decided — null before. */
  next: DualNext | null;
  /** THE PODIUM once the contest is over for him: the first four, each by
   * his bib (null the player) — null before. */
  podium: (number | null)[] | null;
};

/** How many of the qualification's board the plate shows. */
const BOARD_ROWS = 8;

/** The dual moguls readouts at this step, or null on any other run. */
export function dualMogulsOf(state: GameState): DualHud | null {
  const c = state.dualMoguls;
  if (!c || !state.level.dualMoguls) return null;
  const duel = state.duel;
  const you = duel?.lane ?? 0;
  const rival = duel ? duel.heat.lanes[you === 0 ? 1 : 0] : null;
  const me = duel?.heat.lanes[you] ?? null;
  const result = duel ? judgeDuel(state) : null;
  const sheet = duel ? null : judgeMoguls(state, c.seed, 0);
  const after = result || sheet ? dualContestAfter(state) : null;
  return {
    round: duel?.heat.round ?? "qualify",
    lane: duel ? (you === 0 ? "blue" : "red") : null,
    call: duel ? callOf(state) : null,
    rival: rival ? { id: rival.id ?? 0, seed: rival.seed } : null,
    seed: me?.seed ?? (after ? seedOf(after) : null),
    judged: sheet,
    votes: result?.votes ?? null,
    you,
    out: result?.out ?? [false, false],
    board: after && !duel ? boardRows(after) : [],
    next: after ? nextOf(after) : null,
    podium:
      after && !nextDuel(after)
        ? dualStandings(after)
            .slice(0, 4)
            .map((e) => e.id)
        : null,
  };
}

/** The start's call at this moment: the blue course's, then the red's,
 * before the gates drop. */
function callOf(state: GameState): "blue" | "red" | null {
  if (state.phase !== "countdown") return null;
  return state.t < DUAL_MOGULS.ready / 2 ? "blue" : "red";
}

/** His seed off the qualification, if he made the ladder. */
function seedOf(c: DualContest): number | null {
  const at = qualificationBoard(c).findIndex((r) => r.id === null) + 1;
  return at > 0 && at <= DUAL_MOGULS.ladder ? at : null;
}

/** The qualification's board with his run filed. */
function boardRows(c: DualContest): DualHud["board"] {
  const rows = qualificationBoard(c).map((r, i) => ({
    place: i + 1,
    id: r.id,
    score: r.run?.score ?? 0,
    fell: r.run?.fell ?? false,
  }));
  const you = rows.findIndex((r) => r.id === null);
  const top = rows.slice(0, BOARD_ROWS);
  return you >= BOARD_ROWS ? [...top.slice(0, BOARD_ROWS - 1), rows[you]] : top;
}

/** What comes after the run just filed. */
function nextOf(c: DualContest): DualNext {
  const next = nextDuel(c);
  if (next) return { kind: "duel", round: next.round };
  // The top four skied a final; the rest went out on the way.
  const place = dualPlace(c);
  return place <= 4 ? { kind: "done", place } : { kind: "out", place };
}

/** THE CONTEST THE NEXT RUN IS STOOD UP WITH: this run filed — or null
 * where it is still on, or the contest is over for him. */
export function nextDualContest(state: GameState): DualContest | null {
  const after = dualContestAfter(state);
  return after && nextDuel(after) ? after : null;
}

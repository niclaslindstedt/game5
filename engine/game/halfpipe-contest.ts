// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A HALFPIPE CONTEST (R39), pure: the format the freestyle rules give it,
// carried between the runs of one contest as `GameState.halfpipe`
// (`CreateGameOptions.halfpipe`), as big air carries its contest.
//
// THE FORMAT. A QUALIFICATION of `HALFPIPE.qualification` runs, each
// skier's best one counting; the best `HALFPIPE.finalists` go to the
// FINAL of `HALFPIPE.final` runs, nothing carried over and again the
// single best run counting, the final run in reverse order of the
// qualification. Each run is the whole pipe from the start gate to the
// finish line, its hits judged as one run (`halfpipe-judge.ts`); a fall
// ends it.
//
// THE FIELD is dealt, never skied, as a slalom's board is (`field.ts`): each
// rival's every run a pure function of the contest's seed, his number, the
// phase and the run — his level, whether he falls and how far down the
// pipe, the score a whole run draws — off a stream of its own, so
// nothing here draws from `state.rng` and no digest can see it.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { HALFPIPE } from "./defs/halfpipe.ts";
import { judgeHalfpipe, type PipeScore } from "./halfpipe-judge.ts";
import type { GameState } from "./state.ts";

/** A contest's two phases. */
export type PipePhase = "qualification" | "final";

/** ONE RUN JUDGED: its score, whether it was a fall, and — the player's —
 * the judges' sheet. */
export type PipeRun = { score: number; fell: boolean; sheet?: PipeScore };

/** THE CONTEST SO FAR — the player's runs in each phase, the final null
 * until he is through to it. The field's are dealt off `seed` on demand. */
export type PipeContest = {
  seed: number;
  qualification: PipeRun[];
  final: PipeRun[] | null;
};

/** A row of a phase's board: the player (`id` −1) or a rival, his runs so
 * far and his best. */
export type PipeRow = { id: number; runs: PipeRun[]; total: number };

/** The salt a contest's field is dealt off. */
const FIELD_SALT = 0x9a1f9e;

/** THE DEALT FIELD's knobs: how often a run ends in a fall (the field's
 * weakest to its best), the score a whole one draws, and what a fall
 * leaves. A top field lands about two runs in three (est.). */
export const PIPE_FIELD = {
  fallMost: 0.45,
  fallLeast: 0.2,
  /** A run landed whole: `floor` + `span` × level, give or take `wobble`. */
  floor: 40,
  span: 50,
  wobble: 6,
  /** A fall: the hits before it, at most this. */
  fallScore: 30,
} as const;

/** A new contest, before the first run. */
export function freshHalfpipe(seed: number): PipeContest {
  return { seed, qualification: [], final: null };
}

/** The phase the contest's NEXT run is in, or null when the player's
 * contest is over. */
export function pipePhase(c: PipeContest): PipePhase | null {
  if (c.final) return c.final.length < HALFPIPE.final ? "final" : null;
  return c.qualification.length < HALFPIPE.qualification ? "qualification" : null;
}

/** How many runs a phase has. */
export function pipeRunsIn(phase: PipePhase): number {
  return phase === "final" ? HALFPIPE.final : HALFPIPE.qualification;
}

/** RIVAL `id`'s run `run` of a phase, dealt. */
export function pipeRivalRun(seed: number, id: number, phase: PipePhase, run: number): PipeRun {
  const F = PIPE_FIELD;
  const level = createRng((seed ^ FIELD_SALT) + id * 7919).next();
  const rng = createRng(
    (seed ^ FIELD_SALT) + id * 7919 + (phase === "final" ? 104729 : 0) + run * 31 + 1,
  );
  const fell = rng.chance(F.fallMost - (F.fallMost - F.fallLeast) * level);
  const score = fell
    ? rng.range(4, F.fallScore)
    : Math.min(99, F.floor + F.span * level + rng.range(-F.wobble, F.wobble));
  return { score: Math.floor(score * 100) / 100, fell };
}

/** A phase's TOTAL: its best run. */
export function bestPipeRun(runs: readonly PipeRun[]): number {
  return runs.reduce((m, r) => Math.max(m, r.score), 0);
}

/** The rivals in a phase: the whole field in the qualification, the
 * finalists in the final (bar the player's place). */
function rivalsIn(c: PipeContest, phase: PipePhase): number[] {
  const all = Array.from({ length: HALFPIPE.field }, (_, i) => i);
  if (phase === "qualification") return all;
  return pipeBoard(c, "qualification", HALFPIPE.qualification)
    .slice(0, HALFPIPE.finalists)
    .map((r) => r.id)
    .filter((id) => id >= 0);
}

/** A PHASE'S BOARD after `shown` runs of the field's (every rival's first
 * `shown`, the player's as many as he has taken), best first. A tie keeps
 * the order the skiers were listed in, the player first. */
export function pipeBoard(c: PipeContest, phase: PipePhase, shown: number): PipeRow[] {
  const mine = phase === "final" ? c.final : c.qualification;
  const rows: PipeRow[] = [];
  if (mine) rows.push({ id: -1, runs: mine, total: bestPipeRun(mine) });
  for (const id of rivalsIn(c, phase).slice(
    0,
    phase === "final" ? HALFPIPE.finalists : undefined,
  )) {
    const runs: PipeRun[] = [];
    for (let j = 0; j < Math.min(shown, pipeRunsIn(phase)); j++)
      runs.push(pipeRivalRun(c.seed, id, phase, j));
    rows.push({ id, runs, total: bestPipeRun(runs) });
  }
  return rows.sort((a, b) => b.total - a.total);
}

/** The player's place on a phase's board, 1-based, after the field's runs
 * as far as his. */
export function pipePlace(c: PipeContest, phase: PipePhase): number {
  const mine = phase === "final" ? c.final : c.qualification;
  return pipeBoard(c, phase, mine?.length ?? 0).findIndex((r) => r.id === -1) + 1;
}

/** THE RUN ON THE SNOW JUDGED (`judgeHalfpipe`), or null while it is on
 * or on a run with no contest. */
export function judgePipeRun(state: GameState): PipeRun | null {
  const c = state.halfpipe;
  if (!c) return null;
  const phase = pipePhase(c) ?? "final";
  const n =
    (phase === "final" ? 4 : 0) +
    (phase === "final" ? (c.final?.length ?? 0) : c.qualification.length);
  const sheet = judgeHalfpipe(state, c.seed, n);
  return sheet ? { score: sheet.total, fell: sheet.fell, sheet } : null;
}

/** THE CONTEST AFTER THE RUN ON THE SNOW: its run filed in its phase, and
 * — the qualification done — the final opened if the player is in the
 * best `finalists`. Null while the run is on, or on a run with no
 * contest. */
export function pipeContestAfter(state: GameState): PipeContest | null {
  const c = state.halfpipe;
  const run = judgePipeRun(state);
  if (!c || !run) return null;
  // Filed without the sheet: the contest carries scores, not the run.
  const filed: PipeRun = { score: run.score, fell: run.fell };
  if (c.final) return { ...c, final: [...c.final, filed] };
  const next: PipeContest = { ...c, qualification: [...c.qualification, filed] };
  if (next.qualification.length >= HALFPIPE.qualification) {
    if (pipePlace(next, "qualification") <= HALFPIPE.finalists) next.final = [];
  }
  return next;
}

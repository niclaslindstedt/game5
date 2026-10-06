// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A MOGULS CONTEST (R42), pure: the format the freestyle rules give it,
// carried between its runs as `GameState.moguls` (`CreateGameOptions.
// moguls`), as the halfpipe carries its contest.
//
// THE FORMAT. One QUALIFICATION run; its best `MOGULS.final1` to FINAL 1,
// one run with nothing carried over; its best `MOGULS.final2` to FINAL 2,
// again one run and nothing carried. Each run is scored whole
// (`moguls-judge.ts`); a fall or a gate missed scores nothing. Ties: the
// better turns, then the better air before its DD, then the faster time.
//
// THE FIELD is dealt, never skied, as a slalom's board is: each rival's
// run in each phase a pure function of the contest's seed, his number and
// the phase — his level, whether he is out, his turns, air and time about
// the pace — off a stream of its own, so nothing here draws from
// `state.rng` and no digest can see it.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { MOGULS } from "./defs/moguls.ts";
import { judgeMoguls, type MogulScore } from "./moguls-judge.ts";
import type { GameState } from "./state.ts";

/** A contest's three phases, in order. */
export const MOGUL_PHASES = ["qualification", "final1", "final2"] as const;
export type MogulPhase = (typeof MOGUL_PHASES)[number];

/** ONE RUN SCORED: its total, the three parts, the tie-breaks (the air
 * before its DD, the time), whether it was out and — the player's — the
 * sheet. */
export type MogulRun = {
  score: number;
  turns: number;
  air: number;
  airRaw: number;
  speed: number;
  time: number;
  fell: boolean;
  sheet?: MogulScore;
};

/** THE CONTEST SO FAR: the player's run in each phase he has skied, in
 * order, and how many phases he has been let into (1 at the start). The
 * field's are dealt off `seed` on demand. */
export type MogulsContest = { seed: number; runs: MogulRun[]; open: number };

/** A row of a phase's board: the player (`id` −1) or a rival, and his run
 * (null for one not yet skied). */
export type MogulRow = { id: number; run: MogulRun | null };

/** The salt a contest's field is dealt off. */
const FIELD_SALT = 0x3b0c5;

/** THE DEALT FIELD's knobs (est.): how often a run is out (the field's
 * weakest to its best); the turns a run draws (`turns` + `turnSpan` ×
 * level, give or take `wobble`); the air before its DD and the DD it is
 * thrown at; the time over the pace time (`slow` for the weakest, `fast`
 * for the best, give or take `timeWobble`). A top final's six score turns
 * 47–50, air 16–18 and speed 14–17. */
export const MOGUL_FIELD = {
  outMost: 0.22,
  outLeast: 0.08,
  turns: 33,
  turnSpan: 16,
  wobble: 2,
  airRaw: 13,
  airSpan: 5,
  dd: 0.72,
  ddSpan: 0.32,
  slow: 1.12,
  fast: 0.98,
  timeWobble: 0.025,
} as const;

/** A new contest, before the qualification. */
export function freshMoguls(seed: number): MogulsContest {
  return { seed, runs: [], open: 1 };
}

/** The phase the player's NEXT run is in, or null when his contest is
 * over. */
export function mogulPhase(c: MogulsContest): MogulPhase | null {
  return c.runs.length < c.open ? MOGUL_PHASES[c.runs.length] : null;
}

/** RIVAL `id`'s LEVEL in a contest of `seed`, 0 the field's weakest … 1
 * its best — the one draw every phase of his is read off. */
export function mogulLevelOf(seed: number, id: number): number {
  return createRng((seed ^ FIELD_SALT) + id * 7919).next();
}

/** RIVAL `id`'s run in `phase` of a contest of `seed` on a course of
 * `pace` s, dealt. */
export function mogulRivalRun(seed: number, id: number, phase: MogulPhase, pace: number): MogulRun {
  const F = MOGUL_FIELD;
  const level = mogulLevelOf(seed, id);
  const rng = createRng(
    (seed ^ FIELD_SALT) + id * 7919 + (MOGUL_PHASES.indexOf(phase) + 1) * 104729,
  );
  const fell = rng.chance(F.outMost - (F.outMost - F.outLeast) * level);
  const turns = Math.min(58, F.turns + F.turnSpan * level + rng.range(-F.wobble, F.wobble));
  const airRaw = Math.min(20, F.airRaw + F.airSpan * level + rng.range(-1, 1));
  const air = airRaw * (F.dd + F.ddSpan * level);
  const time = pace * (F.slow - (F.slow - F.fast) * level + rng.range(-F.timeWobble, F.timeWobble));
  const speed = Math.max(0, Math.min(20, 48 - 32 * (time / pace)));
  const c = (x: number): number => Math.floor(x * 100) / 100;
  if (fell) return { score: 0, turns: 0, air: 0, airRaw: 0, speed: 0, time: c(time), fell };
  const parts = { turns: c(turns), air: c(Math.min(20, air)), speed: c(speed) };
  return {
    score: c(parts.turns + parts.air + parts.speed),
    ...parts,
    airRaw: c(airRaw),
    time: c(time),
    fell,
  };
}

/** Which of two runs places higher (negative: `a`): the score, then the
 * turns, the air before its DD and the time; a run not yet skied last. */
export function mogulOrder(a: MogulRun | null, b: MogulRun | null): number {
  if (!a || !b) return (a ? 0 : 1) - (b ? 0 : 1);
  return b.score - a.score || b.turns - a.turns || b.airRaw - a.airRaw || a.time - b.time;
}

/** The skiers in a phase: everyone in the qualification, then each
 * final's places off the board before it. */
function entrants(c: MogulsContest, phase: MogulPhase, pace: number): number[] {
  const all = [-1, ...Array.from({ length: MOGULS.field }, (_, i) => i)];
  if (phase === "qualification") return all;
  const before = phase === "final1" ? "qualification" : "final1";
  const n = phase === "final1" ? MOGULS.final1 : MOGULS.final2;
  return mogulBoard(c, before, pace)
    .slice(0, n)
    .map((r) => r.id);
}

/** A PHASE'S BOARD on a course of pace time `pace` s, best first — the
 * player's run if he has skied it. */
export function mogulBoard(c: MogulsContest, phase: MogulPhase, pace: number): MogulRow[] {
  const i = MOGUL_PHASES.indexOf(phase);
  return entrants(c, phase, pace)
    .map((id) => ({
      id,
      run: id < 0 ? (c.runs[i] ?? null) : mogulRivalRun(c.seed, id, phase, pace),
    }))
    .sort((a, b) => mogulOrder(a.run, b.run));
}

/** The player's place on a phase's board, 1-based (0 off it). */
export function mogulPlace(c: MogulsContest, phase: MogulPhase, pace: number): number {
  return mogulBoard(c, phase, pace).findIndex((r) => r.id === -1) + 1;
}

/** A course's PACE TIME, s: its length over the pace speed. */
export function paceTimeOf(state: GameState): number {
  return (state.level.moguls?.length ?? 0) / MOGULS.pace;
}

/** THE RUN ON THE SNOW SCORED (`judgeMoguls`), or null while it is on or
 * on a run with no contest. */
export function judgeMogulsRun(state: GameState): MogulRun | null {
  const c = state.moguls;
  if (!c) return null;
  const sheet = judgeMoguls(state, c.seed, c.runs.length);
  if (!sheet) return null;
  return {
    score: sheet.total,
    turns: sheet.turns,
    air: sheet.air,
    airRaw: sheet.airRaw,
    speed: sheet.speed,
    time: sheet.time,
    fell: sheet.fell,
    sheet,
  };
}

/** THE CONTEST AFTER THE RUN ON THE SNOW: its run filed in its phase and
 * the next phase opened if he placed into it. Null while the run is on, or
 * on a run with no contest. */
export function mogulsContestAfter(state: GameState): MogulsContest | null {
  const c = state.moguls;
  const run = judgeMogulsRun(state);
  if (!c || !run) return null;
  const phase = mogulPhase(c) ?? "final2";
  const { sheet: _sheet, ...filed } = run;
  void _sheet;
  const next: MogulsContest = { ...c, runs: [...c.runs, filed] };
  const cut = phase === "qualification" ? MOGULS.final1 : phase === "final1" ? MOGULS.final2 : 0;
  const pace = paceTimeOf(state);
  if (cut > 0 && !run.fell && mogulPlace(next, phase, pace) <= cut)
    next.open = next.runs.length + 1;
  return next;
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A DUAL SKIED (R43) — the player and his rival out of one start device and
// down the two lanes of one course side by side: the rival a whole run of
// his own (`rivals.ts`) over the same venue in the OTHER lane (`laneOf`),
// skied by the moguls bot at a pace his level on the start list gives him,
// his reaction to the gates his own — all off the dual's own stream, so a
// restart and a replay stand up the same dual.
//
// THE START: "blue course ready… red course ready", then both gates drop
// together at a moment dealt within three seconds of the call — a start
// gate's doors (`RunRules.start` "gate"), so no false start is possible.
//
// ON THE COURSE each skier is judged in his own lane (`stepDuel`): the
// strict gates of his lane; BOTH SKIS OVER THE CENTRE LINE a DID NOT
// FINISH; a stop of ten seconds the same; a fall that stops him out as on
// any course. The lanes never meet, so there is no contact.
//
// THE RESULT (`judgeDuel`), once both runs are over: each run read as the
// moguls' panel reads one (`scoreMoguls`), the gap at the line off the
// moments each crossed it, and the panel's votes (`dual-judge.ts`).

import { fieldCoords } from "../mapgen/mogul-field.ts";
import { laneOf } from "../mapgen/dual-moguls.ts";
import { outRun, freshProgress, standSkier } from "./course.ts";
import { DUAL_MOGULS } from "./defs/dual-moguls.ts";
import { RACE } from "./defs/modes.ts";
import { skisById } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import {
  advance,
  DUAL_ROUNDS,
  dualRng,
  fieldSeed,
  type DualContest,
  type DualHeat,
  type DualResult,
} from "./dual-bracket.ts";
import { voteDual, type DualRead } from "./dual-judge.ts";
import { freshTurns, stepMogulTurns } from "./mogul-turns.ts";
import { mogulLevelOf, type MogulRun } from "./moguls-contest.ts";
import { judgeMoguls, scoreMoguls } from "./moguls-judge.ts";
import { rivalRun } from "./rivals.ts";
import type { GameEvent, GameState } from "./state.ts";
import { stepTricks } from "./tricks.ts";

/** A DUAL UNDER WAY: the dual, the player's lane, and the moment each lane's
 * run ended — over the line or out — on the race clock, s. */
export type Duel = {
  heat: DualHeat;
  lane: 0 | 1;
  ended: [number | null, number | null];
};

/** A DUAL'S RIVAL AS SKIED: the share of the bot's pace he skis at, his
 * level 0 → 1 (est. — a rival a little slower than the bot's own hold to a
 * little faster, never past what the legs absorb), and his reaction to the
 * gates, s. */
export const DUEL = {
  pace: { min: 0.92, max: 1.04 },
  react: { min: 0.15, max: 0.35 },
} as const;

/** THE START: the call, then both gates dropping at a moment dealt off the
 * dual's stream within `DUAL_MOGULS.release` s of it. */
export function duelCountdown(c: DualContest, heat: DualHeat): number {
  return DUAL_MOGULS.ready + dualRng(c, heat).range(0, DUAL_MOGULS.release);
}

/** The player's lane in a dual. */
export function laneIn(heat: DualHeat): 0 | 1 {
  return heat.lanes[0].id === null ? 0 : 1;
}

/** STAND THE DUAL: the rival in the other lane, his pace, grit and
 * reaction his own. Called once, from `createGame`, on a map skied in the
 * player's lane. */
export function createDuel(state: GameState, c: DualContest, heat: DualHeat): void {
  const lane = laneIn(heat);
  const other: 0 | 1 = lane === 0 ? 1 : 0;
  const entry = heat.lanes[other];
  const rng = dualRng(c, heat);
  // The countdown's draw first, so the gates drop at the same moment
  // whatever else is dealt.
  rng.next();
  const level = entry.id === null ? 0.5 : mogulLevelOf(fieldSeed(c), entry.id);
  const P = DUEL.pace;
  const resilience =
    RACE.resilienceBand.min + (RACE.resilienceBand.max - RACE.resilienceBand.min) * level;
  const theirs = laneOf(state.level, other);
  const spot = theirs.spawn;
  const run = rivalRun(state, skisById(DUAL_MOGULS.skis), spot, rng.range(0, 2), resilience);
  run.level = theirs;
  run.progress = freshProgress(theirs);
  run.mogulTurns = freshTurns();
  run.dualMoguls = undefined;
  run.duel = undefined;
  standSkier(run, spot.x, spot.z, spot.heading);
  state.rivals = [
    {
      id: entry.id ?? 0,
      run,
      pace: P.min + (P.max - P.min) * level,
      resilience,
      react: rng.range(DUEL.react.min, DUEL.react.max),
      lane: 0,
    },
  ];
  state.duel = { heat, lane, ended: [null, null] };
}

/** The two runs of a dual by lane, the blue first. */
function runsOf(state: GameState, duel: Duel): [GameState, GameState] {
  const rival = state.rivals[0]?.run ?? state;
  return duel.lane === 0 ? [state, rival] : [rival, state];
}

/** ONE STEP OF A DUAL, after every run has moved: the rival's air and turns
 * read as the player's are, each lane's own rules judged, and the moment
 * each run ended kept. */
export function stepDuel(state: GameState, events: GameEvent[]): void {
  const duel = state.duel;
  if (!duel) return;
  const rival = state.rivals[0]?.run;
  if (rival) {
    stepTricks(rival, rival.events);
    stepMogulTurns(rival, TUNING.dt);
  }
  const runs = runsOf(state, duel);
  for (let k = 0; k < 2; k++) {
    const run = runs[k];
    judgeLane(run, run === state ? events : run.events);
    const p = run.progress;
    if (p.finished && duel.ended[k] === null) duel.ended[k] = p.time;
  }
}

/** A lane's own rules: both skis over the centre line, or ten seconds
 * stopped, and he is out. */
function judgeLane(run: GameState, events: GameEvent[]): void {
  const p = run.progress;
  const dual = run.level.dualMoguls;
  const f = run.level.bumps;
  if (!dual || !f || !p.started || p.finished) return;
  const side = Math.sign(dual.lanes[dual.lane].offset);
  let over = 0;
  for (const s of run.skier.contacts) {
    if (s.station !== "mid") continue;
    if (fieldCoords(f, s.x, s.z).across * side < 0) over += 1;
  }
  if (over >= 2) {
    outRun(run, events, { status: "dnf", why: "lane", gate: p.nextCheckpoint });
    return;
  }
  if ((run.mogulTurns?.still ?? 0) >= DUAL_MOGULS.stop) {
    outRun(run, events, { status: "dnf", why: "stop", gate: p.nextCheckpoint });
  }
}

/** Whether a dual is still being skied: one of its runs not yet over. */
export function duelOn(state: GameState): boolean {
  const duel = state.duel;
  return duel !== undefined && (duel.ended[0] === null || duel.ended[1] === null);
}

/** ONE LANE'S RUN as the panel compares it. */
function readOf(run: GameState, c: DualContest, n: number, ended: number): DualRead {
  const course = run.level.moguls;
  const turns = run.mogulTurns;
  const out = run.progress.out !== null;
  if (!course || !turns) return { turns: 0, air: 0, codes: [], out: true, at: ended };
  const sheet = scoreMoguls(course, turns, run.tricks.flights, ended, false, c.seed, n);
  return {
    turns: sheet.turns,
    air: sheet.air,
    codes: sheet.jumps.flatMap((j) => (j ? [j.code] : [])),
    out,
    at: ended,
  };
}

/** THE DUAL DECIDED — once both runs are over — or null while it is on, or
 * on a run that is no dual. */
export function judgeDuel(state: GameState): DualResult | null {
  const duel = state.duel;
  const c = state.dualMoguls;
  if (!duel || !c || duelOn(state)) return null;
  const runs = runsOf(state, duel);
  const n = 2 * (duel.heat.index + 16 * (1 + DUAL_ROUNDS.indexOf(duel.heat.round)));
  const a = readOf(runs[0], c, n, duel.ended[0] ?? 0);
  const b = readOf(runs[1], c, n + 1, duel.ended[1] ?? 0);
  const rng = dualRng(c, duel.heat);
  rng.next();
  rng.next();
  return { heat: duel.heat, votes: voteDual(a, b, rng), out: [a.out, b.out] };
}

/** THE QUALIFICATION RUN SCORED as a moguls run — once it is over — or
 * null while it is on, or on a run that is no qualification. */
export function qualifyingRun(state: GameState): MogulRun | null {
  const c = state.dualMoguls;
  if (!c || state.duel) return null;
  const sheet = judgeMoguls(state, c.seed, 0);
  if (!sheet) return null;
  return {
    score: sheet.total,
    turns: sheet.turns,
    air: sheet.air,
    airRaw: sheet.airRaw,
    speed: sheet.speed,
    time: sheet.time,
    fell: sheet.fell,
  };
}

/** THE CONTEST AFTER THE RUN ON THE SNOW: the qualification filed, or the
 * dual decided, and every dual it leaves to be dealt dealt. Null while the
 * run (or either run of a dual) is on, or on a run with no contest. */
export function dualContestAfter(state: GameState): DualContest | null {
  const c = state.dualMoguls;
  if (!c) return null;
  if (state.duel) {
    const mine = judgeDuel(state);
    return mine ? advance(c, mine) : null;
  }
  const run = qualifyingRun(state);
  return run ? advance({ ...c, qualifying: run }, null) : null;
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI JUMPING CONTEST (R43), pure: the format the top series jumps,
// carried between its jumps as `GameState.skiJumpContest`
// (`CreateGameOptions.skiJumpContest`), as aerials carries its own.
//
// THE FORMAT. A TRIAL round (jumped or skipped; scored, counting nothing);
// the FIRST ROUND of fifty — the player and `SKI_JUMP.field` dealt — in
// the order of their standing, the best last; the best `SKI_JUMP.final`
// (all of a tie for the last place, and any faller whose distance was 95 %
// of the round's longest) to the FINAL ROUND in REVERSE order of the first
// round's points, the leader last; the winner the best TOTAL of both. A
// tie is shared: equal points, equal place, the places after it displaced.
//
// THE DAY. Every jump has its MOMENT on the contest's clock: a round starts
// at `SKI_JUMP_DAY.rounds`, a jumper every `interval` s down its start
// list, and the jury holds a jumper on the bar while the tail wind at the
// edge is past its window (`HILL_AIR.holdTail`), the list behind him held
// with him. The hill's air at that moment (`jump-wind.ts`) is what he
// flies in and what the stations measure. THE JURY'S GATE is picked for
// the round off the wind forecast at its start: the highest gate whose PAR
// jump (`SKI_JUMP_PAR`, the bot's clean jump measured by `make
// skijump-flight`) leaves the field's best a little short of HS; it is LOWERED
// for the rest of the round when the wind comes up so the best would pass
// HS — the round's first gate stays its reference, and the gate
// compensation pays the difference.
//
// THE FIELD is dealt, never jumped, as aerials' is: each rival's level (the
// one draw his every jump is read off), and each jump — his form either
// side of it, a botched take-off now and then, a fall now and then (oftener
// past HS), his five marks about his level — off a stream of the contest's
// own, his distance his par in the gate and the wind of his moment; his
// points by the same scorer the player's are (`ski-jump-judge.ts`). Nothing
// here draws from `state.rng`, so no digest can see it.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import type { Level } from "../mapgen/index.ts";
import type { SkiJumpHillId } from "../mapgen/trick-rules.ts";
import { SKI_JUMP, HILL_AIR } from "./defs/ski-jump.ts";
import { hillDensity, juryGate } from "./jump-inrun.ts";
import { hillAirAt, hillAirOf, hillMeanAt, measuredAt, type HillAir } from "./jump-wind.ts";
import {
  judgeJump,
  noStart,
  scoreJump,
  type JumpScore,
  type JumpScoring,
} from "./ski-jump-judge.ts";
import type { JumpRecord } from "./ski-jump-state.ts";
import type { GameState } from "./state.ts";

/** A contest's rounds, in the order they are jumped. */
export type SkiJumpRound = "trial" | "first" | "final";

/** THE PAR JUMP on each hill, measured by `make skijump-flight` (seed 38,
 * the light build, the bot's take-off): its distance at the calm-air jury
 * gate (`juryGate`), m; the metres a metre of in-run buys; the metres a m/s
 * of head wind buys and of tail wind costs. */
export const SKI_JUMP_PAR = {
  large: { at: 126, inRun: 3.6, head: 5.5, tail: 5.5 },
  normal: { at: 99.5, inRun: 3.1, head: 3.2, tail: 3.0 },
} as const satisfies Record<
  SkiJumpHillId,
  { at: number; inRun: number; head: number; tail: number }
>;

/** THE CONTEST'S DAY (est.: a broadcast's pace): when each round starts,
 * s of the contest's clock; the time between two jumpers, s; and the time
 * from a jumper's run starting (the count) to the edge, s. */
export const SKI_JUMP_DAY = {
  rounds: { trial: 0, first: 2400, final: 6600 } as Readonly<Record<SkiJumpRound, number>>,
  interval: 70,
  toEdge: 8,
} as const;

/** THE DEALT FIELD's knobs (est., a top series' large-hill field — the
 * best a few metres past the par jump, the thirtieth some ten short of it,
 * the last near thirty short): his distance off par at his level, `top` −
 * `span` × (1 − level)^`curve`, m; his form either way about it (a bell of
 * this spread), m; a BOTCHED take-off's chance and its cost, m; a FALL's
 * chance and its growth a metre past HS; his judges' mean mark at his
 * level (`style` + `styleSpan` × level), the eye either way, a botched
 * jump's and a jump past HS's cost a mark, a fallen jump's mean mark; and
 * the margin over par the jury leaves the field's best, m. */
export const SKI_JUMP_FIELD = {
  top: 3,
  span: 22,
  curve: 1.3,
  wobble: 2.5,
  botch: 0.05,
  botchCost: { least: 8, most: 24 },
  fall: 0.012,
  fallPast: 0.04,
  style: 16.7,
  styleSpan: 1.9,
  eye: 0.5,
  botchMark: 1,
  pastMark: 1,
  fallen: 8.5,
  margin: 8,
} as const;

/** THE HILL a contest is jumped on, as its scorer and its jury need it:
 * the scoring numbers, each gate's in-run, m from the edge (the lowest
 * first), its number, the calm-air jury gate (an index), and the par. */
export type JumpVenue = JumpScoring & {
  hill: SkiJumpHillId;
  inRun: number[];
  numbers: number[];
  jury: number;
};

/** A JUMP FILED: its points part by part and — the player's — its record. */
export type JumpRun = JumpScore & { record?: JumpRecord };

/** THE CONTEST SO FAR: its seed, its hill, the rounds it has, the player's
 * jump in each round he has jumped (null a trial he skipped), how many
 * rounds he has been let into, his standing in the start order (0 the
 * field's weakest … 1 its best), and the hill's air on its day. */
export type SkiJumpContest = {
  seed: number;
  venue: JumpVenue;
  rounds: SkiJumpRound[];
  jumps: (JumpRun | null)[];
  open: number;
  level: number;
  air: HillAir;
};

/** A row of a round's board: the player (`id` −1) or a rival, his jump
 * (null not yet jumped), his place (equal points share it; 0 not jumped). */
export type JumpRow = { id: number; jump: JumpRun | null; place: number };

/** A row of the contest's STANDINGS: his two jumps, their total, his
 * place. */
export type JumpStanding = {
  id: number;
  first: JumpRun | null;
  final: JumpRun | null;
  total: number;
  place: number;
};

/** The salts the field and the day are dealt off. */
const FIELD_SALT = 0x5a1e7f;
const AIR_SALT = 0x2b9d31;

/** THE HILL a contest is jumped on, read off `level`'s. */
export function jumpVenueOf(level: Level): JumpVenue {
  const h = level.skiJump!;
  return {
    hill: h.hill,
    w: h.w,
    hs: h.hs,
    metre: h.metre,
    gateFactor: h.gateFactor,
    headFactor: h.headFactor,
    tailFactor: h.tailFactor,
    inRun: h.gates.map((g) => g.e),
    numbers: h.gates.map((g) => g.number),
    jury: juryGate(h, hillDensity({ level })),
  };
}

/** A NEW CONTEST on `level`'s hill, dealt off `seed`: with its trial round
 * unless asked otherwise, the player at `level` in the start order. */
export function freshSkiJumpContest(
  seed: number,
  level: Level,
  o: { trial?: boolean; standing?: number } = {},
): SkiJumpContest {
  const trial = o.trial ?? SKI_JUMP.trial;
  const rounds: SkiJumpRound[] = trial ? ["trial", "first", "final"] : ["first", "final"];
  return {
    seed,
    venue: jumpVenueOf(level),
    rounds,
    jumps: [],
    open: rounds.length - 1,
    level: o.standing ?? 0.5,
    air: hillAirOf(level, (seed ^ AIR_SALT) >>> 0),
  };
}

/** The round the player's NEXT jump is in, or null when his contest is
 * over (or he is out of the final). */
export function skiJumpRoundOf(c: SkiJumpContest): SkiJumpRound | null {
  return c.jumps.length < c.open ? c.rounds[c.jumps.length] : null;
}

/** The contest with its trial round SKIPPED (unchanged when the next jump
 * is not the trial's). */
export function skipTrial(c: SkiJumpContest): SkiJumpContest {
  return skiJumpRoundOf(c) === "trial" ? { ...c, jumps: [...c.jumps, null] } : c;
}

/** RIVAL `id`'s LEVEL in a contest of `seed`, 0 the field's weakest … 1
 * its best. */
export function jumperLevelOf(seed: number, id: number): number {
  return createRng((seed ^ FIELD_SALT) + id * 7919).next();
}

/** THE PAR JUMP's distance on the venue from gate `g` (an index) in a mean
 * wind of `wind` m/s, m. */
export function parDistance(v: JumpVenue, g: number, wind: number): number {
  const P = SKI_JUMP_PAR[v.hill];
  return P.at + P.inRun * (v.inRun[g] - v.inRun[v.jury]) + (wind >= 0 ? P.head : P.tail) * wind;
}

/** THE JURY'S GATE for a wind of `wind` m/s: the highest whose par leaves
 * the field's best about 0.97 × HS (the lowest when none does). */
export function gateFor(v: JumpVenue, wind: number, aim = 0.97 * v.hs): number {
  for (let g = v.inRun.length - 1; g > 0; g--) {
    if (parDistance(v, g, wind) + SKI_JUMP_FIELD.margin <= aim) return g;
  }
  return 0;
}

/** A ROUND'S START LIST, in the order they jump: the trial and the first
 * round by standing (the best last); the final the first round's best in
 * reverse order of its points. */
export function startList(c: SkiJumpContest, round: SkiJumpRound): number[] {
  if (round === "final") return finalists(c).reverse();
  const all = [-1, ...Array.from({ length: SKI_JUMP.field }, (_, i) => i)];
  const lv = (id: number): number => (id < 0 ? c.level : jumperLevelOf(c.seed, id));
  return all.sort((a, b) => lv(a) - lv(b) || a - b);
}

/** A ROUND AS THE JURY RUNS IT: each jumper's id in start order, his
 * moment (s of the contest's clock his run starts at), his gate (an index)
 * and the round's reference gate. */
export type RoundPlan = { ids: number[]; at: number[]; gates: number[]; reference: number };

/** THE ROUND'S PLAN: the moments held for the wind, the gate picked at its
 * start and lowered when the wind comes up. */
export function roundPlan(c: SkiJumpContest, round: SkiJumpRound): RoundPlan {
  const D = SKI_JUMP_DAY;
  const ids = startList(c, round);
  const start = D.rounds[round];
  const reference = gateFor(c.venue, hillMeanAt(c.air, start + D.toEdge));
  const at: number[] = [];
  const gates: number[] = [];
  let gate = reference;
  let t = start;
  for (let k = 0; k < ids.length; k++) {
    if (k > 0) t += D.interval;
    for (let n = 0; n < HILL_AIR.holdMost; n++) {
      if (hillAirAt(c.air, t + D.toEdge, 0).head >= -HILL_AIR.holdTail) break;
      t += HILL_AIR.holdFor;
    }
    // The wind up: lowered so the best would not pass HS.
    const mean = hillMeanAt(c.air, t + D.toEdge);
    if (parDistance(c.venue, gate, mean) + SKI_JUMP_FIELD.margin > c.venue.hs) {
      gate = Math.min(gate, gateFor(c.venue, mean));
    }
    at.push(t);
    gates.push(gate);
  }
  return { ids, at, gates, reference };
}

/** The gate, as the scorer reads it, of gate index `g` in a round of
 * reference gate `ref`. */
function gateOf(v: JumpVenue, g: number, ref: number) {
  return { number: v.numbers[g], inRun: v.inRun[g], reference: v.inRun[ref] };
}

/** A bell of unit spread off three uniforms. */
function bell(rng: { next: () => number }): number {
  return (rng.next() + rng.next() + rng.next() - 1.5) * 2;
}

/** RIVAL `id`'s jump in `round`, jumped at his moment `at` from gate `g`
 * (an index) in a round of reference gate `ref`, dealt. */
export function rivalJump(
  c: SkiJumpContest,
  id: number,
  round: SkiJumpRound,
  at: number,
  g: number,
  ref: number,
): JumpRun {
  const F = SKI_JUMP_FIELD;
  const v = c.venue;
  const level = jumperLevelOf(c.seed, id);
  const r = ["trial", "first", "final"].indexOf(round) + 1;
  const rng = createRng((c.seed ^ FIELD_SALT) + id * 7919 + r * 104729);
  const wind = measuredAt(c.air, v, at + SKI_JUMP_DAY.toEdge);
  const botched = rng.chance(F.botch);
  let d =
    parDistance(v, g, wind) +
    F.top -
    F.span * Math.pow(1 - level, F.curve) +
    F.wobble * bell(rng) -
    (botched ? rng.range(F.botchCost.least, F.botchCost.most) : 0);
  d = Math.max(v.w * 0.3, Math.floor(d * 2) / 2);
  const fell = rng.chance(F.fall + F.fallPast * Math.max(0, d - v.hs));
  const mean = fell
    ? F.fallen
    : F.style + F.styleSpan * level - (botched ? F.botchMark : 0) - (d > v.hs ? F.pastMark : 0);
  const marks: number[] = [];
  for (let k = 0; k < 5; k++) {
    const m = mean + rng.range(-F.eye, F.eye);
    marks.push(Math.min(20, Math.max(0, Math.round(m * 2) / 2)));
  }
  return scoreJump(v, gateOf(v, g, ref), d, marks, wind, fell);
}

/** Order two jumps on a board: the more points first; a jump not yet
 * jumped last. */
function byPoints(a: JumpRun | null, b: JumpRun | null): number {
  if (!a || !b) return (a ? 0 : 1) - (b ? 0 : 1);
  return b.points - a.points;
}

/** Places shared by equal points, the places after a tie displaced. */
function placed<T extends { points: number | null }>(rows: T[]): number[] {
  return rows.map((row, i) => {
    if (row.points === null) return 0;
    let k = i;
    while (k > 0 && rows[k - 1].points === row.points) k--;
    return k + 1;
  });
}

/** A ROUND'S BOARD, best first — the player's jump if he has jumped it. */
export function skiJumpBoard(c: SkiJumpContest, round: SkiJumpRound): JumpRow[] {
  const i = c.rounds.indexOf(round);
  const plan = roundPlan(c, round);
  const rows = plan.ids.map((id, k) => ({
    id,
    jump:
      id < 0
        ? (c.jumps[i] ?? null)
        : rivalJump(c, id, round, plan.at[k], plan.gates[k], plan.reference),
  }));
  rows.sort((a, b) => byPoints(a.jump, b.jump) || a.id - b.id);
  const places = placed(rows.map((r) => ({ points: r.jump ? r.jump.points : null })));
  return rows.map((r, k) => ({ ...r, place: places[k] }));
}

/** The player's place on a round's board, 1-based (0 off it, or not
 * jumped). */
export function skiJumpPlace(c: SkiJumpContest, round: SkiJumpRound): number {
  return skiJumpBoard(c, round).find((r) => r.id === -1)?.place ?? 0;
}

/** THE FINALISTS, best first: the first round's best `SKI_JUMP.final`,
 * every jumper tied on the last place, and any faller past 95 % of the
 * round's longest jump. The player is among them only once he has jumped
 * the first round. */
export function finalists(c: SkiJumpContest): number[] {
  const board = skiJumpBoard(c, "first").filter((r) => r.jump && !r.jump.dns);
  const longest = Math.max(0, ...board.map((r) => r.jump!.distance));
  return board
    .filter(
      (r) => r.place <= SKI_JUMP.final || (r.jump!.fell && r.jump!.distance >= 0.95 * longest),
    )
    .map((r) => r.id);
}

/** THE STANDINGS after the rounds jumped: the finalists on their total of
 * both rounds, then the rest on their first round's points. */
export function skiJumpStandings(c: SkiJumpContest): JumpStanding[] {
  const first = skiJumpBoard(c, "first");
  const inFinal = new Set(finalists(c));
  // The final is dealt once the player's first round is in.
  const done = c.jumps.length > c.rounds.indexOf("first");
  const final = new Map((done ? skiJumpBoard(c, "final") : []).map((r) => [r.id, r.jump]));
  const rows = first.map((r) => {
    const two = inFinal.has(r.id) ? (final.get(r.id) ?? null) : null;
    return {
      id: r.id,
      first: r.jump,
      final: two,
      total: Math.round(((r.jump?.points ?? 0) + (two?.points ?? 0)) * 10) / 10,
      finalist: inFinal.has(r.id),
    };
  });
  rows.sort((a, b) => Number(b.finalist) - Number(a.finalist) || b.total - a.total || a.id - b.id);
  const places = placed(rows.map((r) => ({ points: r.finalist ? r.total : r.total - 1e6 })));
  return rows.map(({ finalist: _f, ...r }, k) => {
    void _f;
    return { ...r, place: places[k] };
  });
}

/** THE PLAYER'S NEXT JUMP as the jury has it: its round, his gate (an
 * index) and the round's reference gate, his moment, and the hill's air
 * with his run's clock laid on it — what `createGame` stands him on. Null
 * when his contest is over. */
export function skiJumpSetup(c: SkiJumpContest): {
  round: SkiJumpRound;
  gate: number;
  reference: number;
  at: number;
  air: HillAir;
} | null {
  const round = skiJumpRoundOf(c);
  if (!round) return null;
  const plan = roundPlan(c, round);
  const k = Math.max(0, plan.ids.indexOf(-1));
  return {
    round,
    gate: plan.gates[k],
    reference: plan.reference,
    at: plan.at[k],
    air: { ...c.air, clock: plan.at[k] },
  };
}

/** THE JUMP ON THE SNOW SCORED, or null while it is on (or on a run with
 * no contest): a jump never started off the bar no points. */
export function judgeSkiJumpRun(state: GameState): JumpRun | null {
  const c = state.skiJumpContest;
  const j = state.jump;
  const hill = state.level.skiJump;
  if (!c || !j || !hill) return null;
  const setup = skiJumpSetup(c);
  const ref = setup?.reference ?? j.gate;
  const gate = gateOf(c.venue, j.gate, ref);
  if (j.stage === "bar" || j.stage === "tracks") {
    return state.progress.out ? { ...noStart(gate.number), record: j.record } : null;
  }
  const r = j.record;
  if (r.outcome === "pending") return null;
  const key = c.jumps.length * 100 + 99;
  return {
    ...judgeJump(c.venue, r, gate, c.seed, key),
    record: { ...r, stations: [...r.stations] },
  };
}

/** THE CONTEST AFTER THE JUMP ON THE SNOW: filed in its round, the final
 * opened if the first round put him in it. Null while the jump is on, or
 * on a run with no contest. */
export function skiJumpContestAfter(state: GameState): SkiJumpContest | null {
  const c = state.skiJumpContest;
  const jump = judgeSkiJumpRun(state);
  return c && jump ? fileSkiJump(c, jump) : null;
}

/** THE CONTEST WITH THE PLAYER'S NEXT JUMP FILED: in its round, and the
 * final opened if it was the first round's and put him among the
 * finalists. */
export function fileSkiJump(c: SkiJumpContest, jump: JumpRun): SkiJumpContest {
  const round = skiJumpRoundOf(c);
  if (!round) return c;
  const next: SkiJumpContest = { ...c, jumps: [...c.jumps, jump] };
  if (round === "first" && finalists(next).includes(-1)) next.open = next.rounds.length;
  return next;
}

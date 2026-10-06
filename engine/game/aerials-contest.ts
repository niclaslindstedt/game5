// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN AERIALS CONTEST (R44), pure: the format the freestyle rules give it on
// the top series, carried between its jumps as `GameState.aerials`
// (`CreateGameOptions.aerials`), as the moguls carry theirs.
//
// THE FORMAT. One QUALIFICATION jump; its best `AERIALS.final1` to FINAL 1,
// one jump with nothing carried over; its best `AERIALS.final2` to FINAL 2,
// one jump and nothing carried — the last jump decides. Each jump is
// DECLARED before it is jumped (`AerialsContest.plan`) and scored whole
// (`aerials-judge.ts`); the two finals' jumps must differ (a jump repeated
// is a DID NOT FINISH). Ties: the score before the DD, then the form, then
// the landing, then the LOWER DD.
//
// THE FIELD is dealt, never jumped, as a slalom's board is: each rival's
// jump in each phase a pure function of the contest's seed, his number and
// the phase — his level, the jump he declares off the chart about it,
// whether he goes down, his three parts — off a stream of its own, so
// nothing here draws from `state.rng` and no digest can see it.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { AERIALS } from "./defs/aerials.ts";
import { AERIAL_JUMPS, aerialJump, flipsOf } from "./defs/aerial-jumps.ts";
import { judgeAerial, type AerialDnf, type AerialSheet } from "./aerials-judge.ts";
import type { GameState } from "./state.ts";

/** A contest's three phases, in order. */
export const AERIAL_PHASES = ["qualification", "final1", "final2"] as const;
export type AerialPhase = (typeof AERIAL_PHASES)[number];

/** ONE JUMP SCORED: the jump declared, its DD, the score and the parts
 * (the middle three of each summed), the score before the DD, whether he
 * went down, why it is no finish, and — the player's — the sheet. */
export type AerialJumpRun = {
  plan: string;
  dd: number;
  score: number;
  air: number;
  form: number;
  landing: number;
  raw: number;
  fell: boolean;
  dnf: AerialDnf | null;
  sheet?: AerialSheet;
};

/** THE CONTEST SO FAR: the player's jump in each phase he has jumped, in
 * order, how many phases he has been let into (1 at the start), and the
 * jump he has DECLARED for his next. The field's are dealt off `seed` on
 * demand. */
export type AerialsContest = { seed: number; jumps: AerialJumpRun[]; open: number; plan: string };

/** A row of a phase's board: the player (`id` −1) or a rival, and his jump
 * (null for one not yet jumped). */
export type AerialRow = { id: number; jump: AerialJumpRun | null };

/** The salt a contest's field is dealt off. */
const FIELD_SALT = 0x4e71a5;

/** THE DEALT FIELD's knobs (est.): how often a jump goes down (the field's
 * weakest to its best); the DD each declares (`dd` + `ddSpan` × level,
 * give or take `ddWobble`) — the weakest a double full-full, the best a
 * five-twist triple; the three parts' middle-three sums a landed jump
 * draws about its level, give or take `wobble`; and a fallen one's. A top
 * final's winner scores 5.7 + 12.3 + 8.0 at a 5.1. */
export const AERIAL_FIELD = {
  downMost: 0.32,
  downLeast: 0.12,
  dd: 3.15,
  ddSpan: 1.95,
  ddWobble: 0.3,
  air: 5.0,
  airSpan: 0.8,
  form: 10.2,
  formSpan: 2.4,
  landing: 6.4,
  landingSpan: 2.0,
  wobble: 0.5,
  fallen: { air: 4.8, form: 10, landing: 1.5 },
} as const;

/** The jump the default plan card offers a new contest. */
export function freshAerials(seed: number, plan: string = AERIALS.plan): AerialsContest {
  return { seed, jumps: [], open: 1, plan };
}

/** The phase the player's NEXT jump is in, or null when his contest is
 * over. */
export function aerialPhase(c: AerialsContest): AerialPhase | null {
  return c.jumps.length < c.open ? AERIAL_PHASES[c.jumps.length] : null;
}

/** RIVAL `id`'s LEVEL in a contest of `seed`, 0 the field's weakest … 1
 * its best — the one draw every phase of his is read off. */
export function aerialLevelOf(seed: number, id: number): number {
  return createRng((seed ^ FIELD_SALT) + id * 7919).next();
}

/** The doubles and triples of the chart, by the men's DD. */
const DEALT = AERIAL_JUMPS.filter((j) => (flipsOf(j.code)?.length ?? 0) >= 2)
  .slice()
  .sort((a, b) => a.men - b.men);

/** The chart's jump nearest `dd`, skipping `not`. */
function jumpNear(dd: number, not: readonly string[]): string {
  let best = DEALT[0].code;
  let gap = Infinity;
  for (const j of DEALT) {
    if (not.includes(j.code)) continue;
    const g = Math.abs(j.men - dd);
    if (g < gap) {
      gap = g;
      best = j.code;
    }
  }
  return best;
}

const cut = (x: number): number => Math.floor(x * 100 + 1e-9) / 100;
const tenth = (x: number): number => Math.round(x * 10) / 10;

/** RIVAL `id`'s jump in `phase` of a contest of `seed`, dealt — in a
 * final, never the jump he jumped in the final before. */
export function aerialRivalJump(seed: number, id: number, phase: AerialPhase): AerialJumpRun {
  const F = AERIAL_FIELD;
  const level = aerialLevelOf(seed, id);
  const i = AERIAL_PHASES.indexOf(phase);
  const rng = createRng((seed ^ FIELD_SALT) + id * 7919 + (i + 1) * 104729);
  const before = phase === "final2" ? [aerialRivalJump(seed, id, "final1").plan] : [];
  const plan = jumpNear(F.dd + F.ddSpan * level + rng.range(-F.ddWobble, F.ddWobble), before);
  const dd = aerialJump(plan)?.men ?? 0;
  const fell = rng.chance(F.downMost - (F.downMost - F.downLeast) * level);
  const w = (): number => rng.range(-F.wobble, F.wobble);
  const air = tenth(Math.min(6, fell ? F.fallen.air + w() : F.air + F.airSpan * level + w() / 2));
  const form = tenth(Math.min(15, fell ? F.fallen.form + w() : F.form + F.formSpan * level + w()));
  const landing = tenth(
    Math.min(9, fell ? F.fallen.landing + w() : F.landing + F.landingSpan * level + w()),
  );
  const raw = tenth(air + form + landing);
  return { plan, dd, score: cut(raw * dd), air, form, landing, raw, fell, dnf: null };
}

/** Which of two jumps places higher (negative: `a`): the score, then the
 * score before the DD, the form, the landing and the LOWER DD; a jump not
 * yet jumped last, and a DNF after every finish. */
export function aerialOrder(a: AerialJumpRun | null, b: AerialJumpRun | null): number {
  if (!a || !b) return (a ? 0 : 1) - (b ? 0 : 1);
  const out = (x: AerialJumpRun): number => (x.dnf ? 1 : 0);
  return (
    out(a) - out(b) ||
    b.score - a.score ||
    b.raw - a.raw ||
    b.form - a.form ||
    b.landing - a.landing ||
    a.dd - b.dd
  );
}

/** The jumpers in a phase: everyone in the qualification, then each
 * final's places off the board before it. */
function entrants(c: AerialsContest, phase: AerialPhase): number[] {
  const all = [-1, ...Array.from({ length: AERIALS.field }, (_, i) => i)];
  if (phase === "qualification") return all;
  const before = phase === "final1" ? "qualification" : "final1";
  const n = phase === "final1" ? AERIALS.final1 : AERIALS.final2;
  return aerialBoard(c, before)
    .slice(0, n)
    .map((r) => r.id);
}

/** A PHASE'S BOARD, best first — the player's jump if he has jumped it. */
export function aerialBoard(c: AerialsContest, phase: AerialPhase): AerialRow[] {
  const i = AERIAL_PHASES.indexOf(phase);
  return entrants(c, phase)
    .map((id) => ({
      id,
      jump: id < 0 ? (c.jumps[i] ?? null) : aerialRivalJump(c.seed, id, phase),
    }))
    .sort((a, b) => aerialOrder(a.jump, b.jump));
}

/** The player's place on a phase's board, 1-based (0 off it). */
export function aerialPlace(c: AerialsContest, phase: AerialPhase): number {
  return aerialBoard(c, phase).findIndex((r) => r.id === -1) + 1;
}

/** The jumps the player may NOT declare for his next: in final 2, the one
 * he jumped in final 1 (the two finals' jumps must differ). */
export function barredPlans(c: AerialsContest): string[] {
  return aerialPhase(c) === "final2" && c.jumps[1] ? [c.jumps[1].plan] : [];
}

/** THE JUMP ON THE SNOW SCORED (`judgeAerial`), or null while it is on or
 * on a run with no contest. */
export function judgeAerialRun(state: GameState): AerialJumpRun | null {
  const c = state.aerials;
  if (!c || !state.aerial) return null;
  const repeat = barredPlans(c).includes(state.aerial.plan);
  const sheet = judgeAerial(state, c.seed, c.jumps.length, repeat);
  if (!sheet) return null;
  return {
    plan: sheet.plan,
    dd: sheet.dd,
    score: sheet.score,
    air: sheet.air,
    form: sheet.form,
    landing: sheet.landing,
    raw: sheet.raw,
    fell: sheet.fell,
    dnf: sheet.dnf,
    sheet,
  };
}

/** THE CONTEST AFTER THE JUMP ON THE SNOW: its jump filed in its phase and
 * the next phase opened if he placed into it. Null while the jump is on,
 * or on a run with no contest. */
export function aerialsContestAfter(state: GameState): AerialsContest | null {
  const c = state.aerials;
  const jump = judgeAerialRun(state);
  if (!c || !jump) return null;
  const phase = aerialPhase(c) ?? "final2";
  const { sheet: _sheet, ...filed } = jump;
  void _sheet;
  const next: AerialsContest = { ...c, jumps: [...c.jumps, filed] };
  const cut = phase === "qualification" ? AERIALS.final1 : phase === "final1" ? AERIALS.final2 : 0;
  if (cut > 0 && !jump.dnf && aerialPlace(next, phase) <= cut) next.open = next.jumps.length + 1;
  // The next jump declared: the same, unless the finals' rule bars it.
  if (barredPlans(next).includes(next.plan))
    next.plan = jumpNear(aerialJump(next.plan)?.men ?? 0, [next.plan]);
  return next;
}

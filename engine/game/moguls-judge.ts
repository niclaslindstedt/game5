// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MOGULS' FORMAL SCORE (R40) — not an impression but the sum of three
// parts, out of 100, as the freestyle rules write it (`docs/freestyle.md` §
// *Moguls*):
//
// - TURNS, 60: five turn judges each score the turns 0.1–20 — carving half,
//   absorption and extension a quarter, the upper body a quarter, read by
//   `mogul-turns.ts` — and apart a DEDUCTION; the high and the low of each
//   are dropped and the middle three of each summed.
// - AIR, 20: two air judges score each jump 0–10 (its quality, its air,
//   its fluidity) times its DEGREE OF DIFFICULTY (`ddOf`, the table's);
//   the two judges averaged and cut to two decimals. The two jumps must be
//   different — a repeat counts once — and a very poor or missed landing
//   is held to 5.0.
// - SPEED, 20: `48 − 32 × time ÷ pace time`, at most 20, never under 0,
//   the pace time the course's length over the pace speed.
//
// Each judge's EYE — how he sees the run a few tenths either way — is
// dealt off a stream of the contest's own (its seed and the run's number),
// never `state.rng`, so no digest can see it.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { fieldCoords } from "../mapgen/mogul-field.ts";
import type { MogulsCourse } from "../mapgen/types.ts";
import { MOGULS } from "./defs/moguls.ts";
import { readTrick, type TrickRead } from "./judge.ts";
import type { FlightRecord } from "./flight-record.ts";
import type { MogulTurns } from "./mogul-turns.ts";
import type { GameState } from "./state.ts";

/** THE PANEL'S KNOBS (est.): how far a turn judge's eye wanders, points;
 * the skid share that is all slide and no carve; the share of the line in
 * the air that is no absorption at all; the swing off the fall line, rad,
 * that is no upper body at all; a stop's and a check's deduction; how far
 * an air judge's eye wanders; a jump's form off its height over the lip
 * (`air` points for `high` m), its landing (`landed`, `sketchy`), on a
 * `base` the plainest landed jump earns. */
export const MOGUL_PANEL = {
  eye: 0.8,
  slide: 0.8,
  airborne: 0.25,
  swing: 0.6,
  stop: 6,
  check: 2,
  airEye: 0.3,
  base: 5.5,
  air: 2,
  high: 1.5,
  landed: 2.5,
  sketchy: 0.8,
  missed: 5,
} as const;

/** One jump judged: the trick, its code and DD, the judges' mean for it
 * (before DD) and the points it earned. */
export type MogulJump = {
  trick: TrickRead;
  code: string;
  dd: number;
  form: number;
  points: number;
};

/** A RUN'S SHEET: the three parts and the total, the run's time, s, the
 * air before its DD (the second tie-break), the jumps, and whether he was
 * out (a fall, a gate missed — a DID NOT FINISH, scoring nothing). */
export type MogulScore = {
  turns: number;
  air: number;
  airRaw: number;
  speed: number;
  total: number;
  time: number;
  jumps: (MogulJump | null)[];
  fell: boolean;
};

const cut = (x: number): number => Math.floor(x * 100 + 1e-9) / 100;

/** THE MIDDLE THREE of five scores, summed. */
function middle(scores: number[]): number {
  const s = scores.slice().sort((a, b) => a - b);
  return s.slice(1, 4).reduce((a, b) => a + b, 0);
}

/** A JUMP'S DEGREE OF DIFFICULTY (the men's table): an upright 0.40; a
 * straight 360 0.68, each further turn 0.17; a flip 0.68 and the first full
 * twist on it 0.20 more, each further twist or flip 0.17; a grab 0.14.
 * With a CODE naming it, so two jumps can be told apart. */
export function ddOf(r: TrickRead): { code: string; dd: number } {
  const turns = Math.round(r.spin / 360);
  const grab = r.grabs.length > 0 ? 0.14 : 0;
  const g = grab > 0 ? "G" : "";
  if (r.flips > 0) {
    const dir = r.flipDir === "front" ? "f" : "b";
    const dd = 0.68 + (turns > 0 ? 0.2 + 0.17 * (turns - 1) : 0) + 0.17 * (r.flips - 1);
    return { code: `${dir}${r.flips}x${turns}${g}`, dd: cut(dd + grab) };
  }
  if (turns > 0) return { code: `${turns * 360}${g}`, dd: cut(0.68 + 0.17 * (turns - 1) + grab) };
  return { code: `S${g}`, dd: cut(0.4 + grab) };
}

/** THE TURN JUDGES' QUALITY of a run's turns, 0..1 (the share of 20 an
 * unbiased judge gives), and the deduction they take: carving (a turn on
 * every mogul, the skis cutting), absorption (the skis on the snow) and the
 * upper body (down the fall line, on the line). */
export function turnQuality(t: MogulTurns, course: MogulsCourse): { q: number; d: number } {
  const P = MOGUL_PANEL;
  const f = course.field;
  const gaps = f.gaps.reduce((s, [a, b]) => s + (b - a), 0);
  const moguls = Math.max(1, (f.to - f.from - gaps) / f.spacing);
  const n = Math.max(1, t.steps);
  const rhythm = Math.min(1, t.turns / moguls);
  const ground = Math.max(1, t.steps - t.air);
  const carve = 1 - Math.min(1, t.skid / ground / P.slide);
  const absorb = 1 - Math.min(1, t.air / n / P.airborne);
  const upper = 1 - Math.min(1, t.swing / ground / P.swing + (0.5 * t.line) / ground);
  const q = 0.5 * (0.6 * rhythm + 0.4 * carve) + 0.25 * absorb + 0.25 * Math.max(0, upper);
  const d = P.stop * t.stops + Math.min(P.check, (P.check * 4 * t.checks) / ground);
  return { q, d };
}

/** THE JUMP off air bump `k` of `course`: the first flight that left the
 * snow between its foot and its landing. */
function jumpOff(
  flights: readonly FlightRecord[],
  course: MogulsCourse,
  k: number,
): FlightRecord | null {
  const a = course.airs[k];
  for (const fl of flights) {
    if (fl.x === undefined || fl.z === undefined) continue;
    const at = fieldCoords(course.field, fl.x, fl.z).along;
    if (at > a.foot - 3 && at < a.landed) return fl;
  }
  return null;
}

/** The form two air judges see in a jump, 0..10, before its DD and their
 * eyes: its height over the lip and its landing. */
function formOf(fl: FlightRecord): number {
  const P = MOGUL_PANEL;
  const land = fl.outcome === "landed" ? P.landed : fl.outcome === "sketchy" ? P.sketchy : 0;
  const form = P.base + P.air * Math.min(1, fl.height / P.high) + land;
  return Math.min(fl.outcome === "fell" ? P.missed : 10, form);
}

/** THE RUN SCORED, from what was read of it — its turns, its flights, its
 * time and whether it was out — by the panel whose eyes run `n` of the
 * contest dealt off `seed`. */
export function scoreMoguls(
  course: MogulsCourse,
  turns: MogulTurns,
  flights: readonly FlightRecord[],
  time: number,
  out: boolean,
  seed: number,
  n: number,
): MogulScore {
  const P = MOGUL_PANEL;
  const rng = createRng((seed ^ 0x6d06a1) + n * 131 + 7);
  const { q, d } = turnQuality(turns, course);
  const scores: number[] = [];
  const deducted: number[] = [];
  for (let j = 0; j < 5; j++) {
    scores.push(Math.max(0.1, Math.min(20, 20 * q + rng.range(-P.eye, P.eye))));
    deducted.push(Math.max(0, d + (d > 0 ? rng.range(-0.2, 0.2) : 0)));
  }
  const turnPoints = cut(Math.max(0, middle(scores) - middle(deducted)));
  const jumps: (MogulJump | null)[] = [];
  const seen = new Set<string>();
  let air = 0;
  let airRaw = 0;
  for (let k = 0; k < course.airs.length; k++) {
    const fl = jumpOff(flights, course, k);
    if (!fl) {
      jumps.push(null);
      continue;
    }
    const trick = readTrick(fl);
    const { code, dd } = ddOf(trick);
    const base = formOf(fl);
    const eyes = [0, 1].map(() => Math.max(0, Math.min(10, base + rng.range(-P.airEye, P.airEye))));
    const form = cut((eyes[0] + eyes[1]) / 2);
    const points = seen.has(code) ? 0 : cut(form * dd);
    seen.add(code);
    jumps.push({ trick, code, dd, form, points });
    air += points;
    airRaw += form;
  }
  const pace = course.length / MOGULS.pace;
  const speed = cut(Math.max(0, Math.min(20, 48 - (32 * time) / pace)));
  const total = out ? 0 : cut(turnPoints + air + speed);
  return {
    turns: out ? 0 : turnPoints,
    air: out ? 0 : cut(air),
    airRaw: cut(airRaw),
    speed: out ? 0 : speed,
    total,
    time,
    jumps,
    fell: out,
  };
}

/** THE RUN ON THE SNOW SCORED — once it is over (through the finish, or
 * out) — or null while it is on or on a map with no moguls course. */
export function judgeMoguls(state: GameState, seed: number, n: number): MogulScore | null {
  const course = state.level.moguls;
  const turns = state.mogulTurns;
  const p = state.progress;
  if (!course || !turns || (!p.finished && !p.out)) return null;
  const time = p.time - (p.splits[0] ?? 0);
  return scoreMoguls(course, turns, state.tricks.flights, time, p.out !== null, seed, n);
}

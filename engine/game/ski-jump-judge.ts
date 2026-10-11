// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI JUMP SCORED (R43), pure — as the jumping rules write a jump's points
// (`docs/freestyle.md` § *Ski jumping*):
//
// - DISTANCE: 60 points at K (120 on a flying hill), the hill's METRE
//   VALUE for every metre either way, the distance to the half metre;
//   never below nothing.
// - STYLE: five judges each mark the jump out of 20 in half points, less
//   their deductions for the FLIGHT (at most 5), the LANDING (at most 5)
//   and the OUT-RUN to the fall line (at most 7); the highest and the
//   lowest marks are dropped and the middle three summed (60 at most).
// - THE GATE: a jumper started from a gate lower than the round's
//   reference gate is given the hill's gate factor for every metre of
//   in-run below it, one higher has it taken off.
// - THE WIND: the stations' mean along the hill (`jump-wind.ts`) — a head
//   wind's every m/s takes the hill's head factor off, a tail wind's every
//   m/s gives the tail factor (the rules' 1.21 × the head's) on.
// - Each part to one decimal; the jump's points their sum, never below
//   nothing.
//
// The deductions are read off the jump's RECORD (`JumpRecord`): the flight
// off the take-off's timing, the attitude's distance from the ideal, the
// roll and the V's opening, or the jumper turned over; the landing off how
// he came down (a telemark, late, two-footed, a fall) and the load his legs
// took; the out-run off what came of it (clean, a hand down, a fall). Each
// judge's EYE — a few tenths either way before his mark is rounded to the
// half point — is hashed off the contest's seed, the jump and the judge,
// never `state.rng`, so no digest can see it.

import type { JumpRecord } from "./ski-jump-state.ts";

/** THE PANEL'S KNOBS (est. where the rules give a band and no number),
 * points of deduction: the judges; the most each part may cost; the flight's
 * least (no flight is flawless to a judge), its cost a second of take-off
 * off perfect and its most, a never-pressed take-off, a degree of the
 * attitude's mean distance from the ideal and its most, a degree of roll
 * past `rollFree` and its most, the V never opened and a second of it late
 * past `veeFree` (most 1); the landing's by kind and a g of load past
 * `hard` (most `hardMost`); the out-run's by what came of it and an
 * unsteady ride-out past `shaky` g; the eye either way before rounding. */
export const JUMP_PANEL = {
  judges: 5,
  most: { flight: 5, landing: 5, outrun: 7 },
  flight: {
    least: 0.5,
    timing: 8,
    timingMost: 2,
    none: 2,
    attitude: 0.12,
    attitudeMost: 1.5,
    rollFree: 4,
    roll: 0.1,
    rollMost: 1.5,
    veeNever: 1.5,
    veeFree: 0.8,
    vee: 1,
  },
  landing: {
    telemark: 0.5,
    late: 1.5,
    twoFooted: 2,
    fall: 4.5,
    hard: 3.2,
    perG: 0.5,
    hardMost: 1.5,
  },
  outrun: { touch: 4.5, fall: 7, shaky: 4.5, unsteady: 0.5 },
  eye: 0.4,
} as const;

/** THE HILL'S SCORING NUMBERS a jump is scored on (`Level.skiJump`'s): K's
 * distance and the hill size, m; the metre value (points a metre); the
 * gate factor (points a metre of in-run); the head and tail wind factors
 * (points a m/s). */
export type JumpScoring = {
  w: number;
  hs: number;
  metre: number;
  gateFactor: number;
  headFactor: number;
  tailFactor: number;
};

/** A JUMP'S POINTS, part by part: the gate it was jumped from (its number),
 * the distance, m, and its points, the five judges' marks in the order
 * they sit and the middle three summed, the gate's and the wind's points
 * (the wind the stations' mean, m/s, head positive), the jump's points,
 * whether he fell, and whether he never started (no points). */
export type JumpScore = {
  gate: number;
  distance: number;
  distancePoints: number;
  marks: number[];
  style: number;
  gatePoints: number;
  wind: number;
  windPoints: number;
  points: number;
  fell: boolean;
  dns: boolean;
};

/** A number to one decimal, halves away from nothing. */
export function tenth(x: number): number {
  return (Math.sign(x) * Math.round(Math.abs(x) * 10 + 1e-9)) / 10 || 0;
}

/** A mark to the nearest half point, inside 0 … 20. */
function half(x: number): number {
  return Math.min(20, Math.max(0, Math.round(x * 2) / 2));
}

/** DISTANCE POINTS for `distance` m on the hill: 60 at K (120 on a flying
 * hill, K 185 m and up) and the metre value a metre either way, never
 * below nothing. */
export function distancePoints(hill: JumpScoring, distance: number): number {
  const base = hill.w >= 185 ? 120 : 60;
  return Math.max(0, tenth(base + hill.metre * (distance - hill.w)));
}

/** STYLE: the five marks with the highest and the lowest dropped, the
 * middle three summed. */
export function styleOf(marks: readonly number[]): number {
  const sorted = [...marks].sort((a, b) => a - b);
  let sum = 0;
  for (let i = 1; i < sorted.length - 1; i++) sum += sorted[i];
  return tenth(sum);
}

/** GATE POINTS for a jump started `inRun` m from the edge in a round
 * whose reference gate stands `reference` m from it: the factor for every
 * metre below on, above off. */
export function gatePoints(hill: JumpScoring, inRun: number, reference: number): number {
  return tenth(hill.gateFactor * (reference - inRun));
}

/** WIND POINTS for the stations' mean `wind` m/s (head positive): a head
 * wind's factor off, a tail wind's on. */
export function windPoints(hill: JumpScoring, wind: number): number {
  return tenth(wind > 0 ? -hill.headFactor * wind : -hill.tailFactor * wind);
}

/** A JUMP SCORED off its parts: the hill, the gate's number and its in-run
 * and the round's reference gate's, m from the edge, the distance, the
 * judges' marks, the wind measured and whether he fell. */
export function scoreJump(
  hill: JumpScoring,
  gate: { number: number; inRun: number; reference: number },
  distance: number,
  marks: readonly number[],
  wind: number,
  fell: boolean,
): JumpScore {
  const d = distancePoints(hill, distance);
  const style = styleOf(marks);
  const g = gatePoints(hill, gate.inRun, gate.reference);
  const w = windPoints(hill, wind);
  return {
    gate: gate.number,
    distance,
    distancePoints: d,
    marks: [...marks],
    style,
    gatePoints: g,
    wind,
    windPoints: w,
    points: Math.max(0, tenth(d + style + g + w)),
    fell,
    dns: false,
  };
}

/** A jump never started: no points. */
export function noStart(gate: number): JumpScore {
  return {
    gate,
    distance: 0,
    distancePoints: 0,
    marks: [0, 0, 0, 0, 0],
    style: 0,
    gatePoints: 0,
    wind: 0,
    windPoints: 0,
    points: 0,
    fell: false,
    dns: true,
  };
}

/** THE DEDUCTIONS a jump's record earns, part by part, before any judge's
 * eye: the flight, the landing and the out-run, points. */
export function deductionsOf(r: JumpRecord): { flight: number; landing: number; outrun: number } {
  const P = JUMP_PANEL;
  const F = P.flight;
  let flight: number = P.most.flight;
  if (!r.lost) {
    flight = F.least;
    flight += r.timing === null ? F.none : Math.min(F.timingMost, Math.abs(r.timing) * F.timing);
    flight += Math.min(F.attitudeMost, r.attitude * F.attitude);
    flight += Math.min(F.rollMost, Math.max(0, r.roll - F.rollFree) * F.roll);
    flight += r.veeAt < 0 ? F.veeNever : Math.min(F.vee, Math.max(0, r.veeAt - F.veeFree));
    flight = Math.min(P.most.flight, flight);
  }
  const L = P.landing;
  const fell = r.landing === "fall" || r.outcome === "fall";
  let landing: number = r.landing === "fall" ? L.fall : r.landing ? L[r.landing] : L.twoFooted;
  if (r.landing !== "fall") landing += Math.min(L.hardMost, Math.max(0, r.load - L.hard) * L.perG);
  landing = Math.min(P.most.landing, landing);
  const O = P.outrun;
  const outrun = fell
    ? O.fall
    : r.outcome === "touch"
      ? O.touch
      : r.load > O.shaky
        ? O.unsteady
        : 0;
  return { flight, landing, outrun };
}

/** A number in [0, 1) hashed off a contest's seed, a jump's key and a
 * judge. */
function eyeHash(seed: number, key: number, judge: number): number {
  let h = Math.imul((seed ^ Math.imul(key + 1, 0x27d4eb2d)) >>> 0, 0x9e3779b1) >>> 0;
  h = Math.imul(h ^ (judge + 0x1f), 0x85ebca77) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** THE FIVE JUDGES' MARKS for a jump with `ded` points of deductions
 * summed: each 20 less them and his own eye, to the half point — the eye
 * hashed off the contest's `seed` and the jump's `key`. */
export function marksFor(ded: number, seed: number, key: number): number[] {
  const marks: number[] = [];
  for (let k = 0; k < JUMP_PANEL.judges; k++) {
    const eye = (eyeHash(seed, key, k) * 2 - 1) * JUMP_PANEL.eye;
    marks.push(half(20 - ded + eye));
  }
  return marks;
}

/** THE JUMP ON THE SNOW SCORED off its record: the five marks off its
 * deductions (`seed`, `key` the eye's), the distance, the wind the
 * stations measured, the gate against the round's reference. */
export function judgeJump(
  hill: JumpScoring,
  r: JumpRecord,
  gate: { number: number; inRun: number; reference: number },
  seed: number,
  key: number,
): JumpScore {
  const d = deductionsOf(r);
  const marks = marksFor(d.flight + d.landing + d.outrun, seed, key);
  const fell = r.landing === "fall" || r.outcome === "fall";
  return scoreJump(hill, gate, r.distance, marks, r.measured, fell);
}

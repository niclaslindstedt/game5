// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUDGES (R37's contest, `big-air.ts`): a flight READ as a trick and
// SCORED as a panel scores it.
//
// THE READING. A big air trick is named by what it turned: the spin in
// half turns (a 180, a 360 … a 1800), the flips and which way (back or
// front), OFF-AXIS when it flipped and spun together (a cork), its
// direction (left or right, the way he spun), whether it left or met the
// snow switch, and the grabs held. `readTrick` reads a `FlightRecord`
// (`tricks.ts`) into those figures and nothing else: the WORDS are the
// app's (`strings-bigair.ts`).
//
// THE SCORE. A big air jump is judged on its OVERALL IMPRESSION, 0–100,
// weighing the difficulty of the trick, its execution (the take-off, the
// control in the air, the grab held, the landing), the amplitude, and
// progression — the freestyle rules' judging chapter (`docs/freestyle.md`).
// `impressionOf` puts that on one number off the reading and the flight:
// the difficulty sets the ceiling a clean jump reaches, the landing takes
// away from it, the height and the length a little either way. A FALL is
// scored low whatever was thrown. Six judges each mark it whole, a little
// apart (each judge's own eye, dealt off a hash of the contest's seed,
// the jump and the judge — never the run's stream), the highest and the
// lowest are dropped and the four left averaged, CUT (never rounded) to
// two decimals.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import type { FlightRecord, TrickPose } from "./state.ts";

const TAU = Math.PI * 2;

/** The panel and how it marks, and the impression's weights. */
export const JUDGING = {
  /** Judges on the panel, and how many marks at each end are dropped. */
  judges: 6,
  dropped: 1,
  /** How far one judge's eye strays from the impression, points either
   * way. */
  spread: 3,
  /** THE DIFFICULTY, in steps: one a half turn of spin, `flip` a flip,
   * `cork` for taking them off axis, `switchIn` for leaving the lip
   * backward, `grab` for a grab held. A clean jump scores `floor` plus
   * `span` of the `top` steps it reaches — a straight air with a grab
   * low thirties, a double-cork 1440 the high eighties. */
  flip: 2.5,
  cork: 1,
  switchIn: 1,
  grab: 0.5,
  floor: 30,
  span: 62,
  top: 16,
  /** THE LANDING: points off at a landing grade of 1 (`landingGrade`,
   * the legs folded to the stop), and on a sketchy one (harsh, or still
   * in a grab) the further points off and the most it scores. */
  landing: 12,
  sketchy: 20,
  sketchyMost: 50,
  /** A FALL: what it scores, and what the difficulty adds to that. */
  fall: 5,
  fallSpan: 10,
  /** THE AMPLITUDE: points for each metre of height over the lip, to
   * `heightMost`; and points off a jump that came down short of the
   * landing — on the table or the knuckle — `short` m of flight below
   * which it did. */
  height: 1,
  heightMost: 4,
  knuckled: 8,
} as const;

/** A FLIGHT AS A TRICK (`readTrick`): the spin in degrees, a multiple of
 * 180; the whole flips and which way; whether they were thrown off axis;
 * which way it spun; switch in and out; the grabs held. */
export type TrickRead = {
  spin: number;
  /** The press he left the snow in (`butter.ts`) and how far it pivoted
   * him on the snow, degrees, to the nearest 90 — null for none. Its turn
   * is counted into `spin`. */
  butter: { end: "nose" | "tail"; wound: number } | null;
  flips: number;
  flipDir: "back" | "front" | null;
  dir: "left" | "right" | null;
  offAxis: boolean;
  switchIn: boolean;
  switchOut: boolean;
  grabs: TrickPose[];
};

/** Read a flight as the trick it was: each axis's turn to the nearest half
 * turn of spin and whole flip. */
export function readTrick(f: FlightRecord): TrickRead {
  const press = f.butter ?? null;
  const turned = f.spin + (press?.yaw ?? 0);
  const halves = Math.round(Math.abs(turned) / Math.PI);
  const flips = Math.round(Math.abs(f.flip) / TAU);
  // A butter is called by the way he rode INTO it: wound past a quarter
  // turn on the snow, he left the lip the other way round.
  const yaw = Math.abs(press?.yaw ?? 0) % TAU;
  const wound = yaw > Math.PI / 2 && yaw < 1.5 * Math.PI;
  return {
    spin: halves * 180,
    butter: press
      ? { end: press.end, wound: Math.round(Math.abs(press.yaw) / (Math.PI / 2)) * 90 }
      : null,
    flips,
    flipDir: flips === 0 ? null : f.flip > 0 ? "back" : "front",
    dir: halves === 0 ? null : turned > 0 ? "right" : "left",
    offAxis: flips > 0 && halves >= 2,
    switchIn: wound ? !f.switchIn : f.switchIn,
    switchOut: f.switchOut,
    grabs: f.grabs.slice(),
  };
}

/** HOW HARD A TRICK IS, in steps (`JUDGING`). */
export function difficultyOf(r: TrickRead): number {
  const J = JUDGING;
  return (
    r.spin / 180 +
    r.flips * J.flip +
    (r.offAxis ? J.cork : 0) +
    (r.switchIn ? J.switchIn : 0) +
    (r.grabs.length > 0 ? J.grab : 0)
  );
}

/** WHAT KIND OF TRICK IT WAS, for a final's rule that its two counted
 * jumps differ: the way it spun, or — thrown without a spin — the way it
 * flipped; a straight air is its own kind. */
export function trickKind(r: TrickRead): string {
  if (r.dir) return r.dir;
  return r.flipDir ?? "straight";
}

/** THE OVERALL IMPRESSION of one jump, 0–100, before the panel's eyes:
 * the flight read, how far the table's end it came down `table` m past
 * the lip, and whether the run went out after it (a fall on the landing
 * or the run-out is a fall). */
export function impressionOf(f: FlightRecord, table: number, out: boolean): number {
  const J = JUDGING;
  const r = readTrick(f);
  const d = Math.min(1, difficultyOf(r) / J.top);
  if (f.outcome === "fell" || out) return J.fall + J.fallSpan * d;
  let score = J.floor + J.span * d;
  score -= J.landing * Math.min(1, f.landing ?? 1);
  score += Math.min(J.heightMost, f.height * J.height);
  if (f.length < table) score -= J.knuckled;
  if (f.outcome === "sketchy") score = Math.min(J.sketchyMost, score - J.sketchy);
  return Math.max(1, Math.min(99, score));
}

/** A small, stable hash of three integers, for a judge's own eye. */
function mix(a: number, b: number, c: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (b + 0x7f4a7c15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (c + 0x165667b1), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** THE PANEL'S SCORE for an impression: six whole marks a judge's eye
 * apart, the highest and lowest dropped, the rest averaged and cut to two
 * decimals. `seed` and `jump` name the jump the eyes are dealt for. */
export function panelScore(impression: number, seed: number, jump: number): number {
  const J = JUDGING;
  const marks: number[] = [];
  for (let j = 0; j < J.judges; j++) {
    const eye = createRng(mix(seed, jump, j)).range(-J.spread, J.spread);
    marks.push(Math.max(0, Math.min(100, Math.round(impression + eye))));
  }
  marks.sort((a, b) => a - b);
  const kept = marks.slice(J.dropped, marks.length - J.dropped);
  const mean = kept.reduce((s, m) => s + m, 0) / kept.length;
  return Math.floor(mean * 100 + 1e-6) / 100;
}

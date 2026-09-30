// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R23 — THE PISTE GRADES: how hard a run is, as the colour on its signs, and
// what building one to that colour asks of the mountain under it.
//
// A piste is graded by its STEEPEST stretch, not its average, and marked by
// a colour every skier reads before the start hut: GREEN (the beginner's —
// gentle, wide, groomed), BLUE (easy, and never much over a quarter's fall
// but for a short pitch), RED (intermediate — steeper and narrower), BLACK
// (advanced — steep, often left ungroomed, the pitches past half again as
// steep as a red's). The game marks them the way the European colours are
// read with the northern signs' SHAPES on them, so a colour-blind skier
// reads the grade too: a green CIRCLE, a blue SQUARE, a red RECTANGLE and a
// black DIAMOND. The shapes are the app's (`grade-mark.tsx`); the engine
// says only which colour a map is.
//
// THE BANDS are the northern convention's, the one that states a gradient
// for every colour (the European one states a blue's and a red's ceiling
// and leaves the green to judgement): a GREEN falls at most 16 % (9°) over
// its steepest hundred metres, a BLUE at most 27 % (15°), a RED at most
// 47 % (25°), and a BLACK is anything past that, up to R8's 78 % — the
// steepest groomed pitch. They sit a little over the older European
// ceilings (25 % a blue, 40 % a red) and inside the North American ones
// (a green's 6–25 %, a blue's 25–40 %), which is where a ski area's own
// signs land in practice.
//
// A GRADE IS A ROW, like a region (R21, `regions.ts`), and the generator
// BUILDS to it — the mountain's vertical and the shape of its fall line,
// how folded the face is, how steep a walk may run and a grading may
// leave, how wide the piste is, the pitch out of the start hut, how many
// kickers stand on the line and how tall, the DROPS across it (R24, a
// black's alone), the cliffs beside it and how much of it lies ungroomed
// under a drift — and the analysis HOLDS the finished map to the colour it
// was asked for (R23), so a map billed black is black and one billed green
// is green on the one reading a piste is graded by.
//
// THE UNGRADED ROW is the generator before there were grades: every number
// the rule book's own, drawn in the same order off the same stream, and no
// drop laid — so a map built by a version from before R23 (`versions.ts`'s
// `ungraded` trait: the trick maps stand on it) is exactly the map it was.
// Its colour is only ever MEASURED (`pisteGradeOf`), never built to.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { LEVEL_RULES as R, type Band } from "./rules.ts";
import { scaleBand, type Region } from "./regions.ts";
import type { Kicker } from "./types.ts";

/** The four colours, gentlest first. */
export type PisteGrade = "green" | "blue" | "red" | "black";

/** The grades in the order a card offers them, gentlest first. */
export const PISTE_GRADES: readonly PisteGrade[] = ["green", "blue", "red", "black"];

export function isPisteGrade(value: unknown): value is PisteGrade {
  return typeof value === "string" && (PISTE_GRADES as readonly string[]).includes(value);
}

/** The fall-line shape `mountain.profile` states (R2): a shoulder under the
 * ridge, the peak, the ease to the run-out. */
export type ProfileShape = {
  readonly shoulder: number;
  readonly shoulderRun: number;
  readonly ease: number;
  readonly runout: number;
};

/** One grade's row: everything R23 lets a colour change. */
export type GradeRow = {
  /** The colour this row builds to; null on the UNGRADED row. */
  readonly id: PisteGrade | null;
  /** R23 — the band the piste's steepest `track.colourWindow` must fall in,
   * m per m: above the next gentler colour's ceiling, at most its own. */
  readonly steepest: Band;
  /** R2 — the mountain's vertical, m, before the region's share of its own
   * multiple (`verticalBand`). */
  readonly vertical: Band;
  /** R2 — the fall line's shape. */
  readonly profile: ProfileShape;
  /** R3 — multiples of the face's hills, spurs and gullies, rollers and
   * headwalls (how many, how far each drops), on top of the region's. */
  readonly relief: {
    readonly hills: number;
    readonly ridges: number;
    readonly rollers: number;
    readonly headwalls: { readonly count: number; readonly drop: number };
  };
  /** R5–R8 — the steepest ground the walk runs down (`track.steepest`), the
   * steepest a grading may leave any `gradeWindow` (`track.maxGrade`), the
   * run's width band (the finish arena still opens to R7's widest), how
   * many sweeps are held across the face, and how much steeper than the
   * untouched ground the walk reads a pitch for its bends (R6): the grading
   * cuts a steep face's rollers into a steeper line than the one the walk
   * stood on, so a black's walk budgets its turns for the line it will
   * become. */
  readonly track: {
    readonly steepest: number;
    readonly maxGrade: number;
    readonly width: Band;
    readonly sweeps: Band;
    readonly pitch: number;
    /** R5 — the piste's length band: a downhill course's, but for a green
     * and a black, which are let run a little short of it — a gentle face
     * does not fall enough across itself for the walk to spend a long
     * traverse on, and a steep one is skied more nearly down its fall line. */
    readonly length: Band;
  };
  /** R12 — the pitch out of the start hut: the steepest a window of the
   * first `spawn.run` metres may fall, and the least the run falls on the
   * whole (0: no floor). */
  readonly spawn: { readonly maxSlope: number; readonly minSlope: number };
  /** R4, R9 — kickers: how many stand on the line and a multiple of their
   * lips, the steepest pitch a lip is taken off, and a multiple of the count
   * off the piste (on top of the region's). */
  readonly kickers: {
    readonly on: Band;
    readonly height: number;
    readonly approachGrade: number;
    readonly off: number;
  };
  /** R24 — how many DROPS stand across the piste; zero but on a black. */
  readonly drops: Band;
  /** R22 — a multiple of the cliffs on the face, how many of them are stood
   * BESIDE the piste, and the least clear ground between any of them and
   * the piste's edge, m. */
  readonly cliffs: { readonly count: number; readonly beside: Band; readonly clearance: number };
  /** R17 — the share of the piste dealt to lie drifted: the ungroomed. */
  readonly drift: Band;
};

const NONE: Band = { min: 0, max: 0 };

/** THE UNGRADED ROW — the rule book's own numbers, the same objects, so a
 * map built on it draws what it drew before R23 existed. */
export const UNGRADED: GradeRow = {
  id: null,
  steepest: { min: 0, max: R.track.maxGrade },
  vertical: R.mountain.vertical,
  profile: R.mountain.profile,
  relief: { hills: 1, ridges: 1, rollers: 1, headwalls: { count: 1, drop: 1 } },
  track: {
    steepest: R.track.steepest,
    maxGrade: R.track.maxGrade,
    width: R.track.width,
    sweeps: R.track.sweeps.count,
    pitch: 1,
    length: R.track.length,
  },
  spawn: { maxSlope: R.spawn.maxSlope, minSlope: 0 },
  kickers: {
    on: R.kickers.on.count,
    height: 1,
    approachGrade: R.kickers.on.approachGrade,
    off: 1,
  },
  drops: NONE,
  cliffs: { count: 1, beside: NONE, clearance: R.cliff.clearance },
  drift: R.drift.share,
};

const B = R.grade.bands;

/** Every grade's row. */
export const GRADES: Readonly<Record<PisteGrade, GradeRow>> = {
  // GREEN — the nursery run: a low, even fall line with no headwall on it
  // and the face's folds laid nearly flat, a wide piste that wanders across
  // the slope to hold its pitch, one or two little rolls, a gentle push out
  // of the start, and the groomer over nearly all of it.
  green: {
    id: "green",
    steepest: { min: 0, max: B.green },
    vertical: { min: 300, max: 380 },
    profile: { shoulder: 0.85, shoulderRun: 0.15, ease: 0.3, runout: 0.55 },
    relief: { hills: 0.3, ridges: 0.25, rollers: 0.25, headwalls: { count: 0, drop: 0 } },
    track: {
      steepest: 0.13,
      maxGrade: 0.19,
      width: { min: 32, max: 40 },
      sweeps: { min: 2, max: 3 },
      pitch: 1,
      length: { min: 2500, max: R.track.length.max },
    },
    spawn: { maxSlope: 0.12, minSlope: 0 },
    kickers: { on: { min: 0, max: 2 }, height: 0.6, approachGrade: 0.16, off: 0.35 },
    drops: NONE,
    cliffs: { count: 0.5, beside: NONE, clearance: 40 },
    drift: { min: 0, max: 0.1 },
  },
  // BLUE — an easy run: a quarter's fall at most, gentle folds and small
  // rolls, wide, a few low kickers, a mostly groomed line.
  blue: {
    id: "blue",
    steepest: { min: B.green, max: B.blue },
    vertical: { min: 470, max: 580 },
    profile: { shoulder: 0.6, shoulderRun: 0.2, ease: 0.6, runout: 0.35 },
    relief: { hills: 0.5, ridges: 0.45, rollers: 0.5, headwalls: { count: 0.5, drop: 0.4 } },
    track: {
      steepest: 0.22,
      maxGrade: 0.31,
      width: { min: 26, max: 40 },
      sweeps: { min: 1, max: 3 },
      pitch: 1,
      length: R.track.length,
    },
    spawn: { maxSlope: 0.2, minSlope: 0 },
    kickers: { on: { min: 1, max: 3 }, height: 0.8, approachGrade: 0.27, off: 0.8 },
    drops: NONE,
    cliffs: { count: 0.8, beside: NONE, clearance: 30 },
    drift: { min: 0, max: 0.2 },
  },
  // RED — the intermediate run, a downhill course's pitch: the rule book's
  // folds and rollers, headwalls, the full band of kickers, narrower, and a
  // drift or two.
  red: {
    id: "red",
    steepest: { min: B.blue, max: B.red },
    vertical: { min: 640, max: 780 },
    profile: { shoulder: 0.4, shoulderRun: 0.25, ease: 0.9, runout: 0.22 },
    relief: { hills: 0.8, ridges: 0.8, rollers: 1, headwalls: { count: 1, drop: 0.8 } },
    track: {
      steepest: 0.4,
      maxGrade: 0.55,
      width: { min: 22, max: 40 },
      sweeps: { min: 1, max: 3 },
      pitch: 1.05,
      length: R.track.length,
    },
    spawn: { maxSlope: 0.25, minSlope: 0 },
    kickers: { on: { min: 3, max: 6 }, height: 1, approachGrade: 0.4, off: 1 },
    drops: NONE,
    cliffs: { count: 1, beside: { min: 0, max: 1 }, clearance: 16 },
    drift: { min: 0.05, max: 0.4 },
  },
  // BLACK — the advanced run, and FAST: steep from the start hut down (the
  // fall line's peak right under the ridge, the hut's own pitch half as
  // steep again as a blue's), a big vertical, headwalls, tall rollers,
  // DROPS across the line (R24), more and taller kickers, cliffs stood
  // right beside the piste to be dropped off, a narrower line and a good
  // part of it left ungroomed under the drifts.
  black: {
    id: "black",
    steepest: { min: B.red, max: R.track.maxGrade },
    vertical: { min: 980, max: 1160 },
    profile: { shoulder: 1, shoulderRun: 0.08, ease: 1.5, runout: 0.12 },
    relief: { hills: 1.1, ridges: 1.2, rollers: 1.6, headwalls: { count: 1.6, drop: 1.4 } },
    track: {
      steepest: 0.72,
      maxGrade: 0.78,
      width: { min: 20, max: 34 },
      sweeps: { min: 1, max: 2 },
      pitch: 1.2,
      length: { min: 2800, max: R.track.length.max },
    },
    spawn: { maxSlope: 0.6, minSlope: 0.3 },
    kickers: { on: { min: 4, max: 9 }, height: 1.3, approachGrade: 0.62, off: 1.6 },
    drops: { min: 2, max: 5 },
    cliffs: { count: 2, beside: { min: 3, max: 5 }, clearance: 5 },
    drift: { min: 0.1, max: 0.35 },
  },
};

/** The row for a grade, the UNGRADED one for none. */
export function gradeRow(id: PisteGrade | null | undefined): GradeRow {
  return (id && GRADES[id]) || UNGRADED;
}

/** The row a map was BUILT to — the ungraded one for a map from before R23
 * or a hand-built one. Ask this, never `Level.grade`. */
export function gradeRowOf(level: { grade?: PisteGrade }): GradeRow {
  return gradeRow(level.grade);
}

/** R8, R23 — the colour a piste whose steepest `colourWindow` falls at
 * `steepest` m per m is signed with: the MEASURED grade. */
export function pisteGradeOf(steepest: number): PisteGrade {
  return steepest <= B.green
    ? "green"
    : steepest <= B.blue
      ? "blue"
      : steepest <= B.red
        ? "red"
        : "black";
}

/** What a colour is read off: the piste, and its kickers. */
type Graded = {
  track: { points: readonly { y: number; s: number }[]; length: number };
  kickers?: readonly Pick<Kicker, "onTrack" | "trick" | "s" | "ramp" | "landing">[];
};

/** The steepest `track.colourWindow` of a piste, m per m — what a colour
 * is read off (R8), kickers and drops and all but for a terrain park's
 * (R20): a park's dug landing is a jump built on the piste for a tricks
 * run, not the pitch the piste is signed by. */
export function steepestSpan(level: Graded): number {
  const pts = level.track.points;
  const n = pts.length;
  if (n < 2) return 0;
  const step = level.track.length / (n - 1);
  const span = Math.max(1, Math.round(R.track.colourWindow / step));
  const park = (level.kickers ?? [])
    .filter((k) => k.onTrack && k.trick)
    .map((k) => [(k.s ?? 0) - k.ramp, (k.s ?? 0) + k.landing] as const);
  let steepest = 0;
  for (let i = 0; i + span < n; i++) {
    const a = pts[i].s;
    const b = pts[i + span].s;
    if (park.length > 0 && park.some(([from, to]) => a < to && b > from)) continue;
    steepest = Math.max(steepest, (pts[i].y - pts[i + span].y) / (span * step));
  }
  return steepest;
}

/** THE COLOUR ON A MAP'S SIGNS: the grade it was built to (R23) or, on a map
 * from before the grades, the one its steepest stretch measures. What the
 * app marks the piste with. */
export function gradeOf(level: Graded & { grade?: PisteGrade }): PisteGrade {
  return level.grade ?? pisteGradeOf(steepestSpan(level));
}

/** R2, R23 — the band a map's vertical is dealt from: the rule book's
 * scaled by the region's multiple on the ungraded row (the same band at one,
 * R21), and on a graded one the grade's own, scaled by `grade.regionShare`
 * of the region's multiple — a fell's green is a little lower than an
 * alpine's, but a green all the same. */
export function verticalBand(region: Region, grade: GradeRow): Band {
  const k = region.relief.vertical;
  if (grade.id === null) return scaleBand(grade.vertical, k);
  return scaleBand(grade.vertical, 1 + (k - 1) * R.grade.regionShare);
}

/** Salt on the seed for the grade's own stream. */
const GRADE_SALT = 0x6a7ade5;

/** R23 — THE GRADE A SEED DEALS when nobody asked for one, off a stream of
 * its own (the seed, salted — never an attempt's, so every attempt of one
 * seed builds to the same colour) at the odds in `grade.odds`. */
export function dealGrade(seed: number): PisteGrade {
  const rng = createRng((seed ^ GRADE_SALT) >>> 0);
  const u = rng.next();
  let acc = 0;
  for (const id of PISTE_GRADES) {
    acc += R.grade.odds[id];
    if (u < acc) return id;
  }
  return PISTE_GRADES[PISTE_GRADES.length - 1];
}

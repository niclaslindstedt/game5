// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// MAP RATING — how HARD a map is, and what KIND of hard.
//
// `engine/analysis/` asks whether a map is BROKEN, and the generator will
// not hand one out that is. This asks the question that starts where that
// one stops: of two maps that both pass every rule, which asks more of the
// skier, and what does it ask for — the pitch, the bends, the air, the
// trees, the traverses, the powder, the sky, the sheer length of the run? A
// campaign is a LADDER of those answers, and it is built out of this module
// rather than out of the analyzer, because "no rule broken" says nothing
// about whether the second rung asks more than the first.
//
// EIGHT AXES, each 0..1 and none of them better than another. Seven are the
// MAP's and are read off the level (how steep the piste falls, the bends,
// the kickers, the woods walling the line, the traverses across the face,
// the drifts across it, and how long the run is); one is the DAY's and is
// read off what the run is skied in (the dark and the sky, folded into
// one) — because an hour and a weather are the cheapest levers a campaign
// has, they cost nothing that has to be re-verified, and a ladder that
// ignores them wastes a part of its climb. `difficulty` folds the eight
// into one number on the weights in `RATING`.
//
// THE LENGTH AXIS IS A MEASUREMENT WHEN THERE IS ONE. What a competent
// skier takes from the gate to the finish is the bot's run (`simulateRun`),
// which costs a second of simulation and so is not taken here: a caller
// that has one hands it in (`RateOptions.runSeconds` — `make rate --sim`
// does, and `make rate CAMPAIGN=1` always does), and one that has not is
// given the piste's length at the pace the bot averages across a sweep.
// Both are SECONDS, so the axis means the same thing either way; the
// measurement is only the better reading of it.
//
// The CHARACTER is the axes themselves, and a ladder is read off them as
// much as off the index: six maps that all lead on the pitch are the same
// map six times, however well they climb. `scripts/rate-level.mjs` prints
// both, and `scripts/difficulty-preview.mjs` draws the axes over the plan.
//
// Every scale here is a NORMALISER, not a rule: the band a raw measurement
// is laid across to land the population's spread in 0..1. They are read
// off a sweep (`make rate COUNT=96 ARGS=--stats`) and are meant to be
// moved when the generator moves: an axis pinned at 1 or 0 for most of a
// sweep is measuring nothing.

import { treesNear } from "../game/collision.ts";
import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { sunAt } from "@niclaslindstedt/oss-game-framework/core/solar";
import { gradeOf, type PisteGrade } from "../mapgen/grades.ts";
import { LEVEL_RULES } from "../mapgen/rules.ts";
import { declinationOf } from "../mapgen/sun.ts";
import { weatherOf, withSky } from "../mapgen/weather.ts";
import type { Level, SkyOverride, TrackPoint, Weather } from "../mapgen/types.ts";

/** The eight axes, 0..1 each — see the header. */
export type RatingAxes = {
  /** How steeply the piste falls: its mean grade, and the steepest
   * hundred metres of it. */
  steepness: number;
  /** How much the line asks of the edges: how much of it is bent tight,
   * and the heading change per km. */
  bends: number;
  /** How much air the piste throws: lip height on the line and the height
   * of every drop across it (R24), per km. */
  air: number;
  /** How close the woods stand: the share of the piste with a trunk inside
   * `WALL_REACH` of either edge — a line walled by trees is a line where a
   * turn held wide meets bark. */
  woods: number;
  /** How much of the piste is a traverse across the face rather than a
   * run down it: the share held more than `TRAVERSE` off the fall line,
   * and the longest single traverse. */
  traverses: number;
  /** How much of the piste is drifted over (R17): the share of it under a
   * drift, and the longest single stretch of powder. */
  powder: number;
  /** How hard the day is to see in: the dark (0 with the sun high, 1 with
   * it under the horizon — an evening map, R19) and the sky (a clear day
   * nothing, a blizzard or a thick fog the whole, `skyWeight`), folded
   * half and half. */
  weather: number;
  /** How long the run takes a competent skier: the bot's run when
   * measured, the piste's length at `RATING.scale.pace` when not, across
   * `RATING.scale.run`. */
  length: number;
};

export type MapRating = {
  seed: number;
  axes: RatingAxes;
  /** The one number the ladder climbs on — the weighted fold of the axes. */
  difficulty: number;
  /** The raw readings the axes were made from, for the table. */
  stats: {
    /** The piste's length, m. */
    length: number;
    /** The run's seconds, as the length axis read them. */
    runSeconds: number;
    /** Whether `runSeconds` is the bot's measurement or the estimate. */
    measured: boolean;
    /** The piste's mean grade, drop over length, m per m. */
    meanGrade: number;
    /** The steepest `STEEP_SPAN` metres of the piste, m per m. */
    steepest: number;
    /** The tightest local radius on the piste, m. */
    tightest: number;
    /** Share of the piste bent tighter than `TIGHT_FLOORS` × R6's floor. */
    tight: number;
    /** Heading change per kilometre, rad/km. */
    sweepPerKm: number;
    /** Kickers on the piste, and the sum of their lips, m. */
    kickers: number;
    lips: number;
    /** Drops across the piste (R24), and the sum of their heights, m. */
    drops: number;
    dropped: number;
    /** The colour on the map's signs (R23, `gradeOf`). */
    grade: PisteGrade;
    /** Share of the piste walled by trees, 0..1. */
    walled: number;
    /** Share of the piste held across the face, and the longest traverse, m. */
    traversed: number;
    longestTraverse: number;
    /** Share of the piste under a drift, and the longest drift, m. */
    drifted: number;
    longestDrift: number;
    /** The sun's elevation at the start, degrees. */
    sunDeg: number;
    /** The sky the run is skied under. */
    weather: Weather["kind"];
  };
};

/** The rating's own numbers: the normalisers and the weights. */
export const RATING = {
  /** Each raw reading's BAND: the value that reads as nothing on its axis
   * and the value that reads as all of it, off the sweep's tails. Read off
   * a sweep of the first ninety-six alpine seeds (`make rate COUNT=96
   * ARGS=--stats`) with the bot's pace off `make sim` — every grade in it,
   * green to black (R23), so the pitch reads from a nursery run's to a
   * black's and a green shelf rates under a black one, which is the
   * ladder. */
  scale: {
    /** m/s a competent skier averages down a piste — what a run is
     * estimated at when nobody measured it: the bot's mean off `make sim`. */
    pace: 12.5,
    /** A run's seconds: a three-kilometre piste to a four-and-a-half at
     * that pace. */
    run: { min: 220, max: 360 },
    /** The mean grade, drop over length: a green's tenth to a black's
     * third. */
    meanGrade: { min: 0.08, max: 0.34 },
    /** The steepest hundred metres: from a green's pitch to R8's ceiling. */
    steepest: { min: 0.12, max: 0.78 },
    /** The share of the piste bent tighter than `TIGHT_FLOORS` × R6's
     * floor — the walk's turn is capped, so every piste's tightest bend
     * sits at the floor and the SHARE is what tells a twisting piste from
     * a sweeping one: the sweep runs 0.18 to 0.54. */
    tight: { min: 0.1, max: 0.55 },
    /** rad/km of heading change: the sweep runs 10 to 21. */
    sweepPerKm: { min: 9, max: 21 },
    /** m of lip and drop on the piste per km: a green's lone roll to a
     * black's kickers and drops. */
    lipsPerKm: { min: 0.3, max: 6 },
    /** Share of the piste walled by trees. */
    walled: { min: 0.05, max: 0.6 },
    /** Share of the piste held across the face, and the longest traverse, m. */
    traversed: { min: 0.15, max: 0.65 },
    longestTraverse: { min: 60, max: 320 },
    /** Share of the piste drifted (R17 deals up to half of it), and the
     * longest stretch, m (R17's band tops at 180). */
    drifted: { min: 0, max: 0.45 },
    longestDrift: { min: 60, max: 180 },
    /** Degrees of sun above the horizon below which the day starts to read
     * as dark; a winter noon at the band's southern edge is about thirty. */
    sunHigh: 20,
  },
  /** How the eight fold into one: the map about seven eighths, the day
   * about one eighth. */
  weight: {
    steepness: 0.16,
    bends: 0.14,
    air: 0.12,
    woods: 0.12,
    traverses: 0.1,
    powder: 0.12,
    weather: 0.12,
    length: 0.12,
  } satisfies Record<keyof RatingAxes, number>,
} as const;

/** Where `value` sits in `band`, 0..1. */
function across(value: number, band: { min: number; max: number }): number {
  return clamp((value - band.min) / (band.max - band.min), 0, 1);
}

export const RATING_AXES: readonly (keyof RatingAxes)[] = [
  "steepness",
  "bends",
  "air",
  "woods",
  "traverses",
  "powder",
  "weather",
  "length",
];

/** Stations (2 m apart) either side of a point a bend is read over: a
 * twenty-metre chord each way, about what a skier spends turning in. */
const CORNER_SPAN = 10;

/** A radius under this many of R6's least radius is a BEND, not a sweep. */
const TIGHT_FLOORS = 2.5;

/** Stations between two the woods and the traverses are read at: 10 m. */
const STRIDE = 5;

/** Stations the steepest stretch is read over: 100 m. */
const STEEP_SPAN = 50;

/** A heading this far off the fall line, rad, is a traverse. */
const TRAVERSE = Math.PI / 4;

/** m past the piste's edge a trunk counts as WALLING it: the clear corridor
 * R14 keeps, and a turn's width of woods beyond it. */
export const WALL_REACH = LEVEL_RULES.forest.corridor + 6;

/** How heavy a sky reads, 0..1: a lid a little, a fall and a fog by how
 * thick they are. */
export function skyWeight(weather: Weather): number {
  switch (weather.kind) {
    case "clear":
      return 0;
    case "fair":
      return 0.1;
    case "flurries":
      return 0.1 + 0.5 * weather.snowfall;
    case "high":
      return 0.2;
    case "overcast":
      return 0.4;
    case "snow":
      return 0.35 + 0.65 * weather.snowfall;
    case "storm":
      return 0.5 + 0.5 * weather.snowfall;
    case "fog":
      return 0.3 + 0.7 * weather.fog;
  }
}

function circumradius(a: TrackPoint, b: TrackPoint, c: TrackPoint): number {
  const ab = hypot(b.x - a.x, b.z - a.z);
  const bc = hypot(c.x - b.x, c.z - b.z);
  const ca = hypot(a.x - c.x, a.z - c.z);
  const area2 = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
  return area2 < 1e-9 ? Infinity : (ab * bc * ca) / (2 * area2);
}

/** The local radius of the piste at station `i`, read over `CORNER_SPAN`
 * stations either side (the ends held). Infinity on a straight. */
export function cornerRadius(points: readonly TrackPoint[], i: number): number {
  const n = points.length;
  return circumradius(
    points[Math.max(0, i - CORNER_SPAN)],
    points[i],
    points[Math.min(n - 1, i + CORNER_SPAN)],
  );
}

/** What a caller may hand the rating beyond the map. */
export type RateOptions = {
  /** The sky and hour the run is skied under instead of the map's own
   * (`withSky`) — a campaign rung's pinned day. */
  sky?: SkyOverride;
  /** The run as the bot skied it, s — the measurement the length axis
   * prefers. */
  runSeconds?: number;
};

/** THE RATING of one map, skied under its own day or the one `opts.sky`
 * pins. Pure and cheap — tens of milliseconds — so a sweep of a hundred
 * seeds costs what building them costs. */
export function rateLevel(built: Level, opts: RateOptions = {}): MapRating {
  const level = opts.sky ? withSky(built, opts.sky) : built;
  const points = level.track.points;
  const n = points.length;
  const length = level.track.length;
  const km = Math.max(0.1, length / 1000);
  const step = n > 1 ? length / (n - 1) : LEVEL_RULES.track.step;

  // THE CLOCK: the bot's run, or the piste at the sweep's pace.
  const measured = opts.runSeconds !== undefined && Number.isFinite(opts.runSeconds);
  const runSeconds = measured ? (opts.runSeconds as number) : length / RATING.scale.pace;

  // THE PITCH: the drop over the whole run, and the steepest hundred
  // metres of it.
  const meanGrade = n > 1 ? (points[0].y - points[n - 1].y) / length : 0;
  let steepest = 0;
  for (let i = 0; i + STEEP_SPAN < n; i += STRIDE) {
    const g = (points[i].y - points[i + STEEP_SPAN].y) / (STEEP_SPAN * step);
    if (g > steepest) steepest = g;
  }

  // THE BENDS: how much of the piste is bent tighter than the floor, and
  // how far the heading turns a kilometre — two readings, because they
  // catch different maps: hairpins joined by straights, and a line that
  // never stops turning.
  let tightLength = 0;
  let tightest = Infinity;
  let sweep = 0;
  for (let i = 0; i < n; i++) {
    const r = cornerRadius(points, i);
    tightest = Math.min(tightest, r);
    if (r < TIGHT_FLOORS * LEVEL_RULES.track.minRadius) tightLength += step;
    if (i + 1 < n) sweep += Math.abs(angleDiff(points[i].heading, points[i + 1].heading));
  }
  const tight = tightLength / length;
  const sweepPerKm = sweep / km;

  // THE AIR: the lips on the piste. A kicker off it is a detour a skier may
  // take and never has to.
  const onTrack = (level.kickers ?? []).filter((k) => k.onTrack);
  const lips = onTrack.reduce((sum, k) => sum + k.height, 0);
  const drops = (level.cliffs ?? []).filter((c) => c.onTrack);
  const dropped = drops.reduce((sum, c) => sum + c.drop, 0);

  // THE WOODS: at every ten-metre station, is there a trunk inside the reach
  // past each edge? Half a point for each side walled. And THE TRAVERSES:
  // how much of the line is held across the face, and the longest.
  const near: number[] = [];
  let walledSum = 0;
  let stations = 0;
  let traversed = 0;
  let longestTraverse = 0;
  let run = 0;
  for (let i = 0; i < n; i += STRIDE) {
    const p = points[i];
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    let left = false;
    let right = false;
    treesNear(level, p.x, p.z, p.width / 2 + WALL_REACH, near);
    for (const t of near) {
      const tree = level.trees[t];
      const side = (tree.x - p.x) * rx + (tree.z - p.z) * rz;
      if (side > 0) right = true;
      else left = true;
      if (left && right) break;
    }
    walledSum += (left ? 0.5 : 0) + (right ? 0.5 : 0);
    stations += 1;
    if (Math.abs(p.heading) > TRAVERSE) {
      traversed += 1;
      run += STRIDE * step;
      longestTraverse = Math.max(longestTraverse, run);
    } else run = 0;
  }
  const walled = stations > 0 ? walledSum / stations : 0;
  const traverseShare = stations > 0 ? traversed / stations : 0;

  // THE POWDER: how much of the piste the drifts lie over, and the longest.
  let drifts = 0;
  let longestDrift = 0;
  for (const d of level.drifts ?? []) {
    drifts += d.to - d.from;
    longestDrift = Math.max(longestDrift, d.to - d.from);
  }
  const drifted = drifts / length;

  // THE DAY: the sun where the run starts, and the sky over it.
  const sun = sunAt(level.sun.hour, level.sun.latitude, declinationOf(level.sun.dayOfYear));
  const sunDeg = (sun.elevation * 180) / Math.PI;
  const weather = weatherOf(level);
  const dark = clamp(1 - sunDeg / RATING.scale.sunHigh, 0, 1);
  const sky = clamp(skyWeight(weather), 0, 1);

  const S = RATING.scale;
  const axes: RatingAxes = {
    steepness: 0.5 * across(meanGrade, S.meanGrade) + 0.5 * across(steepest, S.steepest),
    bends: 0.5 * across(tight, S.tight) + 0.5 * across(sweepPerKm, S.sweepPerKm),
    air: across((lips + dropped) / km, S.lipsPerKm),
    woods: across(walled, S.walled),
    traverses:
      0.5 * across(traverseShare, S.traversed) + 0.5 * across(longestTraverse, S.longestTraverse),
    powder: 0.5 * across(drifted, S.drifted) + 0.5 * across(longestDrift, S.longestDrift),
    weather: 0.5 * dark + 0.5 * sky,
    length: across(runSeconds, S.run),
  };
  let difficulty = 0;
  for (const axis of RATING_AXES) difficulty += axes[axis] * RATING.weight[axis];

  return {
    seed: level.seed,
    axes,
    difficulty,
    stats: {
      length,
      runSeconds,
      measured,
      meanGrade,
      steepest,
      tightest,
      tight,
      sweepPerKm,
      kickers: onTrack.length,
      lips,
      drops: drops.length,
      dropped,
      grade: gradeOf(level),
      walled,
      traversed: traverseShare,
      longestTraverse,
      drifted,
      longestDrift,
      sunDeg,
      weather: weather.kind,
    },
  };
}

/** Which axis a map LEADS on — the one word its character is read as, for a
 * table and a campaign box. */
export function leadingAxis(axes: RatingAxes): keyof RatingAxes {
  let best: keyof RatingAxes = RATING_AXES[0];
  for (const axis of RATING_AXES) if (axes[axis] > axes[best]) best = axis;
  return best;
}

/** How UNLIKE two maps are: the distance between their axes, 0 for the same
 * map twice, about 1 for two that lead on different things. */
export function characterDistance(a: RatingAxes, b: RatingAxes): number {
  let sum = 0;
  for (const axis of RATING_AXES) sum += (a[axis] - b[axis]) ** 2;
  return Math.sqrt(sum / RATING_AXES.length) * 2;
}

/** What a LADDER of ratings does, read in the order the rungs are played:
 * does it climb, is there a wall, are two rungs the same map twice. Each is
 * a number a curator reads; a note names the rung when one is wrong. */
export type LadderReport = {
  /** The difficulty of each rung, in order. */
  asks: number[];
  /** The smallest step up between neighbours — negative where it steps
   * DOWN. */
  climb: number;
  /** The biggest step up between neighbours — a wall past `LADDER.wall`. */
  wall: number;
  /** The character distance of the two most alike rungs. */
  apart: number;
  notes: string[];
};

export const LADDER = {
  /** A step between rungs smaller than this is one a skier cannot feel. */
  step: 0.005,
  /** A step bigger than this is a wall. */
  wall: 0.2,
  /** Two rungs closer than this in character are the same map twice. */
  apart: 0.15,
} as const;

export function rateLadder(rungs: readonly { name: string; rating: MapRating }[]): LadderReport {
  const asks = rungs.map((r) => r.rating.difficulty);
  const notes: string[] = [];
  let climb = Infinity;
  let wall = -Infinity;
  for (let i = 1; i < rungs.length; i++) {
    const step = asks[i] - asks[i - 1];
    climb = Math.min(climb, step);
    wall = Math.max(wall, step);
    if (step < LADDER.step) {
      notes.push(
        `${rungs[i].name} asks ${step < 0 ? "less" : "no more"} than ${rungs[i - 1].name} (${step.toFixed(3)})`,
      );
    } else if (step > LADDER.wall) {
      notes.push(`${rungs[i].name} is a wall after ${rungs[i - 1].name} (+${step.toFixed(3)})`);
    }
  }
  let apart = Infinity;
  for (let i = 0; i < rungs.length; i++) {
    for (let k = i + 1; k < rungs.length; k++) {
      const d = characterDistance(rungs[i].rating.axes, rungs[k].rating.axes);
      if (d < apart) apart = d;
      if (d < LADDER.apart) {
        notes.push(
          `${rungs[i].name} and ${rungs[k].name} are the same map twice (${d.toFixed(2)})`,
        );
      }
    }
  }
  return {
    asks,
    climb: rungs.length > 1 ? climb : 0,
    wall: rungs.length > 1 ? wall : 0,
    apart: rungs.length > 1 ? apart : 1,
    notes,
  };
}

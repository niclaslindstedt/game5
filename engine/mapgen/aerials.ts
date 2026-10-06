// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R44 — AN AERIALS SITE BUILT OVER A BUILT MAP. As R37's big air jump is
// pushed up out of a mountain's side, an aerials site is shaped STRAIGHT
// down the face: a start platform, an in-run at 23°, a level TABLE with
// ONE steep KICKER on it — the single, the double or the triple, the one
// the declared jump is assigned — the KNOLL at the table's end, a 37°
// LANDING HILL and a level out-run.
//
// THE PROFILE IS DESIGNED, then FITTED, as the big air jump's: drawn
// against the horizontal with the venue pen (`straight-venue.ts`), its
// in-run as long as brings a tucked skier to the kicker's lip at its row's
// speed (`lipSpeed`, down the profile itself), then dropped onto the line
// of the face where it cuts and fills least.
//
// THE SURFACE IS ANALYTIC. A kicker curved to 71° on six metres of radius
// is far finer than the 2 m grid a map is baked on — on the grid it would
// be a bump — so the site answers `groundAt` and `normalAt` off its own
// profile inside its width, as a moguls course does (`withMoguls`, a field
// with no mogul line down it), and the grid under it is cut to the same
// surface, never above it. The renderer lays that surface as its own mesh
// (`mogul-view.ts`).
//
// Pure, drawing nothing from any stream — no digest moves and a restart
// stands on the very site it left.

import { AERIALS_RULE } from "./trick-rules.ts";
import { lipSpeed } from "./big-air.ts";
import { createPen, gradeVenue, jumpHeightAt, originalOf } from "./straight-venue.ts";
import { withMoguls, type MogulField } from "./mogul-field.ts";
import type { AerialKicker, AerialsCourse, Checkpoint, Kicker, Level, Spawn } from "./types.ts";

const R = AERIALS_RULE;
const RAD = Math.PI / 180;

/** THE SITE'S PROFILE: its height every `dx` m of plan from the platform's
 * back (`y`, the lip at 0), and where its parts begin, m of plan. */
export type AerialsProfile = {
  dx: number;
  y: Float64Array;
  gate: number;
  table: number;
  foot: number;
  lip: number;
  knoll: number;
  landing: number;
  outrun: number;
  finish: number;
  end: number;
  /** The lip's height over the table, m. */
  height: number;
};

/** The pen's step, m of plan: fine, because a kicker turned to 71° on
 * six metres climbs three quarters of a metre on a coarser step and the
 * lip would stand a metre over the curve's own height. */
const PEN_STEP = 0.05;

/** The profile with an in-run `run` m long at its full angle, for
 * `kicker`. */
function shape(run: number, kicker: AerialKicker): AerialsProfile {
  const K = R.kickers[kicker];
  const pen = createPen(PEN_STEP);
  pen.straight(R.platform, 0);
  const gate = pen.x;
  pen.bend(R.inRun * RAD, R.roll);
  pen.straight(run, R.inRun * RAD);
  pen.bend(0, R.toFlat);
  const table = pen.x;
  pen.straight(R.flat, 0);
  const foot = pen.x;
  const yTable = pen.y;
  pen.bend(-K.kick * RAD, K.radius);
  const lip = pen.x;
  const yLip = pen.y;
  // THE KICKER'S BACK, down to the table again.
  const back = R.back * RAD;
  while (pen.y > yTable + 1e-6) pen.step(back);
  pen.y = yTable;
  pen.ys[pen.ys.length - 1] = yTable;
  const knoll = lip + K.table;
  pen.straight(Math.max(0, knoll - pen.x), 0);
  pen.bend(R.steepest * RAD, R.knoll);
  pen.straight(R.slope, R.steepest * RAD);
  const landing = pen.x;
  pen.bend(R.outrun.grade * RAD, R.round);
  const outrun = pen.x;
  pen.straight(R.outrun.length, R.outrun.grade * RAD);
  return {
    dx: pen.dx,
    y: Float64Array.from(pen.ys, (v) => v - yLip),
    gate,
    table,
    foot,
    lip,
    knoll,
    landing,
    outrun,
    finish: outrun + R.finish,
    end: pen.x,
    height: yLip - yTable,
  };
}

const designed = new Map<AerialKicker, AerialsProfile>();

/** THE SITE (R44) with `kicker`, as designed: the in-run's length found so
 * the rule's skier reaches the lip at the kicker's speed. The same on
 * every map. */
export function aerialsProfile(kicker: AerialKicker = "triple"): AerialsProfile {
  const had = designed.get(kicker);
  if (had) return had;
  const speed = R.kickers[kicker].speed;
  let lo = 2;
  let hi = 200;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (lipSpeed(shape(mid, kicker), R) < speed) lo = mid;
    else hi = mid;
  }
  const p = shape(hi, kicker);
  designed.set(kicker, p);
  return p;
}

/** The site's height `x` m of plan along it, m (the lip at 0). */
export function aerialsHeightAt(p: AerialsProfile, x: number): number {
  return jumpHeightAt(p, x);
}

const built = new Map<AerialKicker, WeakMap<Level, Level>>();

/** R44 — AN AERIALS SITE BUILT OVER `level` with `kicker`: the site shaped
 * down the face as the map's own `track`, its checkpoints the start gate
 * and the finish line, its spawn the start platform, its kicker the map's
 * one kicker (`AE`) and its surface the map's ground inside its width. A
 * map already carrying the site with that kicker is that map; one carrying
 * any other course is built over the map under it. Kept per map and
 * kicker; the site keeps the day and the sky of the map it was built
 * over. */
export function setAerials(level: Level, kicker: AerialKicker = "triple"): Level {
  if (level.aerials?.kicker === kicker) return level;
  const original = originalOf(level);
  let kept = built.get(kicker);
  if (!kept) {
    kept = new WeakMap();
    built.set(kicker, kept);
  }
  let site = kept.get(original);
  if (!site) {
    site = buildOver(original, kicker);
    kept.set(original, site);
  }
  return site.sun === level.sun && site.weather === level.weather
    ? site
    : { ...site, sun: level.sun, weather: level.weather };
}

/** The site over `original`, a map with no course on it. */
function buildOver(original: Level, kicker: AerialKicker): Level {
  const p = aerialsProfile(kicker);
  const K = R.kickers[kicker];
  const v = gradeVenue(original, p, R, ({ fit, fx, fz, yAt }): Kicker[] => [
    {
      id: "AE",
      x: fit.x + fx * p.lip,
      z: fit.z + fz * p.lip,
      y: yAt(p.lip),
      heading: fit.heading,
      height: p.height,
      ramp: p.lip - p.foot,
      landing: p.landing - p.lip,
      width: 4,
      onTrack: true,
      s: p.lip,
      trick: true,
    },
  ]);
  const { fit, fx, fz, yAt, level } = v;
  const across = (s: number, width: number): Checkpoint => ({
    x: fit.x + fx * s,
    z: fit.z + fz * s,
    y: yAt(s),
    heading: fit.heading,
    width,
    s,
    colour: "red",
  });
  const start = across(p.gate, 6);
  const finish = across(p.finish, R.width);
  const spawn: Spawn = {
    x: fit.x + fx * (p.gate - 2),
    z: fit.z + fz * (p.gate - 2),
    heading: fit.heading,
  };
  // THE SURFACE: the profile itself across the site's width — a field
  // with no mogul line down it.
  const field: MogulField = {
    x: fit.x,
    z: fit.z,
    heading: fit.heading,
    yAt,
    half: R.width / 2,
    end: p.end,
    lines: [],
    from: 0,
    to: 0,
    gaps: [],
    spacing: 1,
    height: 0,
    wave: 1,
    ease: 1,
  };
  const course: AerialsCourse = {
    base: original,
    kicker,
    from: p.gate,
    to: p.finish,
    vertical: start.y - finish.y,
    table: p.table,
    foot: p.foot,
    lip: p.lip,
    knoll: p.knoll,
    landing: p.landing,
    outrun: p.outrun,
    height: p.height,
    kick: K.kick * RAD,
    slope: R.steepest * RAD,
    speed: K.speed,
    width: R.width,
    yAt,
  };
  return {
    ...withMoguls(level, field),
    checkpoints: [start, finish],
    spawn,
    grid: [spawn],
    aerials: course,
  };
}

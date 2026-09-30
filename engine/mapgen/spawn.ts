// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R11–R13 — WHERE THE RUN STARTS: the start under the summit ridge, the
// start line the skiers stand on, the start gate ahead of them, and the
// gates down the piste to the finish.
//
// The run opens ON the groomer, at the top. The start is not searched for
// on a finished line the way a loop's would be: it is the piste's ORIGIN —
// the walk (track.ts) begins there and everything is measured down from
// it. What is searched for is the HEADING out of the gate: a start on a
// shoulder under the ridge is only fair if the first stretch runs straight
// and no steeper than a skier can hold out of a standing start, so the
// start tries the fall line first and then headings further and further
// across it, and takes the first the untouched ground answers.

import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import {
  sampleField,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { UNGRADED, type GradeRow } from "./grades.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import { trackPointAt, type HasTrack } from "./query.ts";
import type { Checkpoint, Spawn } from "./types.ts";

/** The headings tried out of the start, rad off the fall line, in order:
 * the fall line, then each side of it wider and wider. */
const START_HEADINGS = [0, 0.35, 0.7, 1.0, 1.2];

/** How many places under the ridge an attempt tries before it gives up on
 * its mountain: each a seeded x, the first the one R12 names. */
const START_TRIES = 4;

/** The most the untouched ground may climb over a window of the start's
 * run, m per m: a roller's back the grading (R8) cuts through, never a
 * hill. */
const START_CLIMB = 0.08;

/** How far over a grade's floor under the start (R23) the untouched ground
 * must fall for the graded line to keep it: the grading's envelopes and
 * blur take a little off a pitch. */
const START_FLOOR = 1.15;

/** The fall of the untouched ground along a heading from a point, m per m,
 * read over `run` metres and reported as the steepest and the gentlest
 * `track.gradeWindow` of it. */
export function fallAlong(
  ground: Heightfield,
  x: number,
  z: number,
  heading: number,
  run: number,
): { steepest: number; gentlest: number } {
  const w = R.track.gradeWindow;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  let steepest = -Infinity;
  let gentlest = Infinity;
  for (let d = 0; d + w <= run + 1e-9; d += w / 2) {
    const a = sampleField(ground, x + fx * d, z + fz * d);
    const b = sampleField(ground, x + fx * (d + w), z + fz * (d + w));
    const fall = (a - b) / w;
    if (fall > steepest) steepest = fall;
    if (fall < gentlest) gentlest = fall;
  }
  return { steepest, gentlest };
}

/** R12 — the start: a seeded x under the summit ridge, and the first
 * heading the ground makes a fair start along: falling no steeper than
 * R12's slope — the grade's own (R23) — and never really climbing (a
 * roller's back the grading cuts is allowed), from the start line to the
 * end of R12's run; and on a grade with a floor under its start (a black),
 * falling at least that on the whole, so the hut drops onto a pitch. */
export function chooseStart(
  rng: Rng,
  ground: Heightfield,
  grade: GradeRow = UNGRADED,
): Spawn | string {
  const T = R.track;
  const size = R.world.size;
  const z = size * T.start.z;
  const run = startGateArc() + R.spawn.run;
  const { maxSlope, minSlope } = grade.spawn;
  for (let attempt = 0; attempt < START_TRIES; attempt++) {
    const x = size * inBand(rng, T.start.x);
    const side = rng.chance(0.5) ? 1 : -1;
    for (const a of START_HEADINGS) {
      for (const sign of a === 0 ? [1] : [side, -side]) {
        const heading = a * sign;
        const fall = fallAlong(ground, x, z, heading, run);
        if (fall.steepest > maxSlope * 0.9 || fall.gentlest < -START_CLIMB) continue;
        if (minSlope > 0) {
          const end = sampleField(ground, x + Math.sin(heading) * run, z + Math.cos(heading) * run);
          if ((sampleField(ground, x, z) - end) / run < minSlope * START_FLOOR) continue;
        }
        return { x, z, heading };
      }
    }
  }
  return "no heading off the summit makes a fair start";
}

/** R13 — the start line: the skiers abreast on the piste's first station,
 * facing down it, the player's slot first — the leftmost. The spawn is the
 * row's centreline point. */
export function gridOnTrack(level: HasTrack): { spawn: Spawn; grid: Spawn[] } {
  const G = R.grid;
  const p = trackPointAt(level, 0);
  const spawn: Spawn = { x: p.x, z: p.z, heading: p.heading };
  const grid: Spawn[] = [];
  const rx = Math.cos(p.heading);
  const rz = -Math.sin(p.heading);
  for (let slot = 0; slot < G.slots; slot++) {
    const col = slot % G.abreast;
    const o = (col - (G.abreast - 1) / 2) * G.spacing;
    grid.push({ x: p.x + rx * o, z: p.z + rz * o, heading: p.heading });
  }
  return { spawn, grid };
}

/** R11 — where the start gate stands: `grid.back` and one station down the
 * piste from the start line. */
export function startGateArc(): number {
  return R.grid.back + R.track.step;
}

/** R11 — where the gates stand, by arc length, on a piste `length` metres
 * long: the start gate, then evenly spaced as near the target as divides
 * the run, the finish line last. A pure function of the length, so the
 * park (R20) can keep off them before they are laid. */
export function gateArcs(length: number): number[] {
  const s0 = startGateArc();
  const count = Math.max(2, Math.round((length - s0) / R.checkpoint.spacing.target));
  const spacing = (length - s0) / count;
  const out: number[] = [];
  for (let k = 0; k <= count; k++) out.push(k === count ? length : s0 + k * spacing);
  return out;
}

/** R11 — the gates, from the start gate to the finish line at the piste's
 * end, evenly spaced as near the target as divides the run. */
export function layCheckpoints(level: HasTrack): Checkpoint[] {
  const out: Checkpoint[] = [];
  gateArcs(level.track.length).forEach((s, k) => {
    const p = trackPointAt(level, s);
    out.push({
      x: p.x,
      z: p.z,
      y: p.y,
      heading: p.heading,
      width: p.width + 2 * R.checkpoint.margin,
      s: p.s,
      colour: k % 2 === 0 ? "red" : "blue",
    });
  });
  return out;
}

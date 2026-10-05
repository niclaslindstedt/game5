// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R12, R27 — WHERE A RUN OFF A TOP STARTS: out along the face from its top
// station, on the side it leans to and then the other, the first spot a
// start of its colour can be raced off (`fairHeading`) — slid down the fall
// line until it lies under the station by a GLIDE's fall over the way to it
// (`headBelow`), so a skier stood off any lift, a drag's as much as a
// chair's, slides down to his run gathering speed and never climbs to it,
// and near enough that a ramp comes down off the top to it (R26). A version from before (`startsAcrossTop`,
// v4) looks along the line across the face through the top instead, at
// whatever height that finds. The walk itself is `resort-build.ts`'s.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  sampleField,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import type { GradeRow } from "./grades.ts";
import type { RunSpec } from "./network.ts";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import { LEVEL_RULES as R } from "./rules.ts";

/** The start heading a run can be raced off (R12): the fall of the first
 * stretch no steeper than its colour's start, and on a black at least its
 * floor — tried about the wanted heading, the first that holds; null where
 * none does. */
function fairHeading(
  ground: Heightfield,
  x: number,
  z: number,
  want: number,
  row: GradeRow,
): number | null {
  const run = R.grid.back + R.track.step + R.spawn.run;
  const { maxSlope, minSlope } = row.spawn;
  for (const d of [0, 0.25, -0.25, 0.5, -0.5, 0.8, -0.8, 1.05, -1.05, 1.3, -1.3, 1.55, -1.55]) {
    const h = want + d;
    if (Math.abs(h) > 1.3) continue;
    let steepest = 0;
    let climb = 0;
    for (let u = 0; u + R.track.gradeWindow <= run; u += 5) {
      const a = sampleField(ground, x + Math.sin(h) * u, z + Math.cos(h) * u);
      const b = sampleField(
        ground,
        x + Math.sin(h) * (u + R.track.gradeWindow),
        z + Math.cos(h) * (u + R.track.gradeWindow),
      );
      const fall = (a - b) / R.track.gradeWindow;
      steepest = Math.max(steepest, fall);
      climb = Math.max(climb, -fall);
    }
    const end = sampleField(ground, x + Math.sin(h) * run, z + Math.cos(h) * run);
    const mean = (sampleField(ground, x, z) - end) / run;
    if (steepest > maxSlope * 0.85 || climb > 0.06) continue;
    if (minSlope > 0 && mean < minSlope * 1.2) continue;
    return h;
  }
  return null;
}

/** How far along the contour from its top station a run's start is looked
 * for, m a step and steps: a red off a peak whose face falls too steeply
 * for one starts where the ridge has carried it to a pitch it can leave on,
 * as a ridge run does. */
const START_STEP = 30;
const START_STEPS = 12;

/** How far apart along the contour two runs off one top start, m. */
const SIBLING_APART = 80;

/** A run's top as its start is placed under it: where it stands, its
 * snow's height, and the radius of the ground a rider is let go on (a
 * pad's rim; a drag's let-go). */
export type StartTop = { x: number; z: number; y: number; rim: number };

/** A lift's top as the starts under it read it: its snow's height off
 * `ground`, and the rim of the pad it stands on (`rim` m; a drag's top has
 * none). */
export function startTop(
  ground: Heightfield,
  lift: { kind: string; top: { x: number; z: number } },
  rim: number,
): StartTop {
  const y = sampleField(ground, lift.top.x, lift.top.z);
  return { x: lift.top.x, z: lift.top.z, y, rim: lift.kind === "drag" ? 0 : rim };
}

/** The fall line a start is slid along, m a step and steps. */
const HEAD_SLIDE = 4;
const HEAD_SLIDES = 60;

/** R27 — A RUN STARTS UNDER ITS TOP: how far under the top's snow a start
 * at (x, z) must lie — `lift.top.ramp.drop` m, and a GLIDE's fall
 * (`lift.top.ramp.fall`) over the way from the rim to it — so the ramp
 * down to it falls all the way and a rider let go at a crawl gathers speed
 * down it. */
function headBelow(top: StartTop, x: number, z: number): number {
  const K = RR.lift.top.ramp;
  return K.drop + K.fall * Math.max(0, hypot(x - top.x, z - top.z) - top.rim);
}

/** R27 — where on the fall line through (x, z0) a run off `top` starts:
 * slid down the face (+z) until the ground lies under the top by
 * `headBelow`, or — where it already does — back up it while it still
 * would, so the start is the highest spot a glide off the top comes down
 * to; never further from the top than a ramp reaches (`lift.top.ramp.far`
 * less `REACH_SPARE`). Null where the face there will not come down that
 * far within reach. */
export function headOnContour(
  ground: Heightfield,
  x: number,
  z0: number,
  top: StartTop,
): number | null {
  const under = (z: number): boolean => sampleField(ground, x, z) <= top.y - headBelow(top, x, z);
  const near = (z: number): boolean =>
    hypot(x - top.x, z - top.z) <= RR.lift.top.ramp.far - REACH_SPARE;
  if (!under(z0)) {
    for (let k = 1; k <= HEAD_SLIDES; k++) {
      const z = z0 + k * HEAD_SLIDE;
      if (under(z)) return near(z) ? z : null;
    }
    return null;
  }
  let z = z0;
  for (let k = 1; k <= HEAD_SLIDES; k++) {
    const up = z0 - k * HEAD_SLIDE;
    if (!under(up)) break;
    z = up;
  }
  return near(z) ? z : null;
}

/** How far inside a ramp's reach a start stands, m: the ramp is aimed at
 * the run's line, which leaves the start on down the face. */
const REACH_SPARE = 20;

/** How much further down the fall line than the highest spot under its top
 * a start is tried, m. */
const HEAD_DOWNS = [0, 12, 24, 36, 48];

/** R12, R27 — where on the contour by its top station a run starts, and
 * the heading it leaves on: the first spot, out from the station on the
 * side the run leans to and then the other, a start of its colour can be
 * raced off — under it by a glide's fall (`headOnContour`), so a rider
 * off the lift slides down to it, never climbs; `top` null (a version
 * from before, `startsAcrossTop`) looks along the line across the face
 * through the top, at whatever height. Null where there is none within
 * reach. */
export function placeStart(
  ground: Heightfield,
  spec: RunSpec,
  lean: number,
  siblings: readonly number[],
  clear: (x: number, z: number, heading: number) => boolean,
  top: StartTop | null,
): RunSpec | null {
  const dir = lean >= 0 ? 1 : -1;
  // Under a top, at half the step along the contour and a little further
  // down the fall line at each, for the ramp's room as much as the start's.
  const split = top === null ? 1 : 2;
  const downs = top === null ? [0] : HEAD_DOWNS;
  for (let k = 0; k <= START_STEPS * split; k++) {
    for (const sgn of k === 0 ? [1] : [dir, -dir]) {
      const x = spec.x + (sgn * k * START_STEP) / split;
      if (Math.abs(x - R.world.size / 2) > RR.massif.flank.inner - 160) continue;
      if (siblings.some((sx) => Math.abs(sx - x) < SIBLING_APART)) continue;
      const z0 = top === null ? spec.z : headOnContour(ground, x, spec.z, top);
      if (z0 === null) continue;
      for (const down of downs) {
        const z = z0 + down;
        if (top && hypot(x - top.x, z - top.z) > RR.lift.top.ramp.far - REACH_SPARE) break;
        const heading = fairHeading(ground, x, z, spec.heading, spec.row);
        if (heading !== null && clear(x, z, heading)) return { ...spec, x, z, heading };
      }
    }
  }
  return null;
}

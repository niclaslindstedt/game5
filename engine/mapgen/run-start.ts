// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R12, R27 — WHERE A RUN OFF A TOP STARTS: out along the face from its top
// station, on the side it leans to and then the other, the first spot a
// start of its colour can be raced off (`fairHeading`) — slid down the fall
// line onto the top's own contour just under the station (`headOnContour`),
// so a skier stood off any lift, a drag's as much as a chair's, glides to
// his run and never climbs to it. A version from before (`startsAcrossTop`,
// v4) looks along the line across the face through the top instead, at
// whatever height that finds. The walk itself is `resort-build.ts`'s.

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

/** R27 — A RUN STARTS UNDER ITS TOP: how far below its top station's
 * snow its start lies, m — a glide off the station, never a climb, and
 * just under the rim of a chair's or a gondola's pad (`lift.top`, about
 * 2 m under its deck) so a ramp can still come down to it — and
 * the fall line it is slid along to get there, m a step and steps. */
const HEAD_BELOW = 4;
const HEAD_SLIDE = 4;
const HEAD_SLIDES = 60;

/** R27 — where on the fall line through (x, z0) a run off a top whose snow
 * stands at `topY` starts: slid down the face (+z) until the ground is
 * `HEAD_BELOW` m under the top, or — where it already is — back up it while
 * it still would be, so the start sits on the top's contour just below the
 * station: where a skier stood off the lift glides to. Null where the face
 * there will not come down that far within reach. */
function headOnContour(ground: Heightfield, x: number, z0: number, topY: number): number | null {
  const want = topY - HEAD_BELOW;
  if (sampleField(ground, x, z0) > want) {
    for (let k = 1; k <= HEAD_SLIDES; k++) {
      const z = z0 + k * HEAD_SLIDE;
      if (sampleField(ground, x, z) <= want) return z;
    }
    return null;
  }
  let z = z0;
  for (let k = 1; k <= HEAD_SLIDES; k++) {
    const up = z0 - k * HEAD_SLIDE;
    if (sampleField(ground, x, up) > want) break;
    z = up;
  }
  return z;
}

/** R12, R27 — where on the contour by its top station a run starts, and
 * the heading it leaves on: the first spot, out from the station on the
 * side the run leans to and then the other, a start of its colour can be
 * raced off — on the top's contour just below it (`headOnContour`), so a
 * rider off the lift glides to it, never climbs; `topY` null (a version
 * from before, `startsAcrossTop`) looks along the line across the face
 * through the top, at whatever height. Null where there is none within
 * reach. */
export function placeStart(
  ground: Heightfield,
  spec: RunSpec,
  lean: number,
  siblings: readonly number[],
  clear: (x: number, z: number, heading: number) => boolean,
  topY: number | null,
): RunSpec | null {
  const dir = lean >= 0 ? 1 : -1;
  for (let k = 0; k <= START_STEPS; k++) {
    for (const sgn of k === 0 ? [1] : [dir, -dir]) {
      const x = spec.x + sgn * k * START_STEP;
      if (Math.abs(x - R.world.size / 2) > RR.massif.flank.inner - 160) continue;
      if (siblings.some((sx) => Math.abs(sx - x) < SIBLING_APART)) continue;
      const z = topY === null ? spec.z : headOnContour(ground, x, spec.z, topY);
      if (z === null) continue;
      const heading = fairHeading(ground, x, z, spec.heading, spec.row);
      if (heading !== null && clear(x, z, heading)) return { ...spec, x, z, heading };
    }
  }
  return null;
}

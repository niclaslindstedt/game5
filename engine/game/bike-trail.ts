// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH TRAIL THE BIKE IS ON, and WHERE A FALL PUTS IT BACK: the trail it
// was begun on is kept until the bike has plainly left it for another (a
// crossing is ridden through on its own trail), and a rider stood up after
// a fall is put back on that trail's centre line, at its nearest point clear
// of a jump, a drop, a berm or a garden and where the bench does not rise
// ahead of him (only clear where nowhere near is both) — the next one down
// where the nearest is not, else the last one above. Pure over the level and
// the bike; nothing here draws from any stream.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { bikeTrailAt, bikeTrailById, nearestBikeTrailPoint } from "../mapgen/bike-park-query.ts";
import type { BikeTrail, BikeTrailPoint } from "../mapgen/bike-park-types.ts";
import type { Level } from "../mapgen/types.ts";
import type { BikeState } from "./bike-state.ts";

/** How far off its own trail's centre line, past its tread, the bike may be
 * before another trail it stands on is taken as its own, m. */
const LEFT = 1;
/** How clear of a feature a restart stands, m before it (the run-up a
 * standing start wants to roll over even a roller) and after it. */
const CLEAR = { before: 8, after: 3 };
/** How far ahead of a restart the bench may not rise, m. */
const ROLL = 6;
/** How far down (then up) the trail a clear point is looked for, m. */
const SEEK = 60;

/** The nearest point of `t` to (x, z): its index and distance. */
function nearestOn(t: BikeTrail, x: number, z: number): { index: number; distance: number } {
  let index = 0;
  let distance = Infinity;
  const p = t.points;
  for (let i = 0; i < p.length; i++) {
    const d = hypot(p[i].x - x, p[i].z - z);
    if (d < distance) {
      distance = d;
      index = i;
    }
  }
  return { index, distance };
}

/** THE TRAIL THE BIKE IS ON moved on: kept until it stands on another's
 * tread and is off its own past the tread's edge — and, on its own trail's
 * tread, the place it was last ridden there kept (`BikeState.ridden`). */
export function keepTrail(level: Level, b: BikeState): void {
  const hit = bikeTrailAt(level, b.x, b.z);
  if (!hit || Math.abs(hit.lateral) > hit.half) return;
  if (hit.trail.id !== b.trail) {
    const own = b.trail ? bikeTrailById(level, b.trail) : null;
    if (own) {
      const near = nearestOn(own, b.x, b.z);
      if (near.distance <= own.points[near.index].width / 2 + LEFT) return;
    }
    b.trail = hit.trail.id;
  }
  b.ridden = { trail: hit.trail.id, s: hit.s };
}

/** Whether arc `s` of `t` stands clear of every feature. */
function clearAt(t: BikeTrail, s: number): boolean {
  for (const f of t.features) {
    if (s >= f.from - CLEAR.before && s <= f.to + CLEAR.after) return false;
  }
  return true;
}

/** Whether station `i` of `t` is a place to start from at rest: clear of
 * every feature, and the bench not rising over the `ROLL` m ahead (a
 * standing start on a rise rolls back). */
function startAt(t: BikeTrail, i: number): boolean {
  const p = t.points;
  if (!clearAt(t, p[i].s)) return false;
  for (let k = i + 1; k < p.length && p[k].s - p[i].s <= ROLL; k++)
    if (p[k].y > p[i].y) return false;
  return true;
}

/** WHERE A FALL PUTS THE BIKE BACK: the place on a trail it was last
 * ridden (`BikeState.ridden`) — wherever the fall threw it — or with none,
 * its own trail's nearest point within `within` m (any trail's when its own
 * is further); moved down the trail clear of a feature (up it when nothing
 * below is clear) — or null, with no trail to go back to. */
export function restartPoint(level: Level, b: BikeState, within: number): BikeTrailPoint | null {
  let t = b.trail ? bikeTrailById(level, b.trail) : null;
  let index = -1;
  const last = b.ridden ? bikeTrailById(level, b.ridden.trail) : null;
  if (last) {
    t = last;
    b.trail = last.id;
    const p = last.points;
    index = p.length - 1;
    for (let i = 0; i < p.length; i++)
      if (p[i].s >= b.ridden!.s) {
        index = i;
        break;
      }
  } else if (t) {
    const near = nearestOn(t, b.x, b.z);
    if (near.distance <= within) index = near.index;
  }
  if (index < 0) {
    const any = nearestBikeTrailPoint(level, b.x, b.z, within);
    if (!any) return null;
    t = any.trail;
    index = Math.min(any.index, t.points.length - 1);
    b.trail = t.id;
  }
  if (!t) return null;
  const p = t.points;
  const s0 = p[index].s;
  for (let i = index; i < p.length && p[i].s <= s0 + SEEK; i++) if (startAt(t, i)) return p[i];
  for (let i = index; i >= 0 && p[i].s >= s0 - SEEK; i--) if (startAt(t, i)) return p[i];
  for (let i = index; i < p.length && p[i].s <= s0 + SEEK; i++) if (clearAt(t, p[i].s)) return p[i];
  for (let i = index; i >= 0 && p[i].s >= s0 - SEEK; i--) if (clearAt(t, p[i].s)) return p[i];
  return p[index];
}

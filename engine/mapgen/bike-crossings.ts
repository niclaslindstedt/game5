// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CROSSINGS LEVELLED (R44): where two trails' treads overlap in plan
// — one trail crossing another, or running across it for a few metres —
// both benches are brought to one height there, each eased onto it along
// its own line, as a park's builders grade a crossing so a rider on either
// trail rolls straight through it. Without it the two benches, each cut to
// its own line's height, meet as a step or a wall (a metre or two where a
// trail crosses another a switchback lower), and the surface has one
// height a point (`bike-surface.ts`).
//
// Each bench is moved toward the other's, eased in and out at most
// `CROSSING.rate` of grade (and never more than half the trail's own mean
// grade, so a bench eased up into a crossing seldom climbs), over at least
// `CROSSING.least` m — and a move that would break R44's pitch, rise or
// cut is not made, the other bench left to come the rest of the way. Pure
// over the trails it is handed; the map is not read. A crossing far apart
// in height is also scored down while a trail is laid (`crossingMiss`).

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { BIKE_PARK_RULES as B } from "./bike-park-rules.ts";
import type { BikeTrail, BikeTrailPoint } from "./bike-park-types.ts";

/** How a crossing is graded. */
export const CROSSING = {
  /** The grade a bench is eased onto the crossing's height at, at most. */
  rate: 0.04,
  /** And at least (on a trail whose mean grade is shallower than twice it). */
  slow: 0.012,
  /** The shortest easing either side, m. */
  least: 6,
  /** Benches nearer than this in height are left as they are, m (the
   * surface blends what is left, `bikeHit`). */
  close: 0.08,
  /** Passes over every pair (each closes half of what is left, and a
   * crossing levelled moves its neighbours). */
  passes: 6,
} as const;

/** A grid of a trail's stations, for the nearest station to a point. */
type Grid = { cell: number; at: Map<number, number[]>; points: readonly BikeTrailPoint[] };

const CELL = 4;
const key = (i: number, j: number): number => i * 73856093 + j * 19349663;

function gridOf(points: readonly BikeTrailPoint[]): Grid {
  const at = new Map<number, number[]>();
  points.forEach((p, k) => {
    const id = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
    const row = at.get(id);
    if (row) row.push(k);
    else at.set(id, [k]);
  });
  return { cell: CELL, at, points };
}

/** The station of `g` nearest (x, z) within `within` m: its index, or -1. */
function nearest(g: Grid, x: number, z: number, within: number): number {
  const i0 = Math.floor((x - within) / CELL);
  const i1 = Math.floor((x + within) / CELL);
  const j0 = Math.floor((z - within) / CELL);
  const j1 = Math.floor((z + within) / CELL);
  let best = within;
  let out = -1;
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) {
      const row = g.at.get(key(i, j));
      if (!row) continue;
      for (const k of row) {
        const p = g.points[k];
        const d = hypot(p.x - x, p.z - z);
        if (d < best) {
          best = d;
          out = k;
        }
      }
    }
  return out;
}

/** A run of one trail's stations whose tread overlaps another's, with how
 * far each station's bench is under the other's station beside it. */
type Overlap = { k0: number; k1: number; gap: number[] };

/** Every run of `a`'s stations whose tread overlaps `b`'s. */
function overlaps(a: BikeTrail, gb: Grid): Overlap[] {
  const out: Overlap[] = [];
  let run: Overlap | null = null;
  a.points.forEach((p, k) => {
    const q = nearest(gb, p.x, p.z, p.width / 2 + 2);
    const o = q >= 0 ? gb.points[q] : null;
    if (o && hypot(o.x - p.x, o.z - p.z) < (p.width + o.width) / 2) {
      if (!run) run = { k0: k, k1: k, gap: [] };
      run.k1 = k;
      run.gap.push(o.y - p.y);
    } else if (run) {
      out.push(run);
      run = null;
    }
  });
  if (run) out.push(run);
  return out;
}

/** The worst a run's benches miss each other by, m. */
const missOf = (o: Overlap): number => o.gap.reduce((m, g) => Math.max(m, Math.abs(g)), 0);

/** What R44 holds a bench to, measured over its stations `i0`…`i1`: its
 * steepest pitch, its worst rise and its deepest cut or fill. */
function benchOver(p: readonly BikeTrailPoint[], i0: number, i1: number): [number, number, number] {
  let steep = 0;
  let climb = 0;
  let cut = 0;
  for (let i = i0, j = i0; i <= i1; i++) {
    while (j < p.length - 1 && p[j].s - p[i].s < B.pitch) j++;
    const ds = p[j].s - p[i].s;
    if (ds >= B.pitch * 0.9) steep = Math.max(steep, (p[i].y - p[j].y) / ds);
    for (let k = i + 1; k < p.length && p[k].s - p[i].s <= B.climb.window; k++)
      climb = Math.max(climb, p[k].y - p[i].y);
    cut = Math.max(cut, Math.abs(p[i].y - p[i].ground));
  }
  return [steep, climb, cut];
}

/** Trail `t`'s bench moved `share` of the way onto the other's over a
 * run, eased in before it and out after it along its line — kept only
 * where R44 still holds it (or holds it no worse than it was); whether it
 * moved. */
function meet(t: BikeTrail, o: Overlap, share: number): boolean {
  const p = t.points;
  const mean = t.length > 0 ? Math.abs(p[0].y - p[p.length - 1].y) / t.length : 0;
  const rate = Math.max(CROSSING.slow, Math.min(CROSSING.rate, mean / 2));
  const first = o.gap[0] * share;
  const last = o.gap[o.gap.length - 1] * share;
  const s0 = p[o.k0].s;
  const s1 = p[o.k1].s;
  const easeIn = Math.max(CROSSING.least, Math.abs(first) / rate);
  const easeOut = Math.max(CROSSING.least, Math.abs(last) / rate);
  // The stations it reaches, and those its pitch and rise are read over.
  let i0 = o.k0;
  while (i0 > 0 && s0 - p[i0 - 1].s < easeIn) i0--;
  let i1 = o.k1;
  while (i1 < p.length - 1 && p[i1 + 1].s - s1 < easeOut) i1++;
  let w0 = i0;
  while (w0 > 0 && p[i0].s - p[w0 - 1].s <= B.climb.window) w0--;
  let w1 = i1;
  while (w1 < p.length - 1 && p[w1 + 1].s - p[i1].s <= B.climb.window) w1++;
  const was = benchOver(p, w0, w1);
  const kept = p.slice(i0, i1 + 1).map((q) => q.y);
  // Eased as a smoothstep, so the grade changes gently in and out.
  const smooth = (u: number): number => u * u * (3 - 2 * u);
  for (let k = i0; k <= i1; k++) {
    const q = p[k];
    if (k >= o.k0 && k <= o.k1) q.y += o.gap[k - o.k0] * share;
    else if (q.s < s0) q.y += first * smooth(1 - (s0 - q.s) / easeIn);
    else q.y += last * smooth(1 - (q.s - s1) / easeOut);
  }
  const now = benchOver(p, w0, w1);
  const race = t.kind === "race";
  const limit = [race ? B.race.steepest : B.grades[t.grade].steepest, B.climb.most, B.bench.most];
  for (let m = 0; m < 3; m++) {
    if (now[m] > Math.max(limit[m], was[m]) + 1e-6) {
      for (let k = i0; k <= i1; k++) p[k].y = kept[k - i0];
      return false;
    }
  }
  return true;
}

/** How far `t`'s tread misses the benches of `others` where they cross,
 * past `CROSSING.close`, summed, m — what a trail's tries are scored down
 * by, so a trail that would cross another far above or below it is laid
 * another way where it can be. */
export function crossingMiss(t: BikeTrail, others: readonly BikeTrail[]): number {
  let miss = 0;
  for (const b of others) {
    if (b === t) continue;
    for (const o of overlaps(t, gridOf(b.points))) miss += Math.max(0, missOf(o) - CROSSING.close);
  }
  return miss;
}

/** THE CROSSINGS of `trails` levelled, in place; the trails' verticals
 * restated. Each pass moves each bench half the way it still misses the
 * other's (a quarter where half breaks R44, nothing where that does too),
 * so a bench that cannot move leaves the other to come the whole way. */
export function levelCrossings(trails: readonly BikeTrail[]): void {
  if (trails.length < 2) return;
  for (let pass = 0; pass < CROSSING.passes; pass++) {
    let moved = false;
    for (let i = 0; i < trails.length; i++)
      for (let j = 0; j < trails.length; j++) {
        if (i === j) continue;
        const a = trails[i];
        for (const o of overlaps(a, gridOf(trails[j].points))) {
          if (missOf(o) < CROSSING.close) continue;
          if (meet(a, o, 0.5) || meet(a, o, 0.25)) moved = true;
        }
      }
    if (!moved) break;
  }
  for (const t of trails) t.vertical = t.points[0].y - t.points[t.points.length - 1].y;
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE, ASKED: the two questions everything that skis, draws or
// measures a map puts to its line — "where on the piste is this point
// nearest?" and "where is the piste this far down it?" — answered once,
// here, for the generator (the gates, the forest), the analysis, the
// physics, the bot and the renderer alike.
//
// The piste is a couple of thousand two-metre segments, and the
// nearest-point question is asked every physics step for every skier, so it
// is answered off a spatial hash of the segments rather than by walking all
// of them. The hash is built lazily, the first time a piste is asked, and
// kept beside the points array it was built from (a WeakMap, so a dropped
// level takes its index with it). Everything here is read-only over the
// line.
//
// THE PISTE IS OPEN. Nothing here wraps: an arc past the finish is the
// finish, an arc before the start line is the start line, and "how far
// ahead" can be negative — a point up the piste from another is behind it.

import { angleDiff, cellKey, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { TrackHit, TrackPoint } from "./types.ts";

/** Anything carrying an open piste: a finished `Level`, or the generator's
 * own line before it is one. */
export type HasTrack = {
  readonly track: { readonly points: readonly TrackPoint[]; readonly length: number };
};

/** Hash cell, m. Several segments to a cell and a handful of cells to a
 * query: the piste's own corridor fits inside one ring. */
const CELL = 24;

/** How many rings a query walks before it gives up on the hash and walks
 * the whole piste: past this the point is far off the map. */
const MAX_RINGS = 90;

type Index = { readonly cells: Map<number, number[]> };

const indices = new WeakMap<readonly TrackPoint[], Index>();

function indexOf(points: readonly TrackPoint[]): Index {
  let index = indices.get(points);
  if (index) return index;
  const cells = new Map<number, number[]>();
  const n = points.length;
  for (let i = 0; i + 1 < n; i++) {
    const a = points[i];
    const b = points[i + 1];
    const c0 = Math.floor(Math.min(a.x, b.x) / CELL);
    const c1 = Math.floor(Math.max(a.x, b.x) / CELL);
    const r0 = Math.floor(Math.min(a.z, b.z) / CELL);
    const r1 = Math.floor(Math.max(a.z, b.z) / CELL);
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        const key = cellKey(c, r);
        const list = cells.get(key);
        if (list) list.push(i);
        else cells.set(key, [i]);
      }
    }
  }
  index = { cells };
  indices.set(points, index);
  return index;
}

/** Project (x, z) onto segment i → i+1, writing into `hit` if nearer. */
function trySegment(
  points: readonly TrackPoint[],
  i: number,
  x: number,
  z: number,
  hit: TrackHit,
): void {
  const a = points[i];
  const b = points[i + 1];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((x - a.x) * dx + (z - a.z) * dz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = a.x + dx * t;
  const pz = a.z + dz * t;
  const ex = x - px;
  const ez = z - pz;
  // A segment plainly further than the nearest found so far is turned away
  // on the square, before the dear `hypot`; the margin is far wider than
  // `hypot`'s rounding, so whatever passes is decided exactly as before.
  const held = hit.distance;
  if (ex * ex + ez * ez > held * held * (1 + 1e-9)) return;
  const d = hypot(ex, ez);
  if (d >= held) return;
  const len = Math.sqrt(len2) || 1;
  // Right of travel is (cos h, −sin h) = (dz, −dx) / len.
  hit.index = i;
  hit.s = a.s + (b.s - a.s) * t;
  hit.distance = d;
  hit.lateral = (ex * dz - ez * dx) / len;
  hit.x = px;
  hit.z = pz;
}

/** WHERE ON THE PISTE IS THIS POINT NEAREST — the segment, the arc length,
 * the plan distance to the centreline and the signed lateral offset
 * (positive to the right of the direction of travel). Pass `out` to reuse
 * an object on a hot path. */
export function nearestTrackPoint(level: HasTrack, x: number, z: number, out?: TrackHit): TrackHit {
  return nearestWithin(level, x, z, Infinity, out);
}

/** `nearestTrackPoint`, but only looking `within` metres of the point: the
 * answer's `distance` is Infinity when the piste is further off than that.
 * For the question "is the piste near here?" asked of every tree on the
 * map, most of which stand hundreds of metres from it. */
export function nearestWithin(
  level: HasTrack,
  x: number,
  z: number,
  within: number,
  out?: TrackHit,
): TrackHit {
  const points = level.track.points;
  const hit = out ?? { index: 0, s: 0, distance: Infinity, lateral: 0, x: 0, z: 0 };
  hit.distance = Infinity;
  const { cells } = indexOf(points);
  const qc = Math.floor(x / CELL);
  const qr = Math.floor(z / CELL);
  const rings = within === Infinity ? MAX_RINGS : Math.min(MAX_RINGS, Math.ceil(within / CELL) + 1);
  for (let ring = 0; ring <= rings; ring++) {
    for (let dc = -ring; dc <= ring; dc++) {
      const edge = dc === -ring || dc === ring;
      for (let dr = -ring; dr <= ring; dr += edge ? 1 : 2 * ring) {
        const list = cells.get(cellKey(qc + dc, qr + dr));
        if (list) for (const i of list) trySegment(points, i, x, z, hit);
        if (ring === 0) break;
      }
    }
    // Every segment in the next ring out is at least `ring` whole cells
    // away, whatever corner of its own cell the query stands in.
    if (hit.distance <= ring * CELL) return hit;
  }
  if (within !== Infinity) {
    if (hit.distance > within) hit.distance = Infinity;
    return hit;
  }
  for (let i = 0; i + 1 < points.length; i++) trySegment(points, i, x, z, hit);
  return hit;
}

/** WHERE IS THE PISTE `s` METRES DOWN IT: the centreline interpolated
 * between its two nearest stations, the arc length clamped to the line —
 * the start line before it, the finish past it. */
export function trackPointAt(level: HasTrack, s: number, out?: TrackPoint): TrackPoint {
  const points = level.track.points;
  const length = level.track.length;
  const n = points.length;
  const u = s <= 0 ? 0 : s >= length ? length : s;
  // Stations are evenly spaced, so the guess is nearly always the answer.
  let i = Math.min(n - 2, Math.max(0, Math.floor((u / length) * (n - 1))));
  while (i > 0 && points[i].s > u) i--;
  while (i < n - 2 && points[i + 1].s <= u) i++;
  const a = points[i];
  const b = points[i + 1];
  const t = b.s > a.s ? (u - a.s) / (b.s - a.s) : 0;
  const p = out ?? { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
  p.x = a.x + (b.x - a.x) * t;
  p.z = a.z + (b.z - a.z) * t;
  p.y = a.y + (b.y - a.y) * t;
  p.s = u;
  p.heading = a.heading + angleDiff(a.heading, b.heading) * t;
  p.width = a.width + (b.width - a.width) * t;
  return p;
}

/** Arc distance from `a` DOWN the piste to `b`, m — negative where `b` is
 * up the piste from `a`. */
export function arcAhead(_level: HasTrack, a: number, b: number): number {
  return b - a;
}

/** Arc distance between two stations, m, whichever is higher. */
export function arcBetween(_level: HasTrack, a: number, b: number): number {
  return Math.abs(b - a);
}

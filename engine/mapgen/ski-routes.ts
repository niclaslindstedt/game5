// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R42 — THE SKI ROUTES: the ORANGE runs, the grade past black.
//
// A black is the steepest a piste machine works (R8's `track.maxGrade`,
// 78 %, 38°); past it there is only the mountain as it lies. Where a ski
// area has a line down that country worth skiing it MARKS it — orange
// stakes down a corridor, an orange sign at its head — and calls it a SKI
// ROUTE: never groomed, never pressed, never graded, skied in whatever the
// sky left on it, and harder than any black the area has. It is the run an
// expert rides the lift for.
//
// WHERE ONE GOES is FOUND, never sculpted: nothing here moves the ground,
// packs the snow or fells a tree. The mountain is read as a grid of
// `route.cell`-metre squares, each one a skier may stand on unless it is a
// CLIFF (its fall line past `route.cliff`), in the TREES (a trunk within
// `route.open` metres) or under a LIFT (within `route.lift` of its line),
// and a skier may go from one to a neighbour only
// downhill and never down a pitch past the cliff's. Two searches over it:
//
//   - FROM THE TOPS — the shortest way down from the rim of every chair's
//     and gondola's top station to every square, and which top it is from;
//   - TO THE RUNS — the shortest way from every square down onto a piste or
//     a lane, read backwards from every run's corridor;
//
// and a route is the two joined through ONE STEEP SQUARE — a square whose
// fall line falls between R8's groomable ceiling and `route.steepest` over
// a `track.colourWindow` — off the top and down onto the run. The line is
// smoothed, laid at a station every few metres, and kept only where it is
// what a skier can ski and an expert would ride the lift for:
//
//   - STEEPER THAN ANY BLACK: its steepest `track.colourWindow` past R8's
//     ceiling and no more than `route.steepest`;
//   - NEVER A CLIFF: no `route.pitchWindow` of it past `route.cliff`;
//   - OPEN: no trunk within `route.open` metres of any station, and never
//     within `route.lift` metres of a lift's line, under its rope;
//   - NOT A PISTE'S SHOULDER: no more than `route.beside` metres of it run
//     within `route.clear` metres of another run's corridor before it ends
//     on one;
//   - A RUN: `route.length` long and `route.vertical` fallen at least.
//
// Of what stands, the map keeps up to `route.count.max`, the most vertical
// fallen on the steep first, each off a top of its own and clear of the
// others. A mountain with no such line has none.
//
// Nothing draws from a stream: the search is a pure function of the built
// ski area, so a map that carries routes is the same map with them laid on.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  sampleField,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { LEVEL_RULES as R } from "./rules.ts";
import { RESORT_RULES } from "./resort-rules.ts";
import type { Lift, Resort, Run, SkiRoute, TrackPoint, TreeDef } from "./types.ts";

const K = RESORT_RULES.route;

/** What the search reads of a built ski area. */
export type RouteGround = {
  ground: Heightfield;
  runs: readonly Run[];
  lifts: readonly Lift[];
  trees: readonly TreeDef[];
  size: number;
};

/** The neighbours a square steps to: the eight round it and the eight a
 * knight's move off, so a line may run at any of sixteen bearings. */
const STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
  [2, 1],
  [2, -1],
  [-2, 1],
  [-2, -1],
  [1, 2],
  [1, -2],
  [-1, 2],
  [-1, -2],
];

/** The steepest window of `span` metres along a line, m per m. */
export function steepestAlong(points: readonly { y: number; s: number }[], span: number): number {
  let best = 0;
  let j = 0;
  for (let i = 0; i < points.length; i++) {
    while (j < points.length && points[j].s - points[i].s < span) j++;
    if (j >= points.length) break;
    best = Math.max(best, (points[i].y - points[j].y) / (points[j].s - points[i].s));
  }
  return best;
}

/** A binary heap of squares by cost. */
class Heap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size(): number {
    return this.ids.length;
  }
  push(id: number, key: number): void {
    const ids = this.ids;
    const keys = this.keys;
    let i = ids.length;
    ids.push(id);
    keys.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      ids[i] = ids[p];
      keys[i] = keys[p];
      i = p;
    }
    ids[i] = id;
    keys[i] = key;
  }
  pop(): number {
    const ids = this.ids;
    const keys = this.keys;
    const top = ids[0];
    const id = ids.pop() as number;
    const key = keys.pop() as number;
    const n = ids.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const c = l + 1 < n && keys[l + 1] < keys[l] ? l + 1 : l;
        if (keys[c] >= key) break;
        ids[i] = ids[c];
        keys[i] = keys[c];
        i = c;
      }
      ids[i] = id;
      keys[i] = key;
    }
    return top;
  }
}

/** THE SKI ROUTES ON A MAP (R42), "SR1"… — none off a ski area or on a
 * map from before them. Ask this, never `resort.routes`. */
export function skiRoutesOf(level: { resort?: Resort }): readonly SkiRoute[] {
  return level.resort?.routes ?? [];
}

/** R42 — THE SKI ROUTES of a built ski area (see the header). */
export function laySkiRoutes(area: RouteGround): SkiRoute[] {
  const g = (x: number, z: number): number => sampleField(area.ground, x, z);
  const cell = K.cell;
  const n = Math.floor(area.size / cell);
  const N = n * n;
  const cx = (k: number): number => (k % n) * cell + cell / 2;
  const cz = (k: number): number => Math.floor(k / n) * cell + cell / 2;
  const y = new Float32Array(N);
  for (let k = 0; k < N; k++) y[k] = g(cx(k), cz(k));

  // THE TREES on a fine grid: every two-metre square a trunk's bark comes
  // within `route.open` of.
  const fine = 2;
  const fn = Math.ceil(area.size / fine);
  const wooded = new Uint8Array(fn * fn);
  for (const t of area.trees) {
    const reach = K.open + t.radius;
    const i0 = Math.max(0, Math.floor((t.x - reach) / fine));
    const i1 = Math.min(fn - 1, Math.floor((t.x + reach) / fine));
    const j0 = Math.max(0, Math.floor((t.z - reach) / fine));
    const j1 = Math.min(fn - 1, Math.floor((t.z + reach) / fine));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++)
        if (hypot((i + 0.5) * fine - t.x, (j + 0.5) * fine - t.z) <= reach) wooded[j * fn + i] = 1;
  }
  const inTrees = (x: number, z: number): boolean => {
    const i = Math.floor(x / fine);
    const j = Math.floor(z / fine);
    return i < 0 || j < 0 || i >= fn || j >= fn || wooded[j * fn + i] === 1;
  };

  // THE RUNS: every square a run's corridor covers, and which run and at
  // what arc of it; and every square within `route.clear` of one.
  const runOf = new Int32Array(N).fill(-1);
  const runAt = new Float32Array(N);
  const nearRun = new Uint8Array(N);
  area.runs.forEach((r, ri) => {
    for (const p of r.points) {
      const reach = p.width / 2 + K.clear;
      const i0 = Math.max(0, Math.floor((p.x - reach) / cell));
      const i1 = Math.min(n - 1, Math.floor((p.x + reach) / cell));
      const j0 = Math.max(0, Math.floor((p.z - reach) / cell));
      const j1 = Math.min(n - 1, Math.floor((p.z + reach) / cell));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const k = j * n + i;
          const d = hypot(cx(k) - p.x, cz(k) - p.z);
          if (d <= reach) nearRun[k] = 1;
          if (d <= p.width / 2 && runOf[k] < 0) {
            runOf[k] = ri;
            runAt[k] = p.s;
          }
        }
    }
  });

  // THE GROUND A SKIER MAY STAND ON: inside the map's margin, off the
  // cliffs, out of the trees and out from under every lift's rope, whose
  // towers stand down it.
  const underLift = (x: number, z: number): boolean =>
    area.lifts.some((l) => {
      const dx = l.top.x - l.bottom.x;
      const dz = l.top.z - l.bottom.z;
      const len2 = dx * dx + dz * dz || 1;
      const u = Math.max(0, Math.min(1, ((x - l.bottom.x) * dx + (z - l.bottom.z) * dz) / len2));
      return hypot(x - l.bottom.x - dx * u, z - l.bottom.z - dz * u) < K.lift;
    });
  const open = new Uint8Array(N);
  const b = K.baseline / 2;
  const fallAt = (x: number, z: number): [number, number] => [
    (g(x + b, z) - g(x - b, z)) / (2 * b),
    (g(x, z + b) - g(x, z - b)) / (2 * b),
  ];
  for (let k = 0; k < N; k++) {
    const x = cx(k);
    const z = cz(k);
    if (x < K.edge || z < K.edge || x > area.size - K.edge || z > area.size - K.edge) continue;
    const [gx, gz] = fallAt(x, z);
    if (hypot(gx, gz) > K.cliff || inTrees(x, z) || underLift(x, z)) continue;
    open[k] = 1;
  }
  /** Whether a skier may go from square `a` down to square `c`, `len`
   * metres: both open, no climb, no pitch past the cliff's, and the trees
   * clear between. */
  const step = (a: number, c: number, len: number): boolean => {
    if (!open[c]) return false;
    const drop = y[a] - y[c];
    if (drop < 0 || drop / len > K.cliff) return false;
    const x0 = cx(a);
    const z0 = cz(a);
    const x1 = cx(c);
    const z1 = cz(c);
    for (let t = fine; t < len; t += fine) {
      const u = t / len;
      if (inTrees(x0 + (x1 - x0) * u, z0 + (z1 - z0) * u)) return false;
    }
    return true;
  };

  // FROM THE TOPS: the shortest way down to every square, and its top.
  const fromCost = new Float64Array(N).fill(Infinity);
  const fromPrev = new Int32Array(N).fill(-1);
  const fromTop = new Int16Array(N).fill(-1);
  const heap = new Heap();
  area.lifts.forEach((lift, li) => {
    if (lift.kind === "drag") return;
    for (let i = 0; i < K.bearings; i++) {
      const a = (i / K.bearings) * 2 * Math.PI;
      const x = lift.top.x + Math.sin(a) * K.rim;
      const z = lift.top.z + Math.cos(a) * K.rim;
      const k = Math.floor(z / cell) * n + Math.floor(x / cell);
      if (k < 0 || k >= N || !open[k] || runOf[k] >= 0 || fromCost[k] === 0) continue;
      fromCost[k] = 0;
      fromTop[k] = li;
      heap.push(k, 0);
    }
  });
  while (heap.size > 0) {
    const a = heap.pop();
    const i = a % n;
    const j = Math.floor(a / n);
    for (const [di, dj] of STEPS) {
      const ii = i + di;
      const jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
      const c = jj * n + ii;
      // A way off a top never crosses a run: it leaves the top on its own.
      if (runOf[c] >= 0) continue;
      const len = hypot(di, dj) * cell;
      const cost = fromCost[a] + len;
      if (cost >= fromCost[c] || !step(a, c, len)) continue;
      fromCost[c] = cost;
      fromPrev[c] = a;
      fromTop[c] = fromTop[a];
      heap.push(c, cost);
    }
  }

  // TO THE RUNS: the shortest way down onto a run from every square, read
  // backwards from every square of a run's corridor.
  const toCost = new Float64Array(N).fill(Infinity);
  const toNext = new Int32Array(N).fill(-1);
  for (let k = 0; k < N; k++) {
    if (runOf[k] < 0) continue;
    toCost[k] = 0;
    heap.push(k, 0);
  }
  while (heap.size > 0) {
    const c = heap.pop();
    const i = c % n;
    const j = Math.floor(c / n);
    for (const [di, dj] of STEPS) {
      const ii = i - di;
      const jj = j - dj;
      if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
      const a = jj * n + ii;
      if (runOf[a] >= 0) continue;
      const len = hypot(di, dj) * cell;
      const cost = toCost[c] + len;
      if (cost >= toCost[a] || !step(a, c, len)) continue;
      toCost[a] = cost;
      toNext[a] = c;
      heap.push(a, cost);
    }
  }

  // THE STEEP SQUARES a route may be skied through: its fall line falling
  // past a black's ceiling, no more than a route's, over a colour window.
  const half = R.track.colourWindow / 2;
  const steep: number[] = [];
  for (let k = 0; k < N; k++) {
    if (!Number.isFinite(fromCost[k]) || !Number.isFinite(toCost[k])) continue;
    const x = cx(k);
    const z = cz(k);
    const [gx, gz] = fallAt(x, z);
    const m = hypot(gx, gz);
    if (m < 1e-6) continue;
    const dx = -gx / m;
    const dz = -gz / m;
    const pitch = (g(x - dx * half, z - dz * half) - g(x + dx * half, z + dz * half)) / (2 * half);
    if (pitch > R.track.maxGrade && pitch <= K.steepest) steep.push(k);
  }

  type Found = { route: Omit<SkiRoute, "id">; score: number; top: number };
  const best = new Map<number, Found>();
  for (const k of steep) {
    const cells: number[] = [];
    for (let a = k; a >= 0; a = fromPrev[a]) cells.push(a);
    cells.reverse();
    for (let c = toNext[k]; c >= 0; c = toNext[c]) cells.push(c);
    const end = cells[cells.length - 1];
    if (runOf[end] < 0) continue;
    const points = stationsOf(
      cells.map((c) => ({ x: cx(c), z: cz(c) })),
      g,
    );
    const length = points[points.length - 1].s;
    const vertical = points[0].y - points[points.length - 1].y;
    if (length < K.length.min || length > K.length.max || vertical < K.vertical) continue;
    const steepest = steepestAlong(points, R.track.colourWindow);
    if (steepest <= R.track.maxGrade || steepest > K.steepest) continue;
    if (steepestAlong(points, K.pitchWindow) > K.cliff) continue;
    if (points.some((p) => inTrees(p.x, p.z))) continue;
    let beside = 0;
    let onSteep = 0;
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const sq = Math.floor(p.z / cell) * n + Math.floor(p.x / cell);
      const ds = p.s - points[i - 1].s;
      if (sq >= 0 && sq < N && nearRun[sq] && runOf[sq] < 0) beside += ds;
      const drop = points[i - 1].y - p.y;
      if (drop / ds >= R.grade.bands.red) onSteep += drop;
    }
    if (beside > K.beside) continue;
    const top = fromTop[cells[0]];
    const score = onSteep + 0.05 * length;
    const had = best.get(top);
    if (had && had.score >= score) continue;
    best.set(top, {
      route: {
        grade: "orange",
        points,
        length,
        from: area.lifts[top].id,
        into: { run: area.runs[runOf[end]].id, s: runAt[end] },
        steepest,
      },
      score,
      top,
    });
  }
  const ranked = [...best.values()].sort((a, c) => c.score - a.score || a.top - c.top);
  const kept: Found[] = [];
  for (const f of ranked) {
    if (kept.length >= K.count.max) break;
    const apart = kept.every((o) =>
      f.route.points.every(
        (p) => p.s < K.lead || o.route.points.every((q) => hypot(p.x - q.x, p.z - q.z) > K.apart),
      ),
    );
    if (apart) kept.push(f);
  }
  return kept.map((f, i) => ({ id: `SR${i + 1}`, ...f.route }));
}

/** The walked squares as stations: the line through their middles smoothed
 * (`route.smooth` passes, its ends held) and laid every `route.station`
 * metres on the snow, with its arc, its heading and the marked corridor's
 * width. */
function stationsOf(
  raw: readonly { x: number; z: number }[],
  g: (x: number, z: number) => number,
): TrackPoint[] {
  let pts = raw.map((p) => ({ ...p }));
  for (let pass = 0; pass < K.smooth; pass++) {
    const was = pts;
    pts = was.map((p, i) =>
      i === 0 || i === was.length - 1
        ? p
        : {
            x: (was[i - 1].x + 2 * p.x + was[i + 1].x) / 4,
            z: (was[i - 1].z + 2 * p.z + was[i + 1].z) / 4,
          },
    );
  }
  const out: TrackPoint[] = [];
  const at = (x: number, z: number, s: number): void => {
    out.push({ x, z, y: g(x, z), s, heading: 0, width: K.width });
  };
  at(pts[0].x, pts[0].z, 0);
  let s = 0;
  let next = K.station;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const c = pts[i];
    const len = hypot(c.x - a.x, c.z - a.z);
    while (next <= s + len) {
      const u = (next - s) / len;
      at(a.x + (c.x - a.x) * u, a.z + (c.z - a.z) * u, next);
      next += K.station;
    }
    s += len;
  }
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 1)];
    const c = out[Math.min(out.length - 1, i + 1)];
    out[i].heading = Math.atan2(c.x - a.x, c.z - a.z);
  }
  return out;
}

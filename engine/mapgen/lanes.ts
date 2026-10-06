// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R27 — A LANE ROUTED: the line a transport lane is laid along, found
// before it is walked.
//
// A piste is walked: it goes down the mountain, and the ground steers it.
// A cat track is ENGINEERED: it holds a few per cent of fall for a
// kilometre or more across a face that falls at forty, so it is laid along
// the benches, round the heads of the gullies and across the spurs where
// they are lowest — the line the ground lets it keep its pitch on. A greedy
// walk cannot find that line (each step chooses well and the whole goes
// wrong at the first gully); a search over the face can. So a lane's line
// is found on a coarse grid from its start down the map one row at a time
// (a lane never doubles back up the map, R27), each step costing its
// length, more where it falls outside the lane's band of pitch, more again
// where the ground across it is steep (the cut and the fill a bench there
// takes), and a great deal where it runs along beside a piste rather than
// across it — to the cheapest place it can JOIN a piste: on a piste's
// line, far enough from its start to be a way across the mountain, the
// way its slot sends it if the ground lets it go that way.

import { angleDiff, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  sampleField,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { JOIN_END, JOIN_FINISH, NetIndex, clearance } from "./network.ts";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import { LEVEL_RULES as R } from "./rules.ts";

/** The route's grid, m a cell. */
const CELL = 8;
/** A step of the search, in cells across (+x) and down the map, its
 * heading (0 down the map, clockwise from above) and its length, m: down
 * the map, across it at every angle a lane is laid at, and along the
 * contour. */
type Move = { dx: number; dz: number; heading: number; length: number };
const MOVES: readonly Move[] = [
  [-1, 0],
  [-4, 1],
  [-3, 1],
  [-2, 1],
  [-1, 1],
  [-1, 2],
  [-1, 3],
  [0, 1],
  [1, 3],
  [1, 2],
  [1, 1],
  [2, 1],
  [3, 1],
  [4, 1],
  [1, 0],
].map(([dx, dz]) => ({ dx, dz, heading: Math.atan2(dx, dz), length: hypot(dx * CELL, dz * CELL) }));
const WEST = 0;
const EAST = MOVES.length - 1;
/** The steps down the map, and the most rows one spans. */
const DOWN = MOVES.flatMap((b, m) => (b.dz > 0 ? [m] : []));
const DEEPEST = Math.max(...MOVES.map((m) => m.dz));
/** What a step costs, per metre of it, past its length: a metre of pitch
 * outside the band per metre run, the cross-slope past what a lane's
 * bench takes in its stride, and running beside a piste. */
const PITCH_COST = 60;
/** How far past the band a single step may fall, as multiples of its
 * ends: never climbing, and the grading takes a roller in its stride, not
 * a run of them. */
const HARD = { min: 0, max: 1.75 };
const CROSS_COST = 3;
const CROSS_FREE = 0.35;
const BESIDE_COST = 8;
/** What joining the other way from the slot's costs: per metre, as if the
 * lane were this much longer. */
const OTHER_WAY = 0.6;
/** How near a piste's line a cell must lie to be a place to join it, m. */
const ON_LINE = 6;
/** The least angle a step crosses a run's corridor at, rad: a lane meets a
 * run square enough to be across it (R27), a little over the walk's own
 * `CROSS_LEAST` for the pursuit's rounding of the route's corners. */
const SQUARE = 0.65;
/** The tightest a route turns, m of radius: a lane's bend with room for
 * the walk's pursuit of it. */
const BEND = 45;
/** Between each two steps: the turn, rad, and the most a lane's bend lets
 * it be. */
const TURN = MOVES.flatMap((a) => MOVES.map((b) => Math.abs(b.heading - a.heading)));
const TURN_MOST = MOVES.flatMap((a) => MOVES.map((b) => (b.length + a.length) / 2 / BEND));
/** What a radian of turn costs, as metres of lane. */
const TURN_COST = 20;
/** How far from its top station a lane runs beside the pistes that leave
 * it before it must cross what it meets square, m. */
const TOP_FREE = 80;
/** How much further off than the clearance (R27) a route keeps from a run
 * it is not crossing, m: the walk pursues the route a look-ahead ahead and
 * smooths the line it walked, and either cuts a corner by a few metres. */
const MARGIN = 10;

/** Whether a lane may join run `r` at arc `s` (R27): not in its first
 * stretch off its top, nor in its last — its finish into the village or its
 * own junction. */
function joinable(net: NetIndex, r: number, s: number): boolean {
  const run = net.runs[r];
  const last = run.points[run.points.length - 1].s;
  return s > JOIN_END && s < last - (run.into < 0 ? JOIN_FINISH : JOIN_END);
}

/** How far past the route's grid the runs are read, cells: a run just
 * off its edge is beside the cells along it. */
const PAD = 16;

/** EVERY CELL'S NEAREST RUN on the route's grid (`cols` × `rows` cells of
 * `CELL` metres from `left`, `z0`): the distance to the nearest station of
 * any run, that run, and its heading and width there. The stations seed
 * the cells they stand in, and two sweeps carry each cell's nearest seed to
 * its neighbours — a station two metres along is a run's line to within a
 * metre, and the grid's own rounding is a cell's. */
function nearestRaster(
  net: NetIndex,
  left: number,
  z0: number,
  cols: number,
  rows: number,
): {
  dist: Float64Array;
  run: Int32Array;
  heading: Float64Array;
  width: Float64Array;
  arc: Float64Array;
} {
  const W = cols + 2 * PAD;
  const H = rows + 2 * PAD;
  const x0 = left - PAD * CELL;
  const zz0 = z0 - PAD * CELL;
  const seedRun = new Int32Array(W * H).fill(-1);
  const seedIdx = new Int32Array(W * H);
  const d2 = new Float64Array(W * H).fill(Infinity);
  net.runs.forEach((run, r) => {
    const pts = run.points;
    for (let i = 0; i < pts.length; i++) {
      const c = Math.round((pts[i].x - x0) / CELL);
      const q = Math.round((pts[i].z - zz0) / CELL);
      if (c < 0 || q < 0 || c >= W || q >= H) continue;
      const o = q * W + c;
      const d = (x0 + c * CELL - pts[i].x) ** 2 + (zz0 + q * CELL - pts[i].z) ** 2;
      if (d < d2[o]) {
        d2[o] = d;
        seedRun[o] = r;
        seedIdx[o] = i;
      }
    }
  });
  const take = (o: number, from: number, cx: number, cz: number): void => {
    const r = seedRun[from];
    if (r < 0) return;
    const p = net.runs[r].points[seedIdx[from]];
    const d = (cx - p.x) ** 2 + (cz - p.z) ** 2;
    if (d < d2[o]) {
      d2[o] = d;
      seedRun[o] = r;
      seedIdx[o] = seedIdx[from];
    }
  };
  for (let q = 0; q < H; q++) {
    for (let c = 0; c < W; c++) {
      const o = q * W + c;
      const cx = x0 + c * CELL;
      const cz = zz0 + q * CELL;
      if (c > 0) take(o, o - 1, cx, cz);
      if (q > 0) {
        take(o, o - W, cx, cz);
        if (c > 0) take(o, o - W - 1, cx, cz);
        if (c + 1 < W) take(o, o - W + 1, cx, cz);
      }
    }
  }
  for (let q = H - 1; q >= 0; q--) {
    for (let c = W - 1; c >= 0; c--) {
      const o = q * W + c;
      const cx = x0 + c * CELL;
      const cz = zz0 + q * CELL;
      if (c + 1 < W) take(o, o + 1, cx, cz);
      if (q + 1 < H) {
        take(o, o + W, cx, cz);
        if (c + 1 < W) take(o, o + W + 1, cx, cz);
        if (c > 0) take(o, o + W - 1, cx, cz);
      }
    }
  }
  const n = cols * rows;
  const dist = new Float64Array(n).fill(Infinity);
  const run = new Int32Array(n).fill(-1);
  const heading = new Float64Array(n);
  const width = new Float64Array(n);
  const arc = new Float64Array(n);
  for (let q = 0; q < rows; q++) {
    for (let c = 0; c < cols; c++) {
      const o = (q + PAD) * W + c + PAD;
      const r = seedRun[o];
      if (r < 0) continue;
      const p = net.runs[r].points[seedIdx[o]];
      const k = q * cols + c;
      dist[k] = Math.sqrt(d2[o]);
      run[k] = r;
      heading[k] = p.heading;
      width[k] = p.width;
      arc[k] = p.s;
    }
  }
  return { dist, run, heading, width, arc };
}

/** A point of a route. */
export type RoutePoint = { readonly x: number; readonly z: number };

/** A lane's route and the join it ends on: the run (−1 at a lift's
 * bottom station, `goal`). */
export type LaneRoute = { route: RoutePoint[]; run: number; x: number; z: number };

/** What a lane's search may be asked beyond its start: a lift's bottom
 * station to run to instead of a piste (`goal`), the least plan distance
 * to its join (`least`, `road.reach`'s own by default), and the stretch of
 * the map to search (`box`: across from `x0` to `x1`, down to `z1`), and
 * ground it may not cross (`keepOff`). */
export type LaneAsk = {
  goal?: RoutePoint;
  least?: number;
  box?: { x0: number; x1: number; z1: number };
  /** Ground the route may not cross — a station's pad (R26). */
  keepOff?: (x: number, z: number) => boolean;
};

/** How near a lift's bottom station a route must come to end at it, m. */
const GOAL_REACH = 12;

/** R27 — the route a lane from (x0, z0) is laid along to the cheapest join
 * on a piste `may` joins — never in the first or the last stretch of it,
 * where it leaves its top or comes into the village — or, with a `goal`, to
 * that lift's bottom station (`LaneAsk`); within `road.reach` down the
 * map, the way `side` sends it (+1 toward +x) preferred. Null where none
 * keeps a lane's pitch. */
export function routeLane(
  ground: Heightfield,
  net: NetIndex,
  x0: number,
  z0: number,
  side: number,
  may: (run: number) => boolean,
  opts: LaneAsk = {},
): LaneRoute | null {
  const { goal, least = RR.road.reach.min, box, keepOff } = opts;
  const top = ground.originZ + (ground.rows - 1) * ground.cell;
  const zEnd = Math.min(top - 200, z0 + RR.road.reach.max, box ? box.z1 : Infinity);
  const rows = Math.max(1, Math.floor((zEnd - z0) / CELL));
  const edge = ground.originX + (ground.cols - 1) * ground.cell;
  const left = Math.max(0, x0 - RR.road.reach.max * 1.5, box ? box.x0 : 0);
  const right = Math.min(edge, x0 + RR.road.reach.max * 1.5, box ? box.x1 : Infinity);
  const cols = Math.floor((right - left) / CELL) + 1;
  const xAt = (c: number): number => left + c * CELL;
  const zAt = (r: number): number => z0 + r * CELL;
  // The band every step is held to: never so flat the grading has to cut
  // it down to R8's least fall, never past the lane's ceiling.
  const lo = R.track.minGrade * 1.15;
  const hi = RR.road.grade * 0.95;
  const n = (rows + 1) * cols;
  const h = new Float64Array(n);
  const steep = new Float64Array(n);
  const beside = new Float64Array(n);
  const runHeading = new Float64Array(n);
  const atTop = new Uint8Array(n);
  const onRun = new Int32Array(n).fill(-1);
  const laned = new Uint8Array(n);
  const atGoal = new Uint8Array(n);
  const nearest = nearestRaster(net, left, z0, cols, rows + 1);
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = xAt(c);
      const z = zAt(r);
      const o = r * cols + c;
      h[o] = sampleField(ground, x, z);
      const gx = (sampleField(ground, x + 6, z) - sampleField(ground, x - 6, z)) / 12;
      const gz = (sampleField(ground, x, z + 6) - sampleField(ground, x, z - 6)) / 12;
      steep[o] = hypot(gx, gz);
      const d = nearest.dist[o];
      const near = clearance(RR.road.width.max, nearest.width[o]) + MARGIN;
      beside[o] = d < near ? 1 - d / near : 0;
      runHeading[o] = nearest.heading[o];
      atTop[o] = hypot(x - x0, z - z0) < TOP_FREE ? 1 : 0;
      const r0 = nearest.run[o];
      if (d < ON_LINE && may(r0) && joinable(net, r0, nearest.arc[o])) onRun[o] = r0;
      if (goal && hypot(x - goal.x, z - goal.z) < GOAL_REACH) atGoal[o] = 1;
      if (keepOff && keepOff(x, z)) laned[o] = 1;
    }
  }
  // THE LANES LAID BEFORE: a lane never crosses or runs beside another
  // (R27) — the one pressed after would cut through the other's bench — so
  // every cell within the clearance of one is closed to the route.
  const reachLane = Math.ceil((clearance(RR.road.width.max, RR.road.width.max) + MARGIN) / CELL);
  for (const other of net.runs) {
    if (!other.road) continue;
    for (const q of other.points) {
      const qc = Math.round((q.x - left) / CELL);
      const qr = Math.round((q.z - z0) / CELL);
      for (let r = Math.max(0, qr - reachLane); r <= Math.min(rows, qr + reachLane); r++) {
        for (let c = Math.max(0, qc - reachLane); c < Math.min(cols, qc + reachLane + 1); c++) {
          if ((c - qc) ** 2 + (r - qr) ** 2 <= reachLane * reachLane) laned[r * cols + c] = 1;
        }
      }
    }
  }
  // THE SEARCH. A step is one of `MOVES` — down the map, across it, or
  // along a row on the contour — and the cheapest way to a cell ARRIVING ON
  // A HEADING is found row by row: a row's steps along it swept left to
  // right for the ones heading +x and back for the ones heading −x (a lane
  // never reverses on the spot, so neither sweep feeds the other), then
  // every step down pushed on to the rows below. No step turns tighter
  // than a lane's bend (R6), and none climbs back up the map (R27).
  const M = MOVES.length;
  const cost = new Float64Array(n * M).fill(Infinity);
  const from = new Int32Array(n * M).fill(-1);
  const c0 = Math.round((x0 - left) / CELL);
  for (let m = 0; m < M; m++) cost[c0 * M + m] = 0;
  let best = -1;
  let bestScore = Infinity;
  const relax = (o: number, m0: number, m: number, r: number, c: number): void => {
    const base = cost[o * M + m0];
    if (base === Infinity) return;
    const mv = MOVES[m];
    const cc = c + mv.dx;
    const rr = r + mv.dz;
    if (cc < 0 || cc >= cols || rr > rows) return;
    const turn = TURN[m0 * M + m];
    // Off the start any way; then never tighter than the bend.
    if (o !== c0 && turn > TURN_MOST[m0 * M + m]) return;
    const p = rr * cols + cc;
    if (laned[p]) return;
    if (beside[p] > 0 && !atTop[p] && Math.abs(angleDiff(mv.heading, runHeading[p])) < SQUARE)
      return;
    const pitch = (h[o] - h[p]) / mv.length;
    if (pitch < lo * HARD.min || pitch > hi * HARD.max) return;
    const off = pitch < lo ? lo - pitch : pitch > hi ? pitch - hi : 0;
    const step =
      mv.length *
        (1 +
          off * PITCH_COST +
          Math.max(0, steep[p] - CROSS_FREE) * CROSS_COST +
          beside[p] * BESIDE_COST) +
      turn * TURN_COST;
    const k = p * M + m;
    if (base + step < cost[k]) {
      cost[k] = base + step;
      from[k] = o * M + m0;
    }
  };
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c < cols; c++) {
      const o = r * cols + c;
      for (let m0 = 0; m0 < M; m0++) if (m0 !== WEST) relax(o, m0, EAST, r, c);
    }
    for (let c = cols - 1; c >= 0; c--) {
      const o = r * cols + c;
      for (let m0 = 0; m0 < M; m0++) if (m0 !== EAST) relax(o, m0, WEST, r, c);
    }
    // A join on this row: on a piste's line, a lane's length from the start.
    for (let c = 0; c < cols; c++) {
      const o = r * cols + c;
      if (onRun[o] < 0 && !atGoal[o]) continue;
      const dx = xAt(c) - x0;
      const dist = hypot(dx, zAt(r) - z0);
      if (dist < least) continue;
      for (let m = 0; m < M; m++) {
        const k = o * M + m;
        if (cost[k] === Infinity) continue;
        const score = cost[k] + (Math.sign(dx) === side ? 0 : OTHER_WAY * dist);
        if (score < bestScore) {
          bestScore = score;
          best = k;
        }
      }
    }
    if (r === rows) break;
    // Every step costs at least its length: once nothing on this row, nor
    // on the rows below it a step from above already reaches, is cheaper
    // than the best join, nothing further down can be.
    let cheapest = Infinity;
    const reachRow = Math.min(rows, r + DEEPEST);
    for (let k = r * cols * M; k < (reachRow + 1) * cols * M; k++)
      if (cost[k] < cheapest) cheapest = cost[k];
    if (cheapest >= bestScore) break;
    for (let c = 0; c < cols; c++) {
      const o = r * cols + c;
      for (let m0 = 0; m0 < M; m0++) {
        if (cost[o * M + m0] === Infinity) continue;
        for (const m of DOWN) relax(o, m0, m, r, c);
      }
    }
  }
  if (best < 0) return null;
  const route: RoutePoint[] = [];
  for (let k = best; k >= 0; k = from[k]) {
    const o = Math.floor(k / M);
    route.push({ x: xAt(o % cols), z: zAt(Math.floor(o / cols)) });
  }
  route.reverse();
  const end = route[route.length - 1];
  const o = Math.floor(best / M);
  if (goal && atGoal[o]) return { route, run: -1, x: end.x, z: end.z };
  return { route, run: onRun[o], x: end.x, z: end.z };
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RESCUE BY SNOWMOBILE, PLANNED — where an INJURED skier lies with no
// patch near him an air ambulance can set down on (a steep face, the
// woods: `pwa/src/game/rescue-plan.ts`'s `fitToLand`), the ski patrol
// comes for him on two snowmobiles, the first towing an empty rescue
// toboggan. They drive up from the nearest patrol post (a lift's top or
// bottom station, or the snowmobile's own spot at the bottom), stop beside
// him — the first machine pointed down the way it will leave, as a patrol
// parks before it tends anyone, the toboggan trailing it to his side —
// load him into the toboggan, and tow him down to the bottom of the
// mountain at a crawl, the second machine behind.
//
// Everything here is a pure function of the map and where he lay
// (`planSledRescue`), worked out once when the call is made and handed to
// every run after in the call (`RescueCall.sleds`): the ways driven, each
// point with the call's clock it is passed at. Where each machine and the
// toboggan are at a moment, given the machines the player has stolen, is
// `rescue-sled.ts`'s. Nothing here draws from the stream.
//
// THE WAY is searched on a grid over the map (`RESCUE_SLEDS.route`): a
// cell is open when no trunk, post, wall or rock column stands within the
// room a machine needs, an edge between two cells is driven when its grade
// is one a loaded patrol machine climbs, and its cost is its length, more
// on a grade and less on a groomed run (a patrol drives the pistes where
// it can). The cheapest way is pulled straight where the line stays open,
// then laid out every two metres and smoothed into a machine's curve.

import { clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { Heap } from "../mapgen/ski-routes.ts";
import { RESCUE_SLEDS } from "./defs/rescue-sleds.ts";
import { solidsOf } from "./posts.ts";
import { sledSpotOf } from "./sled-pad.ts";
import type { Level } from "../mapgen/types.ts";

const K = RESCUE_SLEDS;

/** A WAY DRIVEN: points every ~2 m (world x, z), each one's arc from the
 * start (m) and the seconds after setting out it is passed at. */
export type SledRoute = {
  x: number[];
  z: number[];
  s: number[];
  t: number[];
  length: number;
  time: number;
};

/** Where a machine (or the toboggan) stands: its middle and heading. */
export type SledPark = { x: number; z: number; heading: number };

/** THE RESCUE BY SNOWMOBILE, the call's clock from 0 (the call made):
 * where each machine stops (`park[0]` the one that tows) and where the
 * toboggan is left beside him; each machine's way up and the call's clock
 * it sets out and stops at; when the convoy leaves; the tow's way down to
 * the bottom; the second machine's way down behind it; the second
 * machine's way up to the toboggan, should the first be gone when it is
 * time to leave; and when it is all over with nothing taken. */
export type RescueSledPlan = {
  park: [SledPark, SledPark];
  toboggan: SledPark;
  arrive: [SledRoute, SledRoute];
  start: [number, number];
  parked: [number, number];
  go: number;
  down: SledRoute;
  follow: SledRoute;
  hitch: SledRoute;
  gone: number;
};

/** THE GRID a map's ways are searched on, kept per map: each cell's
 * snow height and packed share, and the fine marks of how near a solid
 * stands (bit 1 within the tight room, bit 2 within the full room). */
type Grid = {
  n: number;
  cell: number;
  y: Float32Array;
  packed: Float32Array;
  fn: number;
  fine: number;
  marks: Uint8Array;
};

const grids = new WeakMap<Level, Grid>();

function gridOf(level: Level): Grid {
  let g = grids.get(level);
  if (g) return g;
  const cell = K.route.cell;
  const n = Math.floor(level.size / cell) + 1;
  const y = new Float32Array(n * n);
  const packed = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      y[j * n + i] = level.groundAt(i * cell, j * cell);
      packed[j * n + i] = level.packedAt(i * cell, j * cell);
    }
  }
  const fine = 2;
  const fn = Math.ceil(level.size / fine) + 1;
  const marks = new Uint8Array(fn * fn);
  for (const t of solidsOf(level)) {
    if (t.height <= 0 || t.radius <= 0) continue;
    stamp(marks, fn, fine, t.x, t.z, t.radius + K.route.room, 2);
    stamp(marks, fn, fine, t.x, t.z, t.radius + K.route.tight, 1);
  }
  g = { n, cell, y, packed, fn, fine, marks };
  grids.set(level, g);
  return g;
}

function stamp(
  marks: Uint8Array,
  fn: number,
  fine: number,
  x: number,
  z: number,
  r: number,
  bit: number,
): void {
  const i0 = Math.max(0, Math.floor((x - r) / fine));
  const i1 = Math.min(fn - 1, Math.ceil((x + r) / fine));
  const j0 = Math.max(0, Math.floor((z - r) / fine));
  const j1 = Math.min(fn - 1, Math.ceil((z + r) / fine));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      if (hypot(i * fine - x, j * fine - z) <= r) marks[j * fn + i] |= bit;
    }
  }
}

/** Whether (x, z) is clear of every solid by the room `bit` asks. */
function clearAt(g: Grid, x: number, z: number, bit: number): boolean {
  const i = Math.round(x / g.fine);
  const j = Math.round(z / g.fine);
  if (i < 0 || j < 0 || i >= g.fn || j >= g.fn) return false;
  return (g.marks[j * g.fn + i] & bit) === 0;
}

/** Whether the straight line a–b is clear, sampled every fine cell. */
function lineClear(g: Grid, ax: number, az: number, bx: number, bz: number, bit: number): boolean {
  const d = hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(d / g.fine));
  for (let k = 0; k <= n; k++) {
    if (!clearAt(g, ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n, bit)) return false;
  }
  return true;
}

/** Whether (x, z) is in from the map's edge. */
function inside(level: Level, x: number, z: number): boolean {
  const e = K.route.edge;
  return x >= e && z >= e && x <= level.size - e && z <= level.size - e;
}

const STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** The open cell nearest (x, z), searched out a few rings, or −1. */
function snap(level: Level, g: Grid, x: number, z: number, bit: number): number {
  const ci = Math.round(x / g.cell);
  const cj = Math.round(z / g.cell);
  let best = -1;
  let bestD = Infinity;
  for (let r = 0; r <= 4 && best < 0; r++) {
    for (let j = cj - r; j <= cj + r; j++) {
      for (let i = ci - r; i <= ci + r; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
        if (i < 0 || j < 0 || i >= g.n || j >= g.n) continue;
        const px = i * g.cell;
        const pz = j * g.cell;
        if (!inside(level, px, pz) || !clearAt(g, px, pz, bit)) continue;
        const d = hypot(px - x, pz - z);
        if (d < bestD) {
          bestD = d;
          best = j * g.n + i;
        }
      }
    }
  }
  return best;
}

/**
 * THE CHEAPEST WAY over the grid from (x, z) to the first of `targets`
 * reached (each a cell), as world points from (x, z) to that cell —
 * or null where none is reached. `bit` is the room kept.
 */
function search(
  level: Level,
  g: Grid,
  from: number,
  targets: ReadonlySet<number>,
  bit: number,
): number[] | null {
  const N = g.n * g.n;
  const cost = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const done = new Uint8Array(N);
  const heap = new Heap();
  cost[from] = 0;
  heap.push(from, 0);
  while (heap.size) {
    const k = heap.pop();
    if (done[k]) continue;
    done[k] = 1;
    if (targets.has(k)) {
      const path: number[] = [];
      for (let at = k; at >= 0; at = prev[at]) path.push(at);
      return path.reverse();
    }
    const i = k % g.n;
    const j = (k - i) / g.n;
    const x = i * g.cell;
    const z = j * g.cell;
    for (const [di, dj] of STEPS) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= g.n || nj >= g.n) continue;
      const nk = nj * g.n + ni;
      if (done[nk]) continue;
      const nx = ni * g.cell;
      const nz = nj * g.cell;
      if (!inside(level, nx, nz)) continue;
      const len = hypot(nx - x, nz - z);
      const grade = Math.abs(g.y[nk] - g.y[k]) / len;
      if (grade > K.route.steepest) continue;
      if (!lineClear(g, x, z, nx, nz, bit)) continue;
      const piste = (g.packed[k] + g.packed[nk]) / 2;
      const c = cost[k] + len * (1 + K.route.grade * grade * grade) * (1 - K.route.piste * piste);
      if (c < cost[nk]) {
        cost[nk] = c;
        prev[nk] = k;
        heap.push(nk, c);
      }
    }
  }
  return null;
}

/** A grid path as world points, pulled straight wherever the line between
 * two of them stays open and on a grade a machine drives. */
function pull(
  level: Level,
  g: Grid,
  path: readonly number[],
  bit: number,
): { x: number; z: number }[] {
  const pts = path.map((k) => ({ x: (k % g.n) * g.cell, z: Math.floor(k / g.n) * g.cell }));
  const out = [pts[0]];
  let a = 0;
  while (a < pts.length - 1) {
    let b = a + 1;
    for (let c = pts.length - 1; c > a + 1; c--) {
      if (straight(level, g, pts[a], pts[c], bit)) {
        b = c;
        break;
      }
    }
    out.push(pts[b]);
    a = b;
  }
  return out;
}

/** Whether a machine drives straight from a to b: open all the way, and no
 * stretch of it steeper than it climbs. */
function straight(
  level: Level,
  g: Grid,
  a: { x: number; z: number },
  b: { x: number; z: number },
  bit: number,
): boolean {
  if (!lineClear(g, a.x, a.z, b.x, b.z, bit)) return false;
  const d = hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(d / 4));
  let y = level.groundAt(a.x, a.z);
  for (let k = 1; k <= n; k++) {
    const x = a.x + ((b.x - a.x) * k) / n;
    const z = a.z + ((b.z - a.z) * k) / n;
    const yk = level.groundAt(x, z);
    if (Math.abs(yk - y) / (d / n) > K.route.steepest) return false;
    y = yk;
  }
  return true;
}

/** Points laid every `STEP` m along a polyline and smoothed by a running
 * mean (the ends pinned), so no bend is tighter than a machine turns. */
const STEP = 2;

function lay(raw: readonly { x: number; z: number }[]): { x: number[]; z: number[]; s: number[] } {
  let px: number[] = [raw[0].x];
  let pz: number[] = [raw[0].z];
  for (let i = 1; i < raw.length; i++) {
    const a = raw[i - 1];
    const b = raw[i];
    const n = Math.max(1, Math.ceil(hypot(b.x - a.x, b.z - a.z) / STEP));
    for (let k = 1; k <= n; k++) {
      px.push(a.x + ((b.x - a.x) * k) / n);
      pz.push(a.z + ((b.z - a.z) * k) / n);
    }
  }
  const w = 3;
  for (let it = 0; it < 3; it++) {
    const nx: number[] = [];
    const nz: number[] = [];
    for (let i = 0; i < px.length; i++) {
      const r = Math.min(w, i, px.length - 1 - i);
      let sx = 0;
      let sz = 0;
      for (let k = i - r; k <= i + r; k++) {
        sx += px[k];
        sz += pz[k];
      }
      nx.push(sx / (2 * r + 1));
      nz.push(sz / (2 * r + 1));
    }
    px = nx;
    pz = nz;
  }
  const s = [0];
  for (let i = 1; i < px.length; i++)
    s.push(s[i - 1] + hypot(px[i] - px[i - 1], pz[i] - pz[i - 1]));
  return { x: px, z: pz, s };
}

/** THE TIMES a way is driven in: each point's fastest (the grade, the
 * bend), sped up to and slowed down from it at the machine's rates, from a
 * stop to a stop. `towing`: the casualty behind it. */
function time(
  level: Level,
  way: { x: number[]; z: number[]; s: number[] },
  towing: boolean,
): SledRoute {
  const P = K.pace;
  const n = way.x.length;
  const v = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    const ds = Math.max(0.5, way.s[b] - way.s[a]);
    const grade = (level.groundAt(way.x[b], way.z[b]) - level.groundAt(way.x[a], way.z[a])) / ds;
    let most = towing
      ? clamp(P.tow - P.towGrade * Math.abs(grade), P.towLeast, P.tow)
      : clamp(P.up - P.climb * Math.max(0, grade) - 4 * Math.max(0, -grade), P.upLeast, P.up);
    if (i > 0 && i < n - 1) {
      const h0 = Math.atan2(way.x[i] - way.x[a], way.z[i] - way.z[a]);
      const h1 = Math.atan2(way.x[b] - way.x[i], way.z[b] - way.z[i]);
      const bend = Math.abs(Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0))) / (ds / 2);
      if (bend > 1e-4) most = Math.min(most, Math.sqrt(P.lateral / bend));
    }
    v[i] = most;
  }
  v[0] = 0;
  v[n - 1] = 0;
  const up = towing ? P.towAccel : P.accel;
  const down = towing ? P.towBrake : P.brake;
  for (let i = 1; i < n; i++) {
    v[i] = Math.min(v[i], Math.sqrt(v[i - 1] ** 2 + 2 * up * (way.s[i] - way.s[i - 1])));
  }
  for (let i = n - 2; i >= 0; i--) {
    v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * down * (way.s[i + 1] - way.s[i])));
  }
  const t = [0];
  for (let i = 1; i < n; i++) {
    const avg = Math.max(0.3, (v[i - 1] + v[i]) / 2);
    t.push(t[i - 1] + (way.s[i] - way.s[i - 1]) / avg);
  }
  return { x: way.x, z: way.z, s: way.s, t, length: way.s[n - 1], time: t[n - 1] };
}

/** The downhill way at (x, z) over a reach, horizontal, unit, or null on
 * the flat. */
function fallAt(level: Level, x: number, z: number, d: number): { x: number; z: number } | null {
  const gx = level.groundAt(x - d, z) - level.groundAt(x + d, z);
  const gz = level.groundAt(x, z - d) - level.groundAt(x, z + d);
  const m = hypot(gx, gz);
  return m / (2 * d) < 0.02 ? null : { x: gx / m, z: gz / m };
}

/** Where they stop for him lying at `spot`, the first machine pointed
 * along `h`: the toboggan's middle ahead of him and out to one side, the
 * first machine ahead of it on its tow bar, the second out beside the
 * first, and the straight the first comes in on. Null where any of them
 * stands in a solid or over the map's edge. */
function parking(
  level: Level,
  g: Grid,
  spot: { x: number; z: number },
  h: number,
  side: number,
  ahead: number,
) {
  const P = K.park;
  const f = { x: Math.sin(h), z: Math.cos(h) };
  const r = { x: f.z * side, z: -f.x * side };
  const tob = { x: spot.x + f.x * ahead + r.x * P.out, z: spot.z + f.z * ahead + r.z * P.out };
  const a = { x: tob.x + f.x * K.trail, z: tob.z + f.z * K.trail };
  const b = { x: a.x + r.x * P.beside, z: a.z + r.z * P.beside };
  const w = { x: a.x - f.x * P.inRun, z: a.z - f.z * P.inRun };
  for (const p of [tob, a, b, w]) {
    if (!inside(level, p.x, p.z) || !clearAt(g, p.x, p.z, 2)) return null;
  }
  if (!lineClear(g, w.x, w.z, a.x, a.z, 1)) return null;
  return { tob, a, b, w, f, heading: h };
}

/** The patrol's posts: every lift's top and bottom station and the
 * snowmobile's spot at the bottom. */
function posts(level: Level): { x: number; z: number }[] {
  const out = [];
  for (const l of level.resort?.lifts ?? []) out.push(l.top, l.bottom);
  const spot = sledSpotOf(level);
  out.push(spot);
  return out.map((p) => ({ x: p.x, z: p.z }));
}

/** A way searched from (x, z) to the cheapest of `goals`, as points from
 * (x, z) to that goal — or null. */
function wayTo(
  level: Level,
  g: Grid,
  from: { x: number; z: number },
  goals: readonly { x: number; z: number }[],
  bit: number,
): { x: number; z: number }[] | null {
  const start = snap(level, g, from.x, from.z, bit);
  if (start < 0) return null;
  const targets = new Set<number>();
  for (const p of goals) {
    const k = snap(level, g, p.x, p.z, bit);
    if (k >= 0) targets.add(k);
  }
  if (!targets.size) return null;
  const path = search(level, g, start, targets, bit);
  if (!path) return null;
  return [from, ...pull(level, g, path, bit)];
}

/**
 * THE RESCUE BY SNOWMOBILE for a skier found injured lying at `spot`, or
 * null where no patrol machine can reach him (`rescue-plan.ts`'s air
 * ambulance then sets down wherever it can).
 */
export function planSledRescue(
  level: Level,
  spot: { x: number; z: number },
): RescueSledPlan | null {
  const g = gridOf(level);
  const base = sledSpotOf(level);
  const fall =
    fallAt(level, spot.x, spot.z, 30) ??
    (() => {
      const dx = base.x - spot.x;
      const dz = base.z - spot.z;
      const d = hypot(dx, dz) || 1;
      return { x: dx / d, z: dz / d };
    })();
  const h0 = Math.atan2(fall.x, fall.z);
  let at: NonNullable<ReturnType<typeof parking>> | null = null;
  outer: for (const turn of [0, 0.35, -0.35, 0.7, -0.7]) {
    for (const ahead of [K.park.ahead, K.park.ahead - 2, K.park.ahead + 3]) {
      for (const side of [1, -1]) {
        at = parking(level, g, spot, h0 + turn, side, ahead);
        if (at) break outer;
      }
    }
  }
  if (!at) return null;
  for (const bit of [2, 1]) {
    const upWay = wayTo(level, g, at.w, posts(level), bit);
    const downStart = { x: at.a.x + at.f.x * 10, z: at.a.z + at.f.z * 10 };
    const lead = clearAt(g, downStart.x, downStart.z, bit) ? downStart : at.a;
    const downWay = wayTo(level, g, lead, [base], bit);
    if (!upWay || !downWay) continue;
    return assemble(level, at, upWay.reverse(), downWay, base);
  }
  return null;
}

/** The plan's ways and clocks off where they park, the way up (from the
 * post to the in-run's start) and the way down (from the first machine's
 * lead-out to the bottom). */
function assemble(
  level: Level,
  at: NonNullable<ReturnType<typeof parking>>,
  up: { x: number; z: number }[],
  down: { x: number; z: number }[],
  base: { x: number; z: number },
): RescueSledPlan {
  const C = K.convoy;
  // THE FIRST, the toboggan behind it: up its way, in on the straight.
  const arriveA = time(level, lay([...up, at.a]), false);
  // THE SECOND on the first's tracks, then out beside it.
  const cut = Math.max(0, arriveA.length - K.park.inRun - C.peel);
  const shared: { x: number; z: number }[] = [];
  for (let i = 0; i < arriveA.s.length && arriveA.s[i] <= cut; i += 4) {
    shared.push({ x: arriveA.x[i], z: arriveA.z[i] });
  }
  if (shared.length < 2) shared.push({ x: arriveA.x[0], z: arriveA.z[0] });
  const bIn = { x: at.b.x - at.f.x * K.park.inRun, z: at.b.z - at.f.z * K.park.inRun };
  const arriveB = time(level, lay([...shared, bIn, at.b]), false);
  const startA = 0;
  const startB = C.start;
  const parkedA = startA + arriveA.time;
  const parkedB = startB + arriveB.time;
  const go = Math.max(parkedA, parkedB) + K.work;
  const downWay = time(level, lay(down[0] === at.a ? down : [at.a, ...down]), true);
  // THE SECOND DOWN: out from beside the first onto its tracks, a little
  // way down them.
  const join = Math.min(downWay.s.length - 1, Math.max(1, Math.round(downWay.s.length * 0.08)));
  const tail: { x: number; z: number }[] = [];
  for (let i = join; i < downWay.s.length; i += 4) tail.push({ x: downWay.x[i], z: downWay.z[i] });
  tail.push({ x: base.x, z: base.z });
  const follow = time(
    level,
    lay([at.b, { x: at.b.x + at.f.x * 8, z: at.b.z + at.f.z * 8 }, ...tail]),
    false,
  );
  // THE SECOND TO THE TOBOGGAN: round and in on the first's straight.
  const r = { x: at.a.x - at.b.x, z: at.a.z - at.b.z };
  const hitch = time(
    level,
    lay([
      at.b,
      { x: at.b.x + at.f.x * 8 - r.x * 0.5, z: at.b.z + at.f.z * 8 - r.z * 0.5 },
      { x: at.b.x + at.f.x * 4 - r.x * 1.6, z: at.b.z + at.f.z * 4 - r.z * 1.6 },
      { x: at.w.x, z: at.w.z },
      at.a,
    ]),
    false,
  );
  const gone = go + Math.max(downWay.time, C.follow + follow.time) + K.over;
  return {
    park: [
      { x: at.a.x, z: at.a.z, heading: at.heading },
      { x: at.b.x, z: at.b.z, heading: at.heading },
    ],
    toboggan: { x: at.tob.x, z: at.tob.z, heading: at.heading },
    arrive: [arriveA, arriveB],
    start: [startA, startB],
    parked: [parkedA, parkedB],
    go,
    down: downWay,
    follow,
    hitch,
    gone,
  };
}

/** WHERE ON A WAY at `t` s after setting out: its middle and heading (the
 * way's own, a few metres either side, so a corner is turned, not
 * snapped), and how fast, m/s. Before it, at its start; after, at its
 * end. `back`: that far behind it along the way (the toboggan on its
 * tow bar), past its start straight back along its first heading. */
export function onRoute(
  r: SledRoute,
  t: number,
  out: SledPark & { speed: number },
  back = 0,
): SledPark & { speed: number } {
  const n = r.t.length;
  let s: number;
  let speed = 0;
  if (t <= 0) s = 0;
  else if (t >= r.time) s = r.length;
  else {
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (r.t[mid] <= t) lo = mid;
      else hi = mid;
    }
    const span = r.t[hi] - r.t[lo] || 1;
    const u = (t - r.t[lo]) / span;
    s = r.s[lo] + (r.s[hi] - r.s[lo]) * u;
    speed = (r.s[hi] - r.s[lo]) / span;
  }
  at(r, s - back, out);
  out.speed = speed;
  return out;
}

/** The point and heading at arc `s` on a way (before its start straight
 * back along its first heading). */
function at(r: SledRoute, s: number, out: SledPark): void {
  const n = r.s.length;
  if (n < 2) {
    out.x = r.x[0];
    out.z = r.z[0];
    return;
  }
  if (s <= 0) {
    const h = Math.atan2(r.x[1] - r.x[0], r.z[1] - r.z[0]);
    out.heading = h;
    out.x = r.x[0] + Math.sin(h) * s;
    out.z = r.z[0] + Math.cos(h) * s;
    return;
  }
  let lo = 0;
  let hi = n - 1;
  if (s >= r.length) lo = n - 2;
  else {
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (r.s[mid] <= s) lo = mid;
      else hi = mid;
    }
  }
  hi = lo + 1;
  const span = r.s[hi] - r.s[lo] || 1;
  const u = clamp((s - r.s[lo]) / span, 0, 1);
  out.x = r.x[lo] + (r.x[hi] - r.x[lo]) * u;
  out.z = r.z[lo] + (r.z[hi] - r.z[lo]) * u;
  const a = Math.max(0, lo - 1);
  const b = Math.min(n - 1, hi + 1);
  out.heading = Math.atan2(r.x[b] - r.x[a], r.z[b] - r.z[a]);
}

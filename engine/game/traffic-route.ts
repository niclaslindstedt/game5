// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WAYS THE VILLAGE'S TRAFFIC DRIVES (`traffic.ts`) — a route through
// the village's lanes (`village-furniture.ts`) laid as one line the REAR
// AXLE follows: each lane's line between the junctions, trimmed short of
// the crossing carriageway and joined to the next by a curve round the
// corner, a bay's turn in off its aisle, and the speed it is driven at
// along it (the street's top speed, eased for every bend by the sideways
// pull it takes, pulled away from and slowed into), integrated once into
// the time it reaches every point — so where a vehicle is at any moment is
// a pure function of that moment. With the rear axle on the line and the
// body along it, the front swings wide of a corner as a real car's does,
// and the wheels' turn is the bend's (`tan δ = wheelbase × curvature`).
//
// Pure functions of the village's plan; nothing here draws on any stream.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Level } from "../mapgen/types.ts";
import type { Drive } from "./defs/traffic.ts";
import { TRAFFIC as T } from "./defs/traffic.ts";
import type { Village } from "./village.ts";
import { offsetLine, trimAt, type Lane } from "./village-furniture.ts";
import { streetAt, type Street, type StreetPoint } from "./village-streets.ts";

/** How finely a route's line is laid, m. */
export const DS = 0.5;

/** A ROUTE'S LINE, every `DS` m: where (x, z), the way it runs, its
 * curvature (smoothed over a few metres, signed: positive turning the
 * way the heading grows), the lane each point is on (an index into the
 * plan's lanes, −1 between them), the top speed there and what of a turn
 * lies ahead (the heading's change over the next `TRAFFIC.signal.ahead`
 * m, rad). */
export type Path = {
  n: number;
  x: Float64Array;
  z: Float64Array;
  h: Float64Array;
  k: Float64Array;
  lane: Int16Array;
  top: Float64Array;
  turn: Float64Array;
  closed: boolean;
};

/** A stretch of the route on one lane: the lane, and its street's arc from
 * `s0` to `s1` (falling when the lane runs against the street). */
export type Visit = { lane: number; s0: number; s1: number };

/** A raw point of a route before it is laid every `DS` m. */
type Raw = { x: number; z: number; lane: number; top: number };

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** What a vehicle on a lane keeps to: the lane's middle, or a cyclist's
 * line in from the carriageway's edge. */
export type Keep = "middle" | "edge";

/** The lateral off a street's centreline a vehicle keeping `keep` on lane
 * `ln` drives at (the lane's side: `besidePoint`'s negative for the way
 * the street runs, positive back). */
export function laneOffset(st: Street, ln: Lane, keep: Keep): number {
  const off = keep === "middle" ? st.section.lane / 2 : st.section.lane - T.bikes.edge;
  return ln.dir === 1 ? -off : off;
}

/** The top speed on a street of `kind` for a driver's `drive`. */
export function topOf(kind: Street["kind"], drive: Drive): number {
  return kind === "aisle" ? drive.aisle : kind === "road" ? drive.road : drive.street;
}

/** How far short of the junction at its `end` (0 the street's first, 1
 * its last) a lane on `st` is trimmed: past the crossing carriageway. */
export function trimOf(v: Village, st: Street, end: 0 | 1): number {
  const j = v.junctions[end === 0 ? st.from : st.to];
  if (j.exit) return 0;
  return trimAt(v, st, end).road + T.trim;
}

/** A visit's whole lane: from past the junction it leaves to short of the
 * one it reaches. */
export function wholeVisit(v: Village, lanes: readonly Lane[], i: number): Visit {
  const ln = lanes[i];
  const st = streetOf(v, ln.street);
  const a = trimOf(v, st, 0);
  const b = st.length - trimOf(v, st, 1);
  const lo = Math.min(a, (a + b) / 2);
  const hi = Math.max(b, (a + b) / 2);
  return ln.dir === 1 ? { lane: i, s0: lo, s1: hi } : { lane: i, s0: hi, s1: lo };
}

const streets = new WeakMap<Village, Map<string, Street>>();
export function streetOf(v: Village, id: string): Street {
  let m = streets.get(v);
  if (!m) {
    m = new Map(v.streets.map((s) => [s.id, s]));
    streets.set(v, m);
  }
  return m.get(id)!;
}

/** The street's arc nearest (x, z). */
export function arcNearest(st: Street, x: number, z: number): number {
  let best = Infinity;
  let at = 0;
  const p: StreetPoint = { x: 0, y: 0, z: 0, s: 0, heading: 0 };
  for (let s = 0; s <= st.length; s += 0.5) {
    streetAt(st, s, p);
    const d = hypot(p.x - x, p.z - z);
    if (d < best) {
      best = d;
      at = s;
    }
  }
  return at;
}

/** A cubic from `a` going `ta` to `b` arriving along `tb`, its handles
 * `ha` and `hb` long, every `step` m or so (excluding `a`). */
function cubic(
  a: { x: number; z: number },
  ta: { x: number; z: number },
  b: { x: number; z: number },
  tb: { x: number; z: number },
  ha: number,
  hb: number,
  lane: number,
  top: number,
  out: Raw[],
): void {
  const p1 = { x: a.x + ta.x * ha, z: a.z + ta.z * ha };
  const p2 = { x: b.x - tb.x * hb, z: b.z - tb.z * hb };
  const n = Math.max(4, Math.ceil(hypot(b.x - a.x, b.z - a.z) / 0.25));
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const w = 1 - u;
    out.push({
      x: w * w * w * a.x + 3 * w * w * u * p1.x + 3 * w * u * u * p2.x + u * u * u * b.x,
      z: w * w * w * a.z + 3 * w * w * u * p1.z + 3 * w * u * u * p2.z + u * u * u * b.z,
      lane,
      top,
    });
  }
}

/** The way a raw line runs at its end (`end`) or start. */
function tangent(pts: readonly Raw[], end: boolean): { x: number; z: number } {
  const n = pts.length;
  const a = end ? pts[Math.max(0, n - 3)] : pts[0];
  const b = end ? pts[n - 1] : pts[Math.min(n - 1, 2)];
  const d = hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: (b.x - a.x) / d, z: (b.z - a.z) / d };
}

/** The handles of the curve round a corner from `a` (going `ta`) to `b`
 * (leaving along `tb`): a quarter circle's for a square turn, a third of
 * the way for a straight one. */
function handles(
  a: { x: number; z: number },
  ta: { x: number; z: number },
  b: { x: number; z: number },
  tb: { x: number; z: number },
): [number, number] {
  const d = hypot(b.x - a.x, b.z - a.z);
  const cos = ta.x * tb.x + ta.z * tb.z;
  if (cos > 0.97) return [d / 3, d / 3];
  // Where the two lines meet: a + u·ta = b − w·tb.
  const det = ta.x * -tb.z - ta.z * -tb.x;
  if (Math.abs(det) > 1e-6) {
    const rx = b.x - a.x;
    const rz = b.z - a.z;
    const u = (rx * -tb.z - rz * -tb.x) / det;
    const w = (ta.x * rz - ta.z * rx) / det;
    if (u > 0 && w > 0 && u < 3 * d && w < 3 * d) return [u * 0.55, w * 0.55];
  }
  return [d * 0.5, d * 0.5];
}

/** THE RAW LINE of a run of visits, the corners between them rounded:
 * each visit's offset line (`keep`), joined to the next. */
export function rawLine(
  level: Level,
  v: Village,
  lanes: readonly Lane[],
  visits: readonly Visit[],
  keep: Keep,
  drive: Drive,
  closed: boolean,
): Raw[] {
  const out: Raw[] = [];
  const pieces = visits.map((vi) => {
    const ln = lanes[vi.lane];
    const st = streetOf(v, ln.street);
    const top = topOf(st.kind, drive);
    const pts = offsetLine(level, st, laneOffset(st, ln, keep), vi.s0, vi.s1, 2);
    return pts.map((p) => ({ x: p.x, z: p.z, lane: vi.lane, top }));
  });
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    if (i > 0) {
      const prev = pieces[i - 1];
      const a = prev[prev.length - 1];
      const b = piece[0];
      const ta = tangent(prev, true);
      const tb = tangent(piece, false);
      const [ha, hb] = handles(a, ta, b, tb);
      cubic(a, ta, b, tb, ha, hb, -1, Math.min(a.top, b.top), out);
      out.pop();
    }
    out.push(...piece);
  }
  if (closed && pieces.length > 1) {
    const prev = pieces[pieces.length - 1];
    const a = prev[prev.length - 1];
    const b = pieces[0][0];
    const ta = tangent(prev, true);
    const tb = tangent(pieces[0], false);
    const [ha, hb] = handles(a, ta, b, tb);
    cubic(a, ta, b, tb, ha, hb, -1, Math.min(a.top, b.top), out);
    out.pop();
  }
  return out;
}

/** A BAY'S TURN: from `a` on the aisle (going `ta`) into the bay, the rear
 * axle brought to `b` with the body along `fb` (into the bay). */
export function bayTurn(
  a: { x: number; z: number },
  ta: { x: number; z: number },
  b: { x: number; z: number },
  fb: { x: number; z: number },
  top: number,
): Raw[] {
  const out: Raw[] = [{ x: a.x, z: a.z, lane: -1, top }];
  const d = hypot(b.x - a.x, b.z - a.z);
  cubic(a, ta, b, fb, d * 0.55, d * 0.45, -1, top, out);
  return out;
}

/** THE LINE LAID every `DS` m, its headings, curvatures and turns ahead. */
export function layPath(raw: readonly Raw[], closed: boolean): Path {
  const cum: number[] = [0];
  for (let i = 1; i < raw.length; i++) {
    cum.push(cum[i - 1] + hypot(raw[i].x - raw[i - 1].x, raw[i].z - raw[i - 1].z));
  }
  let total = cum[cum.length - 1];
  if (closed) {
    total += hypot(raw[0].x - raw[raw.length - 1].x, raw[0].z - raw[raw.length - 1].z);
  }
  const n = Math.max(2, Math.round(total / DS) + (closed ? 0 : 1));
  const step = closed ? total / n : total / (n - 1);
  const x = new Float64Array(n);
  const z = new Float64Array(n);
  const lane = new Int16Array(n);
  const top = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const s = i * step;
    while (j < raw.length - 1 && cum[j + 1] < s) j++;
    const a = raw[j];
    const last = j === raw.length - 1;
    const b = last ? raw[0] : raw[j + 1];
    const len = last ? total - cum[j] : cum[j + 1] - cum[j];
    const u = len > 1e-9 ? Math.max(0, Math.min(1, (s - cum[j]) / len)) : 0;
    x[i] = a.x + (b.x - a.x) * u;
    z[i] = a.z + (b.z - a.z) * u;
    const near = u < 0.5 ? a : b;
    lane[i] = near.lane;
    top[i] = Math.min(a.top, b.top);
  }
  const at = (i: number) => (closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i)));
  const h = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = at(i - 2);
    const b = at(i + 2);
    h[i] = Math.atan2(x[b] - x[a], z[b] - z[a]);
  }
  // The curvature off the heading's change, smoothed over ±`smooth` points.
  const raw1 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = at(i - 1);
    const b = at(i + 1);
    const span = (b - a + (closed && b < a ? n : 0)) * step || step;
    raw1[i] = wrap(h[b] - h[a]) / span;
  }
  const smooth = 4;
  const k = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let cnt = 0;
    for (let d = -smooth; d <= smooth; d++) {
      const q = closed ? at(i + d) : i + d;
      if (q < 0 || q >= n) continue;
      sum += raw1[q];
      cnt++;
    }
    k[i] = sum / cnt;
  }
  const ahead = Math.round(T.signal.ahead / step);
  const turn = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let most = 0;
    for (let d = 4; d <= ahead; d += 4) {
      const q = closed ? at(i + d) : Math.min(n - 1, i + d);
      const dh = wrap(h[q] - h[i]);
      if (Math.abs(dh) > Math.abs(most)) most = dh;
    }
    turn[i] = most;
  }
  return { n, x, z, h, k, lane, top, turn, closed };
}

/** The step between a path's points, m. */
export function stepOf(p: Path): number {
  const n = p.n;
  let total = 0;
  for (let i = 1; i < n; i++) total += hypot(p.x[i] - p.x[i - 1], p.z[i] - p.z[i - 1]);
  if (p.closed) total += hypot(p.x[0] - p.x[n - 1], p.z[0] - p.z[n - 1]);
  return total / (p.closed ? n : n - 1);
}

/** A LEG of a route as driven: its line, which way along it the vehicle
 * faces (`reverse`: backing along it), the speed at every point and the
 * time it reaches each, from the leg's start. */
export type Driven = {
  path: Path;
  ds: number;
  reverse: boolean;
  v: Float64Array;
  t: Float64Array;
  duration: number;
};

/**
 * THE SPEED ALONG A LINE and the time it reaches every point: the top
 * there, eased for the bend by `drive.lateral` (`v² κ ≤ a`), pulled away
 * at `drive.accel` and slowed at `drive.brake` — from `v0` at its start
 * to `v1` at its end (a closed line round and round, the same at both).
 * `scale` stretches the time (a loop fitted to its period).
 */
export function drivePath(
  path: Path,
  drive: Drive,
  v0: number,
  v1: number,
  reverse = false,
  scale = 1,
): Driven {
  const n = path.n;
  const ds = stepOf(path);
  const top = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const bend = Math.abs(path.k[i]);
    const corner = bend > 1e-6 ? Math.sqrt(drive.lateral / bend) : Infinity;
    top[i] = Math.min(reverse ? drive.reverse : path.top[i], corner);
  }
  const v = new Float64Array(n);
  const rounds = path.closed ? 3 : 1;
  for (let i = 0; i < n; i++) v[i] = top[i];
  if (!path.closed) {
    v[0] = Math.min(v[0], v0);
    v[n - 1] = Math.min(v[n - 1], v1);
  }
  for (let r = 0; r < rounds; r++) {
    // Pulled away: never faster than the last point allows.
    for (let i = 1; i < n + (path.closed ? n : 0); i++) {
      const a = (i - 1) % n;
      const b = i % n;
      v[b] = Math.min(v[b], Math.sqrt(v[a] * v[a] + 2 * drive.accel * ds));
    }
    // Slowed into: never faster than the next point can be braked to.
    for (let i = n - 2 + (path.closed ? n : 0); i >= 0; i--) {
      const a = i % n;
      const b = (i + 1) % n;
      v[a] = Math.min(v[a], Math.sqrt(v[b] * v[b] + 2 * drive.brake * ds));
    }
  }
  if (scale !== 1) for (let i = 0; i < n; i++) v[i] /= scale;
  const t = new Float64Array(path.closed ? n + 1 : n);
  for (let i = 1; i < t.length; i++) {
    const a = v[i - 1];
    const b = v[i % n];
    t[i] = t[i - 1] + (2 * ds) / Math.max(0.05, a + b);
  }
  return { path, ds, reverse, v, t, duration: t[t.length - 1] };
}

/** Where along a driven leg the vehicle is `tau` s in: the point index,
 * the share of the way to the next, and the speed. Within a step the speed
 * runs straight in time, so the arc is the step's own. */
export function alongLeg(d: Driven, tau: number): { i: number; u: number; speed: number } {
  const t = d.t;
  const last = t.length - 1;
  if (tau <= 0) return { i: 0, u: 0, speed: d.v[0] };
  if (tau >= t[last]) {
    const i = d.path.closed ? 0 : d.path.n - 1;
    return { i, u: 0, speed: d.v[i] };
  }
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= tau) lo = mid;
    else hi = mid;
  }
  const n = d.path.n;
  const va = d.v[lo];
  const vb = d.v[(lo + 1) % n];
  const span = t[lo + 1] - t[lo];
  const tt = tau - t[lo];
  const a = span > 0 ? (vb - va) / span : 0;
  const s = va * tt + 0.5 * a * tt * tt;
  const step = span > 0 ? ((va + vb) / 2) * span : d.ds;
  return { i: lo, u: step > 1e-9 ? Math.max(0, Math.min(1, s / step)) : 0, speed: va + a * tt };
}

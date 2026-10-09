// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A DOG WALK'S LINE — the route a walk takes over the village's sidewalk
// network (`dog-walk-net.ts`'s `wanderFrom`) as one line measured along
// its length: where a point a given way along it is, the way it runs
// there (eased round its corners so nobody snaps about), which side the
// road is (the KERB, where a dog squats by the windrow) and how wide the
// sidewalk is, and which stretches are a CROSSING or a link off the
// sidewalks (a door's, a corner's) — where no dog stops. Three-free and
// DOM-free; pure functions of the route.

import type { WalkNet } from "./dog-walk-net.ts";

/** What a stretch of the line is: along a sidewalk, across a street at a
 * crossing, or a link between (a door's path, a corner). */
export type Stretch = "walk" | "crossing" | "link";

/** A walk's line: its points and the arc at each, each stretch's kind,
 * and on a sidewalk the side the road is on (+1 the right of the way the
 * line runs, −1 its left) and the sidewalk's half width. */
export type WalkLine = {
  readonly x: Float64Array;
  readonly z: Float64Array;
  readonly s: Float64Array;
  /** Stretch k runs from point k to k + 1. */
  readonly kind: readonly Stretch[];
  readonly kerb: Int8Array;
  readonly half: Float64Array;
  /** The crossing each crossing stretch is (by id), "" elsewhere. */
  readonly crossing: readonly string[];
  readonly length: number;
};

/** The line through a route of `net`'s nodes. */
export function lineOf(net: WalkNet, way: readonly number[]): WalkLine {
  const pts = way.filter((n, i) => i === 0 || n !== way[i - 1]);
  const n = pts.length;
  const x = new Float64Array(n);
  const z = new Float64Array(n);
  const s = new Float64Array(n);
  const kind: Stretch[] = [];
  const crossing: string[] = [];
  const kerb = new Int8Array(Math.max(1, n - 1));
  const half = new Float64Array(Math.max(1, n - 1));
  for (let i = 0; i < n; i++) {
    const p = net.nodes[pts[i]];
    x[i] = p.x;
    z[i] = p.z;
    if (i > 0) s[i] = s[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]);
  }
  for (let k = 0; k + 1 < n; k++) {
    const a = net.nodes[pts[k]];
    const b = net.nodes[pts[k + 1]];
    const edge = net.adj[pts[k]]
      .map((e) => net.edges[e])
      .find(
        (e) => (e.a === pts[k] && e.b === pts[k + 1]) || (e.b === pts[k] && e.a === pts[k + 1]),
      );
    if (edge?.crossing) {
      kind.push("crossing");
      crossing.push(edge.crossing);
      continue;
    }
    crossing.push("");
    if (a.walk >= 0 && a.walk === b.walk) {
      kind.push("walk");
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l = Math.hypot(dx, dz) || 1;
      // The right of the way it runs is (dz, −dx); the road is on the side
      // the node's kerb points to.
      kerb[k] = (dz / l) * a.kx + (-dx / l) * a.kz >= 0 ? 1 : -1;
      half[k] = a.half;
    } else kind.push("link");
  }
  return { x, z, s, kind, kerb, half, crossing, length: s[n - 1] };
}

/** The stretch an arc `u` lies on. */
export function stretchAt(line: WalkLine, u: number): number {
  const s = line.s;
  const n = s.length;
  if (u <= 0) return 0;
  if (u >= line.length) return Math.max(0, n - 2);
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid] <= u) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** A point of the line, refilled. `heading` the way it runs there (0 =
 * +z, clockwise from above), eased over `EASE` m round a corner. */
export type LinePoint = { x: number; z: number; heading: number };

/** How far round a corner the way the line runs is eased, m. */
const EASE = 0.9;

function pointRaw(line: WalkLine, u: number, out: { x: number; z: number }): void {
  const k = stretchAt(line, u);
  const s0 = line.s[k];
  const s1 = line.s[k + 1] ?? s0;
  const f = s1 > s0 ? Math.max(0, Math.min(1, (u - s0) / (s1 - s0))) : 0;
  out.x = line.x[k] + (line.x[k + 1] - line.x[k]) * f;
  out.z = line.z[k] + (line.z[k + 1] - line.z[k]) * f;
}

const A = { x: 0, z: 0 };
const B = { x: 0, z: 0 };

/** The point `u` m along the line and the way it runs there, `side` m to
 * the right of it (the right of a heading h is (cos h, −sin h)). */
export function pointAt(line: WalkLine, u: number, side: number, out: LinePoint): LinePoint {
  const c = Math.max(0, Math.min(line.length, u));
  pointRaw(line, c, out);
  pointRaw(line, Math.max(0, c - EASE), A);
  pointRaw(line, Math.min(line.length, c + EASE), B);
  out.heading = Math.atan2(B.x - A.x, B.z - A.z);
  if (side !== 0) {
    out.x += Math.cos(out.heading) * side;
    out.z -= Math.sin(out.heading) * side;
  }
  return out;
}

/** Whether every stretch within `pad` m of arc `u` is along a sidewalk. */
export function onSidewalk(line: WalkLine, u: number, pad: number): boolean {
  const a = stretchAt(line, Math.max(0, u - pad));
  const b = stretchAt(line, Math.min(line.length, u + pad));
  if (u - pad < 0 || u + pad > line.length) return false;
  for (let k = a; k <= b; k++) if (line.kind[k] !== "walk") return false;
  // One sidewalk's side all the way: the road where it was.
  return line.kerb[a] === line.kerb[b];
}

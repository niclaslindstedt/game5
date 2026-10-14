// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK KIT'S PIECES — a handful of rock shapes built in code once
// (`rockPieces`), each a CONVEX solid: a slab, a long slab, a buttress
// prism, a block, a wedge, a boulder, a flat boulder and a fragment. Every
// piece is stated in its own frame — x along the wall's strike, y out of
// the wall (0 its back, buried in the face, 1 its front), z up the face —
// in a unit box the placing (`rock-kit.ts`) stretches to its size.
//
// A piece comes in three CUTS: the near one with every corner bevelled
// (a corner cut back a few centimetres catches the light the way a real
// block's broken edge does), the middle one the plain solid, and the far
// one a handful of corners. Each cut is the convex hull of its points, so
// a coarser cut lies INSIDE the finer one and is never more than its
// bevel off it. The physics meets the near cut (its planes, `planes`);
// the drawing lays whichever the distance asks.
//
// Pure: fixed numbers, never a map's hash or the engine's stream.

import { hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
/** A point. */
type P = readonly [number, number, number];

/** A convex solid: its corners and its triangles, wound out. */
export type Hull = {
  readonly points: readonly P[];
  /** Three corner indices a triangle, counter-clockwise seen from outside. */
  readonly tris: readonly (readonly [number, number, number])[];
};

/** A piece of the kit. */
export type RockPiece = {
  readonly name: string;
  /** Its three cuts, near to far. */
  readonly cuts: readonly [Hull, Hull, Hull];
  /** The near cut's faces as planes, `n · p <= d` inside: nx, ny, nz, d. */
  readonly planes: Float64Array;
};

const sub = (a: P, b: P): [number, number, number] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: P, b: P): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: P, b: P): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** THE CONVEX HULL of `pts` (incremental, a few dozen points): its
 * triangles wound out. The points must not all lie in a plane. */
export function convexHull(pts: readonly P[]): Hull {
  const n = pts.length;
  // A first tetrahedron: two far points, the farthest off their line, the
  // farthest off their plane.
  let a = 0;
  let b = 0;
  for (let i = 1; i < n; i++) {
    if (pts[i][0] < pts[a][0]) a = i;
    if (pts[i][0] > pts[b][0]) b = i;
  }
  const ab = sub(pts[b], pts[a]);
  let c = -1;
  let best = 0;
  for (let i = 0; i < n; i++) {
    const l = cross(ab, sub(pts[i], pts[a]));
    const s = dot(l, l);
    if (s > best) {
      best = s;
      c = i;
    }
  }
  const nabc = cross(ab, sub(pts[c], pts[a]));
  let d = -1;
  best = 0;
  for (let i = 0; i < n; i++) {
    const s = Math.abs(dot(nabc, sub(pts[i], pts[a])));
    if (s > best) {
      best = s;
      d = i;
    }
  }
  if (c < 0 || d < 0) throw new Error("convexHull: the points lie in a plane");
  const mid: P = [0, 1, 2].map((k) => (pts[a][k] + pts[b][k] + pts[c][k] + pts[d][k]) / 4) as [
    number,
    number,
    number,
  ];
  type F = { v: [number, number, number]; n: [number, number, number]; d: number; on: boolean };
  const faces: F[] = [];
  const face = (i: number, j: number, k: number): void => {
    let nn = cross(sub(pts[j], pts[i]), sub(pts[k], pts[i]));
    let v: [number, number, number] = [i, j, k];
    if (dot(nn, sub(pts[i], mid)) < 0) {
      v = [i, k, j];
      nn = [-nn[0], -nn[1], -nn[2]];
    }
    const l = hypot3(nn[0], nn[1], nn[2]) || 1;
    const un: [number, number, number] = [nn[0] / l, nn[1] / l, nn[2] / l];
    faces.push({ v, n: un, d: dot(un, pts[v[0]]), on: true });
  };
  face(a, b, c);
  face(a, b, d);
  face(a, c, d);
  face(b, c, d);
  const eps = 1e-9;
  for (let p = 0; p < n; p++) {
    if (p === a || p === b || p === c || p === d) continue;
    const q = pts[p];
    const seen = faces.filter((f) => f.on && dot(f.n, q) - f.d > eps);
    if (!seen.length) continue;
    const edges = new Set<string>();
    for (const f of seen) {
      for (let e = 0; e < 3; e++) edges.add(`${f.v[e]},${f.v[(e + 1) % 3]}`);
    }
    for (const f of seen) f.on = false;
    for (const f of seen) {
      for (let e = 0; e < 3; e++) {
        const u = f.v[e];
        const w = f.v[(e + 1) % 3];
        // A horizon edge: its other side still faces away from the point.
        if (!edges.has(`${w},${u}`)) face(u, w, p);
      }
    }
  }
  const live = faces.filter((f) => f.on);
  // Only the corners the hull uses, renumbered.
  const used = new Map<number, number>();
  const points: P[] = [];
  const tris = live.map((f) =>
    f.v.map((i) => {
      let k = used.get(i);
      if (k === undefined) {
        k = points.length;
        used.set(i, k);
        points.push(pts[i]);
      }
      return k;
    }),
  ) as [number, number, number][];
  return { points, tris };
}

/** Every corner of `h` cut back `bevel` m (at most `share` of an edge)
 * toward each corner it shares an edge with: the near cut's points. */
function bevelled(h: Hull, bevel: number, share: number): P[] {
  const near = h.points.map(() => new Set<number>());
  for (const [i, j, k] of h.tris) {
    near[i].add(j).add(k);
    near[j].add(i).add(k);
    near[k].add(i).add(j);
  }
  const out: P[] = [];
  h.points.forEach((v, i) => {
    for (const j of near[i]) {
      const e = sub(h.points[j], v);
      const l = hypot3(e[0], e[1], e[2]);
      const c = Math.min(bevel, share * l) / l;
      out.push([v[0] + e[0] * c, v[1] + e[1] * c, v[2] + e[2] * c]);
    }
  });
  return out;
}

/** A hash of two small integers to 0..1 — the kit's own jitter. */
function jit(i: number, k: number): number {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** A box's eight corners in the unit frame (x and z centred, y 0..1),
 * each moved by up to `j` of the box, tapered `taper` toward its front. */
function box(id: number, j: number, taper: number): P[] {
  const out: P[] = [];
  let k = 0;
  for (const y of [0, 1]) {
    for (const z of [-0.5, 0.5]) {
      for (const x of [-0.5, 0.5]) {
        const t = y === 1 ? 1 - taper : 1;
        out.push([
          x * t + (jit(id, k++) - 0.5) * j,
          y + (jit(id, k++) - 0.5) * j * 0.6,
          z * t + (jit(id, k++) - 0.5) * j,
        ]);
      }
    }
  }
  return out;
}

/** Points on a squashed sphere in the unit frame, `count` of them by the
 * golden angle, each pushed in or out `j` of the radius. */
function lump(id: number, count: number, j: number): P[] {
  const out: P[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.399963;
    const s = 1 + (jit(id, i) - 0.5) * 2 * j;
    // Flattened underneath, as a stone settles.
    const yy = y < -0.4 ? -0.4 - (y + 0.4) * 0.35 : y;
    out.push([0.5 * r * Math.cos(a) * s, 0.5 + 0.5 * yy * s, 0.5 * r * Math.sin(a) * s]);
  }
  return out;
}

/** A piece off its points: the near cut bevelled, the middle the plain
 * hull, the far one `far` of its corners (the ones farthest out). */
function piece(name: string, pts: P[], bevel: number, far: number, round = false): RockPiece {
  const plain = convexHull(pts);
  const near = round ? plain : convexHull(bevelled(plain, bevel, 0.22));
  const mid = round ? convexHull(pts.filter((_, i) => i % 2 === 0)) : plain;
  // The far cut: the corners farthest from the middle, a handful.
  const c = plain.points.reduce(
    (s, p) => [
      s[0] + p[0] / plain.points.length,
      s[1] + p[1] / plain.points.length,
      s[2] + p[2] / plain.points.length,
    ],
    [0, 0, 0],
  );
  const ranked = [...plain.points].sort(
    (p, q) => hypot3(...sub(q, c as P)) - hypot3(...sub(p, c as P)),
  );
  const farCut = convexHull(ranked.slice(0, Math.max(5, far)));
  const planes = new Float64Array(near.tris.length * 4);
  near.tris.forEach(([i, j, k], f) => {
    const nn = cross(sub(near.points[j], near.points[i]), sub(near.points[k], near.points[i]));
    const l = hypot3(nn[0], nn[1], nn[2]) || 1;
    planes[4 * f] = nn[0] / l;
    planes[4 * f + 1] = nn[1] / l;
    planes[4 * f + 2] = nn[2] / l;
    planes[4 * f + 3] = dot([nn[0] / l, nn[1] / l, nn[2] / l], near.points[i]);
  });
  return { name, cuts: [near, mid, farCut], planes };
}

/** The kit's pieces, by index: what `rock-kit.ts`' kinds name. */
export const PIECE = {
  slab: 0,
  long: 1,
  prism: 2,
  block: 3,
  wedge: 4,
  boulder: 5,
  flat: 6,
  shard: 7,
} as const;

let kit: readonly RockPiece[] | null = null;

/** THE KIT, built once. */
export function rockPieces(): readonly RockPiece[] {
  if (kit) return kit;
  const wedge = box(4, 0.08, 0);
  // A wedge: its front top edge pulled back down to the back.
  wedge[6] = [wedge[6][0], 0.15, wedge[6][2] + 0.25];
  wedge[7] = [wedge[7][0], 0.15, wedge[7][2] + 0.25];
  const block = box(3, 0.16, 0.12);
  block.push([0.12, 1.08, 0.18], [-0.3, 0.7, 0.62]);
  const prism = box(2, 0.1, 0.1);
  prism.push([0.0, 0.85, 0.62], [0.58, 0.6, 0.1]);
  const shard: P[] = [];
  for (let i = 0; i < 11; i++) {
    shard.push([jit(70, i) - 0.5, jit(71, i), jit(72, i) - 0.5]);
  }
  shard.push([-0.5, 0, -0.5], [0.5, 0, 0.5], [0.5, 0.05, -0.5]);
  kit = [
    piece("slab", box(0, 0.1, 0.06), 0.025, 6),
    piece("long", box(1, 0.08, 0.04), 0.02, 6),
    piece("prism", prism, 0.025, 7),
    piece("block", block, 0.03, 7),
    piece("wedge", wedge, 0.025, 6),
    piece("boulder", lump(5, 30, 0.12), 0, 9, true),
    piece("flat", lump(6, 24, 0.1), 0, 8, true),
    piece("shard", shard, 0.02, 6),
  ];
  return kit;
}

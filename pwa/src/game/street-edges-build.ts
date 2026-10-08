// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S STREET EDGES, BUILT — what stands up off the street
// surfaces (`street-plan.ts`) on the facade kit beside the buildings, as a
// mountain village's streets are kept in winter (`docs/buildings.md`):
//
//   * THE KERBS: a granite kerb along the road side of every sidewalk, its
//     face a kerb's height over the road and its top flush with the walk;
//   * THE WINDROWS: the snow the plough throws off the carriageway, a
//     lumpy ridge along each side's bank strip (`SECTIONS`' `bank` wide and
//     `heap` tall) — greyed on its road face by the slush and the grit
//     thrown up with it — BROKEN where people cross (the crossings), at
//     every door and yard gate that opens on the street, at the bus stop,
//     along the square and the car park's mouth, and short of every
//     junction;
//   * THE HEAPS: the car park's snow, pushed into a pile or two at its far
//     corners as tall as a man.
//
// Three-free; faceted like everything on the kit.

import {
  besidePoint,
  streetAt,
  trimAt,
  villageBuildingsOf,
  villageOf,
  STREET_FURNITURE as F,
  type Level,
  type Street,
  type StreetPoint,
  type Village,
} from "@engine";

import { FACADE } from "./facade-paint.ts";
import type { FacadeKit, V3 } from "./facade-kit.ts";
import { KERB, roadY } from "./street-plan.ts";

/** The kerb's width, m (a granite kerb's 15 cm), and its stone's tint. */
const KERB_WIDTH = 0.15;
const GRANITE = 0xc4c4c8;
/** The windrow's snow, white, and its road face greyed by slush. */
const SNOW = 0xffffff;
const SLUSH = 0xb8b6b4;
/** How often a windrow is sampled along, m. */
const STEP = 1;

/** A small hash of a point to 0..1, for the snow's lumps. */
function lump(x: number, z: number, salt: number): number {
  let h = Math.imul(Math.round(x * 3) | 0, 374761393) ^ Math.imul(Math.round(z * 3) | 0, 668265263);
  h = Math.imul(h ^ salt ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** A smooth wave along a street, 0..1: value noise on `cell` m. */
function wave(s: number, cell: number, salt: number): number {
  const f = s / cell;
  const i = Math.floor(f);
  const t = f - i;
  const u = t * t * (3 - 2 * t);
  const a = lump(i, salt, 17);
  const b = lump(i + 1, salt, 17);
  return a + (b - a) * u;
}

/** Push the triangle (a, b, c) in world coordinates, wound so its face
 * looks along `out` (up, by default), its UVs in plan over the layer's
 * tile (or along `uAxis` and up for a face standing up). */
function face(
  kit: FacadeKit,
  a: V3,
  b: V3,
  c: V3,
  layer: number,
  tint: number,
  out: V3 = [0, 1, 0],
  standing = false,
): void {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const flip = nx * out[0] + ny * out[1] + nz * out[2] < 0;
  const uv = (p: V3): number[] => (standing ? [(p[0] + p[2]) / 2, p[1] / 2] : [p[0] / 2, p[2] / 2]);
  if (flip) kit.tri(a, c, b, uv(a), uv(c), uv(b), layer as never, tint);
  else kit.tri(a, b, c, uv(a), uv(b), uv(c), layer as never, tint);
}

/** Build the kerbs, the windrows and the heaps of `level`'s village. */
export function buildStreetEdges(kit: FacadeKit, level: Level): void {
  const v = villageOf(level);
  if (!v) return;
  kit.at(0, 0, 0, 0);
  kerbs(kit, level, v);
  for (const st of v.streets) for (const side of [0, 1] as const) windrow(kit, level, v, st, side);
  heaps(kit, level, v);
}

/** THE KERBS: along each sidewalk's road edge. */
function kerbs(kit: FacadeKit, level: Level, v: Village): void {
  for (const w of v.walks) {
    const out = w.side === 0 ? -1 : 1;
    const half = w.width / 2;
    for (let i = 1; i < w.points.length; i++) {
      const p = w.points[i - 1];
      const q = w.points[i];
      // The kerb's back (flush with the walk) and its face (to the road).
      const pb = besidePoint(p, -out * half);
      const qb = besidePoint(q, -out * half);
      const pf = besidePoint(p, -out * (half + KERB_WIDTH));
      const qf = besidePoint(q, -out * (half + KERB_WIDTH));
      const yp = roadY(level, pb.x, pb.z);
      const yq = roadY(level, qb.x, qb.z);
      const top = (pt: { x: number; z: number }, y: number): V3 => [pt.x, y + KERB + 0.01, pt.z];
      const low = (pt: { x: number; z: number }, y: number): V3 => [pt.x, y - 0.02, pt.z];
      // The top.
      face(kit, top(pf, yp), top(qf, yq), top(qb, yq), FACADE.plain, GRANITE);
      face(kit, top(pf, yp), top(qb, yq), top(pb, yp), FACADE.plain, GRANITE);
      // The face to the road.
      const toRoad: V3 = [pf.x - pb.x, 0, pf.z - pb.z];
      face(kit, low(pf, yp), low(qf, yq), top(qf, yq), FACADE.plain, GRANITE, toRoad, true);
      face(kit, low(pf, yp), top(qf, yq), top(pf, yp), FACADE.plain, GRANITE, toRoad, true);
    }
    // The kerb's ends, turned down where the walk stops at a junction.
    for (const p of [w.points[0], w.points[w.points.length - 1]]) {
      const b = besidePoint(p, -out * half);
      const f = besidePoint(p, -out * (half + KERB_WIDTH));
      const y = roadY(level, b.x, b.z);
      const back = p === w.points[0] ? -1 : 1;
      const along: V3 = [back * Math.sin(p.heading), 0, back * Math.cos(p.heading)];
      face(
        kit,
        [f.x, y - 0.02, f.z],
        [b.x, y - 0.02, b.z],
        [b.x, y + KERB, b.z],
        FACADE.plain,
        GRANITE,
        along,
        true,
      );
      face(
        kit,
        [f.x, y - 0.02, f.z],
        [b.x, y + KERB, b.z],
        [f.x, y + KERB, f.z],
        FACADE.plain,
        GRANITE,
        along,
        true,
      );
    }
  }
}

/** The stretches of a street's side a windrow is broken over: [s0, s1]
 * each. */
function breaks(level: Level, v: Village, st: Street, side: 0 | 1): [number, number][] {
  const out: [number, number][] = [];
  for (const c of v.crossings) {
    if (c.street === st.id) out.push([c.s - c.width / 2 - 0.6, c.s + c.width / 2 + 0.6]);
  }
  // Every door on this side: a building on this street, standing on this
  // side, its middle projected onto the street.
  const at: StreetPoint = { x: 0, y: 0, z: 0, s: 0, heading: 0 };
  for (const c of villageBuildingsOf(level)) {
    if (c.run !== st.id) continue;
    const near = nearestS(st, c.x, c.z);
    streetAt(st, near, at);
    const lat = (c.x - at.x) * Math.cos(at.heading) - (c.z - at.z) * Math.sin(at.heading);
    if ((lat > 0 ? 1 : 0) !== side) continue;
    out.push([near - 1.6, near + 1.6]);
  }
  const b = v.bus;
  if (b && b.street === st.id) {
    const s = nearestS(st, b.x, b.z);
    out.push([s - F.bus.along / 2 - 1, s + F.bus.along / 2 + 1]);
  }
  // Along the open places off the main street's hub side.
  if (st.kind === "main") {
    for (const a of v.areas) {
      const s0 = nearestS(st, a.x - a.half, a.z);
      const s1 = nearestS(st, a.x + a.half, a.z);
      streetAt(st, (s0 + s1) / 2, at);
      const side1 = (a.x - at.x) * Math.cos(at.heading) - (a.z - at.z) * Math.sin(at.heading) > 0;
      if ((side1 ? 1 : 0) !== side) continue;
      if (Math.abs(s1 - s0) > 1) out.push([Math.min(s0, s1) - 0.5, Math.max(s0, s1) + 0.5]);
    }
  }
  return out;
}

/** The arc along `st` nearest (x, z). */
function nearestS(st: Street, x: number, z: number): number {
  let best = Infinity;
  let s = 0;
  for (const p of st.points) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < best) {
      best = d;
      s = p.s;
    }
  }
  return s;
}

/** A WINDROW down one side of a street: rows of five points across its
 * bank strip, every metre along, its height off a lumpy noise and
 * tapered into every break. */
function windrow(kit: FacadeKit, level: Level, v: Village, st: Street, side: 0 | 1): void {
  const S = st.section;
  const sd = S.sides[side];
  if (sd.bank <= 0 || sd.heap <= 0) return;
  const sign = side === 0 ? -1 : 1;
  const inner = S.lane + sd.park;
  const t0 = trimAt(v, st, 0).walk;
  const t1 = trimAt(v, st, 1).walk;
  const s0 = t0 + 0.5;
  const s1 = st.length - t1 - 0.5;
  if (s1 - s0 < 2) return;
  const gaps = breaks(level, v, st, side);
  /** How much of the heap stands at `s`: none in a gap, rising over a
   * metre and a half out of one. */
  const share = (s: number): number => {
    let k = Math.min(1, (s - s0) / 1.5, (s1 - s) / 1.5);
    for (const [a, b] of gaps) {
      if (s >= a && s <= b) return 0;
      k = Math.min(k, (a - s) / 1.5 > 0 ? Math.min(1, (a - s) / 1.5) : Math.min(1, (s - b) / 1.5));
    }
    return Math.max(0, k);
  };
  // The windrow's section: a road face steeper than its back, rounded.
  const across = [0, 0.12, 0.3, 0.5, 0.7, 0.88, 1];
  const rise = [0, 0.45, 0.88, 1, 0.86, 0.45, 0];
  const at: StreetPoint = { x: 0, y: 0, z: 0, s: 0, heading: 0 };
  let prev: V3[] | null = null;
  let prevShare = 0;
  for (let s = s0; s <= s1 + 1e-6; s += STEP) {
    const k = share(s);
    streetAt(st, s, at);
    // Lumps along it a few metres long, and a little roughness on each.
    const bump = 0.65 + 0.7 * wave(s, 3.2, st.id.length * 7 + side);
    const wide = 0.85 + 0.3 * wave(s, 5.5, st.id.length * 11 + side);
    const row: V3[] = across.map((t, i) => {
      const lat = sign * (inner + sd.bank * t * wide);
      const q = besidePoint(at, lat);
      const y = roadY(level, q.x, q.z) - 0.01;
      const h = sd.heap * rise[i] * bump * k * (0.92 + 0.16 * lump(q.x, q.z, 13 + i));
      return [q.x, y + h, q.z];
    });
    if (prev && (k > 0 || prevShare > 0)) {
      for (let i = 0; i + 1 < across.length; i++) {
        // The road face greyed with slush, the rest white.
        const tint = i < 2 ? SLUSH : SNOW;
        face(kit, prev[i], prev[i + 1], row[i + 1], FACADE.snow, tint);
        face(kit, prev[i], row[i + 1], row[i], FACADE.snow, tint);
      }
    }
    prev = row;
    prevShare = k;
  }
}

/** THE CAR PARK'S HEAPS: a pile at each of its far corners. */
function heaps(kit: FacadeKit, level: Level, v: Village): void {
  for (const a of v.areas) {
    if (a.kind !== "carpark") continue;
    const fx = Math.sin(a.heading);
    const fz = Math.cos(a.heading);
    for (const s of [-1, 1]) {
      const cx = a.x + fx * (a.depth - 2.5) + fz * s * (a.half - 3);
      const cz = a.z + fz * (a.depth - 2.5) - fx * s * (a.half - 3);
      mound(kit, level, cx, cz, 3.2 + lump(cx, cz, 3) * 1.2, 1.6 + lump(cx, cz, 5) * 0.8);
    }
  }
}

/** A MOUND of ploughed snow at (x, z): `r` across its foot, `h` tall,
 * rings of lumps — its foot greyed by the grit pushed in with it. */
function mound(kit: FacadeKit, level: Level, x: number, z: number, r: number, h: number): void {
  const n = 10;
  const rings = [0, 0.45, 0.8, 1];
  const height = [1, 0.85, 0.45, 0];
  const pts: V3[][] = rings.map((t, ri) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const rr = r * t * (0.8 + 0.35 * lump(x + i, z + ri, 9));
      const px = x + Math.sin(a) * rr;
      const pz = z + Math.cos(a) * rr;
      const y = roadY(level, px, pz) - 0.05 + h * height[ri] * (0.85 + 0.3 * lump(px, pz, 11));
      return [px, y, pz] as V3;
    }),
  );
  for (let ri = 0; ri + 1 < rings.length; ri++) {
    const tint = ri === rings.length - 2 ? SLUSH : SNOW;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (ri === 0) {
        face(kit, pts[0][0], pts[1][i], pts[1][j], FACADE.snow, tint);
        continue;
      }
      face(kit, pts[ri][i], pts[ri + 1][i], pts[ri + 1][j], FACADE.snow, tint);
      face(kit, pts[ri][i], pts[ri + 1][j], pts[ri][j], FACADE.snow, tint);
    }
  }
}

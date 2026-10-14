// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK'S BEDS — the one function a wall's rock skin is shaped by, the
// drawing's (`pwa/src/game/rock-shapes.ts`' `buildSkin`) and the physics'
// (`rock-ground.ts`' `withRock`) alike, so the stone a body meets is the
// stone drawn, to the vertex.
//
// WHAT REAL ALPINE ROCK IS: LAYERED. A massif's limestone and gneiss lie
// in beds a few metres thick that dip one way across the whole mountain;
// each bed weathers back into a near vertical RISER of bare stone over a
// flatter TREAD the snow lies on, so a wall reads as bands of ledges, not
// as a field of spikes. Two sets of JOINTS cut across the beds and break
// the rock into blocks: a ledge ends or steps where one crosses it, a
// block stands a little prouder or further back than its neighbour, and
// now and then a row of them stands out as a buttress with the gully
// beside it.
//
// HOW IT IS BUILT. Every point of a wall carries a BED COORDINATE `w`: its
// ground's height less the massif's dip plane, folded, and shifted by the
// joint block it is in. The beds are levels of `w` (`bedLevel`), each bed
// two of them — its foot and the lip of its riser — and between them the
// rock stands proud of the ground by a profile linear in `w` (`liftOf`):
// nothing at a bed's foot, the most at its lip, the tread falling back to
// nothing at the next bed's foot. The skin's lattice (`ROCKS.skin.cell`,
// jittered as before) is cut into two triangles a cell; each triangle is
// then SLICED along those levels (`w` is linear over it), and every slice
// laid as a fan of flat triangles (`sliceTri`, `bandOf`) — so a ledge's lip
// and foot are crisp lines whatever the lattice, and two triangles on a
// shared edge cut it at the same points, crack free. The physics asks the
// one triangle that holds a point for the one slice that does (`bandOf`)
// and reads its fan.
//
// A pure function of the map, off hashes of `level.seed`; nothing on a run.

import { ROCKS } from "./defs/rocks.ts";
import { hashOf, unit } from "./rocks.ts";
import type { Level } from "../mapgen/types.ts";

/** A massif's beds and joints, dealt once a map. */
export type Strata = {
  readonly seed: number;
  /** The dip plane's rise, m per m along x and z. */
  readonly dipX: number;
  readonly dipZ: number;
  /** The joint sets' normals over their spacing, per m. */
  readonly j1x: number;
  readonly j1z: number;
  readonly j2x: number;
  readonly j2z: number;
  /** The mean bed, m. */
  readonly bed: number;
};

const SALT = 0x53545241;

const kept = new WeakMap<Level, Strata>();

/** `level`'s beds and joints. */
export function strataOf(level: Level): Strata {
  level = level.bedrock ?? level;
  const had = kept.get(level);
  if (had) return had;
  const S = ROCKS.strata;
  const seed = hashOf(level.seed, SALT);
  const dip = S.dip[0] + (S.dip[1] - S.dip[0]) * unit(seed, 0);
  const az = 2 * Math.PI * unit(seed, 1);
  const cx = Math.cos(az);
  const sz = Math.sin(az);
  // The first joint set across the dip (its planes run down it), the
  // second along it.
  const a1 = 1 / (S.joints[0] * (0.85 + 0.3 * unit(seed, 2)));
  const a2 = 1 / (S.joints[1] * (0.85 + 0.3 * unit(seed, 3)));
  const st: Strata = {
    seed,
    dipX: Math.tan(dip) * cx,
    dipZ: Math.tan(dip) * sz,
    j1x: -sz * a1,
    j1z: cx * a1,
    j2x: cx * a2,
    j2z: sz * a2,
    bed: S.bed,
  };
  kept.set(level, st);
  return st;
}

/** Smooth value noise, -1..1, on a unit lattice. */
function noise(seed: number, x: number, z: number): number {
  const i = Math.floor(x);
  const j = Math.floor(z);
  let fx = x - i;
  let fz = z - j;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  const a = unit(hashOf(seed, i, j), 0);
  const b = unit(hashOf(seed, i + 1, j), 0);
  const c = unit(hashOf(seed, i, j + 1), 0);
  const d = unit(hashOf(seed, i + 1, j + 1), 0);
  return 2 * (a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz) - 1;
}

/** The first joint set's coordinate at (x, z): a block between each two
 * whole numbers. Warped, so a joint is not a ruler's line. */
export function jointOf(st: Strata, x: number, z: number): number {
  const w = ROCKS.strata.jointWarp;
  return st.j1x * x + st.j1z * z + w * noise(st.seed ^ 0x3a, x / 37, z / 37);
}

function joint2Of(st: Strata, x: number, z: number): number {
  const w = ROCKS.strata.jointWarp;
  return st.j2x * x + st.j2z * z + w * noise(st.seed ^ 0x5c, x / 41, z / 41);
}

/** THE BED COORDINATE at (x, z) over ground `g`: the height over the
 * massif's folded dip plane, the joint block's jog added. */
export function bedCoord(st: Strata, x: number, z: number, g: number): number {
  const S = ROCKS.strata;
  const f = S.foldOver;
  const fold =
    S.fold *
    (noise(st.seed ^ 0x11, x / f, z / f) +
      0.4 * noise(st.seed ^ 0x12, x / (f * 0.37), z / (f * 0.37)));
  const b1 = Math.floor(jointOf(st, x, z));
  const b2 = Math.floor(joint2Of(st, x, z));
  const jog =
    S.jog *
    st.bed *
    (unit(hashOf(st.seed, 0x21, b1), 0) - 0.5 + 0.6 * (unit(hashOf(st.seed, 0x22, b2), 0) - 0.5));
  return g - st.dipX * x - st.dipZ * z - fold + jog;
}

/** Bed `k`'s foot, in the bed coordinate, beds `every` at a time. */
export function bedLevel(st: Strata, k: number, every = 1): number {
  const v = ROCKS.strata.vary;
  const n = k * every;
  return st.bed * (n + v * 2 * (unit(hashOf(st.seed, 0x31, n), 0) - 0.5));
}

/** The bed `w` lies in (its foot at or under `w`). */
export function bedOf(st: Strata, w: number, every = 1): number {
  let k = Math.floor(w / (st.bed * every));
  while (bedLevel(st, k, every) > w) k--;
  while (bedLevel(st, k + 1, every) <= w) k++;
  return k;
}

/** Bed `k`'s riser, of its thickness. */
export function riserOf(st: Strata, k: number, every = 1): number {
  const r = ROCKS.strata.riser;
  return r[0] + (r[1] - r[0]) * unit(hashOf(st.seed, 0x32, k * every), 0);
}

/** HOW PROUD OF ITS GROUND the skin stands at (x, z), m: off its bed
 * coordinate `w`, how BARE it is there (0 where the snow holds: tucked
 * `skin.sink` under it) and its corner's `rough` draw. */
export function liftOf(
  st: Strata,
  w: number,
  x: number,
  z: number,
  bare: number,
  rough: number,
  every = 1,
): number {
  const S = ROCKS.skin;
  if (bare <= S.from) return -S.sink;
  const T = ROCKS.strata;
  const k = bedOf(st, w, every);
  const foot = bedLevel(st, k, every);
  const thick = bedLevel(st, k + 1, every) - foot;
  const f = (w - foot) / thick;
  const r = riserOf(st, k, every);
  const b1 = Math.floor(jointOf(st, x, z));
  const b2 = Math.floor(joint2Of(st, x, z));
  let depth = T.depth[0] + (T.depth[1] - T.depth[0]) * unit(hashOf(st.seed, 0x33, k * every), 0);
  depth *= 1 + T.block * 2 * (unit(hashOf(st.seed, 0x34, k * every, b1, b2), 0) - 0.5);
  const lip = Math.min(T.most, Math.min(0.96, depth) * (1 - r) * thick);
  const ledge = f >= r ? (lip * (1 - f)) / (1 - r) : (lip * f) / r;
  const rib = T.rib * Math.max(0, (unit(hashOf(st.seed, 0x35, b1), 0) - 0.55) / 0.45);
  // In from the wall's edge the ledges grow with how bare it is.
  const k0 = Math.min(1, (bare - S.from) / 0.25);
  const grow = k0 * k0 * (3 - 2 * k0);
  return -S.sink + grow * (S.sink + S.proud + S.rough * 0.3 * rough + bare * (ledge + rib));
}

/** HOW MUCH SNOW LIES on a facet of the skin facing up `ny` in bed
 * coordinate `w`, 0..1: whole past `skin.holds`, none under `skin.slides`
 * — and a TREAD holds the snow a facet as steep would shed, up to
 * `strata.tread` of the sky more, a share dealt its bed (some beds' treads
 * lie steeper or the wind scours them). The drawing paints it and the
 * physics reads the rest as bare (`rock-ground.ts`). */
export function snowShare(st: Strata, w: number, ny: number, every = 1): number {
  const S = ROCKS.skin;
  const k = bedOf(st, w, every);
  const foot = bedLevel(st, k, every);
  const thick = bedLevel(st, k + 1, every) - foot;
  const riser = w < foot + riserOf(st, k, every) * thick;
  // A third of the beds shed it as a face does.
  const deal = unit(hashOf(st.seed, 0x79, k * every), 0);
  const held = riser ? 0 : ROCKS.strata.tread * Math.max(0, (deal - 0.3) / 0.7);
  return Math.max(0, Math.min(1, (ny + held - S.slides) / (S.holds - S.slides)));
}

/** A corner of a wall's skin, before it is lifted: its place, its ground,
 * its bed coordinate, how bare (as the physics keeps it, `bareKept`) and
 * its rough draw. */
export type StrataCorner = {
  x: number;
  z: number;
  g: number;
  w: number;
  bare: number;
  rough: number;
};

/** How bare a corner is kept, quantised to the byte the physics stores. */
export function bareKept(bare: number): number {
  return bare > ROCKS.skin.from ? Math.max(1, Math.round(bare * 255)) / 255 : 0;
}

/** The levels of `w` (each bed's foot and its riser's lip) strictly
 * between `lo` and `hi`, ascending, into `out`; how many. */
export function levelsIn(st: Strata, lo: number, hi: number, out: number[], every = 1): number {
  let n = 0;
  let k = bedOf(st, lo, every);
  for (;;) {
    const foot = bedLevel(st, k, every);
    if (foot >= hi) break;
    if (foot > lo) out[n++] = foot;
    const lip = foot + riserOf(st, k, every) * (bedLevel(st, k + 1, every) - foot);
    if (lip >= hi) break;
    if (lip > lo) out[n++] = lip;
    k++;
  }
  return n;
}

/** A vertex of a slice: x, y, z, its bed coordinate. */
export type SliceVerts = number[];

function cross(
  p: StrataCorner,
  q: StrataCorner,
  l: number,
  st: Strata,
  ground: (x: number, z: number) => number,
  out: SliceVerts,
  every: number,
): void {
  // The crossing off the edge's lower end, whichever side asks: the same
  // point from both triangles that share it.
  const a = p.w < q.w ? p : q;
  const b = a === p ? q : p;
  const t = (l - a.w) / (b.w - a.w);
  const x = a.x + (b.x - a.x) * t;
  const z = a.z + (b.z - a.z) * t;
  const bare = a.bare + (b.bare - a.bare) * t;
  const rough = a.rough + (b.rough - a.rough) * t;
  const g = ground(x, z);
  out.push(x, g + liftOf(st, l, x, z, bare, rough, every), z, l);
}

function corner(c: StrataCorner, st: Strata, out: SliceVerts, every: number): void {
  out.push(c.x, c.g + liftOf(st, c.w, c.x, c.z, c.bare, c.rough, every), c.z, c.w);
}

/** THE SLICE of triangle `a`, `b`, `c` between bed coordinates `lo` and
 * `hi` (either infinite), its polygon's vertices (four numbers each, in
 * the triangle's order) into `out`, emptied first: a convex polygon, none
 * where the triangle does not reach it. */
export function bandOf(
  st: Strata,
  ground: (x: number, z: number) => number,
  a: StrataCorner,
  b: StrataCorner,
  c: StrataCorner,
  lo: number,
  hi: number,
  out: SliceVerts,
  every = 1,
): void {
  out.length = 0;
  const tri = [a, b, c];
  for (let e = 0; e < 3; e++) {
    const p = tri[e];
    const q = tri[(e + 1) % 3];
    if (p.w >= lo && p.w <= hi) corner(p, st, out, every);
    if (p.w < q.w) {
      if (p.w < lo && lo < q.w) cross(p, q, lo, st, ground, out, every);
      if (p.w < hi && hi < q.w) cross(p, q, hi, st, ground, out, every);
    } else if (p.w > q.w) {
      if (q.w < hi && hi < p.w) cross(p, q, hi, st, ground, out, every);
      if (q.w < lo && lo < p.w) cross(p, q, lo, st, ground, out, every);
    }
  }
}

const levels: number[] = [];
const band: SliceVerts = [];

/** Triangle `a`, `b`, `c` SLICED along the beds: every slice's fan of
 * flat triangles to `emit` (nine floats of corners in `v` and the slice's
 * middle bed coordinate), each slice in turn up the beds. */
export function sliceTri(
  st: Strata,
  ground: (x: number, z: number) => number,
  a: StrataCorner,
  b: StrataCorner,
  c: StrataCorner,
  emit: (v: SliceVerts, k: number, mid: number) => void,
  every = 1,
): void {
  const lo = Math.min(a.w, b.w, c.w);
  const hi = Math.max(a.w, b.w, c.w);
  // A triangle with no bare corner lies wholly under the snow: one slice.
  const n = a.bare + b.bare + c.bare > 0 ? levelsIn(st, lo, hi, levels, every) : 0;
  for (let s = 0; s <= n; s++) {
    const l0 = s === 0 ? -Infinity : levels[s - 1];
    const l1 = s === n ? Infinity : levels[s];
    bandOf(st, ground, a, b, c, l0, l1, band, every);
    const m = (Math.max(l0, lo) + Math.min(l1, hi)) / 2;
    for (let k = 2; k < band.length / 4; k++) emit(band, k, m);
  }
}

/** The slice of triangle `a`, `b`, `c` (as `sliceTri` cuts it) bed
 * coordinate `w` lies in: the level at or under it and the next over it
 * (infinite past the last), into `out`. */
export function bandAround(
  st: Strata,
  a: StrataCorner,
  b: StrataCorner,
  c: StrataCorner,
  w: number,
  out: [number, number],
  every = 1,
): void {
  const lo = Math.min(a.w, b.w, c.w);
  const hi = Math.max(a.w, b.w, c.w);
  const n = a.bare + b.bare + c.bare > 0 ? levelsIn(st, lo, hi, levels, every) : 0;
  let below = -Infinity;
  let above = Infinity;
  for (let s = 0; s < n; s++) {
    if (levels[s] <= w) below = levels[s];
    else {
      above = levels[s];
      break;
    }
  }
  out[0] = below;
  out[1] = above;
}

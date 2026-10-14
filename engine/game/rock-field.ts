// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK FIELD — the shape of a wall's rock as ONE pure function of the
// map, read by the drawing (`pwa/src/game/rock-shapes.ts`, triangulated
// adaptively by `rock-rtin.ts`) and by the physics (`rock-ground.ts`), so
// what is drawn is what is ridden.
//
// WHAT IT IS BUILT TO (real alpine rock in winter): a crag is LAYERED and
// JOINTED. Its beds dip consistently across a whole wall and step out into
// ledges where a hard bed stands over a soft one — a steep RISER of bare
// stone under a flatter TREAD that holds snow; two sets of joints cut the
// beds into BLOCKS, each pushed out and tipped a little on its own, so a
// ledge ends in a step and a face is a few big flat planes, never a field of
// spikes. So the height over the map's ground at (x, z) is:
//
//   * the BEDS: a phase φ = the ground's height tilted by the wall's DIP (a
//     slow field over the map) and warped by a low noise, cut into beds of a
//     thickness dealt a stretch of the face at a time; each bed a sawtooth
//     — the riser up to the lip over `riser` of the bed, the tread falling
//     back to the next riser — so the face is a stair of ledges with no two
//     alike;
//   * the BLOCKS: an anisotropic Voronoi of the plan, its cells long along
//     the strike, each shifting its beds' phase (so the ledges break at the
//     joints), standing out a little and tipped a little — flat faces;
//   * all of it by how BARE the wall is (`rockShare`, read off a lattice of
//     `lattice` m and interpolated), sunk `sink` m under the snow where it
//     is not, so the rock goes into the snow at its edges, never stops.
//
// The surface a body meets is this field sampled every `fine` m and
// triangulated the finest way the drawing's adaptive mesh can be (every
// cell of the grid split along the diagonal `rock-rtin.ts` gives it): the
// drawing's near cut is a coarsening of that very surface within a few cm.
// A pure function of the map, off hashes of `level.seed`, never the
// engine's stream; no rock lies where a run is skied, so no digest moves.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";

import type { Level } from "../mapgen/types.ts";
import { ROCKS } from "./defs/rocks.ts";
import { hashOf, rockKeptOff, unit, wallBare } from "./rocks.ts";

export const ROCK_FIELD = {
  /** A tile of the adaptive mesh, m (a power of two of `fine`). */
  tile: 64,
  /** The finest sampling — the surface ridden — m. */
  fine: 1,
  /** The lattice how bare the wall is is read on, m. */
  lattice: 4,
  /** The bareness averaged over this many lattice corners each way, so a
   * crag stands out of the snow whole rather than a 2 m facet at a time. */
  blur: 2,
  /** Rock buried deeper than this under the snow is held this far under
   * it, m: the surface met and drawn follows the snow there, so where the
   * rock goes under, the two meet along one line. */
  under: 0.06,
  /** Bareness the rock rises out of the snow over (`rockShare`). */
  edge: [0.15, 0.5] as const,
  /** THE DIP: the beds tilt one way across the whole map by a slope (m per
   * m) of `least`..`most`, folded by a slow swell of `fold` m over `scale` m —
   * so every crag's beds run the same way, as a range's do. */
  dip: { least: 0.05, most: 0.3, scale: 400, fold: 18 },
  /** The bed edges warped by a noise of `scale` m, `amp` m of phase. */
  warp: { scale: 40, amp: 0.6 },
  /** THE BEDS: `least`..`most` m thick (dealt a map),
   * the riser `riser` of a bed, the ledge standing `depth` of the bed's
   * thickness out (dealt a bed) — about the wall's own face, so a lip stands
   * out of it and the back of a ledge is filled with snow; each block shifts
   * its beds by up to `shift` of one. */
  bed: { least: 8, most: 14, riser: 0.3, depth: [0.9, 1] as const, shift: 0.25, back: 0 },
  /** A cut sampling the field every `step` m draws the ledges whole where a
   * ledge is `detail[1]` steps wide or more, and only the slab they average
   * to where it is under `detail[0]`. */
  detail: [1.2, 2.5] as const,
  /** THE BLOCKS: joint cells `along` × `across` m, the long side along the
   * strike, each out up to `out` m, tipped up to `tilt` (m per m); a crack
   * within `crack` of a cell's edge (F2 − F1, m). */
  joint: { along: 16, across: 8, out: 0.12, tilt: 0.03, crack: 0.5 },
} as const;

const SALT = 0x524f434b;

/** A point of the field, for the drawing's paint. */
export type FieldPoint = {
  /** The rock's height (under the ground where none is laid), m. */
  y: number;
  /** The map's ground there, m. */
  ground: number;
  /** How much rock stands there, 0..1 (its envelope). */
  rock: number;
  /** The bed phase (the beds' banding), m. */
  phi: number;
  /** A shade of the block and the bed, 0..1. */
  shade: number;
  /** How hidden from the sky: a crack, the back of a ledge, 0..1. */
  cavity: number;
};

export type RockField = {
  readonly base: Level;
  readonly seed: number;
  /** The bareness lattice, a byte a corner, by tile of `TILE` corners. */
  readonly tiles: Map<number, Uint8Array | null>;
  /** The joint set's way, rad, the map's own. */
  readonly cos: number;
  readonly sin: number;
  /** The beds' dip, m per m, and its way. */
  readonly dip: number;
  readonly dipCos: number;
  readonly dipSin: number;
  /** The beds' thickness, m, the map's own. */
  readonly thick: number;
};

const fields = new WeakMap<Level, RockField>();

/** The rock field of `level` (laid off the map under its skin). */
export function rockFieldOf(level: Level): RockField {
  const base = level.bedrock ?? level;
  const had = fields.get(base);
  if (had) return had;
  const seed = hashOf(base.seed, SALT);
  const a = unit(seed, 9) * Math.PI;
  const d = unit(seed, 10) * Math.PI * 2;
  const D = ROCK_FIELD.dip;
  const f: RockField = {
    base,
    seed,
    tiles: new Map(),
    cos: Math.cos(a),
    sin: Math.sin(a),
    dip: D.least + (D.most - D.least) * unit(seed, 11),
    dipCos: Math.cos(d),
    dipSin: Math.sin(d),
    thick: ROCK_FIELD.bed.least + (ROCK_FIELD.bed.most - ROCK_FIELD.bed.least) * unit(seed, 12),
  };
  fields.set(base, f);
  return f;
}

// ---- the bareness lattice -------------------------------------------------

const TILE = 32;
const Q = 255;

function latticeTile(f: RockField, ti: number, tj: number): Uint8Array | null {
  const key = (ti + 2048) * 4096 + (tj + 2048);
  const had = f.tiles.get(key);
  if (had !== undefined) return had;
  const L = ROCK_FIELD.lattice;
  const B = ROCK_FIELD.blur;
  // How steep the wall is, with a margin of `blur` corners round the tile,
  // then averaged over a square of 2·blur + 1 corners a side — the wall's
  // bareness at the size of a crag, never a facet of the map's 2 m grid —
  // and kept off what the rock is kept off.
  const M = TILE + 2 * B;
  const wall = new Float32Array(M * M);
  for (let b = 0; b < M; b++) {
    for (let a = 0; a < M; a++) {
      wall[b * M + a] = wallBare(f.base, (ti * TILE + a - B) * L, (tj * TILE + b - B) * L);
    }
  }
  const out = new Uint8Array(TILE * TILE);
  let any = false;
  const n = (2 * B + 1) * (2 * B + 1);
  for (let b = 0; b < TILE; b++) {
    for (let a = 0; a < TILE; a++) {
      let sum = 0;
      for (let v = 0; v <= 2 * B; v++) {
        for (let u = 0; u <= 2 * B; u++) sum += wall[(b + v) * M + a + u];
      }
      const bare = sum / n;
      if (bare <= 0) continue;
      if (rockKeptOff(f.base, (ti * TILE + a) * L, (tj * TILE + b) * L)) continue;
      out[b * TILE + a] = Math.max(1, Math.round(bare * Q));
      any = true;
    }
  }
  const kept = any ? out : null;
  f.tiles.set(key, kept);
  return kept;
}

function cornerBare(f: RockField, i: number, j: number): number {
  const ti = Math.floor(i / TILE);
  const tj = Math.floor(j / TILE);
  const t = latticeTile(f, ti, tj);
  return t ? t[(j - tj * TILE) * TILE + (i - ti * TILE)] / Q : 0;
}

/** How bare the wall is at (x, z): the lattice's corners interpolated. */
export function bareAt(f: RockField, x: number, z: number): number {
  const L = ROCK_FIELD.lattice;
  const gx = x / L;
  const gz = z / L;
  const i = Math.floor(gx);
  const j = Math.floor(gz);
  const fx = gx - i;
  const fz = gz - j;
  const a = cornerBare(f, i, j);
  const b = cornerBare(f, i + 1, j);
  const c = cornerBare(f, i, j + 1);
  const d = cornerBare(f, i + 1, j + 1);
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}

/** Whether no rock stands anywhere in the square [x0, x1] × [z0, z1]: every
 * lattice corner round it is bare of rock. */
export function noRockIn(f: RockField, x0: number, z0: number, x1: number, z1: number): boolean {
  const L = ROCK_FIELD.lattice;
  const i0 = Math.floor(x0 / L);
  const j0 = Math.floor(z0 / L);
  const i1 = Math.floor(x1 / L) + 1;
  const j1 = Math.floor(z1 / L) + 1;
  for (let tj = Math.floor(j0 / TILE); tj <= Math.floor(j1 / TILE); tj++) {
    for (let ti = Math.floor(i0 / TILE); ti <= Math.floor(i1 / TILE); ti++) {
      if (latticeTile(f, ti, tj)) return false;
    }
  }
  return true;
}

// ---- noise ----------------------------------------------------------------

/** Smooth value noise, 0..1, of period `s` m. */
function noise(seed: number, x: number, z: number, s: number): number {
  const gx = x / s;
  const gz = z / s;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  let fx = gx - ix;
  let fz = gz - iz;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  const a = unit(hashOf(seed, ix, iz), 0);
  const b = unit(hashOf(seed, ix + 1, iz), 0);
  const c = unit(hashOf(seed, ix, iz + 1), 0);
  const d = unit(hashOf(seed, ix + 1, iz + 1), 0);
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---- the field --------------------------------------------------------------

const nrm = { x: 0, y: 1, z: 0 };
const scratch: FieldPoint = { y: 0, ground: 0, rock: 0, phi: 0, shade: 0, cavity: 0 };

/** THE ROCK AT (x, z): its height and its paint into `out`. */
export function fieldAt(
  f: RockField,
  x: number,
  z: number,
  out: FieldPoint = scratch,
  step: number = ROCK_FIELD.fine,
): FieldPoint {
  const S = ROCKS.skin;
  const F = ROCK_FIELD;
  const ground = f.base.groundAt(x, z);
  const bare = bareAt(f, x, z);
  out.ground = ground;
  const e = smoothstep(F.edge[0], F.edge[1], bare);
  out.rock = e;
  if (e <= 0) {
    out.y = ground - F.under;
    out.phi = ground;
    out.shade = 0.5;
    out.cavity = 0;
    return out;
  }
  const seed = f.seed;
  // The joint cells, long along the strike.
  const u = (x * f.cos + z * f.sin) / F.joint.along;
  const v = (-x * f.sin + z * f.cos) / F.joint.across;
  const iu = Math.floor(u);
  const iv = Math.floor(v);
  let d1 = Infinity;
  let d2 = Infinity;
  let cu = 0;
  let cv = 0;
  let ch = 0;
  for (let b = -1; b <= 1; b++) {
    for (let a = -1; a <= 1; a++) {
      const h = hashOf(seed, iu + a, iv + b);
      const pu = iu + a + 0.15 + 0.7 * unit(h, 0);
      const pv = iv + b + 0.15 + 0.7 * unit(h, 1);
      const du = (u - pu) * F.joint.along;
      const dv = (v - pv) * F.joint.across;
      const d = Math.sqrt(du * du + dv * dv);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        cu = pu;
        cv = pv;
        ch = h;
      } else if (d < d2) d2 = d;
    }
  }
  // The block's centre in plan, and how it stands.
  const bx = (cu * F.joint.along * f.cos - cv * F.joint.across * f.sin) as number;
  const bz = (cu * F.joint.along * f.sin + cv * F.joint.across * f.cos) as number;
  const tilt = F.joint.tilt;
  const block = Math.max(
    0,
    F.joint.out * unit(ch, 2) +
      tilt * ((unit(ch, 3) - 0.5) * 2 * (x - bx) + (unit(ch, 4) - 0.5) * 2 * (z - bz)),
  );
  // The beds: the ground tilted by the dip, warped, shifted a block at a time.
  const thick = f.thick;
  const phi =
    ground +
    f.dip * (x * f.dipCos + z * f.dipSin) +
    F.dip.fold * (noise(seed + 1, x, z, F.dip.scale) - 0.5) * 2 +
    F.warp.amp * (noise(seed + 4, x, z, F.warp.scale) - 0.5) * 2;
  const q = phi / thick + unit(ch, 5) * F.bed.shift;
  const k = Math.floor(q);
  const s = q - k;
  const w = F.bed.riser;
  const depth = F.bed.depth[0] + (F.bed.depth[1] - F.bed.depth[0]) * unit(hashOf(seed, k, 77), 0);
  // The riser eased in at its foot and over its lip, so a lip is a rounded
  // edge a metre or two across rather than a crease the mesh saws at.
  const prof = (s < w ? smoothstep(0, 1, s / w) * (1 - w) : 1 - s) - F.bed.back * (1 - w);
  // Sampled coarser than a ledge is wide (a far cut of the drawing), the
  // beds are drawn as the slab they average to — the ledges are painted on
  // it — never aliased into a saw; at the physics' own grid, whole.
  const mean = (0.5 - F.bed.back) * (1 - w);
  let strata = thick * depth * prof;
  if (step > F.fine) {
    f.base.normalAt(x, z, nrm);
    const wide = thick / (hypot(nrm.x, nrm.z) / Math.max(0.05, nrm.y) + F.dip.least) / step;
    strata = thick * depth * (mean + smoothstep(F.detail[0], F.detail[1], wide) * (prof - mean));
  }
  // The beds stand whole inside a crag, so their treads lie level whatever
  // the wall: scaled down only where the crag goes into the snow.
  out.y = Math.max(ground - F.under, ground - S.sink + e * (S.sink + S.proud + strata + block));
  out.phi = phi;
  out.shade = 0.5 * unit(ch, 6) + 0.5 * unit(hashOf(seed, k, 78), 0);
  // The back of a ledge (the foot of the riser over it) and the cracks.
  const back = 1 - smoothstep(0, 0.22, 1 - s);
  const crack = 1 - smoothstep(0, F.joint.crack, d2 - d1);
  out.cavity = Math.max(back * 0.8, crack * 0.7) * e;
  return out;
}

/** The rock's height at (x, z) alone. */
export function fieldY(f: RockField, x: number, z: number): number {
  return fieldAt(f, x, z, scratch).y;
}

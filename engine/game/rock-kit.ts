// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK KIT LAID — the walls BUILT OF PIECES (`rock-hull.ts`' slabs,
// buttress prisms, blocks and wedges) and the TALUS of fallen blocks under
// them, laid off hashes of the map's seed a cell of `ROCKS.kit.cell` m at a
// time. One answer for the drawing (`pwa/src/game/rock-kit-view.ts`, which
// instances every piece of `kitStones`) and the physics (`kitTop`, which
// `rock-ground.ts` stands a body on): what is drawn is what is ridden.
//
// HOW A WALL IS MADE: real alpine rock is BEDDED — near-parallel beds a few
// metres thick dipping coherently across a whole face — and cut by joints
// into blocks, and the face is ribbed into BUTTRESSES and GULLIES. So every
// wall piece is turned to the wall's own frame (along its strike, out of
// it, up it), the strike tipped by the massif's DIP (`dipAt`, a slow field
// over the map), stood in the middle of its BED (`bedOf`) and as thick as
// it, and stood proud by a share its bed and its rib deal: a buttress's
// pieces big and proud, a gully's few and small. The top of each piece
// faces up the face, so a bed's top is a LEDGE the snow lies on.
//
// THE TALUS: below a wall, on the slope its blocks have come to rest on
// (no steeper than about 48°, the angle of repose and the snow's slope
// under it), boulders and blocks half buried in the snow, small at the
// wall's foot and the big ones run out furthest, in FANS where the noise
// along the foot gathers them (the cones under a gully's mouth).
//
// Kept off every run and bike trail (`nearCut`) and every cliff, as the
// skin is (`rocks.ts`), so no digest moves. Only where the region shows
// rock (`Region.rock`).

import { hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Level } from "../mapgen/types.ts";
import { regionOf } from "../mapgen/regions.ts";
import { ROCKS } from "./defs/rocks.ts";
import { PIECE, rockPieces } from "./rock-hull.ts";
import { hashOf, nearCut, onAnyCliff, rockShare, unit } from "./rocks.ts";

/** The salt the kit is dealt off. */
export const KIT_SALT = 0x4b495420;

/** One piece laid: which, its frame and where. */
export type KitStone = {
  /** Its piece in `rockPieces()`. */
  readonly piece: number;
  /** The piece's frame in the world, its unit box stretched: the columns
   * along the strike (x), out of the wall (y) and up it (z), then its
   * origin — twelve numbers. */
  readonly m: Float64Array;
  /** Its middle in plan and how far from it any of it reaches, m. */
  readonly cx: number;
  readonly cz: number;
  readonly r: number;
  /** Its paint: a shade of the rock (0..1) and a warmth (-1..1). */
  readonly shade: number;
  readonly warm: number;
  /** A fallen block of the talus, not the wall. */
  readonly talus: boolean;
  /** Its near cut's planes in the world, made when a body first asks. */
  planes?: Float64Array;
};

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Value noise over the map, 0..1, `scale` m a cell, off `seed`. */
function noise(seed: number, x: number, z: number, scale: number): number {
  const fx = x / scale;
  const fz = z / scale;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = smooth(fx - i);
  const v = smooth(fz - j);
  const a = unit(hashOf(seed, i, j), 0);
  const b = unit(hashOf(seed, i + 1, j), 0);
  const c = unit(hashOf(seed, i, j + 1), 0);
  const d = unit(hashOf(seed, i + 1, j + 1), 0);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** THE DIP of the beds at (x, z), rad: a slow field over the massif, so a
 * wall's beds tip one way across the whole of it. */
export function dipAt(seed: number, x: number, z: number): number {
  return (noise(seed ^ 0x6469, x, z, 420) * 2 - 1) * ROCKS.kit.dip;
}

/** THE BED a point of a wall lies in: its index, how far up it the point
 * is (0..1) and how thick the beds are there, m. `sx`, `sz` the wall's
 * strike in plan. Shared by the pieces and the skin's paint. */
export function bedOf(
  seed: number,
  x: number,
  y: number,
  z: number,
  sx: number,
  sz: number,
): { index: number; frac: number; thick: number } {
  const [lo, hi] = ROCKS.kit.bed;
  const thick = lo + (hi - lo) * noise(seed ^ 0x626564, x, z, 260);
  const along = x * sx + z * sz;
  // The bed's edges wander a little along the face, never a ruled line.
  const warp = (noise(seed ^ 0x77, x, z, 23) - 0.5) * 0.7 * thick;
  const h = (y - Math.tan(dipAt(seed, x, z)) * along + warp) / thick;
  const index = Math.floor(h);
  return { index, frac: h - index, thick };
}

/** The candidates' spots a cell holds, and the cells' cache a map's kit
 * keeps for the physics. */
type Cache = Map<number, KitStone[] | null>;
const caches = new WeakMap<Level, Cache>();

const N = { x: 0, y: 1, z: 0 };

/** EVERY PIECE LAID IN CELL (ci, cj) of `level`'s kit — a pure function of
 * the map (laid off its rock, `bedrock`). Empty where no rock is near. */
export function kitStones(level: Level, ci: number, cj: number): KitStone[] {
  const base = level.bedrock ?? level;
  if (!regionOf(base).rock) return [];
  const K = ROCKS.kit;
  const seed = hashOf(base.seed, KIT_SALT);
  const x0 = ci * K.cell;
  const z0 = cj * K.cell;
  // A cell with no wall within the talus' reach holds nothing: a coarse
  // look first.
  let near = false;
  for (let b = -2; b <= 3 && !near; b++) {
    for (let a = -2; a <= 3 && !near; a++) {
      const x = x0 + a * (K.cell / 2) + K.cell / 4;
      const z = z0 + b * (K.cell / 2) + K.cell / 4;
      if (x < 0 || z < 0 || x > base.size || z > base.size) continue;
      if (rockShare(base, x, z) > 0) near = true;
    }
  }
  if (!near) return [];
  const out: KitStone[] = [];
  // Two tiers: the BIG blocks the wall is built of, a candidate every
  // `big` m, then the broken pieces between them every `step` m.
  for (const [tier, pitch] of [
    [0, K.big],
    [1, K.step],
  ] as const) {
    const steps = Math.round(K.cell / pitch);
    const step = K.cell / steps;
    for (let b = 0; b < steps; b++) {
      for (let a = 0; a < steps; a++) {
        const h = hashOf(seed, ci * steps + a, cj * steps + b, tier);
        const x = x0 + (a + 0.15 + 0.7 * unit(h, 0)) * step;
        const z = z0 + (b + 0.15 + 0.7 * unit(h, 1)) * step;
        if (x < 8 || z < 8 || x > base.size - 8 || z > base.size - 8) continue;
        const bare = rockShare(base, x, z);
        const stone =
          bare >= K.wall
            ? wallStone(base, seed, x, z, bare, h, tier === 0)
            : bare > 0 || tier === 0
              ? null
              : talusStone(base, seed, x, z, h);
        if (stone) out.push(stone);
      }
    }
  }
  return out;
}

/** A frame `m` of columns `s`, `n`, `u` scaled `sx`, `sy`, `sz`, origin `t`. */
function frame(
  s: readonly number[],
  n: readonly number[],
  u: readonly number[],
  sx: number,
  sy: number,
  sz: number,
  t: readonly number[],
): Float64Array {
  return new Float64Array([
    s[0] * sx,
    s[1] * sx,
    s[2] * sx,
    n[0] * sy,
    n[1] * sy,
    n[2] * sy,
    u[0] * sz,
    u[1] * sz,
    u[2] * sz,
    t[0],
    t[1],
    t[2],
  ]);
}

/** A strike turned `a` rad about the unit `n` from the level one. */
function strikeOf(n: { x: number; y: number; z: number }, a: number): number[][] {
  // Level along the wall: n × up.
  let sx = -n.z;
  let sz = n.x;
  const l = hypot(sx, sz) || 1;
  sx /= l;
  sz /= l;
  // n × s0, to turn about n.
  const wx = n.y * sz;
  const wy = n.z * sx - n.x * sz;
  const wz = -n.y * sx;
  const c = Math.cos(a);
  const si = Math.sin(a);
  let s = [sx * c + wx * si, wy * si, sz * c + wz * si];
  // Up the face: s × n, turned up (both turned keep the frame right-handed).
  let u = [s[1] * n.z - s[2] * n.y, s[2] * n.x - s[0] * n.z, s[0] * n.y - s[1] * n.x];
  if (u[1] < 0) {
    u = u.map((v) => -v);
    s = s.map((v) => -v);
  }
  return [s, [n.x, n.y, n.z], u];
}

/** A WALL PIECE at candidate (x, z), the wall `bare` there; null where it
 * would stand off the wall. */
function wallStone(
  base: Level,
  seed: number,
  x: number,
  z: number,
  bare: number,
  h: number,
  big: boolean,
): KitStone | null {
  const K = ROCKS.kit;
  const rib = noise(seed ^ 0x726962, x, z, K.rib);
  // A gully holds fewer pieces and smaller; a buttress is built of them.
  const dense = big ? K.density : K.rubble;
  if (unit(h, 2) > dense * Math.min(1, bare * 1.4) * (0.55 + 0.7 * rib)) return null;
  base.normalAt(x, z, N);
  const dip = dipAt(seed, x, z) + (unit(h, 3) - 0.5) * 0.12;
  const [s, , u] = strikeOf(N, dip);
  const bed = bedOf(seed, x, base.groundAt(x, z), z, s[0], s[2]);
  // Into the middle of its bed, along the face.
  const shift = ((0.5 - bed.frac) * bed.thick) / Math.max(0.35, u[1]);
  const px = x + u[0] * shift;
  const pz = z + u[2] * shift;
  const bare2 = rockShare(base, px, pz);
  if (bare2 < K.wall * 0.6) return null;
  const gy = base.groundAt(px, pz);
  const kinds = !big
    ? [PIECE.shard, PIECE.wedge, PIECE.block, PIECE.slab]
    : rib > 0.62
      ? [PIECE.prism, PIECE.block, PIECE.slab]
      : rib < 0.3
        ? [PIECE.wedge, PIECE.block, PIECE.slab]
        : [PIECE.slab, PIECE.long, PIECE.block, PIECE.long];
  const piece = kinds[Math.floor(unit(h, 4) * kinds.length)];
  // How proud: its bed's own share along a stretch of it, a rib prouder,
  // so a bed stands out as one LEDGE across the face.
  const along0 = px * s[0] + pz * s[2];
  const bedOut = unit(hashOf(seed, bed.index, Math.floor(along0 / 26)), 0);
  // A STEP: the piece turned about the strike toward the vertical, so its
  // front is a riser and its top a tread the snow lies on — the way a
  // bedded wall weathers back into ledges rather than plates along it.
  const k = big ? K.terrace : K.terrace * 0.5;
  const yp = [-s[1] * s[0], 1 - s[1] * s[1], -s[1] * s[2]];
  const ly = hypot3(yp[0], yp[1], yp[2]) || 1;
  const tilt = (unit(h, 8) - 0.5) * 0.14;
  let ux = u[0] * (1 - k) + (yp[0] / ly) * k + s[0] * tilt;
  let uy = u[1] * (1 - k) + (yp[1] / ly) * k + s[1] * tilt;
  let uz = u[2] * (1 - k) + (yp[2] / ly) * k + s[2] * tilt;
  const lu = hypot3(ux, uy, uz);
  ux /= lu;
  uy /= lu;
  uz /= lu;
  // s re-squared to u, then n = u × s (the frame right-handed: u = s × n).
  const su = s[0] * ux + s[1] * uy + s[2] * uz;
  let s0 = s[0] - ux * su;
  let s1 = s[1] - uy * su;
  let s2 = s[2] - uz * su;
  const lss = hypot3(s0, s1, s2);
  s0 /= lss;
  s1 /= lss;
  s2 /= lss;
  const n2 = [uy * s2 - uz * s1, uz * s0 - ux * s2, ux * s1 - uy * s0];
  // Sized off the ground's plane at its foot: the back of the tread sunk
  // `bury`, the riser standing `proud` out of it, its foot buried too.
  const a = Math.max(0.2, N.x * n2[0] + N.y * n2[1] + N.z * n2[2]);
  const b = Math.max(0.2, N.x * ux + N.y * uy + N.z * uz);
  const proud = big
    ? K.proud[0] +
      (K.proud[1] - K.proud[0]) *
        Math.min(1, 0.65 * bedOut + 0.55 * rib) *
        (0.8 + 0.4 * unit(h, 11))
    : 0.25 + 0.35 * unit(h, 11);
  // The riser's height is stated upright; out of the ground's plane it is
  // that much less the steeper the wall, so a step on a sheer face is a
  // narrow shelf rather than a tread metres deep.
  const up = Math.max(0.3, N.y);
  const bury = K.bury;
  const sy = Math.min(big ? 6 : 2.4, (proud * up + bury) / a) * (piece === PIECE.wedge ? 1.25 : 1);
  const sz =
    ((proud * up + K.foot) / b) * (piece === PIECE.prism ? 1.5 : 1) * (0.9 + 0.2 * unit(h, 5));
  const sx =
    (big ? (piece === PIECE.long ? 9.5 : piece === PIECE.prism ? 4.2 : 7) : 2.2) *
    (0.8 + 0.4 * unit(h, 6)) *
    (big ? 1 : 0.6 + 0.65 * rib);
  const h0 = -bury - (b * sz) / 2;
  const t = [px + N.x * h0, gy + N.y * h0, pz + N.z * h0];
  const m = frame([s0, s1, s2], n2, [ux, uy, uz], sx, sy, sz, t);
  // Bands along the beds, streaks down the fall line.
  const band = unit(hashOf(seed, bed.index, 3), 0);
  const along = along0;
  const streak = noise(seed ^ 0x737472, along, 0, 9);
  return {
    piece,
    m,
    cx: px,
    cz: pz,
    r: 0.5 * hypot3(sx, sy, sz) + 0.3,
    shade: Math.min(1, Math.max(0, 0.25 + 0.45 * band + 0.3 * unit(h, 9) - 0.25 * streak)),
    warm: (noise(seed ^ 0x69726f, along, gy, 17) - 0.5) * 2,
    talus: false,
  };
}

/** A BLOCK OF THE TALUS at candidate (x, z), or null: below a wall, on a
 * slope it rests on, clear of every run, trail and cliff. */
function talusStone(base: Level, seed: number, x: number, z: number, h: number): KitStone | null {
  const K = ROCKS.kit;
  base.normalAt(x, z, N);
  const plan = hypot(N.x, N.z);
  const slope = plan / Math.max(1e-3, N.y);
  if (slope > K.slope || slope < K.gentle) return null;
  // Up the fall line to the wall's foot.
  const ux = -N.x / plan;
  const uz = -N.z / plan;
  let foot = -1;
  for (let d = 5; d <= K.reach; d += 5) {
    if (rockShare(base, x + ux * d, z + uz * d) > 0.45) {
      foot = d;
      break;
    }
  }
  if (foot < 0) return null;
  const run = foot / K.reach;
  // Gathered into fans along the foot.
  const fan = noise(seed ^ 0x66616e, x, z, 46);
  if (unit(h, 2) > K.scree * (0.25 + 1.2 * fan) * (1 - 0.55 * run)) return null;
  if (nearCut(base, x, z) || onAnyCliff(base, x, z, 4)) return null;
  const kinds = [PIECE.boulder, PIECE.boulder, PIECE.flat, PIECE.shard, PIECE.block, PIECE.flat];
  const piece = kinds[Math.floor(unit(h, 4) * kinds.length)];
  // Sorted: the big blocks run out furthest.
  const size = (K.stone + (K.toe - K.stone) * run ** 0.8) * (0.6 + 0.7 * unit(h, 5));
  const sx = size * (0.85 + 0.4 * unit(h, 6));
  const sz = size * (0.85 + 0.4 * unit(h, 7));
  const sy = size * (0.55 + 0.3 * unit(h, 8));
  // Settled half way to the slope: up a little off its normal.
  let nx = N.x * 0.5;
  let ny = N.y * 0.5 + 0.5;
  let nz = N.z * 0.5;
  const ln = hypot3(nx, ny, nz);
  nx /= ln;
  ny /= ln;
  nz /= ln;
  const [s, n, u] = strikeOf({ x: nx, y: ny, z: nz }, unit(h, 9) * Math.PI * 2);
  const [lo, hi] = K.buried;
  const back = sy * (lo + (hi - lo) * unit(h, 10));
  const gy = base.groundAt(x, z);
  const t = [x - n[0] * back, gy - n[1] * back, z - n[2] * back];
  return {
    piece,
    m: frame(s, n, u, sx, sy, sz, t),
    cx: x,
    cz: z,
    r: 0.5 * hypot3(sx, sy, sz) + 0.3,
    shade: 0.35 + 0.5 * unit(h, 11),
    warm: (unit(h, 12) - 0.5) * 1.2,
    talus: true,
  };
}

/** Stone `k`'s near cut as planes in the world: nx, ny, nz, d a face. */
function planesOf(k: KitStone): Float64Array {
  if (k.planes) return k.planes;
  const local = rockPieces()[k.piece].planes;
  const m = k.m;
  const lx = hypot3(m[0], m[1], m[2]);
  const ly = hypot3(m[3], m[4], m[5]);
  const lz = hypot3(m[6], m[7], m[8]);
  const out = new Float64Array(local.length);
  for (let f = 0; f < local.length; f += 4) {
    // The normal through the frame's inverse transpose: each axis's unit
    // column over its stretch.
    const a = local[f] / (lx * lx);
    const b = local[f + 1] / (ly * ly);
    const c = local[f + 2] / (lz * lz);
    const nx = m[0] * a + m[3] * b + m[6] * c;
    const ny = m[1] * a + m[4] * b + m[7] * c;
    const nz = m[2] * a + m[5] * b + m[8] * c;
    out[f] = nx;
    out[f + 1] = ny;
    out[f + 2] = nz;
    out[f + 3] = local[f + 3] + nx * m[9] + ny * m[10] + nz * m[11];
  }
  k.planes = out;
  return out;
}

/** What a body meets of the kit at a point. */
export type KitTop = { y: number; nx: number; ny: number; nz: number };

/** THE TOP OF THE KIT at (x, z) — the highest piece's top face there (its
 * near cut, the one drawn near the lens) — into `out`; false where no
 * piece stands. The physics' (`rock-ground.ts`), cached a cell at a time. */
export function kitTop(level: Level, x: number, z: number, out: KitTop): boolean {
  const base = level.bedrock ?? level;
  let cache = caches.get(base);
  if (!cache) {
    cache = new Map();
    caches.set(base, cache);
  }
  const cell = ROCKS.kit.cell;
  const reach = 3.6;
  const ci0 = Math.floor((x - reach) / cell);
  const ci1 = Math.floor((x + reach) / cell);
  const cj0 = Math.floor((z - reach) / cell);
  const cj1 = Math.floor((z + reach) / cell);
  let found = false;
  let best = -Infinity;
  for (let cj = cj0; cj <= cj1; cj++) {
    for (let ci = ci0; ci <= ci1; ci++) {
      const key = (ci + 4096) * 8192 + (cj + 4096);
      let stones = cache.get(key);
      if (stones === undefined) {
        const s = kitStones(base, ci, cj);
        stones = s.length ? s : null;
        cache.set(key, stones);
      }
      if (!stones) continue;
      for (const k of stones) {
        const dx = x - k.cx;
        const dz = z - k.cz;
        if (dx * dx + dz * dz > k.r * k.r) continue;
        const p = planesOf(k);
        let top = Infinity;
        let bottom = -Infinity;
        let tf = -1;
        let inside = true;
        for (let f = 0; f < p.length; f += 4) {
          const ny = p[f + 1];
          const rest = p[f + 3] - p[f] * x - p[f + 2] * z;
          if (ny > 1e-9) {
            const y = rest / ny;
            if (y < top) {
              top = y;
              tf = f;
            }
          } else if (ny < -1e-9) {
            bottom = Math.max(bottom, rest / ny);
          } else if (rest < 0) {
            inside = false;
            break;
          }
        }
        if (!inside || tf < 0 || top < bottom || top <= best) continue;
        best = top;
        found = true;
        const l = hypot3(p[tf], p[tf + 1], p[tf + 2]);
        out.y = top;
        out.nx = p[tf] / l;
        out.ny = p[tf + 1] / l;
        out.nz = p[tf + 2] / l;
      }
    }
  }
  return found;
}

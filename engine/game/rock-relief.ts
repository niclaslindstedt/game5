// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK'S SHAPE — one pure function of the plan and the ground's height
// that says how far a wall's rock stands out of (or is cut into) the ground
// under it, read by the physics (`rock-ground.ts`' `withRock`) and drawn by
// the ground itself: the clipmap's vertex shader (`pwa/src/game/
// rock-relief-glsl.ts`) lifts every vertex by the same function, line for
// line, so the rock is not a skin laid over the snow but the ground there,
// with no seam where it meets the snow and no draw call of its own.
//
// WHAT A REAL CRAG IS, and so what the function is made of:
//   * BEDS — a wall of layered rock is a stack of beds that DIP the same way
//     across the whole face. Each bed is a TREAD (a flatter bench that holds
//     the snow) and a RISER (a steep step of bare stone): the height is
//     terraced along a bed coordinate `b` that rises with the ground and
//     with a dip plane dealt off the seed, its bed edges warped by noise so
//     no two ledges run parallel for long. Every bed its own tread and riser.
//   * JOINTS — a set of near-vertical cracks across the beds, a few metres
//     apart: each block between two of them shifts the beds by its own share
//     (so a ledge ends at a joint and starts again higher or lower), bulges
//     out by its own amount, and the crack between is a notch.
//   * RIBS — buttresses and gullies tens of metres across, a ridged noise.
// Everything is continuous (a heightfield with no cliff edge in it), so the
// ground's mesh, which samples it at its vertices, meets the physics, which
// reads it exactly, within its interpolation; the drawing only fades the
// beds and blocks with distance as its vertices thin out (the shader paints
// them on in their place), never near a body.
//
// A pure function of the map, off hashes of `level.seed` and never the
// engine's stream. The integer hash is the GLSL's to the bit (`uint`
// arithmetic), the noise its to the float.

import type { Level } from "../mapgen/types.ts";

/** The salt the rock's shape is dealt off. */
export const RELIEF_SALT = 0x524c4946;

/** THE NUMBERS the shape is built to, shared with the shader. */
export const RELIEF = {
  /** A bed's thickness, m: the least and the most a map is dealt. */
  bed: [4.5, 6.5] as const,
  /** The beds' dip off level, rad: the least and the most. */
  dip: [0.14, 0.45] as const,
  /** A bed's riser share of it (the least, and how much more), and the
   * share of its rise its tread takes (the least, and how much more). */
  riser: [0.3, 0.25] as const,
  tread: [0.1, 0.25] as const,
  /** The bed edges' wander: a share of a bed, over a long and a short
   * wavelength (m). */
  warp: [0.38, 0.14] as const,
  warpLength: [23, 7.3] as const,
  /** The joints: their spacing (the least and the most), m; how far one
   * block's beds are shifted off its neighbour's, of a bed; the crack's
   * share of a block; the joints' own wander; a block's bulge and a crack's
   * notch, m. */
  joint: [6, 11] as const,
  shift: 0.7,
  crack: 0.12,
  jointWarp: 0.45,
  bulge: 0.55,
  notch: 0.4,
  /** The buttresses and gullies: their wavelength, m, and their relief. */
  rib: 26,
  ribRelief: 2.2,
  /** The beds stood out of the ground on the whole by this share of one,
   * so the rock is as much proud of the wall as cut into it. */
  lift: 0.22,
} as const;

/** A map's rock, as dealt: the dip plane (m per m in x and z), the bed's
 * thickness, the joints' direction and spacing, and the salt. */
export type ReliefParams = {
  readonly dipX: number;
  readonly dipZ: number;
  readonly bed: number;
  readonly jointX: number;
  readonly jointZ: number;
  readonly joint: number;
  readonly salt: number;
};

// THE HASH — a 32-bit integer hash (lowbias32), the shader's own.
function h32(v: number): number {
  v = (v ^ (v >>> 16)) >>> 0;
  v = Math.imul(v, 0x7feb352d) >>> 0;
  v = (v ^ (v >>> 15)) >>> 0;
  v = Math.imul(v, 0x846ca68b) >>> 0;
  return (v ^ (v >>> 16)) >>> 0;
}

/** Integers are offset so the shader's `uint` of one is the same bits. */
const OFF = 65536;

/** Lattice (i, j) under salt `s` to 0..1, the shader's `rrHash`. */
export function reliefHash(i: number, j: number, s: number): number {
  const h = h32(((i + OFF) >>> 0) ^ h32(((j + OFF) >>> 0) ^ h32(s >>> 0)));
  return (h >>> 8) / 16777216;
}

const sm = (t: number): number => t * t * (3 - 2 * t);

/** Value noise at (x, z) under salt `s`, 0..1. */
export function reliefNoise(x: number, z: number, s: number): number {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const u = sm(x - i);
  const v = sm(z - j);
  const a = reliefHash(i, j, s);
  const b = reliefHash(i + 1, j, s);
  const c = reliefHash(i, j + 1, s);
  const d = reliefHash(i + 1, j + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A map's rock, dealt off its seed. */
export function reliefParams(level: Pick<Level, "seed">): ReliefParams {
  const s = h32((level.seed ^ RELIEF_SALT) >>> 0);
  const r = (n: number): number => reliefHash(n, 7, s);
  const R = RELIEF;
  const dipDir = r(1) * 2 * Math.PI;
  const dip = Math.tan(R.dip[0] + (R.dip[1] - R.dip[0]) * r(2));
  const jointDir = dipDir + Math.PI / 2 + (r(3) - 0.5) * 0.7;
  return {
    dipX: dip * Math.cos(dipDir),
    dipZ: dip * Math.sin(dipDir),
    bed: R.bed[0] + (R.bed[1] - R.bed[0]) * r(4),
    jointX: Math.cos(jointDir),
    jointZ: Math.sin(jointDir),
    joint: R.joint[0] + (R.joint[1] - R.joint[0]) * r(5),
    salt: s,
  };
}

/** The rock's shape split as the drawing fades it: the beds and blocks
 * (`beds`), the buttresses (`ribs`), and the beds' mean lift (`lift`). */
export type ReliefParts = { beds: number; ribs: number; lift: number };

/** THE ROCK'S RELIEF at plan (x, z) over ground `y`, m, in its parts. */
export function reliefParts(
  p: ReliefParams,
  x: number,
  z: number,
  y: number,
  out: ReliefParts,
): ReliefParts {
  const R = RELIEF;
  const T = p.bed;
  const s = p.salt;
  // The joints: which block, how far across it, and its beds' shift.
  const u =
    (p.jointX * x + p.jointZ * z) / p.joint + R.jointWarp * reliefNoise(x / 11, z / 11, s + 3);
  const c = Math.floor(u);
  const fu = u - c;
  const w = R.crack;
  const across = smooth(1 - w, 1, fu);
  const shift =
    R.shift *
    (reliefHash(c, 0, s + 5) + (reliefHash(c + 1, 0, s + 5) - reliefHash(c, 0, s + 5)) * across);
  // The bed coordinate: up the ground and the dip plane, the edges warped.
  const warp =
    R.warp[0] * (reliefNoise(x / R.warpLength[0], z / R.warpLength[0], s + 1) - 0.5) +
    R.warp[1] * (reliefNoise(x / R.warpLength[1], z / R.warpLength[1], s + 2) - 0.5);
  const b = (y + p.dipX * x + p.dipZ * z) / T + warp + shift;
  const k = Math.floor(b);
  const f = b - k;
  // This bed's riser and tread.
  const r = R.riser[0] + R.riser[1] * reliefHash(k, 1, s + 7);
  const tau = R.tread[0] + R.tread[1] * reliefHash(k, 2, s + 7);
  const S = f < 1 - r ? (tau * f) / (1 - r) : tau + (1 - tau) * sm((f - (1 - r)) / r);
  // The block's bulge, none at its edges, and the crack's notch.
  const inBlock = smooth(0, 0.12, fu) * (1 - smooth(1 - w - 0.1, 1 - w, fu));
  const inBed = smooth(0.04, 0.2, f) * (1 - smooth(0.85, 0.98, f));
  const bulge = R.bulge * (reliefHash(c, k, s + 9) - 0.35) * inBlock * inBed;
  const notch = fu > 1 - w ? R.notch * Math.sin((Math.PI * (fu - (1 - w))) / w) : 0;
  out.beds = T * (S - f) + bulge - notch;
  const rn = reliefNoise(x / R.rib, z / R.rib, s + 11);
  out.ribs = R.ribRelief * (0.5 - Math.abs(2 * rn - 1));
  out.lift = R.lift * T;
  return out;
}

const parts: ReliefParts = { beds: 0, ribs: 0, lift: 0 };

/** THE ROCK'S RELIEF at plan (x, z) over ground `y`, m: how far the rock
 * stands over the ground there (negative where it is cut into it), whole. */
export function reliefAt(p: ReliefParams, x: number, z: number, y: number): number {
  reliefParts(p, x, z, y, parts);
  return parts.beds + parts.ribs + parts.lift;
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE ROCK BREAKS THROUGH — the crags, shards and pinnacles that
// stand up out of every face too steep to hold snow (the faces the snow
// shader already paints dark, `region-look.ts`'s `rock`). Three-free and
// pure: a function of the map and its region's band, dealt off hashes of
// `level.seed`, never the engine's stream, so no digest can see it; the
// geometry is `rock-shapes.ts`'s and the draw `rocks.ts`'s.
//
// WHAT A REAL CRAG IN WINTER IS (the reference this is built to): rock
// shows where the slope passes about 35–40°, the snow sliding off it —
// not as a smooth dark patch but as BROKEN, ANGULAR rock: sharp blades and
// spires a metre to a few metres high, packed together in OUTCROPS, their
// slabs all running one way (the rock's bedding, the STRIKE, mostly across
// the slope) and leaning one way (the DIP), a lone gendarme now and then
// standing taller than the rest. Snow lies on every facet that faces up
// enough to hold it. So an outcrop is a knot of shards on one strike, and
// how many there are, and how big, grows with how steep and bare the face
// is.
//
// Nothing stands on the snow anyone skis (the packed field — the piste,
// the runs, the venues), next to a trunk, or off the map.

import type { Level, Vec3 } from "@engine";

/** The slopes, m per m, rock starts showing at and is whole at — the
 * region's band (`RegionLook.rock`). */
export type RockBand = { readonly from: number; readonly to: number };

/** One OUTCROP: a knot of shards round `x, z`. */
export type Outcrop = {
  readonly x: number;
  readonly z: number;
  /** The ground at its middle, m. */
  readonly y: number;
  /** How bare the face is here, 0..1 — the shader's own rock share. */
  readonly bare: number;
  /** The tallest shard's height over the ground, m. */
  readonly height: number;
  /** How far the knot spreads round its middle, m. */
  readonly spread: number;
  /** The rock's bedding: the heading its slabs run along, rad (heading
   * convention: 0 = +z, clockwise from above). */
  readonly strike: number;
  /** How far the shards lean off plumb, rad, and which way (the heading). */
  readonly dip: number;
  readonly dipHeading: number;
  /** How many shards. */
  readonly shards: number;
  /** Its own hash, everything else about its shards drawn off it. */
  readonly hash: number;
};

/** THE NUMBERS. */
export const ROCKS = {
  /** The lattice an outcrop may stand on, m (one jittered point a cell). */
  cell: 7,
  /** At a whole rock share, the chance a cell carries an outcrop. */
  density: 0.75,
  /** The least rock share an outcrop stands at. */
  least: 0.12,
  /** The most packed share an outcrop stands on (the piste's shoulders
   * fade, so a little is let by). */
  packed: 0.05,
  /** No shard within this of a trunk, m. */
  trunk: 3,
  /** An outcrop's tallest shard, m: from `low` on a face just bare to
   * `high` on a wall, with a GENDARME — `tower` times taller — dealt at
   * `towerShare` of the barest outcrops. */
  low: 0.7,
  high: 3.2,
  tower: 2.1,
  towerShare: 0.06,
  /** Shards a knot, the least and the most. */
  fewest: 2,
  most: 7,
  /** The dip off plumb, rad: the least and the most. */
  dip: [0.15, 0.6] as const,
  /** The ribs the rock crowds into: the two scales of the lumpy field, m. */
  rib: [42, 17] as const,
  /** How far the bedding wanders across a mountain, rad, and over how
   * many metres it turns. */
  wander: 0.7,
  wanderReach: 420,
} as const;

/** A 32-bit hash of integers. */
export function hashOf(...k: number[]): number {
  let h = 0x811c9dc5;
  for (const v of k) {
    h = Math.imul(h ^ (v | 0), 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  return h >>> 0;
}

/** The hash to 0..1, its `n`th draw. */
export function unit(hash: number, n: number): number {
  return hashOf(hash, n) / 4294967296;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A smooth value 0..1 over the map at `reach` m — the bedding's wander. */
function lowNoise(seed: number, x: number, z: number, reach: number): number {
  const gx = x / reach;
  const gz = z / reach;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = gx - ix;
  const fz = gz - iz;
  const v = (i: number, j: number): number => unit(hashOf(seed, i, j), 0);
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = v(ix, iz) + (v(ix + 1, iz) - v(ix, iz)) * sx;
  const b = v(ix, iz + 1) + (v(ix + 1, iz + 1) - v(ix, iz + 1)) * sx;
  return a + (b - a) * sz;
}

/** How bare the snow is at a ground normal and a packed share — the same
 * share `snow-glsl.ts` paints the rock by (`snowRock`). */
export function bareOf(n: Vec3, packed: number, band: RockBand): number {
  const slope = Math.hypot(n.x, n.z) / Math.max(1e-3, n.y);
  return smooth(band.from, band.to, slope) * (1 - packed);
}

/** Salt for the rocks' own hashes. */
const SALT = 0x524f434b;

/** A box of the map, m: `[x0, x1) × [z0, z1)`. */
export type Area = {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
};

/** THE OUTCROPS OF `level` IN AN AREA (none where the region lays no
 * rock): a jittered lattice walked over the area, each cell dealt an
 * outcrop at a chance that grows with how bare it is. The trunks are
 * binned once, when the planner is made, so the draw can ask a tile at a
 * time as the lens comes near it. Deterministic in the map: a cell's
 * outcrop is the same whichever area asked for it. */
export function rockPlanner(level: Level, band: RockBand | null): (area: Area) => Outcrop[] {
  if (!band) return () => [];
  const seed = hashOf(level.seed, SALT);
  const { cell } = ROCKS;
  // The trunks, binned on the lattice, so a cell asks its own and its
  // neighbours' bins.
  const cols = Math.ceil(level.size / cell);
  const bins = new Map<number, { x: number; z: number }[]>();
  for (const t of level.trees) {
    const k = Math.floor(t.z / cell) * cols + Math.floor(t.x / cell);
    const bin = bins.get(k);
    if (bin) bin.push(t);
    else bins.set(k, [t]);
  }
  const nearTrunk = (x: number, z: number, reach: number): boolean => {
    const ci = Math.floor(x / cell);
    const cj = Math.floor(z / cell);
    const span = Math.ceil(reach / cell);
    for (let j = cj - span; j <= cj + span; j++) {
      for (let i = ci - span; i <= ci + span; i++) {
        for (const t of bins.get(j * cols + i) ?? []) {
          if ((t.x - x) ** 2 + (t.z - z) ** 2 < reach * reach) return true;
        }
      }
    }
    return false;
  };
  const n: Vec3 = { x: 0, y: 1, z: 0 };
  const margin = cell;
  return (area) => {
    const out: Outcrop[] = [];
    const i0 = Math.max(0, Math.ceil(area.x0 / cell));
    const j0 = Math.max(0, Math.ceil(area.z0 / cell));
    const i1 = Math.min(cols, Math.ceil(area.x1 / cell));
    const j1 = Math.min(cols, Math.ceil(area.z1 / cell));
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) {
        const o = outcropAt(i, j);
        if (o) out.push(o);
      }
    }
    return out;
  };

  function outcropAt(i: number, j: number): Outcrop | null {
    const h = hashOf(seed, i, j);
    const x = (i + 0.15 + 0.7 * unit(h, 1)) * cell;
    const z = (j + 0.15 + 0.7 * unit(h, 2)) * cell;
    if (x < margin || z < margin || x > level.size - margin || z > level.size - margin) return null;
    const packed = level.packedAt(x, z);
    if (packed > ROCKS.packed) return null;
    level.normalAt(x, z, n);
    const bare = bareOf(n, packed, band!);
    // The rock comes through in RIBS and bands, not evenly: a lumpy field
    // over the face, the outcrops crowded where it is high and few where
    // it is low.
    const rib =
      0.65 * lowNoise(seed + 1, x, z, ROCKS.rib[0]) + 0.35 * lowNoise(seed + 2, x, z, ROCKS.rib[1]);
    const crowd = 0.15 + 1.6 * smooth(0.32, 0.68, rib);
    if (bare < ROCKS.least || unit(h, 3) > bare * ROCKS.density * crowd) return null;
    // The tallest shard: bigger the barer the face, a gendarme now and then.
    const grow = Math.pow(unit(h, 4), 1.6);
    let height = ROCKS.low + (ROCKS.high - ROCKS.low) * bare * (0.35 + 0.65 * grow);
    if (bare > 0.7 && unit(h, 5) < ROCKS.towerShare) height *= ROCKS.tower;
    const spread = height * (0.55 + 0.5 * unit(h, 6));
    if (nearTrunk(x, z, ROCKS.trunk + spread)) return null;
    // The bedding: across the slope (along its contour), wandering slowly
    // over the mountain so one face's slabs agree with each other.
    const fall = Math.atan2(n.x, n.z);
    const strike =
      fall + Math.PI / 2 + (lowNoise(seed, x, z, ROCKS.wanderReach) - 0.5) * 2 * ROCKS.wander;
    const dip = ROCKS.dip[0] + (ROCKS.dip[1] - ROCKS.dip[0]) * unit(h, 7);
    // The shards lean out of the face, down it more often than up.
    const dipHeading = fall + (unit(h, 8) < 0.7 ? 0 : Math.PI) + (unit(h, 9) - 0.5) * 0.8;
    const shards = Math.round(
      ROCKS.fewest + (ROCKS.most - ROCKS.fewest) * Math.min(1, bare * (0.4 + 0.8 * unit(h, 10))),
    );
    return {
      x,
      z,
      y: level.groundAt(x, z),
      bare,
      height,
      spread,
      strike,
      dip,
      dipHeading,
      shards,
      hash: h,
    };
  }
}

/** EVERY OUTCROP OF `level`, the whole map at once (the lab's, the suite's). */
export function rockOutcrops(level: Level, band: RockBand | null): Outcrop[] {
  return rockPlanner(level, band)({ x0: 0, z0: 0, x1: level.size, z1: level.size });
}

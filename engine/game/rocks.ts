// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE ROCK STANDS OUT — the crags and the coarse blocks on the DROPS: the
// cliff faces (R22) and the natural walls too steep for anyone to ski.
// SOLID: every standing block is an `Upright` (`rockSolids`) in the map's
// solids (`posts.ts`' `solidsOf`), met by a skier, his thrown body, his
// skis and the machines as a trunk is. A pure function of the map, dealt
// off hashes of `level.seed` and never the engine's stream, kept per map;
// none of it stands where a run is skied, so no digest moves. The numbers
// are `defs/rocks.ts`'s; the drawing (`pwa/src/game/rock-shapes.ts`)
// builds each block off the same layout (`rockBlock`).
//
// NEVER ON SNOW A SKIER RIDES:
//
//   * a CLIFF's face (`Level.cliffs`, the `C…` bands off the piste), the
//     wall a skier drops off and flies past: two rows of blocks across it,
//     jutting out of it, every tip held under the lip and nothing run out
//     onto the landing below. The DROPS across a run (R24's `D…`, and the
//     resort's runs') are ridden over and get none.
//   * a WALL: the natural ground past `ROCKS.wall` (about 52°), off the
//     packed snow and clear of every trunk — the headwalls and cliff bands
//     of the face, not the steep powder a skier takes on.
//
// Only where the region lets rock break through the snow (`Region.rock`).

import type { Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import { regionOf } from "../mapgen/regions.ts";
import type { Cliff, Level } from "../mapgen/types.ts";
import { ROCKS } from "./defs/rocks.ts";
import type { Upright } from "./upright-grid.ts";

/** One OUTCROP: a knot of blocks round `x, z`. */
export type Outcrop = {
  readonly x: number;
  readonly z: number;
  /** The ground at its middle, m. */
  readonly y: number;
  /** How bare the face is here, 0..1. */
  readonly bare: number;
  /** The biggest block's height over the ground, m. */
  readonly height: number;
  /** How far the knot spreads round its middle, m. */
  readonly spread: number;
  /** The rock's bedding: the heading its slabs run along, rad (heading
   * convention: 0 = +z, clockwise from above). */
  readonly strike: number;
  /** How far the blocks lean off plumb, rad, and which way (the heading:
   * out of the face). */
  readonly dip: number;
  readonly dipHeading: number;
  /** How many standing blocks. */
  readonly blocks: number;
  /** Its own hash, everything else about its blocks drawn off it. */
  readonly hash: number;
};

/** One BLOCK of an outcrop, round `x, z`, `long` along
 * the strike and `thin` across it (half-widths of its base, m), `height`
 * over the ground, its base sunk `sink` m; `hash` the rest of it is drawn
 * off. */
export type Block = {
  readonly x: number;
  readonly z: number;
  readonly height: number;
  readonly long: number;
  readonly thin: number;
  readonly sink: number;
  readonly hash: number;
};

const BASIS = 0x811c9dc5;
function mix(h: number, v: number): number {
  h = Math.imul(h ^ (v | 0), 0x01000193);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  return h ^ (h >>> 12);
}

/** A 32-bit hash of integers. */
export function hashOf(...k: number[]): number {
  let h = BASIS;
  for (const v of k) h = mix(h, v);
  return h >>> 0;
}

/** The hash to 0..1, its `n`th draw. */
export function unit(hash: number, n: number): number {
  return (mix(mix(BASIS, hash), n) >>> 0) / 4294967296;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How much of a wall the ground is at a normal, 0..1: none under
 * `ROCKS.wall`, all of it past `ROCKS.whole`. */
export function wallOf(n: Vec3): number {
  const across = Math.sqrt(n.x * n.x + n.z * n.z);
  return smooth(ROCKS.wall, ROCKS.whole, across / Math.max(1e-3, n.y));
}

/** A cliff that gets rock: a band of the face (R22), never a drop a run
 * is skied over (R24's, a resort run's). */
export const rockyCliff = (c: Cliff): boolean => !c.onTrack && !c.run;

/** Salt for the rocks' own hashes. */
const SALT = 0x524f434b;

const plans = new WeakMap<Level, Outcrop[]>();

/**
 * EVERY OUTCROP OF `level` (none where its region lays no rock): the
 * cliffs' blocks, then the walls' outcrops off a jittered lattice walked
 * over the whole map. Kept per map.
 */
export function rocksOf(level: Level): readonly Outcrop[] {
  let list = plans.get(level);
  if (list) return list;
  list = regionOf(level).rock ? planRocks(level) : [];
  plans.set(level, list);
  return list;
}

function planRocks(level: Level): Outcrop[] {
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
  const cliffs = level.cliffs ?? [];
  const out = cliffs
    .filter(rockyCliff)
    .flatMap((c, k) => cliffBlocks(level, c, hashOf(seed, 9001, k)));
  // A cliff's face is its blocks', and a drop's is the run's: no wall
  // outcrop stands on either, or close enough behind the lip to show over it.
  const onAnyCliff = (x: number, z: number, reach: number): boolean =>
    cliffs.some((c) => {
      const dx = x - c.x;
      const dz = z - c.z;
      const down = dx * Math.sin(c.heading) + dz * Math.cos(c.heading);
      const across = dx * Math.cos(c.heading) - dz * Math.sin(c.heading);
      return (
        Math.abs(across) < c.width / 2 + 14 + reach &&
        down > -6 - reach &&
        down < c.face + 4 + reach
      );
    });
  const n: Vec3 = { x: 0, y: 1, z: 0 };
  const margin = cell;
  const base = mix(BASIS, seed);
  for (let j = 0; j < cols; j++) {
    for (let i = 0; i < cols; i++) {
      // `hashOf(seed, i, j)`, spelled out: this is walked a cell at a time
      // over the whole map.
      const h = mix(mix(base, i), j) >>> 0;
      const x = (i + 0.15 + 0.7 * unit(h, 1)) * cell;
      const z = (j + 0.15 + 0.7 * unit(h, 2)) * cell;
      if (x < margin || z < margin || x > level.size - margin || z > level.size - margin) continue;
      if (level.packedAt(x, z) > ROCKS.packed) continue;
      level.normalAt(x, z, n);
      const bare = wallOf(n);
      if (bare <= 0 || unit(h, 3) > bare * ROCKS.density) continue;
      const height = ROCKS.low + (ROCKS.high - ROCKS.low) * bare * (0.4 + 0.6 * unit(h, 4));
      const spread = height * (0.5 + 0.4 * unit(h, 6));
      if (nearTrunk(x, z, ROCKS.trunk + spread) || onAnyCliff(x, z, spread)) continue;
      // The bedding along the contour; the blocks lean out of the wall.
      const fall = Math.atan2(n.x, n.z);
      out.push({
        x,
        z,
        y: level.groundAt(x, z),
        bare,
        height,
        spread,
        strike: fall + Math.PI / 2 + (unit(h, 5) - 0.5) * 0.5,
        dip: ROCKS.dip[0] + (ROCKS.dip[1] - ROCKS.dip[0]) * unit(h, 7),
        dipHeading: fall + (unit(h, 9) - 0.5) * 0.5,
        blocks: Math.round(ROCKS.fewest + (ROCKS.most - ROCKS.fewest) * bare * unit(h, 10)),
        hash: h,
      });
    }
  }
  return out;
}

/** A CLIFF'S BLOCKS: rows across its face, the full height of the edge and
 * shrinking over the ends where the edge sinks back into the country,
 * each block's top held under the lip. */
function cliffBlocks(level: Level, c: Cliff, seed: number): Outcrop[] {
  const out: Outcrop[] = [];
  const ax = Math.sin(c.heading);
  const az = Math.cos(c.heading);
  // Across the edge: the heading turned a quarter.
  const cx = az;
  const cz = -ax;
  const ends = c.width / 2 + 6;
  const count = Math.max(1, Math.floor((2 * ends) / ROCKS.pitch));
  ROCKS.rows.forEach((share, r) => {
    for (let k = 0; k <= count; k++) {
      const h = hashOf(seed, r, k);
      const across = -ends + (k + (unit(h, 0) - 0.5) * 0.7) * ((2 * ends) / count);
      // Full height inside the edge, sinking over its ends.
      const full = 1 - smooth(c.width / 2 - 4, ends, Math.abs(across));
      if (full <= 0.05) continue;
      const down = c.face * Math.min(0.85, share + (unit(h, 1) - 0.5) * 0.18);
      const x = c.x + ax * down + cx * across;
      const z = c.z + az * down + cz * across;
      const y = level.groundAt(x, z);
      const room = Math.max(0, c.y - y) - ROCKS.lip;
      const height = Math.min(
        room,
        c.drop * (ROCKS.tall[0] + (ROCKS.tall[1] - ROCKS.tall[0]) * unit(h, 2)) * full,
      );
      if (height < 0.4) continue;
      out.push({
        x,
        z,
        y,
        bare: 1,
        height,
        spread: Math.min(ROCKS.pitch * 0.6, height * 0.5),
        strike: c.heading + Math.PI / 2 + (unit(h, 3) - 0.5) * 0.4,
        dip: ROCKS.cliffDip[0] + (ROCKS.cliffDip[1] - ROCKS.cliffDip[0]) * unit(h, 4),
        dipHeading: c.heading + (unit(h, 5) - 0.5) * 0.4,
        blocks: Math.round(ROCKS.cliffFewest + (ROCKS.cliffMost - ROCKS.cliffFewest) * unit(h, 6)),
        hash: h,
      });
    }
  });
  return out;
}

/** BLOCK `k` OF OUTCROP `o`: the first the knot's biggest, at its middle;
 * the rest strung out along the strike, a little to either side of it.
 * Coarse rock, not spikes: a block is about as wide as it is tall, longer
 * along the bedding than across it, a third of them long SLABS. */
export function rockBlock(o: Outcrop, k: number): Block {
  const h = hashOf(o.hash, 100 + k);
  const sx = Math.sin(o.strike);
  const sz = Math.cos(o.strike);
  const reach = o.spread;
  const along = k === 0 ? 0 : (unit(h, 0) - 0.5) * 2 * reach;
  const across = k === 0 ? 0 : (unit(h, 1) - 0.5) * 0.45 * reach;
  const height = k === 0 ? o.height : o.height * (0.35 + 0.55 * unit(h, 2));
  const slab = unit(h, 32) < ROCKS.slabs ? ROCKS.slab : 1;
  const long = height * (0.6 + 0.3 * unit(h, 3)) * slab;
  return {
    x: o.x + sx * along + sz * across,
    z: o.z + sz * along - sx * across,
    height,
    long,
    thin: long * (0.6 + 0.3 * unit(h, 4)),
    sink: ROCKS.sink + height * ROCKS.sinkShare,
    hash: h,
  };
}

const solids = new WeakMap<Level, Upright[]>();

/** EVERY STANDING BLOCK as a skier meets it: a column from the snow at its
 * foot to its top (never over its outcrop's own cap — a cliff's blocks
 * stay under the lip), as wide as `ROCKS.meet` of its base and never
 * wider than `ROCKS.widest`. Kept per map. */
export function rockSolids(level: Level): readonly Upright[] {
  let list = solids.get(level);
  if (list) return list;
  list = [];
  for (const o of rocksOf(level)) {
    for (let k = 0; k < o.blocks; k++) {
      const s = rockBlock(o, k);
      const y = level.groundAt(s.x, s.z);
      const height = Math.min(s.height, o.y + o.height - y);
      if (height < ROCKS.least) continue;
      list.push({
        x: s.x,
        z: s.z,
        y,
        height,
        radius: Math.min(ROCKS.widest, ((s.long + s.thin) / 2) * ROCKS.meet),
        stuff: "rock",
      });
    }
  }
  solids.set(level, list);
  return list;
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R14 — THE FOREST: snow-loaded trees where a slow noise says woods, open
// glades between, clearings cut out of the woods, nothing above the tree
// line, and nothing where a tree would be in the run's way.
//
// Candidates stand one per `forest.spacing` cell, jittered inside it, so no
// two trunks share a cell and the wood reads as grown rather than planted
// on a lattice. Each is kept with the probability the forest noise gives
// its spot — the woods' density inside the forest, a sprinkle of lone trees
// out in the glades — and then refused by rule: too near the piste, too
// steep, above the tree line, on a kicker or a cliff, on a lane, or too
// near a tree already standing. That last refusal is what makes a wood
// SKIABLE: no two trunks stand closer than `forest.gap`, and no crown
// spreads wider than `forest.crownMax`, so between any two trees there is a
// lane a skier fits through under the boughs.
//
// THE TREE LINE IS AN ALTITUDE. Nothing grows above the region's tree line
// (R21's band, metres above the sea, over the valley floor's own dealt
// altitude — `lineY` here, as a height); in the band just under it the
// woods are KRUMMHOLZ, stunted to a share of their height and thinning
// toward the line, and the tall woods stand low down, in the thick of a
// wood and in the hollows.
//
// A REAL WOOD GROUPS, and it is not a wall. So before the scan the woods
// grow CLUMPS — a few trunks close round a centre, one kind to a clump: a
// spruce thicket, a birch stand off one root, a tree island out in a glade
// — and every trunk outside a clump keeps the whole `forest.gap` from it, so
// a clump is a thing a skier goes ROUND. Winding LANES are cut through
// every wood (no trunk on them — the old cuts a skier can follow and see
// down), and between them the woods keep `forest.open` of their density, so
// the eye goes in among the trunks. Clumps and lanes are placed off hashes
// of the forest's own seed, never the stream: the four draws a cell makes
// are the same whatever is refused, so the day drawn after the forest never
// moves.
//
// THE REGION (R21) moves the numbers and draws nothing: its row thins or
// thickens the woods, stunts them, moves the tree line, and names what
// grows (off a hash of where the trunk stands, `treeKindAt`). The alpine's
// row is all ones, so its wood is the one the rules grow.

import { cellKey, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  sampleField,
  fieldGradient,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { hash2, valueNoise } from "@niclaslindstedt/oss-game-framework/core/noise";
import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import { onCliff } from "./cliffs.ts";
import { onKicker } from "./kickers.ts";
import { treeKindAt } from "./regions.ts";
import { nearestWithin, type HasTrack } from "./query.ts";
import type { TerrainPlan } from "./terrain.ts";
import type { Cliff, Kicker, TrackHit, TreeDef } from "./types.ts";

/** What a RESORT asks of the woods (R25–R27): the ground kept clear for
 * every run, lift and the village in place of the one piste's corridor,
 * and the woods thick low down and thinning up through the ecotone to the
 * tree line (`resort-woods.ts`). */
export type ForestOptions = {
  /** Whether no trunk may stand here (a run's corridor, a lift's line, the
   * village). */
  readonly clear: (x: number, z: number) => boolean;
  /** How much of a spot's woods stand at height `y`, m, 0..1 — and how
   * much nearer the thick of a wood the spot reads (the closed forest low
   * down has few glades). */
  readonly cover: (y: number) => { readonly keep: number; readonly close: number };
  /** The tallest a tree at `y` grows, as a share of the height band. */
  readonly tall: (y: number) => number;
};

/** R14 — HOW OLD A TREE IS, years: the age `forest.age`'s growth curve
 * gives the height it `grew` to, spread round that by a log-normal off a
 * hash of where it stands (three hashes summed, near enough a normal) and
 * now and then a VETERAN's many times that. A hash, not the generator's
 * stream: an age drawn from the stream would move every tree after it. */
export function treeAge(grew: number, x: number, z: number, seed: number): number {
  const A = R.forest.age;
  const h = Math.min(grew, A.top * 0.97);
  const typical = -Math.log(1 - h / A.top) / A.rate;
  const ix = Math.floor(x * 8);
  const iz = Math.floor(z * 8);
  const normal =
    (hash2(ix, iz, seed + 41) + hash2(ix, iz, seed + 42) + hash2(ix, iz, seed + 43) - 1.5) * 2;
  let age = typical * Math.exp(A.spread * normal);
  if (hash2(ix, iz, seed + 44) < A.veterans) age *= A.veteran;
  return Math.min(A.max, age);
}

/** R14 — the trunk's radius at breast height for a tree of `age` years,
 * m (`forest.trunk`). */
export function trunkRadius(age: number): number {
  const T = R.forest.trunk;
  return T.floor + T.top * Math.pow(1 - Math.exp(-T.rate * Math.max(0, age)), T.shape);
}

/** R14 — grow the forest. `lineY` is the tree line as a HEIGHT on this
 * map, m — the region's altitude over the valley floor's, stood on the
 * base at the finish. */
export function growForest(
  rng: Rng,
  plan: TerrainPlan,
  ground: Heightfield,
  piste: HasTrack,
  kickers: readonly Kicker[],
  cliffs: readonly Cliff[],
  lineY: number,
  resort?: ForestOptions,
): TreeDef[] {
  const F = R.forest;
  const W = plan.region.forest;
  const density = F.density * W.density * F.open;
  const meadow = Math.min(1, F.meadow * W.meadow);
  // The krummholz band under the tree line, and the valley floor, as
  // heights.
  const stuntY = lineY - F.krummholz;
  const baseY = lineY - (plan.treeLine - plan.altitude);
  const seed = rng.int(1, 1 << 30);
  const clearings: { x: number; z: number; r: number }[] = [];
  const nClear = rng.int(F.clearings.count.min, F.clearings.count.max);
  for (let i = 0; i < nClear; i++) {
    clearings.push({
      x: rng.range(200, plan.size - 200),
      z: rng.range(200, plan.size - 200),
      r: inBand(rng, F.clearings.radius),
    });
  }
  /** How wooded a spot is (0 glade … 1 the thick of a wood), and how far
   * out of a clearing (0 in one … 1 clear of them all). */
  const woodsAt = (x: number, z: number): { woods: number; clear: number } => {
    const n =
      valueNoise(x, z, F.scale, seed) * 0.7 + valueNoise(x, z, F.scale * 0.35, seed + 101) * 0.3;
    let clear = 1;
    for (const cl of clearings) {
      const d = hypot(x - cl.x, z - cl.z);
      if (d < cl.r + 12) clear = Math.min(clear, smoothstep(cl.r * 0.8, cl.r + 12, d));
    }
    return { woods: smoothstep(0.42, 0.58, n), clear };
  };
  // THE LANES: each family a set of parallel lines at a heading of its own,
  // bent by a slow noise. The distance to the nearest line is the across-
  // lane coordinate's distance to a multiple of the spacing, divided by
  // that coordinate's gradient — the bend makes a lane wider where it
  // swings and narrower where it straightens, and this reads the true one.
  const L = F.lanes;
  const lanes = Array.from({ length: L.families }, (_, j) => ({
    cos: Math.cos(hash2(j, 1, seed) * Math.PI),
    sin: Math.sin(hash2(j, 1, seed) * Math.PI),
    offset: hash2(j, 2, seed) * L.spacing,
    noise: seed + 300 + j,
  }));
  const bend = (x: number, z: number, noise: number): number =>
    (valueNoise(x, z, L.scale, noise) - 0.5) * 2 * L.swing;
  const onLane = (x: number, z: number): boolean => {
    for (const lane of lanes) {
      const w = bend(x, z, lane.noise);
      const u = x * lane.cos + z * lane.sin + w - lane.offset;
      const d = Math.abs(u - L.spacing * Math.round(u / L.spacing));
      if (d > L.width) continue;
      const gx = lane.cos + (bend(x + 1, z, lane.noise) - w);
      const gz = lane.sin + (bend(x, z + 1, lane.noise) - w);
      if (d / Math.max(0.2, hypot(gx, gz)) < L.width / 2) return true;
    }
    return false;
  };
  const trees: TreeDef[] = [];
  const hit: TrackHit = { index: 0, s: 0, distance: 0, lateral: 0, x: 0, z: 0 };
  const reach = R.track.width.max / 2 + F.corridor;
  /** Whether no tree may stand here at all; `y` is the ground's height. */
  const refused = (x: number, z: number, y: number): boolean => {
    if (y > lineY) return true;
    const g = fieldGradient(ground, x, z);
    if (hypot(g.gx, g.gz) > F.maxSlope) return true;
    if (resort) {
      if (resort.clear(x, z)) return true;
    } else {
      nearestWithin(piste, x, z, reach, hit);
      if (hit.distance < piste.track.points[hit.index].width / 2 + F.corridor) return true;
    }
    if (onKicker(kickers, x, z, 4)) return true;
    if (onCliff(cliffs, x, z, 4)) return true;
    // On a resort the runs are the cuts through the woods.
    return resort ? false : onLane(x, z);
  };
  // THE GAP: every tree kept is filed in a hash of `gap`-sized buckets, so a
  // candidate asks only the nine round it whether one stands too near — the
  // whole gap from any tree, a clump's own gap from its own clump's.
  const gap2 = F.gap * F.gap;
  const clumpGap2 = F.clumps.gap * F.clumps.gap;
  const buckets = new Map<number, TreeDef[]>();
  const bucketOf = (v: number): number => Math.floor(v / F.gap);
  const crowded = (x: number, z: number, clump: number): boolean => {
    const bx = bucketOf(x);
    const bz = bucketOf(z);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const near = buckets.get(cellKey(bx + dx, bz + dz));
        if (!near) continue;
        for (const t of near) {
          const need = clump >= 0 && t.clump === clump ? clumpGap2 : gap2;
          if ((t.x - x) ** 2 + (t.z - z) ** 2 < need) return true;
        }
      }
    }
    return false;
  };
  const stand = (
    x: number,
    z: number,
    y: number,
    height: number,
    clump: number,
    kx: number,
    kz: number,
  ): void => {
    // Aged off the height it would have grown to unstunted: a krummholz
    // tree is as old as the tall one, only beaten down.
    const stunt = 1 - (1 - F.krummholzHeight) * smoothstep(stuntY, lineY, y);
    const age = treeAge(height / Math.max(1e-6, stunt), x, z, seed);
    const tree: TreeDef = {
      x,
      z,
      y,
      height,
      radius: trunkRadius(age),
      crown: Math.min(F.crownMax, F.crown * height),
      age,
    };
    const kind = treeKindAt(plan.region, kx, kz);
    if (kind !== "spruce") tree.kind = kind;
    if (clump >= 0) tree.clump = clump;
    trees.push(tree);
    const key = cellKey(bucketOf(x), bucketOf(z));
    const list = buckets.get(key);
    if (list) list.push(tree);
    else buckets.set(key, [tree]);
  };
  /** Tall in the thick of a wood and low down, short at its edge and up
   * the mountain, stunted in the krummholz band. */
  const heightOf = (woods: number, size: number, y: number): number => {
    const up = Math.max(0, Math.min(1, (y - baseY) / (lineY - baseY)));
    const tall = resort
      ? resort.tall(y) * (0.7 + 0.2 * woods + 0.1 * size)
      : 0.35 + 0.45 * woods + 0.2 * size - 0.45 * up;
    const stunt = 1 - (1 - F.krummholzHeight) * smoothstep(stuntY, lineY, y);
    const h =
      F.height.min + (F.height.max - F.height.min) * Math.max(0, Math.min(1, tall)) * W.height;
    return Math.max(F.height.min, h * stunt);
  };

  // ── THE CLUMPS, before the scan: every trunk the scan stands after keeps
  // the whole gap from them. One chance a cell, off the forest's seed. ──────
  const C = F.clumps;
  const clumpCells = Math.floor(plan.size / C.spacing);
  let id = 0;
  for (let r = 0; r < clumpCells; r++) {
    for (let c = 0; c < clumpCells; c++) {
      const cx = (c + 0.2 + 0.6 * hash2(c, r, seed + 11)) * C.spacing;
      const cz = (r + 0.2 + 0.6 * hash2(c, r, seed + 12)) * C.spacing;
      const { woods: w0, clear } = woodsAt(cx, cz);
      let woods = w0;
      let odds = 1;
      if (resort) {
        const cover = resort.cover(sampleField(ground, cx, cz));
        woods = w0 + (1 - w0) * cover.close;
        odds = cover.keep;
      }
      odds *= (C.meadow + (C.woods - C.meadow) * woods) * clear * W.density;
      if (hash2(c, r, seed + 13) >= odds) continue;
      const want =
        C.trees.min + Math.floor(hash2(c, r, seed + 14) * (C.trees.max - C.trees.min + 1));
      const size = hash2(c, r, seed + 15);
      let grown = 0;
      // Tries round the centre, nearest first, until the clump is whole.
      for (let k = 0; k < want * 4 && grown < want; k++) {
        const a = hash2(k, id, seed + 16) * Math.PI * 2;
        const d = C.radius * Math.sqrt((k + hash2(k, id, seed + 17)) / (want * 4));
        const x = cx + Math.cos(a) * d;
        const z = cz + Math.sin(a) * d;
        const y = sampleField(ground, x, z);
        if (crowded(x, z, id) || refused(x, z, y)) continue;
        const own = size * 0.8 + hash2(k, id, seed + 18) * 0.2;
        stand(x, z, y, heightOf(woods, own, y), id, cx, cz);
        grown++;
      }
      if (grown > 0) id++;
    }
  }

  // ── THE SCAN: a candidate a cell ──────────────────────────────────────────
  const cells = Math.floor(plan.size / F.spacing);
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      // Four draws per cell whatever happens, so one refusal never shifts
      // the stream under every tree after it.
      const jx = rng.next();
      const jz = rng.next();
      const keep = rng.next();
      const size = rng.next();
      const x = (c + 0.1 + jx * 0.8) * F.spacing;
      const z = (r + 0.1 + jz * 0.8) * F.spacing;
      const { woods: w0, clear } = woodsAt(x, z);
      const y = sampleField(ground, x, z);
      let woods = w0;
      let share: number;
      if (resort) {
        // R14 on a resort: the woods by height — closed low down, thinning
        // through the ecotone to the tree line.
        const cover = resort.cover(y);
        woods = w0 + (1 - w0) * cover.close;
        share = density * (meadow + (1 - meadow) * woods * clear) * cover.keep;
      } else {
        share = density * (meadow + (1 - meadow) * woods * clear);
        // The krummholz thins toward the line as well as stunting.
        share *= 1 - 0.6 * smoothstep(stuntY, lineY, y);
      }
      if (keep >= share) continue;
      // Both refusals are pure, so the cheap one asks first: in a wood
      // most candidates stand inside a kept trunk's gap.
      if (crowded(x, z, -1)) continue;
      if (refused(x, z, y)) continue;
      stand(x, z, y, heightOf(woods, size, y), -1, x, z);
    }
  }
  return trees;
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL HOUSES OF A REAL FACE — where a map raised on a real face
// (R25, `Level.face`) stands its buildings where the real valley's
// houses stand (`real-hints.ts`: each real house's middle, its size and
// its longest wall's bearing, off the map's own crop).
//
// Two ways, both after every other building of the map is placed, so not
// one of those moves for them:
//   * THE VILLAGE leans onto them (`village-streets.ts`, `village-place.ts`):
//     its streets laid first where the most real houses stand within the
//     reach the plan already searches, its town's lots kept to where a real
//     house stands once the plan holds enough of them, and a lot beside one
//     turned to its bearing.
//   * EVERY OTHER REAL HOUSE that fits (`placeRealHouses`) is stood as the
//     existing kind nearest its size — a hut, a cabin or a chalet of logs,
//     a town house or an apartment chalet — at its middle (or a few metres
//     off it), turned to its bearing, by the ski area's own placer and
//     clearances (`cabins.ts`'s `stand`): off every run, lift, queue,
//     street, ramp, the hub and the pads, on ground it can be terraced
//     into, its yard cleared of the trunks round it.
//
// A pure function of the map and its face's baked hints — no stream, no
// hash — so a map with no face, or a face with no hints, places exactly
// what it placed before.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { realHints, type HintHouse } from "../mapgen/real-hints.ts";
import type { Level } from "../mapgen/types.ts";
import type { Cabin } from "./cabins.ts";
import { downhillOf, toward } from "./cabin-site.ts";
import { CABINS, type CabinKind } from "./defs/cabins.ts";
import type { Fit, StandAt } from "./resort-buildings.ts";

/** How the real houses are stood, m and counts.
 *   * `most`: the most stood off the village's streets on one map. A face
 *     carries up to 600; 120 is three villages' worth on top of the
 *     village's own 40 lots and the 32 dealt cabins — enough for every
 *     hamlet and farm a face's valley shows (the largest first), while the
 *     placer's work (every site tried against every run, lift and roof),
 *     the walls a skier is checked against and the drawn blocks stay
 *     within a few times what a dealt map carries.
 *   * `biggest`: a real building wider than this is not a house (a lift's
 *     hall, a barn, a hotel's wing) and is left to the generator.
 *   * `sizes`: the kind stood for a real house of each size (the side of a
 *     square of its footprint's area), the first whose bound it is under —
 *     the bounds half way between the kinds' own sides.
 *   * `clearing`: the trunks within this of a real house's roof are felled
 *     for its yard (`fellsTree`), as a house in the woods stands in its
 *     own clearing.
 *   * `nudge`: the spots tried round a real house's middle when its own
 *     does not fit, m.
 *   * `near`: how near a real house a village lot's middle must be to be
 *     beside one; `snap` how near to take its bearing, and `turn` the most
 *     the bearing may turn a lot's building off its street, rad.
 *   * `village`: how many real houses the village's ground must hold before
 *     its town keeps to them. */
export const REAL_HOUSES = {
  most: 120,
  biggest: 45,
  sizes: [
    [5.8, "hut"],
    [7.3, "cabin"],
    [9.4, "chalet"],
    [14, "house"],
    [45, "apartments"],
  ] as const satisfies readonly (readonly [number, CabinKind])[],
  clearing: 5,
  nudge: [
    [0, 0],
    [4, 0],
    [-4, 0],
    [0, 4],
    [0, -4],
    [6, 6],
    [-6, -6],
    [6, -6],
    [-6, 6],
  ] as const,
  near: 30,
  snap: 16,
  turn: 1.05,
  village: 12,
} as const;

/** The `run` a real house's building stands beside. */
export const REAL_RUN = "real";

/** The real houses of `level`'s face, or none (a dealt massif, a face with
 * no hints). */
export function realHousesOf(level: Level): readonly HintHouse[] {
  if (!level.face) return [];
  return realHints(level.face)?.houses ?? [];
}

const CELL = 50;
const grids = new Map<string, Map<number, HintHouse[]>>();

/** The real house nearest (x, z) of `level`'s face within `r` m, or null. */
export function realHouseNear(level: Level, x: number, z: number, r: number): HintHouse | null {
  const houses = realHousesOf(level);
  if (houses.length === 0 || !level.face) return null;
  let grid = grids.get(level.face);
  if (!grid) {
    grid = new Map();
    for (const h of houses) {
      const key = Math.floor(h.x / CELL) * 4096 + Math.floor(h.z / CELL);
      const cell = grid.get(key) ?? [];
      cell.push(h);
      grid.set(key, cell);
    }
    grids.set(level.face, grid);
  }
  let best: HintHouse | null = null;
  let bestD = r;
  const n = Math.ceil(r / CELL);
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  for (let i = cx - n; i <= cx + n; i++) {
    for (let j = cz - n; j <= cz + n; j++) {
      for (const h of grid.get(i * 4096 + j) ?? []) {
        const d = hypot(h.x - x, h.z - z);
        if (d < bestD) {
          best = h;
          bestD = d;
        }
      }
    }
  }
  return best;
}

/** The headings that stand `kind` along a real house's longest wall —
 * its front that wall where the kind is wider than deep, its side where
 * deeper — the one nearest `want` first. */
export function bearingsOf(kind: CabinKind, house: HintHouse, want: number): [number, number] {
  const d = CABINS[kind];
  const a = d.width >= d.depth ? house.turn + Math.PI / 2 : house.turn;
  const b = a + Math.PI;
  return turnOff(a, want) <= turnOff(b, want) ? [a, b] : [b, a];
}

/** How far heading `a` is turned off `b`, rad (0..π). */
export function turnOff(a: number, b: number): number {
  let d = a - b;
  d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
  return Math.abs(d);
}

/** The kind stood for a real house of `size`, or null for one too big. */
export function kindOfSize(size: number): CabinKind | null {
  for (const [most, kind] of REAL_HOUSES.sizes) if (size < most) return kind;
  return null;
}

/** Whether a point lies inside a real house's yard — its roof's rectangle
 * grown by `REAL_HOUSES.clearing` — where its trees are felled. */
export function inRealYard(c: Cabin, x: number, z: number): boolean {
  const d = CABINS[c.kind];
  const r = d.reach;
  const m = REAL_HOUSES.clearing;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const dx = x - c.x;
  const dz = z - c.z;
  const lx = dx * fz - dz * fx;
  const lz = dx * fx + dz * fz;
  return (
    Math.abs(lx) < d.width / 2 + r.side + m &&
    lz > -d.depth / 2 - r.back - m &&
    lz < d.depth / 2 + r.front + m
  );
}

/** STAND THE REAL HOUSES of `level`'s face that fit with `stand` (the ski
 * area's placer), the largest first, `fit` the village's clearances. */
export function placeRealHouses(level: Level, stand: StandAt, fit: Fit): Cabin[] {
  const out: Cabin[] = [];
  const houses = realHousesOf(level)
    .filter((h) => h.size < REAL_HOUSES.biggest)
    .slice()
    .sort((a, b) => b.size - a.size || a.z - b.z || a.x - b.x);
  const yard: Fit = { ...fit, clearing: REAL_HOUSES.clearing };
  for (const h of houses) {
    if (out.length >= REAL_HOUSES.most) break;
    const kind = kindOfSize(h.size);
    if (!kind) continue;
    const headings = bearingsOf(kind, h, downhillOf(level, h.x, h.z));
    let c: Cabin | null = null;
    for (const [dx, dz] of REAL_HOUSES.nudge) {
      for (const heading of headings) {
        c = stand(kind, h.x + dx, h.z + dz, heading, REAL_RUN, 0, 1000 + out.length, yard);
        if (c) break;
      }
      if (c) break;
    }
    if (!c) continue;
    c.id = `R${out.length + 1}`;
    out.push(c);
  }
  return out;
}

/** Whether a turned heading is within `REAL_HOUSES.turn` of `want`. */
export function nearHeading(heading: number, want: number): boolean {
  return turnOff(heading, want) <= REAL_HOUSES.turn;
}

/** `heading` as a building beside a real house within `REAL_HOUSES.snap`
 * of (x, z) would stand along its bearing, where that turns it no more
 * than `REAL_HOUSES.turn` off; else `heading` itself. */
export function snappedHeading(
  level: Level,
  kind: CabinKind,
  x: number,
  z: number,
  heading: number,
): number {
  const h = realHouseNear(level, x, z, REAL_HOUSES.snap);
  if (!h) return heading;
  const [best] = bearingsOf(kind, h, heading);
  return nearHeading(best, heading) ? toward(heading, best, Math.PI) : heading;
}

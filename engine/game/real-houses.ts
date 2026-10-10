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
//     a town house or an apartment chalet — at its middle (or the nearest
//     spot a few metres off it that fits), turned to its bearing, by the
//     ski area's own placer and clearances (`cabins.ts`'s `stand`): off
//     every run, lift, queue, street, ramp, the hub and the pads, on ground
//     it can be terraced into (a walk-out storey under it on a slope), its
//     yard cleared of the trunks round it. The ones UP THE MOUNTAIN are
//     tried first (the hotels, huts and chalets beside the pistes), then
//     the town's, then the rest of the valley's (`realHouseTier`), so a
//     big town never squeezes the mountain's out.
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
import { REAL_STREETS } from "./real-streets.ts";
import type { Fit, StandAt } from "./resort-buildings.ts";

/** How the real houses are stood, m and counts.
 *   * `tiers`: the most stood off the village's streets on one map, by
 *     where they stand (`realHouseTier`), tried in this order, each tier's
 *     the largest first: UP THE MOUNTAIN (`mountain`: `up` m or more over
 *     the valley floor and outside the real town's radius — the hotels,
 *     huts, restaurants, lift-top houses and chalets beside the pistes,
 *     few on any face and what makes it read as its own, so never
 *     squeezed out by a town), THE TOWN (`town`: inside the real town's
 *     circle grown as its streets are read, `REAL_STREETS.town.grow`) and
 *     THE REST OF THE VALLEY (`valley`: the hamlets and farms off the
 *     town). A face carries every building its map draws (up to a few
 *     thousand); these are a few villages' worth on top of the village's
 *     own 40 lots and the 32 dealt cabins — the placer's work, the walls a
 *     skier is checked against and the drawn blocks within a few times
 *     what a dealt map carries.
 *   * `biggest`: a real building wider than this is not a house (a lift's
 *     hall, a barn, a hotel's wing) and is left to the generator.
 *   * `sizes`: the kind stood for a real house of each size (the side of a
 *     square of its footprint's area), the first whose bound it is under —
 *     the bounds half way between the kinds' own sides.
 *   * `clearing`: the trunks within this of a real house's roof are felled
 *     for its yard (`fellsTree`), as a house in the woods stands in its
 *     own clearing.
 *   * `up`: how far over the valley floor a house stands up the mountain, m.
 *   * `steep`: the multiple on a kind's terrace, plinth and cut a real
 *     house is stood with (`Fit.steep`): a house on its real slope has a
 *     walk-out storey of stone under its floor.
 *   * `nudge`: the spots tried round a real house's middle when its own
 *     does not fit, m — nearest first, so a house in the way of a run, a
 *     lift or a pad is moved the least it takes rather than dropped.
 *   * `near`: how near a real house a village lot's middle must be to be
 *     beside one; `snap` how near to take its bearing, and `turn` the most
 *     the bearing may turn a lot's building off its street, rad.
 *   * `village`: how many real houses the village's ground must hold before
 *     its town keeps to them. */
export const REAL_HOUSES = {
  tiers: { mountain: 200, town: 140, valley: 80 },
  up: 60,
  biggest: 45,
  sizes: [
    [5.8, "hut"],
    [7.3, "cabin"],
    [9.4, "chalet"],
    [14, "house"],
    [45, "apartments"],
  ] as const satisfies readonly (readonly [number, CabinKind])[],
  clearing: 5,
  steep: 2.5,
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
    [10, 0],
    [-10, 0],
    [0, 10],
    [0, -10],
    [14, 0],
    [-14, 0],
    [0, 14],
    [0, -14],
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

/** Where a real house stands, as `REAL_HOUSES.tiers` ranks it: up the
 * mountain, in the real town, or elsewhere down the valley. */
export type RealTier = keyof typeof REAL_HOUSES.tiers;

/** Which tier a real house of `level`'s face stands in: in the TOWN
 * inside its circle grown as its streets are read; UP THE MOUNTAIN where
 * it stands `REAL_HOUSES.up` m or more over the valley floor and outside
 * the town's own radius; the VALLEY's otherwise. */
export function realHouseTier(level: Level, h: HintHouse): RealTier {
  const town = level.face ? realHints(level.face)?.town : null;
  const d = town ? hypot(h.x - town.x, h.z - town.z) : Infinity;
  const floor = level.mountain?.base.y ?? 0;
  if (level.groundAt(h.x, h.z) - floor >= REAL_HOUSES.up && (!town || d > town.r)) {
    return "mountain";
  }
  return town && d < town.r * REAL_STREETS.town.grow ? "town" : "valley";
}

/** The real houses of `level`'s face in the order they are tried, each
 * with its tier: up the mountain, then the town, then the valley, each
 * the largest first — none too big to be a house. */
export function realHouseOrder(level: Level): { house: HintHouse; tier: RealTier }[] {
  const rank: Record<RealTier, number> = { mountain: 0, town: 1, valley: 2 };
  return realHousesOf(level)
    .filter((h) => h.size < REAL_HOUSES.biggest && kindOfSize(h.size))
    .map((house) => ({ house, tier: realHouseTier(level, house) }))
    .sort(
      (a, b) =>
        rank[a.tier] - rank[b.tier] ||
        b.house.size - a.house.size ||
        a.house.z - b.house.z ||
        a.house.x - b.house.x,
    );
}

/** STAND THE REAL HOUSES of `level`'s face that fit with `stand` (the ski
 * area's placer) in `realHouseOrder` — up the mountain, then the town,
 * then the valley, each up to its tier's most — each at its middle or the
 * nearest nudge off it that fits, `fit` the village's clearances. */
export function placeRealHouses(level: Level, stand: StandAt, fit: Fit): Cabin[] {
  const out: Cabin[] = [];
  const yard: Fit = { ...fit, clearing: REAL_HOUSES.clearing, steep: REAL_HOUSES.steep };
  const stood: Record<RealTier, number> = { mountain: 0, town: 0, valley: 0 };
  for (const { house: h, tier } of realHouseOrder(level)) {
    if (stood[tier] >= REAL_HOUSES.tiers[tier]) continue;
    const kind = kindOfSize(h.size)!;
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
    stood[tier]++;
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

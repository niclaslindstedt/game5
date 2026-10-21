// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// READING THE SNOW AHEAD — how every machine the army drives over the
// mountain picks its way: the snowmobiles (`army-sled.ts`) and the ground
// waves' carriers, trucks and tanks (`army-vehicle.ts`), each with its own
// numbers. A heading is walked out `look` m, every `step` m: stopped short
// where a rise is steeper than the machine climbs, a drop steeper than it
// goes down, open water, a wind tunnel or the map's edge is near; it costs for every
// metre it is stopped short, for every trunk near its line, for every
// radian off the way wanted and off the way held. A fan of headings either
// side of the way wanted is weighed and the cheapest steered. The hub's
// WIND TUNNELS (R30) are a wall to all of them: a tube on the snow no
// tracks or wheels go through, read as the water is (`tunnelWithin`).
//
// Pure over the map; nothing here draws from any stream.

import { angleDiff } from "@niclaslindstedt/oss-game-framework/core/math";
import { waterWithin } from "../mapgen/real-water.ts";
import { treesNear } from "./upright-grid.ts";
import type { Level } from "../mapgen/types.ts";
import type { GameState } from "./state.ts";

/** Each map's wind tunnels as boxes in plan (their line's extent and half
 * width), so a point far from all of them is answered at once. */
type TubeBox = {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  half: number;
  pts: { x: number; z: number }[];
};
const tubes = new WeakMap<Level, TubeBox[]>();

function tubesOf(level: Level): TubeBox[] {
  let list = tubes.get(level);
  if (list) return list;
  list = [];
  for (const t of level.resort?.tunnels ?? []) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const p of t.points) {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      z0 = Math.min(z0, p.z);
      z1 = Math.max(z1, p.z);
    }
    list.push({ x0, x1, z0, z1, half: t.width / 2, pts: t.points });
  }
  tubes.set(level, list);
  return list;
}

/** WHETHER (x, z) IS WITHIN `r` m OF A WIND TUNNEL'S TUBE (R30): its line
 * from entrance to exit, `width / 2` either side. What the army's machines
 * treat as a wall — they go round the hub's tunnels, never through. */
export function tunnelWithin(level: Level, x: number, z: number, r: number): boolean {
  for (const b of tubesOf(level)) {
    const reach = b.half + r;
    if (x < b.x0 - reach || x > b.x1 + reach || z < b.z0 - reach || z > b.z1 + reach) continue;
    const pts = b.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const c = pts[i + 1];
      const dx = c.x - a.x;
      const dz = c.z - a.z;
      const l2 = dx * dx + dz * dz || 1;
      const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
      const ex = x - a.x - dx * u;
      const ez = z - a.z - dz * u;
      if (ex * ex + ez * ez < reach * reach) return true;
    }
  }
  return false;
}

/** How far ahead it reads and how finely, m; the fan of headings it
 * weighs either side of the way wanted (`fan` a side across `spread`
 * rad). */
export type DriveRead = { look: number; step: number; fan: number; spread: number };

/** The ground it takes and what a heading costs (see the header): the
 * steepest rise and drop, as slopes; water and the edge, m; and the
 * costs a radian off, a metre short, a trunk near, a radian off held. */
export type TerrainRead = {
  climb: number;
  cliff: number;
  water: number;
  edge: number;
  /** A wind tunnel's tube within this many metres is no way at all. */
  tunnel: number;
  turn: number;
  blocked: number;
  tree: number;
  keep: number;
};

const trunks: number[] = [];

/** What stands near a point, by index into its list, into `out`: the
 * trunks alone (`treesNear`, a snowmobile threads the posts), or every
 * solid (`solidsNear`, a lorry does not). */
export type NearFn = (
  level: GameState["level"],
  x: number,
  z: number,
  r: number,
  out: number[],
) => number[];

/** WHAT A HEADING COSTS from (x, z): the way it is stopped short of
 * `look`, the trunks within `r` m of its line, how far it is off the way
 * wanted and the way held — and how many trunks stand in the first three
 * reads (the woods it would be driving into). */
export function wayCost(
  state: GameState,
  x0: number,
  z0: number,
  heading: number,
  want: number,
  keep: number,
  T: TerrainRead,
  D: DriveRead,
  r: number,
  standing: NearFn = treesNear,
): { cost: number; trees: number } {
  const level = state.level;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const n = Math.round(D.look / D.step);
  let g0 = level.groundAt(x0, z0);
  let reach = D.look;
  let trees = 0;
  let near = 0;
  const lo = T.edge;
  const hi = level.size - T.edge;
  for (let i = 1; i <= n; i++) {
    const x = x0 + fx * D.step * i;
    const z = z0 + fz * D.step * i;
    const g = level.groundAt(x, z);
    const rise = (g - g0) / D.step;
    g0 = g;
    if (
      x < lo ||
      z < lo ||
      x > hi ||
      z > hi ||
      rise > T.climb ||
      rise < -T.cliff ||
      waterWithin(level.water, x, z, T.water) ||
      tunnelWithin(level, x, z, T.tunnel)
    ) {
      reach = D.step * (i - 1);
      break;
    }
    const k = standing(level, x, z, r, trunks).length;
    trees += k / i;
    if (i <= 3) near += k;
  }
  const cost =
    T.turn * Math.abs(angleDiff(heading, want)) +
    T.blocked * (D.look - reach) +
    T.tree * trees +
    T.keep * Math.abs(angleDiff(heading, keep));
  return { cost, trees: near };
}

/** THE WAY TO STEER from (x, z), holding `held`: the cheapest of the fan
 * either side of the way `want` (and the way held), and whether it runs
 * among trees. */
export function chooseWay(
  state: GameState,
  x: number,
  z: number,
  held: number,
  want: number,
  T: TerrainRead,
  D: DriveRead,
  r: number,
  standing: NearFn = treesNear,
): { way: number; woods: boolean; cost: number } {
  let best = wayCost(state, x, z, held, want, held, T, D, r, standing);
  let way = held;
  for (let k = -D.fan; k <= D.fan; k++) {
    const h = want + (D.spread * k) / D.fan;
    const c = wayCost(state, x, z, h, want, held, T, D, r, standing);
    if (c.cost < best.cost) {
      best = c;
      way = h;
    }
  }
  return { way: Math.atan2(Math.sin(way), Math.cos(way)), woods: best.trees > 0, cost: best.cost };
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// TREE WELLS — the hollow round a trunk in deep powder (`defs/tree-wells.ts`
// says what a real one is and where every number comes from).
//
// A well is a dip in the SNOW'S SURFACE: `withWells` hands back the map
// with `groundAt` and `normalAt` lowered by the deepest well over a point,
// so every reader of the snow — the skier's legs and body, a thrown body,
// a lone ski, the snowmobile, the crowd — meets the same hollow and nothing
// has to ask for it. Each well is a funnel round its trunk: deepest at the
// trunk, a steep wall of loose snow beside it leaning back to a soft lip
// where it meets the snowpack, longer and deeper down the fall line than
// up it. None is laid where the snow is packed (a groomer fills them), and
// its depth fades with the packed share at every point, so a well beside a
// piste never cuts into the run.
//
// THE SNOW IN IT IS LOOSE: `wellLoose` is how bottomless a point is for the
// well over it (the skier's stations read it beside the dial's own), and
// `SkierState.well` how deep in one the skier stands — which `trench.ts`
// reads to bury him: in a well he sinks whether he poles or not, faster and
// deeper, and rocking packs back little of it.
//
// The wells are a pure function of the map and the run's snow dial
// (`wellShareOf`, the dial's bottomless share): none at the ordinary snow,
// where the map is handed back untouched — no race and no digest moves —
// and nothing here draws from the stream.

import { cellKey, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Level, TreeWell, Vec3, WellField } from "../mapgen/types.ts";
import { TREE_WELLS } from "./defs/tree-wells.ts";
import { bottomlessOf } from "./snow.ts";

const W = TREE_WELLS;
const RINGED: ReadonlySet<string> = new Set(W.ringed);

/** How far grown the wells are at a run's snow dial (`GameState.
 * snowDepth`), 0..1: the powder's own bottomless share. */
export function wellShareOf(snowDepth: number): number {
  return bottomlessOf(snowDepth);
}

/** The wells round `level`'s trees grown `share` 0..1 of the way. */
export function wellsOf(level: Level, share: number): TreeWell[] {
  const out: TreeWell[] = [];
  if (share <= 0) return out;
  const n: Vec3 = { x: 0, y: 1, z: 0 };
  for (const t of level.trees) {
    const kind = t.kind ?? "spruce";
    // On the groomer there is none: the machines fill it.
    if (level.packedAt(t.x, t.z) >= 0.5) continue;
    const grown = Math.min(1, t.height / W.grown);
    const depth = W.depth * W.kinds[kind] * grown * share;
    if (depth < W.min) continue;
    const reach = RINGED.has(kind)
      ? t.radius + W.ring
      : clamp(t.crown * W.reach, Math.max(W.least, t.radius + 0.5), W.most);
    // THE FALL LINE at the trunk: the way the snow creeps.
    level.normalAt(t.x, t.z, n);
    const flat = hypot(n.x, n.z);
    const slope = flat / Math.max(0.2, n.y);
    const lean = flat > 1e-4 ? W.lean * Math.min(1, slope / W.slopeFull) : 0;
    out.push({
      x: t.x,
      z: t.z,
      trunk: t.radius,
      depth,
      reach,
      lean,
      fx: flat > 1e-4 ? n.x / flat : 0,
      fz: flat > 1e-4 ? n.z / flat : 0,
      bound: reach * (1 + lean),
    });
  }
  return out;
}

/** How deep ONE well is at (`x`, `z`), m — before the packed snow fills
 * it (`wellAt` reads that). */
export function wellDepthOf(w: TreeWell, x: number, z: number): number {
  const dx = x - w.x;
  const dz = z - w.z;
  const d2 = dx * dx + dz * dz;
  if (d2 >= w.bound * w.bound) return 0;
  const d = Math.sqrt(d2);
  // Down the fall line it reaches further and sinks deeper; the trunk
  // itself is the floor's middle, so the lean comes in off it.
  const cos = d > 1e-6 ? ((dx * w.fx + dz * w.fz) / d) * Math.min(1, (2 * d) / w.reach) : 0;
  const span = w.reach * (1 + w.lean * cos) - w.trunk;
  const s = (d - w.trunk) / Math.max(0.1, span);
  if (s >= 1) return 0;
  const deep = w.depth * (1 + (W.deeper * w.lean * cos) / W.lean);
  return s <= 0 ? deep : deep * Math.pow(1 - s, W.wall);
}

type Index = { cells: Map<number, number[]> };
const indices = new WeakMap<WellField, Index>();

function indexOf(field: WellField): Index {
  let index = indices.get(field);
  if (index) return index;
  const cells = new Map<number, number[]>();
  field.list.forEach((w, i) => {
    const c0 = Math.floor((w.x - w.bound) / W.cell);
    const c1 = Math.floor((w.x + w.bound) / W.cell);
    const r0 = Math.floor((w.z - w.bound) / W.cell);
    const r1 = Math.floor((w.z + w.bound) / W.cell);
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        const key = cellKey(c, r);
        const at = cells.get(key);
        if (at) at.push(i);
        else cells.set(key, [i]);
      }
    }
  });
  index = { cells };
  indices.set(field, index);
  return index;
}

/** The hollow at (`x`, `z`) on a map with `field`'s wells laid over the
 * snow `packedAt` reads, m: the deepest well over the point, as much of it
 * as the loose snow there leaves open. */
function hollowAt(field: WellField, packedAt: Level["packedAt"], x: number, z: number): number {
  const at = indexOf(field).cells.get(cellKey(Math.floor(x / W.cell), Math.floor(z / W.cell)));
  if (!at) return 0;
  let most = 0;
  for (const i of at) {
    const d = wellDepthOf(field.list[i], x, z);
    if (d > most) most = d;
  }
  return most > 0 ? most * (1 - packedAt(x, z)) : 0;
}

/** How deep the tree wells lower the snow at (`x`, `z`), m — 0 on a map
 * with none. */
export function wellAt(level: Level, x: number, z: number): number {
  return level.wells ? hollowAt(level.wells, level.packedAt, x, z) : 0;
}

/** HOW LOOSE the well makes the snow at (`x`, `z`), 0..1: the bottomless
 * share a station there reads beside the dial's own. */
export function wellLoose(level: Level, x: number, z: number): number {
  return level.wells ? clamp(wellAt(level, x, z) / W.loose, 0, 1) : 0;
}

const welled = new WeakMap<Level, Map<number, Level>>();

/** `level` with its trees' wells grown `share` 0..1 of the way into the
 * snow — the map itself, untouched, at none (or with no trees). The same
 * map at the same share is the same object, so a run started again on it
 * is a run on the map the renderer already holds. */
export function withWells(level: Level, share: number): Level {
  if (share <= 0 || level.trees.length === 0 || level.wells) return level;
  let shares = welled.get(level);
  if (!shares) welled.set(level, (shares = new Map()));
  const kept = shares.get(share);
  if (kept) return kept;
  const made = laid(level, share);
  shares.set(share, made);
  return made;
}

function laid(level: Level, share: number): Level {
  const list = wellsOf(level, share);
  if (list.length === 0) return level;
  const wells: WellField = { list, deepest: Math.max(...list.map((w) => w.depth)) };
  const base = level;
  const groundAt = (x: number, z: number): number =>
    base.groundAt(x, z) - hollowAt(wells, base.packedAt, x, z);
  const e = 0.05;
  const normalAt = (x: number, z: number, out: Vec3): void => {
    base.normalAt(x, z, out);
    const xp = hollowAt(wells, base.packedAt, x + e, z);
    const xm = hollowAt(wells, base.packedAt, x - e, z);
    const zp = hollowAt(wells, base.packedAt, x, z + e);
    const zm = hollowAt(wells, base.packedAt, x, z - e);
    if (xp + xm + zp + zm <= 0) return;
    // The snowpack's gradient less the hollow's.
    const gx = -out.x / out.y - (xp - xm) / (2 * e);
    const gz = -out.z / out.y - (zp - zm) / (2 * e);
    const inv = 1 / Math.sqrt(gx * gx + 1 + gz * gz);
    out.x = -gx * inv;
    out.y = inv;
    out.z = -gz * inv;
  };
  return { ...level, wells, groundAt, normalAt };
}

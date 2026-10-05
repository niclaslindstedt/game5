// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE FLOODLIGHT MASTS STAND — a mast every fifty metres or so down
// every run of a ski area, past the piste's edge, as tall as the piste is
// wide. In the engine because a skier MEETS one (`standing.ts`): a steel
// pole is as solid as a trunk. What each mast carries and the light it
// lays on the snow is the app's (`piste-light-plan.ts`, whose header holds
// the research the layout below is built to).

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { trackPointAt } from "../mapgen/query.ts";
import type { Level, TrackPoint } from "../mapgen/types.ts";
import { treesNear } from "./upright-grid.ts";
import { clearOfLifts } from "./lift-line.ts";

/** The layout, m.
 *   * `every`: from one mast to the next down the run; `first` the first
 *     mast's arc down from the run's head (half the edge stakes' 25 m, so
 *     the two never stand side by side).
 *   * `out`: the mast's foot past the piste's edge — beyond the edge
 *     stakes' 1.5 m.
 *   * `height`: the light point over the snow: `base` + `perWidth` × the
 *     piste's width, held to `[min, max]`.
 *   * `bothSides`: a piste wider than this is lit from both edges, the
 *     masts staggered.
 *   * `clear`: how close two masts may stand (two runs side by side); how
 *     far a trunk keeps from the foot; how far from the finish line and
 *     the start line a mast stands (the arena has its own floods).
 *   * `pole`: the steel pole's radius at its foot and its head, and how
 *     far it is sunk into the snow so a slope never shows its base. */
export const PISTE_MAST = {
  every: 50,
  first: 12.5,
  out: 3.5,
  height: { base: 8, perWidth: 0.15, min: 10, max: 18 },
  bothSides: 70,
  clear: { mast: 25, tree: 1.6, finish: 40, start: 20 },
  pole: { foot: 0.12, head: 0.065, sunk: 0.4 },
} as const;

/** One mast as it stands: its foot on the snow, its height to the light
 * point, which side of its run (+1 the skier's left going down), the way
 * it faces in plan (across its run), and where on which line it stands —
 * the run (`lines` index), its arc, the piste's width there and whether
 * that piste is lit from both edges. */
export type MastSite = {
  x: number;
  y: number;
  z: number;
  height: number;
  side: number;
  heading: number;
  line: number;
  s: number;
  width: number;
  wide: boolean;
};

/** The lines a ski area's masts stand along: every run of the area, or the
 * one piste of a map that has none. */
export function mastLines(level: Level): { id: string; points: TrackPoint[]; length: number }[] {
  if (level.resort) return level.resort.runs;
  return [{ id: "piste", points: level.track.points, length: level.track.length }];
}

/** The light point's height over the snow beside a piste `width` m wide. */
export function mastHeight(width: number): number {
  const H = PISTE_MAST.height;
  return Math.min(H.max, Math.max(H.min, H.base + H.perWidth * width));
}

/** A small FNV hash of a run's id: which side its masts stand on. */
function sideOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) % 2 === 0 ? 1 : -1;
}

const sites = new WeakMap<Level, MastSite[]>();

/**
 * WHERE THE MASTS STAND on `level`: down every run from `first` m every
 * `every` m, `out` m past the edge on the run's own side (both sides,
 * staggered, where it is wider than `bothSides`). A mast that would stand
 * in a lift's line or station, on another run's snow, in a trunk, or close
 * by another mast is nudged down and up the run, and left out where no
 * nudge clears it. Pure, and kept per map.
 */
export function pisteMasts(level: Level): readonly MastSite[] {
  const known = sites.get(level);
  if (known) return known;
  const P = PISTE_MAST;
  const masts: MastSite[] = [];
  const lines = mastLines(level);
  const many = lines.length > 1;
  const near: number[] = [];
  const cps = level.checkpoints;
  const finish = cps.length > 0 ? cps[cps.length - 1] : null;
  // A hash of the masts stood so far, a cell per `clear.mast`.
  const cells = new Map<string, MastSite[]>();
  const cellKey = (x: number, z: number): string =>
    `${Math.floor(x / P.clear.mast)},${Math.floor(z / P.clear.mast)}`;
  const crowded = (x: number, z: number): boolean => {
    const cx = Math.floor(x / P.clear.mast);
    const cz = Math.floor(z / P.clear.mast);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (const m of cells.get(`${cx + i},${cz + j}`) ?? []) {
          if (hypot(m.x - x, m.z - z) < P.clear.mast) return true;
        }
      }
    }
    return false;
  };
  const clearAt = (x: number, z: number): boolean => {
    if (x < 0 || z < 0 || x > level.size || z > level.size) return false;
    if (many && level.packedAt(x, z) > 0.5) return false;
    if (!clearOfLifts(level, x, z)) return false;
    if (treesNear(level, x, z, P.clear.tree, near).length > 0) return false;
    if (finish && hypot(finish.x - x, finish.z - z) < P.clear.finish) return false;
    if (hypot(level.spawn.x - x, level.spawn.z - z) < P.clear.start) return false;
    return !crowded(x, z);
  };
  const at: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
  // Nudged along the run, nearest first.
  const NUDGE = [0, 5, -5, 10, -10];

  lines.forEach((run, index) => {
    const line = { track: { points: run.points, length: run.length } };
    const own = sideOf(run.id);
    for (let s0 = P.first, k = 0; s0 < run.length - 5; s0 += P.every / 2, k++) {
      trackPointAt(line, s0, at);
      const wide = at.width > P.bothSides;
      // Every other half-step is a mast on the run's own side; the ones
      // between stand on the far side where the piste is wide enough.
      const side = k % 2 === 0 ? own : -own;
      if (k % 2 === 1 && !wide) continue;
      let placed: { s: number; x: number; z: number } | null = null;
      for (const ds of NUDGE) {
        const s = s0 + ds;
        if (s < 0 || s > run.length) continue;
        trackPointAt(line, s, at);
        const off = at.width / 2 + P.out;
        const x = at.x + Math.cos(at.heading) * side * off;
        const z = at.z - Math.sin(at.heading) * side * off;
        if (clearAt(x, z)) {
          placed = { s, x, z };
          break;
        }
      }
      if (!placed) continue;
      trackPointAt(line, placed.s, at);
      const mast: MastSite = {
        x: placed.x,
        y: level.groundAt(placed.x, placed.z),
        z: placed.z,
        height: mastHeight(at.width),
        side,
        // Facing in across the run: the heading turned toward the centreline.
        heading: at.heading - (side * Math.PI) / 2,
        line: index,
        s: placed.s,
        width: at.width,
        wide,
      };
      masts.push(mast);
      const key = cellKey(mast.x, mast.z);
      const list = cells.get(key);
      if (list) list.push(mast);
      else cells.set(key, [mast]);
    }
  });
  sites.set(level, masts);
  return masts;
}

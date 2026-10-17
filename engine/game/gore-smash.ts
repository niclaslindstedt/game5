// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SMASHED AGAINST STONE OR WOOD (`GORE.smash`) — which points of a body
// arriving at a rigid solid faster than a body holds together were crushed
// on it this step, and which way the solid's face looked where each met it.
// Read only by `gore.ts`, on a run that carries its injuries.
//
// It reads what the ragdoll has already measured: every point's closing
// speed into a solid this step (`Thrown.struck`) and into the ground
// (`Thrown.impacts`), the ground counted as stone only where the crag's
// rock is bare. A padded tower gives and is never a smash; nor is snow.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { GORE } from "./defs/gore.ts";
import { TUNING } from "./defs/tuning.ts";
import { RAGDOLL, RADIUS } from "./ragdoll-points.ts";
import { solidsNear, solidsOf } from "./posts.ts";
import type { GoreState } from "./gore-state.ts";
import type { GameState, Thrown } from "./state.ts";

const R = RAGDOLL;
const dt = TUNING.dt;

/** One point crushed: which (`RAGDOLL`), the solid's face there, and the
 * upright it met — its axis and radius, m (`r` 0: a flat face). */
export type Smashed = {
  point: number;
  nx: number;
  ny: number;
  nz: number;
  cx: number;
  cz: number;
  r: number;
};

const near: number[] = [];
const n = { x: 0, y: 1, z: 0 };

/** How fast his body goes, m/s: the mean of his points' way over the step
 * thrown, his own on his skis. */
export function bodySpeed(state: GameState): number {
  const b = state.skier.thrown;
  const c = state.skier;
  if (!b) return hypot(hypot(c.vx, c.vy), c.vz);
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < R.count; i++) {
    x += b.points[3 * i] - b.last[3 * i];
    y += b.points[3 * i + 1] - b.last[3 * i + 1];
    z += b.points[3 * i + 2] - b.last[3 * i + 2];
  }
  return hypot(hypot(x, y), z) / (R.count * dt);
}

/** The points of `b` crushed this step, given the run clock his body last
 * went faster than a smash (`GoreState.fast`): inside the window every
 * point that meets a solid faster than `hit`, and outside it any point that
 * meets one faster than `speed` itself. */
export function smashedPoints(state: GameState, g: GoreState, b: Thrown): Smashed[] {
  const S = GORE.smash;
  // The body arriving fast lets every point that meets the solid count; a
  // point that met it as fast on its own counts whatever the body did.
  const fast = g.fast >= 0 && state.t - g.fast <= S.window;
  const hit = fast ? S.hit : S.speed;
  const level = state.level;
  const out: Smashed[] = [];
  const solids = solidsOf(level);
  for (let i = 0; i < R.count; i++) {
    const x = b.points[3 * i];
    const z = b.points[3 * i + 2];
    if (b.struck[i] > hit) {
      // The solid it met: the nearest within its reach, and its face's way.
      let best = Infinity;
      let ux = 0;
      let uz = 0;
      let soft = false;
      let cx = 0;
      let cz = 0;
      let r = 0;
      solidsNear(level, x, z, 2, near);
      for (const k of near) {
        const s = solids[k];
        const dx = x - s.x;
        const dz = z - s.z;
        const d = hypot(dx, dz) - s.radius;
        if (d < best) {
          best = d;
          ux = dx / (hypot(dx, dz) || 1);
          uz = dz / (hypot(dx, dz) || 1);
          soft = s.stuff === "padded";
          cx = s.x;
          cz = s.z;
          r = s.radius;
        }
      }
      // A wall's slab or a box (none of the uprights near): back the way it came.
      if (best > RADIUS[i] + 0.3) {
        const vx = x - b.last[3 * i];
        const vz = z - b.last[3 * i + 2];
        const v = hypot(vx, vz) || 1;
        ux = -vx / v;
        uz = -vz / v;
        soft = false;
        r = 0;
      }
      if (!soft) out.push({ point: i, nx: ux, ny: 0, nz: uz, cx, cz, r });
      continue;
    }
    if (b.impacts[i] > hit && level.bareRockAt && level.bareRockAt(x, z) >= S.rock) {
      level.normalAt(x, z, n);
      out.push({ point: i, nx: n.x, ny: n.y, nz: n.z, cx: x, cz: z, r: 0 });
    }
  }
  return out;
}

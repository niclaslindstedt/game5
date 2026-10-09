// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER MEETING WHAT IS NOT SNOW — the trees, and the edge of the map.
// The snow itself is the legs' and the hull's (`skier.ts`); this is
// everything that stands up out of it.
//
// A TREE is its trunk: a vertical cylinder of `radius` from the ground at
// its foot to its top, and the crown drawn round it is nothing to the
// physics — a skier brushing snow off the lowest branches is a picture, and
// a skier meeting the trunk is the whole of the hit. The skier is three
// plan circles down his skis' length (the tips, the body and the tails),
// which is the footprint of a thing two metres long and most of a metre
// wide at any heading. A circle inside a trunk is pushed out along the line
// between their centres, the closing speed comes back at `restitution`, the
// speed along the trunk is scrubbed, and the push's lever about the CoG
// turns the skier — which is why a clipped tip spins a skier round and a
// trunk met dead centre stops him. The trunks are hashed once per level, so
// a step reads the handful near the skier rather than the forest
// (`upright-grid.ts`).
//
// A POST is met the same way: a lift tower's steel column or a floodlight
// mast's pole (`posts.ts`) is a cylinder from the snow to its head, as
// solid as any trunk and reported as the same `hit`.
//
// A BUILDING'S WALL is a slab (`building-walls.ts`), met by the same three
// circles and answered the same way, its normal the wall's: he slides
// along a wall met at a slant and stops at one met square, and the way he
// came this step is asked too, so no speed carries him through a wall —
// from outside or, once through an open door, from inside.
//
// THE EDGE is a soft push back toward the middle over the last `bounds.soft`
// metres and a hard wall `bounds.margin` inside the map's own edge.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { envelopeOf, inertiaOf, totalMass } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { holdOutOfWalls, wallTouch } from "./building-walls.ts";
import { solidsNear, solidsOf } from "./posts.ts";
import type { GameEvent, GameState } from "./state.ts";
import { treesNear, type Stuff } from "./upright-grid.ts";

export { treesNear };

const K = TUNING.trees;
const dt = TUNING.dt;

/** Where the three footprint circles stand along the skis, m forward of
 * the CoG, as shares of their half-length. */
const CIRCLES = [0.8, 0, -0.8];
/** How far his boots stand under his centre of gravity, m, near enough:
 * what a low rail or a step is met by. */
const LEGS = 0.9;
const near: number[] = [];
const touch = wallTouch();
const at = { x: 0, z: 0 };

/** Push the skier out of every trunk, every post (a lift's column, a
 * floodlight mast) and every building's wall he has run into this step,
 * and report the hit. (`x0`, `z0`): where he stood at the step's start —
 * the way to here a wall is asked along; left out, where he is. */
export function collideTrees(
  state: GameState,
  events: GameEvent[],
  x0 = state.skier.x,
  z0 = state.skier.z,
): void {
  const c = state.skier;
  const level = state.level;
  const solids = solidsOf(level);
  if (solids.length === 0) return;
  const half = envelopeOf(c.spec).length / 2;
  solidsNear(level, c.x, c.z, half + K.bodyRadius + Math.abs(c.x - x0) + Math.abs(c.z - z0), near);
  const m = totalMass(c.spec);
  const Iy = inertiaOf(c.spec).y;
  const fl = hypot(Math.sin(c.heading), Math.cos(c.heading));
  const fx = Math.sin(c.heading) / fl;
  const fz = Math.cos(c.heading) / fl;
  let worst = 0;
  let hitX = 0;
  let hitZ = 0;
  let post = false;
  let stuff: Stuff = "trunk";
  let radius = 0;
  for (const i of near) {
    const t = solids[i];
    // A building's wall is met as the wall, below — never its posts.
    if (t.wall) continue;
    if (c.y < t.y - 1 || c.y > t.y + t.height) continue;
    for (const share of CIRCLES) {
      const ox = fx * share * half;
      const oz = fz * share * half;
      const dx = c.x + ox - t.x;
      const dz = c.z + oz - t.z;
      const d = hypot(dx, dz);
      const reach = K.bodyRadius + t.radius;
      if (d >= reach) continue;
      const nx = d > 1e-6 ? dx / d : -fx;
      const nz = d > 1e-6 ? dz / d : -fz;
      const pen = reach - d;
      c.x += nx * pen;
      c.z += nz * pen;
      const vn = c.vx * nx + c.vz * nz;
      if (vn >= 0) continue;
      const closing = -vn;
      // The normal part comes back at the restitution; the part along the
      // trunk is scrubbed, harder the harder the blow.
      const tx = c.vx - vn * nx;
      const tz = c.vz - vn * nz;
      const scrub = 1 - K.scrub * Math.min(1, closing / 8);
      c.vx = tx * scrub - K.restitution * vn * nx;
      c.vz = tz * scrub - K.restitution * vn * nz;
      // The blow's lever about the CoG turns the skier (world y is the
      // body's up while it is upright, which is the only way it meets a
      // trunk worth turning it for).
      const j = m * (1 + K.restitution) * closing;
      const yaw = (oz * nx - ox * nz) * j;
      c.wy += (yaw / Iy) * 0.5;
      if (closing > worst) {
        worst = closing;
        hitX = t.x;
        hitZ = t.z;
        post = i >= level.trees.length;
        stuff = t.stuff ?? "trunk";
        radius = t.radius;
      }
    }
  }
  // THE WALLS: each circle where it was at the step's start and where it
  // is, held out of every slab — the push the wall's, answered as a trunk's.
  for (const share of CIRCLES) {
    const ox = fx * share * half;
    const oz = fz * share * half;
    at.x = c.x + ox;
    at.z = c.z + oz;
    holdOutOfWalls(state, x0 + ox, z0 + oz, at, c.y, K.bodyRadius, touch, LEGS);
    if (!touch.met) continue;
    c.x += at.x - (c.x + ox);
    c.z += at.z - (c.z + oz);
    const nx = touch.nx;
    const nz = touch.nz;
    const vn = c.vx * nx + c.vz * nz;
    if (vn >= 0) continue;
    const closing = -vn;
    const tx = c.vx - vn * nx;
    const tz = c.vz - vn * nz;
    const scrub = 1 - K.scrub * Math.min(1, closing / 8);
    c.vx = tx * scrub - K.restitution * vn * nx;
    c.vz = tz * scrub - K.restitution * vn * nz;
    const j = m * (1 + K.restitution) * closing;
    c.wy += (((oz * nx - ox * nz) * j) / Iy) * 0.5;
    if (closing > worst) {
      worst = closing;
      hitX = at.x - nx * K.bodyRadius;
      hitZ = at.z - nz * K.bodyRadius;
      post = true;
      stuff = touch.stuff;
      radius = 0;
    }
  }
  if (worst >= K.hitSpeed && c.hitCooldown <= 0) {
    c.hitCooldown = K.cooldown;
    events.push({
      kind: "hit",
      t: state.t,
      speed: worst,
      x: hitX,
      z: hitZ,
      stuff,
      radius,
      ...(post ? { post: true as const } : {}),
    });
  }
}

/** Turn the skier back from the edge of the map. */
export function keepInBounds(state: GameState): void {
  const c = state.skier;
  const B = TUNING.bounds;
  const lo = B.margin;
  const hi = state.level.size - B.margin;
  const soft = (p: number): number => {
    if (p < lo + B.soft) return ((lo + B.soft - p) / B.soft) * B.push;
    if (p > hi - B.soft) return -((p - (hi - B.soft)) / B.soft) * B.push;
    return 0;
  };
  c.vx += soft(c.x) * dt;
  c.vz += soft(c.z) * dt;
  if (c.x < lo) {
    c.x = lo;
    if (c.vx < 0) c.vx = 0;
  } else if (c.x > hi) {
    c.x = hi;
    if (c.vx > 0) c.vx = 0;
  }
  if (c.z < lo) {
    c.z = lo;
    if (c.vz < 0) c.vz = 0;
  } else if (c.z > hi) {
    c.z = hi;
    if (c.vz > 0) c.vz = 0;
  }
}

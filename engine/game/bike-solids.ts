// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE AGAINST WHAT STANDS (`bike.ts`): every solid of the map
// (`posts.ts`' `solidsOf` — the trunks, the lifts' towers and posts, the
// masts, the buildings' walls as rows of posts, the cliffs' rock) met by the
// bike's PLAN, a capsule down its length for its wheels and frame, and by
// its BARS, 0.8 m across and a metre up, whose ends reach past the wheels
// either side — the classic clip of a bar end on a trunk beside the line,
// which snatches the bars round and throws the rider where the wheels went
// clear. The map's edge, a walker's plan and a lying bike's are here too.
// Pure over the level and the state; nothing here draws from any stream.

import { clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { bikeToWorld } from "./bike-frame.ts";
import { standing } from "./building-walls.ts";
import { BIKE } from "./defs/bike.ts";
import { TUNING } from "./defs/tuning.ts";
import { solidsNear, solidsOf } from "./posts.ts";
import type { BikeState, GameState } from "./state.ts";

/** The bike's plan as a solid meets it: a capsule `half` m either way of
 * its middle along its length, `wide` m round. */
export const BIKE_PLAN = { half: 1.05, wide: 0.3 } as const;

/** THE BARS as a solid meets them, in the bike's own frame from its centre
 * of mass, m: their middle (over the steer axis, a stem ahead of it, at
 * the bars' height on a 0.63 m stack) and their half-width (a 0.8 m bar —
 * `docs/downhill-bike.md`); a bar end met `hook` m deep into a solid
 * catches on it rather than sliding past. */
export const BIKE_BARS = { y: 0.55, z: 0.38, half: 0.4, hook: 0.02 } as const;

/** What the solids did to the bike this step: the hardest closing speed of
 * its wheels or frame, m/s, and of a bar end caught, m/s. */
export type SolidMeet = { frame: number; bar: number };

const near: number[] = [];
const end = { x: 0, y: 0, z: 0 };
const other = { x: 0, y: 0, z: 0 };

/** THE SOLIDS against the bike: its plan pushed out of each, the closing
 * speed taken off (the frame bounced back a little off it, the rider
 * carried on most of his way), and a bar end that catches one snatched
 * round — the bike yawed toward it and slowed by the catch. */
export function meetSolids(run: GameState, b: BikeState): SolidMeet {
  const out: SolidMeet = { frame: 0, bar: 0 };
  const level = run.level;
  const solids = solidsOf(level);
  if (solids.length === 0) return out;
  const P = BIKE_PLAN;
  solidsNear(level, b.x, b.z, P.half + BIKE_BARS.half + 1, near);
  const fx = Math.sin(b.heading);
  const fz = Math.cos(b.heading);
  for (const i of near) {
    const t = solids[i];
    if (b.y < t.y - 1 || b.y > t.y + t.height || !standing(run, t)) continue;
    const u = clamp((t.x - b.x) * fx + (t.z - b.z) * fz, -P.half, P.half);
    const dx = b.x + fx * u - t.x;
    const dz = b.z + fz * u - t.z;
    const d = hypot(dx, dz);
    const reach = P.wide + t.radius;
    if (d >= reach) continue;
    const nx = d > 1e-6 ? dx / d : -fx;
    const nz = d > 1e-6 ? dz / d : -fz;
    shiftBike(b, nx * (reach - d), nz * (reach - d));
    const vn = b.vx * nx + b.vz * nz;
    if (vn >= 0) continue;
    b.vx -= 1.3 * vn * nx;
    b.vz -= 1.3 * vn * nz;
    b.rider.vx -= 0.5 * vn * nx;
    b.rider.vz -= 0.5 * vn * nz;
    b.wy += u * (nx * fz - nz * fx) * -vn * 0.3;
    out.frame = Math.max(out.frame, -vn);
  }
  out.bar = barEnds(run, b);
  return out;
}

/** THE BAR ENDS against the solids beside the line: a bar end `hook` m into
 * one has caught it — the closing speed is the bike's own way into it
 * (the bar does not slide off a trunk it has hooked), the bike is pushed
 * clear, slowed and yawed toward the side it caught. Returns the hardest
 * catch's speed, m/s. */
function barEnds(run: GameState, b: BikeState): number {
  const B = BIKE_BARS;
  const solids = solidsOf(run.level);
  let worst = 0;
  for (const side of [-1, 1]) {
    bikeToWorld(b.q, { x: side * B.half, y: B.y, z: B.z }, end);
    bikeToWorld(b.q, { x: side * B.half * 0.45, y: B.y, z: B.z }, other);
    end.x += b.x;
    end.y += b.y;
    end.z += b.z;
    other.x += b.x;
    other.z += b.z;
    // The bar's outer half, from past the grip's inside to its end.
    const ex = end.x - other.x;
    const ez = end.z - other.z;
    const len2 = ex * ex + ez * ez || 1;
    for (const i of near) {
      const t = solids[i];
      if (end.y < t.y || end.y > t.y + t.height || !standing(run, t)) continue;
      const k = clamp(((t.x - other.x) * ex + (t.z - other.z) * ez) / len2, 0, 1);
      const px = other.x + ex * k;
      const pz = other.z + ez * k;
      const dx = px - t.x;
      const dz = pz - t.z;
      const d = hypot(dx, dz);
      const into = t.radius - d;
      if (into <= 0) continue;
      const nx = d > 1e-6 ? dx / d : 0;
      const nz = d > 1e-6 ? dz / d : 0;
      shiftBike(b, nx * into, nz * into);
      if (into < B.hook) continue;
      // Caught: the bike's way into the trunk's side of it is the blow.
      const fx = Math.sin(b.heading);
      const fz = Math.cos(b.heading);
      const way = b.vx * fx + b.vz * fz;
      if (way <= 0) continue;
      worst = Math.max(worst, way);
      // The catch takes a share of his way and turns the bars and the bike
      // about the bar end: toward the side it caught.
      const keep = 0.55;
      b.vx -= fx * way * (1 - keep);
      b.vz -= fz * way * (1 - keep);
      b.rider.vx -= fx * way * (1 - keep) * 0.4;
      b.rider.vz -= fz * way * (1 - keep) * 0.4;
      b.wy += side * way * 0.9;
      b.steerRate += side * way * 4;
    }
  }
  return worst;
}

/** A LYING OR RESTARTED BIKE kept out of the solids along its whole plan
 * (its middle is kept out by `outOfSolids`; its nose and tail would
 * otherwise slide into a wall it is shoved against, or be stood up in
 * one): moved clear, its way into each gone. */
export function planOut(run: GameState, b: BikeState): void {
  const level = run.level;
  const solids = solidsOf(level);
  if (solids.length === 0) return;
  const P = BIKE_PLAN;
  solidsNear(level, b.x, b.z, P.half + 1, near);
  const fx = Math.sin(b.heading);
  const fz = Math.cos(b.heading);
  for (const i of near) {
    const t = solids[i];
    if (b.y < t.y - 1 || b.y > t.y + t.height || !standing(run, t)) continue;
    const u = clamp((t.x - b.x) * fx + (t.z - b.z) * fz, -P.half, P.half);
    const dx = b.x + fx * u - t.x;
    const dz = b.z + fz * u - t.z;
    const d = hypot(dx, dz);
    const reach = P.wide + t.radius;
    if (d >= reach) continue;
    const nx = d > 1e-6 ? dx / d : -fx;
    const nz = d > 1e-6 ? dz / d : -fz;
    shiftBike(b, nx * (reach - d), nz * (reach - d));
    const vn = b.vx * nx + b.vz * nz;
    if (vn < 0) {
      b.vx -= vn * nx;
      b.vz -= vn * nz;
    }
  }
}

/** The bike, its rider and its wheels moved by (dx, dz). */
export function shiftBike(b: BikeState, dx: number, dz: number): void {
  b.x += dx;
  b.z += dz;
  b.rider.x += dx;
  b.rider.z += dz;
}

/** (x, z) pushed out of every solid standing in the way, `width` m round —
 * a walker's or a lying bike's plan. */
export function outOfSolids(
  run: GameState,
  x: number,
  z: number,
  width: number,
): { x: number; z: number } {
  const level = run.level;
  const solids = solidsOf(level);
  solidsNear(level, x, z, width + 1, near);
  // Twice round, so pushed out of one into the next it is pushed out of
  // that too.
  for (let pass = 0; pass < 2; pass++) {
    for (const i of near) {
      const t = solids[i];
      if (!standing(run, t)) continue;
      const dx = x - t.x;
      const dz = z - t.z;
      const d = hypot(dx, dz);
      const reach = width + t.radius;
      if (d >= reach) continue;
      const ox = d > 1e-6 ? dx / d : 1;
      const oz = d > 1e-6 ? dz / d : 0;
      x = t.x + ox * reach;
      z = t.z + oz * reach;
    }
  }
  return { x, z };
}

/** The map's edge: held inside it. */
export function bikeInBounds(run: GameState, b: BikeState): void {
  const lo = TUNING.bounds.margin;
  const hi = run.level.size - lo;
  const dx = clamp(b.x, lo, hi) - b.x;
  const dz = clamp(b.z, lo, hi) - b.z;
  if (dx === 0 && dz === 0) return;
  shiftBike(b, dx, dz);
  if (dx !== 0) b.vx = dx > 0 ? Math.max(0, b.vx) : Math.min(0, b.vx);
  if (dz !== 0) b.vz = dz > 0 ? Math.max(0, b.vz) : Math.min(0, b.vz);
}

/** Whether a bar end caught at `speed` m/s throws him: past what a rider
 * holds a snatched bar at (`crash.hit`). */
export const barThrows = (speed: number): boolean => speed > BIKE.crash.hit;

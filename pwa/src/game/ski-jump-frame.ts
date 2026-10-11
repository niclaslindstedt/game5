// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMPING HILL'S FRAME (R43): where a point stated along the hill
// stands in the world. A hill publishes every place down it as metres of
// PLAN along its line (`Level.skiJump`, the tower's deck at 0), and its
// own `track` starts on that line's origin with the line's heading — so a
// point `d` m along, `a` m across (to the jumper's right) and `h` m over
// the profile is that origin carried along and across. Three-free: the
// plan (`ski-jump-plan.ts`), the view and the lab all ask this one frame.

import { SKI_JUMP_RULE, type Level } from "@engine";

/** The hill a map publishes (`Level.skiJump`). */
export type SkiJumpHill = NonNullable<Level["skiJump"]>;

export type HillFrame = {
  hill: SkiJumpHill;
  /** The line's origin (the deck), m, and its heading, rad (0 = +z). */
  x: number;
  z: number;
  heading: number;
  /** Down the hill (fx, fz) and to the jumper's right (rx, rz), unit. */
  fx: number;
  fz: number;
  rx: number;
  rz: number;
};

/** The frame of `level`'s hill, or null on a map with none. */
export function hillFrame(level: Level): HillFrame | null {
  const hill = level.skiJump;
  const o = level.track.points[0];
  if (!hill || !o) return null;
  const fx = Math.sin(o.heading);
  const fz = Math.cos(o.heading);
  return { hill, x: o.x, z: o.z, heading: o.heading, fx, fz, rx: fz, rz: -fx };
}

/** The world point `d` m of plan along the hill, `a` m to its right and
 * `h` m over its profile. */
export function hillPoint(
  f: HillFrame,
  d: number,
  a = 0,
  h = 0,
): { x: number; y: number; z: number } {
  return {
    x: f.x + f.fx * d + f.rx * a,
    y: f.hill.yAt(d) + h,
    z: f.z + f.fz * d + f.rz * a,
  };
}

/** THE LANDING AREA'S WIDTH `d` m of plan along the hill, m: the norm's
 * widths at the knoll's foot, at K and at U, straight between them, the
 * in-run's above the edge. */
export function landingWidth(hill: SkiJumpHill, d: number): number {
  const w = hill.w;
  const foot = SKI_JUMP_RULE.norm.widths.foot * w;
  const k = SKI_JUMP_RULE.norm.widths.k * w;
  const u = SKI_JUMP_RULE.norm.widths.u * w;
  if (d <= hill.edge) return SKI_JUMP_RULE.norm.widths.inRun;
  if (d <= hill.k) return foot + ((k - foot) * (d - hill.edge)) / (hill.k - hill.edge);
  if (d <= hill.u) return k + ((u - k) * (d - hill.k)) / (hill.u - hill.k);
  return u;
}

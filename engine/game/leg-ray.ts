// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE A LEG MEETS THE SNOW — a station's ray, cast from its attachment
// at `(ax, ay, az)` along `(dx, dy, dz)` (down the snow's normal, unit),
// against the support `sink` m under the surface: the distance along the
// ray it meets it, m, or NaN where it never does.
//
// ON A MAP A SKIER STANDS ON, Newton's method along the ray, off the slope
// of the snow wherever the last guess landed — a ray at a grazing angle to
// a face converges where a vertical guess would overshoot it — from the
// vertical gap; a ray running along the snow meets nothing.
//
// ON A MAP WITH WALLS (`Level.normalNear`, R41's pipe), the ray is cast
// nearly level into a wall standing at 80°, where the vertical gap is no
// guess at all and three Newton steps from it land metres off: the gap is
// BRACKETED along the leg's own reach and bisected — the first place the
// ray passes under the snow.

import type { Level, Vec3 } from "../mapgen/types.ts";

/** Newton steps, and how steeply the ray must meet the snow (the vertical
 * closing per metre of ray) to count as meeting it. */
const RAY_STEPS = 3;
const RAY_GRAZE = 0.15;
/** On a wall: the reach searched, m along the ray, its step and the
 * bisection's halvings. */
const WALL_FROM = -0.5;
const WALL_STEP = 0.2;
const WALL_HALVINGS = 14;

export function castLeg(
  level: Level,
  ax: number,
  ay: number,
  az: number,
  dx: number,
  dy: number,
  dz: number,
  sink: number,
  reach: number,
  normal: Vec3,
): number {
  if (level.normalNear) {
    const gap = (t: number): number =>
      ay + dy * t - (level.groundAt(ax + dx * t, az + dz * t) - sink);
    let lo = WALL_FROM;
    if (gap(lo) <= 0) return lo;
    for (let hi = lo + WALL_STEP; hi <= reach + WALL_STEP; hi += WALL_STEP) {
      if (gap(hi) > 0) {
        lo = hi;
        continue;
      }
      for (let k = 0; k < WALL_HALVINGS; k++) {
        const mid = (lo + hi) / 2;
        if (gap(mid) > 0) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    }
    return NaN;
  }
  let t = (ay - (level.groundAt(ax, az) - sink)) / -dy;
  let cx = ax + dx * t;
  let cz = az + dz * t;
  for (let it = 0; it < RAY_STEPS; it++) {
    level.normalAt(cx, cz, normal);
    const slope = dy + (normal.x * dx + normal.z * dz) / normal.y;
    if (slope > -RAY_GRAZE) return NaN;
    const gap = ay + dy * t - (level.groundAt(cx, cz) - sink);
    t -= gap / slope;
    cx = ax + dx * t;
    cz = az + dz * t;
  }
  // A root far behind the hips is no snow under the leg: Newton walked the
  // ray's line backward onto a face above (a kicker's, under a skier high
  // in the air over its back).
  return t < -reach ? NaN : t;
}

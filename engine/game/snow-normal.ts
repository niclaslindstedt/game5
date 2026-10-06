// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW UNDER A SKIER — the normal of the snow he stands on, read off
// his centre of mass. On every map but one it is the snow straight under
// him (`Level.normalAt`); on a map with a surface steeper than a skier
// stands on — R41's pipe, whose vert stands at 83° — it is the snow
// NEAREST him (`Level.normalNear`), because straight down from a body stood
// off a wall is the transition metres below it. Every reading of "the
// ground under the CoG" in the skier's step asks here, so a map without a
// pipe reads exactly what it always read.

import type { Level, Vec3 } from "../mapgen/types.ts";

/** The snow's normal under the body at `p` (its centre of mass), into
 * `out`. */
export function snowNormal(level: Level, p: { x: number; y: number; z: number }, out: Vec3): void {
  if (level.normalNear) level.normalNear(p.x, p.y, p.z, out);
  else level.normalAt(p.x, p.z, out);
}

/** How UPRIGHT a body whose up is `up` stands: against the world's up on a
 * map a skier stands on (as the step always read it), against the snow's
 * own normal `n` where the map has walls (a skier on the vert stands
 * square to the wall, his up all but level). */
export function uprightOn(level: Level, up: Vec3, n: Vec3): number {
  return level.normalNear ? up.x * n.x + up.y * n.y + up.z * n.z : up.y;
}

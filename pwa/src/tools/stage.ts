// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A LAB'S STAGE on a map — where a harness rides its skier and under what
// sun: the open MEADOW (the most room from the nearest tree, flat, off the
// piste, on the mountain's face), a spot on the PISTE a third of the way
// down it, and the hour the sun stands at a height. The cloud lab
// (`cloud-harness.ts`) and the turns lab (`turns-harness.ts`) stand on it.

import { nearestTrackPoint, sunAtRun, withSky, type Level } from "@engine";

/** THE OPEN MEADOW: the most room from the nearest tree, flat, off the
 * piste, on the mountain's face. */
export function meadow(level: Level): { x: number; z: number; room: number } {
  const c = { x: level.size / 2, z: level.size * 0.5, rim: level.size * 0.4 };
  let best = { x: c.x, z: c.z, room: -Infinity };
  for (let x = c.x - c.rim * 0.8; x <= c.x + c.rim * 0.8; x += 16) {
    for (let z = c.z - c.rim * 0.8; z <= c.z + c.rim * 0.8; z += 16) {
      if (Math.hypot(x - c.x, z - c.z) > c.rim * 0.8) continue;
      const near = nearestTrackPoint(level, x, z);
      if (Math.hypot(near.x - x, near.z - z) < 45 || level.packedAt(x, z) > 0.05) continue;
      let tree = 90;
      for (const t of level.trees) tree = Math.min(tree, Math.hypot(t.x - x, t.z - z));
      let lo = Infinity;
      let hi = -Infinity;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        for (const r of [0, 20, 40]) {
          const y = level.groundAt(x + Math.sin(a) * r, z + Math.cos(a) * r);
          lo = Math.min(lo, y);
          hi = Math.max(hi, y);
        }
      }
      const room = tree - (hi - lo) * 6;
      if (room > best.room) best = { x, z, room };
    }
  }
  return best;
}

/** THE PISTE as a stage: a point `at` of the way down it (a third unless
 * said) and its heading there. */
export function pisteSpot(level: Level, at = 1 / 3): { x: number; z: number; heading: number } {
  const p = level.track.points[Math.floor(level.track.points.length * at)];
  return { x: p.x, z: p.z, heading: p.heading };
}

/** The hour (solar) the sun stands nearest `elevation` rad, before noon. */
export function hourAt(level: Level, elevation: number): number {
  let best = 12;
  let gap = Infinity;
  for (let h = 5; h <= 12; h += 0.25) {
    const e = sunAtRun(withSky(level, { hour: h })).elevation;
    if (Math.abs(e - elevation) < gap) {
      gap = Math.abs(e - elevation);
      best = h;
    }
  }
  return best;
}

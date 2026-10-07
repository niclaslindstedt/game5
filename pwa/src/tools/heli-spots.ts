// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER LAB'S PLACES (`heli-harness.ts`): where on a map each scene
// is staged, found by sampling the map's own ground and trees — never a
// number typed in for one seed — and the lenses planted off them. Every
// search walks a fixed grid in a fixed order, so a seed gives the same
// places on every run.
//
//   pad       the helicopter's own pad (`helipadOf`)
//   approach  the way a skier rides in to the pad: the bearing off it with
//             open snow and no trunk along 140 m, rising gently
//   meadow    open, flat, deep powder off the piste, the most room to a
//             trunk (`stage.ts`'s meadow where the map has no such place)
//   flat      the highest patch the machine can set down on: level within
//             half the slope it may land on, no crown within the disc
//   steep     a face too steep to land on, deep powder and no trees under
//             it — where the skier has to push off
//   cruise    a line from the pad toward the flat, for forward flight

import { HELI, helipadOf, treesNear, type GameState, type Helipad, type Level } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { meadow } from "./stage.ts";

export type Spot = { x: number; y: number; z: number };

export type Spots = {
  pad: Helipad;
  /** The bearing a skier rides in to the pad ALONG (from out there toward
   * it), rad, and the way out to where he starts. */
  approach: { out: number; rise: number };
  meadow: Spot;
  flat: Spot;
  steep: Spot & { slope: number };
  /** The steepest open face of loose snow to drop onto (`plunge`). */
  face: Spot & { slope: number };
};

const trunks: number[] = [];

function treeFree(level: Level, x: number, z: number, r: number): boolean {
  return treesNear(level, x, z, r, trunks).length === 0;
}

/** The bearing off the pad a skier rides in along: no trunk within 6 m of
 * any point out to 140 m, the snow rising gently toward the mountain. */
function approachOf(level: Level, pad: Helipad): { out: number; rise: number } {
  let best = { out: pad.heading + Math.PI / 2, rise: -Infinity };
  for (let k = 0; k < 24; k++) {
    const b = (k / 24) * Math.PI * 2;
    let ok = true;
    let worst = 0;
    let prev = pad.y;
    for (let d = 10; d <= 140 && ok; d += 10) {
      const x = pad.x + Math.sin(b) * d;
      const z = pad.z + Math.cos(b) * d;
      if (x < 20 || z < 20 || x > level.size - 20 || z > level.size - 20) ok = false;
      else if (!treeFree(level, x, z, 6)) ok = false;
      const y = level.groundAt(x, z);
      worst = Math.max(worst, Math.abs(y - prev) / 10);
      prev = y;
    }
    if (!ok || worst > 0.3) continue;
    const rise = Math.min(25, prev - pad.y) - worst * 20;
    if (rise > best.rise) best = { out: b, rise };
  }
  return best;
}

/** How far the snow round (x, z) stands off level within `r` m: the
 * steepest of eight spokes, as a gradient. */
function unevenness(level: Level, x: number, z: number, r: number): number {
  const y = level.groundAt(x, z);
  let most = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const dy = level.groundAt(x + Math.sin(a) * r, z + Math.cos(a) * r) - y;
    most = Math.max(most, Math.abs(dy) / r);
  }
  return most;
}

/** The highest patch the machine can set down on, well away from its pad. */
function flatOf(level: Level, pad: Helipad): Spot {
  const flatMost = Math.tan(HELI.crash.slope * 0.5);
  const clear = HELI.rotor.radius + 6;
  let best: Spot | null = null;
  const m = 80;
  for (let x = m; x <= level.size - m; x += 10) {
    for (let z = m; z <= level.size - m; z += 10) {
      if (Math.hypot(x - pad.x, z - pad.z) < 400) continue;
      const y = level.groundAt(x, z);
      if (best && y <= best.y) continue;
      if (unevenness(level, x, z, 4) > flatMost || unevenness(level, x, z, 8) > flatMost) continue;
      if (!treeFree(level, x, z, clear)) continue;
      best = { x, y, z };
    }
  }
  return best ?? { x: pad.x, y: pad.y, z: pad.z };
}

/** A face too steep to land on — 29–43°, deep powder, no trees within
 * 15 m — high on the mountain, nearest 35°. */
function steepOf(level: Level): Spot & { slope: number } {
  let best: (Spot & { slope: number; score: number }) | null = null;
  const m = 80;
  const n = { x: 0, y: 1, z: 0 };
  for (let x = m; x <= level.size - m; x += 12) {
    for (let z = m; z <= level.size - m; z += 12) {
      level.normalAt(x, z, n);
      const slope = Math.acos(Math.min(1, n.y));
      if (slope < 0.5 || slope > 0.75) continue;
      if (level.packedAt(x, z) > 0.05) continue;
      const y = level.groundAt(x, z);
      const score = y - 300 * Math.abs(slope - 0.62);
      if (best && score <= best.score) continue;
      if (!treeFree(level, x, z, 15)) continue;
      best = { x, y, z, slope, score };
    }
  }
  if (!best) {
    const c = meadow(level);
    return { x: c.x, y: level.groundAt(c.x, c.z), z: c.z, slope: 0 };
  }
  return { x: best.x, y: best.y, z: best.z, slope: best.slope };
}

/** THE STEEPEST OPEN FACE: loose snow 40–50° steep all round a 9 m disc
 * (its least slope the score), no trunk within 25 m — where a long drop
 * comes down along the fall line and is ridden away down it. */
function faceOf(level: Level): Spot & { slope: number } {
  let best: (Spot & { slope: number }) | null = null;
  const m = 80;
  const n = { x: 0, y: 1, z: 0 };
  const slopeAt = (x: number, z: number): number => {
    level.normalAt(x, z, n);
    return Math.acos(Math.min(1, n.y));
  };
  for (let x = m; x <= level.size - m; x += 10) {
    for (let z = m; z <= level.size - m; z += 10) {
      if (level.packedAt(x, z) > 0.05) continue;
      let least = slopeAt(x, z);
      for (const [dx, dz] of [
        [9, 0],
        [-9, 0],
        [0, 9],
        [0, -9],
      ]) {
        least = Math.min(least, slopeAt(x + dx, z + dz));
      }
      if (least > 0.87 || (best && least <= best.slope)) continue;
      if (!treeFree(level, x, z, 25)) continue;
      best = { x, y: level.groundAt(x, z), z, slope: least };
    }
  }
  return best ?? steepOf(level);
}

/** Open deep powder to hover over and drop into: flat within 6°, unpacked,
 * and the most room to the nearest trunk — 20 m at the least. */
function meadowOf(level: Level): Spot {
  let best: (Spot & { room: number }) | null = null;
  const flatMost = Math.tan(0.1);
  const m = 100;
  for (let x = m; x <= level.size - m; x += 16) {
    for (let z = m; z <= level.size - m; z += 16) {
      if (level.packedAt(x, z) > 0.05) continue;
      if (unevenness(level, x, z, 10) > flatMost || unevenness(level, x, z, 25) > flatMost)
        continue;
      let room = 0;
      for (const r of [20, 30, 40, 55, 70, 90]) {
        if (!treeFree(level, x, z, r)) break;
        room = r;
      }
      if (best && room <= best.room) continue;
      best = { x, y: level.groundAt(x, z), z, room };
    }
  }
  if (best) return { x: best.x, y: best.y, z: best.z };
  const c = meadow(level);
  return { x: c.x, y: level.groundAt(c.x, c.z), z: c.z };
}

export function spotsOf(level: Level): Spots {
  const pad = helipadOf(level);
  return {
    pad,
    approach: approachOf(level, pad),
    meadow: meadowOf(level),
    flat: flatOf(level, pad),
    steep: steepOf(level),
    face: faceOf(level),
  };
}

/** The machine's middle, where a lens looks at it. */
export function heliMiddle(state: GameState): Spot {
  const h = state.heli!;
  return { x: h.x, y: h.y + HELI.cog, z: h.z };
}

/** Whether a lens at (x, z) sees `at` past every trunk: none within 6 m of
 * the eye, nor within 3 m of the sightline's middle stretch. */
function clearSight(level: Level, at: Spot, x: number, z: number): boolean {
  if (!treeFree(level, x, z, 6)) return false;
  for (const k of [0.25, 0.5, 0.75]) {
    if (!treeFree(level, at.x + (x - at.x) * k, at.z + (z - at.z) * k, 3)) return false;
  }
  return true;
}

/** A LENS PLANTED OUTSIDE: `dist` m off `at` along `bearing` — or the
 * nearest bearing to it, in eighths of a turn, with no trunk in the way —
 * `up` m over the snow there (and no lower than `at` + `over`), looking at
 * `at`. */
export function outside(
  level: Level,
  at: Spot,
  bearing: number,
  dist: number,
  up = 1.7,
  over = -Infinity,
  fov = 50,
): LensPose {
  let b = bearing;
  for (const k of [0, 1, -1, 2, -2, 3, -3, 4]) {
    const t = bearing + (k * Math.PI) / 4;
    if (clearSight(level, at, at.x + Math.sin(t) * dist, at.z + Math.cos(t) * dist)) {
      b = t;
      break;
    }
  }
  const x = at.x + Math.sin(b) * dist;
  const z = at.z + Math.cos(b) * dist;
  const y = Math.max(level.groundAt(x, z) + up, at.y + over);
  return { eye: { x, y, z }, target: { ...at }, fov, roll: 0 };
}

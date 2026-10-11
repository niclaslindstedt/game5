// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIRSTRIP — where a free ride's jump plane takes off from and lands
// on: a straight rectangle of snow on the valley floor, BELOW THE TOWN (on
// the village's level or under it, beside it along the valley), laid along
// the valley and just as long as the plane needs: its own take-off roll at
// its start weight (`PLANE.strip.roll`, measured off this engine by
// `make plane-flight`) times `rollFactor`, and an overrun.
//
// A RECTANGLE SEARCH over the floor round the village (or the finish, on a
// map with none): every centre on a grid and a handful of bearings within a
// few degrees of the valley's axis (±x), each rectangle held to
//   * the map, a margin inside its edge;
//   * the snow: its grade along and across, and how far the ground stands
//     off a straight line down its length (`PLANE.strip.grade`, `.cross`,
//     `.bump`) — a flat enough strip is CHOSEN, never graded, so the map's
//     ground is never touched;
//   * what stands on the floor: no trunk inside it or its clearance; off
//     the village's ground (its streets, lots and gardens — `streetMaskAt`)
//     and its buildings, every cabin, every lift's line and stations, the
//     wind tunnels, the helipad, the snowmobile's spot and the balloon's
//     site.
// The cheapest wins: nearest the village, never above it. NOTHING ELSE
// AVOIDS THE STRIP — every other place on the map was decided before it and
// none of them asks it, so no map, village or digest moves for it. A map
// with no room for one gets the nearest it can (the rules eased, then the
// village or the finish itself, `fallback`).
//
// A pure function of the map, worked out once and kept per map; nothing
// here draws from the stream.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { balloonSiteOf } from "./balloon.ts";
import { cabinsOf } from "./cabins.ts";
import { BALLOON } from "./defs/balloon.ts";
import { HELI } from "./defs/heli.ts";
import { PLANE } from "./defs/plane.ts";
import { helipadOf } from "./heli-pad.ts";
import { liftPlans } from "./lift-line.ts";
import { sledSpotOf } from "./sled-pad.ts";
import { treesNear } from "./upright-grid.ts";
import { streetMaskAt, villageBuildingsOf } from "./village.ts";
import type { Level } from "../mapgen/types.ts";

/** A point on the strip, world frame, m. */
export type StripPoint = { x: number; y: number; z: number };

/** THE STRIP: its middle, the bearing it is taken off along (away from the
 * town), its length and width, m; where a take-off starts (a few metres in
 * from its back end) and where it ends; the bearing it is landed along, the
 * threshold a landing aims to touch down past, and how far out the final
 * approach is joined, m (shortened where the map is short of room), and
 * the side of it the landing circuit is flown on (1 right of the landing
 * bearing, −1 left); and whether no place met the rules (`fallback`). */
export type Airstrip = {
  x: number;
  y: number;
  z: number;
  heading: number;
  length: number;
  width: number;
  start: StripPoint;
  end: StripPoint;
  land: { heading: number; threshold: StripPoint; final: number; side: number };
  fallback: boolean;
};

const S = PLANE.strip;
/** The strip's whole length, m. */
export const STRIP_LENGTH = Math.round(S.roll * S.rollFactor + S.overrun);
/** The grid the floor is searched on, m; how far from the village, m; the
 * bearings tried either side of the valley's axis, rad; the margin kept
 * inside the map's edge, m. */
const STEP = 20;
const SEARCH = 1800;
const BEARINGS = [0, 0.06, -0.06, 0.12, -0.12, 0.18, -0.18];
const EDGE = 60;
/** The gaps kept from a lift's line and its stations, a tunnel's lane, a
 * building, m. */
const LINE_GAP = 18;
const STATION_GAP = 40;
const TUNNEL_GAP = 16;
const HOUSE_GAP = 22;
/** What a metre of height over the village costs the search, in metres of
 * distance from it — so the strip lies on the town's level or under it. */
const ABOVE = 25;

const strips = new WeakMap<Level, Airstrip>();
const near: number[] = [];

/** THE STRIP of `level`, worked out once. */
export function airstripOf(level: Level): Airstrip {
  let strip = strips.get(level);
  if (!strip) {
    strip = findStrip(level);
    strips.set(level, strip);
  }
  return strip;
}

/** Whether (x, z) lies on the strip's packed snow (`plane.ts` reads the
 * skis' friction off it). */
export function onStrip(level: Level, x: number, z: number): boolean {
  const s = airstripOf(level);
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  const dx = x - s.x;
  const dz = z - s.z;
  return Math.abs(dx * fx + dz * fz) <= s.length / 2 && Math.abs(dx * fz - dz * fx) <= s.width / 2;
}

type Rules = { grade: number; cross: number; bump: number; step: number; clear: number };
type Keep = { x: number; z: number; r: number };
type Found = { x: number; z: number; axis: number; cost: number };

function findStrip(level: Level): Airstrip {
  const resort = level.resort;
  const finish = level.track.points[level.track.points.length - 1];
  const village = resort ? resort.village : { x: finish.x, z: finish.z };
  const homeY = level.groundAt(village.x, village.z);
  const keep = keepOffs(level);
  const strict: Rules = {
    grade: S.grade,
    cross: S.cross,
    bump: S.bump,
    step: S.step,
    clear: S.clear,
  };
  const eased: Rules = {
    grade: S.grade * 2,
    cross: S.cross * 2,
    bump: S.bump * 2,
    step: S.step * 1.5,
    clear: 6,
  };
  const found =
    search(level, village, homeY, keep, strict) ?? search(level, village, homeY, keep, eased);
  const at = found ?? { x: village.x, z: village.z, axis: Math.PI / 2, cost: 0 };
  return build(level, at, village, !found);
}

/** Everything the strip keeps off that is a circle: the helipad, the
 * snowmobile's spot, the balloon's site, every cabin and village building
 * and every lift's bottom and top station. */
function keepOffs(level: Level): Keep[] {
  const out: Keep[] = [];
  if (level.resort) {
    const pad = helipadOf(level);
    const sled = sledSpotOf(level);
    const balloon = balloonSiteOf(level);
    out.push({ x: pad.x, z: pad.z, r: HELI.pad.radius + 20 });
    out.push({ x: sled.x, z: sled.z, r: 20 });
    out.push({ x: balloon.x, z: balloon.z, r: BALLOON.site.room + 20 });
  }
  for (const c of cabinsOf(level)) out.push({ x: c.x, z: c.z, r: HOUSE_GAP });
  for (const b of villageBuildingsOf(level)) out.push({ x: b.x, z: b.z, r: HOUSE_GAP });
  for (const p of liftPlans(level)) {
    out.push({ x: p.lift.bottom.x, z: p.lift.bottom.z, r: STATION_GAP });
    out.push({ x: p.lift.top.x, z: p.lift.top.z, r: STATION_GAP });
  }
  return out;
}

function search(
  level: Level,
  village: { x: number; z: number },
  homeY: number,
  keep: readonly Keep[],
  rules: Rules,
): Found | null {
  const half = STRIP_LENGTH / 2;
  let best: Found | null = null;
  for (let dz = -SEARCH; dz <= SEARCH; dz += STEP) {
    for (let dx = -SEARCH; dx <= SEARCH; dx += STEP) {
      const x = village.x + dx;
      const z = village.z + dz;
      if (x < EDGE + half || x > level.size - EDGE - half) continue;
      if (z < EDGE + half || z > level.size - EDGE - half) continue;
      const d = hypot(dx, dz);
      if (best && d >= best.cost) continue;
      const y = level.groundAt(x, z);
      const cost = d + ABOVE * Math.max(0, y - homeY);
      if (best && cost >= best.cost) continue;
      for (const b of BEARINGS) {
        const axis = Math.PI / 2 + b;
        if (!flatEnough(level, x, z, axis, rules)) continue;
        if (!clearOf(level, x, z, axis, rules, keep)) continue;
        best = { x, z, axis, cost };
        break;
      }
    }
  }
  return best;
}

/** The snow along the rectangle: the grade end to end, the cross slope at
 * five stations, and the most the ground stands off the straight line. */
/** How far apart the centre line's grade is read, m. */
const STEP_ALONG = 5;

function flatEnough(level: Level, x: number, z: number, axis: number, r: Rules): boolean {
  const fx = Math.sin(axis);
  const fz = Math.cos(axis);
  const half = STRIP_LENGTH / 2;
  const w = S.width / 2;
  const a = level.groundAt(x - fx * half, z - fz * half);
  const b = level.groundAt(x + fx * half, z + fz * half);
  const mean = (b - a) / STRIP_LENGTH;
  if (Math.abs(mean) > r.grade) return false;
  // No step or lip along the centre line: every few metres the snow's own
  // grade stays near the strip's (a terrace edge would throw the plane off
  // the snow far short of flying speed).
  let last = a;
  for (let s = STEP_ALONG; s <= STRIP_LENGTH; s += STEP_ALONG) {
    const h = level.groundAt(x + fx * (s - half), z + fz * (s - half));
    if (Math.abs((h - last) / STEP_ALONG - mean) > r.step) return false;
    last = h;
  }
  for (let i = 0; i <= 20; i++) {
    const s = -half + (i / 20) * STRIP_LENGTH;
    const px = x + fx * s;
    const pz = z + fz * s;
    const line = a + ((b - a) * (s + half)) / STRIP_LENGTH;
    if (Math.abs(level.groundAt(px, pz) - line) > r.bump) return false;
    if (i % 5 === 0) {
      const l = level.groundAt(px - fz * w, pz + fx * w);
      const rr = level.groundAt(px + fz * w, pz - fx * w);
      if (Math.abs(l - rr) / (2 * w) > r.cross) return false;
    }
  }
  return true;
}

/** Nothing on the rectangle or its clearance: the village's ground, a
 * trunk, a kept-off circle, a lift's line, a tunnel's lane. */
function clearOf(
  level: Level,
  x: number,
  z: number,
  axis: number,
  r: Rules,
  keep: readonly Keep[],
): boolean {
  const fx = Math.sin(axis);
  const fz = Math.cos(axis);
  const half = STRIP_LENGTH / 2;
  const w = S.width / 2 + r.clear;
  const n = Math.ceil(STRIP_LENGTH / 10);
  for (let i = 0; i <= n; i++) {
    const s = -half + (i / n) * STRIP_LENGTH;
    for (const side of [-w, 0, w]) {
      const px = x + fx * s + fz * side;
      const pz = z + fz * s - fx * side;
      if (streetMaskAt(level, px, pz) !== 0) return false;
      for (const k of keep) if (hypot(k.x - px, k.z - pz) < k.r) return false;
    }
  }
  for (let s = -half; s <= half; s += w) {
    if (treesNear(level, x + fx * s, z + fz * s, w * 1.12, near).length > 0) return false;
  }
  for (const p of liftPlans(level)) {
    for (const s of [-half, -half / 2, 0, half / 2, half]) {
      const rx = x + fx * s - p.lift.bottom.x;
      const rz = z + fz * s - p.lift.bottom.z;
      const u = rx * p.dx + rz * p.dz;
      const v = rx * p.dz - rz * p.dx;
      if (u > -w && u < p.length + w && Math.abs(v) < LINE_GAP + w) return false;
    }
    if (crosses(x, z, fx, fz, half, p)) return false;
  }
  for (const t of level.resort?.tunnels ?? []) {
    for (const q of t.points) {
      const rx = q.x - x;
      const rz = q.z - z;
      const along = rx * fx + rz * fz;
      const across = rx * fz - rz * fx;
      if (Math.abs(along) < half + TUNNEL_GAP && Math.abs(across) < w + TUNNEL_GAP + t.width / 2) {
        return false;
      }
    }
  }
  return true;
}

/** Whether the strip's centre line crosses a lift's line in plan. */
function crosses(
  x: number,
  z: number,
  fx: number,
  fz: number,
  half: number,
  p: { lift: { bottom: { x: number; z: number } }; dx: number; dz: number; length: number },
): boolean {
  const ax = x - fx * half - p.lift.bottom.x;
  const az = z - fz * half - p.lift.bottom.z;
  const den = fx * p.dz - fz * p.dx;
  if (Math.abs(den) < 1e-6) return false;
  // a + t·f = u·d, solved for the strip's t and the line's u.
  const t = (p.dx * az - p.dz * ax) / den;
  const u = (fx * az - fz * ax) / den;
  return t >= 0 && t <= 2 * half && u >= 0 && u <= p.length;
}

/** The strip worked out round the rectangle found: taken off away from the
 * town; landed the way whose final approach lies furthest inside the map. */
function build(
  level: Level,
  at: Found,
  village: { x: number; z: number },
  fallback: boolean,
): Airstrip {
  const half = STRIP_LENGTH / 2;
  const fx = Math.sin(at.axis);
  const fz = Math.cos(at.axis);
  const away = (at.x - village.x) * fx + (at.z - village.z) * fz;
  const sign = away >= 0 ? 1 : -1;
  const heading = sign > 0 ? at.axis : at.axis - Math.PI;
  const hx = fx * sign;
  const hz = fz * sign;
  const point = (s: number): StripPoint => {
    const px = at.x + hx * s;
    const pz = at.z + hz * s;
    return { x: px, y: level.groundAt(px, pz), z: pz };
  };
  // The landing circuit flies under the airborne bounds' height, kept only
  // off the map's very edge.
  const band = PLANE.pilot.edge;
  // Each way it could be landed: the final gate's room inside the map.
  const ways = [1, -1].map((dir) => {
    const lx = hx * dir;
    const lz = hz * dir;
    // The threshold is the end the landing comes in over.
    const tx = at.x - lx * (half - 30);
    const tz = at.z - lz * (half - 30);
    let final = PLANE.pilot.final;
    const room = (gx: number, gz: number): number =>
      Math.min(gx, gz, level.size - gx, level.size - gz) - band;
    // The final gate and the base turn beyond it, inside the band.
    const inside = (d: number): number =>
      room(tx - lx * (d + PLANE.pilot.circuit), tz - lz * (d + PLANE.pilot.circuit));
    while (final > 500 && inside(final) < 0) final -= 50;
    // The circuit flown on the side of the strip with more room.
    const right = room(tx + lz * 2 * PLANE.pilot.circuit, tz - lx * 2 * PLANE.pilot.circuit);
    const left = room(tx - lz * 2 * PLANE.pilot.circuit, tz + lx * 2 * PLANE.pilot.circuit);
    return { dir, tx, tz, final, room: inside(final), side: right >= left ? 1 : -1 };
  });
  const way = ways[0].room >= ways[1].room - 1 ? ways[0] : ways[1];
  const landHeading = way.dir > 0 ? heading : heading - Math.PI;
  return {
    x: at.x,
    y: level.groundAt(at.x, at.z),
    z: at.z,
    heading: wrap(heading),
    length: STRIP_LENGTH,
    width: S.width,
    start: point(-half + 15),
    end: point(half),
    land: {
      heading: wrap(landHeading),
      threshold: { x: way.tx, y: level.groundAt(way.tx, way.tz), z: way.tz },
      final: way.final,
      side: way.side,
    },
    fallback,
  };
}

function wrap(a: number): number {
  let h = a;
  while (h > Math.PI) h -= 2 * Math.PI;
  while (h <= -Math.PI) h += 2 * Math.PI;
  return h;
}

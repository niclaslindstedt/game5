// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIRSTRIP — where a free ride's jump plane takes off from and lands
// on: a straight rectangle of snow on the valley floor, BELOW THE TOWN (on
// the village's level or under it, beside it along the valley), laid along
// the valley and just as long as the plane needs: its own take-off roll at
// its start weight (`PLANE.strip.roll`, measured off this engine by
// `make plane-flight`) times `rollFactor`, and an overrun.
//
// A RECTANGLE SEARCH over the whole floor, nearest the village (or the
// finish, on a map with none) first: every centre on a grid and every
// bearing round the half circle, each rectangle held to
//   * the map, a margin inside its edge;
//   * the snow: its grade along and across, and how far the ground stands
//     off a straight line down its length (`PLANE.strip.grade`, `.cross`,
//     `.bump`) — a flat enough strip is CHOSEN, never graded, so the map's
//     ground is never touched;
//   * ROOM: its whole centre line half its width and its clearance off
//     everything the floor carries (`airstrip-room.ts`'s field): every
//     building by its own footprint and the village's streets, every run,
//     lane and route by its own width and the hub, every lift's line and
//     stations, the wind tunnels, the helipad, the snowmobile's spot and
//     the balloon's site, every trunk, every lake and stream.
// The cheapest wins: nearest the village, never above it, along the
// valley's axis where it fits (a bearing off it costs a little), the air
// off its ends clear. NOTHING ELSE AVOIDS THE STRIP — every other place on
// the map was decided before it and none of them asks it, so no map,
// village or digest moves for it. A map with no room under the rules gets
// the nearest under rules eased twice over (`fallback`), and only a map
// with none at all the village itself.
//
// A pure function of the map, worked out once and kept per map; nothing
// here draws from the stream.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { balloonSiteOf } from "./balloon-site.ts";
import { cabinsOf } from "./cabins.ts";
import { BALLOON } from "./defs/balloon.ts";
import { HELI } from "./defs/heli.ts";
import { PLANE } from "./defs/plane.ts";
import { helipadOf } from "./heli-pad.ts";
import { liftPlans } from "./lift-line.ts";
import { sledSpotOf } from "./sled-pad.ts";
import { treesNear } from "./upright-grid.ts";
import { corridorIntrusion } from "./airstrip-corridor.ts";
import { stripRoomAt } from "./airstrip-room.ts";
import { villageBuildingsOf } from "./village.ts";
import type { Level } from "../mapgen/types.ts";

/** A point on the strip, world frame, m. */
export type StripPoint = { x: number; y: number; z: number };

/** THE STRIP: its middle, the bearing it is taken off along (away from the
 * town), its length and width, m; where a take-off starts (a few metres in
 * from its back end) and where it ends; the bearing it is landed along, the
 * threshold a landing aims to touch down past, and how far out the final
 * approach is joined, m (shortened where the map is short of room), and
 * the side of it the landing circuit is flown on (1 right of the landing
 * bearing, −1 left); and whether no place met the rules (`fallback`) —
 * which rules the place found met (`tier`: the strict, the eased, the
 * loose, or none and the strip laid on the village). */
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
  tier: StripTier;
  /** The clearance kept either side of its packed edge, m: what its
   * search held everything off and fells the trees over
   * (`airstrip-site.ts`'s `stripFelled`). */
  clear: number;
};

/** Which rules a strip was found under (`airstrip.ts`'s search). */
export type StripTier = "strict" | "eased" | "loose" | "village";

const S = PLANE.strip;
/** The strip's whole length, m. */
export const STRIP_LENGTH = Math.round(S.roll * S.rollFactor + S.overrun);
/** The grid the floor is searched on, m; how far from the village, m; the
 * bearings tried either side of the valley's axis, rad; the margin kept
 * inside the map's edge, m. */
const STEP = 20;
const BEARINGS = Array.from({ length: 36 }, (_, k) => ((k < 18 ? k : 17 - k) * Math.PI) / 36);
const EDGE = 60;
/** The gaps the site's buildings keep from a lift's stations and from a
 * building, m (`keepOffs`). */
const STATION_GAP = 40;
const HOUSE_GAP = 22;
/** What a radian of the strip's bearing off the valley's axis costs the
 * search, in metres of distance from the town — so it lies along the
 * valley where the valley has room, and turns where only that fits. */
const TURN = 300;
/** What a trunk felled for the strip and its clearance costs the search,
 * in metres of distance from the town — so a clearing is cut only where
 * the open floor is far, and through the thinnest wood. */
const FELL = 12;
/** How far apart the room is read down the centre line, m (the room
 * field's own cell, `STRIP_ROOM.cell`). */
const ROOM_STEP = 4;
/** What a metre of height over the village costs the search, in metres of
 * distance from it — so the strip lies on the town's level or under it. */
const ABOVE = 25;
/** What a unit of a rope or a pad standing into the air off its ends costs
 * the search (`corridorIntrusion`), in metres of distance from the town —
 * a rope across the final moves the strip a few hundred metres. */
const AIR = 120;

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
/** A circle the strip and its buildings keep off, m. */
export type Keep = { x: number; z: number; r: number };
type Found = { x: number; z: number; axis: number; cost: number };

function findStrip(level: Level): Airstrip {
  const resort = level.resort;
  const finish = level.track.points[level.track.points.length - 1];
  const village = resort ? resort.village : { x: finish.x, z: finish.z };
  const homeY = level.groundAt(village.x, village.z);
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
  const loose: Rules = {
    grade: S.grade * 3,
    cross: S.cross * 3,
    bump: S.bump * 3,
    step: S.step * 2,
    clear: 2,
  };
  const offsets = offsetsOf(level, village);
  const tiers = [
    ["strict", strict],
    ["eased", eased],
    ["loose", loose],
  ] as const;
  for (const [tier, rules] of tiers) {
    const found = search(level, village, homeY, offsets, rules);
    if (found) return build(level, found, village, tier, rules.clear);
  }
  const home = { x: village.x, z: village.z, axis: Math.PI / 2, cost: 0 };
  return build(level, home, village, "village", 0);
}

/** Everything the strip's site keeps off that is a circle: the helipad,
 * the snowmobile's spot, the balloon's site, every cabin and village
 * building and every lift's bottom and top station (`airstrip-site.ts`;
 * the strip itself reads all of it, and the runs, the hub and the water
 * besides, off `stripRoomAt`). */
export function keepOffs(level: Level): Keep[] {
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

/** Every centre on the search's grid inside the map, nearest the village
 * first, with its distance from it. */
function offsetsOf(level: Level, village: { x: number; z: number }): Float64Array {
  const pts: [number, number, number][] = [];
  const reach = Math.ceil(level.size / STEP);
  for (let j = -reach; j <= reach; j++) {
    for (let i = -reach; i <= reach; i++) {
      const x = village.x + i * STEP;
      const z = village.z + j * STEP;
      if (x < EDGE || z < EDGE || x > level.size - EDGE || z > level.size - EDGE) continue;
      pts.push([x, z, hypot(i * STEP, j * STEP)]);
    }
  }
  pts.sort((a, b) => a[2] - b[2]);
  const out = new Float64Array(pts.length * 3);
  pts.forEach((p, k) => out.set(p, k * 3));
  return out;
}

function search(
  level: Level,
  village: { x: number; z: number },
  homeY: number,
  offsets: Float64Array,
  rules: Rules,
): Found | null {
  const half = STRIP_LENGTH / 2;
  const need = S.width / 2 + rules.clear;
  const inMap = (x: number, z: number): boolean =>
    x >= EDGE && z >= EDGE && x <= level.size - EDGE && z <= level.size - EDGE;
  let best: Found | null = null;
  for (let k = 0; k < offsets.length; k += 3) {
    const x = offsets[k];
    const z = offsets[k + 1];
    const d = offsets[k + 2];
    // Nearest first: nothing further on can be cheaper.
    if (best && d >= best.cost) break;
    if (stripRoomAt(level, x, z) < need) continue;
    const y = level.groundAt(x, z);
    const cost = d + ABOVE * Math.max(0, y - homeY);
    if (best && cost >= best.cost) continue;
    for (const b of BEARINGS) {
      const turned = cost + TURN * Math.abs(b);
      if (best && turned >= best.cost) continue;
      const axis = Math.PI / 2 + b;
      const fx = Math.sin(axis);
      const fz = Math.cos(axis);
      if (!inMap(x - fx * half, z - fz * half) || !inMap(x + fx * half, z + fz * half)) continue;
      if (!roomy(level, x, z, fx, fz, need)) continue;
      if (!flatEnough(level, x, z, axis, rules)) continue;
      const cut: number =
        turned + FELL * trunksOn(level, x, z, fx, fz, need, best ? best.cost - turned : Infinity);
      if (best && cut >= best.cost) continue;
      // The air off its ends: the climb-out away from the town, and the
      // clearer of the two ways in.
      const air: number = cut + AIR * airOf(level, x, z, axis, village);
      if (!best || air < best.cost) best = { x, z, axis, cost: air };
    }
  }
  return best;
}

/** How many trunks stand within `need` m of a centre line (counted no
 * further than past `most`'s worth). */
function trunksOn(
  level: Level,
  x: number,
  z: number,
  fx: number,
  fz: number,
  need: number,
  most: number,
): number {
  const half = STRIP_LENGTH / 2;
  const seen = new Set<number>();
  for (let s = -half; s <= half + need; s += need) {
    const a = Math.min(s, half);
    for (const i of treesNear(level, x + fx * a, z + fz * a, need * 1.5, near)) {
      if (seen.has(i)) continue;
      const t = level.trees[i];
      if (offLine(t.x - x, t.z - z, fx, fz) <= need) seen.add(i);
    }
    if (seen.size * FELL >= most) break;
  }
  return seen.size;
}

/** How far (dx, dz) off a strip's middle is from its centre line's
 * segment, m. */
function offLine(dx: number, dz: number, fx: number, fz: number): number {
  const half = STRIP_LENGTH / 2;
  const along = Math.max(-half, Math.min(half, dx * fx + dz * fz));
  return hypot(dx - fx * along, dz - fz * along);
}

/** Whether the strip's whole centre line, end to end, stands `need` m or
 * more off everything it keeps off (`stripRoomAt`). */
function roomy(level: Level, x: number, z: number, fx: number, fz: number, need: number): boolean {
  const half = STRIP_LENGTH / 2;
  // The ends first: most rectangles that fail, fail there.
  if (stripRoomAt(level, x - fx * half, z - fz * half) < need) return false;
  if (stripRoomAt(level, x + fx * half, z + fz * half) < need) return false;
  for (let s = -half; s <= half; s += ROOM_STEP) {
    if (stripRoomAt(level, x + fx * s, z + fz * s) < need) return false;
  }
  return true;
}

/** The ends of a rectangle and the way it is taken off (away from the
 * town): the back end's and the far end's points and the take-off's unit. */
function endsOf(
  level: Level,
  x: number,
  z: number,
  axis: number,
  village: { x: number; z: number },
): { back: StripPoint; far: StripPoint; hx: number; hz: number } {
  const fx = Math.sin(axis);
  const fz = Math.cos(axis);
  const sign = (x - village.x) * fx + (z - village.z) * fz >= 0 ? 1 : -1;
  const hx = fx * sign;
  const hz = fz * sign;
  const half = STRIP_LENGTH / 2;
  const at = (s: number): StripPoint => {
    const px = x + hx * s;
    const pz = z + hz * s;
    return { x: px, y: level.groundAt(px, pz), z: pz };
  };
  return { back: at(-half), far: at(half), hx, hz };
}

/** How much stands into the air off a rectangle's ends: the climb-out
 * past its far end, and the clearer way in (over the back end, landed the
 * way it is taken off; or over the far end, the other way). */
function airOf(
  level: Level,
  x: number,
  z: number,
  axis: number,
  village: { x: number; z: number },
): number {
  const e = endsOf(level, x, z, axis, village);
  const out = corridorIntrusion(level, e.far.x, e.far.y, e.far.z, e.hx, e.hz);
  const back = corridorIntrusion(level, e.back.x, e.back.y, e.back.z, -e.hx, -e.hz);
  return out + Math.min(out, back);
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

/** The strip worked out round the rectangle found: taken off away from the
 * town; landed the way whose final approach lies furthest inside the map. */
function build(
  level: Level,
  at: Found,
  village: { x: number; z: number },
  tier: StripTier,
  clear: number,
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
    // The air the final comes in through, off the end it comes in over.
    const end = point(-dir * half);
    const air = corridorIntrusion(level, end.x, end.y, end.z, -lx, -lz);
    return { dir, tx, tz, final, room: inside(final), side: right >= left ? 1 : -1, air };
  });
  // The clearer way in where both fit the map (or neither does), else the
  // one with room.
  const fits = (w: (typeof ways)[number]): boolean => w.room >= 0;
  const [a, b] = ways;
  const way =
    fits(a) === fits(b)
      ? Math.abs(a.air - b.air) > 0.5
        ? a.air < b.air
          ? a
          : b
        : a.room >= b.room - 1
          ? a
          : b
      : fits(a)
        ? a
        : b;
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
    fallback: tier === "loose" || tier === "village",
    tier,
    clear,
  };
}

function wrap(a: number): number {
  let h = a;
  while (h > Math.PI) h -= 2 * Math.PI;
  while (h <= -Math.PI) h += 2 * Math.PI;
  return h;
}

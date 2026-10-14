// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT IS DRAWN ON THE SNOW, MADE SOLID — the app's source for the
// engine's `setDrawnSolids` (`engine/game/drawn-solids.ts`): every piece
// the drawing stands on the ground that the engine does not already meet,
// laid out of the very plans the drawing is built from, as posts:
//
//   * A LIFT'S STATION HOUSES (`stationHouses`, drawn by `station-build.ts`)
//     as a ring of posts round each box, and the booths, the drag huts, the
//     wind masts, the gondola platform roofs' columns and the piste map
//     boards (`layStations`).
//   * EVERY SIGN'S POST down the runs, at the tops and at the bike trails'
//     heads (`run-sign-plan.ts`, `bike-sign-plan.ts`), and the locals'
//     homemade boards at a ski route's head (`route-sign-plan.ts`).
//   * A WIND TUNNEL'S ARCHES, a foot either side of the lane
//     (`wind-tunnel-plan.ts`).
//   * A FIRE'S BENCHES, STUMPS AND WOODPILE (`fire-plan.ts`); its hearth is
//     the engine's own (`fire-burn.ts`).
//
// A pure function of the map, three-free and DOM-free. Registered at
// import, so whatever builds a run in the app imports this first
// (`App.tsx`, `renderer.ts`).

import {
  firesOf,
  liftPlans,
  setDrawnSolids,
  stationHouses,
  type Level,
  type Stuff,
  type Upright,
} from "@engine";

import { bikeSigns } from "./bike-sign-plan.ts";
import { fireLayouts, type LogPiece } from "./fire-plan.ts";
import { AMATEUR, amateurSigns } from "./route-sign-plan.ts";
import { signPlan, summitSigns, type SignPost } from "./run-sign-plan.ts";
import { BOARD_FACE } from "./map-board.ts";
import { layStations, type Part } from "./station-plan.ts";
import {
  TUNNEL_LOOK,
  archRadius,
  marksAlong,
  tunnelPointAt,
  tunnelsOf,
} from "./wind-tunnel-plan.ts";

/** A wall's posts: their radius and the most between their middles, m —
 * close enough that nothing a body is passes between two. */
const WALL = { radius: 0.35, gap: 0.5 };

/** How far over the snow a post's top must stand to be met at all, m. */
const LOW = 0.1;

/** Posts from (ax, az) to (bx, bz), their outer faces on the line's ends,
 * no further apart than `gap`. */
function row(
  out: Upright[],
  ax: number,
  az: number,
  bx: number,
  bz: number,
  y: number,
  height: number,
  radius: number,
  stuff: Stuff,
  gap = Math.max(0.1, radius * 1.4),
): void {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(len / gap));
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    out.push({ x: ax + (bx - ax) * f, z: az + (bz - az) * f, y, height, radius, stuff });
  }
}

/** A box `hw` across and `hl` along heading `h` round (x, z), its walls as
 * rows of posts set in by their radius. */
function box(
  out: Upright[],
  x: number,
  z: number,
  h: number,
  hw: number,
  hl: number,
  y: number,
  top: number,
  stuff: Stuff,
  ends = true,
): void {
  const r = Math.min(WALL.radius, hw, hl);
  // +z along (sin h, cos h); +x across, to its right (cos h, −sin h).
  const fx = Math.sin(h);
  const fz = Math.cos(h);
  const at = (u: number, v: number): [number, number] => [x + fz * u + fx * v, z - fx * u + fz * v];
  const a = at(-(hw - r), -(hl - r));
  const b = at(hw - r, -(hl - r));
  const c = at(hw - r, hl - r);
  const d = at(-(hw - r), hl - r);
  // a–b and c–d are its ends (across), b–c and d–a its sides (along).
  const walls = ends
    ? [
        [a, b],
        [b, c],
        [c, d],
        [d, a],
      ]
    : [
        [b, c],
        [d, a],
      ];
  for (const [p, q] of walls) {
    row(out, p[0], p[1], q[0], q[1], y, top - y, r, stuff, WALL.gap);
  }
}

/** A piece of a station off its plan (`station-build.ts`' sizes). */
function stationPart(out: Upright[], level: Level, p: Part): void {
  const ground = level.groundAt(p.x, p.z);
  switch (p.kind) {
    case "booth":
      return box(out, p.x, p.z, p.yaw, 1.25, 1.25, ground - 0.3, ground + 2.5, "steel");
    case "hut":
      return box(out, p.x, p.z, p.yaw, 1.15, 1.15, ground - 0.3, ground + 3, "log");
    case "mast":
      out.push({ x: p.x, z: p.z, y: ground, height: 9.2, radius: 0.1, stuff: "steel" });
      return;
    case "board": {
      // Two posts and the face hung between them from `foot` up
      // (`map-board.ts`): a wall across the parting of the way off.
      const w = BOARD_FACE.width / 2 + 0.14;
      const fx = Math.sin(p.yaw);
      const fz = Math.cos(p.yaw);
      const top = BOARD_FACE.foot + BOARD_FACE.height + 0.45;
      row(
        out,
        p.x - fz * w,
        p.z + fx * w,
        p.x + fz * w,
        p.z - fx * w,
        ground,
        top,
        0.12,
        "log",
        0.2,
      );
      return;
    }
    case "canopy": {
      // The platform roof's four columns (`platformRoof`).
      const hw = p.size / 2 + 0.6 - 0.4;
      const hl = 6.5 - 0.6;
      const fx = Math.sin(p.yaw);
      const fz = Math.cos(p.yaw);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const x = p.x + fz * sx * hw + fx * sz * hl;
          const z = p.z - fx * sx * hw + fz * sz * hl;
          const y = level.groundAt(x, z);
          out.push({ x, z, y, height: p.y + 1.3 - y, radius: 0.18, stuff: "steel" });
        }
      }
      return;
    }
    default:
      // The hood over the line and the load line and the hall's door the
      // rider passes through: nothing to stand in his way.
      return;
  }
}

/** A sign's post, as tall as its top board. */
function signPost(out: Upright[], s: SignPost): void {
  let top = 1.5;
  for (const b of s.boards) top = Math.max(top, b.y + b.height + 0.1);
  out.push({ x: s.x, z: s.z, y: s.y, height: top, radius: 0.07, stuff: "log" });
}

/** A log lying or standing (a stump, a split log of the pile), as posts
 * down its length in plan. */
function logOf(out: Upright[], level: Level, g: LogPiece): void {
  const half = g.length / 2;
  const ax = g.x - g.dx * half;
  const az = g.z - g.dz * half;
  const bx = g.x + g.dx * half;
  const bz = g.z + g.dz * half;
  const top = g.y + Math.abs(g.dy) * half + g.radius;
  const y = Math.min(level.groundAt(g.x, g.z), g.y - Math.abs(g.dy) * half - g.radius);
  row(out, ax, az, bx, bz, y, top - y, g.radius, "log");
}

/** EVERYTHING DRAWN ON `level`'s SNOW THAT THE ENGINE DOES NOT ALREADY MEET,
 * as posts. */
export function drawnSolids(level: Level): Upright[] {
  const out: Upright[] = [];
  const plans = liftPlans(level);
  for (const p of plans) {
    // A gondola's hall is walked through along the line, from the queue
    // to the platform and off it: its sides alone stand.
    const ends = p.lift.kind !== "gondola";
    for (const h of stationHouses(level, p)) {
      box(out, h.x, h.z, p.heading, h.halfWidth, h.halfLength, h.base, h.top, "log", ends);
    }
  }
  for (const part of layStations(level, plans).parts) stationPart(out, level, part);
  for (const s of [...signPlan(level), ...summitSigns(level), ...bikeSigns(level)]) {
    signPost(out, s);
  }
  for (const s of amateurSigns(level)) {
    out.push({ x: s.x, z: s.z, y: s.y, height: AMATEUR.stick.height, radius: 0.05, stuff: "log" });
  }
  for (const t of tunnelsOf(level)) {
    const r = archRadius(t);
    for (const s of marksAlong(t.length, TUNNEL_LOOK.archEvery, 0, true)) {
      const at = tunnelPointAt(t, s);
      const ax = Math.cos(at.heading);
      const az = -Math.sin(at.heading);
      for (const side of [-1, 1]) {
        const x = at.x + ax * r * side;
        const z = at.z + az * r * side;
        out.push({ x, z, y: level.groundAt(x, z), height: r, radius: 0.12, stuff: "steel" });
      }
    }
  }
  for (const f of fireLayouts(level, firesOf(level))) {
    // The hearth's own lay burns (`fire-burn.ts`); the benches' stumps and
    // the woodpile stand round it.
    const clear = f.embers + 0.3;
    for (const g of f.logs) {
      if (Math.hypot(g.x - f.fire.x, g.z - f.fire.z) > clear) logOf(out, level, g);
    }
    for (const s of f.seats) {
      const fx = Math.sin(s.heading) * (s.length / 2);
      const fz = Math.cos(s.heading) * (s.length / 2);
      const y = level.groundAt(s.x, s.z);
      row(out, s.x - fx, s.z - fz, s.x + fx, s.z + fz, y, s.y - y, s.radius, "log");
    }
  }
  // Every post footed in the snow under it, its top where it was (a row laid
  // off one height stands a little off the ground on a slope), and one
  // standing no higher than the snow is nothing to meet.
  const kept: Upright[] = [];
  for (const s of out) {
    const g = level.groundAt(s.x, s.z);
    if (s.y + s.height < g + LOW) continue;
    const y = Math.min(s.y, g - 0.1);
    kept.push(y === s.y ? s : { ...s, y, height: s.height + s.y - y });
  }
  return kept;
}

setDrawnSolids(drawnSolids);

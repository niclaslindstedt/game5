// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR ON THE SKIER — the aerodynamic force on his body, summed with
// every other force in `skier.ts`.
//
// QUADRATIC DRAG AGAINST THE AIR, NOT THE GROUND. The force is ½ρ|a| times
// the drag area times a, where a is his velocity less the air's where he is
// (`wind.ts`'s `airAt`; in a wind tunnel the tunnel's own air, the weather
// shut out — `wind-tunnel.ts`). So a headwind adds to what holds him back
// and lowers his terminal speed, a tailwind takes from it and, faster than
// him, pushes him on, and a wind across him pushes him sideways. A downhill
// run measured against a wind model loses a fifth of its time to a head-on
// breeze, and a light tailwind gains back a little — which is the size of
// what this does.
//
// TWO AREAS, NOT ONE. The body shows the air a different area face-on and
// side-on (`TUNING.wind.sideUpright`, `.sideTuck`), so the air past him is
// split along his heading and across it and each part drags on its own
// area; the vertical takes the frontal, as it always has. That is why a
// crosswind on a tucked skier — whose profile is long — pushes harder than
// the same wind on him stood up, and why the drag barely moves at a small
// yaw while the side force climbs with it, as wind-tunnel work on skiers
// finds. A SNOWBOARDER rides side-on, so his two areas trade places: the
// air along the board meets his side and the air across it his front.
//
// WHERE IT ACTS. On the CoG: a standing body's side area centres within a
// hand's breadth of its centre of gravity, so a crosswind's roll moment is
// small and the skier answers it by LEANING INTO the wind, which is what
// `side` is handed back for — `skier.ts` stands the inclination on the
// edges' share of the lateral load (the bend's pull less the wind's), and
// lets the wind across a turn widen or tighten the line the grip can hold.
// What it costs the skier in yaw is the path: the edges hold him to their
// line against the push, and past their grip the path drifts downwind and
// the nose follows it.

import { washAt, type Wash } from "./heli-wash.ts";
import { hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";

import { TUNING } from "./defs/tuning.ts";
import type { SkiSpec } from "./defs/skis.ts";
import type { GameState, SkierState } from "./state.ts";
import { BODY_HEIGHT, airAt, type Wind } from "./wind.ts";
import { tunnelBlow, tunnelWind } from "./wind-tunnel.ts";

/** The body's frontal drag area at `crouch` 0..1, m². */
export function dragAreaOf(spec: SkiSpec, crouch: number): number {
  return spec.cdAUpright + (spec.cdATuck - spec.cdAUpright) * Math.min(1, Math.max(0, crouch));
}

/** The body's SIDE-ON drag area at `crouch` 0..1, m² — the frontal at the
 * same crouch times the side's share of it (`TUNING.wind`). A snowboarder
 * stands across his board, so the wind across it meets his chest or his
 * back: his own area to it (`BoardFit.across`), as his frontal one is his
 * side silhouette. */
export function sideAreaOf(spec: SkiSpec, crouch: number): number {
  const k = Math.min(1, Math.max(0, crouch));
  const across = spec.board?.across;
  if (across) return across.upright + (across.crouch - across.upright) * k;
  const W = TUNING.wind;
  return dragAreaOf(spec, k) * (W.sideUpright + (W.sideTuck - W.sideUpright) * k);
}

/** The air's force on a skier, N, world frame, and what of it is across
 * him. */
export type AirForce = {
  x: number;
  y: number;
  z: number;
  /** The force across him toward his right (the heading's clockwise side,
   * `edge`'s right) as an acceleration of the whole skier, m/s². */
  side: number;
};

const AIR: Wind = { x: 0, z: 0, speed: 0, gust: 0 };
const WASH: Wash = { x: 0, y: 0, z: 0 };

/** THE AIR ON `c` this step, of mass `m`: the drag against the air where he
 * is — the weather's, a helicopter's wash over it — and in a wind tunnel its
 * blowers' thrust and hold (R30). */
export function airForce(state: GameState, c: SkierState, m: number, out: AirForce): AirForce {
  const level = state.level;
  const tunnels = level.resort?.tunnels;
  // The air: in a tunnel the tunnel's, out of it the weather's at his body.
  const w = c.tunnel ? tunnelWind(c, tunnels) : airAt(level, state.t, c.x, c.z, BODY_HEIGHT, AIR);
  // ...and a helicopter's rotor wash over it, near one (`heli-wash.ts`).
  const wash = washAt(level, state.heli, c.x, c.y, c.z, WASH);
  const ax = c.vx - w.x - wash.x;
  const ay = c.vy - wash.y;
  const az = c.vz - w.z - wash.z;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  // Along his heading and across it to his right (cos h, −sin h).
  const along = ax * fx + az * fz;
  const across = ax * fz - az * fx;
  const half = 0.5 * TUNING.airDensity * hypot3(ax, ay, az);
  // ...less what a racer close ahead takes off it in a ski-cross heat.
  const front = half * dragAreaOf(c.spec, c.crouch) * (1 - (c.draft ?? 0));
  const side = half * sideAreaOf(c.spec, c.crouch);
  const fAlong = -front * along;
  const fAcross = -side * across;
  const blow = tunnelBlow(c, tunnels);
  out.x = fAlong * fx + fAcross * fz + m * blow.x;
  out.y = -front * ay;
  out.z = fAlong * fz - fAcross * fx + m * blow.z;
  out.side = fAcross / m;
  return out;
}

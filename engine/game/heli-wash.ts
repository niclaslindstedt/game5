// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROTOR'S WASH — the air a hovering helicopter's rotor drives down
// through its disc and out along the snow, as a pure function of where the
// helicopter is and what it is lifting (`HeliState.thrust`). The skier's
// drag is against it like any other air (`air.ts`), so a skier standing by
// a machine lifting off is shoved off the pad, and the renderer reads the
// same field to blow the snow (`heli-view.ts`).
//
// MOMENTUM THEORY says a disc of area A lifting T in air of density ρ
// drives its flow down through itself at the induced velocity
// v_i = √(T / 2ρA), and on to twice that in the far wake. Over the snow
// the column turns and spreads radially as a thin OUTWASH WALL JET whose
// peak — measured round light helicopters at 1.7–2.1 v_i — stands about
// `HELI.wash.core` rotor radii out and falls off as 1/r beyond; the jet is
// tens of centimetres deep near its peak and thickens as it spreads, it
// mixes away into the still air a dozen radii out, and it is gone from the
// snow once the rotor is more than `HELI.wash.reach`
// rotor diameters up.
//
// Draws nothing from any stream and writes nothing.

import { clamp, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler, rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { HELI } from "./defs/heli.ts";
import type { Level } from "../mapgen/types.ts";
import type { HeliState } from "./state.ts";

const R = HELI.rotor.radius;
const AREA = Math.PI * R * R;
/** The outwash's peak as a multiple of the induced velocity. */
const PEAK = 1.9;

export type Wash = { x: number; y: number; z: number };

/** The hover's induced velocity under a thrust, m/s. */
export function inducedOf(thrust: number): number {
  return Math.sqrt(Math.max(0, thrust) / (2 * HELI.density * AREA));
}

/** THE WASH at (x, y, z) off `h`, m/s, world frame, into `out`: down
 * through the disc and its column, and out along the snow in the wall
 * jet. Zero with the rotor lifting nothing, or a wreck. */
export function washAt(
  level: Level,
  h: HeliState | undefined,
  x: number,
  y: number,
  z: number,
  out: Wash,
): Wash {
  out.x = out.y = out.z = 0;
  if (!h || h.mode === "wreck" || h.thrust <= 0) return out;
  const vi = inducedOf(h.thrust);
  const hub = rotate(fromEuler(h.heading, h.pitch, h.roll), {
    x: 0,
    y: HELI.rotor.hub,
    z: HELI.rotor.at,
  });
  const hx = h.x + hub.x;
  const hy = h.y + hub.y;
  const hz = h.z + hub.z;
  const dx = x - hx;
  const dz = z - hz;
  const r = hypot(dx, dz);
  const below = hy - y;
  // THE COLUMN under the disc: accelerating to the far wake's 2 v_i over a
  // radius below it, contracting, and spent a few diameters down.
  if (below > 0 && r < R) {
    const edge = 1 - (r / R) ** 4;
    const v = vi * (1 + smoothstep(0, R, below)) * edge * (1 - smoothstep(4 * R, 8 * R, below));
    out.y -= v;
  }
  // THE WALL JET along the snow.
  const ground = level.groundAt(hx, hz);
  const height = hy - ground;
  const reach = HELI.wash.reach * 2 * R;
  if (height >= reach || r < 0.1) return out;
  const core = HELI.wash.core * R;
  const peak = PEAK * vi * (1 - smoothstep(R, reach, height));
  // ...and spent into the still air past a dozen radii out.
  const u = (r < core ? peak * (r / core) : peak * (core / r)) * (1 - smoothstep(6 * R, 12 * R, r));
  const over = Math.max(0, y - level.groundAt(x, z));
  const depth = 0.3 + 0.06 * r;
  const k = clamp(u * Math.exp(-over / depth), 0, 3 * vi);
  out.x += (dx / r) * k;
  out.z += (dz / r) * k;
  return out;
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROTOR, AS MOMENTUM THEORY STATES IT, and the helicopter's frames —
// what both the flight (`heli.ts`) and the bot's hands on it
// (`heli-pilot.ts`) read, stated once. Pure.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler, rotate, type Quat } from "@niclaslindstedt/oss-game-framework/core/quat";
import { HELI } from "./defs/heli.ts";
import { totalMass } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import type { GameState, HeliState } from "./state.ts";

const K = HELI;
export const ROTOR_AREA = Math.PI * K.rotor.radius ** 2;

/** THE SEAT IN THE BODY FRAME. `HELI` states the machine as it is built
 * and drawn — x to its own right as a pilot sits in it, the side its tail
 * rotor is on and the skid opposite its ski basket. The engine's body x
 * runs the other way round on the screen (the renderer's frame mirrors the
 * map — `input-model.ts`'s `SCREEN_TO_ENGINE`), so a point off `HELI`
 * comes into the body frame with its x turned. */
export const SEAT = { x: -K.seat.x, y: K.seat.y, z: K.seat.z };

/** The airframe's orientation, body to world. */
export function heliQuat(h: HeliState): Quat {
  return fromEuler(h.heading, h.pitch, h.roll);
}

/** The ROTOR DISC's orientation — the way its thrust points (`HeliState.disc`). */
export function discQuat(h: HeliState): Quat {
  return fromEuler(h.heading, h.disc.pitch, h.disc.roll);
}

/** A point of the airframe, body frame (x right, y up, z forward, off the
 * skid datum), in the world. */
export function heliPoint(
  h: HeliState,
  p: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const w = rotate(heliQuat(h), p);
  return { x: h.x + w.x, y: h.y + w.y, z: h.z + w.z };
}

/** The mass flown: the machine and, while he is on its skid, the skier. */
export function heliMass(run: GameState): number {
  return K.mass + (run.heli?.rider ? totalMass(run.skier.spec) : 0);
}

/** WHAT THE ROTOR CAN GIVE, N, at full rpm: the thrust momentum theory
 * says the power buys going `along` m/s through the air and climbing `vc`
 * m/s — P = T·(v_c + v_i), the induced velocity off Glauert's relation
 * v_i = v_h² / √(V² + (v_c + v_i)²), v_h² = T / 2ρA, the parasite power
 * ½ρfV³ at speed taken off first — in ground effect `over` m of hub height
 * over the snow (Cheeseman & Bennett, 1 / (1 − (R / 4z)²)). */
export function thrustMost(along: number, vc: number, over: number): number {
  const rho = K.density;
  const avail = Math.max(K.power * 0.25, K.power - 0.5 * rho * K.flatPlate * along ** 3);
  let t = K.mass * TUNING.g * 1.3;
  for (let k = 0; k < 6; k++) {
    const vh2 = t / (2 * rho * ROTOR_AREA);
    // Below a descent of v_h the momentum stream reverses (the vortex ring):
    // the relation is held at its edge.
    const c = Math.max(vc, -Math.sqrt(vh2));
    let vi = Math.sqrt(vh2);
    for (let j = 0; j < 4; j++) vi = vh2 / Math.max(0.5, hypot(along, c + vi));
    const need = t * Math.max(0.5, c + vi);
    t *= (avail / need) ** (2 / 3);
  }
  const R = K.rotor.radius;
  const z = Math.max(over, (R / 4) * 1.05);
  const ground = Math.min(K.groundMost, 1 / (1 - (R / (4 * z)) ** 2));
  return t * ground;
}

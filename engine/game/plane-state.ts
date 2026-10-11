// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S STATE (`plane.ts`) — its controls, what it is doing and
// where, and what its events say — beside `state.ts`, which names them.

import type { Quat } from "@niclaslindstedt/oss-game-framework/core/quat";

/** THE CONTROLS OF THE PLANE, flown by hand with nothing between the pilot
 * and the surfaces:
 *   * `throttle` — the power lever, 0 (flight idle) … 1 (full power); a
 *     lever, it stays where it is left;
 *   * `pitch` — the stick fore and aft, −1..1, FORWARD positive (the
 *     elevator down, the nose down — the helicopter's cyclic's sense);
 *   * `roll` — the stick side to side, −1..1, right positive (the right
 *     aileron up: the right wing down);
 *   * `yaw` — the rudder pedals, −1..1, nose right positive (and the tail
 *     ski steered with them on the snow);
 *   * `flaps` — the flap lever, 0 (up) … 1 (full, 40°);
 *   * `brake` — on the snow, the skis' drag claws and the propeller's
 *     reverse, 0..1; nothing in the air. Left out, off;
 *   * `trim` — the elevator's trim, where the stick's middle stands, −1..1
 *     of its travel (forward positive): set, it stays; left out, where it
 *     was. */
export type PlaneControls = {
  throttle: number;
  pitch: number;
  roll: number;
  yaw: number;
  flaps: number;
  brake?: number;
  trim?: number;
};

/** What a `plane` event says (`plane.ts`): the skier taken aboard at the
 * door, off the snow, onto it, out of the door in the air (`jump`) or onto
 * the snow from a plane stopped (`stepoff`), the pilot home on the strip,
 * the machine crashed (where it burns), the ride started again on the
 * strip — and `stall`, a wing let go of its air. */
export type PlanePhaseEvent =
  "board" | "liftoff" | "land" | "jump" | "stepoff" | "home" | "crash" | "restart" | "stall";

/** THE PLANE'S EVENT. `speed` is how hard: the closing speed into the snow
 * or a crown, m/s (a crash, a landing), the airspeed (a jump), 0 else. */
export type PlaneEvent = {
  kind: "plane";
  t: number;
  phase: PlanePhaseEvent;
  x: number;
  y: number;
  z: number;
  speed: number;
};

/** WHAT THE PLANE IS DOING: `parked` on the strip, the propeller winding
 * down; `flown` by the player with the skier in its door; `home` flown
 * back to the strip and landed by its pilot after the jump; or a `wreck`
 * burning where it came down. */
export type PlaneMode = "parked" | "flown" | "home" | "wreck";

/** THE FREE RIDE'S JUMP PLANE (`plane.ts`) — on a run begun on it
 * (`CreateGameOptions.plane`), absent everywhere else. Its place is the
 * GROUND DATUM (`PLANE`: the snow under the main skis, the fuselage level),
 * world frame, m; its velocity the CoG's, m/s; its orientation a body-to-
 * world quaternion and the angles read off it (the skier's conventions:
 * heading 0 = +z clockwise, pitch nose-up positive, roll right-side-down
 * positive); its rates in the body frame, right-handed (a nose-up pitch
 * rate is a negative `wx`). Drawn off this, heard off this; nothing in it
 * draws from the stream. */
export type PlaneState = {
  mode: PlaneMode;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  q: Quat;
  heading: number;
  pitch: number;
  roll: number;
  wx: number;
  wy: number;
  wz: number;
  /** The controls it was flown on this step — the player's, or the pilot's
   * flying it home — after the bounds' hand (`airBounds`). */
  controls: PlaneControls;
  /** Where the surfaces stand, rad (the elevator trailing edge down
   * positive, the right aileron up positive, the rudder's trailing edge to
   * the right positive), and the flaps' share down, 0..1. */
  surfaces: { aileron: number; elevator: number; rudder: number; flaps: number };
  /** The elevator's trim, −1..1 of the stick's travel (`PlaneControls.trim`). */
  trim: number;
  /** The engine's power share, 0..1, the thrust this step, N (negative in
   * reverse), the propeller's turn, rad (wrapped), and its rpm's share. */
  power: number;
  thrust: number;
  prop: number;
  spin: number;
  /** THE AIR: the airspeed, m/s, the angle of attack at the fuselage line
   * and the sideslip, rad; the load factor (lift over weight); the wing's
   * mean lift coefficient (what the tail's downwash reads, a step late);
   * the share of the wing stalled, 0..1; the air's density, kg/m³. */
  airspeed: number;
  aoa: number;
  slip: number;
  load: number;
  cl: number;
  stalled: number;
  density: number;
  /** Whether a ski is on the snow, the three legs' compressions, m (left,
   * right, tail), and the datum's height over the snow, m. */
  grounded: boolean;
  legs: [number, number, number];
  agl: number;
  /** How far into the airborne bounds band it is (`airBounds`), 0 inside. */
  bounds: number;
  /** Whether the skier stands in its door, and how far open the door is,
   * 0..1 (slid open on the ground at the start, as a jump plane flies). */
  rider: boolean;
  door: number;
  /** Seconds in this mode (the wreck's clock, the pilot's beat). */
  t: number;
  /** Where the wreck came down, how hard, m/s, and whether the skier was
   * aboard (`plane` crash) — then the ride starts again on the strip. */
  wreck: { x: number; y: number; z: number; speed: number; aboard: boolean } | null;
};

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER'S STATE (`heli.ts`) — its controls, what it is doing and
// where, and what its events say — beside `state.ts`, which re-exports
// every one of them, so a reader asks the one place it always has.

/** THE CONTROLS OF A HELICOPTER, flown by hand with nothing between the
 * pilot and the rotor:
 *   * `collective` — the lever, 0 (down: the blades flat, no lift) … 1 (all
 *     the pitch the power can turn): the thrust's share of what the rotor
 *     can give. A lever, not a spring: it stays where it is left;
 *   * `pitch` — the cyclic fore and aft, −1..1, forward positive: the disc
 *     tilted forward, the nose pitched down;
 *   * `roll` — the cyclic side to side, −1..1, toward the right side
 *     positive (the engine's right, `steer`'s);
 *   * `pedal` — the pedals, −1..1, the tail rotor's thrust turning the nose
 *     right (clockwise) positive. */
export type HeliControls = { collective: number; pitch: number; roll: number; pedal: number };

/** What a `heli` event says (`heli.ts`). */
export type HeliPhaseEvent = "board" | "liftoff" | "land" | "drop" | "home" | "crash" | "restart";

/** WHAT THE HELICOPTER IS DOING (`heli.ts`): `parked` on its pad, the
 * rotor winding down or turning; `flown` by the player with the skier on
 * its skid; `home` flown back to its pad by its pilot after the drop; or
 * a `wreck` burning where it came down. */
export type HeliMode = "parked" | "flown" | "home" | "wreck";

/** THE FREE RIDE'S HELICOPTER (`heli.ts`) — on a run whose rules carry one
 * (`RunRules.heli`), absent everywhere else. Its place is the SKID DATUM
 * (`HELI`: the ground under the middle of the skids), world frame, m; its
 * attitude the skier's conventions (heading 0 = +z clockwise, pitch nose-up
 * positive, roll right-side-down positive). Drawn off this, heard off
 * this; nothing in it draws from the stream. */
export type HeliState = {
  mode: HeliMode;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number;
  /** The airframe's attitude — the fuselage, hung under its rotor. */
  pitch: number;
  roll: number;
  /** THE ROTOR DISC, which the cyclic flies and the thrust points along:
   * its pitch and roll (the airframe's conventions) and their rates. */
  disc: { pitch: number; roll: number; pitchRate: number; rollRate: number };
  /** The controls the machine was flown on this step (`HeliControls`) —
   * the player's, or the bot's flying it home. */
  controls: HeliControls;
  /** The rates, rad/s: the heading's, and the fuselage's pitch and roll. */
  yawRate: number;
  pitchRate: number;
  rollRate: number;
  /** THE ROTOR: its share of the full rpm, 0..1, and the main and tail
   * rotors' turn, rad (wrapped) — what the drawing spins them by. */
  spool: number;
  rotor: number;
  tailRotor: number;
  /** The rotor's thrust this step, N, and its share of what it could give —
   * the collective as the sound and the wash read it. */
  thrust: number;
  collective: number;
  /** Whether the skids are on the snow, and the hub's height over it, m. */
  grounded: boolean;
  agl: number;
  /** Whether the skier is sat on the right skid. */
  rider: boolean;
  /** Seconds in this mode (the wreck's clock, the boarding's). */
  t: number;
  /** Whether the skier has been clear of the boarding reach since he last
   * stepped off — a skier stood beside the skid he has just stepped off is
   * not sat straight back on it. */
  away: boolean;
  /** The jump key as the last step had it — a drop is taken on the press. */
  jumpWas: boolean;
  /** Where the wreck came down, how hard, m/s, and whether the skier was
   * on it (`heli` crash) — then the ride starts again from the pad. */
  wreck: { x: number; y: number; z: number; speed: number; aboard: boolean } | null;
  /** How far the seated skier's body origin stands over the skid's top, m
   * — up with his skis on the snow, down with them hanging in the air. */
  hang: number;
};

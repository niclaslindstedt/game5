// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE'S STATE (`sled.ts`) — its controls, its body, its engine
// and belt, what it is doing and what its events say — beside `state.ts`,
// which re-exports every one of them, so a reader asks the one place it
// always has.

import type { Quat } from "@niclaslindstedt/oss-game-framework/core/quat";

/** THE CONTROLS OF THE SNOWMOBILE, as the rider works them: the thumb
 * throttle 0..1, the brake lever 0..1, the bars −1..1 (right positive, the
 * engine's `steer`), and his weight fore and aft −1..1 (+1 back — the nose
 * lifted, the climber's stance; −1 over the bars). Read off the skier's
 * own input while he rides (`sledControls`). */
export type SledControls = { throttle: number; brake: number; steer: number; lean: number };

/** What a `sled` event says (`sled.ts`): taken (boarded), left (hopped
 * off), the rider thrown (`crash`), stood back up on its belt (`right`),
 * or the ride begun again at the bottom (`restart`). */
export type SledPhaseEvent = "board" | "hop" | "crash" | "right" | "restart";

/** A `sled` event (`GameEvent`): ridden into and taken, hopped off, the
 * rider thrown off it, stood back on its belt, or the ride begun again at
 * the bottom — where, and the machine's speed, m/s (a hop, a crash). */
export type SledEvent = {
  kind: "sled";
  t: number;
  phase: SledPhaseEvent;
  x: number;
  y: number;
  z: number;
  speed: number;
};

/** WHAT THE SNOWMOBILE IS DOING: `parked` with nobody on it (where it was
 * left, or on its spot at the bottom), `ridden` by the player, or `down` —
 * the rider thrown off it, the machine lying where it came to rest. */
export type SledMode = "parked" | "ridden" | "down";

/** ONE PROBE ON THE SNOW, as the renderer stamps it: on the surface under
 * the probe (world, m), sunk how deep, carrying what, and whether it is
 * touching — the skis' grooves and the belt's paddled trench. */
export type SledContact = {
  kind: "ski" | "tread";
  station: "ski" | "front" | "mid" | "rear";
  side: number;
  x: number;
  y: number;
  z: number;
  sink: number;
  width: number;
  load: number;
  touching: boolean;
};

/** THE FREE RIDE'S SNOWMOBILE (`sled.ts`) — on a run whose rules carry one
 * (`RunRules.sled`), absent everywhere else. A rigid body: its place is
 * the centre of gravity of the machine and its rider, world frame, m; its
 * attitude the quaternion `q` (the skier's conventions: heading 0 = +z
 * clockwise, pitch nose-up positive, roll right-side-down positive) and
 * its rates the body's, rad/s. Drawn off this, heard off this; nothing in
 * it draws from the stream. */
export type SledState = {
  mode: SledMode;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  q: Quat;
  wx: number;
  wy: number;
  wz: number;
  /** Derived each step: the heading, pitch and roll, the speed |v| and the
   * way — the speed along the nose, flat. */
  heading: number;
  pitch: number;
  roll: number;
  speed: number;
  way: number;
  /** The controls as they stand after their lags. */
  controls: SledControls;
  /** The skis' turn off the nose, rad (right positive). */
  skiAngle: number;
  /** The rider's weight moved across (right, m) and back (m). */
  riderRight: number;
  riderAft: number;
  /** The roll the rider is taking it to off the snow's plane, rad (right
   * side down positive): what the bars ask, eased at `SLED.roll.rate`. */
  rollAim: number;
  /** THE ENGINE AND THE BELT (`sled-drive.ts`): rpm; the belt's speed and
   * its slip over the snow, m/s — a spinning belt digs and throws the
   * roost. */
  rpm: number;
  treadSpeed: number;
  /** Whether the engine is running: started as a rider takes it, left
   * idling as he steps off, shut off after `SLED.idleFor` s with nobody on
   * it or when it is thrown over. */
  running: boolean;
  slip: number;
  /** The share of packed snow under it, weighted by load. */
  packed: number;
  /** Every probe on the snow (`SLED_PROBES`' order). */
  contacts: SledContact[];
  /** Each probe's settled sink and last compression, m. */
  sinks: number[];
  comps: number[];
  /** The skis' and the belt's compression, m — what the drawn suspension
   * travels by. */
  skiComp: [number, number];
  treadComp: number;
  /** In the air: whether, and for how long, s. */
  airborne: boolean;
  airTime: number;
  /** Whether the rider is on its boards. */
  rider: boolean;
  /** Seconds in this mode. */
  t: number;
  /** Whether the rider was thrown off it — he is put back on it where it
   * lies once he is stood up. */
  thrown: boolean;
  /** How long it has stood past rolled or looped, s (`SLED.crash.over`). */
  overFor: number;
  /** Seconds before another trunk is reported. */
  hitCooldown: number;
};

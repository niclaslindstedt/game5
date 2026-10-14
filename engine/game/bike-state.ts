// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE'S STATE (`bike.ts`, `bike-body.ts`) — its controls, its
// bodies, its wheels and what its events say — beside `state.ts`, which
// re-exports every one of them, so a reader asks the one place it always has.

import type { Quat } from "@niclaslindstedt/oss-game-framework/core/quat";

/** THE CONTROLS OF THE BIKE, as the rider works them (`bikeControls` reads
 * them off the skier's own input): the pedals 0..1, the front and rear
 * brake levers 0..1, the bars −1..1 (right positive — a turn asked, which
 * his hands make by leaning it), his weight fore and aft −1..1 (+1 back),
 * and the legs folded for a pop 0..1 (let go, they spring). */
export type BikeControls = {
  pedal: number;
  front: number;
  rear: number;
  steer: number;
  lean: number;
  crouch: number;
};

/** What a `bike` event says (`bike.ts`): got on (`board`), got off
 * (`hop`), the rider thrown (`crash`), back on it where it lay (`right`),
 * the ride begun again at a trail head (`restart`), carried up a lift
 * (`lift`), or a landing judged (`land`). */
export type BikePhaseEvent = "board" | "hop" | "crash" | "right" | "restart" | "lift" | "land";

/** How a landing was judged: ridden away clean, CASED (short, onto the
 * deck or the lip's back), NOSED in (the front wheel first and steep), or
 * OVERSHOT (past the landing onto the flat), or flat (off a drop to flat
 * ground). */
export type BikeLanding = "clean" | "cased" | "nosed" | "overshot" | "flat";

/** How the rider came off: over the bars, the front washed out, the bike
 * lowsided, a landing he did not ride away, something hit, or his body met
 * the ground. */
export type BikeCrash = "bars" | "washout" | "lowside" | "landing" | "hit" | "down";

/** A `bike` event (`GameEvent`): where, the bike's speed, m/s, and for a
 * landing its judgement and the body's peak, g; for a crash, how. */
export type BikeEvent = {
  kind: "bike";
  t: number;
  phase: BikePhaseEvent;
  x: number;
  y: number;
  z: number;
  speed: number;
  landing?: BikeLanding;
  g?: number;
  air?: number;
  how?: BikeCrash;
};

/** WHAT THE BIKE IS DOING: `parked` with nobody on it, `ridden`, `lift` —
 * hooked on a chair or a gondola with him — or `down`, lying where it came
 * to rest with its rider thrown off it. */
export type BikeMode = "parked" | "ridden" | "lift" | "down";

/** ONE WHEEL: its suspension's compression at the wheel, m, and its rate,
 * m/s; the tyre's load, N, its contact point (world, m), whether it is on
 * the ground, the slip it is wound to, rad, how far past its grip the side
 * force asks (1 = at the peak), whether it is locked by its brake or
 * spinning under the pedals, its turn about the axle, rad (for the
 * drawing), and its spin, rad/s (forward positive). */
export type BikeWheel = {
  comp: number;
  compRate: number;
  load: number;
  x: number;
  y: number;
  z: number;
  touching: boolean;
  slip: number;
  over: number;
  locked: boolean;
  spinning: boolean;
  turn: number;
  spin: number;
  /** The peak load of the current landing window, N. */
  peak: number;
};

/** THE RIDER ON IT: his centre of mass and its velocity, world frame, m and
 * m/s — a second body on the legs' and arms' springs. */
export type BikeRider = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};

/** THE FREE RIDE'S DOWNHILL BIKE (`bike.ts`) — on a summer free ride that
 * asked for it (`CreateGameOptions.bike`), absent everywhere else. The frame
 * is a rigid body: its place is the bike's own centre of mass, world, m;
 * its attitude `q` (the skier's conventions: heading 0 = +z clockwise,
 * pitch nose-up positive, roll right-side-down positive) and its rates the
 * body's, rad/s. The bars turn on their own axis (`steer`, rad, right
 * positive) and the rider rides his own springs. Nothing in it draws from
 * the stream. */
export type BikeState = {
  mode: BikeMode;
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
  steer: number;
  steerRate: number;
  /** The torque the front patch put about the steer axis last substep,
   * N·m — the rider feels it in the bars and meets it. */
  feel: number;
  /** The turn the hands are making, 1/m (right positive), eased toward the
   * bars asked, and the lean it wants, rad. */
  turn: number;
  aimLean: number;
  /** How long the bars have been asked past the grip's knee, s
   * (`hands.past`): a quick stab is held to the grip, a hold goes on past. */
  pastKnee: number;
  /** Where his weight is fore and aft, −1..1 (+1 back): the lean asked,
   * moved to over `BIKE.rider.shift` s — a body shifts, it does not jump. */
  shift: number;
  rider: BikeRider;
  front: BikeWheel;
  rear: BikeWheel;
  /** The cranks' angle, rad, and the cadence, rpm. */
  crank: number;
  cadence: number;
  /** The work over critical power still in the rider's legs, J (W′). */
  reserve: number;
  /** The rider's mass, kg, and the springs' preloads it set (the sag). */
  riderMass: number;
  /** Derived each step: the heading, pitch and roll (the roll off the
   * vertical), the speed |v|, the way (along the frame, flat), and the
   * body's acceleration, g, low-passed. */
  heading: number;
  pitch: number;
  roll: number;
  speed: number;
  way: number;
  g: number;
  /** The controls as they stand. */
  controls: BikeControls;
  /** In the air: whether, and for how long, s; the landing being judged —
   * the time since touchdown, the body's peak g in it, the flight it ended,
   * s, and its verdict so far. */
  airborne: boolean;
  airTime: number;
  landing: { t: number; peak: number; air: number; verdict: BikeLanding; v: number } | null;
  /** Seconds left of the pop's push. */
  pop: number;
  /** Seconds left of the legs tucked up after a pop, lifting the bike. */
  tuck: number;
  /** The most the legs push on the landing being ridden, × his weight
   * (`BIKE.rider.legs`): set at each touchdown by how hard it came. */
  legs: number;
  /** The share of a pop loaded: the legs folded and held, 0..1. */
  loaded: number;
  /** How long the bike has leaned past the lowside's angle, and the front
   * slid past its grip, s. */
  leanFor: number;
  slideFor: number;
  /** Whether the rider is on it, seconds in this mode, whether he was
   * thrown (he is put back on it once stood up), seconds before another
   * trunk is said, and the lift it rides. */
  onIt: boolean;
  t: number;
  thrown: boolean;
  hitCooldown: number;
  lift: string | null;
  /** OFF THE BIKE ON FOOT (`bike.ts`): how far he has walked, m, and his
   * pace, m/s — the gait the drawing reads — and whether he is PUSHING the
   * bike beside him by its bars (it stood upright on its wheels at his
   * side, `BIKE.walk.push`), or null while he rides, is carried or lies
   * thrown. */
  afoot: { walked: number; pace: number; push: boolean } | null;
  /** The trail the ride was begun at the head of (`startBike`), begun there
   * again on a restart. */
  trail: string | null;
  /** WHERE IT WAS LAST RIDDEN ON A TRAIL: the trail's id and the arc, m,
   * of the last step it was on that trail's tread (`keepTrail`) — where a
   * fall or the reset puts it back (`restartPoint`) — or null: not ridden
   * on a trail since the ride began or a lift let it off at the top. */
  ridden: { trail: string; s: number } | null;
};

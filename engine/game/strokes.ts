// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STROKES — the controls a FREE RIDE or a TRICKS run reads off the
// SHAPE of an input rather than its value (`RunRules.stunts`), and the
// skier's GRABS (on a tricks run). THE TWIRL is the edge thrown over, and
// each one is HALF A TURN about the skier's own up axis: tap it once and he
// comes down with the skis backward and rides away SWITCH (`skier.ts`);
// twice, and it is a whole 360. THE PUMP is the lean thrown to the top of
// its axis, and each one is a WHOLE TURN nose over tail — back, the
// backflip; forward, the front flip. Under the skin they are one mechanism
// read twice.
//
// Both are bookkeeping on an input rather than a force, which is why they
// live here and not in `flight.ts`: a stroke is EARNED by carrying the input
// across a gate near the top of its axis, on a skier who is flying, and
// what it buys is an ANGLE owed (`TrickState.spinGoal` / `.flipGoal`). Below
// the gate the lean and the edge are the ordinary air control — the lean's
// torque — and a skier trimming his pitch never turns a trick by accident.
// A tap the other way takes a stroke back off what is still owed.
//
// A STROKE IS A THROW, NOT A SNAP. The angle owed is turned at a rate the
// body GATHERS — up at `spinAccel` / `flipAccel` to its cruise and off
// again at the same, so the skier stops square on the angle bought, the
// skis straight backward after a 180 and level after a loop — and while
// anything is owed on an axis the throw has that axis: the air's own hand,
// the lean's torque and its damping are steered over. Once it is turned
// the axis is the air's again.
//
// IT IS PACED TO THE SNOW. The cruise is raised to turn what is owed by
// `finish` s before the flight comes down (`landingAhead`), as fast as
// `rateMost`, and a stroke that could not be turned in the air left is not
// taken at all — which is what keeps a lean thrown on the way down to
// meet the landing a lean, and a hop over a roller a hop. A throw the snow
// comes back under dies with the flight: whatever was still owed is not
// turned.
//
// A KICKER, AND NOT A BUMP. The lean held across the gate up a kicker's ramp
// is one stroke at the lip: the skier set the trick up. Held anywhere else
// on the snow — leaning back to float through powder, which every skier
// does — the crossing is marked as already made, and the same hold off a
// crest buys nothing until he lets it go and throws it again.
//
// THE GRABS. With the trick button held in the air the skier's body is off
// the controls and into a grab: one ski kicked forward and one back, the
// daffy (the edge over), both skis flung wide, the spread (the lean back),
// or the body folded to a hand on the ski, the grab (the lean forward, or
// nothing). While he grabs the lean and the edge move his body and not his
// flight (`poseInput`), so he flies on as he was and the grab is a thing he
// has to get out of before the snow comes back (`tricks.ts` judges that).
//
// Nothing here is random and nothing reads a clock: a run replays to the
// same rotation.

import { approach, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { landingAhead } from "./flight.ts";
import { flightGravity } from "./limits.ts";
import { SKIS, inertiaOf } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import type { GameState, SkierInput, TrickPose } from "./state.ts";

const T = TUNING.tricks;

/** Which grab the lean and the edge ask for with the trick button held. */
export function poseOf(input: SkierInput): TrickPose {
  const steer = Math.abs(input.steer);
  if (steer >= 0.5 && steer >= Math.abs(input.lean)) return "daffy";
  return input.lean >= 0.5 ? "spread" : "grab";
}

/** Whether the skier is grabbing this step: the trick button, on a run
 * that counts tricks, off the snow and still on his skis. */
function posing(state: GameState, input: SkierInput): boolean {
  const c = state.skier;
  return state.rules.tricks && input.trick === true && c.airborne && c.thrown === null;
}

const posed: SkierInput = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };
const thrown: SkierInput = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };

/** THE INPUT THE SKIER FLIES ON while he grabs: the tuck and the brake are
 * still under his thumbs, but the lean and the edge are his body, and he
 * flies on without them. And an axis still held across its gate from the
 * stroke it bought is the THROW's: a lean held past a loop that had come
 * round would go on pitching him over onto his back. Anything else passes
 * as it is. */
export function poseInput(state: GameState, input: SkierInput): SkierInput {
  if (posing(state, input)) {
    posed.tuck = input.tuck;
    posed.brake = input.brake;
    posed.reset = input.reset;
    posed.jump = input.jump;
    return posed;
  }
  const k = state.tricks;
  if (!state.skier.airborne || (!k.flipHeld && !k.spinHeld)) return input;
  Object.assign(thrown, input);
  if (k.flipHeld) thrown.lean = 0;
  if (k.spinHeld) thrown.steer = 0;
  return thrown;
}

/** Whether the skier stands on the ramp of a kicker (R4, R9, R20) — where
 * a lean held across the gate is a trick being set up. */
function onRamp(state: GameState): boolean {
  const kickers = state.level.kickers;
  if (!kickers) return false;
  const c = state.skier;
  for (const k of kickers) {
    const fx = Math.sin(k.heading);
    const fz = Math.cos(k.heading);
    const dx = c.x - k.x;
    const dz = c.z - k.z;
    const u = dx * fx + dz * fz;
    if (u < -k.ramp || u > 1) continue;
    if (Math.abs(dx * fz - dz * fx) <= k.width / 2) return true;
  }
  return false;
}

/** Which way an axis is across its gate: +1, −1, or 0 at trim. */
function across(value: number, gate: number): number {
  const v = clamp(value, -1, 1);
  return v >= gate ? 1 : v <= -gate ? -1 : 0;
}

/** The least time, s, a throw gathered at `accel` rad/s² to no more than
 * `rate` rad/s and stopped again takes to turn `angle` rad from rest. */
export function throwTime(angle: number, rate: number, accel: number): number {
  const a = Math.abs(angle);
  if (a * accel <= rate * rate) return 2 * Math.sqrt(a / accel);
  return a / rate + rate / accel;
}

/** One step of both stroke detectors, the throws and the grab, run after
 * the skier has been stepped (his flight bookkeeping is current), on a run
 * whose rules let him trick (`RunRules.stunts`). `input` is what the skier
 * asked for, before `poseInput`. */
export function stepStrokes(state: GameState, input: SkierInput): void {
  const k = state.tricks;
  const c = state.skier;
  const flip = across(input.lean, T.flipGate);
  const spin = across(input.steer, T.spinGate);

  // THE GRAB: chosen off the input every airborne step, its clock restarted
  // whenever it changes. Left standing on the step the snow comes back, so
  // `tricks.ts` can see a landing taken in one.
  if (c.airborne) {
    const pose = posing(state, input) ? poseOf(input) : null;
    if (pose !== k.pose) k.poseTime = 0;
    else if (pose !== null) k.poseTime += TUNING.dt;
    k.pose = pose;
  }

  const flying =
    c.airborne && c.thrown === null && c.airTime >= TUNING.air.counts && c.launchVy >= T.launch;
  // An axis let back under its gate is the air control's again.
  if (flip === 0) k.flipHeld = false;
  if (spin === 0) k.spinHeld = false;
  if (!flying) {
    k.flipHeld = false;
    k.spinHeld = false;
    k.flipGoal = 0;
    k.spinGoal = 0;
    k.flipDone = 0;
    k.spinDone = 0;
    if (!c.airborne) {
      // ARMED on the snow: across the gate up a kicker's ramp is a stroke
      // waiting for the lip; anywhere else it is a crossing already made.
      const ramp = onRamp(state);
      k.flipCrossed = ramp ? 0 : flip;
      k.spinCrossed = ramp ? 0 : spin;
    }
    return;
  }
  // WHAT THE LAST STEP TURNED toward what is owed. Tips up is a negative
  // `wx` (`state.ts`), so a backflip's angle is −wx; a positive `wy` turns
  // the skier clockwise, the way a positive edge does.
  const dt = TUNING.dt;
  if (owing(k.flipGoal, k.flipDone)) k.flipDone -= c.wx * dt;
  if (owing(k.spinGoal, k.spinDone)) k.spinDone += c.wy * dt;

  // THE PACE: this pair's throw, and the air left to turn it in.
  const I = inertiaOf(c.spec);
  const ref = inertiaOf(SKIS);
  const flipAccel = T.flipAccel * Math.sqrt(ref.x / I.x);
  const spinAccel = T.spinAccel * Math.sqrt(ref.y / I.y);
  const down = landingAhead(c, state.level, flightGravity(state.rules));
  const left = (down ? down.t : Infinity) - T.finish;

  if (k.pose !== null) {
    // Grabbing: the body is busy, and whatever the axes are doing is the
    // grab's — nothing is thrown, though a throw already owed is still
    // turned below. Let go, they must be thrown afresh.
    k.flipCrossed = flip;
    k.spinCrossed = spin;
  } else {
    // THE PUMP, a whole turn the way the lean went: back (+1) the backflip.
    if (flip === 0) k.flipCrossed = 0;
    else if (flip !== k.flipCrossed) {
      k.flipCrossed = flip;
      const goal = k.flipGoal + flip * T.flipStep;
      if (takes(goal, k.flipDone, T.flipMost, flipAccel, left)) {
        if (!owing(k.flipGoal, k.flipDone)) k.flipDone = 0;
        k.flipGoal = goal;
        k.flipHeld = true;
      }
    }
    // THE TWIRL, half a turn the way the edge went.
    if (spin === 0) k.spinCrossed = 0;
    else if (spin !== k.spinCrossed) {
      k.spinCrossed = spin;
      const goal = k.spinGoal + spin * T.spinStep;
      if (takes(goal, k.spinDone, T.spinMost, spinAccel, left)) {
        if (!owing(k.spinGoal, k.spinDone)) k.spinDone = 0;
        k.spinGoal = goal;
        k.spinHeld = true;
      }
    }
  }

  // THE THROW, axis by axis: the rate the angle still owed asks for —
  // gathered to its cruise, and eased off so it stops on the angle. Turned,
  // the axis is the air's again.
  if (owing(k.flipGoal, k.flipDone)) {
    const rate = throwRate(k.flipGoal - k.flipDone, -c.wx, T.flipRate, flipAccel, left);
    if (rate === null) {
      k.flipGoal = 0;
      k.flipDone = 0;
    }
    c.wx = -(rate ?? 0);
  }
  if (owing(k.spinGoal, k.spinDone)) {
    const rate = throwRate(k.spinGoal - k.spinDone, c.wy, T.spinRate, spinAccel, left);
    if (rate === null) {
      k.spinGoal = 0;
      k.spinDone = 0;
    }
    c.wy = rate ?? 0;
  }
}

/** Whether a throw is under way on an axis: something asked for, or
 * something turned that a stroke the other way has asked back. */
function owing(goal: number, done: number): boolean {
  return goal !== 0 || done !== 0;
}

/** Whether a stroke that would make an axis owe `goal` rad in all, `done`
 * of it turned, is taken: no more than the axis's most, and turnable at the
 * fastest throw in the `left` s before the snow. */
function takes(goal: number, done: number, most: number, accel: number, left: number): boolean {
  return Math.abs(goal) <= most && throwTime(goal - done, T.rateMost, accel) <= left;
}

/** The angle owed this close, rad, and the rate this slow, rad/s, is a
 * throw finished — stopped dead on its angle, the last of the rate the
 * body's own: left turning at it, a 180 drifted a fifth of a right angle
 * off the line before the snow came back. */
const SQUARE = 0.01;
const STILL = 0.3;

/** THE RATE A THROW TURNS AT NEXT STEP, rad/s on its own axis (positive
 * the way its angle is owed), off the angle still `owed`, the rate it
 * turns at `now`, its cruise and acceleration and the `left` s to turn it
 * in — or null once it is done. The cruise is raised to the least that
 * turns the angle in the air left — a trapezoid of `owed/r + r/accel` s,
 * the smaller root of r² − left·accel·r + owed·accel — never past
 * `rateMost`; and the rate never asks more than stopping square on the
 * angle allows, √(2·accel·owed). */
function throwRate(
  owed: number,
  now: number,
  cruise: number,
  accel: number,
  left: number,
): number | null {
  const a = Math.abs(owed);
  if (a < SQUARE && Math.abs(now) < STILL) return null;
  // No snow in sight (`landingAhead`'s horizon): the cruise is enough.
  const room = Math.max(left, 0.05);
  const disc = room * room * accel * accel - 4 * a * accel;
  const fit = !Number.isFinite(room)
    ? 0
    : disc > 0
      ? (room * accel - Math.sqrt(disc)) / 2
      : T.rateMost;
  const top = clamp(Math.max(cruise, fit), 0, T.rateMost);
  const want = Math.sign(owed) * Math.min(top, Math.sqrt(2 * accel * a));
  return approach(now, want, accel * TUNING.dt);
}

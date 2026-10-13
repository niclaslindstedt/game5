// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STROKES — the controls a FREE RIDE or a TRICKS run reads off the
// SHAPE of an input rather than its value (`RunRules.stunts`), and the
// skier's GRABS (on a tricks run). THE TWIRL is the edge thrown over, and
// each one is HALF A TURN about the skier's own up axis: tap it once and he
// comes down with the skis backward and rides away SWITCH (`skier.ts`);
// twice, and it is a whole 360. THE LOOP is the lean carried to the top of
// its axis — back, the backflip; forward, the front flip — and it is HELD,
// not tapped: he turns nose over tail for as long as the lean stays there.
//
// Both are read off an input rather than a force, which is why they live
// here and not in `flight.ts`: they are EARNED by carrying the input
// across a gate near the top of its axis, on a skier who is flying. Below
// the gate the lean and the edge are the ordinary air control — the lean's
// torque — and a skier trimming his pitch never turns a trick by accident.
//
// A TWIRL IS HELD AND SETTLED. The edge held across its gate spins him at
// a rate the body GATHERS (`spinAccel`, toward a cruise the further over
// the edge is pushed), for as long as it is held; let go, the spin is
// carried on to the next half turn it can still stop square on and
// stopped there (`TrickState.spinGoal`), so a tap is a 180 — the skis
// straight backward, ridden away switch — and a held spin comes round
// onto the skis forward or switch. While it turns, the edge's own yaw is
// steered over. IT IS PACED TO THE SNOW: a settling spin is raised to
// stop by `finish` s before the flight comes down (`landingAhead`), as
// fast as `rateMost`, and a fresh twirl that could not turn half a turn
// in the air left is not taken at all.
//
// A LOOP IS THE SKIER'S OWN. Nothing stops it square: the lean held across
// its gate gathers the rotation at `flipAccel` to its cruise and keeps it
// there — a loop, a double, round past his feet if he holds it too long —
// and let go he opens out and it dies away at `flipBrake`, carrying him
// on a little over a third of a turn before the air's own control has the
// axis back. So he lets go upside down, as a skier opens to spot the
// snow, and comes round onto his skis; too early and he lands on his
// tails, too late on his tips or his back. While the loop turns, the
// lean's torque, the air's levelling and its damping are steered over
// (`TrickState.flipGoal` keeps where it is headed, for the tuck as drawn).
// The snow coming back under him ends it, wherever he is.
//
// A KICKER, AND NOT A BUMP. The lean held across the gate up a kicker's ramp
// is one stroke at the lip: the skier set the trick up. Held anywhere else
// on the snow — leaning back to float through powder, which every skier
// does — the crossing is marked as already made, and the same hold off a
// crest buys nothing until he lets it go and throws it again. And on a
// FREE RIDE a flight takes a stroke only if he MEANT it — off a kicker, or
// in a pop of his own (`popWindow`): a knee or a roller taken at speed
// throws him without asking, and the edge he steers across it then is his
// steering, never a 180 (`TrickState.meant`). A BIG FLIGHT is the
// exception for the lean: with a second of air or more still ahead
// (`bigFlight`) — off a crest, a cliff, a drop — the lean thrown across its
// gate is a loop whatever launched him.
//
// THE GRABS. With the trick button held in the air the skier's body is off
// the controls and into a grab: one ski kicked forward and one back, the
// daffy (the edge over), both skis flung wide, the spread (the lean back),
// or the body folded to a hand on the ski, the grab (the lean forward, or
// nothing) — and on a board the board's seven (`board-tricks.ts`: the indy,
// the mute, the melon, the stalefish, the method, the nose and the tail).
// While he grabs the lean and the edge move his body and not his
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
import { boardGrabOf } from "./board-tricks.ts";
import type { GameState, SkierInput, SkierState, TrickPose } from "./state.ts";

const T = TUNING.tricks;

/** Which grab the lean and the edge ask for with the trick button held —
 * on a board (`c` given and riding one) its own (`board-tricks.ts`). */
export function poseOf(input: SkierInput, c?: SkierState): TrickPose {
  if (c?.board) return boardGrabOf(input, c.spec, c.switched);
  const steer = Math.abs(input.steer);
  if (steer >= 0.5 && steer >= Math.abs(input.lean)) return "daffy";
  return input.lean >= 0.5 ? "spread" : "grab";
}

/** Whether the skier is grabbing this step: the trick button, on a run
 * that counts tricks or lets him trick the mountain (a free ride), off
 * the snow and still on his skis. */
function posing(state: GameState, input: SkierInput): boolean {
  const c = state.skier;
  return (
    (state.rules.tricks || state.rules.stunts) &&
    input.trick === true &&
    c.airborne &&
    c.thrown === null
  );
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
  const looping = k.flipHeld || k.flipGoal !== 0 || k.flipDone !== 0;
  const twirling = k.spinHeld || k.spinGoal !== 0 || k.spinDone !== 0;
  if (!state.skier.airborne || (!looping && !twirling)) return input;
  Object.assign(thrown, input);
  if (looping) thrown.lean = 0;
  if (twirling) thrown.steer = 0;
  return thrown;
}

/** Whether the skier stands on the ramp of a kicker (R4, R9, R20) — where
 * a lean held across the gate is a trick being set up — or no further than
 * `past` m beyond its lip. */
export function onRamp(state: GameState, past = 1): boolean {
  const kickers = state.level.kickers;
  if (!kickers) return false;
  const c = state.skier;
  for (const k of kickers) {
    const fx = Math.sin(k.heading);
    const fz = Math.cos(k.heading);
    const dx = c.x - k.x;
    const dz = c.z - k.z;
    const u = dx * fx + dz * fz;
    if (u < -k.ramp || u > past) continue;
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
    const pose = posing(state, input) ? poseOf(input, c) : null;
    if (pose !== k.pose) k.poseTime = 0;
    else if (pose !== null) k.poseTime += TUNING.dt;
    k.pose = pose;
  }

  const aloft = c.airborne && c.thrown === null && c.airTime >= TUNING.air.counts;
  // A BIG FLIGHT — a crest, a cliff, a drop with the air still ahead of
  // him for a loop (`bigFlight`) — is the pump's whatever launched it.
  const down = aloft ? landingAhead(c, state.level, flightGravity(state.rules)) : null;
  const ahead = down ? down.t : Infinity;
  const big = aloft && ahead >= T.bigFlight;
  const launched = aloft && c.launchVy >= T.launch;
  // ...and a loop under way is turned out whatever the air left says.
  const flying = launched || big || (aloft && owing(k.flipGoal, k.flipDone));
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
    k.flipSpeed = 0;
    if (!c.airborne) {
      // ARMED on the snow: across the gate up a kicker's ramp is a stroke
      // waiting for the lip; anywhere else it is a crossing already made.
      const ramp = onRamp(state);
      k.flipCrossed = ramp ? 0 : flip;
      k.spinCrossed = ramp ? 0 : spin;
      // The flight he leaves the snow on next is MEANT if he leaves it off
      // a kicker or in his own pop; off a knee or a lip he did not jump, a
      // free ride's flight is a fall he steers, and nothing is thrown.
      k.meant = ramp || c.popped <= T.popWindow;
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
  const pace = flipPace(c.spec);
  const I = inertiaOf(c.spec);
  const ref = inertiaOf(SKIS);
  const spinAccel = T.spinAccel * Math.sqrt(ref.y / I.y);
  const left = ahead - T.finish;
  // A flight he never meant (`TrickState.meant`) is steered, never thrown
  // — a twirl off a knee is his steering — but in a big one the lean is
  // the pump all the same: there is the air for a loop, and leaning hard
  // in it means one.
  const willed = launched && (k.meant || state.rules.tricks);
  // Grabbing, the body is busy, and whatever the axes are doing is the
  // grab's — nothing is thrown, though a loop under way still turns (and
  // dies away) and a twirl owed is still turned below. Let go, they must
  // be thrown afresh.
  const busy = k.pose !== null;
  if (busy || !(willed || big || owing(k.flipGoal, k.flipDone))) {
    k.flipCrossed = flip;
    k.flipHeld = false;
  } else {
    // THE LOOP, turned the way the lean went for as long as it is held:
    // back (+1) the backflip. Thrown across the gate it takes hold — the
    // other way, it turns the loop back — and let back under it, it lets
    // go and the rotation dies away.
    if (flip === 0) k.flipCrossed = 0;
    else if (flip !== k.flipCrossed) {
      k.flipCrossed = flip;
      if (!owing(k.flipGoal, k.flipDone)) k.flipDone = 0;
      k.flipHeld = true;
    }
    if (flip !== k.flipCrossed || flip === 0) k.flipHeld = false;
  }
  if (busy || !(willed || big)) k.spinCrossed = spin;
  else {
    // THE TWIRL, half a turn the way the edge went.
    // (A revert under way turns him round itself: no twirl is read on top.)
    if (spin === 0 || c.revert != null || !willed) k.spinCrossed = spin;
    else if (spin !== k.spinCrossed) {
      k.spinCrossed = spin;
      // A crossing is taken only if the air left can carry the turn it
      // asks for (half a turn back always can).
      const fresh = !owing(k.spinGoal, k.spinDone);
      const most = state.rules.spinMost ?? T.spinMost;
      // Each crossing is half a turn more the way it went (a tap the
      // other way, half a turn back), whatever a hold then adds to it.
      const goal = (fresh ? 0 : k.spinGoal) + spin * T.spinStep;
      const done = fresh ? 0 : k.spinDone;
      const back = !fresh && Math.abs(goal) < Math.abs(k.spinGoal);
      if (Math.abs(goal) <= most && (back || takes(goal, done, most, spinAccel, left))) {
        if (fresh) k.spinDone = 0;
        k.spinGoal = goal;
        k.spinHeld = true;
      }
    }
    if (spin !== k.spinCrossed) k.spinHeld = false;
  }

  // THE LOOP: held, the rate gathered toward its cruise the way the lean
  // went — let go before the run's most would be turned on the way to a
  // stop — and let go, opened out and slowing. Once it has all but died
  // the axis is the air's again, the last of the rate the body's own.
  if (k.flipHeld || owing(k.flipGoal, k.flipDone)) {
    const most = state.rules.flipMost ?? T.flipMost;
    // Taken up off the body's own rate as the loop takes hold.
    let now = owing(k.flipGoal, k.flipDone) ? k.flipSpeed : -c.wx;
    if (k.flipHeld && Math.abs(k.flipDone) + stopOf(now, pace.brake) >= most) k.flipHeld = false;
    now = k.flipHeld
      ? approach(now, k.flipCrossed * T.flipRate, pace.accel * dt)
      : approach(now, 0, pace.brake * dt);
    c.wx = -now;
    k.flipSpeed = now;
    // ...though a lean still held across the gate past the most keeps the
    // axis, so its own torque cannot carry him on round.
    const kept = flip !== 0 && flip === k.flipCrossed;
    if (!k.flipHeld && !kept && Math.abs(now) < STILL) {
      k.flipGoal = 0;
      k.flipDone = 0;
      k.flipSpeed = 0;
    } else {
      // Where it is headed: on round while held (the tuck kept), and where
      // it will come to rest once let go (the body opening toward it).
      const dir = k.flipHeld ? k.flipCrossed : Math.sign(now);
      const stop = stopOf(now, pace.brake);
      k.flipGoal = k.flipDone + dir * (k.flipHeld ? OPEN + stop : stop);
    }
  }
  // THE TWIRL: held, the rate gathered toward its cruise the way the edge
  // went — the further over the edge, the quicker, so a thumb dragged
  // across spins him as hard as it is pushed — and let go (or held to the
  // run's most), SETTLED: the spin carried on to the next half turn it can
  // still stop square on, so a tap is a 180 and a held spin comes round
  // onto the skis forward or switch.
  const most = state.rules.spinMost ?? T.spinMost;
  if (k.spinHeld && Math.abs(k.spinDone) + stopOf(c.wy, spinAccel) >= most) k.spinHeld = false;
  if (k.spinHeld) {
    const dir = k.spinCrossed;
    const drive = 0.5 + 0.5 * clamp((Math.abs(input.steer) - T.spinGate) / (1 - T.spinGate), 0, 1);
    c.wy = approach(c.wy, dir * T.spinRate * drive, spinAccel * dt);
    // ...the half turn it settles on kept ahead of where it could stop.
    const ahead = (dir * (k.spinDone + Math.sign(c.wy) * stopOf(c.wy, spinAccel))) / T.spinStep;
    const halves = Math.min(Math.ceil(ahead - 0.1), Math.floor(most / T.spinStep));
    if (halves > (dir * k.spinGoal) / T.spinStep) k.spinGoal = dir * halves * T.spinStep;
  }
  if (!k.spinHeld && owing(k.spinGoal, k.spinDone)) {
    const rate = throwRate(k.spinGoal - k.spinDone, c.wy, T.spinRate, spinAccel, left);
    if (rate === null) {
      k.spinGoal = 0;
      k.spinDone = 0;
    }
    c.wy = rate ?? 0;
  }
}

/** HOW THIS PAIR TURNS A LOOP: the rate it gathers at and the rate it
 * dies away at once let go, rad/s², each the reference pair's scaled by
 * the root of this one's pitch inertia against it. */
export function flipPace(spec: SkierState["spec"]): { accel: number; brake: number } {
  const k = Math.sqrt(inertiaOf(SKIS).x / inertiaOf(spec).x);
  return { accel: T.flipAccel * k, brake: T.flipBrake * k };
}

/** How far a loop turning at `rate` rad/s goes on once let go, rad. */
function stopOf(rate: number, brake: number): number {
  return (rate * rate) / (2 * brake);
}

/** How much of a turn the throw is kept ahead of a held loop, rad — the
 * whole of the view's tuck (`skier-somersault.ts`'s `OPEN`). */
const OPEN = 3.2;

/** THE LEAN THAT TURNS `loops` WHOLE LOOPS the way `dir` goes (+1 back)
 * and lets go in time to come round onto the skis: held while what is
 * turned and what a let-go loop would still carry fall short of them —
 * the bot's hand and the labs' (`sim/moguls-steer.ts`, the ride lab). */
export function flipLean(state: GameState, loops: number, dir: number): number {
  const c = state.skier;
  const k = state.tricks;
  if (c.thrown !== null) return 0;
  const turned = dir * k.rotation;
  const rate = Math.max(0, (owing(k.flipGoal, k.flipDone) ? k.flipSpeed : -c.wx) * dir);
  return turned + stopOf(rate, flipPace(c.spec).brake) < loops * 2 * Math.PI ? dir : 0;
}

/** Whether a throw is under way on an axis: something asked for, or
 * something turned that a stroke the other way has asked back. */
function owing(goal: number, done: number): boolean {
  return goal !== 0 || done !== 0;
}

/** Whether a stroke that would make an axis owe `goal` rad in all, `done`
 * of it turned, is taken: no more than the axis's most (the run's own
 * ceiling — a contest's — or the arcade's), and turnable at the
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

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STROKES — the flips and spins a FREE RIDE or a TRICKS run lets the
// skier throw (`RunRules.stunts`), and his GRABS. They are PHYSICAL: a
// body in the air keeps the turn it left the snow with, and nothing but
// the snow coming back stands him on his feet.
//
// THE THROW IS MADE AT THE TAKE-OFF. Only in the first `setFor` s of a
// flight (after `air.counts`), or wound up the ramp of a kicker and let go
// at its lip, does an axis carried across its gate SET a rotation: the
// lean back the backflip, forward the front flip, the edge over a spin. Held
// across, the rate gathers (`flipSet`, `spinSet`, scaled by the pair's own
// inertia) toward its cruise for as long as it is held in that window — a
// quick tap a slow turn, a long one a fast turn — and then it is SET: the
// window shut, nothing the controls do can add a turn or take one away.
//
// IN THE AIR HE CAN ONLY CHANGE HIS SHAPE. The body's inertia changes with
// it, and the turn with it: the lean held the flip's way is the TUCK — the
// knees to the chest, the loop turning `tuckForm` times as fast — and the
// lean against it the LAYOUT, opened out to `openForm` of it; the edge held
// the spin's way pulls the arms in (`spinIn`), against it throws them out
// (`spinOut`). So a skier who threw too little tucks to bring it round and
// one who threw too much opens out — and the timing is his.
//
// AT THE END HE SPOTS HIS LANDING — if he can. With the snow `catchLook` s
// away and his body not tucked, a skier coming round within `flipCatch` of
// his feet under him (or within `spinCatch` of a line he can ride, forward
// or switch) opens out and slows the turn at no more than `flipCatchBrake`
// (`spinCatchBrake`) to stop square, and once it has stopped the air's own
// hand (`flight.ts`) lays him onto the slope. Turning too fast to stop in
// what is left, he goes over; too slow to come round, he lands short of it;
// and outside that reach he does not try at all: he meets the snow on
// whatever is under him — the tails, the tips, his back, his side — and the
// landing is judged as any other (`crash.ts`).
//
// A KICKER, AND NOT A BUMP. The lean held across the gate up a kicker's ramp
// is one stroke at the lip: the skier set the trick up. Held anywhere else
// on the snow — leaning back to float through powder, which every skier
// does — the crossing is marked as already made, and the same hold off a
// crest buys nothing. On a FREE RIDE a flight takes a stroke only if he
// MEANT it — off a kicker, or in a pop of his own (`popWindow`): a knee
// taken at speed throws him without asking, and the edge he steers across
// it then is his steering (`TrickState.meant`). A BIG FLIGHT is the
// exception for the lean: with a second of air or more ahead (`bigFlight`)
// the lean thrown across its gate in the window is a loop whatever launched
// him.
//
// THE GRABS. With the trick button held in the air the skier's body is off
// the controls and into a grab: one ski kicked forward and one back, the
// daffy (the edge over), both skis flung wide, the spread (the lean back),
// or the body folded to a hand on the ski, the grab (the lean forward, or
// nothing) — and on a board the board's seven (`board-tricks.ts`). While he
// grabs the lean and the edge move his body and not his flight
// (`poseInput`), and the turn he threw goes on as it was.
//
// Nothing here is random and nothing reads a clock: a run replays to the
// same rotation.

import { approach, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { rotate, type Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import { landingAhead, type Landing } from "./flight.ts";
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
 * flies on without them. And while a throw turns him the lean and the edge
 * are his SHAPE (`stepStrokes`), never the air control's torque on top of
 * it. Anything else passes as it is. */
export function poseInput(state: GameState, input: SkierInput): SkierInput {
  if (posing(state, input)) {
    posed.tuck = input.tuck;
    posed.brake = input.brake;
    posed.reset = input.reset;
    posed.jump = input.jump;
    return posed;
  }
  const k = state.tricks;
  const looping = k.flipGoal !== 0;
  const twirling = k.spinGoal !== 0;
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

/** Whether the take-off's window is still open on a skier `airTime` s up:
 * the only time an axis thrown across its gate can set a turn going. */
export function setting(airTime: number): boolean {
  return airTime < TUNING.air.counts + T.setFor;
}

/** THE SHAPE an axis asks for, as a multiple of the open body's rate:
 * `a` the input held the turn's way (positive) or against it, `tight` the
 * multiple fully pulled in and `wide` fully laid out. */
function formOf(a: number, tight: number, wide: number): number {
  return a >= 0 ? 1 + (tight - 1) * Math.min(1, a) : 1 - (1 - wide) * Math.min(1, -a);
}

/** One step of both throws and the grab, run after the skier has been
 * stepped (his flight bookkeeping is current), on a run whose rules let
 * him trick (`RunRules.stunts`). `input` is what the skier asked for,
 * before `poseInput`. */
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
  const down = aloft ? landingAhead(c, state.level, flightGravity(state.rules)) : null;
  const ahead = down ? down.t : Infinity;
  const big = aloft && ahead >= T.bigFlight;
  const launched = aloft && c.launchVy >= T.launch;
  // ...and a throw under way turns on whatever the air left says.
  const flying = launched || big || (aloft && (k.flipGoal !== 0 || k.spinGoal !== 0));
  if (flip === 0) k.flipHeld = false;
  if (spin === 0) k.spinHeld = false;
  if (!flying) {
    clearFlip(state);
    clearSpin(state);
    if (!c.airborne) {
      // ARMED on the snow: across the gate up a kicker's ramp is a stroke
      // waiting for the lip; anywhere else it is a crossing already made.
      // The edge thrown WITH THE JUMP — after the key was pressed, or as the
      // pop leaves the snow — is the spin wound into it, not a turn he was
      // already carving: a crossing made then is left for the air to take.
      const ramp = onRamp(state);
      const jumping = c.jumpLoad > 0 || c.popped <= T.popWindow;
      k.flipCrossed = ramp ? 0 : flip;
      k.spinCrossed = ramp || (jumping && spin !== k.spinCrossed) ? 0 : spin;
      // The flight he leaves the snow on next is MEANT if he leaves it off
      // a kicker or in his own pop; off a knee or a lip he did not jump, a
      // free ride's flight is a fall he steers, and nothing is thrown.
      k.meant = ramp || c.popped <= T.popWindow;
    }
    return;
  }
  // WHAT THE LAST STEP TURNED. Tips up is a negative `wx` (`state.ts`), so
  // a backflip's angle is −wx; a positive `wy` turns the skier clockwise,
  // the way a positive edge does.
  const dt = TUNING.dt;
  if (k.flipGoal !== 0) k.flipDone -= c.wx * dt;
  if (k.spinGoal !== 0) k.spinDone += c.wy * dt;

  const open = setting(c.airTime);
  // A flight he never meant (`TrickState.meant`) is steered, never thrown
  // — a twirl off a knee is his steering — but in a big one the lean is
  // the loop all the same.
  const willed = launched && (k.meant || state.rules.tricks);
  // Grabbing, the body is busy: nothing is thrown and nothing is set, and
  // a throw already going goes on as it was.
  const busy = k.pose !== null;
  const I = inertiaOf(c.spec);
  const ref = inertiaOf(SKIS);

  // THE LOOP: a fresh crossing in the window takes hold, and held, the rate
  // gathers the way the lean went — up to what the run's ceiling lets come
  // round in the air there is (a contest's most, `RunRules.flipMost`).
  if (flip === 0) k.flipCrossed = 0;
  else if (flip !== k.flipCrossed) {
    k.flipCrossed = flip;
    k.flipHeld = open && !busy && (willed || big);
    if (k.flipHeld && k.flipGoal === 0) {
      k.flipSpeed = -c.wx;
      k.flipForm = 1;
      k.flipDone = 0;
      k.flipGoal = flip * 1e-3;
    }
  }
  if (flip !== k.flipCrossed) k.flipHeld = false;
  if (k.flipHeld && open && !busy) {
    const most = state.rules.flipMost ?? T.flipMost;
    const reach = Math.abs(k.flipSpeed) * Math.min(ahead, AIR_MOST) + Math.abs(k.flipDone);
    const accel = T.flipSet * Math.sqrt(ref.x / I.x);
    if (reach < most || Math.sign(k.flipSpeed) !== k.flipCrossed) {
      k.flipSpeed = approach(k.flipSpeed, k.flipCrossed * T.flipRate, accel * dt);
    }
  } else k.flipHeld = false;

  // THE SPIN: the edge thrown TIGHT across its gate — not only in the
  // window but at any moment of a flight he meant (or a big one) while
  // nothing turns him yet and the air left will carry a turn (`spinLate`).
  // Held, it winds up the edge's way, the further over the harder, so a
  // thumb dragged across spins him as hard as it is pushed; let go, it is
  // set, and one flight takes one throw. (A revert under way turns him
  // round itself: nothing on top.)
  if (spin === 0) k.spinCrossed = 0;
  else if (spin !== k.spinCrossed) {
    k.spinCrossed = spin;
    const fresh = k.spinGoal === 0 && ahead >= T.spinLate;
    k.spinHeld = (open || fresh) && !busy && (willed || big) && c.revert == null;
    if (k.spinHeld && k.spinGoal === 0) {
      k.spinSpeed = c.wy;
      k.spinForm = 1;
      k.spinDone = 0;
      k.spinGoal = spin * 1e-3;
    }
  }
  if (spin !== k.spinCrossed) k.spinHeld = false;
  if (k.spinHeld && !busy) {
    const most = state.rules.spinMost ?? T.spinMost;
    const reach = Math.abs(k.spinSpeed) * Math.min(ahead, AIR_MOST) + Math.abs(k.spinDone);
    const accel = T.spinSet * Math.sqrt(ref.y / I.y);
    const drive = 0.5 + 0.5 * clamp((Math.abs(input.steer) - T.spinGate) / (1 - T.spinGate), 0, 1);
    if (reach < most || Math.sign(k.spinSpeed) !== k.spinCrossed) {
      k.spinSpeed = approach(k.spinSpeed, k.spinCrossed * T.spinRate * drive, accel * drive * dt);
    }
  } else k.spinHeld = false;

  if (k.flipGoal !== 0) turnFlip(state, input, down, busy, open);
  if (k.spinGoal !== 0) turnSpin(state, input, down, busy, open);
}

/** One step of a loop under way: its shape off the lean, the body's rate
 * off the shape, the spot at the end, and how far it still has to go. */
function turnFlip(
  state: GameState,
  input: SkierInput,
  down: Landing | null,
  busy: boolean,
  open: boolean,
): void {
  const k = state.tricks;
  const c = state.skier;
  const dt = TUNING.dt;
  const dir = Math.sign(k.flipSpeed) || Math.sign(k.flipGoal);
  const lean = busy ? 0 : clamp(input.lean, -1, 1) * dir;
  k.flipForm = approach(k.flipForm, formOf(lean, T.tuckForm, T.openForm), T.formRate * dt);
  let rate = k.flipSpeed * k.flipForm;
  // Where his feet are: the angle still to turn the way he turns until his
  // body's up meets the snow's, rad, in [0, 2π).
  const n = down ? normalOf(state, down) : UP;
  const u = rotate(c.q, UP);
  const r = rotate(c.q, RIGHT);
  const s = Math.atan2(dot(cross(u, n), r), dot(u, n));
  const left = wrap(-Math.sign(rate || dir) * s, 2 * Math.PI);
  const past = 2 * Math.PI - left;
  // THE SPOT: near the end, not tucked, round past half a turn, and within
  // reach of his feet — ahead of them, or turned past and coming back.
  const spot =
    !open &&
    !busy &&
    down !== null &&
    down.t <= T.catchLook &&
    lean < 0.5 &&
    Math.abs(k.flipDone) > Math.PI &&
    Math.min(left, past) < T.flipCatch;
  if (spot) {
    const brake = T.flipCatchBrake * Math.sqrt(inertiaOf(SKIS).x / inertiaOf(c.spec).x);
    const d = Math.sign(rate) || dir;
    const on = rate * d;
    const want = left <= past ? Math.sqrt(2 * brake * left) : -Math.sqrt(2 * brake * past);
    const next = on > want ? approach(on, want, brake * dt) : on;
    rate = next * d;
    k.flipForm = Math.max(T.openForm, Math.min(k.flipForm, 1));
    k.flipSpeed = rate / k.flipForm;
    if (Math.abs(rate) < STILL && Math.min(left, past) < SQUARE) {
      c.wx = -rate;
      clearFlip(state);
      return;
    }
  }
  c.wx = -rate;
  // ...and for the figure: how far round it is still to go, and how tight.
  k.flipGoal = k.flipDone + (Math.sign(rate) || dir) * Math.max(left, 1e-3);
  k.flipTuck = clamp((k.flipForm - T.openForm) / (T.tuckForm - T.openForm), 0, 1);
}

/** One step of a spin under way: its shape off the edge, the body's rate
 * off it, and the spot onto a line he can ride, forward or switch. */
function turnSpin(
  state: GameState,
  input: SkierInput,
  down: Landing | null,
  busy: boolean,
  open: boolean,
): void {
  const k = state.tricks;
  const c = state.skier;
  const dt = TUNING.dt;
  const dir = Math.sign(k.spinSpeed) || Math.sign(k.spinGoal);
  const steer = busy ? 0 : clamp(input.steer, -1, 1) * dir;
  k.spinForm = approach(k.spinForm, formOf(steer, T.spinIn, T.spinOut), T.formRate * dt);
  let rate = k.spinSpeed * k.spinForm;
  // Where his skis point against the way he is going, about his own up:
  // the angle still to turn the way he turns to the next line he can ride
  // (the way, or switch to it — every half turn), in [0, π).
  const u = rotate(c.q, UP);
  const f = rotate(c.q, FORWARD);
  const vu = c.vx * u.x + c.vy * u.y + c.vz * u.z;
  way.x = c.vx - vu * u.x;
  way.y = c.vy - vu * u.y;
  way.z = c.vz - vu * u.z;
  // On a pipe the air turns him round to the wall he comes down on
  // (`pipe-air.ts`), so the lines are every half turn of the spin itself.
  const pipe = state.level.pipe !== undefined;
  const along = pipe ? 2 : Math.sqrt(dot(way, way));
  const s = pipe ? -k.spinDone : along > 1 ? Math.atan2(dot(cross(f, way), u), dot(f, way)) : 0;
  const left = along > 1 ? wrap(Math.sign(rate || dir) * s, Math.PI) : Math.PI;
  const past = Math.PI - left;
  const spot =
    !open &&
    !k.spinHeld &&
    !busy &&
    along > 1 &&
    down !== null &&
    down.t <= T.catchLook &&
    steer < 0.5 &&
    Math.abs(k.spinDone) > Math.PI / 2 &&
    Math.min(left, past) < T.spinCatch;
  if (spot) {
    const brake = T.spinCatchBrake * Math.sqrt(inertiaOf(SKIS).y / inertiaOf(c.spec).y);
    const d = Math.sign(rate) || dir;
    const on = rate * d;
    const want = left <= past ? Math.sqrt(2 * brake * left) : -Math.sqrt(2 * brake * past);
    const next = on > want ? approach(on, want, brake * dt) : on;
    rate = next * d;
    k.spinForm = Math.max(T.spinOut, Math.min(k.spinForm, 1));
    k.spinSpeed = rate / k.spinForm;
    if (Math.abs(rate) < STILL && Math.min(left, past) < SQUARE) {
      c.wy = rate;
      clearSpin(state);
      return;
    }
  }
  c.wy = rate;
  k.spinGoal = k.spinDone + (Math.sign(rate) || dir) * Math.max(left, 1e-3);
}

/** The snow's normal where the flight comes down. */
function normalOf(state: GameState, down: Landing): Vec3 {
  if (down.wall) return down.wall;
  state.level.normalAt(down.x, down.z, ground);
  return ground;
}

function clearFlip(state: GameState): void {
  const k = state.tricks;
  k.flipGoal = 0;
  k.flipDone = 0;
  k.flipSpeed = 0;
  k.flipForm = 1;
  k.flipTuck = 0;
  k.flipHeld = false;
}

function clearSpin(state: GameState): void {
  const k = state.tricks;
  k.spinGoal = 0;
  k.spinDone = 0;
  k.spinSpeed = 0;
  k.spinForm = 1;
  k.spinHeld = false;
}

/** HOW THIS PAIR TURNS A LOOP: the rate it is set going at in the window
 * and the most the spot can shed, rad/s², each the reference pair's scaled
 * by the root of this one's pitch inertia against it. */
export function flipPace(spec: SkierState["spec"]): { accel: number; brake: number } {
  const k = Math.sqrt(inertiaOf(SKIS).x / inertiaOf(spec).x);
  return { accel: T.flipSet * k, brake: T.flipCatchBrake * k };
}

/** THE HAND THAT THROWS `turns` rad on an axis the way `dir` goes and
 * brings it round on the snow — the bot's and the labs': in the window it
 * winds the throw up until the open body would turn what is owed in the
 * air left, and after it tucks while the turn would come round short and
 * opens out while it would go over, leaving the spot the rest. */
function aimed(
  state: GameState,
  turns: number,
  dir: number,
  done: number,
  speed: number,
  going: boolean,
  slack: number,
  period: number,
  most: number,
  goal: number,
  cut = period,
  gain = 0,
): number {
  const c = state.skier;
  if (c.thrown !== null || !c.airborne) return 0;
  // The skis meet the snow before the CoG is back at its standing height
  // (a leg's give, a tip pitched down), so the bot reads the flight to
  // `LANDS_HIGH` over it.
  const down = landingAhead(c, state.level, flightGravity(state.rules), LANDS_HIGH);
  const t = down ? down.t : 1;
  const turned = going ? done * dir : 0;
  const ahead = turned + Math.max(0, going ? speed * dir : 0) * t;
  // A plan more than the air can hold is cut to the whole turns it can:
  // the most the body turns is `most` rad/s, less the window still to
  // wind it up.
  const left = Math.max(0, TUNING.air.counts + T.setFor - c.airTime);
  const reach = turned + most * Math.max(0, t - left / 2);
  const owed = Math.min(turns, Math.floor(reach / cut) * cut);
  // Committed, he goes through with it.
  if (!going) {
    if (owed <= 0) return 0;
    turns = owed;
  }
  // Once turning, the lines he can land on are known (the next is the
  // goal, the one just passed behind it, the rest a `period` apart): aim
  // at the one nearest the plan, never back at one long gone.
  if (going) {
    const next = goal * dir;
    const back = next - turned > period / 2 ? -1 : 0;
    turns = next + period * Math.max(back, Math.round((turns - next) / period));
  }
  // In the window a step held adds `gain` rad/s, so he lets go once half
  // a step more would carry him past the plan: the nearer of the two.
  if (setting(c.airTime)) return ahead + (gain * TUNING.dt * t) / 2 < turns ? dir : 0;
  if (!going) return 0;
  if (ahead < turns - slack) return dir;
  if (ahead > turns + slack) return -dir;
  return 0;
}

/** THE LEAN THAT TURNS `loops` WHOLE LOOPS the way `dir` goes (+1 back). */
export function flipLean(state: GameState, loops: number, dir: number): number {
  const k = state.tricks;
  return aimed(
    state,
    loops * 2 * Math.PI,
    dir,
    k.flipDone,
    k.flipSpeed,
    k.flipGoal !== 0,
    0.35,
    2 * Math.PI,
    Math.min(T.flipRate, T.flipSet * T.setFor),
    k.flipGoal,
  );
}

/** THE EDGE THAT TURNS `halves` HALF TURNS the way `dir` goes (+1
 * clockwise from above); `forward` cuts a plan the air cannot hold to
 * whole turns, never one that comes down switch. */
export function spinSteer(state: GameState, halves: number, dir: number, forward = false): number {
  const k = state.tricks;
  const most = Math.min(T.spinRate, T.spinSet * T.setFor);
  const cut = forward ? 2 * Math.PI : Math.PI;
  return aimed(
    state,
    halves * Math.PI,
    dir,
    k.spinDone,
    k.spinSpeed,
    k.spinGoal !== 0,
    0.3,
    Math.PI,
    most,
    k.spinGoal,
    cut,
    T.spinSet,
  );
}

/** A turn this slow, rad/s, this close to square, rad, is stopped: the
 * rest is the air's own hand's. */
const SQUARE = 0.12;
/** The air a throw is wound up against when no snow is in sight, s. */
const AIR_MOST = 3;
/** How far over his standing height the bot reckons the skis meet the
 * snow, m. */
const LANDS_HIGH = 0.4;
const STILL = 0.4;

/** `a` wrapped into [0, m). */
function wrap(a: number, m: number): number {
  return ((a % m) + m) % m;
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

const UP: Vec3 = { x: 0, y: 1, z: 0 };
const RIGHT: Vec3 = { x: 1, y: 0, z: 0 };
const FORWARD: Vec3 = { x: 0, y: 0, z: 1 };
const ground: Vec3 = { x: 0, y: 1, z: 0 };
const way: Vec3 = { x: 0, y: 0, z: 0 };

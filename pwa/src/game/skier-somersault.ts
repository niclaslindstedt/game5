// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SOMERSAULT, AS A BODY TURNS ONE — how the skier carries himself
// through a loop the lean has thrown (`strokes.ts`: the backflip, the front
// flip), and the grabs' feet. Three-free, so the suite reads it;
// presentation only — the rotation is the engine's own.
//
// A somersault is turned TUCKED. The body's inertia about its side axis
// tucked is a fraction of its inertia laid out, so a skier pulls his knees
// up to his chest and takes hold of his shins to bring a flip round in the
// air a kicker gives him — film of park skiers and of aerialists agrees,
// and coaches tell a first backflip exactly that: knees to the chest, the
// tighter the quicker. Through the last of the turn he OPENS — the legs
// let down toward the snow and the hands off the shins — which slows the
// rotation and lets him spot the landing; a backflipper with his head
// thrown back looking for the snow over it, a front flipper with his chin
// in until the snow comes up in front of him.
//
// So the tuck is the ENGINE'S own (`TrickState.flipTuck`, the shape the
// player's lean holds him in, which is what turns him faster or slower);
// where a caller has none it is read off the throw (`flipGoal` /
// `flipDone`), full while most of a loop is owed and let go through the
// last `OPEN` rad of it — eased on a quick spring either way. A plank that tips over is what the
// figure is without it — the lean's pose held stiff while the skis go
// round.

import { add, mix, type V3 } from "./skier-vec.ts";
import type { TrickPose } from "@engine";
import type { FlightShape } from "./skier-flight.ts";

/** The throw as the engine keeps it: the angle owed in all and turned so
 * far, rad, back positive (`TrickState`). */
export type FlipThrow = {
  readonly flipGoal: number;
  readonly flipDone: number;
  /** How tucked the engine has him, 0..1, where it says (`TrickState`). */
  readonly flipTuck?: number;
};

/** THE TUCK as the view carries it between frames. */
export type Somersault = {
  /** How tucked he is, 0..1, and how fast that is changing. */
  tuck: number;
  rate: number;
  /** Which way the loop goes: +1 back, −1 forward (the last one thrown). */
  dir: number;
  /** How far the loop owns his body, 0..1: whole from the throw to the
   * snow, let go of over a moment after it. */
  own: number;
  /** How far round the loop he is, 0..1, and how fast that is changing:
   * eased, since the engine's goal moves the moment the lean is let go
   * (held, it owes the opening on top of the stop) and what was a third
   * of the way round was two thirds in a frame. */
  u: number;
  uRate: number;
};

/** What the pose is handed: how tucked, which way he turns, how far the
 * loop owns him and how far round it he is. */
export type SomersaultShape = { tuck: number; dir: number; own: number; u: number };

export function createSomersault(): Somersault {
  return { tuck: 0, rate: 0, dir: 1, own: 0, u: 0, uRate: 0 };
}

/** How much of the loop still owed he turns opening out, rad: the last
 * ~140° of it — opening from just past half way round (upside down, the
 * snow coming into view), so he is open by the time it stops, as a skier
 * is taught to open and spot. */
export const OPEN = 3.2;
/** How quickly he pulls into the tuck and lets out of it, rad/s of a
 * critically damped spring: the pull a fifth of a second from the throw
 * (long enough for the arms to be seen swinging into it), the opening a
 * little quicker — he kicks the legs out at the snow. */
const PULL = 16;
const LET = 26;
/** How quickly the loop lets go of his body once he is down, /s. */
const RELEASE = 5;
/** How quickly the drawn way round follows the engine's, rad/s of a
 * critically damped spring. */
const ROUND = 22;

/** How tucked a throw asks him to be, 0..1: none with no loop owed, whole
 * while more than `OPEN` is, let out steadily over the last of it. */
export function tuckAim(t: FlipThrow | null | undefined): number {
  if (!t || (t.flipGoal === 0 && t.flipDone === 0)) return 0;
  if (t.flipTuck !== undefined) return t.flipTuck;
  const owed = Math.abs(t.flipGoal - t.flipDone);
  return Math.min(1, owed / OPEN);
}

/** One frame of the tuck, `dt` s, toward what the throw asks (none when
 * there is no throw — on the snow, thrown, or on a run with no tricks). */
export function stepSomersault(s: Somersault, t: FlipThrow | null | undefined, dt: number): void {
  const aim = tuckAim(t);
  const thrown = !!t && t.flipGoal !== 0;
  if (thrown) {
    s.dir = Math.sign(t.flipGoal);
    const u = Math.min(1, Math.max(0, t.flipDone / t.flipGoal));
    if (s.own <= 0 || dt <= 0) {
      s.u = u;
      s.uRate = 0;
    } else {
      const x = s.u - u;
      const e = Math.exp(-ROUND * dt);
      const v = s.uRate + ROUND * x;
      s.u = Math.min(1, Math.max(0, u + (x + v * dt) * e));
      s.uRate = (s.uRate - ROUND * v * dt) * e;
    }
  }
  if (dt <= 0) return;
  s.own = thrown ? 1 : Math.max(0, s.own - RELEASE * dt);
  const w = aim > s.tuck ? PULL : LET;
  // A critically damped spring, stepped exactly over the frame.
  const x = s.tuck - aim;
  const e = Math.exp(-w * dt);
  const v = s.rate + w * x;
  s.tuck = Math.min(1, Math.max(0, aim + (x + v * dt) * e));
  s.rate = (s.rate - w * v * dt) * e;
}

/** The tuck as the pose is handed it, or none once the loop has let go. */
export function somersaultOf(s: Somersault): SomersaultShape | undefined {
  return s.tuck > 0.005 || s.own > 0.005
    ? { tuck: s.tuck, dir: s.dir, own: s.own, u: s.u }
    : undefined;
}

/** What a skier's pose is laid onto by a loop (`SkierPoseInput`'s). */
type LaidPose = { somersault?: SomersaultShape; flight?: FlightShape; lean: number };

/** A rider's tuck as the view keeps it: stepped each frame off the throw
 * and handed to the pose — and, on skis, LAID on it: a loop owns his body
 * while it turns, its own arms over the fall's, and the lean that threw it
 * no longer drawn as a lean. */
export function createTuck(): {
  step(t: FlipThrow | null | undefined, dt: number, stand?: { lift: number[] }): void;
  shape(): SomersaultShape | undefined;
  lay(pose: LaidPose): void;
} {
  const s = createSomersault();
  return {
    step(t, dt, stand) {
      stepSomersault(s, t, dt);
      // ...the skis pulled up under him with the knees.
      if (stand) for (let i = 0; i < 2; i++) stand.lift[i] += flipLift(somersaultOf(s));
    },
    shape: () => somersaultOf(s),
    lay(pose) {
      pose.somersault = somersaultOf(s);
      pose.flight = withFlip(pose.flight, pose.somersault);
      pose.lean *= 1 - (pose.somersault?.own ?? 0);
    },
  };
}

/** HOW FAR THE TUCK PULLS THE FEET UP, m in the body frame: a flip is
 * tucked as a BALL, not a racer's egg — the heels drawn in under the seat
 * and the knees up past the hips to the chest, so the skis come up close
 * under him and turn round with him rather than a man sat in a chair
 * hanging off them. */
export const FLIP_LIFT = 0.45;

export function flipLift(f: SomersaultShape | undefined): number {
  return f ? FLIP_LIFT * Math.max(0, Math.min(1, f.tuck)) : 0;
}

/** THE SKIER RIGHT WAY ROUND. His yaw, pitch and roll as the engine
 * states them (the pitch kept within a quarter turn) go over the top of a
 * loop as half a turn of heading and a half roll — the same body, but a
 * figure that reads the roll as how far he leans over lays itself out
 * beside its skis, and a lens that reads the heading swings round to his
 * side. Past a quarter roll the same turn is read the other way round: the
 * heading turned back, the pitch carried on past upright, the roll near
 * level. */
export function uprightSkier<T extends { heading: number; pitch: number; roll: number }>(s: T): T {
  if (Math.abs(s.roll) <= Math.PI / 2) return s;
  return {
    ...s,
    heading: s.heading + (s.heading > 0 ? -Math.PI : Math.PI),
    pitch: (s.pitch >= 0 ? Math.PI : -Math.PI) - s.pitch,
    roll: s.roll - Math.sign(s.roll) * Math.PI,
  };
}

/** THE THREE MOMENTS OF A LOOP, each 0..1: the THROW (out of the tuck on
 * the way into it, the arms swinging), the TUCK, and the OPENING (out of
 * it on the far side — the legs let down at the snow, the arms out). */
export function flipPhases(f: SomersaultShape | undefined): {
  pop: number;
  tuck: number;
  open: number;
} {
  if (!f) return { pop: 0, tuck: 0, open: 0 };
  const k = Math.max(0, Math.min(1, f.tuck));
  const own = Math.max(0, Math.min(1, f.own ?? 1));
  const late = smooth((f.u - 0.3) / 0.3);
  return { pop: own * (1 - k) * (1 - late), tuck: k, open: own * (1 - k) * late };
}

/** WHAT THE TUCK DOES TO THE BODY, off its shape: how far it folds him
 * (as a crouch, `skier-pose.ts`'s — the knees up, the back rounded), how
 * far the head is bowed (+, chin in) or thrown back (−, spotting over it),
 * how far the hands are on the shins, and the trunk's own pitch (+ over
 * the knees, − the chest up).
 *
 * A BACKFLIP is thrown from the hips with the chest lifted and the head
 * only a little back, pulled into the tuck with the eyes kept level, and
 * opened with the head going back to look for the snow over it and the
 * chest coming up off the knees. A FRONT FLIP is thrown by dropping the
 * shoulders, turned chin in, and opened with the head up to see the
 * landing come in front of him. */
export function tuckOf(f: SomersaultShape | undefined): {
  crouch: number;
  nod: number;
  hold: number;
  round: number;
  pitch: number;
  hips: V3;
  knee: number;
} {
  if (!f) return NO_TUCK;
  const { pop, tuck: k, open } = flipPhases(f);
  const back = f.dir > 0;
  // OPENING IS THE HIPS STRAIGHTENING: the chest comes up off the knees
  // as the legs go down to the snow, never the trunk left folded over
  // thighs that are already reaching — what the tuck's bow (a crouch's,
  // some 0.9 rad at the full fold) is let out of, from upside down on.
  const unfold = (back ? 0.85 : 0.3) * k * (f.own ?? 1) * smooth((f.u - 0.5) / 0.3);
  return {
    crouch: k,
    nod: back ? 0.1 * k - 0.55 * open - 0.15 * pop : 0.45 * k + 0.25 * pop - 0.25 * open,
    pitch: (back ? -0.3 * pop - 0.3 * open : 0.35 * pop + 0.3 * open) - unfold - BALL.up * k,
    hold: k,
    round: 0.5 * k,
    hips: { x: 0, y: -BALL.drop * k, z: -BALL.back * k },
    knee: BALL.knee * k,
  };
}
const NO_TUCK = {
  crouch: 0,
  nod: 0,
  hold: 0,
  round: 0,
  pitch: 0,
  hips: { x: 0, y: 0, z: 0 },
  knee: 0,
};
/** THE BALL a flip is tucked into, beside a racer's egg: the hips let
 * down to the heels' height (`drop`, m) and back over them (`back`, m), the
 * knees folded past the egg's (`knee`, in shares of the egg's own fold
 * past a skier's bent knee — `skier-limbs.ts`'s `kneeRoom`) and the trunk
 * stood up off them (`up`, rad) so the chest comes onto the knees. */
const BALL = { drop: 0.14, back: 0.04, knee: 1.8, up: 0.95 };

/** The arms through a loop, as the fall's arms are stated
 * (`skier-flight.ts`'s `FlightShape`: rad from hanging, forward positive,
 * rad out of the body's plane, the share of the arm): thrown UP over the
 * head into a backflip and swung DOWN through into a front flip, and flung
 * out wide to the sides opening out of either — the arms spread to slow
 * the turn and to balance for the snow. */
const ARMS = {
  back: { arm: 2.7, out: 0.35, span: 0.95 },
  front: { arm: 0.55, out: 0.3, span: 0.9 },
  open: { arm: 1.55, out: 1.2, span: 0.95 },
};

/** The fall's arms and trunk (`skier-flight.ts`) with a loop laid over
 * them: while the loop owns him the arms are its own (the hands on the
 * shins over the tuck are `holdShins`'), and the fall's spotting and
 * reaching are let go — he is upside down, not spotting a landing he
 * cannot see. */
export function withFlip(
  fall: FlightShape | undefined,
  f: SomersaultShape | undefined,
): FlightShape | undefined {
  if (!f || f.own <= 0) return fall;
  const own = Math.max(0, Math.min(1, f.own));
  const { pop, open } = flipPhases(f);
  const thrown = f.dir > 0 ? ARMS.back : ARMS.front;
  const fw = Math.min(1, pop + open);
  const at = (k: "arm" | "out" | "span") =>
    fw > 0 ? (pop * thrown[k] + open * ARMS.open[k]) / (pop + open) : ARMS.open[k];
  const w0 = (fall?.w ?? 0) * (1 - own);
  const w1 = fw * own;
  const of = (k: "arm" | "out" | "span", none: number) =>
    w0 + w1 > 0 ? ((fall ? fall[k] : none) * w0 + at(k) * w1) / (w0 + w1) : at(k);
  return {
    w: w0 + w1,
    arm: of("arm", 0),
    out: of("out", 0),
    span: of("span", 0),
    pitch: (fall?.pitch ?? 0) * (1 - own),
    nod: (fall?.nod ?? 0) * (1 - own),
    lift: (fall?.lift ?? 0) * (1 - own),
    along: (fall?.along ?? 0) * (1 - own),
    keep: 1 - (1 - (fall?.keep ?? 1)) * (1 - own),
    bow: (fall?.bow ?? 0) * (1 - own),
  };
}

function smooth(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/** THE HANDS ON THE SHINS: each fist taken from where it is to the front
 * of its own shin a hand under the knee (a front flip's a little higher,
 * round the knees), by the tuck's `hold`. `side` is −1 left, +1 right. */
export function holdShins(
  hands: [V3, V3],
  knees: readonly [V3, V3],
  feet: readonly [V3, V3],
  hold: number,
  dir: number,
): void {
  if (hold <= 0) return;
  const down = dir < 0 ? 0.12 : 0.3;
  for (const i of [0, 1]) {
    const side = i ? 1 : -1;
    const shin = add(mix(knees[i], feet[i], down), { x: side * 0.06, y: 0.02, z: 0.07 });
    hands[i] = mix(hands[i], shin, hold);
  }
}

/** THE GRABS' FEET, in the air: a DAFFY kicks one ski forward and one
 * back, a SPREAD flings both wide (a GRAB's fold is the hands'). */
export function trickFeet(feet: [V3, V3], trick: TrickPose | null | undefined): void {
  if (trick === "daffy") {
    feet[0] = { x: feet[0].x, y: feet[0].y - 0.1, z: feet[0].z - 0.45 };
    feet[1] = { x: feet[1].x, y: feet[1].y + 0.1, z: feet[1].z + 0.5 };
  } else if (trick === "spread") {
    feet[0] = { x: feet[0].x - 0.45, y: feet[0].y + 0.15, z: feet[0].z + 0.08 };
    feet[1] = { x: feet[1].x + 0.45, y: feet[1].y + 0.15, z: feet[1].z + 0.08 };
  }
}

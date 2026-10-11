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
// So the tuck is read off the THROW (`TrickState.flipGoal` / `.flipDone`):
// full while most of a loop is still owed, let go through the last
// `OPEN` rad of it, and eased on a quick spring so it pulls in as the throw
// gathers and is open before the snow. A plank that tips over is what the
// figure is without it — the lean's pose held stiff while the skis go
// round.

import { add, mix, type V3 } from "./skier-vec.ts";
import type { TrickPose } from "@engine";

/** The throw as the engine keeps it: the angle owed in all and turned so
 * far, rad, back positive (`TrickState`). */
export type FlipThrow = { readonly flipGoal: number; readonly flipDone: number };

/** THE TUCK as the view carries it between frames. */
export type Somersault = {
  /** How tucked he is, 0..1, and how fast that is changing. */
  tuck: number;
  rate: number;
  /** Which way the loop goes: +1 back, −1 forward (the last one thrown). */
  dir: number;
};

/** What the pose is handed: how tucked, and which way he turns. */
export type SomersaultShape = { tuck: number; dir: number };

export function createSomersault(): Somersault {
  return { tuck: 0, rate: 0, dir: 1 };
}

/** How much of the loop still owed he turns opening out, rad: the last
 * ~140° of it — opening from just past half way round (upside down, the
 * snow coming into view), so he is open by the time it stops, as a skier
 * is taught to open and spot. */
export const OPEN = 2.4;
/** How quickly he pulls into the tuck and lets out of it, rad/s of a
 * critically damped spring: the pull is a snatch of the knees, the
 * opening a little slower. */
const PULL = 30;
const LET = 30;

/** How tucked a throw asks him to be, 0..1: none with no loop owed, whole
 * while more than `OPEN` is, let out steadily over the last of it. */
export function tuckAim(t: FlipThrow | null | undefined): number {
  if (!t || (t.flipGoal === 0 && t.flipDone === 0)) return 0;
  const owed = Math.abs(t.flipGoal - t.flipDone);
  return Math.min(1, owed / OPEN);
}

/** One frame of the tuck, `dt` s, toward what the throw asks (none when
 * there is no throw — on the snow, thrown, or on a run with no tricks). */
export function stepSomersault(s: Somersault, t: FlipThrow | null | undefined, dt: number): void {
  const aim = tuckAim(t);
  if (t && t.flipGoal !== 0) s.dir = Math.sign(t.flipGoal);
  if (dt <= 0) return;
  const w = aim > s.tuck ? PULL : LET;
  // A critically damped spring, stepped exactly over the frame.
  const x = s.tuck - aim;
  const e = Math.exp(-w * dt);
  const v = s.rate + w * x;
  s.tuck = Math.min(1, Math.max(0, aim + (x + v * dt) * e));
  s.rate = (s.rate - w * v * dt) * e;
}

/** The tuck as the pose is handed it, or none when he is open. */
export function somersaultOf(s: Somersault): SomersaultShape | undefined {
  return s.tuck > 0.005 ? { tuck: s.tuck, dir: s.dir } : undefined;
}

/** A rider's tuck as the view keeps it: stepped each frame off the throw
 * and handed to the pose. */
export function createTuck(): {
  step(t: FlipThrow | null | undefined, dt: number): void;
  shape(): SomersaultShape | undefined;
} {
  const s = createSomersault();
  return { step: (t, dt) => stepSomersault(s, t, dt), shape: () => somersaultOf(s) };
}

/** WHAT THE TUCK DOES TO THE BODY, off its shape: how far it folds him
 * (as a crouch, `skier-pose.ts`'s — the knees up, the back rounded), how
 * far the head is bowed (+, chin in) or thrown back (−, spotting over it),
 * and how far the hands are on the shins. */
export function tuckOf(f: SomersaultShape | undefined): {
  crouch: number;
  nod: number;
  hold: number;
  round: number;
  pitch: number;
} {
  if (!f) return NO_TUCK;
  const k = Math.max(0, Math.min(1, f.tuck));
  const back = f.dir > 0;
  return {
    // Opening out of a backflip the legs come down ahead of him toward the
    // snow first: the fold let go sooner than the hands.
    crouch: back ? k * k : k,
    // A backflipper's head goes back to look for the snow behind him, and
    // his chest comes up off his knees as he opens toward it; a front
    // flipper keeps his chin in and stays curled over until the snow.
    nod: back ? -0.35 * k : 0.45 * k,
    pitch: back ? -2.4 * k * (1 - k) : 0,
    hold: k,
    round: 0.5 * k,
  };
}
const NO_TUCK = { crouch: 0, nod: 0, hold: 0, round: 0, pitch: 0 };

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

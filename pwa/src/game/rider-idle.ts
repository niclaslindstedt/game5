// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER AT EASE — the rider card's skier, off his skis, standing calmly
// in his boots on the snow: the feet a boot's width apart, the shins leaned
// into the boots' forward flex so his knees never lock, the arms hanging
// loose at his sides with the elbows soft, and nothing moving but his
// breathing — the chest lifting and settling — a slow, small shift of his
// weight from one leg to the other and his head turning a little now and
// then. One key (`party-pose.ts`'s `Key`), every motion in it a slow sine
// so nothing ever snaps, laid on the body by `keyPoints` and read into the
// figure's joints as the afterski's moves are. Three-free, so the suite
// reads it.

import { blend, keyPoints, STAND, v, type Key } from "./party-pose.ts";
import { ragdollPose, type BodyFrame } from "./skier-ragdoll.ts";
import type { SkierPose } from "./skier-joints.ts";

/** A breath, s: in and out, a resting adult's dozen or so a minute. */
const BREATH = 4.6;
/** The weight carried from one leg to the other and back, s. */
const SHIFT = 11;
/** The head's slow look about, s. */
const LOOK = 17;

const wave = (t: number, period: number, phase = 0): number =>
  Math.sin((2 * Math.PI * t) / period + phase);

/** THE KEY he is at, `t` s into his wait. */
export function idleKey(t: number): Key {
  const k = blend(STAND, STAND, 0);
  // In: the chest up and the shoulders a touch back; out: settled again.
  const breath = 0.5 + 0.5 * wave(t, BREATH);
  // His weight, −1 over his left leg … 1 over his right — never far.
  const weight = wave(t, SHIFT, 0.4);
  k.hipY = 0.95 + 0.004 * breath;
  k.hipX = 0.018 * weight;
  k.hipZ = -0.03;
  k.pitch = 0.05 - 0.015 * breath;
  k.roll = -0.015 * weight;
  k.twist = 0.02 * wave(t, SHIFT * 1.3, 1.1);
  k.nod = 0.02 * breath + 0.03 * wave(t, LOOK * 0.7, 2);
  k.twist += 0.06 * wave(t, LOOK, 0.6);
  k.feet = [v(-0.14, 0.09, 0.0), v(0.14, 0.09, 0.01)];
  // The arms hang from the shoulders (±0.2) a hair out past the jacket,
  // the elbows soft so the hands sit at the thighs' side, the palms in;
  // the breath rocks them a few millimetres.
  const sway = 0.008 * breath;
  k.hands = [
    v(-0.25 + 0.4 * k.hipX, k.hipY - 0.12, 0.03 + sway),
    v(0.25 + 0.4 * k.hipX, k.hipY - 0.12, 0.03 + sway),
  ];
  return k;
}

/** THE POSE he is at, `t` s into his wait, over the snow at `ground` in
 * the frame its trunk makes (written into `frame`). */
export function idlePose(t: number, ground: number, frame: BodyFrame): SkierPose {
  return ragdollPose(keyPoints(idleKey(t), ground), frame);
}

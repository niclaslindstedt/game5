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

import { gearOf, type Outfit, type PantsId } from "./outfit.ts";
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

/** A thigh's radius at its top on the medium build, m (a 625 mm girth). */
const THIGH = 0.1;

/** How much more a pair of pants stands off the thigh than the insulated
 * pair, m — each cut's ease over the thigh (`dress-garments.ts`'s
 * `PANTS_CUT`) less the insulated one's 0.024, a race pair's closer cut
 * taken as none. */
const LOOSER: Record<PantsId, number> = { insulated: 0, race: 0, baggy: 0.026, cargo: 0.01 };

/** THE ROOM HIS LEGS TAKE past the medium build in insulated pants, m: a
 * heavier build's rounder thighs (the limbs take 0.7 of the trunk's girth,
 * `dress-body.ts`'s `builtTo`) and a looser pair's ease over them — how
 * much further out his fists hang so a glove never sinks into his pants. */
export function idleRoom(o: Outfit): number {
  const limb = 1 + (gearOf("weight", o.weight).girth - 1) * 0.7;
  return Math.max(0, THIGH * (limb - 1)) + LOOSER[o.pants];
}

/** THE KEY he is at, `t` s into his wait, his fists hung `room` m further
 * out for a broader leg (`idleRoom`). */
export function idleKey(t: number, room = 0): Key {
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
  // the elbows soft so the hands sit at the thighs' side, a little ahead of
  // them, the palms in — the fist's width clear of the pants at the thigh's
  // fullest (its outside about 0.24 m out on the medium build), so the
  // glove's curled fingers rest against the cloth and never sink into it;
  // the breath rocks them a few millimetres.
  const sway = 0.008 * breath;
  const out = 0.3 + room;
  k.hands = [
    v(-out + 0.4 * k.hipX, k.hipY - 0.12, 0.06 + sway),
    v(out + 0.4 * k.hipX, k.hipY - 0.12, 0.06 + sway),
  ];
  return k;
}

/** THE POSE he is at, `t` s into his wait, over the snow at `ground` in
 * the frame its trunk makes (written into `frame`), his fists `room` m
 * further out (`idleRoom`). */
export function idlePose(t: number, ground: number, frame: BodyFrame, room = 0): SkierPose {
  return ragdollPose(keyPoints(idleKey(t, room), ground), frame);
}

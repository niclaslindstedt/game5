// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER AT EASE — the rider card's skier, off his skis, standing about
// in his boots on the snow the way a skier waits at the foot of a lift: his
// weight on one leg and then the other, his shins leaned into the boots'
// forward flex so his knees never lock, breathing, looking up the hill and
// round about him, beating his gloves together against the cold, his hands
// on his hips, a glove pushed up to settle his goggles on the helmet. A
// loop of a handful of HABITS, each a key (`party-pose.ts`'s `Key`) alive
// with its own small motions, eased from one into the next so nothing
// snaps — laid on the body by `keyPoints` and read into the figure's
// joints as the afterski's moves are. Three-free, so the suite reads it.

import { blend, keyPoints, STAND, v, type Key } from "./party-pose.ts";
import { ragdollPose, type BodyFrame } from "./skier-ragdoll.ts";
import type { SkierPose } from "./skier-joints.ts";

/** How long each habit is held, s, and how long one eases into the next. */
export const HABIT_HOLD = 4.6;
export const HABIT_EASE = 1.3;

const smooth = (k: number): number => {
  const c = Math.max(0, Math.min(1, k));
  return c * c * (3 - 2 * c);
};

/** A skier stood in his boots: the cuffs hold his shins leaned forward, so
 * his hips sit a little lower and back of a man in shoes, the feet a
 * boot's width apart. */
function base(t: number, weight: number): Key {
  const k = blend(STAND, STAND, 0);
  k.hipY = 0.9;
  k.hipZ = -0.03;
  k.pitch = 0.08;
  // Breathing: the chest up and the shoulders back every few seconds.
  const breath = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 4.2);
  k.pitch -= 0.025 * breath;
  k.nod = 0.03 * breath;
  // His weight over one leg (`weight` −1 his left … 1 his right): the hips
  // out over it and dropped on the other side, the free knee let go.
  k.hipX = 0.045 * weight;
  k.roll = -0.05 * weight;
  k.feet = [v(-0.15, 0.09, 0.03), v(0.15, 0.09, 0.03)];
  const free = weight > 0 ? 0 : 1;
  k.feet[free] = v(free ? 0.19 : -0.19, 0.09, 0.1);
  k.hands = [v(-0.27, 0.76, 0.05), v(0.27, 0.76, 0.05)];
  // A little sway on the standing leg, never still.
  k.hipX += 0.008 * Math.sin((2 * Math.PI * t) / 6.1);
  return k;
}

/** THE HABITS, each a key at `t` s into the wait. */
const HABITS: readonly ((t: number) => Key)[] = [
  // At ease on his right leg, the arms hanging loose, a glance about.
  (t) => {
    const k = base(t, 1);
    k.twist = 0.12 * Math.sin((2 * Math.PI * t) / 5.5);
    k.hands[0] = v(-0.26, 0.77, 0.1);
    return k;
  },
  // A glove up to settle the goggles on the helmet, the head dipped to it.
  (t) => {
    const k = base(t, 0.7);
    const fuss = 0.5 + 0.5 * Math.sin(t * 3.1);
    k.hands[1] = v(0.08 + 0.02 * fuss, k.hipY + 0.73, 0.16);
    k.nod = -0.18;
    k.pitch = 0.1;
    return k;
  },
  // Looking up the hill and round, the weight carried over to the left.
  (t) => {
    const k = base(t, -1);
    k.twist = -0.28 * Math.sin((2 * Math.PI * t) / HABIT_HOLD / 1.6 + 0.3);
    k.nod = 0.22 + 0.05 * Math.sin(t * 1.3);
    k.pitch = 0.02;
    return k;
  },
  // The gloves beaten together against the cold, then rubbed.
  (t) => {
    const k = base(t, 0.3);
    const beat = Math.max(0, Math.sin(t * 2 * Math.PI * 1.6));
    const gap = 0.05 + 0.07 * beat;
    const y = k.hipY + 0.32 + 0.015 * Math.sin(t * 7);
    k.hands = [v(-gap, y, 0.3), v(gap, y + 0.01, 0.31)];
    k.pitch = 0.12;
    k.nod = -0.12;
    return k;
  },
  // Hands on his hips, elbows out, weight on the left.
  (t) => {
    const k = base(t, -0.8);
    k.hands = [v(-0.2, k.hipY + 0.08, -0.03), v(0.2, k.hipY + 0.08, -0.03)];
    k.pitch = 0.03;
    k.twist = 0.15 * Math.sin((2 * Math.PI * t) / 6.5);
    return k;
  },
];

/** THE KEY he is at, `t` s into his wait: the habit he is in, eased into
 * the next over its last `HABIT_EASE` s. */
export function idleKey(t: number): Key {
  const n = HABITS.length;
  const span = HABIT_HOLD + HABIT_EASE;
  const at = Math.max(0, t);
  const i = Math.floor(at / span) % n;
  const into = at % span;
  // Every habit is read at the one clock, so none jumps as it hands over.
  const now = HABITS[i](at);
  if (into < HABIT_HOLD) return now;
  const next = HABITS[(i + 1) % n](at);
  const s = smooth((into - HABIT_HOLD) / HABIT_EASE);
  const k = blend(now, next, s);
  // A hand carried from one habit's place to the next swings out and
  // forward on its way, as a hand does, rather than through his shoulder —
  // where the arm's reach would fold the elbow over in a frame.
  const arc = 4 * s * (1 - s);
  k.hands = [
    v(k.hands[0].x - 0.12 * arc, k.hands[0].y, k.hands[0].z + 0.2 * arc),
    v(k.hands[1].x + 0.12 * arc, k.hands[1].y, k.hands[1].z + 0.2 * arc),
  ];
  return k;
}

/** THE POSE he is at, `t` s into his wait, over the snow at `ground` in
 * the frame its trunk makes (written into `frame`). */
export function idlePose(t: number, ground: number, frame: BodyFrame): SkierPose {
  return ragdollPose(keyPoints(idleKey(t), ground), frame);
}

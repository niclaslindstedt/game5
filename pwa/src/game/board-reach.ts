// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWBOARDER'S LEGS KEPT THEIR LENGTH: the rule `board-pose.ts` holds
// every leg to before it is drawn — no cuff further from its hip than the
// thigh and the shin reach, none closer than the knees fold. A cuff out of
// either is a shin the rig STRETCHES to meet it (`make anim`'s stretch
// column), so the pose moves what may move instead: the free foot's push is
// drawn in toward its hip (a short push by the back binding, never a split —
// the instructors' rule), and a board drawn up to a grabbing hand stops
// where the knees are folded right up. Three-free.

import { BODY, SHIN_ABOVE_CUFF, type SkierPose } from "./skier-pose.ts";
import { solveLimb } from "./skier-limbs.ts";
import { add, dot, len, norm, scale, sub, type V3 } from "./skier-vec.ts";

/** The most the board is drawn up to a hand that cannot reach it, m. */
export const REACH_MOST = 0.3;

export function V0(): V3 {
  return { x: 0, y: 0, z: 0 };
}

/** THE KNEE'S FLEXION of leg `i` of a pose, rad (0 straight). */
export function kneeFlex(p: SkierPose, i: 0 | 1): number {
  const a = sub(p.hipJoints[i], p.knees[i]);
  const b = sub(p.feet[i], p.knees[i]);
  return Math.PI - Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b)))));
}

/** THE LEG'S SPAN, hip joint to cuff: the most (a share of the thigh and
 * the shin laid straight — a knee never locked) and the least (m: the knee
 * folded to ~150°, the thighs on the chest in a tight grab or a flip). */
export const LEG_SPAN = {
  most: 0.97 * (BODY.thigh + SHIN_ABOVE_CUFF),
  least: Math.sqrt(
    BODY.thigh * BODY.thigh +
      SHIN_ABOVE_CUFF * SHIN_ABOVE_CUFF -
      2 * BODY.thigh * SHIN_ABOVE_CUFF * Math.cos(0.5),
  ),
};

/** How far the free foot's sole is moved, across the snow, so its cuff
 * stands inside its leg's reach of `hip` — nothing while it already does. */
export function drawnIn(cuff: V3, hip: V3): V3 {
  const d = sub(hip, cuff);
  if (len(d) <= LEG_SPAN.most) return { x: 0, y: 0, z: 0 };
  const flat = Math.hypot(d.x, d.z);
  // Over the hip's height, never under it: the leg's own vertical share kept.
  const want = Math.sqrt(Math.max(0, LEG_SPAN.most * LEG_SPAN.most - d.y * d.y));
  if (flat < 1e-6) return { x: 0, y: 0, z: 0 };
  return scale({ x: d.x, y: 0, z: d.z }, (flat - want) / flat);
}

/** THE MOST OF `share` (0..share, bisected) for which `held` still says
 * every leg is inside its span — a grab's tweak, or a shift's share. */
export function heldShare(share: number, held: (k: number) => boolean): number {
  if (held(share)) return share;
  let lo = 0;
  let hi = share;
  for (let k = 0; k < 14; k++) {
    const m = (lo + hi) / 2;
    if (held(m)) lo = m;
    else hi = m;
  }
  return lo;
}

/** THE FIRST OF `share` (0..share) at which `held` stops saying every leg
 * is inside its span, walked out from nothing in `steps` and bisected in
 * the last: a tweak that rolls the deck through an arc can bring a foot back
 * inside its span further on, and a bisection over the whole of it found
 * that far side one frame and the near side the next. */
export function heldFirst(share: number, held: (k: number) => boolean, steps = 12): number {
  let lo = 0;
  for (let i = 1; i <= steps; i++) {
    const k = (share * i) / steps;
    if (held(k)) {
      lo = k;
      continue;
    }
    let hi = k;
    for (let j = 0; j < 10; j++) {
      const m = (lo + hi) / 2;
      if (held(m)) lo = m;
      else hi = m;
    }
    return lo;
  }
  return share;
}

/** THE MOST OF `shift` a board may be moved by (`heldShare` along it). */
export function heldShift(shift: V3, held: (s: V3) => boolean): V3 {
  return scale(
    shift,
    heldShare(1, (k) => held(scale(shift, k))),
  );
}

/** Whether every hip–cuff span is inside the leg's (`LEG_SPAN`). */
export function inSpan(hips: readonly V3[], cuffs: readonly V3[]): boolean {
  for (let i = 0; i < hips.length; i++) {
    const d = len(sub(cuffs[i], hips[i]));
    if (d < LEG_SPAN.least || d > LEG_SPAN.most) return false;
  }
  return true;
}

const DOWN: V3 = { x: 0, y: -1, z: 0 };

/** An arm from `shoulder` toward `target`: the hand eased inside the arm's
 * reach, the elbow bent toward `pole`. */
export function arm(
  shoulder: V3,
  target: V3,
  pole: V3,
  fallback: V3 = DOWN,
): { elbow: V3; hand: V3 } {
  const reach = (BODY.upperArm + BODY.forearm) * 0.96;
  const d = sub(target, shoulder);
  const l = len(d);
  const hand = l > reach ? add(shoulder, scale(d, reach / l)) : target;
  return {
    elbow: solveLimb(
      shoulder,
      hand,
      BODY.upperArm,
      BODY.forearm,
      steady(sub(hand, shoulder), pole, fallback),
    ),
    hand,
  };
}

/** HOW FAR A HAND FALLS SHORT of `target` from `shoulder`, as the way the
 * board must come to it, m: nothing well inside the arm's reach, then
 * gathering softly over the last `REACH_EASE` m before the hand is held
 * short (`arm`'s clamp) and one for one past it — so the knees start drawing
 * the board up a little before the arm runs out, never all at once. */
export const REACH_EASE = 0.02;
export function shortOf(shoulder: V3, target: V3): V3 {
  const d = sub(target, shoulder);
  const l = len(d);
  const m = REACH_EASE;
  const e = l - ((BODY.upperArm + BODY.forearm) * 0.96 - m);
  if (e <= 0 || l < 1e-9) return V0();
  const s = e < 2 * m ? (e * e) / (4 * m) : e - m;
  return scale(d, s / l);
}

/** An elbow's pole kept off the arm's own line: the further `pole` lies
 * along the shoulder–hand line `line`, the more of `fallback` (a dropped
 * elbow, or the arm's own pole when a grab's turns it) it is given — a pole along the line names no side, and an arm swung
 * through it (a stalefish's hand reaching round behind the rear leg) had
 * its elbow thrown round in a frame. */
export function steady(line: V3, pole: V3, fallback: V3 = DOWN): V3 {
  const l = len(line);
  if (l < 1e-6) return pole;
  const u = scale(line, 1 / l);
  const p = sub(pole, scale(u, dot(pole, u)));
  const q = sub(fallback, scale(u, dot(fallback, u)));
  const w = 1 - Math.min(1, Math.max(0, (len(p) - 0.08) / 0.25));
  return add(p, scale(q, w * w * (3 - 2 * w) * 0.7));
}

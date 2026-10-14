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

/** An arm from `shoulder` toward `target`: the hand eased inside the arm's
 * reach, the elbow bent toward `pole`. */
export function arm(shoulder: V3, target: V3, pole: V3): { elbow: V3; hand: V3 } {
  const reach = (BODY.upperArm + BODY.forearm) * 0.96;
  const d = sub(target, shoulder);
  const l = len(d);
  const hand = l > reach ? add(shoulder, scale(d, reach / l)) : target;
  return { elbow: solveLimb(shoulder, hand, BODY.upperArm, BODY.forearm, pole), hand };
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A LIFT'S LOOP AS A SHAPE (`lift-line.ts`'s `carrierAt` walks it): the
// rope a carrier rides up, the half circle round each bullwheel, the loop's
// whole length and where a point of it stands in the world.

import type { LiftPlan } from "./lift-line.ts";

/** The rope a carrier rides up, m right of the line: a drag's one rope on
 * its arm's reach, otherwise the up side of the gauge. */
export const DRAG_ARM = 1.2;
export function upRope(plan: LiftPlan): number {
  return plan.lift.kind === "drag" ? DRAG_ARM : plan.look.gauge / 2;
}

/** THE TURN ROUND EACH BULLWHEEL: its radius, m — the rope wraps the wheel
 * from one side's rope to the other's, so half the ropes' gauge (a drag's
 * up rope on its arm and its return rope on the other) — and the length
 * of rope (or a detachable's station rail) round it, half a circle. */
export function turnRadius(plan: LiftPlan): number {
  return upRope(plan);
}
function turnLength(plan: LiftPlan): number {
  return Math.PI * turnRadius(plan);
}

/** A lift's whole loop, m: up the line, round the top wheel, back down and
 * round the bottom one. */
export function carrierLoop(plan: LiftPlan): number {
  return 2 * plan.length + 2 * turnLength(plan);
}

/** Where `w` m round a lift's loop (0 the bottom wheel's tangent on the up
 * rope) is: `u` m up the line on `side`, or — round a wheel — `turn` rad of
 * the half circle gone (0 where it came off its rope, π where it leaves
 * onto the other), at the wheel's `u`. */
export function loopSpot(plan: LiftPlan, w: number): { u: number; side: 0 | 1; turn?: number } {
  const L = plan.length;
  const T = turnLength(plan);
  const r = turnRadius(plan);
  if (w < L) return { u: Math.max(0, w), side: 0 };
  if (w < L + T) {
    const turn = (w - L) / r;
    return { u: L, side: turn < Math.PI / 2 ? 0 : 1, turn };
  }
  if (w < 2 * L + T) return { u: L - (w - L - T), side: 1 };
  const turn = Math.min(Math.PI, (w - 2 * L - T) / r);
  return { u: 0, side: turn < Math.PI / 2 ? 1 : 0, turn };
}

/** A CARRIER ON ITS LOOP, PLACED: `along` m up the line and `v` m right
 * of it (in the line's frame), where in the world, and the way it runs
 * there (`heading`, 0 is +z, clockwise from above) — on its rope's side up
 * or down the line, or round a wheel on the half circle about its centre,
 * its way the circle's tangent. And `bend`: the turn's curvature, 1/m,
 * positive turning right, 0 on a straight. */
export function carrierPlace(
  plan: LiftPlan,
  c: { u: number; side: 0 | 1; turn?: number },
): { along: number; v: number; x: number; z: number; heading: number; bend: number } {
  const r = turnRadius(plan);
  let along = c.u;
  let v = c.side === 0 ? r : -r;
  let tu = c.side === 0 ? 1 : -1;
  let tv = 0;
  let bend = 0;
  if (c.turn !== undefined) {
    const a = c.turn;
    if (c.u > 0) {
      // Round the top wheel, from the up rope behind it to the down rope.
      along = plan.length + r * Math.sin(a);
      v = r * Math.cos(a);
      tu = Math.cos(a);
      tv = -Math.sin(a);
    } else {
      // Round the bottom wheel, from the down rope behind it to the up.
      along = -r * Math.sin(a);
      v = -r * Math.cos(a);
      tu = -Math.cos(a);
      tv = Math.sin(a);
    }
    // Both turns run round their wheel to the left: the up rope is right
    // of the line and the loop comes back down on its left.
    bend = -1 / Math.max(1e-6, r);
  }
  const x = plan.lift.bottom.x + plan.dx * along + plan.dz * v;
  const z = plan.lift.bottom.z + plan.dz * along - plan.dx * v;
  const wx = plan.dx * tu + plan.dz * tv;
  const wz = plan.dz * tu - plan.dx * tv;
  return { along, v, x, z, heading: Math.atan2(wx, wz), bend };
}

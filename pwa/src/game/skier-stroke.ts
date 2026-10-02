// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMS' STROKES — what the hands and the poles do through a stride, a
// skate, a double pole and a turn's pole plant, as arithmetic over a
// cycle's phase: where each fist goes off its stance, and each pole as a
// rigid rod TURNED through it, never a tip placed and jumped to. Read by
// `skier-pose.ts`; three-free, so the suite reads it.

import { add, clamp01, mix, norm, sub, scale, type V3 } from "./skier-vec.ts";

/** WHERE A WORKING POLE BITES: `x` out from the centre, m, and the least
 * its basket stands behind the fist, m — a pole is planted angled back,
 * never ahead of the hand that pushes on it. */
export type Basket = { x: number; behind: number };
/** THE DIAGONAL STRIDE'S ARMS: where the hands are, off their stance, at
 * the PLANT (ahead and up) and at the FINISH of the push (down and back
 * past the hips), m, and how far below the straight line between them
 * the hands pass — one arm at a time, a short stroke. */
export type Stroke = {
  plant: { y: number; z: number };
  finish: { y: number; z: number };
  dip: number;
  basket: Basket;
};
/** The double pole's baskets: wide of the boots, and planted with the
 * poles near upright — some 75° to the snow at the plant in measured
 * double poling, so a basket a quarter of the rod behind its fist. The
 * hands' path is `DOUBLE_ARM`'s. */
export const DOUBLE_BASKET: Basket = { x: 0.38, behind: 0.3 };
export const STRIDE_STROKE: Stroke = {
  plant: { y: 0.1, z: 0.26 },
  finish: { y: -0.12, z: -0.4 },
  dip: 0.06,
  basket: { x: 0.3, behind: 0.15 },
};
/** THE DOUBLE POLE'S ARMS, SWUNG FROM THE SHOULDERS: each arm's angle off
 * straight down, rad (forward positive), and its reach as a share of the
 * whole arm, at the PLANT (well ahead, the elbows bent and out, the fists
 * a little under the shoulders) and at the FINISH (long behind the hips);
 * how far the elbows bend through the push, as a share of the arm lost at
 * its middle — the arms pressing down on the poles as the trunk crunches
 * over them — and how much the arm gives at the elbow as it swings
 * forward through the recovery (a share of the arm, shorter negative):
 * hanging loose from the shoulder, a little bent, so the fists come
 * through clear of the thighs. Measured double poling has the elbow bent
 * some 120° at the plant, bent further early in the push and near straight
 * (about 140° open) at the pole's release. Stated off the shoulders rather
 * than the stance, a trunk folded over the poles carries the arms with it
 * and a fist never passes up by the shoulder with the arm folded tight. */
export type ArmSwing = {
  plant: { angle: number; reach: number };
  finish: { angle: number; reach: number };
  bend: number;
  lift: number;
};
export const DOUBLE_ARM: ArmSwing = {
  plant: { angle: 1.2, reach: 0.74 },
  finish: { angle: -0.95, reach: 0.97 },
  bend: 0.3,
  lift: -0.05,
};

/** Where a fist is off its shoulder at `swing` through an arm's stroke
 * (`pushing`, or swung back through the recovery), as shares of the arm's
 * length: down (`y`, negative) and forward (`z`). */
export function armAt(a: ArmSwing, swing: number, pushing: boolean): { y: number; z: number } {
  const angle = a.plant.angle + (a.finish.angle - a.plant.angle) * swing;
  const reach =
    a.plant.reach +
    (a.finish.reach - a.plant.reach) * swing +
    (pushing ? -a.bend : a.lift) * Math.sin(Math.PI * swing);
  return { y: -Math.cos(angle) * reach, z: Math.sin(angle) * reach };
}

/** THE POLE PLANT AT SPEED, as shares of the plant: the swing forward
 * ends at the `touch` — a tap at speed — and the rest of it the basket
 * trails back up to its hang. Where the basket touches (`x` out from the
 * centre, m — the rod's own length puts it on the snow ahead of the fist);
 * how far the fist reaches for it — forward, down and out, m — a flick of
 * the wrist and the forearm, the arm never thrown; and how far off the
 * straight swing the rod is lifted going forward and trailing back, rad. */
export const TURN_PLANT = {
  touch: 0.35,
  basket: { x: 0.42 },
  reach: { z: 0.14, y: -0.05, x: 0.04 },
  swingLift: 0.12,
  trailLift: 0.2,
};
/** How a pole swings through the recovery: the basket trailing back and
 * up, clear of the snow, at the middle of it. */
const POLE_TRAIL: V3 = { x: 0, y: 0.25, z: -0.35 };

/** Ease in and out over 0..1. */
export const smooth = (t: number): number => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};

/** Where an arm is in its stroke at `phase` 0..1 of its own cycle, the
 * push the first `duty` of it: 0 planted, 1 at the finish, and back. Eased
 * at both ends, so an arm comes to the plant and leaves it at rest. */
export const strokeSwing = (phase: number, duty: number): number =>
  phase < duty ? smooth(phase / duty) : 1 - smooth((phase - duty) / (1 - duty));

/** A reach of `l` m eased short of a limb's full `length`: whole under
 * 85 % of it, closing smoothly on 97 %. */
export function easeReach(l: number, length: number): number {
  const knee = 0.85 * length;
  const top = 0.97 * length;
  return l <= knee ? l : knee + (top - knee) * Math.tanh((l - knee) / (top - knee));
}

/** A hand's offset off its stance at `swing` through a stroke. */
export function strokeHand(st: Stroke, swing: number): { y: number; z: number } {
  return {
    y: st.plant.y + (st.finish.y - st.plant.y) * swing - st.dip * Math.sin(Math.PI * swing),
    z: st.plant.z + (st.finish.z - st.plant.z) * swing,
  };
}

/**
 * THE POLE THROUGH A STROKE, as a direction out of the fist `pole` m long:
 * on the push BITING — its basket on the snow behind the fist, as far
 * behind as the rod's length leaves once the fist's height is taken off
 * it, so a pole pushed on is a pole in the snow, angled back further the
 * lower and further back the fist drives; on the recovery turned from
 * where the push left it to where the next plant wants it, the basket
 * trailing. A fist too high for the snow holds the pole at its plant's
 * angle, the basket just off it. A rigid pole whose angle only ever turns,
 * so nothing jumps at the plant or the release. `handAt(swing)` is the
 * fist at a point of the stroke, everything else held.
 */
export function strokePole(
  basket: Basket,
  side: number,
  ground: number,
  phase: number,
  duty: number,
  handAt: (swing: number) => V3,
  pole: number,
): V3 {
  const toBasket = (swing: number): V3 => {
    const hand = handAt(swing);
    const x = side * basket.x;
    const drop = hand.y - ground;
    const reach = pole * pole - drop * drop - (x - hand.x) ** 2;
    const behind = Math.max(basket.behind, Math.sqrt(Math.max(0, reach)));
    return norm(sub({ x, y: ground, z: hand.z - behind }, hand));
  };
  if (phase < duty) return toBasket(strokeSwing(phase, duty));
  const r = (phase - duty) / (1 - duty);
  return norm(
    add(mix(toBasket(1), toBasket(0), smooth(r)), scale(POLE_TRAIL, Math.sin(Math.PI * r))),
  );
}

/** Where the turn's planting fist reaches for the touch, 0..1 of
 * `TURN_PLANT.reach`, at `u` through the plant: out to the touch and back. */
export function plantReach(u: number): number {
  return u < TURN_PLANT.touch
    ? smooth(u / TURN_PLANT.touch)
    : 1 - smooth((u - TURN_PLANT.touch) / (1 - TURN_PLANT.touch));
}

/**
 * THE PLANTING POLE'S DIRECTION out of its fist at `u` 0..1 through the
 * plant, from its `hang` (unit), the fist at `hand`, the snow at `ground`
 * and the pole `pole` m long, on the skier's `side` (−1 left).
 */
export function plantPole(
  hang: V3,
  hand: V3,
  ground: number,
  side: number,
  u: number,
  pole: number,
): V3 {
  // A rod of the pole's own length from a fist nearer the snow than
  // that cannot stand vertical, so it swings round the OUTSIDE: its
  // heading turned from trailing behind, out past his side, to the
  // basket ahead and back again, and its angle off the vertical never
  // less than the one that just puts the basket on the snow — which it
  // reaches at the touch.
  const down = Math.min(1, (hand.y - ground) / pole);
  const touchTilt = Math.acos(down);
  const hangTilt = Math.acos(Math.max(-1, Math.min(1, -hang.y)));
  const hangHeading = Math.atan2(side * hang.x, hang.z);
  const touchHeading = Math.atan2(TURN_PLANT.basket.x - side * hand.x, pole * Math.sin(touchTilt));
  const [r, lift] =
    u < TURN_PLANT.touch
      ? [smooth(u / TURN_PLANT.touch), TURN_PLANT.swingLift]
      : [1 - smooth((u - TURN_PLANT.touch) / (1 - TURN_PLANT.touch)), TURN_PLANT.trailLift];
  const tilt = hangTilt + (touchTilt - hangTilt) * r + lift * Math.sin(Math.PI * r);
  const heading = hangHeading + (touchHeading - hangHeading) * r;
  const dir = {
    x: side * Math.sin(tilt) * Math.sin(heading),
    y: -Math.cos(tilt),
    z: Math.sin(tilt) * Math.cos(heading),
  };
  return dir;
}

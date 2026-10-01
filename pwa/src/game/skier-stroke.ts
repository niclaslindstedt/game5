// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMS' STROKES — what the hands and the poles do through a stride, a
// skate, a double pole and a turn's pole plant, as arithmetic over a
// cycle's phase: where each fist goes off its stance, and each pole as a
// rigid rod TURNED through it, never a tip placed and jumped to. Read by
// `skier-pose.ts`; three-free, so the suite reads it.

import { add, clamp01, mix, norm, sub, scale, type V3 } from "./skier-vec.ts";

/** THE ARMS' STROKE: where the hands are, off their stance, at the PLANT
 * (ahead and up) and at the FINISH of the push (down and back past the
 * hips, the arms long), m, and how far below the straight line between
 * them the hands pass; and where the basket is on the snow at the plant
 * and at the finish (`x` out from the centre, `z` along the skis). The
 * double pole's — both arms together, the skate's poles with it — and
 * the diagonal stride's, one arm at a time and shorter. */
export type Stroke = {
  plant: { y: number; z: number };
  finish: { y: number; z: number };
  dip: number;
  basket: { x: number; from: number; to: number };
};
export const DOUBLE_STROKE: Stroke = {
  plant: { y: 0.14, z: 0.26 },
  finish: { y: -0.24, z: -0.8 },
  dip: 0.18,
  basket: { x: 0.32, from: 0.25, to: -1.2 },
};
export const STRIDE_STROKE: Stroke = {
  plant: { y: 0.1, z: 0.26 },
  finish: { y: -0.08, z: -0.36 },
  dip: 0.03,
  basket: { x: 0.3, from: 0.2, to: -0.75 },
};
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
 * THE POLE THROUGH A STROKE, as a direction out of the fist: on the push
 * toward its basket on the snow, the snow sliding back under him; on the
 * recovery turned from where the push left it to where the next plant
 * wants it, the basket trailing. A rigid pole whose angle only ever turns,
 * so nothing jumps at the plant or the release. `handAt(swing)` is the
 * fist at a point of the stroke, everything else held.
 */
export function strokePole(
  st: Stroke,
  side: number,
  ground: number,
  phase: number,
  duty: number,
  handAt: (swing: number) => V3,
): V3 {
  const toBasket = (swing: number): V3 =>
    norm(
      sub(
        {
          x: side * st.basket.x,
          y: ground,
          z: st.basket.from + (st.basket.to - st.basket.from) * swing,
        },
        handAt(swing),
      ),
    );
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

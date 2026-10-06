// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SIDESTEP'S POLES — where a skier stepping up a steep face
// (`sidestep.ts`, `skier-gait.ts`'s `sidestepGait`) has his baskets: the
// UPHILL pole planted short, up the hill beside the uphill ski and a little
// ahead, the DOWNHILL pole planted long, out down the hill and a little
// behind, bracing him while a ski is in the air. Each pole is lifted and
// planted again with its own ski — the uphill one carried up the hill as
// the uphill ski steps up, the downhill one brought up after it — so the
// four points on the snow climb together. Three-free; posed in the body's
// own frame, where the snow tilts across him by the inclination he is
// drawn at (`SkierPoseInput.incline`) and stands under the boots at
// `ground`.

import { add, mix, norm, scale, sub, type V3 } from "./skier-vec.ts";

/** Where the baskets go, m across the snow from his centre (the uphill one
 * short, the downhill one long) and ahead of the boots (the uphill one
 * ahead, the downhill one behind); how high a pole is carried clear of
 * the snow as its ski steps, m; and the share of its ski's step a basket
 * moves by. */
export const SIDE_POLES = {
  up: 0.55,
  down: 0.6,
  fore: { up: 0.4, down: -0.1 },
  lift: 0.16,
  carry: 1,
};

/** THE BASKETS at this frame, [left, right] in the body frame: `side` the
 * hill's (±1, right positive), `out` and `lift` each ski's own off the
 * gait (`Gait.out`, `Gait.lift`, and the gait's own most lift `most`),
 * `ground` the snow under the boots and `incline` the inclination the body
 * is drawn at over it. */
export function sidestepBaskets(
  side: number,
  out: readonly [number, number],
  lift: readonly [number, number],
  most: number,
  ground: number,
  incline: number,
): [V3, V3] {
  const hill = side > 0 ? 1 : 0;
  const cr = Math.cos(incline);
  const sr = Math.sin(incline);
  const baskets: [V3, V3] = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ];
  for (const i of [0, 1]) {
    const up = i === hill;
    // Across the snow, m, signed right positive: out to the pole's side,
    // moved with its own ski's step.
    const d =
      (i === 1 ? 1 : -1) * (up ? SIDE_POLES.up : SIDE_POLES.down) + SIDE_POLES.carry * out[i];
    const raise = most > 0 ? (SIDE_POLES.lift * lift[i]) / most : 0;
    baskets[i] = {
      x: d * cr,
      y: ground + d * sr + raise,
      z: up ? SIDE_POLES.fore.up : SIDE_POLES.fore.down,
    };
  }
  return baskets;
}

/** The fist that holds a pole of `pole` m with its basket at `basket`,
 * moved as little as it can be from `hand`: on the sphere the rod sweeps
 * round the basket, toward where the hand was. */
export function holdAt(hand: V3, basket: V3, pole: number): V3 {
  return add(basket, scale(norm(sub(hand, basket)), pole));
}

/** The pole's direction out of the fist `hand` toward `basket`, blended by
 * `w` from the direction `was` (both unit). */
export function toward(was: V3, hand: V3, basket: V3, w: number): V3 {
  return norm(mix(was, norm(sub(basket, hand)), w));
}

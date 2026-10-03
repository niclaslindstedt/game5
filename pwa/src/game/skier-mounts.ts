// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE SKIER IS FIXED TO HIS SKIS — the bindings his boots stand in,
// the hips he stands at and folds to, the hands on the poles' grips — in the
// engine's body frame, for the reference pair (`MOUNTS`) and for any pair
// (`mountsFor`). `skier-pose.ts` poses him off them and re-exports them.
// Three-free.

import type { V3 } from "./skier-vec.ts";

/** Where the skier is fixed to his skis, and where his free parts settle,
 * in the body frame: for the REFERENCE pair (`SKIS`, a 0.3 m stance under
 * a 1.0 m centre of gravity). `mountsFor` states them for any pair. */
export type Mounts = {
  /** The ankles over the boots' cuffs: half the stance across, the cuff's
   * height over the body's origin, a hair ahead of the boot centre. */
  foot: V3;
  /** The hips standing, and folded into a full tuck. */
  hips: V3;
  tuckHips: V3;
  /** The hands standing (ahead at hip height, the poles hanging back), and
   * in a tuck (together ahead of the face). */
  hand: V3;
  tuckHand: V3;
  /** Where the snow is under the origin, m (negative), and how far ahead a
   * pole plants, m. */
  ground: number;
  poleReach: number;
  /** The pole's length, grip to basket, m. */
  pole: number;
  /** How far a full tuck drops the body's origin toward the skis, m
   * (`SkiSpec.crouchDrop`) — the feet rise by it in the body frame. */
  crouchDrop: number;
};

export const MOUNTS: Mounts = {
  foot: { x: 0.15, y: -0.71, z: 0.02 },
  // THE ATHLETIC STANCE: the hips a hand behind the boots and low enough
  // that the knees bend about 45° over ankles flexed into the cuffs.
  hips: { x: 0, y: -0.02, z: -0.06 },
  tuckHips: { x: 0, y: -0.06, z: -0.18 },
  // THE HANDS: forward and outside the body, a little over the hips — a
  // skier carries them where he can see them, and from behind they show
  // either side of his jacket rather than tucked away against his ribs.
  hand: { x: 0.37, y: 0.1, z: 0.42 },
  tuckHand: { x: 0.12, y: -0.12, z: 0.66 },
  ground: -1,
  poleReach: 0.9,
  pole: 1.2,
  crouchDrop: 0.3,
};

/** The mounts for a pair: its stance, its centre of gravity, its boots'
 * cuff (`cuff` m over the snow) and its poles. */
export function mountsFor(
  spec: { stance: number; cogHeight: number; poleReach: number; crouchDrop?: number },
  cuff = 0.29,
  pole = 1.2,
): Mounts {
  const dy = 1 - spec.cogHeight;
  return {
    foot: { x: spec.stance / 2, y: -spec.cogHeight + cuff, z: 0.02 },
    hips: { x: 0, y: MOUNTS.hips.y + dy, z: MOUNTS.hips.z },
    tuckHips: { x: 0, y: MOUNTS.tuckHips.y + dy, z: MOUNTS.tuckHips.z },
    hand: { x: MOUNTS.hand.x, y: MOUNTS.hand.y + dy, z: MOUNTS.hand.z },
    tuckHand: { x: MOUNTS.tuckHand.x, y: MOUNTS.tuckHand.y + dy, z: MOUNTS.tuckHand.z },
    ground: -spec.cogHeight,
    poleReach: spec.poleReach,
    pole,
    crouchDrop: spec.crouchDrop ?? MOUNTS.crouchDrop,
  };
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RIDING SWITCH, AS STOOD: the skier going down the hill tails first
// (`engine/game/switch.ts`) looks back over a shoulder to see where he is
// going. Three-free; `skierPose` lays it on the body it stands up.
//
// What a skier riding switch does with his body, as instructors teach it:
//   - HE PICKS A SHOULDER and keeps it — most a favourite side — rather
//     than flicking his head from side to side, which costs the balance
//     (the shoulder is kept by the view's spring, `SkierSpring.backSide`).
//   - THE WHOLE TRUNK TURNS that way, not the neck alone: the shoulder
//     opened and the hips rotated toward it, so the head can come round
//     far enough to see behind him. The neck takes the rest — about as far
//     as a neck turns, some 80° — the chin over the shoulder and the head
//     held UPRIGHT, never ducked to peer down under the arm.
//   - THE STANCE IS THE SAME athletic one as riding forward, if anything
//     lower: knees and ankles bent, the shins on the boots' tongues — never
//     stood up on straight legs.
//   - THE HANDS go out wide and forward of him for balance, the arm on the
//     shoulder he looks over drawn round with the open shoulder, and the
//     poles trail behind the way he goes — toward his tips.

/** The look back at its fullest: the head turned in the body's frame,
 * rad (the trunk's turn and the neck's together — the chin over the
 * shoulder, the eyes a little behind square across), the shoulders' turn
 * off the hips', rad, the hips' own turn toward it, rad, the hips sunk, m,
 * the hands carried round with the shoulders, rad, and spread wide, m. */
export const SWITCH_LOOK = {
  head: 2.15,
  twist: 0.7,
  hips: 0.25,
  sink: 0.06,
  arms: 0.45,
  wide: 0.1,
} as const;

export type SwitchShape = {
  /** How far into the look back he is, 0..1 — the poles trailing behind
   * the way he goes, toward his tips, at 1. */
  w: number;
  /** Added to the pose's `look` (whose head yaw is half of it). */
  look: number;
  twist: number;
  hips: number;
  sink: number;
  arms: number;
  wide: number;
};

/** The look back as the pose lays it on, for `switched` −1..1 — how far
 * into it, signed to the shoulder: positive toward the body frame's +x,
 * the side the hips hang to for a positive `hipRight` — and how far he is in
 * the air (0..1): a flight is ridden square, the head coming back round. */
export function switchShape(switched: number | undefined, air: number): SwitchShape {
  const k = Math.max(-1, Math.min(1, switched ?? 0)) * (1 - air);
  const w = Math.abs(k);
  return {
    w,
    look: 2 * SWITCH_LOOK.head * k,
    twist: SWITCH_LOOK.twist * k,
    hips: SWITCH_LOOK.hips * k,
    sink: SWITCH_LOOK.sink * w,
    arms: SWITCH_LOOK.arms * k,
    wide: SWITCH_LOOK.wide * w,
  };
}

/** A fist carried round with the open shoulder: turned about the hips'
 * upright by `turn` rad (the same way as the shoulders' twist and the
 * head's look) and set out to its side by `wide` m. */
export function switchHand(
  h: { x: number; y: number; z: number },
  hips: { x: number; z: number },
  side: number,
  sw: SwitchShape,
): { x: number; y: number; z: number } {
  if (sw.arms === 0 && sw.wide === 0) return h;
  const dx = h.x - hips.x + side * sw.wide;
  const dz = h.z - hips.z;
  const c = Math.cos(sw.arms);
  const s = Math.sin(sw.arms);
  return { x: hips.x + dx * c + dz * s, y: h.y, z: hips.z - dx * s + dz * c };
}

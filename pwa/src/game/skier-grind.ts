// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER ON A LIFT'S ROPE (`engine/game/cable.ts`), as drawn: a rail
// skier's stance laid over the pose. Off how rail sliders are coached — the
// knees bent and the weight centred over the feet, the arms held out to the
// sides a little below the shoulders for balance, the shoulders kept square
// to the line and the eyes on its end, the poles' baskets trailing down and
// back clear of the rope — so the head is turned along his travel off the
// slide's yaw, the legs folded a little, and the arms laid out off the
// shoulders. Three-free, eased in and out by its share.

import type { CableRide } from "@engine";

import type { SkierPose } from "./skier-joints.ts";
import type { SkierPoseInput } from "./skier-pose-input.ts";
import { add, mix, norm, scale, sub, type V3 } from "./skier-vec.ts";

export const GRIND_LOOK = {
  /** How far the legs fold on the rope, 0..1 of the tuck's crouch. */
  crouch: 0.3,
  /** The most the head turns along the rope off the skis, rad. */
  look: 1.2,
  /** Each hand out from its shoulder, m: across, down and forward. */
  out: 0.52,
  down: 0.16,
  fore: 0.14,
  /** The elbow let down below the line from shoulder to hand, m. */
  elbow: 0.06,
  /** How the poles trail from the hands: out, down and back (a direction). */
  pole: { out: 0.35, down: 1, back: 0.45 },
  /** How fast the stance is taken and let go, 1/s. */
  rate: 9,
} as const;

/** The share the rope's stance is drawn at, eased toward on or off. */
export function easeGrind(share: number, on: boolean, dt: number): number {
  const k = 1 - Math.exp(-GRIND_LOOK.rate * dt);
  return share + ((on ? 1 : 0) - share) * k;
}

/** The pose's input on the rope: the legs folded a little. */
export function grindInput(input: SkierPoseInput, share: number): SkierPoseInput {
  if (share <= 0.001) return input;
  const crouch = input.crouch + (Math.max(input.crouch, GRIND_LOOK.crouch) - input.crouch) * share;
  return { ...input, crouch };
}

/** How far he looks along the rope off his skis, rad: the slide's yaw
 * undone — sliding the other way round, over the other shoulder. */
export function grindLook(grind: CableRide | null | undefined): number {
  const yaw = grind ? Math.atan2(Math.sin(grind.yaw), Math.cos(grind.yaw)) : 0;
  const along = Math.abs(yaw) > Math.PI / 2 ? yaw - Math.sign(yaw) * Math.PI : yaw;
  return Math.max(-GRIND_LOOK.look, Math.min(GRIND_LOOK.look, -along));
}

/** The arms laid out for balance over the posed figure and the head turned
 * along the rope (`look`), by `share`. */
export function grindArms(p: SkierPose, look: number, share: number): SkierPose {
  if (share <= 0.001) return p;
  const across = norm(sub(p.shoulders[1], p.shoulders[0]));
  const up: V3 = { x: 0, y: 1, z: 0 };
  // Forward: the way the hands were carried ahead of the shoulders, held
  // square to the shoulders' line.
  const mid = scale(add(p.shoulders[0], p.shoulders[1]), 0.5);
  const reach = sub(scale(add(p.hands[0], p.hands[1]), 0.5), mid);
  const off = reach.x * across.x + reach.y * across.y + reach.z * across.z;
  const ahead = sub(reach, scale(across, off));
  const fwd = norm({ x: ahead.x, y: 0, z: ahead.z });
  const L = GRIND_LOOK;
  const hands = [0, 1].map((i) => {
    const s = i === 0 ? -1 : 1;
    const want = add(
      p.shoulders[i],
      add(scale(across, s * L.out), add(scale(up, -L.down), scale(fwd, L.fore))),
    );
    return mix(p.hands[i], want, share);
  }) as [V3, V3];
  const elbows = [0, 1].map((i) => {
    const want = add(scale(add(p.shoulders[i], hands[i]), 0.5), scale(up, -L.elbow));
    return mix(p.elbows[i], want, share);
  }) as [V3, V3];
  const poles = p.poles
    ? ([0, 1].map((i) => {
        const s = i === 0 ? -1 : 1;
        const length = Math.hypot(
          p.poles![i].x - p.hands[i].x,
          p.poles![i].y - p.hands[i].y,
          p.poles![i].z - p.hands[i].z,
        );
        const way = norm(
          add(
            scale(across, s * L.pole.out),
            add(scale(up, -L.pole.down), scale(fwd, -L.pole.back)),
          ),
        );
        return mix(p.poles![i], add(hands[i], scale(way, length)), share);
      }) as [V3, V3])
    : null;
  return { ...p, hands, elbows, poles, look: p.look + (look - p.look) * share };
}

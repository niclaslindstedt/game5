// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLALOM START, AS A CLIP — the one short move every slalom racer makes
// out of the start house (`start-push.ts` is the engine's half: held there
// after GO until he goes, then one push). The same for every racer, so it
// is keyframed rather than worked out of the physics' readings, and driven
// by the engine's own clock of it, `SkierState.launch`.
//
//   HELD: his boots just behind the wand, crouched, his weight back over
//   his feet, the arms loaded on the poles planted beyond the wand outside
//   its posts.
//   FALL: up out of the crouch with no hop, the chest going out past the
//   wand while the feet stay behind it.
//   KICK: the body past the wand, he pitches on over it and fires both
//   skis through together on the poles' push — the feet the last of him
//   out of the house. (The push through the arms is `launchGait`'s.)
//   SETTLE: out of the clip into the racing stance.
//
// Three-free; `skis-body.ts` hands the frame's shape to `skierPose` as its
// start gate (`SkierPoseInput.house`), weighted as `ready`.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";

/** A start gate's shape: how far the hips sink, m, and sit back over the
 * boots (negative is forward, out over the wand), m, how far the trunk
 * tips over, rad, and how far out from the centre the baskets are
 * planted, m. */
export type GateShape = { sink: number; back: number; pitch: number; basket: number };

/** The clip's keyframes and its timing, s from the launch. */
export const SLALOM_START = {
  held: { sink: 0.18, back: 0.05, pitch: 0.5, basket: 0.85 },
  fall: { sink: 0.06, back: -0.14, pitch: 0.9, basket: 0.85 },
  kick: { sink: 0.12, back: -0.2, pitch: 0.95, basket: 0.85 },
  /** The chest out past the wand by `fall`, the skis through by `kick`
   * (the engine's push, `TUNING.start.push`), into the stance by `settle`. */
  times: { fall: 0.12, kick: 0.35, settle: 0.8 },
} as const;

const smooth = (u: number): number => {
  const k = clamp(u, 0, 1);
  return k * k * (3 - 2 * k);
};

const mix = (a: GateShape, b: GateShape, k: number): GateShape => ({
  sink: a.sink + (b.sink - a.sink) * k,
  back: a.back + (b.back - a.back) * k,
  pitch: a.pitch + (b.pitch - a.pitch) * k,
  basket: a.basket + (b.basket - a.basket) * k,
});

/** THE CLIP this frame — the gate shape and how much of the pose it holds
 * (0..1) — for a racer `held` in the house or `launch` s out of it (−1
 * before he goes); null when he is neither. */
export function slalomStart(
  held: boolean,
  launch: number,
): { shape: GateShape; weight: number } | null {
  const S = SLALOM_START;
  const T = S.times;
  if (launch < 0) return held ? { shape: S.held, weight: 1 } : null;
  if (launch < T.fall) return { shape: mix(S.held, S.fall, smooth(launch / T.fall)), weight: 1 };
  if (launch < T.kick) {
    return { shape: mix(S.fall, S.kick, smooth((launch - T.fall) / (T.kick - T.fall))), weight: 1 };
  }
  if (launch < T.settle) {
    return { shape: S.kick, weight: 1 - smooth((launch - T.kick) / (T.settle - T.kick)) };
  }
  return null;
}

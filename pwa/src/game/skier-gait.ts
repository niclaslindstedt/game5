// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GAIT — how the skier works for his speed at a crawl, off the
// engine's own drive (`poles.ts`): the diagonal stride, the skate's V and
// the double pole, and what each does to each ski as drawn. One statement
// the skis (`ski-gear.ts`, `ski-rig.ts`) and the figure (`skier-pose.ts`)
// both read, so a boot never leaves its ski. Three-free.

import { TUNING, driveReach, skateShare, strideShare, type SkierState } from "@engine";

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** THE GAIT: how the skier is working for his speed this frame, off the
 * engine's own `drive` and `stride` (`poles.ts`), and what it does to each
 * ski as drawn — the one statement the skis (`ski-gear.ts`, `ski-rig.ts`)
 * and the figure both read, so a boot never leaves its ski. */
export type Gait = {
  /** How much of him is striding (the diagonal stride), skating, and
   * double-poling, 0..1 each. */
  stride: number;
  skate: number;
  pole: number;
  /** Where in the stride he is, 0..1, and which leg is pushing (0 left). */
  phase: number;
  push: 0 | 1;
  /** Each ski's turn off the line, rad (clockwise positive — the V opens
   * the left ski anticlockwise), how far out it has been pushed, m, and how
   * far up it has been lifted for the recovery, m. */
  splay: [number, number];
  out: [number, number];
  lift: [number, number];
  /** Each ski slid forward (+) or back along its line, m — the stride's
   * kick and glide. */
  fore: [number, number];
};

/** The skate's V, each ski off the line, rad; how far out a push takes the
 * ski, m, and how high the recovery lifts it, m. */
const SKATE = { splay: 0.3, out: 0.28, lift: 0.09 };
/** THE DIAGONAL STRIDE: how far the kicking ski slides back and the
 * gliding one forward, m, and how high the kick comes off the snow. */
const STRIDE = { back: 0.3, ahead: 0.24, kick: 0.04 };

export const STILL_GAIT: Gait = {
  stride: 0,
  skate: 0,
  pole: 0,
  phase: 0,
  push: 0,
  splay: [0, 0],
  out: [0, 0],
  lift: [0, 0],
  fore: [0, 0],
};

export function gaitOf(
  s: Pick<SkierState, "drive" | "stride" | "speed" | "airborne" | "thrown">,
): Gait {
  if (s.airborne || s.thrown || s.drive <= 0.01) return STILL_GAIT;
  // THE MOTION IS WHOLE while he works at all: the push fades with speed
  // (`driveReach`), but a skier pushing at all makes a whole stride of it —
  // a stride drawn at half size reads as a twitch.
  const work = clamp01(2 * s.drive * driveReach(s.speed));
  if (work <= 0.01) return STILL_GAIT;
  const striding = strideShare(s.speed);
  const skating = (1 - striding) * skateShare(s.speed);
  const stride = work * striding;
  const skate = work * skating;
  const phase = s.stride - Math.floor(s.stride);
  const push = (Math.floor(s.stride) % 2) as 0 | 1;
  const glide = (1 - push) as 0 | 1;
  const duty = TUNING.poles.duty;
  const out: [number, number] = [0, 0];
  const lift: [number, number] = [0, 0];
  const fore: [number, number] = [0, 0];
  // THE PUSHING LEG goes out along its ski's line (skating) or back along
  // it (striding), weighted; then comes back in, lifted clear of the snow,
  // for the next.
  const reach =
    phase < duty
      ? Math.sin((Math.PI / 2) * (phase / duty))
      : Math.cos((Math.PI / 2) * ((phase - duty) / (1 - duty)));
  const recover = phase < duty ? 0 : Math.sin((Math.PI * (phase - duty)) / (1 - duty));
  out[push] = (push === 0 ? -1 : 1) * SKATE.out * skate * reach;
  lift[push] = SKATE.lift * skate * recover + STRIDE.kick * stride * reach;
  fore[push] = -STRIDE.back * stride * reach;
  fore[glide] = STRIDE.ahead * stride * reach;
  return {
    stride,
    skate,
    pole: work * (1 - striding) * (1 - skating),
    phase,
    push,
    splay: [-SKATE.splay * skate, SKATE.splay * skate],
    out,
    lift,
    fore,
  };
}

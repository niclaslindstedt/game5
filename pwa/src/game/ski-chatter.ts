// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIS SHAKING AT SPEED, AS DRAWN — the engine says how hard the pair
// is chattering (`SkierState.chatter`, `TUNING.chatter`: the snow passing
// under the skis drives them at v / λ, worst on a loaded edge on hard
// snow) and this lays it on the drawn pair: each ski hopping off the snow
// a little, its tip flapping about the binding and its edge rocking — the
// two skis out of step, as two skis on two lines of snow are.
//
// The shake is driven by the SNOW PASSED, never by a clock: each ski's
// wave is a sum of three bumps of a length (`CHATTER_LOOK.waves`, m), so
// at a crawl it is a slow wobble and flat out it is a buzz, and the same
// stretch of snow shakes it the same way however fast the frames come.
// The knees take it: the figure's boots stand on the stand's `lift`, so a
// ski hopping folds its knee and the body above rides quiet, as a good
// skier's does. Presentation only. Three-free.

import type { SkierState } from "@engine";

import type { Stand } from "./ski-stand.ts";

/** How the chatter is drawn at its whole (`SkierState.chatter` = 1). */
export const CHATTER_LOOK = {
  /** The most a ski hops off the snow, m — only ever up: the snow is what
   * throws it. */
  lift: 0.025,
  /** The most its tip flaps about the binding, rad, tips up (down into
   * the snow it is checked at `downShare` of that). */
  pitch: 0.06,
  downShare: 0.4,
  /** The most its edge rocks about its length, rad. */
  rock: 0.03,
  /** The bumps' lengths, m, and their weights — incommensurate, so the
   * shake never repeats. */
  waves: [0.73, 1.19, 1.91] as const,
  weights: [0.45, 0.35, 0.2] as const,
  /** How fast the drawn shake follows the engine's, 1/s — a ski thrown
   * into the air stops shaking over a moment, not in a frame. */
  follow: 14,
};

/** The view's shake between frames: the snow passed, m, and the chatter
 * as drawn (NaN until the first frame is stepped — a still drawn at dt 0
 * reads the engine's own). */
export type Chatter = { run: number; amount: number };

export function createChatter(): Chatter {
  return { run: 0, amount: Number.NaN };
}

/** Step the shake by a frame of `dt` s. */
export function stepChatter(s: Chatter, skier: Pick<SkierState, "chatter" | "speed">, dt: number) {
  if (!(dt > 0)) return;
  s.run += skier.speed * dt;
  const was = Number.isNaN(s.amount) ? 0 : s.amount;
  s.amount = was + (skier.chatter - was) * Math.min(1, CHATTER_LOOK.follow * dt);
}

/** One ski's wave at `run` m of snow, −1..1; `ski` 0 or 1 puts the two
 * out of step. */
export function chatterWave(run: number, ski: number, axis: number): number {
  const L = CHATTER_LOOK;
  let sum = 0;
  for (let k = 0; k < L.waves.length; k++) {
    // A phase per ski, per axis and per wave off fixed irrationals.
    const phase = (ski * 2.399 + axis * 1.618 + k * 0.937) * Math.PI;
    sum += L.weights[k] * Math.sin((2 * Math.PI * run) / L.waves[k] + phase);
  }
  return sum;
}

/** THE SHAKE LAID ON THE STAND, for one frame: each ski's lift, tip and
 * edge moved by the chatter, as far as he stands on the snow (`ground`,
 * 0..1). `s` is the view's shake, or none to read the engine's own at a
 * point of the snow (a still). */
export function shakeStand(
  stand: Stand,
  skier: Pick<SkierState, "chatter" | "x" | "z">,
  ground: number,
  s?: Chatter,
): Stand {
  const live = s !== undefined && !Number.isNaN(s.amount);
  const amount = (live ? s.amount : skier.chatter) * Math.max(0, Math.min(1, ground));
  if (!(amount > 1e-4)) return stand;
  const run = live ? s.run : skier.x + skier.z;
  const L = CHATTER_LOOK;
  for (let i = 0; i < 2; i++) {
    const hop = chatterWave(run, i, 0);
    const flap = chatterWave(run, i, 1);
    stand.lift[i] += amount * L.lift * (0.5 + 0.5 * hop);
    stand.pitch[i] += amount * L.pitch * (flap > 0 ? flap : L.downShare * flap);
    stand.rock[i] += amount * L.rock * chatterWave(run, i, 2);
  }
  return stand;
}

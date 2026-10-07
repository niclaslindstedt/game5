// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HUD TAKING THE BLOWS HE TAKES, and HIS DEATH as read — DOM-free, so
// the suite reads it. Only with the INJURIES switch on (`injuriesShown`):
// off, none of this is ever drawn.
//
// The readouts are glass between the player and the run, and on a run that
// can kill him they take what he takes:
//
//   * A BLOW JOLTS IT: every blow he falls on knocks the whole HUD off its
//     place and lets it spring back, the harder the further (`jolt`).
//   * HIS DEATH BREAKS IT: when he dies the readouts drop off the glass and
//     fall away, the word DIED comes up over the picture and the picture
//     goes dark; then the run starts again from the top, a new rider and a
//     new try (`DEATH.again`, read by `App.tsx`).

import type { GameState } from "@engine";

/** THE DEATH'S TIMELINE, s after he died. The word comes up while the
 * camera still holds on him and his heart's last beats spray; the picture
 * goes dark under it; the run starts again from the top. */
export const DEATH = {
  /** The readouts start to fall off the glass. */
  fall: 0.25,
  /** How long they take to fall away. */
  falling: 1.4,
  /** The word comes up, and how long it takes. */
  word: 1.1,
  rise: 0.6,
  /** The picture goes dark, and how long it takes. */
  dark: 2.4,
  fade: 1.6,
  /** The run starts again from the top. */
  again: 5,
} as const;

/** How long a blow's jolt lasts, s, and the g that throws it furthest. */
const JOLT_FOR = 0.6;
const JOLT_G = 120;

export type Wreck = {
  /** The blow's jolt: how far, 0 … 1, and which blow it is (a new id
   * starts a new jolt). */
  jolt: number;
  joltId: number;
  /** How far out of true the glass leans, deg. */
  bend: number;
  /** How far the readouts have fallen off it, 0 … 1. */
  fall: number;
  /** The word DIED's opacity, and the dark over the picture, 0 … 1. */
  word: number;
  dark: number;
};

const ramp = (t: number, from: number, over: number): number =>
  Math.max(0, Math.min(1, (t - from) / over));

/** THE HUD'S WRECK for a body that took the blow `blow` (its g, its id
 * and its age, s — or none) and died `died` s ago (null: alive). */
export function wreckOf(
  blow: { g: number; id: number; age: number } | null,
  died: number | null,
): Wreck {
  const jolt =
    blow && blow.age < JOLT_FOR ? Math.min(1, blow.g / JOLT_G) * (1 - blow.age / JOLT_FOR) : 0;
  const dead = died !== null;
  return {
    jolt,
    joltId: blow?.id ?? 0,
    // Knocked out of true as the readouts fall off it.
    bend: dead ? 3 * ramp(died, DEATH.fall, DEATH.falling) : 0,
    fall: dead ? ramp(died, DEATH.fall, DEATH.falling) : 0,
    word: dead ? ramp(died, DEATH.word, DEATH.rise) : 0,
    dark: dead ? ramp(died, DEATH.dark, DEATH.fade) : 0,
  };
}

/** Seconds since the player died, or null: alive, or a run without the
 * wounds that kill (`GameState.gore`). */
export function diedOf(state: GameState): number | null {
  const g = state.gore;
  return g && g.dead >= 0 ? Math.max(0, state.t - g.dead) : null;
}

/** Whether a death has run its course and the run starts again. */
export function deathOver(state: GameState): boolean {
  const d = diedOf(state);
  return d !== null && d >= DEATH.again;
}

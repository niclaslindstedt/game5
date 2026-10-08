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
//   * HIS DEATH CLEARS IT: when he dies the readouts fade slowly away where
//     they stand, gone before anything else happens; then the word DIED
//     comes up over the picture and the picture goes dark; then the run starts again from the top, a new rider and a
//     new try (`DEATH.again`, read by `App.tsx`).
//   * HURT TOO BADLY TO SKI ON (`rescue.ts`) it clears the same way, on the
//     same timeline: the word INJURED and what keeps him down come up, the
//     picture goes WHITE rather than dark, and the run starts again from
//     the top — where, on the next run, the air ambulance is taking him off
//     the mountain (`rescue-plan.ts`).

import type { GameState } from "@engine";

/** THE DEATH'S TIMELINE, s after he died. The readouts fade first and are
 * gone before the word comes up, while the camera still holds on him and
 * his heart's last beats spray; the picture goes dark under it; the run
 * starts again from the top. */
export const DEATH = {
  /** The readouts start to fade (they take `HUD_FADE` to go). */
  clear: 0,
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
  /** How far the readouts have faded, 0 … 1. */
  fade: number;
  /** The word DIED's (or INJURED's) opacity, and the dark (or the white)
   * over the picture, 0 … 1. */
  word: number;
  dark: number;
  /** The run ends INJURED rather than dead: the picture goes white. */
  white: boolean;
};

const ramp = (t: number, from: number, over: number): number =>
  Math.max(0, Math.min(1, (t - from) / over));

/** How long the readouts take to fade off the glass, s. */
export const HUD_FADE = 1;

/** THE HUD FADED OFF THE GLASS, 0 … 1, `since` s after whatever cleared it
 * began (null: it has not). One fade for every reason the readouts go —
 * his death here, and any other moment the picture should be left bare —
 * drawn as `--hud-fade` on the HUD (`wreck.css`); several reasons at once
 * are the furthest of them (`Math.max`). */
export function hudFade(since: number | null): number {
  return since === null ? 0 : ramp(since, 0, HUD_FADE);
}

/** THE HUD'S WRECK for a body that took the blow `blow` (its g, its id
 * and its age, s — or none), died `died` s ago (null: alive) or was found
 * too hurt to ski on `injured` s ago (null: he was not) — a death first. */
export function wreckOf(
  blow: { g: number; id: number; age: number } | null,
  died: number | null,
  injured: number | null = null,
): Wreck {
  const jolt =
    blow && blow.age < JOLT_FOR ? Math.min(1, blow.g / JOLT_G) * (1 - blow.age / JOLT_FOR) : 0;
  const since = died ?? injured;
  const over = since !== null;
  return {
    jolt,
    joltId: blow?.id ?? 0,
    fade: over ? hudFade(since - DEATH.clear) : 0,
    word: over ? ramp(since, DEATH.word, DEATH.rise) : 0,
    dark: over ? ramp(since, DEATH.dark, DEATH.fade) : 0,
    white: died === null && injured !== null,
  };
}

/** Seconds since the player died, or null: alive, or a run without the
 * wounds that kill (`GameState.gore`). */
export function diedOf(state: GameState): number | null {
  const g = state.gore;
  return g && g.dead >= 0 ? Math.max(0, state.t - g.dead) : null;
}

/** Seconds since the player was found too hurt to ski on, or null: he
 * was not, a run without the wounds (`GameState.gore`) — or he has died
 * since, which a death's card says instead. */
export function injuredOf(state: GameState): number | null {
  const g = state.gore;
  return g && g.injured >= 0 && g.dead < 0 ? Math.max(0, state.t - g.injured) : null;
}

/** Whether a death — or a run ended INJURED — has run its course and the
 * run starts again. */
export function deathOver(state: GameState): boolean {
  const d = diedOf(state) ?? injuredOf(state);
  return d !== null && d >= DEATH.again;
}

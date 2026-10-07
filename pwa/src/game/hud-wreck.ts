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
//   * HIS INJURIES BEND AND CRACK IT: past an injury severity score of
//     16 (major trauma, the score's own threshold) the glass is cracked —
//     a crack a star more for each band of the score — and leans out of
//     true (`bend`), so the run is read through a broken visor.
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

/** The injury severity score the glass first cracks at — major trauma — and
 * the score each further star of cracks takes. */
const CRACK_FROM = 16;
const CRACK_EVERY = 9;
/** The most stars of cracks the glass carries. */
export const CRACKS_MOST = 6;

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
  /** How many stars of cracks are on it. */
  cracks: number;
  /** How far the readouts have fallen off it, 0 … 1. */
  fall: number;
  /** The word DIED's opacity, and the dark over the picture, 0 … 1. */
  word: number;
  dark: number;
};

const ramp = (t: number, from: number, over: number): number =>
  Math.max(0, Math.min(1, (t - from) / over));

/** THE HUD'S WRECK for a body of injury severity `severity` that took the
 * blow `blow` (its g, its id and its age, s — or none) and died `died` s
 * ago (null: alive). */
export function wreckOf(
  severity: number,
  blow: { g: number; id: number; age: number } | null,
  died: number | null,
): Wreck {
  const jolt =
    blow && blow.age < JOLT_FOR ? Math.min(1, blow.g / JOLT_G) * (1 - blow.age / JOLT_FOR) : 0;
  const cracks =
    severity < CRACK_FROM
      ? 0
      : Math.min(CRACKS_MOST, 1 + Math.floor((severity - CRACK_FROM) / CRACK_EVERY));
  const dead = died !== null;
  return {
    jolt,
    joltId: blow?.id ?? 0,
    // Out of true by up to a few degrees, and further as he dies.
    bend: Math.min(4, cracks * 0.6) + (dead ? 3 * ramp(died, DEATH.fall, DEATH.falling) : 0),
    cracks: dead ? CRACKS_MOST : cracks,
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

/** ONE STAR OF CRACKS on the glass: where it struck (0 … 1 of the width
 * and the height) and its rays, each a polyline of points in the glass's
 * own units (the height is 1, the width `aspect`) — dealt off its index
 * alone, so the same glass cracks the same way every time. */
export type CrackStar = { x: number; y: number; rays: { x: number; y: number }[][]; ring: number };

function hash(i: number, k: number): number {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** The `n`th star of cracks on glass `aspect` wide to 1 high. */
export function crackStar(n: number, aspect: number): CrackStar {
  // The strikes spread over the glass, never on its very middle.
  const x = aspect * (0.12 + 0.76 * hash(n, 1));
  const y = 0.1 + 0.8 * hash(n, 2);
  const rays: { x: number; y: number }[][] = [];
  const count = 7 + Math.floor(hash(n, 3) * 6);
  for (let r = 0; r < count; r++) {
    const a = (r / count) * Math.PI * 2 + hash(n * 31 + r, 4) * 0.6;
    const len = 0.15 + 0.45 * hash(n * 17 + r, 5) ** 1.5;
    const pts = [{ x, y }];
    let px = x;
    let py = y;
    let dir = a;
    const steps = 4 + Math.floor(hash(n * 13 + r, 6) * 4);
    for (let k = 1; k <= steps; k++) {
      // A crack runs on in jags.
      dir += (hash(n * 7 + r * 3 + k, 7) - 0.5) * 0.7;
      const d = len / steps;
      px += Math.cos(dir) * d;
      py += Math.sin(dir) * d;
      pts.push({ x: px, y: py });
    }
    rays.push(pts);
  }
  return { x, y, rays, ring: 0.02 + 0.04 * hash(n, 8) };
}

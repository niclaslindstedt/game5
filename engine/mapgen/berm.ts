// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R18 — THE WINDROW'S SHAPE: the ridge the groomer's tiller leaves along
// each edge of the piste, as two pure functions of where across it and how
// far down the piste — read by the corridor's stamp (`track.ts`), by the
// ground the app draws (`terrain.ts`) and by the suite, off the numbers in
// the rule book's `berm` block.

import { LEVEL_RULES } from "./rules.ts";

/** R18 — the windrow's height over the graded line `u` metres out from the
 * inner toe (0 … `berm.width`), with its crest `crest` metres tall. */
export function bermProfile(crest: number, u: number): number {
  const w = LEVEL_RULES.berm.width;
  if (u <= 0 || u >= w) return 0;
  const k = Math.sin((Math.PI * u) / w);
  return crest * k * k;
}

/** R18 — the crest's height `s` metres down the piste: two slow sines of
 * the wander's wavelengths, wandering inside `berm.height` without drawing
 * anything. */
export function bermCrest(s: number): number {
  const B = LEVEL_RULES.berm;
  const [a, b] = B.wander;
  const v =
    0.5 + 0.3 * Math.sin((2 * Math.PI * s) / a) + 0.2 * Math.sin((2 * Math.PI * s) / b + 1.3);
  return B.height.min + (B.height.max - B.height.min) * v;
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER GONE UNDER AN AVALANCHE (`avalanche.ts`): once the flow has
// buried him he is not drawn — the debris, or the flow still running, over
// him — while the lens stays out over the snow he went under and the BURIED
// card comes up (`hud-wreck.ts`). Three-free, so the suite reads it.

import { debrisDepth, type GameState } from "@engine";

/** Whether the avalanche has taken him under: the figure is no longer
 * drawn and only his lost skis are left on the snow, as a real burial
 * leaves a ski, a pole or a glove on the surface. */
export function goneUnder(state: GameState): boolean {
  const v = state.avalanche?.victim;
  return !!v && v.phase === "lost" && !!state.skier.thrown;
}

/** Over the snow a lens is kept above while the avalanche has him, m: the
 * flow's churned body and its blocks stand a couple of metres over the
 * debris' depth, and a lens inside them sees nothing but their insides. */
export const OVER_SNOW = 3;

/** The ground every lens stands over while the avalanche has him — carried
 * or under — raised by the debris and its blocks round where it asks, so
 * the picture follows the snow from above it; `groundAt` itself otherwise. */
export function lensGround(
  state: GameState,
  groundAt: (x: number, z: number) => number,
): (x: number, z: number) => number {
  const a = state.avalanche;
  const slide = a?.slide;
  if (!a?.victim || !slide || !state.skier.thrown) return groundAt;
  return (x, z) => groundAt(x, z) + debrisDepth(slide, x, z) + OVER_SNOW;
}

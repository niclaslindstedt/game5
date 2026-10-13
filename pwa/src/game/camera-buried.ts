// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER GONE UNDER AN AVALANCHE (`avalanche.ts`): once the flow has
// buried him he is not drawn — the debris, or the flow still running, over
// him — while the lens stays out over the snow he went under and the BURIED
// card comes up (`hud-wreck.ts`). Three-free, so the suite reads it.

import type { GameState } from "@engine";

/** Whether the avalanche has taken him under: the figure is no longer
 * drawn and only his lost skis are left on the snow, as a real burial
 * leaves a ski, a pole or a glove on the surface. */
export function goneUnder(state: GameState): boolean {
  const v = state.avalanche?.victim;
  return !!v && v.phase === "lost" && !!state.skier.thrown;
}

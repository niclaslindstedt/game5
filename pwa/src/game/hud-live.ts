// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE HUD DRAWS AT FRAME RATE. Most readouts are re-rendered off the
// ~12 Hz snapshot (`snapshot.ts`), which is plenty for a number; a gauge that
// FILLS while the thumb holds it is not a number, and stepping it twelve
// times a second reads as a stutter. The few figures of that kind are fed
// here once a frame by the app's loop, and each drawing that shows one
// writes it straight onto the DOM — never a re-render, as the thumbs' own
// knobs are written (`hud-touch.tsx`, `hud-heli-pad.tsx`).

import type { GameState } from "@engine";

/** The figures drawn every frame, and the drawings that show them. */
export interface HudLive {
  /** The helicopter's collective lever, 0..1, while the player flies it. */
  collective: number;
  /** Each called once a frame, after the figures above are written. */
  readonly draws: Set<() => void>;
}

export function createHudLive(): HudLive {
  return { collective: 0, draws: new Set() };
}

/** Write this frame's figures off the run and redraw what shows them. */
export function feedHudLive(live: HudLive, state: GameState): void {
  const h = state.heli;
  live.collective = h?.rider ? Math.max(0, Math.min(1, h.controls.collective)) : 0;
  for (const draw of live.draws) draw();
}

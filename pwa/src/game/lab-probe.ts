// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A LAB'S WINDOW ON THE RUN (`window.__SH_PROBE__`): what the HUD reads,
// where the player's skis is and which way it points, the shell, the rung,
// and a tally of every event the player's run has raised — so a script
// driving the built app (`scripts/screenshot.mjs`) can check a key did what
// it says without reading pixels. Read-only; nothing in the app calls it.
// `App.tsx` hangs it on the window with its own closures.

import type { GameState } from "@engine";

import type { RunBook } from "./ghost-run.ts";
import { takeSnapshot } from "./snapshot.ts";

declare global {
  interface Window {
    /** Raised once the first frame of a race has been presented. */
    __SH_READY__?: boolean;
    __SH_PROBE__?: () => Record<string, unknown>;
  }
}

export function labProbe(
  state: GameState,
  book: Pick<RunBook, "ledger" | "ghost">,
  app: { shell: string; camera: string; replay: string | null; events: Record<string, number> },
): Record<string, unknown> {
  return {
    ...takeSnapshot(state, book.ledger()),
    ghost: book.ghost() !== null,
    // The minimap's payload is left off: it carries the level itself, which
    // a lab would be handed across the page boundary whole.
    minimap: undefined,
    phase: state.phase,
    t: state.t,
    x: state.skier.x,
    z: state.skier.z,
    heading: state.skier.heading,
    skis: state.skier.spec.id,
    input: { ...state.input },
    ...app,
    events: { ...app.events },
  };
}

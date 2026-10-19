// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GUNFIRE'S LOG (`GunfireState.log`): every `gunfire` event said this
// step, kept a moment longer in the state as well — the drawing
// (`gunfire-view.ts`) reads the muzzle flashes, the strikes and the
// bursts off it, since a frame may fall between steps and the renderer is
// handed the state, not the events. A ring of the last `LOG` of them, each
// numbered so a reader takes only the ones it has not seen. Nothing in
// the engine reads it back.

import type { GameEvent } from "./state.ts";
import type { GunfireEvent, GunfireState } from "./gunfire-state.ts";

/** How many of the last events the log keeps. */
export const LOG = 96;

/** Say `e`: into this step's events, and into the log. */
export function sayGunfire(g: GunfireState, events: GameEvent[], e: GunfireEvent): void {
  events.push(e);
  g.said += 1;
  g.log[g.said % LOG] = { n: g.said, e };
}

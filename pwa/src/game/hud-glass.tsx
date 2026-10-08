// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HIS DEATH (`hud-wreck.ts` decides, this draws): the word DIED over a
// picture going dark. Only with the INJURIES switch on; `hud.tsx` leaves it
// out otherwise.

import type { JSX } from "preact";
import type { DeathCause } from "@engine";

import type { Wreck } from "./hud-wreck.ts";
import { STRINGS } from "./strings.ts";

/** THE DEATH CARD: the picture going dark, the word over it, what killed
 * him under it, and that a new rider starts at the top. */
export function DeathCard({ wreck, cause }: { wreck: Wreck; cause: DeathCause }): JSX.Element {
  return (
    <div class="hud-death" role="alert" style={{ "--death-dark": String(wreck.dark) }}>
      <div class="hud-death-words" style={{ opacity: String(wreck.word) }}>
        <span class="hud-death-word">{STRINGS.died}</span>
        <span class="hud-death-cause">{STRINGS.diedOf[cause]}</span>
        <span class="hud-death-again">{STRINGS.diedAgain}</span>
      </div>
    </div>
  );
}

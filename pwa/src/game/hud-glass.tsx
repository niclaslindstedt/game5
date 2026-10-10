// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HIS DEATH (`hud-wreck.ts` decides, this draws): the word DIED over a
// picture going dark — or INJURED over one going white. Only with the INJURIES switch on; `hud.tsx` leaves it
// out otherwise.

import type { ComponentChildren, JSX } from "preact";
import type { BodyPart, DeathCause, InjuryKind } from "@engine";

import type { AgainAt } from "./free-ride.ts";
import type { Wreck } from "./hud-wreck.ts";
import { STRINGS } from "./strings.ts";

/** THE DEATH CARD: the picture going dark, the word over it, what killed
 * him under it, and where the new rider starts (`againAt`). */
export function DeathCard({
  wreck,
  cause,
  again,
  offer,
}: {
  wreck: Wreck;
  cause: DeathCause;
  again: AgainAt;
  /** The crash's replay, offered in small print under the words. */
  offer?: ComponentChildren;
}): JSX.Element {
  return (
    <WreckCard
      wreck={wreck}
      word={STRINGS.died}
      line={STRINGS.diedOf[cause]}
      again={STRINGS.diedAgain[again]}
      offer={offer}
    />
  );
}

/** THE INJURED CARD (`rescue.ts`): the picture going white, the word over
 * it, what keeps him down under it, and the air ambulance on its way. */
export function InjuredCard({
  wreck,
  injury,
  offer,
}: {
  wreck: Wreck;
  injury: { kind: InjuryKind; part: BodyPart };
  offer?: ComponentChildren;
}): JSX.Element {
  return (
    <WreckCard
      wreck={wreck}
      word={STRINGS.injuredWord}
      line={STRINGS.injury(injury.kind, injury.part)}
      again={STRINGS.injuredAgain}
      offer={offer}
    />
  );
}

function WreckCard({
  wreck,
  word,
  line,
  again,
  offer,
}: {
  wreck: Wreck;
  word: string;
  line: string;
  again: string;
  offer?: ComponentChildren;
}): JSX.Element {
  return (
    <div
      class="hud-death"
      role="alert"
      data-white={wreck.white ? "1" : undefined}
      style={{ "--death-dark": String(wreck.dark) }}
    >
      <div class="hud-death-words" style={{ opacity: String(wreck.word) }}>
        <span class="hud-death-word">{word}</span>
        <span class="hud-death-cause">{line}</span>
        <span class="hud-death-again">{again}</span>
        {offer}
      </div>
    </div>
  );
}

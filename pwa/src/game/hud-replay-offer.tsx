// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE OFFER AFTER A CRASH — one press, for a few seconds after the skier goes
// down (a wipeout, an injury, a death), that watches the crash again: the
// recording opened ten seconds before it on the broadcast camera, the
// director running the fall slow, and the run handed back where it was
// (`replay-run.ts`, `replay.ts`'s `CRASH`).
//
// It is an OFFER, not an interruption, and a QUIET one: a racing game that
// cuts to a replay on its own takes the controls away at the very moment the
// player wants to get up and go, and a big press in the middle of the
// picture says the same thing louder. So it is never in the middle. Where
// the death or the injured card is up it is a line of small print under its
// words, read with them (`hud-glass.tsx`); on any other fall it is a small
// chip in the top right corner, under the map and the presses (`hud.tsx`).
// Either way it says what it does and which key does it, and goes away on
// its own. On the keyboard it is V (`settings-input.ts`), which outside the
// offer is the last few seconds watched again.

import { Glyph } from "./menu-glyphs.tsx";
import { STRINGS } from "./strings.ts";

/** What the HUD is handed while a crash is worth watching again. */
export type CrashOffer = {
  /** The key the instant replay is bound to, as printed on the cap. */
  keyLabel: string;
  onWatch: () => void;
};

export type ReplayOfferProps = CrashOffer & {
  touch: boolean;
  /** Under the death or the injured card's words, or in the corner. */
  place: "card" | "corner";
};

export function ReplayOffer({ keyLabel, touch, onWatch, place }: ReplayOfferProps) {
  return (
    <button
      type="button"
      class={`hud-replay-offer is-${place}`}
      onClick={onWatch}
      aria-label={STRINGS.replayOffer}
    >
      <Glyph name="replay" className="hud-replay-offer-glyph" />
      <span class="hud-replay-offer-word">{STRINGS.replayOffer}</span>
      {!touch && keyLabel && <span class="hud-replay-offer-key">{keyLabel}</span>}
    </button>
  );
}

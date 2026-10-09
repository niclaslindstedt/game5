// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE OFFER AFTER A CRASH — one press, for a few seconds after the skier goes
// down (a wipeout, an injury, a death), that watches the crash again: the
// recording opened a few seconds before it on the broadcast camera, the
// director running the fall slow, and the run handed back where it was
// (`replay-run.ts`, `replay.ts`'s `CRASH`).
//
// It is an OFFER, not an interruption: a racing game that cuts to a replay
// on its own takes the controls away at the very moment the player wants to
// get up and go, so the picture is never taken — the press stands low in the
// middle of the screen, clear of both thumbs and of the death card's words,
// says what it does and which key does it, and goes away on its own. On the
// keyboard it is V (`settings-input.ts`), which outside the offer is the last
// few seconds watched again.

import { Glyph } from "./menu-glyphs.tsx";
import { STRINGS } from "./strings.ts";

export type ReplayOfferProps = {
  /** The key the instant replay is bound to, as printed on the cap. */
  keyLabel: string;
  touch: boolean;
  onWatch: () => void;
};

export function ReplayOffer({ keyLabel, touch, onWatch }: ReplayOfferProps) {
  return (
    <div class="hud hud-replay-offer-layer">
      <button type="button" class="hud-mini hud-replay-offer" onClick={onWatch}>
        <Glyph name="replay" className="hud-replay-offer-glyph" />
        <span class="hud-replay-offer-text">
          <span class="hud-replay-offer-word">{STRINGS.replayOffer}</span>
          {!touch && keyLabel && (
            <span class="hud-replay-offer-key">{STRINGS.replayOfferKey(keyLabel)}</span>
          )}
        </span>
      </button>
    </div>
  );
}

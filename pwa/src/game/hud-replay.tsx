// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REPLAY BAR — the one strip on screen while a recording is watched
// (`replay.ts`).
//
// A REPLAY IS THE GAME'S OWN FRAMES: the same map, the same skis, the same
// physics, ridden off the controls the race was ridden on. So there is
// nothing to add to the HUD — the clock, the place, the gates and the map read
// the recording exactly as they read the race, because it IS the race — and
// the only things a WATCHER has that a skier does not are the answers to
// "what am I looking at", "which camera" and "how do I get out".
//
// BOTTOM CENTRE, where the thumbs would be: nobody is steering a replay, so
// the thumb zones are down and the strip takes their place, clear of the
// clock and the chips along the top.
//
// AND THE ONE THING THE PICTURE CANNOT SAY FOR ITSELF: that it is running
// slow. A skier not expecting it reads a third-speed jump as a device that
// has started dropping frames, and it is one word to say otherwise.
//
// It wears `.hud-card`, so the key walk (`menu-nav.ts`) finds it and Escape
// presses its `data-nav-back`: the way out of a recording is the way out of
// any card.

import { isSkiId, skisById } from "@engine";

import type { ReplayBarFacts } from "./replay-run.ts";
import { STRINGS } from "./strings.ts";

export type ReplayBarProps = ReplayBarFacts & {
  /** One rung along the watching ladder. */
  onCamera: () => void;
  /** Leave the recording for the front door. */
  onLeave: () => void;
  /** Whether there is a thumb on the screen — the key note is for the other
   * kind of player. */
  touch: boolean;
};

export function ReplayBar({ bill, through, slow, rung, onCamera, onLeave, touch }: ReplayBarProps) {
  const skis = isSkiId(bill.skis) ? skisById(bill.skis).name : bill.skis;
  return (
    <div class="hud hud-replay-layer">
      <div class="hud-card hud-replay">
        <div class="hud-replay-text">
          <div class="hud-replay-label">
            {STRINGS.replayLabel}
            {slow && <span class="hud-replay-slow">{STRINGS.replaySlow}</span>}
          </div>
          <div class="hud-replay-title">{STRINGS.replayTitle(bill.seed, bill.mode)}</div>
          <div class="hud-replay-line">{STRINGS.replayLine(skis, bill.time, bill.place)}</div>
          {/* How far through, as a rule rather than a scrubber: the
              recording is the engine being stepped, and a seek would mean
              re-riding every step up to the mark. */}
          <div class="hud-replay-bar">
            <div class="hud-replay-fill" style={{ transform: `scaleX(${through})` }} />
          </div>
        </div>
        <div class="hud-replay-acts">
          <button type="button" class="hud-mini hud-replay-act" onClick={onCamera}>
            {STRINGS.replayCamera(rung)}
          </button>
          <button type="button" class="hud-mini hud-replay-act" data-nav-back onClick={onLeave}>
            {STRINGS.replayExit}
          </button>
        </div>
        {!touch && <div class="hud-card-note hud-replay-note">{STRINGS.replayNote}</div>}
      </div>
    </div>
  );
}

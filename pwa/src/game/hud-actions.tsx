// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PRESSES MADE WHILE THE SKIER IS MOVING: back to the last checkpoint,
// and the next camera. They share a row in the top right-hand corner, under
// the minimap, because that is the corner a skier glances at between
// checkpoints — and they are MARKS rather than words, because the top strip
// is the one part of this screen that has to stay out of the way of the
// snow. HOLDING THE RACE IS THE MINIMAP'S OWN PRESS (`minimap.tsx`); with
// the readouts off there is no map, and a pause disc stands at the head of
// this row in its place, so a phone is never left without a way out.
//
// They are drawn on every device rather than on touch alone. The keys
// (Escape, R and C) are the fast way for anybody who has learned them; the
// buttons are what makes those doors visible to everybody who has not — and
// the reset in particular is reached for with the skis on its side in a
// tree well, which is the worst possible moment to be remembering a key.
//
// THE RESET LIGHTS UP WHEN A GATE HAS BEEN MISSED OR THE SKIER IS DOWN —
// the moment he is thrown off his skis, not when he has stopped tumbling.
// It is the press that answers both moments, so it stops being one of the
// identical marks and becomes the only lit thing in the corner
// (`.hud-mini-missed`).
//
// Each mark is drawn on a viewBox cut to its own INK, so they sit at the
// same size in the middle of their discs.

import type { ComponentChildren } from "preact";
import { useMemo } from "preact/hooks";

import { createHudPress, pressHandlers } from "@niclaslindstedt/oss-game-framework/input/hud-press";
import { STRINGS } from "./strings.ts";

/** The pause mark: two bars, the one every player already knows. */
function PauseGlyph() {
  return (
    <svg class="hud-glyph" viewBox="0 0 20 22" aria-hidden="true">
      <rect x="2" y="1" width="5.5" height="20" rx="1.4" />
      <rect x="12.5" y="1" width="5.5" height="20" rx="1.4" />
    </svg>
  );
}

/** The reset mark: an arrow curling back on itself, which is what this does
 * to a race — the ring open at its upper left and the head at the top,
 * pointing back round it. The head is set ON THE ARC'S TANGENT where the
 * stroke ends (at the top the tangent is level, so the head points
 * straight left), and the stroke's end is buried in the head's base so the
 * two read as one line. The ring is 8 units across its centreline about
 * (0, 0); the box is the ink's — the ring's outer edge and the head over
 * it — squared off and centred, so nothing is sliced flat at any size. */
function ResetGlyph() {
  return (
    <svg class="hud-glyph" viewBox="-11 -12.3 22 22" aria-hidden="true">
      <path
        d="M 0 -8 A 8 8 0 1 1 -7.52 -2.74"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
      />
      <polygon
        points="0,-11.8 0,-4.2 -5.6,-8"
        stroke="currentColor"
        stroke-width="0.6"
        stroke-linejoin="round"
      />
    </svg>
  );
}

/** The camera mark: a movie camera — body, lens cone and the two reels.
 * The reels are centred over the BODY, not over the whole mark: a pair
 * set over the middle of body-and-lens stands off the body's back and
 * reads as hanging off to the right. */
function CameraGlyph() {
  return (
    <svg class="hud-glyph" viewBox="2 2.1 20 17.8" aria-hidden="true">
      <circle cx="5.6" cy="5.4" r="3.3" />
      <circle cx="12.4" cy="5.4" r="3.3" />
      <rect x="2" y="9.4" width="14" height="10.5" rx="2" />
      <path d="M 16.6 13 L 22 10 L 22 19.3 L 16.6 16.3 Z" />
    </svg>
  );
}

/** One press. It lets go of the focus on mouse-up, so the next Space — the
 * brake — is not a second press of the button the mouse last touched. And
 * it is pressed through the POINTER events (the framework's `input/hud-press`), because a
 * moving skis is a skis with a thumb already on the glass and a second
 * finger is handed no `click` at all. */
function Press({
  title,
  lit,
  onPress,
  children,
}: {
  title: string;
  lit?: boolean;
  onPress: () => void;
  children: ComponentChildren;
}) {
  const press = useMemo(createHudPress, []);
  return (
    <button
      type="button"
      class={`hud-mini hud-mini-icon ${lit ? "hud-mini-missed" : ""}`}
      title={title}
      aria-label={title}
      {...pressHandlers(press, onPress)}
      onMouseUp={(e) => (e.currentTarget as HTMLButtonElement).blur()}
    >
      {children}
    </button>
  );
}

export function HudActions({
  onPause,
  onReset,
  onCamera,
  lit,
}: {
  /** Given only when there is no minimap to press (the readouts off). */
  onPause?: () => void;
  onReset: () => void;
  onCamera: () => void;
  /** A gate is behind the skier and owed, or he is off his skis — the one
   * bit this row needs to light the reset. */
  lit: boolean;
}) {
  return (
    <div class="hud-action-stack">
      {onPause && (
        <Press title={STRINGS.pauseTitle} onPress={onPause}>
          <PauseGlyph />
        </Press>
      )}
      <Press title={STRINGS.resetTitle} lit={lit} onPress={onReset}>
        <ResetGlyph />
      </Press>
      <Press title={STRINGS.cameraTitle} onPress={onCamera}>
        <CameraGlyph />
      </Press>
    </div>
  );
}

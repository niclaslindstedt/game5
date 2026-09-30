// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE THREE PRESSES MADE WHILE THE SKIS IS MOVING: hold the race, back to
// the last checkpoint, and the next camera. They share a row in the top
// right-hand corner because that is the corner a skier glances at between
// checkpoints — and they are MARKS rather than words, because the top strip
// is the one part of this screen that has to stay out of the way of the
// snow.
//
// All three are drawn on every device rather than on touch alone. The keys
// (Escape, R and C) are the fast way for anybody who has learned them; the
// buttons are what makes those doors visible to everybody who has not — and
// the reset in particular is reached for with the skis on its side in a
// tree well, which is the worst possible moment to be remembering a key.
//
// THE RESET LIGHTS UP WHEN A CHECKPOINT HAS BEEN MISSED. It is the press
// that answers that moment, so it stops being one of three identical marks
// and becomes the only lit thing in the corner (`.hud-mini-missed`).
//
// Each mark is drawn on a viewBox cut to its own INK, so the three sit at
// the same size in the middle of their discs.

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
 * to a race. The box is cut round the STROKE, not the line it is stroked
 * on, or the ring is sliced flat down its right-hand side. */
function ResetGlyph() {
  return (
    <svg class="hud-glyph" viewBox="8 19.4 76.1 67.1" aria-hidden="true">
      <path
        d="M 24 44 A 28 28 0 1 1 30 72"
        fill="none"
        stroke="currentColor"
        stroke-width="11"
        stroke-linecap="round"
      />
      <polygon points="8,50 40,50 24,22" fill="currentColor" />
    </svg>
  );
}

/** The camera mark: a movie camera — body, lens cone and the two reels. */
function CameraGlyph() {
  return (
    <svg class="hud-glyph" viewBox="2 1.9 20 17.6" aria-hidden="true">
      <circle cx="8" cy="5" r="3.1" />
      <circle cx="15" cy="5" r="3.1" />
      <rect x="2" y="9" width="14" height="10.5" rx="2" />
      <path d="M 16.6 12.6 L 22 9.6 L 22 18.9 L 16.6 15.9 Z" />
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
  missed,
}: {
  onPause: () => void;
  onReset: () => void;
  onCamera: () => void;
  /** A checkpoint is behind the skier and owed — the one bit this row needs
   * to light the reset. */
  missed: boolean;
}) {
  return (
    <div class="hud-action-stack">
      <Press title={STRINGS.pauseTitle} onPress={onPause}>
        <PauseGlyph />
      </Press>
      <Press title={STRINGS.resetTitle} lit={missed} onPress={onReset}>
        <ResetGlyph />
      </Press>
      <Press title={STRINGS.cameraTitle} onPress={onCamera}>
        <CameraGlyph />
      </Press>
    </div>
  );
}

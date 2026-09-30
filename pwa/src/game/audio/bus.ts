// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app's single audio surface: ONE underlying synth (one AudioContext),
// wrapped into two volume-scaled VIEWS — the skier's own wind (the fader
// keeps the sibling games' name, `engine`) and every other sound — each
// under its OPTIONS fader, with
// the master and the SOUND switch folded into both (`mixOf` in
// `settings.ts`, which remembers all of it).
// Unlocking on any user gesture unlocks everything, because there is only
// ever one context to unlock.
//
// One synth rather than one per subsystem is not a saving, it is the
// requirement: a browser gives a page one usable AudioContext's worth of
// goodwill, and the echo bus and the master limiter only do their jobs if
// every voice in the game — the wind, a landing, a chime — passes
// through the same pair.

import { createSynth } from "@niclaslindstedt/oss-game-framework/audio/synth";
import { clamp01, scaledView } from "@niclaslindstedt/oss-game-framework/audio/view";
import type { Synth } from "@niclaslindstedt/oss-game-framework/audio/voice";

const raw = createSynth();

let engineVolume = 1;
let effectsVolume = 1;

/** Set the two 0–1 volumes, the master and the switch already folded in. */
export function setAudioVolumes(v: { engine: number; effects: number }): void {
  engineVolume = clamp01(v.engine);
  effectsVolume = clamp01(v.effects);
}

/** Every sound but the skier's own wind routes through this view. */
export const sfx: Synth = scaledView(raw, () => effectsVolume);

/** The wind routes through this one (the `engine` fader, by the sibling
 * games' name). */
export const engineSfx: Synth = scaledView(raw, () => engineVolume);

/** Start (or revive) audio from a real user gesture. Safe to call on every
 * pointer down — it is a no-op once the context is running. */
export function unlockAudio(): void {
  raw.unlock();
}

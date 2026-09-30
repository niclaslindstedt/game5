// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// PRESET ▸ AUTO, AS THE APP RUNS IT: when the probe (`video-probe.ts`) is
// timing, and what its answers do to the settings. Once a visit while
// PRESET is AUTO, again the moment AUTO is pressed, and never while it is
// off. A factory over `App.tsx`'s settings setter, DOM-free.

import type { Settings } from "./settings.ts";
import type { VideoSettings } from "./settings-video.ts";
import { createVideoProbe, type VideoProbe } from "./video-probe.ts";

export type PictureAuto = {
  /** Whether the frame about to be drawn is one to time: AUTO is on, this
   * visit's fit is not done, and the frame is a quiet one under a card. */
  wants(auto: boolean, quiet: boolean): boolean;
  /** The frame just drawn: the display's wait for it, its drained draw
   * time (ms), and the picture it was drawn at. */
  frame(elapsedMs: number, drawMs: number, drawnAt: VideoSettings): void;
};

/** `allowed` is false under a race a link boots, a link's picture, and a
 * lab's `?probe=0`; `update` is the app's settings setter. */
export function createPictureAuto(
  allowed: boolean,
  update: (change: (s: Settings) => Settings) => void,
): PictureAuto {
  let probe: VideoProbe | null = null;
  let fitted = false;
  let wasAuto: boolean | null = null;
  return {
    wants(auto, quiet) {
      // AUTO pressed again: this visit's fit is to be done over.
      if (auto && wasAuto === false) fitted = false;
      wasAuto = auto;
      if (!auto) probe = null;
      else if (allowed && !fitted && probe === null) probe = createVideoProbe();
      return probe !== null && quiet;
    },
    frame(elapsedMs, drawMs, drawnAt) {
      if (!probe) return;
      const next = probe.frame(elapsedMs, drawMs, drawnAt);
      // The fit's rows, the canvas's own antialiasing, and only while the
      // picture is still the fit's to set.
      if (next !== null) {
        update((s) =>
          s.autoPicture ? { ...s, video: { ...next, antialias: s.video.antialias } } : s,
        );
      }
      if (probe.done()) {
        probe = null;
        fitted = true;
        update((s) => (s.probed ? s : { ...s, probed: true }));
      }
    },
  };
}

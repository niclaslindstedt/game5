// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PROBE: time this machine drawing the race under the front door, and
// fit OPTIONS ▸ PICTURE to it — every row, not a preset — so the game holds
// sixty frames a second with as little of the look given up as it can
// (`picture-fit.ts` is the fit; this is the timing).
//
// On a phone nobody finds out what their machine can afford: the game
// opens at the design point and either stutters (and the rider blames the
// game) or looks fine while twice the headroom goes unused. This module is
// the finding-out, done on the front door, where a few seconds of
// measuring cost the rider nothing. It runs whenever PRESET is AUTO — on
// the first visit, on every visit after it (a machine on its battery is not
// the machine on its charger), and the moment AUTO is pressed.
//
// IT MEASURES, IT NEVER LOOKS UP. A browser on a phone reports every GPU as
// the same string, so there is no table of devices to consult — the only
// honest answer is to draw the race for a while and time it. What is timed
// is the whole frame DRAINED: the CPU's bill and the GPU's own execution,
// which the renderer waits for (`drain`) so a machine whose processor is
// idle while its GPU is flat out cannot read as a fast one. The ninth decile
// is the reading, not the mean: a picture is judged by its worst ordinary
// frame.
//
// IN ROUNDS. The fit reads the machine as the reference scaled, which is
// right in the large and wrong in the details, so the probe applies the
// fit's answer, lets the renderer settle, times THAT picture and fits
// again — at most `PROBE_ROUNDS` times, and done as soon as a fit hands
// back the picture it was given.
//
// DOM-free: `tests/video_test.ts` drives it with made-up frames. `App.tsx`
// feeds it one frame at a time from the loop and applies what it hands back.

import { fitPicture, samePicture } from "./picture-fit.ts";
import type { VideoSettings } from "./settings-video.ts";

/** Frames drawn before the first one of a round is measured: the first
 * seconds of a visit are shaders compiling and the browser's own tier-up,
 * and a picture just applied may have rebuilt the ground. */
export const PROBE_WARMUP = 30;

/** Frames measured a round — a second at sixty, enough for the bot to have
 * thrown some spray and turned past some woods. */
export const PROBE_SAMPLES = 60;

/** Fits at most, before the answer stands. */
export const PROBE_ROUNDS = 3;

/** A gap this long is not a frame but a stall — a build, a tab coming back
 * — and is never counted as one. */
export const PROBE_STALL_MS = 250;

/** How many stalls the probe sits through before giving up with no move. */
export const PROBE_STALLS = 30;

/** The value `share` of the way up the sorted list — the nearest rank, so a
 * decile is a frame that actually happened. */
export function decile(values: readonly number[], share: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(share * (sorted.length - 1) + 0.5))];
}

/** The probe as the loop feeds it. */
export type VideoProbe = {
  /** One drawn frame: the display's wait for it and its drained draw time,
   * ms, and the picture it was drawn at. A picture to apply when a round
   * moves it; null otherwise. */
  frame: (elapsedMs: number, drawMs: number, drawnAt: VideoSettings) => VideoSettings | null;
  done: () => boolean;
};

export function createVideoProbe(budgetMs?: number): VideoProbe {
  let warm = 0;
  let stalls = 0;
  let rounds = 0;
  let samples: number[] = [];
  let done = false;
  return {
    frame: (elapsedMs, drawMs, drawnAt) => {
      if (done) return null;
      if (!(elapsedMs > 0) || elapsedMs > PROBE_STALL_MS) {
        // A machine that stalls this often is not one this probe can say
        // anything about.
        if (++stalls >= PROBE_STALLS) done = true;
        return null;
      }
      if (warm < PROBE_WARMUP) {
        warm++;
        return null;
      }
      samples.push(drawMs);
      if (samples.length < PROBE_SAMPLES) return null;
      const next = fitPicture(drawnAt, decile(samples, 0.9), budgetMs);
      rounds++;
      samples = [];
      warm = 0;
      if (samePicture(next, drawnAt)) {
        done = true;
        return null;
      }
      if (rounds >= PROBE_ROUNDS) done = true;
      return next;
    },
    done: () => done,
  };
}

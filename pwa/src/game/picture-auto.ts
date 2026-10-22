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
  /** The same for a frame whose draw began at `drawAt` (`performance.now`):
   * the CPU's share is from then to now, the GPU's is drained off `gpu` —
   * WebGL's sync drain at once, a WebGPU device's queue when it answers
   * (`drainLater`). */
  drawn(elapsedMs: number, drawAt: number, gpu: Drains, drawnAt: VideoSettings): void;
};

/** How the frame's GPU work is waited for (the world renderer's pair). */
export type Drains = { drain(): number; drainLater(): Promise<number> | null };

/** `allowed` is false under a race a link boots, a link's picture, and a
 * lab's `?probe=0`; `update` is the app's settings setter. */
export function createPictureAuto(
  allowed: boolean,
  update: (change: (s: Settings) => Settings) => void,
): PictureAuto {
  let probe: VideoProbe | null = null;
  let fitted = false;
  let wasAuto: boolean | null = null;
  const auto: PictureAuto = {
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
      // The fit's picture, only while it is still the fit's to set.
      if (next !== null) update((s) => (s.autoPicture ? { ...s, video: next } : s));
      if (probe.done()) {
        probe = null;
        fitted = true;
        update((s) => (s.probed ? s : { ...s, probed: true }));
      }
    },
    drawn(elapsedMs, drawAt, gpu, drawnAt) {
      const cpuMs = performance.now() - drawAt;
      const later = gpu.drainLater();
      if (!later) auto.frame(elapsedMs, cpuMs + gpu.drain(), drawnAt);
      else void later.then((ms) => auto.frame(elapsedMs, cpuMs + ms, drawnAt));
    },
  };
  return auto;
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW FAST THE PICTURE IS ARRIVING, as one number a person can read — the
// developer overlay's FPS.
//
// The instantaneous rate is useless on screen: frames land a millisecond or
// two either side of their ideal and the figure flickers through a five-frame
// range while nothing is wrong. So the readout is an exponential average,
// and this module is the whole of it — DOM-free, so `tests/benchmark_test.ts`
// reads the rule without a browser.

/** How much of a new frame's rate the reading takes: settles within about
 * half a second, holds still enough between frames to be read. */
export const FPS_SMOOTHING = 1 / 8;

/** A frame longer than this, ms, is a STALL — a tab coming back, a map being
 * built, a first draw compiling every shader — not a frame rate. Folding it
 * in would bury the reading at single digits for seconds, so it is skipped. */
export const FPS_STALL_MS = 400;

/** The reading after one more frame of `frameMs`. The first real frame is
 * taken whole rather than eased up from zero. */
export function smoothFps(reading: number, frameMs: number): number {
  if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > FPS_STALL_MS) return reading;
  const now = 1000 / frameMs;
  return reading > 0 ? reading + (now - reading) * FPS_SMOOTHING : now;
}

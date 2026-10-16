// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FRAME CAP (OPTIONS ▸ FRAME RATE): how many frames a second the game
// draws at most.
//
// Uncapped, a phone on a 120 Hz screen draws every frame it can, and the
// GPU runs flat out until the phone heats up and slows its clock: on the
// reference phone the benchmark fell from about 90 fps to about 40 in its
// last sixth. Held at sixty, the GPU rests for part of each frame and the
// phone holds sixty far longer. So a touch device starts at 60 and every
// other machine starts uncapped (`null` is "as the device says", the
// INJURIES row's pattern). The BENCHMARK never reads this, because its pump
// draws as fast as it can (`benchmark.ts`).
//
// DOM-free: the pacing is a pure function of the frame's timestamp, so
// `tests/frame_cap_test.ts` drives it with made-up clocks.

/** The stops: 60 frames a second, or no cap (0). */
export const FRAME_CAPS = [60, 0] as const;
export type FrameCap = (typeof FRAME_CAPS)[number];

/** The cap a stored setting stands for on this device: the setting itself,
 * or 60 on a touch device and none elsewhere where nobody picked one. */
export function frameCapOf(setting: FrameCap | null, touch: boolean): FrameCap {
  return setting ?? (touch ? 60 : 0);
}

/** Whether this machine is a touch device (as the HUD reads it). */
export function touchDevice(): boolean {
  return typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
}

/** A pacer for the animation frames: `due(now, cap)` says whether the
 * frame at `now` (ms) is one to run. The screen's refresh decides when a
 * frame can come, so a frame runs once it is within a quarter of an
 * interval of when it was due. Then a 120 Hz screen runs every other
 * frame, and a 90 Hz one runs two frames in three, which averages sixty.
 * The next one is due an interval after the last was due, which keeps the
 * average on the cap; after a stall it is counted from no more than half
 * an interval back, so a stall is never paid back with a burst of frames. */
export function createFramePacer(): { due: (now: number, cap: FrameCap) => boolean } {
  let next = -Infinity;
  return {
    due(now, cap) {
      if (cap <= 0) {
        next = -Infinity;
        return true;
      }
      const interval = 1000 / cap;
      if (now < next - interval / 4) return false;
      next = Math.max(next, now - interval / 2) + interval;
      return true;
    },
  };
}

/** The app loop's gate: whether the frame at `now` runs, under the cap
 * `setting` stands for on this device. */
export function createFrameGate(setting: () => FrameCap | null): (now: number) => boolean {
  const pacer = createFramePacer();
  const touch = touchDevice();
  return (now) => pacer.due(now, frameCapOf(setting(), touch));
}

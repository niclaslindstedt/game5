// OPTIONS ▸ FRAME RATE (`frame-cap.ts`): which animation frames run under a
// cap, on screens of every common refresh rate, and what a device starts at.

import { describe, expect, it } from "vitest";

import { createFramePacer, frameCapOf, type FrameCap } from "../pwa/src/game/frame-cap.ts";
import { freshSettings, mergeSettings } from "../pwa/src/game/settings.ts";

/** How many of a second's frames at `hz` run under `cap`, with the
 * timestamps jittered by up to `jitter` ms either way. */
function framesRun(hz: number, cap: FrameCap, jitter = 0): number {
  const pacer = createFramePacer();
  let run = 0;
  // A second's warm-up, so the count is the steady state's.
  for (let i = 0; i < 2 * hz; i++) {
    const wobble = jitter * Math.sin(i * 12.9898) * Math.cos(i * 4.1414);
    const due = pacer.due((i * 1000) / hz + wobble, cap);
    if (i >= hz && due) run++;
  }
  return run;
}

describe("the frame cap", () => {
  it("holds sixty on a 120 Hz, 90 Hz and 60 Hz screen", () => {
    expect(framesRun(120, 60)).toBe(60);
    expect(Math.abs(framesRun(90, 60) - 60)).toBeLessThanOrEqual(1);
    expect(framesRun(60, 60)).toBe(60);
  });

  it("is not thrown by the frames' timestamps jittering", () => {
    expect(Math.abs(framesRun(120, 60, 1.5) - 60)).toBeLessThanOrEqual(1);
    expect(framesRun(60, 60, 1.5)).toBe(60);
  });

  it("runs every frame with no cap", () => {
    expect(framesRun(120, 0)).toBe(120);
  });

  it("does not pay a stall back with a burst", () => {
    const pacer = createFramePacer();
    for (let t = 0; t < 500; t += 1000 / 120) pacer.due(t, 60);
    // Half a second lost, then the 120 Hz frames again.
    let run = 0;
    for (let i = 0; i < 12; i++) if (pacer.due(1000 + (i * 1000) / 120, 60)) run++;
    expect(run).toBeLessThanOrEqual(7);
  });

  it("starts at sixty on a touch device and uncapped elsewhere", () => {
    expect(frameCapOf(null, true)).toBe(60);
    expect(frameCapOf(null, false)).toBe(0);
    expect(frameCapOf(0, true)).toBe(0);
    expect(frameCapOf(60, false)).toBe(60);
  });

  it("is stored as the player picked it, and as the device says by default", () => {
    expect(freshSettings().frameCap).toBeNull();
    expect(mergeSettings({ frameCap: 0 }).frameCap).toBe(0);
    expect(mergeSettings({ frameCap: 60 }).frameCap).toBe(60);
    expect(mergeSettings({ frameCap: 45 }).frameCap).toBeNull();
  });
});

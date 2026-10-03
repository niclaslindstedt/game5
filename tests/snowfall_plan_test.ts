// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW THE FALL MOVES PAST THE LENS (`pwa/src/game/snowfall-plan.ts`): a
// flake's own velocity is the wind's plus its fall, the lens's is measured
// off the lens, and what is drawn is the difference — so at 100 km/h into
// still air every flake comes at the lens at 100 km/h.

import { describe, expect, it } from "vitest";

import {
  FALL_SPEED,
  LENS,
  MOTE_SETTLE,
  SHUTTER,
  airPast,
  createLensTrack,
  flakeDrift,
  moteOf,
  shutterOf,
} from "../pwa/src/game/snowfall-plan.ts";

const still = { x: 0, z: 0 };
const KMH = 1 / 3.6;

/** A lens ridden along +z at `speed` m/s for `seconds` at sixty frames. */
function ride(speed: number, seconds = 1) {
  const track = createLensTrack();
  let v = track.step({ x: 0, y: 0, z: 0 }, 0);
  for (let t = 1 / 60; t <= seconds + 1e-9; t += 1 / 60) {
    v = track.step({ x: 0, y: 0, z: speed * t }, 1 / 60);
  }
  return { ...v };
}

describe("a flake's own velocity", () => {
  it("is the wind's across, and its fall's down", () => {
    const d = flakeDrift({ x: 3, z: -4 }, 0.6);
    expect(d.x).toBe(3);
    expect(d.z).toBe(-4);
    expect(d.y).toBeCloseTo(-FALL_SPEED, 9);
  });

  it("barely settles when the sky is not snowing, and falls in a fall", () => {
    expect(moteOf(0)).toBe(1);
    expect(moteOf(0.5)).toBe(0);
    expect(flakeDrift(still, 0).y).toBeCloseTo(-MOTE_SETTLE, 9);
  });
});

describe("the air past the lens", () => {
  it("comes AT a lens ridden at 100 km/h into still air at 100 km/h", () => {
    const lens = ride(100 * KMH);
    const air = airPast(flakeDrift(still, 0.5), lens);
    expect(-air.z).toBeCloseTo(100 * KMH, 1);
    expect(air.x).toBeCloseTo(0, 6);
  });

  it("adds a head wind and takes off a tail wind", () => {
    const lens = ride(20);
    expect(-airPast(flakeDrift({ x: 0, z: -8 }, 0.5), lens).z).toBeCloseTo(28, 1);
    expect(-airPast(flakeDrift({ x: 0, z: 8 }, 0.5), lens).z).toBeCloseTo(12, 1);
  });

  it("is only the fall for a lens ridden downwind at the wind's speed", () => {
    const lens = ride(10);
    const air = airPast(flakeDrift({ x: 0, z: 10 }, 0.5), lens);
    expect(Math.hypot(air.x, air.z)).toBeLessThan(0.05);
    expect(air.y).toBeCloseTo(-FALL_SPEED, 2);
  });
});

describe("the lens's velocity, measured off the lens", () => {
  it("is still for a lens planted still", () => {
    const track = createLensTrack();
    for (let i = 0; i < 30; i++) track.step({ x: 5, y: 2, z: 9 }, 1 / 60);
    expect(track.step({ x: 5, y: 2, z: 9 }, 1 / 60)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("takes a jump no lens skis for a CUT, not a speed", () => {
    const track = createLensTrack();
    track.step({ x: 0, y: 0, z: 0 }, 1 / 60);
    const v = track.step({ x: 0, y: 0, z: (LENS.cut * 2) / 60 }, 1 / 60);
    expect(Math.hypot(v.x, v.y, v.z)).toBe(0);
  });

  it("holds over a frame that took no time, and forgets on a reset", () => {
    const track = createLensTrack();
    track.step({ x: 0, y: 0, z: 0 }, 0);
    for (let i = 1; i <= 60; i++) track.step({ x: 0, y: 0, z: i * 0.5 }, 1 / 60);
    expect(track.step({ x: 0, y: 0, z: 30 }, 0).z).toBeCloseTo(30, 1);
    track.reset();
    expect(track.step({ x: 0, y: 0, z: 400 }, 1 / 60).z).toBe(0);
  });
});

describe("the shutter", () => {
  it("spans a frame, within its bounds", () => {
    expect(shutterOf(1 / 60)).toBeCloseTo((1 / 60) * SHUTTER.share, 9);
    expect(shutterOf(1)).toBe(SHUTTER.max);
    expect(shutterOf(0)).toBe(SHUTTER.min);
  });
});

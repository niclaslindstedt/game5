// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SENSE OF SPEED IN THE AIR (`camera-pace.ts`): the field widening with
// the airspeed while the lens pulls in to keep him his size, the lens let
// back on a dive into speed, the buffet growing with the speed and the
// horizon banked with him — and nothing done at a standstill.

import { describe, expect, it } from "vitest";

import {
  createFlightPace,
  FLIGHT_PACE,
  heldShare,
  stretchedFov,
  type PaceSubject,
} from "../pwa/src/game/camera-pace.ts";
import type { LensPose } from "../pwa/src/game/camera-rigs.ts";

const at = { x: 0, y: 500, z: 0 };
const way = { x: 0, y: 0, z: 1 };
const lens = (): LensPose => ({
  eye: { x: 0, y: 501, z: -4 },
  target: { x: 0, y: 490, z: 30 },
  fov: 60,
  roll: 0,
});
const subject = (speed: number, o: Partial<PaceSubject> = {}): PaceSubject => ({
  at,
  way,
  speed,
  bank: 0,
  worn: false,
  ...o,
});
const dist = (l: LensPose): number => Math.hypot(l.eye.x - at.x, l.eye.y - at.y, l.eye.z - at.z);

describe("the stretch", () => {
  it("widens the field with speed, capped", () => {
    expect(stretchedFov(60, 0)).toBe(60);
    expect(stretchedFov(60, 45)).toBeGreaterThan(65);
    expect(stretchedFov(60, 200)).toBe(60 + FLIGHT_PACE.stretch.fov);
    expect(stretchedFov(85, 200)).toBe(FLIGHT_PACE.stretch.max);
  });

  it("pulls the lens in as the field widens", () => {
    expect(heldShare(60, 60, 0.6)).toBe(1);
    expect(heldShare(60, 80, 0.6)).toBeLessThan(1);
  });
});

describe("the pace on a flyer's lens", () => {
  it("leaves a still lens as it was", () => {
    const pace = createFlightPace();
    const l = pace.apply(lens(), subject(0), 1 / 60, true);
    expect(l.fov).toBe(60);
    expect(dist(l)).toBeCloseTo(dist(lens()), 6);
  });

  it("is wider and closer at a dive's speed, and buffets", () => {
    const pace = createFlightPace();
    let l = pace.apply(lens(), subject(60), 1 / 60, true);
    const seen: number[] = [];
    for (let i = 0; i < 120; i++) {
      l = pace.apply(lens(), subject(60), 1 / 60, false);
      seen.push(l.eye.y);
    }
    expect(l.fov).toBeGreaterThan(70);
    expect(dist(l)).toBeLessThan(dist(lens()));
    expect(Math.max(...seen) - Math.min(...seen)).toBeGreaterThan(0.02);
    expect(Math.max(...seen) - Math.min(...seen)).toBeLessThan(0.5);
  });

  it("falls back behind a flyer diving into speed, and settles", () => {
    const pace = createFlightPace();
    pace.apply(lens(), subject(30), 1 / 60, true);
    let speed = 30;
    for (let i = 0; i < 60; i++) pace.apply(lens(), subject((speed += 0.1)), 1 / 60, false);
    expect(pace.surge()).toBeGreaterThan(0.5);
    for (let i = 0; i < 600; i++) pace.apply(lens(), subject(speed), 1 / 60, false);
    expect(Math.abs(pace.surge())).toBeLessThan(0.05);
  });

  it("banks a boom with him, never his own eyes", () => {
    const boom = createFlightPace().apply(lens(), subject(20, { bank: 0.5 }), 1 / 60, true);
    expect(boom.roll).toBeCloseTo(0.5 * FLIGHT_PACE.bank, 3);
    const worn = createFlightPace().apply(
      lens(),
      subject(20, { bank: 0.5, worn: true }),
      1 / 60,
      true,
    );
    expect(Math.abs(worn.roll)).toBeLessThan(0.01);
    expect(worn.eye).toEqual(lens().eye);
  });
});

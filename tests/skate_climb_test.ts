// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// UP A RISE THE GLIDE IS SHORT (`poles.ts`'s `skateCadence`, `skateDuty`):
// gravity's pull along his skis slows the gliding ski on top of the snow's
// own drag, so a skater pushes again sooner — quicker strides, the push
// filling more of each — and the flat and a downhill pitch keep the
// flat's cadence. `make skate-climb` is the lab.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  SKIS,
  TUNING,
  createGame,
  glideSlowing,
  placeRun,
  poleDuty,
  skateCadence,
  skateDuty,
  step,
  strideRate,
} from "@engine";
import { climbDrive } from "../pwa/src/game/skier-gait.ts";
import { flatLevel } from "./support/synthetic.ts";

/** The pull along his skis up a rise of `grade`, m/s² (downhill positive). */
const up = (grade: number): number => (-TUNING.g * grade) / Math.hypot(1, grade);
const P = TUNING.poles;

describe("skating up a rise", () => {
  it("keeps the flat's cadence on the flat and down a pitch", () => {
    for (const v of [1, 3, 5]) {
      expect(skateCadence(v, 0)).toBe(skateCadence(v));
      expect(skateCadence(v, 1.2)).toBe(skateCadence(v));
      expect(skateDuty(v, 0.5)).toBe(P.duty);
      expect(strideRate(v, true, 0, 0)).toBe(strideRate(v));
    }
  });

  it("quickens the strides the steeper it is, to a skater's quickest", () => {
    let last = skateCadence(3);
    for (const grade of [0.04, 0.08, 0.12, 0.2, 0.3]) {
      const c = skateCadence(3, up(grade));
      expect(c).toBeGreaterThan(last);
      expect(c).toBeLessThanOrEqual(P.climb.most);
      last = c;
    }
    // A steep climb's offset skate: some 0.8–0.9 cycles a second, two
    // strides each.
    expect(skateCadence(2.5, up(0.12))).toBeGreaterThan(1.4);
    expect(skateCadence(2.5, up(0.12))).toBeLessThan(2);
  });

  it("keeps the leg's push its time, so it fills more of each stride", () => {
    for (const grade of [0.04, 0.12]) {
      const hill = up(grade);
      const push = skateDuty(3, hill) / skateCadence(3, hill);
      if (skateDuty(3, hill) < P.climb.duty) expect(push).toBeCloseTo(P.duty / skateCadence(3), 6);
    }
    expect(skateDuty(3, up(0.3))).toBe(P.climb.duty);
    expect(poleDuty(3, 0, up(0.16))).toBeGreaterThan(poleDuty(3));
  });

  it("is cut by the glide's own slowing, rolling and the air", () => {
    expect(glideSlowing(0)).toBeCloseTo(TUNING.snow.crrPacked * TUNING.g, 6);
    expect(glideSlowing(5)).toBeGreaterThan(glideSlowing(2));
  });

  it("is read off the ground he skis up and quickens his strides", () => {
    const strides = (grade: number) => {
      const level = flatLevel({ packed: 1, grade, slopeFrom: 100, size: 3000 });
      const state = createGame({ level, spec: SKIS, rivals: 0, countdown: 0, quiet: true });
      placeRun(state, { x: 1500, z: 1400, heading: Math.PI, speed: 2.5 });
      const n = 2 * TUNING.physicsHz;
      let hill = 0;
      let speed = 0;
      for (let i = 0; i < n; i++) {
        step(state, { ...NEUTRAL_INPUT, tuck: 1 });
        hill += state.skier.hill / n;
        speed += state.skier.speed / n;
      }
      return { stride: state.skier.stride, hill, speed };
    };
    const flat = strides(0);
    const climb = strides(0.16);
    expect(flat.hill).toBeCloseTo(0, 6);
    expect(climb.hill).toBeLessThan(-1.4);
    // Slower up the rise, and still more strides in the time.
    expect(climb.speed).toBeLessThan(flat.speed);
    expect(climb.stride).toBeGreaterThan(flat.stride * 1.3);
  });

  it("draws him driving harder the more the climb takes of his glide", () => {
    expect(climbDrive(3, 0)).toBe(0);
    expect(climbDrive(3, 1)).toBe(0);
    expect(climbDrive(3, up(0.08))).toBeGreaterThan(0.5);
    expect(climbDrive(3, up(0.24))).toBeGreaterThan(climbDrive(3, up(0.08)));
    expect(climbDrive(3, up(0.24))).toBeLessThan(1);
  });
});

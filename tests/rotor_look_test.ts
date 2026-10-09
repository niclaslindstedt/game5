// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW A ROTOR LOOKS AS IT SPOOLS UP (`pwa/src/game/rotor-look.ts`): sharp
// blades at a crawl, smeared thin as they come up, the pattern dissolved
// where the strobe cannot tell forward from back, and at full rpm the
// ghost of the blades creeping slowly BACKWARDS.

import { describe, expect, it } from "vitest";

import { HELI } from "@engine";

import {
  EXPOSURE,
  STROBE,
  apparentRate,
  createRotorEye,
  lookAt,
  strobedTurn,
  type RotorSpec,
} from "../pwa/src/game/rotor-look.ts";

const MAIN: RotorSpec = {
  blades: HELI.rotor.blades,
  rpm: HELI.rotor.rpm,
  width: 0.35 / (0.6 * HELI.rotor.radius),
};
const FULL = (HELI.rotor.rpm / 60) * 2 * Math.PI;
const GAP = (2 * Math.PI) / MAIN.blades;

describe("the strobe", () => {
  it("shows a slow rotor turning as it truly turns", () => {
    for (const omega of [0, 1, 5, 12]) {
      expect(apparentRate(omega, MAIN.blades)).toBeCloseTo(omega, 9);
    }
  });

  it("folds a picture's turn into half a blade-gap either way", () => {
    for (let omega = 0; omega <= FULL * 1.5; omega += 0.37) {
      expect(Math.abs(strobedTurn(omega, MAIN.blades))).toBeLessThanOrEqual(GAP / 2 + 1e-9);
    }
  });

  it("sets the strobe just under the blade-pass rate at full rpm", () => {
    const pass = (MAIN.blades * HELI.rotor.rpm) / 60;
    expect(STROBE).toBeGreaterThan(pass);
    expect(STROBE).toBeLessThan(pass * 1.1);
  });

  it("creeps a rotor at full rpm slowly backwards", () => {
    const rate = apparentRate(FULL, MAIN.blades);
    expect(rate).toBeLessThan(0);
    // Under half a turn a second: a ghost drifting, not a rotor spinning.
    expect(Math.abs(rate)).toBeLessThan(Math.PI);
    expect(Math.abs(rate)).toBeGreaterThan(0.2);
  });

  it("runs a spool-up forward, then backward, slowing as it comes up", () => {
    const rates = Array.from({ length: 101 }, (_, k) =>
      apparentRate((FULL * k) / 100, MAIN.blades),
    );
    const flip = rates.findIndex((r) => r < 0);
    expect(flip).toBeGreaterThan(30);
    expect(flip).toBeLessThan(70);
    // Forward and quickening before the flip; backward and slowing after.
    for (let k = 1; k < flip; k++) expect(rates[k]).toBeGreaterThan(rates[k - 1]);
    for (let k = flip + 1; k <= 100; k++) expect(rates[k]).toBeGreaterThan(rates[k - 1]);
  });
});

describe("the smear", () => {
  it("is the arc a blade sweeps in one exposure", () => {
    expect(lookAt(MAIN, 10, 0).smear).toBeCloseTo(10 * EXPOSURE, 9);
  });

  it("draws the model's blades at a crawl and hands them to the smear at speed", () => {
    const still = lookAt(MAIN, 0, 0);
    expect(still.blades).toBe(1);
    expect(still.disc).toBe(0);
    const full = lookAt(MAIN, FULL, 0);
    expect(full.blades).toBe(0);
    expect(full.disc).toBe(1);
    // The two halves of the hand-over always make a whole.
    for (let omega = 0; omega <= FULL; omega += 0.5) {
      const l = lookAt(MAIN, omega, 0);
      expect(l.blades + l.disc).toBeCloseTo(1, 9);
    }
  });

  it("smears a blade at full rpm short of the next, so the ghost still shows", () => {
    const { smear } = lookAt(MAIN, FULL, 0);
    expect(smear).toBeGreaterThan(GAP / 3);
    expect(smear).toBeLessThan(GAP);
  });
});

describe("the dissolve", () => {
  it("keeps the pattern where the strobe reads one way", () => {
    expect(lookAt(MAIN, 3, 0).contrast).toBe(1);
    expect(lookAt(MAIN, FULL, 0).contrast).toBe(1);
  });

  it("dissolves it to an even haze where forward and back are equally near", () => {
    const fold = (STROBE * GAP) / 2;
    expect(lookAt(MAIN, fold, 0).contrast).toBeCloseTo(0, 6);
  });
});

describe("the eye", () => {
  it("holds a rotor that is not turning", () => {
    const eye = createRotorEye(MAIN);
    for (let k = 0; k < 60; k++) expect(eye.step(0, 1 / 60).phase).toBe(0);
  });

  it("stands still with no time passing, as behind the pause card", () => {
    const eye = createRotorEye(MAIN);
    const a = eye.step(1, 1 / 60).phase;
    expect(eye.step(1, 0).phase).toBe(a);
  });

  it("turns the pattern backwards at full rpm, within a blade-gap", () => {
    const eye = createRotorEye(MAIN);
    let last = eye.step(1, 1 / 60).phase;
    for (let k = 0; k < 600; k++) {
      const { phase } = eye.step(1, 1 / 60);
      expect(Math.abs(phase)).toBeLessThan(GAP);
      const moved = phase - last;
      // A wrap aside, every frame's move is a small step back.
      if (Math.abs(moved) < GAP / 2) expect(moved).toBeLessThan(0);
      last = phase;
    }
  });
});

describe("in slow motion", () => {
  it("shows a rotor at full rpm slowed far enough as its blades, turning forward", () => {
    const eye = createRotorEye(MAIN);
    const wall = 1 / 60;
    // The shred cam's pace: a twentieth of the run's own.
    const pace = 0.05;
    let look = eye.step(1, wall * pace, pace);
    const from = look.phase;
    look = eye.step(1, wall * pace, pace);
    expect(look.blades).toBeGreaterThan(0.99);
    expect(look.disc).toBeLessThan(0.01);
    expect(look.contrast).toBeGreaterThan(0.99);
    // Forward, at the true turn times the pace, on the wall's clock.
    expect((look.phase - from) / wall).toBeCloseTo(FULL * pace, 6);
  });

  it("is the same eye at the run's own pace", () => {
    const a = createRotorEye(MAIN);
    const b = createRotorEye(MAIN);
    for (let k = 0; k < 30; k++) expect(a.step(1, 1 / 60, 1)).toEqual(b.step(1, 1 / 60));
  });
});

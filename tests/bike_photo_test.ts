// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER AS PHOTOGRAPHED (`bike-photo.ts`): the track a bike's rider is
// presented by — the cranks levelled when coasting with the outside pedal
// dropped in a turn, the foot out eased, the hips on a body's spring and the
// landing's fold — and the pose it stands him in. Presentation only.
import { describe, expect, it } from "vitest";
import { BIKE, type BikeState } from "@engine";

import { coastCrank, hipsOver, photoTrack, PHOTO, TRACK } from "../pwa/src/game/bike-photo.ts";

const bike = (): BikeState => ({ airborne: false, vy: 0 }) as unknown as BikeState;
const frame = { riderY: BIKE.rider.stand.y, crank: 1, pedalling: false, roll: 0 };
const raw = { footOut: 0, foot: 0 as const, brake: 0, left: 1 };

describe("the photographs' track", () => {
  it("coasts with the cranks level, the outside pedal dropped in a turn", () => {
    expect(coastCrank(0)).toBe(0);
    expect(coastCrank(0.6)).toBeCloseTo(Math.PI / 2);
    expect(coastCrank(-0.6)).toBeCloseTo(-Math.PI / 2);
  });

  it("stands the hips at the photographs' height at the engine's rest, softly held off the floor", () => {
    expect(hipsOver(BIKE.rider.stand.y)).toBeCloseTo(PHOTO.hips.y);
    expect(hipsOver(-5)).toBeGreaterThanOrEqual(PHOTO.spring.floor);
    expect(hipsOver(0.5)).toBeGreaterThan(PHOTO.spring.floor);
  });

  it("back-pedals a coasting crank to level at a body's pace", () => {
    const b = bike();
    let shown = photoTrack(b, 0, frame, raw);
    expect(shown.crank).toBeCloseTo(0);
    // The engine leaves its crank wherever the last stroke did; the drawn
    // one is turned back to level.
    for (let i = 1; i <= 60; i++) shown = photoTrack(b, i / 60, { ...frame, crank: 2.5 }, raw);
    expect(Math.abs(Math.atan2(Math.sin(shown.crank), Math.cos(shown.crank)))).toBeLessThan(0.05);
  });

  it("never gives the cranks to a pedal held for a single step", () => {
    const b = bike();
    photoTrack(b, 0, frame, raw);
    let last = 0;
    for (let i = 1; i <= 120; i++) {
      const shown = photoTrack(b, i / 60, { ...frame, pedalling: i % 5 === 0 }, raw);
      expect(Math.abs(shown.crank - last)).toBeLessThan(TRACK.crank.rate / 60 + 1e-9);
      last = shown.crank;
    }
  });

  it("puts the foot out only once the slide holds, and eases it", () => {
    const b = bike();
    photoTrack(b, 0, frame, raw);
    const flicker = photoTrack(b, 1 / 60, frame, { ...raw, footOut: 0.2 });
    expect(flicker.footOut).toBe(0);
    let shown = flicker;
    for (let i = 2; i <= 4; i++) shown = photoTrack(b, i / 60, frame, { ...raw, footOut: 1 });
    expect(shown.footOut).toBeGreaterThan(0);
    expect(shown.footOut).toBeLessThan(0.5);
  });

  it("keeps the hips' spring steady at a slow frame rate", () => {
    const b = bike();
    photoTrack(b, 0, frame, raw);
    let shown = photoTrack(b, 0.05, { ...frame, riderY: 0.6 }, raw);
    const target = hipsOver(0.6);
    let prev = Math.abs(shown.hipsY - target);
    for (let i = 2; i <= 40; i++) {
      shown = photoTrack(b, i * 0.05, { ...frame, riderY: 0.6 }, raw);
      expect(shown.hipsY).toBeGreaterThanOrEqual(target - 0.01);
      prev = Math.abs(shown.hipsY - target);
    }
    expect(prev).toBeLessThan(0.005);
  });

  it("folds the legs into a landing by the speed he came down at", () => {
    const b = bike() as unknown as { airborne: boolean; vy: number };
    const k = b as unknown as BikeState;
    photoTrack(k, 0, frame, raw);
    b.airborne = true;
    b.vy = -4;
    photoTrack(k, 1 / 60, frame, { ...raw, left: 0 });
    b.airborne = false;
    let least = Infinity;
    for (let i = 2; i <= 40; i++) least = Math.min(least, photoTrack(k, i / 60, frame, raw).hipsY);
    expect(PHOTO.hips.y - least).toBeGreaterThan(0.08);
    expect(least).toBeGreaterThanOrEqual(TRACK.land.floor);
  });
});

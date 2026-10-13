// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD CUP BIKE'S LINKAGE (`bike-wc-look.ts`) held to the engine: the
// rear axle the four-bar carries IS the engine's own through the travel,
// the upper link keeps its length, and the shock works the class's stroke.

import { describe, expect, it } from "vitest";
import { BIKE, bikePose, NEUTRAL_INPUT, step } from "@engine";

import { rearAxle } from "../pwa/src/game/bike-look.ts";
import { upperMiss, wcRear, WC_SHOCK_REST } from "../pwa/src/game/bike-wc-look.ts";
import { isBikeLook } from "../pwa/src/game/bike-looks.ts";
import { racerKit, DEFAULT_OUTFIT } from "../pwa/src/game/outfit.ts";
import { outfitKey } from "../pwa/src/game/dress.ts";
import { riderKey } from "../pwa/src/game/skier-bike.ts";
import { bikeRun, summerMap } from "./support/bike-bot.ts";

describe("the world cup bike's linkage", () => {
  it("carries the rear axle on the engine's path", () => {
    for (let c = 0; c <= BIKE.rearEnd.travel + 1e-9; c += 0.01) {
      const r = wcRear(c);
      const n = Math.hypot(BIKE.rearPath.y, BIKE.rearPath.z);
      const rest = rearAxle(0);
      expect(r.axle.z).toBeCloseTo(rest.z + (c * BIKE.rearPath.z) / n, 6);
      expect(r.axle.y).toBeCloseTo(rest.y + (c * BIKE.rearPath.y) / n, 6);
    }
  });

  it("keeps the upper link within a millimetre of its length", () => {
    for (let c = 0; c <= BIKE.rearEnd.travel + 1e-9; c += 0.005) {
      expect(Math.abs(upperMiss(c))).toBeLessThan(0.001);
    }
  });

  it("works a 250 mm shock through about its 75 mm stroke, shortening all the way", () => {
    expect(WC_SHOCK_REST).toBeCloseTo(0.25, 2);
    let last = wcRear(0).shockLength;
    for (let c = 0.01; c <= BIKE.rearEnd.travel + 1e-9; c += 0.01) {
      const l = wcRear(c).shockLength;
      expect(l).toBeLessThan(last);
      last = l;
    }
    const stroke = WC_SHOCK_REST - wcRear(BIKE.rearEnd.travel).shockLength;
    expect(stroke).toBeGreaterThan(0.068);
    expect(stroke).toBeLessThan(0.082);
  });
});

describe("the racer on it", () => {
  let s = bikeRun(summerMap(38));
  for (let i = 0; i < 120; i++) s = step(s, NEUTRAL_INPUT);
  const pose = bikePose(s.bike!);

  it("keeps his hands and feet where the plain stance has them", () => {
    const a = riderKey(pose);
    const b = riderKey({ ...pose, pedalling: true, front: 1, rear: 1 }, true);
    expect(b.hands).toEqual(a.hands);
    expect(b.feet).toEqual(a.feet);
  });

  it("pushes his hips back on the brakes and sways them sprinting", () => {
    const free = riderKey(pose, true);
    const stop = riderKey({ ...pose, front: 1, rear: 1 }, true);
    expect(stop.hipZ).toBeLessThan(free.hipZ - 0.03);
    const l = riderKey({ ...pose, pedalling: true, crank: Math.PI / 2 }, true);
    const r = riderKey({ ...pose, pedalling: true, crank: -Math.PI / 2 }, true);
    expect(l.hipX - r.hipX).toBeGreaterThan(0.04);
  });

  it("wears a kit of its own, kept apart from the outfit it is cut from", () => {
    expect(isBikeLook("worldcup")).toBe(true);
    const kit = racerKit(DEFAULT_OUTFIT);
    expect(kit.bike).toBe(true);
    expect(kit.poles).toBe("none");
    expect(outfitKey(kit)).not.toBe(outfitKey({ ...kit, bike: undefined }));
  });
});

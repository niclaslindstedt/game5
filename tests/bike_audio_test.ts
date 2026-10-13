// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE'S VOICE (`pwa/src/game/audio/bike-voice.ts`) and its
// bed's reading of the state (`bike-bed.ts`): stood still it is silent, the
// tyres roar with the speed in a band set by the ground, the freehub ticks
// only while he coasts and at the rate the rear wheel turns, a locked wheel
// skids, the brakes squeal under a hard pull at a trot, and a ridden bike in
// the game has a voice while one lying by itself has none.
import { describe, expect, it } from "vitest";
import { NEUTRAL_INPUT, step } from "@engine";

import {
  bikeHeard,
  bikeTargets,
  hubHz,
  HUB_POINTS,
  type BikeVoice,
} from "../pwa/src/game/audio/bike-voice.ts";
import { bikeVoiceOf } from "../pwa/src/game/audio/bike-bed.ts";
import { bikeRun, summerMap } from "./support/bike-bot.ts";

const MIX = { bike: 1, tone: 1 };
const at = (v: Partial<BikeVoice>): BikeVoice => ({
  speed: 0,
  rearSpin: 0,
  pedalling: false,
  ground: "trail",
  touching: 1,
  rough: 0,
  slide: 0,
  locked: false,
  brake: 0,
  ...v,
});
const spinOf = (speed: number) => speed / 0.36;

describe("the bike's voice (bike-voice.ts)", () => {
  it("rolls louder the faster it goes, and says nearly nothing at rest", () => {
    const rest = bikeTargets(at({}), MIX);
    const fast = bikeTargets(at({ speed: 12, rearSpin: spinOf(12) }), MIX);
    expect(fast.roll.level).toBeGreaterThan(rest.roll.level * 4);
    expect(rest.hub.level).toBe(0);
    expect(rest.skid.level).toBe(0);
  });

  it("sounds the ground: gravel crunches, grass hushes, tarmac buzzes", () => {
    const go = { speed: 10, rearSpin: spinOf(10) };
    const grass = bikeTargets(at({ ...go, ground: "meadow" }), MIX);
    const gravel = bikeTargets(at({ ...go, ground: "scree" }), MIX);
    const road = bikeTargets(at({ ...go, ground: "road" }), MIX);
    expect(gravel.grit.level).toBeGreaterThan(grass.grit.level * 4);
    expect(road.knobs.level).toBeGreaterThan(grass.knobs.level * 4);
    expect(gravel.roll.cutoff!).toBeGreaterThan(grass.roll.cutoff!);
  });

  it("ticks the freehub coasting, at its points a turn of the wheel, and not under the pedals", () => {
    const coast = bikeTargets(at({ speed: 5, rearSpin: spinOf(5) }), MIX);
    const pedal = bikeTargets(at({ speed: 5, rearSpin: spinOf(5), pedalling: true }), MIX);
    expect(coast.hub.level).toBeGreaterThan(0);
    expect(pedal.hub.level).toBe(0);
    expect(hubHz(2 * Math.PI)).toBeCloseTo(HUB_POINTS, 9);
    // The click train is a square at half the rate (two edges a cycle).
    expect(coast.hub.hz).toBeCloseTo(hubHz(spinOf(5)) / 2, 6);
  });

  it("skids on a locked wheel and squeals under a hard pull at a trot, not flat out", () => {
    const go = { speed: 6, rearSpin: spinOf(6) };
    expect(bikeTargets(at({ ...go, locked: true }), MIX).skid.level).toBeGreaterThan(0);
    expect(bikeTargets(at({ ...go, brake: 1 }), MIX).squeal.level).toBeGreaterThan(0);
    expect(bikeTargets(at({ speed: 20, rearSpin: spinOf(20), brake: 1 }), MIX).squeal.level).toBe(
      0,
    );
  });

  it("rattles the chain as the ground works the wheels", () => {
    const go = { speed: 8, rearSpin: spinOf(8), ground: "rocks" as const };
    const smooth = bikeTargets(at(go), MIX);
    const rough = bikeTargets(at({ ...go, rough: 1.2 }), MIX);
    expect(rough.chain.level).toBeGreaterThan(smooth.chain.level);
  });

  it("is a quiet thing: gone a few tens of metres off", () => {
    expect(bikeHeard(0).gain).toBe(1);
    expect(bikeHeard(80).gain).toBe(0);
  });
});

describe("the bed's reading (bike-bed.ts)", () => {
  it("hears a ridden bike, and none once it lies alone", () => {
    let s = bikeRun(summerMap(38));
    s = step(s, NEUTRAL_INPUT);
    const v = bikeVoiceOf(s);
    expect(v).not.toBe(null);
    expect(v!.touching).toBeGreaterThan(0);
    const lying = { ...s, bike: { ...s.bike!, onIt: false, mode: "parked" as const } };
    expect(bikeVoiceOf(lying)).toBe(null);
  });
});

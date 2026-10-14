// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BARS ANSWER (`make bike-steer`): the downhill bike turns the way it is
// steered at once, settles to the turn its lean asks, and a turn asked past
// what the tyres hold puts the rider down.

import { describe, expect, it } from "vitest";
import { BIKE } from "@engine";
import { steerStep } from "./support/bike-steer.ts";

describe("the bike's steering", () => {
  it("bites inside a third of a second and barely swings the wrong way first", () => {
    for (const v of [5, 8, 14, 17]) {
      for (const s of [0.3, 0.6]) {
        const r = steerStep(v, s);
        expect(r.crash, `${v} m/s, bars ${s}`).toBeNull();
        expect(r.bite, `${v} m/s, bars ${s}`).toBeLessThan(0.35);
        expect(r.made, `${v} m/s, bars ${s}`).toBeLessThan(0.6);
        expect(r.dip, `${v} m/s, bars ${s}`).toBeLessThan(5);
      }
    }
  });

  it("settles to the lean its turn asks", () => {
    const r = steerStep(8, 0.6);
    const ask = (Math.atan((8 * 8) / (9.81 * r.radius)) * 180) / Math.PI;
    expect(Math.abs(r.lean - ask)).toBeLessThan(5);
  });

  it("rides every turn inside the knee and is thrown by one past the grip", () => {
    for (const v of [5, 8, 11, 14, 17]) {
      expect(steerStep(v, BIKE.hands.knee * 0.9).crash, `${v} m/s at the knee`).toBeNull();
      expect(steerStep(v, 1).crash, `${v} m/s at full bars`).not.toBeNull();
    }
  });

  it("turns at a crawl on the bars' lock without falling", () => {
    const r = steerStep(3, 1);
    expect(r.crash).toBeNull();
    expect(r.radius).toBeLessThan(3);
  });
});

describe("a stab of full bars", () => {
  it("is held to the grip; held on, it lays the bike past it", async () => {
    const { benchRide, benchWorld, slope, NO_HANDS } = await import("./support/bike-worlds.ts");
    const stab = (until: number) =>
      benchRide(benchWorld(slope(0), "hardpack"), {
        speed: 8,
        seconds: 4,
        hand: (b, t) => ({
          ...NO_HANDS,
          pedal: b.way < 7.9 ? 1 : 0,
          steer: t > 1 && t < until ? 1 : 0,
        }),
      }).crash;
    expect(stab(1.3)).toBeNull();
    expect(stab(4)).not.toBeNull();
  });
});

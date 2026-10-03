// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFT AS THE LENS RIDES IT (`pwa/src/game/camera-lift.ts`): the chase
// boom comes in close behind a skier carried up a lift, holds there through
// the stand-up, the ramp and the lane off a chair's top, and opens out to
// the chase over the lead onto his run — or eases out where the lift lets
// him go with no lead.

import { describe, expect, it } from "vitest";

import type { LiftRide } from "@engine";
import {
  LIFT_LOOK,
  createRideMemory,
  rideTarget,
  stepRideLook,
} from "../pwa/src/game/camera-lift.ts";

function ride(phase: LiftRide["phase"], t = 0, kind: LiftRide["kind"] = "chair"): LiftRide {
  return {
    index: 0,
    id: "C1",
    kind,
    phase,
    u: 0,
    speed: 0,
    swing: 0,
    swingRate: 0,
    t,
    tower: 1,
    from: { x: 0, y: 0, z: 0, heading: 0 },
    lead: phase === "lead" ? { run: 0, s: 0, until: 40, time: 26 } : null,
  };
}

describe("the lift's look", () => {
  it("is whole while he boards and rides, and let out over the lead", () => {
    expect(rideTarget(null)).toBe(0);
    expect(rideTarget(ride("board"))).toBe(1);
    expect(rideTarget(ride("ride"))).toBe(1);
    expect(rideTarget(ride("lead", LIFT_LOOK.lead.hold - 0.1))).toBe(1);
    expect(rideTarget(ride("lead", LIFT_LOOK.lead.out + 0.1))).toBe(0);
    let last = 1;
    for (let t = 0; t <= LIFT_LOOK.lead.out; t += 0.25) {
      const k = rideTarget(ride("lead", t));
      expect(k).toBeLessThanOrEqual(last);
      last = k;
    }
  });

  it("eases in once he is taken, and snaps to it on a new run", () => {
    const mem = createRideMemory();
    expect(stepRideLook(mem, null, 1 / 60)).toBeNull();
    const first = stepRideLook(mem, ride("ride"), 1 / 60)!;
    expect(first.share).toBeGreaterThan(0);
    expect(first.share).toBeLessThan(0.1);
    expect(first.dist).toBe(LIFT_LOOK.chair.dist);
    const snapped = stepRideLook(createRideMemory(), ride("ride", 0, "gondola"), 1 / 60, true)!;
    expect(snapped.share).toBe(1);
    expect(snapped.dist).toBe(LIFT_LOOK.gondola.dist);
  });

  it("follows the lead's own curve, and eases out where the lift lets him go", () => {
    const mem = createRideMemory();
    stepRideLook(mem, ride("ride"), 1 / 60, true);
    const mid = (LIFT_LOOK.lead.hold + LIFT_LOOK.lead.out) / 2;
    expect(stepRideLook(mem, ride("lead", mid), 1 / 60)!.share).toBeCloseTo(
      rideTarget(ride("lead", mid)),
      9,
    );
    const free = createRideMemory();
    stepRideLook(free, ride("ride"), 1 / 60, true);
    const after = stepRideLook(free, null, 1 / 60)!;
    // Still the chair's look, kept while it opens out…
    expect(after.share).toBeGreaterThan(0.9);
    expect(after.dist).toBe(LIFT_LOOK.chair.dist);
    // …and gone in the end.
    let left: unknown = after;
    for (let i = 0; i < 60 * 30 && left; i++) left = stepRideLook(free, null, 1 / 60);
    expect(left).toBeNull();
  });
});

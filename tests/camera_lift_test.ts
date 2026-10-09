// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFT AS THE LENS RIDES IT (`pwa/src/game/camera-lift.ts`): the chase
// boom comes in close behind a skier carried up a lift and eases out to the
// chase once the lift lets him go at the top.

import { describe, expect, it } from "vitest";

import type { LiftRide } from "@engine";
import {
  LIFT_FADE,
  LIFT_LOOK,
  createRideMemory,
  liftCut,
  liftFade,
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
    t,
    tower: 1,
    from: { x: 0, y: 0, z: 0, heading: 0 },
  };
}

describe("the lift's look", () => {
  it("is whole while he rides, and nothing while he skates up or once he is let go", () => {
    expect(rideTarget(null)).toBe(0);
    expect(rideTarget(ride("board"))).toBe(0);
    expect(rideTarget(ride("wait", 0, "drag"))).toBe(0);
    expect(rideTarget(ride("ride"))).toBe(1);
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

  it("eases out where the lift lets him go", () => {
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

describe("the fade through a station", () => {
  const board = (togo: number, kind: LiftRide["kind"] = "gondola"): LiftRide => ({
    ...ride("board", 0, kind),
    walk: 20,
    s: 20 - togo,
    foot: togo,
  });
  const faded = (t: number): LiftRide => ({ ...ride("ride", t, "gondola"), faded: true });

  it("goes black at the door and comes back in on him sat in his cabin", () => {
    expect(liftFade(board(10))).toBe(0);
    expect(liftFade(board(LIFT_FADE.out / 2))).toBeGreaterThan(0.2);
    expect(liftFade(board(0))).toBe(1);
    expect(liftFade(faded(0))).toBe(1);
    expect(liftCut(faded(0))).toBe(true);
    expect(liftFade(faded(LIFT_FADE.hold + LIFT_FADE.in / 2))).toBeCloseTo(0.5, 5);
    expect(liftCut(faded(LIFT_FADE.hold + 0.1))).toBe(false);
    expect(liftFade(faded(LIFT_FADE.hold + LIFT_FADE.in))).toBe(0);
  });

  it("never fades a T-bar's rider, nor a ride begun on the lift", () => {
    expect(liftFade(board(0, "drag"))).toBe(0);
    expect(liftFade(ride("ride", 0, "gondola"))).toBe(0);
    expect(liftCut(ride("ride", 0, "chair"))).toBe(false);
  });

  it("cuts the lens to the lift's look while it is black", () => {
    const mem = createRideMemory();
    expect(stepRideLook(mem, faded(0.1), 1 / 60)!.share).toBe(1);
  });
});

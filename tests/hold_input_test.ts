// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A RIDE HELD AT A SPEED (`pwa/src/game/hold-input.ts`): the hands a lab
// and a link's `?hold=` ski the player on — the speed held on a slope, the
// heading kept, and each move's own: a check's brake, a stop's skid, a
// carve's turns either way.

import { describe, expect, it } from "vitest";

import { createGame, placeRun, step } from "@engine";

import { heldRide, holdInput, rideHold } from "../pwa/src/game/hold-input.ts";
import { flatLevel } from "./support/synthetic.ts";

const PITCH = Math.tan((10 * Math.PI) / 180);
const slope = () =>
  createGame({
    level: flatLevel({ packed: 1, grade: PITCH, slopeFrom: 200, size: 4000 }),
    rivals: 0,
    countdown: 0,
    quiet: true,
  });

describe("a held ride", () => {
  it("holds near its speed down a slope and keeps its heading", () => {
    // A tuck and a brake on the gap, not a governor: within a hand of km/h.
    const state = slope();
    placeRun(state, { x: 2000, z: 600, heading: 0, speed: 30 / 3.6 });
    for (let i = 0; i < 4 * 120; i++) step(state, holdInput(state, 30, 0, "straight", i / 120));
    expect(state.skier.speed * 3.6).toBeGreaterThan(24);
    expect(state.skier.speed * 3.6).toBeLessThan(42);
    expect(Math.abs(state.skier.heading)).toBeLessThan(0.1);
  });

  it("brakes in a check, throws the skis across in a stop and turns both ways in a carve", () => {
    const state = slope();
    expect(holdInput(state, 30, 0, "check", 0.1).brake).toBeGreaterThan(0.5);
    expect(holdInput(state, 30, 0, "check", 0.8).brake).toBe(0);
    expect(holdInput(state, 30, 0, "stop", 1)).toMatchObject({ brake: 1, steer: 1 });
    expect(holdInput(state, 30, 0, "carve", 0.6).steer).toBeGreaterThan(0.5);
    expect(holdInput(state, 30, 0, "carve", 1.8).steer).toBeLessThan(-0.5);
  });

  it("sets him going at the speed down the fall line, drawn after every frame", () => {
    const state = slope();
    placeRun(state, { x: 2000, z: 600, heading: 1.2, speed: 1 });
    let frames = 0;
    rideHold(state, { kmh: 40, move: "straight", seconds: 1 }, () => frames++);
    expect(frames).toBe(60);
    expect(state.skier.speed * 3.6).toBeGreaterThan(30);
    // The synthetic strip falls toward +z: heading 0.
    expect(Math.abs(state.skier.heading)).toBeLessThan(0.2);
  });

  it("rides a link's hold once, on the first frame, and nothing without one", () => {
    const state = slope();
    placeRun(state, { x: 2000, z: 600, heading: 0, speed: 1 });
    let frames = 0;
    const ride = heldRide({ kmh: 20, move: "straight", seconds: 0.5 });
    ride(state, () => frames++);
    ride(state, () => frames++);
    expect(frames).toBe(30);
    heldRide(null)(state, () => frames++);
    expect(frames).toBe(30);
  });
});

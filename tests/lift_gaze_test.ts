// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// LOOKING ROUND FROM THE LIFT (`pwa/src/game/lift-gaze.ts`): the drag only
// counts while the lift carries him, the world is grabbed, the lens keeps
// its distance from him, and the look goes home once he is let go.
import { describe, expect, it } from "vitest";

import type { LiftRide } from "@engine";

import {
  LIFT_GAZE,
  createGazeRig,
  createLiftGaze,
  dragGaze,
  gazeAllowed,
  gazing,
  stepGaze,
  swingLens,
} from "../pwa/src/game/lift-gaze.ts";

const riding = { phase: "ride" } as LiftRide;
const boarding = { phase: "board" } as LiftRide;

describe("the lift's free look", () => {
  it("is allowed only on the rope", () => {
    expect(gazeAllowed(riding)).toBe(true);
    expect(gazeAllowed(boarding)).toBe(false);
    expect(gazeAllowed(null)).toBe(false);
  });

  it("grabs the world: right turns the look left, down tips it up", () => {
    const g = createLiftGaze();
    dragGaze(g, 100, 0, 800, 64);
    expect(g.yaw).toBeLessThan(0);
    dragGaze(g, 0, 100, 800, 64);
    expect(g.pitch).toBeLessThan(0);
  });

  it("tips no further than its limits, and wraps the turn", () => {
    const g = createLiftGaze();
    dragGaze(g, 0, -1e5, 800, 64);
    expect(g.pitch).toBe(LIFT_GAZE.down);
    dragGaze(g, 0, 1e5, 800, 64);
    expect(g.pitch).toBe(-LIFT_GAZE.up);
    dragGaze(g, 1e4, 0, 800, 64);
    expect(Math.abs(g.yaw)).toBeLessThanOrEqual(Math.PI);
  });

  it("holds while carried and goes home, the short way, once let go", () => {
    const g = { yaw: 4, pitch: 0.5 };
    stepGaze(g, riding, 0.1);
    expect(g).toEqual({ yaw: 4, pitch: 0.5 });
    // Turned 4 rad right is 2.3 rad left: home the left way.
    stepGaze(g, null, 0.05);
    expect(g.yaw).toBeLessThan(0);
    for (let i = 0; i < 120; i++) stepGaze(g, null, 1 / 60);
    expect(gazing(g)).toBe(false);
  });

  it("swings the lens about him, keeping its distance", () => {
    const pivot = { x: 0, y: 10, z: 0 };
    const eye = { x: 0, y: 11, z: -3 };
    const target = { x: 0, y: 10.5, z: 5 };
    const dist = (p: typeof eye) => Math.hypot(p.x - pivot.x, p.y - pivot.y, p.z - pivot.z);
    const half = swingLens(eye, target, pivot, { yaw: Math.PI, pitch: 0 });
    expect(half.eye.z).toBeCloseTo(3);
    expect(half.target.z).toBeCloseTo(-5);
    const down = swingLens(eye, target, pivot, { yaw: 0.7, pitch: 0.6 });
    expect(dist(down.eye)).toBeCloseTo(dist(eye));
    expect(dist(down.target)).toBeCloseTo(dist(target));
    // Tipped down: the eye rises over him and the look falls.
    expect(down.eye.y).toBeGreaterThan(eye.y);
    expect(down.target.y - down.eye.y).toBeLessThan(target.y - eye.y);
  });

  it("takes drags into the lens only while the lift carries him", () => {
    const rig = createGazeRig();
    const lens = { eye: { x: 0, y: 11, z: -3 }, target: { x: 0, y: 10, z: 5 }, fov: 64, roll: 0 };
    const at = { x: 0, y: 10, z: 0 };
    const flat = { groundAt: () => 0 };
    rig.drag(200, 0);
    expect(rig.frame(lens, at, null, 1 / 60, 720, flat)).toBeNull();
    rig.drag(200, -400);
    const looked = rig.frame(lens, at, riding, 1 / 60, 720, flat);
    expect(looked?.eye.x).not.toBeCloseTo(0);
    // Kept over the snow however far down he looks.
    const high = { groundAt: () => 13 };
    rig.drag(0, -4000);
    expect(rig.frame(lens, at, riding, 1 / 60, 720, high)!.eye.y).toBeGreaterThanOrEqual(13.5);
  });
});

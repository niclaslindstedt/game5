// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREE RIDE: nobody else out there, no lights and no course — the clock
// and the odometer run, no gate is ever owed, a reset stands the skier on
// the nearest point of the piste, a spot picked on the chart is where it
// starts (held out of the trees and inside the edge), the day can be moved,
// and the snow dial sinks the powder deeper or shallower without drawing
// anything from the stream.

import { describe, expect, it } from "vitest";

import {
  SNOW_DIAL,
  clampSnowDepth,
  createGame,
  dayOfYearOf,
  freeHours,
  freeSpawn,
  hourOfTime,
  nearestTrackPoint,
  NEUTRAL_INPUT,
  placeRun,
  powderFloor,
  resetPose,
  restSinkOf,
  sinkTarget,
  step,
  sunAtRun,
  TIMES_OF_DAY,
  TUNING,
  withDay,
  type GameState,
} from "@engine";
import { flatLevel, LONE_TREE, SLOPE, syntheticLevel } from "./support/synthetic.ts";

function freeRide(extra: Parameters<typeof createGame>[0] = {}): GameState {
  return createGame({ level: syntheticLevel(), mode: "free", quiet: true, ...extra });
}

describe("the free ride's rules", () => {
  it("has no field, no lights and no course", () => {
    const state = freeRide();
    expect(state.rules.course).toBe(false);
    expect(state.rules.rivals).toBe(0);
    expect(state.rivals).toHaveLength(0);
    expect(state.phase).toBe("racing");
  });

  it("a race still counts its course", () => {
    const state = createGame({ level: syntheticLevel(), quiet: true });
    expect(state.rules.course).toBe(true);
  });

  it("owes no checkpoint: riding through the start line takes nothing", () => {
    const state = freeRide();
    const cp = state.level.checkpoints[0];
    placeRun(state, {
      x: cp.x - Math.sin(cp.heading) * 0.1,
      z: cp.z - Math.cos(cp.heading) * 0.1,
      heading: cp.heading,
      speed: 20,
    });
    step(state, { ...NEUTRAL_INPUT, tuck: 1 });
    expect(state.events.some((e) => e.kind === "checkpoint")).toBe(false);
    expect(state.progress.started).toBe(false);
    expect(state.progress.passed).toBe(0);
  });

  it("runs the clock and the odometer", () => {
    const state = freeRide();
    // In the powder beside the piste, pointed down the fall line.
    placeRun(state, { x: SLOPE.x + 100, z: 500, heading: 0, speed: 15 });
    for (let i = 0; i < 240; i++) step(state, { ...NEUTRAL_INPUT, tuck: 1 });
    expect(state.progress.time).toBeCloseTo(2, 5);
    // Two seconds at fifteen metres a second and more.
    expect(state.progress.distance).toBeGreaterThan(25);
    expect(state.progress.distance).toBeLessThan(80);
  });
});

describe("the free ride's reset", () => {
  it("stands the skier on the piste's nearest point, facing along it", () => {
    const state = freeRide();
    // Out in the powder east of the piste, half way down the face.
    placeRun(state, { x: SLOPE.x + 200, z: 700, heading: 1 });
    const pose = resetPose(state);
    const near = nearestTrackPoint(state.level, SLOPE.x + 200, 700);
    expect(pose.x).toBeCloseTo(near.x, 0);
    expect(pose.z).toBeCloseTo(near.z, 0);
    expect(pose.checkpoint).toBe(-1);
    step(state, { ...NEUTRAL_INPUT, reset: true });
    expect(state.events.some((e) => e.kind === "reset")).toBe(true);
    expect(Math.hypot(state.skier.x - near.x, state.skier.z - near.z)).toBeLessThan(1);
  });

  it("a race's reset still goes back to the start gate before one is taken", () => {
    const state = createGame({ level: syntheticLevel(), rivals: 0, countdown: 0, quiet: true });
    placeRun(state, { x: SLOPE.x + 200, z: 700, heading: 1 });
    // Back on the start line, a few metres above the start gate.
    const cp0 = state.level.checkpoints[0];
    const spawn = state.level.spawn;
    const pose = resetPose(state);
    expect(pose.checkpoint).toBe(-1);
    expect(Math.hypot(pose.x - spawn.x, pose.z - spawn.z)).toBeLessThan(1);
    expect(pose.z).toBeLessThan(cp0.z);
    expect(Math.hypot(pose.x - cp0.x, pose.z - cp0.z)).toBeLessThan(SLOPE.startGate + 1);
  });
});

describe("where a free ride starts", () => {
  it("starts on the start line when nothing was picked", () => {
    const state = freeRide();
    const slot = state.level.grid[0];
    expect(state.skier.x).toBeCloseTo(slot.x, 5);
    expect(state.skier.z).toBeCloseTo(slot.z, 5);
  });

  it("starts at the spot picked, facing the way the piste runs nearest it", () => {
    // Out in the powder beside a straight stretch of the piste.
    const state = freeRide({ spawn: { x: 400, z: 700 } });
    expect(state.skier.x).toBeCloseTo(400, 5);
    expect(state.skier.z).toBeCloseTo(700, 5);
    const near = nearestTrackPoint(state.level, 400, 700);
    const at = state.level.track.points[near.index];
    expect(Math.abs(Math.sin(state.skier.heading - at.heading))).toBeLessThan(0.2);
  });

  it("holds a spot off the map's edge inside it", () => {
    const level = syntheticLevel();
    const s = freeSpawn(level, -50, level.size + 80);
    const B = TUNING.bounds;
    expect(s.x).toBe(B.margin + B.soft);
    expect(s.z).toBe(level.size - B.margin - B.soft);
  });

  it("never stands a skis inside a trunk", () => {
    const level = syntheticLevel();
    const s = freeSpawn(level, LONE_TREE.x, LONE_TREE.z);
    expect(Math.hypot(s.x - LONE_TREE.x, s.z - LONE_TREE.z)).toBeGreaterThan(5);
    const near = nearestTrackPoint(level, LONE_TREE.x, LONE_TREE.z);
    expect(Math.hypot(s.x - near.x, s.z - near.z)).toBeLessThan(1);
  });

  it("a race ignores a spawn and starts on its grid", () => {
    const state = createGame({
      level: syntheticLevel(),
      rivals: 0,
      spawn: { x: 400, z: 200 },
      quiet: true,
    });
    expect(state.skier.x).toBeCloseTo(state.level.grid[0].x, 5);
  });
});

describe("the day a free ride is ridden on", () => {
  it("moves the sun and nothing else", () => {
    const level = syntheticLevel();
    const w = freeHours(level.sun.latitude, 40)!;
    const moved = withDay(level, { hour: (w.min + w.max) / 2, dayOfYear: 40 });
    expect(moved).not.toBe(level);
    expect(moved.sun.dayOfYear).toBe(40);
    expect(moved.sun.hour).toBeCloseTo((w.min + w.max) / 2);
    expect(moved.ground).toBe(level.ground);
    expect(moved.track).toBe(level.track);
    expect(moved.groundAt(123, 456)).toBe(level.groundAt(123, 456));
  });

  it("returns the very level when nothing moves", () => {
    const level = syntheticLevel();
    expect(withDay(level, { hour: null, dayOfYear: null })).toBe(level);
  });

  it("holds the hour inside the day's daylight", () => {
    const level = syntheticLevel();
    const w = freeHours(level.sun.latitude, level.sun.dayOfYear)!;
    expect(withDay(level, { hour: 1 }).sun.hour).toBeCloseTo(w.min);
    expect(withDay(level, { hour: 23 }).sun.hour).toBeCloseTo(w.max);
  });

  it("reads a time of day as an hour on the map's own date and latitude", () => {
    const level = syntheticLevel();
    const hours = TIMES_OF_DAY.map((time) => withDay(level, { time, dayOfYear: 20 }).sun.hour);
    // In the order the words say, the three lit ones inside the daylight.
    expect(hours).toEqual([...hours].sort((a, b) => a - b));
    const w = freeHours(level.sun.latitude, 20)!;
    for (const hour of hours.slice(0, 3)) {
      expect(hour).toBeGreaterThanOrEqual(w.min);
      expect(hour).toBeLessThanOrEqual(w.max);
    }
    expect(hourOfTime(level.sun.latitude, 20, "day")).toBeCloseTo((w.min + w.max) / 2);
  });

  it("stands a NIGHT ride with the sun under the horizon, past the daylight", () => {
    const level = syntheticLevel();
    for (const day of [-16, 20, 56, 91]) {
      const night = withDay(level, { time: "night", dayOfYear: day });
      expect(sunAtRun(night).elevation).toBeLessThan(-0.1);
      // A named time wins over an hour.
      expect(withDay(level, { time: "night", hour: 12, dayOfYear: day }).sun.hour).toBe(
        night.sun.hour,
      );
    }
  });

  it("reads a December day off a count before New Year", () => {
    expect(dayOfYearOf(-30)).toBe(335);
    expect(dayOfYearOf(1)).toBe(1);
    expect(dayOfYearOf(365)).toBe(365);
    expect(dayOfYearOf(366)).toBe(1);
  });

  it("is what createGame's day asks for", () => {
    const state = freeRide({ day: { dayOfYear: 60 } });
    expect(state.level.sun.dayOfYear).toBe(60);
  });
});

describe("the snow dial", () => {
  it("holds a depth inside the dial and reads none as the ordinary snow", () => {
    expect(clampSnowDepth(undefined)).toBe(1);
    expect(clampSnowDepth(Number.NaN)).toBe(1);
    expect(clampSnowDepth(10)).toBe(SNOW_DIAL.max);
    expect(clampSnowDepth(0)).toBe(SNOW_DIAL.min);
    expect(createGame({ level: syntheticLevel(), quiet: true }).snowDepth).toBe(1);
  });

  it("scales the powder's sink and leaves the groomer's cut alone", () => {
    expect(sinkTarget(0, 0, 1, 1, 2)).toBeCloseTo(2 * sinkTarget(0, 0, 1));
    expect(sinkTarget(1, 0, 1, 1, 2)).toBeCloseTo(sinkTarget(1, 0, 1));
    expect(powderFloor(0, 1, 0.5)).toBeCloseTo(0.5 * powderFloor(0, 1));
    expect(restSinkOf(1)).toBe(TUNING.snow.powderSink);
  });

  it("sinks a skis at rest in powder deeper on deep snow", () => {
    const at = (depth: number): number => {
      const state = createGame({
        level: flatLevel({ packed: 0 }),
        mode: "free",
        snowDepth: depth,
        quiet: true,
      });
      for (let i = 0; i < 240; i++) step(state, NEUTRAL_INPUT);
      return state.skier.y;
    };
    expect(at(2)).toBeLessThan(at(1) - 0.05);
    expect(at(0.25)).toBeGreaterThan(at(1) + 0.05);
  });

  it("is slower going in deep powder", () => {
    const speedAt = (depth: number): number => {
      const state = createGame({
        level: flatLevel({ packed: 0 }),
        mode: "free",
        snowDepth: depth,
        quiet: true,
      });
      for (let i = 0; i < 600; i++) step(state, { ...NEUTRAL_INPUT, tuck: 1 });
      return state.skier.speed;
    };
    expect(speedAt(2)).toBeLessThan(speedAt(1));
  });

  it("draws nothing from the stream: a run replays the same at any depth", () => {
    const ride = (depth: number): number => {
      const state = createGame({
        level: syntheticLevel(),
        rivals: 2,
        snowDepth: depth,
        quiet: true,
      });
      for (let i = 0; i < 600; i++) step(state, { ...NEUTRAL_INPUT, tuck: 1 });
      return state.rng.next();
    };
    expect(ride(2)).toBe(ride(1));
    const a = createGame({ level: syntheticLevel(), rivals: 2, snowDepth: 2, quiet: true });
    expect(a.rivals.every((r) => r.run.snowDepth === 2)).toBe(true);
  });
});

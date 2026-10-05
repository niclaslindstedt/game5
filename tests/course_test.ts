// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COURSE: the start gate first, then every gate in order down the piste
// and the finish line to end the run; a gate gone past is flagged and not
// credited; the reset, asked for and automatic.

import { describe, expect, it } from "vitest";

import {
  bearingToNext,
  createGame,
  crossedCheckpoint,
  crossingsToFinish,
  fromEuler,
  NEUTRAL_INPUT,
  placeRun,
  resetPose,
  step,
  TUNING,
  type Checkpoint,
  type GameEvent,
  type GameState,
} from "@engine";
import { flatLevel, syntheticLevel } from "./support/synthetic.ts";

/** Teleport the skier across a gate's line along its heading: stand him a
 * step short, then let one step carry him over. */
function crossAt(state: GameState, cp: Checkpoint, lateral = 0): GameEvent[] {
  const fx = Math.sin(cp.heading);
  const fz = Math.cos(cp.heading);
  const rx = Math.cos(cp.heading);
  const rz = -Math.sin(cp.heading);
  placeRun(state, {
    x: cp.x - fx * 0.1 + rx * lateral,
    z: cp.z - fz * 0.1 + rz * lateral,
    heading: cp.heading,
    speed: 20,
  });
  step(state, { ...NEUTRAL_INPUT, tuck: 1 });
  return [...state.events];
}

function freshRace(): GameState {
  return createGame({ level: syntheticLevel(), rivals: 0, countdown: 0, quiet: true });
}

describe("crossing a gate", () => {
  const cp: Checkpoint = { x: 0, z: 0, y: 0, heading: 0, width: 10, s: 0, colour: "red" };
  it("counts a move through its width in its facing direction", () => {
    expect(crossedCheckpoint(cp, 1, -1, 1, 1)).toBeCloseTo(1);
    expect(crossedCheckpoint(cp, 6, -1, 6, 1)).toBeCloseTo(6); // within the grace
    expect(crossedCheckpoint(cp, 9, -1, 9, 1)).toBeNull();
    expect(crossedCheckpoint(cp, 1, 1, 1, -1)).toBeNull(); // backwards
  });
});

describe("the run's order", () => {
  it("owes the start gate first, then each gate in turn, and the finish ends it", () => {
    const state = freshRace();
    const cps = state.level.checkpoints;
    expect(cps.length).toBeGreaterThan(4);
    expect(cps[cps.length - 1].s).toBeCloseTo(state.level.track.length, 6);
    expect(state.progress.nextCheckpoint).toBe(0);
    const first = crossAt(state, cps[0]);
    expect(first.some((e) => e.kind === "checkpoint" && e.index === 0)).toBe(true);
    expect(state.progress.started).toBe(true);
    expect(state.progress.lap).toBe(0);
    for (let i = 1; i < cps.length - 1; i++) {
      crossAt(state, cps[i]);
      expect(state.progress.finished).toBe(false);
    }
    const last = crossAt(state, cps[cps.length - 1]);
    expect(last.some((e) => e.kind === "lap" && e.lap === 1)).toBe(true);
    expect(last.some((e) => e.kind === "finish")).toBe(true);
    expect(state.progress.finished).toBe(true);
    expect(state.phase).toBe("finished");
    expect(state.progress.passed).toBe(crossingsToFinish(state));
    expect(state.progress.passed).toBe(cps.length);
    expect(state.progress.lapTimes).toHaveLength(1);
  });

  it("does not credit a gate out of turn, and flags the one gone past", () => {
    const state = freshRace();
    const cps = state.level.checkpoints;
    crossAt(state, cps[0]);
    const skipped = crossAt(state, cps[2]);
    expect(skipped.some((e) => e.kind === "checkpoint")).toBe(false);
    expect(state.progress.nextCheckpoint).toBe(1);
    const missed = crossAt(state, cps[2]);
    expect(missed.some((e) => e.kind === "checkpoint")).toBe(false);
    // Gone past gate 1 when crossing 2's line: the arrow points back.
    crossAt(state, cps[1], 30);
    expect(state.progress.nextCheckpoint).toBe(1);
    const back = crossAt(state, cps[1]);
    expect(back.some((e) => e.kind === "checkpoint" && e.index === 1)).toBe(true);
    expect(state.progress.missed).toBeNull();
  });

  it("flags a gate skied past", () => {
    const state = freshRace();
    const cps = state.level.checkpoints;
    crossAt(state, cps[0]);
    const events = crossAt(state, cps[2]);
    expect(events.some((e) => e.kind === "missed" && e.index === 1)).toBe(true);
    expect(state.progress.missed).toBe(1);
    const bearing = bearingToNext(state)!;
    expect(bearing.index).toBe(1);
  });

  it("flags a gate the moment it is skied past beside it, not at the next one", () => {
    const state = freshRace();
    const cps = state.level.checkpoints;
    crossAt(state, cps[0]);
    const beside = crossAt(state, cps[1], cps[1].width / 2 + TUNING.course.grace + 3);
    expect(beside.some((e) => e.kind === "missed" && e.index === 1)).toBe(true);
    expect(state.progress.missed).toBe(1);
    expect(state.progress.nextCheckpoint).toBe(1);
    // ...and the order still stands: the next one is not credited until it is taken.
    expect(crossAt(state, cps[2]).some((e) => e.kind === "checkpoint")).toBe(false);
    expect(crossAt(state, cps[1]).some((e) => e.kind === "checkpoint" && e.index === 1)).toBe(true);
    expect(state.progress.missed).toBeNull();
  });

  it("does not take a crossing of the line's far extension for a gate skied past", () => {
    const state = freshRace();
    const cps = state.level.checkpoints;
    crossAt(state, cps[0]);
    const far = cps[1].width / 2 + TUNING.course.grace + TUNING.course.missReach + 5;
    expect(crossAt(state, cps[1], far).some((e) => e.kind === "missed")).toBe(false);
    expect(state.progress.missed).toBeNull();
  });

  it("does not count a crossing outside the gate's width", () => {
    const state = freshRace();
    const cps = state.level.checkpoints;
    crossAt(state, cps[0]);
    const wide = crossAt(state, cps[1], cps[1].width / 2 + TUNING.course.grace + 3);
    expect(wide.some((e) => e.kind === "checkpoint")).toBe(false);
  });

  it("is generous on the start gate's crossing only", () => {
    const state = freshRace();
    const cps = state.level.checkpoints;
    const off = cps[0].width / 2 + TUNING.course.grace + TUNING.course.startGrace / 2;
    expect(crossAt(state, cps[0], off).some((e) => e.kind === "checkpoint")).toBe(true);
    expect(crossAt(state, cps[1], off).some((e) => e.kind === "checkpoint")).toBe(false);
  });
});

describe("the reset", () => {
  it("stands the skier on the piste past the last gate taken, at rest", () => {
    const state = freshRace();
    const cps = state.level.checkpoints;
    crossAt(state, cps[0]);
    crossAt(state, cps[1]);
    placeRun(state, { x: 300, z: 200, heading: 1, speed: 10 });
    step(state, { ...NEUTRAL_INPUT, reset: true });
    expect(state.events.some((e) => e.kind === "reset" && e.checkpoint === 1 && !e.auto)).toBe(
      true,
    );
    const c = state.skier;
    expect(Math.hypot(c.x - cps[1].x, c.z - cps[1].z)).toBeLessThan(TUNING.course.resetAhead + 1);
    expect(c.speed).toBe(0);
    expect(state.level.packedAt(c.x, c.z)).toBe(1);
    expect(state.progress.nextCheckpoint).toBe(2);
  });

  it("before the start gate, stands the skier on the start line above it", () => {
    const state = freshRace();
    const pose = resetPose(state);
    expect(pose.checkpoint).toBe(-1);
    const cp = state.level.checkpoints[0];
    const along = (pose.x - cp.x) * Math.sin(cp.heading) + (pose.z - cp.z) * Math.cos(cp.heading);
    expect(along).toBeLessThan(0);
    expect(pose.x).toBeCloseTo(state.level.spawn.x, 6);
  });

  it("happens by itself to a skier left on his back", () => {
    const state = freshRace();
    placeRun(state, { x: 300, z: 300, heading: 0 });
    state.skier.q = fromEuler(0, 0, Math.PI);
    state.skier.y += 1;
    const events: GameEvent[] = [];
    for (let i = 0; i < (TUNING.crash.lieFor + 2) * TUNING.physicsHz; i++) {
      step(state, NEUTRAL_INPUT);
      events.push(...state.events);
    }
    expect(events.some((e) => e.kind === "reset" && e.auto)).toBe(true);
  });

  it("happens by itself to a skier poling in deep powder going nowhere", () => {
    const state = freshRace();
    placeRun(state, { x: 300, z: 300, heading: 0 });
    const events: GameEvent[] = [];
    // Pinned: his way taken off him every step, as a skier wedged in a
    // drift. In the powder he sinks first (`trench.ts`), and the engine
    // gives him the hole's own hold to work out before it steps in.
    for (let i = 0; i < 14 * TUNING.physicsHz; i++) {
      state.skier.vx = state.skier.vz = 0;
      step(state, { ...NEUTRAL_INPUT, tuck: 1 });
      state.skier.vx = state.skier.vz = 0;
      events.push(...state.events);
      if (events.some((e) => e.kind === "reset")) break;
    }
    const reset = events.find((e) => e.kind === "reset");
    expect(reset && reset.kind === "reset" && reset.auto).toBe(true);
    expect(events.some((e) => e.kind === "stuck")).toBe(true);
    expect(reset!.t).toBeGreaterThan(TUNING.trench.holdFor);
  });

  it("comes after the plain hold on packed snow, where nothing sinks", () => {
    const state = createGame({
      level: flatLevel({ packed: 1 }),
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
    placeRun(state, { x: 1500, z: 300, heading: 0 });
    const events: GameEvent[] = [];
    for (let i = 0; i < 5 * TUNING.physicsHz; i++) {
      state.skier.vx = state.skier.vz = 0;
      step(state, { ...NEUTRAL_INPUT, tuck: 1 });
      state.skier.vx = state.skier.vz = 0;
      events.push(...state.events);
      if (events.some((e) => e.kind === "reset")) break;
    }
    expect(events.some((e) => e.kind === "reset" && e.auto)).toBe(true);
    expect(events.some((e) => e.kind === "stuck")).toBe(false);
  });
});

describe("the lights", () => {
  it("count three, then GO, and hold the skier in the gate until then", () => {
    const state = createGame({ level: syntheticLevel(), rivals: 0, quiet: true });
    expect(state.phase).toBe("countdown");
    const events: GameEvent[] = [];
    const x0 = state.skier.x;
    const z0 = state.skier.z;
    for (let i = 0; i < 4 * TUNING.physicsHz; i++) {
      step(state, { ...NEUTRAL_INPUT, tuck: 1 });
      events.push(...state.events);
      if (state.phase === "countdown") {
        expect(Math.hypot(state.skier.x - x0, state.skier.z - z0)).toBeLessThan(1e-9);
        expect(state.progress.time).toBe(0);
      }
    }
    expect(
      events.filter((e) => e.kind === "count").map((e) => e.kind === "count" && e.left),
    ).toEqual([3, 2, 1]);
    expect(events.some((e) => e.kind === "go")).toBe(true);
    expect(state.phase).toBe("racing");
    expect(state.progress.time).toBeGreaterThan(0.9);
  });

  it("hold him in the gate above a pitch no plough could stand on, and let him go at GO", () => {
    // A 31° face from the start line down: his brake alone would slide.
    const state = createGame({
      level: flatLevel({ grade: 0.6, slopeFrom: 0 }),
      rivals: 0,
      countdown: 10,
      quiet: true,
    });
    const x0 = state.skier.x;
    const z0 = state.skier.z;
    for (let i = 0; i < 10 * TUNING.physicsHz && state.phase === "countdown"; i++) {
      step(state, NEUTRAL_INPUT);
      if (state.phase === "countdown")
        expect(Math.hypot(state.skier.x - x0, state.skier.z - z0)).toBeLessThan(1e-9);
    }
    expect(state.phase).toBe("racing");
    for (let i = 0; i < TUNING.physicsHz; i++) step(state, { ...NEUTRAL_INPUT, tuck: 1 });
    expect(state.skier.speed).toBeGreaterThan(3);
  });
});

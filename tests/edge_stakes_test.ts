// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE EDGE STAKES (`edge-stakes.ts`): light poles that give. Met slowly a
// stake bends over and whips back up; met fast it snaps and stays down;
// either way it takes little off the skier's speed and is met once — and
// run into fast enough it throws him.

import { describe, expect, it } from "vitest";

import {
  createGame,
  NEUTRAL_INPUT,
  placeRun,
  stakePlan,
  step,
  TUNING,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";
import { syntheticLevel } from "./support/synthetic.ts";

const GLIDE: SkierInput = { ...NEUTRAL_INPUT };
const level = syntheticLevel();
const plan = stakePlan(level);
// A stake on the straight below the S-bend, where the face falls along +z.
const index = plan.stakes.findIndex((p) => p.z > 600 && p.z < 900);
const stake = plan.stakes[index];

/** The skier `back` m above the stake, aimed straight at it at `kmh`,
 * gliding on. */
function intoStake(kmh: number, back = 2): { state: GameState; events: GameEvent[] } {
  const state = createGame({ level, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: stake.x, z: stake.z - back, heading: 0, speed: kmh / 3.6 });
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(0.5 * TUNING.physicsHz); i++) {
    step(state, GLIDE);
    events.push(...state.events);
  }
  return { state, events };
}

/** Ride on for `seconds`, the events kept. */
function on(state: GameState, seconds: number, events: GameEvent[]): void {
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
    step(state, GLIDE);
    events.push(...state.events);
  }
}

describe("the edge stakes' plan", () => {
  it("stands a stake down both edges of the piste, every one banded on one side", () => {
    expect(plan.count).toBeGreaterThan(40);
    expect(index).toBeGreaterThanOrEqual(0);
    const banded = plan.banded.reduce((n, b) => n + b, 0);
    expect(banded).toBeGreaterThan(plan.count / 3);
    expect(banded).toBeLessThan((plan.count * 2) / 3);
    expect(stakePlan(level)).toBe(plan);
  });
});

describe("a stake met", () => {
  it("slowly bends over, costs almost nothing, and whips back up", () => {
    const { state, events } = intoStake(15);
    const knocks = events.filter((e) => e.kind === "stake");
    expect(knocks).toHaveLength(1);
    const k = knocks[0];
    expect(k.kind === "stake" && k.broke).toBe(false);
    expect(state.stakes!.broken[index]).toBe(0);
    expect(state.stakes!.tilt[index]).not.toBe(0);
    // Not a trunk: he rides on past it.
    expect(state.skier.z).toBeGreaterThan(stake.z);
    expect(events.some((e) => e.kind === "hit" || e.kind === "wipeout")).toBe(false);
    on(state, 4, events);
    expect(state.stakes!.tilt[index]).toBe(0);
    expect(events.filter((e) => e.kind === "stake")).toHaveLength(1);
  });

  it("fast snaps it, and it stays down", () => {
    const { state, events } = intoStake(40);
    const k = events.find((e) => e.kind === "stake");
    expect(k && k.kind === "stake" && k.broke).toBe(true);
    expect(state.stakes!.broken[index]).toBe(1);
    expect(events.some((e) => e.kind === "wipeout")).toBe(false);
    on(state, 3, events);
    expect(state.stakes!.broken[index]).toBe(1);
    expect(state.stakes!.tilt[index]).toBeCloseTo(TUNING.stakes.broken, 5);
  });

  it("takes only a little off his speed, and turns him", () => {
    const glide = createGame({ level, rivals: 0, countdown: 0, quiet: true });
    placeRun(glide, { x: stake.x + 4, z: stake.z - 2, heading: 0, speed: 40 / 3.6 });
    const { state } = intoStake(40);
    on(glide, 0.5, []);
    // The same glide beside the stake, untouched.
    expect(glide.skier.speed - state.skier.speed).toBeGreaterThan(0.2);
    expect(glide.skier.speed - state.skier.speed).toBeLessThan(1.5);
  });

  it("is ridden across once it is down", () => {
    const { state, events } = intoStake(40);
    // Back above it, and through it again.
    placeRun(state, { x: stake.x, z: stake.z - 2, heading: 0, speed: 40 / 3.6 });
    events.length = 0;
    on(state, 0.5, events);
    expect(events.some((e) => e.kind === "stake")).toBe(false);
  });

  it("too fast throws him", () => {
    const { events } = intoStake(70);
    const fall = events.find((e) => e.kind === "wipeout");
    expect(fall && fall.kind === "wipeout" && fall.cause).toBe("stake");
  });

  it("is every run's own: a fresh run finds every stake standing", () => {
    intoStake(40);
    const fresh = createGame({ level, rivals: 0, countdown: 0, quiet: true });
    expect(fresh.stakes).toBeUndefined();
  });
});

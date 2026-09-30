// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARCADE'S TWO HANDS ON THE SKIS (`Assist`, engine/game/defs/modes.ts):
// the hold on the yaw and the levelling of the roll in the air. Every hand is
// on unless a run asks otherwise, the field always rides with every hand on,
// the dials draw nothing from the stream — and each one actually does what
// its row on OPTIONS says it does.

import { describe, expect, it } from "vitest";

import {
  FULL_ASSIST,
  NEUTRAL_INPUT,
  createGame,
  placeRun,
  step,
  TUNING,
  type Assist,
  type GameState,
  type SkierInput,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

const PACKED = flatLevel({ packed: 1 });

function stage(assist?: Assist, speed = 60 / 3.6): GameState {
  const state = createGame({ level: PACKED, rivals: 0, countdown: 0, quiet: true, assist });
  placeRun(state, { x: 1500, z: 150, heading: 0, speed });
  return state;
}

function ride(state: GameState, seconds: number, input: SkierInput): void {
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) step(state, input);
}

describe("the assist dials", () => {
  it("puts every hand on when a run names none, and on every rival whatever it names", () => {
    expect(createGame({ level: PACKED, rivals: 0, quiet: true }).assist).toEqual(FULL_ASSIST);
    const bare = createGame({ level: PACKED, rivals: 3, quiet: true, assist: { yaw: 0, air: 0 } });
    expect(bare.assist).toEqual({ yaw: 0, air: 0 });
    for (const rival of bare.rivals) expect(rival.run.assist).toEqual(FULL_ASSIST);
  });

  it("draws nothing from the stream: a run replays the same at any setting", () => {
    const runs = [FULL_ASSIST, { yaw: 0, air: 0 }].map((assist) => {
      const state = stage(assist);
      ride(state, 3, { ...NEUTRAL_INPUT, tuck: 0.7, steer: 0.6 });
      return state.rng.next();
    });
    expect(runs[0]).toBe(runs[1]);
  });

  it("holds the yaw with the hand on, and lets the skis find its own without it", () => {
    // Half an edge: a bend the grip holds, so that without the hand the
    // sidecut alone carves it (a full edge at 60 km/h asks for more than
    // the edges hold, and the bare physics spins through the skid — which
    // is what the hand is for).
    const turn: SkierInput = { ...NEUTRAL_INPUT, tuck: 0.6, steer: 0.5 };
    const held = stage(FULL_ASSIST);
    const bare = stage({ yaw: 0, air: 1 });
    ride(held, 1.5, turn);
    ride(bare, 1.5, turn);
    // Both still turn the way the bars say — the hold is help, not the steering.
    expect(Math.sign(held.skier.heading)).toBe(1);
    expect(Math.sign(bare.skier.heading)).toBe(1);
    expect(Math.abs(held.skier.heading - bare.skier.heading)).toBeGreaterThan(0.01);
  });

  it("levels the roll in the air only as far as the hand is on", () => {
    const rollAfter = (air: number): number => {
      const state = stage({ yaw: 1, air });
      placeRun(state, { x: 1500, z: 150, heading: 0, speed: 20, height: 12, roll: 0.4 });
      ride(state, 0.5, NEUTRAL_INPUT);
      expect(state.skier.airborne).toBe(true);
      return Math.abs(state.skier.roll);
    };
    const bare = rollAfter(0);
    const half = rollAfter(0.5);
    const full = rollAfter(1);
    expect(full).toBeLessThan(half);
    expect(half).toBeLessThan(bare);
    // With no hand on, nothing but the air's damping touches the roll.
    expect(bare).toBeGreaterThan(0.3);
  });
});

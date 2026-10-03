// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STEP TURN ON THE SPOT (`poles.ts`'s `stepRound`): stood still with
// only a steer held, the skier steps his skis round a pair at a time —
// the inside ski first, then the outside brought alongside — and goes
// nowhere. Staged on the drag strip with `placeRun`, and as the figure
// draws it (`skier-gait.ts`'s `pivotGait`). The skate turn he makes when
// he is going is `drive_test.ts`'s.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  SKIS,
  TUNING,
  angleDiff,
  createGame,
  pivotSteps,
  placeRun,
  step,
  type GameState,
  type SkierInput,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";
import { gaitOf, pivotGait } from "../pwa/src/game/skier-gait.ts";

const PACKED = flatLevel({ packed: 1 });
const P = TUNING.poles.pivot;

function stage(poles = true): GameState {
  const state = createGame({
    level: PACKED,
    spec: SKIS,
    rivals: 0,
    countdown: 0,
    quiet: true,
    poles,
  });
  placeRun(state, { x: 1500, z: 300, heading: 0 });
  return state;
}

/** Ski `seconds` on `input`; the heading turned, rad, clockwise positive. */
function ride(state: GameState, seconds: number, input: Partial<SkierInput>): number {
  let turned = 0;
  let prev = state.skier.heading;
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) {
    step(state, { ...NEUTRAL_INPUT, ...input });
    turned += angleDiff(prev, state.skier.heading);
    prev = state.skier.heading;
  }
  return turned;
}

describe("the step turn on the spot (poles.ts' stepRound)", () => {
  for (const poles of [true, false]) {
    it(`turns him where he stands, a pair of steps at a time, and goes nowhere${poles ? "" : " — without poles too"}`, () => {
      const state = stage(poles);
      const x0 = state.skier.x;
      const z0 = state.skier.z;
      const turned = ride(state, 3, { steer: 1 });
      expect(Math.hypot(state.skier.x - x0, state.skier.z - z0)).toBeLessThan(0.05);
      expect(state.skier.drive).toBe(0);
      // About a pair a second at the step's angle, either way.
      const pairs = 3 * P.steps;
      expect(turned).toBeGreaterThan(0.8 * pairs * P.angle);
      expect(turned).toBeLessThan(1.4 * pairs * P.angle);
      expect(ride(stage(poles), 3, { steer: -1 })).toBeCloseTo(-turned, 6);
    });
  }

  it("stands his skis on no edge while he steps", () => {
    const state = stage();
    ride(state, 1, { steer: 1 });
    expect(Math.abs(state.skier.edge)).toBeLessThan(0.02);
  });

  it("finishes the pair begun when the key is let go, and stands with his skis together", () => {
    const state = stage();
    const first = ride(state, 0.3, { steer: 1 });
    expect(state.skier.stride % 1).toBeGreaterThan(0);
    const after = ride(state, 1.5, {});
    expect(after).toBeGreaterThan(0);
    expect(state.skier.stride % 1).toBe(0);
    expect(state.skier.pivot).toBe(0);
    // One whole pair turned in all, and nothing more once it is down.
    expect(first + after).toBeCloseTo(P.angle, 3);
  });

  it("turns in STEPS: still between them, never a smooth spin", () => {
    const state = stage();
    const rates: number[] = [];
    let prev = state.skier.heading;
    for (let i = 0; i < 2 * TUNING.physicsHz; i++) {
      step(state, { ...NEUTRAL_INPUT, steer: 1 });
      rates.push(angleDiff(prev, state.skier.heading) * TUNING.physicsHz);
      prev = state.skier.heading;
    }
    const most = Math.max(...rates);
    // Each step eases to a halt before the next: some moments all but still.
    expect(rates.filter((r) => r < 0.1 * most).length).toBeGreaterThan(10);
    expect(Math.min(...rates)).toBeGreaterThanOrEqual(-1e-9);
  });

  it("is not taken when he is asked to go: the tuck sets him skating round", () => {
    const state = stage();
    ride(state, 2, { steer: 1, tuck: 1 });
    expect(state.skier.pivot).toBe(0);
    expect(state.skier.speed).toBeGreaterThan(2);
  });
});

describe("the step turn as drawn (skier-gait.ts' pivotGait)", () => {
  it("steps the inside ski round first, then brings the outside one alongside", () => {
    expect(pivotSteps(0).body).toBe(0);
    expect(pivotSteps(1).body).toBe(1);
    const mid = pivotGait(0.47, 1);
    // Stepping right: the right ski's tip out, the left's in — a V.
    expect(mid.splay[1]).toBeGreaterThan(0.15);
    expect(mid.splay[0]).toBeLessThan(-0.15);
    // The tails kept together: each boot moved toward its tip's side.
    expect(mid.out[1] - mid.out[0]).toBeGreaterThan(0.1);
    // The stepping ski is off the snow, the standing one on it.
    const first = pivotGait(0.22, 1);
    expect(first.lift[1]).toBeGreaterThan(0.05);
    expect(first.lift[0]).toBe(0);
    const second = pivotGait(0.72, 1);
    expect(second.lift[0]).toBeGreaterThan(0.05);
    expect(second.lift[1]).toBe(0);
    // Together at both ends of a pair.
    for (const u of [0, 1]) {
      const g = pivotGait(u, 1);
      expect(Math.abs(g.splay[0])).toBeLessThan(1e-9);
      expect(Math.abs(g.splay[1])).toBeLessThan(1e-9);
    }
  });

  it("is the gait of a skier stepping round on the spot, and still otherwise", () => {
    const still = { drive: 0, speed: 0, pitch: 0, airborne: false, thrown: null, stride: 3.3 };
    expect(gaitOf({ ...still, pivot: 1 }).pivot).toBe(1);
    expect(gaitOf({ ...still, pivot: -1 }).splay[0]).toBeLessThan(0);
    expect(gaitOf(still).pivot).toBe(0);
  });
});

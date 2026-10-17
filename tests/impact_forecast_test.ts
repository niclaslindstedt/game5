// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BLOW SEEN COMING (`pwa/src/game/impact-forecast.ts`): the run read a
// moment ahead off a copy of it — the bone that breaks seen before it does,
// at the step it does, and the run itself left exactly as it was.

import { describe, expect, it } from "vitest";
import {
  TUNING,
  createGame,
  liftPlans,
  ropeOver,
  standSkier,
  step,
  NEUTRAL_INPUT,
  type GameState,
} from "@engine";

import { forecast, forkRun } from "../pwa/src/game/impact-forecast.ts";
import { stageTrial, type Staging } from "./support/injury-stage.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const INTO_A_TRUNK: Staging = {
  stage: { how: "ski", stuff: "trunk", speed: 22, offset: 0 },
  ground: "groomed",
};

/** The steps until the first injury that breaks a bone, or −1. */
function firstBreak(state: GameState, input: Parameters<typeof step>[1], most: number): number {
  for (let i = 1; i <= most; i++) {
    step(state, input);
    if (state.events.some((e) => e.kind === "injury")) return i;
  }
  return -1;
}

describe("the blow seen coming", () => {
  it("sees a trunk skied into before it is met, at the step it is met", () => {
    const { state, input } = stageTrial(INTO_A_TRUNK, 0, true);
    let seen = null;
    let k = 0;
    for (; k < 600 && !seen; k++) {
      seen = forecast(state, input, 0.5);
      if (!seen) step(state, input);
    }
    expect(seen).not.toBeNull();
    const at = firstBreak(state, input, 200);
    expect(at).toBeGreaterThan(0);
    expect(Math.abs(at * TUNING.dt - seen!.in)).toBeLessThan(TUNING.dt * 1.5);
  });

  it("sees a lift's rope go through him at the waist as the blow, not the hand it cut first", () => {
    // Flown square at a chair's down rope at 25 m/s, the rope at his waist:
    // it goes through a hand and an arm a step before it parts him there.
    const level = levelFor(LEVEL_SEEDS[0]);
    const chair = liftPlans(level).find((p) => p.lift.kind === "chair")!;
    const run = createGame({ level, mode: "free", quiet: true, gore: true });
    const p = ropeOver(chair, 1, chair.length * 0.5);
    const hx = chair.dz;
    const hz = -chair.dx;
    standSkier(run, p.x + hx * 5, p.z + hz * 5, Math.atan2(-hx, -hz));
    const c = run.skier;
    c.y = p.y + c.spec.cogHeight - 1.3;
    c.vx = -hx * 25;
    c.vz = -hz * 25;
    c.airborne = true;
    const seen = forecast(run, NEUTRAL_INPUT, 0.5);
    expect(seen?.tear?.piece).toBe("lower");
    expect(seen?.fatal).toBe(true);
  });

  it("leaves the run it reads exactly as it was", () => {
    const a = stageTrial(INTO_A_TRUNK, 3, true);
    const b = stageTrial(INTO_A_TRUNK, 3, true);
    const trail = (s: GameState) => JSON.stringify([s.t, s.skier, s.gore, s.progress]);
    for (let i = 0; i < 400; i++) {
      if (i % 6 === 0) forecast(a.state, a.input, 0.4);
      step(a.state, a.input);
      step(b.state, b.input);
      expect(a.state.events).toEqual(b.state.events);
    }
    expect(trail(a.state)).toBe(trail(b.state));
    expect(a.state.rng.next()).toBe(b.state.rng.next());
  });

  it("copies the run without sharing anything but the map", () => {
    const { state } = stageTrial(INTO_A_TRUNK, 0, true);
    const fork = forkRun(state);
    expect(fork.level).toBe(state.level);
    expect(fork.skier).not.toBe(state.skier);
    expect(fork.skier.body).not.toBe(state.skier.body);
    expect(fork.rng).not.toBe(state.rng);
    expect(fork.rivals).toEqual([]);
  });
});

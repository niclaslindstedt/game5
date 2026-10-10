// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOP INTO SWITCH (`switch.ts`'s `hopSwitch`): a skier riding forward
// on a free ride or a tricks run (ridden here on the tricks run, which has
// no crowd to bump) who pops a jump with the edge held under
// 40 km/h is turned half round in the air off it, the way the edge is held,
// and lands riding switch — and stays switch a while however slow he is.
// A jump with the edge let go, or popped too fast, or on a race, is a jump.

import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  SKI_CATALOG,
  TUNING,
  createGame,
  placeRun,
  step,
  switchTurn,
  type GameEvent,
  type GameMode,
  type GameState,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

/** Riding forward down a gentle groomer at `speed` m/s, facing +z. */
function forward(speed: number, mode: GameMode = "tricks", grade = 0.08): GameState {
  const state = createGame({
    level: flatLevel({ packed: 1, grade, slopeFrom: 0 }),
    mode,
    countdown: 0,
    quiet: true,
    spec: SKI_CATALOG[0],
  });
  placeRun(state, { x: 1500, z: 200, heading: 0, pitch: -Math.atan(grade), speed });
  return state;
}

/** Pop a jump with the edge held `steer` and ride on `seconds`: whether a
 * turn was under way in the air, the heading half way through it, and the
 * events. */
function hop(state: GameState, steer: number, seconds = 2) {
  const events: GameEvent[] = [];
  let inAir = false;
  let mid: number | null = null;
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
    step(state, { ...NEUTRAL_INPUT, steer: i < 30 ? steer : 0, jump: i < 12 });
    events.push(...state.events);
    const r = state.skier.revert;
    if (r && state.skier.airborne) inAir = true;
    if (r && mid === null && r.u >= 0.5) mid = state.skier.heading;
  }
  return { events, inAir, mid };
}

describe("the hop into switch", () => {
  it("turns a forward skier half round off a jump with the edge held, and lands him switch", () => {
    for (const steer of [1, -1]) {
      const state = forward(6);
      const out = hop(state, steer);
      const c = state.skier;
      expect(out.inAir, `steer ${steer}`).toBe(true);
      expect(
        out.events.filter((e) => e.kind === "wipeout"),
        `steer ${steer}`,
      ).toHaveLength(0);
      expect(c.revert ?? null, `steer ${steer}`).toBeNull();
      expect(c.switched, `steer ${steer}`).toBe(true);
      // Tails first down the line he still travels.
      expect(c.way, `steer ${steer}`).toBeLessThan(0);
      expect(Math.cos(c.heading + Math.PI - Math.atan2(c.vx, c.vz))).toBeGreaterThan(0.95);
      // Half way round, turned to the side the edge asked: right is +x.
      expect(Math.sign(Math.sin(out.mid ?? 0)), `steer ${steer}`).toBe(steer);
    }
  });

  it("stays switch after it, slow as he is, before the revert may take it off him", () => {
    const state = forward(3, "tricks", 0);
    hop(state, 1, 1);
    expect(state.skier.switched).toBe(true);
    // Under the revert's 15 km/h, held switch for a moment...
    let reverted = false;
    for (let i = 0; i < 0.8 * TUNING.physicsHz; i++) {
      step(state, NEUTRAL_INPUT);
      if (state.skier.revert) reverted = true;
    }
    expect(reverted).toBe(false);
  });

  it("turns the way the edge is held even the long way round", () => {
    // Facing +z, sliding a touch to the right: the tails' line is a little
    // left of straight behind him — the edge held left takes the long way.
    const c = forward(6).skier;
    c.vx = 1;
    expect(switchTurn(c, 1)).toBeGreaterThan(0);
    expect(switchTurn(c, -1)).toBeLessThan(0);
    expect(Math.abs(switchTurn(c, 1)) + Math.abs(switchTurn(c, -1))).toBeCloseTo(2 * Math.PI, 5);
  });

  it("leaves a jump with the edge let go, a fast one, and a race's a jump", () => {
    const cases: [number, number, GameMode][] = [
      [6, 0, "tricks"],
      [TUNING.switch.hop.below + 1, 1, "tricks"],
      [6, 1, "slalom"],
    ];
    for (const [speed, steer, mode] of cases) {
      const state = forward(speed, mode);
      const out = hop(state, steer, 1.2);
      expect(out.inAir, `${mode} ${speed} ${steer}`).toBe(false);
      expect(state.skier.switched, `${mode} ${speed} ${steer}`).toBe(false);
    }
  });
});

describe("the hop into switch, the edge pressed late", () => {
  it("still hops him round with the edge pressed just after the pop", () => {
    const state = forward(6);
    let inAir = false;
    for (let i = 0; i < 2 * TUNING.physicsHz; i++) {
      // The jump tapped, then the side a few steps later, off the snow.
      step(state, { ...NEUTRAL_INPUT, jump: i < 12, steer: i >= 16 && i < 40 ? 1 : 0 });
      if (state.skier.revert && state.skier.airborne) inAir = true;
    }
    expect(inAir).toBe(true);
    expect(state.skier.switched).toBe(true);
  });

  it("leaves the edge pressed long after the pop alone", () => {
    const state = forward(6);
    let turned = false;
    for (let i = 0; i < 2 * TUNING.physicsHz; i++) {
      step(state, { ...NEUTRAL_INPUT, jump: i < 12, steer: i >= 40 && i < 60 ? 1 : 0 });
      if (state.skier.revert) turned = true;
    }
    expect(turned).toBe(false);
  });
});

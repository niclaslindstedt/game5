// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REVERT (`switch.ts`): a skier riding switch on a free ride or a
// tricks run who slows under 15 km/h turns round on his flat skis to ride
// forward — the way the steer asks, or the shorter way onto his line —
// keeps most of his way through it, and poles and skates off; above it he
// stays switch, and a race never rides switch at all.

import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  SKI_CATALOG,
  TUNING,
  createGame,
  placeRun,
  revertShare,
  step,
  type GameEvent,
  type GameMode,
  type GameState,
  type SkierInput,
} from "@engine";
import { revertLook, revertRise } from "../pwa/src/game/skier-switch.ts";
import { flatLevel } from "./support/synthetic.ts";

/** Riding switch across the flat groomer at `speed` m/s, tails first. */
function switched(speed: number, mode: GameMode = "free", grade = 0): GameState {
  const state = createGame({
    level: flatLevel({ packed: 1, grade, slopeFrom: 0 }),
    mode,
    countdown: 0,
    quiet: true,
    spec: SKI_CATALOG[0],
  });
  placeRun(state, { x: 1500, z: 200, heading: Math.PI, pitch: Math.atan(grade), speed: -speed });
  return state;
}

function ride(state: GameState, seconds: number, input: Partial<SkierInput> = {}) {
  const events: GameEvent[] = [];
  let reverted = false;
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
    step(state, { ...NEUTRAL_INPUT, ...input });
    events.push(...state.events);
    if (state.skier.revert) reverted = true;
  }
  return { events, reverted };
}

const BELOW = TUNING.switch.revert.below;

describe("the revert", () => {
  it("turns a slow switch skier round onto his line, keeps his way and poles off", () => {
    const state = switched(BELOW - 1);
    const out = ride(state, 1.2);
    const c = state.skier;
    expect(out.reverted).toBe(true);
    expect(out.events.filter((e) => e.kind === "wipeout")).toHaveLength(0);
    expect(c.revert ?? null).toBeNull();
    expect(c.switched).toBe(false);
    // Faced down the line he travels, going forward...
    expect(c.way).toBeGreaterThan(0);
    expect(Math.cos(c.heading - Math.atan2(c.vx, c.vz))).toBeGreaterThan(0.95);
    // ...having slid out of it on light skis, not stopped by them.
    expect(c.speed).toBeGreaterThan(0.75 * (BELOW - 1));
    // And working for his speed again.
    ride(state, 1);
    expect(state.skier.drive).toBeGreaterThan(0.5);
  });

  it("turns the way the steer asks", () => {
    const sides = [1, -1].map((steer) => {
      const state = switched(BELOW - 1);
      let mid = 0;
      for (let i = 0; i < TUNING.physicsHz; i++) {
        step(state, { ...NEUTRAL_INPUT, steer });
        const r = state.skier.revert;
        if (r && Math.abs(r.u - 0.5) < 0.02) mid = state.skier.heading;
      }
      return mid;
    });
    // Half way round from facing −z, one way faces +x and the other −x.
    expect(Math.sign(Math.sin(sides[0]))).toBe(-Math.sign(Math.sin(sides[1])));
  });

  it("leaves a fast switch skier riding switch", () => {
    const state = switched(BELOW + 2, "free", 0.25);
    const out = ride(state, 1.5);
    expect(out.reverted).toBe(false);
    expect(state.skier.switched).toBe(true);
  });

  it("leaves a skier knocked or crept back at a walk standing where he stops", () => {
    const state = switched(TUNING.switch.revert.least - 0.5);
    expect(ride(state, 2).reverted).toBe(false);
    expect(state.skier.speed).toBeLessThan(0.5);
  });

  it("turns round on a tricks run too, and never where the rules keep him switch", () => {
    expect(ride(switched(BELOW - 1, "tricks"), 1).reverted).toBe(true);
    const held = switched(BELOW - 1);
    held.rules = { ...held.rules, revert: false };
    expect(ride(held, 1).reverted).toBe(false);
  });

  it("hops a switch skier round off a jump under 40 km/h, and lands him forward", () => {
    for (const steer of [0, 1]) {
      const state = switched(8);
      let inAir = false;
      const events: GameEvent[] = [];
      for (let i = 0; i < 2 * TUNING.physicsHz; i++) {
        step(state, { ...NEUTRAL_INPUT, steer, jump: i < 12 });
        events.push(...state.events);
        if (state.skier.revert && state.skier.airborne) inAir = true;
      }
      const c = state.skier;
      expect(inAir, `steer ${steer}`).toBe(true);
      expect(
        events.filter((e) => e.kind === "wipeout"),
        `steer ${steer}`,
      ).toHaveLength(0);
      expect(c.switched, `steer ${steer}`).toBe(false);
      expect(c.way, `steer ${steer}`).toBeGreaterThan(0);
    }
  });

  it("leaves a jump popped switch over 40 km/h a jump", () => {
    const state = switched(TUNING.switch.revert.hopBelow + 1, "free", 0.25);
    let reverted = false;
    for (let i = 0; i < TUNING.physicsHz; i++) {
      step(state, { ...NEUTRAL_INPUT, jump: i < 12 });
      if (state.skier.revert) reverted = true;
    }
    expect(reverted).toBe(false);
    expect(state.skier.switched).toBe(true);
  });

  it("is drawn with the look held on the line and the legs light", () => {
    expect(revertShare(0)).toBe(0);
    expect(revertShare(1)).toBe(1);
    // The head stays turned back until the body has come within its reach.
    expect(revertLook(0, Math.PI, revertShare)).toBe(1);
    expect(revertLook(0, -Math.PI, revertShare)).toBe(-1);
    expect(revertLook(1, Math.PI, revertShare)).toBe(0);
    expect(Math.abs(revertLook(0.8, Math.PI, revertShare))).toBeLessThan(1);
    expect(revertRise(0.5)).toBeGreaterThan(0);
    expect(revertRise(0)).toBe(0);
  });
});

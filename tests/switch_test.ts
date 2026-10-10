// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RIDING SWITCH (`switch.ts`) and the STROKES off the jump key on a free
// ride: a skier turned round on a groomed slope rides it backward on any
// pair, his steer read the way he is going; riding backward through loose
// snow the tails dig unless they are turned up (the park ski's twin tips); a race never rides
// switch; and on a free ride one tap of the edge after a jump is a 180
// ridden away backward, two a 360, a tap of the lean a loop.

import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  SKI_CATALOG,
  createGame,
  placeRun,
  skisById,
  step,
  tailRiseOf,
  type GameEvent,
  type GameMode,
  type GameState,
  type SkierInput,
  type SkiSpec,
} from "@engine";
import { newsFor } from "../pwa/src/game/run-news.ts";
import { comboLine } from "../pwa/src/game/strings.ts";
import { flatLevel } from "./support/synthetic.ts";

/** A skier on a 14° slope falling toward +z, FACING UP IT, let go — at
 * rest, or already riding backward down it at `speed` m/s. */
function backward(
  spec: SkiSpec,
  packed: number,
  mode: GameMode = "free",
  snowDepth = 1,
  speed = 0,
): GameState {
  const state = createGame({
    level: flatLevel({ packed, grade: 0.25, slopeFrom: 0 }),
    mode,
    countdown: 0,
    quiet: true,
    spec,
    snowDepth,
  });
  placeRun(state, { x: 1500, z: 200, heading: Math.PI, pitch: Math.atan(0.25), speed });
  // Placed along the heading; turned round, he is going tails first.
  state.skier.vx = -state.skier.vx;
  state.skier.vy = -state.skier.vy;
  state.skier.vz = -state.skier.vz;
  return state;
}

/** Riding backward at 30 km/h: past a drift, as off a 180. */
const RIDING = 30 / 3.6;

function ride(state: GameState, seconds: number, at: (t: number) => Partial<SkierInput>) {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    step(state, { ...NEUTRAL_INPUT, ...at(i / 120) });
    events.push(...state.events);
  }
  return events;
}

const wipeouts = (events: GameEvent[]) => events.filter((e) => e.kind === "wipeout");

describe("riding switch", () => {
  it("runs backward down the groomer on every pair, tails first and held to his line", () => {
    for (const spec of SKI_CATALOG) {
      // Held switch however slow (a free ride turns him round, `revert`).
      const state = backward(spec, 1);
      state.rules = { ...state.rules, revert: false };
      const events = ride(state, 4, () => ({}));
      expect(wipeouts(events), spec.id).toHaveLength(0);
      expect(state.skier.switched, spec.id).toBe(true);
      expect(state.skier.way, spec.id).toBeLessThan(-5);
      // Straight backward: the way over the snow is all along the skis.
      const flat = Math.hypot(state.skier.vx, state.skier.vz);
      expect(-state.skier.way / flat, spec.id).toBeGreaterThan(0.99);
    }
  });

  it("steers the way he is going: the line bends to the side pressed, as it does forward", () => {
    const turned = (heading: number): number => {
      const state = createGame({
        level: flatLevel({ packed: 1, grade: 0.25, slopeFrom: 0 }),
        mode: "free",
        countdown: 0,
        quiet: true,
      });
      placeRun(state, { x: 1500, z: 200, heading, pitch: Math.cos(heading) * -Math.atan(0.25) });
      ride(state, 3, () => ({}));
      const x = state.skier.x;
      ride(state, 1.5, () => ({ steer: 1 }));
      return state.skier.x - x;
    };
    const forward = turned(0);
    const switched = turned(Math.PI);
    expect(Math.abs(forward)).toBeGreaterThan(0.3);
    expect(Math.sign(switched)).toBe(Math.sign(forward));
  });

  it("digs its tails in loose snow — but on the park ski's twin tips, which ride over it", () => {
    for (const spec of SKI_CATALOG) {
      const state = backward(spec, 0, "free", 1, RIDING);
      const events = ride(state, 4, () => ({}));
      const dug = wipeouts(events);
      if (tailRiseOf(spec) >= 1) expect(dug, spec.id).toHaveLength(0);
      else {
        expect(dug.length, spec.id).toBeGreaterThan(0);
        expect(dug[0].kind === "wipeout" && dug[0].cause, spec.id).toBe("nose");
      }
    }
    // A dusting is less than the powder ski's raised tail rides over.
    const light = backward(skisById("marmot"), 0, "free", 0.25, RIDING);
    expect(wipeouts(ride(light, 4, () => ({})))).toHaveLength(0);
  });

  it("is never ridden on a race: the steer is never turned round", () => {
    const state = backward(skisById("chamois"), 1, "timeTrial");
    for (let i = 0; i < 4 * 120; i++) {
      step(state, { ...NEUTRAL_INPUT, steer: 1 });
      expect(state.skier.switched).toBe(false);
      expect(state.skier.steer).toBe(1);
    }
  });
});

describe("the strokes off the jump key on a free ride", () => {
  /** The jump key held two seconds rolling at 40 km/h over flat groomer,
   * let go, and `at(t)` from the pop. */
  function popped(at: (t: number) => Partial<SkierInput>) {
    const state = createGame({ level: flatLevel({ packed: 1 }), mode: "free", quiet: true });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 11 });
    const events = ride(state, 5, (t) => ({ jump: t < 2, ...at(t - 2) }));
    const tricks = events.flatMap((e) => (e.kind === "trick" ? [e] : []));
    const line = comboLine(tricks.map((e) => ({ kind: e.trick, spins: e.spins, flight: 1 })));
    return { state, events, line };
  }
  const tap = (from: number, to: number, v: Partial<SkierInput>) => (t: number) =>
    t >= from && t < to ? v : {};

  it("one tap of the edge is a 180, ridden away switch", () => {
    const { state, events, line } = popped(tap(0.2, 0.25, { steer: -1 }));
    expect(wipeouts(events)).toHaveLength(0);
    expect(line).toBe("BIG AIR + 180 + CLEAN LANDING");
    expect(state.skier.switched).toBe(true);
  });

  it("two taps are a 360, ridden away forward", () => {
    const { state, events, line } = popped((t) =>
      (t >= 0.2 && t < 0.25) || (t >= 0.3 && t < 0.35) ? { steer: 1 } : {},
    );
    expect(wipeouts(events)).toHaveLength(0);
    expect(line).toBe("BIG AIR + 360 + CLEAN LANDING");
    expect(state.skier.switched).toBe(false);
  });

  it("a tap of the lean is a loop, back or forward", () => {
    for (const [lean, word] of [
      [1, "BACKFLIP"],
      [-1, "FRONT FLIP"],
    ] as const) {
      const { events, line } = popped(tap(0.2, 0.25, { lean }));
      expect(wipeouts(events)).toHaveLength(0);
      expect(line).toBe(`BIG AIR + ${word} + CLEAN LANDING`);
    }
  });

  it("names a tail dug in for what it is", () => {
    const state = backward(skisById("swift"), 0, "free", 1, RIDING);
    let said: string | undefined;
    for (let i = 0; i < 4 * 120 && said === undefined; i++) {
      step(state, NEUTRAL_INPUT);
      const dug = state.events.find((e) => e.kind === "wipeout");
      if (dug) said = newsFor(dug, state)?.text;
    }
    expect(said).toBe("TAILS DUG IN");
  });
});

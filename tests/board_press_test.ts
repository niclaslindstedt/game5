// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SNOWBOARDER'S PRESSES AND BUTTERS (`engine/game/board-press.ts`): the
// lean carried well over at a crawl to a run's pace loads the nose or the
// tail and lifts the other end, the steer through it pivots the board on
// the end left on the snow — half round to ride fakie, with no fall — a
// soft board quicker than a stiff one, nothing at speed and nothing on a
// pair of skis.

import { describe, expect, it } from "vitest";

import {
  GOSHAWK,
  LYNX,
  NEUTRAL_INPUT,
  PIKA,
  SKIS,
  TUNING,
  butterRate,
  createGame,
  placeRun,
  pressAsked,
  step,
  type GameEvent,
  type GameState,
  type SkiSpec,
  type SkierInput,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

const P = TUNING.board.press;

/** A rider rolling `kmh` down a 12 % groomer on a free ride. */
function rolling(spec: SkiSpec = LYNX, kmh = 12): GameState {
  const level = flatLevel({ packed: 1, grade: 0.12, slopeFrom: 0, size: 3000 });
  const state = createGame({ level, spec, mode: "free", countdown: 0, quiet: true, crowd: 0 });
  placeRun(state, { x: 1500, z: 600, heading: 0, speed: kmh / 3.6 });
  return state;
}

function ride(state: GameState, seconds: number, input: Partial<SkierInput>): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
    step(state, { ...NEUTRAL_INPUT, ...input });
    events.push(...state.events);
  }
  return events;
}

/** The load on each end's stations, N: the nose's (`tip`) and the tail's. */
function ends(state: GameState): { nose: number; tail: number } {
  let nose = 0;
  let tail = 0;
  for (const k of state.skier.contacts) {
    if (k.station === "tip") nose += k.touching ? k.load : 0;
    if (k.station === "tail") tail += k.touching ? k.load : 0;
  }
  return { nose, tail };
}

describe("the press asked", () => {
  it("nothing short of the lean's `from`, the whole of it by `full`, its sign the lean's", () => {
    expect(pressAsked(P.from - 0.01, 0)).toBe(0);
    expect(pressAsked(-1, 0)).toBe(-1);
    expect(pressAsked(1, 0)).toBe(1);
    expect(pressAsked(0.7, 0)).toBeGreaterThan(0);
    expect(pressAsked(0.7, 0)).toBeLessThan(1);
  });

  it("whole at a crawl, faded past a run's pace and gone at speed", () => {
    expect(pressAsked(1, P.slow)).toBe(1);
    expect(pressAsked(1, (P.slow + P.fast) / 2)).toBeCloseTo(0.5, 6);
    expect(pressAsked(1, P.fast)).toBe(0);
  });
});

describe("pressing on the snow", () => {
  it("the lean back loads the tail and lifts the nose; forward the other way", () => {
    const tail = rolling();
    ride(tail, 0.8, { lean: 1 });
    expect(tail.skier.board!.press).toBeGreaterThan(0.95);
    const t = ends(tail);
    expect(t.tail).toBeGreaterThan(2 * t.nose);

    const nose = rolling();
    ride(nose, 0.8, { lean: -1 });
    expect(nose.skier.board!.press).toBeLessThan(-0.95);
    const n = ends(nose);
    expect(n.nose).toBeGreaterThan(2 * n.tail);
  });

  it("a press straight on leaves the board on his line", () => {
    const state = rolling();
    const h0 = state.skier.heading;
    ride(state, 1, { lean: 1 });
    expect(Math.abs(state.skier.board!.butter)).toBe(0);
    expect(Math.abs(state.skier.heading - h0)).toBeLessThan(0.05);
  });

  it("at speed there is no press", () => {
    const state = rolling(LYNX, 45);
    ride(state, 0.5, { lean: 1 });
    expect(state.skier.board!.press).toBe(0);
  });

  it("it lets go as the lean comes back", () => {
    const state = rolling();
    ride(state, 0.6, { lean: -1 });
    ride(state, 0.6, {});
    expect(state.skier.board!.press).toBe(0);
  });
});

describe("the butter", () => {
  it("a nose butter carried half round leaves him riding fakie, on his feet", () => {
    const state = rolling(LYNX, 15);
    const h0 = state.skier.heading;
    const events = ride(state, 1.2, { lean: -1, steer: 1 });
    expect(state.skier.board!.butter).toBeGreaterThan(Math.PI * 0.85);
    events.push(...ride(state, 0.6, {}));
    expect(events.some((e) => e.kind === "wipeout")).toBe(false);
    expect(state.skier.thrown).toBeNull();
    expect(state.skier.switched).toBe(true);
    const turned = Math.abs(
      Math.atan2(Math.sin(state.skier.heading - h0), Math.cos(state.skier.heading - h0)),
    );
    expect(turned).toBeGreaterThan(Math.PI * 0.8);
    expect(state.skier.speed).toBeGreaterThan(1);
  });

  it("the steer the other way butters the other way", () => {
    const right = rolling();
    ride(right, 0.6, { lean: 1, steer: 1 });
    const left = rolling();
    ride(left, 0.6, { lean: 1, steer: -1 });
    expect(right.skier.board!.butter).toBeGreaterThan(0.3);
    expect(left.skier.board!.butter).toBeLessThan(-0.3);
  });

  it("a soft board butters quicker than a stiff one", () => {
    expect(PIKA.flex).toBeLessThan(GOSHAWK.flex);
    expect(butterRate(1, 1, PIKA.flex)).toBeGreaterThan(butterRate(1, 1, GOSHAWK.flex));
    const soft = rolling(PIKA);
    ride(soft, 0.6, { lean: -1, steer: 1 });
    const stiff = rolling(GOSHAWK);
    ride(stiff, 0.6, { lean: -1, steer: 1 });
    expect(soft.skier.board!.butter).toBeGreaterThan(stiff.skier.board!.butter);
  });

  it("inside the steer's dead zone nothing turns", () => {
    expect(butterRate(1, P.dead, LYNX.flex)).toBe(0);
    expect(butterRate(0, 1, LYNX.flex)).toBe(0);
  });
});

describe("a pair of skis", () => {
  it("has no press, and the lean with the steer turns him as it always did", () => {
    const skis = rolling(SKIS);
    ride(skis, 1, { lean: -1, steer: 1 });
    expect(skis.skier.board).toBeUndefined();
  });
});

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ONE-KEY BRAKE AND THE CLIMB (`stop-hand.ts`): the back key held with
// no edge asked stops a skier — a skidded turn or two, then a hockey stop
// uphill — on every pitch a run is graded to, without putting him down;
// pressed again stood still it takes him back up the hill (sidestepped up
// a steep one); and the tuck held facing a hill climbs it. Staged on the
// drag strip tilted into a face, off the piste and with nobody else on it.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  SKIS,
  TUNING,
  createGame,
  createStopHand,
  headingOffFall,
  placeRun,
  step,
  stopHand,
  type GameState,
  type HandAsk,
  type StopHand,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

const DEG = Math.PI / 180;
const HZ = TUNING.physicsHz;
const BACK: HandAsk = { back: true, go: false };
const GO: HandAsk = { back: false, go: true };
const NONE: HandAsk = { back: false, go: false };

/** A free ride on a face of `deg`° falling along +z, the skier at `speed`
 * heading `heading` off straight down it — stood still a second first when
 * `speed` is 0. */
function stage(deg: number, heading: number, speed: number, packed = 1): GameState {
  const level = flatLevel({ packed, grade: Math.tan(deg * DEG), slopeFrom: 200, size: 4000 });
  const state = createGame({
    level,
    spec: SKIS,
    rivals: 0,
    countdown: 0,
    quiet: true,
    mode: "free",
  });
  state.crowd = undefined;
  placeRun(state, { x: 1000, z: 300, heading, speed });
  if (speed === 0) {
    const c = state.skier;
    for (let i = 0; i < HZ; i++) {
      c.vx = c.vy = c.vz = 0;
      step(state, NEUTRAL_INPUT);
    }
  }
  return state;
}

/** Ride `seconds` with the hands asking `ask` (the keys as they would be:
 * the back key the brake, the tuck the tuck), until `until` says stop. */
function ride(
  state: GameState,
  hand: StopHand,
  ask: HandAsk,
  seconds: number,
  until: () => boolean = () => false,
): { thrown: boolean; sides: number; sidestepped: boolean } {
  let thrown = false;
  let sidestepped = false;
  let sides = 0;
  let side = hand.side;
  for (let i = 0; i < seconds * HZ && !until(); i++) {
    const held = { ...NEUTRAL_INPUT, brake: ask.back ? 1 : 0, tuck: ask.go ? 1 : 0 };
    step(state, stopHand(hand, state, ask, held));
    if (state.skier.thrown) thrown = true;
    if (state.skier.sidestep !== 0) sidestepped = true;
    if (hand.side !== side) sides++;
    side = hand.side;
  }
  return { thrown, sides, sidestepped };
}

describe("the one-key brake (stop-hand.ts)", () => {
  for (const [deg, v0] of [
    [8, 22],
    [22, 15],
    [22, 30],
    [30, 22],
    [38, 12],
  ] as const) {
    it(`stops him from ${Math.round(v0 * 3.6)} km/h on ${deg}° without a fall`, () => {
      const state = stage(deg, 0, v0);
      const hand = createStopHand();
      const run = ride(state, hand, BACK, 25, () => hand.mode === "stopped");
      expect(run.thrown).toBe(false);
      expect(hand.mode).toBe("stopped");
      expect(state.skier.speed).toBeLessThan(0.5);
    });
  }

  it("zig-zags at speed before the hockey stop, and stops across the hill", () => {
    const state = stage(22, 0, 22);
    const hand = createStopHand();
    const run = ride(state, hand, BACK, 25, () => hand.mode === "stopped");
    expect(run.sides).toBeGreaterThanOrEqual(1);
    expect(Math.abs(headingOffFall(state))).toBeGreaterThan(70 * DEG);
  });

  it("stops in powder too", () => {
    const state = stage(22, 0, 22, 0);
    const hand = createStopHand();
    const run = ride(state, hand, BACK, 25, () => hand.mode === "stopped");
    expect(run.thrown).toBe(false);
    expect(hand.mode).toBe("stopped");
  });

  it("lets go when an edge is asked with it — the hockey stop by hand", () => {
    const state = stage(20, 0, 15);
    const hand = createStopHand();
    const held = { ...NEUTRAL_INPUT, brake: 1, steer: 1 };
    const out = stopHand(hand, state, BACK, { ...held });
    expect(out).toEqual(held);
    expect(hand.mode).toBe("none");
  });

  it("leaves a race alone", () => {
    const level = flatLevel({ packed: 1, grade: Math.tan(20 * DEG), slopeFrom: 200 });
    const state = createGame({ level, spec: SKIS, rivals: 0, countdown: 0, quiet: true });
    expect(state.rules.course).toBe(true);
    placeRun(state, { x: 1500, z: 300, heading: 0, speed: 15 });
    const held = { ...NEUTRAL_INPUT, brake: 1 };
    expect(stopHand(createStopHand(), state, BACK, { ...held })).toEqual(held);
  });
});

describe("back, pressed again stood still", () => {
  it("sidesteps him up the steep hill he stopped across", () => {
    const state = stage(25, 0, 15);
    const hand = createStopHand();
    ride(state, hand, BACK, 25, () => hand.mode === "stopped");
    // Held on, he stands; let go, he stays stood on his edges.
    ride(state, hand, BACK, 1);
    ride(state, hand, NONE, 1);
    expect(state.skier.speed).toBeLessThan(0.3);
    const y0 = state.skier.y;
    const run = ride(state, hand, BACK, 6);
    expect(run.sidestepped).toBe(true);
    expect(state.skier.y - y0).toBeGreaterThan(0.3);
    expect(state.skier.speed).toBeLessThan(0.3);
  });

  it("turns round to walk up a gentle hill behind him", () => {
    const state = stage(6, 0, 0);
    const hand = createStopHand();
    const y0 = state.skier.y;
    ride(state, hand, BACK, 12);
    expect(Math.abs(headingOffFall(state))).toBeGreaterThan(160 * DEG);
    expect(state.skier.y - y0).toBeGreaterThan(0.2);
  });

  it("turns him round to face down a hill in front of him, and ploughs him back down it", () => {
    const state = stage(20, Math.PI, 0);
    const hand = createStopHand();
    const run = ride(state, hand, BACK, 8);
    expect(run.thrown).toBe(false);
    expect(Math.abs(headingOffFall(state))).toBeLessThan(25 * DEG);
    expect(state.skier.speed).toBeLessThan(8);
  });

  it("turns round on the flat and walks back", () => {
    const state = stage(0, 0, 0);
    const hand = createStopHand();
    const z0 = state.skier.z;
    ride(state, hand, BACK, 10);
    expect(state.skier.z).toBeLessThan(z0 - 1);
  });
});

describe("the climb", () => {
  it("sidesteps up a steep face he stands facing, never slid down it", () => {
    const state = stage(25, Math.PI, 0);
    const hand = createStopHand();
    const y0 = state.skier.y;
    let lowest = y0;
    for (let i = 0; i < 10 * HZ; i++) {
      step(state, stopHand(hand, state, GO, { ...NEUTRAL_INPUT, tuck: 1 }));
      lowest = Math.min(lowest, state.skier.y);
    }
    expect(hand.mode).toBe("climb");
    expect(state.skier.sidestep).not.toBe(0);
    expect(lowest).toBeGreaterThan(y0 - 0.1);
    expect(state.skier.y - y0).toBeGreaterThan(0.4);
  });

  it("walks straight up a gentle one", () => {
    const state = stage(6, Math.PI, 0);
    const hand = createStopHand();
    const y0 = state.skier.y;
    ride(state, hand, GO, 6);
    expect(hand.mode).toBe("climb");
    expect(state.skier.sidestep).toBe(0);
    expect(state.skier.y - y0).toBeGreaterThan(0.5);
  });

  it("leaves the tuck alone going down a hill", () => {
    const state = stage(20, 0, 0);
    const hand = createStopHand();
    const out = stopHand(hand, state, GO, { ...NEUTRAL_INPUT, tuck: 1 });
    expect(out.tuck).toBe(1);
    expect(hand.mode).toBe("none");
  });
});

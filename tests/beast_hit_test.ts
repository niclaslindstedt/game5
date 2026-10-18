// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RUN INTO AN ANIMAL (`engine/game/beast-hit.ts`): on a free ride the
// wildlife is a body — a moose met at speed throws the rider (the `beast`
// crash cause) and is killed, and with the injuries on it hurts him badly;
// a hare is run through; a safe run kills nothing; and no other run carries
// any of it. Staged on the synthetic SLOPE with one animal laid by hand
// (`layBeasts`, onto the run's own map) square across the skier's line, its group's fright already
// spent so it stands its ground.

import { describe, expect, it } from "vitest";

import {
  BEAST_HIT,
  TUNING,
  createGame,
  layBeasts,
  placeRun,
  severityOf,
  step,
  type BeastEvent,
  type BeastId,
  type GameEvent,
  type GameState,
  NEUTRAL_INPUT,
} from "@engine";
import { SLOPE, syntheticLevel } from "./support/synthetic.ts";

/** Where the skier is stood and the animal stands, on his line down the
 * SLOPE (whose pitch leaves some 70 % of his speed square on its flank). */
const FROM = 628;
const AT = 640;

function rideInto(
  species: BeastId,
  speed: number,
  opts: { gore?: boolean; sfw?: boolean; mode?: "free" } = { gore: true },
): GameState {
  const level = syntheticLevel({ noTrees: true });
  const state = createGame({
    level,
    mode: opts.mode ?? "free",
    quiet: true,
    crowd: 0,
    gore: opts.gore,
    sfw: opts.sfw,
  });
  layBeasts(state.level, {
    seed: state.level.seed,
    groups: [
      {
        id: "A1",
        species,
        count: 1,
        home: { x: SLOPE.x, z: AT },
        // A round too small to walk off the line: it stands across it.
        round: { x: SLOPE.x, z: AT, radius: 0.05, ovality: 1, heading: 0, sense: 1, length: 0.3 },
        cycle: 100,
        phase: 0.9,
        scatter: 7,
      },
    ],
  });
  placeRun(state, { x: SLOPE.x, z: FROM, heading: 0, speed });
  return state;
}

/** Ride on for `seconds`, the frights spent so the animal holds its ground. */
function run(state: GameState, seconds: number): GameEvent[] {
  const all: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds / TUNING.dt); i++) {
    step(state, NEUTRAL_INPUT);
    const wild = state.wild;
    if (wild) wild.spooks = wild.spooks.map(() => ({ at: state.t, dx: 0, dz: 0, ox: 0, oz: 0 }));
    all.push(...state.events);
  }
  return all;
}

const met = (events: GameEvent[]): BeastEvent | undefined =>
  events.find((e): e is BeastEvent => e.kind === "beast");

describe("the wildlife as bodies", () => {
  it("is a free ride's only", () => {
    expect(rideInto("moose", 25).wild).toBeDefined();
    const level = syntheticLevel({ noTrees: true });
    expect(createGame({ level, quiet: true }).wild).toBeUndefined();
  });

  it("a moose met at 25 m/s throws him and is killed", () => {
    const state = rideInto("moose", 25);
    const events = run(state, 2.5);
    const hit = met(events);
    expect(hit).toBeDefined();
    expect(hit!.thrown).toBe(true);
    expect(hit!.killed).toBe(true);
    expect(hit!.crush).toBeGreaterThan(0.3);
    const wipeout = events.find((e) => e.kind === "wipeout");
    expect(wipeout?.kind === "wipeout" && wipeout.cause).toBe("beast");
    const dead = state.wild!.struck[0];
    expect(dead.killed).toBe(true);
    // Stopped dead: the moose took nearly all of him.
    expect(hit!.taken).toBeGreaterThan(0.85 * hit!.speed);
  });

  it("hurts him badly with the injuries on", () => {
    const state = rideInto("moose", 25);
    run(state, 3);
    expect(severityOf(state.skier.body)).toBeGreaterThanOrEqual(25);
  });

  it("met flat out, both are crushed: the moose burst and him torn apart", () => {
    const state = rideInto("moose", 36);
    const hit = met(run(state, 3));
    expect(hit?.crush).toBe(1);
    expect(state.gore!.lost).not.toBe(0);
    expect(state.gore!.dead).toBeGreaterThanOrEqual(0);
  });

  it("is walked away from met at a jog", () => {
    const state = rideInto("moose", 8);
    const hit = met(run(state, 3));
    expect(hit).toBeDefined();
    expect(severityOf(state.skier.body)).toBeLessThan(16);
    expect(state.gore!.mortal).toBeLessThan(0);
  });

  it("runs a hare through without a throw", () => {
    const state = rideInto("hare", 25);
    const events = run(state, 2.5);
    const hit = met(events);
    expect(hit).toBeDefined();
    expect(hit!.thrown).toBe(false);
    expect(hit!.killed).toBe(true);
    expect(events.some((e) => e.kind === "wipeout")).toBe(false);
    expect(state.skier.thrown).toBeNull();
  });

  it("a roe deer at a cruise throws him", () => {
    const hit = met(run(rideInto("roedeer", 12), 5));
    expect(hit?.thrown).toBe(true);
  });

  it("kills nothing on a safe run, and the knocked one gets up again", () => {
    const state = rideInto("moose", 25, { sfw: true });
    const events = run(state, 2.5);
    const hit = met(events);
    expect(hit?.thrown).toBe(true);
    expect(hit?.killed).toBe(false);
    expect(state.wild!.struck[0]?.knocked).toBe(true);
    run(state, BEAST_HIT.downFor + BEAST_HIT.rejoin + 0.5);
    expect(state.wild!.struck).toHaveLength(0);
  });
});

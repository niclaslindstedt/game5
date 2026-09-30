// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR: a kicker throws the skier, the flight is reported, the landing is
// reported and a flat one from too high costs speed; the lean pitches him
// in the air and the edge swings the skis.

import { describe, expect, it } from "vitest";

import {
  createGame,
  landingAhead,
  NEUTRAL_INPUT,
  placeRun,
  SKI_CATALOG,
  step,
  TUNING,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";
import { flatLevel, pisteX, SLOPE, syntheticLevel } from "./support/synthetic.ts";

const TUCK: SkierInput = { ...NEUTRAL_INPUT, tuck: 1 };

function ride(state: GameState, seconds: number, input: SkierInput): GameEvent[] {
  const events: GameEvent[] = [];
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    step(state, input);
    events.push(...state.events);
  }
  return events;
}

describe("a kicker", () => {
  it("throws the skier into the air and lands him", () => {
    const level = syntheticLevel();
    const state = createGame({ level, rivals: 0, countdown: 0, quiet: true });
    placeRun(state, {
      x: pisteX(SLOPE.kickerZ - 40),
      z: SLOPE.kickerZ - 40,
      heading: 0,
      speed: 60 / 3.6,
    });
    const events = ride(state, 5, { ...TUCK, tuck: 0.5 });
    const air = events.find((e) => e.kind === "air");
    const land = events.find((e) => e.kind === "land");
    expect(air).toBeDefined();
    expect(land).toBeDefined();
    if (land?.kind !== "land") return;
    expect(land.airTime).toBeGreaterThan(0.4);
    expect(land.airTime).toBeLessThan(3);
    expect(state.progress.bestAir).toBeCloseTo(land.airTime, 5);
    expect(state.skier.airborne).toBe(false);
    // He comes down the right way up.
    expect(Math.abs(state.skier.roll)).toBeLessThan(0.5);
  });
});

describe("a landing", () => {
  it("from a metre is taken by the legs whole", () => {
    const state = createGame({
      level: flatLevel({ packed: 1 }),
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 15, height: 2.0 });
    const events = ride(state, 2, NEUTRAL_INPUT);
    const land = events.find((e) => e.kind === "land");
    expect(land?.kind === "land" && !land.harsh).toBe(true);
  });

  it("flat from five metres folds the legs to the stop and costs speed", () => {
    const state = createGame({
      level: flatLevel({ packed: 1 }),
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 15, height: 6 });
    const events = ride(state, 2, NEUTRAL_INPUT);
    const land = events.find((e) => e.kind === "land");
    expect(land?.kind).toBe("land");
    if (land?.kind !== "land") return;
    expect(land.harsh).toBe(true);
    expect(land.lost).toBeGreaterThan(0);
    expect(land.impact).toBeGreaterThan(TUNING.air.harshSpeed);
  });
});

describe("a landing sticks", () => {
  // THE BUCK a skier with too little rebound damping gives: the legs handing
  // a landing back, the whole body thrown off the snow again. Once the first
  // landing is in, the snow keeps him — a skip of a station or two for less
  // than a counted flight at most, and no second `air` or `land` for the
  // same jump.
  const cases = [
    {
      name: "the slope's kicker overshot at race speed",
      level: () => syntheticLevel(),
      at: { x: pisteX(SLOPE.kickerZ - 60), z: SLOPE.kickerZ - 60, heading: 0, speed: 75 / 3.6 },
    },
    {
      name: "a 3 m drop onto the groomer",
      level: () => flatLevel({ packed: 1 }),
      at: { x: 1500, z: 200, heading: 0, speed: 60 / 3.6, height: 4 },
    },
  ];
  for (const { name, level, at } of cases) {
    it(`off ${name}, on every pair`, () => {
      for (const spec of SKI_CATALOG) {
        const state = createGame({ level: level(), rivals: 0, countdown: 0, spec, quiet: true });
        placeRun(state, at);
        let landed = -1;
        let off = 0;
        let longest = 0;
        let flights = 0;
        for (let i = 0; i < 5 * TUNING.physicsHz; i++) {
          step(state, TUCK);
          for (const e of state.events) {
            if (e.kind === "land") {
              flights += 1;
              if (landed < 0) landed = state.t;
            }
          }
          if (landed < 0 || state.t - landed > 2) continue;
          off = state.skier.contacts.some((p) => p.touching) ? 0 : off + TUNING.dt;
          longest = Math.max(longest, off);
        }
        expect(flights, spec.id).toBe(1);
        expect(longest, spec.id).toBeLessThan(TUNING.air.counts);
      }
    });
  }
});

describe("the air's pull", () => {
  // The same staged launch, climbing 8.5 m/s off the flat.
  function hang(mode: "race" | "tricks"): number {
    const state = createGame({ level: flatLevel({ packed: 1 }), mode, countdown: 0, quiet: true });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 18, height: 1.2, vy: 8.5 });
    const land = ride(state, 4, TUCK).find((e) => e.kind === "land");
    return land?.kind === "land" ? land.airTime : 0;
  }

  it("is the arcade's heavier air on a race and the real g on a tricks run", () => {
    const race = hang("race");
    const tricks = hang("tricks");
    expect(race).toBeGreaterThan(0.8);
    // Air time off the same launch goes as 1/g.
    expect(tricks / race).toBeGreaterThan(TUNING.air.gravity * 0.85);
    expect(tricks / race).toBeLessThan(TUNING.air.gravity * 1.15);
  });

  it("is what the landing is looked for along", () => {
    const state = createGame({ level: flatLevel({ packed: 1 }), countdown: 0, quiet: true });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 20, height: 6 });
    const fall = TUNING.g * TUNING.air.gravity;
    const ahead = landingAhead(state.skier, state.level, fall);
    expect(ahead).not.toBeNull();
    if (!ahead) return;
    // Five metres down, from rest vertically, onto the flat.
    expect(ahead.t).toBeCloseTo(Math.sqrt((2 * 5) / fall), 1);
    expect(Math.abs(ahead.slope)).toBeLessThan(0.01);
  });
});

describe("air control", () => {
  function pitchAfter(input: SkierInput): number {
    const state = createGame({
      level: flatLevel({ packed: 1 }),
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
    placeRun(state, { x: 1500, z: 200, heading: 0, speed: 20, height: 12, vy: 3 });
    ride(state, 0.6, input);
    expect(state.skier.airborne).toBe(true);
    return state.skier.pitch;
  }

  it("lean back lifts the tips, lean forward drops them", () => {
    const neutral = pitchAfter(NEUTRAL_INPUT);
    expect(pitchAfter({ ...NEUTRAL_INPUT, lean: 1 })).toBeGreaterThan(neutral + 0.2);
    expect(pitchAfter({ ...NEUTRAL_INPUT, lean: -1 })).toBeLessThan(neutral - 0.2);
  });

  it("the tuck and the brake do nothing to the pitch: a skier has no gyro", () => {
    const neutral = pitchAfter(NEUTRAL_INPUT);
    expect(pitchAfter(TUCK)).toBeCloseTo(neutral, 3);
    expect(pitchAfter({ ...NEUTRAL_INPUT, brake: 1 })).toBeCloseTo(neutral, 3);
  });
});

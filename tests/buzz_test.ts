// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BUZZ: nothing at all at none — a sober run is the run it always was,
// bit for bit — and, with the beer in him, a skier who will not ride
// straight, turns harder and then not hard enough, and falls far sooner;
// who sobers up slowly; and who, thrown on a free ride, is not reset but
// gets up where he lies, walks to each ski the fall threw off, picks it up,
// steps back in and skis on — the reset press still the way out of it.

import { describe, expect, it } from "vitest";

import {
  BUZZ,
  crashLimit,
  createGame,
  drunkInput,
  NEUTRAL_INPUT,
  placeRun,
  step,
  throwRider,
  TUNING,
  type CrashLimit,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";
import { flatLevel, SLOPE, syntheticLevel } from "./support/synthetic.ts";

const PITCH = flatLevel({ packed: 1, grade: 0.2, slopeFrom: 150, size: 3000 });

function ride(
  state: GameState,
  seconds: number,
  input: SkierInput | ((s: GameState) => SkierInput) = NEUTRAL_INPUT,
): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
    step(state, typeof input === "function" ? input(state) : input);
    events.push(...state.events);
  }
  return events;
}

/** A run on `level` stood at `x`, `z` going `speed` down +z, with `buzz`
 * in him, on the free ride's terms (`afterski`, no course) when `free`. */
function staged(buzz: number | undefined, speed = 12, free = true, level = PITCH): GameState {
  const state = createGame({ level, rivals: 0, countdown: 0, quiet: true });
  if (free) state.rules = { ...state.rules, afterski: true, course: false };
  placeRun(state, { x: level.size / 2, z: 400, heading: 0, speed });
  if (buzz !== undefined) state.skier.buzz = buzz;
  return state;
}

/** How far off his line he wandered over `seconds`, m — the most his x
 * strayed from where he set off, running straight with the edge flat. */
function wander(state: GameState, seconds: number): number {
  const x0 = state.skier.x;
  let most = 0;
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
    step(state, NEUTRAL_INPUT);
    if (state.skier.thrown) break;
    most = Math.max(most, Math.abs(state.skier.x - x0));
  }
  return most;
}

describe("the buzz at none", () => {
  it("changes nothing: a buzz of 0 skis the sober run bit for bit", () => {
    const sober = staged(undefined, 14, false, syntheticLevel());
    const zero = staged(0, 14, false, syntheticLevel());
    const input = (s: GameState): SkierInput => ({
      ...NEUTRAL_INPUT,
      steer: Math.sin(s.t * 1.3) * 0.7,
      tuck: 0.4,
    });
    ride(sober, 8, input);
    ride(zero, 8, input);
    expect(zero.skier.x).toBe(sober.skier.x);
    expect(zero.skier.z).toBe(sober.skier.z);
    expect(zero.skier.vx).toBe(sober.skier.vx);
    expect(zero.skier.q).toEqual(sober.skier.q);
  });

  it("leaves every crash threshold where resilience put it", () => {
    const c = staged(0).skier;
    const keys = Object.keys(BUZZ.crash) as CrashLimit[];
    const sober = staged(undefined).skier;
    for (const k of keys) expect(crashLimit(c, k)).toBe(crashLimit(sober, k));
  });
});

describe("the buzz", () => {
  it("lowers every threshold toward the drunk's, all the way at 1", () => {
    const full = staged(1).skier;
    const half = staged(0.5).skier;
    const sober = staged(undefined).skier;
    for (const k of Object.keys(BUZZ.crash) as CrashLimit[]) {
      expect(crashLimit(full, k)).toBeCloseTo(BUZZ.crash[k], 9);
      expect(crashLimit(half, k)).toBeCloseTo((crashLimit(sober, k) + BUZZ.crash[k]) / 2, 9);
    }
  });

  it("will not let him ride straight", () => {
    const sober = wander(staged(undefined), 8);
    const drunk = wander(staged(0.9), 8);
    expect(sober).toBeLessThan(0.2);
    expect(drunk).toBeGreaterThan(2);
  });

  it("puts the edge on late, and harder or softer than asked", () => {
    const state = staged(1);
    const asked = { ...NEUTRAL_INPUT, steer: 0.6 };
    const first = drunkInput(state, asked).steer;
    expect(Math.abs(first)).toBeLessThan(0.6);
    const seen: number[] = [];
    for (let i = 0; i < 12 * TUNING.physicsHz; i++) {
      state.t += TUNING.dt;
      seen.push(drunkInput(state, asked).steer);
    }
    expect(Math.max(...seen)).toBeGreaterThan(0.75);
    expect(Math.min(...seen)).toBeLessThan(0.45);
  });

  it("is the same buzzed run twice: every wobble is the clock's, off the seed", () => {
    const a = staged(0.7);
    const b = staged(0.7);
    ride(a, 6, { ...NEUTRAL_INPUT, steer: 0.3 });
    ride(b, 6, { ...NEUTRAL_INPUT, steer: 0.3 });
    expect(b.skier.x).toBe(a.skier.x);
    expect(b.skier.z).toBe(a.skier.z);
  });

  it("wears off slowly outside", () => {
    const state = staged(0.6, 0);
    ride(state, 30);
    expect(state.skier.buzz!).toBeCloseTo(0.6 - 30 * BUZZ.decay, 3);
  });
});

/** Throw him at `speed` m/s down +z, as a fall at speed would. */
function thrown(state: GameState, speed = 10): GameEvent[] {
  const events: GameEvent[] = [];
  throwRider(state, "roll", { x: 0, y: 0, z: speed }, events);
  return events;
}

describe("a buzzed fall", () => {
  it("is not reset: he gets up where he lies, fetches both skis and skis on", () => {
    const state = staged(0.8, 10);
    ride(state, 0.2);
    thrown(state);
    const events = ride(state, TUNING.crash.lieFor + 0.5);
    expect(events.some((e) => e.kind === "reset")).toBe(false);
    expect(events.some((e) => e.kind === "fetch" && e.phase === "up")).toBe(true);
    const f = state.skier.fetch!;
    expect(f).toBeTruthy();
    expect(state.skier.thrown).toBeNull();
    // ...his hands off: the walk goes by itself, to each ski in turn.
    const after = ride(state, 120);
    const beats = after.filter((e) => e.kind === "fetch").map((e) => e.kind === "fetch" && e.phase);
    expect(beats).toEqual(["ski", "ski", "in"]);
    expect(after.some((e) => e.kind === "reset")).toBe(false);
    expect(state.skier.fetch).toBeNull();
    expect(state.skier.thrown).toBeNull();
    // ...and he skis on from there.
    ride(state, 6, { ...NEUTRAL_INPUT, tuck: 1 });
    expect(state.skier.speed).toBeGreaterThan(2);
  });

  it("walks on the player's own hands too, and the reset press still ends it", () => {
    const state = staged(0.8, 10);
    thrown(state);
    ride(state, TUNING.crash.lieFor + BUZZ.fetch.rise + 0.5);
    expect(state.skier.fetch?.phase).toBe("walk");
    const h = state.skier.heading;
    ride(state, 1, { ...NEUTRAL_INPUT, steer: 1 });
    expect(state.skier.heading).not.toBeCloseTo(h, 2);
    const events = ride(state, TUNING.dt, { ...NEUTRAL_INPUT, reset: true });
    expect(events.some((e) => e.kind === "reset")).toBe(true);
    expect(state.skier.fetch).toBeNull();
  });

  it("is reset as ever when he is sober, or on a run that counts a course", () => {
    for (const s of [staged(undefined, 10), staged(0.8, 10, false)]) {
      thrown(s);
      const events = ride(s, TUNING.crash.lieFor + 0.5);
      expect(events.some((e) => e.kind === "reset")).toBe(true);
      expect(s.skier.fetch ?? null).toBeNull();
    }
  });

  it("comes much sooner: a carve that a sober skier holds throws a drunk one", () => {
    const carve = (s: GameState): SkierInput => ({
      ...NEUTRAL_INPUT,
      steer: Math.sin(s.t * 1.6) > 0 ? 0.9 : -0.9,
      tuck: 0.6,
    });
    const falls = (buzz: number | undefined): number => {
      const s = staged(buzz, 16, true, syntheticLevel());
      placeRun(s, { x: SLOPE.x, z: 600, heading: 0, speed: 16 });
      if (buzz !== undefined) s.skier.buzz = buzz;
      return ride(s, 25, carve).filter((e) => e.kind === "wipeout").length;
    };
    expect(falls(undefined)).toBe(0);
    expect(falls(1)).toBeGreaterThan(0);
  });
});

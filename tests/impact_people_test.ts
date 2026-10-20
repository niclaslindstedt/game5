// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PERSON STRUCK, SEEN COMING (`pwa/src/game/impact-people.ts` under
// `impact-forecast.ts`): the read ahead finds a hard meeting with one of
// the crowd's amateurs (dead-reckoned, never stepped) or a person on foot
// (stepped in the copy, off his closed-form plan) as the IMPACT cam's
// strike, at the moment it comes; a knock at a cruise is not one; and the
// run read is left exactly as it was.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  TUNING,
  createGame,
  placeRun,
  step,
  withFoot,
  type Amateur,
  type GameEvent,
  type GameState,
} from "@engine";

import { createForecaster, forecast } from "../pwa/src/game/impact-forecast.ts";
import { ghostsOf, hardStrike, peopleAhead } from "../pwa/src/game/impact-people.ts";
import { HIT_SEED } from "./support/body-hits.ts";
import { levelFor } from "./support/levels.ts";

type Struck = Extract<GameEvent, { kind: "struck" }>;

/** A free ride with its INJURIES on, the crowd all up a lift but one
 * amateur stood stopped on his run, and the player sent at him from `far`
 * m up his way at `kmh`. */
function intoAmateur(kmh: number, far: number): { state: GameState; a: Amateur } {
  const state = createGame({
    level: levelFor(HIT_SEED),
    seed: HIT_SEED,
    mode: "free",
    quiet: true,
    crowd: 30,
    gore: true,
  });
  const crowd = state.crowd!;
  for (const o of crowd.amateurs) o.mode = "lift";
  for (const g of crowd.groups) g.lift = 1e9;
  const a = crowd.amateurs.find((o) => o.rank === 0) ?? crowd.amateurs[0];
  Object.assign(a, { mode: "stop", body: "man", board: null, speed: 0, timer: 1e9, think: 1e9 });
  step(state, NEUTRAL_INPUT);
  const h = a.heading;
  placeRun(state, {
    x: a.x - Math.sin(h) * far,
    z: a.z - Math.cos(h) * far,
    heading: h,
    speed: kmh / 3.6,
  });
  return { state, a };
}

/** A free ride with its INJURIES on and one civilian stood `far` m ahead
 * of the player, sent at him at `kmh`. */
function intoCivilian(kmh: number, far: number): GameState {
  const state = createGame({
    level: levelFor(HIT_SEED),
    seed: HIT_SEED,
    mode: "free",
    quiet: true,
    crowd: 0,
    gore: true,
  });
  const c = state.skier;
  placeRun(state, { x: c.x, z: c.z, heading: 0, speed: kmh / 3.6 });
  const x = c.x;
  const z = c.z + far;
  const y = state.level.groundAt(x, z);
  withFoot(state, {
    people: [{ key: 7, body: "man", x, y, z, heading: Math.PI, rx: x, rz: z, rr: 1 }],
    rate: 0,
  });
  return state;
}

/** The step the run meets a person on, and its event. */
function meeting(state: GameState, most: number): { at: number; e: Struck } | null {
  for (let i = 1; i <= most; i++) {
    step(state, NEUTRAL_INPUT);
    const e = state.events.find((x): x is Struck => x.kind === "struck");
    if (e) return { at: i, e };
  }
  return null;
}

describe("a person struck, seen coming", () => {
  it("sees an amateur skied into at 60 km/h as the impact cam's strike, at the step it comes", () => {
    const { state } = intoAmateur(60, 10);
    expect(ghostsOf(state, 0.8).length).toBeGreaterThan(0);
    expect(peopleAhead(state, 0.8)).toBe(true);
    const seen = forecast(state, NEUTRAL_INPUT, 0.8);
    expect(seen?.strike?.kind).toBe("person");
    expect(seen!.strike!.person).toBeDefined();
    expect(seen!.strike!.way.z ** 2 + seen!.strike!.way.x ** 2).toBeGreaterThan(15 ** 2);
    const met = meeting(state, 200)!;
    expect(met).not.toBeNull();
    expect(hardStrike(met.e)).toBe(true);
    expect(Math.abs(met.at * TUNING.dt - seen!.strike!.in)).toBeLessThan(0.05);
    expect(Math.hypot(met.e.x - seen!.strike!.at.x, met.e.z - seen!.strike!.at.z)).toBeLessThan(1);
  });

  it("sees a civilian run into at 60 km/h, read off his own plan in the copy", () => {
    const state = intoCivilian(60, 8);
    expect(peopleAhead(state, 0.8)).toBe(true);
    const seen = forecast(state, NEUTRAL_INPUT, 0.8);
    expect(seen?.strike?.kind).toBe("person");
    const met = meeting(state, 200)!;
    expect(met).not.toBeNull();
    expect(Math.abs(met.at * TUNING.dt - seen!.strike!.in)).toBeLessThan(0.05);
  });

  it("finds it over frames, as the app reads it", () => {
    const { state } = intoAmateur(60, 10);
    const ahead = createForecaster();
    let seen = null;
    for (let k = 0; k < 40 && !seen?.strike; k++) seen = ahead.frame(state, NEUTRAL_INPUT);
    expect(seen?.strike?.kind).toBe("person");
    expect(seen!.strike!.in).toBeGreaterThan(0);
  });

  it("sees no strike in a shoulder at a cruise, nor in a meeting that hurts nobody slowly", () => {
    const { state } = intoAmateur(20, 4);
    expect(forecast(state, NEUTRAL_INPUT, 0.8)?.strike).toBeUndefined();
    expect(meeting(state, 120)).toBeNull();
    // A child's knock, or one on a run without its injuries: past the
    // strike speed, but hurting nobody, only a fast one is the cam's.
    expect(hardStrike({ speed: 9, killed: false, injured: false })).toBe(false);
    expect(hardStrike({ speed: 13, killed: false, injured: false })).toBe(true);
    expect(hardStrike({ speed: 7, killed: false, injured: true })).toBe(true);
  });

  it("leaves the run it reads exactly as it was, the crowd and all", () => {
    const a = intoAmateur(60, 14).state;
    const b = intoAmateur(60, 14).state;
    const trail = (s: GameState) =>
      JSON.stringify([s.t, s.skier, s.gore, s.crowd!.amateurs, s.crowd!.struck]);
    for (let i = 0; i < 240; i++) {
      if (i % 6 === 0) forecast(a, NEUTRAL_INPUT, 0.8);
      step(a, NEUTRAL_INPUT);
      step(b, NEUTRAL_INPUT);
      expect(a.events).toEqual(b.events);
    }
    expect(trail(a)).toBe(trail(b));
    expect(a.rng.next()).toBe(b.rng.next());
    expect(a.crowd!.rng.next()).toBe(b.crowd!.rng.next());
  });
});

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// IN TOWN ON FOOT (`engine/game/town.ts`): a free ride's skier skied onto
// a street of the village is stopped, steps out of his bindings, puts the
// pair on his shoulder and walks; off the streets the pair comes down, he
// steps back in and skis on. Only where the rules ask for it, the reset
// forgets it, and the pair is on his shoulder — over it, tips ahead — the
// whole walk.

import { describe, expect, it } from "vitest";

import { angleDiff } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  createGame,
  NEUTRAL_INPUT,
  placeRun,
  standSkier,
  step,
  streetMaskAt,
  TOWN,
  TUNING,
  villageOf,
  type GameEvent,
  type GameState,
  type SkierInput,
} from "@engine";

import { townKey, townMove } from "../pwa/src/game/town-pose.ts";

import { levelFor } from "./support/levels.ts";

const SEED = 38;

/** A free ride on `SEED`'s map, the crowd sent home, skied along the
 * village's longest street at 7 m/s from 14 m back of its middle. */
function intoTheVillage(town = true): GameState {
  const state = createGame({ level: levelFor(SEED), mode: "free", quiet: true });
  delete state.crowd;
  if (!town) state.rules = { ...state.rules, town: false };
  const v = villageOf(state.level)!;
  const st = [...v.streets].sort((a, b) => b.points.length - a.points.length)[0];
  const i = Math.floor(st.points.length * 0.35);
  const a = st.points[i];
  const b = st.points[i + 3];
  const heading = Math.atan2(b.x - a.x, b.z - a.z);
  placeRun(state, {
    x: a.x - Math.sin(heading) * 14,
    z: a.z - Math.cos(heading) * 14,
    heading,
    speed: 7,
  });
  return state;
}

function ride(
  state: GameState,
  seconds: number,
  input: (s: GameState) => SkierInput = () => NEUTRAL_INPUT,
): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) {
    step(state, input(state));
    events.push(...state.events);
  }
  return events;
}

const phases = (events: GameEvent[]): string[] =>
  events.flatMap((e) => (e.kind === "town" ? [e.phase] : []));

/** The nearest way off the village's streets: a heading. */
function wayOut(s: GameState): number {
  const c = s.skier;
  let best = { h: c.heading, d: Infinity };
  for (let a = 0; a < 72; a++) {
    const hd = (a / 72) * Math.PI * 2;
    for (let d = 2; d < 260; d += 2) {
      if (streetMaskAt(s.level, c.x + Math.sin(hd) * d, c.z + Math.cos(hd) * d) < 2) {
        if (d < best.d) best = { h: hd, d };
        break;
      }
    }
  }
  return best.h;
}

/** Walk toward `target`: turned to it, then on with the tuck. */
const toward =
  (target: number) =>
  (s: GameState): SkierInput => {
    const turn = angleDiff(s.skier.heading, target);
    return {
      ...NEUTRAL_INPUT,
      tuck: Math.abs(turn) < 0.6 ? 1 : 0,
      steer: Math.max(-1, Math.min(1, turn * 3)),
    };
  };

describe("in town on foot", () => {
  it("stops him on a street, steps him out and puts the pair on his shoulder", () => {
    const state = intoTheVillage();
    const events = ride(state, 4 + TOWN.out + TOWN.pick);
    expect(phases(events)).toEqual(["stop", "heel", "heel", "clap", "shoulder"]);
    const w = state.skier.town!;
    expect(w.phase).toBe("walk");
    expect(state.skier.speed).toBeLessThan(0.05);
    // On his shoulder: both skis above his shoulder's height and running
    // along the way he faces, tips ahead.
    const ground = state.skier.y - state.skier.spec.cogHeight;
    const fx = Math.sin(state.skier.heading);
    const fz = Math.cos(state.skier.heading);
    for (const ski of w.skis) {
      const [tx, ty, tz, lx, ly, lz] = ski.ends;
      expect((ty + ly) / 2 - ground).toBeGreaterThan(1.2);
      expect((tx - lx) * fx + (tz - lz) * fz).toBeGreaterThan(1.2);
    }
  });

  it("walks on the tuck, stands still without it, and steps as he goes", () => {
    const state = intoTheVillage();
    ride(state, 4 + TOWN.out + TOWN.pick);
    const at = { x: state.skier.x, z: state.skier.z };
    ride(state, 1);
    expect(Math.hypot(state.skier.x - at.x, state.skier.z - at.z)).toBeLessThan(0.05);
    const ahead = state.skier.heading;
    const steps = phases(ride(state, 3, toward(ahead))).filter((p) => p === "step");
    const walked = Math.hypot(state.skier.x - at.x, state.skier.z - at.z);
    expect(walked).toBeGreaterThan(2);
    expect(walked).toBeLessThan(TOWN.walk * 3 + 0.1);
    expect(steps.length).toBeGreaterThanOrEqual(3);
  });

  it("puts the pair back on off the streets and skis him on", () => {
    const state = intoTheVillage();
    ride(state, 4 + TOWN.out + TOWN.pick);
    const events: GameEvent[] = [];
    for (let i = 0; i < 120 * 240 && state.skier.town?.phase === "walk"; i++) {
      step(state, toward(wayOut(state))(state));
      events.push(...state.events);
    }
    events.push(...ride(state, TOWN.drop + TOWN.clip + 0.5));
    expect(phases(events).filter((p) => p !== "step")).toEqual(["lay", "snap", "snap", "away"]);
    expect(state.skier.town ?? null).toBeNull();
    expect(state.skier.thrown ?? null).toBeNull();
    expect(streetMaskAt(state.level, state.skier.x, state.skier.z)).toBeLessThan(3);
  });

  it("is only where the rules ask for it, and the reset forgets it", () => {
    const off = intoTheVillage(false);
    expect(phases(ride(off, 4))).toEqual([]);
    expect(off.skier.town ?? null).toBeNull();

    const state = intoTheVillage();
    ride(state, 4);
    expect(state.skier.town).toBeTruthy();
    standSkier(state, state.skier.x, state.skier.z, state.skier.heading);
    expect(state.skier.town ?? null).toBeNull();
  });

  it("holds the pair in his right hand over his right shoulder as drawn", () => {
    const state = intoTheVillage();
    ride(state, 4 + TOWN.out + TOWN.pick + 0.5);
    const m = townMove(state.skier.town!, state.skier);
    const { key } = townKey(m, 1.2);
    // The right hand is up by the head, on the pair's right-hand ski.
    const right = key.hands[1];
    expect(right.y).toBeGreaterThan(1.2);
    for (const ski of m.skis) expect(ski.b.y).toBeGreaterThan(1.2);
  });
});

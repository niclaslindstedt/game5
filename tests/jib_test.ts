// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JIBS (`jib.ts`) on the bench: a rail and a box laid on a synthetic
// strip at a rail section's pitch, nothing the generator built. A skier
// met at one along it is put on it, slides it, swaps and presses on it,
// turns out and leaves it straight, lands and rides away — and one who
// comes at it off its line, or flies over it, is not.

import { describe, expect, it } from "vitest";

import {
  JIBS,
  createGame,
  jibLength,
  placeRun,
  step,
  type GameEvent,
  type GameState,
  type Jib,
  type Level,
  type SkierInput,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

/** The strip's pitch: 7°, a rail section's deck. */
const GRADE = Math.tan((7 * Math.PI) / 180);
const X = 500;
const Z0 = 300;

/** The strip with a jib on its middle from `Z0`, `entry` m over the snow,
 * `legs` m of plan each following the pitch (a level leg where `flat`). */
function benchLevel(kind: "rail" | "box", legs: number[], flat: boolean[] = []): Level {
  const base = flatLevel({ packed: 1, size: 1000, grade: GRADE, slopeFrom: 0 });
  let z = Z0;
  let y = base.groundAt(X, z) + 0.3;
  const points = [{ x: X, y, z }];
  legs.forEach((leg, i) => {
    z += leg;
    if (!flat[i]) y -= leg * GRADE;
    points.push({ x: X, y, z });
  });
  const jib: Jib = {
    id: "J1L",
    section: 1,
    line: -1,
    kind,
    shape: flat.some(Boolean) ? "flatDown" : "down",
    points,
    width: kind === "rail" ? 0.08 : 0.4,
  };
  return { ...base, jibs: [jib] };
}

const NONE: SkierInput = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };

/** A run on `level` placed `before` m above the jib at `speed`, `dx` m off
 * its line, ridden for `seconds` on `input(t)`; every event it raised. */
function rideAt(
  level: Level,
  options: {
    speed?: number;
    before?: number;
    dx?: number;
    seconds?: number;
    input?: (state: GameState) => SkierInput;
  } = {},
): { state: GameState; events: GameEvent[]; onFor: number; touching: boolean } {
  const state = createGame({ level, mode: "free", crowd: 0, quiet: true });
  state.rules = {
    ...state.rules,
    stunts: true,
    tricks: true,
    heli: false,
    sled: false,
    lifts: false,
  };
  placeRun(state, {
    x: X + (options.dx ?? 0),
    z: Z0 - (options.before ?? 4),
    heading: 0,
    pitch: -Math.atan(GRADE),
    speed: options.speed ?? 6.5,
  });
  const events: GameEvent[] = [];
  let onFor = 0;
  let touching = false;
  const steps = Math.round((options.seconds ?? 5) * 120);
  for (let i = 0; i < steps; i++) {
    step(state, options.input ? options.input(state) : NONE);
    events.push(...state.events);
    if (state.skier.jib) {
      onFor += 1 / 120;
      if (state.skier.contacts.some((c) => c.touching)) touching = true;
    }
  }
  return { state, events, onFor, touching };
}

describe("a jib ridden (jib.ts)", () => {
  it("puts a skier met at its end along it on it, slides him down it and off its end", () => {
    const { state, events, onFor, touching } = rideAt(benchLevel("rail", [9]));
    const jib = state.level.jibs?.[0] as Jib;
    const on = events.filter((e) => e.kind === "jib" && e.phase === "on");
    const off = events.filter((e) => e.kind === "jib" && e.phase === "off");
    expect(on).toHaveLength(1);
    expect(off).toHaveLength(1);
    // A 9 m rail at 6–8 m/s is a second and some on it.
    expect(onFor).toBeGreaterThan(0.8);
    expect(onFor).toBeLessThan(2);
    // On it, nothing of his touches the snow (the trail map draws nothing).
    expect(touching).toBe(false);
    const r = state.tricks.jibs[0];
    expect(r).toMatchObject({ id: "J1L", kind: "rail", on: 0, off: 0, swaps: 0, whole: true });
    expect(r.stances).toEqual(["fifty"]);
    expect(r.length).toBeCloseTo(jibLength(jib), 1);
    // ...and he lands off it and rides away.
    expect(events.some((e) => e.kind === "wipeout")).toBe(false);
    expect(state.skier.thrown).toBeNull();
    expect(state.skier.z).toBeGreaterThan(Z0 + 20);
  });

  it("slides him on its line at its top, his speed down it", () => {
    const level = benchLevel("box", [8]);
    const state = createGame({ level, mode: "free", crowd: 0, quiet: true });
    state.rules = { ...state.rules, heli: false, sled: false, lifts: false };
    placeRun(state, { x: X + 0.3, z: Z0 - 3, heading: 0, pitch: -Math.atan(GRADE), speed: 6 });
    let seen = false;
    for (let i = 0; i < 240 && !seen; i++) {
      step(state, NONE);
      const c = state.skier;
      if (c.jib && c.jib.u > 2) {
        seen = true;
        expect(c.x).toBeCloseTo(X, 5);
        const top = level.groundAt(c.x, c.z) + 0.3;
        expect(c.y - c.spec.cogHeight).toBeCloseTo(top, 1);
        expect(c.vz).toBeGreaterThan(3);
        expect(c.vy).toBeLessThan(0);
      }
    }
    expect(seen).toBe(true);
  });

  it("misses a jib met off its line, or flown high over", () => {
    const wide = rideAt(benchLevel("rail", [9]), { dx: 1.5, seconds: 3 });
    expect(wide.events.some((e) => e.kind === "jib")).toBe(false);
    expect(wide.state.tricks.jibs).toHaveLength(0);
    const level = benchLevel("rail", [9]);
    const state = createGame({ level, mode: "free", crowd: 0, quiet: true });
    state.rules = { ...state.rules, heli: false, sled: false, lifts: false };
    placeRun(state, { x: X, z: Z0 - 1, heading: 0, speed: 8, height: 3, vy: 2 });
    for (let i = 0; i < 60; i++) step(state, NONE);
    expect(state.tricks.jibs).toHaveLength(0);
  });

  it("swaps to a slide on the edge tapped, and turns out of it straight", () => {
    let t = 0;
    const { state, events } = rideAt(benchLevel("box", [10]), {
      speed: 6,
      input: (s) => {
        t = s.skier.jib ? t + 1 : t;
        // One tap, a quarter of a second onto it.
        return { ...NONE, steer: t > 30 && t < 40 ? 1 : 0 };
      },
    });
    const r = state.tricks.jibs[0];
    expect(r.swaps).toBe(1);
    expect(r.stances).toEqual(["fifty", "slide"]);
    // Off a slide with the edge let go: back round the near way, a 90 out.
    expect(r.off).toBe(90);
    expect(r.whole).toBe(true);
    expect(events.some((e) => e.kind === "wipeout")).toBe(false);
    expect(state.skier.thrown).toBeNull();
  });

  it("holds a press on the lean, and the record names the end", () => {
    const { state } = rideAt(benchLevel("box", [8]), {
      input: (s) => ({ ...NONE, lean: s.skier.jib ? -1 : 0 }),
    });
    const r = state.tricks.jibs[0];
    expect(r.press).toBe("nose");
    expect(r.pressed).toBeGreaterThan(0.5);
  });

  it("pops him off it where he lets the jump go", () => {
    let t = 0;
    const { state } = rideAt(benchLevel("rail", [10]), {
      input: (s) => {
        t = s.skier.jib ? t + 1 : t;
        return { ...NONE, jump: t > 0 && t < 40 };
      },
    });
    const r = state.tricks.jibs[0];
    expect(r.whole).toBe(false);
    expect(r.length).toBeLessThan(8);
  });

  it("rides a level leg and a falling one, and a slow skier slides off", () => {
    const kinked = rideAt(benchLevel("rail", [3, 6], [true, false]));
    expect(kinked.state.tricks.jibs[0].whole).toBe(true);
    // A box that climbs: too slow, he slides off its side partway.
    const base = flatLevel({ packed: 1, size: 1000, grade: GRADE, slopeFrom: 0 });
    const y = base.groundAt(X, Z0) + 0.3;
    const uphill: Level = {
      ...base,
      jibs: [
        {
          id: "J1L",
          section: 1,
          line: -1,
          kind: "box",
          shape: "down",
          points: [
            { x: X, y, z: Z0 },
            { x: X, y: y + 4, z: Z0 + 12 },
          ],
          width: 0.4,
        },
      ],
    };
    const slow = rideAt(uphill, { speed: 3 });
    expect(slow.state.tricks.jibs[0].whole).toBe(false);
  });

  it("replays to the same ride", () => {
    const a = rideAt(benchLevel("rail", [9]), {
      input: (s) => ({ ...NONE, steer: s.t > 0.8 && s.t < 0.9 ? 1 : 0 }),
    });
    const b = rideAt(benchLevel("rail", [9]), {
      input: (s) => ({ ...NONE, steer: s.t > 0.8 && s.t < 0.9 ? 1 : 0 }),
    });
    expect(a.state.skier.x).toBe(b.state.skier.x);
    expect(a.state.skier.z).toBe(b.state.skier.z);
    expect(a.state.tricks.jibs).toEqual(b.state.tricks.jibs);
  });

  it("states its numbers with their ranges", () => {
    expect(JIBS.friction.rail).toBeGreaterThan(0);
    expect(JIBS.friction.box).toBeLessThanOrEqual(JIBS.friction.rail);
  });
});

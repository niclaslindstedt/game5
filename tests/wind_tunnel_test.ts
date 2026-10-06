// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIND TUNNEL (R30, `wind-tunnel.ts`): a skier stood into the wind
// inside one is blown along it without skiing — to its speed in a few
// seconds and on past it with no ceiling, ever more slowly — held to its
// line, and let go at its exit with his way kept; a skier crossing one is
// left alone. Staged on the flat drag strip with a hand-made tunnel laid
// across it, nothing the generator built.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  SKIS,
  TUNING,
  createGame,
  placeRun,
  step,
  type GameEvent,
  type GameState,
  type Level,
  type WindTunnel,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

/** The tunnel: along +x across the strip at z = `Z`, from `FROM` to `TO`. */
const Z = 1500;
const FROM = 1000;
const TO = 2000;
const SPEED = 28;

function tunnel(): WindTunnel {
  const points: WindTunnel["points"] = [];
  for (let s = 0; s <= TO - FROM; s += 4)
    points.push({ x: FROM + s, z: Z, y: 0, s, heading: Math.PI / 2 });
  return { id: "W1", points, length: TO - FROM, width: 9, speed: SPEED };
}

function levelWithTunnel(): Level {
  const level = flatLevel({ packed: 1 });
  level.resort = {
    runs: [],
    lifts: [],
    courses: [],
    course: "",
    village: { x: 1500, y: 0, z: 1500 },
    tunnels: [tunnel()],
  };
  return level;
}

const LEVEL = levelWithTunnel();

function stage(x: number, z: number, heading: number, speed = 0): GameState {
  const state = createGame({ level: LEVEL, spec: SKIS, rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x, z, heading, speed });
  return state;
}

/** Ride with the hands off for up to `seconds`, collecting the tunnel's
 * events; stops early when `until` says so. */
function ride(state: GameState, seconds: number, until?: (s: GameState) => boolean): GameEvent[] {
  const seen: GameEvent[] = [];
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) {
    step(state, NEUTRAL_INPUT);
    for (const e of state.events) if (e.kind === "tunnel") seen.push(e);
    if (until?.(state)) break;
  }
  return seen;
}

describe("the wind tunnel (R30)", () => {
  it("takes in a skier stood into the wind and blows him to its speed in a few seconds", () => {
    const state = stage(FROM + 10, Z, Math.PI / 2);
    const events = ride(state, 6, (s) => s.skier.vx > SPEED * 0.9);
    expect(events[0]).toMatchObject({ kind: "tunnel", id: "W1", phase: "in" });
    expect(state.skier.tunnel?.id).toBe("W1");
    expect(state.skier.vx).toBeGreaterThan(SPEED * 0.9);
    expect(state.t).toBeLessThan(5);
  });

  it("blows him on past its speed with no ceiling, more slowly the faster he goes", () => {
    const state = stage(FROM + 10, Z, Math.PI / 2);
    // 150 km/h in a few seconds and a few hundred metres of the lane.
    ride(state, 8, (s) => s.skier.vx > 150 / 3.6);
    expect(state.skier.vx).toBeGreaterThan(150 / 3.6);
    expect(state.t).toBeLessThan(6);
    expect(state.skier.x - FROM).toBeLessThan(150);
    // ...and on: every second faster than the last, by less each time.
    const gains: number[] = [];
    for (let i = 0; i < 6; i++) {
      const was = state.skier.vx;
      ride(state, 1);
      gains.push(state.skier.vx - was);
    }
    expect(state.skier.tunnel?.id).toBe("W1");
    expect(state.skier.thrown).toBeNull();
    for (let i = 1; i < gains.length; i++) {
      expect(gains[i]).toBeGreaterThan(0);
      expect(gains[i]).toBeLessThan(gains[i - 1]);
    }
    expect(Math.abs(state.skier.vz)).toBeLessThan(1);
  });

  it("lets him go at its exit with his way kept", () => {
    const state = stage(FROM + 10, Z, Math.PI / 2);
    let last = 0;
    const events = ride(state, 80, (s) => {
      if (s.skier.tunnel === null && s.skier.x > TO - 20) return true;
      last = s.skier.vx;
      return false;
    });
    expect(events.map((e) => (e.kind === "tunnel" ? e.phase : ""))).toEqual(["in", "out"]);
    expect(state.skier.x).toBeGreaterThan(TO - 10);
    const at = state.skier.vx;
    expect(at).toBeGreaterThan(SPEED * 2);
    expect(at).toBeGreaterThan(last * 0.99);
    // Past the exit nothing blows: he runs on, slowing only as the snow and
    // the still air slow him — hard, at the speed the lane let him go at.
    ride(state, 1);
    expect(state.skier.tunnel).toBeNull();
    expect(state.skier.vx).toBeGreaterThan(SPEED);
    expect(state.skier.vx).toBeLessThan(at);
  });

  it("holds him to its line", () => {
    // Three metres right of the way it blows: right of +x is −z.
    const state = stage(FROM + 10, Z - 3, Math.PI / 2);
    let worst = 0;
    const events = ride(state, 6, (s) => {
      worst = Math.max(worst, Math.abs(s.skier.z - Z));
      return false;
    });
    expect(events).toHaveLength(1);
    expect(worst).toBeLessThan(4.5);
    expect(Math.abs(state.skier.z - Z)).toBeLessThan(1.5);
  });

  it("leaves a skier crossing it alone", () => {
    // Square across it, as a run's finish would cross one.
    const state = stage(1500, Z - 40, 0, 10);
    const events = ride(state, 8, (s) => s.skier.z > Z + 40);
    expect(events).toHaveLength(0);
    // Nothing shoved him sideways: his way runs along his skis — skating
    // by then, along the gliding one's line (`glide`), a zig-zag of his own.
    const c = state.skier;
    const line = c.heading + c.glide;
    expect(Math.abs(c.vx * Math.cos(line) - c.vz * Math.sin(line))).toBeLessThan(0.5);
  });

  it("blows nothing on a map without one, and the same ride twice is the same ride", () => {
    const plain = createGame({
      level: flatLevel({ packed: 1 }),
      spec: SKIS,
      rivals: 0,
      countdown: 0,
      quiet: true,
    });
    placeRun(plain, { x: FROM + 10, z: Z, heading: Math.PI / 2 });
    expect(ride(plain, 2)).toHaveLength(0);
    expect(plain.skier.vx).toBeLessThan(3);
    const a = stage(FROM + 10, Z - 2, Math.PI / 2);
    const b = stage(FROM + 10, Z - 2, Math.PI / 2);
    ride(a, 5);
    ride(b, 5);
    expect([a.skier.x, a.skier.z, a.skier.vx]).toEqual([b.skier.x, b.skier.z, b.skier.vx]);
  });
});

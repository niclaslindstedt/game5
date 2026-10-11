// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMP JUMPED (R43): the bar and the start, the in-run's tracks to
// the edge at the jury's gate, the take-off's push and its timing, the
// flight on its polar in the wind along the hill, the landing and the
// distance credited — jumped by the real engine on a generated map's hill,
// a scripted jumper's hands (`make skijump-flight` is the same jumper's
// lab).

import { describe, expect, it } from "vitest";

import {
  ALBATROSS,
  JUMP,
  NEUTRAL_INPUT,
  TUNING,
  createGame,
  gateSpeed,
  pushShare,
  riderById,
  step,
  timeToEdge,
  withRider,
  type GameState,
  type JumpRecord,
} from "@engine";
import { levelFor } from "./support/levels.ts";

const SPEC = withRider(ALBATROSS, riderById("light"));
const SEED = 1;

type Jump = {
  /** The take-off's error, s (null never pressed). */
  timing?: number | null;
  /** A staged head wind along the hill, m/s. */
  wind?: number;
  lean?: number;
  hand?: number;
  /** Ride on to the fall line (else stop on the touch). */
  out?: boolean;
};

function newJump(o: Jump = {}): GameState {
  const state = createGame({
    level: levelFor(SEED),
    mode: "skiJump",
    spec: SPEC,
    countdown: 0,
    quiet: true,
    assist: { yaw: 1, air: o.hand ?? 1 },
  });
  state.jump!.staged = { head: o.wind ?? 0, across: 0 };
  return state;
}

function jump(o: Jump = {}): { state: GameState; record: JumpRecord } {
  const state = newJump(o);
  const timing = o.timing === undefined ? 0 : o.timing;
  let past = Math.round(1 / TUNING.dt);
  for (let i = 0; i < Math.round(40 / TUNING.dt) && past > 0; i++) {
    const j = state.jump!;
    if (j.stage === "down" && !o.out) break;
    const input = { ...NEUTRAL_INPUT, tuck: 1 };
    if (j.stage === "tracks") {
      input.jump = timing !== null && timeToEdge(state) <= JUMP.takeOff.push - timing;
    } else if (j.stage === "air") {
      input.lean = o.lean ?? 0;
    }
    step(state, input);
    if (state.phase === "finished" || state.progress.out) past -= 1;
  }
  return { state, record: state.jump!.record };
}

const K = (): number => newJump().level.skiJump!.w;

describe("the bar and the in-run", () => {
  it("sits him on the jury's gate, still, until the press", () => {
    const state = newJump();
    const j = state.jump!;
    expect(j.stage).toBe("bar");
    const hill = state.level.skiJump!;
    expect(
      gateSpeed(hill, j.gate, j.density, SPEC.skierMass + SPEC.gearMass),
    ).toBeGreaterThanOrEqual(hill.speed);
    for (let i = 0; i < 60; i++) step(state, NEUTRAL_INPUT);
    expect(j.stage).toBe("bar");
    expect(j.speed).toBe(0);
  });

  it("leaves the bar on the tuck and carries the design speed over the edge", () => {
    const { record, state } = jump();
    const hill = state.level.skiJump!;
    expect(record.edgeSpeed).toBeGreaterThanOrEqual(hill.speed - 0.1);
    expect(record.edgeSpeed).toBeLessThan(hill.speed + 0.6);
    expect(record.inRunSpeed).toBeGreaterThan(record.edgeSpeed - 1);
    expect(state.progress.out).toBeFalsy();
  });
});

describe("the take-off", () => {
  it("keeps the whole push on time, less of it mistimed, none of it never pressed", () => {
    expect(pushShare(0)).toBe(1);
    expect(pushShare(0.1)).toBeCloseTo(pushShare(-0.1), 9);
    expect(pushShare(0.1)).toBeLessThan(0.8);
    expect(pushShare(JUMP.takeOff.push)).toBeCloseTo(0, 9);
    expect(pushShare(null)).toBe(0);
  });
});

describe("the flight", () => {
  const calm = jump({ out: true });

  it("a jump on time in calm air lands within 8 m of K, telemarked, ridden out clean", () => {
    const r = calm.record;
    expect(Math.abs(r.distance - K())).toBeLessThanOrEqual(8);
    expect(r.flightTime).toBeGreaterThan(3.8);
    expect(r.flightTime).toBeLessThan(5.2);
    expect(r.peak).toBeGreaterThan(3);
    expect(r.peak).toBeLessThan(5.5);
    expect(r.landing).toBe("telemark");
    expect(r.outcome).toBe("clean");
    expect(r.load).toBeGreaterThan(1);
  });

  it("credits the distance to the half metre below", () => {
    const r = calm.record;
    expect(r.distance * 2).toBe(Math.floor(r.distance * 2));
    expect(r.distance).toBeLessThanOrEqual(r.reach);
    expect(r.reach - r.distance).toBeLessThan(0.5);
  });

  it("a head wind carries him further and a tail wind shortens him", () => {
    const head = jump({ wind: 2 }).record.distance;
    const tail = jump({ wind: -2 }).record.distance;
    const d = calm.record.distance;
    expect(head).toBeGreaterThan(d + 4);
    expect(tail).toBeLessThan(d - 4);
  });

  it("a take-off late is shorter, and never pressed shorter still", () => {
    const late = jump({ timing: 0.1 }).record;
    expect(late.share).toBeLessThan(0.8);
    expect(late.distance).toBeLessThan(calm.record.distance - 10);
    const none = jump({ timing: null }).record;
    expect(none.timing).toBeNull();
    expect(none.push).toBe(0);
    expect(none.distance).toBeLessThan(late.distance);
  });

  it("sat back with no hand on him he stalls and falls", () => {
    const { record } = jump({ lean: 1, hand: 0, out: true });
    expect(record.distance).toBeLessThan(calm.record.distance - 30);
    expect(record.landing).toBe("fall");
    expect(record.outcome).toBe("fall");
  });

  it("is the same jump jumped twice", () => {
    const again = jump({ out: true });
    expect(again.record).toEqual(calm.record);
    expect(again.state.skier.x).toBe(calm.state.skier.x);
    expect(again.state.skier.z).toBe(calm.state.skier.z);
  });
});

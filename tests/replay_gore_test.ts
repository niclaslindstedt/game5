// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A REPLAY DEALS THE SAME WOUNDS (`pwa/src/game/replay.ts`): the tape keeps
// every field of the controls a run was ridden on — a touch flick's pop, the
// jump plane's levers, the transceiver and the rescue key among them — so a
// recording stood up again parts from its run nowhere, and a rider cut by a
// lift's rope is cut again, piece for piece, in the replay of it.
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  createGame,
  liftPlans,
  ropeOver,
  standSkier,
  step,
  type SkierInput,
} from "@engine";
import { snapInput } from "../pwa/src/game/ghost.ts";
import { pairViews } from "../pwa/src/game/gore-replay.ts";
import type { GoreModel, GoreView } from "../pwa/src/game/gore-view.ts";
import { createReplayRig } from "../pwa/src/game/replay.ts";
import { isStoodUp } from "../pwa/src/game/replay-keep.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const level = levelFor(LEVEL_SEEDS[0]);

/** Every field `SkierInput` has, in turn set and let go. */
function inputAt(i: number): SkierInput {
  const input: SkierInput = {
    steer: Math.sin(i * 0.7),
    tuck: (i % 5) / 4,
    brake: (i % 3) / 2,
    lean: Math.cos(i * 0.3),
    reset: i % 11 === 0,
  };
  if (i % 2) input.trick = true;
  if (i % 3 === 1) input.carve = true;
  if (i % 4 === 1) input.jump = true;
  if (i % 4 === 2) input.pop = (i % 9) / 8 + 0.05;
  if (i % 5 === 1) input.machine = true;
  if (i % 6 === 1) input.beacon = true;
  if (i % 7 > 3) input.dig = true;
  if (i % 8 > 4) input.heli = { collective: 0.6, pitch: -0.3, roll: 0.2, pedal: 0.9 };
  if (i % 9 > 5) {
    input.plane = { throttle: 0.83, pitch: -0.123, roll: 0.456, yaw: -0.7, flaps: 0.25 };
    if (i % 2) input.plane.brake = 0.4;
    if (i % 3) input.plane.trim = -0.18;
  }
  return snapInput(input);
}

describe("a replay deals the same wounds", () => {
  it("keeps every field of the controls on its tape", () => {
    const run = createGame({ level, mode: "free", quiet: true });
    const rig = createReplayRig();
    rig.arm(run, "free");
    const ridden = Array.from({ length: 200 }, (_, i) => inputAt(i));
    for (const input of ridden) rig.step(input, run);
    const replay = rig.open()!;
    for (const want of ridden) {
      // Read back as the input it was: a field let go reads back as left out.
      const got = JSON.parse(JSON.stringify(replay.input())) as SkierInput;
      expect(got).toEqual(JSON.parse(JSON.stringify(want)));
    }
  });

  it("cuts a rider by a lift's rope again, piece for piece", () => {
    const chair = liftPlans(level).find((p) => p.lift.kind === "chair")!;
    const run = createGame({ level, mode: "free", quiet: true, gore: true });
    const p = ropeOver(chair, 1, chair.length * 0.5);
    const hx = chair.dz;
    const hz = -chair.dx;
    standSkier(run, p.x + hx * 0.6, p.z + hz * 0.6, Math.atan2(-hx, -hz));
    const c = run.skier;
    c.y = p.y + c.spec.cogHeight - 1.3;
    c.vx = -hx * 25;
    c.vz = -hz * 25;
    c.airborne = true;
    const rig = createReplayRig();
    rig.arm(run, "free");
    for (let i = 0; i < 240; i++) {
      step(run, NEUTRAL_INPUT);
      rig.step(NEUTRAL_INPUT, run);
    }
    expect(run.gore!.torn.length).toBeGreaterThan(0);
    const replay = rig.open("crash")!;
    while (!replay.over()) step(replay.state, replay.input());
    expect(replay.state.gore).toEqual(run.gore);
    expect(replay.state.skier.thrown?.halves).toEqual(run.skier.thrown?.halves);
  });
});

describe("the run's wounds and its replay's, drawn apart (gore-replay.ts)", () => {
  /** A hollow view that writes down what it was asked. */
  const hollow = (log: string[], name: string): GoreView => {
    const group = new THREE.Group();
    const dead = new THREE.Group();
    dead.name = "gore-remains";
    group.add(dead, new THREE.Group());
    return {
      group,
      update: (s) => void log.push(`${name}:draw:${s.tick}`),
      setPace: () => {},
      clear: () => void log.push(`${name}:clear`),
      leave: () => void log.push(`${name}:leave`),
      clearRemains: () => {},
      flown: () => null,
      dispose: () => {},
    };
  };

  it("leaves nothing lying on the way into a replay, across a seek or out of it", () => {
    const run = createGame({ level, mode: "free", quiet: true });
    const rig = createReplayRig();
    rig.arm(run, "free");
    for (let i = 0; i < 30; i++) {
      step(run, NEUTRAL_INPUT);
      rig.step(NEUTRAL_INPUT, run);
    }
    const log: string[] = [];
    const made: GoreView[] = [];
    const views = pairViews(() => {
      const v = hollow(log, made.length === 0 ? "run" : "replay");
      made.push(v);
      return v;
    });
    const model = {} as GoreModel;
    const replay = rig.open()!;
    expect(isStoodUp(replay.state)).toBe(true);
    expect(isStoodUp(run)).toBe(false);
    views.update(run, model, 0, 0);
    views.leave(model, replay.state); // into the replay
    views.update(replay.state, model, 0, 0);
    // The run held out of sight but for its dead.
    expect(made[0].group.children.map((o) => o.visible)).toEqual([true, false]);
    replay.seek(10);
    replay.pump(() => true);
    views.leave(model, replay.state); // a seek: a new copy
    views.update(replay.state, model, 0, 0);
    views.leave(model, run); // back to the run
    views.update(run, model, 0, 0);
    expect(made[0].group.children.map((o) => o.visible)).toEqual([true, true]);
    expect(log.filter((l) => l.endsWith(":leave"))).toEqual([]);
    expect(log).toEqual([
      "run:draw:30",
      "replay:draw:0",
      "replay:draw:10",
      "replay:clear",
      "run:draw:30",
    ]);
    // A new run leaves the last one lying, as it always did.
    views.leave(model, createGame({ level, mode: "free", quiet: true }));
    expect(log.at(-1)).toBe("run:leave");
  });
});

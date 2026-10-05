// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI CROSS'S START GATE AND FLAGS, AS PLANNED (`cross-gate-plan.ts`,
// `cross-flags.ts`'s `flagsOf`): a door a lane of the start gate, across the
// doors' line, up under the starter's word and down at GO, fallen onto the
// snow and no further; a turning gate one flag on its inside, a corridor
// gate a flag at each end — and no start house on a ski cross.

import { describe, expect, it } from "vitest";
import { createGame, SKI_CROSS, skisById, step, NEUTRAL_INPUT } from "@engine";

import {
  CROSS_GATE,
  crossGatePlan,
  doorAngle,
  sinceDrop,
} from "../pwa/src/game/cross-gate-plan.ts";
import { flagsOf } from "../pwa/src/game/cross-flags.ts";
import { startHousePlan } from "../pwa/src/game/start-house-plan.ts";

const game = () =>
  createGame({ seed: 8, mode: "skiCross", spec: skisById(SKI_CROSS.skis), quiet: true });

describe("a ski cross's start gate", () => {
  const state = game();
  const level = state.level;
  const plan = crossGatePlan(level)!;

  it("stands a door before every lane, across the doors' line, and no start house", () => {
    expect(plan).not.toBeNull();
    expect(startHousePlan(level)).toBeNull();
    expect(plan.doors.length).toBe(level.grid.length);
    for (const lane of level.grid) {
      // Each racer stands behind a door of his own, square to the course.
      const along = (lane.x - plan.x) * plan.fx + (lane.z - plan.z) * plan.fz;
      const across = (lane.x - plan.x) * plan.rx + (lane.z - plan.z) * plan.rz;
      expect(along).toBeLessThan(0);
      expect(along).toBeGreaterThan(-2);
      const door = plan.doors.find((d) => Math.abs(d.across - across) < 0.01);
      expect(door, `lane at ${across.toFixed(2)} m`).toBeDefined();
    }
    // A post between each two doors and one at each end, none in a door.
    expect(plan.posts.length).toBe(plan.doors.length + 1);
    for (const d of plan.doors) {
      for (const p of plan.posts) expect(Math.abs(p - d.across)).toBeGreaterThan(d.width / 2);
    }
  });

  it("holds its doors up under the starter's word and drops them at GO", () => {
    const run = game();
    expect(sinceDrop(run)).toBeLessThan(0);
    for (const d of plan.doors) expect(doorAngle(sinceDrop(run), d.open)).toBe(0);
    while (run.phase === "countdown") step(run, NEUTRAL_INPUT);
    for (let i = 0; i < 60; i++) step(run, NEUTRAL_INPUT);
    const t = sinceDrop(run);
    expect(t).toBeGreaterThan(0.4);
    for (const d of plan.doors) {
      // Past upright, onto the snow ahead, and settled there.
      expect(d.open).toBeGreaterThan(Math.PI / 2 - 0.2);
      expect(d.open).toBeLessThanOrEqual(CROSS_GATE.drop.most);
      expect(doorAngle(t, d.open)).toBeCloseTo(d.open, 2);
    }
    // Falling, never past where it lies.
    for (let u = 0; u < 1; u += 0.01) {
      expect(doorAngle(u, 1.6)).toBeLessThanOrEqual(1.6 + 1e-9);
      expect(doorAngle(u, 1.6)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("a ski cross's flags", () => {
  it("marks a turning gate with one flag on its inside, a corridor gate with two", () => {
    const level = game().level;
    const flags = flagsOf(level.checkpoints);
    let turning = 0;
    let corridor = 0;
    level.checkpoints.forEach((cp, gate) => {
      const own = flags.filter((f) => f.gate === gate);
      if (!cp.flags) {
        expect(own.length).toBe(0);
        return;
      }
      if (cp.pole === "open") {
        turning++;
        expect(own.map((f) => f.side)).toEqual([cp.turn]);
      } else {
        corridor++;
        expect(own.map((f) => f.side).sort()).toEqual([-1, 1]);
      }
    });
    expect(turning).toBeGreaterThan(0);
    expect(corridor).toBeGreaterThan(0);
  });
});

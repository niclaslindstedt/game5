// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SAVE AS THE FIGURE MAKES IT (`skier-save.ts`, followed by
// `skier-spring.ts`, laid on by `skier-pose.ts`): nothing at rest and
// nothing once it has played; a hard landing sinks him and flings his arms
// out; a trunk on the right knocks the right shoulder back and rocks him
// left; the body down on the right puts the right hand to the snow; and
// the whole of it comes on and goes as a motion, never a jump.

import { describe, expect, it } from "vitest";

import type { Save } from "@engine";
import {
  createSkierSpring,
  skierPose,
  stepSkierSpring,
  type SkierPose,
} from "../pwa/src/game/skier-pose.ts";
import { JOLT_KEYS, joltEnvelope, joltOf, NO_JOLT } from "../pwa/src/game/skier-save.ts";

const base = {
  hipRight: 0,
  hipAft: 0,
  lean: 0,
  steer: 0,
  crouch: 0,
  airborne: false,
  landing: 5,
};

const save = (kind: Save["kind"], t: number, side = 1, fore = 0): Save => ({
  kind,
  t,
  size: 1,
  side,
  fore,
});

/** The figure at the save's peak. */
const peak = (s: Save): SkierPose => skierPose({ ...base, jolt: joltOf({ ...s, t: 0.15 }) });

describe("the save as the figure makes it", () => {
  it("is nothing with no save, at its first instant and once it has played", () => {
    expect(joltOf(null)).toEqual(NO_JOLT);
    expect(joltEnvelope(0, 0.8)).toBe(0);
    expect(joltEnvelope(0.8, 0.8)).toBe(0);
    expect(joltEnvelope(0.2, 0.8)).toBeGreaterThan(0.5);
    for (const kind of ["landing", "tree", "body", "edge"] as const) {
      for (const k of JOLT_KEYS) expect(joltOf(save(kind, 5))[k], `${kind} ${k}`).toBe(0);
    }
  });

  it("sinks him onto his legs and flings both arms out for a hard landing", () => {
    const rest = skierPose(base);
    const hard = peak(save("landing", 0, 0, 1));
    expect(hard.hips.y).toBeLessThan(rest.hips.y - 0.08);
    // Thrown over the tips.
    expect(hard.pitch).toBeGreaterThan(rest.pitch + 0.3);
    for (const i of [0, 1]) {
      expect(Math.abs(hard.hands[i].x)).toBeGreaterThan(Math.abs(rest.hands[i].x) + 0.15);
      expect(hard.hands[i].y).toBeGreaterThan(rest.hands[i].y);
    }
  });

  it("knocks the shoulder a trunk hits back, and rocks him away from it", () => {
    const rest = skierPose(base);
    const right = peak(save("tree", 0, 1));
    // The right shoulder goes back past the left, and the trunk leans left.
    expect(right.shoulders[1].z).toBeLessThan(right.shoulders[0].z - 0.1);
    expect(right.roll).toBeLessThan(rest.roll - 0.15);
    // The far arm is thrown out.
    expect(right.hands[0].x).toBeLessThan(rest.hands[0].x - 0.2);
    const left = peak(save("tree", 0, -1));
    expect(left.shoulders[0].z).toBeLessThan(left.shoulders[1].z - 0.1);
  });

  it("puts a hand down to the snow on the side he went down on", () => {
    const rest = skierPose(base);
    const down = peak(save("body", 0, 1));
    expect(down.hands[1].y).toBeLessThan(rest.hands[1].y - 0.4);
    expect(down.hands[1].x).toBeGreaterThan(rest.hands[1].x);
    expect(down.roll).toBeGreaterThan(rest.roll + 0.15);
  });

  it("comes on and goes as a motion: no joint jumps between frames, even cut short", () => {
    const s = createSkierSpring();
    const ride = { edge: 0, speed: 15, crouch: 0, drive: 0, hipRight: 0, roll: 0 };
    stepSkierSpring(s, 0, false, 1 / 60, 0, { ...ride, save: null });
    let last: SkierPose | null = null;
    let worst = 0;
    const dt = 1 / 120;
    for (let i = 0; i < 240; i++) {
      const t = i * dt;
      // A landing, cut short by a trunk on the other side.
      const now = t < 0.3 ? save("landing", t, 1, 1) : save("tree", t - 0.3, -1);
      stepSkierSpring(s, 0, false, dt, 0, { ...ride, save: now });
      const pose = skierPose({ ...base, jolt: s.jolt });
      if (last) {
        for (const key of ["hips", "head", "neck"] as const) {
          const a = pose[key];
          const b = last[key];
          worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
        }
        for (const i of [0, 1]) {
          const a = pose.hands[i];
          const b = last.hands[i];
          worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
        }
      }
      last = pose;
    }
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThan(0.03);
  });
});

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLALOM START CLIP (`pwa/src/game/slalom-start.ts`): the held crouch,
// the fall out over the wand, the kick in the feet and the settle — keyed by
// the engine's own clock of the launch, the same for every racer — and the
// start shot's move off the roof down behind him (`camera-start.ts`).

import { describe, expect, it } from "vitest";

import { settleShot } from "../pwa/src/game/camera-start.ts";
import { emptyStand } from "../pwa/src/game/ski-stand.ts";
import { SLALOM_KICK, SLALOM_START, kickStand, slalomStart } from "../pwa/src/game/slalom-start.ts";

describe("the slalom start clip", () => {
  it("holds the crouch, weight back, while he waits in the house", () => {
    const held = slalomStart(true, -1);
    expect(held?.weight).toBe(1);
    expect(held?.shape.back).toBeGreaterThan(0);
    expect(slalomStart(false, -1)).toBeNull();
  });

  it("throws the chest out over the wand and lets go of the pose once out", () => {
    const fall = slalomStart(false, SLALOM_START.times.fall);
    expect(fall?.shape.back).toBeLessThan(0);
    expect(fall!.shape.pitch).toBeGreaterThan(SLALOM_START.held.pitch);
    const late = slalomStart(false, (SLALOM_START.times.kick + SLALOM_START.times.settle) / 2);
    expect(late!.weight).toBeGreaterThan(0);
    expect(late!.weight).toBeLessThan(1);
    expect(slalomStart(false, SLALOM_START.times.settle)).toBeNull();
  });

  it("kicks the heels back and up, then fires the skis forward together", () => {
    const top = emptyStand();
    kickStand(top, SLALOM_KICK.top);
    expect(top.pitch[0]).toBeCloseTo(SLALOM_KICK.heel);
    expect(top.pitch[1]).toBe(top.pitch[0]);
    expect(top.lift[0]).toBeGreaterThan(0);
    expect(top.fore[0]).toBeLessThan(0);
    const through = emptyStand();
    kickStand(through, SLALOM_START.times.kick);
    expect(through.fore[0]).toBeGreaterThan(0);
    for (const t of [-1, 0, SLALOM_KICK.down]) {
      const still = emptyStand();
      kickStand(still, t);
      expect(still).toEqual(emptyStand());
    }
  });
});

describe("the start shot's move", () => {
  // The two shots as `start-house-plan.ts` places them: over the door
  // looking down on his skis, and behind him looking out down the course.
  const over = { lens: { x: 0.4, y: 2.75, z: -0.45 }, aim: { x: 0, y: 0.15, z: 0.35 } };
  const behind = { lens: { x: 0, y: 1.7, z: -2.1 }, aim: { x: 0, y: 0.5, z: 12 } };
  const close = (a: { x: number; y: number; z: number }, b: typeof a): void => {
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
    expect(a.z).toBeCloseTo(b.z, 6);
  };
  const look = (s: typeof over): { x: number; y: number; z: number } => {
    const d = { x: s.aim.x - s.lens.x, y: s.aim.y - s.lens.y, z: s.aim.z - s.lens.z };
    const r = Math.hypot(d.x, d.y, d.z);
    return { x: d.x / r, y: d.y / r, z: d.z / r };
  };

  it("starts on the overhead shot and settles on the shot from behind", () => {
    close(settleShot(over, behind, 0).lens, over.lens);
    close(settleShot(over, behind, 0).aim, over.aim);
    close(settleShot(over, behind, 1).lens, behind.lens);
    close(settleShot(over, behind, 1).aim, behind.aim);
  });

  it("moves the lens and turns its look a little a frame — never a cut", () => {
    const frames = 84; // the move's 1.4 s at sixty frames a second
    let was = settleShot(over, behind, 0);
    for (let i = 1; i <= frames; i++) {
      const now = settleShot(over, behind, i / frames);
      const a = look(was);
      const b = look(now);
      const turn = Math.acos(Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
      expect(turn).toBeLessThan(0.05);
      const step = Math.hypot(
        now.lens.x - was.lens.x,
        now.lens.y - was.lens.y,
        now.lens.z - was.lens.z,
      );
      expect(step).toBeLessThan(0.1);
      was = now;
    }
  });
});

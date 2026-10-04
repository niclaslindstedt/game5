// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SLALOM START CLIP (`pwa/src/game/slalom-start.ts`): the held crouch,
// the fall out over the wand, the kick in the feet and the settle — keyed by
// the engine's own clock of the launch, the same for every racer.

import { describe, expect, it } from "vitest";

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

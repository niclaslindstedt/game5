// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT GETS DOWN: on the synthetic slope, and on generated maps. What the
// harness reports is held to the run's own shape — every gate credited, the
// finish reached — and to a pace floor, so a skier or a bot that quietly
// stopped racing fails here rather than in the table.

import { describe, expect, it } from "vitest";

import { generateLevel, simulateRun } from "@engine";
import { syntheticLevel } from "./support/synthetic.ts";

describe("the bot on the synthetic slope", () => {
  it("finishes the run with no reset and no tree hit", () => {
    const r = simulateRun(1, { level: syntheticLevel() });
    expect(r.finished).toBe(true);
    expect(r.laps).toBe(1);
    expect(r.lapTimes).toHaveLength(1);
    expect(r.checkpoints).toBe(r.crossings);
    expect(r.resets).toBe(0);
    expect(r.treeHits).toBe(0);
    expect(r.wipeouts).toBe(0);
    expect(r.meanSpeed * 3.6).toBeGreaterThan(45);
    expect(r.jumps).toBeGreaterThanOrEqual(1);
  });
});

describe("the bot on generated maps", () => {
  for (const seed of [1, 2, 3]) {
    it(`finishes seed ${seed}`, () => {
      const level = generateLevel(seed);
      const r = simulateRun(seed, { level });
      expect(r.finished).toBe(true);
      expect(r.checkpoints).toBe(r.crossings);
      expect(r.meanSpeed * 3.6).toBeGreaterThan(35);
      expect(r.autoResets).toBeLessThanOrEqual(1);
      // A clean run never comes near a wipeout's thresholds (`TUNING.crash`).
      expect(r.wipeouts).toBe(0);
    });
  }

  it("gets down in a storm, the gale in its face on the traverses and all", () => {
    // Seed 5's storm blows up a long traverse: the bot crawls it into the
    // wind at a skater's pace, and must neither stall nor give up on it.
    const r = simulateRun(5, { weather: "storm" });
    expect(r.finished).toBe(true);
    expect(r.checkpoints).toBe(r.crossings);
    expect(r.resets).toBe(0);
    expect(r.wipeouts).toBe(0);
  });

  it("races a field and finishes on the podium or behind it, never lost", () => {
    const r = simulateRun(2, { rivals: 3 });
    expect(r.finished).toBe(true);
    expect(r.place).toBeGreaterThanOrEqual(1);
    expect(r.place).toBeLessThanOrEqual(4);
  });
});

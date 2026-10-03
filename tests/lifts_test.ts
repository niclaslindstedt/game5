// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFTS AS PLANNED (`engine/game/lift-line.ts`): every tower stands on
// the snow under its rope, the towers are a class's span apart, and the
// rope hangs clear of the snow between them by what its carriers need —
// on the resort the generator builds, and on a hand-built crest a straight
// rope would meet.

import { describe, expect, it } from "vitest";

import { LIFT_LOOK, planLift, ropeAt, type Lift } from "@engine";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";
import { syntheticLevel } from "./support/synthetic.ts";

describe("a lift's plan", () => {
  const level = levelFor(LEVEL_SEEDS[0]);
  const lifts = level.resort?.lifts ?? [];

  it("plans every lift of the resort from station to station", () => {
    expect(lifts.length).toBeGreaterThan(0);
    for (const lift of lifts) {
      const plan = planLift(level, lift);
      const s = plan.supports;
      expect(s[0].station).toBe(true);
      expect(s[s.length - 1].station).toBe(true);
      expect(s[0].u).toBe(0);
      expect(s[s.length - 1].u).toBeCloseTo(plan.length, 6);
      for (let i = 1; i < s.length; i++) expect(s[i].u).toBeGreaterThan(s[i - 1].u);
    }
  });

  it("stands every tower on the snow, a class's span apart", () => {
    for (const lift of lifts) {
      const plan = planLift(level, lift);
      for (const s of plan.supports) {
        expect(s.ground).toBeCloseTo(level.groundAt(s.x, s.z), 6);
        expect(s.rope).toBeGreaterThan(0);
      }
      for (let i = 1; i < plan.supports.length; i++) {
        const span = plan.supports[i].u - plan.supports[i - 1].u;
        expect(span).toBeLessThanOrEqual(plan.look.spacing * 1.5 + 24);
      }
    }
  });

  it("hangs the rope clear of the snow out on the line", () => {
    for (const lift of lifts) {
      const plan = planLift(level, lift);
      const need = plan.look.hang + 0.5;
      for (let u = 40; u < plan.length - 40; u += 5) {
        const x = lift.bottom.x + plan.dx * u;
        const z = lift.bottom.z + plan.dz * u;
        expect(ropeAt(plan, u) - level.groundAt(x, z)).toBeGreaterThan(need);
      }
    }
  });

  it("puts a tower under a crest a straight rope would meet", () => {
    // Straight down the synthetic slope over its kicker and its rollers.
    const slope = syntheticLevel();
    const lift: Lift = {
      id: "T",
      kind: "chair",
      bottom: { x: 640, y: slope.groundAt(640, 1050), z: 1050 },
      top: { x: 640, y: slope.groundAt(640, 60), z: 60 },
    };
    const plan = planLift(slope, lift);
    expect(plan.supports.length).toBeGreaterThanOrEqual(
      Math.round(plan.length / LIFT_LOOK.chair.spacing),
    );
    for (let u = 40; u < plan.length - 40; u += 4) {
      const x = lift.bottom.x + plan.dx * u;
      const z = lift.bottom.z + plan.dz * u;
      expect(ropeAt(plan, u) - slope.groundAt(x, z)).toBeGreaterThan(LIFT_LOOK.chair.hang);
    }
  });
});

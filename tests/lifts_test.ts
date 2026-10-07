// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFTS AS PLANNED (`engine/game/lift-line.ts`): every tower stands on
// the snow under its rope, the towers are a class's span apart, and the
// rope hangs clear of the snow between them by what its carriers need —
// on the resort the generator builds, and on a hand-built crest a straight
// rope would meet.

import { describe, expect, it } from "vitest";

import {
  LIFT_LOOK,
  TOWER_SITE,
  liftPlans,
  pisteGap,
  planLift,
  ropeAt,
  ropeShortfall,
  type Lift,
} from "@engine";
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
        const a = plan.supports[i - 1];
        const b = plan.supports[i];
        const span = b.u - a.u;
        expect(span).toBeLessThanOrEqual(plan.look.spacing * TOWER_SITE.span + TOWER_SITE.slide);
        if (span <= plan.look.spacing * 1.5 + 24) continue;
        // Longer only where the line spans a run.
        let crosses = false;
        for (let t = 0.05; t < 1 && !crosses; t += 0.05) {
          crosses = pisteGap(level, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t) < 0;
        }
        expect(crosses, `${lift.id} ${a.u}–${b.u}`).toBe(true);
      }
    }
  });

  it("stands its towers off the runs, and pads any left on or beside one", () => {
    let towers = 0;
    let on = 0;
    for (const seed of LEVEL_SEEDS) {
      const map = levelFor(seed);
      for (const plan of liftPlans(map)) {
        for (const s of plan.supports) {
          if (s.station) continue;
          towers++;
          const gap = pisteGap(map, s.x, s.z) - plan.look.column;
          if (gap < 0) on++;
          // Padded exactly where it stands near a run's edge.
          expect(s.pad === true, `${seed} ${plan.lift.id} ${s.u}`).toBe(gap < TOWER_SITE.pad);
        }
      }
    }
    // A line run down a run too long to span is all that leaves one there.
    expect(on / towers).toBeLessThan(0.02);
  });

  it("hangs every carrier clear of the snow to the wheels, as R26's check asks of the ruled rope", () => {
    for (const seed of LEVEL_SEEDS) {
      const map = levelFor(seed);
      for (const plan of liftPlans(map)) {
        expect(ropeShortfall(map, plan).lack, `${seed} ${plan.lift.id}`).toBeLessThan(0.25);
      }
    }
  });

  it("brings the rope DOWN into a top from its last tower, over the terminal's rail", () => {
    for (const lift of lifts) {
      if (lift.kind === "drag") continue;
      const plan = planLift(level, lift);
      const s = plan.supports;
      const last = s[s.length - 2];
      const wheel = s[s.length - 1];
      // Past the pad's rim, and above the wheel by the fall into it — or
      // as tall as a tower goes where the mountain climbs too steeply to it.
      expect(plan.length - last.u).toBeGreaterThanOrEqual(plan.look.in.back);
      const fall = last.ground + last.rope - (wheel.ground + wheel.rope);
      if (last.rope < plan.look.towerMax)
        expect(fall).toBeGreaterThanOrEqual((plan.length - last.u) * plan.look.in.fall - 1e-9);
      expect(fall).toBeGreaterThan(0);
      // Level at the wheel's height along the rail.
      for (let b = 0; b <= plan.look.rail; b += 2) {
        expect(ropeAt(plan, plan.length - b)).toBeCloseTo(wheel.ground + wheel.rope, 6);
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

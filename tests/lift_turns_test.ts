// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ROUND THE WHEELS (`engine/game/lift-line.ts`'s `carrierAt`,
// `carrierPlace`; `carrier-swing.ts`'s `carrierRollAt`): every carrier of
// every lift runs the half circle about each station's bullwheel — never
// cut across from one rope to the other — at the speed it has there (a
// detachable's creep on the station's rail, a drag's rope speed), its way
// turning smoothly with the circle, and leans out of the turn as a hung
// carrier does.

import { describe, expect, it } from "vitest";

import {
  carrierAt,
  carrierCount,
  carrierLoop,
  carrierPlace,
  carrierRollAt,
  HOUSE_CLEAR,
  liftPlans,
  stationHouses,
  turnRadius,
  type LiftPlan,
} from "@engine";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const FPS = 60;

/** The world step a carrier makes between two frames, and its turn. */
function walk(plan: LiftPlan, k: number, from: number, seconds: number) {
  const steps: { d: number; turn: number; inTurn: boolean }[] = [];
  let last = carrierPlace(plan, carrierAt(plan, k, from));
  for (let i = 1; i <= seconds * FPS; i++) {
    const c = carrierAt(plan, k, from + i / FPS);
    const p = carrierPlace(plan, c);
    let turn = p.heading - last.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    steps.push({ d: Math.hypot(p.x - last.x, p.z - last.z), turn, inTurn: c.turn !== undefined });
    last = p;
  }
  return steps;
}

describe("the carriers round a lift's wheels", () => {
  const level = levelFor(LEVEL_SEEDS[0]);
  const plans = liftPlans(level);

  it("has a lift of every kind to hold", () => {
    const kinds = new Set(plans.map((p) => p.lift.kind));
    expect(kinds.has("chair")).toBe(true);
    expect(kinds.has("drag")).toBe(true);
  });

  it("runs every carrier the whole loop with no jump and no snap of its way", () => {
    for (const plan of plans) {
      // Once round the loop, from carrier 0's start: the rope's time and
      // what the creep through four terminals adds.
      const steps = walk(plan, 0, 0, carrierLoop(plan) / plan.look.speed + 400);
      const fastest = plan.look.speed / FPS;
      const turnMost = Math.max(plan.look.slow, plan.look.speed) / turnRadius(plan) / FPS;
      let turned = 0;
      for (const s of steps) {
        expect(s.d).toBeLessThan(fastest * 1.05 + 1e-3);
        expect(Math.abs(s.turn)).toBeLessThan(turnMost * 1.2 + 1e-3);
        if (s.inTurn) turned += s.turn;
      }
      // Both half circles were run: a whole turn of the way, to the left.
      expect(turned).toBeLessThan(-2 * Math.PI * 0.9);
    }
  });

  it("creeps a detachable's carriers round at the terminal's speed and a drag's at the rope's", () => {
    for (const plan of plans) {
      const want = plan.look.slow < plan.look.speed ? plan.look.slow : plan.look.speed;
      for (let k = 0; k < Math.min(8, carrierCount(plan)); k++) {
        const steps = walk(plan, k, 0, 120).filter((s) => s.inTurn);
        for (const s of steps.slice(1, -1)) expect(s.d * FPS).toBeCloseTo(want, 1);
      }
    }
  });

  it("goes round the back of each wheel, short of its house", () => {
    for (const plan of plans) {
      const r = turnRadius(plan);
      const bottom = carrierPlace(plan, { u: 0, side: 1, turn: Math.PI / 2 });
      const top = carrierPlace(plan, { u: plan.length, side: 0, turn: Math.PI / 2 });
      expect(bottom.along).toBeCloseTo(-r, 6);
      expect(top.along).toBeCloseTo(plan.length + r, 6);
      // The house behind a foot's wheel (and a gondola's or a drag's top)
      // stands past where the carriers swing round it.
      const [foot] = stationHouses(level, plan);
      const front =
        (foot.x - plan.lift.bottom.x) * plan.dx +
        (foot.z - plan.lift.bottom.z) * plan.dz +
        foot.halfLength;
      expect(front).toBeLessThan(-r - 0.5);
      expect(-front).toBeCloseTo(HOUSE_CLEAR[plan.lift.kind], 6);
    }
  });

  it("leans a hung carrier out of the turn, eased in and out, and never off a wheel", () => {
    for (const plan of plans) {
      expect(carrierRollAt(plan, undefined)).toBe(0);
      expect(carrierRollAt(plan, 0)).toBeCloseTo(0, 9);
      expect(carrierRollAt(plan, Math.PI)).toBeCloseTo(0, 9);
      const mid = carrierRollAt(plan, Math.PI / 2);
      // Both turns run to the left: the top leans in, left side down.
      expect(mid).toBeLessThan(0);
      expect(mid).toBeGreaterThan(-0.8);
    }
  });
});

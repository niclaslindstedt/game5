// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LOCALS' SIGN AT A SKI ROUTE (`route-sign-plan.ts`): one homemade board
// at the head of every orange route (R42), on the pad beside its corridor,
// turned to the rider coming off the lift and its hacked point aimed down
// the route; never square, never out of its measure.
import { describe, expect, it } from "vitest";

import { liftPlans, skiRoutesOf, trackPointAt } from "@engine";
import { AMATEUR, amateurSigns } from "../pwa/src/game/route-sign-plan.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const maps = () => LEVEL_SEEDS.slice(0, 3).map((seed) => levelFor(seed));

describe("the locals' sign at a ski route", () => {
  it("stands one at the head of every route and none on a map without", () => {
    let seen = 0;
    for (const level of maps()) {
      const routes = skiRoutesOf(level);
      const signs = amateurSigns(level);
      expect(signs.map((s) => s.route)).toEqual(routes.map((r) => r.id));
      seen += signs.length;
    }
    expect(seen).toBeGreaterThan(0);
  }, 240_000);

  it("stands outside the corridor, near its head, and points down the route", () => {
    for (const level of maps()) {
      for (const s of amateurSigns(level)) {
        const r = skiRoutesOf(level).find((q) => q.id === s.route)!;
        const head = r.points[0];
        const d = Math.hypot(s.x - head.x, s.z - head.z);
        expect(d).toBeGreaterThan(head.width / 2 + 1);
        expect(d).toBeLessThan(head.width / 2 + AMATEUR.aside + AMATEUR.back + 1);
        expect(s.y).toBeCloseTo(level.groundAt(s.x, s.z), 5);
        // The point on the side of the reader's view the route lies on.
        const to = trackPointAt(
          { track: { points: r.points, length: r.length } },
          Math.min(r.length, AMATEUR.aim),
        );
        const right = -(to.x - s.x) * Math.cos(s.heading) + (to.z - s.z) * Math.sin(s.heading);
        expect(s.point).toBe(right >= 0 ? "right" : "left");
        // Turned to the rider off the lift it leaves.
        const top = liftPlans(level).find((p) => p.lift.id === r.from)?.lift.top;
        if (top && Math.hypot(s.x - top.x, s.z - top.z) > 2) {
          const want = Math.atan2(s.x - top.x, s.z - top.z);
          expect(
            Math.abs(Math.atan2(Math.sin(s.heading - want), Math.cos(s.heading - want))),
          ).toBeLessThan(1e-6);
        }
      }
    }
  }, 240_000);

  it("is a hacked plank: within its measure, never square, its point the far end", () => {
    const hw = AMATEUR.board.width / 2;
    const hh = AMATEUR.board.height / 2;
    for (const level of maps()) {
      for (const s of amateurSigns(level)) {
        const xs = s.outline.map(([x]) => x);
        const ys = s.outline.map(([, y]) => y);
        expect(Math.min(...xs)).toBeGreaterThan(-hw - 0.05);
        expect(Math.max(...xs)).toBeLessThan(hw + AMATEUR.tip * 1.2 + 0.05);
        expect(Math.max(...xs)).toBeGreaterThan(hw + AMATEUR.tip * 0.6);
        for (const y of ys) expect(Math.abs(y)).toBeLessThanOrEqual(hh + 1e-9);
        expect(Math.abs(s.tilt)).toBeLessThanOrEqual(AMATEUR.tilt);
        expect(Math.abs(s.leanSide)).toBeLessThanOrEqual(AMATEUR.stick.lean);
        expect(Math.abs(s.boardY - AMATEUR.y)).toBeLessThanOrEqual(AMATEUR.yJitter);
      }
    }
  }, 240_000);

  it("has its words in the strings", () => {
    expect(STRINGS.skiRouteAmateur.length).toBeGreaterThan(0);
  });
});

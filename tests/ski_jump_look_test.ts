// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMPING HILL AS PLANNED FOR THE DRAWING (`ski-jump-plan.ts`):
// every piece of furniture stands where the hill the map publishes puts it
// — each distance board at the distance it reads, the P, K and HS lines at
// P, K and L, the tracks the skis' stance apart down the in-run's whole
// length to the edge, the gates inside the in-run, the judges' tower in the
// norm's band and clear of the landing hill, the boards, flags and masts
// outside the landing area's walls.

import { describe, expect, it } from "vitest";

import { ALBATROSS, SKI_JUMP_RULE, setSkiJump } from "@engine";
import { hillFrame, hillPoint } from "../pwa/src/game/ski-jump-frame.ts";
import {
  landingWidth,
  planOfDistance,
  skiJumpPlan,
  SJ_LOOK,
} from "../pwa/src/game/ski-jump-plan.ts";
import { levelFor } from "./support/levels.ts";

const level = setSkiJump(levelFor(1));
const plan = skiJumpPlan(level)!;
const hill = level.skiJump!;
const N = SKI_JUMP_RULE.norm;

describe("the ski jumping hill's plan", () => {
  it("is null on a map with no hill, and kept per map", () => {
    expect(skiJumpPlan(levelFor(1))).toBeNull();
    expect(skiJumpPlan(level)).toBe(plan);
  });

  it("stands its frame on the hill's own line", () => {
    const f = hillFrame(level)!;
    const edge = hillPoint(f, hill.edge);
    const kicker = (level.kickers ?? []).find((k) => k.id === "SJ")!;
    expect(edge.x).toBeCloseTo(kicker.x, 3);
    expect(edge.z).toBeCloseTo(kicker.z, 3);
    expect(edge.y).toBeCloseTo(kicker.y, 3);
  });

  it("reads a distance back to the place it is credited at", () => {
    for (const dist of [40, 63, 100, hill.w, hill.hs, 150]) {
      expect(hill.distanceAt(planOfDistance(hill, dist))).toBeCloseTo(dist, 2);
    }
  });

  it("stands every board at the distance it reads, both sides, every metre", () => {
    expect(plan.boards.length).toBeGreaterThan(100);
    for (const b of plan.boards) {
      expect(hill.distanceAt(b.d)).toBeCloseTo(b.distance, 2);
      expect(b.tick).toBe(b.distance % SJ_LOOK.board.every !== 0);
    }
    const numbered = plan.boards.filter((b) => !b.tick).map((b) => b.distance);
    expect(Math.min(...numbered)).toBeLessThanOrEqual(hill.w / 2 + SJ_LOOK.board.every);
    expect(Math.max(...numbered)).toBeGreaterThanOrEqual(hill.hs);
  });

  it("draws the P, K and HS lines at P, K and L, and the fall line at the finish", () => {
    const at = (kind: string) => plan.lines.find((l) => l.kind === kind)!.d;
    expect(at("p")).toBe(hill.p);
    expect(at("k")).toBe(hill.k);
    expect(hill.distanceAt(at("k"))).toBeCloseTo(hill.w, 1);
    expect(hill.distanceAt(at("hs"))).toBeCloseTo(hill.hs, 0);
    expect(at("fall")).toBe(hill.to);
    expect(plan.bands.blue).toEqual([hill.p, hill.k]);
    expect(plan.bands.red).toEqual([hill.k, hill.l]);
  });

  it("lays the tracks the skis' stance apart, down the in-run to the edge", () => {
    expect(plan.inRun.to).toBe(hill.edge);
    expect(2 * plan.inRun.track).toBeCloseTo(ALBATROSS.stance, 6);
    expect(plan.inRun.groove).toBeGreaterThan(ALBATROSS.tipWidth / 2);
    expect(plan.inRun.track + plan.inRun.groove).toBeLessThan(plan.inRun.half);
    expect(2 * plan.inRun.half).toBe(N.widths.inRun);
    // The groove's floor is the profile the engine guides him down, to a
    // few centimetres.
    expect(Math.abs(SJ_LOOK.track.over)).toBeLessThan(0.05);
  });

  it("puts every gate inside the in-run, the lowest first", () => {
    expect(plan.gates.length).toBe(hill.gates.length);
    plan.gates.forEach((g, i) => {
      expect(g.d).toBeGreaterThan(plan.inRun.from);
      expect(g.d).toBeLessThan(plan.inRun.to);
      expect(g.number).toBe(i + 1);
      if (i > 0) expect(g.d).toBeLessThan(plan.gates[i - 1].d);
    });
  });

  it("stands the judges' tower in the norm's band, clear of the landing hill", () => {
    for (const d of plan.judges.d) {
      const dist = hill.distanceAt(d);
      expect(dist).toBeGreaterThan(N.tower.from * hill.w - 4);
      expect(dist).toBeLessThan(N.tower.to * hill.w + 4);
      expect(plan.judges.off - SJ_LOOK.judges.deep / 2).toBeGreaterThan(landingWidth(hill, d) / 2);
    }
    expect(plan.judges.off).toBeGreaterThanOrEqual(N.tower.off[0] * hill.w);
    expect(plan.judges.off).toBeLessThanOrEqual(N.tower.off[1] * hill.w);
  });

  it("keeps the boards, flags and masts outside the landing area's walls", () => {
    const f = plan.frame;
    for (const m of plan.masts) {
      const d = (m.x - f.x) * f.fx + (m.z - f.z) * f.fz;
      const a = (m.x - f.x) * f.rx + (m.z - f.z) * f.rz;
      expect(Math.abs(a)).toBeGreaterThan(landingWidth(hill, d) / 2 + 2);
      expect(m.lamps.length).toBeGreaterThan(0);
    }
    expect(SJ_LOOK.board.out).toBeGreaterThan(0);
    expect(SJ_LOOK.flag.out).toBeGreaterThan(0);
    for (const fl of plan.flags) expect(fl.d).toBeLessThanOrEqual(hill.k + 1e-9);
  });

  it("widens the landing area from the knoll's foot to U as the norm has it", () => {
    expect(landingWidth(hill, hill.k)).toBeCloseTo(N.widths.k * hill.w, 6);
    expect(landingWidth(hill, hill.u)).toBeCloseTo(N.widths.u * hill.w, 6);
    expect(landingWidth(hill, hill.edge + 1)).toBeLessThan(landingWidth(hill, hill.k));
    expect(landingWidth(hill, hill.u)).toBeLessThanOrEqual(hill.width);
  });
});

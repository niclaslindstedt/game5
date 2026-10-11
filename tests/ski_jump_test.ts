// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SKI JUMPING (R43): the hill built to the construction norm — every element
// of the profile against the norm's own formulas (h, n, the slopes at the
// knoll's foot, P, K and L, the radii, the table, the in-run's lengths, the
// out-run), the distance credited along the profile, the gates and the
// speed a point mass carries off the edge from them — and the hill graded
// into a built map; the pair, the build and the mode.

import { describe, expect, it } from "vitest";

import {
  ALBATROSS,
  FREESTYLE,
  MODE_RULES,
  SKI_JUMP,
  SKI_JUMP_RULE,
  createGame,
  designGate,
  edgeSpeed,
  hillOf,
  jumpDistanceAt,
  measuredDistance,
  raceRiderOf,
  raceSkisOf,
  setSkiJump,
  skiJumpHeightAt,
  skiJumpProfile,
  skisById,
} from "@engine";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const R = SKI_JUMP_RULE;
const DEG = 180 / Math.PI;

describe("the hill's elements off the norm (R43)", () => {
  it("the large hill: HS 140, K 126 and the elements the spec's arithmetic gives", () => {
    const el = hillOf(R.hills.large);
    expect(el.h).toBeCloseTo(62.9, 1);
    expect(el.n).toBeCloseTo(108.45, 1);
    expect(el.h / el.n).toBeCloseTo(0.58, 6);
    expect(el.landing).toBeCloseTo(30.26, 2);
    expect(el.rL).toBe(300);
    expect(el.r1).toBeCloseTo(103.2, 1);
    expect(el.t).toBeCloseTo(6.79, 2);
    expect(el.s).toBeCloseTo(3.15, 2);
    expect(el.slopeP * DEG).toBeCloseTo(37.0, 6);
    expect(el.slopeFoot * DEG).toBeCloseTo(6.17, 2);
    expect(el.slopeL * DEG).toBeCloseTo(31.25, 2);
    expect(el.e1).toBeCloseTo(98.8, 1);
    expect(el.e2).toBeCloseTo(80.6, 1);
    expect(el.a).toBeCloseTo(82.6, 1);
    expect(el.l1).toBeCloseTo(16.2, 1);
    expect(el.l2).toBeCloseTo(13.9, 1);
  });

  it("the normal hill: HS 106, K 95.4", () => {
    const el = hillOf(R.hills.normal);
    expect(el.h).toBeCloseTo(45.7, 1);
    expect(el.n).toBeCloseTo(83.2, 1);
    expect(el.rL).toBe(210);
    expect(el.r1).toBeCloseTo(91.4, 1);
    expect(el.e1).toBeCloseTo(84.4, 1);
    expect(el.e2).toBeCloseTo(69.3, 1);
    expect(el.slopeL * DEG).toBeCloseTo(31.25, 1);
  });

  it("every hill's choices inside the norm's bands", () => {
    for (const row of Object.values(R.hills)) {
      // HS = w / 0.9; the table w/30 + 6.9 … w/30 + 7.9; the steepness
      // w/800 + 0.400 … w/1000 + 0.480; the in-run at most 37°.
      expect(row.w / row.hs).toBeCloseTo(0.9, 2);
      expect(row.table).toBeGreaterThanOrEqual(row.w / 30 + 6.9 - 1e-9);
      expect(row.table).toBeLessThanOrEqual(row.w / 30 + 7.9);
      expect(row.steepness).toBeGreaterThanOrEqual(row.w / 800 + 0.4);
      expect(row.steepness).toBeLessThanOrEqual(row.w / 1000 + 0.48);
      expect(row.inRun).toBeLessThanOrEqual(37);
      const el = hillOf(row);
      // The steepest point never past 37°; the transition at the table
      // loading at most 0.7 g; the landing transition's radius inside
      // the norm's floor (1.8 g at the speed landing there) and r_L.
      expect(el.slopeP * DEG).toBeLessThanOrEqual(37 + 1e-9);
      expect((row.speed * row.speed) / el.r1).toBeLessThan(0.7 * 9.81);
      const floor = el.landing ** 2 / (18 - 10 * Math.cos(el.slopeL));
      expect(row.r2l).toBeGreaterThanOrEqual(floor);
      expect(row.r2l).toBeLessThanOrEqual(el.rL);
    }
  });
});

describe("the hill's profile (R43)", () => {
  for (const hill of ["large", "normal"] as const) {
    const p = skiJumpProfile(hill);
    const el = p.elements;
    const slope = (x: number): number =>
      Math.atan2(skiJumpHeightAt(p, x - 0.05) - skiJumpHeightAt(p, x + 0.05), 0.1) * DEG;

    it(`${hill}: K h below and n out from the edge, P and L on the landing radius`, () => {
      expect(p.k - p.edge).toBeCloseTo(el.n, 6);
      expect(skiJumpHeightAt(p, p.edge)).toBeCloseTo(0, 6);
      expect(skiJumpHeightAt(p, p.k)).toBeCloseTo(-el.h, 2);
      expect(slope(p.k)).toBeCloseTo(el.slope * DEG, 1);
      expect(Math.abs(slope(p.p) - el.slopeP * DEG)).toBeLessThan(0.05);
      expect(Math.abs(slope(p.l) - el.slopeL * DEG)).toBeLessThan(0.05);
    });

    it(`${hill}: the table at its angle, the wall under the edge, the knoll leaving at β₀`, () => {
      expect(slope(p.edge - 2)).toBeCloseTo(R.hills[hill].table, 2);
      expect(p.edge - p.table).toBeGreaterThan(el.t * Math.cos(el.table) - 0.1);
      expect(skiJumpHeightAt(p, p.edge + p.dx)).toBeLessThan(-el.s + 0.1);
      expect(Math.abs(slope(p.edge + 0.3) - el.slopeFoot * DEG)).toBeLessThan(0.5);
      // The knoll steepens all the way to P: never flatter than behind.
      let prev = 0;
      for (let x = p.edge + 0.2; x < p.p; x += 0.5) {
        const a = slope(x);
        expect(a).toBeGreaterThanOrEqual(prev - 1e-6);
        prev = a;
      }
    });

    it(`${hill}: the in-run at its angle at the top gate, the curve to the table`, () => {
      const top = p.gates[p.gates.length - 1];
      expect(slope(top.x)).toBeCloseTo(R.hills[hill].inRun, 1);
      expect(top.e).toBeCloseTo(el.e1, 6);
      expect(p.gates[0].e).toBeCloseTo(el.e2, 6);
      for (let i = 1; i < p.gates.length; i++) {
        expect(p.gates[i].y - p.gates[i - 1].y).toBeLessThanOrEqual(R.gateHeight + 1e-9);
        expect(p.gates[i].y).toBeGreaterThan(p.gates[i - 1].y);
      }
      // The curve turns 35° to the table's angle and never climbs.
      for (let x = p.curve; x < p.table; x += 1)
        expect(slope(x)).toBeGreaterThan(R.hills[hill].table - 0.1);
    });

    it(`${hill}: onto the level out-run at U, no more than 88 m below the edge`, () => {
      expect(slope(p.u + 1)).toBeCloseTo(0, 3);
      expect(-skiJumpHeightAt(p, p.u)).toBeLessThanOrEqual(88);
      expect(p.outrun - p.u).toBeCloseTo(el.a, 6);
      expect(p.finish).toBeGreaterThan(p.u);
      expect(p.finish).toBeLessThan(p.outrun);
      // Never rising anywhere from the deck to the end.
      for (let i = 1; i < p.y.length; i++) expect(p.y[i]).toBeLessThanOrEqual(p.y[i - 1] + 1e-9);
    });

    it(`${hill}: the distance credited reads K at w and L near HS`, () => {
      expect(jumpDistanceAt(p, p.k)).toBeCloseTo(el.w, 6);
      expect(Math.abs(jumpDistanceAt(p, p.l) - el.hs)).toBeLessThan(0.6);
      expect(jumpDistanceAt(p, p.p)).toBeCloseTo(el.w - el.l1, 0);
      expect(jumpDistanceAt(p, p.edge - 5)).toBe(0);
      expect(measuredDistance(125.74)).toBe(125.5);
      expect(measuredDistance(126)).toBe(126);
    });

    it(`${hill}: a point mass off the top gate past the design speed, off the lowest short of it`, () => {
      const top = edgeSpeed(p, p.gates.length - 1);
      const low = edgeSpeed(p, 0);
      expect(top).toBeGreaterThanOrEqual(el.speed);
      expect(low).toBeLessThan(el.speed - 1);
      const g = designGate(p);
      expect(edgeSpeed(p, g)).toBeGreaterThanOrEqual(el.speed);
      if (g > 0) expect(edgeSpeed(p, g - 1)).toBeLessThan(el.speed);
      // A head wind down the in-run slows him; each gate higher is faster.
      expect(edgeSpeed(p, g, 3)).toBeLessThan(edgeSpeed(p, g));
      expect(edgeSpeed(p, g + 1 < p.gates.length ? g + 1 : g)).toBeGreaterThanOrEqual(
        edgeSpeed(p, g),
      );
    });
  }

  it("the large hill's design speed comes off a gate in the upper half", () => {
    const p = skiJumpProfile("large");
    expect(designGate(p)).toBeGreaterThan(p.gates.length / 2);
  });
});

describe("the hill graded into a built map", () => {
  for (const seed of LEVEL_SEEDS.slice(0, 2)) {
    it(`seed ${seed}: the start gate on the top gate, the finish on the fall line, the take-off a kicker`, () => {
      const base = levelFor(seed);
      const level = setSkiJump(base);
      const hill = level.skiJump!;
      const p = skiJumpProfile("large");
      expect(hill.base).toBe(base);
      expect(level.checkpoints).toHaveLength(2);
      expect(level.checkpoints[0].s).toBeCloseTo(hill.gates[hill.gates.length - 1].x, 6);
      expect(level.checkpoints[1].s).toBeCloseTo(p.finish, 6);
      expect(level.kickers?.some((k) => k.id === "SJ")).toBe(true);
      expect(hill.vertical).toBeGreaterThan(120);
      // The ground IS the profile down the line, inside the hill's width.
      const head = level.track.points[0].heading;
      const fx = Math.sin(head);
      const fz = Math.cos(head);
      const x0 = level.track.points[0].x;
      const z0 = level.track.points[0].z;
      for (const d of [hill.from, hill.edge - 1, hill.k, hill.u, hill.to]) {
        expect(level.groundAt(x0 + fx * d, z0 + fz * d)).toBeCloseTo(hill.yAt(d), 4);
        // ...and a few metres off the axis too.
        expect(level.groundAt(x0 + fx * d + fz * 8, z0 + fz * d - fx * 8)).toBeCloseTo(
          hill.yAt(d),
          4,
        );
      }
      // The spawn stands on the top gate; no tree stands on the hill.
      expect(level.spawn.x).toBeCloseTo(x0 + fx * hill.from, 6);
      for (const t of level.trees) {
        const along = (t.x - x0) * fx + (t.z - z0) * fz;
        const across = Math.abs((t.x - x0) * fz - (t.z - z0) * fx);
        if (along > 0 && along < hill.to) expect(across).toBeGreaterThan(hill.width / 2);
      }
    });
  }

  it("is the same map asked twice, and another for the normal hill", () => {
    expect(setSkiJump(levelFor(1))).toBe(setSkiJump(levelFor(1)));
    expect(setSkiJump(levelFor(1), "normal")).not.toBe(setSkiJump(levelFor(1)));
    expect(setSkiJump(levelFor(1), "normal").skiJump?.hs).toBe(106);
  });
});

describe("the pair, the build and the mode", () => {
  it("the Albatross is a jumping ski inside the class's rule", () => {
    const a = skisById("albatross");
    expect(a).toBe(ALBATROSS);
    // At most 145 % of a 1.78 m jumper, less for a BMI of 20.5.
    expect(a.length).toBeLessThanOrEqual(1.78 * 1.45);
    expect(a.length).toBeGreaterThan(2.45);
    // 95–105 mm at the balance point, the tip and tail within 5 mm.
    expect(a.waist).toBeGreaterThanOrEqual(0.095);
    expect(a.waist).toBeLessThanOrEqual(0.105);
    expect(Math.abs(a.tipWidth - a.tailWidth)).toBeLessThanOrEqual(0.005 + 1e-9);
    // No more than 57 % of it ahead of the boot's toe.
    expect(a.mount).toBeLessThan(0.5);
    expect(raceSkisOf("skiJump")).toBe("albatross");
    expect(raceRiderOf("skiJump")).toBe("light");
  });

  it("is the tricks card's first format, one jumper at the real g", () => {
    expect(FREESTYLE[0]).toEqual({ id: "skiJump", mode: "skiJump" });
    const r = MODE_RULES.skiJump(1);
    expect(r.rivals).toBe(0);
    expect(r.airGravity).toBe(1);
    expect(r.stunts).toBe(false);
    expect(r.gates).toBe("strict");
    expect(r.skiJump).toBe(true);
    expect(r.window).toBe(SKI_JUMP.window);
  });

  it("stands the jumper on the top gate of the in-run", () => {
    const state = createGame({ level: levelFor(1), mode: "skiJump", spec: ALBATROSS });
    const hill = state.level.skiJump!;
    expect(hill).toBeDefined();
    const top = hill.gates[hill.gates.length - 1];
    const p = state.level.track.points[0];
    const along =
      (state.skier.x - p.x) * Math.sin(p.heading) + (state.skier.z - p.z) * Math.cos(p.heading);
    expect(along).toBeCloseTo(top.x, 1);
  });
});

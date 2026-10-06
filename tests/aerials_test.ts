// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AERIALS (R44): the site built to the rules (the in-run sized to the
// kicker's speed, the three kickers, the table, the knoll and the landing
// hill), the chart of jumps and their codes, the flight as declared flips
// and twists, the formal score (the air, the form and the landing of five
// judges, the middle three, times the DD), the contest's format and its
// dealt field, the pair and the build, and the bot through a jump.

import { describe, expect, it } from "vitest";

import {
  AERIALS,
  AERIALS_RULE,
  AERIAL_JUMPS,
  AERIAL_PANEL,
  AERIAL_PHASES,
  KESTREL,
  MODE_RULES,
  aerialBoard,
  aerialJump,
  aerialOrder,
  aerialPhase,
  aerialRivalJump,
  aerialTotal,
  aerialsHeightAt,
  aerialsProfile,
  barredPlans,
  codeOf,
  dnfOf,
  flipsOf,
  freshAerials,
  isAerialCode,
  kickerOf,
  middleThree,
  raceRiderOf,
  raceSkisOf,
  setAerials,
  simulateRun,
  skisById,
  twistsOf,
  type AerialJumpRun,
  type AerialRead,
} from "@engine";
import { levelFor } from "./support/levels.ts";

const R = AERIALS_RULE;
const RAD = Math.PI / 180;

describe("the aerials site's profile (R44)", () => {
  for (const kicker of ["single", "double", "triple"] as const) {
    const p = aerialsProfile(kicker);
    const K = R.kickers[kicker];
    const slope = (x: number): number =>
      Math.atan2(aerialsHeightAt(p, x - 0.1) - aerialsHeightAt(p, x), 0.1);

    it(`${kicker}: its kicker turned to ${K.kick}° on ${K.radius} m, its lip over the table`, () => {
      // The lip's height is the circle's own, within the pen's step.
      expect(Math.abs(p.height - K.radius * (1 - Math.cos(K.kick * RAD)))).toBeLessThan(0.15);
      expect(Math.abs(-slope(p.lip) / RAD - K.kick)).toBeLessThan(1);
    });

    it(`${kicker}: the knoll ${K.table} m past the lip and the hill at ${R.steepest}°`, () => {
      expect(p.knoll - p.lip).toBeCloseTo(K.table, 1);
      expect(slope(p.knoll + R.knoll * R.steepest * RAD + 2) / RAD).toBeCloseTo(R.steepest, 0);
      // The in-run lies at its angle somewhere above the table.
      expect(slope(p.table - 25) / RAD).toBeCloseTo(R.inRun, 0);
    });
  }

  it("runs longer in-runs to the bigger kickers, all of them inside the hill's 50–110 m", () => {
    const runs = (["single", "double", "triple"] as const).map((k) => {
      const p = aerialsProfile(k);
      return p.table - p.gate;
    });
    expect(runs[0]).toBeLessThan(runs[1]);
    expect(runs[1]).toBeLessThan(runs[2]);
    expect(runs[0]).toBeGreaterThan(50);
    expect(runs[2]).toBeLessThan(110);
  });
});

describe("the site set over a built map", () => {
  for (const seed of [1, 2]) {
    it(`seed ${seed}: a start gate, a finish line and the kicker the jump declares`, () => {
      const level = setAerials(levelFor(seed), "double");
      const site = level.aerials!;
      expect(site.kicker).toBe("double");
      expect(level.checkpoints).toHaveLength(2);
      expect(level.kickers?.some((k) => k.id === "AE")).toBe(true);
      expect(site.base).toBe(levelFor(seed));
      expect(site.vertical).toBeGreaterThan(40);
    });
  }

  it("is the same map asked twice, and another for another kicker", () => {
    expect(setAerials(levelFor(1), "triple")).toBe(setAerials(levelFor(1), "triple"));
    expect(setAerials(levelFor(1), "single")).not.toBe(setAerials(levelFor(1), "triple"));
  });
});

describe("the chart of jumps", () => {
  it("reads a code into its flips, and back", () => {
    expect(flipsOf("bLdFF")).toEqual([
      { twists: 0, tuck: false },
      { twists: 2, tuck: false },
      { twists: 1, tuck: false },
    ]);
    expect(flipsOf("bT")).toEqual([{ twists: 0, tuck: true }]);
    for (const j of AERIAL_JUMPS) expect(codeOf(flipsOf(j.code)!)).toBe(j.code);
    expect(flipsOf("xyz")).toBeNull();
    expect(isAerialCode("bFtF")).toBe(true);
    expect(isAerialCode("bQ")).toBe(false);
  });

  it("sends each jump to the kicker its flips need", () => {
    expect(kickerOf("bL")).toBe("single");
    expect(kickerOf("bFF")).toBe("double");
    expect(kickerOf("bFdFF")).toBe("triple");
    expect(twistsOf("bFdFdF")).toBe(5);
  });

  it("holds the chart's degrees of difficulty, the harder the jump the higher", () => {
    expect(aerialJump("bL")?.men).toBeCloseTo(2.05, 6);
    expect(aerialJump("bLF")?.men).toBeCloseTo(2.9, 6);
    expect(aerialJump("bdFFdF")?.men).toBeCloseTo(5.0, 6);
    for (const j of AERIAL_JUMPS) {
      const n = flipsOf(j.code)!.length;
      expect(j.men).toBeGreaterThan(n === 1 ? 1.9 : n === 2 ? 2.5 : 3.1);
      expect(j.women).toBeGreaterThanOrEqual(j.men);
    }
  });
});

describe("the formal score", () => {
  it("is the middle three of five per part, summed, times the DD, cut to two decimals", () => {
    expect(middleThree([1.0, 1.9, 1.9, 1.9, 2.0])).toBeCloseTo(5.7, 9);
    // The top series' example: 5.7 + 12.3 + 8.0 = 26.0, × 5.100 = 132.60.
    const t = aerialTotal(
      [1.9, 1.9, 1.9, 1.8, 2.0],
      [4.1, 4.1, 4.1, 4.0, 4.3],
      [2.6, 2.7, 2.7, 2.5, 2.8],
      5.1,
    );
    expect(t.air).toBeCloseTo(5.7, 9);
    expect(t.form).toBeCloseTo(12.3, 9);
    expect(t.landing).toBeCloseTo(8.0, 9);
    expect(t.raw).toBeCloseTo(26.0, 9);
    expect(t.score).toBeCloseTo(132.6, 9);
  });

  const read = (code: string): AerialRead => ({
    flips: flipsOf(code)!.map((f) => ({
      twists: f.twists,
      twist: f.twists * 2 * Math.PI,
      tuck: f.tuck ? 1 : 0,
    })),
    code,
    peak: 5,
    firstTap: 0.05,
    owing: 0,
    tucked: false,
    landedAt: 0,
  });

  it("is no finish for the wrong flips or the wrong twists", () => {
    expect(dnfOf(read("bLF"), "bLF")).toBeNull();
    expect(dnfOf(read("bLL"), "bLF")).toBe("twists");
    expect(dnfOf(read("bLF"), "bLFF")).toBe("flips");
    // A twist in the wrong flip is form, not a no finish.
    expect(dnfOf(read("bFL"), "bLF")).toBeNull();
  });

  it("states its panel's bands, smaller for a jump of more flips", () => {
    expect(AERIAL_PANEL.judges).toBe(5);
    expect(AERIAL_PANEL.bands[3].major).toBeLessThan(AERIAL_PANEL.bands[1].major);
  });
});

describe("the contest", () => {
  const jump = (score: number, extra: Partial<AerialJumpRun> = {}): AerialJumpRun => ({
    plan: "bLF",
    dd: 2.9,
    score,
    air: 5,
    form: 12,
    landing: 7,
    raw: 24,
    fell: false,
    dnf: null,
    ...extra,
  });

  it("is a qualification, final 1 of twelve and final 2 of six", () => {
    expect(AERIAL_PHASES).toEqual(["qualification", "final1", "final2"]);
    const c = freshAerials(5);
    expect(c.plan).toBe(AERIALS.plan);
    expect(aerialPhase(c)).toBe("qualification");
    expect(aerialBoard(c, "qualification")).toHaveLength(AERIALS.field + 1);
    const through = { ...c, jumps: [jump(200)], open: 2 };
    expect(aerialPhase(through)).toBe("final1");
    expect(aerialBoard(through, "final1")).toHaveLength(AERIALS.final1);
    const last = { ...through, jumps: [jump(200), jump(200, { plan: "bFF" })], open: 3 };
    expect(aerialBoard(last, "final2")).toHaveLength(AERIALS.final2);
    // The two finals' jumps must differ: final 1's is barred in final 2.
    expect(barredPlans(last)).toEqual(["bFF"]);
  });

  it("deals the field off its own seed, a top final in the right band", () => {
    expect(aerialRivalJump(3, 4, "final1")).toEqual(aerialRivalJump(3, 4, "final1"));
    const scores = Array.from({ length: AERIALS.field }, (_, i) =>
      aerialRivalJump(3, i, "qualification"),
    )
      .filter((j) => !j.fell)
      .map((j) => j.score);
    expect(Math.max(...scores)).toBeGreaterThan(90);
    expect(Math.max(...scores)).toBeLessThan(140);
    for (let i = 0; i < AERIALS.field; i++) {
      expect(aerialRivalJump(3, i, "final2").plan).not.toBe(aerialRivalJump(3, i, "final1").plan);
    }
  });

  it("breaks a tie on the score before the DD, the form, the landing, then the lower DD", () => {
    const a = jump(100);
    expect(aerialOrder(a, { ...a, raw: a.raw - 1 })).toBeLessThan(0);
    expect(aerialOrder(a, { ...a, form: a.form - 1 })).toBeLessThan(0);
    expect(aerialOrder(a, { ...a, landing: a.landing + 1 })).toBeGreaterThan(0);
    expect(aerialOrder(a, { ...a, dd: a.dd + 1 })).toBeLessThan(0);
    expect(aerialOrder(a, { ...a, dnf: "flips" })).toBeLessThan(0);
  });
});

describe("the mode, the pair and the build", () => {
  it("is jumped on the Kestrel at the light build", () => {
    expect(raceSkisOf("aerials")).toBe("kestrel");
    expect(skisById("kestrel")).toBe(KESTREL);
    expect(raceRiderOf("aerials")).toBe("light");
    // Short, narrow, light and nearly straight.
    expect(KESTREL.length).toBeGreaterThanOrEqual(1.5);
    expect(KESTREL.length).toBeLessThanOrEqual(1.6);
    expect(KESTREL.waist).toBeCloseTo(0.065, 3);
    expect(KESTREL.sidecut).toBeGreaterThanOrEqual(25);
  });

  it("flies the strict gates, the real g and the chart's three flips and six twists", () => {
    const rules = MODE_RULES.aerials(1);
    expect(rules.aerials).toBe(true);
    expect(rules.gates).toBe("strict");
    expect(rules.airGravity).toBe(1);
    expect(rules.flipMost).toBeCloseTo(6 * Math.PI, 9);
    expect(rules.spinMost).toBeCloseTo(12 * Math.PI, 9);
    expect(rules.rivals).toBe(0);
  });
});

describe("the bot through a jump", () => {
  it("throws the jump it declared, lands it on the hill and is scored", () => {
    const r = simulateRun(2, { mode: "aerials", spec: KESTREL, plan: "bLFF", keepEvents: true });
    expect(r.finished).toBe(true);
    expect(r.out).toBeNull();
    expect(r.jumps).toBe(1);
    expect(r.score).toBeGreaterThan(70);
    expect(r.events.some((e) => e.kind === "wipeout")).toBe(false);
  });
});

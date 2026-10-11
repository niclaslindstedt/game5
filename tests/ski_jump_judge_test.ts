// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI JUMP SCORED (R43, `ski-jump-judge.ts`): the distance points off K
// and the metre value, the five judges' marks with the high and low
// dropped, the gate's and the wind's compensation, each part to one
// decimal — held to worked examples — and the deductions a jump's record
// earns: a telemark against none, a hand down, a fall.

import { describe, expect, it } from "vitest";

import {
  JUMP_PANEL,
  SKI_JUMP_RULE,
  deductionsOf,
  distancePoints,
  gatePoints,
  judgeJump,
  marksFor,
  scoreJump,
  styleOf,
  tenth,
  windPoints,
  type JumpRecord,
  type JumpScoring,
} from "@engine";

/** The large hill's scoring numbers (R43). */
const LARGE: JumpScoring = {
  w: 126,
  hs: 140,
  metre: SKI_JUMP_RULE.hills.large.metre,
  gateFactor: SKI_JUMP_RULE.hills.large.gate,
  headFactor: SKI_JUMP_RULE.hills.large.head,
  tailFactor: SKI_JUMP_RULE.hills.large.tail,
};

/** The round's reference gate, its in-run m from the edge. */
const REF = { number: 22, inRun: 85, reference: 85 };

/** A clean telemark to K, flown well: the record a judge reads. */
function record(o: Partial<JumpRecord> = {}): JumpRecord {
  return {
    gate: 22,
    inRunSpeed: 25.6,
    edgeSpeed: 26.2,
    timing: 0.01,
    share: 1,
    push: 2.5,
    flightTime: 4.3,
    peak: 4.3,
    peakAt: 56,
    wind: 0,
    stations: [0, 0, 0, 0, 0],
    measured: 0,
    attitude: 0.4,
    roll: 1,
    veeAt: 0.6,
    lost: false,
    distance: 126,
    reach: 126.2,
    landingSpeed: 27.5,
    into: 4.6,
    load: 2.8,
    landing: "telemark",
    outcome: "clean",
    ...o,
  };
}

describe("ski jumping's scorer (R43)", () => {
  it("scores the distance off K at the metre value: 131.5 m on K 126 at 1.8 is 69.9", () => {
    expect(distancePoints(LARGE, 131.5)).toBe(69.9);
    expect(distancePoints(LARGE, 126)).toBe(60);
    expect(distancePoints(LARGE, 120.5)).toBe(50.1);
    // Never below nothing.
    expect(distancePoints(LARGE, 50)).toBe(0);
    // A flying hill's K is worth 120.
    expect(distancePoints({ ...LARGE, w: 200, metre: 1.2 }, 210)).toBe(132);
  });

  it("drops the high and the low mark and sums the middle three: 53.5", () => {
    expect(styleOf([18.5, 18.0, 18.0, 17.5, 17.0])).toBe(53.5);
    expect(styleOf([17.0, 18.5, 17.5, 18.0, 18.0])).toBe(53.5);
    expect(styleOf([20, 20, 20, 20, 20])).toBe(60);
  });

  it("a clean 126 m telemark at the reference gate in calm air is 60 + 3 × 18.5", () => {
    const s = scoreJump(LARGE, REF, 126, [18.5, 18.5, 18.5, 18.5, 18.5], 0, false);
    expect(s.points).toBe(115.5);
    expect(s.gatePoints).toBe(0);
    expect(s.windPoints).toBe(0);
  });

  it("gives the gate factor for every metre of in-run below the reference, takes it above", () => {
    const f = LARGE.gateFactor;
    expect(gatePoints(LARGE, 85 - 1.4, 85)).toBe(tenth(f * 1.4));
    expect(gatePoints(LARGE, 85 + 0.7, 85)).toBe(tenth(-f * 0.7));
    expect(gatePoints(LARGE, 85 - 1.4, 85)).toBeGreaterThan(8);
  });

  it("takes the head factor off a head wind and gives 1.21 × it on a tail wind", () => {
    expect(LARGE.tailFactor / LARGE.headFactor).toBeCloseTo(1.21, 2);
    expect(windPoints(LARGE, 1.5)).toBe(tenth(-LARGE.headFactor * 1.5));
    expect(windPoints(LARGE, 1.5)).toBeLessThan(0);
    expect(windPoints(LARGE, -1.5)).toBe(tenth(LARGE.tailFactor * 1.5));
    expect(windPoints(LARGE, -1.5)).toBeGreaterThan(-windPoints(LARGE, 1.5));
    expect(windPoints(LARGE, 0)).toBe(0);
  });

  it("rounds every part to one decimal, halves away from nothing", () => {
    expect(tenth(14.85)).toBe(14.9);
    expect(tenth(-14.85)).toBe(-14.9);
    expect(tenth(0.04)).toBe(0);
  });

  it("sums the parts: 131.5 m, 53.5 of style, a gate lower and a head wind", () => {
    const s = scoreJump(
      LARGE,
      { number: 20, inRun: 83.6, reference: 85 },
      131.5,
      [18.5, 18.0, 18.0, 17.5, 17.0],
      0.8,
      false,
    );
    expect(s.distancePoints).toBe(69.9);
    expect(s.style).toBe(53.5);
    expect(s.gatePoints).toBe(tenth(LARGE.gateFactor * 1.4));
    expect(s.windPoints).toBe(tenth(-LARGE.headFactor * 0.8));
    expect(s.points).toBe(tenth(69.9 + 53.5 + s.gatePoints + s.windPoints));
  });

  it("marks a well flown telemark 18 to 19.5, in half points, each judge his own eye", () => {
    const marks = marksFor(deductionsOf(record()).flight + 0.5, 7, 199);
    for (const m of marks) {
      expect(m * 2).toBe(Math.round(m * 2));
      expect(m).toBeGreaterThanOrEqual(18);
      expect(m).toBeLessThanOrEqual(19.5);
    }
    // The same jump, the same eyes; another contest, other eyes somewhere.
    expect(marksFor(1.2, 7, 199)).toEqual(marksFor(1.2, 7, 199));
    const others = [1, 2, 3, 4, 5, 6].map((seed) => marksFor(1.25, seed, 199).join());
    expect(new Set(others).size).toBeGreaterThan(1);
  });

  it("costs a landing with no telemark two points a judge", () => {
    const tele = deductionsOf(record());
    const two = deductionsOf(record({ landing: "twoFooted" }));
    const late = deductionsOf(record({ landing: "late" }));
    expect(two.landing - tele.landing).toBeCloseTo(
      JUMP_PANEL.landing.twoFooted - JUMP_PANEL.landing.telemark,
      9,
    );
    expect(two.landing).toBeGreaterThanOrEqual(2);
    expect(late.landing).toBeGreaterThan(tele.landing);
    expect(late.landing).toBeLessThan(two.landing);
    const a = judgeJump(LARGE, record(), REF, 3, 99);
    const b = judgeJump(LARGE, record({ landing: "twoFooted" }), REF, 3, 99);
    expect(a.style - b.style).toBeGreaterThanOrEqual(4.5);
  });

  it("costs a hard landing, a hand down and a mistimed take-off", () => {
    const clean = deductionsOf(record());
    expect(deductionsOf(record({ load: 4.6 })).landing).toBeGreaterThan(clean.landing);
    expect(deductionsOf(record({ outcome: "touch" })).outrun).toBe(JUMP_PANEL.outrun.touch);
    expect(deductionsOf(record({ timing: -0.12 })).flight).toBeGreaterThan(clean.flight + 0.5);
    expect(deductionsOf(record({ veeAt: -1 })).flight).toBeGreaterThan(clean.flight + 1);
    expect(deductionsOf(record({ lost: true })).flight).toBe(JUMP_PANEL.most.flight);
  });

  it("marks a fall under ten a judge, the style under 30", () => {
    const fall = record({ landing: "fall", outcome: "fall", distance: 118 });
    const d = deductionsOf(fall);
    expect(d.outrun).toBe(JUMP_PANEL.outrun.fall);
    const s = judgeJump(LARGE, fall, REF, 3, 99);
    expect(s.fell).toBe(true);
    for (const m of s.marks) expect(m).toBeLessThan(10);
    expect(s.style).toBeLessThan(30);
    expect(s.distancePoints).toBe(distancePoints(LARGE, 118));
  });

  it("scores the wind the stations measured, never the flight's own mean", () => {
    const s = judgeJump(LARGE, record({ wind: 2, measured: -1 }), REF, 3, 99);
    expect(s.wind).toBe(-1);
    expect(s.windPoints).toBe(tenth(LARGE.tailFactor));
  });
});

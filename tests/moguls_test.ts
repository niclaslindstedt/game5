// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// MOGULS (R42): the course built to the rules (the pitch, the two air
// bumps, the mogul track, the gates), the field of moguls laid as an
// analytic surface a dual course can share, the legs absorbing them, the
// formal score (the turns, the air by its DD, the speed off the pace), the
// contest's format and its dealt field, and the bot down the course.

import { describe, expect, it } from "vitest";

import {
  MOGUL_ABSORB,
  IBEX,
  MODE_RULES,
  MOGULS,
  MOGULS_RULE,
  MOGUL_PHASES,
  absorbedAt,
  ddOf,
  fieldCoords,
  freshMoguls,
  freshTurns,
  mogulBoard,
  mogulOrder,
  mogulPhase,
  mogulRivalRun,
  mogulsAt,
  mogulsField,
  mogulsProfile,
  raceRiderOf,
  raceSkisOf,
  riddenLevel,
  scoreMoguls,
  setMoguls,
  simulateRun,
  skisById,
  type FlightRecord,
  type MogulRun,
  type MogulTurns,
  type TrickRead,
} from "@engine";
import { levelFor } from "./support/levels.ts";

const R = MOGULS_RULE;
const RAD = Math.PI / 180;

describe("the moguls course's profile (R42)", () => {
  const p = mogulsProfile();

  it("is the top series' course: 235 m down the pitch to the finish line", () => {
    expect(p.length).toBeGreaterThan(R.course);
    expect(p.length).toBeLessThan(R.course + R.round);
  });

  it("holds its pitch between the air bumps", () => {
    const at = (x: number): number => p.y[Math.round(x / p.dx)];
    const mid = (p.airs[0].landed + p.airs[1].foot) / 2;
    const slope = (at(mid + 5) - at(mid - 5)) / 10;
    // The profile is drawn as the descent from the platform.
    expect(Math.atan(slope) / RAD).toBeCloseTo(-R.pitch, 0);
  });

  it("stands its two air bumps at 15 % and 80 % of the course, a lip over the pitch", () => {
    expect(p.airs).toHaveLength(2);
    const span = p.finish - p.gate;
    expect((p.airs[0].lip - p.gate) / span).toBeGreaterThan(0.1);
    expect((p.airs[0].lip - p.gate) / span).toBeLessThan(0.2);
    expect((p.airs[1].lip - p.gate) / span).toBeGreaterThan(0.72);
    expect((p.airs[1].lip - p.gate) / span).toBeLessThan(0.85);
    for (const a of p.airs) {
      expect(a.lip).toBeGreaterThan(a.foot);
      expect(a.landed).toBeGreaterThan(a.lip);
    }
  });
});

describe("the mogul field", () => {
  const p = mogulsProfile();
  const frame = { x: 0, z: 0, heading: 0, yAt: (d: number) => -d * Math.tan(R.pitch * RAD) };
  const f = mogulsField(p, frame);

  it("bumps the track crest to trough by the rule's height, a mogul every spacing", () => {
    const along = (f.gaps[0][1] + f.gaps[1][0]) / 2;
    let hi = -Infinity;
    let lo = Infinity;
    for (let a = along; a < along + f.spacing; a += 0.05) {
      hi = Math.max(hi, mogulsAt(f, a, 0));
      lo = Math.min(lo, mogulsAt(f, a, 0));
    }
    expect(hi - lo).toBeCloseTo(R.bumps.height, 1);
    expect(mogulsAt(f, along, 0)).toBeCloseTo(mogulsAt(f, along + f.spacing, 0), 6);
  });

  it("is smooth off the track, in the air bumps' run-ins and landings and past its ends", () => {
    expect(mogulsAt(f, (f.gaps[0][1] + f.gaps[1][0]) / 2, R.track / 2 + R.bumps.ease)).toBe(0);
    for (const [a, b] of f.gaps) expect(mogulsAt(f, (a + b) / 2, 0)).toBe(0);
    expect(mogulsAt(f, f.from - 1, 0)).toBe(0);
    expect(mogulsAt(f, f.to + 1, 0)).toBe(0);
  });

  it("lays two lines side by side on one rhythm for a dual course", () => {
    const dual = mogulsField(p, frame, R, [
      { offset: -6, width: 6 },
      { offset: 6, width: 6 },
    ]);
    const a = (f.gaps[0][1] + f.gaps[1][0]) / 2;
    expect(mogulsAt(dual, a, -6)).toBeCloseTo(mogulsAt(dual, a, 6), 6);
    expect(Math.abs(mogulsAt(dual, a, 6))).toBeGreaterThan(0);
    expect(mogulsAt(dual, a, 0)).toBeCloseTo(0, 3);
  });
});

describe("the course set over a built map", () => {
  for (const seed of [1, 2, 3]) {
    it(`seed ${seed}: a start, nine control gates and a finish, the airs its kickers`, () => {
      const level = setMoguls(levelFor(seed));
      const course = level.moguls!;
      expect(level.checkpoints).toHaveLength(R.gates + 2);
      expect(level.kickers?.filter((k) => k.id.startsWith("A")).map((k) => k.id)).toEqual([
        "A1",
        "A2",
      ]);
      expect(course.vertical).toBeGreaterThan(80);
      expect(course.base).toBe(levelFor(seed));
      // The ground answers the moguls inside the track.
      const f = level.bumps!;
      const sx = f.x + Math.sin(f.heading) * ((f.gaps[0][1] + f.gaps[1][0]) / 2);
      const sz = f.z + Math.cos(f.heading) * ((f.gaps[0][1] + f.gaps[1][0]) / 2);
      const at = fieldCoords(f, sx, sz);
      expect(level.groundAt(sx, sz)).toBeCloseTo(
        f.yAt(at.along) + mogulsAt(f, at.along, at.across),
        6,
      );
    });
  }

  it("is the same map asked twice", () => {
    expect(setMoguls(levelFor(1))).toBe(setMoguls(levelFor(1)));
  });
});

describe("the legs absorbing the moguls", () => {
  it("take all of a mogul at the pace and less past it", () => {
    expect(absorbedAt(5)).toBe(1);
    expect(absorbedAt(MOGUL_ABSORB.easy)).toBe(1);
    expect(absorbedAt(MOGUL_ABSORB.hard)).toBeCloseTo(MOGUL_ABSORB.floor, 6);
    expect(absorbedAt(12)).toBeLessThan(1);
  });

  it("leave every map without moguls untouched", () => {
    const level = levelFor(1);
    expect(riddenLevel(level, 10)).toBe(level);
  });
});

describe("the mode, the pair and the build", () => {
  it("is ridden on the Ibex at the medium build", () => {
    expect(raceSkisOf("moguls")).toBe("ibex");
    expect(raceRiderOf("moguls")).toBe("medium");
    expect(skisById("ibex")).toBe(IBEX);
    expect(IBEX.length).toBeGreaterThanOrEqual(1.6);
    expect(IBEX.length).toBeLessThanOrEqual(1.79);
    expect(IBEX.waist).toBeGreaterThanOrEqual(0.06);
    expect(IBEX.waist).toBeLessThanOrEqual(0.066);
  });

  it("holds the strict gates and the moguls technique", () => {
    const rules = MODE_RULES.moguls(1);
    expect(rules.gates).toBe("strict");
    expect(rules.technique).toBe("moguls");
    expect(rules.rivals).toBe(0);
  });
});

const read = (r: Partial<TrickRead>): TrickRead => ({
  spin: 0,
  butter: null,
  flips: 0,
  flipDir: null,
  dir: null,
  offAxis: false,
  switchIn: false,
  switchOut: false,
  grabs: [],
  ...r,
});

describe("the formal score", () => {
  it("reads the jumps' degree of difficulty off the table", () => {
    expect(ddOf(read({})).dd).toBe(0.4);
    expect(ddOf(read({ spin: 360, dir: "left" })).dd).toBe(0.68);
    expect(ddOf(read({ spin: 720, dir: "left" })).dd).toBe(0.85);
    expect(ddOf(read({ flips: 1, flipDir: "back" })).dd).toBe(0.68);
    expect(ddOf(read({ flips: 1, flipDir: "back", spin: 360, dir: "left" })).dd).toBe(0.88);
    expect(ddOf(read({ flips: 1, flipDir: "back", spin: 720, dir: "left" })).dd).toBe(1.05);
    expect(ddOf(read({ grabs: ["grab"] })).dd).toBe(0.54);
  });

  const level = setMoguls(levelFor(1));
  const course = level.moguls!;
  const good: MogulTurns = {
    ...freshTurns(),
    steps: 2000,
    turns: 90,
    skid: 300,
    swing: 100,
    line: 200,
    air: 20,
  };
  const at = (k: number): { x: number; z: number } => {
    const d = course.airs[k].lip;
    const f = course.field;
    return { x: f.x + Math.sin(f.heading) * d, z: f.z + Math.cos(f.heading) * d };
  };
  const flight = (k: number, flip: number): FlightRecord => ({
    flight: 1,
    flip,
    spin: 0,
    grabs: [],
    air: 1,
    length: 10,
    height: 1.5,
    switchIn: false,
    switchOut: false,
    landing: 1,
    outcome: "landed",
    t: 1,
    ...at(k),
  });

  it("scores the speed 48 − 32 × time ÷ pace, at most 20", () => {
    const pace = course.length / MOGULS.pace;
    expect(scoreMoguls(course, good, [], pace, false, 1, 0).speed).toBe(16);
    expect(scoreMoguls(course, good, [], pace * 0.8, false, 1, 0).speed).toBe(20);
    expect(scoreMoguls(course, good, [], pace * 2, false, 1, 0).speed).toBe(0);
  });

  it("sums the middle three of five turn judges, and a stop costs six", () => {
    const s = scoreMoguls(course, good, [], 25, false, 1, 0);
    expect(s.turns).toBeGreaterThan(40);
    expect(s.turns).toBeLessThanOrEqual(60);
    const stopped = scoreMoguls(course, { ...good, stops: 1 }, [], 25, false, 1, 0);
    expect(s.turns - stopped.turns).toBeGreaterThan(15);
  });

  it("scores each air judged by its DD, a repeat once", () => {
    const two = scoreMoguls(course, good, [flight(0, 0), flight(1, 2 * Math.PI)], 25, false, 1, 0);
    expect(two.jumps.map((j) => j?.code)).toEqual(["S", "b1x0"]);
    expect(two.air).toBeGreaterThan(8);
    expect(two.air).toBeLessThanOrEqual(20);
    const same = scoreMoguls(course, good, [flight(0, 0), flight(1, 0)], 25, false, 1, 0);
    expect(same.jumps[1]?.points).toBe(0);
  });

  it("scores a run that went out nothing", () => {
    const s = scoreMoguls(course, good, [], 25, true, 1, 0);
    expect(s.total).toBe(0);
    expect(s.fell).toBe(true);
  });

  it("deals each judge's eye off the contest, never the run's stream", () => {
    const a = scoreMoguls(course, good, [], 25, false, 7, 0);
    const b = scoreMoguls(course, good, [], 25, false, 7, 0);
    expect(a).toEqual(b);
  });
});

describe("the contest", () => {
  const pace = 24;
  const run = (score: number): MogulRun => ({
    score,
    turns: score * 0.6,
    air: score * 0.2,
    airRaw: 15,
    speed: score * 0.2,
    time: 24,
    fell: false,
  });

  it("is a qualification, final 1 of sixteen and final 2 of six", () => {
    expect(MOGUL_PHASES).toEqual(["qualification", "final1", "final2"]);
    const c = freshMoguls(5);
    expect(mogulPhase(c)).toBe("qualification");
    expect(mogulBoard(c, "qualification", pace)).toHaveLength(MOGULS.field + 1);
    const through = { ...c, runs: [run(99)], open: 2 };
    expect(mogulPhase(through)).toBe("final1");
    expect(mogulBoard(through, "final1", pace)).toHaveLength(MOGULS.final1);
    expect(
      mogulBoard({ ...through, runs: [run(99), run(99)], open: 3 }, "final2", pace),
    ).toHaveLength(MOGULS.final2);
  });

  it("deals the field off its own seed, a top final in the right band", () => {
    expect(mogulRivalRun(3, 4, "final1", pace)).toEqual(mogulRivalRun(3, 4, "final1", pace));
    const scores = Array.from({ length: MOGULS.field }, (_, i) =>
      mogulRivalRun(3, i, "qualification", pace),
    )
      .filter((r) => !r.fell)
      .map((r) => r.score);
    expect(Math.max(...scores)).toBeGreaterThan(70);
    expect(Math.max(...scores)).toBeLessThan(90);
  });

  it("breaks a tie on the turns, then the air before its DD, then the time", () => {
    const a = run(70);
    expect(mogulOrder(a, { ...a, turns: a.turns - 1 })).toBeLessThan(0);
    expect(mogulOrder(a, { ...a, airRaw: a.airRaw + 1 })).toBeGreaterThan(0);
    expect(mogulOrder(a, { ...a, time: a.time + 1 })).toBeLessThan(0);
  });
});

describe("the bot down the course", () => {
  it("finishes on the Ibex near the pace and is scored", () => {
    const r = simulateRun(2, { mode: "moguls", spec: skisById("ibex") });
    expect(r.finished).toBe(true);
    expect(r.time).toBeLessThan(32);
    expect(r.score).toBeGreaterThan(50);
  });
});

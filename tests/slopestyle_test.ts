// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SLOPESTYLE (R39): the course built to the rules — the platform, three
// rail sections and three jumps, each section met at its design speed —
// set on a map, the mode's rules and presets, the bot down it, the
// section judging and the contest's format.

import { describe, expect, it } from "vitest";

import {
  MODE_RULES,
  SLOPESTYLE,
  SLOPESTYLE_RULE,
  SLOPE_JUDGING,
  bestRun,
  createGame,
  freshSlopestyle,
  jibImpression,
  judgeSlopestyle,
  jumpHeightAt,
  raceRiderOf,
  raceSkisOf,
  rivalRun,
  setSlopestyle,
  simulateRun,
  skisById,
  slopeBoard,
  slopeContestAfter,
  slopePhase,
  slopestyleProfile,
  type FlightRecord,
  type GameState,
  type JibRecord,
  type SlopeContest,
} from "@engine";
import { levelFor } from "./support/levels.ts";

const R = SLOPESTYLE_RULE;
const RAD = Math.PI / 180;

describe("the slopestyle course's profile (R39)", () => {
  const p = slopestyleProfile();

  it("is three rail sections then three jumps, in order down the hill", () => {
    expect(p.sections.map((s) => s.kind)).toEqual(["rail", "rail", "rail", "jump", "jump", "jump"]);
    for (let i = 1; i < p.sections.length; i++) {
      expect(p.sections[i].from).toBeGreaterThanOrEqual(p.sections[i - 1].to);
    }
    expect(p.gate).toBeLessThanOrEqual(p.sections[0].from);
    expect(p.finish).toBeGreaterThan(p.sections[5].to);
  });

  it("never climbs, and is a long course with real vertical", () => {
    for (let x = p.gate; x < p.finish; x += 1) {
      // Only a kicker's own ramp climbs.
      const up = jumpHeightAt(p, x + 1) - jumpHeightAt(p, x);
      if (up > 0.01)
        expect(p.feet.some((f, j) => x >= f - 1 && x <= (p.sections[3 + j].lip ?? 0))).toBe(true);
    }
    expect(p.finish - p.gate).toBeGreaterThan(400);
    expect(jumpHeightAt(p, p.gate) - jumpHeightAt(p, p.finish)).toBeGreaterThan(100);
  });

  it("lays every rail deck at the rule's pitch", () => {
    for (const d of p.decks) {
      const fall = (jumpHeightAt(p, d + 5) - jumpHeightAt(p, d + 15)) / 10;
      expect(Math.atan(fall) / RAD).toBeCloseTo(R.rails.grade, 0);
    }
  });

  it("sizes its kickers up the ladder, each landing no steeper than the rule", () => {
    expect(p.heights[0]).toBeLessThan(p.heights[2]);
    for (let j = 0; j < 3; j++) {
      const s = p.sections[3 + j];
      expect(s.speed).toBe(R.jumps[j].speed);
      const knuckle = s.knuckle ?? 0;
      for (let x = knuckle; x < s.to - 2; x += 1) {
        const slope = Math.atan(jumpHeightAt(p, x) - jumpHeightAt(p, x + 1)) / RAD;
        expect(slope).toBeLessThanOrEqual(R.steepest + 0.5);
      }
      // The design flight comes down past the knuckle, on the landing.
      expect(p.touches[j]).toBeGreaterThan(knuckle);
      expect(p.touches[j]).toBeLessThan(s.to);
    }
  });
});

describe("the slopestyle course set on a map (R39)", () => {
  const level = setSlopestyle(levelFor(1));
  const course = level.slopestyle;

  it("is set, its start gate and finish line its only gates", () => {
    expect(course).toBeDefined();
    expect(level.checkpoints).toHaveLength(2);
    expect(level.bigAir ?? level.slalom ?? level.downhill).toBeUndefined();
    expect(setSlopestyle(level)).toBe(level);
  });

  it("stands a rail and a box on two lines in every rail section", () => {
    const jibs = level.jibs ?? [];
    expect(jibs).toHaveLength(6);
    for (let k = 1; k <= 3; k++) {
      const here = jibs.filter((j) => j.section === k);
      expect(here.map((j) => j.line).sort()).toEqual([-1, 1]);
      expect(new Set(here.map((j) => j.kind))).toEqual(new Set(["rail", "box"]));
      // Every jib stands over the snow it is on, never under it.
      for (const j of here) {
        for (const pt of j.points) expect(pt.y).toBeGreaterThan(level.groundAt(pt.x, pt.z) - 0.05);
      }
    }
  });

  it("publishes its three jumps among the map's kickers", () => {
    const on = (level.kickers ?? []).filter((k) => k.id.startsWith("S"));
    expect(on.map((k) => k.id)).toEqual(["S4", "S5", "S6"]);
    for (const k of on) expect(k.trick).toBe(true);
  });
});

describe("slopestyle as a mode", () => {
  it("is the strict gates, the tricks and the raised ceilings", () => {
    const r = MODE_RULES.slopestyle(1);
    expect(r.gates).toBe("strict");
    expect(r.tricks).toBe(true);
    expect(r.stunts).toBe(true);
    expect(r.rivals).toBe(0);
    expect(r.spinMost).toBeGreaterThanOrEqual(10 * Math.PI);
  });

  it("opens on the big-air pair and the medium build", () => {
    expect(raceSkisOf("slopestyle")).toBe("raven");
    expect(skisById(SLOPESTYLE.skis).kind).toBe("Big air");
    expect(raceRiderOf("slopestyle")).toBe("medium");
  });

  it("carries a fresh contest off the seed", () => {
    const state = createGame({ seed: 1, mode: "slopestyle", quiet: true });
    expect(state.level.slopestyle).toBeDefined();
    expect(state.slopestyle).toEqual(freshSlopestyle(state.seed));
  });

  it("is skied by the bot to the finish, every rail ridden and every jump landed", () => {
    const r = simulateRun(1, { mode: "slopestyle", spec: skisById("raven") });
    expect(r.finished).toBe(true);
    expect(r.out).toBeNull();
    expect(r.harshLandings).toBe(0);
    expect(r.wipeouts).toBe(0);
    expect(r.score).toBeGreaterThan(40);
  });
});

function jib(over: Partial<JibRecord> = {}): JibRecord {
  return {
    id: "J1L",
    section: 1,
    kind: "rail",
    on: 0,
    off: 0,
    stances: ["fifty"],
    swaps: 0,
    press: null,
    pressed: 0,
    length: 9,
    whole: true,
    t: 5,
    ...over,
  };
}

describe("the section judges", () => {
  it("mark a harder jib higher, and one left early down", () => {
    const plain = jibImpression(jib());
    const swapped = jibImpression(jib({ on: 90, swaps: 1, stances: ["slide", "fifty"], off: 90 }));
    expect(swapped).toBeGreaterThan(plain);
    expect(jibImpression(jib({ whole: false }))).toBeLessThanOrEqual(SLOPE_JUDGING.shortMost);
    expect(jibImpression(jib({ kind: "box" }))).toBeLessThan(plain);
  });

  it("score nothing while the run is on, and nothing past a fall", () => {
    const state = createGame({ seed: 1, mode: "slopestyle", quiet: true });
    expect(judgeSlopestyle(state, 1, 0)).toBeNull();
    const out = fallenAt(state, 3);
    const sheet = judgeSlopestyle(out, 1, 0);
    expect(sheet?.fell).toBe(true);
    // The section he went down in is marked as ridden; every one after it
    // scores nothing.
    expect(sheet?.sections.slice(4)).toEqual([0, 0]);
  });

  it("weigh the trick panels 60 % and the composition 40 %, cut to two decimals", () => {
    const state = skiedClean();
    const sheet = judgeSlopestyle(state, 7, 0);
    if (!sheet) throw new Error("not judged");
    expect(sheet.sections).toHaveLength(6);
    const total = 0.6 * sheet.trick + 0.4 * sheet.composition;
    expect(sheet.total).toBeCloseTo(Math.floor(total * 100 + 1e-6) / 100, 6);
    expect(Math.round(sheet.total * 100)).toBe(sheet.total * 100);
    // The same run, judged again, is the same sheet.
    expect(judgeSlopestyle(state, 7, 0)).toEqual(sheet);
  });
});

/** `state` gone down in section `k` (from 0). */
function fallenAt(state: GameState, k: number): GameState {
  const s = state.level.slopestyle!.sections[k];
  const mid = (s.from + s.to) / 2;
  const pts = state.level.track.points;
  const at = pts.reduce((a, b) => (Math.abs(b.s - mid) < Math.abs(a.s - mid) ? b : a));
  state.skier.x = at.x;
  state.skier.z = at.z;
  state.progress.out = { status: "dnf", why: "fall", gate: 1 };
  return state;
}

/** A run skied clean: a jib in each rail section and a spin off each jump. */
function skiedClean(): GameState {
  const state = createGame({ seed: 1, mode: "slopestyle", quiet: true });
  const course = state.level.slopestyle!;
  for (let k = 1; k <= 3; k++) state.tricks.jibs.push(jib({ section: k, swaps: k - 1 }));
  course.sections
    .filter((s) => s.kind === "jump")
    .forEach((s, j) => {
      const at = state.level.track.points.find((p) => p.s >= (s.lip ?? 0))!;
      const f: FlightRecord = {
        flight: j + 1,
        flip: 0,
        spin: 2 * Math.PI * (j + 1),
        grabs: [],
        air: 2,
        length: 18,
        height: 2,
        switchIn: false,
        switchOut: false,
        landing: 0.2,
        outcome: "landed",
        t: 20 + j * 10,
        x: at.x,
        z: at.z,
      };
      state.tricks.flights.push(f);
    });
  state.progress.finished = true;
  return state;
}

describe("the contest", () => {
  it("deals the field the same every time", () => {
    expect(rivalRun(5, 3, "qualification", 1)).toEqual(rivalRun(5, 3, "qualification", 1));
    expect(rivalRun(5, 3, "final", 1)).not.toEqual(rivalRun(5, 3, "qualification", 1));
  });

  it("counts each phase's best run", () => {
    expect(
      bestRun([
        { score: 40, fell: true },
        { score: 72.5, fell: false },
      ]),
    ).toBe(72.5);
    const c: SlopeContest = { seed: 3, qualification: [{ score: 90, fell: false }], final: null };
    const board = slopeBoard(c, "qualification", 1);
    expect(board).toHaveLength(SLOPESTYLE.field + 1);
    for (let i = 1; i < board.length; i++)
      expect(board[i - 1].total).toBeGreaterThanOrEqual(board[i].total);
  });

  it("takes a clean run to the final and a fall out of it", () => {
    const clean = skiedClean();
    clean.slopestyle = {
      seed: clean.seed,
      qualification: [{ score: 97, fell: false }],
      final: null,
    };
    const through = slopeContestAfter(clean);
    expect(through?.qualification).toHaveLength(SLOPESTYLE.qualification);
    expect(through?.final).toEqual([]);
    expect(slopePhase(through!)).toBe("final");
    const fell = fallenAt(createGame({ seed: 1, mode: "slopestyle", quiet: true }), 1);
    fell.slopestyle = { seed: fell.seed, qualification: [{ score: 3, fell: true }], final: null };
    const out = slopeContestAfter(fell);
    expect(out?.final).toBeNull();
    expect(slopePhase(out!)).toBeNull();
  });
});

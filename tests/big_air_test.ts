// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// BIG AIR (R37): the jump built to the freestyle rules' park chapter, the
// mode's rules and presets, the bot off the lip, the judges and the
// contest's format.

import { describe, expect, it } from "vitest";

import {
  BIG_AIR,
  JUDGING,
  MODE_RULES,
  TRICK_RULES,
  boardOf,
  contestAfter,
  createGame,
  freshBigAir,
  impressionOf,
  jumpProfile,
  nextPhase,
  panelScore,
  jumpHeightAt,
  raceRiderOf,
  raceSkisOf,
  readTrick,
  rivalJump,
  setBigAir,
  simulateRun,
  skisById,
  totalOf,
  trickKind,
  type BigAirContest,
  type BigAirJump,
  type FlightRecord,
  type GameState,
} from "@engine";
import { levelFor } from "./support/levels.ts";

const B = TRICK_RULES.bigAir;
const RAD = Math.PI / 180;

/** The jump's slope at `x` m of plan, degrees, falling positive. */
function slopeAt(x: number): number {
  const p = jumpProfile();
  return Math.atan2(jumpHeightAt(p, x - 0.25) - jumpHeightAt(p, x + 0.25), 0.5) / RAD;
}

describe("the big air jump's profile (R37)", () => {
  const p = jumpProfile();

  it("is built in the rule's order, each part as long as the rule asks", () => {
    expect(p.gate).toBeGreaterThanOrEqual(B.platform);
    expect(p.gate).toBeLessThan(p.foot);
    expect(p.foot).toBeLessThan(p.lip);
    expect(p.knuckle - p.lip).toBeCloseTo(B.table, 0);
    expect(p.knuckle).toBeLessThan(p.landing);
    expect(p.landing).toBeLessThan(p.outrun);
    expect(p.outrun).toBeLessThan(p.end);
  });

  it("drops in at its angle and kicks at the rule's least or more", () => {
    let steepest = 0;
    for (let x = p.gate; x < p.foot; x += 1) steepest = Math.max(steepest, slopeAt(x));
    expect(steepest).toBeCloseTo(B.dropIn, 0);
    expect(-slopeAt(p.lip - 0.3)).toBeGreaterThan(25);
  });

  it("stands its lip at least two metres over the flat, the table level", () => {
    expect(p.height).toBeGreaterThanOrEqual(2);
    for (let x = p.lip + 1; x < p.knuckle - 1; x += 2)
      expect(Math.abs(slopeAt(x))).toBeLessThan(0.5);
  });

  it("lands at 28° or more and never past its steepest", () => {
    let most = 0;
    for (let x = p.knuckle; x < p.landing; x += 0.5) most = Math.max(most, slopeAt(x));
    expect(most).toBeGreaterThanOrEqual(28);
    expect(most).toBeLessThanOrEqual(B.steepest + 0.5);
  });

  it("meets a skier off the lip at its speed no harder than a short fall", () => {
    // Off the lip at the design speed or a tenth under, where the flight
    // meets the landing the speed into the slope is a fall's of well under
    // a metre — the landing shaped to the rule's fall height until its
    // steepest caps it. A tenth OVER, he comes down further on the landing,
    // still on it: overshooting a jump is harder, as on any real one.
    const kick = B.kick * RAD;
    for (const share of [0.9, 1, 1.1]) {
      const v0 = B.speed * share;
      const vx = v0 * Math.cos(kick);
      let met = false;
      for (let t = 0.05; t < 6 && !met; t += 0.002) {
        const x = p.lip + vx * t;
        const y = v0 * Math.sin(kick) * t - 4.905 * t * t;
        if (x <= p.knuckle || y > jumpHeightAt(p, x)) continue;
        met = true;
        expect(x).toBeLessThan(p.landing);
        if (share > 1) continue;
        const vy = v0 * Math.sin(kick) - 9.81 * t;
        const slope = slopeAt(x) * RAD;
        const into = Math.abs(-vx * Math.sin(slope) - vy * Math.cos(slope));
        expect((into * into) / (2 * 9.81)).toBeLessThan(0.6);
      }
      expect(met).toBe(true);
    }
  });
});

describe("the big air jump set on a map (R37)", () => {
  const level = setBigAir(levelFor(1));
  const course = level.bigAir;

  it("is set, its start gate and finish line its only gates", () => {
    expect(course).toBeDefined();
    expect(level.checkpoints).toHaveLength(2);
    expect(level.track.closed).toBe(false);
    expect(level.slalom ?? level.downhill ?? level.speedSki).toBeUndefined();
  });

  it("is graded to its profile along its line", () => {
    if (!course) throw new Error("no jump");
    const p = jumpProfile();
    const base = level.track.points[0];
    const y0 = level.groundAt(base.x, base.z) - jumpHeightAt(p, base.s);
    for (const pt of level.track.points) {
      expect(Math.abs(level.groundAt(pt.x, pt.z) - y0 - jumpHeightAt(p, pt.s))).toBeLessThan(0.15);
    }
  });

  it("is clear of trees, and its kicker is the only one on it", () => {
    if (!course) throw new Error("no jump");
    const pts = level.track.points;
    const near = (x: number, z: number, r: number): boolean =>
      pts.some((pt) => Math.hypot(x - pt.x, z - pt.z) < r);
    // Only the trees and kickers within reach of the line's box are asked.
    const xs = pts.map((pt) => pt.x);
    const zs = pts.map((pt) => pt.z);
    const box = (x: number, z: number): boolean =>
      x > Math.min(...xs) - B.width &&
      x < Math.max(...xs) + B.width &&
      z > Math.min(...zs) - B.width &&
      z < Math.max(...zs) + B.width;
    for (const t of level.trees) if (box(t.x, t.z)) expect(near(t.x, t.z, B.width / 2)).toBe(false);
    const on = (level.kickers ?? []).filter((k) => near(k.x, k.z, B.width / 2));
    expect(on.map((k) => k.id)).toEqual(["BA"]);
  });
});

describe("big air as a mode", () => {
  it("is the strict gates, the tricks, the real g and the raised ceilings", () => {
    const r = MODE_RULES.bigAir(1);
    expect(r.gates).toBe("strict");
    expect(r.tricks).toBe(true);
    expect(r.stunts).toBe(true);
    expect(r.rivals).toBe(0);
    expect(r.spinMost).toBeGreaterThanOrEqual(10 * Math.PI);
    expect(r.flipMost).toBeGreaterThanOrEqual(6 * Math.PI);
  });

  it("opens on the big-air pair and the medium build", () => {
    expect(raceSkisOf("bigAir")).toBe("raven");
    expect(skisById(BIG_AIR.skis).kind).toBe("Big air");
    expect(raceRiderOf("bigAir")).toBe("medium");
  });

  it("carries a fresh contest off the seed", () => {
    const state = createGame({ seed: 1, mode: "bigAir", quiet: true });
    expect(state.level.bigAir).toBeDefined();
    expect(state.bigAir).toEqual(freshBigAir(state.seed));
  });

  it("is jumped by the bot off the lip at the design speed and landed", () => {
    const r = simulateRun(1, { mode: "bigAir", spec: skisById("raven") });
    expect(r.finished).toBe(true);
    expect(r.out).toBeNull();
    expect(r.bestAir).toBeGreaterThan(1.2);
    expect(r.harshLandings).toBe(0);
    expect(r.wipeouts).toBe(0);
  });
});

/** A flight as `tricks.ts` files one. */
function flight(over: Partial<FlightRecord> = {}): FlightRecord {
  return {
    flight: 1,
    flip: 0,
    spin: 0,
    grabs: [],
    air: 2.2,
    length: 30,
    height: 2,
    switchIn: false,
    switchOut: false,
    landing: 0.3,
    outcome: "landed",
    t: 10,
    ...over,
  };
}

describe("the judges", () => {
  it("read a flight as the trick it turned", () => {
    const r = readTrick(flight({ spin: -4 * Math.PI + 0.2, flip: 2 * Math.PI * 2 - 0.3 }));
    expect(r.spin).toBe(720);
    expect(r.dir).toBe("left");
    expect(r.flips).toBe(2);
    expect(r.flipDir).toBe("back");
    expect(r.offAxis).toBe(true);
    expect(trickKind(r)).toBe("left");
    expect(trickKind(readTrick(flight({ flip: -2 * Math.PI })))).toBe("front");
    expect(trickKind(readTrick(flight()))).toBe("straight");
  });

  it("score a harder trick higher, a fall low and a knuckled jump down", () => {
    const table = B.table;
    const straight = impressionOf(flight({ grabs: ["grab"] }), table, false);
    const cork = impressionOf(flight({ spin: 8 * Math.PI, flip: 4 * Math.PI }), table, false);
    const fell = impressionOf(
      flight({ spin: 8 * Math.PI, flip: 4 * Math.PI, outcome: "fell" }),
      table,
      false,
    );
    const short = impressionOf(flight({ length: table - 2 }), table, false);
    expect(cork).toBeGreaterThan(straight + 30);
    expect(fell).toBeLessThan(JUDGING.fall + JUDGING.fallSpan + 0.01);
    expect(short).toBeLessThan(impressionOf(flight(), table, false));
  });

  it("drop the highest and lowest of six marks and cut the mean to two decimals", () => {
    for (let jump = 0; jump < 20; jump++) {
      const s = panelScore(70.4, 7, jump);
      expect(Math.abs(s - 70.4)).toBeLessThanOrEqual(JUDGING.spread + 0.5);
      expect(Math.round(s * 100)).toBeCloseTo(s * 100, 6);
      expect(panelScore(70.4, 7, jump)).toBe(s);
    }
  });
});

describe("the contest", () => {
  const jump = (score: number, kind: string | null = "left"): BigAirJump => ({
    score,
    kind,
    fell: false,
  });

  it("counts the qualification's best jump, and the final's best two different", () => {
    expect(totalOf("qualification", [jump(40), jump(80)])).toBe(80);
    expect(totalOf("final", [jump(90, "left"), jump(85, "left"), jump(60, "right")])).toBe(150);
    expect(totalOf("final", [jump(90, "left"), jump(85, "right"), jump(60, "right")])).toBe(175);
  });

  it("deals the field the same every time", () => {
    expect(rivalJump(5, 3, "final", 1)).toEqual(rivalJump(5, 3, "final", 1));
    expect(boardOf(freshBigAir(5), "qualification", 2)).toHaveLength(BIG_AIR.field + 1);
  });

  /** A finished run of a contest with `flights` on it. */
  function run(contest: BigAirContest, flights: FlightRecord[], out = false): GameState {
    const state = createGame({ seed: 3, mode: "bigAir", quiet: true, bigAir: contest });
    state.tricks.flights = flights;
    state.progress.finished = !out;
    if (out) state.progress.out = { status: "dnf", why: "fall", gate: 1 };
    return state;
  }

  it("takes a clean double cork to the final and a fall and a stop out of it", () => {
    let won = freshBigAir(3);
    const big = flight({ spin: 10 * Math.PI, flip: 4 * Math.PI, landing: 0.1 });
    for (let k = 0; k < BIG_AIR.qualification; k++) won = contestAfter(run(won, [big])) ?? won;
    expect(nextPhase(won)).toBe("final");
    expect(won.final).toEqual([]);

    let lost = freshBigAir(3);
    lost = contestAfter(run(lost, [flight({ outcome: "fell" })], true)) ?? lost;
    lost = contestAfter(run(lost, [])) ?? lost;
    expect(lost.qualification[1].score).toBe(0);
    expect(lost.final).toBeNull();
    expect(nextPhase(lost)).toBeNull();
  });
});

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DUAL MOGULS (R43): the course of two lanes built to the rules (one
// rhythm, the air bumps level across, each lane's own gates), the panel's
// votes, the ladder and its rounds dealt off the contest's own streams, a
// dual skied — the rival in the other lane, the centre line, the votes —
// and the bot down both kinds of run.

import { describe, expect, it } from "vitest";

import {
  DUAL_LADDER,
  DUAL_MOGULS,
  DUAL_MOGULS_RULE,
  DUAL_ROUNDS,
  MODE_RULES,
  advanceDual,
  botInput,
  createGame,
  dualContestAfter,
  dualDone,
  dualPlace,
  dualQualified,
  dualStandings,
  dualsOf,
  duelOn,
  fieldCoords,
  freshDual,
  judgeDuel,
  ladder,
  laneOf,
  mogulsAt,
  mogulsProfile,
  nextDuel,
  raceRiderOf,
  raceSkisOf,
  setDualMoguls,
  simulateRun,
  skisById,
  step,
  voteDual,
  NEUTRAL_INPUT,
  type DualContest,
  type DualRead,
  type MogulRun,
} from "@engine";
import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { levelFor } from "./support/levels.ts";

const R = DUAL_MOGULS_RULE;
const pace = mogulsProfile(R).length / 10.3;

/** A qualification run that wins it, or one that scores `score`. */
const run = (score: number, fell = false): MogulRun => ({
  score,
  turns: score * 0.6,
  air: score * 0.2,
  airRaw: score * 0.2,
  speed: score * 0.2,
  time: pace,
  fell,
});

describe("the dual course (R43)", () => {
  const level = setDualMoguls(levelFor(1));
  const dual = level.dualMoguls!;
  const f = level.bumps!;

  it("is the top series' 220 m, two lanes either side of the line", () => {
    expect(mogulsProfile(R).length).toBeGreaterThan(R.course);
    expect(mogulsProfile(R).length).toBeLessThan(R.course + R.round);
    expect(dual.lanes.map((l) => l.colour)).toEqual(["blue", "red"]);
    // Looking up the hill the blue is on the left: right of the line down.
    expect(dual.lanes[0].offset).toBeGreaterThan(0);
    expect(dual.lanes[1].offset).toBe(-dual.lanes[0].offset);
    expect(dual.lanes[0].offset - dual.lanes[1].offset).toBeGreaterThanOrEqual(4.5);
  });

  it("lays both mogul lines on one rhythm, so neither lane is the faster", () => {
    expect(f.lines).toHaveLength(2);
    const along = (f.gaps[0][1] + f.gaps[1][0]) / 2;
    for (let d = 0; d < 7; d += 0.5) {
      const blue = mogulsAt(f, along + d, dual.lanes[0].offset);
      const red = mogulsAt(f, along + d, dual.lanes[1].offset);
      expect(blue).toBeCloseTo(red, 9);
    }
  });

  it("gives each lane its own gates, the map skied in one of them", () => {
    for (const lane of [0, 1] as const) {
      const map = laneOf(level, lane);
      expect(map.dualMoguls?.lane).toBe(lane);
      expect(map.checkpoints).toHaveLength(R.gates + 2);
      for (const g of map.checkpoints) {
        expect(fieldCoords(f, g.x, g.z).across).toBeCloseTo(dual.lanes[lane].offset, 6);
      }
      expect(fieldCoords(f, map.spawn.x, map.spawn.z).across).toBeCloseTo(
        dual.lanes[lane].offset,
        6,
      );
    }
    expect(setDualMoguls(levelFor(1))).toBe(level);
  });

  it("is ridden on the moguls' pair at the moguls' build", () => {
    expect(raceSkisOf("dualMoguls")).toBe("ibex");
    expect(raceRiderOf("dualMoguls")).toBe("medium");
    expect(MODE_RULES.dualMoguls(1).technique).toBe("moguls");
  });
});

describe("the votes", () => {
  const read = (r: Partial<DualRead>): DualRead => ({
    turns: 45,
    air: 14,
    codes: ["360", "b1x0"],
    out: false,
    at: 25,
    ...r,
  });

  it("are 35, every judge's five split between the two, a majority winning", () => {
    for (let s = 1; s < 20; s++) {
      const v = voteDual(read({}), read({ turns: 40 + s / 2 }), createRng(s));
      expect(v.votes[0] + v.votes[1]).toBe(35);
      expect(v.turns[0] + v.turns[1]).toBe(20);
      expect(v.air[0] + v.air[1]).toBe(10);
      expect(v.speed[0] + v.speed[1]).toBe(5);
      expect(v.votes[v.winner]).toBeGreaterThan(17);
    }
  });

  it("splits the speed judge's five off the gap: 3–2, 4–1, 5–0", () => {
    const speed = (gap: number): number =>
      voteDual(read({}), read({ at: 25 + gap }), createRng(1)).speed[0];
    expect(speed(0.5)).toBe(3);
    expect(speed(1)).toBe(4);
    expect(speed(2)).toBe(5);
    expect(speed(-2)).toBe(0);
  });

  it("gives a dual to the skier who finished, both out to the one out later", () => {
    expect(voteDual(read({ out: true }), read({}), createRng(1)).winner).toBe(1);
    expect(voteDual(read({}), read({ out: true }), createRng(1)).votes).toEqual([35, 0]);
    expect(
      voteDual(read({ out: true, at: 9 }), read({ out: true, at: 4 }), createRng(1)).winner,
    ).toBe(0);
  });

  it("moves two votes of each air judge off a repeated jump", () => {
    const fair = voteDual(read({}), read({}), createRng(3));
    const rep = voteDual(read({ codes: ["360", "360"] }), read({}), createRng(3));
    expect(rep.air[0]).toBeLessThan(fair.air[0]);
  });
});

describe("the format", () => {
  const won: DualContest = { ...freshDual(7, pace), qualifying: run(99) };

  it("seeds a ladder of sixteen, the top eight on their places, 9–16 drawn", () => {
    const l = ladder(won);
    expect(l).toHaveLength(DUAL_MOGULS.ladder);
    DUAL_LADDER.forEach((s, i) => {
      if (s <= DUAL_MOGULS.kept) expect(l[i].seed).toBe(s);
      else expect(l[i].seed).toBeGreaterThan(DUAL_MOGULS.kept);
    });
    expect(new Set(l.map((e) => e.seed)).size).toBe(16);
    expect(ladder(won)).toEqual(l);
  });

  it("puts the player's first dual in the eighth-finals, the higher seed in blue", () => {
    const d = nextDuel(won)!;
    expect(d.round).toBe("eighth");
    expect(d.lanes[0].id).toBeNull();
    expect(d.lanes[0].seed).toBeLessThan(d.lanes[1].seed);
  });

  it("deals every other dual and, once he is out, every round to the end", () => {
    const first = nextDuel(won)!;
    const lost = advanceDual(won, {
      heat: first,
      votes: voteDual(
        { turns: 30, air: 5, codes: [], out: false, at: 30 },
        { turns: 50, air: 15, codes: [], out: false, at: 25 },
        createRng(1),
      ),
      out: [false, false],
    });
    expect(nextDuel(lost)).toBeNull();
    expect(dualDone(lost)).toBe(true);
    for (const round of DUAL_ROUNDS) expect(dualsOf(lost, round)).not.toBeNull();
    const all = dualStandings(lost);
    expect(new Set(all.map((e) => e.id)).size).toBe(DUAL_MOGULS.field + 1);
    expect(dualPlace(lost)).toBeGreaterThan(8);
    expect(dualPlace(lost)).toBeLessThanOrEqual(16);
  });

  it("leaves a skier who did not make the ladder out of it", () => {
    const short = { ...freshDual(7, pace), qualifying: run(10) };
    expect(dualQualified(short)).toBe(false);
    expect(nextDuel(short)).toBeNull();
    expect(dualPlace(advanceDual(short, null))).toBeGreaterThan(16);
  });
});

describe("a dual skied", () => {
  const won: DualContest = { ...freshDual(3, pace), qualifying: run(99) };

  it("stands the rival in the other lane, out of the gates together", () => {
    const s = createGame({ seed: 3, mode: "dualMoguls", dualMoguls: won, quiet: true });
    expect(s.duel?.lane).toBe(0);
    expect(s.rivals).toHaveLength(1);
    const rival = s.rivals[0].run;
    expect(rival.level.dualMoguls?.lane).toBe(1);
    expect(s.rules.start).toBe("gate");
    expect(s.rules.contact).toBe(false);
    expect(s.rules.countdown).toBeGreaterThanOrEqual(DUAL_MOGULS.ready);
    expect(s.rules.countdown).toBeLessThan(DUAL_MOGULS.ready + DUAL_MOGULS.release);
  });

  it("puts out a skier whose skis cross the centre line", () => {
    const s = createGame({
      seed: 3,
      mode: "dualMoguls",
      dualMoguls: won,
      spec: skisById("ibex"),
      countdown: 0,
      quiet: true,
    });
    // Down the slope and across, into the red lane.
    for (let i = 0; i < 120 * 20 && !s.progress.finished; i++) {
      step(s, { ...NEUTRAL_INPUT, tuck: 1, steer: s.progress.started ? -0.4 : 0 });
    }
    expect(s.progress.out?.why).toBe("lane");
  });

  it("is decided by the votes once both runs are over, and the next dual follows", () => {
    const r = simulateRun(3, { mode: "dualMoguls", heat: true, spec: skisById("ibex") });
    expect(r.finished).toBe(true);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(35);
    const s = createGame({
      seed: 3,
      mode: "dualMoguls",
      dualMoguls: won,
      spec: skisById("ibex"),
      quiet: true,
    });
    expect(judgeDuel(s)).toBeNull();
    for (let i = 0; i < 120 * 60 && (s.phase !== "finished" || duelOn(s)); i++)
      step(s, botInput(s));
    const after = dualContestAfter(s);
    expect(after?.results.filter((x) => x.heat.round === "eighth")).toHaveLength(8);
  });
});

describe("the qualification", () => {
  it("is a moguls run alone in the blue lane, filed into a contest", () => {
    const r = simulateRun(2, { mode: "dualMoguls", spec: skisById("ibex") });
    expect(r.finished).toBe(true);
    expect(r.score).toBeGreaterThan(50);
    expect(r.place).toBe(1);
  });
});

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI JUMPING CONTEST (R43, `ski-jump-contest.ts`): the trial round, the
// first round of fifty, the best thirty to the final in reverse order, the
// totals and the shared places; the field dealt about the hill's par in the
// hill's own air (`jump-wind.ts`) — head and tail winds both, the jury's
// gate lowered for a head wind — and a jump jumped by the real engine from
// the jury's gate at the player's moment, scored and filed.

import { describe, expect, it } from "vitest";

import {
  RIDER_BOT,
  SKI_JUMP,
  botInput,
  createGame,
  fileSkiJump,
  finalists,
  freshSkiJumpContest,
  gateFor,
  hillMeanAt,
  judgeSkiJumpRun,
  noStart,
  roundPlan,
  scoreJump,
  setSkiJump,
  skiJumpBoard,
  skiJumpContestAfter,
  skiJumpPlace,
  skiJumpRoundOf,
  skiJumpSetup,
  skiJumpStandings,
  skipTrial,
  startList,
  step,
  type JumpRun,
  type SkiJumpContest,
} from "@engine";
import { levelFor } from "./support/levels.ts";

const LEVEL = setSkiJump(levelFor(1), "large");
const HILL = LEVEL.skiJump!;

/** A first-round jump of the player's of `distance` m, marked `mark`. */
function mine(c: SkiJumpContest, distance: number, mark = 18): JumpRun {
  const v = c.venue;
  const ref = roundPlan(c, "first").reference;
  return scoreJump(
    v,
    { number: v.numbers[ref], inRun: v.inRun[ref], reference: v.inRun[ref] },
    distance,
    [mark, mark, mark, mark, mark],
    0,
    false,
  );
}

describe("a ski jumping contest (R43)", () => {
  it("has a trial round, a first round and a final, and the trial may be skipped", () => {
    const c = freshSkiJumpContest(5, LEVEL);
    expect(c.rounds).toEqual(["trial", "first", "final"]);
    expect(skiJumpRoundOf(c)).toBe("trial");
    const s = skipTrial(c);
    expect(skiJumpRoundOf(s)).toBe("first");
    expect(skipTrial(s)).toBe(s);
    expect(skiJumpRoundOf(freshSkiJumpContest(5, LEVEL, { trial: false }))).toBe("first");
  });

  it("starts fifty in the first round, the best last", () => {
    const c = freshSkiJumpContest(5, LEVEL, { trial: false });
    const list = startList(c, "first");
    expect(list).toHaveLength(SKI_JUMP.field + 1);
    expect(list).toContain(-1);
    const board = skiJumpBoard(c, "first");
    expect(board.filter((r) => r.jump)).toHaveLength(SKI_JUMP.field);
  });

  it("places the board on points, a tie sharing its place and displacing the next", () => {
    for (const seed of [1, 2, 3, 4]) {
      const board = skiJumpBoard(freshSkiJumpContest(seed, LEVEL, { trial: false }), "first");
      const jumped = board.filter((r) => r.jump);
      for (let i = 1; i < jumped.length; i++) {
        const a = jumped[i - 1];
        const b = jumped[i];
        expect(a.jump!.points).toBeGreaterThanOrEqual(b.jump!.points);
        if (a.jump!.points === b.jump!.points) expect(b.place).toBe(a.place);
        else expect(b.place).toBe(i + 1);
      }
    }
  });

  it("puts the best thirty through to the final in reverse order, the leader last", () => {
    const c = fileSkiJump(
      freshSkiJumpContest(9, LEVEL, { trial: false }),
      mine(freshSkiJumpContest(9, LEVEL, { trial: false }), HILL.w),
    );
    const first = skiJumpBoard(c, "first");
    const through = finalists(c);
    expect(through.length).toBeGreaterThanOrEqual(SKI_JUMP.final);
    expect(through.length).toBeLessThanOrEqual(SKI_JUMP.final + 3);
    const order = startList(c, "final");
    expect(order).toEqual([...through].reverse());
    const points = order.map((id) => first.find((r) => r.id === id)!.jump!.points);
    for (let i = 1; i < points.length; i++) expect(points[i]).toBeGreaterThanOrEqual(points[i - 1]);
    expect(order[order.length - 1]).toBe(first[0].id);
  });

  it("lets a long first jump into the final and keeps a short one out", () => {
    const fresh = freshSkiJumpContest(9, LEVEL, { trial: false });
    const long = fileSkiJump(fresh, mine(fresh, HILL.hs - 2, 19));
    expect(skiJumpPlace(long, "first")).toBeLessThanOrEqual(5);
    expect(skiJumpRoundOf(long)).toBe("final");
    const plan = skiJumpSetup(long)!;
    expect(plan.round).toBe("final");
    expect(startList(long, "final")).toContain(-1);
    const short = fileSkiJump(fresh, mine(fresh, HILL.w - 40, 15));
    expect(skiJumpPlace(short, "first")).toBeGreaterThan(SKI_JUMP.final);
    expect(skiJumpRoundOf(short)).toBeNull();
    expect(skiJumpSetup(short)).toBeNull();
    expect(startList(short, "final")).not.toContain(-1);
    const none = fileSkiJump(fresh, { ...noStart(22) });
    expect(skiJumpRoundOf(none)).toBeNull();
  });

  it("totals both rounds for the finalists, the rest after them on their first", () => {
    const fresh = freshSkiJumpContest(11, LEVEL, { trial: false });
    const c1 = fileSkiJump(fresh, mine(fresh, HILL.w + 4, 18.5));
    expect(skiJumpRoundOf(c1)).toBe("final");
    const c2 = fileSkiJump(c1, mine(c1, HILL.w, 18));
    expect(skiJumpRoundOf(c2)).toBeNull();
    const rows = skiJumpStandings(c2);
    expect(rows).toHaveLength(SKI_JUMP.field + 1);
    const n = finalists(c2).length;
    for (const r of rows.slice(0, n)) {
      expect(r.final).not.toBeNull();
      expect(r.total).toBeCloseTo(r.first!.points + r.final!.points, 6);
    }
    for (const r of rows.slice(n)) expect(r.final).toBeNull();
    for (let i = 1; i < n; i++) expect(rows[i].total).toBeLessThanOrEqual(rows[i - 1].total);
    const me = rows.find((r) => r.id === -1)!;
    expect(me.place).toBeGreaterThan(0);
    expect(me.total).toBeCloseTo(c2.jumps[0]!.points + c2.jumps[1]!.points, 6);
  });

  it("is dealt the same every time, and differently off another seed", () => {
    const a = skiJumpBoard(freshSkiJumpContest(21, LEVEL), "first");
    const b = skiJumpBoard(freshSkiJumpContest(21, LEVEL), "first");
    expect(a).toEqual(b);
    const c = skiJumpBoard(freshSkiJumpContest(22, LEVEL), "first");
    expect(c.map((r) => r.jump?.points)).not.toEqual(a.map((r) => r.jump?.points));
  });

  it("deals a large-hill field: the best near HS, the thirtieth some metres short of K", () => {
    let falls = 0;
    let jumps = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const c = freshSkiJumpContest(seed, LEVEL, { trial: false });
      const d = skiJumpBoard(c, "first")
        .filter((r) => r.jump)
        .map((r) => r.jump!.distance)
        .sort((x, y) => y - x);
      expect(d[0]).toBeGreaterThan(0.88 * HILL.hs);
      expect(d[0]).toBeLessThan(HILL.hs + 6);
      expect(d[29]).toBeGreaterThan(HILL.w - 25);
      expect(d[29]).toBeLessThan(HILL.w);
      const board = skiJumpBoard(c, "first").filter((r) => r.jump);
      falls += board.filter((r) => r.jump!.fell).length;
      jumps += board.length;
      for (const r of board.filter((x) => !x.jump!.fell)) {
        expect(r.jump!.style).toBeGreaterThanOrEqual(45);
        expect(r.jump!.style).toBeLessThanOrEqual(58.5);
      }
    }
    expect(falls / jumps).toBeLessThan(0.05);
  });

  it("blows head and tail winds both across contests, and lowers the gate for a head wind", () => {
    const means: number[] = [];
    for (let seed = 1; seed <= 60; seed++) {
      const c = freshSkiJumpContest(seed, LEVEL);
      means.push(hillMeanAt(c.air, 2408), hillMeanAt(c.air, 6608));
    }
    expect(means.filter((m) => m < -0.3).length).toBeGreaterThan(10);
    expect(means.filter((m) => m > 0.3).length).toBeGreaterThan(10);
    for (const m of means) expect(Math.abs(m)).toBeLessThan(4);
    const v = freshSkiJumpContest(1, LEVEL).venue;
    expect(gateFor(v, 2)).toBeLessThan(gateFor(v, 0));
    expect(gateFor(v, -2)).toBeGreaterThanOrEqual(gateFor(v, 0));
  });

  it("jumps the player's turn from the jury's gate at his moment, scores it and files it", () => {
    const c = freshSkiJumpContest(3, LEVEL, { trial: false });
    const setup = skiJumpSetup(c)!;
    const state = createGame({ level: LEVEL, mode: "skiJump", skiJumpContest: c, quiet: true });
    expect(state.jump!.gate).toBe(setup.gate);
    expect(state.jump!.air.clock).toBe(setup.at);
    expect(judgeSkiJumpRun(state)).toBeNull();
    for (let i = 0; i < 40 * 120 && state.phase !== "finished"; i++) {
      step(state, botInput(state, RIDER_BOT));
    }
    const r = state.jump!.record;
    // The stations he passed, the edge's first: four short of K, five past it.
    expect(r.stations).toHaveLength(r.distance >= HILL.w ? 5 : 4);
    const sum = r.stations.reduce((s, w) => s + w, 0);
    expect(r.measured).toBeCloseTo(sum / r.stations.length, 2);
    const scored = judgeSkiJumpRun(state)!;
    expect(scored.distance).toBe(r.distance);
    expect(scored.wind).toBe(r.measured);
    expect(scored.points).toBeGreaterThan(60);
    const after = skiJumpContestAfter(state)!;
    expect(after.jumps).toHaveLength(1);
    expect(after.jumps[0]!.record!.distance).toBe(r.distance);
    const place = skiJumpPlace(after, "first");
    expect(place).toBeGreaterThan(0);
    expect(place).toBeLessThanOrEqual(25);
  });
});

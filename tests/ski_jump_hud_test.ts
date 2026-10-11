// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SKI JUMPING AS THE APP READS IT (`ski-jump-run.ts`): the jump on the HUD
// — the bar's light, wind, gate, bib and leader, the in-run's speed, the
// take-off's word, the attitude in the air and the distance down — the
// points part by part and the board once it is over, the round flow (the
// trial, round 1, the final and the result, and out of the final), the
// contest the next jump is stood up with, and the links, the book and the
// replay.

import { describe, expect, it } from "vitest";

import {
  SKI_JUMP,
  createGame,
  styleOf,
  type GameState,
  type JumpLanding,
  type SkiJumpContest,
} from "@engine";

import { keepsRecords, mergeRecords } from "../pwa/src/game/records.ts";
import { keepsReplay, recipeOf } from "../pwa/src/game/replay.ts";
import {
  leaderOf,
  nextSkiJumpContest,
  skiJumpOf,
  takeOffWord,
  withJumpContest,
} from "../pwa/src/game/ski-jump-run.ts";
import { readStats } from "../pwa/src/game/stats.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { linkWorld, readParams } from "../pwa/src/game/url-params.ts";
import { levelFor } from "./support/levels.ts";

const BASE = levelFor(1);

/** A ski jump on seed 1's hill, in `contest` (a fresh one when left out). */
function onBar(contest?: SkiJumpContest): GameState {
  return createGame(
    withJumpContest({
      level: BASE,
      seed: 1,
      mode: "skiJump",
      quiet: true,
      ...(contest ? { skiJumpContest: contest } : {}),
    }),
  );
}

/** A jump down at `distance` m, ridden out as `landing` says. */
function landed(
  contest: SkiJumpContest | undefined,
  distance: number,
  landing: JumpLanding = "telemark",
): GameState {
  const state = onBar(contest);
  const j = state.jump!;
  state.phase = "racing";
  j.stage = "down";
  j.edgeAt = 1;
  Object.assign(j.record, {
    edgeSpeed: 25.5,
    inRunSpeed: 25.3,
    timing: 0,
    share: 1,
    flightTime: 5,
    distance,
    reach: distance,
    landing,
    outcome: landing === "fall" ? "fall" : "clean",
  });
  return state;
}

describe("ski jumping on the HUD", () => {
  it("reads the bar: the trial round, the red light through the count, the gate, the bib", () => {
    const state = onBar();
    const hud = skiJumpOf(state)!;
    expect(hud.round).toBe("trial");
    expect(hud.stage).toBe("bar");
    expect(hud.light).toBe("red");
    expect(hud.hs).toBe(state.level.skiJump!.hs);
    expect(hud.gate).toBe(state.level.skiJump!.gates[state.jump!.gate].number);
    expect(hud.bib).toBeGreaterThanOrEqual(1);
    expect(hud.of).toBe(SKI_JUMP.field + 1);
    expect(hud.judged).toBeNull();
    expect(hud.board).toEqual([]);
    expect(hud.next).toBeNull();
  });

  it("turns the light green once the count is done, and names the leader to beat", () => {
    const state = onBar();
    state.phase = "racing";
    state.t = state.rules.countdown + 2;
    const hud = skiJumpOf(state)!;
    expect(hud.light).toBe("green");
    expect(hud.left).toBeCloseTo(state.rules.window - 2, 6);
    const leader = leaderOf(state.skiJumpContest!);
    if (hud.bib > 1) {
      expect(leader?.points).toBeGreaterThan(0);
      expect(leader!.toBeat * 2).toBe(Math.round(leader!.toBeat * 2));
    }
  });

  it("reads the in-run's speed, the take-off's word and the attitude in the air", () => {
    const state = onBar();
    const j = state.jump!;
    j.stage = "tracks";
    j.speed = 24;
    expect(skiJumpOf(state)!.speed).toBeCloseTo(86.4, 6);
    j.stage = "air";
    j.edgeAt = state.t;
    j.record.edgeSpeed = 25;
    j.record.timing = 0.01;
    const edge = skiJumpOf(state)!;
    expect(edge.edgeSpeed).toBeCloseTo(90, 6);
    expect(edge.takeOff).toBe("perfect");
    expect(edge.attitude).toBeNull();
    state.t += 2;
    const air = skiJumpOf(state)!;
    expect(air.takeOff).toBeNull();
    expect(air.attitude).not.toBeNull();
    expect(takeOffWord(-0.08)).toBe("early");
    expect(takeOffWord(0.08)).toBe("late");
    expect(takeOffWord(null)).toBe("none");
  });

  it("scores a landed jump part by part, the plate's numbers off the staged jump", () => {
    const state = landed(undefined, 131.5);
    const hud = skiJumpOf(state)!;
    expect(hud.distance).toBe(131.5);
    const p = hud.judged!;
    expect(p.distance).toBe(131.5);
    expect(p.marks).toHaveLength(5);
    expect(p.style).toBe(styleOf(p.marks));
    expect(p.points).toBeCloseTo(p.distancePoints + p.style + p.gatePoints + p.windPoints, 1);
    expect(hud.board.length).toBeGreaterThan(0);
    expect(hud.board.length).toBeLessThanOrEqual(11);
    expect(hud.board.some((r) => r.you)).toBe(true);
  });

  it("goes trial → round 1 → the final → the result", () => {
    const trial = landed(undefined, 128);
    expect(skiJumpOf(trial)!.next).toEqual(
      expect.objectContaining({ kind: "round", round: "first" }),
    );
    const c1 = nextSkiJumpContest(trial)!;
    const first = landed(c1, 142);
    expect(skiJumpOf(first)!.round).toBe("first");
    const through = skiJumpOf(first)!.next!;
    expect(through.kind).toBe("round");
    expect(through.kind === "round" && through.round).toBe("final");
    const c2 = nextSkiJumpContest(first)!;
    const final = landed(c2, 141);
    const hud = skiJumpOf(final)!;
    expect(hud.round).toBe("final");
    expect(hud.total).toBeGreaterThan(hud.judged!.points);
    expect(hud.next?.kind).toBe("done");
    expect(hud.board[0].distances).toHaveLength(2);
    expect(nextSkiJumpContest(final)).toBeNull();
  });

  it("puts a short fall in round 1 out of the final", () => {
    const c1 = nextSkiJumpContest(landed(undefined, 128))!;
    const state = landed(c1, 70, "fall");
    const hud = skiJumpOf(state)!;
    expect(hud.judged?.fell).toBe(true);
    expect(hud.next?.kind).toBe("out");
    expect(nextSkiJumpContest(state)).toBeNull();
  });

  it("skips the trial for a link that asks for round 1", () => {
    const state = createGame(
      withJumpContest({ level: BASE, seed: 1, mode: "skiJump", quiet: true }, "first"),
    );
    expect(skiJumpOf(state)!.round).toBe("first");
  });

  it("carries the contest in a replay's recipe, keeps no book and is recorded", () => {
    const state = onBar();
    const recipe = recipeOf(state, "skiJump");
    expect(recipe.skiJumpContest).toEqual(state.skiJumpContest);
    expect(recipe.gate).toBe(state.jump!.gate);
    expect(keepsRecords("skiJump")).toBe(false);
    expect(keepsReplay("skiJump")).toBe(true);
  });

  it("is booted by a link, its gate and round with it", () => {
    const q = readParams("?start=skijump&gate=7&round=1");
    expect(q.mode).toBe("skiJump");
    expect(q.rides).toBe(true);
    expect(q.gate).toBe(7);
    expect(linkWorld(q).gate).toBe(6);
    expect(linkWorld(q).round).toBe("first");
    expect(readParams("?mode=skijump&seed=3").mode).toBe("skiJump");
    expect(readParams("?start=skijump&gate=0").gate).toBeNull();
  });

  it("drops big air's stored rows and figures on read", () => {
    expect(readParams("?start=bigair").mode).toBe("slalom");
    const book = mergeRecords({
      "bigAir/4/raven/1": { value: 80, skis: "raven", at: 1 },
      "slalom/4/swift/1": { value: 50, skis: "swift", at: 1 },
    });
    expect(Object.keys(book)).toEqual(["slalom/4/swift/1"]);
    const stats = readStats({
      v: 1,
      modes: {
        bigAir: { runs: 2, time: 30, distance: 400 },
        slalom: { runs: 1, time: 40, distance: 600 },
      },
      bests: { top: { value: 70, mode: "bigAir", skis: "raven", seed: 4, at: 3 } },
    });
    expect(Object.keys(stats.modes)).toEqual(["slalom"]);
    expect(stats.bests.top).toBeNull();
  });

  it("words the bar, the moments and the plate", () => {
    expect(STRINGS.freestyle.skiJump).toBe("SKI JUMPING");
    expect(STRINGS.skiJumpWind(-1.24)).toBe("TAIL 1.2 m/s");
    expect(STRINGS.skiJumpTakeOff("perfect")).toBe("PERFECT");
    expect(STRINGS.skiJumpDistance(131.5)).toBe("131.5 m");
    expect(STRINGS.skiJumpGatePoints(12, 3.42)).toBe("GATE 12 · +3.4");
    expect(STRINGS.skiJumpWindPoints(1.2, -10.6)).toBe("WIND +1.2 m/s · −10.6");
    expect(STRINGS.skiJumpRow([124.5], 132.4, false, false)).toBe("124.5 m · 132.4");
    expect(STRINGS.skiJumpRow([124.5, 128], 265.3, false, false)).toBe("124.5 · 128.0 · 265.3");
    expect(STRINGS.skiJumpTitle("final", 140)).toBe("SKI JUMPING · HS 140 · FINAL ROUND");
    expect(STRINGS.keyTrick).toContain("TELEMARK");
  });
});

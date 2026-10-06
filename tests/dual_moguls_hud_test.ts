// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DUAL MOGULS AS THE APP READS THEM (`dual-moguls-run.ts`): the run on the
// HUD — the round, the lanes, the start's call — the qualification scored
// and its board, a dual's votes once both lanes are home, what the plate
// offers next, the contest the next run is stood up with, and the links
// and the book.

import { describe, expect, it } from "vitest";

import { DUAL_MOGULS, createGame, freshDual, type DualContest, type GameState } from "@engine";

import { dualMogulsOf, nextDualContest } from "../pwa/src/game/dual-moguls-run.ts";
import { keepsRecords } from "../pwa/src/game/records.ts";
import { keepsReplay, recipeOf } from "../pwa/src/game/replay.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

/** A qualification finished at `time` s. */
function qualified(time = 12): GameState {
  const state = createGame({ seed: 4, mode: "dualMoguls", quiet: true });
  state.progress.started = true;
  state.progress.finished = true;
  state.progress.splits[0] = 0;
  state.progress.time = time;
  if (state.mogulTurns) {
    Object.assign(state.mogulTurns, { steps: 2000, turns: 90, skid: 200, swing: 80, line: 150 });
  }
  return state;
}

/** A contest whose qualification he won. */
function won(): DualContest {
  const c = freshDual(4, 22);
  return {
    ...c,
    qualifying: { score: 99, turns: 59, air: 20, airRaw: 20, speed: 20, time: 20, fell: false },
  };
}

describe("dual moguls on the HUD and the plate", () => {
  it("reads a fresh qualification: alone in the blue lane, not scored", () => {
    const hud = dualMogulsOf(createGame({ seed: 4, mode: "dualMoguls", quiet: true }))!;
    expect(hud.round).toBe("qualify");
    expect(hud.lane).toBeNull();
    expect(hud.rival).toBeNull();
    expect(hud.judged).toBeNull();
    expect(hud.next).toBeNull();
  });

  it("is null on any other run", () => {
    expect(dualMogulsOf(createGame({ seed: 4, mode: "moguls", quiet: true }))).toBeNull();
  });

  it("scores a fast clean qualification, boards it and offers the first dual", () => {
    const hud = dualMogulsOf(qualified())!;
    expect(hud.judged?.speed).toBe(20);
    expect(hud.board.some((r) => r.id === null)).toBe(true);
    expect(hud.next).toEqual({ kind: "duel", round: "eighth" });
    expect(hud.seed).not.toBeNull();
    expect(nextDualContest(qualified())?.qualifying).not.toBeNull();
  });

  it("stands a dual up with the lanes, the call and the rival, undecided", () => {
    const state = createGame({ seed: 4, mode: "dualMoguls", dualMoguls: won(), quiet: true });
    const hud = dualMogulsOf(state)!;
    expect(hud.round).toBe("eighth");
    expect(hud.lane).toBe("blue");
    expect(hud.call).toBe("blue");
    expect(hud.rival?.seed).toBeGreaterThan(8);
    expect(hud.votes).toBeNull();
    expect(hud.next).toBeNull();
  });

  it("decides a dual the other skier did not finish", () => {
    const state = createGame({ seed: 4, mode: "dualMoguls", dualMoguls: won(), quiet: true });
    const rival = state.rivals[0].run;
    state.progress.finished = true;
    state.progress.time = 24;
    rival.progress.finished = true;
    rival.progress.out = { status: "dnf", why: "lane", gate: 4 };
    state.duel!.ended = [24, 9];
    const hud = dualMogulsOf(state)!;
    expect(hud.votes?.votes).toEqual([35, 0]);
    expect(hud.out).toEqual([false, true]);
    expect(hud.next).toEqual({ kind: "duel", round: "quarter" });
  });

  it("carries the contest in a replay's recipe, keeps no book and is recorded", () => {
    const state = createGame({ seed: 4, mode: "dualMoguls", dualMoguls: won(), quiet: true });
    expect(recipeOf(state, "dualMoguls").dualMoguls).toEqual(state.dualMoguls);
    expect(keepsRecords("dualMoguls")).toBe(false);
    expect(keepsReplay("dualMoguls")).toBe(true);
  });

  it("is booted by a link", () => {
    expect(readParams("?start=dual").mode).toBe("dualMoguls");
    expect(readParams("?mode=dual&seed=3").mode).toBe("dualMoguls");
  });

  it("words the HUD and the plate", () => {
    expect(STRINGS.dualCall("red")).toBe("RED COURSE READY");
    expect(STRINGS.dualVotes(21, 14)).toBe("21 – 14");
    expect(STRINGS.dualRound("small")).toBe("SMALL FINAL");
    expect(STRINGS.freestyle.dualMoguls).toBe("DUAL MOGULS");
    expect(STRINGS.freestyleDual(DUAL_MOGULS.field + 1, DUAL_MOGULS.ladder)).toContain("16");
  });
});

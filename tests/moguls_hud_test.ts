// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// MOGULS AS THE APP READS THEM (`moguls-run.ts`): the run on the HUD — its
// phase, the pace and the airs — the formal score and the board once it is
// over, what the plate offers next, the contest the next run is stood up
// with, and the links and the book.

import { describe, expect, it } from "vitest";

import { MOGULS, createGame, type GameState, type MogulsContest } from "@engine";

import { mogulsOf, nextMogulsContest } from "../pwa/src/game/moguls-run.ts";
import { keepsRecords } from "../pwa/src/game/records.ts";
import { keepsReplay, recipeOf } from "../pwa/src/game/replay.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

/** A run finished at `time` s, in `contest`. */
function finished(contest?: MogulsContest, time = 25): GameState {
  const state = createGame({ seed: 4, mode: "moguls", quiet: true, moguls: contest });
  state.progress.started = true;
  state.progress.finished = true;
  state.progress.splits[0] = 0;
  state.progress.time = time;
  if (state.mogulTurns) {
    Object.assign(state.mogulTurns, { steps: 2000, turns: 90, skid: 200, swing: 80, line: 150 });
  }
  return state;
}

describe("moguls on the HUD and the plate", () => {
  it("reads a fresh run: the qualification, the pace, no air, not scored", () => {
    const hud = mogulsOf(createGame({ seed: 4, mode: "moguls", quiet: true }));
    expect(hud?.phase).toBe("qualification");
    expect(hud?.pace).toBeGreaterThan(20);
    expect(hud?.airs).toBe(0);
    expect(hud?.judged).toBeNull();
    expect(hud?.board).toEqual([]);
    expect(hud?.next).toBeNull();
  });

  it("is null on any other run", () => {
    expect(mogulsOf(createGame({ seed: 4, mode: "halfpipe", quiet: true }))).toBeNull();
  });

  it("scores a finished run, boards it and offers final 1 to a fast clean one", () => {
    const hud = mogulsOf(finished(undefined, 20))!;
    expect(hud.judged?.speed).toBe(20);
    expect(hud.board.some((r) => r.you)).toBe(true);
    expect(hud.next?.kind).toBe("final");
    expect(nextMogulsContest(finished(undefined, 20))?.runs).toHaveLength(1);
  });

  it("ends the contest for him out of the qualification", () => {
    const state = finished();
    state.progress.finished = false;
    state.progress.out = { status: "dnf", why: "fall", gate: 3 } as GameState["progress"]["out"];
    const hud = mogulsOf(state)!;
    expect(hud.judged?.fell).toBe(true);
    expect(hud.next?.kind).toBe("out");
    expect(nextMogulsContest(state)).toBeNull();
  });

  it("carries the contest in a replay's recipe, keeps no book and is recorded", () => {
    const state = createGame({ seed: 4, mode: "moguls", quiet: true });
    expect(recipeOf(state, "moguls").moguls).toEqual(state.moguls);
    expect(keepsRecords("moguls")).toBe(false);
    expect(keepsReplay("moguls")).toBe(true);
  });

  it("is booted by a link", () => {
    expect(readParams("?start=moguls").mode).toBe("moguls");
    expect(readParams("?mode=moguls&seed=3").mode).toBe("moguls");
  });

  it("words the HUD, the parts, a jump and the plate's lines", () => {
    expect(STRINGS.mogulsPace(24.04, 1)).toBe("PACE 24.0 · AIR 1/2");
    expect(STRINGS.mogulsParts(47.2, 12.4, 14.5)).toBe("TURNS 47.20 · AIR 12.40 · SPEED 14.50");
    expect(STRINGS.mogulsPhase("final2")).toBe("FINAL 2");
    expect(STRINGS.mogulsRow(0, true)).toBe("DNF");
    expect(STRINGS.freestyle.moguls).toBe("MOGULS");
    expect(STRINGS.freestyleMoguls(MOGULS.field + 1, MOGULS.final1, MOGULS.final2)).toContain("30");
  });
});

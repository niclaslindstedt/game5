// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HALFPIPE AS THE APP READS IT (`halfpipe-run.ts`): the run on the HUD
// — its phase, which run, the hits and the last one's height — the judges'
// sheet and the board once it is over, what the plate offers next, the
// contest the next run is stood up with, and the links and the book.

import { describe, expect, it } from "vitest";

import { HALFPIPE, createGame, type GameState, type PipeContest } from "@engine";

import { halfpipeOf, nextPipeContest } from "../pwa/src/game/halfpipe-run.ts";
import { keepsRecords } from "../pwa/src/game/records.ts";
import { keepsReplay, recipeOf } from "../pwa/src/game/replay.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

/** A run finished with no hits, in `contest`. */
function finished(contest?: PipeContest): GameState {
  const state = createGame({ seed: 4, mode: "halfpipe", quiet: true, halfpipe: contest });
  state.progress.finished = true;
  return state;
}

describe("the halfpipe on the HUD and the plate", () => {
  it("reads a fresh run: the qualification's first, no hits, not judged", () => {
    const hud = halfpipeOf(createGame({ seed: 4, mode: "halfpipe", quiet: true }));
    expect(hud).toMatchObject({ phase: "qualification", run: 1, of: HALFPIPE.qualification });
    expect(hud?.hits).toBe(0);
    expect(hud?.over).toBeNull();
    expect(hud?.judged).toBeNull();
    expect(hud?.board).toEqual([]);
    expect(hud?.next).toBeNull();
  });

  it("is null on any other run", () => {
    expect(halfpipeOf(createGame({ seed: 4, mode: "bigAir", quiet: true }))).toBeNull();
  });

  it("judges a finished run, boards it and offers the next run", () => {
    const hud = halfpipeOf(finished())!;
    expect(hud.judged?.hits).toEqual([]);
    expect(hud.board.some((r) => r.you)).toBe(true);
    expect(hud.next).toEqual({ kind: "run", run: 2 });
    expect(nextPipeContest(finished())?.qualification).toHaveLength(1);
  });

  it("ends the contest for him out of the qualification", () => {
    const low: PipeContest = { seed: 4, qualification: [{ score: 1, fell: true }], final: null };
    const hud = halfpipeOf(finished(low))!;
    expect(hud.next?.kind).toBe("out");
    expect(nextPipeContest(finished(low))).toBeNull();
  });

  it("carries the contest in a replay's recipe, keeps no book and is recorded", () => {
    const state = createGame({ seed: 4, mode: "halfpipe", quiet: true });
    expect(recipeOf(state, "halfpipe").halfpipe).toEqual(state.halfpipe);
    expect(keepsRecords("halfpipe")).toBe(false);
    expect(keepsReplay("halfpipe")).toBe(true);
  });

  it("is booted by a link", () => {
    expect(readParams("?start=halfpipe").mode).toBe("halfpipe");
    expect(readParams("?mode=halfpipe&seed=3").mode).toBe("halfpipe");
  });

  it("words the HUD, a hit, a board row and the plate's lines", () => {
    expect(STRINGS.halfpipeHits(0, null)).toBe("DROP IN");
    expect(STRINGS.halfpipeHits(3, 4.26)).toBe("HIT 3 · 4.3 M");
    expect(STRINGS.halfpipeHit("RIGHT 360", true, 4.1)).toBe("ALLEY-OOP RIGHT 360 · 4.1 M");
    expect(STRINGS.halfpipeRow([71.4, 12], [false, true], 71.4)).toBe("71.40 · FALL · BEST 71.40");
    expect(STRINGS.freestyle.halfpipe).toBe("HALFPIPE");
  });
});

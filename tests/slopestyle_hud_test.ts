// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SLOPESTYLE AS THE APP READS IT (`slopestyle-run.ts`): the run on the HUD
// — its phase, which run, the section he is in — the judges' sheet and the
// board once it is over, what the plate offers next, the contest the next
// run is stood up with, and the links and the book.

import { describe, expect, it } from "vitest";

import { SLOPESTYLE, createGame, type GameState, type SlopeContest } from "@engine";

import { nextSlopeContest, slopestyleOf } from "../pwa/src/game/slopestyle-run.ts";
import { keepsRecords } from "../pwa/src/game/records.ts";
import { keepsReplay, recipeOf } from "../pwa/src/game/replay.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

/** A run finished clean of tricks, in `contest`. */
function finished(contest?: SlopeContest): GameState {
  const state = createGame({ seed: 4, mode: "slopestyle", quiet: true, slopestyle: contest });
  state.progress.finished = true;
  const end = state.level.track.points[state.level.track.points.length - 1];
  state.skier.x = end.x;
  state.skier.z = end.z;
  return state;
}

describe("slopestyle on the HUD and the plate", () => {
  it("reads a fresh run: the qualification's first, above the first section, not judged", () => {
    const hud = slopestyleOf(createGame({ seed: 4, mode: "slopestyle", quiet: true }));
    expect(hud).toMatchObject({ phase: "qualification", run: 1, of: SLOPESTYLE.qualification });
    expect(hud?.sections).toBe(6);
    expect(hud?.section).toBe(0);
    expect(hud?.judged).toBeNull();
    expect(hud?.board).toEqual([]);
    expect(hud?.next).toBeNull();
  });

  it("is null on any other run", () => {
    expect(slopestyleOf(createGame({ seed: 4, mode: "bigAir", quiet: true }))).toBeNull();
  });

  it("names the section he is in", () => {
    const state = createGame({ seed: 4, mode: "slopestyle", quiet: true });
    const s = state.level.slopestyle!.sections[4];
    const at = state.level.track.points.find((p) => p.s > s.from + 2)!;
    state.skier.x = at.x;
    state.skier.z = at.z;
    const hud = slopestyleOf(state)!;
    expect(hud.section).toBe(5);
    expect(hud.kind).toBe("jump");
    expect(STRINGS.slopestyleSection(hud.section, hud.sections, hud.kind)).toBe("JUMP 5/6");
  });

  it("judges a finished run, boards it and offers the next run", () => {
    const hud = slopestyleOf(finished())!;
    expect(hud.judged?.sections).toHaveLength(6);
    expect(hud.board.some((r) => r.you)).toBe(true);
    expect(hud.next).toEqual({ kind: "run", run: 2 });
    const next = nextSlopeContest(finished());
    expect(next?.qualification).toHaveLength(1);
  });

  it("ends the contest for him out of the qualification", () => {
    const low: SlopeContest = { seed: 4, qualification: [{ score: 1, fell: true }], final: null };
    const hud = slopestyleOf(finished(low))!;
    expect(hud.next?.kind).toBe("out");
    expect(nextSlopeContest(finished(low))).toBeNull();
  });

  it("carries the contest in a replay's recipe, keeps no book and is recorded", () => {
    const state = createGame({ seed: 4, mode: "slopestyle", quiet: true });
    expect(recipeOf(state, "slopestyle").slopestyle).toEqual(state.slopestyle);
    expect(keepsRecords("slopestyle")).toBe(false);
    expect(keepsReplay("slopestyle")).toBe(true);
  });

  it("is booted by a link", () => {
    expect(readParams("?start=slopestyle").mode).toBe("slopestyle");
    expect(readParams("?mode=slopestyle&seed=3").mode).toBe("slopestyle");
  });

  it("words a board row and the plate's lines", () => {
    expect(STRINGS.slopestyleRow([71.4, 12], [false, true], 71.4)).toBe(
      "71.40 · FALL · BEST 71.40",
    );
    expect(STRINGS.slopestyleSection(0, 6, null)).toBe("DROP IN");
    expect(STRINGS.freestyle.slopestyle).toBe("SLOPESTYLE");
  });
});

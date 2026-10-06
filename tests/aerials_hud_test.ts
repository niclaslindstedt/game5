// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AERIALS AS THE APP READS THEM (`aerials-run.ts`): the jump on the HUD —
// its phase, the jump declared, the flips thrown — the formal score and the
// board once it is over, what the plate offers next, the contest the next
// jump is stood up with, the picker's jumps, and the links and the book.

import { describe, expect, it } from "vitest";

import {
  AERIALS,
  createGame,
  flipsOf,
  type AerialsContest,
  type FlightRecord,
  type GameState,
} from "@engine";

import { AERIAL_PICKS, aerialsOf, nextAerialsContest } from "../pwa/src/game/aerials-run.ts";
import { keepsRecords } from "../pwa/src/game/records.ts";
import { keepsReplay, recipeOf } from "../pwa/src/game/replay.ts";
import { freshSettings, mergeSettings } from "../pwa/src/game/settings.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

/** A jump landed clean `past` m past the knoll, in `contest`, flown as
 * `flown` against the plan declared. */
function landed(contest?: AerialsContest, flown = "bLF", past = 3): GameState {
  const state = createGame({ seed: 4, mode: "aerials", quiet: true, aerials: contest });
  const site = state.level.aerials!;
  state.progress.started = true;
  state.progress.finished = true;
  state.progress.splits[0] = 0;
  state.progress.time = 12;
  state.aerial!.read = {
    flips: flipsOf(flown)!.map((f) => ({
      twists: f.twists,
      twist: f.twists * 2 * Math.PI,
      tuck: f.tuck ? 1 : 0,
    })),
    code: flown,
    peak: 5,
    firstTap: 0.05,
    owing: 0,
    tucked: false,
    landedAt: site.knoll + past,
  };
  const flight: FlightRecord = {
    flight: 1,
    flip: 4 * Math.PI,
    spin: 2 * Math.PI,
    grabs: [],
    air: 2.8,
    length: 15,
    height: 7.5,
    switchIn: false,
    switchOut: false,
    landing: 0.5,
    outcome: "landed",
    t: 10,
  };
  state.tricks.flights.push(flight);
  return state;
}

describe("aerials on the HUD and the plate", () => {
  it("reads a fresh jump: the qualification, the jump declared, nothing thrown, not scored", () => {
    const hud = aerialsOf(createGame({ seed: 4, mode: "aerials", quiet: true }));
    expect(hud?.phase).toBe("qualification");
    expect(hud?.plan).toBe(AERIALS.plan);
    expect(hud?.dd).toBeCloseTo(2.9, 6);
    expect(hud?.flips).toBe(2);
    expect(hud?.thrown).toBe(0);
    expect(hud?.judged).toBeNull();
    expect(hud?.board).toEqual([]);
    expect(hud?.next).toBeNull();
  });

  it("declares the jump a link or the card asks for", () => {
    const hud = aerialsOf(createGame({ seed: 4, mode: "aerials", quiet: true, plan: "bFdFF" }));
    expect(hud?.plan).toBe("bFdFF");
    expect(hud?.flips).toBe(3);
  });

  it("is null on any other run", () => {
    expect(aerialsOf(createGame({ seed: 4, mode: "moguls", quiet: true }))).toBeNull();
  });

  it("scores a landed jump, boards it and carries the contest on", () => {
    const hud = aerialsOf(landed())!;
    expect(hud.judged?.dnf).toBeNull();
    expect(hud.judged?.score).toBeGreaterThan(50);
    expect(hud.judged?.flown).toBe("bLF");
    expect(hud.board.some((r) => r.you)).toBe(true);
    expect(hud.next).not.toBeNull();
    const after = nextAerialsContest(landed());
    if (after) expect(after.jumps).toHaveLength(1);
  });

  it("is no finish for a jump flown other than declared, and ends his contest", () => {
    const state = landed(undefined, "bLL");
    const hud = aerialsOf(state)!;
    expect(hud.judged?.dnf).toBe("twists");
    expect(hud.judged?.score).toBe(0);
    expect(hud.next?.kind).toBe("out");
    expect(nextAerialsContest(state)).toBeNull();
  });

  it("carries the contest in a replay's recipe, keeps no book and is recorded", () => {
    const state = createGame({ seed: 4, mode: "aerials", quiet: true });
    expect(recipeOf(state, "aerials").aerials).toEqual(state.aerials);
    expect(keepsRecords("aerials")).toBe(false);
    expect(keepsReplay("aerials")).toBe(true);
  });

  it("is booted by a link, its jump with it", () => {
    expect(readParams("?start=aerials").mode).toBe("aerials");
    expect(readParams("?mode=aerials&seed=3").mode).toBe("aerials");
    expect(readParams("?start=aerials&plan=bLFF").plan).toBe("bLFF");
    expect(readParams("?start=aerials&plan=nope").plan).toBeNull();
  });

  it("offers every jump of the chart on the picker, easiest first, and keeps the pick", () => {
    expect(AERIAL_PICKS[0]).toMatch(/^b[LT]$/);
    expect(AERIAL_PICKS).toContain("bFtFdF");
    expect(freshSettings().aerialPlan).toBe(AERIALS.plan);
    expect(mergeSettings({ aerialPlan: "bFF" }).aerialPlan).toBe("bFF");
    expect(mergeSettings({ aerialPlan: "bQQ" }).aerialPlan).toBe(AERIALS.plan);
  });

  it("words the HUD, a jump, the parts and the plate's lines", () => {
    expect(STRINGS.aerialsDeclared("bLF", 2.9, 1, 2)).toBe("bLF · DD 2.900 · 1/2 FLIPS");
    expect(STRINGS.aerialsJumpWords("bLdFF")).toBe("TRIPLE BACK · LAY · DOUBLE FULL · FULL");
    expect(STRINGS.aerialsJumpWords("bT")).toBe("SINGLE BACK · TUCK");
    expect(STRINGS.aerialsParts(5.7, 12.3, 8)).toBe("AIR 5.7 · FORM 12.3 · LANDING 8.0");
    expect(STRINGS.aerialsSum(26, 5.1)).toBe("26.0 × DD 5.100");
    expect(STRINGS.aerialsOut("repeat")).toBe("DID NOT FINISH · JUMP REPEATED");
    expect(STRINGS.freestyle.aerials).toBe("AERIALS");
    expect(STRINGS.freestyleAerials(AERIALS.field + 1, AERIALS.final1, AERIALS.final2)).toContain(
      "24",
    );
  });
});

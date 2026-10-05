// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SPEED SKIING ON THE HUD — what a speed race's readouts and plate are
// worked out FROM, read without a browser: every time read as the speed it
// is (`speed-ski-run.ts`), the race's readouts (`snapshot.ts`'s `raceOf`),
// the qualification and the final after it (`slalom-heat.ts`), the board
// ranked on the final alone (`slalom-board.ts`), the run a restart stands
// up again (`replay.ts`, `pinned-run.ts`), the link that boots one
// (`url-params.ts`), the news line the timing zone earns and the race
// card's row.

import { describe, expect, it } from "vitest";

import { PEREGRINE, SPEED_SKI, createGame, type GameState } from "@engine";

import { boardOf } from "../pwa/src/game/slalom-board.ts";
import { secondRunAgain } from "../pwa/src/game/pinned-run.ts";
import { raceMapsOf } from "../pwa/src/game/race-maps.ts";
import { recipeOf } from "../pwa/src/game/replay.ts";
import { newsFor } from "../pwa/src/game/run-news.ts";
import {
  heatAfter,
  heatOf,
  qualifyOf,
  secondRunOf,
  twoRunMode,
} from "../pwa/src/game/slalom-heat.ts";
import { raceOf } from "../pwa/src/game/snapshot.ts";
import { speedGapOf, speedOf } from "../pwa/src/game/speed-ski-run.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { readParams } from "../pwa/src/game/url-params.ts";
import { levelFor } from "./support/levels.ts";

const BASE = levelFor(38);

/** A speed race's qualification on the map — or its final off `heat`. */
function speedRace(heat?: ReturnType<typeof heatAfter>): GameState {
  return createGame({
    level: BASE,
    seed: 5,
    mode: "speedSki",
    spec: PEREGRINE,
    heat: heat ?? undefined,
    quiet: true,
  });
}

/** The player home through the zone in `time`. */
function home(state: GameState, time: number): GameState {
  const p = state.progress;
  p.started = true;
  p.finished = true;
  p.time = time;
  p.trap = state.level.speedSki!.zone.length / time;
  state.phase = "finished";
  return state;
}

describe("a time read as a speed", () => {
  it("is the zone over the time, and a gap the speed it costs", () => {
    expect(speedOf(1.8, 100)).toBeCloseTo(200, 9);
    expect(speedOf(null, 100)).toBeNull();
    expect(speedOf(0, 100)).toBeNull();
    // 1.80 s against a leader at 1.75 s: some 5.7 km/h slower.
    expect(speedGapOf(1.8, 0.05, 100)).toBeCloseTo(200 - 205.714, 2);
    expect(speedGapOf(1.8, null, 100)).toBeNull();
  });
});

describe("a speed race's readouts", () => {
  it("are its discipline's, two runs, the zone's length beside them", () => {
    const state = speedRace();
    const race = raceOf(state)!;
    expect(race.discipline).toBe("speedSki");
    expect(race.runs).toBe(SPEED_SKI.runs);
    expect(race.run).toBe(1);
    expect(race.zone).toBeCloseTo(state.level.speedSki!.zone.length, 9);
    expect(race.timing).toBeNull();
    expect(twoRunMode(state)).toBe("speedSki");
    expect(qualifyOf(state)).toBe(SPEED_SKI.qualify);
  });

  it("offers the final to the qualification's best, and says why not to the rest", () => {
    const fast = home(speedRace(), 1.0);
    expect(secondRunOf(fast)).toEqual({ kind: "go", place: 1 });
    const slow = home(speedRace(), 3);
    expect(secondRunOf(slow)?.kind).toBe("short");
    const heat = heatAfter(fast)!;
    expect(heat.run).toBe(2);
    const final = speedRace(heat);
    expect(final.level.speedSki?.run).toBe(2);
    expect(raceOf(final)!.run).toBe(2);
    // ...and nothing after the final.
    expect(secondRunOf(home(final, 1.7))).toBeNull();
    // A restart or a replay stands the final up again, as a speed race.
    expect(heatOf(final)?.run).toBe(2);
    expect(recipeOf(final, twoRunMode(final)).mode).toBe("speedSki");
    expect(secondRunAgain(final)?.level.speedSki?.run).toBe(2);
  });

  it("boards the final on the final alone", () => {
    const fast = home(speedRace(), 1.0);
    const final = home(speedRace(heatAfter(fast)!), 1.6);
    const board = boardOf(final);
    expect(board).toHaveLength(SPEED_SKI.qualify);
    const mine = board.find((r) => r.you)!;
    expect(mine.total).toBeCloseTo(1.6, 9);
    expect(mine.before).toBeNull();
    for (const r of board) if (r.total !== null) expect(r.total).toBe(r.time);
  });

  it("says the speed the zone timed, and leaves the place to the plate", () => {
    const state = home(speedRace(), 1.8);
    const timed = newsFor({ kind: "trap", t: 20, speed: 100 / 1.8 }, state);
    expect(timed?.text).toBe(STRINGS.newsSpeed(200));
    expect(newsFor({ kind: "finish", t: 20, time: 1.8, place: 3 }, state)).toBeNull();
  });
});

describe("the way into a speed race", () => {
  it("is a link, the race card's row and its level card", () => {
    expect(readParams("?start=speedski").mode).toBe("speedSki");
    expect(readParams("?start=speedski").rides).toBe(true);
    expect(readParams("?mode=speedski").mode).toBe("speedSki");
    expect(STRINGS.racesSpeedSki(SPEED_SKI.field + 1)).toContain("FINAL");
    expect(raceMapsOf("speedSki")).not.toBeNull();
  });
});

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL ON THE HUD — what a downhill's readouts and plate are worked
// out FROM, read without a browser: the training run and the race after it
// (`downhill-run.ts`, `slalom-heat.ts`'s `secondRunOf`, `pinned-run.ts`),
// the speed trap (`trapOf`), the four intermediates (`slalom-board.ts`),
// the run a restart and a replay stand up again (`replay.ts`), the maps a
// downhill is raced on, the link that boots one
// (`url-params.ts`), and the news and the pulse the trap and the nets earn.

import { describe, expect, it } from "vitest";

import { DISCIPLINE_RULES, DOWNHILL, createGame, skisById, type GameState } from "@engine";

import { isTraining, trainingOf, trapOf } from "../pwa/src/game/downhill-run.ts";
import { secondRunOff } from "../pwa/src/game/pinned-run.ts";
import { recipeOf } from "../pwa/src/game/replay.ts";
import { rumbleForEvent } from "../pwa/src/game/rumble.ts";
import { newsFor } from "../pwa/src/game/run-news.ts";
import { timingGates } from "../pwa/src/game/slalom-board.ts";
import { heatAfter, secondRunOf } from "../pwa/src/game/slalom-heat.ts";
import { takeSnapshot } from "../pwa/src/game/snapshot.ts";
import { readParams } from "../pwa/src/game/url-params.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const BASE = syntheticLevel();
const EAGLE = skisById("eagle");

/** A downhill on the slope — its training run unless `training` is false. */
function downhill(training = true): GameState {
  return createGame({ level: BASE, seed: 5, mode: "downhill", spec: EAGLE, training, quiet: true });
}

/** The player home in `time`. */
function home(state: GameState, time: number): GameState {
  const p = state.progress;
  p.started = true;
  p.finished = true;
  p.time = time;
  state.phase = "finished";
  return state;
}

describe("a downhill's two runs", () => {
  it("is stood up as its training, the race after it", () => {
    const training = downhill();
    expect(isTraining(training)).toBe(true);
    expect(trainingOf(training)).toBe(true);
    const race = downhill(false);
    expect(isTraining(race)).toBe(false);
    expect(trainingOf(race)).toBe(false);
    // ...and neither is anything on a slalom.
    expect(trainingOf(createGame({ level: BASE, seed: 5, mode: "slalom", quiet: true }))).toBe(
      undefined,
    );
  });

  it("offers the race over a training run, home or out — and nothing over the race", () => {
    expect(secondRunOf(home(downhill(), 60))).toEqual({ kind: "race" });
    const out = downhill();
    out.progress.out = { status: "dnf", why: "fall", gate: 3 };
    home(out, 30);
    expect(secondRunOf(out)).toEqual({ kind: "race" });
    expect(secondRunOf(home(downhill(false), 60))).toBeNull();
    // A downhill has no slalom's heat.
    expect(heatAfter(home(downhill(), 60))).toBeNull();
  });

  it("stands a restart and a replay up again as the run it was", () => {
    expect(createGame(recipeOf(downhill(), "downhill")).field?.training).toBe(true);
    expect(createGame(recipeOf(downhill(false), "downhill")).field?.training).toBe(false);
    // A link's second run is the race, off the training — nothing skied.
    const race = secondRunOff(downhill());
    expect(race.field?.training).toBe(false);
    expect(race.progress.time).toBe(0);
  });

  it("reads the race on the HUD: the discipline, the run, one of one", () => {
    const snap = takeSnapshot(downhill());
    expect(snap.race?.discipline).toBe("downhill");
    expect(snap.race?.training).toBe(true);
    expect(snap.race?.runs).toBe(DOWNHILL.runs);
    expect(snap.race?.word).toBe("ready");
    expect(takeSnapshot(downhill(false)).race?.training).toBe(false);
  });
});

describe("a downhill's timing", () => {
  it("is timed at its four intermediates, never the start or the finish", () => {
    const level = downhill().level;
    const gates = timingGates(level);
    const n = level.checkpoints.length;
    if (n >= DISCIPLINE_RULES.downhill.timing + 3) {
      expect(gates).toHaveLength(DISCIPLINE_RULES.downhill.timing);
      for (const g of gates) {
        expect(g).toBeGreaterThan(0);
        expect(g).toBeLessThan(n - 1);
      }
      expect([...gates].sort((a, b) => a - b)).toEqual(gates);
    }
  });

  it("takes the speed trap: his speed, the field's fastest down already, his place among them", () => {
    const state = downhill(false);
    expect(trapOf(state)?.speed).toBeNull();
    state.progress.started = true;
    state.progress.trap = 40;
    state.progress.trapAt = 50;
    state.progress.time = 51;
    const before = state.field!.runs.slice(0, state.field!.slot);
    const theirs = before.map((r) => r.trap).filter((v): v is number => v !== null);
    const reading = trapOf(state)!;
    expect(reading.speed).toBeCloseTo(144, 6);
    expect(reading.best).toBeCloseTo(Math.max(...theirs) * 3.6, 6);
    expect(reading.rank).toBe(1 + theirs.filter((v) => v > 40).length);
    const snap = takeSnapshot(state);
    expect(snap.race?.trap?.speed).toBeCloseTo(144, 6);
    expect(snap.race?.trapFresh).toBe(true);
    state.progress.time = 60;
    expect(takeSnapshot(state).race?.trapFresh).toBe(false);
    // ...and no trap off a downhill.
    expect(trapOf(createGame({ level: BASE, seed: 5, mode: "slalom", quiet: true }))).toBeNull();
  });

  it("says the trap and the nets in the news and the hands", () => {
    const state = downhill(false);
    expect(newsFor({ kind: "trap", t: 1, speed: 40 }, state)?.text).toContain("144");
    expect(newsFor({ kind: "net", t: 1, speed: 9, x: 0, z: 0 }, state)?.tone).toBe("bad");
    expect(rumbleForEvent({ kind: "net", t: 1, speed: 9, x: 0, z: 0 })).not.toBeNull();
  });
});

describe("where a downhill is raced", () => {
  it("boots off a link into its training, or with ?run=2 its race", () => {
    expect(readParams("?start=downhill").mode).toBe("downhill");
    expect(readParams("?start=downhill").rides).toBe(true);
    expect(readParams("?start=race&mode=downhill").mode).toBe("downhill");
    expect(readParams("?start=downhill&run=2").run).toBe(2);
  });
});

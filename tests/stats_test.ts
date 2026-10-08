// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STATISTICS (`pwa/src/game/stats.ts`): one run tallied off the
// engine's own state and events, folded into the book in shares and counted
// once however many times it is folded, its bests kept with the run that
// set them, and a stored blob trusted no further than a run could have
// written it.
import { describe, expect, it } from "vitest";

import { TUNING, botInput, createGame, step, type GameState } from "@engine";
import {
  MIN_RUN,
  RECENT_RUNS,
  averageSpeed,
  createStatsTracker,
  emptyStats,
  foldRun,
  readStats,
  trickKey,
  trickOf,
  tricksByCount,
  zeroSums,
  type RunTally,
} from "../pwa/src/game/stats.ts";
import { syntheticLevel } from "./support/synthetic.ts";

/** A run skied by the bot down the synthetic slope for `seconds` — a
 * slalom's, whose course is set down the face rather than on the flat at
 * its top. */
function skied(seconds: number): {
  state: GameState;
  tracker: ReturnType<typeof createStatsTracker>;
} {
  const state = createGame({ level: syntheticLevel(), mode: "slalom", quiet: true });
  const tracker = createStatsTracker();
  tracker.arm(state, "slalom", 1_700_000_000_000);
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    step(state, botInput(state));
    tracker.step(state);
  }
  return { state, tracker };
}

const tally = (extra: Partial<RunTally> = {}): RunTally => ({
  ...zeroSums(),
  at: 1_700_000_000_000,
  mode: "slalom",
  seed: 38,
  skis: "swift",
  top: 0,
  longest: 0,
  landing: 0,
  combo: 0,
  iss: 0,
  peak: 0,
  score: 0,
  finished: false,
  time_: null,
  place: null,
  out: false,
  causes: {},
  killed: {},
  tricks: {},
  ...extra,
});

describe("the run's tally", () => {
  it("counts nothing before a run is long enough to be one", () => {
    const { tracker } = skied(MIN_RUN / 2);
    expect(tracker.take()).toBeNull();
  });

  it("measures the skier's own riding: time, distance, height lost, top speed", () => {
    const { tracker } = skied(8);
    const taken = tracker.take();
    expect(taken).not.toBeNull();
    const run = taken!.whole;
    expect(run.time).toBeCloseTo(8, 1);
    expect(run.distance).toBeGreaterThan(10);
    expect(run.vertical).toBeGreaterThan(1);
    expect(run.top).toBeGreaterThan(1);
    // Distance over time can never beat the fastest he went.
    expect(run.distance / run.time).toBeLessThanOrEqual(run.top + 1e-9);
  });

  it("hands over only the share since the last fold", () => {
    const { state, tracker } = skied(5);
    const first = tracker.take()!;
    expect(first.first).toBe(true);
    for (let i = 0; i < TUNING.physicsHz; i++) {
      step(state, botInput(state));
      tracker.step(state);
    }
    const second = tracker.take()!;
    expect(second.first).toBe(false);
    expect(second.share.time).toBeCloseTo(1, 2);
    expect(second.whole.time).toBeCloseTo(first.whole.time + 1, 2);
  });
});

describe("the book", () => {
  it("counts a run folded twice as one run, its sums once", () => {
    const { state, tracker } = skied(5);
    let book = foldRun(emptyStats(), tracker.take()!);
    for (let i = 0; i < TUNING.physicsHz * 2; i++) {
      step(state, botInput(state));
      tracker.step(state);
    }
    const last = tracker.take()!;
    book = foldRun(book, last);
    expect(book.runs).toBe(1);
    expect(book.sums.time).toBeCloseTo(last.whole.time, 6);
    expect(book.sums.distance).toBeCloseTo(last.whole.distance, 6);
    expect(book.recent).toHaveLength(1);
    expect(book.modes.slalom?.runs).toBe(1);
    expect(averageSpeed(book)).toBeGreaterThan(0);
  });

  it("counts a win, a podium and a finish once, and keeps the best with its run", () => {
    const won = tally({ finished: true, place: 1, time_: 61, top: 30, time: 61 });
    let book = foldRun(emptyStats(), {
      whole: won,
      share: { ...zeroSums(), time: 61 },
      first: true,
    });
    book = foldRun(book, { whole: won, share: zeroSums(), first: false });
    expect(book.finished).toBe(1);
    expect(book.wins).toBe(1);
    expect(book.podiums).toBe(1);
    expect(book.bests.top).toMatchObject({ value: 30, mode: "slalom", seed: 38, skis: "swift" });
    const slower = tally({ at: won.at + 1, top: 20, time: 40, causes: { tree: 2 } });
    book = foldRun(book, { whole: slower, share: { ...zeroSums(), time: 40 }, first: true });
    expect(book.bests.top?.value).toBe(30);
    expect(book.causes.tree).toBe(2);
    expect(book.recent[0].at).toBe(slower.at);
  });

  it("keeps each map's best time per mode, its tricks, and every map's tricks", () => {
    const slow = tally({ finished: true, place: 4, time_: 70, tricks: { backflip: 1 } });
    const fast = tally({
      at: slow.at + 1,
      finished: true,
      place: 2,
      time_: 64,
      score: 900,
      tricks: { backflip: 2, [trickKey("backflip", 2)]: 1 },
    });
    let book = foldRun(emptyStats(), { whole: slow, share: zeroSums(), first: true });
    book = foldRun(book, { whole: fast, share: zeroSums(), first: true });
    // The same run folded again owes nothing more.
    book = foldRun(book, { whole: fast, share: zeroSums(), first: false });
    const row = book.seeds["38"];
    expect(row.runs).toBe(2);
    expect(row.times.slalom).toBe(64);
    expect(row.score).toBe(900);
    expect(row.tricks).toEqual({ backflip: 3, backflip2: 1 });
    expect(book.tricks).toEqual({ backflip: 3, backflip2: 1 });
    expect(tricksByCount(book.tricks)[0]).toEqual(["backflip", 3]);
    expect(trickOf("backflip2")).toEqual({ kind: "backflip", spins: 2 });
    expect(trickOf("nonsense")).toBeNull();
    expect(book.bests.score?.value).toBe(900);
  });

  it("places nothing on a free ride", () => {
    const free = tally({ mode: "free", finished: true, place: 1 });
    const book = foldRun(emptyStats(), { whole: free, share: zeroSums(), first: true });
    expect(book.wins).toBe(0);
    expect(book.podiums).toBe(0);
  });

  it("keeps the newest runs only", () => {
    let book = emptyStats();
    for (let i = 0; i < RECENT_RUNS + 5; i++)
      book = foldRun(book, { whole: tally({ at: 1 + i }), share: zeroSums(), first: true });
    expect(book.recent).toHaveLength(RECENT_RUNS);
    expect(book.recent[0].at).toBe(RECENT_RUNS + 5);
    expect(book.runs).toBe(RECENT_RUNS + 5);
  });

  it("reads back what it wrote, and nothing it could not have", () => {
    const book = foldRun(emptyStats(), {
      whole: tally({ top: 12, peak: 9, causes: { nose: 1 }, tricks: { spin: 2 } }),
      share: { ...zeroSums(), time: 9, distance: 40 },
      first: true,
    });
    expect(readStats(JSON.parse(JSON.stringify(book)))).toEqual(book);
    expect(readStats(null)).toEqual(emptyStats());
    expect(readStats({ v: 2 })).toEqual(emptyStats());
    const bad = readStats({
      v: 1,
      runs: -4,
      sums: { time: "x", distance: Infinity },
      recent: [{}],
    });
    expect(bad.runs).toBe(0);
    expect(bad.sums.time).toBe(0);
    expect(bad.sums.distance).toBe(0);
    expect(bad.recent).toEqual([]);
  });
});

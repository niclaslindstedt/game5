// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RECORD BOOK (`pwa/src/game/records.ts`): one row per seed, skis, mode
// and length, beaten outright or not at all, the gap at every crossing read
// off the row that stood, and a stored blob trusted no further than a run
// could have written it.
import { describe, expect, it } from "vitest";

import {
  GAME_MODES,
  MODE_RULES,
  TIME_TRIAL,
  fieldRules,
  botInput,
  createGame,
  step,
} from "@engine";
import {
  beats,
  bestFor,
  keepsRecords,
  mergeRecords,
  noteRecord,
  recordId,
  splitGap,
  type RecordBook,
  type RecordKey,
  type RunRecord,
} from "../pwa/src/game/records.ts";
import { freshSettings, mergeSettings } from "../pwa/src/game/settings.ts";
import { takeSnapshot } from "../pwa/src/game/snapshot.ts";
import { readParams } from "../pwa/src/game/url-params.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const KEY: RecordKey = { seed: 38, skis: "chamois", mode: "timeTrial", laps: 1 };
const row = (value: number, extra: Partial<RunRecord> = {}): RunRecord => ({
  value,
  skis: "chamois",
  at: 1_700_000_000_000,
  splits: [],
  ...extra,
});

describe("the modes", () => {
  it("a time trial is the loop alone, under the lights", () => {
    const rules = MODE_RULES.timeTrial(3);
    expect(rules.rivals).toBe(0);
    expect(rules.countdown).toBeGreaterThan(0);
    expect(rules.laps).toBe(3);
    const run = createGame({ level: syntheticLevel(), mode: "timeTrial", laps: 1, quiet: true });
    expect(run.rivals).toHaveLength(0);
    expect(run.rules.laps).toBe(1);
    expect(run.phase).toBe("countdown");
  });

  it("the field on the start line is what createGame deals when no mode is named", () => {
    const run = createGame({ level: syntheticLevel(), quiet: true });
    expect(run.rules).toEqual(fieldRules(run.level.laps));
  });

  it("the trial is always one run top to bottom; a stored length is read back as one", () => {
    expect(TIME_TRIAL.laps).toEqual([1]);
    expect(freshSettings().trialLaps).toBe(1);
    expect(mergeSettings({ trialLaps: 3 }).trialLaps).toBe(1);
    expect(mergeSettings({ trialLaps: 2 }).trialLaps).toBe(1);
    expect(mergeSettings({ trialLaps: "1" }).trialLaps).toBe(1);
  });
});

describe("what names a row", () => {
  it("is the seed, the skis, the mode and the length", () => {
    const id = recordId(KEY);
    expect(recordId({ ...KEY, seed: 39 })).not.toBe(id);
    expect(recordId({ ...KEY, skis: "hare" })).not.toBe(id);
    expect(recordId({ ...KEY, mode: "slalom" })).not.toBe(id);
    expect(recordId({ ...KEY, laps: 2 })).not.toBe(id);
    expect(recordId({ ...KEY })).toBe(id);
  });

  it("every timed mode keeps a book, and the free ride, the tricks run and the contests none", () => {
    const untimed = [
      "free",
      "tricks",
      "bigAir",
      "knuckleHuck",
      "slopestyle",
      "railJam",
      "halfpipe",
      "moguls",
    ];
    for (const mode of GAME_MODES) expect(keepsRecords(mode)).toBe(!untimed.includes(mode));
    expect(beats("free", 10, null)).toBe(false);
  });
});

describe("what beats a row", () => {
  it("is a lower time, and a standing row with nothing on it is beaten by any time", () => {
    expect(beats("timeTrial", 99.99, row(100))).toBe(true);
    expect(beats("timeTrial", 100.01, row(100))).toBe(false);
    expect(beats("slalom", 90, row(100))).toBe(true);
    expect(beats("timeTrial", 500, null)).toBe(true);
  });

  it("never a tie, and never a figure that is not one", () => {
    expect(beats("timeTrial", 100, row(100))).toBe(false);
    expect(beats("timeTrial", 0, null)).toBe(false);
    expect(beats("timeTrial", -1, null)).toBe(false);
    expect(beats("timeTrial", Number.NaN, null)).toBe(false);
    expect(beats("timeTrial", Number.POSITIVE_INFINITY, null)).toBe(false);
  });
});

describe("noting a run", () => {
  it("writes a new row, keeps the book handed in, and names the skis and the date", () => {
    const empty: RecordBook = {};
    const first = noteRecord(empty, KEY, row(80, { splits: [0, 20, 40] }));
    expect(first.record).toBe(true);
    expect(empty).toEqual({});
    const stood = bestFor(first.book, KEY)!;
    expect(stood.value).toBe(80);
    expect(stood.skis).toBe("chamois");
    expect(stood.at).toBe(1_700_000_000_000);
    expect(stood.splits).toEqual([0, 20, 40]);

    const slower = noteRecord(first.book, KEY, row(81));
    expect(slower.record).toBe(false);
    expect(slower.book).toBe(first.book);

    const quicker = noteRecord(first.book, KEY, row(79.5));
    expect(quicker.record).toBe(true);
    expect(bestFor(quicker.book, KEY)!.value).toBe(79.5);
    expect(bestFor(quicker.book, { ...KEY, laps: 2 })).toBeNull();
  });

  it("the gap at a crossing is this run's clock less the record's, negative ahead", () => {
    const rec = row(80, { splits: [0, 20, 40] });
    expect(splitGap(rec, 1, 19.5)).toBeCloseTo(-0.5);
    expect(splitGap(rec, 2, 41)).toBeCloseTo(1);
    expect(splitGap(rec, 3, 60)).toBeNull();
    expect(splitGap(rec, -1, 0)).toBeNull();
    expect(splitGap(null, 1, 20)).toBeNull();
  });
});

describe("the HUD's reading of it", () => {
  it("the split carries its gap to the record at the same crossing, and the plate its row", () => {
    const run = createGame({ level: syntheticLevel(), mode: "timeTrial", laps: 1, quiet: true });
    for (let i = 0; i < 120 * 120 && run.progress.passed < 2; i++) step(run, botInput(run));
    expect(run.progress.passed).toBe(2);
    const at = run.progress.splits[run.progress.lastCheckpoint];
    const standing = row(90, { splits: [0, at - 1.25] });
    const snap = takeSnapshot(run, { mode: "timeTrial", standing });
    expect(snap.split).toBe(at);
    expect(snap.gap).toBeCloseTo(1.25);
    expect(snap.mode).toBe("timeTrial");
    expect(snap.best).toEqual({ time: 90, skis: "chamois", at: standing.at });
    const bare = takeSnapshot(run);
    expect(bare.gap).toBeNull();
    expect(bare.best).toBeNull();
    expect(bare.mode).toBe("slalom");
  });

  it("a link names the mode", () => {
    expect(readParams("?start=race&mode=trial").mode).toBe("timeTrial");
    expect(readParams("?start=race").mode).toBe("slalom");
    expect(readParams("?mode=nonsense").mode).toBe("slalom");
  });
});

describe("a stored book", () => {
  it("keeps every row a run could have set and drops the rest", () => {
    const book = mergeRecords({
      good: { value: 70, skis: "hare", at: 5, splits: [0, 10] },
      noDate: { value: 71, skis: "chough" },
      badSplits: { value: 72, skis: "swift", at: 1, splits: [1, "x", 3] },
      zero: { value: 0, skis: "hare", at: 5 },
      nan: { value: "fast", skis: "hare", at: 5 },
      ghostSkis: { value: 70, skis: "snowboard", at: 5 },
      junk: 12,
    });
    expect(Object.keys(book).sort()).toEqual(["badSplits", "good", "noDate"]);
    expect(book.noDate.at).toBe(0);
    expect(book.noDate.splits).toEqual([]);
    expect(book.badSplits.splits).toEqual([1, 3]);
    expect(mergeRecords(null)).toEqual({});
    expect(mergeRecords("[]")).toEqual({});
  });
});

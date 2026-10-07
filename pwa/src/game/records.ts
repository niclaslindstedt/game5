// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RECORD BOOK — the best time this device has seen on each mountain, on each
// skis, in each mode, over each length.
//
// ONE ROW PER (SEED AND COURSE, SKIS, MODE, LAPS, RUN). The seed is the
// mountain — the generator is a pure function of it — and on a resort the
// COURSE is which of its pistes was raced (R28), so two runs on one seed and
// course are two runs down the same piste. The pair is in the key rather than merely written on the row,
// because the seven pairs are seven answers to the snow — a slalom ski's time
// down a groomed piste is not a powder ski's to beat — and the run count is
// (always one on a piste, kept so the key's shape is the sibling games'),
// because a one-run trial and a three-run one would be two different
// stopwatches. A SLALOM'S SECOND RUN is set on a course of its own (R31),
// so it keeps its own row — and its own ghost — beside the first run's. The
// date the row was set is written on it, and so are the
// clock at every crossing of the run that set it (`splits`), which is what
// the HUD's split is read against at each checkpoint of the next run.
//
// WHICH MODES KEEP A BOOK is `keepsRecords` — the race and the time trial.
// The FREE RIDE keeps none: its runs are not comparable (a map on a day and
// a depth of snow of the skier's own choosing, and no course to time), which
// is the case the predicate exists for. Nor does a TRICKS run: its figure is
// a score, higher the better, and this book is a book of times.
//
// Two halves, the way `settings.ts` is split: everything above the storage
// line is PURE — a key, a comparison, a book laid over a book — so
// `tests/records_test.ts` holds the policy without a browser, and the two
// functions under it are the skin over `localStorage`. A device with no
// storage still keeps this session's book in memory; a row is never
// load-bearing.
//
// A TIE IS NOT A RECORD. The row stands until it is beaten outright.

import {
  isGameMode,
  isSkiId,
  riderOf,
  type GameMode,
  type GameState,
  type RiderId,
  type SkiId,
  type SkiSpec,
} from "@engine";
import {
  beats as beatsRow,
  bestIn,
  noteRecord as noteRow,
  readBook,
  splitGap as gapAt,
} from "@niclaslindstedt/oss-game-framework/racing/records";

/** What names a row. `course` is the resort's course the run was raced
 * down (R28, `Resort.course`) — one seed builds a whole ski area and the
 * campaign rides six of its courses, so the seed alone no longer names the
 * piste; absent on a map with one piste (a version before the resorts). */
export type RecordKey = {
  seed: number;
  course?: string;
  skis: SkiId;
  /** The skier's build (`Outfit.weight`): a heavier skier is faster
   * downhill, so each build keeps its own book. Absent is the medium
   * build, whose rows keep the ids they had before a build could be
   * chosen. */
  rider?: RiderId;
  mode: GameMode;
  laps: number;
  /** Which run of a slalom (R31): the second is a course of its own. Absent
   * is the first — and every other mode's only run — whose rows keep the
   * ids they had before a second run could be skied. */
  run?: 1 | 2;
};

/** One row: the time, s; the skis it was set on; when, as a unix ms stamp;
 * and the clock at each gate of the piste, in order — the start gate's
 * first crossing first (`Progress.passed` less one indexes it). */
export type RunRecord = {
  value: number;
  skis: SkiId;
  at: number;
  splits: number[];
};

export type RecordBook = Readonly<Record<string, RunRecord>>;

/** WHAT A RUN IS MEASURED AGAINST, as the HUD reads it: the mode it is
 * ridden in, and the row that stood when it began — held for the whole run,
 * so the finish plate can say whether the run beat it after the book has
 * already been rewritten. */
export type RunLedger = { mode: GameMode; standing: RunRecord | null };

/** The pair and the build a run is skied on, as a key names them. */
export function pairKey(spec: SkiSpec): Pick<RecordKey, "skis" | "rider"> {
  return { skis: spec.id, rider: riderOf(spec).id };
}

/** THE ROW A RUN ON THE SNOW IS FILED UNDER, ridden in `mode`: its map
 * and course, its pair and build, its length — and on a slalom's second run,
 * the run. */
export function runKey(state: GameState, mode: GameMode): RecordKey {
  return {
    seed: state.seed,
    course: state.level.resort?.course,
    ...pairKey(state.skier.spec),
    mode,
    laps: state.rules.laps,
    ...(state.field?.run === 2 ? { run: 2 as const } : {}),
  };
}

/** The row's id. */
export function recordId(key: RecordKey): string {
  const map = key.course === undefined ? `${key.seed}` : `${key.seed}.${key.course}`;
  const rider = key.rider === undefined || key.rider === "medium" ? "" : `/${key.rider}`;
  const run = key.run === 2 ? "/run2" : "";
  return `${key.mode}/${map}/${key.skis}/${key.laps}${rider}${run}`;
}

/** WHETHER A MODE KEEPS A BOOK AT ALL (see the header). */
export function keepsRecords(mode: GameMode): boolean {
  return (
    isGameMode(mode) &&
    mode !== "free" &&
    mode !== "tricks" &&
    mode !== "bigAir" &&
    mode !== "slopestyle" &&
    mode !== "halfpipe" &&
    mode !== "moguls" &&
    mode !== "aerials"
  );
}

/** Whether `value` beats the row standing — outright, never on a tie — or
 * stands where there is none. A figure that is not a figure beats nothing,
 * and neither does any figure in a mode that keeps no book. */
export function beats(mode: GameMode, value: number, standing: RunRecord | null): boolean {
  return keepsRecords(mode) && beatsRow(value, standing);
}

export function bestFor(book: RecordBook, key: RecordKey): RunRecord | null {
  return bestIn(book, recordId(key));
}

/** The book with this run in it, if it earned a row — and whether it did.
 * Pure: the book handed in is never written. */
export function noteRecord(
  book: RecordBook,
  key: RecordKey,
  run: RunRecord,
): { book: RecordBook; record: boolean } {
  if (!keepsRecords(key.mode)) return { book, record: false };
  return noteRow(book, recordId(key), run);
}

/** THE GAP AT A CROSSING: the clock at crossing `index` of this run less
 * the record's at the same crossing, s — negative is ahead. Null where the
 * record has no such crossing or either clock is not a number. */
export function splitGap(record: RunRecord | null, index: number, time: number): number | null {
  return gapAt(record, index, time);
}

/** A stored blob as a book, one row at a time — every row checked, and any
 * that is not a row a run could have set dropped: a time that is not
 * positive and finite, a skis the catalog no longer has. The same rule
 * `mergeSettings` applies, for the same reason. */
export function mergeRecords(parsed: unknown): RecordBook {
  return readBook<RunRecord>(
    parsed,
    (raw, row) =>
      typeof raw.skis === "string" && isSkiId(raw.skis)
        ? { value: row.value, skis: raw.skis, at: row.at, splits: row.splits ?? [] }
        : null,
    { splits: true },
  );
}

/* ── STORAGE ──────────────────────────────────────────────────────────── */

export const RECORDS_KEY = "fall-line.records.v1";

export function loadRecords(): RecordBook {
  try {
    const stored = localStorage.getItem(RECORDS_KEY);
    return mergeRecords(stored === null ? null : JSON.parse(stored));
  } catch {
    // Storage unavailable, or not JSON — an empty book is a good book.
    return {};
  }
}

export function saveRecords(book: RecordBook): void {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(book));
  } catch {
    // Storage unavailable — the row still stands for this session.
  }
}

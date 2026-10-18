// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE KEYFRAMES — copies of the run kept as it goes, so a recording can be
// watched from any moment instead of only from its first step.
//
// A REPLAY IS THE ENGINE STEPPED AGAIN off the controls the run was ridden
// on (`replay.ts`), and an engine step is not free: a free ride's, with its
// crowd and its machines, is about a millisecond. Re-riding a ten-minute run
// from its first step to show its last ten seconds is a minute of the
// processor — so every few seconds the run is COPIED, and a seek is the
// nearest copy at or before the mark, stepped forward from there. That is
// what a scrubber, a "back five seconds" and an instant replay of a crash are
// built on.
//
// WHAT A COPY IS: the whole `GameState` but the map (`level`, built once and
// never written by a run) and the pairs (`spec`, read and never written),
// which stay shared. Everything else is plain data — numbers, arrays, typed
// arrays, the odd map — but for the SEEDED STREAMS: a stream is a closure whose position
// cannot be read off it. So the first copy taught to a stream LOGS IT, in
// place: every draw the run takes from then on is written down, and a copy
// keeps the stream as a position in that log. A run stood up again from the
// copy draws the same values in the same order off the log rather than off
// the stream — which is exactly what the run did, since the engine is
// deterministic. The engine barely draws while a run is on (its streams are
// dealt at the start line), but a free ride's crowd decides off its own
// stream thousands of times a second: the log is kept in pages, and a page
// older than the oldest copy kept is let go.
//
// WHICH COPIES ARE KEPT: one every `KEEP.every` seconds, thinned with age —
// every one of the last `KEEP.near` seconds, then one in `KEEP.midEvery`, then
// one in `KEEP.farEvery` back to `KEEP.window`, and none past it. The moment
// most often asked for (the crash a few seconds ago, the last stretch) is
// never more than a couple of seconds from a copy, and the bill for a long
// free ride stays a few dozen copies. The thinning keeps the copies on fixed
// multiples of their spacing, so a copy dropped stays dropped.
//
// Pure and DOM-free: `tests/replay_test.ts` holds a run stood up from a copy
// to the run itself, step for step.

import { TUNING, type GameState } from "@engine";

/** How the copies are kept. Seconds of the run's own clock. */
export const KEEP = {
  /** One copy every this many seconds. */
  every: 2,
  /** Every copy of the last this many seconds is kept... */
  near: 20,
  /** ...then one in this many seconds back to `mid`... */
  midEvery: 6,
  mid: 120,
  /** ...then one in this many back to the window's start. */
  farEvery: 24,
  /** The furthest back a recording reaches, s: the run thus far, up to
   * this long. */
  window: 480,
} as const;

const HZ = TUNING.physicsHz;

/** A seeded stream as the engine holds it. */
type Stream = {
  next: () => number;
  range: (min: number, max: number) => number;
  int: (min: number, max: number) => number;
  chance: (p: number) => boolean;
  pick: <T>(items: readonly T[]) => T;
};

const STREAM_KEYS = ["next", "range", "int", "chance", "pick"] as const;

function isStream(v: object): v is Stream {
  return STREAM_KEYS.every((k) => typeof (v as Record<string, unknown>)[k] === "function");
}

/** A STREAM'S LOG, kept in pages: the stream holds only the page it is
 * writing, each page the next one after it, and a copy holds the page its
 * mark is on. So a page no kept copy reaches back to is let go by itself —
 * the log of a long free ride's crowd (thousands of draws a second) is as
 * long as the oldest copy kept, never the whole ride. */
type Page = { readonly values: Float64Array; length: number; next: Page | null };

/** Draws a page, 64 KB. */
const PAGE = 8192;

const page = (): Page => ({ values: new Float64Array(PAGE), length: 0, next: null });

/** The page a stream is writing, by stream. */
type Log = { tail: Page };

/** Every stream ever taught to log, and its log. */
const logs = new WeakMap<object, Log>();

function write(log: Log, v: number): void {
  let tail = log.tail;
  if (tail.length === PAGE) {
    tail = tail.next = page();
    log.tail = tail;
  }
  tail.values[tail.length++] = v;
}

/** TEACH A STREAM TO WRITE DOWN WHAT IT DEALS, in place, so every holder of
 * it logs too. Each answer is logged as the number it read back as — the
 * value, the coin as 1 or 0, the pick as its index. */
function logStream(stream: Stream): Log {
  const known = logs.get(stream);
  if (known) return known;
  const log: Log = { tail: page() };
  const { next, range, int, chance, pick } = stream;
  stream.next = () => {
    const v = next();
    write(log, v);
    return v;
  };
  stream.range = (min, max) => {
    const v = range(min, max);
    write(log, v);
    return v;
  };
  stream.int = (min, max) => {
    const v = int(min, max);
    write(log, v);
    return v;
  };
  stream.chance = (p) => {
    const v = chance(p);
    write(log, v ? 1 : 0);
    return v;
  };
  stream.pick = <T>(items: readonly T[]): T => {
    const v = pick(items);
    write(log, items.indexOf(v));
    return v;
  };
  logs.set(stream, log);
  return log;
}

/** A stream read back off its log from `at` on page `from`. Past the log's
 * end it deals zeros: a recording that has walked off its own draws has
 * already parted from its run, and a picture beats an exception in the
 * frame loop. */
function replayStream(from: Page, at: number): Stream {
  let on = from;
  const take = (): number => {
    while (at >= on.length) {
      // The live end of the log: nothing drawn there yet.
      if (at < PAGE || on.next === null) return 0;
      on = on.next;
      at = 0;
    }
    return on.values[at++];
  };
  return {
    next: take,
    range: () => take(),
    int: () => take(),
    chance: () => take() === 1,
    pick: <T>(items: readonly T[]): T => items[Math.max(0, take())],
  };
}

/** A stream inside a copy: the page of its log and how far into it the run
 * had drawn. */
type StreamMark = { readonly page: Page; readonly at: number };
const MARK = Symbol("stream");
type Marked = { [MARK]: StreamMark };

/** The keys a copy SHARES with the run rather than copying: the map and
 * the pairs (never written by a run), and an amateur's knobs (`Amateur`'s,
 * only ever replaced whole, never written in place). */
const SHARED = new Set(["level", "spec", "knobs"]);

/** ROWS PACKED: a long array of records of one shape — a free ride's
 * crowd, four hundred amateurs of some sixty fields each — is copied as
 * one block of numbers and the few fields that are not, rather than as
 * four hundred objects of sixty boxed numbers. A copy of a free ride is
 * about a seventh the size it was. A row of another shape (an optional
 * field set) is copied as it is. */
const PACKED = Symbol("rows");
type Packed = {
  [PACKED]: {
    readonly keys: readonly string[];
    readonly numbers: Float64Array;
    /** Per cell: 1 where the value is in `rest` rather than `numbers`. */
    readonly other: Uint8Array;
    /** The cells that are not numbers, in order. */
    readonly rest: unknown[];
    /** Rows of another shape, copied whole, by index. */
    readonly odd: Map<number, unknown>;
    readonly length: number;
  };
};

/** Arrays shorter than this are copied a row at a time. */
const PACK_FROM = 16;

const plain = (v: unknown): v is Record<string, unknown> =>
  v !== null &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  !ArrayBuffer.isView(v) &&
  !(v instanceof Map) &&
  !(v instanceof Set) &&
  !isStream(v);

function sameKeys(row: Record<string, unknown>, keys: readonly string[]): boolean {
  let i = 0;
  for (const k in row) {
    if (k !== keys[i++]) return false;
  }
  return i === keys.length;
}

function packRows(rows: readonly unknown[]): Packed | null {
  const first = rows[0];
  if (rows.length < PACK_FROM || !plain(first)) return null;
  const keys = Object.keys(first);
  const width = keys.length;
  const numbers = new Float64Array(rows.length * width);
  const other = new Uint8Array(rows.length * width);
  const rest: unknown[] = [];
  const odd = new Map<number, unknown>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!plain(row) || !sameKeys(row, keys)) {
      odd.set(i, copyOut(row));
      continue;
    }
    for (let j = 0; j < width; j++) {
      const k = keys[j];
      const v = row[k];
      if (typeof v === "number") numbers[i * width + j] = v;
      else {
        other[i * width + j] = 1;
        rest.push(SHARED.has(k) ? v : copyOut(v));
      }
    }
  }
  return { [PACKED]: { keys, numbers, other, rest, odd, length: rows.length } };
}

function unpackRows(packed: Packed[typeof PACKED]): unknown[] {
  const { keys, numbers, other, rest, odd, length } = packed;
  const width = keys.length;
  const rows: unknown[] = new Array(length);
  let r = 0;
  for (let i = 0; i < length; i++) {
    const kept = odd.get(i);
    if (kept !== undefined || odd.has(i)) {
      rows[i] = copyIn(kept);
      continue;
    }
    const row: Record<string, unknown> = {};
    for (let j = 0; j < width; j++) {
      const k = keys[j];
      if (other[i * width + j] === 0) row[k] = numbers[i * width + j];
      else {
        const v = rest[r++];
        row[k] = SHARED.has(k) ? v : copyIn(v);
      }
    }
    rows[i] = row;
  }
  return rows;
}

function copyOut(v: unknown): unknown {
  if (v === null || typeof v !== "object") return v;
  if (ArrayBuffer.isView(v)) return (v as unknown as { slice: () => unknown }).slice();
  if (Array.isArray(v)) return packRows(v) ?? v.map(copyOut);
  if (v instanceof Map) return new Map([...v].map(([k, x]) => [k, copyOut(x)]));
  if (v instanceof Set) return new Set([...v].map(copyOut));
  if (isStream(v)) {
    const { tail } = logStream(v);
    return { [MARK]: { page: tail, at: tail.length } } satisfies Marked;
  }
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) out[k] = SHARED.has(k) ? x : copyOut(x);
  return out;
}

function copyIn(v: unknown): unknown {
  if (v === null || typeof v !== "object") return v;
  if (ArrayBuffer.isView(v)) return (v as unknown as { slice: () => unknown }).slice();
  if (Array.isArray(v)) return v.map(copyIn);
  if (v instanceof Map) return new Map([...v].map(([k, x]) => [k, copyIn(x)]));
  if (v instanceof Set) return new Set([...v].map(copyIn));
  const rows = (v as Partial<Packed>)[PACKED];
  if (rows) return unpackRows(rows);
  const mark = (v as Partial<Marked>)[MARK];
  if (mark) return replayStream(mark.page, mark.at);
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) out[k] = SHARED.has(k) ? x : copyIn(x);
  return out;
}

/** ONE COPY OF THE RUN: after `step` steps of the recording, and the live
 * run it was copied off. */
export type Keyframe = { readonly step: number; readonly copy: unknown; readonly run: GameState };

/** Copy a run as it stands. Teaches its streams to log, so it is taken on
 * the LIVE run, never on a run stood up from a copy. */
export function keyframeOf(state: GameState, step: number): Keyframe {
  return { step, copy: copyOut(state), run: state };
}

/** Every run stood up from a copy, and the run it is a replay of, so a
 * drawing can tell a replay from a run — and which run's it is. */
const stood = new WeakMap<GameState, GameState>();

/** A run stood up from a copy: a fresh state, free to be stepped, that the
 * copy itself survives. */
export function standUp(frame: Keyframe): GameState {
  const state = copyIn(frame.copy) as GameState;
  stood.set(state, frame.run);
  return state;
}

/** Whether `state` is a replay's — stood up from a copy — rather than a run. */
export function isStoodUp(state: GameState): boolean {
  return stood.has(state);
}

/** The run `state` is a replay of, or null when it is a run itself. */
export function replayOf(state: GameState): GameState | null {
  return stood.get(state) ?? null;
}

/** The spacing a copy `age` seconds behind the newest is kept at, s — or
 * null past the window. */
export function spacingAt(age: number): number | null {
  if (age < KEEP.near) return KEEP.every;
  if (age < KEEP.mid) return KEEP.midEvery;
  if (age <= KEEP.window) return KEEP.farEvery;
  return null;
}

export type Keyframes = {
  /** After step `step` of the recording: a copy taken when one is due. */
  step: (state: GameState, step: number) => void;
  /** The newest copy at or before `step`; the oldest kept where none is. */
  before: (step: number) => Keyframe;
  /** The oldest copy kept — where the recording starts. */
  first: () => Keyframe;
  /** How many are kept (a lab's, a test's). */
  count: () => number;
};

/** The copies of one run, the first taken as it stands now (step 0). */
export function createKeyframes(state: GameState): Keyframes {
  const every = Math.round(KEEP.every * HZ);
  const kept: Keyframe[] = [keyframeOf(state, 0)];
  const thin = (newest: number): void => {
    for (let i = kept.length - 2; i >= 0; i--) {
      const s = kept[i].step;
      const spacing = spacingAt((newest - s) / HZ);
      if (spacing === null || s % Math.round(spacing * HZ) !== 0) kept.splice(i, 1);
    }
  };
  return {
    step: (live, step) => {
      if (step % every !== 0 || step === 0) return;
      kept.push(keyframeOf(live, step));
      thin(step);
    },
    before: (step) => {
      for (let i = kept.length - 1; i >= 0; i--) if (kept[i].step <= step) return kept[i];
      return kept[0];
    },
    first: () => kept[0],
    count: () => kept.length,
  };
}

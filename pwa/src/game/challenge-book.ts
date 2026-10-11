// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CHALLENGE BOOK — what the player has won at the free ride's
// challenges (`engine/game/challenges/`, `docs/challenges.md`), map by map,
// kept on this device. Each map deals its challenges off its own key
// (`challengeKey`: its face or country, its seed, its generator), and the
// book files a result under that key and the challenge's id, both of which
// stay the same for good — so a medal won on a mountain is there the next
// time that mountain is ridden, whichever run it was stood up on.
//
// WHAT IS KEPT, a challenge at a time: the best MEDAL, the best VALUE (a
// line's time, a trick's tier, how many spots or summits found), what has
// been FOUND (a count kind's ids — a spot found stays found), and when it
// last got better. A medal only ever replaces a worse one, and a better
// value on the same medal is kept; a value that earned no medal is kept
// only while there is no medal, so a line skied too slowly for bronze still
// shows how near it came.
//
// TWO HALVES, as `stats.ts` is split: everything above the storage line is
// pure (filing a result, reading a stored blob back, the totals), and the
// two functions under it are the skin over `localStorage`.

import {
  medalBeats,
  medalOf,
  MEDALS,
  type ChallengeBase,
  type ChallengeMemory,
  type Medal,
} from "@engine";

/** One challenge's best, on one map. */
export type ChallengeEntry = {
  medal: Medal | null;
  /** The best value: a time, s (lower better), a tier or a count. */
  value?: number;
  /** A count kind's ids found so far. */
  found?: string[];
  /** When it last got better, ms since the epoch. */
  at: number;
};

/** One map's results, by challenge id. */
export type ChallengeMap = Readonly<Record<string, ChallengeEntry>>;

export type ChallengeBook = {
  v: 1;
  /** By map key (`challengeKey`). */
  maps: Readonly<Record<string, ChallengeMap>>;
};

/** What a result did to the book: a first entry, a better medal, a better
 * value on the same medal, or nothing. */
export type Filed = "new" | "medal" | "value" | null;

/** What a judge said, as the book files it. */
export type ChallengeHeld = {
  id: string;
  /** The value reached: the time or tier, or the count found. */
  value?: number;
  /** A count kind: what has just been found. */
  found?: readonly string[];
};

export function emptyChallenges(): ChallengeBook {
  return { v: 1, maps: {} };
}

/** The entry for challenge `id` on map `key`, or null. */
export function entryOf(book: ChallengeBook, key: string, id: string): ChallengeEntry | null {
  return book.maps[key]?.[id] ?? null;
}

/** What the judge is armed with: what each count kind has already found on
 * map `key`, so a spot is said once for good. */
export function memoryOf(book: ChallengeBook, key: string): ChallengeMemory {
  const found: Record<string, readonly string[]> = {};
  for (const [id, e] of Object.entries(book.maps[key] ?? {})) if (e.found) found[id] = e.found;
  return { found };
}

/** Whether value `a` is better than `b` on challenge `c`. */
function betterValue(c: Pick<ChallengeBase, "better">, a: number, b: number | undefined): boolean {
  if (b === undefined) return true;
  return c.better === "lower" ? a < b : a > b;
}

/** FILE a result on map `key`: the book as it stands after it, and what it
 * did. A count kind's found ids are added to what was found before and its
 * value is how many there are; its medal is read off that count. */
export function fileResult(
  book: ChallengeBook,
  key: string,
  c: Pick<ChallengeBase, "id" | "medals" | "better">,
  held: ChallengeHeld,
  at: number,
): { book: ChallengeBook; filed: Filed } {
  const was = entryOf(book, key, c.id);
  let found = was?.found;
  let value = held.value;
  if (held.found) {
    const all = new Set([...(was?.found ?? []), ...held.found]);
    found = [...all].sort();
    value = found.length;
  }
  if (value === undefined) return { book, filed: null };
  const medal = medalOf(c, value);
  let filed: Filed = null;
  let next: ChallengeEntry | null = null;
  if (!was) {
    filed = "new";
    next = { medal, value, at, ...(found ? { found } : {}) };
  } else if (medalBeats(medal, was.medal)) {
    filed = "medal";
    next = { medal, value, at, ...(found ? { found } : {}) };
  } else if (medal === was.medal && betterValue(c, value, was.value)) {
    filed = "value";
    next = { medal, value, at, ...(found ? { found } : {}) };
  } else if (found && found.length !== (was.found?.length ?? 0)) {
    // Found more without a better medal: still kept, so it stays found.
    next = { ...was, found, value: Math.max(found.length, was.value ?? 0) };
  }
  if (!next) return { book, filed: null };
  const map = { ...(book.maps[key] ?? {}), [c.id]: next };
  return { book: { v: 1, maps: { ...book.maps, [key]: map } }, filed };
}

/** Every medal held, across every map: how many of each. */
export function medalTally(book: ChallengeBook): Record<Medal, number> {
  const out: Record<Medal, number> = { bronze: 0, silver: 0, gold: 0 };
  for (const map of Object.values(book.maps)) {
    for (const e of Object.values(map)) if (e.medal) out[e.medal]++;
  }
  return out;
}

/* ── READING A STORED BLOB ─────────────────────────────────────────────── */

const record = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function entryFrom(v: unknown): ChallengeEntry | null {
  const r = record(v);
  const medal = MEDALS.includes(r.medal as Medal) ? (r.medal as Medal) : null;
  const value =
    typeof r.value === "number" && Number.isFinite(r.value) && r.value >= 0 ? r.value : undefined;
  const found = Array.isArray(r.found)
    ? [...new Set(r.found.filter((f): f is string => typeof f === "string"))].sort()
    : undefined;
  if (medal === null && value === undefined && !found) return null;
  const at = typeof r.at === "number" && Number.isFinite(r.at) ? r.at : 0;
  return { medal, at, ...(value !== undefined ? { value } : {}), ...(found ? { found } : {}) };
}

/** A stored blob as a book this build can read — an empty one for anything
 * that is not one, and any entry that is not one left out. */
export function readChallenges(blob: unknown): ChallengeBook {
  const r = record(blob);
  if (r.v !== 1) return emptyChallenges();
  const maps: Record<string, ChallengeMap> = {};
  for (const [key, m] of Object.entries(record(r.maps))) {
    const map: Record<string, ChallengeEntry> = {};
    for (const [id, e] of Object.entries(record(m))) {
      const entry = entryFrom(e);
      if (entry) map[id] = entry;
    }
    if (Object.keys(map).length > 0) maps[key] = map;
  }
  return { v: 1, maps };
}

/* ── STORAGE ──────────────────────────────────────────────────────────── */

export const CHALLENGES_KEY = "fall-line.challenges.v1";

export function loadChallenges(): ChallengeBook {
  try {
    const stored = localStorage.getItem(CHALLENGES_KEY);
    return stored ? readChallenges(JSON.parse(stored)) : emptyChallenges();
  } catch {
    return emptyChallenges();
  }
}

export function saveChallenges(book: ChallengeBook): void {
  try {
    localStorage.setItem(CHALLENGES_KEY, JSON.stringify(book));
  } catch {
    // Storage full or refused: the medals live on for this session.
  }
}

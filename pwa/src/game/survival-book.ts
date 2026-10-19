// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SURVIVAL HIGHSCORE: the longest the army has hunted the player and
// not got him (`wanted.ts`'s survival timer), kept on this device the way
// the record book keeps a map's best time (`records.ts`).
//
// TWO HALVES: above the storage line the pure part (the reading of a stored
// blob, what beats the best); under it the skin over `localStorage`, read
// once and kept in memory. A device with no storage keeps this session's
// best in memory.

/** The book: the best time survived, s, and the stars it reached. */
export type SurvivalBook = { best: number; stars: number };

const EMPTY: SurvivalBook = { best: 0, stars: 0 };

/** A stored blob read into a book this build trusts — anything else an
 * empty one. */
export function readSurvival(raw: unknown): SurvivalBook {
  if (!raw || typeof raw !== "object") return { ...EMPTY };
  const r = raw as Record<string, unknown>;
  const best = typeof r.best === "number" && Number.isFinite(r.best) && r.best > 0 ? r.best : 0;
  const stars =
    typeof r.stars === "number" && Number.isInteger(r.stars) && r.stars >= 0 && r.stars <= 5
      ? r.stars
      : 0;
  return { best, stars };
}

/** The book after a hunt of `seconds` reaching `stars`: the better of the
 * two — longer, never a tie. */
export function withSurvival(book: SurvivalBook, seconds: number, stars: number): SurvivalBook {
  return seconds > book.best ? { best: seconds, stars } : book;
}

/* ── STORAGE ──────────────────────────────────────────────────────────── */

export const SURVIVAL_KEY = "fall-line.survival.v1";

/** How often a hunt still running is written down while it beats the
 * best, s of the hunt — a run torn down mid-hunt keeps nearly all of it. */
const SAVE_EVERY = 5;

let held: SurvivalBook | null = null;
/** The hunt time last written, s, and whether the held best is ahead of
 * what storage has. */
let savedAt = 0;
let dirty = false;

export function loadSurvival(): SurvivalBook {
  if (held) return held;
  try {
    const stored = localStorage.getItem(SURVIVAL_KEY);
    held = readSurvival(stored === null ? null : JSON.parse(stored));
  } catch {
    held = { ...EMPTY };
  }
  return held;
}

/** File the hunt on screen: `seconds` survived at `stars`, `final` once it
 * has ended. Written down when it ends, or every `SAVE_EVERY` s while it
 * runs past the best. Returns the book. */
export function noteSurvival(seconds: number, stars: number, final: boolean): SurvivalBook {
  const was = loadSurvival();
  const next = withSurvival(was, seconds, stars);
  if (next !== was) {
    held = next;
    dirty = true;
  }
  if (dirty && (final || Math.abs(seconds - savedAt) >= SAVE_EVERY)) {
    savedAt = seconds;
    dirty = false;
    try {
      localStorage.setItem(SURVIVAL_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable — the best still stands for this session.
    }
  }
  return next;
}

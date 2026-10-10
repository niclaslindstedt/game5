// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STATISTICS — what the player has done on the snow, run after run,
// kept on this device and read on the front door's STATISTICS card
// (`menu-stats.tsx`). Not a record book: `records.ts` keeps the best TIME on
// a map; this keeps the life of a skier — how far he has gone, how much
// mountain he has come down, how fast he has ever been, how long he has
// hung in the air, and every tree, every broken bone and every grimbear
// along the way.
//
// TWO HALVES, the way `settings.ts` and `records.ts` are split: everything
// above the storage line is pure (the tally of one run, the book it is
// folded into, the reading of a stored blob), and the two functions under
// it are the skin over `localStorage`. A device with no storage keeps this
// session's numbers in memory.
//
// WHAT A RUN IS: everything the player rode between one run being stood up
// and the next — a race from the gate to the flag, a free ride from the
// chair to the menu. Only what the PLAYER rides is counted: the bot that
// rides the race behind a card, a link's pre-roll and a replay are not him.
// A run of under `MIN_RUN` seconds of riding is a press of RESTART, never a
// run, and counts for nothing.
//
// WHAT IS COUNTED ON SKIS and what is not: the distance and the vertical
// are the skier's own, on his skis and on his feet — never on a lift, in a
// helicopter or the jump plane, falling from it or under its canopy, on a
// snowmobile, under a wing, in a piste machine's cab, in
// the lodge, or thrown off his skis tumbling down the hill. The machines
// keep columns of their own.
//
// THE BOOK IS FOLDED IN SHARES. A run is folded into the book whenever
// there is a reason to keep it — the flag, the run out, the next run stood
// up, the page hidden, the STATISTICS card opened — and keeps riding after
// that, so the tracker holds two tallies: the WHOLE run (what its line in
// RECENT shows) and the SHARE not yet folded (what the totals are owed).
// The sums are folded from the share and the bests from the whole, so a run
// folded three times is counted once.

import type { CrashCause, DeathCause, GameMode, GameState, SkiId, TrickKind } from "@engine";
import { TUNING, bonesOf, severityOf } from "@engine";

/** Seconds of riding before a run is a run. */
export const MIN_RUN = 3;

/** How many runs the RECENT list keeps, newest first. */
export const RECENT_RUNS = 12;

/** The share of one run the totals are owed — every column a sum. */
export type RunSums = {
  /** Seconds ridden. */
  time: number;
  /** Metres travelled on skis (or on foot), and metres of height lost. */
  distance: number;
  vertical: number;
  /** Seconds off the snow, and the flights that counted as air. */
  air: number;
  jumps: number;
  wipeouts: number;
  /** Trunks (and posts, stones, towers) met. */
  trees: number;
  saves: number;
  injuries: number;
  bones: number;
  deaths: number;
  gates: number;
  missed: number;
  lifts: number;
  /** Seconds in a helicopter, under a wing, in a groomer's cab; metres on
   * a snowmobile. */
  heli: number;
  para: number;
  groomer: number;
  sled: number;
  beers: number;
  mauled: number;
  /** Rivals and amateurs shouldered. */
  bumps: number;
  /** Trick points banked. */
  points: number;
};

/** One run, whole: its sums and what it did at its best. */
export type RunTally = RunSums & {
  /** When it was stood up, ms since the epoch — also its id. */
  at: number;
  mode: GameMode;
  seed: number;
  skis: SkiId;
  /** The fastest, m/s; the longest flight, s; the hardest landing ridden
   * away, g; the biggest combo banked; the worst injury severity score. */
  top: number;
  longest: number;
  landing: number;
  combo: number;
  iss: number;
  /** The hardest blow the body took, g (`BodyState.peak`); the run's banked
   * trick score. */
  peak: number;
  score: number;
  /** Over the line: its time and place, or out of it. */
  finished: boolean;
  time_: number | null;
  place: number | null;
  out: boolean;
  /** What threw him, by cause. */
  causes: Partial<Record<CrashCause, number>>;
  killed: Partial<Record<DeathCause, number>>;
  /** Every trick element won, by `trickKey`. */
  tricks: Record<string, number>;
};

/** A trick element as the book keys it: its kind, and the revolution of
 * its flight past the first (`backflip`, `backflip2` — a double). */
export function trickKey(kind: TrickKind, spins: number): string {
  return spins > 1 ? `${kind}${spins}` : kind;
}

/** A trick key read back: the kind and the revolution. */
export function trickOf(key: string): { kind: TrickKind; spins: number } | null {
  const m = /^([a-z]+)(\d*)$/.exec(key);
  if (!m || !(TRICK_KINDS as readonly string[]).includes(m[1])) return null;
  return { kind: m[1] as TrickKind, spins: m[2] ? Number(m[2]) : 1 };
}

const TRICK_KINDS: readonly TrickKind[] = [
  "air",
  "backflip",
  "frontflip",
  "spin",
  "half",
  "twist",
  "landing",
  "daffy",
  "spread",
  "grab",
];

/** ONE MAP'S OWN BOOK: how often it was ridden, its best time per mode
 * over the line, its best trick score and top speed, and the tricks landed
 * on it. */
export type SeedRow = {
  seed: number;
  runs: number;
  /** When it was last ridden, ms since the epoch. */
  at: number;
  distance: number;
  top: number;
  score: number;
  times: Partial<Record<GameMode, number>>;
  tricks: Record<string, number>;
};

/** How many maps the book keeps a row for — the most lately ridden. */
export const SEED_ROWS = 60;

/** A best in the book, and the run that set it. */
export type Best = { value: number; mode: GameMode; seed: number; skis: SkiId; at: number };

/** What the book keeps per mode and per pair. */
export type ShareRow = { runs: number; time: number; distance: number };

export type StatsBook = {
  v: 1;
  /** The first run counted, ms since the epoch (0 none yet). */
  since: number;
  runs: number;
  finished: number;
  wins: number;
  podiums: number;
  outs: number;
  sums: RunSums;
  bests: {
    top: Best | null;
    longest: Best | null;
    landing: Best | null;
    combo: Best | null;
    iss: Best | null;
    peak: Best | null;
    bones: Best | null;
    score: Best | null;
  };
  causes: Partial<Record<CrashCause, number>>;
  killed: Partial<Record<DeathCause, number>>;
  modes: Partial<Record<GameMode, ShareRow>>;
  skis: Partial<Record<SkiId, ShareRow>>;
  /** Every trick element won, on every map, by `trickKey`. */
  tricks: Record<string, number>;
  /** Each map's own book, by its seed. */
  seeds: Record<string, SeedRow>;
  recent: RunTally[];
};

const SUM_KEYS: readonly (keyof RunSums)[] = [
  "time",
  "distance",
  "vertical",
  "air",
  "jumps",
  "wipeouts",
  "trees",
  "saves",
  "injuries",
  "bones",
  "deaths",
  "gates",
  "missed",
  "lifts",
  "heli",
  "para",
  "groomer",
  "sled",
  "beers",
  "mauled",
  "bumps",
  "points",
];

const BEST_KEYS = ["top", "longest", "landing", "combo", "iss", "peak", "bones", "score"] as const;

export function zeroSums(): RunSums {
  const out = {} as RunSums;
  for (const k of SUM_KEYS) out[k] = 0;
  return out;
}

export function emptyStats(): StatsBook {
  return {
    v: 1,
    since: 0,
    runs: 0,
    finished: 0,
    wins: 0,
    podiums: 0,
    outs: 0,
    sums: zeroSums(),
    bests: {
      top: null,
      longest: null,
      landing: null,
      combo: null,
      iss: null,
      peak: null,
      bones: null,
      score: null,
    },
    causes: {},
    killed: {},
    modes: {},
    skis: {},
    tricks: {},
    seeds: {},
    recent: [],
  };
}

/** Whether the skier is on his own skis (or his own feet) — the distance
 * and the vertical are counted only then (see the header). */
export function onSkis(s: GameState): boolean {
  const k = s.skier;
  if (k.thrown || k.lift) return false;
  if (s.heli?.rider) return false;
  if (s.plane?.rider) return false;
  // Falling from the plane or hung under the canopy: on his skis again once
  // he is down on them, or cut away.
  const ch = s.chute;
  if (ch && !ch.done && ch.mode !== "landed" && ch.mode !== "released") return false;
  if (s.sled?.mode === "ridden") return false;
  if (s.para && s.para.mode !== "dropped") return false;
  if (s.afterski?.inside) return false;
  if (s.groomers?.some((g) => g.rider)) return false;
  return true;
}

/** WHAT ONE RUN DID, step by step — the app arms it on every run stood up,
 * steps it on every step the player rides, and folds it into the book
 * (`foldRun`) whenever it hands it over. */
export type StatsTracker = {
  arm: (state: GameState, mode: GameMode, at: number) => void;
  step: (state: GameState) => void;
  /** The run as it stands, and the share of it not yet folded — null when
   * there is nothing worth folding yet (`MIN_RUN`). Marks the share folded. */
  take: () => { whole: RunTally; share: RunSums; first: boolean } | null;
};

export function createStatsTracker(): StatsTracker {
  let whole: RunTally | null = null;
  let share = zeroSums();
  let folded = false;
  let last: { x: number; y: number; z: number } | null = null;
  let sledLast: { x: number; z: number } | null = null;

  const add = (k: keyof RunSums, v: number): void => {
    if (!whole) return;
    whole[k] += v;
    share[k] += v;
  };

  return {
    arm(state, mode, at) {
      whole = {
        ...zeroSums(),
        at,
        mode,
        seed: state.seed,
        skis: state.skier.spec.id,
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
      };
      share = zeroSums();
      folded = false;
      last = null;
      sledLast = null;
    },
    step(state) {
      const run = whole;
      if (!run) return;
      const k = state.skier;
      const dt = TUNING.dt;
      add("time", dt);
      if (onSkis(state)) {
        if (last) {
          const dx = k.x - last.x;
          const dy = k.y - last.y;
          const dz = k.z - last.z;
          const d = Math.hypot(dx, dy, dz);
          // A reset or a restart stands him somewhere else in one step: that
          // is no distance skied (no skier goes 60 m in a step).
          if (d < 1) {
            add("distance", d);
            if (dy < 0) add("vertical", -dy);
          }
        }
        last = { x: k.x, y: k.y, z: k.z };
        if (k.speed > run.top) run.top = k.speed;
        if (k.airborne) add("air", dt);
      } else {
        last = null;
      }
      if (k.body.peak > run.peak) run.peak = k.body.peak;
      if (state.tricks.score > run.score) run.score = state.tricks.score;
      if (state.heli?.rider) add("heli", dt);
      if (state.para?.mode === "flown") add("para", dt);
      if (state.groomers?.some((g) => g.rider)) add("groomer", dt);
      if (state.sled?.mode === "ridden") {
        const sl = state.sled;
        if (sledLast) {
          const d = Math.hypot(sl.x - sledLast.x, sl.z - sledLast.z);
          if (d < 1) add("sled", d);
        }
        sledLast = { x: sl.x, z: sl.z };
      } else {
        sledLast = null;
      }
      for (const e of state.events) {
        switch (e.kind) {
          case "land":
            add("jumps", 1);
            if (e.airTime > run.longest) run.longest = e.airTime;
            if (!e.harsh && e.g > run.landing) run.landing = e.g;
            break;
          case "wipeout":
            add("wipeouts", 1);
            run.causes[e.cause] = (run.causes[e.cause] ?? 0) + 1;
            break;
          case "hit":
            add("trees", 1);
            break;
          case "save":
            add("saves", 1);
            break;
          case "injury": {
            add("injuries", 1);
            add("bones", bonesOf(e.injury, e.part).length);
            const iss = severityOf(k.body);
            if (iss > run.iss) run.iss = iss;
            break;
          }
          case "death":
            add("deaths", 1);
            run.killed[e.cause] = (run.killed[e.cause] ?? 0) + 1;
            break;
          case "checkpoint":
            add("gates", 1);
            break;
          case "missed":
            add("missed", 1);
            break;
          case "lift":
            if (e.phase === "take") add("lifts", 1);
            break;
          case "afterski":
            if (e.phase === "beer") add("beers", 1);
            break;
          case "grimbear":
            if (e.phase === "maul") add("mauled", 1);
            break;
          case "bump":
            add("bumps", 1);
            break;
          case "trick": {
            const key = trickKey(e.trick, e.spins);
            run.tricks[key] = (run.tricks[key] ?? 0) + 1;
            break;
          }
          case "combo":
            add("points", e.points);
            if (e.points > run.combo) run.combo = e.points;
            break;
          case "finish":
            run.finished = true;
            run.time_ = e.time;
            run.place = e.place;
            break;
          case "out":
            run.out = true;
            break;
          default:
            break;
        }
      }
    },
    take() {
      // Nothing yet, or nothing new since the last fold.
      if (!whole || whole.time < MIN_RUN || (folded && share.time === 0)) return null;
      const out = { whole: cloneTally(whole), share, first: !folded };
      share = zeroSums();
      folded = true;
      return out;
    },
  };
}

function cloneTally(t: RunTally): RunTally {
  return { ...t, causes: { ...t.causes }, killed: { ...t.killed }, tricks: { ...t.tricks } };
}

/** Whether a race's place earns the podium (a field to be placed against
 * — a free ride or a tricks run has no place worth the name). */
const PODIUM = 3;

/** THE RUN FOLDED INTO THE BOOK: the share into the sums, the run's bests
 * into the book's, its line into RECENT (replaced, if it is already there).
 * Pure: a new book, the old one untouched. */
export function foldRun(
  book: StatsBook,
  taken: { whole: RunTally; share: RunSums; first: boolean },
): StatsBook {
  const { whole, share, first } = taken;
  const next: StatsBook = {
    ...book,
    sums: { ...book.sums },
    bests: { ...book.bests },
    causes: { ...book.causes },
    killed: { ...book.killed },
    modes: { ...book.modes },
    skis: { ...book.skis },
    tricks: { ...book.tricks },
    seeds: { ...book.seeds },
  };
  for (const k of SUM_KEYS) next.sums[k] += share[k];
  if (first) {
    next.runs += 1;
    if (next.since === 0) next.since = whole.at;
  }
  const mode = next.modes[whole.mode] ?? { runs: 0, time: 0, distance: 0 };
  next.modes[whole.mode] = {
    runs: mode.runs + (first ? 1 : 0),
    time: mode.time + share.time,
    distance: mode.distance + share.distance,
  };
  const pair = next.skis[whole.skis] ?? { runs: 0, time: 0, distance: 0 };
  next.skis[whole.skis] = {
    runs: pair.runs + (first ? 1 : 0),
    time: pair.time + share.time,
    distance: pair.distance + share.distance,
  };

  // The run's whole tally against what RECENT already holds of it: the
  // counts that are the run's once (the flag, the causes) are owed only what
  // is new since the last fold.
  const before = book.recent.find((r) => r.at === whole.at) ?? null;
  if (whole.finished && !before?.finished) {
    next.finished += 1;
    if (whole.place !== null && raced(whole.mode)) {
      if (whole.place === 1) next.wins += 1;
      if (whole.place <= PODIUM) next.podiums += 1;
    }
  }
  if (whole.out && !before?.out) next.outs += 1;
  for (const [cause, n] of Object.entries(whole.causes) as [CrashCause, number][]) {
    const owed = n - (before?.causes[cause] ?? 0);
    if (owed > 0) next.causes[cause] = (next.causes[cause] ?? 0) + owed;
  }
  for (const [cause, n] of Object.entries(whole.killed) as [DeathCause, number][]) {
    const owed = n - (before?.killed[cause] ?? 0);
    if (owed > 0) next.killed[cause] = (next.killed[cause] ?? 0) + owed;
  }

  const seedKey = String(whole.seed);
  const map: SeedRow = next.seeds[seedKey] ?? {
    seed: whole.seed,
    runs: 0,
    at: 0,
    distance: 0,
    top: 0,
    score: 0,
    times: {},
    tricks: {},
  };
  const row: SeedRow = {
    ...map,
    runs: map.runs + (first ? 1 : 0),
    at: Math.max(map.at, whole.at),
    distance: map.distance + share.distance,
    top: Math.max(map.top, whole.top),
    score: Math.max(map.score, whole.score),
    times: { ...map.times },
    tricks: { ...map.tricks },
  };
  if (whole.finished && whole.time_ !== null) {
    const held = row.times[whole.mode];
    if (held === undefined || whole.time_ < held) row.times[whole.mode] = whole.time_;
  }
  for (const [key, n] of Object.entries(whole.tricks)) {
    const owed = n - (before?.tricks[key] ?? 0);
    if (owed <= 0) continue;
    next.tricks[key] = (next.tricks[key] ?? 0) + owed;
    row.tricks[key] = (row.tricks[key] ?? 0) + owed;
  }
  next.seeds[seedKey] = row;
  const kept = Object.entries(next.seeds).sort((a, b) => b[1].at - a[1].at);
  if (kept.length > SEED_ROWS) next.seeds = Object.fromEntries(kept.slice(0, SEED_ROWS));

  for (const key of BEST_KEYS) {
    const value = whole[key];
    const held = next.bests[key];
    if (value > 0 && (held === null || value > held.value)) {
      next.bests[key] = {
        value,
        mode: whole.mode,
        seed: whole.seed,
        skis: whole.skis,
        at: whole.at,
      };
    }
  }

  next.recent = [whole, ...book.recent.filter((r) => r.at !== whole.at)]
    .sort((a, b) => b.at - a.at)
    .slice(0, RECENT_RUNS);
  return next;
}

/** The modes a place means something on: a race against a field. */
function raced(mode: GameMode): boolean {
  return mode !== "free" && mode !== "tricks";
}

/** THE AVERAGE SPEED of everything ridden on skis, m/s — 0 before any. */
export function averageSpeed(book: StatsBook): number {
  return book.sums.time > 0 ? book.sums.distance / book.sums.time : 0;
}

/** The modes ridden, most time first. */
export function modesByTime(book: StatsBook): [GameMode, ShareRow][] {
  return (Object.entries(book.modes) as [GameMode, ShareRow][])
    .filter(([, row]) => row.runs > 0)
    .sort((a, b) => b[1].time - a[1].time);
}

/** The pairs ridden, most distance first. */
export function skisByDistance(book: StatsBook): [SkiId, ShareRow][] {
  return (Object.entries(book.skis) as [SkiId, ShareRow][])
    .filter(([, row]) => row.runs > 0)
    .sort((a, b) => b[1].distance - a[1].distance);
}

/** The tricks landed, most often first — on one map's row, or on all. */
export function tricksByCount(tricks: Record<string, number>): [string, number][] {
  return Object.entries(tricks)
    .filter(([key, n]) => n > 0 && trickOf(key) !== null)
    .sort((a, b) => b[1] - a[1]);
}

/** The maps ridden, most lately first. */
export function seedsByRecent(book: StatsBook): SeedRow[] {
  return Object.values(book.seeds).sort((a, b) => b.at - a.at);
}

/** What threw him, most often first. */
export function causesByCount(book: StatsBook): [CrashCause, number][] {
  return (Object.entries(book.causes) as [CrashCause, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
}

/* ── READING A STORED BOOK ────────────────────────────────────────────────
   A blob off the disk is somebody else's word: every number is checked to
   be a finite, non-negative number and every best to be shaped like one, and
   whatever is not is dropped rather than trusted. */

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

const record = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function counts<K extends string>(v: unknown): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  for (const [k, n] of Object.entries(record(v))) if (num(n) > 0) out[k as K] = num(n);
  return out;
}

function sumsOf(v: unknown): RunSums {
  const r = record(v);
  const out = zeroSums();
  for (const k of SUM_KEYS) out[k] = num(r[k]);
  return out;
}

function bestOf(v: unknown): Best | null {
  const r = record(v);
  if (typeof r.mode !== "string" || typeof r.skis !== "string") return null;
  const value = num(r.value);
  if (value <= 0) return null;
  return {
    value,
    mode: r.mode as GameMode,
    seed: num(r.seed),
    skis: r.skis as SkiId,
    at: num(r.at),
  };
}

function rowsOf<K extends string>(v: unknown): Partial<Record<K, ShareRow>> {
  const out: Partial<Record<K, ShareRow>> = {};
  for (const [k, row] of Object.entries(record(v))) {
    const r = record(row);
    out[k as K] = { runs: num(r.runs), time: num(r.time), distance: num(r.distance) };
  }
  return out;
}

function seedRowOf(v: unknown): SeedRow | null {
  const r = record(v);
  if (num(r.at) <= 0) return null;
  return {
    seed: num(r.seed),
    runs: num(r.runs),
    at: num(r.at),
    distance: num(r.distance),
    top: num(r.top),
    score: num(r.score),
    times: counts(r.times),
    tricks: counts(r.tricks) as Record<string, number>,
  };
}

function seedsOf(v: unknown): Record<string, SeedRow> {
  const out: Record<string, SeedRow> = {};
  for (const [k, row] of Object.entries(record(v))) {
    const read = seedRowOf(row);
    if (read) out[k] = read;
  }
  return out;
}

function tallyOf(v: unknown): RunTally | null {
  const r = record(v);
  if (typeof r.mode !== "string" || typeof r.skis !== "string" || num(r.at) <= 0) return null;
  const place = num(r.place);
  const time = num(r.time_);
  return {
    ...sumsOf(r),
    at: num(r.at),
    mode: r.mode as GameMode,
    seed: num(r.seed),
    skis: r.skis as SkiId,
    top: num(r.top),
    longest: num(r.longest),
    landing: num(r.landing),
    combo: num(r.combo),
    iss: num(r.iss),
    peak: num(r.peak),
    score: num(r.score),
    finished: r.finished === true,
    time_: time > 0 ? time : null,
    place: place > 0 ? place : null,
    out: r.out === true,
    causes: counts(r.causes),
    killed: counts(r.killed),
    tricks: counts(r.tricks) as Record<string, number>,
  };
}

/** A stored blob as a book this build can read — an empty one for anything
 * that is not one. */
export function readStats(blob: unknown): StatsBook {
  const r = record(blob);
  if (r.v !== 1) return emptyStats();
  const bests = record(r.bests);
  return {
    v: 1,
    since: num(r.since),
    runs: num(r.runs),
    finished: num(r.finished),
    wins: num(r.wins),
    podiums: num(r.podiums),
    outs: num(r.outs),
    sums: sumsOf(r.sums),
    bests: {
      top: bestOf(bests.top),
      longest: bestOf(bests.longest),
      landing: bestOf(bests.landing),
      combo: bestOf(bests.combo),
      iss: bestOf(bests.iss),
      peak: bestOf(bests.peak),
      bones: bestOf(bests.bones),
      score: bestOf(bests.score),
    },
    causes: counts(r.causes),
    killed: counts(r.killed),
    modes: rowsOf(r.modes),
    skis: rowsOf(r.skis),
    tricks: counts(r.tricks) as Record<string, number>,
    seeds: seedsOf(r.seeds),
    recent: (Array.isArray(r.recent) ? r.recent : [])
      .map(tallyOf)
      .filter((t): t is RunTally => t !== null)
      .slice(0, RECENT_RUNS),
  };
}

/* ── STORAGE ──────────────────────────────────────────────────────────── */

export const STATS_KEY = "fall-line.stats.v1";

export function loadStats(): StatsBook {
  try {
    const stored = localStorage.getItem(STATS_KEY);
    return stored ? readStats(JSON.parse(stored)) : emptyStats();
  } catch {
    return emptyStats();
  }
}

export function saveStats(book: StatsBook): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(book));
  } catch {
    // Storage full or refused: the numbers live on for this session.
  }
}

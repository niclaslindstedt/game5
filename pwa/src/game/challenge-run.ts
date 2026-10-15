// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CHALLENGES' RIG — the app's half of the free ride challenges
// (`engine/game/challenges/`, `docs/challenges.md`): the judge armed over
// the run the PLAYER rides on a free ride, what it says turned into news
// lines and filed in the book (`challenge-book.ts`), and the session the
// HUD, the minimap and the pause card read the challenges through.
//
// `App.tsx` arms it on every run stood up — a free ride the player rides
// is judged, anything else is not — and steps it beside the statistics'
// rig on every step the player rides (never the bot's, a pre-roll's or a
// replay's). A result is filed the moment it is said, so the book on disk
// is never a run behind: a medal is won, not saved.
//
// THE SESSION IS KEYED BY THE RUN'S STATE (`challengeSessionOf`), as the
// HUD's other readers key what they read by the state they are handed: a
// replay shows another state and so no chip, and a run stood up again has
// a session of its own. DOM-free, so the suite reads it.

import {
  challengeKey,
  createChallengeRun,
  isLine,
  isSpots,
  isSummits,
  isTrick,
  type ChallengeBase,
  type ChallengeEvent,
  type ChallengePlan,
  type ChallengeRun,
  type GameMode,
  type GameState,
  type Level,
  type Medal,
} from "@engine";

import {
  fileResult,
  loadChallenges,
  memoryOf,
  saveChallenges,
  type ChallengeBook,
  type ChallengeHeld,
  type Filed,
} from "./challenge-book.ts";
import { runById, runNumber } from "./run-names.ts";
import type { NewsLine } from "./run-news.ts";
import { STRINGS } from "./strings.ts";

/** THE PLATE at a line's or a trick's finish: what was done and what it
 * earned, from engine time `t`. */
export type ChallengePlate = {
  id: string;
  kind: "line" | "trick";
  t: number;
  medal: Medal | null;
  /** The time, s, or the tier met. */
  value: number;
  /** What it did to the book. */
  filed: Filed;
  /** A line too slow for bronze: by how much, s. */
  gap: number | null;
  /** The challenge as its name reads. */
  name: string;
  /** A trick: the goal met, in words. */
  what: string | null;
};

/** A RUN BEING JUDGED: the judge, the map's key, the book as it stands and
 * the last plate. */
export type ChallengeSession = {
  run: ChallengeRun;
  level: Level;
  book: ChallengeBook;
  plate: ChallengePlate | null;
};

const sessions = new WeakMap<GameState, ChallengeSession>();

/** The challenges `state` is being judged for, or null. */
export function challengeSessionOf(state: GameState): ChallengeSession | null {
  return sessions.get(state) ?? null;
}

/** Where the rig keeps its book, and the wall clock it dates an entry by. */
export type ChallengeStore = {
  load(): ChallengeBook;
  save(book: ChallengeBook): void;
  now(): number;
};

/* ── NAMES ─────────────────────────────────────────────────────────────── */

/** A run as a challenge names it: `RUN 4`, or a ski route's. */
export function runLabel(level: Level, id: string | null): string | null {
  if (id === null) return null;
  const run = runById(level, id);
  return run ? STRINGS.challengeRun(runNumber(level, run)) : STRINGS.challengeRoute;
}

/** What a challenge is called, with the count found so far for a count
 * kind (`n`). */
export function challengeName(level: Level, c: ChallengeBase, n = 0): string {
  if (isLine(c)) return STRINGS.challengeLineName(runLabel(level, c.run)!);
  if (isTrick(c)) return STRINGS.challengeKickerName(runLabel(level, c.run));
  if (isSpots(c)) return STRINGS.challengeSpotsName(n, c.spots.length);
  if (isSummits(c)) return STRINGS.challengeSummitsName(n, c.tops.length);
  return c.id.toUpperCase();
}

/* ── WHAT A STEP SAID ──────────────────────────────────────────────────── */

/** READ ONE STEP'S EVENTS against the plan: the book after filing them,
 * the news lines they earn, and the plate (the last one, or a new one).
 * Pure — the rig's whole decision, so the suite can hand it events. */
export function readEvents(
  level: Level,
  plan: ChallengePlan,
  book: ChallengeBook,
  events: readonly ChallengeEvent[],
  now: number,
): { book: ChallengeBook; lines: NewsLine[]; plate: ChallengePlate | null } {
  const lines: NewsLine[] = [];
  let plate: ChallengePlate | null = null;
  const byId = new Map(plan.challenges.map((c) => [c.id, c]));
  const file = (c: ChallengeBase, held: ChallengeHeld, name: string): Filed => {
    const r = fileResult(book, plan.key, c, held, now);
    book = r.book;
    const entry = book.maps[plan.key]?.[c.id];
    if ((r.filed === "medal" || r.filed === "new") && entry?.medal)
      lines.push({ text: STRINGS.challengeMedalUp(entry.medal, name), tone: "good" });
    else if (r.filed === "value" && c.better === "lower")
      lines.push({ text: STRINGS.challengeNewBest(name), tone: "good" });
    return r.filed;
  };
  for (const e of events) {
    const c = byId.get(e.id);
    if (!c) continue;
    if (isLine(c)) {
      const run = runLabel(level, c.run)!;
      const name = challengeName(level, c);
      if (e.kind === "start") {
        const m = c.medals;
        lines.push({
          text: STRINGS.challengeLineGo(run, m.gold, m.silver, m.bronze),
          tone: "info",
        });
      } else if (e.kind === "split" && e.value !== undefined) {
        lines.push({ text: STRINGS.challengeLineSplit(e.value), tone: "info" });
      } else if (e.kind === "void" && e.why) {
        lines.push({ text: STRINGS.challengeLineVoid(e.why), tone: "bad" });
      } else if (e.kind === "done" && e.value !== undefined) {
        const medal = e.medal ?? null;
        const gap = medal ? null : e.value - c.medals.bronze;
        lines.push(
          medal
            ? { text: STRINGS.challengeLineDone(run, e.value, medal), tone: "good" }
            : { text: STRINGS.challengeLineNone(e.value, gap!), tone: "info" },
        );
        const filed = file(c, { id: c.id, value: e.value }, name);
        plate = {
          id: c.id,
          kind: "line",
          t: e.t,
          medal,
          value: e.value,
          filed,
          gap,
          name,
          what: null,
        };
      }
    } else if (isTrick(c) && e.kind === "done" && e.value !== undefined && e.medal) {
      const name = challengeName(level, c);
      const what = STRINGS.challengeGoal(c.goals[e.medal]);
      lines.push({ text: STRINGS.challengeTrickDone(e.medal, what), tone: "good" });
      const filed = file(c, { id: c.id, value: e.value }, name);
      plate = {
        id: c.id,
        kind: "trick",
        t: e.t,
        medal: e.medal,
        value: e.value,
        filed,
        gap: null,
        name,
        what,
      };
    } else if (e.kind === "found" && e.what !== undefined) {
      const n = e.value ?? 0;
      if (isSpots(c)) {
        const spot = c.spots.find((s) => s.id === e.what);
        lines.push({
          text: STRINGS.challengeSpot(n, c.spots.length, spot?.what ?? null),
          tone: "good",
        });
      } else if (isSummits(c)) {
        lines.push({ text: STRINGS.challengeSummit(n, c.tops.length), tone: "good" });
      }
      file(c, { id: c.id, found: [e.what] }, challengeName(level, c, n));
    }
  }
  return { book, lines, plate };
}

/* ── THE RIG ───────────────────────────────────────────────────────────── */

export type ChallengeRig = {
  /** A new run stood up: judged when it is a WINTER free ride the player
   * rides — summer's bike is another sport, and its ride deals none. */
  arm(state: GameState, mode: GameMode, rides: boolean): void;
  /** After a step the player rode: the news lines it earned. */
  step(state: GameState): NewsLine[];
};

/** The book on this device, dated by the wall clock. */
const ON_DEVICE: ChallengeStore = {
  load: loadChallenges,
  save: saveChallenges,
  now: () => Date.now(),
};

export function createChallengeRig(store: ChallengeStore = ON_DEVICE): ChallengeRig {
  return {
    arm(state, mode, rides) {
      if (!rides || mode !== "free" || state.summer || !state.level.resort) return;
      const book = store.load();
      const run = createChallengeRun(state.level, memoryOf(book, challengeKey(state.level)));
      sessions.set(state, { run, level: state.level, book, plate: null });
    },
    step(state) {
      const s = sessions.get(state);
      if (!s) return [];
      const events = s.run.step(state);
      if (events.length === 0) return [];
      const r = readEvents(s.level, s.run.plan, s.book, events, store.now());
      if (r.book !== s.book) {
        s.book = r.book;
        store.save(r.book);
      }
      if (r.plate) s.plate = r.plate;
      return r.lines;
    },
  };
}

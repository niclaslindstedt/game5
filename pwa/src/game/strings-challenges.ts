// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE FREE RIDE CHALLENGES — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names, so nothing reads it by any other path. What a challenge
// is and what it earned are the engine's (`engine/game/challenges/`) and the
// book's (`challenge-book.ts`); the news lines, the HUD's chip and plate,
// the pause card's list and the statistics' tally read every word here.

import { formatTime } from "@niclaslindstedt/oss-game-framework/hud/format";

import type { Medal, SpotKind, VoidCause } from "@engine";

const MEDAL_NAMES: Record<Medal, string> = { gold: "GOLD", silver: "SILVER", bronze: "BRONZE" };

/** What each hidden spot is, as the news names it once found. */
const SPOT_NAMES: Record<SpotKind, string> = {
  ridge: "THE RIDGE",
  glade: "A GLADE",
  cliff: "A CLIFF TOP",
  corner: "THE FAR CORNER",
  shore: "THE SHORE",
  treeline: "THE TREE LINE",
};

/** Why a line's attempt was thrown away. */
const VOID_WHY: Record<VoidCause, string> = {
  fall: "FELL",
  reset: "RESET",
  lift: "ON A LIFT",
  machine: "OFF YOUR SKIS",
  off: "OFF THE LINE",
  slow: "TOO SLOW",
  moved: "MOVED",
};

/** A trick goal in words: a spin, the flips, a grab — `360 + GRAB`,
 * `BACKFLIP`, or a plain AIR. */
function goalWord(goal: { spin: number; flips: number; grab: boolean }): string {
  const parts: string[] = [];
  if (goal.flips === 1) parts.push("FLIP");
  else if (goal.flips > 1) parts.push(`${goal.flips} FLIPS`);
  if (goal.spin > 0) parts.push(String(goal.spin));
  if (goal.grab) parts.push("GRAB");
  return parts.length === 0 ? "CLEAN AIR" : parts.join(" + ");
}

export const CHALLENGE_STRINGS = {
  medalNames: MEDAL_NAMES,
  /** A time on a challenge, as every clock in the game reads one. */
  challengeTime: (s: number): string => formatTime(s),
  challengeGoal: goalWord,

  /* ── THE NEWS ─────────────────────────────────────────────────────── */
  /** A timed line's clock started: the run and the times to beat. */
  challengeLineGo: (run: string, gold: number, silver: number, bronze: number): string =>
    `LINE ${run} · G ${formatTime(gold)} S ${formatTime(silver)} B ${formatTime(bronze)}`,
  challengeLineSplit: (t: number): string => `HALF WAY · ${formatTime(t)}`,
  challengeLineDone: (run: string, t: number, medal: Medal): string =>
    `LINE ${run} · ${formatTime(t)} · ${MEDAL_NAMES[medal]}`,
  /** Finished too slowly for a medal, and by how much. */
  challengeLineNone: (t: number, gap: number): string =>
    `LINE · ${formatTime(t)} · NO MEDAL, +${gap.toFixed(1)} S TO BRONZE`,
  challengeLineVoid: (why: VoidCause): string => `LINE OFF · ${VOID_WHY[why]}`,
  challengeTrickDone: (medal: Medal, what: string): string =>
    `KICKER · ${what} · ${MEDAL_NAMES[medal]}`,
  challengeSpot: (n: number, of: number, what: SpotKind | null): string =>
    `HIDDEN SPOT ${n}/${of}${what ? ` · ${SPOT_NAMES[what]}` : ""}`,
  challengeSummit: (n: number, of: number): string => `SUMMIT ${n}/${of}`,
  /** A medal won or bettered for the book. */
  challengeMedalUp: (medal: Medal, what: string): string => `${MEDAL_NAMES[medal]} MEDAL · ${what}`,
  challengeNewBest: (what: string): string => `NEW BEST · ${what}`,

  /* ── WHAT EACH CHALLENGE IS CALLED ───────────────────────────────────── */
  challengeLineName: (run: string): string => `LINE · ${run}`,
  challengeKickerName: (run: string | null): string => `KICKER · ${run ?? "OFF-PISTE"}`,
  challengeSpotsName: (n: number, of: number): string => `HIDDEN SPOTS ${n}/${of}`,
  challengeSummitsName: (n: number, of: number): string => `EVERY SUMMIT ${n}/${of}`,
  /** A run as a challenge names it: its number, or a ski route's. */
  challengeRun: (number: string): string => `RUN ${number}`,
  challengeRoute: "SKI ROUTE",

  /* ── THE HUD ──────────────────────────────────────────────────────── */
  /** The chip's caption: the medal the clock is still inside, or none. */
  challengeChipFor: (medal: Medal | null): string =>
    medal ? `FOR ${MEDAL_NAMES[medal]}` : "NO MEDAL",
  challengeChipLabel: "LINE",
  challengePlateNone: "NO MEDAL",
  challengePlateNew: "NEW BEST",
  challengePlateGap: (gap: number): string => `+${gap.toFixed(1)} S TO BRONZE`,

  /* ── THE PAUSE CARD ───────────────────────────────────────────────── */
  pauseChallenges: "CHALLENGES",
  pauseChallengesCaption:
    "Every mountain deals its own challenges. Ride a line between its flags, land a trick off a kicker, find the hidden spots, stand on every summit.",
  pauseChallengesNone: "THIS MOUNTAIN DEALS NO CHALLENGES",
  challengeHeld: "BEST",
  challengeNotYet: "NOT YET",
  challengeRide: "RIDE",
  /** A count kind's targets: how many each medal asks. */
  challengeCountBar: (n: number): string => String(n),

  /* ── THE STATISTICS ───────────────────────────────────────────────── */
  statsMedals: "CHALLENGE MEDALS",
  statsMedalsNone: "No medals yet — a free ride deals every mountain's challenges.",
};

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE SLALOM — a block of the one strings table (`strings.ts`,
// §39.1), stated next door and spread into `STRINGS` under the same names,
// so nothing reads it by any other path. Split out because it is a subject
// of its own (the starter's word, the run, the intermediates, the board, the
// plate's verdicts, the second run), and a table that grew every such block
// in place would be the one file every change to the game had to touch.

import type { RunOut } from "@engine";

import { formatTime, ordinal } from "@niclaslindstedt/oss-game-framework/hud/format";

/** How a racer went out, in the plate's plain words. A gate is numbered as
 * the HUD's gate count numbers it — the start gate the first. */
function outWhy(why: RunOut["why"], gate: number): string {
  switch (why) {
    case "missed":
      return `MISSED GATE ${gate}`;
    case "straddle":
      return `STRADDLED GATE ${gate}`;
    case "start":
      return "LATE OUT OF THE START";
    case "net":
      return `INTO THE NETS BELOW GATE ${gate}`;
    default:
      return `FELL AT GATE ${gate}`;
  }
}

/** A gap as a board prints it: `+0.42`, `−0.30`. */
const signed = (seconds: number): string =>
  `${seconds < 0 ? "−" : "+"}${Math.abs(seconds).toFixed(2)}`;

export const SLALOM_STRINGS = {
  /* ── THE HUD (hud.tsx) ─────────────────────────────────────────────── */
  /** The starter's two words, small at the top — the start clock in the
   * house carries the count. */
  starterReady: "READY",
  starterGo: "GO",
  /** Which run of the two. */
  runOf: (run: number, runs: number): string => `${run} / ${runs}`,
  runLabel: "RUN",
  /** An intermediate time and its caption. */
  timingLabel: (point: number): string => `SPLIT ${point}`,
  leaderGapLabel: "VS LEADER",

  /* ── THE PLATE (hud-result.tsx) ────────────────────────────────────── */
  resultSlalomTitle: (run: number): string => (run === 1 ? "SLALOM · RUN 1" : "SLALOM · FINAL"),
  /** The verdict on a run that went out, and why. */
  outTitle: (status: RunOut["status"]): string =>
    status === "dsq" ? "DISQUALIFIED" : "DID NOT FINISH",
  outWhy: (out: RunOut): string => outWhy(out.why, out.gate),
  /** The out plate's one press: the run again. */
  outAgain: "TRY AGAIN",
  /** The second run's figures on its plate. */
  resultRuns: (first: number, second: number): string =>
    `RUN 1 ${formatTime(first)} · RUN 2 ${formatTime(second)}`,
  resultTotal: (seconds: number): string => `TOTAL ${formatTime(seconds)}`,
  /** Where the player stands against the leader. */
  resultLead: (gap: number): string => (gap <= 0 ? "IN THE LEAD" : `${signed(gap)} TO THE LEADER`),
  /** THE SECOND RUN: the press, and why there is none. */
  secondRun: "SECOND RUN",
  secondOut: "OUT OF RUN 1 · NO SECOND RUN",
  secondShort: (place: number, cut: number): string =>
    `${ordinal(place)} · ONLY THE TOP ${cut} START RUN 2`,
  secondNote: (cut: number): string => `THE TOP ${cut} START RUN 2 IN REVERSE ORDER`,
  runAgain: (run: number): string => `SKI RUN ${run} AGAIN`,
  slalomNote: "B skis the run again · ESC holds the run",

  /* ── THE BOARD (hud-board.tsx) ─────────────────────────────────────── */
  boardBib: (bib: number): string => `${bib}`,
  boardHead: {
    place: "",
    bib: "BIB",
    name: "",
    first: "RUN 1",
    time: "TIME",
    second: "RUN 2",
    total: "TOTAL",
    gap: "GAP",
  },
  boardGap: (gap: number): string => (gap === 0 ? "" : signed(gap)),
  /** A racer out of it: DSQ or DNF, and where. */
  boardOut: (out: RunOut): string =>
    out.why === "start"
      ? "DSQ · START"
      : `${out.status === "dsq" ? "DSQ" : "DNF"} · ${out.why === "missed" ? "MISSED" : out.why === "straddle" ? "STRADDLE" : out.why === "net" ? "NETS" : "FALL"} ${out.gate}`,
  boardWaiting: "TO START",
  boardOnCourse: "ON COURSE",

  /* ── THE NEWS COLUMN (run-news.ts) ─────────────────────────────────── */
  newsTiming: (point: number, seconds: number, gap: number | null): string =>
    `SPLIT ${point}  ${formatTime(seconds)}${gap === null ? "" : `  ${signed(gap)}`}`,
  newsPole: (gate: number): string => `POLE DOWN · GATE ${gate}`,
  newsOut: (out: RunOut): string =>
    `${out.status === "dsq" ? "DISQUALIFIED" : "DID NOT FINISH"} · ${outWhy(out.why, out.gate)}`,
} as const;

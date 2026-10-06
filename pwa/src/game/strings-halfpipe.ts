// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE HALFPIPE (R41) — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names: the freestyle card's row, the trick map card's billing,
// the run on the HUD and the plate. A hit's trick is called by big air's
// `trickName`, with the pipe's own word in front of an uphill spin.

import { ordinal } from "@niclaslindstedt/oss-game-framework/hud/format";
import type { PipePhase } from "@engine";

export const HALFPIPE_STRINGS = {
  /* ── THE FREESTYLE CARD (menu-freestyle.tsx) ────────────────────────── */
  freestyleHalfpipe: (skiers: number, finalists: number): string =>
    `WALL TO WALL · ${skiers} · FINAL OF ${finalists}`,

  /* ── THE TRICK MAP CARD (menu-tricks.tsx) ───────────────────────────── */
  halfpipeOn: "HALFPIPE ON",
  halfpipeBilling: (qualification: number, final: number): string =>
    `${qualification} + ${final} RUNS`,

  /* ── THE HUD (hud.tsx) ──────────────────────────────────────────────── */
  halfpipePhase: (phase: PipePhase): string => (phase === "final" ? "FINAL" : "QUALIFICATION"),
  halfpipeRun: (run: number, of: number): string => `RUN ${run}/${of}`,
  /** "HIT 3 · 4.2 M" — the hits so far and the last one's height. */
  halfpipeHits: (hits: number, over: number | null): string =>
    hits === 0 || over === null ? "DROP IN" : `HIT ${hits} · ${over.toFixed(1)} M`,

  /* ── THE PLATE (hud-halfpipe.tsx) ───────────────────────────────────── */
  halfpipeTitle: (phase: PipePhase, run: number, of: number): string =>
    `HALFPIPE · ${phase === "final" ? "FINAL" : "QUALIFICATION"} · RUN ${run}/${of}`,
  halfpipeScore: (score: number): string => score.toFixed(2),
  halfpipeFellScore: (score: number): string => `FALL · ${score.toFixed(2)}`,
  /** A hit on the sheet: "ALLEY-OOP RIGHT 360 · 4.1 M". */
  halfpipeHit: (trick: string, alleyOop: boolean, over: number): string =>
    `${alleyOop ? "ALLEY-OOP " : ""}${trick} · ${over.toFixed(1)} M`,
  halfpipeNoHits: "NO HITS",
  halfpipeTotal: "BEST RUN COUNTS",
  halfpipeYou: "YOU",
  halfpipeBib: (id: number): string => `BIB ${id + 1}`,
  /** A board row: one run alone is its score; more are each run's and the
   * best of them — "71.40 · FALL · BEST 71.40". */
  halfpipeRow: (scores: readonly number[], fell: readonly boolean[], total: number): string => {
    const each = scores.map((s, k) => (fell[k] ? "FALL" : s.toFixed(2)));
    if (each.length <= 1) return each[0] ?? total.toFixed(2);
    return `${each.join(" · ")} · BEST ${total.toFixed(2)}`;
  },
  halfpipeNextRun: (run: number): string => `RUN ${run}`,
  halfpipeToFinal: "ON TO THE FINAL",
  halfpipeNextFinal: (place: number): string => `QUALIFIED ${place}`,
  halfpipeShort: (place: number, finalists: number): string =>
    `${ordinal(place)} · THE BEST ${finalists} GO TO THE FINAL`,
  halfpipeDone: (place: number): string =>
    place === 1 ? "YOU WIN" : place <= 3 ? `PODIUM · ${place}` : `FINISHED ${place}`,
  halfpipeAgain: "RUN AGAIN",
} as const;

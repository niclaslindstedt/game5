// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF SLOPESTYLE (R39) — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names: the freestyle card's row, the trick map card's billing,
// the run on the HUD and the plate.

import { ordinal } from "@niclaslindstedt/oss-game-framework/hud/format";
import type { SlopePhase } from "@engine";

export const SLOPESTYLE_STRINGS = {
  /* ── THE FREESTYLE CARD (menu-freestyle.tsx) ────────────────────────── */
  freestyleSlopestyle: (skiers: number, finalists: number): string =>
    `RAILS + JUMPS · ${skiers} · FINAL OF ${finalists}`,

  /* ── THE TRICK MAP CARD (menu-tricks.tsx) ───────────────────────────── */
  slopestyleOn: "SLOPESTYLE ON",
  slopestyleBilling: (qualification: number, final: number): string =>
    `${qualification} + ${final} RUNS`,

  /* ── THE HUD (hud.tsx) ──────────────────────────────────────────────── */
  slopestylePhase: (phase: SlopePhase): string => (phase === "final" ? "FINAL" : "QUALIFICATION"),
  slopestyleRun: (run: number, of: number): string => `RUN ${run}/${of}`,
  slopestyleSection: (section: number, of: number, kind: "rail" | "jump" | null): string =>
    section === 0 ? "DROP IN" : `${kind === "rail" ? "RAILS" : "JUMP"} ${section}/${of}`,

  /* ── THE PLATE (hud-slopestyle.tsx) ─────────────────────────────────── */
  slopestyleTitle: (phase: SlopePhase, run: number, of: number): string =>
    `SLOPESTYLE · ${phase === "final" ? "FINAL" : "QUALIFICATION"} · RUN ${run}/${of}`,
  slopestyleScore: (score: number): string => score.toFixed(2),
  slopestyleFellScore: (score: number): string => `FALL · ${score.toFixed(2)}`,
  /** The judges' sheet: each section's trick mark, then the two panels. */
  slopestyleSections: (sections: readonly number[]): string =>
    sections.map((s) => Math.round(s)).join(" · "),
  slopestylePanels: (trick: number, composition: number): string =>
    `TRICKS ${trick.toFixed(2)} · COMPOSITION ${composition.toFixed(2)}`,
  slopestyleTotal: "BEST RUN COUNTS",
  slopestyleYou: "YOU",
  slopestyleBib: (id: number): string => `BIB ${id + 1}`,
  /** A board row: one run alone is its score; more are each run's and the
   * best of them — "71.40 · FALL · BEST 71.40". */
  slopestyleRow: (scores: readonly number[], fell: readonly boolean[], total: number): string => {
    const each = scores.map((s, k) => (fell[k] ? "FALL" : s.toFixed(2)));
    if (each.length <= 1) return each[0] ?? total.toFixed(2);
    return `${each.join(" · ")} · BEST ${total.toFixed(2)}`;
  },
  slopestyleNextRun: (run: number): string => `RUN ${run}`,
  slopestyleToFinal: "ON TO THE FINAL",
  slopestyleNextFinal: (place: number): string => `QUALIFIED ${place}`,
  slopestyleShort: (place: number, finalists: number): string =>
    `${ordinal(place)} · THE BEST ${finalists} GO TO THE FINAL`,
  slopestyleDone: (place: number): string =>
    place === 1 ? "YOU WIN" : place <= 3 ? `PODIUM · ${place}` : `FINISHED ${place}`,
  slopestyleAgain: "RUN AGAIN",
} as const;

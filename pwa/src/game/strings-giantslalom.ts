// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE GIANT SLALOM (R36) — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names, as the slalom's and the super-G's are: its level card and
// its plate. Its run chip and its second run are the slalom's words.

export const GIANT_SLALOM_STRINGS = {
  /* ── THE LEVEL CARD (menu-levels.tsx) ───────────────────────────────── */
  levelsGiantSlalom: "GIANT SLALOM ON",

  /* ── THE PLATE (hud-result.tsx) ─────────────────────────────────────── */
  resultGiantSlalomTitle: (run: number): string =>
    run === 1 ? "GIANT SLALOM · RUN 1" : "GIANT SLALOM · FINAL",
} as const;

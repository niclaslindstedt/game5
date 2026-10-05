// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE DOWNHILL (R32) — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names, as the slalom's are (`strings-slalom.ts`): the front
// door's tile, the run on the HUD (the training and the race), the speed
// trap, the plate's titles and its RACE press, the nets.

import { ordinal } from "@niclaslindstedt/oss-game-framework/hud/format";

export const DOWNHILL_STRINGS = {
  /* ── THE FRONT DOOR (menu-main.tsx) ────────────────────────────────── */
  menuDownhill: "DOWNHILL",
  /** Its format on the tile, as the slalom's is billed: one race run (the
   * training before it said on the HUD and the plate). */
  menuDownhillFormat: (skiers: number): string => `ONE RUN · ${skiers}`,

  /* ── THE HUD (hud.tsx) ─────────────────────────────────────────────── */
  /** Which of a downhill's two runs this is. */
  downhillRun: (training: boolean): string => (training ? "TRAINING" : "RACE"),
  /** THE SPEED TRAP's chip: the speed and where it stands in the field. */
  trapSpeed: (kmh: number): string => `${Math.round(kmh)} KM/H`,
  trapLabel: (rank: number | null): string =>
    rank === null ? "SPEED TRAP" : `SPEED TRAP · ${ordinal(rank)}`,

  /* ── THE PLATE (hud-result.tsx) ────────────────────────────────────── */
  resultDownhillTitle: (training: boolean): string =>
    training ? "DOWNHILL · TRAINING" : "DOWNHILL",
  /** The trap on the plate: his speed, the field's fastest. */
  resultTrap: (kmh: number, best: number | null): string =>
    best === null
      ? `SPEED TRAP ${Math.round(kmh)} KM/H`
      : `SPEED TRAP ${Math.round(kmh)} KM/H · FIELD BEST ${Math.round(best)}`,
  /** THE RACE after the training: the press, and what the training was. */
  raceRun: "RACE",
  raceNote: "TRAINING TIMES COUNT FOR NOTHING · THE RACE IS ONE RUN",
  downhillAgain: (training: boolean): string => (training ? "TRAIN AGAIN" : "RACE AGAIN"),

  /* ── THE NEWS COLUMN (run-news.ts) ─────────────────────────────────── */
  newsTrap: (kmh: number): string => `SPEED TRAP · ${Math.round(kmh)} KM/H`,
  newsNet: "INTO THE NETS",
} as const;

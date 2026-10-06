// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE SKI CROSS (R35) — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names, as the other disciplines' are: its row on the race card,
// its level card, the start gate's commands and the round on the HUD, its
// plate with the heat's order and who goes through, and its news.

import { formatTime, ordinal } from "@niclaslindstedt/oss-game-framework/hud/format";

import type { CrossRound } from "@engine";

/** A round's name. */
const ROUND: Record<CrossRound | "qualify", string> = {
  qualify: "QUALIFICATION",
  quarter: "QUARTER-FINAL",
  semi: "SEMI-FINAL",
  small: "SMALL FINAL",
  final: "BIG FINAL",
};

export const SKI_CROSS_STRINGS = {
  /* ── THE RACE CARD (menu-races.tsx) AND THE LEVEL CARD ─────────────── */
  racesSkiCross: (abreast: number): string => `QUALIFYING + HEATS OF ${abreast}`,
  levelsSkiCross: "SKI CROSS ON",

  /* ── THE HUD (hud.tsx) ─────────────────────────────────────────────── */
  /** The round chip: the qualification, or a heat's round and number. */
  crossRound: (round: CrossRound | "qualify"): string => ROUND[round],
  crossHeat: (heat: number, round: CrossRound | "qualify"): string =>
    round === "qualify" || round === "small" || round === "final" ? "" : `HEAT ${heat}`,
  crossRoundLabel: "ROUND",
  /** THE START GATE'S COMMANDS: "skiers ready", "attention" — then the
   * doors drop without a word. */
  crossReady: "SKIERS READY",
  crossAttention: "ATTENTION",
  crossGo: "GO",

  /* ── THE PLATE (hud-cross.tsx) ─────────────────────────────────────── */
  crossTitle: (round: CrossRound | "qualify", heat: number): string =>
    `SKI CROSS · ${ROUND[round]}${round === "quarter" || round === "semi" ? ` ${heat}` : ""}`,
  /** The heat's result line: his place in it of the four. */
  crossPlace: (place: number, of: number): string => `${ordinal(place)} OF ${of}`,
  /** His qualification: the place on the board and the time. */
  crossQualified: (place: number, time: number): string =>
    `${ordinal(place)} · ${formatTime(time)}`,
  /** A racer in the heat's table: the player, or his bib — his rank out of
   * the qualification. */
  crossYou: "YOU",
  crossBib: (rank: number): string => `BIB ${rank}`,
  crossOut: "DNF",
  crossOn: "ON COURSE",
  crossThrough: "THROUGH",
  /** Another heat of the round on the plate: its name. */
  crossHeatOf: (round: CrossRound | "qualify", heat: number): string =>
    round === "quarter" || round === "semi" ? `${ROUND[round]} ${heat}` : ROUND[round],
  /** What comes next. */
  crossNext: (round: CrossRound): string => `THROUGH TO THE ${ROUND[round]}`,
  crossNextQualified: (round: CrossRound): string => `QUALIFIED · ON TO THE ${ROUND[round]}`,
  crossOutAt: (place: number): string => `OUT · ${ordinal(place)} OVERALL`,
  crossShort: (cut: number): string => `ONLY THE TOP ${cut} RACE THE HEATS`,
  crossDone: (place: number): string => (place === 1 ? "WINNER" : `${ordinal(place)} OVERALL`),
  crossNote: (through: number): string => `THE FIRST ${through} OVER THE LINE GO THROUGH`,
  /** The podium under a finished race. */
  crossPodiumHead: "THE FINAL",
  /** The press on to the next heat. */
  crossGoOn: (round: CrossRound): string => ROUND[round],
  crossAgain: (round: CrossRound | "qualify"): string =>
    round === "qualify" ? "QUALIFY AGAIN" : "RACE THE HEAT AGAIN",

  /* ── THE NEWS COLUMN (run-news.ts) ─────────────────────────────────── */
  newsCard: "RED CARD · DISQUALIFIED",
  newsKnocked: "DOWN IN THE PACK",
} as const;

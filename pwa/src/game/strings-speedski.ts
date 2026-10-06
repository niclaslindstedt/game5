// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF SPEED SKIING (R34) — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names, as the other disciplines' are: its row on the race card,
// its level card, its runs on the HUD, its plate and its board, where
// every time a speed race keeps is read as the SPEED it is.

import { ordinal } from "@niclaslindstedt/oss-game-framework/hud/format";

/** A speed, km/h, to the hundredth the timing reads it to. */
const kmh = (v: number): string => v.toFixed(2);

/** A speed's difference, km/h: `+1.24`, `−0.30`. */
const signedKmh = (dv: number): string => `${dv < 0 ? "−" : "+"}${Math.abs(dv).toFixed(2)}`;

export const SPEED_SKI_STRINGS = {
  /* ── THE RACE CARD (menu-races.tsx) AND THE LEVEL CARD ─────────────── */
  racesSpeedSki: (skiers: number): string => `QUALIFICATION + FINAL · ${skiers}`,
  levelsSpeedSki: "SPEED SKIING ON",

  /* ── THE HUD (hud.tsx) ─────────────────────────────────────────────── */
  /** The run chip: which of the two. */
  speedSkiRun: (run: number): string => (run === 1 ? "QUALIFYING" : "FINAL"),
  /** The big readout in the clock's place: the speed, and its caption —
   * the speed he is carrying, then the one the zone timed. */
  speedSkiNow: (v: number): string => v.toFixed(1),
  speedSkiLabel: "KM/H",
  speedSkiTimed: (v: number): string => kmh(v),
  speedSkiTimedLabel: "KM/H · TIMED",

  /* ── THE PLATE (hud-result.tsx) ────────────────────────────────────── */
  resultSpeedSkiTitle: (run: number): string =>
    run === 1 ? "SPEED SKIING · QUALIFYING" : "SPEED SKIING · FINAL",
  /** His speed through the zone, and the time it was read off. */
  resultSpeed: (v: number): string => `${kmh(v)} KM/H`,
  resultZone: (seconds: number, metres: number): string =>
    `${seconds.toFixed(3)} S OVER ${Math.round(metres)} M`,
  /** On the final: his qualifying speed beside it. */
  resultQualifying: (v: number): string => `QUALIFYING ${kmh(v)} KM/H`,
  /** Where he stands against the leader's speed. */
  resultLeadSpeed: (dv: number): string =>
    dv >= 0 ? "IN THE LEAD" : `${signedKmh(dv)} KM/H TO THE LEADER`,
  /** The record book's line: the best speed that stood, and his off it. */
  resultBestSpeed: (v: number, skis: string, at: number): string =>
    `BEST ${kmh(v)} KM/H · ${skis.toUpperCase()}${
      at > 0 ? ` · ${new Date(at).toISOString().slice(0, 10)}` : ""
    }`,
  resultOffSpeed: (dv: number): string => `${signedKmh(dv)} KM/H OFF THE RECORD`,
  /** THE FINAL: the press, and why there is none. */
  finalRun: "FINAL",
  finalOut: "OUT OF QUALIFYING · NO FINAL",
  finalShort: (place: number, cut: number): string =>
    `${ordinal(place)} · ONLY THE TOP ${cut} RACE THE FINAL`,
  finalNote: (cut: number): string =>
    `THE TOP ${cut} RACE THE FINAL FROM THE TOP START · THE FASTEST LAST`,
  speedSkiAgain: (run: number): string => (run === 1 ? "QUALIFY AGAIN" : "RACE THE FINAL AGAIN"),

  /* ── THE BOARD (hud-board.tsx) ─────────────────────────────────────── */
  boardSpeed: (v: number): string => kmh(v),
  boardSpeedGap: (dv: number): string => (dv === 0 ? "" : signedKmh(dv)),
  boardSpeedHead: "KM/H",

  /* ── THE NEWS COLUMN (run-news.ts) ─────────────────────────────────── */
  newsSpeed: (v: number): string => `TIMED  ${kmh(v)} KM/H`,
} as const;

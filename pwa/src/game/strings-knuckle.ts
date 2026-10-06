// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE KNUCKLE HUCK (R38) — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names: the tricks card's row, the trick map card's billing, the
// jam on the HUD and the plate at the buzzer. A trick is named by big air's
// `trickName`, which reads the press too.

import { ordinal } from "@niclaslindstedt/oss-game-framework/hud/format";

/** m:ss of the jam's clock. */
function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const KNUCKLE_STRINGS = {
  /** The tricks card's row: its format under its name. */
  freestyleKnuckle: (riders: number, seconds: number): string =>
    `A JAM · ${riders} RIDERS · ${Math.round(seconds / 60)} MIN`,
  /** The trick map card's head and billing. */
  knuckleOn: "KNUCKLE HUCK ON",
  knuckleBilling: (seconds: number): string => `A ${Math.round(seconds / 60)} MIN JAM`,

  /* ── THE HUD (hud.tsx) ──────────────────────────────────────────────── */
  knuckleClock: (left: number): string => clock(left),
  knuckleHits: (hits: number): string => (hits === 1 ? "1 HIT" : `${hits} HITS`),
  knucklePlace: (place: number, riders: number): string => `${place}/${riders}`,
  knuckleSession: "SESSION",
  /** The last hit's impression, under its trick's name: "48.9". */
  knuckleImpression: (impression: number): string => impression.toFixed(1),
  knuckleFall: "FALL",

  /* ── THE PLATE (hud-knuckle.tsx) ────────────────────────────────────── */
  knuckleTitle: "KNUCKLE HUCK · THE BUZZER",
  knuckleScore: (score: number): string => score.toFixed(2),
  knuckleResult: (place: number): string =>
    place === 1 ? "YOU WIN THE JAM" : place <= 3 ? `PODIUM · ${place}` : `${ordinal(place)}`,
  knuckleRow: (hits: number, falls: number, score: number): string =>
    `${hits} HITS${falls > 0 ? ` · ${falls} DOWN` : ""} · ${score.toFixed(2)}`,
  knuckleNote: "RANKED ON THE WHOLE SESSION: THE BEST THREE HITS, VARIETY, FEW FALLS",
  knuckleAgain: "JAM AGAIN",
} as const;

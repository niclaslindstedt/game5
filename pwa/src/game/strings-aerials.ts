// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF AERIALS (R44) — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names: the freestyle card's row, the trick map card's billing
// and its jump picker, the jump on the HUD and the plate. A jump is called
// by its code as the chart writes it (`bLdFF`) and by its words, flip by
// flip ("BACK · LAY · DOUBLE FULL · FULL").

import { ordinal } from "@niclaslindstedt/oss-game-framework/hud/format";
import { flipsOf, type AerialDnf, type AerialPhase } from "@engine";

const PHASE: Record<AerialPhase, string> = {
  qualification: "QUALIFICATION",
  final1: "FINAL 1",
  final2: "FINAL 2",
};

const TWISTS = ["", "FULL", "DOUBLE FULL", "TRIPLE FULL"];
const FLIPS = ["", "SINGLE", "DOUBLE", "TRIPLE"];

const DNF: Record<AerialDnf, string> = {
  flips: "WRONG FLIPS",
  twists: "WRONG TWISTS",
  repeat: "JUMP REPEATED",
  start: "NO START",
};

/** A jump in words, flip by flip: "BACK · LAY · FULL" — the position of a
 * flip with no twist, a twisted flip's twists. */
function jumpWords(code: string): string {
  const flips = flipsOf(code) ?? [];
  const parts = flips.map((f) => (f.twists > 0 ? TWISTS[f.twists] : f.tuck ? "TUCK" : "LAY"));
  return [`${FLIPS[flips.length] ?? ""} BACK`.trim(), ...parts].join(" · ");
}

export const AERIALS_STRINGS = {
  /* ── THE FREESTYLE CARD (menu-freestyle.tsx) ────────────────────────── */
  freestyleAerials: (skiers: number, final1: number, final2: number): string =>
    `AIR · FORM · LANDING × DD · ${skiers} · ${final1} · ${final2}`,

  /* ── THE TRICK MAP CARD (menu-tricks.tsx) ───────────────────────────── */
  aerialsOn: "AERIALS ON",
  aerialsBilling: "ONE JUMP A ROUND",
  /** The jump picker's label: "JUMP". */
  aerialsJumpLabel: "JUMP",
  /** "bLF · DD 2.900". */
  aerialsJumpCode: (code: string, dd: number): string => `${code} · DD ${dd.toFixed(3)}`,
  aerialsJumpWords: jumpWords,

  /* ── THE HUD (hud.tsx) ──────────────────────────────────────────────── */
  aerialsPhase: (phase: AerialPhase): string => PHASE[phase],
  /** "bLF · DD 2.900 · 2 OF 2 FLIPS" — the jump declared and what is
   * thrown of it. */
  aerialsDeclared: (code: string, dd: number, flips: number, of: number): string =>
    `${code} · DD ${dd.toFixed(3)} · ${flips}/${of} FLIPS`,

  /* ── THE PLATE (hud-aerials.tsx) ────────────────────────────────────── */
  aerialsTitle: (phase: AerialPhase): string => `AERIALS · ${PHASE[phase]}`,
  aerialsScore: (score: number): string => score.toFixed(2),
  aerialsOut: (why: AerialDnf): string => `DID NOT FINISH · ${DNF[why]}`,
  aerialsFell: "FALL",
  /** "AIR 5.9 · FORM 12.7 · LANDING 6.7". */
  aerialsParts: (air: number, form: number, landing: number): string =>
    `AIR ${air.toFixed(1)} · FORM ${form.toFixed(1)} · LANDING ${landing.toFixed(1)}`,
  /** "25.3 × DD 2.900". */
  aerialsSum: (raw: number, dd: number): string => `${raw.toFixed(1)} × DD ${dd.toFixed(3)}`,
  /** "FLOWN bLF". */
  aerialsFlown: (code: string): string => `FLOWN ${code || "—"}`,
  aerialsYou: "YOU",
  aerialsBib: (id: number): string => `BIB ${id + 1}`,
  aerialsRow: (code: string, score: number, dnf: boolean): string =>
    `${code} ${dnf ? "DNF" : score.toFixed(2)}`,
  aerialsToFinal: (phase: AerialPhase, code: string): string => `${PHASE[phase]} · ${code}`,
  aerialsThrough: (place: number): string => `THROUGH ${ordinal(place)}`,
  aerialsShort: (place: number): string => `${ordinal(place)} · OUT OF THE CONTEST`,
  aerialsDone: (place: number): string =>
    place === 1 ? "YOU WIN" : place <= 3 ? `PODIUM · ${place}` : `FINISHED ${place}`,
  aerialsAgain: "JUMP AGAIN",
} as const;

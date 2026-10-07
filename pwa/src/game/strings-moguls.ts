// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF MOGULS (R40) — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names: the freestyle card's row, the trick map card's billing,
// the run on the HUD and the plate. A jump's trick is called by big air's
// `trickName`, with its degree of difficulty beside it.

import { ordinal } from "@niclaslindstedt/oss-game-framework/hud/format";
import type { MogulPhase } from "@engine";

const PHASE: Record<MogulPhase, string> = {
  qualification: "QUALIFICATION",
  final1: "FINAL 1",
  final2: "FINAL 2",
};

export const MOGULS_STRINGS = {
  /* ── THE FREESTYLE CARD (menu-freestyle.tsx) ────────────────────────── */
  freestyleMoguls: (skiers: number, final1: number, final2: number): string =>
    `TURNS · AIR · SPEED · ${skiers} · ${final1} · ${final2}`,

  /* ── THE TRICK MAP CARD (menu-tricks.tsx) ───────────────────────────── */
  mogulsOn: "MOGULS ON",
  mogulsBilling: "ONE RUN A ROUND",

  /* ── THE HUD (hud.tsx) ──────────────────────────────────────────────── */
  mogulsPhase: (phase: MogulPhase): string => PHASE[phase],
  /** "PACE 24.0 · AIR 1/2" — the pace time and the airs so far. */
  mogulsPace: (pace: number, airs: number): string => `PACE ${pace.toFixed(1)} · AIR ${airs}/2`,

  /* ── THE PLATE (hud-moguls.tsx) ─────────────────────────────────────── */
  mogulsTitle: (phase: MogulPhase): string => `MOGULS · ${PHASE[phase]}`,
  mogulsScore: (score: number): string => score.toFixed(2),
  mogulsOut: "DID NOT FINISH",
  /** "TURNS 47.20 · AIR 12.40 · SPEED 14.50". */
  mogulsParts: (turns: number, air: number, speed: number): string =>
    `TURNS ${turns.toFixed(2)} · AIR ${air.toFixed(2)} · SPEED ${speed.toFixed(2)}`,
  /** A jump on the sheet: "BACK FLIP · DD 0.68 · 8.10 → 5.50". */
  mogulsJump: (trick: string, dd: number, form: number, points: number): string =>
    `${trick} · DD ${dd.toFixed(2)} · ${form.toFixed(2)} → ${points.toFixed(2)}`,
  mogulsNoJump: "NO AIR",
  mogulsTime: (time: number, pace: number): string =>
    `${time.toFixed(2)} S · PACE ${pace.toFixed(2)} S`,
  mogulsYou: "YOU",
  mogulsBib: (id: number): string => `BIB ${id + 1}`,
  mogulsRow: (total: number, fell: boolean): string => (fell ? "DNF" : total.toFixed(2)),
  mogulsToFinal: (phase: MogulPhase): string => `ON TO ${PHASE[phase]}`,
  mogulsThrough: (place: number): string => `THROUGH ${ordinal(place)}`,
  mogulsShort: (place: number): string => `${ordinal(place)} · OUT OF THE CONTEST`,
  mogulsDone: (place: number): string =>
    place === 1 ? "YOU WIN" : place <= 3 ? `PODIUM · ${place}` : `FINISHED ${place}`,
  mogulsAgain: "RUN AGAIN",
} as const;

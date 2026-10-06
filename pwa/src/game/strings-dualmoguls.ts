// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF DUAL MOGULS (R43) — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names: the freestyle card's row, the trick map card's billing,
// the run on the HUD (the round, the lanes, the start's call) and the plate
// (the qualification's score and board, a dual's votes, what comes next).

import { ordinal } from "@niclaslindstedt/oss-game-framework/hud/format";
import type { DualRound } from "@engine";

const ROUND: Record<"qualify" | DualRound, string> = {
  qualify: "QUALIFICATION",
  eighth: "EIGHTH-FINAL",
  quarter: "QUARTER-FINAL",
  semi: "SEMI-FINAL",
  small: "SMALL FINAL",
  final: "BIG FINAL",
};

export const DUAL_MOGULS_STRINGS = {
  /* ── THE FREESTYLE CARD (menu-freestyle.tsx) ────────────────────────── */
  /** "HEAD TO HEAD · 30 · LADDER OF 16". */
  freestyleDual: (skiers: number, ladder: number): string =>
    `HEAD TO HEAD · ${skiers} · LADDER OF ${ladder}`,

  /* ── THE TRICK MAP CARD (menu-tricks.tsx) ───────────────────────────── */
  dualOn: "DUAL MOGULS ON",
  dualBilling: "QUALIFY · THEN DUALS",

  /* ── THE HUD (hud.tsx) ──────────────────────────────────────────────── */
  dualRound: (round: "qualify" | DualRound): string => ROUND[round],
  /** "BLUE · YOU v BIB 12 (9)" — his lane and who is in the other. */
  dualLanes: (lane: "blue" | "red", bib: number, seed: number): string =>
    `${lane === "blue" ? "BLUE" : "RED"} · YOU v BIB ${bib + 1} (${seed})`,
  dualAlone: "ALONE · BLUE LANE",
  /** The start's call, before both gates drop together. */
  dualCall: (lane: "blue" | "red"): string =>
    lane === "blue" ? "BLUE COURSE READY" : "RED COURSE READY",

  /* ── THE PLATE (hud-dual.tsx) ───────────────────────────────────────── */
  dualTitle: (round: "qualify" | DualRound): string => `DUAL MOGULS · ${ROUND[round]}`,
  /** "21 – 14" — his votes first. */
  dualVotes: (mine: number, theirs: number): string => `${mine} – ${theirs}`,
  dualWaiting: "THE OTHER LANE IS STILL ON THE COURSE",
  dualWon: "YOU WIN THE DUAL",
  dualLost: "YOU LOSE THE DUAL",
  dualOut: "DID NOT FINISH",
  dualRivalOut: "YOUR RIVAL DID NOT FINISH",
  /** "TURNS 12–8 · AIR 5–5 · SPEED 4–1". */
  dualParts: (t: [number, number], a: [number, number], s: [number, number]): string =>
    `TURNS ${t[0]}–${t[1]} · AIR ${a[0]}–${a[1]} · SPEED ${s[0]}–${s[1]}`,
  /** "+0.42 S AT THE LINE" — the gap, his side of it. */
  dualGap: (gap: number, ahead: boolean): string =>
    `${ahead ? "AHEAD" : "BEHIND"} BY ${gap.toFixed(2)} S AT THE LINE`,
  dualSeed: (seed: number): string => `SEEDED ${ordinal(seed)} INTO THE LADDER`,
  dualShort: (place: number): string => `${ordinal(place)} · OUT OF THE LADDER`,
  dualThrough: (round: DualRound): string => `ON TO THE ${ROUND[round]}`,
  dualOutAt: (place: number): string => `${ordinal(place)} · OUT OF THE CONTEST`,
  dualDone: (place: number): string =>
    place === 1 ? "YOU WIN" : place <= 3 ? `PODIUM · ${place}` : `FINISHED ${place}`,
  dualToNext: (round: DualRound): string => `ON TO THE ${ROUND[round]}`,
  dualAgain: "SKI IT AGAIN",
  dualYou: "YOU",
  dualBib: (id: number): string => `BIB ${id + 1}`,
  dualRow: (score: number, fell: boolean): string => (fell ? "DNF" : score.toFixed(2)),
} as const;

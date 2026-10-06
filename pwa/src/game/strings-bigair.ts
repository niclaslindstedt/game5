// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF BIG AIR (R37) and of THE FREESTYLE CARD the front door's
// TRICKS tile opens — a block of the one strings table (`strings.ts`,
// §39.1), stated next door and spread into `STRINGS` under the same names,
// as the races' are: the card's rows, the trick map card's billing, the
// jump on the HUD, a trick as the judges call it and the plate.

import { ordinal } from "@niclaslindstedt/oss-game-framework/hud/format";
import type { BigAirPhase, Freestyle, TrickRead } from "@engine";

/** A flip's count in front of its name. */
const TIMES = ["", "", "DOUBLE ", "TRIPLE ", "QUAD "];

/** The grabs, as a big air trick names them. */
const GRABS = { daffy: "DAFFY", spread: "SPREAD EAGLE", grab: "MUTE" } as const;

export const BIG_AIR_STRINGS = {
  /* ── THE FREESTYLE CARD (menu-freestyle.tsx) ────────────────────────── */
  freestyleTitle: "TRICKS",
  /** The park run's row: the trick maps' two minutes. */
  freestylePark: "PARK RUN",
  freestyleParkLine: (seconds: number): string => `KICKERS · ${Math.round(seconds / 60)} MIN`,
  /** Each freestyle format's name. */
  freestyle: {
    bigAir: "BIG AIR",
    slopestyle: "SLOPESTYLE",
    halfpipe: "HALFPIPE",
    railJam: "RAIL JAM",
    moguls: "MOGULS",
    dualMoguls: "DUAL MOGULS",
    aerials: "AERIALS",
    knuckleHuck: "KNUCKLE HUCK",
  } as Readonly<Record<Freestyle, string>>,
  /** Big air's row: its format under its name. */
  freestyleBigAir: (skiers: number, finalists: number): string =>
    `ONE JUMP · ${skiers} · FINAL OF ${finalists}`,

  /* ── THE TRICK MAP CARD for a big air contest (menu-tricks.tsx) ─────── */
  bigAirOn: "BIG AIR ON",
  bigAirBilling: (qualification: number, final: number): string =>
    `${qualification} + ${final} JUMPS`,

  /* ── THE HUD (hud.tsx) ──────────────────────────────────────────────── */
  bigAirPhase: (phase: BigAirPhase): string => (phase === "final" ? "FINAL" : "QUALIFICATION"),
  bigAirJump: (jump: number, of: number): string => `JUMP ${jump}/${of}`,

  /* ── A TRICK AS THE JUDGES CALL IT ──────────────────────────────────── */
  /** "SWITCH LEFT DOUBLE CORK 1260 MUTE", "BACKFLIP", "STRAIGHT AIR". */
  trickName: (r: TrickRead): string => {
    const words: string[] = [];
    if (r.switchIn) words.push("SWITCH");
    // Off a press (the knuckle huck's, R38): a butter if it wound, a press
    // if it only rode the end — "NOSE BUTTER RIGHT 360", "TAIL PRESS".
    if (r.butter) {
      const end = r.butter.end === "nose" ? "NOSE" : "TAIL";
      words.push(r.butter.wound > 0 ? `${end} BUTTER` : `${end} PRESS`);
    }
    if (r.dir) words.push(r.dir === "left" ? "LEFT" : "RIGHT");
    if (r.offAxis) words.push(`${TIMES[r.flips] ?? `${r.flips}× `}CORK ${r.spin}`);
    else if (r.flips > 0) {
      const flip = `${TIMES[r.flips] ?? `${r.flips}× `}${r.flipDir === "front" ? "FRONT FLIP" : "BACKFLIP"}`;
      words.push(r.spin > 0 ? `${r.spin} ${flip}` : flip);
    } else if (r.spin > 0) words.push(String(r.spin));
    else if (!r.butter) words.push("STRAIGHT AIR");
    for (const g of r.grabs) words.push(GRABS[g]);
    return words.join(" ");
  },
  trickNone: "NO JUMP",

  /* ── THE PLATE (hud-bigair.tsx) ─────────────────────────────────────── */
  bigAirTitle: (phase: BigAirPhase, jump: number, of: number): string =>
    `BIG AIR · ${phase === "final" ? "FINAL" : "QUALIFICATION"} · JUMP ${jump}/${of}`,
  bigAirScore: (score: number): string => score.toFixed(2),
  bigAirFell: "FALL",
  bigAirTotal: (phase: BigAirPhase): string =>
    phase === "final" ? "BEST TWO DIFFERENT TRICKS" : "BEST JUMP COUNTS",
  bigAirYou: "YOU",
  bigAirBib: (id: number): string => `BIB ${id + 1}`,
  bigAirFellScore: (score: number): string => `FALL · ${score.toFixed(2)}`,
  /** A board row: one jump alone is its score ("86.00", "FALL"); more are
   * each jump's and what counts of them — "88.25 · FALL · BEST 88.25" in the
   * qualification, "91.00 · 84.50 · FALL · TOTAL 175.50" in the final. */
  bigAirRow: (
    phase: BigAirPhase,
    scores: readonly number[],
    fell: readonly boolean[],
    total: number,
  ): string => {
    const each = scores.map((s, k) => (fell[k] ? "FALL" : s.toFixed(2)));
    if (each.length <= 1) return each[0] ?? total.toFixed(2);
    return `${each.join(" · ")} · ${phase === "final" ? "TOTAL" : "BEST"} ${total.toFixed(2)}`;
  },
  bigAirNextJump: (jump: number): string => `JUMP ${jump}`,
  bigAirToFinal: "ON TO THE FINAL",
  bigAirNextFinal: (place: number): string => `QUALIFIED ${place}`,
  bigAirShort: (place: number, finalists: number): string =>
    `${ordinal(place)} · THE BEST ${finalists} GO TO THE FINAL`,
  bigAirDone: (place: number): string =>
    place === 1 ? "YOU WIN" : place <= 3 ? `PODIUM · ${place}` : `FINISHED ${place}`,
  bigAirAgain: "JUMP AGAIN",
} as const;

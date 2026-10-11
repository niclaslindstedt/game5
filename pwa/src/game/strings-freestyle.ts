// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE FREESTYLE CARD the front door's TRICKS tile opens, and
// A TRICK AS THE JUDGES CALL IT — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names, as the races' are. Each format's own HUD and plate words
// are its own file's (`strings-skijump.ts`, `strings-slopestyle.ts`, …).

import type { Freestyle, TrickRead } from "@engine";
import { BOARD_GRAB_WORDS, BOARD_SIDE_WORDS } from "./strings-board-tricks.ts";

/** A flip's count in front of its name. */
const TIMES = ["", "", "DOUBLE ", "TRIPLE ", "QUAD "];

/** The grabs, as a judged trick names them. */
const GRABS = {
  daffy: "DAFFY",
  spread: "SPREAD EAGLE",
  grab: "MUTE",
  ...BOARD_GRAB_WORDS,
} as const;

export const FREESTYLE_STRINGS = {
  /* ── THE FREESTYLE CARD (menu-freestyle.tsx) ────────────────────────── */
  freestyleTitle: "TRICKS",
  /** The park run's row: the trick maps' two minutes. */
  freestylePark: "PARK RUN",
  freestyleParkLine: (seconds: number): string => `KICKERS · ${Math.round(seconds / 60)} MIN`,
  /** Each freestyle format's name. */
  freestyle: {
    skiJump: "SKI JUMPING",
    slopestyle: "SLOPESTYLE",
    halfpipe: "HALFPIPE",
    moguls: "MOGULS",
    aerials: "AERIALS",
  } as Readonly<Record<Freestyle, string>>,
  /** Ski jumping's row: the hill sizes its hills come in and its format
   * under its name — "HS 106 / 140 · 50 · FINAL OF 30". */
  freestyleSkiJump: (hs: readonly number[], jumpers: number, finalists: number): string =>
    `HS ${hs.join(" / ")} · ${jumpers} · FINAL OF ${finalists}`,

  /* ── A TRICK AS THE JUDGES CALL IT ──────────────────────────────────── */
  /** "SWITCH LEFT DOUBLE CORK 1260 MUTE", "BACKFLIP", "STRAIGHT AIR" — and
   * on a board the side in place of the way, "SWITCH BACKSIDE 720 INDY",
   * "NOLLIE FRONTSIDE 360". */
  trickName: (r: TrickRead): string => {
    const words: string[] = [];
    if (r.switchIn) words.push("SWITCH");
    else if (r.nollie && r.spin > 0) words.push("NOLLIE");
    if (r.side !== undefined) {
      if (r.side) words.push(BOARD_SIDE_WORDS[r.side]);
    } else if (r.dir) words.push(r.dir === "left" ? "LEFT" : "RIGHT");
    if (r.offAxis) words.push(`${TIMES[r.flips] ?? `${r.flips}× `}CORK ${r.spin}`);
    else if (r.flips > 0) {
      const flip = `${TIMES[r.flips] ?? `${r.flips}× `}${r.flipDir === "front" ? "FRONT FLIP" : "BACKFLIP"}`;
      words.push(r.spin > 0 ? `${r.spin} ${flip}` : flip);
    } else if (r.spin > 0) words.push(String(r.spin));
    else words.push("STRAIGHT AIR");
    for (const g of r.grabs) words.push(GRABS[g]);
    return words.join(" ");
  },
} as const;

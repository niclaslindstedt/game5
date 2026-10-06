// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE RAIL JAM (R40) — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names: the tricks card's row, the trick map card's billing, a
// feature's trick as it is called, and the plate at the buzzer. The jam's
// chips are the knuckle huck's (`strings-knuckle.ts`), the same session.

import type { JibRecord, Jib } from "@engine";

/** A feature as a rider names it: its shape, then rail or box. */
const SHAPES: Readonly<Record<Jib["shape"], string>> = {
  down: "DOWN",
  flatDown: "FLAT-DOWN",
  downFlatDown: "KINKED",
  rainbow: "RAINBOW",
};

export const RAIL_JAM_STRINGS = {
  /** The tricks card's row: its format under its name. */
  freestyleRailJam: (riders: number, seconds: number, features: number): string =>
    `A JAM · ${riders} RIDERS · ${features} FEATURES · ${Math.round(seconds / 60)} MIN`,
  /** The trick map card's head and billing. */
  railJamOn: "RAIL JAM ON",
  railJamBilling: (seconds: number): string => `A ${Math.round(seconds / 60)} MIN JAM`,

  /** A FEATURE'S TRICK AS IT IS CALLED, from the top: the degrees on, each
   * stance held (a 50-50, a slide), a swap, a press, the degrees out, and
   * the feature — "270 ON · SLIDE · 90 OUT · KINKED RAIL". */
  jibName: (r: JibRecord, shape: Jib["shape"] | null): string => {
    const parts: string[] = [];
    if (r.on > 0) parts.push(`${r.on} ON`);
    parts.push(r.stances.map((s) => (s === "fifty" ? "50-50" : "SLIDE")).join(" TO "));
    if (r.swaps > 0) parts.push(r.swaps === 1 ? "SWAP" : `${r.swaps} SWAPS`);
    if (r.press) parts.push(r.press === "nose" ? "NOSE PRESS" : "TAIL PRESS");
    if (r.off > 0) parts.push(`${r.off} OUT`);
    const feature = r.kind === "rail" ? "RAIL" : "BOX";
    parts.push(shape ? `${SHAPES[shape]} ${feature}` : feature);
    return parts.join(" · ");
  },

  /* ── THE PLATE (hud-knuckle.tsx) ────────────────────────────────────── */
  railJamTitle: "RAIL JAM · THE BUZZER",
  railJamNote: "RANKED ON THE WHOLE SESSION: THE BEST THREE HITS, EVERY FEATURE, FEW FALLS",
} as const;

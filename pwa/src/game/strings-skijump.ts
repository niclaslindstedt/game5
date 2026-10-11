// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF SKI JUMPING (R43) — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names: the trick map card's billing, the jump on the HUD (the
// bar, the in-run, the take-off, the flight and the landing) and the plate.

import { ordinal } from "@niclaslindstedt/oss-game-framework/hud/format";
import type { SkiJumpRound } from "@engine";

import type { TakeOffWord } from "./ski-jump-run.ts";

const ROUND: Record<SkiJumpRound, string> = {
  trial: "TRIAL ROUND",
  first: "ROUND 1",
  final: "FINAL ROUND",
};

const TAKE_OFF: Record<TakeOffWord, string> = {
  early: "EARLY",
  perfect: "PERFECT",
  late: "LATE",
  none: "NO PUSH",
};

/** A signed figure to one decimal: "+3.4", "−10.6", "0.0". */
function signed(x: number): string {
  const v = Math.round(x * 10) / 10;
  if (v === 0) return "0.0";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;
}

export const SKI_JUMP_STRINGS = {
  /* ── THE TRICK MAP CARD (menu-tricks.tsx) ───────────────────────────── */
  skiJumpOn: "SKI JUMPING ON",
  /** "HS 140 · TRIAL + 2 ROUNDS". */
  skiJumpBilling: (hs: number, trial: boolean): string =>
    `HS ${hs} · ${trial ? "TRIAL + " : ""}2 ROUNDS`,

  /* ── THE HUD (hud-skijump.tsx) ──────────────────────────────────────── */
  skiJumpRound: (round: SkiJumpRound): string => ROUND[round],
  /** "BIB 23 / 50". */
  skiJumpBib: (bib: number, of: number): string => `BIB ${bib} / ${of}`,
  skiJumpGate: (gate: number): string => `GATE ${gate}`,
  /** The start light: red while the jury holds him, green once he may go
   * — and with it the seconds left to leave the bar. */
  skiJumpRed: "WAIT",
  skiJumpGreen: (left: number): string => `GO · ${Math.max(0, Math.ceil(left))}`,
  skiJumpLightLabel: "START",
  /** "HEAD 1.2 m/s", "TAIL 0.8 m/s". */
  skiJumpWind: (head: number): string =>
    `${head >= 0 ? "HEAD" : "TAIL"} ${Math.abs(head).toFixed(1)} m/s`,
  skiJumpWindLabel: "WIND",
  /** The leader's points and the distance that beats them. */
  skiJumpLeader: (points: number): string => `LEADER ${points.toFixed(1)}`,
  skiJumpToBeat: (metres: number): string => `TO BEAT ${metres.toFixed(1)} m`,
  skiJumpFirstUp: "FIRST TO JUMP",
  /** The in-run's speed and the edge's. */
  skiJumpSpeed: (kmh: number): string => `${kmh.toFixed(1)} km/h`,
  skiJumpSpeedLabel: "IN-RUN",
  skiJumpEdgeLabel: "AT THE EDGE",
  skiJumpTakeOff: (word: TakeOffWord): string => TAKE_OFF[word],
  /** The attitude cue in the air: on the ideal, or which way to go. */
  skiJumpAttitude: "ATTITUDE",
  skiJumpLeanIn: "LEAN IN",
  skiJumpSitUp: "EASE BACK",
  skiJumpHold: "HOLD IT",
  /** The distance on the landing, in big type. */
  skiJumpDistance: (metres: number): string => `${metres.toFixed(1)} m`,
  skiJumpTelemark: "TELEMARK",
  skiJumpTwoFooted: "TWO-FOOTED",
  skiJumpFall: "FALL",
  /** The touch pad's two presses. */
  skiJumpPadJump: "JUMP",
  skiJumpPadTelemark: "TELEMARK",
  /** The bar's call: how to leave it. */
  skiJumpGo: (touch: boolean, key: string): string =>
    touch ? "HOLD JUMP TO GO" : `HOLD ${key} TO GO · ${key === "SPACE" ? "" : "SPACE "}AT THE EDGE`,

  /* ── THE PLATE (hud-skijump.tsx) ────────────────────────────────────── */
  skiJumpTitle: (round: SkiJumpRound, hs: number): string =>
    `SKI JUMPING · HS ${hs} · ${ROUND[round]}`,
  skiJumpNoStart: "DID NOT START",
  /** The distance's points, "DISTANCE 69.0" (the metres are the title). */
  skiJumpDistancePoints: (points: number): string => `DISTANCE ${points.toFixed(1)}`,
  skiJumpMark: (mark: number): string => mark.toFixed(1),
  skiJumpStyle: (style: number): string => `STYLE ${style.toFixed(1)}`,
  /** "GATE 12 · +3.4". */
  skiJumpGatePoints: (gate: number, points: number): string => `GATE ${gate} · ${signed(points)}`,
  /** "WIND +1.2 m/s · −10.6". */
  skiJumpWindPoints: (wind: number, points: number): string =>
    `WIND ${signed(wind)} m/s · ${signed(points)}`,
  skiJumpPoints: (points: number): string => `${points.toFixed(1)} PTS`,
  skiJumpTotal: (total: number): string => `TOTAL ${total.toFixed(1)}`,
  skiJumpYou: "YOU",
  skiJumpBibOf: (id: number): string => `BIB ${id + 1}`,
  /** A board row: a round's "124.5 m · 132.4"; the final's both jumps and
   * their total, "124.5 · 128.0 · 265.3". */
  skiJumpRow: (
    distances: readonly number[],
    points: number,
    fell: boolean,
    dns: boolean,
  ): string =>
    dns
      ? "DNS"
      : `${distances.map((d) => d.toFixed(1)).join(" · ")}${distances.length === 1 ? " m" : ""}${fell ? " · FALL" : ""} · ${points.toFixed(1)}`,
  /** What the plate offers next. */
  skiJumpNext: (round: SkiJumpRound): string => (round === "final" ? "TO THE FINAL" : ROUND[round]),
  skiJumpThrough: (place: number): string => `THROUGH TO THE FINAL · ${ordinal(place)}`,
  skiJumpOnward: (place: number): string => `${ordinal(place)} · ON TO ROUND 1`,
  skiJumpShort: (place: number, finalists: number): string =>
    `${ordinal(place)} · THE BEST ${finalists} JUMP THE FINAL`,
  skiJumpDone: (place: number): string =>
    place === 1 ? "YOU WIN" : place <= 3 ? `PODIUM · ${place}` : `FINISHED ${ordinal(place)}`,
  skiJumpAgain: "JUMP AGAIN",
  skiJumpFinalBoard: "FINAL RANKING",
} as const;

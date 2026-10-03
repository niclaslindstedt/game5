// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW THE BODY IS, as the HUD paints it — the engine's ledger
// (`SkierState.body`, `body.ts`) folded into what a figure the size of a
// thumb and three lines under it can say, and the blow the g meter shows.
// DOM-free on purpose: the drawing is next door (`hud-body.tsx`,
// `hud-gforce.tsx`), the arithmetic is here, and the root suite reads it.
//
// Nothing here decides anything. A part's colour IS its worst injury's
// rank on the Abbreviated Injury Scale — green sound, yellow a minor one,
// orange a moderate one, red serious and worse — and the word over the
// whole body IS its injury severity score's band (`severityOf`), the trauma
// ward's own lines: 16 and up is major trauma. The g is billed only off a
// FALL — he went down, or the skier he shouldered did (`Impact.fall`): a
// landing ridden out or a shoulder both stood up from shows no number.

import {
  BODY_PARTS,
  TUNING,
  severityOf,
  type BodyPart,
  type BodyState,
  type ImpactSource,
  type InjuryKind,
} from "@engine";

import type { BodyCondition } from "./strings-body.ts";

/** A part's paint: sound, a minor injury, a moderate one, serious or worse
 * — the same four the rally game's car schematic is painted in. */
export type BodyTone = "ok" | "hurt" | "spent" | "dead";

/** One line under the figure: an injury, and whether it is new enough to
 * be marked as news. */
export type BodyLine = { kind: InjuryKind; part: BodyPart; ais: number; fresh: boolean };

/** THE BLOW ON THE METER: its peak, what took it from what, its number
 * (what the drawing keys its shake on) and how far through its hold it is,
 * 0 just struck … 1 gone. */
export type BlowTile = {
  g: number;
  part: BodyPart;
  source: ImpactSource;
  id: number;
  age: number;
};

export type BodyTile = {
  /** Every part's paint, in `BODY_PARTS` order. */
  parts: BodyTone[];
  /** The part the blow on the meter struck, while it is fresh — drawn lit. */
  struck: BodyPart | null;
  condition: BodyCondition;
  /** The injury severity score, 0 … 75. */
  severity: number;
  /** The worst injuries, worst first and the newest first within a rank,
   * at most `LINES`; `more` how many the panel leaves out. */
  lines: BodyLine[];
  more: number;
  /** The run's hardest blow he fell on, g — 0 before one. */
  peak: number;
  /** The blow on the meter, or null with no fall's fresh. */
  blow: BlowTile | null;
};

/** How many injuries the panel lists. */
export const LINES = 3;

/** How long an injury is marked as news, s of the engine's clock. */
const FRESH = 3;

/** A part's paint off its worst AIS rank. */
export function toneOf(ais: number): BodyTone {
  if (ais <= 0) return "ok";
  if (ais === 1) return "hurt";
  if (ais === 2) return "spent";
  return "dead";
}

/** The whole body's word off its injury severity score. */
export function conditionOf(severity: number): BodyCondition {
  if (severity <= 0) return "sound";
  if (severity <= 3) return "bruised";
  if (severity <= 8) return "hurt";
  if (severity <= 15) return "injured";
  if (severity <= 24) return "serious";
  return "critical";
}

/** The tile, off the body and the engine's clock `t`. */
export function bodyTile(body: BodyState, t: number): BodyTile {
  const order = body.injuries
    .map((h, i) => ({ h, i }))
    .sort((a, b) => b.h.ais - a.h.ais || b.i - a.i);
  const lines = order.slice(0, LINES).map(({ h }) => ({
    kind: h.kind,
    part: h.part,
    ais: h.ais,
    fresh: t - h.t < FRESH,
  }));
  const hold = TUNING.injury.hold;
  const b = body.impact;
  const blow =
    b && b.fall && b.t < hold
      ? { g: b.g, part: b.part, source: b.source, id: b.id, age: b.t / hold }
      : null;
  const severity = severityOf(body);
  return {
    parts: BODY_PARTS.map((_, i) => toneOf(body.worst[i])),
    struck: blow ? blow.part : null,
    condition: conditionOf(severity),
    severity,
    lines,
    more: Math.max(0, body.injuries.length - LINES),
    peak: body.fallPeak,
    blow,
  };
}

/** The meter's paint off a blow's g: a jolt, a hard blow, a dangerous
 * one, past what a body takes whole. Lines at the chest's 60 g and the
 * spine's 20 — the round tolerances the catalog is fitted to. */
export function blowTone(g: number): "jolt" | "hard" | "danger" | "severe" {
  if (g < 8) return "jolt";
  if (g < 20) return "hard";
  if (g < 60) return "danger";
  return "severe";
}

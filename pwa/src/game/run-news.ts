// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A RACE SAYS: the line in the news column an engine event earns. Pure
// — an event and the state it came off in, a line out — so the root suite
// reads every rung without a browser, and `App.tsx` only calls it. Every
// word is the strings table's (§39.1).
//
// NEWS IS WHAT CHANGED THE RUN: a gate taken and its clock, one missed, a
// tree met, a landing the legs could not take, a wipeout and what caused
// it, the skier bogged, an edge dulled or a knee hurt, a reset, the finish.
// What the HUD already shows in its own corner every frame — the speed, the
// place — is not news, and neither is a landing the skis simply rode away
// from.

import type { GameEvent, GameState } from "@engine";

import { gatesTaken } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

/** A line in the news column: what it says, its colour, and an id the list
 * is keyed on so a line leaving does not restart the animation of the one
 * under it. */
export type HudFlash = { id: number; text: string; tone: "good" | "bad" | "info" };

export type NewsLine = Omit<HudFlash, "id">;

/** The line `e` earns, or null for an event that is not news. */
export function newsFor(e: GameEvent, state: GameState): NewsLine | null {
  switch (e.kind) {
    case "checkpoint":
      // The START GATE opens the run and is worth a word; every later gate
      // is billed with its clock — but not the finish line, whose crossing
      // the `finish` event says better.
      if (e.index === 0) return { text: STRINGS.newsStart, tone: "info" };
      if (e.index >= state.level.checkpoints.length - 1) return null;
      return { text: STRINGS.newsCheckpoint(e.index, e.split), tone: "good" };
    case "lap":
      // A piste is one run: the finish line ends it, and the `finish`
      // event beside this one carries the line.
      return null;
    case "missed":
      return { text: STRINGS.newsMissed(e.index), tone: "bad" };
    case "hit":
      return { text: STRINGS.newsTree, tone: "bad" };
    case "land":
      return e.harsh ? { text: STRINGS.newsHarsh, tone: "bad" } : null;
    case "reset":
      return { text: STRINGS.newsReset, tone: "info" };
    case "wipeout":
      return { text: STRINGS.newsWipeout(e.cause), tone: "bad" };
    case "stuck":
      return { text: STRINGS.newsStuck, tone: "bad" };
    case "damage":
      return { text: STRINGS.newsDamage(e.part), tone: "bad" };
    case "combo":
      return e.sketchy
        ? { text: `${STRINGS.comboSketchy} ${STRINGS.comboBanked(e.points)}`, tone: "info" }
        : { text: STRINGS.comboBanked(e.points), tone: "good" };
    case "bail":
      return { text: STRINGS.comboBailed(e.lost), tone: "bad" };
    case "finish":
      // A tricks run is its score; a run alone has no place, only a time.
      if (state.rules.tricks)
        return { text: STRINGS.newsTricksFinish(state.tricks.score), tone: "good" };
      if (state.rivals.length === 0) return { text: STRINGS.newsFinishAlone(e.time), tone: "good" };
      return {
        text: STRINGS.newsFinish(e.place, state.rivals.length + 1, e.time),
        tone: "good",
      };
    default:
      return null;
  }
}

/** WHAT A PICTURE IS CALLED: the mountain it was taken on, where on the
 * piste — the gate count, or the free ride that counts none — how fast, and
 * on which pair.
 * It is the gallery's caption and most of the file's name
 * (`screenshots.ts`), read at the SHUTTER'S press, so it is the moment the
 * button went down rather than the frame that served it. */
export function shotLabel(state: GameState): string {
  return STRINGS.shotLabel({
    seed: state.seed,
    gate: state.rules.course ? gatesTaken(state.progress, state.level.checkpoints.length) : null,
    gates: state.level.checkpoints.length,
    kmh: state.skier.speed * 3.6,
    skis: state.skier.spec.name,
  });
}

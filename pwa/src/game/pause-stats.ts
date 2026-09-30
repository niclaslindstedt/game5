// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE HELD RUN IS BILLED WITH on the pause card — the handful of figures
// worth reading back once the snow has stopped moving.
//
// THE HUD IS STILL UP BEHIND THIS CARD (`shell.ts`'s `hudOver`), so the
// clock, the gate count and the vertical dropped are already on screen. A strip that
// simply repeated them in their own order would be a second copy of the
// corner the player is looking past. So only the two worth repeating lead:
// WHERE THE SKIER STANDS and THE CLOCK, because those are what a skier stopped
// to think about. Behind them come the run's OWN STORY — the record it is
// being skied against, the longest flight, how far has been skied — which
// the HUD either flashes for a moment or does not carry at all. The corner's
// other readings fill whatever is left over.
//
// WHICH FIGURES IS THE RUN'S (`GameState.rules`, read off the snapshot as
// `free` and `skiers`): a figure the run is not playing for is not shown at
// all — 1ST / 1 is not a standing, and a free ride owes no gate — the
// way the HUD leaves a chip out rather than printing a zero.
//
// FOUR AT MOST, one row across. The card has to stand inside a phone held
// sideways — 390 px of height for a head, four presses and this — so a fifth
// cell is not a tighter row, it is a card that scrolls.
//
// DOM-free: the decision is here and `menu-pause.tsx` only draws it, so
// `tests/menu_system_test.ts` holds every rule above without a browser. The
// WORDS are the strings table's (§39.1) — nothing here spells one.

import type { HudSnapshot } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";

/** One cell: the figure, the caption under it, and a key for the list. */
export type PauseStat = {
  key: string;
  value: string;
  label: string;
};

/** WHAT A BILL IS READ FROM — the fields of the HUD's own snapshot this asks
 * for, and no more. A whole `HudSnapshot` satisfies it, so `App.tsx` hands
 * one straight over, and a test states a run in a dozen numbers rather than
 * assembling a minimap. */
export type PauseRun = Pick<
  HudSnapshot,
  | "place"
  | "skiers"
  | "time"
  | "free"
  | "taken"
  | "gates"
  | "dropped"
  | "bestAir"
  | "distance"
  | "best"
>;

/** How many cells the row carries — a height budget, not a taste. */
export const PAUSE_STATS = 4;

/** Skied (or dropped) less than this, m, and the cell has nothing to say:
 * the start line is a few metres of shuffling before the lights go. */
const DISTANCE_SHOWN = 1;

/** A candidate cell and whether the run has anything to say in it. `shown`
 * false drops it before the count is taken, so a run with no flight in it yet
 * is billed with four figures and not with three and a dash. */
type Candidate = PauseStat & { shown: boolean };

export function pauseStats(snap: PauseRun, max: number = PAUSE_STATS): PauseStat[] {
  const place: Candidate = {
    key: "place",
    value: STRINGS.place(snap.place, snap.skiers),
    label: STRINGS.placeLabel,
    shown: snap.skiers > 1,
  };
  const time: Candidate = {
    key: "time",
    value: STRINGS.resultTime(snap.time),
    label: STRINGS.clockLabel,
    shown: true,
  };
  // The row the time trial is being skied against — the HUD only ever shows
  // the GAP to it, at a crossing, and never the figure itself.
  const record: Candidate = {
    key: "record",
    value: snap.best ? STRINGS.resultTime(snap.best.time) : "",
    label: STRINGS.pauseRecord,
    shown: snap.best !== null,
  };
  // THE RUN'S OWN STORY. Each is 0 until the run has done it, and a zero here
  // is a cell spent saying nothing.
  const air: Candidate = {
    key: "air",
    value: STRINGS.air(snap.bestAir),
    label: STRINGS.bestAirLabel,
    shown: snap.bestAir > 0,
  };
  const distance: Candidate = {
    key: "distance",
    value: STRINGS.distance(snap.distance),
    label: STRINGS.distanceLabel,
    shown: snap.distance >= DISTANCE_SHOWN,
  };
  const gate: Candidate = {
    key: "gate",
    value: STRINGS.gates(snap.taken, snap.gates),
    label: STRINGS.gatesLabel,
    shown: !snap.free,
  };
  const dropped: Candidate = {
    key: "dropped",
    value: STRINGS.dropped(snap.dropped),
    label: STRINGS.droppedLabel,
    shown: snap.dropped >= DISTANCE_SHOWN,
  };
  // THE HEADLINE AND THE CLOCK, THEN THE RUN'S OWN RECORDS — and only then
  // the rest of what the HUD is already showing. So the strip is the HUD's
  // own reading while the run has no story yet, and stops being one the
  // moment it has.
  const order = snap.free
    ? [time, air, distance, dropped]
    : [place, time, record, air, distance, gate, dropped];
  return order.filter((c) => c.shown).slice(0, Math.max(0, max));
}

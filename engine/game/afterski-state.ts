// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AFTERSKI AND THE BUZZ AS STATE (`afterski.ts`, `buzz.ts`) — beside
// `state.ts`, which re-exports them, so a reader asks the one place he
// always has.

import type { LoneSki } from "./thrown-state.ts";

/** THE AFTERSKI on a free ride (`RunRules.afterski`): whether the skier is
 * inside a lodge and which, how long he has been in, the beers he has had
 * there and when the last was finished — absent from a run with no lodges
 * to go into. */
export type AfterskiState = {
  /** The lodge he is in (`Cabin.id`), or null outside. */
  inside: string | null;
  /** Seconds since he went in. */
  t: number;
  /** Beers finished this visit, and in all this run. */
  beers: number;
  total: number;
  /** Seconds inside the last beer was finished at (−1 none yet). */
  last: number;
  /** The beer in his hand: seconds into drinking it, or −1 between. */
  sip: number;
};

/** THE LATE HANDS (`buzz.ts`'s `drunkInput`): the edge and the lean as
 * they have reached his skis through the buzz's lag. */
export type Wobble = { steer: number; lean: number };

/** ON FOOT AFTER A FALL, FETCHING HIS SKIS (`buzz.ts`'s `stepFetch`): got
 * up where he lay, walking to each ski the fall threw off, picking it up,
 * and stepping back into the pair to ski on.
 *   * `phase`: getting up off the snow, walking to a ski, bending for it,
 *     or clipping back in; `phaseT` s into it, `t` s since he got up.
 *   * `skis`: the two skis as they lie (`lone-skis.ts`), still sliding
 *     until they stop; `carried` which of them he has picked up.
 *   * `target`: the ski he is walking to, or −1.
 *   * `walked`: how far he has walked, m — what his stride is drawn by.
 *   * `hands`: seconds since the player last walked him himself; the
 *     walk goes on by itself once it is past `BUZZ.fetch.hands`. */
export type Fetch = {
  phase: "rise" | "walk" | "pick" | "clip";
  phaseT: number;
  t: number;
  skis: LoneSki[];
  carried: [boolean, boolean];
  target: number;
  walked: number;
  hands: number;
};

/** What the afterski and the buzz report: in through the door, a beer
 * finished (`beers` this visit), out; and the fetch's beats — up off the
 * snow, a ski picked up (`skis` of two in hand), back in the bindings. */
export type AfterskiEvent =
  | { kind: "afterski"; t: number; phase: "in" | "beer" | "out"; beers: number; buzz: number }
  | { kind: "fetch"; t: number; phase: "up" | "ski" | "in"; skis: number };

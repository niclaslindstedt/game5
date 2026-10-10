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
  /** The lodge he has just come out of (`Cabin.id`), or null: its door is
   * not offered again — no call, no press in — until he has been out of
   * its reach, so the way out does not stand there as a way back in. */
  out: string | null;
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

/** IN TOWN ON FOOT (`town.ts`): stopped on a street of the village, out of
 * the bindings, the pair on his right shoulder and walking in his boots —
 * and, off the streets again, the pair laid down and stepped back into.
 *   * `phase`: stepping out of the bindings (`out`), picking the pair up
 *     onto his shoulder (`pick`), walking (`walk`), taking it off and
 *     laying it down (`drop`), back in (`clip`); `phaseT` s into it, `t`
 *     s since he stopped.
 *   * `skis`: the two skis where they are (`lone-skis.ts`'s shape, placed
 *     by `town.ts` every step, never slid): at his feet, stood up in front
 *     of him, on his shoulder.
 *   * `at`: where the pair lay when he stepped out of it (x, z, heading),
 *     and where he lays it to step back in.
 *   * `walked`: how far he has walked, m — what his stride is drawn by.
 *   * `station`: the walk is a gondola station's (`lift-skis.ts`), not the
 *     town's — the HUD calls no town over it. */
export type TownWalk = {
  phase: "out" | "pick" | "walk" | "drop" | "clip";
  phaseT: number;
  t: number;
  skis: LoneSki[];
  at: { x: number; z: number; heading: number };
  walked: number;
  station?: boolean;
};

/** What the afterski and the buzz report: in through the door, a beer
 * finished (`beers` this visit), out; and the fetch's beats — up off the
 * snow, a ski picked up (`skis` of two in hand), back in the bindings. */
export type AfterskiEvent =
  | { kind: "afterski"; t: number; phase: "in" | "beer" | "out"; beers: number; buzz: number }
  | { kind: "fetch"; t: number; phase: "up" | "ski" | "in"; skis: number }
  /** In town (`town.ts`): stopped on a street, a heel piece popped, the
   * pair clapped together, on the shoulder, a boot's step, the pair laid
   * on the snow, a binding snapped shut and away. */
  | {
      kind: "town";
      t: number;
      phase: "stop" | "heel" | "clap" | "shoulder" | "step" | "lay" | "snap" | "away";
    };

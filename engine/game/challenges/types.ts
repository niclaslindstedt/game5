// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHAPES OF A FREE RIDE CHALLENGE — what a map deals, what a judge
// says and what the app files. Stated apart from the kinds so a kind, the
// registry and the app all read one set of names.
//
// A CHALLENGE is a goal dealt once off a map (`ChallengeKind.deal`): an id
// that names it on that map for good, its kind, the three medals' bars and
// which way is better, and whatever geometry the app draws it with (a
// line's two gates, a kicker's lip, the lift tops) — each kind's own
// interface extends `ChallengeBase`. A JUDGE (`ChallengeKind.watch`) is a
// pure watcher over a run: handed the `GameState` after every step, it
// reads the skier, the step's events and the filed flights, keeps its
// memory in itself and writes NOTHING into the state — so a run judged is
// the run unjudged, digest for digest.

import type { Level } from "../../mapgen/types.ts";
import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import type { GameState } from "../state.ts";

/** The three medals, worst first. */
export type Medal = "bronze" | "silver" | "gold";
export const MEDALS: readonly Medal[] = ["bronze", "silver", "gold"];

/** The value each medal asks for: a time at the most, s (`better`
 * "lower"), or a count or tier at the least (`better` "higher"). */
export type MedalBars = { bronze: number; silver: number; gold: number };

/** What every challenge carries. `unit` says how its value reads: seconds,
 * a count (spots, summits) or a tier (1 bronze … 3 gold, a trick's). */
export interface ChallengeBase {
  /** Stable on the map for good: `line:<run>:<n>`, `trick:<x>:<z>`,
   * `spots`, `summits` — never a course's or a pick's. */
  id: string;
  /** The kind's id (`ChallengeKind.id`). */
  kind: string;
  medals: MedalBars;
  better: "lower" | "higher";
  unit: "s" | "count" | "tier";
}

/** A point on the snow, m (heading in the engine's convention). */
export type Spot = { x: number; y: number; z: number };

/** A FLAG GATE across a run: its middle, the heading down the run there,
 * its width (the run's own) and its two flags, m. */
export type ChallengeGate = Spot & {
  heading: number;
  width: number;
  /** The left and right flags as a skier going down sees them. */
  left: { x: number; z: number };
  right: { x: number; z: number };
  /** The gate's arc down its run, m. */
  s: number;
};

/** WHAT A JUDGE SAYS on a step, for the app's news, HUD and book:
 *   * `start` — a timed line's clock started at its start gate;
 *   * `split` — half way down it (`value` the clock, s);
 *   * `done` — finished, or a goal met (`value` the time or the tier);
 *   * `void` — a line's attempt thrown away (`why`);
 *   * `found` — one more thing found (`what` it is, `value` how many of
 *     the challenge's are found so far, this run's and `known`'s together).
 * `medal` is what the value earns, null when it earns none. */
export type ChallengeEvent = {
  kind: "start" | "split" | "done" | "void" | "found";
  id: string;
  t: number;
  value?: number;
  medal?: Medal | null;
  what?: string;
  why?: VoidCause;
};

/** Why a line's attempt was thrown away. */
export type VoidCause = "fall" | "reset" | "lift" | "machine" | "off" | "slow" | "moved";

/** The best a run did at one challenge, as the app files it. */
export type ChallengeResult = {
  id: string;
  medal: Medal | null;
  value?: number;
  /** For a count kind: what was found, by `what`. */
  found?: string[];
};

/** ONE WATCHER OF A KIND over a run: stepped with the state after every
 * engine step, pushing what it saw onto `out`; `live` is what it would
 * show on the HUD now (null for nothing). */
export interface ChallengeWatch {
  step(state: GameState, out: ChallengeEvent[]): void;
  live?(): LiveLine | null;
}

/** A TIMED LINE UNDER WAY, for the HUD: which, its clock, how far down it
 * he is, and its bars. */
export type LiveLine = {
  id: string;
  run: string;
  elapsed: number;
  /** 0 at the start gate … 1 at the finish. */
  share: number;
  medals: MedalBars;
};

/** What a judge is armed with besides the plan: what the app's book has
 * already found, by challenge id — so a `found` is said once for good and
 * counted with what was found before. */
export type ChallengeMemory = { found?: Readonly<Record<string, readonly string[]>> };

/** A KIND OF CHALLENGE — one row of `CHALLENGE_KINDS`. `deal` reads the
 * map and draws only off the `rng` it is handed (a stream of the kind's
 * own); `watch` makes the judge of a run over the challenges it dealt. */
export interface ChallengeKind<C extends ChallengeBase = ChallengeBase> {
  id: string;
  deal(level: Level, rng: Rng): C[];
  watch(level: Level, dealt: readonly C[], memory: ChallengeMemory): ChallengeWatch;
}

/** The medal `value` earns on challenge `c`, or null. */
export function medalOf(c: Pick<ChallengeBase, "medals" | "better">, value: number): Medal | null {
  const meets = (bar: number) => (c.better === "lower" ? value <= bar : value >= bar);
  if (meets(c.medals.gold)) return "gold";
  if (meets(c.medals.silver)) return "silver";
  if (meets(c.medals.bronze)) return "bronze";
  return null;
}

/** Whether medal `a` is better than `b` (null the worst). */
export function medalBeats(a: Medal | null, b: Medal | null): boolean {
  return (a === null ? -1 : MEDALS.indexOf(a)) > (b === null ? -1 : MEDALS.indexOf(b));
}

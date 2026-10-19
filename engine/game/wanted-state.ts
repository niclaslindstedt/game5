// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WANTED LEVEL as the run holds it (`wanted.ts`) — a type of its own so
// `state.ts` can carry it without importing the step that moves it.

import type { PursuerKind, WantedCause } from "./defs/wanted.ts";

/** ONE PURSUER as the sight test sees him: what he is and where his eyes
 * are, world frame, m. The parts that fly the helicopters, ski the
 * soldiers and drive the snowmobiles write one of these a step for every
 * man or machine they have out (`WantedState.pursuers`); `id` is theirs. */
export type Pursuer = {
  id: number;
  kind: PursuerKind;
  x: number;
  y: number;
  z: number;
};

/** How a hunt ended: the stars lost (`escaped`), taken in by the army with
 * SAFE FOR WORK on (`arrested`), or dead (`killed`). */
export type WantedEnd = "escaped" | "arrested" | "killed";

/** THE WANTED LEVEL on a run that raised it — absent on every other, so
 * no digest moves. Nothing in it draws from any stream. */
export type WantedState = {
  /** The stars held, 0..5 (0 once lost). */
  stars: number;
  /** The heat in star units, `stars` ≤ heat < `stars` + 1 while hunted:
   * the fraction is how near the next star is. */
  heat: number;
  /** Whether a pursuer has him in sight (or the fix after an offence
   * holds): the stars solid. False while they search: the stars flash. */
  seen: boolean;
  /** Seconds out of every pursuer's sight, this search. */
  unseen: number;
  /** Seconds left of the fix the last offence gave them. */
  fix: number;
  /** Where he was last seen, world frame, m — the search's centre. */
  lastSeen: { x: number; y: number; z: number };
  /** Seconds to the next look (`WANTED.lookEvery`). */
  look: number;
  /** THE PURSUERS out, written by the parts that move them; empty until
   * any is. */
  pursuers: Pursuer[];
  /** Whether the army shoots to kill (false with SAFE FOR WORK on: they
   * chase him down and arrest him instead). */
  lethal: boolean;
  /** THE SURVIVAL TIMER: run time the hunt began (the first raise, or a
   * raise after the last one ended), and the run time it stopped — null
   * while it runs. The time survived is `(stopped ?? t) − since`. */
  since: number;
  stopped: number | null;
  /** How the last hunt ended, and when (run time) — null while it runs. */
  ended: WantedEnd | null;
  endedAt: number;
  /** The most stars this hunt reached. */
  peak: number;
  /** Run time each star was reached at (index = stars; NaN not yet) — the
   * clock each star's ground waves count from. */
  reached: number[];
  /** The last offence that raised the heat. */
  cause: WantedCause | null;
};

/** THE WANTED LEVEL'S EVENT: a star gained (`raised`) or taken away by
 * hand (`lowered`), the stars dropped after a search ran out (`lost`), a
 * pursuer catching sight of him again (`seen`), losing it (`searching`),
 * or the army taking him in (`arrested`). */
export type WantedEvent = {
  kind: "wanted";
  t: number;
  change: "raised" | "lowered" | "lost" | "seen" | "searching" | "arrested";
  stars: number;
  cause?: WantedCause;
};

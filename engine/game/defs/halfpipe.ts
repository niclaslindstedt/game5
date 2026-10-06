// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HALFPIPE'S NUMBERS — the contest (R41 builds its pipe; the format and
// the judging are `halfpipe-contest.ts`'s and `halfpipe-judge.ts`'s, the
// flight off a wall `pipe-air.ts`'s), from `docs/freestyle.md` §
// *Halfpipe*. Stated beside `modes.ts`, which re-exports them, so the
// modes' file stays under its cap; it imports nothing from `modes.ts` but
// types, so the two load in either order.

import type { Jury, RunRules } from "./modes.ts";
import type { SkiId } from "./skis.ts";

/** THE HALFPIPE CONTEST'S NUMBERS. */
export const HALFPIPE = {
  /** The start list beside the player — a qualification heat's 25 — and
   * how many of the whole go to the final (the top series' ten to twelve). */
  field: 24,
  finalists: 12,
  /** Runs in each phase, the single best counting in both: a
   * qualification of two and a final of three. */
  qualification: 2,
  final: 3,
  /** The starter's count, s, and the time after it to drop in, s. */
  countdown: 3,
  window: 30,
  /** THE STROKES' CEILINGS: a 1620 (the most a top run spins in the pipe)
   * and a double. */
  spinMost: 9 * Math.PI,
  flipMost: 4 * Math.PI,
  /** THE PAIR: the competition twin-tip the same skiers ride in the park —
   * a pipe skier asks for a firm ski for the speed, ~90–100 mm underfoot
   * at most, 174–184 cm on a 17–21 m sidecut: the class the Raven is
   * (`docs/freestyle.md` § *Halfpipe*, "The pair"). */
  skis: "raven" as SkiId,
  /** THE JURY'S WEATHER (est.): no rule sets a wind speed; a top final ran
   * in gusts to ~65 km/h with its field toning its runs down and falling,
   * and a series stop was put off with gusts near 64 km/h — so the pipe
   * is held under 40 km/h of gust, and in no more than a steady fall
   * (a storm's fall closes the view a skier spots the wall by). */
  jury: { wind: 40 / 3.6, fall: 0.75 } as Jury,
} as const;

/** THE HALFPIPE as a skier is dealt it (R41): one skier in the pipe, the
 * starter's count and the window to drop in, a fall the end of the run
 * (the strict gates), the real g in flight, the strokes' ceilings raised.
 * The field is the contest's, dealt, never skied. */
export function halfpipeRules(laps: number): RunRules {
  return {
    rivals: 0,
    laps,
    countdown: HALFPIPE.countdown,
    contact: false,
    course: true,
    tricks: true,
    stunts: true,
    limit: 0,
    airGravity: 1,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    start: "line",
    gates: "strict",
    window: HALFPIPE.window,
    jury: HALFPIPE.jury,
    spinMost: HALFPIPE.spinMost,
    flipMost: HALFPIPE.flipMost,
  };
}

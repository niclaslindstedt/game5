// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MOGULS' NUMBERS — the contest (R42 builds its course; the format is
// `moguls-contest.ts`'s, the formal score `moguls-judge.ts`'s and the
// turns' reading `mogul-turns.ts`'s), from `docs/freestyle.md` §
// *Moguls*. Stated beside `modes.ts`, which re-exports them, so the
// modes' file stays under its cap; it imports nothing from `modes.ts` but
// types, so the two load in either order.

import type { Jury, RunRules } from "./modes.ts";
import type { SkiId } from "./skis.ts";

/** THE MOGULS CONTEST'S NUMBERS. */
export const MOGULS = {
  /** The start list beside the player — a qualification of thirty — and
   * the phases after it: the best `final1` to FINAL 1, its best `final2`
   * to FINAL 2, each one run, nothing carried over. */
  field: 29,
  final1: 16,
  final2: 6,
  /** The starter's count ("competitor ready", then 3, 2, 1), s, and the
   * time after it to break the light beam at the start gate, s. */
  countdown: 3,
  window: 10,
  /** THE PACE SPEED the speed score is read against, m/s — the men's (the
   * women's is 9.00): a run at it scores 16, at 0.875 of its time 20. */
  pace: 10.3,
  /** THE STROKES' CEILINGS off an air bump: a cork 1440 (the most a top
   * run throws off the bottom air) and a double (a back double full). */
  spinMost: 8 * Math.PI,
  flipMost: 4 * Math.PI,
  /** THE PAIR: the mogul ski, the class the athletes ride — 161–179 cm,
   * 61–66 mm underfoot on a straight 17–26 m sidecut, soft in the
   * forebody (`docs/freestyle.md` § *Moguls*, "The skis"). */
  skis: "ibex" as SkiId,
  /** THE JURY'S WEATHER (est.): no rule sets a wind speed. Moguls are
   * called off for what the judges cannot SEE — fog and a heavy fall
   * closing the course to the panel at its foot — far oftener than for
   * wind; the air bumps are small and the run is low to the snow. So the
   * course is held under 50 km/h of gust (a speed race's) and in no more
   * than a steady fall. (Fog, a visibility the jury has no row for, is
   * still dealt.) */
  jury: { wind: 50 / 3.6, fall: 0.75 } as Jury,
} as const;

/** THE MOGULS as a skier is dealt them (R42): one skier on the course, the
 * starter's count and the window to break the beam, the control gates
 * held strictly (a gate missed, a fall that stops him: out), the real g in
 * flight, the strokes' ceilings raised for the two airs, and the mogul
 * skier's technique. The field is the contest's, dealt, never skied. */
export function mogulsRules(laps: number): RunRules {
  return {
    rivals: 0,
    laps,
    countdown: MOGULS.countdown,
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
    window: MOGULS.window,
    technique: "moguls",
    jury: MOGULS.jury,
    spinMost: MOGULS.spinMost,
    flipMost: MOGULS.flipMost,
  };
}

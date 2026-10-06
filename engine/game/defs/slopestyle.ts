// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SLOPESTYLE'S NUMBERS — the contest (R39 builds its course; the format and
// the section judging are `slopestyle-contest.ts`'s and
// `slopestyle-judge.ts`'s) and THE JIBS a skier slides on (`jib.ts`), from
// `docs/freestyle.md` § *Slopestyle* and § *Rail jam*. Stated beside
// `modes.ts`, which re-exports them, so the modes' file stays under its
// cap; it imports nothing from `modes.ts` but types, so the two load in
// either order.

import type { Jury, RunRules } from "./modes.ts";
import type { SkiId } from "./skis.ts";

/** THE SLOPESTYLE CONTEST'S NUMBERS. */
export const SLOPESTYLE = {
  /** The start list beside the player — the top series' thirty — and how
   * many of the whole go to the final. */
  field: 29,
  finalists: 12,
  /** Runs in each phase, the single best counting in both (the format's
   * qualification of two and final of three). */
  qualification: 2,
  final: 3,
  /** The starter's count, s, and the time after it to drop in, s. */
  countdown: 3,
  window: 30,
  /** THE STROKES' CEILINGS: a 1800 (the most the biggest jump of a top
   * course is spun) and a triple. */
  spinMost: 10 * Math.PI,
  flipMost: 6 * Math.PI,
  /** The pair the field rides: the competition twin-tip the same skiers
   * ride in big air — a slopestyle course is three big-air-sized jumps
   * after its rails, and its skiers ride one stiff park pair for both
   * (`docs/freestyle.md` § *Slopestyle*, "The pair"). */
  skis: "raven" as SkiId,
  /** THE JURY'S WEATHER (est.): no rule sets a wind speed; a top final run
   * in gusts up to 10 m/s left most of its field on the snow and was
   * widely called unsafe, and finals have been called off for wind — so
   * the course is held under 36 km/h of gust, and in no more than a
   * steady fall. */
  jury: { wind: 36 / 3.6, fall: 0.75 } as Jury,
} as const;

/** THE JIBS — a rail or a box ridden (`jib.ts`). Every number is an
 * arcade's or an estimate's, and says which. */
export const JIBS = {
  /** THE SLIDE'S FRICTION, Coulomb: a ski's base on a box's polyethylene
   * top and its edges across a steel pipe, a little worse than on groomed
   * snow (est.). */
  friction: { rail: 0.08, box: 0.06 },
  /** How far either side of a jib's top a skier's feet may come down and
   * still be put on it, m past its half-width — the line a skier rides at
   * it, not the inch a real rail asks for (an arcade's). */
  capture: { rail: 0.4, box: 0.5 },
  /** How far above its top his feet may come down onto it, m, and how far
   * below it they may be and still hop on — a jib's near end is ridden
   * onto with an ollie the game throws for him (an arcade's). */
  above: 1.4,
  below: 0.5,
  /** How far along from its near end he can still get on, m. */
  window: 1.5,
  /** THE SWAP: the edge past `tap` throws a quarter turn on the rail, the
   * skis turned at `rate` rad/s (a quarter in an eighth of a second). */
  tap: 0.6,
  rate: 12,
  /** THE PRESS: the lean past this holds the skis onto one end. */
  press: 0.5,
  /** How long before the end he turns out, s. */
  outLead: 0.22,
  /** Slower than this, m/s, he slides off the side. */
  stall: 0.6,
  /** THE POP off it, m/s up — the jump let go on it (an arcade's). */
  pop: 2.6,
  /** The drag area of a skier stood up on it, m², and his mass, kg —
   * the air's share of his slow. */
  drag: 0.7,
  mass: 80,
} as const;

/** SLOPESTYLE as a skier is dealt it (R39): one skier on the course, the
 * starter's count and the window to drop in, a fall the end of the run
 * (the strict gates — nobody is stood back on it), the real g in flight,
 * the strokes' ceilings raised, and the jibs ridden. The field is the
 * contest's, dealt, never skied. */
export function slopestyleRules(laps: number): RunRules {
  return {
    rivals: 0,
    laps,
    countdown: SLOPESTYLE.countdown,
    contact: false,
    course: true,
    tricks: true,
    stunts: true,
    limit: 0,
    // The real g: every trick format's flights are timed to a real hang.
    airGravity: 1,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    start: "line",
    gates: "strict",
    window: SLOPESTYLE.window,
    jury: SLOPESTYLE.jury,
    spinMost: SLOPESTYLE.spinMost,
    flipMost: SLOPESTYLE.flipMost,
  };
}

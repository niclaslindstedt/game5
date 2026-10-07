// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AERIALS' NUMBERS — the contest (R41 builds its site; the format is
// `aerials-contest.ts`'s, the formal score `aerials-judge.ts`'s and the
// flight `aerial-flight.ts`'s), from `docs/freestyle.md` § *Aerials*.
// Stated beside `modes.ts`, which re-exports them, so the modes' file stays
// under its cap; it imports nothing from `modes.ts` but types, so the two
// load in either order.

import type { Jury, RunRules } from "./run-rules.ts";
import type { SkiId } from "./skis.ts";

/** THE AERIALS CONTEST'S NUMBERS. */
export const AERIALS = {
  /** The start list beside the player — a qualification of twenty-four —
   * and the phases after it: the best `final1` to FINAL 1, its best
   * `final2` to FINAL 2, one jump each, nothing carried over. */
  field: 23,
  final1: 12,
  final2: 6,
  /** The start official's count, s, and the START CLOCK after it: twenty
   * seconds to leave the start (red, then ten seconds of yellow, then
   * green, `docs/freestyle.md`). Past it the jumper has not started. */
  countdown: 3,
  window: 20,
  /** THE STROKES' CEILINGS on the flight (`aerial-flight.ts`): three
   * flips and six twists, the chart's most. */
  flipMost: 6 * Math.PI,
  spinMost: 12 * Math.PI,
  /** THE PAIR: the aerials ski — 150–160 cm, ~65 mm underfoot, little
   * sidecut (`docs/freestyle.md` § *Aerials*, "The skis"). */
  skis: "kestrel" as SkiId,
  /** THE JURY'S WEATHER (est.): the rules set no wind speed — the start
   * official sends each jumper "having regard to wind", off anemometers on
   * the in-run, the knoll and the finish. A jumper ten metres up and three
   * seconds in the air is moved by a gust as no racer is, and a head or a
   * tail wind moves his speed onto the knoll or past the hill, so the
   * jump is held in gusts under 30 km/h and no more than a steady fall
   * (the landing hill must be seen). */
  jury: { wind: 30 / 3.6, fall: 0.75 } as Jury,
  /** THE DEFAULT JUMP, the one the plan card opens on: a back lay-full,
   * a double. */
  plan: "bLF",
} as const;

/** AERIALS as a jumper is dealt them (R41): one jumper on the site, the
 * start official's count and the start clock, the strict gates (a fall a
 * DID NOT FINISH), the real g in flight, the in-run ridden straight and
 * tucked to the kicker (`in-run.ts`), and the air flown as twisting flips
 * (`aerial-flight.ts`) — no strokes, no grabs, no arcade score worked for.
 * The field is the contest's, dealt, never jumped. */
export function aerialsRules(laps: number): RunRules {
  return {
    rivals: 0,
    laps,
    countdown: AERIALS.countdown,
    contact: false,
    course: true,
    tricks: false,
    stunts: false,
    limit: 0,
    airGravity: 1,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    groomer: false,
    start: "line",
    gates: "strict",
    window: AERIALS.window,
    jury: AERIALS.jury,
    spinMost: AERIALS.spinMost,
    flipMost: AERIALS.flipMost,
    inRun: true,
    aerials: true,
    hockeyStop: true,
  };
}

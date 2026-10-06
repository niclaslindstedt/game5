// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RAIL JAM'S NUMBERS — the jam (R40 builds its set; the session and its
// dealt field are `jam.ts`'s, the features' ride `jib.ts`'s), from
// `docs/freestyle.md` § *Rail jam*. Stated beside `modes.ts`, which
// re-exports them, so the modes' file stays under its cap; it imports
// nothing from `modes.ts` but types, so the two load in either order.

import type { Jury, RunRules } from "./modes.ts";
import type { SkiId } from "./skis.ts";

/** THE RAIL JAM'S NUMBERS. */
export const RAIL_JAM = {
  /** The riders beside the player: a session of eight — the top street
   * contest's two heats of four, ridden here as one jam. */
  field: 7,
  /** THE JAM, s: the top contest's ten-minute heats (a resort's 30–60
   * minutes) cut to three — some fifteen hits on a set this short. */
  jam: 180,
  /** The starter's count, s. */
  countdown: 3,
  /** THE PAIR: the soft park twin-tip. A jib skier rides a soft,
   * centre-mounted twin-tip of ~164–180 cm on a 90–94 mm waist and a
   * 15–20 m sidecut, its edges thick and dulled (some built with none) —
   * the class the Hare is (`docs/freestyle.md` § *Rail jam*, "The
   * pair"). */
  skis: "hare" as SkiId,
  /** THE JURY'S WEATHER (est.): no rule is published; a rail is ridden at
   * a crawl next to a jump, and jams go ahead at night under the lights
   * and in a fall — held under 50 km/h of gust and no more than a steady
   * fall. */
  jury: { wind: 50 / 3.6, fall: 0.75 } as Jury,
} as const;

/** THE RAIL JAM as a skier is dealt it (R40): one rider on the set, the
 * starter's count, no course owed — a JAM of hits off the platform until
 * the buzzer, a fall only the end of its hit — the real g, the strokes
 * read (a spin onto a feature, a spin off it), and the features ridden.
 * The field is the jam's (`jam.ts`), dealt, never skied. */
export function railJamRules(laps: number): RunRules {
  return {
    rivals: 0,
    laps,
    countdown: RAIL_JAM.countdown,
    contact: false,
    course: false,
    tricks: true,
    stunts: true,
    limit: RAIL_JAM.jam,
    airGravity: 1,
    crowd: 0,
    lifts: false,
    heli: false,
    sled: false,
    start: "line",
    gates: "arcade",
    window: 0,
    jury: RAIL_JAM.jury,
    jam: true,
  };
}

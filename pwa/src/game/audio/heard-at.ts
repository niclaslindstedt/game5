// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A ONE-SHOT HEARD FROM THE EAR (`route.ts`'s): how loud, how dull and how
// smeared a sound made at a point reaches the listener, for every event
// the route scales by where it happened.

import type { PlayShape } from "@niclaslindstedt/oss-game-framework/audio/types";

import { heliHeard } from "./heli-voice.ts";

/** A sound made at the event's point as heard from the ear: the inverse of
 * the distance from `ref` m (and none nearer), the air taking its top off
 * (`heliHeard`'s brightness, as a pitch) and smearing it longer. Without
 * an ear it is heard where it happened. */
export function heardAt(
  at: { x: number; y: number; z: number },
  ear: { x: number; y: number; z: number } | undefined,
  ref: number,
  floor = 0,
): PlayShape {
  if (!ear) return { gain: 1, pitch: 1, stretch: 1 };
  const d = Math.hypot(at.x - ear.x, at.y - ear.y, at.z - ear.z);
  const air = heliHeard(d);
  return {
    gain: Math.max(floor, ref / Math.max(ref, d)),
    pitch: 0.75 + 0.25 * air.bright,
    stretch: 1 + 0.4 * (1 - air.bright),
  };
}

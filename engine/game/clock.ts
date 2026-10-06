// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUN'S PLACE FOR A RUN. Nothing in the simulation looks at the sun, but
// where it stands is a fact about the run, and it is stated here so
// everything that reads the sun — the sky, the snow's glitter, the shadows,
// the birds — reads the same one.
//
// THE SUN STANDS STILL. A run is ridden at the hour its map was dealt (R15)
// or a rider picked, from the green to the flag: the light a map is met in
// is the light it is raced in. The dark is the EVENING R19 deals some of the
// maps (R15's exception) — an hour round or after sunset, and the moon then
// the only light in the sky.

import {
  moonAt,
  sunAt,
  type MoonPlace,
  type SunPlace,
} from "@niclaslindstedt/oss-game-framework/core/solar";
import { declinationOf, type Level } from "../mapgen/index.ts";

/** THE WORLD'S HEADING OF A COMPASS BEARING on `level`: the generic pool's
 * sun and moon stand at compass bearings with +z north, and a map whose face
 * was turned to the sun (R15, `Level.sun.facing`) has its +z at that
 * bearing instead — so a bearing reads as a world heading less it. */
export function worldHeadingOf(level: Pick<Level, "sun">, bearing: number): number {
  return bearing - (level.sun.facing ?? 0);
}

/** Where the sun stands over a run on `level` — its azimuth a WORLD heading,
 * the face's bearing taken out (R15). */
export function sunAtRun(level: Pick<Level, "sun">): SunPlace {
  const at = sunAt(level.sun.hour, level.sun.latitude, declinationOf(level.sun.dayOfYear));
  return level.sun.facing ? { ...at, azimuth: worldHeadingOf(level, at.azimuth) } : at;
}

/** The moon's age on a map's day, days past new. The year is a fixed,
 * nominal one — the moon was new on the 19th of January of it — so a day of
 * the year is always the same phase and R15's two months of days carry two
 * whole lunations, a full moon and a dark night each. */
export function moonAgeOn(dayOfYear: number): number {
  return (dayOfYear - 19 + 30 * 29.530589) % 29.530589;
}

/** Where the moon stands over a run on `level`, and how much of it is lit —
 * its azimuth a WORLD heading, like the sun's. */
export function moonAtRun(level: Pick<Level, "sun">): MoonPlace {
  const d = level.sun.dayOfYear;
  const at = moonAt(level.sun.hour, level.sun.latitude, declinationOf(d), moonAgeOn(d));
  return level.sun.facing ? { ...at, azimuth: worldHeadingOf(level, at.azimuth) } : at;
}

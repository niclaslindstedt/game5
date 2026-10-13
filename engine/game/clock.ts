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
//
// THE SKY IS THE REAL ONE. The generator deals its day with a textbook
// cosine of the season (`declinationOf`, R15 — what a seed BUILDS, held by
// the digests); the sky a run is met under is reckoned for a real instant
// instead — the framework's `core/solar` ephemeris: the sun's declination
// and the equation of time off NOAA's series, the air's refraction lifting
// the sun's image, the moon off its real orbit and its real phase. A map's
// day of the year is a date in one nominal year (`SKY_YEAR`); its hour is
// local APPARENT SOLAR time (noon is the sun on the meridian, wherever the
// map is), and a real face's longitude dates the instant the stars are read
// at (`withPlace`); a generated map stands on the prime meridian.

import {
  SUNRISE,
  julianDayOfYear,
  moonOnDate,
  sunOnDate,
  sunWindowOnDate,
  universalHourOf,
  type DatedMoonPlace,
  type DatedSunPlace,
} from "@niclaslindstedt/oss-game-framework/core/solar";
import type { Level } from "../mapgen/index.ts";

/** THE YEAR A MAP'S DAY IS A DATE IN — one nominal year for every map, so
 * a day of the year is always the same sky: the same declination, the same
 * phase of the moon. A year of the moon's MAJOR STANDSTILL, when its path
 * swings furthest north and south — a winter's full moon rides highest. */
export const SKY_YEAR = 2026;

/** The Julian day at 0h UT of `level`'s date in the sky's year. */
export function skyDateOf(level: Pick<Level, "sun">): number {
  return julianDayOfYear(SKY_YEAR, level.sun.dayOfYear);
}

/** THE WORLD'S HEADING OF A COMPASS BEARING on `level`: the generic pool's
 * sun and moon stand at compass bearings with +z north, and a map whose face
 * was turned to the sun (R15, `Level.sun.facing`) has its +z at that
 * bearing instead — so a bearing reads as a world heading less it. */
export function worldHeadingOf(level: Pick<Level, "sun">, bearing: number): number {
  return bearing - (level.sun.facing ?? 0);
}

/** Where the sun stands over a run on `level` — its elevation the APPARENT
 * one (lifted by the air's refraction; `trueElevation` the geometric),
 * its azimuth a WORLD heading, the face's bearing taken out (R15). */
export function sunAtRun(level: Pick<Level, "sun">): DatedSunPlace {
  const { hour, latitude, longitude } = level.sun;
  const at = sunOnDate(hour, latitude, longitude ?? 0, skyDateOf(level));
  return level.sun.facing ? { ...at, azimuth: worldHeadingOf(level, at.azimuth) } : at;
}

/** THE HOURS OF `level`'s DAY the sun stands over `minElevation` (true,
 * radians), apparent solar hours: by default SUNRISE TO SUNSET as an
 * almanac states them (the upper limb on the horizon, the refraction
 * counted) — the whole clock under the midnight sun, null in the polar
 * night. A twilight's depth gives that twilight's window. */
export function sunWindowOf(
  level: Pick<Level, "sun">,
  minElevation: number = SUNRISE,
): { min: number; max: number } | null {
  const { latitude, longitude } = level.sun;
  return sunWindowOnDate(latitude, longitude ?? 0, skyDateOf(level), minElevation);
}

/** The moon's age on a map's day at solar noon on the prime meridian, days
 * past new — the sky year's real moon (`SKY_YEAR`). */
export function moonAgeOn(dayOfYear: number): number {
  return moonOnDate(12, 0, 0, julianDayOfYear(SKY_YEAR, dayOfYear)).age;
}

/** Where the moon stands over a run on `level`, how much of it is lit and
 * how old it is — off its real orbit on the map's date, its azimuth a WORLD
 * heading, like the sun's. */
export function moonAtRun(level: Pick<Level, "sun">): DatedMoonPlace {
  const { hour, latitude, longitude } = level.sun;
  const at = moonOnDate(hour, latitude, longitude ?? 0, skyDateOf(level));
  return level.sun.facing ? { ...at, azimuth: worldHeadingOf(level, at.azimuth) } : at;
}

/** THE CLOCK'S HOUR at apparent solar `hour` on `level`, 0..24 — what a
 * watch there reads: the equation of time taken off and the longitude's
 * distance from its time zone's meridian (the nearest fifteen degrees; no
 * summer time). A map with no longitude (every generated one) has no
 * zone, and its clock is the sun's. */
export function clockHourOf(level: Pick<Level, "sun">, hour: number): number {
  const lon = level.sun.longitude;
  if (lon === undefined) return hour;
  // The instant in UT (the longitude and the equation of time off the
  // solar hour), read on the zone's clock.
  const clock = universalHourOf(skyDateOf(level), hour, lon) + Math.round(lon / 15);
  return ((clock % 24) + 24) % 24;
}

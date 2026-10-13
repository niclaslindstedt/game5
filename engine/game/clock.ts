// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUN'S PLACE FOR A RUN. Nothing in the simulation looks at the sun, but
// where it stands is a fact about the run, and it is stated here so
// everything that reads the sun — the sky, the snow's glitter, the shadows,
// the birds — reads the same one.
//
// THE SUN MOVES WITH THE RUN'S OWN CLOCK. A run STARTS at the hour its map
// was dealt (R15) or a rider picked, and the sky's hour then runs on with
// `state.t` at `SKY_CLOCK.rate` — twelve times real time, so five minutes
// on the snow are an hour of the sun's: a long free ride sees the sun go
// down, the lamps come on and the stars come out (`skyHourAt`). The dark
// is the EVENING R19 deals some of the maps (R15's exception) — an hour
// round or after sunset, and the moon then the only light in the sky.
//
// THE MOVING HOUR IS PRESENTATION. Nothing the physics reads takes `t`:
// with `t` left out, `sunAtRun` and `moonAtRun` are the sun and the moon at
// the map's START hour, and every decision a run deals when it is created
// off them — the night crowd (`nightOver`), the piste machines
// (`groomersOut`), the snow guns (`snowGunsOut`), the piste's day
// (`pisteDayOf`), the generator's R15 and R19 — stays as dealt for the
// whole run, so no digest moves. The sky, the light, the stars, the birds,
// the sound and the people on foot read the moving hour; the app owns the
// rate (`?skyclock=`, 0 holding the sun still for a lab or a link) and a
// replay, re-skiing `state.t`, is met under the same sky.
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

/** THE SKY'S CLOCK: how many seconds of the sun's day pass in one second
 * of the run — five real minutes an hour of sun. Not engine state: the app
 * hands its own rate to every reader (0 holds the sun at the start hour). */
export const SKY_CLOCK = { rate: 12 } as const;

/** THE SKY'S HOUR at run time `t`, s, on `level`: the start hour run on at
 * `rate` (apparent solar hours; past 24 it is the next day's, which the
 * ephemeris reads as such). */
export function skyHourAt(level: Pick<Level, "sun">, t = 0, rate: number = SKY_CLOCK.rate): number {
  return level.sun.hour + (t * rate) / 3600;
}

/** `level` with its hour run on to run time `t` at `rate` — the map as
 * the sky stands over it at that moment (itself when the hour stands). */
export function skyLevelAt<L extends Pick<Level, "sun">>(level: L, t = 0, rate?: number): L {
  const hour = skyHourAt(level, t, rate);
  return hour === level.sun.hour ? level : { ...level, sun: { ...level.sun, hour } };
}

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
 * its azimuth a WORLD heading, the face's bearing taken out (R15). At the
 * START hour when `t` is left out (what every create-time decision reads);
 * at run time `t` on the sky's clock (`skyHourAt`) for the picture. */
export function sunAtRun(level: Pick<Level, "sun">, t?: number, rate?: number): DatedSunPlace {
  const { latitude, longitude } = level.sun;
  const hour = t === undefined ? level.sun.hour : skyHourAt(level, t, rate);
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
 * heading, like the sun's; at the start hour, or at run time `t` on the
 * sky's clock, as `sunAtRun`. */
export function moonAtRun(level: Pick<Level, "sun">, t?: number, rate?: number): DatedMoonPlace {
  const { latitude, longitude } = level.sun;
  const hour = t === undefined ? level.sun.hour : skyHourAt(level, t, rate);
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

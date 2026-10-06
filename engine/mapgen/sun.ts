// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R15 — THE DAY THE RUN IS SKIED ON: a latitude, a winter's day and a
// solar hour at which the sun is well up in a clear sky.
//
// The sun's arithmetic is the generic pool's (the framework's `core/solar`); what is this
// game's is only which day and which hours count. The declination is the
// textbook cosine of the day of the year, so a February map at 62°N is
// dealt the low, long-shadowed sun it would really have — and a draw whose
// latitude and day leave no hour of the band with the sun over the floor is
// simply drawn again.

import { angleDiff } from "@niclaslindstedt/oss-game-framework/core/math";
import { daylightWindow, sunAt } from "@niclaslindstedt/oss-game-framework/core/solar";
import { createRng, type Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { LEVEL_RULES as R, inBand, type Band } from "./rules.ts";

/** The sun's declination on a day of the year, degrees. */
export function declinationOf(dayOfYear: number): number {
  return -23.44 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365);
}

/** The hours of the rule's band in which the sun stands over its floor on
 * that day at that latitude, or null when there are none. */
export function sunWindow(
  latitude: number,
  dayOfYear: number,
): { min: number; max: number } | null {
  const w = daylightWindow(
    latitude,
    (R.sun.minElevation * Math.PI) / 180,
    declinationOf(dayOfYear),
  );
  if (!w) return null;
  const min = Math.max(w.min, R.sun.hour.min);
  const max = Math.min(w.max, R.sun.hour.max);
  return max > min ? { min, max } : null;
}

/** R15 — deal the day, from the region's latitudes and days (R21; the
 * rule's own — the alpine's — bands when none is given). */
export function dealSun(
  rng: Rng,
  bands: { latitude: Band; dayOfYear: Band } = R.sun,
): { hour: number; dayOfYear: number; latitude: number } {
  for (let i = 0; i < 64; i++) {
    const latitude = inBand(rng, bands.latitude);
    const dayOfYear = Math.round(inBand(rng, bands.dayOfYear));
    const w = sunWindow(latitude, dayOfYear);
    if (!w) continue;
    return { latitude, dayOfYear, hour: rng.range(w.min, w.max) };
  }
  // The band's own southern edge in its latest week always has a noon.
  return { latitude: bands.latitude.min, dayOfYear: bands.dayOfYear.max, hour: 12 };
}

/** Salt on the attempt's sub-seed for the face's bearing's own stream. */
const FACING_SALT = 0x5a1f0ce;

/** R15 — THE FACE TURNED TO THE SUN: the compass bearing the fall line is
 * given (`Level.sun.facing`), within `sun.facing` of the sun's own bearing
 * at the hour the run starts, off a stream of its own. The mountain shades
 * itself — a face turned from a low winter sun is skied in its own shadow
 * — so the face a piste runs down is turned to the light, and a skier goes
 * down it toward the sun and across it. */
export function faceTheSun(
  sub: number,
  sun: { hour: number; dayOfYear: number; latitude: number },
): number {
  const rng = createRng((sub ^ FACING_SALT) >>> 0);
  const at = sunAt(sun.hour, sun.latitude, declinationOf(sun.dayOfYear));
  return compass(at.azimuth + rng.range(-R.sun.facing, R.sun.facing));
}

/** A bearing on [0, 2π). */
function compass(heading: number): number {
  const t = heading % (2 * Math.PI);
  return t < 0 ? t + 2 * Math.PI : t;
}

/** How far off the face's own bearing the sun stands at the run's hour,
 * radians — 0 where the skier skis straight at it (R15). */
export function sunOffFace(sun: {
  hour: number;
  dayOfYear: number;
  latitude: number;
  facing?: number;
}): number {
  const at = sunAt(sun.hour, sun.latitude, declinationOf(sun.dayOfYear));
  return Math.abs(angleDiff(sun.facing ?? 0, at.azimuth));
}

/** THE HOURS A FREE RIDE MAY START AT on a day at a latitude: every hour the
 * sun stands over R15's floor, not only the rule's band — a skier choosing
 * the day may ski the long low light of an early morning the generator
 * never deals. Null when the sun never clears the floor at all. */
export function freeHours(
  latitude: number,
  dayOfYear: number,
): { min: number; max: number } | null {
  return daylightWindow(latitude, (R.sun.minElevation * Math.PI) / 180, declinationOf(dayOfYear));
}

/** A day of the year on 1..365, from any whole count of days off Jan 1 —
 * so a winter that starts in December (day −30) is still a date. */
export function dayOfYearOf(day: number): number {
  const d = Math.round(day - 1) % 365;
  return (d < 0 ? d + 365 : d) + 1;
}

/** THE TIMES OF DAY A FREE RIDE IS ASKED FOR IN — words, not hours, because
 * the hour a word means moves with the date and the latitude: a February
 * morning at 68°N is noon's neighbour, one in April is hours before it. */
export type TimeOfDay = "morning" | "day" | "evening" | "night";

export const TIMES_OF_DAY: readonly TimeOfDay[] = ["morning", "day", "evening", "night"];

/** How far into the night NIGHT is, h after sunset — deep enough that the
 * sky has gone to the moon and the stars, inside R19's evening band. */
const NIGHT_AFTER_SUNSET = 2.5;

/** THE SOLAR HOUR A TIME OF DAY MEANS on a day at a latitude: MORNING a fifth
 * of the way into the sun's hours over R15's floor, DAY the middle of them,
 * EVENING the low sun near their end, NIGHT a while after sunset. A day the
 * sun never clears the floor on puts every lit word at noon. */
export function hourOfTime(latitude: number, dayOfYear: number, time: TimeOfDay): number {
  const doy = dayOfYearOf(dayOfYear);
  if (time === "night") {
    const set = daylightWindow(latitude, 0, declinationOf(doy));
    return (set ? set.max : 12) + NIGHT_AFTER_SUNSET;
  }
  const w = freeHours(latitude, doy);
  if (!w) return 12;
  const at = time === "morning" ? 0.2 : time === "day" ? 0.5 : 0.88;
  return w.min + (w.max - w.min) * at;
}

/** THE SAME MAP ON ANOTHER DAY: a copy of `level` with its sun moved to the
 * hour and the day asked for — whichever of them is given — and everything
 * else the very objects the seed built. A free ride asks for its own day;
 * the mountain, the piste and the woods are the seed's and are never rebuilt
 * for it. The hour is held inside the day's daylight (`freeHours`); a named
 * `time` (`hourOfTime`) wins over `hour` and is not. */
export function withDay<L extends { sun: { hour: number; dayOfYear: number; latitude: number } }>(
  level: L,
  day: { hour?: number | null; dayOfYear?: number | null; time?: TimeOfDay | null },
): L {
  const dayOfYear =
    day.dayOfYear === undefined || day.dayOfYear === null
      ? level.sun.dayOfYear
      : dayOfYearOf(day.dayOfYear);
  let hour = day.hour === undefined || day.hour === null ? level.sun.hour : day.hour;
  if (day.time) {
    // A named time is its own answer, and NIGHT is past the daylight on
    // purpose — the one way a free skier stands the map in the dark.
    hour = hourOfTime(level.sun.latitude, dayOfYear, day.time);
  } else {
    const w = freeHours(level.sun.latitude, dayOfYear);
    if (w) hour = Math.min(w.max, Math.max(w.min, hour));
  }
  if (hour === level.sun.hour && dayOfYear === level.sun.dayOfYear) return level;
  return { ...level, sun: { ...level.sun, hour, dayOfYear } };
}

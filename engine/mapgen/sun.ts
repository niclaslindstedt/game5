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
export type TimeOfDay = "morning" | "day" | "evening" | "sunset" | "night";

export const TIMES_OF_DAY: readonly TimeOfDay[] = ["morning", "day", "evening", "sunset", "night"];

/** How high SUNSET stands the sun, degrees: low enough to turn the light
 * gold and the clouds red, still over the horizon — under R15's floor on
 * purpose, as NIGHT is past it. */
const SUNSET_ELEVATION = 2;

/** How far into the night NIGHT is, h after sunset — deep enough that the
 * sky has gone to the moon and the stars, inside R19's evening band. */
const NIGHT_AFTER_SUNSET = 2.5;

/** THE SOLAR HOUR A TIME OF DAY MEANS on a day at a latitude: MORNING a fifth
 * of the way into the sun's hours over R15's floor, DAY the middle of them,
 * EVENING the low sun near their end, SUNSET the sun on the horizon, NIGHT
 * a while after sunset. A day the
 * sun never clears the floor on puts every lit word at noon. */
export function hourOfTime(latitude: number, dayOfYear: number, time: TimeOfDay): number {
  const doy = dayOfYearOf(dayOfYear);
  if (time === "night") {
    const set = daylightWindow(latitude, 0, declinationOf(doy));
    // Under the MIDNIGHT SUN (a sun that never sets) and in the POLAR NIGHT
    // (one that never rises) there is no sunset to count from: NIGHT is
    // midnight, the lowest the sun goes.
    if (!set || set.max >= 24) return 24;
    return set.max + NIGHT_AFTER_SUNSET;
  }
  if (time === "sunset") {
    const low = daylightWindow(latitude, (SUNSET_ELEVATION * Math.PI) / 180, declinationOf(doy));
    // A sun that never sinks that low sets nowhere: its lowest, at midnight;
    // one that never climbs that high, its highest, at noon.
    if (!low) return 12;
    return low.max >= 24 ? 24 : low.max;
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

/** HALF A YEAR, days: a season's day in the other hemisphere. */
const HALF_YEAR = 182;

/** THE DAY OF A SEASON at `latitude`: a season named by its northern day
 * (`day`, a count off 1 January) is half a year on south of the equator,
 * where deep winter is July. */
export function seasonDay(day: number, latitude: number): number {
  return latitude < 0 ? day + HALF_YEAR : day;
}

/** Where a map stands on the globe: latitude and longitude (°) and the
 * compass bearing its fall line runs to (°, clockwise from north). */
export type GlobePlace = { lat: number; lon: number; bearing: number };

/** THE SAME MAP AT ITS REAL PLACE: a copy of `level` stood at `place` — a
 * real face's latitude and longitude, and its true north as the face's
 * bearing (`facing`) — and nothing else rebuilt. The generator deals a real
 * face's day off its region's bands like any map's (what a seed BUILDS
 * stays the digests'); a run is then created at the face's own place.
 * Moved across the equator, the day moves half a year with it
 * (`seasonDay`), so a map dealt a February is skied in the southern
 * August; and the hour keeps its place in the day — the same share of the
 * way from sunrise to sunset, or the same time after sunset on an evening
 * map. Null leaves the map where it is; a map already there is returned. */
export function withPlace<
  L extends {
    sun: { hour: number; dayOfYear: number; latitude: number; facing?: number; longitude?: number };
  },
>(level: L, place: GlobePlace | null): L {
  if (!place) return level;
  // The same map at the same place is the same object: everything a run
  // memoizes off its map (the hashes, the solids, the village) is kept
  // across every run created on it.
  const key = `${place.lat},${place.lon},${place.bearing}`;
  const kept = PLACED.get(level)?.get(key);
  if (kept) return kept as L;
  const placed = placeAt(level, place);
  let byPlace = PLACED.get(level);
  if (!byPlace) PLACED.set(level, (byPlace = new Map()));
  byPlace.set(key, placed);
  return placed;
}

/** Every map stood at a place, by the map and the place (`withPlace`). */
const PLACED = new WeakMap<object, Map<string, object>>();

function placeAt<
  L extends {
    sun: { hour: number; dayOfYear: number; latitude: number; facing?: number; longitude?: number };
  },
>(level: L, place: GlobePlace): L {
  const facing = compass((place.bearing * Math.PI) / 180);
  const sun = level.sun;
  if (sun.latitude === place.lat && sun.longitude === place.lon && sun.facing === facing) {
    return level;
  }
  const crossed = sun.latitude >= 0 !== place.lat >= 0;
  const dayOfYear = crossed ? dayOfYearOf(sun.dayOfYear + HALF_YEAR) : sun.dayOfYear;
  const was = daylightWindow(sun.latitude, 0, declinationOf(sun.dayOfYear));
  const now = daylightWindow(place.lat, 0, declinationOf(dayOfYear));
  let hour = sun.hour;
  if (was && now && was.max < 24 && now.max < 24) {
    if (hour >= was.min && hour <= was.max) {
      const share = (hour - was.min) / Math.max(1e-6, was.max - was.min);
      hour = now.min + share * (now.max - now.min);
    } else if (hour > was.max) {
      hour = now.max + (hour - was.max);
    } else {
      hour = now.min - (was.min - hour);
    }
  }
  return {
    ...level,
    sun: { ...sun, latitude: place.lat, longitude: place.lon, facing, dayOfYear, hour },
  };
}

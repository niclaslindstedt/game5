// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREE RIDE AS THE APP ASKS FOR ONE — what the start card writes
// (`Settings.ride`), how a stored blob of it is read back, what the rows'
// figures read as, and the one place those answers become the options a
// run is stood up with (`freeGameOptions`). DOM-free, so the suite reads all
// of it (`tests/free_ride_card_test.ts`).
//
// THE ROWS ASK IN WORDS, NOT FIGURES. Nobody picks the 43rd day of the year or
// 10:45 solar time; they pick MIDWINTER and MORNING, and a depth of snow by
// what it is like to ride. So the day is a SEASON, the hour a TIME OF DAY
// (the engine's `hourOfTime` says which hour that is on the map's own date
// and latitude, NIGHT included) and the snow one of four depths.
//
// THE DAY'S TWO ROWS DEFER TO THE MAP UNTIL THEY ARE MOVED. A generated map
// is a whole day, and a card that arrived with an opinion about it would
// quietly take that away from every skier who never touched it. So both
// store NULL until moved, and null is the seed's own answer (AS DEALT).
//
// THE SPOT BELONGS TO ITS SEED. A place picked on one map's chart is a
// meaningless coordinate on the next, so it is kept with the seed it was
// picked on and read only while that is still the seed on the card.

import {
  DEFAULT_REGION,
  TIMES_OF_DAY,
  isPisteGrade,
  isRegionId,
  snowCoverOf,
  type PisteGrade,
  type RegionId,
  type TimeOfDay,
  type WeatherKind,
  WEATHER_KINDS,
  type Assist,
  type CreateGameOptions,
  type Level,
  type SkiSpec,
} from "@engine";

/** THE SEASON ROW'S STOPS, each a day as a count off Jan 1 (so December
 * runs through New Year without a seam; the engine folds it, `dayOfYearOf`):
 * the whole winter a mountain like this one holds snow, where R15 deals only
 * mid-January to mid-March. */
export const SEASONS = [
  { id: "early", day: -16 }, // 15 Dec: the lowest sun, the shortest day
  { id: "mid", day: 20 }, // 20 Jan
  { id: "late", day: 56 }, // 25 Feb
  { id: "spring", day: 91 }, // 1 Apr: a high sun and long days
] as const;

export type SeasonId = (typeof SEASONS)[number]["id"];

/** THE SNOW ROW'S STOPS, by how deep the loose snow lies, cm (`snowCoverOf`).
 * MEDIUM is the snow every race is ridden on; DEEP is a metre of fresh snow,
 * a northern forest's by March, where the powder is bottomless — a skis
 * that stops sinks to its belly, only speed keeps it on top and the skier's
 * weight keeps it upright (`snow.ts`). */
export const SNOW_STOPS = [
  { id: "thin", cm: 20 },
  { id: "medium", cm: 40 },
  { id: "thick", cm: 70 },
  { id: "deep", cm: 100 },
] as const;

export type SnowId = (typeof SNOW_STOPS)[number]["id"];

/** The snow dial (`SNOW_DIAL`) a stop asks for: its depth over the
 * ordinary snow's. */
export function depthOf(snow: SnowId): number {
  const stop = SNOW_STOPS.find((s) => s.id === snow) ?? SNOW_STOPS[1];
  return stop.cm / 100 / snowCoverOf(1);
}

/** What the start card writes. */
export type FreeRide = {
  /** The map; null is the one the front door is standing over. */
  seed: number | null;
  /** The season ({@link SEASONS}); null is the map's own date. */
  season: SeasonId | null;
  /** The time of day (`hourOfTime`); null is the map's own hour. */
  time: TimeOfDay | null;
  /** How deep the powder is ({@link SNOW_STOPS}). */
  snow: SnowId;
  /** Where on the chart the ride starts, on the seed it was picked on; null
   * is the start line. */
  spot: { seed: number; x: number; z: number } | null;
  /** The sky to ride under (R19's kinds, at their typical numbers —
   * `weatherFor`); null is the one the map was dealt. */
  weather: WeatherKind | null;
  /** The kind of snow country the map is built in (R21). */
  region: RegionId;
  /** The piste grade the map is built to (R23); null is the one the seed
   * deals. */
  grade: PisteGrade | null;
};

export function freshRide(): FreeRide {
  return {
    seed: null,
    season: null,
    time: null,
    snow: "medium",
    spot: null,
    weather: null,
    region: DEFAULT_REGION,
    grade: null,
  };
}

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const isSeason = (v: unknown): v is SeasonId => SEASONS.some((s) => s.id === v);
const isSnow = (v: unknown): v is SnowId => SNOW_STOPS.some((s) => s.id === v);

/** A stored blob — anything at all — made into a ride this build offers,
 * every field checked on its own. A blob from the build with faders (a
 * `depth` multiple, a `day`, an `hour`) keeps its snow on the nearest stop
 * and hands the day back to the map. */
export function mergeRide(blob: unknown): FreeRide {
  const out = freshRide();
  if (!blob || typeof blob !== "object") return out;
  const b = blob as Record<string, unknown>;
  if (isNumber(b.seed) && Number.isInteger(b.seed) && b.seed >= 1 && b.seed <= 0xffffffff) {
    out.seed = b.seed;
  }
  if (isSeason(b.season)) out.season = b.season;
  if (TIMES_OF_DAY.includes(b.time as TimeOfDay)) out.time = b.time as TimeOfDay;
  if (isSnow(b.snow)) out.snow = b.snow;
  else if (isNumber(b.depth)) {
    const cm = snowCoverOf(b.depth) * 100;
    out.snow = SNOW_STOPS.reduce((best, s) =>
      Math.abs(s.cm - cm) < Math.abs(best.cm - cm) ? s : best,
    ).id;
  }
  if (typeof b.weather === "string" && WEATHER_KINDS.includes(b.weather as WeatherKind)) {
    out.weather = b.weather as WeatherKind;
  }
  if (isRegionId(b.region)) out.region = b.region;
  if (isPisteGrade(b.grade)) out.grade = b.grade;
  const spot = b.spot as Record<string, unknown> | null | undefined;
  if (
    spot &&
    typeof spot === "object" &&
    isNumber(spot.seed) &&
    isNumber(spot.x) &&
    isNumber(spot.z)
  ) {
    out.spot = { seed: spot.seed, x: spot.x, z: spot.z };
  }
  return out;
}

/** The spot to start at on `seed`, or null for the start line. */
export function spotOn(ride: FreeRide, seed: number): { x: number; z: number } | null {
  return ride.spot !== null && ride.spot.seed === seed ? { x: ride.spot.x, z: ride.spot.z } : null;
}

/** THE RUN A FREE RIDE IS STOOD UP AS, on `seed`, for the skier on `spec`
 * with `assist` — everything but the map itself, which the caller either
 * hands over already built or leaves to the seed. */
export function freeGameOptions(
  ride: FreeRide,
  seed: number,
  spec: SkiSpec,
  assist: Assist,
): CreateGameOptions {
  return {
    seed,
    spec,
    assist,
    mode: "free",
    region: ride.region,
    grade: ride.grade ?? undefined,
    snowDepth: depthOf(ride.snow),
    // ONE PATH FOR THE HOUR: the TIME row's word goes through `day`
    // (`withDay`, which reads it on the map's own latitude and the season's
    // date); the WEATHER row names only the sky, never an hour, so the two
    // cannot disagree.
    day: {
      time: ride.time,
      dayOfYear: SEASONS.find((s) => s.id === ride.season)?.day ?? null,
    },
    sky: ride.weather === null ? undefined : { weather: ride.weather },
    spawn: spotOn(ride, seed) ?? undefined,
    // ONTO THE MOUNTAIN BY CHAIR (`lift-ride.ts`): up the lift whose run
    // passes nearest the spot, and led off its top onto that run.
    byLift: true,
  };
}

/** THE FREE RIDE STARTED AGAIN (the pause card's restart): the options it
 * was stood up with, on the map `level` it built. The day and the sky are
 * already in that map, so they are dropped rather than laid on again —
 * `withSky` makes a new map of any map it is handed, and a new map is one
 * the renderer has not built, which it would never draw. */
export function freeAgainOptions(options: CreateGameOptions, level: Level): CreateGameOptions {
  return { ...options, level, day: undefined, sky: undefined };
}

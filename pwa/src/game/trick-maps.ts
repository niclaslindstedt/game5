// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRICK MAPS — the six maps a TRICKS run is ridden on, picked on the
// trick map card (`menu-tricks.tsx`) the front door's TRICKS tile opens.
//
// Each is a SEED built with its trick field (R20) — the seed's own country
// and loop, with the field's graded kickers and their landing slopes on it —
// ridden on a DAY of its own: a date (the SEASON: the short low days of
// December, the long bright ones of late winter, the soft snow of April), an
// hour (the LIGHT: a morning, a midday, a low sun, the night) and a SKY (the
// WEATHER). None of the three moves anything the generator builds, so a map
// is the same ground whatever day it is ridden on, and the six were chosen
// for the fields their seeds carry — every one with the three sizes on it
// and at least three of the high lips — out of a sweep of the first seventy.
//
// LIKE A RACE MAP, each names the generator that built it and carries
// the DIGEST of the map that came out (`levelDigest`), written out on every
// map on purpose, and `tests/trick_maps_test.ts` rebuilds all six and holds
// them to it: a rule moving under one is a red suite, not a silent re-roll.
// Their loops are drawn on the card from `map-routes.ts` (`make
// routes`), as a race map box's is.
//
// A MAP IS NAMED FOR WHAT IT IS LIKE, never for where it is.
//
// DOM-free and storage-free: the card, the app, the routes script and the
// suite read one statement of it — the words its box and the front door's
// tile read it in too.

import {
  TRICKS_RUN,
  generateLevel,
  type Assist,
  type CreateGameOptions,
  type GeneratorVersion,
  type Level,
  type SkyOverride,
  type SkiSpec,
  type WeatherKind,
} from "@engine";

import { STRINGS } from "./strings.ts";

export type TrickMap = {
  id: string;
  name: string;
  /** One line of billing on the map's box. */
  blurb: string;
  seed: number;
  /** WHICH GENERATOR built this map (`mapgen/versions.ts`). */
  version: GeneratorVersion;
  /** The fingerprint of the map, as `levelDigest` reads it. */
  digest: string;
  /** THE DAY it is ridden on: the date (day of the year, 1–365), the solar
   * hour the run starts at, and the sky — the hour laid on through the sky
   * where it is past the daylight (the night), since the day's own hour is
   * held inside it (`withDay`). */
  day: { dayOfYear: number; hour: number; weather: WeatherKind };
};

/** THE SIX, in the order the card shows them — the brightest first. */
export const TRICK_MAPS: readonly TrickMap[] = [
  {
    id: "tricks-1",
    name: "Bluebird",
    blurb: "A clear late-winter noon and a park down a black piste",
    seed: 73,
    version: 1,
    digest: "89ee01af",
    day: { dayOfYear: 55, hour: 12.5, weather: "clear" },
  },
  {
    id: "tricks-2",
    name: "First Snow",
    blurb: "A January morning, flurries out of a sunny sky",
    seed: 6,
    version: 1,
    digest: "dbbb340c",
    day: { dayOfYear: 20, hour: 10, weather: "flurries" },
  },
  {
    id: "tricks-3",
    name: "Spring Corn",
    blurb: "April afternoon: soft snow and long light",
    seed: 83,
    version: 1,
    digest: "b05229f4",
    day: { dayOfYear: 105, hour: 14.5, weather: "fair" },
  },
  {
    id: "tricks-4",
    name: "Low Sun",
    blurb: "December, and a sun that never climbs out of the trees",
    seed: 14,
    version: 1,
    digest: "4d9e81ad",
    day: { dayOfYear: 355, hour: 13.5, weather: "high" },
  },
  {
    id: "tricks-5",
    name: "Snow Day",
    blurb: "Snowing all day, and the fresh snow deepening under the lips",
    seed: 9,
    version: 1,
    digest: "a8c1c174",
    day: { dayOfYear: 40, hour: 12, weather: "snow" },
  },
  {
    id: "tricks-6",
    name: "Night Session",
    blurb: "A March night under the stars, on the lamp alone",
    seed: 10,
    version: 1,
    digest: "76309e29",
    day: { dayOfYear: 75, hour: 20, weather: "clear" },
  },
];

/** The trick map named by an id, or the first where the id is no map (a
 * fresh app, or a stale stored id). */
export function trickMapFor(id: string | null): TrickMap {
  return TRICK_MAPS.find((map) => map.id === id) ?? TRICK_MAPS[0];
}

/** Whether an id names a trick map — what a stored setting is held to. */
export function isTrickMap(id: unknown): id is string {
  return typeof id === "string" && TRICK_MAPS.some((map) => map.id === id);
}

/** The ground a trick map is: its seed on its generator, with the field. */
export function buildTrickMap(map: TrickMap): Level {
  return generateLevel(map.seed, { tricks: true, version: map.version });
}

/** The sky a trick map is ridden under: its weather, and its hour where the
 * day's own could not reach it (past the daylight). */
export function trickSky(map: TrickMap): SkyOverride {
  return { weather: map.day.weather, hour: map.day.hour };
}

/** Who rides a trick map, and with what: the machine, the help, whether
 * blows bend it, and his poles (with them when left out). */
export type TrickSkier = {
  spec: SkiSpec;
  assist: Assist;
  damage: boolean;
  poles?: boolean;
  gore?: boolean;
};

/** A TRICKS RUN ON A TRICK MAP, as `createGame` takes it: the map (built, or
 * the one already standing), on its date, at its hour, under its sky, on the
 * skier's machine. */
export function trickGameOptions(
  map: TrickMap,
  skier: TrickSkier,
  built?: Level,
): CreateGameOptions {
  return {
    level: built ?? buildTrickMap(map),
    seed: map.seed,
    mode: "tricks",
    day: { dayOfYear: map.day.dayOfYear },
    sky: trickSky(map),
    spec: skier.spec,
    assist: skier.assist,
    damage: skier.damage,
    ...(skier.gore ? { gore: true } : {}),
    poles: skier.poles,
  };
}

/** THE FRONT DOOR'S TRICKS TILE: the map it rides — the card's, or the
 * seed a link pinned — and how long the run lasts, s. */
export function tricksTile(
  chosen: string | null,
  linkSeed: number | null,
): { map: string; seconds: number } {
  return {
    map: linkSeed === null ? trickMapFor(chosen).name : STRINGS.menuTricksSeed(linkSeed),
    seconds: TRICKS_RUN.limit,
  };
}

/** The day a trick map is ridden on, on one line under its name. */
export function trickDayLine(map: TrickMap): string {
  const sky = STRINGS.mapSky[map.day.weather] ?? map.day.weather.toUpperCase();
  return STRINGS.tricksDay(sky, map.day.hour, map.day.dayOfYear);
}

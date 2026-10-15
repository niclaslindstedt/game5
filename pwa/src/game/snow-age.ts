// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW OLD THE SNOW IS — the loose snow off the groomer as the PICTURE reads
// it, a run at a time. Snow changes from the hour it lands: a field of new
// snow is the whitest thing on a mountain, smooth and sugar-fine, glittering
// in a dust of tiny points; a few days on it has settled and the wind has
// worked it; a week on it is a shade greyer, coarse-grained (fewer, bigger
// glints), carved into ripples where it is exposed, glazed into a SUN CRUST
// on the faces the noon sun stands on, and — after clear, cold nights —
// furred on the shaded snow with SURFACE HOAR, feathers of ice a centimetre
// or two across that flash like sequins. Under a spring sun it goes WET:
// greyer still, glossy, dimpled into sun cups, and nearly done glittering.
//
// The numbers it stands on, from the snow-science literature, in our words:
//   * albedo (the share of sunlight a snow returns): new dry snow 0.80–0.95,
//     a week-old settled snow 0.70–0.80, old melting snow 0.45–0.60 — the
//     fall is fastest in the first days and faster when it is warm;
//   * new snow's crystals settle and round within a day or three, and the
//     grains coarsen from about a tenth of a millimetre to a millimetre or
//     more over a week or two — the glitter goes from a fine dust of points
//     to a sparse scatter of larger flashes;
//   * the wind packs exposed snow into a firmer, smoother slab within hours
//     of a breeze over about 5 m/s, and leaves ripples across its way;
//   * a sun crust is a melt-and-freeze glaze on the faces the sun warms,
//     and needs a sun high enough to melt the top — late winter and spring;
//   * surface hoar grows on clear, calm, cold nights on shaded, sheltered
//     snow, and is ruined by the sun and the wind;
//   * snow goes WET (free water in it) once its surface reaches 0 °C: air
//     over the melting point wets it under a lid as much as under the sun,
//     a strong spring sun wets the sunny snow down to a few degrees below
//     zero, and in air colder than about −8 °C even a high sun leaves it
//     dry; snow falling through air over zero lands heavy and wet.
//
// PRESENTATION ONLY: dealt off the map's seed on a salt of its own (never
// the engine's stream, never a field the physics reads), so no digest moves;
// what the snow DOES to the skis is `engine/game/snow.ts`'s, what it throws
// and keeps is `snowpack.ts`'s. Three-free and DOM-free, so the suite reads
// it (`tests/snow_age_test.ts`); `snow-glsl.ts` draws it off `uSnowAge` and
// `uSnowAge2` (`haze.ts`'s `setRunSnow`).

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";

import {
  airTempAt,
  slopeAltitudeOf,
  sunAtRun,
  weatherOf,
  type TempLevel,
  type Level,
  type Weather,
} from "@engine";

/** The surface's ages a lab forces, each a picture of its own. */
export type SnowAgeKind = "fresh" | "settled" | "old" | "wind" | "crust" | "hoar" | "wet";

export const SNOW_AGE_KINDS: readonly SnowAgeKind[] = [
  "fresh",
  "settled",
  "old",
  "wind",
  "crust",
  "hoar",
  "wet",
];

export function isSnowAgeKind(value: unknown): value is SnowAgeKind {
  return typeof value === "string" && (SNOW_AGE_KINDS as readonly string[]).includes(value);
}

/** THE SURFACE OF THE LOOSE SNOW over one run. Every figure 0..1 but
 * `days` and `noon`. */
export type SnowAge = {
  /** Days since the last fall. */
  days: number;
  /** How NEW the snow still looks: whiter, smoother, the finest glitter. */
  fresh: number;
  /** How OLD it looks: greyer, coarser grains, the wind's and sun's work. */
  old: number;
  /** How packed and rippled the wind has left exposed snow. */
  wind: number;
  /** The sun crust's glaze on the faces turned to the noon sun. */
  crust: number;
  /** Surface hoar on the shaded, sheltered snow. */
  hoar: number;
  /** How wet the thaw has made it: grey, glossy, sun-cupped. */
  wet: number;
  /** The world direction toward the noon sun, level (unit x, z): which
   * faces a crust glazes and which stay in the shade. */
  noon: { x: number; z: number };
};

/** How fast the new look goes and the old comes, days. */
export const AGEING = { fresh: 1.4, old: 4.5 } as const;

/** The days since the last fall a sky deals: none under a falling sky,
 * a few under a lid, anything up to a fortnight in the sun — a powder day
 * after a storm a quarter of the time. */
export const DAYS = {
  lid: { min: 0.5, max: 5 },
  powder: { share: 0.25, min: 0.4, max: 1.5 },
  sunny: { min: 2, max: 16 },
} as const;

/** The wind at 10 m over which exposed snow is packed and rippled, m/s. */
export const PACKING_WIND = { from: 3, full: 11 } as const;

/** The noon sun's elevation (rad) over which a sunny face grows a crust. */
export const CRUST_SUN = { from: (14 * Math.PI) / 180, full: (34 * Math.PI) / 180 } as const;

/** The sun's elevation (rad) over which spring snow starts to go wet, and
 * where it is wet through (`snowpack.ts` reads it for what is thrown). */
export const THAW = { from: (20 * Math.PI) / 180, full: (32 * Math.PI) / 180 } as const;

/** The run's sun elevation (rad) over which the loose snow's SURFACE is
 * drawn wet — higher than `THAW`'s, which wets the spray a skier throws
 * from under it: a winter's noon sun softens the top without glazing a
 * whole field grey. */
export const WET_SUN = { from: (30 * Math.PI) / 180, full: (45 * Math.PI) / 180 } as const;

/** THE AIR (°C) the snow is wet in: wet through in air at `full` and
 * over, none of it in air at `from` and under, whatever the sun. */
export const WET_AIR = { from: -0.5, full: 2.5 } as const;

/** THE AIR (°C) the SUN can wet snow in: in full at `from` and warmer,
 * not at all at `cold` and colder. */
export const SUN_WETS = { cold: -8, from: -2 } as const;

/** How wet the snow is in air at `air` °C with the sun's own share `sun`
 * (0..1, the thaw its elevation and the sky give it) — `air` undefined
 * leaves the sun's share alone. */
export function wetIn(air: number | undefined, sun: number): number {
  if (air === undefined) return sun;
  return Math.max(
    smooth(WET_AIR.from, WET_AIR.full, air),
    sun * smooth(SUN_WETS.cold, SUN_WETS.from, air),
  );
}

/** THE AIR the snow lies in on `level` at its start hour, °C (the slopes'
 * altitude, `slopeAltitudeOf`) — what a reader handed no air of its own
 * reads. */
export function snowAirOf(level: TempLevel): number {
  return airTempAt(level, undefined, slopeAltitudeOf(level));
}

/** Salt on the map's seed for the days' own draw. */
const AGE_SALT = 0x5a0aa6e;

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Every figure a forced kind stands its surface at. */
const FORCED: Readonly<Record<SnowAgeKind, Omit<SnowAge, "noon">>> = {
  fresh: { days: 0, fresh: 1, old: 0, wind: 0, crust: 0, hoar: 0, wet: 0 },
  settled: { days: 3, fresh: 0.12, old: 0.5, wind: 0.25, crust: 0, hoar: 0, wet: 0 },
  old: { days: 12, fresh: 0, old: 0.93, wind: 0.35, crust: 0.2, hoar: 0, wet: 0 },
  wind: { days: 6, fresh: 0, old: 0.75, wind: 1, crust: 0, hoar: 0, wet: 0 },
  crust: { days: 8, fresh: 0, old: 0.83, wind: 0.2, crust: 1, hoar: 0, wet: 0 },
  hoar: { days: 4, fresh: 0.05, old: 0.6, wind: 0, crust: 0.3, hoar: 1, wet: 0 },
  wet: { days: 10, fresh: 0, old: 0.9, wind: 0.1, crust: 0.3, hoar: 0, wet: 1 },
};

export type SnowAgeOptions = {
  /** The sky over the run — the map's own when left out. */
  weather?: Weather;
  /** The sun's elevation over the run, rad — the map's own hour's when
   * left out: what thaws it. */
  elevation?: number;
  /** One surface everywhere (a lab), or null for the map's own. */
  force?: SnowAgeKind | null;
  /** The air over the snow, °C — the map's own at its start hour and the
   * slopes' altitude when left out (`snowAirOf`): what wets it. */
  air?: number;
};

/** THE SURFACE OF THE LOOSE SNOW on `level` under its sky. */
export function snowAgeOf(
  level: Pick<Level, "seed" | "sun" | "weather"> & TempLevel,
  options: SnowAgeOptions = {},
): SnowAge {
  const noonSun = sunAtRun({ sun: { ...level.sun, hour: 12 } });
  const noon = { x: Math.sin(noonSun.azimuth), z: Math.cos(noonSun.azimuth) };
  if (options.force) return { ...FORCED[options.force], noon };
  const weather = options.weather ?? weatherOf(level);
  const days = daysSince(level.seed, weather);
  const fresh = Math.exp(-days / AGEING.fresh);
  const old = 1 - Math.exp(-days / AGEING.old);
  // The wind works the exposed snow from the first breezy hours, and a
  // calm week settles it a little too.
  const wind = old * (0.25 + 0.75 * smooth(PACKING_WIND.from, PACKING_WIND.full, weather.wind));
  // A crust wants a sun that melts the top, and a day or two of it.
  const crust =
    smooth(1.5, 5, days) *
    smooth(CRUST_SUN.from, CRUST_SUN.full, noonSun.elevation) *
    clearness(weather);
  // Hoar wants clear, calm, cold nights since the fall — and is spoiled
  // by a strong sun and a wind.
  const calm = 1 - smooth(4, 9, weather.wind);
  const cold = 1 - smooth(CRUST_SUN.from, CRUST_SUN.full + 0.1, noonSun.elevation) * 0.6;
  const hoar =
    smooth(0.8, 2.5, days) * (1 - smooth(9, 14, days)) * clearness(weather) * calm * cold;
  // The thaw, as `snowpack.ts` reads it for what is thrown: the run's sun on
  // the snow — a lid keeping most of it off, a falling sky all of it, and
  // only in air near the melting point — and the air itself over zero,
  // which wets the snow (and a fall through it) under any sky.
  const snowing =
    weather.kind === "flurries" || weather.kind === "snow" || weather.kind === "storm";
  const lid = weather.kind === "overcast" || weather.kind === "fog" ? 0.35 : 1;
  const elevation = options.elevation ?? sunAtRun(level).elevation;
  const sun = snowing
    ? 0
    : smooth(WET_SUN.from, WET_SUN.full, elevation) * lid * smooth(0.5, 2, days);
  const wet = wetIn(options.air ?? snowAirOf({ ...level, weather }), sun);
  return { days, fresh, old, wind, crust, hoar, wet, noon };
}

/** How clear the nights and days since the fall have been, off the sky
 * the run is skied under: the best guess the map holds. */
function clearness(weather: Weather): number {
  switch (weather.kind) {
    case "clear":
      return 1;
    case "fair":
      return 0.85;
    case "high":
      return 0.55;
    case "fog":
      return 0.4;
    case "overcast":
      return 0.2;
    default:
      return 0;
  }
}

/** The days since the last fall on a map under a sky, off its seed. */
export function daysSince(seed: number, weather: Weather): number {
  if (weather.kind === "flurries" || weather.kind === "snow" || weather.kind === "storm") return 0;
  const rng = createRng((seed ^ AGE_SALT) >>> 0);
  if (weather.kind === "overcast" || weather.kind === "fog" || weather.kind === "high") {
    return rng.range(DAYS.lid.min, DAYS.lid.max);
  }
  if (rng.next() < DAYS.powder.share) return rng.range(DAYS.powder.min, DAYS.powder.max);
  return rng.range(DAYS.sunny.min, DAYS.sunny.max);
}

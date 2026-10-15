// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR TEMPERATURE over a map — at any real altitude, at any moment of a
// run on the sky's clock (`defs/air-temp.ts` holds the numbers and the
// meteorology behind them).
//
//   * THE DAY'S MEAN is the lake-ice model's smooth year (`airOn`): the
//     latitude, the altitude over the sea, the day of the year and the kind
//     of snow country — read here, never restated.
//   * THE SKY moves the mean a little (a clear spell colder, a lid milder)
//     and sets how far the DAY'S CYCLE swings either side of it — coldest
//     about sunrise, warmest a couple of hours past the sun's noon, falling
//     fast through the evening. Over a free ride's FRONT the two skies
//     either side of a change are mixed by its share (`frontAt`).
//   * A SNOWING SKY is held at `AIR_TEMP.snowing` or colder where the model
//     is left to itself — the snow falls as snow.
//   * THE KNOB (`Weather.temp`, the start card's TEMPERATURE row): the air
//     at the valley floor at the start hour, °C. Set, the whole day is
//     shifted so that value holds there and then — the cycle, the lapse and
//     the front still play over it, and a snowing sky is not held.
//
// A PURE FUNCTION of the map, the run's time and an altitude: nothing is
// drawn from `state.rng`, nothing stepped, and no map's digest reads the
// knob (`levelDigest` never hashes `temp`). Every decision a run deals when
// it is CREATED reads the start hour (`t` left out), as `sunAtRun` does:
// the piste's day (`pisteDayOf`), the snow guns (`snowGunsRun`). The
// picture reads the moving hour.
//
// ALTITUDES ARE REAL: metres over the sea. A point of the map at height `y`
// stands at `y − level.mountain.sea` (`altitudeOfY`).

import { airOn } from "./lake-ice.ts";
import { AIR_TEMP } from "./defs/air-temp.ts";
import { LAKE_ICE } from "./defs/lake-ice.ts";
import { skyHourAt, sunAtRun, sunWindowOf } from "./clock.ts";
import { frontAt } from "../mapgen/front.ts";
import { regionOf } from "../mapgen/regions.ts";
import { snows, weatherOf } from "../mapgen/weather.ts";
import type { Level, Mountain, Weather, WeatherKind } from "../mapgen/types.ts";

// The numbers, and the year the air is built on, through the one barrel.
export { AIR_TEMP, LAKE_ICE };

const A = AIR_TEMP;
const D = A.diurnal;

/** What the air reads of a map: its sun (the place, the day and the start
 * hour), and where it has them its sky, front, mountain and country. A map
 * with no mountain stands its valley floor at `AIR_TEMP.valley`. */
export type TempLevel = Pick<Level, "sun"> &
  Partial<Pick<Level, "weather" | "front" | "region">> & {
    mountain?: Pick<Mountain, "altitude"> & Partial<Pick<Mountain, "vertical" | "sea">>;
  };

/** The valley floor's altitude on `level`, m over the sea. */
export function valleyAltitudeOf(level: TempLevel): number {
  return level.mountain?.altitude ?? A.valley;
}

/** THE SLOPES' ALTITUDE on `level`, m over the sea: half way up the
 * mountain — the one altitude a reader that keeps a single air for the
 * whole ski area stands it at (the snow's wetness, the piste's day, the
 * guns). A map with no mountain is given `AIR_TEMP.vertical` of it. */
export function slopeAltitudeOf(level: TempLevel): number {
  return valleyAltitudeOf(level) + (level.mountain?.vertical ?? A.vertical) / 2;
}

/** The real altitude of a map height `y`, m over the sea. */
export function altitudeOfY(level: Pick<Level, "mountain">, y: number): number {
  return y - (level.mountain?.sea ?? 0);
}

/** What the sun does to the day's cycle on a map: its sunrise and how big
 * the cycle swings for the day's sun — the same for every hour. */
type Climate = { sunrise: number; swing: number };

const climates = new WeakMap<object, Climate>();

function climateOf(level: TempLevel): Climate {
  const known = climates.get(level.sun);
  if (known) return known;
  const peak = 12 + D.peak;
  const lit = sunWindowOf(level);
  // No sunrise, or no sunset: the polar night and the midnight sun.
  const dark = lit === null || lit.max - lit.min >= 24 - 1e-6;
  const sunrise = dark ? 6 : Math.min(lit.min, peak - 1);
  const noon = sunAtRun({ sun: { ...level.sun, hour: 12 } }).elevation;
  const sun =
    D.sun.least +
    (1 - D.sun.least) * Math.min(1, Math.max(0, Math.sin(noon)) / Math.sin(D.sun.full));
  const climate = { sunrise, swing: sun * (dark ? D.dark : 1) };
  climates.set(level.sun, climate);
  return climate;
}

/** THE DAY'S CYCLE at solar `hour`, −1 (the dawn's low) … +1 (the
 * afternoon's high), with its mean over the day taken out: a cosine up
 * from sunrise to the peak, an exponential fall from it to the next dawn. */
function cycleAt(hour: number, sunrise: number): number {
  const peak = 12 + D.peak;
  const rise = peak - sunrise;
  const fall = 24 - rise;
  const tau = D.fall;
  const tail = Math.exp(-fall / tau);
  // The fall's mean over its hours, the rise's being nought.
  const fallMean = -1 + (2 * ((tau * (1 - tail)) / fall - tail)) / (1 - tail);
  const mean = (fall * fallMean) / 24;
  const h = ((((hour - sunrise) % 24) + 24) % 24) + sunrise;
  const s =
    h <= peak
      ? -Math.cos((Math.PI * (h - sunrise)) / rise)
      : -1 + (2 * (Math.exp(-(h - peak) / tau) - tail)) / (1 - tail);
  return s - mean;
}

/** The model's air under one sky, °C — no knob, no snowing hold. */
function skyAir(
  level: TempLevel,
  kind: WeatherKind,
  hour: number,
  altitude: number,
  cycle: boolean,
): number {
  const { latitude, dayOfYear } = level.sun;
  const day = dayOfYear + Math.floor(hour / 24);
  const mean = airOn(day, latitude, altitude, regionOf(level).id) + A.sky[kind];
  if (!cycle) return mean;
  const climate = climateOf(level);
  const up = Math.max(0, altitude - valleyAltitudeOf(level)) / 1000;
  const aloft = 1 - (1 - D.aloft.least) * Math.min(1, up / D.aloft.km);
  return mean + D.half[kind] * climate.swing * aloft * cycleAt(hour, climate.sunrise);
}

/** How far the knob shifts the model's air on `level`, °C: what it takes
 * for the valley floor to read `Weather.temp` at the start hour — nought
 * when the knob is AUTO. */
function knobShift(level: TempLevel, cycle: boolean): number {
  const w: Weather = weatherOf(level);
  if (w.temp === undefined) return 0;
  return w.temp - skyAir(level, w.kind, level.sun.hour, valleyAltitudeOf(level), cycle);
}

/** The air at `altitude` at solar `hour` under the run's sky at `t`. */
function airAt(
  level: TempLevel,
  t: number,
  hour: number,
  altitude: number,
  cycle: boolean,
): number {
  const { a, b, share } = frontAt(level, t);
  const ta = skyAir(level, a.kind, hour, altitude, cycle);
  const air = share > 0 ? ta + (skyAir(level, b.kind, hour, altitude, cycle) - ta) * share : ta;
  const knob = weatherOf(level).temp !== undefined;
  if (knob) return air + knobShift(level, cycle);
  // AUTO: a snowing sky's air is held at the snow's.
  const snowing =
    share > 0
      ? (snows(a.kind) ? 1 - share : 0) + (snows(b.kind) ? share : 0)
      : snows(a.kind)
        ? 1
        : 0;
  return air - snowing * Math.max(0, air - A.snowing);
}

/**
 * THE AIR TEMPERATURE on `level`, °C: at `altitude` m over the sea (the
 * valley floor's when left out), at run time `t`, s, on the sky's clock run
 * at `rate` (`skyHourAt`) — at the START hour when `t` is left out, which
 * is what every decision a run deals as it is created must read. Under a
 * free ride's front the sky at `t` (`frontAt`). With the knob set
 * (`Weather.temp`) the valley floor reads it at the start hour exactly.
 */
export function airTempAt(level: TempLevel, t?: number, altitude?: number, rate?: number): number {
  const hour = t === undefined ? level.sun.hour : skyHourAt(level, t, rate);
  return airAt(level, t ?? 0, hour, altitude ?? valleyAltitudeOf(level), true);
}

/** THE WET BULB on `level`, °C — `airTempAt`'s air at the same moment and
 * altitude less the depression its sky's dryness gives it
 * (`AIR_TEMP.bulb`): what a snow gun makes snow under. */
export function wetBulbAt(level: TempLevel, t?: number, altitude?: number, rate?: number): number {
  const kind = (t === undefined ? weatherOf(level) : frontAt(level, t).b).kind;
  return airTempAt(level, t, altitude, rate) - A.bulb[kind];
}

/** THE TROPOPAUSE over `level` on its day, m over the sea: about 16.5 km
 * over the tropics, 11 km at the middle latitudes, 9 km over the poles —
 * a kilometre or so lower in deep winter and higher in high summer. */
export function tropopauseOf(level: Pick<Level, "sun">): number {
  const T = A.free.tropopause;
  const { latitude, dayOfYear } = level.sun;
  const k = smooth(T.from, T.to, Math.abs(latitude));
  const coldest = latitude < 0 ? LAKE_ICE.coldest + 365 / 2 : LAKE_ICE.coldest;
  const winter = Math.cos((2 * Math.PI * (dayOfYear - coldest)) / 365);
  return (T.tropics + (T.poles - T.tropics) * k - T.winter * winter * k) * 1000;
}

/**
 * THE FREE AIR ALOFT over `level`, °C, at `altitude` m over the sea, at run
 * time `t` on the sky's clock (the start hour left out): the column over
 * the valley floor's day mean — the sky's and the knob's shift in it, the
 * day's cycle and the snowing hold not, which are the ground's — cooling at
 * the standard 6.5 °C a kilometre, never colder than the tropopause's air
 * for the latitude, and the same as it all the way up past the tropopause
 * (`tropopauseOf`). What a jet's contrail forms in, and an aircraft's
 * outside air reads.
 */
export function freeAirTempAt(
  level: TempLevel,
  t: number | undefined,
  altitude: number,
  rate?: number,
): number {
  const valley = valleyAltitudeOf(level);
  const hour = t === undefined ? level.sun.hour : skyHourAt(level, t, rate);
  const { a, b, share } = frontAt(level, t ?? 0);
  const ta = skyAir(level, a.kind, hour, valley, false);
  const ground =
    (share > 0 ? ta + (skyAir(level, b.kind, hour, valley, false) - ta) * share : ta) +
    knobShift(level, true);
  const top = tropopauseOf(level);
  const F = A.free.floor;
  const floor =
    F.tropics +
    (F.poles - F.tropics) *
      smooth(A.free.tropopause.from, A.free.tropopause.to, Math.abs(level.sun.latitude));
  const column = (z: number): number =>
    Math.max(floor, ground - (A.free.lapse * (z - valley)) / 1000);
  return column(Math.min(altitude, top));
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

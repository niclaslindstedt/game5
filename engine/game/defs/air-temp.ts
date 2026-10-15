// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR TEMPERATURE — the numbers (`air-temp.ts` is the model).
//
// The day's MEAN is the lake-ice model's smooth year (`airOn`,
// `defs/lake-ice.ts`): a mean falling with latitude and altitude, swinging
// either side of it through the year, each kind of snow country its own.
// Over it this model lays what a day does to the air, from the mountain
// meteorology literature, in our words:
//
//   * THE DAY'S CYCLE. The air is coldest about sunrise and warmest two to
//     three hours after the sun's noon; it cools fast in the evening and
//     more slowly through the night. Under a clear winter sky in the
//     mountains the swing is some 8–12 °C from the dawn's low to the
//     afternoon's high (half of it either side of the mean), less on a
//     summit than in a valley, where the cold pools by night; under a lid
//     of cloud 2–3 °C; in a storm hardly any. A low midwinter sun drives a
//     smaller swing than a spring one; in the polar night and under the
//     midnight sun there is little of a cycle at all.
//   * THE SKY'S OWN AIR. A clear sky lets the snow radiate its warmth away
//     (a clear spell's mean a little colder), a lid of cloud holds it in (a
//     little milder); a valley fog is an inversion's cold air; showers out
//     of a sunny sky and a storm's blizzard come in cold air behind a front,
//     a steady fall under a lid in milder air ahead of one.
//   * SNOW, NOT RAIN. Snow reaches the ground as snow only in air at about
//     +1 to +1.5 °C or colder; a sky the model has snowing is held there.
//     A knob turned warm over a snowing sky is the player's: heavy, wet
//     snow near the melting point.
//   * THE FREE AIR ALOFT cools at the standard atmosphere's 6.5 °C a
//     kilometre up to the TROPOPAUSE, about 16 km over the tropics, 10–12 km
//     at the middle latitudes and 8–9 km over the poles in winter (lower in
//     winter, higher in summer), and stays about the same above it — some
//     −55 to −60 °C at the middle and high latitudes, near −75 °C over the
//     tropics.

import type { WeatherKind } from "../../mapgen/types.ts";

const deg = Math.PI / 180;

export const AIR_TEMP = {
  /** The valley floor's altitude, m over the sea, a map with no mountain
   * (a synthetic slope) stands its air at. */
  valley: 1000,
  /** ...and the vertical over it, m: its slopes stand half way up. */
  vertical: 1500,
  /** THE DAY'S CYCLE. `half`: the swing either side of the day's mean at
   * the valley floor under each sky, °C. `peak`: the warmest hour, solar
   * hours after noon. `fall`: the evening's cooling, h to `1 − 1/e` of the
   * way down to the dawn's low. */
  diurnal: {
    half: {
      clear: 5,
      fair: 4,
      flurries: 3,
      high: 3,
      overcast: 1.5,
      fog: 1.5,
      snow: 1,
      storm: 0.5,
    } satisfies Record<WeatherKind, number>,
    peak: 2.5,
    fall: 4,
    /** The swing grows with how high the noon sun stands: `least` of it
     * with the sun on the horizon, all of it at `full` (rad) and over. */
    sun: { least: 0.5, full: 50 * deg },
    /** ...and shrinks with the height over the valley floor: `least` of it
     * `km` kilometres up and above. */
    aloft: { km: 2, least: 0.6 },
    /** ...and with no sunrise at all (the polar night, the midnight sun),
     * this share of it is left. */
    dark: 0.3,
  },
  /** THE SKY'S OWN AIR, °C on the day's mean. */
  sky: {
    clear: -0.5,
    fair: 0,
    flurries: -1,
    high: 0.5,
    overcast: 1,
    fog: -1,
    snow: 0.5,
    storm: -1,
  } satisfies Record<WeatherKind, number>,
  /** THE WET BULB's depression under the air under each sky, °C: the
   * drier the air, the further under — a clear sky's air is dry, a lid's
   * and a fog's near saturated. What a snow gun reads (a wet bulb under
   * about −2 °C makes snow). */
  bulb: {
    clear: 2,
    fair: 1.5,
    flurries: 1,
    high: 1.5,
    overcast: 0.5,
    fog: 0,
    snow: 0.3,
    storm: 0.3,
  } satisfies Record<WeatherKind, number>,
  /** The warmest a sky the model has snowing is let be, °C — snow, not
   * rain, where it falls. */
  snowing: 1,
  /** THE FREE AIR: its lapse, °C a kilometre; the tropopause's height, km,
   * over the tropics and the poles, eased between `from` and `to` degrees
   * of latitude, `winter` km lower in deep winter (as much higher in high
   * summer) where the latitude reaches it; and the coldest the column gets
   * over the tropics and the poles, °C. */
  free: {
    lapse: 6.5,
    tropopause: { tropics: 16.5, poles: 9, from: 15, to: 65, winter: 1.2 },
    floor: { tropics: -74, poles: -56 },
  },
} as const;

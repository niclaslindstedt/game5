// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// LAKE ICE — the numbers (`lake-ice.ts` is the model).
//
// Whether a mountain lake is open, freezing, frozen or breaking up on a
// given day is a matter of the AIR it has had since the summer, and the
// limnology of lake ice says how, to the accuracy a game needs:
//
//   * A lake freezes only once the summer's heat has gone out of it: it
//     cools under air below zero, and the deeper (the bigger) it is, the
//     more frost it takes — a pond a few days of it, a lake of a square
//     kilometre a few weeks, the biggest valley lakes a winter's worth and
//     some never close at all. Ice first forms along the SHORE, in the
//     shallow water, and grows out over the lake (border ice).
//   * Ice then thickens by the square root of the frost it has had (the
//     Stefan law: thickness = α √(freezing degree-days)); under its usual
//     cover of snow α is about 1.7 cm per √(°C·day), bare ice twice that.
//     A northern lake ends the winter half a metre to a metre thick.
//   * A new cover is BLACK ICE — clear, the dark water seen through it —
//     until the next snowfall lays white on it; the wind keeps scoured
//     patches of grey ice bare.
//   * In spring the snow on it melts first, then the ice rots from within
//     (grey, candled, wet, pools of meltwater on it) and a MOAT of open
//     water opens along the shore, where the shallows and the meltwater
//     running in warm first; the middle goes last, a few weeks after the
//     air's mean has climbed past zero.
//   * Running water freezes later and opens earlier than still.
//
// The air is a smooth year: a mean that falls with latitude (about 0.4 °C
// a degree) and with altitude (5.5 °C a kilometre — less than the free
// air's 6.5, because the cold pools in the valleys in winter), and a swing
// either side of it that grows toward the pole, coldest about 20 January.
// Each kind of snow country moves the mean and scales the swing (the
// maritime milder and steadier, the continental colder and wider). Every
// figure is set inside what the measured freeze-up and ice-off dates of
// northern and alpine lakes show: a lake at 400 m at 63° N frozen from
// late November to mid May, half a metre to 70 cm thick by March; a lake
// at 800 m at 46° N frozen from around New Year into March; a big low
// lake in a mild country open all winter.

import type { RegionId } from "../../mapgen/regions.ts";

export const LAKE_ICE = {
  /** THE AIR'S YEARLY MEAN at the sea, °C: `sea − perLatitude × |lat|`. */
  sea: 28,
  perLatitude: 0.4,
  /** How much colder the mean is a kilometre up, °C. */
  lapse: 5.5,
  /** THE SWING either side of the mean, °C: `swing + swingPerLatitude ×
   * |lat|`, coldest on `coldest` (the day of the year; half a year on in
   * the south). */
  swing: 3,
  swingPerLatitude: 0.14,
  coldest: 20,
  /** Each country's own air: °C added to the mean, and the swing's scale. */
  region: {
    alpine: { mean: 0, swing: 1 },
    fell: { mean: 0, swing: 1.1 },
    continental: { mean: -1, swing: 1.25 },
    maritime: { mean: 1.5, swing: 0.7 },
  } satisfies Record<RegionId, { mean: number; swing: number }>,
  /** Where the year is begun from: the warmest day, everything open. */
  warmest: 202,

  /** FREEZE-UP: the frost (°C·day) the water takes before it closes over,
   * `need + perRootArea × √(area m²)`; a warm day gives `warmBack` of its
   * warmth back against it. Running water takes `running` times as much. */
  need: 8,
  perRootArea: 0.045,
  warmBack: 0.6,
  running: 2.5,
  /** The shore ice reaching out before the whole lake closes: it starts at
   * `rimFrom` of the frost needed and reaches `rimMost` m out at the close. */
  rimFrom: 0.35,
  rimMost: 60,
  /** The first skin of ice, m. */
  skin: 0.02,

  /** THE STEFAN LAW's α, m per √(°C·day): under snow, and bare. */
  alphaSnow: 0.017,
  alphaBare: 0.027,

  /** THE SNOW ON IT, m of water: laid at `snowFall` a frosty day up to
   * `snowMost` (the wind takes the rest), and white over the ice at
   * `snowWhite`. A cover younger than `blackDays` with no snow on it is
   * still black ice. `scour` of a snowed lake is kept bare by the wind. */
  snowFall: 0.004,
  snowMost: 0.12,
  snowWhite: 0.02,
  blackDays: 6,
  scour: 0.1,

  /** THE THAW: snow and ice melt at `melt` (m of water, ice) per °C·day of
   * air above `meltFrom` (the spring sun's share is what puts the melt
   * below zero); the ice melts at `underSnow` of that while snow lies on
   * it. Ice under `rotten` m that is melting is ROTTEN; under `open` m
   * it breaks up and the lake is open. */
  meltFrom: -2,
  melt: 0.006,
  meltIce: 0.01,
  underSnow: 0.3,
  rotten: 0.25,
  open: 0.04,
  /** The moat at its widest, m, as the ice goes. */
  moatMost: 30,
} as const;

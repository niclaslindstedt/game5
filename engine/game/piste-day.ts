// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE THROUGH A DAY — what state the ski area's runs are in at the
// hour a free ride is stood up, out of the hour, the date, the latitude and
// the sky the map is ridden under, and nothing else:
//
//   * THE NIGHT'S CORDUROY. The piste machines (`groomer.ts`) groomed every
//     run overnight, so at the first chair the piste is crisp corduroy with
//     the edge's whole grip on it — the best piste snow of the day.
//   * SKIED UP. From the first chair (`PISTE_DAY.open`) the traffic skis the
//     comb off it, scrapes the turns down to the hard base and heaps the
//     loose snow between them (`worn`, 0 → 1 over the day's hours).
//   * NEW SNOW. A snowing sky lays its fall at R19's rate (`freshRate`) on
//     the runs from the night's last pass: all of it before the first chair,
//     and after it a layer the traffic keeps skiing in, settling toward the
//     rate times `pack` hours — a flurry leaves a dusting, a steady fall a
//     few soft centimetres by the afternoon, a storm a hand of loose snow
//     over the whole run (`fresh`, m).
//   * THE SUN. A high sun on a groomer — a spring one; a midwinter noon sun
//     never gets there — warms it to slush through the afternoon (`soft`),
//     and as it goes the slush freezes hard and glassy (`hard`): the
//     evening's scratchy piste. A lid over the sun keeps most of it off, and
//     a snowing sky all of it.
//
// A PURE FUNCTION OF THE MAP, worked out once as the run is stood up by
// walking the day from the night's last pass to the hour — no draw from
// `state.rng`, nothing stepped. Only a run whose rules have the ski area's
// machines (`RunRules.groomer`, the free ride) is dealt it (`createGame`),
// so a race on its prepared course, a trial or a measurement is the run it
// always was. The physics reads it through `snow.ts` (`packedUnder`'s loose
// share, `pisteIce`) and `GameState.fresh`, which it seeds; the picture reads
// the same numbers (`snowpack.ts`, the snow shader's `uWorked` / `uPiste`).

import { sunAt } from "@niclaslindstedt/oss-game-framework/core/solar";
import { declinationOf, snows, weatherOf, type Level } from "../mapgen/index.ts";
import { PISTE_DAY } from "./defs/piste-day.ts";
import { freshRate } from "./snowfall.ts";

const P = PISTE_DAY;

/** The state of the runs at a run's hour. */
export type PisteDay = {
  /** The solar hour it was worked out for. */
  hour: number;
  /** Hours of full traffic the runs have taken since the night's pass. */
  skied: number;
  /** How skied up the groomer is, 0 (the night's corduroy) … 1 (worn
   * through, scraped and heaped). */
  worn: number;
  /** The loose new snow lying on the runs, m (seeds `GameState.fresh`). */
  fresh: number;
  /** How soft the sun has made the groomer, 0 … 1 (slush through). */
  soft: number;
  /** How hard it has frozen again since, 0 … 1 (glassy through). */
  hard: number;
  /** The share of a groomer's pack that reads as loose snow (`packedUnder`). */
  loose: number;
  /** The share of bare ice's grip a groomer stands at (`pisteIce`). */
  ice: number;
};

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The traffic on the runs at solar hour `h`, 0..1. */
function trafficAt(h: number): number {
  if (h < P.open) return 0;
  return h < P.close ? 1 : P.after;
}

/** THE RUNS ON `level` at its own hour, date and sky. */
export function pisteDayOf(level: Pick<Level, "sun" | "weather">): PisteDay {
  const hour = level.sun.hour;
  const weather = weatherOf(level);
  const rate = snows(weather.kind) ? freshRate(weather.snowfall) * 3600 : 0;
  const lid = P.sun.lid[weather.kind];
  const dec = declinationOf(level.sun.dayOfYear);
  const sinFrom = Math.sin(P.sun.from);
  let skied = 0;
  let fresh = 0;
  let warm = 0;
  let softMost = 0;
  // Walk the day from the night's last pass, a step at a time — the last
  // step cut to land on the hour itself.
  for (let h = P.groomed; h < hour - 1e-9;) {
    const dt = Math.min(P.step, hour - h);
    const mid = h + dt / 2;
    const traffic = trafficAt(mid);
    skied += traffic * dt;
    // The fall lands; the traffic skis a share of what lies into the piste.
    fresh += (rate - (traffic * fresh) / P.pack) * dt;
    // The sun warms the surface over its threshold; it cools back always.
    const sun = sunAt(mid, level.sun.latitude, dec);
    const heat = Math.max(0, Math.sin(sun.elevation) - sinFrom) * lid;
    warm += (heat - warm / P.sun.cool) * dt;
    softMost = Math.max(softMost, smooth(P.sun.soft.from, P.sun.soft.full, warm));
    h += dt;
  }
  const worn = 1 - Math.exp(-skied / P.wear);
  const soft = smooth(P.sun.soft.from, P.sun.soft.full, warm);
  // What was slush and is no longer has frozen.
  const hard = Math.max(0, softMost - soft);
  const loose = Math.min(P.loose.most, P.loose.worn * worn * (1 - hard) + P.loose.soft * soft);
  return {
    hour,
    skied,
    worn,
    fresh: Math.max(0, fresh),
    soft,
    hard,
    loose,
    ice: P.ice * hard,
  };
}

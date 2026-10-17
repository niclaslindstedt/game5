// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE THROUGH A DAY — what state the ski area's runs are in at the
// hour a free ride is stood up, out of the hour and the sky the map is
// ridden under, and nothing else:
//
//   * THE NIGHT'S CORDUROY. The piste machines (`groomer.ts`) groomed every
//     run overnight, so at the first chair the piste is crisp corduroy.
//   * SKIED UP, AS DRAWN. From the first chair (`PISTE_DAY.open`) the
//     traffic skis the comb off its look (`worn`, 0 → 1 over the day's
//     hours) and lays the other skiers' tracks on it (`skied`). The grip
//     never goes with it: the runs ski as the groomer they are at any hour
//     — no slush, no evening refreeze — so an evening run keeps its
//     traction.
//   * NEW SNOW. A snowing sky lays its fall at R19's rate (`freshRate`) on
//     the runs from the night's last pass: all of it before the first chair,
//     and after it a layer the traffic keeps skiing in, settling toward the
//     rate times `pack` hours — a flurry leaves a dusting, a steady fall a
//     few soft centimetres by the afternoon, a storm a hand of loose snow
//     over the whole run (`fresh`, m).
//
// A PURE FUNCTION OF THE MAP, worked out once as the run is stood up by
// walking the day from the night's last pass to the hour — no draw from
// `state.rng`, nothing stepped. Only a run whose rules have the ski area's
// machines (`RunRules.groomer`, the free ride) is dealt it (`createGame`),
// so a race on its prepared course, a trial or a measurement is the run it
// always was. The physics reads it through `GameState.fresh`, which it
// seeds, and the ground the lift staff keep (`snow.ts`); the picture reads
// the same numbers (`snowpack.ts`, the snow shader's `uWorked` / `uPiste`).

import { snows, weatherOf, type Level } from "../mapgen/index.ts";
import { PISTE_DAY } from "./defs/piste-day.ts";
import { freshRate } from "./snowfall.ts";

const P = PISTE_DAY;

/** The state of the runs at a run's hour. */
export type PisteDay = {
  /** The solar hour it was worked out for. */
  hour: number;
  /** Hours of full traffic the runs have taken since the night's pass. */
  skied: number;
  /** How skied up the groomer LOOKS, 0 (the night's corduroy) … 1 (worn
   * through) — drawn only, never felt. */
  worn: number;
  /** The loose new snow lying on the runs, m (seeds `GameState.fresh`). */
  fresh: number;
};

/** The traffic on the runs at solar hour `h`, 0..1. */
function trafficAt(h: number): number {
  if (h < P.open) return 0;
  return h < P.close ? 1 : P.after;
}

/** THE RUNS ON `level` at its own hour and sky. */
export function pisteDayOf(level: Pick<Level, "sun" | "weather">): PisteDay {
  const hour = level.sun.hour;
  const weather = weatherOf(level);
  const rate = snows(weather.kind) ? freshRate(weather.snowfall) * 3600 : 0;
  let skied = 0;
  let fresh = 0;
  // Walk the day from the night's last pass, a step at a time — the last
  // step cut to land on the hour itself.
  for (let h = P.groomed; h < hour - 1e-9;) {
    const dt = Math.min(P.step, hour - h);
    const traffic = trafficAt(h + dt / 2);
    skied += traffic * dt;
    // The fall lands; the traffic skis a share of what lies into the piste.
    fresh += (rate - (traffic * fresh) / P.pack) * dt;
    h += dt;
  }
  return { hour, skied, worn: 1 - Math.exp(-skied / P.wear), fresh: Math.max(0, fresh) };
}

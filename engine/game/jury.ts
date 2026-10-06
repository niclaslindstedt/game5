// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JURY'S DAY — the weather a race is run in. A race's jury holds,
// lowers or calls off a start the weather makes unsafe or unfair, so a race
// is never skied in more wind or a heavier fall than its discipline's
// `JURY` row (`defs/modes.ts`) allows: a day the sky dealt past it is a race
// held for a calmer hour, and the race is skied in that hour's weather —
// the same sky, its wind and its fall eased to the row.
//
// THE WIND is read where the jury's anemometer stands, at the course's START
// gate — on a SPEED TRACK (R34) at the top of its timing zone, where that
// sport's rules stand it: the mean wind there at 10 m (`exposureAt` — the start is high on
// the mountain, where the flow runs fastest) with every gust at its crest
// (`GUST_PEAK`) is held to the row, so no gust anywhere down the course,
// lower and in the lee, passes it either. THE FALL is held the same way,
// and a storm whose fall is eased is the steady fall it has become.
//
// A pure function of the map and the row, drawing nothing from any stream,
// and idempotent — a replay rebuilt on the race's own map eases nothing
// further — so the race is the same day on every machine. Nothing the map
// BUILT moves: only its `weather`, through `withSky`, as a sky picked by
// hand would.

import type { Level, Weather } from "../mapgen/index.ts";
import { weatherOf, withSky } from "../mapgen/index.ts";
import type { Jury } from "./defs/modes.ts";
import { exposureAt, GUST_PEAK } from "./wind.ts";

/** The strongest gust at the course's start under `weather`, m/s at 10 m —
 * a speed track's at the top of its timing zone. */
export function startGustOf(level: Level, weather: Weather = weatherOf(level)): number {
  const gate = (level.speedSki ? level.checkpoints[1] : level.checkpoints[0]) ?? level.spawn;
  return weather.wind * GUST_PEAK * exposureAt(level, gate.x, gate.z);
}

/** `level` under the weather its race's jury runs it in — the same level
 * where the sky is already inside `jury`. */
export function juryDay<L extends Level>(level: L, jury: Jury): L {
  const w = weatherOf(level);
  const exposed = startGustOf(level, w) / Math.max(1e-9, w.wind);
  const wind = exposed > 0 ? Math.min(w.wind, jury.wind / exposed) : w.wind;
  const fall = Math.min(w.snowfall, jury.fall);
  if (wind >= w.wind && fall >= w.snowfall) return level;
  // A storm whose fall is eased is the steady fall it has become.
  const kind = w.kind === "storm" && fall < w.snowfall ? "snow" : w.kind;
  return withSky(level, { weather: { ...w, kind, wind, snowfall: fall } });
}

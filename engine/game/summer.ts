// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMER SEASON on a free ride (`CreateGameOptions.summer` →
// `GameState.summer`): the mountain in midsummer, the snow gone but for the
// patches left lying high in the hollows (`summer-ground.ts`). What it
// changes about a run is stated here once:
// - THE SNOW: no loose snow anywhere — the dial at its least, no new snow,
//   no tree wells, no piste through the day — and `snow.ts`'s `packedSnow`
//   reads the whole surface as hard (`state.summer`), so nothing sinks;
// - THE SKY: a summer sky never snows (`drySummer`: a flurry is fair
//   weather, a fall or a storm an overcast; rain is not modelled);
// - THE SKI AREA: no piste machines, no snow guns, no avalanches, no
//   snowmobile and no crowd of skiers on the runs (`rulesFor`), and the
//   DRAG LIFTS stand still (`lift-ride.ts`) — the chairs and gondolas run
//   for the hikers and the bikes.
// Absent off a summer ride, so no digest moves.

import { snows, weatherOf, withSky } from "../mapgen/weather.ts";
import type { Level, WeatherKind } from "../mapgen/types.ts";
import { SUMMER_GROUND } from "./defs/summer-ground.ts";

/** Whether a run asked for summer is one: a free ride's alone. */
export function summerOf(options: { summer?: boolean; mode?: string }): boolean {
  return options.summer === true && options.mode === "free";
}

/** The SUMMER DAY of the year the season stands on (15 July). */
export const SUMMER_DAY = SUMMER_GROUND.day;

/** The summer sky a winter sky `kind` is: a flurry fair weather, a fall or
 * a storm an overcast; any sky that does not snow, itself. */
export function summerSky(kind: WeatherKind): WeatherKind {
  if (!snows(kind)) return kind;
  return kind === "flurries" ? "fair" : "overcast";
}

/** `level` under a sky that does not snow (`summerSky`). */
export function drySummer<L extends Level>(level: L): L {
  const kind = weatherOf(level).kind;
  return snows(kind) ? withSky(level, { weather: summerSky(kind) }) : level;
}

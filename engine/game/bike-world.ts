// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GROUND A SUMMER MAP GIVES THE BIKE (`bike-body.ts`'s `BikeWorld`):
// the map's own height and normal (the bike park's trails laid over it,
// `bike-surface.ts`), what each point is to a tyre (`summer-ground.ts`'s
// `summerSurfaceAt` — the tread, a garden's rock or root, the meadow), the
// wind brought down to the rider, and WHERE ON A JUMP a wheel came down
// (`zoneAt`, off the park's features) for the landing's judge
// (`bike-judge.ts`). Pure over the level and the clock; nothing here draws
// from any stream.

import { bikeTrailAt } from "../mapgen/bike-park-query.ts";
import type { Level } from "../mapgen/types.ts";
import type { BikeZone, ZonedWorld } from "./bike-judge.ts";
import { TUNING } from "./defs/tuning.ts";
import { summerSurfaceAt } from "./summer-ground.ts";
import { windAt, type Wind } from "./wind.ts";

/** The wind at the rider's height over the 10 m wind the map is dealt: the
 * log law's ln(1.5 m / z₀) over ln(10 m / z₀) on open ground (z₀ 3 cm). */
const LOW = 0.67;
/** How far past a jump's landing a wheel coming down is OVERSHOT, m — the
 * run-out's flat a landing that long was not shaped for. */
const RUNOUT = 12;
/** How far past a drop's or a step-down's lip its landing reaches, m. */
const BELOW = 10;

const worlds = new WeakMap<Level, ZonedWorld>();
const wind: Wind = { x: 0, z: 0, speed: 0, gust: 0 };

/** THE BIKE'S WORLD on `level` at run time `t`: one a map, its wind set to
 * the moment's. */
export function bikeWorldOf(level: Level, t: number): ZonedWorld {
  let w = worlds.get(level);
  if (!w) {
    w = {
      groundAt: (x, z) => level.groundAt(x, z),
      normalAt: (x, z, out) => level.normalAt(x, z, out),
      surfaceAt: (x, z) => summerSurfaceAt(level, x, z),
      wind: { x: 0, z: 0 },
      rho: TUNING.airDensity,
      zoneAt: (x, z) => zoneAt(level, x, z),
    };
    worlds.set(level, w);
  }
  windAt(level, t, wind);
  w.wind.x = wind.x * LOW;
  w.wind.z = wind.z * LOW;
  return w;
}

/** WHERE ON A JUMP (x, z) LIES, for the landing's judge: a table's or a
 * gap's DECK (between its lip and its knuckle — short of the landing), its
 * LANDING (the knuckle to the feature's end), the RUN-OUT past it (an
 * overshoot), the landing below a step-down's lip, the FLAT under a drop's
 * ledge — or null, where no jump stands. */
export function zoneAt(level: Level, x: number, z: number): BikeZone {
  const hit = bikeTrailAt(level, x, z);
  if (!hit) return null;
  const s = hit.s;
  for (const f of hit.trail.features) {
    if (f.lip === undefined || s < f.lip || s > f.to + RUNOUT) continue;
    if (f.kind === "table" || f.kind === "gap") {
      const knuckle = f.knuckle ?? f.lip;
      if (s < knuckle) return "deck";
      return s <= f.to ? "landing" : "runout";
    }
    if (f.kind === "stepdown" && s <= f.lip + BELOW) return "landing";
    if (f.kind === "drop" && s <= f.lip + BELOW) return "flat";
  }
  return null;
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R15, R19 — A COURSE'S DAY on a resort: dealt when a course's map is stood
// up (`resortLevel`), off a stream of the course's own, so every map of one
// resort shares every metre of its snow and only its sky differs.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import type { Region } from "./regions.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import { sunOffFace, sunWindow } from "./sun.ts";
import type { GeneratedLevel } from "./types.ts";
import { dealWeather } from "./weather.ts";

/** The salt for a course's day. */
const DAY_SALT = 0x0dae5a1;

/** R15, R19 — a course's day: its own stream's day of the year and hour,
 * turned to the face (the sun within `sun.facing` of the face's bearing at
 * the run's hour), and its sky. */
export function courseDay(
  b: { sub: number; region: Region; latitude: number; facing: number },
  id: string,
): { sun: GeneratedLevel["sun"]; weather: GeneratedLevel["weather"] } {
  const sub = (b.sub ^ Math.imul(Number(id), DAY_SALT)) >>> 0;
  const rng = createRng(sub);
  const bands = b.region.sun;
  for (let t = 0; t < 48; t++) {
    const dayOfYear = Math.round(
      bands.dayOfYear.min + rng.next() * (bands.dayOfYear.max - bands.dayOfYear.min),
    );
    const w = sunWindow(b.latitude, dayOfYear);
    if (!w) continue;
    const hour = w.min + rng.next() * (w.max - w.min);
    const { weather, hour: start } = dealWeather((sub + t) >>> 0, {
      hour,
      dayOfYear,
      latitude: b.latitude,
    });
    const sun = { hour: start, dayOfYear, latitude: b.latitude, facing: b.facing };
    if (sunOffFace(sun) <= R.sun.facing) return { sun, weather };
  }
  // A noon in the band always faces within the bearing it was dealt for.
  const dayOfYear = Math.round((bands.dayOfYear.min + bands.dayOfYear.max) / 2);
  const { weather } = dealWeather(sub, { hour: 12.5, dayOfYear, latitude: b.latitude });
  return {
    sun: { hour: 12.5, dayOfYear, latitude: b.latitude, facing: b.facing },
    weather: { ...weather, evening: false },
  };
}

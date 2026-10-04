// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LINE A RACER SKIS THROUGH A SLALOM (R31) — the setter's line round
// the poles (`slalomLineFast`: just outside every turning pole, across the
// middle of every closed gate) as a racer takes it on the pitch under him.
//
// The setter's line is the shortest way round the poles, and on a gentle
// hill a racer skis it. On a STEEP one he cannot: the fall line pulls him
// faster than any skid can take off (a skid's drag is some 0.35 g, a 33°
// pitch pulls 0.55 g), so the speed is checked by the shape of the turns
// — started earlier and taken wider of the poles, each turn finished
// further across the hill before the next. So the line's swing either
// side of the course's middle is ROUNDED OUT by the pitch: the setter's
// own past `ROUND.from` of grade, `ROUND.per` more of it for every unit of
// grade beyond, to `ROUND.most` more at the steepest. Its bend grows with
// it, and the speed a bend allows (the bot's `speedAllowed`, the par's
// profile) falls with that — the slower pace a steep slalom is skied at.
//
// A closed gate's line crosses the gate's own poles at its middle
// (`setSlalom` stands every closed gate on the course's middle), so
// rounding the swing about that middle keeps the crossing where it is.
// Read by the bot's slalom (`sim/bot.ts`) and the par (`par.ts`), so the
// line the bot skis is the line par is reckoned on.

import { slalomLineFast, trackPointAt } from "../mapgen/index.ts";
import type { Level, TrackPoint } from "../mapgen/types.ts";

/** How far the line is rounded out by the pitch: from `from` of grade
 * (rise over run), `per` of the swing more a unit of grade past it, at
 * most `most` more. */
export const ROUND = { from: 0.3, per: 2, most: 0.8 } as const;

/** How far either side the pitch is read over, m. */
const PITCH_SPAN = 3;

const pa: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
const pb: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
const out = { offset: 0, curvature: 0 };

/** The racer's line `s` metres down the piste: how far right of the
 * piste's centreline, m, and how sharply it bends there, 1/m. Null on a
 * map with no slalom set. The object is reused: read it before the next
 * call. */
export function raceLineAt(level: Level, s: number): { offset: number; curvature: number } | null {
  const line = slalomLineFast(level, s);
  if (!line) return null;
  const grade =
    (trackPointAt(level, s - PITCH_SPAN, pa).y - trackPointAt(level, s + PITCH_SPAN, pb).y) /
    (2 * PITCH_SPAN);
  const round = 1 + Math.min(ROUND.most, ROUND.per * Math.max(0, grade - ROUND.from));
  out.offset = line.offset * round;
  out.curvature = line.curvature * round;
  return out;
}

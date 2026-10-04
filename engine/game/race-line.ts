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
import type { SkiSpec } from "./defs/skis.ts";
import type { Technique } from "./defs/technique.ts";
import { cutGrip } from "./limits.ts";

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

/** How far apart the line's turns are about `s` metres down the piste,
 * m: the stretch between the two points of the setter's line either side
 * of it (each a turning pole's or a closed gate's end, where the line
 * turns hardest) — over which it swings from one turn into the next.
 * Infinity off the line. */
export function raceSpanAt(level: Level, s: number): number {
  const line = level.slalom?.line;
  if (!line || line.length < 2 || s <= line[0].s || s >= line[line.length - 1].s) return Infinity;
  let lo = 0;
  let hi = line.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (line[mid].s <= s) lo = mid;
    else hi = mid;
  }
  return Math.max(0.5, line[hi].s - line[lo].s);
}

/** THE SPEED A RACER CAN TAKE THE LINE AT where it bends `k` 1/m and turns
 * every `span` m, m/s, on snow `packed`: the bend at `pace` of the grip
 * his skis CUT HARD hold (`cutGrip`, read at a standstill and once more
 * at the speed that gives) — less the stretch he crosses from one edge to
 * the next. A racer is laid over into the old turn until its load lets him
 * go, so for `cross` s between two turns he runs on no edge; the turn
 * that is left, span − v·cross, must swing him as far, tighter by the
 * square of the share left: v²·k·(span / (span − v·cross))² ≤ a. Read by
 * the bot's speed and the par, so the line the bot skis is the one par
 * is reckoned on. */
export function lineSpeed(
  spec: SkiSpec,
  T: Technique,
  k: number,
  span: number,
  packed: number,
  pace: number,
  cross: number,
): number {
  const fit = (a: number): number =>
    Number.isFinite(span)
      ? (Math.sqrt(a) * span) / (Math.sqrt(k) * span + Math.sqrt(a) * cross)
      : Math.sqrt(a / k);
  const first = fit(cutGrip(spec, 0, T, packed) * pace);
  return fit(cutGrip(spec, first, T, packed) * pace);
}

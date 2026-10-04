// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PAR OF A SLALOM (R31) — how long a good racer takes down the course,
// and the clock at each of its gates, worked out off the course itself
// rather than skied: the line round the poles (`slalomLineFast`), the pitch
// under it and what a pair can do on it (`limits.ts`). The field's times
// are dealt about it (`field.ts`), so a racer of the field is never skied
// by anyone — only one racer is ever on a slalom course, and what the
// player races is the board.
//
// THE SPEED DOWN THE LINE is the least of three ceilings at every half
// metre: what the pitch lets a racer stood half up reach (`terminalSpeed`),
// what the edge's grip holds round the line's bend (`cornerGrip`), and how
// fast the skis come round it and roll from edge to edge between two poles
// (`PAR.turn` rad/s at `PAR.pace` of it, as the bot plans it) — then held to
// what he can gather from the hut (`PAR.push`, then the pitch) and shed
// before a bend (`PAR.brake`). The clock is that profile integrated, and
// `PAR.scale` is the measured share of the bot's own time a good racer
// takes (`tests/slalom_test.ts` holds the two apart by no more than the
// field's own spread).

import { slalomLineFast, trackPointAt } from "../mapgen/index.ts";
import type { Level } from "../mapgen/types.ts";
import type { SkiSpec } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { cornerGrip, terminalSpeed } from "./limits.ts";

/** The par's numbers. Metres, seconds. */
export const PAR = {
  /** The step the line is walked in, m. */
  step: 0.5,
  /** How fast round the skis turn, rad/s, and the share of it a line's
   * bend is skied at — the rest is the edge rolling between two turns. */
  turn: 1.3,
  pace: 0.42,
  /** The share of the edge's grip a bend is carved at. */
  grip: 0.8,
  /** How far up out of the tuck a slalom racer skis, 0 tall … 1 folded. */
  crouch: 0.3,
  /** Out of the hut: the speed the push gives, m/s, and the share of the
   * pitch's pull he keeps between the poles. */
  push: 3,
  pull: 0.75,
  /** The most he sheds before a bend, m/s². */
  brake: 4,
  /** A good racer's time as a share of the line's own. */
  scale: 1.12,
} as const;

/** A slalom's par: the whole run, s, and the clock at each checkpoint —
 * the start gate's 0 first, the finish's the run. */
export type Par = { time: number; splits: number[] };

const pars = new WeakMap<Level, WeakMap<SkiSpec, Par>>();

/** THE PAR of `level`'s slalom on `spec`. Kept per map and pair; a map with
 * no slalom has none. */
export function slalomPar(level: Level, spec: SkiSpec): Par | null {
  const sl = level.slalom;
  if (!sl) return null;
  let bySpec = pars.get(level);
  if (!bySpec) {
    bySpec = new WeakMap();
    pars.set(level, bySpec);
  }
  const known = bySpec.get(spec);
  if (known) return known;
  const ds = PAR.step;
  const n = Math.max(2, Math.ceil((sl.to - sl.from) / ds) + 1);
  const cap = new Float64Array(n);
  const pull = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const s = sl.from + i * ds;
    const y0 = trackPointAt(level, s).y;
    const y1 = trackPointAt(level, s + 2).y;
    const grade = Math.atan(Math.max(0, (y0 - y1) / 2));
    let v = terminalSpeed(spec, grade, PAR.crouch);
    const k = slalomLineFast(level, s)?.curvature ?? 0;
    if (k > 1e-4) {
      v = Math.min(v, Math.sqrt((cornerGrip(spec, 1) * PAR.grip) / k), (PAR.turn * PAR.pace) / k);
    }
    cap[i] = Math.max(1, v);
    pull[i] = Math.max(0.3, TUNING.g * Math.sin(grade) * PAR.pull);
  }
  // Gathered from the hut, then shed before every bend that asks it.
  const v = new Float64Array(n);
  v[0] = Math.min(cap[0], PAR.push);
  for (let i = 1; i < n; i++) v[i] = Math.min(cap[i], Math.sqrt(v[i - 1] ** 2 + 2 * pull[i] * ds));
  for (let i = n - 2; i >= 0; i--)
    v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * PAR.brake * ds));
  // The clock down it, read at every checkpoint.
  const clock = new Float64Array(n);
  for (let i = 1; i < n; i++) clock[i] = clock[i - 1] + (2 * ds) / (v[i - 1] + v[i]);
  const at = (s: number): number => {
    const f = Math.min(n - 1, Math.max(0, (s - sl.from) / ds));
    const i = Math.min(n - 2, Math.floor(f));
    return (clock[i] + (clock[i + 1] - clock[i]) * (f - i)) * PAR.scale;
  };
  const splits = level.checkpoints.map((c) => at(c.s));
  const par: Par = { time: splits[splits.length - 1], splits };
  bySpec.set(spec, par);
  return par;
}

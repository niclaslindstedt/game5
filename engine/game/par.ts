// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PAR OF A SLALOM (R31) — how long a good racer takes down the course,
// and the clock at each of its gates, worked out off the course itself
// rather than skied: the line a racer takes round the poles (`race-line.ts`
// — the setter's line, rounded out on a steep pitch), the pitch under it and what a pair can do on it (`limits.ts`). The field's times
// are dealt about it (`field.ts`), so a racer of the field is never skied
// by anyone — only one racer is ever on a slalom course, and what the
// player races is the board.
//
// THE SPEED DOWN THE LINE, at every half metre, is what the pitch gives a
// racer stood half up — its pull less the base's friction and the air's
// drag — under what the edge's grip holds round the line's bend with the
// skis CUT HARD by a slalom racer's technique (`cutGrip` under
// `SLALOM_TECHNIQUE`), at `PAR.pace` of it as the bot plans it — the rest
// of the grip is the edge rolling from one turn into the next — then held
// to what he can gather from the hut (`PAR.push`, then the pitch) and shed
// before a bend (`PAR.brake`). The clock is that profile integrated, and
// `PAR.scale` is the measured share of it the bot's own slalom takes over
// the campaign's fourteen slaloms and seeds 1–16, every one within 5 % of
// it (the field's best is dealt about par, so par is a good
// racer's clean run, and the bot one of the field).

import { trackPointAt } from "../mapgen/index.ts";
import type { Level } from "../mapgen/types.ts";
import { totalMass, type SkiSpec } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { SLALOM_TECHNIQUE } from "./defs/technique.ts";
import { lineSpeed, raceLineAt, raceSpanAt } from "./race-line.ts";

/** The par's numbers. Metres, seconds. */
export const PAR = {
  /** The step the line is walked in, m. */
  step: 0.5,
  /** The share of the cut-hard corner grip a line's bend is skied at —
   * the rest is the edge rolling between two turns (the bot's own
   * `slalomPace`). */
  pace: 0.65,
  /** ...and the time he runs between two turns crossing from one edge to
   * the next, s (the bot's own `slalomCross`). */
  cross: 0.15,
  /** How far up out of the tuck a slalom racer skis, 0 tall … 1 folded
   * (the bot's own `slalomStance`). */
  crouch: 0.3,
  /** Out of the hut: the speed the push gives, m/s, and the share of the
   * pitch's pull he keeps between the poles. */
  push: 3,
  pull: 0.9,
  /** The most he sheds before a bend, m/s². */
  brake: 4,
  /** A good racer's time as a share of the line's own. */
  scale: 1.14,
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
    const grade = Math.atan((y0 - y1) / 2);
    let v = Infinity;
    const k = raceLineAt(level, s)?.curvature ?? 0;
    if (k > 1e-4) {
      v = lineSpeed(spec, SLALOM_TECHNIQUE, k, raceSpanAt(level, s), 1, PAR.pace, PAR.cross);
    }
    cap[i] = Math.max(1, v);
    pull[i] = TUNING.g * (Math.sin(grade) - TUNING.snow.crrPacked * Math.cos(grade)) * PAR.pull;
  }
  // Gathered from the hut — the pitch's pull less the base's friction and
  // the air's drag on him half up out of the tuck, so a flatter stretch is
  // coasted with what he brought to it — then shed before every bend that
  // asks it.
  const air =
    (0.5 * TUNING.airDensity * (spec.cdAUpright + (spec.cdATuck - spec.cdAUpright) * PAR.crouch)) /
    totalMass(spec);
  const v = new Float64Array(n);
  v[0] = Math.min(cap[0], PAR.push);
  for (let i = 1; i < n; i++) {
    const gain = 2 * ds * (pull[i] - air * v[i - 1] ** 2);
    v[i] = Math.min(cap[i], Math.sqrt(Math.max(1, v[i - 1] ** 2 + gain)));
  }
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

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

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { trackPointAt } from "../mapgen/index.ts";
import type { Level, SpeedCourse, TrackPoint } from "../mapgen/types.ts";
import { DOWNHILL, GIANT_SLALOM, SKI_CROSS, SLALOM, SPEED_SKI, SUPER_G } from "./defs/modes.ts";
import { skisById, totalMass, type SkiSpec } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import {
  DOWNHILL_TECHNIQUE,
  GIANT_SLALOM_TECHNIQUE,
  SLALOM_TECHNIQUE,
  SUPER_G_TECHNIQUE,
  type Technique,
} from "./defs/technique.ts";
import { lineBendAt } from "./course.ts";
import { brakeDecel, carveSpeedOf, cutGrip } from "./limits.ts";
import { lineSpeed, raceLineAt, raceSpanAt } from "./race-line.ts";
import { NEUTRAL_INPUT, type SkierInput } from "./state.ts";
import { createGame, step } from "./step.ts";
import { botInput } from "../sim/bot.ts";

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

/** A race's par: the whole run, s, and the clock at each checkpoint —
 * the start gate's 0 first, the finish's the run — and, on a downhill,
 * the speed through its trap, m/s (0 on a slalom). */
export type Par = { time: number; splits: number[]; trap: number };

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
  const par: Par = { time: splits[splits.length - 1], splits, trap: 0 };
  bySpec.set(spec, par);
  return par;
}

/** THE DOWNHILL'S PAR NUMBERS (R32): the bot's own way of reading a
 * downhill (`sim/bot.ts`), so par is the run a good racer makes of it. */
export const DOWNHILL_PAR = {
  /** The step the piste is walked in, m. */
  step: 1,
  /** How far either side a bend is read over, m (the bot's `bendSpan`). */
  span: 8,
  /** The share of the corner grip a bend is taken at (the bot's
   * `cornerShare`). */
  corner: 0.7,
  /** A bend the downhill ski carves only slower than this share of what
   * its grip holds is skidded round at the grip instead. */
  skidded: 0.6,
  /** The share of the skid's grip he plans to brake on before a bend (the
   * bot's `brakeShare`). */
  brake: 0.7,
  /** Out of the house: the push, m/s. */
  push: 3,
  /** A good racer's time as a share of the profile's own, and his speed
   * through the trap as a share of the profile's there — the measured share
   * of each the bot's own downhill takes over seeds 1–16 (`make sim
   * ARGS="--mode downhill --skis eagle --count 16"`): its time within
   * −9 … +7 % of the profile's on every seed and 1.01 of it on the mean,
   * its trap speed 0.97 of the profile's — so par is the profile's own
   * clock, and the bot one of the field about it. */
  scale: 1,
  trap: 0.97,
} as const;

/** THE SUPER-G'S PAR NUMBERS (R33): the downhill's way of reading a
 * speed course, its time and trap shares the bot's own super-G's over seeds
 * 1–16 (`make sim ARGS="--mode superG --skis falcon --count 16"`): its time
 * within −5 … +10 % of the profile's on every seed it finished and 1.03 of
 * it on the mean — the gates' swing the profile reads as the line's bend
 * and no more — its trap speed the profile's within a few per cent. On the
 * super-G ski the nine race maps' bot runs −3 … +5 % of par (`make rate
 * RACE=superG`), as close as it ran on the downhill ski. */
export const SUPER_G_PAR = {
  ...DOWNHILL_PAR,
  scale: 1.03,
  trap: 0.97,
} as const;

/** THE GIANT SLALOM'S PAR NUMBERS (R36): the super-G's way of reading a
 * course on a racing line, its time share the bot's own giant slalom's
 * over seeds 1–16 (`make sim ARGS="--mode giantSlalom --skis chough
 * --count 16"`): the bot's time 1.03–1.15 of the profile's, 1.11 on the
 * median — a turn every twenty-odd metres scrubs more than the profile's
 * bends read. It has no speed trap. */
export const GIANT_SLALOM_PAR = {
  ...DOWNHILL_PAR,
  scale: 1.11,
  trap: 0,
} as const;

type SpeedParRule = typeof DOWNHILL_PAR | typeof SUPER_G_PAR | typeof GIANT_SLALOM_PAR;

const downhillPars = new WeakMap<Level, WeakMap<SkiSpec, Par>>();
const superGPars = new WeakMap<Level, WeakMap<SkiSpec, Par>>();
const giantSlalomPars = new WeakMap<Level, WeakMap<SkiSpec, Par>>();
const qa: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };

/** THE PAR of `level`'s downhill on `spec` (R32): the speed down the
 * piste at every metre — what the pitch gives a racer most of the way
 * into his tuck, its pull less the base's friction and the air's drag,
 * under what his skis CUT HARD hold round the racing line's bend
 * (`cutGrip`, `lineBendAt`) and what the downhill ski carves at all
 * (`carveSpeedOf`) — gathered from the house, tucked under the speed the
 * bends within his braking reach allow and stood up over it, cut back at
 * every bend to what it holds; the clock that profile, read at every gate, times
 * `DOWNHILL_PAR.scale`. Kept per map and pair; a map with no downhill has
 * none. */
export function downhillPar(level: Level, spec: SkiSpec): Par | null {
  const dh = level.downhill;
  return dh ? speedPar(level, dh, spec, DOWNHILL_TECHNIQUE, DOWNHILL_PAR, downhillPars) : null;
}

/** THE PAR of `level`'s super-G on `spec` (R33): the downhill's forward
 * reckoning (`downhillPar`) down the super-G's swung line, under the
 * super-G racer's technique. A map with no super-G has none. */
export function superGPar(level: Level, spec: SkiSpec): Par | null {
  const sg = level.superG;
  return sg ? speedPar(level, sg, spec, SUPER_G_TECHNIQUE, SUPER_G_PAR, superGPars) : null;
}

/** THE PAR of `level`'s giant slalom on `spec` (R36): the downhill's
 * forward reckoning (`downhillPar`) down the giant slalom's swung line,
 * under the giant slalom racer's technique. A map with no giant slalom has
 * none. */
export function giantSlalomPar(level: Level, spec: SkiSpec): Par | null {
  const gs = level.giantSlalom;
  return gs
    ? speedPar(level, gs, spec, GIANT_SLALOM_TECHNIQUE, GIANT_SLALOM_PAR, giantSlalomPars)
    : null;
}

/** A speed course's par, worked out once a map and pair. */
function speedPar(
  level: Level,
  dh: SpeedCourse,
  spec: SkiSpec,
  T: Technique,
  P: SpeedParRule,
  pars: WeakMap<Level, WeakMap<SkiSpec, Par>>,
): Par {
  let bySpec = pars.get(level);
  if (!bySpec) {
    bySpec = new WeakMap();
    pars.set(level, bySpec);
  }
  const known = bySpec.get(spec);
  if (known) return known;
  const ds = P.step;
  const n = Math.max(2, Math.ceil((dh.to - dh.from) / ds) + 1);
  const cap = new Float64Array(n);
  const pull = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const s = dh.from + i * ds;
    const y0 = trackPointAt(level, s, qa).y;
    const y1 = trackPointAt(level, s + 2, qa).y;
    const grade = Math.atan((y0 - y1) / 2);
    pull[i] = TUNING.g * (Math.sin(grade) - TUNING.snow.crrPacked * Math.cos(grade));
    const k = Math.abs(lineBendAt(level, s, P.span));
    let v = Infinity;
    if (k > 1e-4) {
      const still = Math.sqrt((cutGrip(spec, 0, T) * P.corner) / k);
      v = Math.sqrt((cutGrip(spec, still, T) * P.corner) / k);
      // ...no faster than the downhill ski carves it — where it carves it
      // at all at a racer's pace: a bend it can only just carve is skidded
      // round at the edge's grip instead.
      const carve = carveSpeedOf(spec, k, T);
      if (carve > P.skidded * v) v = Math.min(v, carve);
    }
    cap[i] = Math.max(4, v);
  }
  // The air's drag a kilo: folded in the tuck, and stood up out of it.
  const mass = totalMass(spec);
  const tucked = (0.5 * TUNING.airDensity * spec.cdATuck) / mass;
  const stood = (0.5 * TUNING.airDensity * spec.cdAUpright) / mass;
  const brake = brakeDecel(spec, 1) * P.brake;
  const height = new Float64Array(n);
  for (let i = 0; i < n; i++) height[i] = trackPointAt(level, dh.from + i * ds, qa).y;
  const v = new Float64Array(n);
  v[0] = Math.min(cap[0], P.push);
  for (let i = 1; i < n; i++) {
    // THE SPEED HE ALLOWS HIMSELF: the slowest any bend within his braking
    // reach holds, with the room he has to brake for it less what the fall
    // of the piste gives back (the bot's own `speedAllowed`). Over it he
    // stands up out of the tuck into the air's drag; under it he tucks —
    // on a downhill's pitches no check sheds speed the fall does not give
    // straight back, so standing up is the brake that tells.
    const u = v[i - 1];
    const reach = Math.min(n - 1, i + Math.ceil(((u * u) / (2 * brake) + 30) / ds));
    let allowed = Infinity;
    for (let j = i; j <= reach; j++) {
      if (cap[j] >= allowed) continue;
      const d = (j - i) * ds;
      const drop = Math.max(0, height[i] - height[j]);
      const room = Math.max(0, 2 * brake * Math.max(0, d - 6) - 2 * TUNING.g * drop);
      allowed = Math.min(allowed, Math.sqrt(cap[j] * cap[j] + room));
    }
    const air = u > allowed ? stood : tucked;
    const gain = 2 * ds * (pull[i] - air * u * u);
    v[i] = Math.min(cap[i], Math.sqrt(Math.max(1, u * u + gain)));
  }
  const clock = new Float64Array(n);
  for (let i = 1; i < n; i++) clock[i] = clock[i - 1] + (2 * ds) / (v[i - 1] + v[i]);
  const at = (s: number): number => {
    const f = Math.min(n - 1, Math.max(0, (s - dh.from) / ds));
    const i = Math.min(n - 2, Math.floor(f));
    return (clock[i] + (clock[i + 1] - clock[i]) * (f - i)) * P.scale;
  };
  const splits = level.checkpoints.map((c) => at(c.s));
  // A speed event's trap speed; a giant slalom has no trap.
  const trapS = dh.trap?.s;
  const ti =
    trapS === undefined ? 0 : Math.min(n - 1, Math.max(0, Math.round((trapS - dh.from) / ds)));
  const par: Par = {
    time: splits[splits.length - 1],
    splits,
    trap: trapS === undefined ? 0 : v[ti] * P.trap,
  };
  bySpec.set(spec, par);
  return par;
}

/** SPEED SKIING'S PAR NUMBERS (R34): the most a par run is skied for, s,
 * and the step the profile is walked in where it cannot be skied, m. */
export const SPEED_SKI_PAR = {
  limit: 90,
  step: 0.5,
} as const;

const speedSkiPars = new WeakMap<Level, WeakMap<SkiSpec, Par>>();
const TUCKED: SkierInput = { ...NEUTRAL_INPUT, tuck: 1 };

/** THE PAR of `level`'s speed-skiing run on `spec` (R34): the run itself,
 * SKIED — out of the house in a full tuck, the skis flat, straight down the
 * track to the timing zone's bottom line, in the run's own weather and its
 * wind and over the new snow it lays — which is the cleanest run there is,
 * a racer's whole craft on a speed track being to hold it. Nothing a
 * profile can be walked by sees what the physics does to him in a
 * compression at 55 m/s or in a headwind, and the race is decided by tenths
 * of a km/h. The splits are the start gate's 0, the zone's top line's 0
 * (the clock started again there) and the time through it; the trap its
 * length over that time. A map with no speed track has none. */
export function speedSkiPar(level: Level, spec: SkiSpec): Par | null {
  const sk = level.speedSki;
  if (!sk) return null;
  let bySpec = speedSkiPars.get(level);
  if (!bySpec) {
    bySpec = new WeakMap();
    speedSkiPars.set(level, bySpec);
  }
  const known = bySpec.get(spec);
  if (known) return known;
  const run = createGame({
    level,
    seed: level.seed,
    mode: "speedSki",
    spec,
    rivals: 0,
    countdown: 0,
    quiet: true,
    // The final's track is the final's.
    heat: sk.run === 2 ? { run: 2, player: 0, field: [] } : undefined,
  });
  for (let i = 0; i < SPEED_SKI_PAR.limit * TUNING.physicsHz && !run.progress.finished; i++) {
    step(run, TUCKED);
  }
  const p = run.progress;
  const time = p.finished && !p.out ? p.time : profileTime(level, spec);
  const par: Par = { time, splits: [0, 0, time], trap: sk.zone.length / time };
  bySpec.set(spec, par);
  return par;
}

/** The time through `level`'s timing zone of a full tuck walked down the
 * profile — the pitch's pull less the air's drag and the base's friction —
 * where the track cannot be skied clean. */
function profileTime(level: Level, spec: SkiSpec): number {
  const sk = level.speedSki;
  if (!sk) return 0;
  const ds = SPEED_SKI_PAR.step;
  const tucked = (0.5 * TUNING.airDensity * spec.cdATuck) / totalMass(spec);
  let v: number = TUNING.start.speed;
  let zone = 0;
  let y0 = trackPointAt(level, sk.from, qa).y;
  for (let s = sk.from; s < sk.zone.to - 1e-9; s += ds) {
    const y1 = trackPointAt(level, s + ds, qa).y;
    const len = hypot(ds, y0 - y1);
    const pull = TUNING.g * ((y0 - y1 - TUNING.snow.crrPacked * ds) / len);
    const v1 = Math.sqrt(Math.max(0.01, v * v + 2 * len * (pull - tucked * v * v)));
    if (s >= sk.zone.from) zone += (2 * len) / (v + v1);
    v = v1;
    y0 = y1;
  }
  return Math.max(zone, 1e-3);
}

/** THE SKI CROSS'S PAR: the most a qualification run is given, s, before it
 * is called a run that will not come home. */
export const SKI_CROSS_PAR = {
  limit: 200,
} as const;

const skiCrossPars = new WeakMap<Level, WeakMap<SkiSpec, Par>>();

/** THE PAR of `level`'s ski cross on `spec` (R35): a clean qualification
 * run, SKIED — out of the start gate, through its berms, over its rollers
 * and its jumps, alone, in the race's weather — by the bot, the field's
 * own stand-in: no profile walks a banked turn or a table's landing the
 * way the physics does. The splits are the clock at every gate. A map
 * with no ski cross has none; one whose run did not come home has none. */
export function skiCrossPar(level: Level, spec: SkiSpec): Par | null {
  if (!level.skiCross) return null;
  let bySpec = skiCrossPars.get(level);
  if (!bySpec) {
    bySpec = new WeakMap();
    skiCrossPars.set(level, bySpec);
  }
  const known = bySpec.get(spec);
  if (known) return known;
  const run = createGame({
    level,
    seed: level.seed,
    mode: "skiCross",
    spec,
    rivals: 0,
    countdown: 0,
    quiet: true,
  });
  for (let i = 0; i < SKI_CROSS_PAR.limit * TUNING.physicsHz && !run.progress.finished; i++) {
    step(run, botInput(run));
  }
  const p = run.progress;
  if (!p.finished || p.out) return null;
  const par: Par = { time: p.time, splits: [...p.splits], trap: 0 };
  bySpec.set(spec, par);
  return par;
}

/** THE PAR OF THE RACE SET ON `level` — a slalom's, a downhill's, a
 * super-G's, a giant slalom's, a speed track's or a ski cross's — on the pair its field
 * races on; null on a
 * map with no course set. */
export function raceParOf(level: Level): Par | null {
  if (level.downhill) return downhillPar(level, skisById(DOWNHILL.skis));
  if (level.superG) return superGPar(level, skisById(SUPER_G.skis));
  if (level.giantSlalom) return giantSlalomPar(level, skisById(GIANT_SLALOM.skis));
  if (level.speedSki) return speedSkiPar(level, skisById(SPEED_SKI.skis));
  if (level.skiCross) return skiCrossPar(level, skisById(SKI_CROSS.skis));
  return slalomPar(level, skisById(SLALOM.skis));
}

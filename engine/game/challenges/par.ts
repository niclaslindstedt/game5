// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PAR OF A TIMED LINE — how long a good free skier takes from its start
// gate to its finish, worked out off the line itself rather than skied, in
// the slalom par's mould (`../par.ts`) and on the bot's own reading of a
// piste (`sim/bot.ts`'s `speedAllowed`), since the bot is the competent
// skier the medals are measured against:
//
//   * THE BEND: the run's heading turned over a span either side, taken at
//     a share of the corner grip less a share of the pitch's pull out of a
//     turn across it (never under a floor of that grip), at the grip left
//     at that speed, and no faster than the pair carves it
//     (`carveSpeedOf`).
//   * THE PITCH: what it gives him most of the way into his tuck — its
//     pull less the base's friction and, where the snow lies loose, the
//     powder's drag, and the air's — from the speed he skis in at, under a
//     free skier's top speed.
//   * THE BRAKE: every bend within his skid's reach come to at what the
//     skid sheds less a share of what the fall to it gives back.
//
// The clock is that profile integrated, times the share of it the bot's
// own runs take (`CHALLENGES.par.scale`): par is a competent skier's clean
// run, and the medals are shares of it (`CHALLENGES.medals`), both
// measured with `make challenges-table`.

import { angleDiff, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { trackPointAt } from "../../mapgen/index.ts";
import type { Level, TrackPoint } from "../../mapgen/types.ts";
import { RIDER_BOT } from "../../sim/bot.ts";
import { CHALLENGES } from "../defs/challenges.ts";
import { SKIS, totalMass, type SkiSpec } from "../defs/skis.ts";
import { TUNING } from "../defs/tuning.ts";
import { brakeDecel, carveSpeedOf, cornerGrip } from "../limits.ts";
import type { DealtRun } from "./common.ts";

const P = CHALLENGES.par;
const qa: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
const qb: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };

/** THE PAR, s, of the line down `run` from arc `from` to `to` on `spec`
 * (the reference pair when left out) — and, handed `profile`, the speed it
 * reckons at every `CHALLENGES.par.step` m, m/s (a lab's trace). */
export function linePar(
  level: Level,
  run: DealtRun,
  from: number,
  to: number,
  spec: SkiSpec = SKIS,
  profile?: number[],
): number {
  const ds = P.step;
  const n = Math.max(2, Math.ceil((to - from) / ds) + 1);
  const cap = new Float64Array(n);
  const pull = new Float64Array(n);
  const fall = new Float64Array(n);
  const packs = new Float64Array(n);
  const air =
    (0.5 * TUNING.airDensity * (spec.cdAUpright + (spec.cdATuck - spec.cdAUpright) * P.crouch)) /
    totalMass(spec);
  const span = RIDER_BOT.bendSpan;
  const share = P.corner;
  for (let i = 0; i < n; i++) {
    const s = Math.min(to, from + i * ds);
    const a = trackPointAt(run, s, qa);
    const ax = a.x;
    const az = a.z;
    const ay = a.y;
    const b = trackPointAt(run, s + ds, qb);
    fall[i] = ay - b.y;
    const grade = Math.atan2(ay - b.y, Math.max(0.1, hypot(b.x - ax, b.z - az)));
    const packed = level.packedAt(ax, az);
    packs[i] = packed;
    const crr = TUNING.snow.crrPacked * packed + TUNING.snow.crrPowder * (1 - packed);
    pull[i] = TUNING.g * (Math.sin(grade) - crr * Math.cos(grade));
    const h0 = trackPointAt(run, s - span, qa).heading;
    const h1 = trackPointAt(run, s + span, qb).heading;
    const k = Math.abs(angleDiff(h1, h0)) / (2 * span);
    if (k < 1e-4) {
      cap[i] = P.most;
      continue;
    }
    const pitch = Math.max(0, Math.tan(grade));
    const out = TUNING.g * (pitch / hypot(1, pitch)) * P.pitchPull;
    const turnOn = (v: number) => {
      const g = cornerGrip(spec, 1, v) * share;
      return Math.max(g - out, g * P.pitchFloor);
    };
    let corner = Math.sqrt(turnOn(Math.sqrt(turnOn(0) / k)) / k);
    const carve = carveSpeedOf(spec, k);
    if (carve > 0) corner = Math.min(corner, carve);
    cap[i] = Math.min(P.most, Math.max(P.crawl, corner));
  }
  // Gathered from the speed he skis in at, and held at every step under
  // what the bends within his braking reach allow: each come to at what
  // his skid sheds less what the fall of the run gives back on the way —
  // the bot's own look ahead, so a bend far down a steep pitch slows him
  // only once it is near.
  const decel = brakeDecel(spec, 1) * RIDER_BOT.brakeShare;
  const allowed = (i: number, speed: number): number => {
    const reach = (speed * speed) / (2 * decel) + P.reach;
    let most = Infinity;
    let drop = 0;
    for (let j = i; j < n && (j - i) * ds <= reach; j++) {
      if (j > i) drop += fall[j - 1];
      if (cap[j] >= P.most) continue;
      const owed =
        2 * decel * Math.max(0, (j - i) * ds - P.runup) - 2 * TUNING.g * P.fall * Math.max(0, drop);
      most = Math.min(most, Math.sqrt(Math.max(P.crawl ** 2, cap[j] ** 2 + owed)));
    }
    return most;
  };
  const v = new Float64Array(n);
  v[0] = Math.min(P.entry, allowed(0, P.entry));
  for (let i = 1; i < n; i++) {
    const loose = TUNING.g * TUNING.snow.powderDrag * v[i - 1] * (1 - packs[i - 1]);
    const gain = 2 * ds * (pull[i - 1] - loose - air * v[i - 1] ** 2);
    const free = Math.sqrt(Math.max(1, v[i - 1] ** 2 + gain));
    v[i] = Math.min(
      free,
      P.most,
      Math.max(allowed(i, free), Math.sqrt(Math.max(1, v[i - 1] ** 2 - 2 * decel * ds))),
    );
  }
  if (profile) profile.push(...v);
  let time = 0;
  for (let i = 1; i < n; i++) time += (2 * ds) / (v[i - 1] + v[i]);
  return time * P.scale;
}

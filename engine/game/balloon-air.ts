// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR A HOT AIR BALLOON FLIES IN (`balloon.ts`) — on a balloon ride and
// nowhere else.
//
//   * THE UP-VALLEY WIND. On a fine day the sun warms the slopes, the air
//     over them rises, and the valley's air flows UP the valley toward the
//     summit to replace it — the anabatic and valley winds a mountain
//     balloonist plans his day on. On a balloon ride the map's own wind
//     (`windAt`: its strength and its gusts) is turned to blow that way:
//     toward the summit from wherever the balloon is, carrying on over the
//     ridge once it is near it. Its strength is the day's up-valley breeze
//     (`BALLOON_AIR.valley`) and the map's own wind on top of it — a calm
//     day a gentle drift, a storm far past anything a pilot takes off in.
//   * THE GRADIENT. Over the snow the wind grows with height by the log
//     law (`profileAt`), up to the layer's top: a balloon that climbs meets
//     a faster wind than the basket it left, and the shear between them is
//     what pushes an envelope over.
//   * THE VEER. The wind turns with height (`veer`, one way or the other
//     by the map's seed): what a balloonist steers by — climbing or sinking
//     into a layer that blows a little to one side.
//   * THE ATMOSPHERE: the air's temperature falling with altitude at the
//     standard lapse, its pressure by the barometric law, and its density.
//
// Pure over the map, the place and the clock: nothing here draws from the
// stream, and no other run reads it, so no digest can see it.

import { clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";

import { BALLOON } from "./defs/balloon.ts";
import { profileAt, windAt, type Wind } from "./wind.ts";
import type { Level } from "../mapgen/types.ts";

/** THE UP-VALLEY WIND's own numbers: the day's breeze at 10 m, m/s (2–4 on
 * a fine winter day); the top of the layer the log law grows to, m; how
 * near the summit, m, the wind stops converging on it and carries on over
 * the ridge; the most the wind turns with height, rad, and the height over
 * the snow it has turned that far by, m; the slow swing of its bearing,
 * rad, and its period, s; and the flow's rise along the slope
 * (`balloonRiseAt`): the span the slope is read over, m, the depth over
 * the snow it dies out in, m, and the steepest slope it follows. */
export const BALLOON_AIR = {
  valley: 2.5,
  top: 400,
  near: 250,
  veer: 0.35,
  veerDepth: 500,
  sway: 0.06,
  swayPeriod: 97,
  span: 40,
  depth: 120,
  steepest: 0.6,
} as const;

const A = BALLOON_AIR;
const K = BALLOON.air;
const carry: Wind = { x: 0, z: 0, speed: 0, gust: 0 };

/** A sign (±1) and a phase hashed off a seed — the map's veer and sway. */
function hashOf(seed: number): number {
  let h = Math.imul((seed ^ 0x6b1a5e) >>> 0, 0x9e3779b1) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca77) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** THE WAY TO THE SUMMIT from (x, z), rad: straight at it from afar, the
 * mountain's own axis (from its base to its summit) once near it — so the
 * flow carries on over the ridge. A map with no mountain (a synthetic one)
 * is blown up its fall line: −z. */
export function upValley(level: Pick<Level, "mountain">, x: number, z: number): number {
  const m = level.mountain;
  if (!m) return Math.PI;
  const axis = Math.atan2(m.summit.x - m.base.x, m.summit.z - m.base.z);
  const dx = m.summit.x - x;
  const dz = m.summit.z - z;
  const d = hypot(dx, dz);
  if (d < 1) return axis;
  const at = Math.atan2(dx, dz);
  // Near the summit, eased onto the axis.
  const w = clamp(1 - d / A.near, 0, 1);
  let off = axis - at;
  off = Math.atan2(Math.sin(off), Math.cos(off));
  return at + off * w;
}

/** The wind a balloon meets at (x, y, z) at run time `t`, m/s, world frame,
 * into `out` (its `gust` the map's own). */
export function balloonWindAt(
  level: Pick<Level, "seed" | "weather" | "mountain" | "groundAt">,
  t: number,
  x: number,
  y: number,
  z: number,
  out: Wind,
): Wind {
  windAt(level, t, carry);
  const agl = Math.max(0.5, y - level.groundAt(x, z));
  // The day's breeze and the map's own wind, summed as two flows at right
  // angles would be: a calm map is the breeze, a stormy one its storm.
  const speed = hypot(A.valley, carry.speed) * profileAt(Math.min(agl, A.top));
  const u = hashOf(level.seed);
  const side = u < 0.5 ? -1 : 1;
  const veer =
    side * A.veer * clamp(agl / A.veerDepth, 0, 1) +
    A.sway * Math.sin((2 * Math.PI * t) / A.swayPeriod + u * 2 * Math.PI);
  const toward = upValley(level, x, z) + veer;
  out.x = Math.sin(toward) * speed;
  out.z = Math.cos(toward) * speed;
  out.speed = speed;
  out.gust = carry.gust;
  return out;
}

/** THE AIR'S RISE at (x, y, z) in the wind `w` (`balloonWindAt`'s), m/s:
 * the up-valley flow follows the slope it climbs — the anabatic wind is a
 * flow ALONG the warmed snow — rising at the wind's speed times the
 * ground's rise along its way (read across `BALLOON_AIR.span`), dying out
 * with height over the ground in `BALLOON_AIR.depth`. A balloon is carried
 * up a slope by it, if not as fast as the slope rises under a fast drift. */
export function balloonRiseAt(
  level: Pick<Level, "groundAt">,
  x: number,
  y: number,
  z: number,
  w: Wind,
): number {
  const ground = level.groundAt(x, z);
  const agl = Math.max(0, y - ground);
  if (w.speed < 0.01) return 0;
  const ux = w.x / w.speed;
  const uz = w.z / w.speed;
  const s = A.span;
  const rise =
    (level.groundAt(x + ux * s, z + uz * s) - level.groundAt(x - ux * s, z - uz * s)) / (2 * s);
  return w.speed * clamp(rise, -A.steepest, A.steepest) * Math.exp(-agl / A.depth);
}

/** THE AIR'S ALTITUDE above the sea at a height `y` of the map's frame, m. */
export function seaAltitude(level: Pick<Level, "mountain">, y: number): number {
  return y - (level.mountain?.sea ?? 0);
}

/** THE AIR'S TEMPERATURE at an altitude above the sea, K (the standard
 * lapse off a winter day's sea-level air). */
export function airKelvin(altitude: number): number {
  return 273.15 + K.sea - K.lapse * Math.max(0, altitude);
}

/** THE AIR'S PRESSURE at an altitude above the sea, Pa (the barometric law
 * of the standard atmosphere). */
export function airPressure(altitude: number): number {
  return K.pressure * Math.pow(1 - (0.0065 * Math.max(0, altitude)) / 288.15, 5.2559);
}

/** The density of air at `pressure`, Pa, and `kelvin`, kg/m³. */
export function airDensity(pressure: number, kelvin: number): number {
  return pressure / (K.gas * kelvin);
}

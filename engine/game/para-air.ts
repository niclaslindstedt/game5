// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR A PARAMOTOR'S WING FLIES IN (`para.ts`) — the weather's wind as a
// soft wing meets it, which is a lot more than a skier's (`wind.ts`'s
// `airAt`). A wing that flies at 55 km/h is moved bodily by a wind of half
// that, and kept up or pushed down by the air's own rise and fall; so:
//
//   * THE MEAN WIND aloft: the dealt 10 m wind (`windAt`, its gusts and its
//     veer) grown with height by the log law up to the boundary layer's top,
//     and exposed by the AIR'S altitude up the mountain, not the ground's —
//     the higher he flies, the harder it blows. The woods shelter it only
//     below their crowns.
//   * THE AIR'S RISE AND FALL over the ground (`lift`): the flow follows the
//     slopes it meets, rising at the wind's speed times the slope where it
//     blows up one — RIDGE LIFT, what keeps a soaring wing up — and sinking
//     where it blows down one. Read at two scales (a spur's flank, the whole
//     face), each dying out with height over the ground in the depth its
//     slopes reach. Down a slope the flow SEPARATES: less of the sink is
//     kept as a smooth sink and the rest is the LEE's rotor.
//   * THE TURBULENCE: eddies frozen into the wind and carried down it
//     (Taylor's hypothesis), three octaves of them on a 5/3 law, their
//     strength a share of the mean wind — some of it in the open air, more
//     near the snow (mechanical turbulence), much more in the lee and over
//     the woods, more again in a storm. Its vertical part is what changes a
//     wing's angle of attack, and read at both tips (`eddyUp`) it is what
//     rolls a wing and folds one side of it.
//
// Pure over the map, the place and the clock, as `wind.ts` is: nothing here
// draws from the stream. Every number is `PARA.air`'s.

import { clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";

import { PARA } from "./defs/para.ts";
import { TUNING } from "./defs/tuning.ts";
import { weatherOf } from "../mapgen/index.ts";
import { profileAt, shelterAt, windAt, type AirLevel, type Wind } from "./wind.ts";

const A = PARA.air;

/** The air at a point, as the wing meets it. */
export type ParaAir = {
  /** The air's velocity, m/s, world frame — its rise `y` included. */
  x: number;
  y: number;
  z: number;
  /** The mean wind's horizontal speed there, m/s (before the eddies). */
  mean: number;
  /** The air's rise off the ground's slopes, m/s (before the eddies). */
  lift: number;
  /** How rough the air is: the eddies' strength, m/s (one sigma). */
  rough: number;
  /** How far into a lee the point lies, 0..1. */
  lee: number;
};

/** A phase in [0, 2π) hashed from a seed and a salt. */
function hashed(seed: number, salt: number): number {
  let h = Math.imul((seed ^ Math.imul(salt, 0x27d4eb2d)) >>> 0, 0x9e3779b1) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca77) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** THE EDDIES: per component (x, up, z), two waves an octave, each with
 * its own direction and phase off the map's seed. Built once a seed. */
type Wave = { kx: number; ky: number; kz: number; omega: number; phase: number; amp: number };
const fields = new Map<number, Wave[][]>();

function eddiesOf(seed: number): Wave[][] {
  const had = fields.get(seed);
  if (had) return had;
  const octaves = A.eddies.wavelengths;
  const per = 2;
  // The velocity of an eddy grows as its size to the third (Kolmogorov);
  // the amplitudes normed so each component's variance is one.
  const raw = octaves.map((l) => Math.cbrt(l));
  const norm = Math.sqrt(2 / (per * raw.reduce((s, r) => s + r * r, 0)));
  const out: Wave[][] = [];
  for (let c = 0; c < 3; c++) {
    const waves: Wave[] = [];
    for (let o = 0; o < octaves.length; o++) {
      for (let k = 0; k < per; k++) {
        const salt = 101 + c * 37 + o * 7 + k;
        const az = hashed(seed, salt) * Math.PI * 2;
        const el = (hashed(seed, salt + 500) - 0.5) * 0.9;
        const n = (Math.PI * 2) / octaves[o];
        waves.push({
          kx: Math.cos(el) * Math.sin(az) * n,
          ky: Math.sin(el) * n,
          kz: Math.cos(el) * Math.cos(az) * n,
          // An eddy turns over in about the time the wind takes to cross it
          // a few times — it lives while it is carried.
          omega: n * A.eddies.churn,
          phase: hashed(seed, salt + 900) * Math.PI * 2,
          amp: raw[o] * norm,
        });
      }
    }
    out.push(waves);
  }
  fields.set(seed, out);
  return out;
}

const carry: Wind = { x: 0, z: 0, speed: 0, gust: 0 };

/** One component of the eddies at a point, in units of sigma. */
function eddy(seed: number, c: number, t: number, x: number, y: number, z: number): number {
  const waves = eddiesOf(seed)[c];
  // Frozen into the wind and carried down it.
  const px = x - carry.x * t;
  const pz = z - carry.z * t;
  let sum = 0;
  for (let i = 0; i < waves.length; i++) {
    const w = waves[i];
    sum += w.amp * Math.sin(w.kx * px + w.ky * y + w.kz * pz + w.omega * t + w.phase);
  }
  return sum;
}

/** The ground's slope at (x, z) over `span` m either side. */
function slopeAt(
  level: AirLevel,
  x: number,
  z: number,
  span: number,
  out: { x: number; z: number },
) {
  out.x = (level.groundAt(x + span, z) - level.groundAt(x - span, z)) / (2 * span);
  out.z = (level.groundAt(x, z + span) - level.groundAt(x, z - span)) / (2 * span);
}
const grad = { x: 0, z: 0 };

/** THE AIR at (x, y, z) at run time `t` — the mean wind there, its rise off
 * the slopes and the eddies in it — into `out`. */
export function paraAirAt(
  level: AirLevel,
  t: number,
  x: number,
  y: number,
  z: number,
  out: ParaAir,
): ParaAir {
  const ground = level.groundAt(x, z);
  const agl = Math.max(1, y - ground);
  // THE MEAN WIND: the 10 m wind, up the log law to the layer's top,
  // exposed by the air's own altitude, sheltered only under the crowns.
  windAt(level, t, carry);
  const m = level.mountain;
  const up = m && m.vertical > 0 ? clamp((y - m.base.y) / m.vertical, 0, 1.3) : 0.5;
  const W = TUNING.wind;
  const exposed = W.valley + (W.summit - W.valley) * up;
  const under = clamp(1 - agl / A.crowns, 0, 1);
  const shelter = 1 - (1 - shelterAt(level, x, z)) * under;
  const k = profileAt(Math.min(agl, A.top)) * exposed * shelter;
  const wx = carry.x * k;
  const wz = carry.z * k;
  const U = hypot(wx, wz);
  // THE RISE AND FALL: the flow along the slopes it meets.
  let lift = 0;
  let lee = 0;
  for (let i = 0; i < A.ridge.length; i++) {
    const r = A.ridge[i];
    slopeAt(level, x, z, r.span, grad);
    const along = clamp(wx * grad.x + wz * grad.z, -U * A.steepest, U * A.steepest);
    const fade = Math.exp(-agl / r.depth);
    if (along >= 0) lift += r.share * along * fade;
    else {
      // Down a slope the flow tears off it: part of it a smooth sink, the
      // rest the rotor's churn.
      lift += r.share * along * A.separate * fade;
      lee = Math.max(lee, clamp(-along / Math.max(1, U) / A.leeSlope, 0, 1) * fade);
    }
  }
  // THE EDDIES: their strength off the mean wind, the snow, the lee, the
  // woods and the storm.
  const E = A.eddies;
  const woods = (1 - shelterAt(level, x, z)) * clamp(1 - (agl - A.crowns) / E.woodsDepth, 0, 1);
  const storm = weatherOf(level).kind === "storm" ? E.storm : 1;
  const rough =
    U *
    storm *
    (E.open + E.ground * Math.exp(-agl / E.groundDepth) + E.lee * lee + E.woods * woods);
  // The vertical eddies are pressed flat against the snow.
  const flat = clamp(agl / E.flat, 0, 1);
  out.x = wx + rough * eddy(level.seed, 0, t, x, y, z);
  out.y = lift + rough * flat * eddy(level.seed, 1, t, x, y, z);
  out.z = wz + rough * eddy(level.seed, 2, t, x, y, z);
  out.mean = U;
  out.lift = lift;
  out.rough = rough;
  out.lee = lee;
  return out;
}

/** The eddies' vertical part alone at another point of the wing, in the
 * same air as the last `paraAirAt` (its `rough`), m/s — what one tip meets
 * that the other does not. */
export function eddyUp(
  level: AirLevel,
  t: number,
  x: number,
  y: number,
  z: number,
  air: ParaAir,
): number {
  const agl = Math.max(1, y - level.groundAt(x, z));
  return air.rough * clamp(agl / A.eddies.flat, 0, 1) * eddy(level.seed, 1, t, x, y, z);
}

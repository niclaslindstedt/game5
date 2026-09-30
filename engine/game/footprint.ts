// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A PAIR OF SKIS IS WORTH ON SNOW — the per-pair half of the snow
// model, read off the spec and nothing else. `snow.ts` states how snow
// behaves under a footprint; this module states how much footprint each
// pair brings to it, as multipliers on the shared numbers. The ALL-MOUNTAIN
// ski (`SKIS`) is the reference every shared number was tuned on, so every
// multiplier here is exactly 1 for it and the model it was measured with is
// unchanged by the catalog existing.
//
// THE PRESSURE is the whole weight over the two skis' area on the snow —
// their length by their waist. It is the planing hull's loading carried over
// (the sink already is — `snow.ts`): a wide ski under the same skier sinks
// less at rest, `(p / p₀)^floatExp`, and comes up onto the top of the snow
// sooner, the planing speed going as √(p / p₀) because the support a ski
// gets from crossing the snow goes as the square of the speed. The same
// sink prices the COMPACTION: the powder drag a ski pays is the work of
// pressing the snow down, which goes as how far it is pressed (Bekker), so
// `sink` scales the powder drag as well as the depth.
//
// THE EDGE bites the groomer with its whole length only on a STIFF ski: a
// soft one bends away from the snow at the tip and the tail and holds on
// its middle, and a ROCKERED tip is lifted off the snow before the edge
// starts — `edge`, on the sideways grip a ski has on packed snow. In powder
// the edge is buried and the ski turns on its BASE, the wider the more, and
// a rockered tip floats and steers there where a cambered one dives —
// `base`, on the sideways grip in powder.
//
// THE ROLL onto an edge: a long stiff ski takes longer to tip over than a
// short soft one, and a WIDE one longer than a narrow one — the boot stands
// further from the edge it has to be tipped onto, which is why a slalom
// ski's 66 mm waist is the quickest thing edge to edge and a powder ski's
// 116 mm the slowest to get there — `edgeRate`, on how fast the edge is
// reached. And a soft
// ski lands softer: it takes some of a landing the legs would otherwise
// take — `harsh`, on the harsh speed.

import { SKIS, totalMass, type SkiSpec } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";

export type Footprint = {
  /** The skis' ground pressure at rest, Pa. */
  pressure: number;
  /** The rest sink in powder, and the powder drag paid, as a multiple of
   * the reference's. */
  sink: number;
  /** The planing speed, as a multiple of `snow.planeSpeed`. */
  plane: number;
  /** The edge's sideways hold on packed snow, as a multiple of
   * `grip.edgePacked`: the flex and the rocker. */
  edge: number;
  /** The base's sideways hold in powder, as a multiple of
   * `grip.basePowder`: the waist and the rocker. */
  base: number;
  /** How fast the skis roll onto their edge, as a multiple of
   * `steer.edgeRate`. */
  edgeRate: number;
  /** The harsh speed, as a multiple of the reference's: a soft ski takes
   * a share of a landing. */
  harsh: number;
};

/** The skis' ground pressure at rest, Pa: the whole weight over the two
 * skis' length by their waist. */
export function pressureOf(spec: SkiSpec): number {
  return (totalMass(spec) * TUNING.g) / (2 * spec.length * spec.waist);
}

const cache = new WeakMap<SkiSpec, Footprint>();

/** THE FOOTPRINT of a pair, built once per spec. */
export function footprintOf(spec: SkiSpec): Footprint {
  const hit = cache.get(spec);
  if (hit) return hit;
  const F = TUNING.footprint;
  const pressure = pressureOf(spec);
  const ratio = pressure / pressureOf(SKIS);
  const flex = spec.flex - SKIS.flex;
  const rocker = spec.rocker - SKIS.rocker;
  const fit: Footprint = {
    pressure,
    sink: Math.pow(ratio, F.floatExp),
    plane: Math.sqrt(ratio),
    edge: Math.max(0.2, (1 + F.edgeFlex * flex) * (1 - F.edgeRocker * rocker)),
    base: Math.pow(spec.waist / SKIS.waist, F.baseFloat) * (1 + F.rockerFloat * rocker),
    edgeRate:
      1 /
      ((spec.length / SKIS.length) *
        Math.pow(spec.waist / SKIS.waist, F.waistRate) *
        (1 + F.flexRate * flex)),
    harsh: 1 + F.flexHarsh * (SKIS.flex - spec.flex),
  };
  cache.set(spec, fit);
  return fit;
}

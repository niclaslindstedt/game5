// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE SKIS MEET THE SNOW — the probe layout, off the spec, and THE
// LEGS that carry the skier over them. Each ski is THREE stations — its tip,
// its middle under the boot and its tail — and each station is a
// spring-damper cast down the snow's normal from under the skier's hips
// (`skier.ts`: along the ski's line by `bz`, across the snow by `bx`): the
// raycast vehicle, whose contact is wherever that ray meets the snow's
// support (`snow.ts`), with a stop at the end of its travel — cast from
// the hips and not from a point rolled over with the body, because a
// skier's skis stay on the snow whatever his body does above them. The spring is the leg: a skier stands on bent knees and absorbs
// a landing by folding them (`LegSpec`), and the three stations of one ski
// share that leg — a ski is a beam under a boot, so its tip and its tail
// ride on the same knee as its middle, at their shares of the ski's load.
//
// THE REST LOAD each station carries comes off the geometry rather than
// being authored: each ski half the weight, its stations by a quarter, a
// half and a quarter (the boot's station bears most of it), and each
// attachment is placed so that station's spring sits at exactly its rest
// sag with the CoG at `cogHeight` above the snow. So a skier put down on
// flat snow stands at the height the spec says.
//
// Beside them, the HULL: points on the body — the hips, the shoulders, the
// helmet, the knees — and the skis' tips and tails, which are not sprung
// at all and meet the snow only when the legs have run out: a tail dragged
// over a crest, a skier down on his hip, one on his back.

import { totalMass, type LegSpec, type SkiSpec } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { footprintOf } from "./footprint.ts";

export type Station = "tip" | "mid" | "tail";

export type Probe = {
  kind: "ski";
  station: Station;
  /** -1 the left ski, +1 the right. */
  side: number;
  /** The attachment, body frame, m. The spring hangs down from here. */
  bx: number;
  by: number;
  bz: number;
  susp: LegSpec;
  /** The load it carries at rest, N. */
  rest: number;
  /** Width of snow it presses, m, and whether it is at the FRONT of its
   * ski and so ploughs (the mid and the tail run in the furrow the tip
   * cuts). */
  width: number;
  ploughs: boolean;
  /** Its share of the reference ski's sink, and its planing speed as a
   * multiple of `snow.planeSpeed` (`snow.ts`, `footprint.ts`). */
  sinkScale: number;
  planeScale: number;
};

export type HullPoint = { x: number; y: number; z: number };

/** The three stations of a ski, as shares of its length AHEAD of the boot
 * (negative behind), and the share of the ski's load each bears. */
const STATIONS: readonly { station: Station; along: number; share: number }[] = [
  { station: "tip", along: 0.38, share: 0.25 },
  { station: "mid", along: 0, share: 0.5 },
  { station: "tail", along: -0.32, share: 0.25 },
];

const layouts = new WeakMap<SkiSpec, Probe[]>();
const hulls = new WeakMap<SkiSpec, HullPoint[]>();

/** Where the boot stands along the ski, m ahead of the ski's own centre
 * (a mounted binding is a little aft of it). */
export function bootOffset(spec: SkiSpec): number {
  return (spec.mount - 0.5) * spec.length;
}

/** Every probe: the left ski's tip, mid and tail, then the right's. Built
 * once per spec. */
export function probesOf(spec: SkiSpec): Probe[] {
  const cached = layouts.get(spec);
  if (cached) return cached;
  const weight = totalMass(spec) * TUNING.g;
  const fit = footprintOf(spec);
  const probes: Probe[] = [];
  // The whole leg's rate is the spec's; each station's spring is its share
  // of it, so the three together are one leg at its rate and its sag.
  for (const side of [-1, 1]) {
    for (const st of STATIONS) {
      const rate = spec.legs.rate * st.share;
      const rest = (weight / 2) * st.share;
      const susp: LegSpec = {
        rate,
        bump: spec.legs.bump * st.share,
        rebound: spec.legs.rebound * st.share,
        travel: spec.legs.travel,
      };
      const width =
        st.station === "tip" ? spec.tipWidth : st.station === "tail" ? spec.tailWidth : spec.waist;
      probes.push({
        kind: "ski",
        station: st.station,
        side,
        bx: (side * spec.stance) / 2,
        by: -spec.cogHeight + susp.travel - rest / rate,
        bz: st.along * spec.length,
        susp,
        rest,
        width,
        ploughs: st.station === "tip",
        sinkScale: fit.sink * (st.station === "mid" ? 1 : TUNING.snow.endSink),
        planeScale: fit.plane,
      });
    }
  }
  layouts.set(spec, probes);
  return probes;
}

/** The body's own points, body frame: the ski tips and tails, the knees,
 * the hips either side, the shoulders, and the crown of the helmet. */
export function hullOf(spec: SkiSpec): HullPoint[] {
  const cached = hulls.get(spec);
  if (cached) return cached;
  const w = spec.stance / 2;
  const boot = bootOffset(spec);
  const tip = boot + spec.length / 2;
  const tail = boot - spec.length / 2;
  const floor = -spec.cogHeight + 0.02;
  const knee = -spec.cogHeight + 0.5;
  const hip = -spec.cogHeight + 0.95;
  const shoulder = -spec.cogHeight + 1.45;
  const head = -spec.cogHeight + 1.75;
  const points: HullPoint[] = [
    { x: -w, y: floor, z: tip },
    { x: w, y: floor, z: tip },
    { x: -w, y: floor, z: tail },
    { x: w, y: floor, z: tail },
    { x: -w, y: knee, z: 0.15 },
    { x: w, y: knee, z: 0.15 },
    { x: -w - 0.1, y: hip, z: -0.05 },
    { x: w + 0.1, y: hip, z: -0.05 },
    { x: -w - 0.15, y: shoulder, z: 0 },
    { x: w + 0.15, y: shoulder, z: 0 },
    { x: 0, y: head, z: 0.05 },
  ];
  hulls.set(spec, points);
  return points;
}

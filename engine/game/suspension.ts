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
//
// A SNOWBOARD (`SkiSpec.board`) is one deck under both feet, one behind the
// other along it: its stations stand in ONE COLUMN down the deck's
// centreline at its whole width (`side` 0) — the nose's contact, the front
// foot, the back foot and the tail's contact — and each FOOT is a leg as
// each ski is, carrying half the rider over its foot's station and the end
// of the board beyond it. Its hull is the board's four corners and a rider
// stood across it, his knees over his feet toward his toe edge, his seat and
// his back toward his heel edge.

import { totalMass, type LegSpec, type SkiSpec } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import { footprintOf, type Footprint } from "./footprint.ts";

export type Station = "tip" | "mid" | "tail";

export type Probe = {
  kind: "ski";
  station: Station;
  /** -1 the left ski, +1 the right; 0 a board's one column. */
  side: number;
  /** Which leg carries it, the index into `SkierState.skiCompression`: 0
   * the left ski's or a board's FRONT foot (the nose's half), 1 the right
   * ski's or its BACK foot. */
  leg: 0 | 1;
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

/** A board's stations: the nose's and the tail's contact as shares of the
 * board's length from the stance's middle (inside its effective edge,
 * which ends near 0.38 of it), the feet over the bindings
 * (`BoardFit.stance`), and each one's share of its FOOT's load — the
 * pressure under a loaded board peaks under the bindings. */
const BOARD_END = 0.35;
const BOARD_STATIONS: readonly { station: Station; foot: 0 | 1; end: boolean; share: number }[] = [
  { station: "tip", foot: 0, end: true, share: 0.3 },
  { station: "mid", foot: 0, end: false, share: 0.7 },
  { station: "mid", foot: 1, end: false, share: 0.7 },
  { station: "tail", foot: 1, end: true, share: 0.3 },
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
  if (spec.board) {
    boardProbes(spec, weight, fit, probes);
    layouts.set(spec, probes);
    return probes;
  }
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
        leg: side < 0 ? 0 : 1,
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

/** A BOARD'S STATIONS onto `probes`: one column down the deck's
 * centreline, each foot a leg at the spec's rate, sharing half the weight
 * between the foot's station and its end of the board. */
function boardProbes(spec: SkiSpec, weight: number, fit: Footprint, probes: Probe[]): void {
  const board = spec.board!;
  const boot = bootOffset(spec);
  for (const st of BOARD_STATIONS) {
    const sign = st.foot === 0 ? 1 : -1;
    const rate = spec.legs.rate * st.share;
    const rest = (weight / 2) * st.share;
    const susp: LegSpec = {
      rate,
      bump: spec.legs.bump * st.share,
      rebound: spec.legs.rebound * st.share,
      travel: spec.legs.travel,
    };
    probes.push({
      kind: "ski",
      station: st.station,
      side: 0,
      leg: st.foot,
      bx: 0,
      by: -spec.cogHeight + susp.travel - rest / rate,
      bz: st.end ? sign * BOARD_END * spec.length - boot : (sign * board.stance) / 2,
      susp,
      rest,
      width:
        st.station === "tip" ? spec.tipWidth : st.station === "tail" ? spec.tailWidth : spec.waist,
      ploughs: st.station === "tip",
      sinkScale: fit.sink * (st.end ? TUNING.snow.endSink : 1),
      planeScale: fit.plane,
    });
  }
}

/** The body's own points, body frame: the ski tips and tails, the knees,
 * the hips either side, the shoulders, and the crown of the helmet — or on
 * a board, its four corners and the rider stood across it. */
export function hullOf(spec: SkiSpec): HullPoint[] {
  const cached = hulls.get(spec);
  if (cached) return cached;
  if (spec.board) {
    const points = boardHull(spec);
    hulls.set(spec, points);
    return points;
  }
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

/** A BOARD'S HULL, in `hullOf`'s order (the four ends, the knees, the
 * hips, the shoulders, the helmet — `chassis.ts` and the body plough read
 * them by their place): the nose's and the tail's corners at the board's
 * width, the knees over the feet bent toward the toe edge, the seat and the
 * front of the hips, the back and the chest, the helmet over the middle.
 * The toe edge is the board's right for a regular rider, its left for a
 * goofy one (`BoardFit.lead`). */
function boardHull(spec: SkiSpec): HullPoint[] {
  const board = spec.board!;
  const toe = board.lead === "regular" ? 1 : -1;
  const boot = bootOffset(spec);
  const nose = spec.length / 2 - boot;
  const tail = -spec.length / 2 - boot;
  const floor = -spec.cogHeight + 0.02;
  const knee = -spec.cogHeight + 0.5;
  const hip = -spec.cogHeight + 0.95;
  const shoulder = -spec.cogHeight + 1.45;
  const head = -spec.cogHeight + 1.75;
  const feet = board.stance / 2;
  return [
    { x: -spec.tipWidth / 2, y: floor, z: nose },
    { x: spec.tipWidth / 2, y: floor, z: nose },
    { x: -spec.tailWidth / 2, y: floor, z: tail },
    { x: spec.tailWidth / 2, y: floor, z: tail },
    { x: toe * 0.12, y: knee, z: feet },
    { x: toe * 0.12, y: knee, z: -feet },
    { x: -toe * 0.15, y: hip, z: 0 },
    { x: toe * 0.12, y: hip, z: 0 },
    { x: -toe * 0.17, y: shoulder, z: 0 },
    { x: toe * 0.15, y: shoulder, z: 0 },
    { x: 0, y: head, z: 0 },
  ];
}

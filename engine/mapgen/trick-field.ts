// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R20 — THE TERRAIN PARK: a run of groomed kickers down the piste, laid only
// on a map built for a TRICKS run. The mountain, the piste, its start and
// its gates are the seed's own; the park changes the line and nothing
// else.
//
// ON THE PISTE, because the piste is where a skier already has his speed:
// it is groomed, it is clear of trees, and it goes on down — a skier who
// has taken the park comes to the finish without being told where to go.
//
// THREE SIZES, laid low, medium and high in turn and round again, so a run
// down the park is a ladder: the low lip for a grab, the medium for a flip,
// the high one for the flip with a spin in it. Every one of them is BUILT
// past its lip (`KickerShape`): a flat deck at the lip's height, then a
// landing slope falling away to a floor dug under the piste, then a run-out
// climbing back up to the line. The slope is what a skier comes down onto —
// met at the angle he is falling at, it takes the landing into the legs a
// little at a time instead of all at once — and the bigger the lip the
// longer and deeper the slope, because the bigger lip throws a skier
// further and he comes down steeper. The speed a kicker is taken at is the
// skier's to judge.
//
// STAMPED ALONG THE LINE, by the arc length of the nearest station under
// every cell of the corridor (the map `stampCorridor` left), so the ramp,
// the deck, the landing and the run-out follow the piste through whatever
// it does and lift or sink the line, its shoulders and its windrows
// together — but BUILT AGAINST THE HORIZONTAL, as a park is: the ramp
// climbs from the altitude of its foot to a lip `height` above it, the
// deck is level at the lip's altitude, and the landing slope falls from
// there to a floor `dig` under the line. A kicker shaped in the line's own
// frame on a piste falling ten in a hundred would lose that ten off its
// take-off and have its "flat" deck falling away under the flight, and a
// skier off it would come down on the deck. The FLIGHT does not follow the
// line — a skier in the air goes straight — so each kicker stands where
// the line barely turns from the ramp's foot to the landing slope's, and
// where the line falls no steeper than a park is built on.
//
// SPACED by `trick.gap` of piste between one run-out's end and the next
// ramp's foot: the run-up he takes the next lip at. And OFF THE GATES
// (R11), by `trick.gateClear`: a gate line across a deck, a landing slope
// or the dug floor is no gate, and a reset stands a skier at the last gate
// he took — in the floor of a landing or on a run-out he would stand at
// nothing, in a trough, and stick there; and stood at a gate a few metres
// short of a ramp he would crawl into it and stall on it, so the gate
// before a ramp stands a run-in back, and the line falls `trick.runIn`
// times the lip's height over that run-in.
//
// Nothing here draws from a stream: the stations are the piste's own, taken
// in order, so asking for the park moves nothing the seed drew.

import {
  sampleField,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { angleDiff, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { landingEase, runoutEase } from "./kickers.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import { gateArcs, startGateArc } from "./spawn.ts";
import type { Piste } from "./track.ts";
import type { Cliff, Kicker, KickerShape, TrackPoint, TrickSize } from "./types.ts";
import { CURRENT_GENERATOR_VERSION, type GeneratorVersion } from "./versions.ts";

/** The generator a map with a park on it is built by when none is named:
 * today's — a ski area lays its park down the course it is ridden on
 * (`resort-park.ts`), the single piste down its one line. */
export const PARK_VERSION: GeneratorVersion | undefined = CURRENT_GENERATOR_VERSION;

/** The line a park is laid down: its stations every `track.step` metres and
 * its length — a single piste's (`Piste`), or a resort course's. */
export type ParkLine = Pick<Piste, "points" | "length">;

/** What a park's line asks of it besides R20 (a ski area's course): the
 * gates it keeps off (the single piste's evenly spaced ones when left out),
 * stretches of the line it leaves alone (a drift, R17), and which gaps from
 * one run-out's end to the next ramp's foot it allows. */
export type ParkAsk = {
  gates?: readonly number[];
  avoid?: readonly [number, number][];
  apart?: (gap: number) => boolean;
};

/** The arc a kicker covers, foot of the ramp to the end of its landing, m. */
function footprint(k: { s?: number; ramp: number; landing: number }): [number, number] {
  const s = k.s ?? 0;
  return [s - k.ramp, s + k.landing];
}

/** One size of the park as a kicker is built to it: the lip, the ramp,
 * the whole length past the lip, and the built landing. */
export function trickKicker(size: TrickSize): {
  height: number;
  ramp: number;
  landing: number;
  shape: KickerShape;
} {
  const z = R.trick.sizes[size];
  return {
    height: z.height,
    ramp: z.height * z.ramp,
    landing: z.deck + z.fall + z.runout,
    shape: { deck: z.deck, fall: z.fall, dig: z.dig },
  };
}

/** Where the stamp around the piste reaches: the corridor out to the far
 * toe of the windrow, then a fade into the mountain. */
export type Corridor = { near: Int32Array; along: Float32Array; dist: Float32Array };

/** R20 — plan the park on the finished piste: its kickers in the order they
 * are skied, or the reason the line could not carry one. `taken` are the
 * kickers already on the piste (R9) and `drops` the drops across it (R24),
 * which the park keeps clear of. Nothing is stamped yet: the mountain is
 * finished first (`stampTrickField`). */
export function planTrickField(
  piste: ParkLine,
  taken: readonly Kicker[],
  drops: readonly Cliff[] = [],
  ask: ParkAsk = {},
): Kicker[] | string {
  const F = R.trick;
  const n = piste.points.length;
  const busy = taken
    .filter((k) => k.onTrack)
    .map(footprint)
    .concat(drops.map((d) => footprint({ s: d.s, ramp: d.shelf, landing: d.face + d.landing })))
    .concat(ask.avoid ?? []);
  const gates = ask.gates ?? gateArcs(piste.length);
  const apart = ask.apart ?? (() => true);
  const out: Kicker[] = [];
  let free = startGateArc() + F.lead;
  let i = 0;
  /** Where in `trick.order` the next kicker's turn is. */
  let turn = 0;
  while (i < n && out.length < F.count.max) {
    // The size whose turn it is, where it first fits — unless a smaller one
    // fits more than `trick.wait` sooner: a stretch too short, too bent or
    // too steep for the big lip still carries a small one, and the turn
    // goes on from whatever was laid.
    let pick: { k: Kicker; at: number; index: number } | null = null;
    for (let t = 0; t < F.order.length; t++) {
      const at = (turn + F.order.length - t) % F.order.length;
      if (t > 0 && F.sizes[F.order[at]].height > F.sizes[F.order[turn]].height) continue;
      const last = out[out.length - 1];
      const ok = (from: number): boolean => !last || apart(from - ((last.s ?? 0) + last.landing));
      const hit = firstFit(piste, i, F.order[at], free, busy, gates, ok);
      if (hit && (!pick || (hit.k.s ?? 0) + F.wait < (pick.k.s ?? 0))) pick = { ...hit, at };
    }
    if (!pick) break;
    pick.k.id = `T${out.length + 1}`;
    out.push(pick.k);
    turn = (pick.at + 1) % F.order.length;
    free = (pick.k.s ?? 0) + pick.k.landing + F.gap;
    i = pick.index + 1;
  }
  if (out.length < F.count.min) return `only ${out.length} park kicker(s) fit the piste (R20)`;
  return out;
}

/** The first station from `i` on where a kicker of `size` stands, and it. */
function firstFit(
  piste: ParkLine,
  i: number,
  size: TrickSize,
  free: number,
  busy: readonly [number, number][],
  gates: readonly number[],
  ok: (from: number) => boolean,
): { k: Kicker; index: number } | null {
  for (let j = i; j < piste.points.length; j++) {
    const k = fits(piste, piste.points[j], size, free, busy, gates, ok);
    if (k) return { k, index: j };
  }
  return null;
}

/** The kicker of `size` with its lip at `p`, or null where it will not
 * stand: inside the lead, on `busy` piste (R9's kickers, `trick.gap`
 * either side), too near a gate (`trick.gateClear`) or without the run-in
 * from the gate before it (`trick.runIn`), on a bend or on a pitch. */
function fits(
  piste: ParkLine,
  p: TrackPoint,
  size: TrickSize,
  free: number,
  busy: readonly [number, number][],
  gates: readonly number[],
  ok: (from: number) => boolean,
): Kicker | null {
  const F = R.trick;
  const pts = piste.points;
  const n = pts.length;
  const step = R.track.step;
  const built = trickKicker(size);
  const from = p.s - built.ramp;
  const to = p.s + built.landing;
  if (from < free || to > piste.length - F.lead || !ok(from)) return null;
  if (busy.some(([a, b]) => from < b + F.gap && to > a - F.gap)) return null;
  if (gates.some((g) => g > from - F.gateClear.before && g < to + F.gateClear.after)) return null;
  // The run-in from the gate before: enough fall to reach the lip from it.
  let gate = -Infinity;
  for (const g of gates) if (g <= from - F.gateClear.before && g > gate) gate = g;
  if (gate > -Infinity) {
    const yGate = pts[Math.min(n - 1, Math.round(gate / step))].y;
    const yFoot = pts[Math.max(0, Math.floor(from / step))].y;
    if (yGate - yFoot < F.runIn * built.height) return null;
  }
  // Straight from the ramp's foot to the landing slope's, where the skier
  // is on the ramp or in the air: one heading lies on the line.
  const flight = p.s + built.shape.deck + built.shape.fall;
  const i0 = Math.max(0, Math.floor(from / step));
  const i1 = Math.min(n - 1, Math.ceil(flight / step));
  for (let j = i0; j <= i1; j++) {
    if (Math.abs(angleDiff(pts[j].heading, p.heading)) > F.straight) return null;
  }
  // A moderate pitch from the ramp's foot to the landing slope's foot.
  if ((pts[i0].y - pts[i1].y) / ((i1 - i0) * step) > F.maxGrade) return null;
  return {
    id: "",
    x: p.x,
    z: p.z,
    y: p.y,
    heading: p.heading,
    height: built.height,
    ramp: built.ramp,
    landing: built.landing,
    width: p.width + 2 * (R.track.shoulder.flat + R.berm.width),
    onTrack: true,
    s: p.s,
    trick: true,
    size,
    shape: built.shape,
  };
}

/** The graded line's height at arc length `s`, m — read off the stations
 * either side of it, before the park is stamped. */
function lineY(pts: readonly TrackPoint[], s: number): number {
  const step = R.track.step;
  const i = Math.max(0, Math.min(pts.length - 2, Math.floor(s / step)));
  const t = Math.max(0, Math.min(1, s / step - i));
  return pts[i].y + (pts[i + 1].y - pts[i].y) * t;
}

/** A park kicker built against the horizontal: the ALTITUDE of its surface
 * `u` metres past the lip, given the altitude of its ramp's foot and of
 * its landing's floor. The ramp climbs `height` over the foot as
 * (1 − u/ramp)², steepest at the lip; the deck is level at the lip; the
 * landing slope falls to the floor, rounded over at the knuckle and out at
 * the bottom; the run-out climbs from the floor back to the line — that
 * last one in the line's frame, since it ends on the line. Undefined
 * outside the kicker; the caller keeps it off the line there. */
export function trickAltitude(
  k: { height: number; ramp: number; landing: number; shape: KickerShape },
  u: number,
  foot: number,
  floor: number,
  line: number,
): number {
  const z = k.shape;
  if (u <= 0) {
    const t = 1 + u / k.ramp;
    return foot + k.height * t * t;
  }
  const top = foot + k.height;
  if (u <= z.deck) return top;
  const v = u - z.deck;
  if (v < z.fall) return top - (top - floor) * landingEase(v / z.fall);
  const out = k.landing - z.deck - z.fall;
  return floor + (line - floor) * runoutEase((v - z.fall) / out);
}

/** Stamp the planned park into the finished ground by arc length — full
 * height out to the windrow's far toe, faded into the mountain over
 * `trick.edge` beyond it — and publish the lips' heights. */
export function stampTrickField(
  ground: Heightfield,
  field: readonly Kicker[],
  { near, along, dist }: Corridor,
  piste: ParkLine,
): void {
  const pts = piste.points;
  const n = pts.length;
  const step = R.track.step;
  const g = ground.data;
  const toe = R.track.shoulder.flat + R.berm.width;
  // Each kicker's two altitudes: the ramp's foot on the line, and the
  // landing's floor `dig` under the line at the slope's foot.
  const frames = field.map((k) => {
    const shape = k.shape ?? { deck: 0, fall: 0, dig: 0 };
    const s0 = k.s ?? 0;
    return {
      k: { height: k.height, ramp: k.ramp, landing: k.landing, shape },
      s0,
      foot: lineY(pts, s0 - k.ramp),
      floor: lineY(pts, s0 + shape.deck + shape.fall) - shape.dig,
    };
  });
  for (let o = 0; o < g.length; o++) {
    const i = near[o];
    if (i < 0) continue;
    const s = (i + along[o]) * step;
    let lift = 0;
    for (const f of frames) {
      const u = s - f.s0;
      if (u <= -f.k.ramp || u >= f.k.landing) continue;
      const line = lineY(pts, s);
      lift = trickAltitude(f.k, u, f.foot, f.floor, line) - line;
      break;
    }
    if (lift === 0) continue;
    const a = pts[i].width;
    const half = (a + (pts[Math.min(n - 1, i + 1)].width - a) * along[o]) / 2;
    const reach = half + toe;
    g[o] += (1 - smoothstep(reach, reach + R.trick.edge, dist[o])) * lift;
  }
  for (const k of field) k.y = sampleField(ground, k.x, k.z);
}

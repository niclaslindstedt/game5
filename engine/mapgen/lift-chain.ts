// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R26 — THE NEXT LIFT'S QUEUE OFF A TOP (generator v7). Where a lift tops
// out beside the next lift's bottom station — the gondola's mid-station and
// the peak's chair — the rider let go at the top must reach that lift's
// queue by skiing ON: the boarding ring at its corral's open end lies AHEAD
// of him and to one side, on snow that falls to it all the way, so he turns
// onto it the way he is going and never has to turn back for it, nor walks
// out of the cabin straight into it.
//
// A chair's corral leaves its load line to the RIGHT of the line and
// back down it (`lift-line.ts`'s `queueLane`), so the ring is laid on the
// rider's right and the station stands beyond it, across his way: the way
// runs from the let-go point to the ring and on up the corral to the house.
// `chainBottom` places the bottom station so its ring lands on an aim;
// `wayFalls` reads whether the snow carries a rider there; the way itself is
// kept off by the runs, the ramps and the lanes walked after it, groomed,
// and cleared of trees (`resort-build.ts`). `analyzeResort` holds the
// finished map to the same rule off what the level publishes.
//
// Pure over its arguments; draws nothing from the stream.

import { angleDiff, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  sampleField,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { letGoOf, ringFrame } from "../game/lift-line.ts";
import type { LiftPlan } from "./resort.ts";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import { withinBand } from "./rules.ts";
import { bottomFootprint } from "./station-clear.ts";
import { pressPads, type PadShape, type StationPad } from "./station-pad.ts";
import type { Lift, SummitRamp } from "./types.ts";

type Point = { x: number; z: number };
type Ends = { kind: Lift["kind"]; bottom: Point; top: Point };

/** The way from a top to the next lift's queue: where the rider is let go,
 * the ring, and the next lift's bottom station. */
export type ChainWay = { from: Point; ring: Point; station: Point };

/** The bottom station of a `kind` lift climbing to `top` whose boarding
 * ring lies `aim` (a bearing off the way the rider faces, rad, to his
 * right; and a reach, m) from where a rider is let go at `upper`'s top. */
export function chainBottom(
  upper: Ends,
  kind: Lift["kind"],
  top: Point,
  aim: readonly [number, number],
): Point {
  const off = letGoOf(upper.kind, upper.bottom, upper.top);
  const [bearing, reach] = aim;
  const h = off.heading + bearing;
  // The ring: ahead and to the right of the rider (heading 0 is +z, and
  // the right of a heading is a quarter turn clockwise).
  const ring = { x: off.x + Math.sin(h) * reach, z: off.z + Math.cos(h) * reach };
  const f = ringFrame(kind);
  // The ring sits `f.u` m up the line and `f.v` m right of it from the
  // bottom wheel; the line's direction moves a little with the bottom, so
  // read it again until it settles.
  let b = { ...ring };
  for (let k = 0; k < 4; k++) {
    const len = Math.max(1, hypot(top.x - b.x, top.z - b.z));
    const dx = (top.x - b.x) / len;
    const dz = (top.z - b.z) / len;
    b = { x: ring.x - dx * f.u - dz * f.v, z: ring.z - dz * f.u + dx * f.v };
  }
  return b;
}

/** The way off `upper`'s top to `lower`'s queue. */
export function chainWay(upper: Ends, lower: Ends): ChainWay {
  const off = letGoOf(upper.kind, upper.bottom, upper.top);
  const f = ringFrame(lower.kind);
  const len = Math.max(1, hypot(lower.top.x - lower.bottom.x, lower.top.z - lower.bottom.z));
  const dx = (lower.top.x - lower.bottom.x) / len;
  const dz = (lower.top.z - lower.bottom.z) / len;
  return {
    from: { x: off.x, z: off.z },
    ring: { x: lower.bottom.x + dx * f.u + dz * f.v, z: lower.bottom.z + dz * f.u - dx * f.v },
    station: lower.bottom,
  };
}

/** The step the way is read at, m. */
const READ = 1;

/** Whether the snow carries a rider down the way to the ring: falling at
 * `lift.chain.fall` or more over it and never rising more than
 * `lift.chain.rise` over the lowest he has come to. */
export function wayFalls(way: ChainWay, height: (x: number, z: number) => number): boolean {
  const C = RR.lift.chain;
  const len = hypot(way.ring.x - way.from.x, way.ring.z - way.from.z);
  const n = Math.max(1, Math.ceil(len / READ));
  const y0 = height(way.from.x, way.from.z);
  let low = y0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const y = height(
      way.from.x + (way.ring.x - way.from.x) * t,
      way.from.z + (way.ring.z - way.from.z) * t,
    );
    if (y - low > C.rise) return false;
    low = Math.min(low, y);
  }
  return y0 - height(way.ring.x, way.ring.z) >= C.fall * len;
}

/** How far (x, z) stands off the way's ground, m: its two legs (the
 * let-go point to the ring, the ring up the corral to the station), less
 * `lift.chain.half`. */
export function offWay(way: ChainWay, x: number, z: number): number {
  return (
    Math.min(seg(way.from, way.ring, x, z), seg(way.ring, way.station, x, z)) - RR.lift.chain.half
  );
}

/** How far (x, z) stands off the way's ground as a ramp off the top's
 * deck reads it, m: the first leg only along its line, and only past
 * `lift.chain.share` m of it — a ramp may come down beside it, and cross
 * it on and just off the deck, where the two stand level, but never
 * further out — and the corral and the station whole (R26). */
export function offQueue(way: ChainWay, x: number, z: number): number {
  const C = RR.lift.chain;
  const k = Math.min(
    1,
    C.share / Math.max(1, hypot(way.ring.x - way.from.x, way.ring.z - way.from.z)),
  );
  const from = {
    x: way.from.x + (way.ring.x - way.from.x) * k,
    z: way.from.z + (way.ring.z - way.from.z) * k,
  };
  return Math.min(
    seg(from, way.ring, x, z) - C.half + RR.lift.top.ramp.width / 2,
    seg(way.ring, way.station, x, z) - C.half,
  );
}

/** Plan distance from (x, z) to the segment a–b, m. */
function seg(a: Point, b: Point, x: number, z: number): number {
  return segAt(a, b, x, z).d;
}

/** The share of the way along the segment a–b nearest (x, z), and the
 * plan distance to it, m. */
function segAt(a: Point, b: Point, x: number, z: number): { k: number; d: number } {
  const ex = b.x - a.x;
  const ez = b.z - a.z;
  const k = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / (ex * ex + ez * ez || 1)));
  return { k, d: hypot(x - (a.x + ex * k), z - (a.z + ez * k)) };
}

/** The lift that tops out at the mid-station and the one that leaves it. */
const UPPER = "G1";
const LOWER = "C1";

/** The step the way's ground is read at for its earthworks, m. */
const DIG_READ = 2;

/** R26 — LAY THE WAY to the peak's chair's queue off the gondola's top, on
 * ground the pads are pressed into: the chair's bottom station moved to the
 * first of `lift.chain.aims` whose way and station ask no more than
 * `lift.chain.dig` of cut or fill and stand off every pad — the pads
 * pressed again where it moved (its line, and so its top's pad, turns with
 * it) — and the way GRADED into the mountain (`pressWay`). The way and the
 * pads, or null where no aim will do. `raw` is the ground before any pad
 * was pressed. Moves the chair in place. */
export function layChain(
  ground: Heightfield,
  raw: Heightfield["data"],
  lifts: readonly LiftPlan[],
  pads: StationPad[],
  shape: PadShape,
): { way: ChainWay; pads: StationPad[] } | null {
  const upper = lifts.find((l) => l.id === UPPER);
  const lower = lifts.find((l) => l.id === LOWER);
  if (!upper || !lower) return null;
  const offPads = (b: Point): boolean =>
    bottomFootprint(lower.kind, b, lower.top).every((p) =>
      pads.every((q) => hypot(p.x - q.x, p.z - q.z) > q.r),
    );
  const aims = RR.lift.chain.aims;
  for (let i = 0; i < aims.length; i++) {
    const bottom = i === 0 ? lower.bottom : chainBottom(upper, lower.kind, lower.top, aims[i]);
    const ends = { kind: lower.kind, bottom, top: lower.top };
    const way = chainWay(upper, ends);
    if (!offPads(bottom)) continue;
    const works = earthworks(ground, way, ends);
    const C = RR.lift.chain;
    if (works.fill > C.fill || works.cut > C.dig || works.dig > C.dig) continue;
    if (i > 0) {
      // Pressed again with the chair where it now stands.
      lower.bottom = bottom;
      ground.data.set(raw);
      pads = pressPads(ground, lifts, shape);
    }
    pressWay(ground, way, ends, upper, Math.max(C.blend, C.bank * works.dig));
    return { way, pads };
  }
  return null;
}

/** What the way's ground is graded to at (x, z): the height, how far
 * outside its core the point stands, m (0 inside it), and whether it is
 * only ever CUT to it. The core is the first leg `lift.chain.half` either
 * side, falling straight from the let-go point's height `y0` to the
 * ring's and cut down to that line where the snow stands over it (never
 * filled: the runs off the top leave beside it on the mountain as it
 * falls); the station's footprint level at `yStation`; and the corral's
 * leg between the two, eased from the ring's height to the station's (the
 * queue is walked up it). */
function wayTarget(
  way: ChainWay,
  lower: Ends,
  y0: number,
  yRing: number,
  yStation: number,
  x: number,
  z: number,
): { y: number; out: number; cut: boolean } {
  const C = RR.lift.chain;
  const first = segAt(way.from, way.ring, x, z);
  const corral = segAt(way.ring, way.station, x, z);
  const station = rectOff(lower, x, z);
  const leg = Math.max(0, first.d - C.half);
  const queue = Math.max(0, corral.d - C.half);
  if (station <= Math.min(leg, queue)) return { y: yStation, out: station, cut: false };
  if (leg <= queue) return { y: y0 + (yRing - y0) * first.k, out: leg, cut: true };
  return { y: yRing + (yStation - yRing) * smoothstep(0, 1, corral.k), out: queue, cut: false };
}

/** The heights the way is graded to: where he is let go (`y0`), the
 * ring — its own ground, or cut to fall `lift.chain.grade` m per m from
 * him where it would fall less — and the station's footprint, cut to its
 * ground's mean held between the ring's height and `lift.chain.climb` m
 * per m over it up the corral. */
function wayLevels(
  ground: Heightfield,
  way: ChainWay,
  lower: Ends,
): { y0: number; yRing: number; yStation: number } {
  const C = RR.lift.chain;
  const y0 = sampleField(ground, way.from.x, way.from.z);
  const reach = Math.max(1, hypot(way.ring.x - way.from.x, way.ring.z - way.from.z));
  const yRing = Math.min(sampleField(ground, way.ring.x, way.ring.z), y0 - C.grade * reach);
  const pts = bottomFootprint(lower.kind, lower.bottom, lower.top);
  let sum = 0;
  for (const p of pts) sum += sampleField(ground, p.x, p.z);
  const corral = hypot(way.station.x - way.ring.x, way.station.z - way.ring.z);
  const yStation = Math.max(yRing, Math.min(yRing + C.climb * corral, sum / pts.length));
  return { y0, yRing, yStation };
}

/** How far (x, z) stands outside a bottom station's footprint, m. */
function rectOff(l: Ends, x: number, z: number): number {
  const F = RR.lift.footprint[l.kind];
  const len = Math.max(1, hypot(l.top.x - l.bottom.x, l.top.z - l.bottom.z));
  const dx = (l.top.x - l.bottom.x) / len;
  const dz = (l.top.z - l.bottom.z) / len;
  const u = (x - l.bottom.x) * dx + (z - l.bottom.z) * dz;
  const v = (x - l.bottom.x) * dz - (z - l.bottom.z) * dx;
  return hypot(Math.max(0, -F.back - u, u - F.ahead), Math.max(0, Math.abs(v) - F.half));
}

/** The earthworks the way asks: the most its core is filled (`fill`) or
 * cut (`cut`) and the most the station's footprint is cut into the
 * mountain (`dig`), m. */
function earthworks(
  ground: Heightfield,
  way: ChainWay,
  lower: Ends,
): { fill: number; cut: number; dig: number } {
  const { y0, yRing, yStation } = wayLevels(ground, way, lower);
  const out = { fill: 0, cut: 0, dig: 0 };
  const read = (p: Point, footprint: boolean): void => {
    const t = wayTarget(way, lower, y0, yRing, yStation, p.x, p.z);
    const d = sampleField(ground, p.x, p.z) - t.y;
    if (!t.cut) out.fill = Math.max(out.fill, -d);
    if (footprint) out.dig = Math.max(out.dig, d);
    else out.cut = Math.max(out.cut, d);
  };
  for (const p of [...alongSeg(way.from, way.ring), ...alongSeg(way.ring, way.station)])
    read(p, false);
  for (const p of bottomFootprint(lower.kind, lower.bottom, lower.top)) read(p, true);
  return out;
}

/** Points every `DIG_READ` m along a segment. */
function alongSeg(a: Point, b: Point): Point[] {
  const n = Math.max(1, Math.ceil(hypot(b.x - a.x, b.z - a.z) / DIG_READ));
  return Array.from({ length: n + 1 }, (_, i) => ({
    x: a.x + ((b.x - a.x) * i) / n,
    z: a.z + ((b.z - a.z) * i) / n,
  }));
}

/** R26 — THE WAY GRADED into the mountain: its core cut (and the station's
 * footprint and its corral filled) to its grade (`wayTarget`) and eased into the mountain over `lift.chain.blend`
 * m — only ever cut under the gondola's way in, where its cabins come down
 * onto the deck (`lift.top.approach`). */
function pressWay(
  ground: Heightfield,
  way: ChainWay,
  lower: Ends,
  upper: Ends,
  blend: number,
): void {
  const C = RR.lift.chain;
  const { y0, yRing, yStation } = wayLevels(ground, way, lower);
  const under = approached(upper);
  const corners = [...bottomFootprint(lower.kind, lower.bottom, lower.top), way.from, way.ring];
  pressBox(ground, corners, C.half + blend, (x, z, y) => {
    const t = wayTarget(way, lower, y0, yRing, yStation, x, z);
    if (t.out >= blend) return y;
    const to = y + (t.y - y) * (1 - smoothstep(0, blend, t.out));
    return t.cut || under(x, z) ? Math.min(y, to) : to;
  });
}

/** R26 — THE WAY'S FIRST LEG CUT AGAIN once the ramps off the top are
 * pressed (a ramp may cross it by the deck, and is pressed after it):
 * whatever stands over its line — from where it leaves the top's pad, at
 * the height the pad's edge stands there, straight to the ring — cut down
 * to it and eased into the snow round it over `lift.chain.blend` m — and
 * filled up to it for the first `lift.chain.lip` m off the pad, wherever
 * no ramp crosses it — the pad itself left as it was pressed. */
export function regradeLeg(
  ground: Heightfield,
  lifts: readonly LiftPlan[],
  pads: readonly StationPad[],
  ramps: ReadonlyMap<string, readonly SummitRamp[]>,
): void {
  const way = chainOf(lifts);
  const upper = lifts.find((l) => l.id === UPPER);
  if (!way || !upper) return;
  const C = RR.lift.chain;
  const pad = pads.find((p) => p.lift === UPPER);
  // Off the pad's own edge: its height read just inside it, its cells
  // left as they were pressed.
  const keep = pad ? pad.r : 0;
  const from = pad ? leaves(way, pad, keep) : way.from;
  const edge = pad ? leaves(way, pad, pad.r - ground.cell) : way.from;
  const leg = { ...way, from };
  const y0 = sampleField(ground, edge.x, edge.z);
  const yRing = sampleField(ground, way.ring.x, way.ring.z);
  const reach = hypot(way.ring.x - from.x, way.ring.z - from.z);
  const onRamp = (x: number, z: number): boolean =>
    (ramps.get(UPPER) ?? []).some(
      (r) => seg(r.from, r.to, x, z) < r.width / 2 + RR.lift.top.ramp.blend,
    );
  pressBox(ground, [from, way.ring], C.half + C.blend, (x, z, y) => {
    if (pad && hypot(x - pad.x, z - pad.z) < keep) return y;
    const at = segAt(leg.from, leg.ring, x, z);
    const out = Math.max(0, at.d - C.half);
    if (out >= C.blend) return y;
    const w = 1 - smoothstep(0, C.blend, out);
    const to = y + (y0 + (yRing - y0) * at.k - y) * w;
    // Filled only off the pad's edge, fading over `lift.chain.lip` m, so
    // the way leaves the pad without a step down onto it — where no ramp
    // crosses it: a ramp crossing it is left falling as it was pressed.
    const lip = 1 - smoothstep(0, C.lip, at.k * reach);
    return to < y ? to : onRamp(x, z) ? y : y + (to - y) * lip;
  });
}

/** Where the way's first leg leaves a circle of radius `r` about `pad`. */
function leaves(way: ChainWay, pad: Point, r: number): Point {
  const ex = way.ring.x - way.from.x;
  const ez = way.ring.z - way.from.z;
  const fx = way.from.x - pad.x;
  const fz = way.from.z - pad.z;
  const a = ex * ex + ez * ez || 1;
  const b = fx * ex + fz * ez;
  const c = fx * fx + fz * fz - r * r;
  if (c >= 0) return way.from;
  const t = Math.min(1, (-b + Math.sqrt(b * b - a * c)) / a);
  return { x: way.from.x + ex * t, z: way.from.z + ez * t };
}

/** Whether (x, z) is under `upper`'s way in, where its cabins come down
 * onto the deck (`lift.top.approach`): ground there is only ever cut. */
function approached(upper: Ends): (x: number, z: number) => boolean {
  const A = RR.lift.top.approach;
  const len = Math.max(1, hypot(upper.top.x - upper.bottom.x, upper.top.z - upper.bottom.z));
  const ux = (upper.top.x - upper.bottom.x) / len;
  const uz = (upper.top.z - upper.bottom.z) / len;
  return (x, z) => {
    const back = (upper.top.x - x) * ux + (upper.top.z - z) * uz;
    const v = Math.abs((x - upper.top.x) * uz - (z - upper.top.z) * ux);
    return back > 0 && back < A.length && v < A.half.gondola + A.blend;
  };
}

/** Every grid cell within `far` m of the box round `corners`, its height
 * handed to `to` and replaced by what it returns. */
function pressBox(
  ground: Heightfield,
  corners: readonly Point[],
  far: number,
  to: (x: number, z: number, y: number) => number,
): void {
  const cell = ground.cell;
  const xs = corners.map((p) => p.x);
  const zs = corners.map((p) => p.z);
  const c0 = Math.max(0, Math.floor((Math.min(...xs) - far - ground.originX) / cell));
  const c1 = Math.min(ground.cols - 1, Math.ceil((Math.max(...xs) + far - ground.originX) / cell));
  const r0 = Math.max(0, Math.floor((Math.min(...zs) - far - ground.originZ) / cell));
  const r1 = Math.min(ground.rows - 1, Math.ceil((Math.max(...zs) + far - ground.originZ) / cell));
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const i = row * ground.cols + col;
      ground.data[i] = to(ground.originX + col * cell, ground.originZ + row * cell, ground.data[i]);
    }
  }
}

/** Whether the peak's chair, where `lifts` stand it, still has its queue
 * ahead of a rider out of the gondola — within `lift.chain.bearing` and
 * `lift.chain.reach` of him — on a way the snow carries him down: what a
 * station slid off a run must keep (`station-clear.ts`). */
export function keepsChain(
  lifts: readonly LiftPlan[],
  height: (x: number, z: number) => number,
): boolean {
  const way = chainOf(lifts);
  if (!way) return true;
  const upper = lifts.find((l) => l.id === UPPER) as LiftPlan;
  const off = letGoOf(upper.kind, upper.bottom, upper.top);
  const C = RR.lift.chain;
  const dx = way.ring.x - way.from.x;
  const dz = way.ring.z - way.from.z;
  const reach = hypot(dx, dz);
  // To his right: the side the corral leaves its line on, the station
  // beyond the ring rather than between him and it.
  const bearing = angleDiff(off.heading, Math.atan2(dx, dz));
  return withinBand(bearing, C.bearing) && withinBand(reach, C.reach) && wayFalls(way, height);
}

/** The way off the gondola's top to the peak's chair's queue where `lifts`
 * stand them, or null on an area without either. */
export function chainOf(lifts: readonly LiftPlan[]): ChainWay | null {
  const upper = lifts.find((l) => l.id === UPPER);
  const lower = lifts.find((l) => l.id === LOWER);
  return upper && lower ? chainWay(upper, lower) : null;
}

/** The way GROOMED, `lift.chain.half` m either side of its legs and eased
 * out over as much again — never over a run's own snow, which its grading
 * has packed (R26). */
export function groomWay(
  way: ChainWay,
  packed: Heightfield,
  onRun: (x: number, z: number) => boolean,
): void {
  const half = RR.lift.chain.half;
  const cell = packed.cell;
  const xs = [way.from.x, way.ring.x, way.station.x];
  const zs = [way.from.z, way.ring.z, way.station.z];
  const far = 2 * half;
  const c0 = Math.max(0, Math.floor((Math.min(...xs) - far - packed.originX) / cell));
  const c1 = Math.min(packed.cols - 1, Math.ceil((Math.max(...xs) + far - packed.originX) / cell));
  const r0 = Math.max(0, Math.floor((Math.min(...zs) - far - packed.originZ) / cell));
  const r1 = Math.min(packed.rows - 1, Math.ceil((Math.max(...zs) + far - packed.originZ) / cell));
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const x = packed.originX + col * cell;
      const z = packed.originZ + row * cell;
      const off = offWay(way, x, z);
      if (off >= half) continue;
      const groom = off <= 0 ? 1 : 1 - off / half;
      const i = row * packed.cols + col;
      if (groom > packed.data[i] && !onRun(x, z)) packed.data[i] = groom;
    }
  }
}

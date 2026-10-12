// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R25 — A REAL FACE'S WATER: its lakes, ponds, reservoirs and rivers mapped
// as areas, and its streams and rivers mapped as lines, laid onto a map
// raised on it.
//
// Read off the face's hints (`real-hints.ts`, baked off OpenStreetMap by
// `scripts/lib/real-face-water.mjs`): every body's rings on the map, the
// lowest its shore stands on the real face, and every stream's line
// downstream with its width. Each body is given a SURFACE on the map — the
// median of the map's ground under it, so it is dug into the slope above
// as far as it is banked below — and the ground under it is FLATTENED to
// exactly that, eased into the shore round it over `WATER.feather` m, so
// a frozen lake is a flat field of snow and the renderer lays its water at
// the surface. A body the ground would have to be moved further than
// `WATER.spread` for is left off, and a body reaching onto the valley
// floor's rows is cut along them (`clipped`). Done on the ground just
// baked, before anything is stood on it, and again once every run, pad and
// ramp is graded (`relayWater`); a run may cross a lake, but no tree,
// tower, station or building stands in one (`inWater`).
//
// A pure function of the face and the ground: no stream is drawn, and a
// map with no face carries no water and moves nothing.

import { hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  sampleField,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { SECTIONS, VILLAGE_STREETS as V, sideReach } from "../game/defs/village-streets.ts";
import { offWay, type ChainWay } from "./lift-chain.ts";
import { hubAt } from "./query.ts";
import { faceHeight } from "./real-face.ts";
import { realHints, ringArea } from "./real-hints.ts";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import { LEVEL_RULES } from "./rules.ts";
import { offRamp } from "./summit-ramps.ts";
import type { TerrainPlan } from "./terrain.ts";
import type { Hub, SummitRamp, WaterBody, WaterStream } from "./types.ts";

/** How a real face's water is laid on the map.
 *   * `feather`: how far round a body its ground is eased from the surface
 *     into the shore, m — `per` m of ease a metre the ground stands off
 *     the surface just outside it, within `min`..`max`.
 *   * `spread`: the most the ground under a body may stand off its surface
 *     (above or below) for it to be laid, m. The massif under a face is the
 *     dealt one with the real relief laid over it (`massif.ts`), so a real
 *     tarn's bench is not always there: a body the map's ground would have
 *     to be dug or banked further than this for is left off the map rather
 *     than set in a crater.
 *   * `settled`: how far the ground under a body may have been moved off
 *     its surface by the grading after it was laid before it is laid
 *     again (`relayWater`), m.
 *   * `floor`: the valley floor's rows kept dry, m above and below the foot
 *     of the face (`TerrainPlan.baseZ`) — where the hub, the bottom
 *     stations, the finishes and the wind tunnels stand (R29, R30). A body
 *     reaching into them is cut along them, and what lies past them is
 *     kept: a valley lake the dealt hub would stand in lies below it. */
export const WATER = {
  feather: { min: 10, max: 20, per: 1.5 },
  spread: 15,
  settled: 0.01,
  floor: { above: 150, below: 190 },
} as const;

/** A face's water on its map. */
export type FaceWater = { water: WaterBody[]; streams: WaterStream[] };

/** THE WATER of a map raised on a real face, its ground flattened under
 * every body (`ground` is changed in place); null on a dealt massif. Each
 * body's SURFACE is the middle (the median) of the ground under it, so it
 * is dug into the slope above as far as it is banked below. */
export function layWater(plan: TerrainPlan, ground: Heightfield): FaceWater | null {
  const face = plan.face;
  if (!face) return null;
  const hints = realHints(face.grid.id);
  if (!hints) return { water: [], streams: [] };
  const top = plan.baseZ - WATER.floor.above;
  const bottom = plan.baseZ + WATER.floor.below;
  const pieces: WaterBody[] = [];
  for (const h of hints.water) {
    const box = ringBox(h.rings[0]);
    const cut = box.z1 > top && box.z0 < bottom;
    // Kept off the valley floor: the piece above it and the piece below.
    for (const keep of cut ? [-1, 1] : [0]) {
      const rings = h.rings
        .map((r) => (keep === 0 ? r.slice() : clipRow(r, keep < 0 ? top : bottom, keep)))
        .filter((r, i) => i > 0 || r.length >= 6);
      if (rings.length === 0 || rings[0].length < 6) continue;
      const area = rings.reduce((a, r) => a + ringArea(r), 0);
      if (area < LEAST) continue;
      pieces.push({
        kind: h.kind,
        rings: rings.filter((r) => r.length >= 6),
        y: 0,
        realLevel: h.level,
        area,
        clipped: h.clipped || cut,
      });
    }
  }
  const water = flatten(ground, pieces);
  const streams = hints.streams.map((s) => ({
    kind: s.kind,
    line: s.line.slice(),
    width: s.width,
    realLevel: faceHeight(face.grid, s.line[0], s.line[1]),
  }));
  return { water, streams };
}

/** The least body laid, m² (the bake's own floor). */
const LEAST = 400;

/** A ring (x, z pairs) cut along the row `z`, the side `keep` kept (-1
 * the rows above it, +1 those below) — Sutherland–Hodgman on one edge. */
function clipRow(ring: Float32Array, z: number, keep: number): Float32Array {
  return clipLine(ring, 1, z, keep);
}

/** A ring cut along the line where its `axis` (0 x, 1 z) is `at`, the
 * side `keep` kept (-1 the lesser, +1 the greater). */
function clipLine(ring: Float32Array, axis: 0 | 1, at: number, keep: number): Float32Array {
  const out: number[] = [];
  const n = ring.length;
  const ins = (i: number): boolean => (ring[i + axis] - at) * keep >= 0;
  for (let i = 0; i < n; i += 2) {
    const j = (i + n - 2) % n;
    const [a, b] = [ins(j), ins(i)];
    if (a !== b) {
      const t = (at - ring[j + axis]) / (ring[i + axis] - ring[j + axis]);
      const x = ring[j] + (ring[i] - ring[j]) * t;
      const z = ring[j + 1] + (ring[i + 1] - ring[j + 1]) * t;
      if (axis === 0) out.push(at, z);
      else out.push(x, at);
    }
    if (b) out.push(ring[i], ring[i + 1]);
  }
  return Float32Array.from(out);
}

/** A body's bounds, m. */
type Box = { x0: number; z0: number; x1: number; z1: number };

function boxOf(body: WaterBody): Box {
  return ringBox(body.rings[0]);
}

function ringBox(r: Float32Array): Box {
  const box = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  for (let i = 0; i < r.length; i += 2) {
    box.x0 = Math.min(box.x0, r[i]);
    box.x1 = Math.max(box.x1, r[i]);
    box.z0 = Math.min(box.z0, r[i + 1]);
    box.z1 = Math.max(box.z1, r[i + 1]);
  }
  return box;
}

/** The cells of `ground` in a body (even-odd over all its rings, so an
 * island stands dry), row by row, as indices. */
function cellsIn(ground: Heightfield, body: WaterBody): number[] {
  const { cols, rows, cell } = ground;
  const box = boxOf(body);
  const out: number[] = [];
  const r0 = Math.max(0, Math.ceil(box.z0 / cell));
  const r1 = Math.min(rows - 1, Math.floor(box.z1 / cell));
  for (let r = r0; r <= r1; r++) {
    const z = r * cell;
    const xs: number[] = [];
    for (const ring of body.rings) {
      const n = ring.length;
      for (let i = 0; i < n; i += 2) {
        const j = (i + 2) % n;
        const [az, bz] = [ring[i + 1], ring[j + 1]];
        if (az > z === bz > z) continue;
        xs.push(ring[i] + ((ring[j] - ring[i]) * (z - az)) / (bz - az));
      }
    }
    xs.sort((a, c) => a - c);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil(xs[k] / cell));
      const c1 = Math.min(cols - 1, Math.floor(xs[k + 1] / cell));
      for (let c = c0; c <= c1; c++) out.push(r * cols + c);
    }
  }
  return out;
}

/** The ground under every body flattened to its surface and eased into
 * the shore round it, and the bodies laid: first each body's cells (a cell
 * the body before it holds is that one's) and its surface — the median of
 * the ground over them — a body whose ground stands further off it than
 * `WATER.spread` left out; then the shore round each eased toward its
 * surface by the distance to its rings, never a cell in water; then every
 * cell in water set to its body's surface exactly. */
function flatten(ground: Heightfield, pieces: readonly WaterBody[]): WaterBody[] {
  const { cols, rows, data } = ground;
  const wet = new Uint8Array(cols * rows);
  const F = WATER.feather;
  const water: WaterBody[] = [];
  const feathers: number[] = [];
  for (const body of pieces) {
    if (water.length >= 255) break;
    const cells = cellsIn(ground, body).filter((i) => wet[i] === 0);
    if (cells.length === 0) continue;
    const heights = Float64Array.from(cells, (i) => data[i]).sort();
    const y = heights[heights.length >> 1];
    const spread = Math.max(y - heights[0], heights[heights.length - 1] - y);
    if (spread > WATER.spread) continue;
    water.push({ ...body, y });
    feathers.push(Math.min(F.max, Math.max(F.min, spread * F.per)));
    for (const i of cells) wet[i] = water.length;
  }
  settle(
    ground,
    water,
    wet,
    feathers,
    water.map((_, b) => b),
  );
  return water;
}

/** The shore round each body of `only` eased toward its surface by the
 * distance to its rings over its feather, never a cell in water, then
 * every cell in water (`wet`: its body's place in `water`, plus one) set
 * to its body's surface exactly. */
function settle(
  ground: Heightfield,
  water: readonly WaterBody[],
  wet: Uint8Array,
  feathers: readonly number[],
  only: readonly number[],
): void {
  const { cols, rows, cell, data } = ground;
  for (const b of only) {
    const body = water[b];
    const feather = feathers[b];
    const box = boxOf(body);
    const c0 = Math.max(0, Math.floor((box.x0 - feather) / cell));
    const c1 = Math.min(cols - 1, Math.ceil((box.x1 + feather) / cell));
    const r0 = Math.max(0, Math.floor((box.z0 - feather) / cell));
    const r1 = Math.min(rows - 1, Math.ceil((box.z1 + feather) / cell));
    const w = c1 - c0 + 1;
    const dist = new Float32Array(w * (r1 - r0 + 1)).fill(feather);
    for (const ring of body.rings) {
      const n = ring.length;
      for (let i = 0; i < n; i += 2) {
        const j = (i + 2) % n;
        const [ax, az, bx, bz] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
        const ex = bx - ax;
        const ez = bz - az;
        const l2 = ex * ex + ez * ez || 1;
        const cc0 = Math.max(c0, Math.floor((Math.min(ax, bx) - feather) / cell));
        const cc1 = Math.min(c1, Math.ceil((Math.max(ax, bx) + feather) / cell));
        const rr0 = Math.max(r0, Math.floor((Math.min(az, bz) - feather) / cell));
        const rr1 = Math.min(r1, Math.ceil((Math.max(az, bz) + feather) / cell));
        for (let r = rr0; r <= rr1; r++) {
          for (let c = cc0; c <= cc1; c++) {
            const [x, z] = [c * cell, r * cell];
            const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2));
            const d = hypot(ax + ex * t - x, az + ez * t - z);
            const k = (r - r0) * w + (c - c0);
            if (d < dist[k]) dist[k] = d;
          }
        }
      }
    }
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        const d = dist[(r - r0) * w + (c - c0)];
        if (wet[i] !== 0 || d >= feather) continue;
        data[i] = body.y + (data[i] - body.y) * smoothstep(0, feather, d);
      }
    }
  }
  const picked = new Uint8Array(water.length + 1);
  for (const b of only) picked[b + 1] = 1;
  for (let i = 0; i < wet.length; i++) if (picked[wet[i]] !== 0) data[i] = water[wet[i] - 1].y;
}

/** What the water laid again keeps its hands off: the stations' pads
 * (and the drags' tops), the ramps off them and the way cut to the next
 * lift's queue — each graded to a level a rider is let go on. */
export type WaterKeep = {
  pads: readonly { x: number; z: number; r: number }[];
  ramps: readonly SummitRamp[];
  way: ChainWay | null;
};

/** THE WATER LAID AGAIN once everything else is graded (`ground` changed
 * in place): a run pressed across a body, a station's pad, its ramps and
 * the way cut to the next queue leave the ground under it off its
 * surface, and the renderer would draw the water floating over the snow
 * or the snow through it. Every body whose ground stands further off
 * its surface than `WATER.settled` is flattened to it once more and eased
 * into the shore round it as it was first laid — a run across it carried
 * down onto it and off it again, never a step at the shore — its feather
 * grown with how far its ground had moved. A body that would move the
 * ground of anything in `keep` is left off the map instead, its ground as
 * graded. The cells of a body nothing moved are left alone, so a face
 * whose water nothing touched builds as before. Every run's line, its
 * kickers and drops (`runs`) and every ramp's ends are read off the ground
 * again. */
export function relayWater(
  ground: Heightfield,
  laid: FaceWater | null,
  runs: readonly RelaidRun[],
  keep: WaterKeep,
): void {
  const water = laid?.water;
  if (!laid || !water || water.length === 0) return;
  const { cols, rows, cell, data } = ground;
  const wet = new Uint8Array(cols * rows);
  const F = WATER.feather;
  const off = new Float64Array(water.length);
  water.forEach((body, b) => {
    for (const i of cellsIn(ground, body)) {
      if (wet[i] !== 0) continue;
      wet[i] = b + 1;
      off[b] = Math.max(off[b], Math.abs(data[i] - body.y));
    }
  });
  const kept = (x: number, z: number): boolean =>
    keep.pads.some((p) => hypot(x - p.x, z - p.z) < p.r + RR.lift.padBlend) ||
    keep.ramps.some((r) => offRamp(r, x, z) < 0) ||
    (!!keep.way && offWay(keep.way, x, z) < RR.lift.padBlend);
  // Every run's line as the ground stands: the water laid again may
  // leave it no steeper than its kind allows, or than it was, and climbing
  // nowhere it did not (R27).
  const lines = runs.map((run) => {
    const pts = run.walked.points;
    const ys = Float64Array.from(pts, (p) => sampleField(ground, p.x, p.z));
    const most = run.walked.spec.kind === "road" ? RR.road.grade : LEVEL_RULES.track.maxGrade;
    return { pts, ys, most };
  });
  /** Whether the ground as it now stands leaves a run steeper, or
   * climbing more, anywhere in the box than it was (R27). */
  const harder = (box: Box): boolean =>
    lines.some(({ pts, ys, most }) => {
      const out = (a: { x: number; z: number }) =>
        a.x < box.x0 || a.x > box.x1 || a.z < box.z0 || a.z > box.z1;
      for (let i = 0; i + WINDOW < pts.length; i++) {
        const [p, q] = [pts[i], pts[i + WINDOW]];
        if (out(p) && out(q)) continue;
        const span = spanOf(pts, i);
        const rate = (sampleField(ground, p.x, p.z) - sampleField(ground, q.x, q.z)) / span;
        const was = (ys[i] - ys[i + WINDOW]) / span;
        if (rate > Math.max(most, was) || -rate > Math.max(0, -was) + SLACK) return true;
      }
      return false;
    });
  const dropped = new Set<number>();
  for (let b = 0; b < water.length; b++) {
    if (off[b] <= WATER.settled) continue;
    const feather = Math.min(F.max, Math.max(F.min, off[b] * F.per));
    const box = boxOf(water[b]);
    const c0 = Math.max(0, Math.floor((box.x0 - feather) / cell));
    const c1 = Math.min(cols - 1, Math.ceil((box.x1 + feather) / cell));
    const r0 = Math.max(0, Math.floor((box.z0 - feather) / cell));
    const r1 = Math.min(rows - 1, Math.ceil((box.z1 + feather) / cell));
    const w = c1 - c0 + 1;
    const was = new Float32Array(w * (r1 - r0 + 1));
    for (let r = r0; r <= r1; r++)
      was.set(data.subarray(r * cols + c0, r * cols + c1 + 1), (r - r0) * w);
    const feathers = water.map(() => feather);
    settle(ground, water, wet, feathers, [b]);
    let touched = harder({ x0: c0 * cell, x1: c1 * cell, z0: r0 * cell, z1: r1 * cell });
    for (let r = r0; r <= r1 && !touched; r++) {
      for (let c = c0; c <= c1 && !touched; c++) {
        const moved = Math.abs(data[r * cols + c] - was[(r - r0) * w + (c - c0)]) > MOVED;
        touched = moved && kept(c * cell, r * cell);
      }
    }
    if (!touched) continue;
    for (let r = r0; r <= r1; r++)
      data.set(was.subarray((r - r0) * w, (r - r0 + 1) * w), r * cols + c0);
    dropped.add(b);
  }
  if (dropped.size > 0) {
    // A cell a body left off had claimed (the first body over a cell takes
    // it) is the next body's that lies over it: its surface, not the
    // dropped body's.
    water.forEach((body, b) => {
      if (dropped.has(b)) return;
      for (const i of cellsIn(ground, body)) if (dropped.has(wet[i] - 1)) data[i] = body.y;
    });
    laid.water = water.filter((_, b) => !dropped.has(b));
  }
  for (const run of runs) {
    for (const set of [run.walked.points, run.kickers, run.drops])
      for (const p of set) p.y = sampleField(ground, p.x, p.z);
  }
  for (const r of keep.ramps) {
    r.from.y = sampleField(ground, r.from.x, r.from.z);
    r.to.y = sampleField(ground, r.to.x, r.to.z);
  }
}

/** THE VILLAGE'S ROOM kept dry (`laid` changed in place): the village is
 * laid off the hub's valley edge (`valley` the way z runs into the
 * valley), its streets `VILLAGE_STREETS.main` and `.back` out from it and
 * its centre tried within `.tries.centre` of the ski area's village point
 * `vx` (`village-streets.ts`). Where the water leaves the rows it is laid
 * in no dry stretch the shortest village fits along — a lake or a river
 * reaching up to the hub's edge, a real town on its shore — every body is
 * cut back out of that room along its far row and its two ends, the rest
 * of it kept, so the village stands on the shore rather than on the ice.
 * The ground under the cut is the body's flat surface already. A face
 * whose village has room is left as it is. */
export function keepVillageDry(laid: FaceWater | null, hub: Hub, vx: number, valley: 1 | -1): void {
  const water = laid?.water;
  if (!laid || !water || water.length === 0 || hub.top.length < 2) return;
  const hx0 = hub.x0 + ROOM.step;
  const hx1 = hub.x0 + hub.step * (hub.top.length - 1) - ROOM.step;
  const reach = Math.max(...V.tries.centre.map(Math.abs)) + V.span.most / 2;
  const x0 = Math.max(hx0, vx - reach);
  const x1 = Math.min(hx1, vx + reach);
  if (x1 <= x0) return;
  let edge = valley > 0 ? -Infinity : Infinity;
  for (let x = x0; x <= x1; x += ROOM.step) {
    const e = hubAt(hub, x);
    if (e) edge = valley > 0 ? Math.max(edge, e.bottom) : Math.min(edge, e.top);
  }
  if (!Number.isFinite(edge)) return;
  const depth =
    V.main.most +
    V.back.most +
    V.bend +
    Math.max(sideReach(SECTIONS.back, 0), sideReach(SECTIONS.back, 1)) +
    ROOM.lot;
  const far = edge + valley * depth;
  const [z0, z1] = valley > 0 ? [edge, far] : [far, edge];
  // The longest run along the room of columns dry through its depth.
  const need =
    V.span.least * Math.min(...V.tries.span) +
    2 * Math.max(sideReach(SECTIONS.cross, 0), sideReach(SECTIONS.cross, 1));
  let run = 0;
  for (let x = x0; x <= x1; x += ROOM.step) {
    let dry = true;
    for (let z = z0; z <= z1 && dry; z += ROOM.step) dry = !inWater(water, x, z);
    run = dry ? run + ROOM.step : 0;
    if (run >= need) return;
  }
  const out: WaterBody[] = [];
  for (const body of water) {
    const box = boxOf(body);
    if (box.x1 < x0 || box.x0 > x1 || box.z1 < z0 || box.z0 > z1) {
      out.push(body);
      continue;
    }
    // Its pieces past either end of the room, then beyond its far row and
    // on the hub's side of its near one.
    const cuts: ((r: Float32Array) => Float32Array)[] = [
      (r) => clipLine(r, 0, x0, -1),
      (r) => clipLine(r, 0, x1, 1),
      (r) => clipLine(clipLine(clipLine(r, 0, x0, 1), 0, x1, -1), 1, z1, 1),
      (r) => clipLine(clipLine(clipLine(r, 0, x0, 1), 0, x1, -1), 1, z0, -1),
    ];
    for (const cut of cuts) {
      const rings = body.rings.map(cut);
      if (rings[0].length < 6) continue;
      const kept = rings.filter((r) => r.length >= 6);
      const area = kept.reduce((a, r) => a + ringArea(r), 0);
      if (area < LEAST) continue;
      out.push({ ...body, rings: kept, area, clipped: true });
    }
  }
  laid.water = out.slice(0, 255);
}

/** The village's room as `keepVillageDry` reads it: `step` m between its
 * samples (and kept off the hub's ends), and `lot` m behind the back
 * street for the lots its houses stand on. */
const ROOM = { step: 5, lot: 20 } as const;

/** How far a cell may move and count as unmoved, m. */
const MOVED = 1e-3;

/** A run's line read over `WINDOW` of its points (about 10 m), and how
 * much more it may climb than it did there once the water is laid again,
 * rise over run. */
const WINDOW = 5;
const SLACK = 0.002;

/** The ground distance over a window of a run's line from point `i`. */
function spanOf(pts: readonly { x: number; z: number }[], i: number): number {
  const [p, q] = [pts[i], pts[i + WINDOW]];
  return Math.max(1e-6, hypot(q.x - p.x, q.z - p.z));
}

/** A run as the water laid again reads it: its line, kickers and drops,
 * each read off the ground again afterwards. */
type Point3 = { x: number; y: number; z: number };
export type RelaidRun = {
  walked: { points: Point3[]; spec: { kind: string } };
  kickers: Point3[];
  drops: Point3[];
};
const boxes = new WeakMap<WaterBody, Box>();

/** Whether (x, z) lies in a body of `water` (in its outer ring and out of
 * every hole) — what a tree, a tower, a station, a building and a pad are
 * kept off. None on a map with no water. */
export function inWater(water: readonly WaterBody[] | null | undefined, x: number, z: number) {
  if (!water) return false;
  for (const body of water) {
    let box = boxes.get(body);
    if (!box) boxes.set(body, (box = boxOf(body)));
    if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1) continue;
    let odd = false;
    for (const ring of body.rings) {
      const n = ring.length;
      for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
        const [xi, zi, xj, zj] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) odd = !odd;
      }
    }
    if (odd) return true;
  }
  return false;
}

/** Whether any of a circle of radius `r` round (x, z) — its middle and
 * eight points round its rim — lies in water. */
export function waterWithin(
  water: readonly WaterBody[] | null | undefined,
  x: number,
  z: number,
  r: number,
): boolean {
  if (!water || water.length === 0) return false;
  if (inWater(water, x, z)) return true;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (inWater(water, x + Math.sin(a) * r, z + Math.cos(a) * r)) return true;
  }
  return false;
}

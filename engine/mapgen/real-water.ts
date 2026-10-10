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
// floor's rows is cut along them (`clipped`). Done once, on the ground
// just baked, before anything is stood on it; a run may cross a lake, but
// no tree, tower, station or building stands in one (`inWater`).
//
// A pure function of the face and the ground: no stream is drawn, and a
// map with no face carries no water and moves nothing.

import { hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Heightfield } from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { faceHeight } from "./real-face.ts";
import { realHints, ringArea } from "./real-hints.ts";
import type { TerrainPlan } from "./terrain.ts";
import type { WaterBody, WaterStream } from "./types.ts";

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
 *   * `floor`: the valley floor's rows kept dry, m above and below the foot
 *     of the face (`TerrainPlan.baseZ`) — where the hub, the bottom
 *     stations, the finishes and the wind tunnels stand (R29, R30). A body
 *     reaching into them is cut along them, and what lies past them is
 *     kept: a valley lake the dealt hub would stand in lies below it. */
export const WATER = {
  feather: { min: 10, max: 20, per: 1.5 },
  spread: 15,
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
  const out: number[] = [];
  const n = ring.length;
  const ins = (i: number): boolean => (ring[i + 1] - z) * keep >= 0;
  for (let i = 0; i < n; i += 2) {
    const j = (i + n - 2) % n;
    const [a, b] = [ins(j), ins(i)];
    if (a !== b) {
      const t = (z - ring[j + 1]) / (ring[i + 1] - ring[j + 1]);
      out.push(ring[j] + (ring[i] - ring[j]) * t, z);
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
  const { cols, rows, cell, data } = ground;
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
  for (let b = 0; b < water.length; b++) {
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
  for (let i = 0; i < wet.length; i++) if (wet[i] !== 0) data[i] = water[wet[i] - 1].y;
  return water;
}

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

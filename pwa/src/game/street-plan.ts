// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S STREETS AS DRAWN, DECIDED — the surfaces laid over the
// snow where the engine's street plan runs (`village.ts`'s `villageOf`), as
// plain arrays (`StreetGeo`) a view makes meshes of (`streets-view.ts`) and
// the tests read:
//
//   * ROAD — every street's carriageway, its parking strips and the strip
//     under its windrows, ribbon by ribbon (u across, mirrored about the
//     centreline: 0 the crown, ½ a lane's edge, 1 the kerb; v along, m),
//     short of its junctions, and every JUNCTION'S patch between them;
//   * AREA — the car park's and the junctions' packed snow (u, v in plan);
//   * WALK — every sidewalk raised a kerb over the road, its back edge
//     turned down into the snow; SQUARE — the square at the sidewalk's
//     level, its edges turned down the same way;
//   * MARKS — what is painted: a crossing's stripes, worn by the tyres, on
//     its patch of road swept darker, and the car park's bays scraped into
//     its snow; vertex colours alone.
//
// Every surface stands a hair over the drawn snow (`LOOSE`, `LIFT`) and the
// view pushes each forward in depth a step further than the one under it,
// so nothing fights the ground or the next layer. Three-free.

import {
  besidePoint,
  sideReach,
  streetAt,
  trimAt,
  villageOf,
  type Level,
  type Street,
  type StreetPoint,
  type Village,
} from "@engine";

import { LOOSE } from "./trail-stamp.ts";

/** One surface's arrays: positions, uvs, colours (linear 0..1, a
 * multiply over its texture) and triangle indices. */
export type StreetGeo = { pos: number[]; uv: number[]; col: number[]; idx: number[] };

/** Everything laid. */
export type StreetSurfaces = {
  road: StreetGeo;
  area: StreetGeo;
  walk: StreetGeo;
  square: StreetGeo;
  marks: StreetGeo;
};

/** How far the road stands over the drawn snow, m; the kerb's rise from
 * the road to the sidewalk; how far down a sidewalk's or the square's back
 * edge is turned into the snow; how often a ribbon is sampled along. */
export const LIFT = 0.03;
export const KERB = 0.12;
const SKIRT = 0.3;
const STEP = 2;

/** What one tile of each painted texture covers, m (`street-paint.ts`
 * paints them to these): the road's along it, the packed snow's and the
 * sidewalk's square in plan. */
export const TILE = { road: 32, area: 16, walk: 4, square: 12 } as const;

/** The road's crown, m: how far each lane's middle stands over its edge
 * (a road is cambered to shed its melt). */
const CAMBER = 0.04;

/** The tints a kind of street's surface is laid in over its texture: the
 * main street ploughed down to the grit, the back streets whiter, the road
 * out whitest. */
const ROAD_TINT: Record<Street["kind"], [number, number, number]> = {
  main: [0.94, 0.94, 0.95],
  back: [1, 1, 1],
  cross: [0.98, 0.98, 0.99],
  road: [1.02, 1.02, 1.03],
  aisle: [0.97, 0.97, 0.98],
};

function geo(): StreetGeo {
  return { pos: [], uv: [], col: [], idx: [] };
}

/** The drawn road at (x, z): the ground, the loose cover the shader lays
 * on it and the lift. */
export function roadY(level: Level, x: number, z: number): number {
  return level.groundAt(x, z) + LOOSE + LIFT;
}

/** A grid ribbon: `rows` along (each a list of vertices across), joined
 * into quads. Each vertex: x, y, z, u, v, r, g, b. */
function ribbon(g: StreetGeo, rows: readonly (readonly number[])[][]): void {
  const base = g.pos.length / 3;
  const across = rows[0]?.length ?? 0;
  for (const row of rows) {
    for (const p of row) {
      g.pos.push(p[0], p[1], p[2]);
      g.uv.push(p[3], p[4]);
      g.col.push(p[5], p[6], p[7]);
    }
  }
  // Wound so its first quad's face looks up (a skirt's, out): the
  // vertices' order across decides it, whichever way the rows run.
  let up = true;
  if (rows.length > 1 && across > 1) {
    const a = rows[0][0];
    const b = rows[0][1];
    const c = rows[1][0];
    const ux = b[0] - a[0];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vz = c[2] - a[2];
    // The y of (b − a) × (c − a): up when positive.
    up = uz * vx - ux * vz > 0;
  }
  for (let i = 0; i + 1 < rows.length; i++) {
    for (let j = 0; j + 1 < across; j++) {
      const a = base + i * across + j;
      const b = a + across;
      if (up) g.idx.push(a, a + 1, b, b, a + 1, b + 1);
      else g.idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
}

/** Push the triangle (a, b, c), wound so its face looks up. */
function upward(g: StreetGeo, a: number, b: number, c: number): void {
  const p = g.pos;
  const ux = p[b * 3] - p[a * 3];
  const uz = p[b * 3 + 2] - p[a * 3 + 2];
  const vx = p[c * 3] - p[a * 3];
  const vz = p[c * 3 + 2] - p[a * 3 + 2];
  if (uz * vx - ux * vz > 0) g.idx.push(a, b, c);
  else g.idx.push(a, c, b);
}

/** The arcs along a street from `s0` to `s1`, every `STEP` m. */
function arcs(s0: number, s1: number): number[] {
  const n = Math.max(1, Math.ceil((s1 - s0) / STEP));
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(s0 + ((s1 - s0) * i) / n);
  return out;
}

/** The cross-section of a street's road as laid: each break across it,
 * left to right — its lateral, its u and its share of the camber. */
function roadSection(st: Street): { lat: number; u: number; crown: number }[] {
  const S = st.section;
  const out: { lat: number; u: number; crown: number }[] = [];
  const side = (k: 0 | 1, sign: number) => {
    const sd = S.sides[k];
    const pts = [
      { lat: S.lane + sd.park + sd.bank, u: 1, crown: 0 },
      ...(sd.park > 0 ? [{ lat: S.lane + sd.park, u: 0.62, crown: 0 }] : []),
      { lat: S.lane, u: 0.5, crown: 0 },
      { lat: S.lane * 0.5, u: 0.25, crown: 0.75 },
    ];
    return pts.map((p) => ({ lat: sign * p.lat, u: p.u, crown: p.crown }));
  };
  out.push(...side(0, -1));
  out.push({ lat: 0, u: 0, crown: 1 });
  out.push(...side(1, 1).reverse());
  return out;
}

/** THE SURFACES of `level`'s village, or null where it has none. */
export function planStreets(level: Level): StreetSurfaces | null {
  const v = villageOf(level);
  if (!v) return null;
  const out: StreetSurfaces = {
    road: geo(),
    area: geo(),
    walk: geo(),
    square: geo(),
    marks: geo(),
  };
  const at: StreetPoint = { x: 0, y: 0, z: 0, s: 0, heading: 0 };
  for (const st of v.streets) {
    const t0 = trimAt(v, st, 0).road;
    const t1 = trimAt(v, st, 1).road;
    if (st.length - t0 - t1 < 1) continue;
    const section = roadSection(st);
    const tint = ROAD_TINT[st.kind];
    const rows = arcs(t0, st.length - t1).map((s) => {
      streetAt(st, s, at);
      return section.map((c) => {
        const q = besidePoint(at, c.lat);
        const y = roadY(level, q.x, q.z) + c.crown * CAMBER;
        return [q.x, y, q.z, c.u, s / TILE.road, ...tint];
      });
    });
    ribbon(out.road, rows);
  }
  junctions(level, v, out.area);
  areas(level, v, out);
  walks(level, v, out.walk);
  crossings(level, v, out.marks);
  bays(level, v, out.marks);
  return out;
}

/** EVERY JUNCTION'S PATCH: a fan from its middle to the corners of the
 * streets' trimmed ends, in order round it — the packed snow between them,
 * laid in plan as the car park's is. */
function junctions(level: Level, v: Village, g: StreetGeo): void {
  const at: StreetPoint = { x: 0, y: 0, z: 0, s: 0, heading: 0 };
  for (const j of v.junctions) {
    if (j.exit || j.streets.length < 2) continue;
    const corners: { x: number; z: number; a: number }[] = [];
    for (const id of j.streets) {
      const st = v.streets.find((s) => s.id === id);
      if (!st) continue;
      const end = st.from === j.id ? 0 : 1;
      const t = trimAt(v, st, end).road;
      streetAt(st, end === 0 ? t : st.length - t, at);
      const S = st.section;
      for (const k of [0, 1] as const) {
        const sd = S.sides[k];
        const lat = (k === 0 ? -1 : 1) * (S.lane + sd.park + sd.bank);
        const q = besidePoint(at, lat);
        corners.push({ x: q.x, z: q.z, a: Math.atan2(q.x - j.x, q.z - j.z) });
      }
    }
    if (corners.length < 3) continue;
    corners.sort((p, q) => p.a - q.a);
    // The fan: the middle, a ring half way out, the corners.
    const base = g.pos.length / 3;
    const put = (x: number, z: number, crown: number) => {
      g.pos.push(x, roadY(level, x, z) + crown * CAMBER, z);
      g.uv.push(x / TILE.area, z / TILE.area);
      g.col.push(...ROAD_TINT.main);
    };
    put(j.x, j.z, 1);
    for (const c of corners) put((j.x + c.x) / 2, (j.z + c.z) / 2, 0.5);
    for (const c of corners) put(c.x, c.z, 0);
    const n = corners.length;
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      const mi = base + 1 + i;
      const mk = base + 1 + k;
      const oi = base + 1 + n + i;
      const ok = base + 1 + n + k;
      upward(g, base, mi, mk);
      upward(g, mi, ok, mk);
      upward(g, mi, oi, ok);
    }
  }
}

/** A rectangle of an area laid every `STEP` m: its middle, its heading
 * (out of the street), its half length along the street, its half depth;
 * `y` the surface over the drawn snow, `uvScale` metres a texture's tile. */
function patch(
  level: Level,
  g: StreetGeo,
  x: number,
  z: number,
  heading: number,
  half: number,
  depth: number,
  lift: number,
  tint: readonly number[],
  skirt: boolean,
  tile: number,
): void {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const na = Math.max(1, Math.ceil((2 * half) / STEP));
  const nd = Math.max(1, Math.ceil((2 * depth) / STEP));
  const rows: number[][][] = [];
  for (let i = 0; i <= nd; i++) {
    const d = -depth + (2 * depth * i) / nd;
    const row: number[][] = [];
    for (let k = 0; k <= na; k++) {
      // Left to right seen along the heading: from +x of its right to −.
      const a = -half + (2 * half * k) / na;
      const px = x + fx * d + fz * a;
      const pz = z + fz * d - fx * a;
      row.push([px, roadY(level, px, pz) + lift, pz, px / tile, pz / tile, ...tint]);
    }
    rows.push(row);
  }
  ribbon(g, rows);
  if (!skirt) return;
  // The edges turned down into the snow round it.
  const edges: [number, number, number, number][] = [
    [-depth, -half, -depth, half],
    [-depth, half, depth, half],
    [depth, half, depth, -half],
    [depth, -half, -depth, -half],
  ];
  for (const [d0, a0, d1, a1] of edges) {
    const n = Math.max(1, Math.ceil(Math.hypot(d1 - d0, a1 - a0) / STEP));
    const top: number[][] = [];
    const low: number[][] = [];
    for (let i = 0; i <= n; i++) {
      const d = d0 + ((d1 - d0) * i) / n;
      const a = a0 + ((a1 - a0) * i) / n;
      const px = x + fx * d + fz * a;
      const pz = z + fz * d - fx * a;
      const y = roadY(level, px, pz) + lift;
      top.push([px, y, pz, px / tile, pz / tile, ...tint]);
      low.push([px, y - lift - SKIRT, pz, px / tile, (pz + 0.3) / tile, ...tint]);
    }
    ribbon(g, [top, low]);
  }
}

/** THE OPEN PLACES: the square at the sidewalk's level, paved and swept
 * (on the walk's stone); the car park at the road's, packed. */
function areas(level: Level, v: Village, out: StreetSurfaces): void {
  for (const a of v.areas) {
    // Out to the main street's sidewalk, past the plan's half-metre gap.
    const grow = 0.6;
    const fx = Math.sin(a.heading);
    const fz = Math.cos(a.heading);
    const x = a.x - fx * (grow / 2);
    const z = a.z - fz * (grow / 2);
    if (a.kind === "square") {
      patch(
        level,
        out.square,
        x,
        z,
        a.heading,
        a.half,
        a.depth + grow / 2,
        KERB,
        [0.98, 0.98, 0.98],
        true,
        TILE.square,
      );
    } else {
      patch(
        level,
        out.area,
        x,
        z,
        a.heading,
        a.half,
        a.depth + grow / 2,
        -0.005,
        [1, 1, 1],
        false,
        TILE.area,
      );
    }
  }
}

/** THE SIDEWALKS: each raised a kerb over the road, its back edge turned
 * down into the snow (u across in metres, v along). */
function walks(level: Level, v: Village, g: StreetGeo): void {
  for (const w of v.walks) {
    const st = v.streets.find((s) => s.id === w.street);
    if (!st || w.points.length < 2) continue;
    const half = w.width / 2;
    const W = TILE.walk;
    // The way out from the road: a left walk's back is to its left.
    const out = w.side === 0 ? -1 : 1;
    const rows = w.points.map((p) => {
      const front = besidePoint(p, -out * half);
      const back = besidePoint(p, out * half);
      const yf = roadY(level, front.x, front.z) + KERB;
      const yb = roadY(level, back.x, back.z) + KERB;
      const row = [
        [front.x, yf, front.z, 0, p.s / W, 1, 1, 1],
        [back.x, yb, back.z, w.width / W, p.s / W, 1, 1, 1],
        // The back edge again, so the turn down keeps a normal of its own.
        [back.x, yb, back.z, w.width / W, p.s / W, 0.95, 0.95, 0.96],
        [back.x, yb - KERB - LIFT - SKIRT, back.z, (w.width + 0.3) / W, p.s / W, 0.95, 0.95, 0.96],
      ];
      // Left to right across its way.
      return out < 0 ? row.reverse() : row;
    });
    ribbon(g, rows);
  }
}

/** THE CROSSINGS: the road under each swept to its darker grit, then the
 * stripes — bars along the street half a metre wide, half a metre apart,
 * across its carriageway — their paint worn through where the tyres run. */
function crossings(level: Level, v: Village, g: StreetGeo): void {
  const at: StreetPoint = { x: 0, y: 0, z: 0, s: 0, heading: 0 };
  for (const c of v.crossings) {
    const st = v.streets.find((s) => s.id === c.street);
    if (!st) continue;
    const half = c.across / 2;
    const s0 = c.s - c.width / 2;
    const s1 = c.s + c.width / 2;
    // The swept patch under it, a little wider than the stripes.
    const swept = [0.55, 0.53, 0.52];
    const rows: number[][][] = [];
    for (const s of [s0 - 0.4, c.s, s1 + 0.4]) {
      streetAt(st, s, at);
      const row: number[][] = [];
      for (const lat of [-half, -half / 2, 0, half / 2, half]) {
        const q = besidePoint(at, lat);
        row.push([q.x, roadY(level, q.x, q.z) + CAMBER + 0.006, q.z, 0, 0, ...swept]);
      }
      rows.push(row);
    }
    ribbon(g, rows);
    // The bars.
    const bar = 0.5;
    const n = Math.floor((2 * half + bar) / (2 * bar));
    const start = -((n - 1) * 2 * bar) / 2;
    for (let i = 0; i < n; i++) {
      const lat = start + i * 2 * bar;
      // Worn where a lane's wheels run (a third and two thirds out), whole
      // at the crown and the kerbs.
      const across = Math.abs(lat) / Math.max(1e-6, st.section.lane);
      const wear = Math.abs(across - 0.25) < 0.12 || Math.abs(across - 0.75) < 0.12 ? 0.55 : 0.9;
      const rowsB: number[][][] = [];
      for (const s of [s0, (s0 + s1) / 2, s1]) {
        streetAt(st, s, at);
        const row: number[][] = [];
        for (const d of [-bar / 2, bar / 2]) {
          const q = besidePoint(at, lat + d);
          const k = wear * (0.85 + 0.15 * Math.sin(q.x * 3.1 + q.z * 2.3));
          row.push([
            q.x,
            roadY(level, q.x, q.z) + CAMBER + 0.012,
            q.z,
            0,
            0,
            k,
            k * 0.97,
            k * 0.86,
          ]);
        }
        rowsB.push(row);
      }
      ribbon(g, rowsB);
    }
  }
}

/** THE CAR PARK'S BAYS, scraped into its snow: the line between two bays
 * a darker groove the tyres keep open. */
function bays(level: Level, v: Village, g: StreetGeo): void {
  for (const b of v.bays) {
    if (b.kind !== "lot") continue;
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    // The line down its right side, from its mouth to its head.
    const rx = fz;
    const rz = -fx;
    const ox = b.x + rx * (b.width / 2);
    const oz = b.z + rz * (b.width / 2);
    const rows: number[][][] = [];
    for (const d of [-b.length / 2, 0, b.length / 2]) {
      const row: number[][] = [];
      for (const w of [-0.06, 0.06]) {
        const x = ox + fx * d + rx * w;
        const z = oz + fz * d + rz * w;
        row.push([x, roadY(level, x, z) + 0.01, z, 0, 0, 0.68, 0.67, 0.66]);
      }
      rows.push(row);
    }
    ribbon(g, rows);
  }
}

/** Whether a point is within `pad` m of a street of the village's road
 * (for the labs and the tests). */
export function nearRoad(v: Village, x: number, z: number, pad = 0): boolean {
  for (const st of v.streets) {
    const r = Math.max(sideReach(st.section, 0), sideReach(st.section, 1)) + pad;
    for (const p of st.points) if (Math.hypot(p.x - x, p.z - z) < r) return true;
  }
  return false;
}

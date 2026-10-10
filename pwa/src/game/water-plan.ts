// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WATER, DECIDED (three-free): what `water-view.ts` draws every lake,
// pond, reservoir and stream on the map with, worked out once a map.
//
//   * WHERE ITS SHORE IS — one small texture over the water's box: every
//     texel's distance to the nearest dry ground, m. The shader reads it
//     for the water's colour (shallow to deep), the shore ice reaching out
//     in the autumn and the moat opening in the spring. A body cut by the
//     map's edge draws no shore along the cut: ground past the edge is
//     never dry.
//   * WHAT IT MIRRORS — the hills round each lake, as a horizon: from the
//     lake's middle, on 64 bearings, how high the skyline stands, how far
//     off it is, and how wooded the near slopes and the skyline are. The
//     shader reflects the terrain under that line and the sky over it, so a
//     calm lake mirrors its mountain for a texture read rather than drawing
//     the world a second time.
//   * WHAT STATE IT IS IN on the map's day (`lake-ice.ts`), as the two
//     per-vertex vectors the shader takes it from: the ice from the shore
//     out to A m and beyond B m (forming: A the rim; thawing: B the moat;
//     frozen: everywhere; open: nowhere), the snow on it, the rot, and how
//     black (new) the ice is.

import {
  bodyState,
  streamState,
  type Level,
  type WaterBody,
  type WaterState,
  type WaterStream,
} from "@engine";

/** The shore texture's finest cell, m, and the most texels a side. */
export const SHORE_CELL = 2;
export const SHORE_MOST = 1024;
/** A texel's distance is stored at this many steps a metre (0..127.5 m). */
export const SHORE_SCALE = 2;
/** The horizon's bearings a lake, and how far it looks, m. */
export const HORIZON_BEARINGS = 64;
export const HORIZON_REACH = 2600;
/** Ice "everywhere" and "nowhere", as a reach from the shore, m. */
const ALL = 1e4;
const NONE = -1;

export type ShoreMap = {
  data: Uint8Array;
  cols: number;
  rows: number;
  originX: number;
  originZ: number;
  cell: number;
};

/** One body's state as the shader takes it. */
export type BodyLook = {
  state: WaterState;
  /** x: ice from the shore out to this many m; y: ice beyond this many m;
   * z: the snow on it, 0..1; w: the rot, 0..1. */
  ice: [number, number, number, number];
  /** x: the body's horizon row; y: how black (new and bare) the ice is;
   * z: the ice's thickness, m; w: how much a cold day steams off it. */
  more: [number, number, number, number];
};

/** A stream laid as a ribbon: its centreline's points on the snow. */
export type StreamLook = {
  state: WaterState;
  ice: BodyLook["ice"];
  more: BodyLook["more"];
  /** x, y, z a point down its line. */
  points: Float32Array;
  width: number;
};

export type WaterPlan = {
  bodies: { body: WaterBody; look: BodyLook }[];
  streams: StreamLook[];
  shore: ShoreMap;
  /** RGBA a bearing, a row a body: the skyline's elevation (R, of a right
   * angle), the near slopes' woods (G), the skyline's woods (B), its
   * distance (A, of `HORIZON_REACH`). */
  horizon: Uint8Array;
  /** Whether any of it shows on the map's day (all of it under snow: no). */
  shows: boolean;
};

/** The look a state is drawn with. */
export function lookOf(state: WaterState, row: number): BodyLook {
  let a = NONE;
  let b = ALL;
  if (state.phase === "frozen") a = ALL;
  else if (state.phase === "forming") a = state.rim;
  else if (state.phase === "thawing") b = state.moat;
  // New ice is black (the skim along a freezing shore always); snow and
  // a month's weather whiten it.
  const black =
    state.phase === "forming"
      ? 1
      : state.phase === "open"
        ? 0
        : Math.max(0, 1 - state.snow) * Math.max(0, 1 - state.age / 30);
  const steam = state.ice > 0 ? 0 : Math.max(0, Math.min(1, -state.air / 15));
  return {
    state,
    ice: [a, b, state.phase === "forming" ? 0 : state.snow, state.rot],
    more: [row, black, state.ice, steam],
  };
}

/** Does a look draw anything: open water, black or rotten ice, or the
 * wind's scoured patches all show; a whole snowed cover is the terrain's. */
export function showsAt(look: BodyLook): boolean {
  return look.state.phase !== "frozen" || look.state.snow < 0.999 || look.state.rot > 0;
}

/** The area inside a ring (positive counter-clockwise), m². */
export function ringArea(ring: Float32Array): number {
  let s = 0;
  const n = ring.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    s += ring[2 * j] * ring[2 * i + 1] - ring[2 * i] * ring[2 * j + 1];
  }
  return s / 2;
}

/** The middle of a ring: its centroid, or its first point if degenerate. */
export function ringMiddle(ring: Float32Array): { x: number; z: number } {
  let cx = 0;
  let cz = 0;
  let a = 0;
  const n = ring.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const cross = ring[2 * j] * ring[2 * i + 1] - ring[2 * i] * ring[2 * j + 1];
    cx += (ring[2 * j] + ring[2 * i]) * cross;
    cz += (ring[2 * j + 1] + ring[2 * i + 1]) * cross;
    a += cross;
  }
  if (Math.abs(a) < 1e-6) return { x: ring[0], z: ring[1] };
  return { x: cx / (3 * a), z: cz / (3 * a) };
}

/** Every body's shore at row-centre `z`: the x where a ring crosses it. */
function crossings(rings: readonly Float32Array[], z: number, out: number[]): void {
  out.length = 0;
  for (const ring of rings) {
    const n = ring.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const zi = ring[2 * i + 1];
      const zj = ring[2 * j + 1];
      if (zi > z === zj > z) continue;
      const xi = ring[2 * i];
      const xj = ring[2 * j];
      out.push(xi + ((z - zi) / (zj - zi)) * (xj - xi));
    }
  }
  out.sort((p, q) => p - q);
}

/** THE SHORE MAP: every texel's distance to dry ground, m, over the box
 * round every body (a chamfer distance, two passes). */
export function shoreMap(level: Level, bodies: readonly WaterBody[]): ShoreMap {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const b of bodies) {
    for (const r of b.rings) {
      for (let i = 0; i < r.length; i += 2) {
        x0 = Math.min(x0, r[i]);
        x1 = Math.max(x1, r[i]);
        z0 = Math.min(z0, r[i + 1]);
        z1 = Math.max(z1, r[i + 1]);
      }
    }
  }
  if (!Number.isFinite(x0)) {
    return { data: new Uint8Array(1), cols: 1, rows: 1, originX: 0, originZ: 0, cell: 1 };
  }
  const span = Math.max(x1 - x0, z1 - z0);
  const cell = Math.max(SHORE_CELL, span / (SHORE_MOST - 4));
  const pad = 2 * cell;
  const originX = x0 - pad;
  const originZ = z0 - pad;
  const cols = Math.min(SHORE_MOST, Math.ceil((x1 - x0 + 2 * pad) / cell) + 1);
  const rows = Math.min(SHORE_MOST, Math.ceil((z1 - z0 + 2 * pad) / cell) + 1);
  const far = 1e9;
  const dist = new Float32Array(cols * rows).fill(far);
  const xs: number[] = [];
  const size = level.size;
  for (let r = 0; r < rows; r++) {
    const z = originZ + r * cell;
    // A body cut by the map's edge: past the edge is never dry ground.
    const offMap = z < 0 || z > size;
    const wet = new Uint8Array(cols);
    for (const b of bodies) {
      crossings(b.rings, z, xs);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k] - originX) / cell));
        const c1 = Math.min(cols - 1, Math.floor((xs[k + 1] - originX) / cell));
        for (let c = c0; c <= c1; c++) wet[c] = 1;
      }
    }
    for (let c = 0; c < cols; c++) {
      const x = originX + c * cell;
      if (!wet[c] && !offMap && x >= 0 && x <= size) dist[r * cols + c] = 0;
    }
  }
  const d1 = cell;
  const d2 = cell * Math.SQRT2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = r * cols + c;
      let v = dist[k];
      if (c > 0) v = Math.min(v, dist[k - 1] + d1);
      if (r > 0) {
        v = Math.min(v, dist[k - cols] + d1);
        if (c > 0) v = Math.min(v, dist[k - cols - 1] + d2);
        if (c < cols - 1) v = Math.min(v, dist[k - cols + 1] + d2);
      }
      dist[k] = v;
    }
  }
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const k = r * cols + c;
      let v = dist[k];
      if (c < cols - 1) v = Math.min(v, dist[k + 1] + d1);
      if (r < rows - 1) {
        v = Math.min(v, dist[k + cols] + d1);
        if (c < cols - 1) v = Math.min(v, dist[k + cols + 1] + d2);
        if (c > 0) v = Math.min(v, dist[k + cols - 1] + d2);
      }
      dist[k] = v;
    }
  }
  const data = new Uint8Array(cols * rows);
  for (let k = 0; k < data.length; k++) data[k] = Math.min(255, Math.round(dist[k] * SHORE_SCALE));
  return { data, cols, rows, originX, originZ, cell };
}

/** How wooded the map is, a coarse grid: trees a cell over what fills it. */
function woodsGrid(level: Level, cell: number): (x: number, z: number) => number {
  const n = Math.max(1, Math.ceil(level.size / cell));
  const count = new Float32Array(n * n);
  for (const t of level.trees) {
    const c = Math.floor(t.x / cell);
    const r = Math.floor(t.z / cell);
    if (c >= 0 && r >= 0 && c < n && r < n) count[r * n + c]++;
  }
  const full = (cell * cell) / 90;
  return (x, z) => {
    const c = Math.floor(x / cell);
    const r = Math.floor(z / cell);
    if (c < 0 || r < 0 || c >= n || r >= n) return 0;
    return Math.min(1, count[r * n + c] / full);
  };
}

/** THE HORIZON a lake mirrors, a row of `HORIZON_BEARINGS` texels. */
export function horizonRow(
  level: Level,
  x: number,
  z: number,
  y: number,
  woods: (x: number, z: number) => number,
  out: Uint8Array,
  at: number,
): void {
  for (let i = 0; i < HORIZON_BEARINGS; i++) {
    const a = (i / HORIZON_BEARINGS) * Math.PI * 2;
    const dx = Math.sin(a);
    const dz = Math.cos(a);
    let best = 0;
    let bestR = HORIZON_REACH;
    let near = 0;
    let nearN = 0;
    let ridge = 0;
    for (let r = 30; r < HORIZON_REACH; r += 10 + r * 0.04) {
      const px = x + dx * r;
      const pz = z + dz * r;
      if (px < 0 || pz < 0 || px > level.size || pz > level.size) break;
      const h = level.groundAt(px, pz) - y;
      const w = woods(px, pz);
      if (r < 500) {
        near += w;
        nearN++;
      }
      const e = Math.atan2(h, r);
      if (e > best) {
        best = e;
        bestR = r;
        ridge = w;
      }
    }
    const k = (at * HORIZON_BEARINGS + i) * 4;
    out[k] = Math.round(Math.min(1, best / (Math.PI / 2)) * 255);
    out[k + 1] = Math.round((nearN ? near / nearN : 0) * 255);
    out[k + 2] = Math.round(ridge * 255);
    out[k + 3] = Math.round(Math.min(1, bestR / HORIZON_REACH) * 255);
  }
}

/** THE PLAN of a map's water on its day; null where it has none. */
export function planWater(level: Level): WaterPlan | null {
  const water = level.water ?? [];
  const lines = level.streams ?? [];
  if (water.length === 0 && lines.length === 0) return null;
  const woods = woodsGrid(level, 40);
  const horizon = new Uint8Array(Math.max(1, water.length) * HORIZON_BEARINGS * 4);
  const bodies = water.map((body, row) => {
    const mid = ringMiddle(body.rings[0]);
    horizonRow(level, mid.x, mid.z, body.y, woods, horizon, row);
    return { body, look: lookOf(bodyState(level, body), row) };
  });
  const streams = lines.map((s) => streamLook(level, s));
  return {
    bodies,
    streams,
    shore: shoreMap(level, water),
    horizon,
    shows: bodies.some((b) => showsAt(b.look)) || streams.some((s) => showsAt(s)),
  };
}

function streamLook(level: Level, s: WaterStream): StreamLook {
  const n = s.line.length / 2;
  const points = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = s.line[2 * i];
    const z = s.line[2 * i + 1];
    points[3 * i] = x;
    points[3 * i + 1] = level.groundAt(x, z);
    points[3 * i + 2] = z;
  }
  const look = lookOf(streamState(level, s, points[1]), 0);
  return { ...look, points, width: s.width };
}

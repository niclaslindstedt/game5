// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROOM ON THE FLOOR FOR AN AIRSTRIP — how far each spot of the map is
// from the nearest thing a strip may not be laid over or beside, as one
// distance field, baked once a map, that the strip's search (`airstrip.ts`)
// and its site's buildings (`airstrip-site.ts`) read with one lookup.
//
// What a strip keeps off, each drawn with the gap kept from it:
//   * every BUILDING by its own footprint — a log hut, a town's flats, a
//     real face's long hall — and the village's streets, lots and gardens;
//   * every RUN, lane and ski route by its own width (a strip across a
//     piste is a plane taking off through skiers), and the HUB the runs end
//     in on the valley floor;
//   * every lift's line and its stations, the wind tunnels;
//   * the helipad, the snowmobile's spot and the balloon's site;
//   * every lake, pond and river and every stream (a real face's water,
//     never known to be frozen hard enough).
// The trees are not in it: a strip may be cleared through a wood, and the
// search counts what it would fell (`airstrip.ts`). The field is the exact Euclidean distance (Felzenszwalb and Huttenlocher's
// transform) over a grid of `CELL` m, read at the cell a point lies in, less
// the cell's half-diagonal so a read never says there is more room than
// there is.
//
// A pure function of the map, worked out once and kept per map; nothing
// here draws from the stream, and nothing else is moved by it.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { inWater } from "../mapgen/real-water.ts";
import type { Level } from "../mapgen/types.ts";
import { balloonSiteOf } from "./balloon-site.ts";
import { cabinsOf } from "./cabins.ts";
import { BALLOON } from "./defs/balloon.ts";
import { CABINS } from "./defs/cabins.ts";
import { HELI } from "./defs/heli.ts";
import { RESORT_BUILDINGS } from "./defs/resort-buildings.ts";
import { helipadOf } from "./heli-pad.ts";
import { liftPlans } from "./lift-line.ts";
import { sledSpotOf } from "./sled-pad.ts";
import { streetMaskAt, villageBox, villageOf } from "./village.ts";

/** THE GAPS a strip keeps, m, beyond each thing's own size: a building, a
 * lift's line and its stations, a tunnel's lane, a run's edge, a street's,
 * the water's shore; and the grid the field is baked on, m. */
export const STRIP_ROOM = {
  house: 22,
  line: 18,
  station: 40,
  tunnel: 16,
  run: 12,
  street: 8,
  water: 8,
  cell: 4,
} as const;

const CELL = STRIP_ROOM.cell;
/** What a read takes off for the cell a point lies in, m. */
const SLACK = CELL * Math.SQRT1_2;

type Room = { n: number; dist: Float32Array };
const rooms = new WeakMap<Level, Room>();

/** How far (x, z) is from the nearest thing a strip keeps off, m (0 on
 * one; a negative read is clamped). */
export function stripRoomAt(level: Level, x: number, z: number): number {
  const r = roomOf(level);
  const i = Math.floor(x / CELL);
  const j = Math.floor(z / CELL);
  if (i < 0 || j < 0 || i >= r.n || j >= r.n) return 0;
  return Math.max(0, r.dist[j * r.n + i] - SLACK);
}

/** The field of `level`, baked on first ask. */
function roomOf(level: Level): Room {
  let r = rooms.get(level);
  if (!r) {
    r = bake(level);
    rooms.set(level, r);
  }
  return r;
}

function bake(level: Level): Room {
  const n = Math.ceil(level.size / CELL);
  const solid = new Uint8Array(n * n);
  /** Mark every cell whose middle lies within `r` m of the segment a→b. */
  const capsule = (ax: number, az: number, bx: number, bz: number, r: number): void => {
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - r) / CELL));
    const i1 = Math.min(n - 1, Math.floor((Math.max(ax, bx) + r) / CELL));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - r) / CELL));
    const j1 = Math.min(n - 1, Math.floor((Math.max(az, bz) + r) / CELL));
    const ex = bx - ax;
    const ez = bz - az;
    const ee = ex * ex + ez * ez;
    for (let j = j0; j <= j1; j++) {
      const pz = (j + 0.5) * CELL;
      for (let i = i0; i <= i1; i++) {
        const px = (i + 0.5) * CELL;
        const h = ee > 1e-9 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / ee)) : 0;
        const dx = px - ax - ex * h;
        const dz = pz - az - ez * h;
        if (dx * dx + dz * dz <= r * r) solid[j * n + i] = 1;
      }
    }
  };
  const disc = (x: number, z: number, r: number): void => capsule(x, z, x, z, r);
  const point = (x: number, z: number): void => {
    const i = Math.floor(x / CELL);
    const j = Math.floor(z / CELL);
    if (i >= 0 && j >= 0 && i < n && j < n) solid[j * n + i] = 1;
  };
  const G = STRIP_ROOM;

  // The machines' places.
  if (level.resort) {
    const pad = helipadOf(level);
    const sled = sledSpotOf(level);
    const balloon = balloonSiteOf(level);
    disc(pad.x, pad.z, HELI.pad.radius + 20);
    disc(sled.x, sled.z, 20);
    disc(balloon.x, balloon.z, BALLOON.site.room + 20);
  }
  // Every building by its footprint, and the village's ground.
  for (const c of cabinsOf(level)) {
    const def = (CABINS as Record<string, { width: number; depth: number }>)[c.kind] ??
      (RESORT_BUILDINGS as Record<string, { width: number; depth: number }>)[c.kind] ?? {
        width: 10,
        depth: 10,
      };
    disc(c.x, c.z, hypot(def.width, def.depth) / 2 + G.house);
  }
  // Every street by its section (a real face's town streets reach past
  // the village's own ground), and the square and the car park.
  const village = villageOf(level);
  for (const st of village?.streets ?? []) {
    const side = Math.max(...st.section.sides.map((d) => d.park + d.bank + d.walk));
    const r = st.section.lane + side + G.street;
    for (let k = 1; k < st.points.length; k++) {
      const a = st.points[k - 1];
      const b = st.points[k];
      capsule(a.x, a.z, b.x, b.z, r);
    }
  }
  for (const a of village?.areas ?? []) disc(a.x, a.z, hypot(a.half, a.depth) + G.street);
  const box = villageBox(level);
  if (box) {
    for (let z = box.z0 + 0.5; z < box.z1; z += 1) {
      for (let x = box.x0 + 0.5; x < box.x1; x += 1) {
        if (streetMaskAt(level, x, z) !== 0) point(x, z);
      }
    }
  }
  // Every lift's line and stations, every tunnel's lane.
  for (const p of liftPlans(level)) {
    const b = p.lift.bottom;
    const t = p.lift.top;
    capsule(b.x, b.z, t.x, t.z, G.line);
    disc(b.x, b.z, G.station);
    disc(t.x, t.z, G.station);
  }
  for (const t of level.resort?.tunnels ?? []) {
    for (let k = 1; k < t.points.length; k++) {
      const a = t.points[k - 1];
      const b = t.points[k];
      capsule(a.x, a.z, b.x, b.z, t.width / 2 + G.tunnel);
    }
  }
  // Every run, lane and route by its own width, and the hub.
  const lines: { points: { x: number; z: number; width?: number }[]; width?: number }[] = [
    ...(level.resort?.runs ?? []),
    ...(level.resort?.routes ?? []),
    level.track,
  ];
  for (const r of lines) {
    for (let k = 1; k < r.points.length; k++) {
      const a = r.points[k - 1];
      const b = r.points[k];
      const w = Math.max(a.width ?? r.width ?? 20, b.width ?? r.width ?? 20);
      capsule(a.x, a.z, b.x, b.z, w / 2 + G.run);
    }
  }
  const hub = level.resort?.hub;
  if (hub) {
    for (let k = 0; k < hub.top.length; k++) {
      const x = hub.x0 + k * hub.step;
      capsule(x, hub.top[k], x, hub.bottom[k], hub.step);
    }
  }
  // The water: every body's cells (its middle in it), its shore grown by
  // the gap below; every stream by its width.
  const water = level.water ?? [];
  if (water.length > 0) {
    const wet = new Uint8Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        if (inWater(water, (i + 0.5) * CELL, (j + 0.5) * CELL)) wet[j * n + i] = 1;
      }
    }
    const grow = Math.ceil(G.water / CELL);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        if (wet[j * n + i]) disc((i + 0.5) * CELL, (j + 0.5) * CELL, grow * CELL);
      }
    }
  }
  for (const s of level.streams ?? []) {
    for (let k = 2; k + 1 < s.line.length; k += 2) {
      capsule(s.line[k - 2], s.line[k - 1], s.line[k], s.line[k + 1], s.width / 2 + G.water);
    }
  }
  return { n, dist: distanceOf(solid, n) };
}

/** The exact distance, m, from every cell's middle to the nearest solid
 * cell's: the squared transform down the columns, then along the rows. */
function distanceOf(solid: Uint8Array, n: number): Float32Array {
  const INF = 1e20;
  const d2 = new Float64Array(n * n);
  for (let k = 0; k < n * n; k++) d2[k] = solid[k] ? 0 : INF;
  const f = new Float64Array(n);
  const out = new Float64Array(n);
  const v = new Int32Array(n);
  const zz = new Float64Array(n + 1);
  const pass = (get: (k: number) => number, set: (k: number, x: number) => void): void => {
    for (let k = 0; k < n; k++) f[k] = get(k);
    let k = 0;
    v[0] = 0;
    zz[0] = -INF;
    zz[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= zz[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      zz[k] = s;
      zz[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (zz[k + 1] < q) k++;
      out[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
    for (let q = 0; q < n; q++) set(q, out[q]);
  };
  for (let i = 0; i < n; i++) {
    pass(
      (k) => d2[k * n + i],
      (k, x) => (d2[k * n + i] = x),
    );
  }
  for (let j = 0; j < n; j++) {
    pass(
      (k) => d2[j * n + k],
      (k, x) => (d2[j * n + k] = x),
    );
  }
  const dist = new Float32Array(n * n);
  for (let k = 0; k < n * n; k++) dist[k] = d2[k] >= INF / 2 ? 1e6 : Math.sqrt(d2[k]) * CELL;
  return dist;
}

#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL FACES — twenty real mountainsides baked into the generator.
//
// A free ride can be raised on a REAL face instead of the massif R25 deals:
// one 4×4 km stretch of a real ski mountain, from its summit ridge down to
// the valley floor, turned so its fall line runs down the map. This script
// is the offline half: it reads the heights off the global 30 m elevation
// model (one 1°×1° GeoTIFF tile a face, kept in `previews/.dem/` once
// fetched), crops each face to the map's square, smooths the forest canopy
// and the buildings the surface model carries out of it, and writes the
// grids into `engine/mapgen/real-faces-data.ts` — a GENERATED file, a few
// kilobytes a face, which `real-face.ts` decodes at run time.
//
// The faces are NAMED BY NOTHING BUT THEIR REGION AND A NUMBER: the rule
// book of this repository names no real place, so a face is a position on
// the globe and a crop, never the name of the resort it was taken from.
//
// Where each crop sits was searched once (every bearing, offset and scale
// round a face's middle, scored on how much of the playable face falls
// down the map and how far the ridge row stands over the valley floor) and
// the winners are written below; every run prints the table.
//
//   make real-faces ARGS=--fetch      # fetch the tiles (once), then bake
//   make real-faces                   # bake from the kept tiles, print the table
//   make real-faces ARGS=--write      # …and write real-faces-data.ts
//
// The elevation data: Copernicus DEM GLO-30, © DLR e.V. 2010–2014 and ©
// Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the
// European Union and ESA; free to use and redistribute with this notice
// (`docs/real-faces.md`).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(root, "previews", ".dem");
const OUT = join(root, "engine", "mapgen", "real-faces-data.ts");
const BUCKET = "https://copernicus-dem-30m.s3.amazonaws.com";

/** The map's side, m, and the grid a face is kept on: 126 samples 32 m
 * apart, as fine as the 30 m model honestly is. */
const SIZE = 4000;
const CELL = 32;
const N = Math.round(SIZE / CELL) + 1;
/** How finely a height is kept, m. */
const STEP = 0.5;
/** The smoothing, in cells (a Gaussian's sigma): the canopy and the
 * village's roofs out, the spurs and gullies kept. */
const SMOOTH = 1.2;

/** Every face: its region (R21), the middle it was searched round (°),
 * and the crop the search kept — the window's middle east and north of it
 * (m), the bearing its fall line runs down the map on (° clockwise from
 * north) and how many real metres a metre of the map is. */
const FACES = [
  {
    id: "alpine-1",
    region: "alpine",
    lat: 45.297,
    lon: 6.585,
    east: -1200,
    north: -1800,
    bearing: -4,
    scale: 1.0,
  },
  {
    id: "alpine-2",
    region: "alpine",
    lat: 45.4,
    lon: 6.618,
    east: 450,
    north: -300,
    bearing: 42,
    scale: 0.9,
  },
  {
    id: "alpine-3",
    region: "alpine",
    lat: 45.452,
    lon: 6.9,
    east: -450,
    north: -1500,
    bearing: 28,
    scale: 0.9,
  },
  {
    id: "alpine-4",
    region: "alpine",
    lat: 45.442,
    lon: 6.965,
    east: -1800,
    north: 1800,
    bearing: 68,
    scale: 0.9,
  },
  {
    id: "alpine-5",
    region: "alpine",
    lat: 45.5,
    lon: 6.68,
    east: -1500,
    north: 1050,
    bearing: 6,
    scale: 1.1,
  },
  {
    id: "alpine-6",
    region: "alpine",
    lat: 45.105,
    lon: 6.085,
    east: 450,
    north: -1050,
    bearing: 226,
    scale: 0.9,
  },
  {
    id: "alpine-7",
    region: "alpine",
    lat: 46.015,
    lon: 7.77,
    east: 750,
    north: 1800,
    bearing: 288,
    scale: 0.9,
  },
  {
    id: "alpine-8",
    region: "alpine",
    lat: 46.093,
    lon: 7.245,
    east: 0,
    north: -1800,
    bearing: 226,
    scale: 0.9,
  },
  {
    id: "alpine-9",
    region: "alpine",
    lat: 47.14,
    lon: 10.24,
    east: 750,
    north: 0,
    bearing: 148,
    scale: 1.0,
  },
  {
    id: "alpine-10",
    region: "alpine",
    lat: 46.995,
    lon: 10.305,
    east: 1500,
    north: 1800,
    bearing: 270,
    scale: 1.1,
  },
  {
    id: "alpine-11",
    region: "alpine",
    lat: 46.958,
    lon: 10.985,
    east: 0,
    north: -300,
    bearing: 52,
    scale: 0.9,
  },
  {
    id: "continental-1",
    region: "continental",
    lat: 39.62,
    lon: -106.365,
    east: -300,
    north: 750,
    bearing: -6,
    scale: 0.9,
  },
  {
    id: "continental-2",
    region: "continental",
    lat: 39.475,
    lon: -106.075,
    east: -1050,
    north: 1500,
    bearing: 70,
    scale: 1.12,
  },
  {
    id: "continental-3",
    region: "continental",
    lat: 40.64,
    lon: -111.53,
    east: 450,
    north: 1050,
    bearing: 28,
    scale: 1.0,
  },
  {
    id: "continental-4",
    region: "continental",
    lat: 39.17,
    lon: -106.82,
    east: 1050,
    north: -750,
    bearing: 32,
    scale: 0.9,
  },
  {
    id: "maritime-1",
    region: "maritime",
    lat: 50.085,
    lon: -122.95,
    east: -1800,
    north: 450,
    bearing: 316,
    scale: 1.0,
  },
  {
    id: "maritime-2",
    region: "maritime",
    lat: 42.865,
    lon: 140.68,
    east: 0,
    north: -1500,
    bearing: 148,
    scale: 0.9,
  },
  {
    id: "maritime-3",
    region: "maritime",
    lat: 36.7,
    lon: 137.815,
    east: 1800,
    north: -300,
    bearing: 94,
    scale: 1.0,
  },
  {
    id: "fell-1",
    region: "fell",
    lat: 63.418,
    lon: 13.085,
    east: -450,
    north: -750,
    bearing: 192,
    scale: 0.9,
  },
  {
    id: "fell-2",
    region: "fell",
    lat: 60.86,
    lon: 8.45,
    east: 1500,
    north: 300,
    bearing: 60,
    scale: 0.9,
  },
];

const args = parseArgs(
  process.argv.slice(2),
  {
    fetch: { kind: "flag", help: "download the elevation tiles not yet kept in previews/.dem/" },
    write: { kind: "flag", help: "write engine/mapgen/real-faces-data.ts" },
    only: {
      kind: "string",
      help: "comma-separated face ids to bake (the table only; --write needs all)",
    },
  },
  "usage: npm run real-faces -- [--fetch] [--write] [--only id,id]",
);

// ── The tiles ───────────────────────────────────────────────────────────

/** The tile a point falls in, by its south-west corner's name. */
function tileName(lat, lon) {
  const la = Math.floor(lat);
  const lo = Math.floor(lon);
  const ns = la >= 0 ? `N${String(la).padStart(2, "0")}` : `S${String(-la).padStart(2, "0")}`;
  const ew = lo >= 0 ? `E${String(lo).padStart(3, "0")}` : `W${String(-lo).padStart(3, "0")}`;
  return { name: `${ns}_00_${ew}_00`, la, lo };
}

async function fetchTile(name) {
  const file = join(CACHE, `${name}.tif`);
  if (existsSync(file)) return;
  const key = `Copernicus_DSM_COG_10_${name}_DEM`;
  const url = `${BUCKET}/${key}/${key}.tif`;
  process.stdout.write(`fetching ${name}… `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log("kept");
}

/** A tiled, deflated, float32 GeoTIFF with the floating-point predictor —
 * the shape every tile of the model comes in — read a tile at a time. */
function openTiff(file) {
  const buf = readFileSync(file);
  const le = buf.toString("latin1", 0, 2) === "II";
  if (!le) throw new Error(`${file}: big-endian TIFF`);
  const u16 = (o) => buf.readUInt16LE(o);
  const u32 = (o) => buf.readUInt32LE(o);
  const ifd = u32(4);
  const count = u16(ifd);
  const tags = new Map();
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    const tag = u16(e);
    const type = u16(e + 2);
    const n = u32(e + 4);
    const size = type === 3 ? 2 : type === 16 ? 8 : 4;
    const at = n * size <= 4 ? e + 8 : u32(e + 8);
    const values = [];
    for (let k = 0; k < n; k++) {
      const o = at + k * size;
      values.push(size === 2 ? u16(o) : size === 8 ? Number(buf.readBigUInt64LE(o)) : u32(o));
    }
    tags.set(tag, values);
  }
  const width = tags.get(256)[0];
  const height = tags.get(257)[0];
  const tw = tags.get(322)[0];
  const th = tags.get(323)[0];
  const offsets = tags.get(324);
  const counts = tags.get(325);
  if (tags.get(259)[0] !== 8 || tags.get(317)?.[0] !== 3) {
    throw new Error(`${file}: not a deflated tile with the floating-point predictor`);
  }
  const across = Math.ceil(width / tw);
  const kept = new Map();
  const tile = (i) => {
    let t = kept.get(i);
    if (t) return t;
    const raw = inflateSync(buf.subarray(offsets[i], offsets[i] + counts[i]));
    t = new Float32Array(tw * th);
    const row = new Uint8Array(tw * 4);
    const view = new DataView(row.buffer);
    for (let r = 0; r < th; r++) {
      const src = raw.subarray(r * tw * 4, (r + 1) * tw * 4);
      // Undo the byte differencing, then gather each sample's bytes back out
      // of their four planes (most significant first).
      let acc = 0;
      const undiff = new Uint8Array(tw * 4);
      for (let k = 0; k < tw * 4; k++) undiff[k] = acc = (acc + src[k]) & 0xff;
      for (let c = 0; c < tw; c++) {
        row[c * 4] = undiff[c];
        row[c * 4 + 1] = undiff[tw + c];
        row[c * 4 + 2] = undiff[2 * tw + c];
        row[c * 4 + 3] = undiff[3 * tw + c];
        t[r * tw + c] = view.getFloat32(c * 4, false);
      }
    }
    kept.set(i, t);
    return t;
  };
  const at = (r, c) => {
    const rr = Math.min(height - 1, Math.max(0, r));
    const cc = Math.min(width - 1, Math.max(0, c));
    return tile(Math.floor(rr / th) * across + Math.floor(cc / tw))[(rr % th) * tw + (cc % tw)];
  };
  return { width, height, at };
}

const tiffs = new Map();
function tiffOf(name) {
  let t = tiffs.get(name);
  if (!t) {
    const file = join(CACHE, `${name}.tif`);
    if (!existsSync(file)) throw new Error(`${file} missing: run with --fetch`);
    t = openTiff(file);
    tiffs.set(name, t);
  }
  return t;
}

/** The model's height at a point, bilinear between its samples. */
function heightAt(lat, lon) {
  const { name, la, lo } = tileName(lat, lon);
  const t = tiffOf(name);
  const r = (la + 1 - lat) * t.height - 0.5;
  const c = (lon - lo) * t.width - 0.5;
  const r0 = Math.floor(r);
  const c0 = Math.floor(c);
  const fr = r - r0;
  const fc = c - c0;
  const a = t.at(r0, c0) * (1 - fc) + t.at(r0, c0 + 1) * fc;
  const b = t.at(r0 + 1, c0) * (1 - fc) + t.at(r0 + 1, c0 + 1) * fc;
  return a * (1 - fr) + b * fr;
}

// ── A face cropped ──────────────────────────────────────────────────────

/** Where the map point (`x`, `z`) of a face is on the globe, (lat, lon). */
function globeAt(face, x, z) {
  const th = (face.bearing * Math.PI) / 180;
  const dx = (x - SIZE / 2) * face.scale;
  const dz = (z - SIZE / 2) * face.scale;
  // +z down the fall line (the bearing), +x to its right.
  const e = face.east + dx * Math.cos(th) + dz * Math.sin(th);
  const n = face.north - dx * Math.sin(th) + dz * Math.cos(th);
  const kx = 111320 * Math.cos((face.lat * Math.PI) / 180);
  return [face.lat + n / 111320, face.lon + e / kx];
}

/** Every tile a face's crop reaches into. */
function tilesOf(face) {
  const names = [];
  for (const x of [0, SIZE / 2, SIZE]) {
    for (const z of [0, SIZE / 2, SIZE]) names.push(tileName(...globeAt(face, x, z)).name);
  }
  return names;
}

/** The face's grid, row 0 the map's top edge (z = 0), real metres. */
function crop(face) {
  const g = new Float64Array(N * N);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) g[r * N + c] = heightAt(...globeAt(face, c * CELL, r * CELL));
  }
  return smooth(g, SMOOTH);
}

/** A separable Gaussian over the grid, the edges held. */
function smooth(g, sigma) {
  const k = Math.ceil(sigma * 3);
  const w = [];
  let sum = 0;
  for (let i = -k; i <= k; i++) sum += w[i + k] = Math.exp(-0.5 * (i / sigma) ** 2);
  for (let i = 0; i < w.length; i++) w[i] /= sum;
  const pass = (src, dr, dc) => {
    const out = new Float64Array(N * N);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        let v = 0;
        for (let i = -k; i <= k; i++) {
          const rr = Math.min(N - 1, Math.max(0, r + i * dr));
          const cc = Math.min(N - 1, Math.max(0, c + i * dc));
          v += src[rr * N + cc] * w[i + k];
        }
        out[r * N + c] = v;
      }
    }
    return out;
  };
  return pass(pass(g, 0, 1), 1, 0);
}

/** The grid as `real-face.ts` reads it: the lowest height (m), then every
 * height in STEPs over it, second-differenced against its left, upper and
 * upper-left neighbours, zig-zagged and written as base-128 varints, and
 * the bytes as base64. */
function encode(g) {
  let floor = Infinity;
  for (const v of g) floor = Math.min(floor, v);
  floor = Math.floor(floor);
  const q = Int32Array.from(g, (v) => Math.round((v - floor) / STEP));
  const bytes = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const at = (rr, cc) => (rr < 0 || cc < 0 ? 0 : q[rr * N + cc]);
      const d = at(r, c) - at(r, c - 1) - at(r - 1, c) + at(r - 1, c - 1);
      let z = d >= 0 ? d * 2 : -d * 2 - 1;
      while (z >= 0x80) {
        bytes.push((z & 0x7f) | 0x80);
        z >>>= 7;
      }
      bytes.push(z);
    }
  }
  return { floor, data: Buffer.from(bytes).toString("base64"), quantised: q };
}

/** What the crop holds as a skier sees it: the ridge row over the valley
 * floor, and how much of the playable face falls down the map. */
function measure(q) {
  const h = (r, c) => q[r * N + c] * STEP;
  const mid = (z0, z1) => {
    let s = 0;
    let n = 0;
    for (let r = Math.round(z0 / CELL); r <= Math.round(z1 / CELL); r++) {
      for (let c = Math.round(700 / CELL); c <= Math.round(3300 / CELL); c++) {
        s += h(r, c);
        n++;
      }
    }
    return s / n;
  };
  const drop = mid(250, 420) - mid(3450, SIZE);
  let falls = 0;
  let all = 0;
  for (let r = Math.round(400 / CELL); r < Math.round(3500 / CELL) - 4; r++) {
    for (let c = Math.round(700 / CELL); c <= Math.round(3300 / CELL); c++) {
      all++;
      if (h(r + 4, c) < h(r, c)) falls++;
    }
  }
  return { drop, falls: falls / all };
}

// ── Run ─────────────────────────────────────────────────────────────────

const only = args.only ? new Set(args.only.split(",")) : null;
const faces = FACES.filter((f) => !only || only.has(f.id));
if (args.fetch) {
  for (const name of new Set(faces.flatMap(tilesOf))) await fetchTile(name);
}
const baked = [];
console.log("face            region        drop m  falls  bytes");
for (const face of faces) {
  const { floor, data, quantised } = encode(crop(face));
  const m = measure(quantised);
  baked.push({ id: face.id, region: face.region, floor, data });
  console.log(
    `${face.id.padEnd(16)}${face.region.padEnd(14)}${m.drop.toFixed(0).padStart(6)}  ${m.falls.toFixed(2)}  ${String(Math.round((data.length * 3) / 4)).padStart(6)}`,
  );
}
const total = baked.reduce((s, b) => s + b.data.length, 0);
console.log(`${baked.length} faces, ${(total / 1024).toFixed(0)} KB of base64`);

if (args.write) {
  if (only) throw new Error("--write bakes every face: drop --only");
  const lines = [
    "// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0",
    "// GENERATED by `make real-faces ARGS=--write` (scripts/real-faces.mjs) —",
    "// never edit by hand. The heights are off the Copernicus DEM GLO-30, ©",
    "// DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018,",
    "// provided under COPERNICUS by the European Union and ESA",
    "// (docs/real-faces.md); `real-face.ts` reads them.",
    "",
    'import type { RegionId } from "./regions.ts";',
    "",
    "/** One face as baked: its region, the lowest height (m) and the grid. */",
    "export type FaceData = {",
    "  readonly id: string;",
    "  readonly region: RegionId;",
    "  readonly floor: number;",
    "  readonly data: string;",
    "};",
    "",
    `/** The grid's samples a side and their spacing, m, and a height's step, m. */`,
    `export const FACE_GRID = { n: ${N}, cell: ${CELL}, step: ${STEP} } as const;`,
    "",
    "export const FACE_DATA: readonly FaceData[] = [",
    // One field a line, as the formatter would lay it, so `make fmt`
    // leaves the generated file alone.
    ...baked.flatMap((b) => [
      "  {",
      `    id: "${b.id}",`,
      `    region: "${b.region}",`,
      `    floor: ${b.floor},`,
      `    data: "${b.data}",`,
      "  },",
    ]),
    "];",
    "",
  ];
  writeFileSync(OUT, lines.join("\n"));
  console.log(`wrote ${OUT}`);
}

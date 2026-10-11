#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL FACES — real mountainsides baked into the generator.
//
// A free ride can be raised on a REAL face instead of the massif R25 deals:
// one 4×4 km stretch of a real ski mountain, from its summit ridge down to
// the valley floor, turned so its fall line runs down the map. This script
// is the offline half: it reads the heights off the global 30 m elevation
// model (one 1°×1° GeoTIFF tile a face, kept in `previews/.dem/` once
// fetched), crops each face to the map's square, smooths the forest canopy
// and the buildings the surface model carries out of it, and writes the
// grids into `engine/mapgen/real-faces/face-<id>.ts` — a GENERATED file a
// face, a few kilobytes, listed in `real-faces-index.ts`, which
// `real-face.ts` loads and decodes at run time.
//
// A face's id is its region and a number, a key that never moves; the
// start card names it by PLACE off its crop row — its range, its area and
// the part of the area — and never by a brand, a lift or a piste.
//
// Where each crop sits was searched once (every bearing, offset and scale
// round a face's middle, scored on how much of the playable face falls
// down the map and how far the ridge row stands over the valley floor) and
// the winners are written below; every run prints the table.
//
//   make real-faces ARGS=--fetch      # fetch the tiles (once), then bake
//   make real-faces                   # bake from the kept tiles, print the table
//   make real-faces ARGS=--write      # …and write the faces baked and the index
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

import { FACES, SIZE, globeAt } from "./lib/real-face-crops.mjs";
import { FACE_DIR, FACE_INDEX, writeFaceFile, writeFaceIndex } from "./lib/real-face-files.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(root, "previews", ".dem");
const BUCKET = "https://copernicus-dem-30m.s3.amazonaws.com";

/** The grid a face is kept on: 126 samples 32 m
 * apart, as fine as the 30 m model honestly is. */
const CELL = 32;
const N = Math.round(SIZE / CELL) + 1;
/** How finely a height is kept, m. */
const STEP = 0.5;
/** The smoothing, in cells (a Gaussian's sigma): the canopy and the
 * village's roofs out, the spurs and gullies kept. */
const SMOOTH = 1.2;

const args = parseArgs(
  process.argv.slice(2),
  {
    fetch: { kind: "flag", help: "download the elevation tiles not yet kept in previews/.dem/" },
    write: {
      kind: "flag",
      help: "write the faces baked (engine/mapgen/real-faces/) and the index",
    },
    search: {
      kind: "flag",
      help: "search each --only face's crop (bearing, offset, scale) and print the best rows",
    },
    index: {
      kind: "flag",
      help: "write the index alone (each face's region and place off its crop row), baking nothing",
    },
    only: {
      kind: "string",
      help: "comma-separated face ids to bake (--write writes those and keeps the rest)",
    },
  },
  "usage: npm run real-faces -- [--fetch] [--write] [--index] [--search] [--only id,id]",
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

// ── The search ──────────────────────────────────────────────────────────

/** A crop's score, read coarsely (every 125 m, unsmoothed) the way
 * `measure` reads a baked one: the ridge row over the valley floor and the
 * share of the playable face falling down the map. */
function roughMeasure(face) {
  const step = 125;
  const n = SIZE / step + 1;
  const g = new Float64Array(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) g[r * n + c] = heightAt(...globeAt(face, c * step, r * step));
  }
  const h = (r, c) => g[r * n + c];
  const band = (z0, z1) => {
    let sum = 0;
    let k = 0;
    for (let r = Math.round(z0 / step); r <= Math.round(z1 / step); r++) {
      for (let c = Math.round(700 / step); c <= Math.round(3300 / step); c++) {
        sum += h(r, c);
        k++;
      }
    }
    return sum / k;
  };
  const drop = band(250, 420) - band(3450, SIZE);
  let falls = 0;
  let all = 0;
  for (let r = Math.round(400 / step); r < Math.round(3500 / step) - 1; r++) {
    for (let c = Math.round(700 / step); c <= Math.round(3300 / step); c++) {
      all++;
      if (h(r + 1, c) < h(r, c)) falls++;
    }
  }
  return { drop, falls: falls / all };
}

/** What a crop is worth: a face that falls down the map, standing tall. */
const worth = (m) => m.falls * m.falls * Math.min(m.drop, 1200);

/** Every bearing, offset and scale round a face's middle (the middle kept
 * well inside the window, so the ski area stays on the map), the best few
 * re-read on the baked grid; prints them best first as crop rows. */
function search(face) {
  const tried = [];
  for (let bearing = -180; bearing < 180; bearing += 10) {
    for (let east = -1350; east <= 1350; east += 450) {
      for (let north = -1350; north <= 1350; north += 450) {
        for (const scale of [0.9, 1.0, 1.1]) {
          const row = { ...face, east, north, bearing, scale };
          tried.push({ row, m: roughMeasure(row) });
        }
      }
    }
  }
  tried.sort((a, b) => worth(b.m) - worth(a.m));
  const best = tried
    .slice(0, 8)
    .map(({ row }) => ({ row, m: measure(encode(crop(row)).quantised) }));
  best.sort((a, b) => worth(b.m) - worth(a.m));
  console.log(`${face.id}: best of ${tried.length}`);
  for (const { row, m } of best.slice(0, 4)) {
    console.log(
      `  drop ${m.drop.toFixed(0).padStart(5)}  falls ${m.falls.toFixed(2)}   east: ${row.east}, north: ${row.north}, bearing: ${row.bearing}, scale: ${row.scale}`,
    );
  }
}

// ── Run ─────────────────────────────────────────────────────────────────

/** The index written: every face's row, its heights' file already baked. */
function writeIndex() {
  const missing = FACES.filter((f) => !existsSync(join(FACE_DIR, `face-${f.id}.ts`)));
  if (missing.length > 0) {
    throw new Error(`no heights baked for ${missing.map((f) => f.id).join(", ")}: bake them`);
  }
  writeFaceIndex(FACES, { n: N, cell: CELL, step: STEP });
  console.log(`wrote ${FACE_INDEX}`);
}

if (args.index) {
  writeIndex();
  process.exit(0);
}

const only = args.only ? new Set(args.only.split(",")) : null;
const faces = FACES.filter((f) => !only || only.has(f.id));
if (args.fetch) {
  // A search reaches every crop round the middle: the tiles within 5 km.
  const near = (f) =>
    [-0.05, 0, 0.05].flatMap((dl) =>
      [-0.09, 0, 0.09].map((dn) => tileName(f.lat + dl, f.lon + dn).name),
    );
  for (const name of new Set(
    faces.flatMap((f) => [...tilesOf(f), ...(args.search ? near(f) : [])]),
  )) {
    await fetchTile(name);
  }
}
if (args.search) {
  if (!only) throw new Error("--search needs --only");
  for (const face of faces) search(face);
  process.exit(0);
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
  // The faces baked are written; every other face's file is kept as it is,
  // so adding a face never moves one already shipped.
  for (const b of baked) console.log(`wrote ${writeFaceFile(b)}`);
  writeIndex();
}

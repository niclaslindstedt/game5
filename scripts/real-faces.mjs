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
// Where each crop sits was searched once (every bearing and offset round a
// face's middle, at a scale of 1 — a face is laid 1:1 — scored on how much of the playable face falls
// down the map, how far the ridge row stands over the valley floor and,
// where its real lifts were fetched, how many of them the window holds) and
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
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

import { createDem } from "./lib/dem-tiles.mjs";
import { FACES, SIZE, globeAt, mapAt } from "./lib/real-face-crops.mjs";
import { FACE_DIR, FACE_INDEX, writeFaceFile, writeFaceIndex } from "./lib/real-face-files.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(root, "previews", ".dem");
/** Where the search keeps each face's real lifts' ends (off the map data,
 * fetched with `--fetch --search`), and the API it reads them from. */
const LIFTS = join(root, "previews", ".osm");
const MAP_API = "https://api.openstreetmap.org/api/0.6/map";

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
      help: "search each --only face's crop (bearing, offset, scale) and print the best rows (with --fetch, weighing the real lifts round its middle)",
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

const { tileName, fetchTile, heightAt } = createDem({ cache: CACHE, arcsec: 1 });

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

/** What a crop is worth: a face that falls down the map, standing tall —
 * and, where the real lifts are known, holding them all, bottoms low. */
const worth = (m) =>
  m.falls *
  m.falls *
  Math.min(m.drop, 1200) *
  (m.lifts ? m.lifts.on ** 3 * (0.5 + 0.5 * m.lifts.low) : 1);

// ── The real lifts ──────────────────────────────────────────────────────

/** The file a face's lift ends are kept in, keyed by its middle. */
const liftsFile = (face) => join(LIFTS, `lifts-${face.id}-${face.lat},${face.lon}.json`);

/** The ends of every lift within about 2 km of a face's middle, off the
 * map data — a smaller box where the area is too busy for one call — kept
 * as [[lat, lon], [lat, lon]] a lift. No name is read. */
async function fetchLifts(face) {
  const file = liftsFile(face);
  if (existsSync(file)) return;
  for (const reach of [2200, 1500, 1000]) {
    const dl = reach / 111320;
    const dn = dl / Math.cos((face.lat * Math.PI) / 180);
    const box = [face.lon - dn, face.lat - dl, face.lon + dn, face.lat + dl].map((v) =>
      v.toFixed(5),
    );
    const res = await fetch(`${MAP_API}?bbox=${box.join(",")}`, {
      headers: { "User-Agent": "game5-real-faces (offline bake)" },
    });
    if (res.status === 400) continue;
    if (!res.ok) throw new Error(`lifts for ${face.id}: ${res.status}`);
    const xml = await res.text();
    const nodes = new Map();
    for (const m of xml.matchAll(/<node id="(\d+)"[^>]*lat="([-\d.]+)" lon="([-\d.]+)"/g))
      nodes.set(m[1], [Number(m[2]), Number(m[3])]);
    const ends = [];
    for (const [way] of xml.matchAll(/<way [\s\S]*?<\/way>/g)) {
      if (
        !/k="aerialway" v="(chair_lift|gondola|cable_car|mixed_lift|drag_lift|t-bar|j-bar|platter)"/.test(
          way,
        )
      )
        continue;
      const refs = [...way.matchAll(/<nd ref="(\d+)"/g)]
        .map((m) => nodes.get(m[1]))
        .filter(Boolean);
      if (refs.length >= 2) ends.push([refs[0], refs.at(-1)]);
    }
    mkdirSync(LIFTS, { recursive: true });
    writeFileSync(file, JSON.stringify(ends));
    console.log(`${face.id}: ${ends.length} lifts kept`);
    return;
  }
  throw new Error(`lifts for ${face.id}: the area is too busy for the map API`);
}

/** How a crop holds the real lifts: the share of their ends on the map
 * (150 m in from its edge) and the share of lifts whose bottom stands in
 * the map's lower half — the generator's lifts leave from the valley floor.
 * Null where none are kept. */
function liftsOn(face, ends) {
  if (!ends || ends.length === 0) return null;
  const inside = ([x, z]) => x > 150 && x < SIZE - 150 && z > 150 && z < SIZE - 150;
  let on = 0;
  let low = 0;
  for (const [a, b] of ends) {
    const [lo, hi] = heightAt(...a) < heightAt(...b) ? [a, b] : [b, a];
    const [pl, ph] = [mapAt(face, ...lo), mapAt(face, ...hi)];
    on += (inside(pl) ? 1 : 0) + (inside(ph) ? 1 : 0);
    if (pl[1] > SIZE / 2) low++;
  }
  return { on: on / (2 * ends.length), low: low / ends.length, n: ends.length };
}

/** Every bearing, offset and scale round a face's middle (the middle kept
 * well inside the window, so the ski area stays on the map), the best few
 * re-read on the baked grid; prints them best first as crop rows. */
function search(face) {
  const ends = existsSync(liftsFile(face))
    ? JSON.parse(readFileSync(liftsFile(face), "utf8"))
    : null;
  const tried = [];
  for (let bearing = -180; bearing < 180; bearing += 10) {
    for (let east = -1350; east <= 1350; east += 450) {
      for (let north = -1350; north <= 1350; north += 450) {
        for (const scale of [1]) {
          const row = { ...face, east, north, bearing, scale };
          tried.push({ row, m: { ...roughMeasure(row), lifts: liftsOn(row, ends) } });
        }
      }
    }
  }
  tried.sort((a, b) => worth(b.m) - worth(a.m));
  const best = tried.slice(0, 8).map(({ row, m: rough }) => ({
    row,
    m: { ...measure(encode(crop(row)).quantised), lifts: rough.lifts },
  }));
  best.sort((a, b) => worth(b.m) - worth(a.m));
  console.log(`${face.id}: best of ${tried.length}`);
  for (const { row, m } of best.slice(0, 4)) {
    console.log(
      `  drop ${m.drop.toFixed(0).padStart(5)}  falls ${m.falls.toFixed(2)}  ${m.lifts ? `lifts on ${m.lifts.on.toFixed(2)} low ${m.lifts.low.toFixed(2)}` : "no lifts kept"}   east: ${row.east}, north: ${row.north}, bearing: ${row.bearing}, scale: ${row.scale}`,
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
  if (args.fetch) for (const face of faces) await fetchLifts(face);
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

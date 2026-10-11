#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD MAP — the outline the free ride's WHERE steps are drawn over.
//
// The start card's first step is a world map that pans and zooms onto the
// range a real face lies in, with a marker on every ski area (`world-map.ts`,
// `menu-where.tsx`). This script is the offline half: it reads Natural
// Earth's 1:50 m land, its land borders between countries and its lakes
// (public domain, naturalearthdata.com — kept in `previews/.ne/` once
// fetched), SIMPLIFIES them — finely within a few hundred kilometres of a
// real face, coarsely everywhere else, the far-off islands and the small
// lakes dropped — and writes them into `pwa/src/game/world-map-data.ts`, a
// GENERATED module the card loads only when it is opened. Nothing of it is
// the engine's, and nothing in it is named: the outlines are lines alone.
//
//   make world-map ARGS=--fetch   # fetch the three layers (once), then bake
//   make world-map                # bake from the kept layers, print the sizes
//   make world-map ARGS=--write   # …and write the module
//
// Each ring is kept as an ENCODED POLYLINE (the common one: zig-zagged
// deltas in five-bit chunks, as printable characters) at a hundredth of a
// degree, so a coastline costs about three characters a point; a layer is
// its rings joined by spaces, a character the encoding never uses.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

import { FACES } from "./lib/real-face-crops.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(root, "previews", ".ne");
const OUT = join(root, "pwa", "src", "game", "world-map-data.ts");
const SOURCE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";
const LAYERS = {
  land: "ne_50m_land",
  borders: "ne_50m_admin_0_boundary_lines_land",
  lakes: "ne_50m_lakes",
};

/** How finely a point is kept, °. */
const PRECISION = 100;
/** Within this of a real face (km) the outline is kept FINE, and within
 * `CLOSE_KM` finer still — the area step's map, a few tens of km across. */
const NEAR_KM = 700;
const CLOSE_KM = 70;
/** The simplification's tolerance, ° on the ground (east scaled by the
 * latitude): finest round a face, fine near one, coarse elsewhere. */
const TOL = { close: 0.008, near: 0.025, far: 0.16 };
/** A ring smaller than this across (°) is dropped: near a face, far. */
const SMALL = { near: 0.12, far: 0.8 };
/** A lake is kept only within this of a face (km), and this big (° across). */
const LAKE = { km: 350, across: 0.12 };
/** Nothing south of this is drawn (°): the camera never goes there. */
const SOUTH = -58;

const args = parseArgs(
  process.argv.slice(2),
  {
    fetch: {
      kind: "flag",
      help: "download the Natural Earth layers not yet kept in previews/.ne/",
    },
    write: { kind: "flag", help: "write pwa/src/game/world-map-data.ts" },
  },
  "usage: npm run world-map -- [--fetch] [--write]",
);

async function layer(name) {
  const file = join(CACHE, `${name}.geojson`);
  if (!existsSync(file)) {
    if (!args.fetch) throw new Error(`${file} is not kept — run with --fetch`);
    process.stdout.write(`fetching ${name}… `);
    const res = await fetch(`${SOURCE}/${name}.geojson`);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log("done");
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

/** The faces' middles, once. */
const FACE_AT = FACES.map((f) => ({ lat: f.lat, lon: f.lon }));

function km(a, b) {
  const k = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return 111.32 * Math.hypot(a.lat - b.lat, (a.lon - b.lon) * k);
}
const nearest = (p) => Math.min(...FACE_AT.map((f) => km(p, f)));
const isNear = (p) => nearest(p) < NEAR_KM;

/** A point's distance from a segment, ° on the ground. */
function offLine(p, a, b) {
  const k = Math.cos((p[1] * Math.PI) / 180);
  const ax = a[0] * k;
  const bx = b[0] * k;
  const px = p[0] * k;
  const dx = bx - ax;
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  let t = len > 0 ? ((px - ax) * dx + (p[1] - a[1]) * dy) / len : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas–Peucker, each point held to its own tolerance. */
function simplify(pts) {
  if (pts.length < 3) return pts;
  const tol = pts.map((p) => {
    const km = nearest({ lon: p[0], lat: p[1] });
    return km < CLOSE_KM ? TOL.close : km < NEAR_KM ? TOL.near : TOL.far;
  });
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let worst = 0;
    let at = -1;
    for (let k = i + 1; k < j; k++) {
      const r = offLine(pts[k], pts[i], pts[j]) / tol[k];
      if (r > worst) [worst, at] = [r, k];
    }
    if (worst > 1) {
      keep[at] = 1;
      stack.push([i, at], [at, j]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

/** How far across a ring is, °. */
function across(pts) {
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const k = Math.cos((((Math.max(...lats) + Math.min(...lats)) / 2) * Math.PI) / 180);
  return Math.hypot(
    (Math.max(...lons) - Math.min(...lons)) * k,
    Math.max(...lats) - Math.min(...lats),
  );
}

/** The polyline encoding of one ring at `PRECISION`. */
function encode(pts) {
  let out = "";
  let px = 0;
  let py = 0;
  const put = (v) => {
    let z = v < 0 ? ~(v << 1) : v << 1;
    while (z >= 0x20) {
      out += String.fromCharCode((0x20 | (z & 0x1f)) + 63);
      z >>= 5;
    }
    out += String.fromCharCode(z + 63);
  };
  for (const [lon, lat] of pts) {
    const x = Math.round(lon * PRECISION);
    const y = Math.round(lat * PRECISION);
    if (out !== "" && x === px && y === py) continue;
    put(y - py);
    put(x - px);
    px = x;
    py = y;
  }
  return out;
}

/** Every line of a geometry, as arrays of [lon, lat]. */
function linesOf(geom) {
  switch (geom.type) {
    case "Polygon":
      return geom.coordinates;
    case "MultiPolygon":
      return geom.coordinates.flat();
    case "LineString":
      return [geom.coordinates];
    case "MultiLineString":
      return geom.coordinates;
    default:
      return [];
  }
}

/** A layer baked: its lines kept, simplified and encoded. */
function bake(json, { closed, keepLine = () => true }) {
  const out = [];
  let points = 0;
  for (const feature of json.features) {
    for (const line of linesOf(feature.geometry)) {
      if (line.every((p) => p[1] < SOUTH)) continue;
      if (!keepLine(line)) continue;
      const near = line.some((p) => isNear({ lon: p[0], lat: p[1] }));
      if (closed && across(line) < (near ? SMALL.near : SMALL.far)) continue;
      const pts = simplify(line);
      if (pts.length < (closed ? 4 : 2)) continue;
      points += pts.length;
      out.push(encode(pts));
    }
  }
  return { text: out.join(" "), rings: out.length, points };
}

const land = bake(await layer(LAYERS.land), { closed: true });
const borders = bake(await layer(LAYERS.borders), { closed: false });
const lakes = bake(await layer(LAYERS.lakes), {
  closed: true,
  keepLine: (line) =>
    across(line) >= LAKE.across && line.some((p) => nearest({ lon: p[0], lat: p[1] }) < LAKE.km),
});

const rows = { land, borders, lakes };
let total = 0;
for (const [name, r] of Object.entries(rows)) {
  total += r.text.length;
  console.log(
    `${name.padEnd(8)} ${String(r.rings).padStart(5)} lines ${String(r.points).padStart(6)} points ${(r.text.length / 1024).toFixed(1).padStart(6)} KB`,
  );
}
console.log(`total    ${(total / 1024).toFixed(1)} KB`);

if (args.write) {
  const lines = [
    "// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0",
    "// GENERATED by `make world-map ARGS=--write` (scripts/world-map.mjs) — never",
    "// edit by hand. The outlines are Natural Earth's 1:50 m land, land borders",
    "// and lakes (public domain, naturalearthdata.com), simplified; each layer",
    "// is its lines as encoded polylines at a hundredth of a degree, joined by",
    "// spaces. `world-map.ts` decodes them; the start card's WHERE steps load",
    "// this module only when they are opened.",
    "",
    `/** The precision the lines are kept at: a unit is 1/${PRECISION} °. */`,
    `export const WORLD_PRECISION = ${PRECISION};`,
    "",
    "/** The land's coastlines (closed rings). */",
    `export const WORLD_LAND = ${JSON.stringify(land.text)};`,
    "",
    "/** The borders between countries on land (open lines). */",
    `export const WORLD_BORDERS = ${JSON.stringify(borders.text)};`,
    "",
    "/** The bigger lakes near a real face (closed rings). */",
    `export const WORLD_LAKES = ${JSON.stringify(lakes.text)};`,
    "",
  ];
  writeFileSync(OUT, lines.join("\n"));
  console.log(`wrote ${OUT}`);
}

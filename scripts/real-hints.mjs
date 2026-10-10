#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL FACES' HINTS — where the real ski area on each of the twenty
// real faces has its lifts, its pistes and its houses, so a ski area
// raised on a face can be laid the way the real one is.
//
// The offline half: it reads the map data of each face's crop off
// OpenStreetMap (the editing API's bounding-box call, a few tiles a face,
// kept in `previews/.osm/` once fetched), keeps only what a generator can
// lean on — every lift's two ends and its kind, every downhill piste as a
// line of bends with its grade and its width at each (off the piste's
// mapped area, where there is one), every building's middle, size
// and bearing — turns them onto the face's map with the same crop the
// heights were baked on (`scripts/lib/real-face-crops.mjs`), and writes
// them into `engine/mapgen/real-hints/hints-<id>.ts`, a GENERATED file a
// face listed in `real-hints-index.ts` with the grades its pistes are
// signed, that `real-hints.ts` loads and decodes at run time.
//
// Nothing is kept by name: no lift, piste or place name is read.
//
//   make real-hints ARGS=--fetch      # fetch the map data (once), then bake
//   make real-hints                   # bake from the kept data, print the table
//   make real-hints ARGS=--write      # …and write the faces baked and the index
//
// The map data: © OpenStreetMap contributors, available under the Open
// Database Licence (ODbL 1.0); the baked hints are a derived database
// under the same licence (`docs/real-faces.md`).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

import { FACES, SIZE, globeAt, mapAt } from "./lib/real-face-crops.mjs";
import { HINT_INDEX, keptGrades, writeHintFile, writeHintIndex } from "./lib/real-face-files.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(root, "previews", ".osm");
const API = "https://api.openstreetmap.org/api/0.6/map";

/** How many tiles a side a face's box is fetched in (the API caps a call's
 * nodes), and how far past the crop the box reaches, m. */
const TILES = 3;
const PAD = 150;

const args = parseArgs(
  process.argv.slice(2),
  {
    fetch: { kind: "flag", help: "download the map data not yet kept in previews/.osm/" },
    write: {
      kind: "flag",
      help: "write the faces baked (engine/mapgen/real-hints/) and the index",
    },
    only: {
      kind: "string",
      help: "comma-separated face ids to bake (--write writes those and keeps the rest)",
    },
  },
  "usage: npm run real-hints -- [--fetch] [--write] [--only id,id]",
);

// ── The map data ────────────────────────────────────────────────────────

/** A face's box on the globe, padded, as [south, west, north, east]. */
function boxOf(face) {
  const pts = [];
  for (const x of [-PAD, SIZE + PAD]) {
    for (const z of [-PAD, SIZE + PAD]) pts.push(globeAt(face, x, z));
  }
  const lats = pts.map((p) => p[0]);
  const lons = pts.map((p) => p[1]);
  return [Math.min(...lats), Math.min(...lons), Math.max(...lats), Math.max(...lons)];
}

/** The cached file of one tile of a face's box. */
const tileFile = (face, i, j) => join(CACHE, `${face.id}-${i}${j}.osm`);

async function fetchFace(face) {
  const [s, w, n, e] = boxOf(face);
  mkdirSync(CACHE, { recursive: true });
  for (let i = 0; i < TILES; i++) {
    for (let j = 0; j < TILES; j++) {
      const file = tileFile(face, i, j);
      if (existsSync(file)) continue;
      const bbox = [
        w + ((e - w) * j) / TILES,
        s + ((n - s) * i) / TILES,
        w + ((e - w) * (j + 1)) / TILES,
        s + ((n - s) * (i + 1)) / TILES,
      ]
        .map((v) => v.toFixed(5))
        .join(",");
      process.stdout.write(`fetching ${face.id} ${i}${j}… `);
      const res = await fetch(`${API}?bbox=${bbox}`, {
        headers: { "User-Agent": "fall-line-bake/1.0 (offline terrain bake, run by hand)" },
      });
      if (!res.ok) throw new Error(`${face.id} ${i}${j}: ${res.status} ${await res.text()}`);
      writeFileSync(file, await res.text());
      console.log("kept");
      // The API's usage policy asks for a light hand.
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

/** Every node and way of a face's tiles: nodes as [lat, lon], ways as their
 * node ids and tags. The XML is the API's own, read by its fixed shape. */
function readFace(face) {
  const nodes = new Map();
  const ways = new Map();
  for (let i = 0; i < TILES; i++) {
    for (let j = 0; j < TILES; j++) {
      const xml = readFileSync(tileFile(face, i, j), "utf8");
      for (const m of xml.matchAll(/<node id="(\d+)"[^>]*?lat="([-\d.]+)" lon="([-\d.]+)"/g)) {
        nodes.set(m[1], [Number(m[2]), Number(m[3])]);
      }
      for (const m of xml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
        if (ways.has(m[1])) continue;
        const refs = [...m[2].matchAll(/<nd ref="(\d+)"/g)].map((r) => r[1]);
        const tags = {};
        for (const t of m[2].matchAll(/<tag k="([^"]*)" v="([^"]*)"/g)) tags[t[1]] = t[2];
        ways.set(m[1], { refs, tags });
      }
    }
  }
  return { nodes, ways };
}

// ── What is kept ────────────────────────────────────────────────────────

/** The lifts by kind: 0 a chair, 1 a gondola or a cable car, 2 a drag. */
const LIFT_KINDS = {
  chair_lift: 0,
  mixed_lift: 0,
  gondola: 1,
  cable_car: 1,
  drag_lift: 2,
  "t-bar": 2,
  "j-bar": 2,
  platter: 2,
  rope_tow: 2,
  magic_carpet: 2,
};

/** `RunGrade`s in the order a piste's grade indexes them. */
const GRADE_NAMES = ["green", "blue", "red", "black", "orange"];

/** A piste's grade, as an index of `RunGrade`s (green to orange), off its tagged
 * difficulty — read as the country it lies in reads it: Europe's easy is
 * a blue, America's and the far east's a green. */
function gradeOf(face, tags) {
  const d = tags["piste:difficulty"];
  const west = face.lon < -30 || face.lon > 100;
  const table = west
    ? { novice: 0, easy: 0, intermediate: 1, advanced: 3, expert: 3, freeride: 4, extreme: 4 }
    : { novice: 0, easy: 1, intermediate: 2, advanced: 3, expert: 3, freeride: 4, extreme: 4 };
  return table[d] ?? (west ? 1 : 2);
}

/** How coarsely a lift's ends and a piste's bends are kept, m, and a
 * house's middle; how far a piste's line may stray from its bends, m; the
 * shortest piste kept, m; a house's size step, m, and its bearing's steps
 * round half a turn. */
const COARSE = 2;
const FINE = 1;
const STRAY = 6;
const SHORTEST = 60;
/** A piste area wider than this across its line is a whole bowl mapped as
 * one, and tells nothing of the piste's own width, m. */
const WIDEST = 160;
const SIZE_STEP = 1;
const WIDTH_STEP = 2;
const BEARINGS = 32;
/** The houses kept: none smaller than `HOUSE_LEAST` m a side (a shed, a
 * garage), and no more than `HOUSES_MOST` a face, the largest first. */
const HOUSE_LEAST = 3;
const HOUSES_MOST = 4000;

const inMap = ([x, z]) => x >= 0 && x <= SIZE && z >= 0 && z <= SIZE;

/** A line thinned to the bends that keep it within `tol` (Douglas–Peucker). */
function thin(pts, tol) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts.at(-1)];
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  let worst = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((pts[i][0] - a[0]) * dz - (pts[i][1] - a[1]) * dx) / len;
    if (d > worst) [worst, at] = [d, i];
  }
  if (worst <= tol) return [a, b];
  return [...thin(pts.slice(0, at + 1), tol).slice(0, -1), ...thin(pts.slice(at), tol)];
}

/** The longest run of a line's points that stay on the map. */
function onMap(pts) {
  let best = [];
  let cur = [];
  for (const p of pts) {
    if (inMap(p)) cur.push(p);
    else {
      if (cur.length > best.length) best = cur;
      cur = [];
    }
  }
  return cur.length > best.length ? cur : best;
}

const lengthOf = (pts) =>
  pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

/** A piste AREA (a groomed slope mapped as its outline): its ring and
 * its bounds. */
function areaOf(ring) {
  const xs = ring.map((p) => p[0]);
  const zs = ring.map((p) => p[1]);
  return {
    ring,
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    z0: Math.min(...zs),
    z1: Math.max(...zs),
  };
}

function inside(ring, x, z) {
  let odd = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) odd = !odd;
  }
  return odd;
}

/** How far from (`x`, `z`) along (`dx`, `dz`) a ring's edge is, m. */
function reachTo(ring, x, z, dx, dz) {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[j];
    const ex = ring[i][0] - ax;
    const ez = ring[i][1] - az;
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((ax - x) * ez - (az - z) * ex) / den;
    const u = ((ax - x) * dz - (az - z) * dx) / den;
    if (t > 0 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  return best;
}

/** The real width of a piste at each of its bends, m: straight across its
 * line to the edges of the narrowest piste area it lies in — 0 where it
 * lies in none (a piste mapped as a line alone). */
function widthsOf(points, areas) {
  return points.map(([x, z], i) => {
    const [ax, az] = points[Math.max(0, i - 1)];
    const [bx, bz] = points[Math.min(points.length - 1, i + 1)];
    const l = Math.hypot(bx - ax, bz - az) || 1;
    const [nx, nz] = [-(bz - az) / l, (bx - ax) / l];
    let best = 0;
    for (const a of areas) {
      if (x < a.x0 || x > a.x1 || z < a.z0 || z > a.z1 || !inside(a.ring, x, z)) continue;
      const w = reachTo(a.ring, x, z, nx, nz) + reachTo(a.ring, x, z, -nx, -nz);
      if (w < WIDEST && (best === 0 || w < best)) best = w;
    }
    return best;
  });
}

/** A face's hints on its map: lifts bottom to top, pistes down their line,
 * houses by their middle, size and bearing. `height` reads the face's own
 * baked heights, so a lift's bottom is the lower of its ends. */
function hintsOf(face, height) {
  const { nodes, ways } = readFace(face);
  const lifts = [];
  const pistes = [];
  const houses = [];
  const areas = [];
  for (const w of ways.values()) {
    const closed = w.refs[0] === w.refs.at(-1);
    if (w.tags["piste:type"] !== "downhill" || !closed || w.refs.length < 4) continue;
    const ring = w.refs
      .slice(0, -1)
      .map((r) => nodes.get(r))
      .filter(Boolean)
      .map((g) => mapAt(face, ...g));
    if (ring.length >= 3) areas.push(areaOf(ring));
  }
  for (const w of ways.values()) {
    const pts = w.refs
      .map((r) => nodes.get(r))
      .filter(Boolean)
      .map((g) => mapAt(face, ...g));
    if (pts.length < 2) continue;
    const kind = LIFT_KINDS[w.tags.aerialway];
    if (kind !== undefined) {
      let [a, b] = [pts[0], pts.at(-1)];
      if (!inMap(a) || !inMap(b)) continue;
      if (height(...a) > height(...b)) [a, b] = [b, a];
      lifts.push({ kind, bottom: a, top: b });
      continue;
    }
    const closed = w.refs[0] === w.refs.at(-1);
    if (w.tags["piste:type"] === "downhill" && !closed && w.tags.area !== "yes") {
      let line = onMap(pts);
      if (lengthOf(line) < SHORTEST) continue;
      // Down the hill, top first.
      if (height(...line[0]) < height(...line.at(-1))) line = line.reverse();
      const points = thin(line, STRAY);
      pistes.push({ grade: gradeOf(face, w.tags), points, widths: widthsOf(points, areas) });
      continue;
    }
    if (w.tags.building && closed && pts.length >= 4) {
      const ring = pts.slice(0, -1);
      let area = 0;
      let cx = 0;
      let cz = 0;
      for (let i = 0; i < ring.length; i++) {
        const [x0, z0] = ring[i];
        const [x1, z1] = ring[(i + 1) % ring.length];
        const k = x0 * z1 - x1 * z0;
        area += k;
        cx += (x0 + x1) * k;
        cz += (z0 + z1) * k;
      }
      if (Math.abs(area) < 1e-6) continue;
      const mid = [cx / (3 * area), cz / (3 * area)];
      if (!inMap(mid)) continue;
      // The longest wall's bearing, folded into half a turn.
      let long = 0;
      let bearing = 0;
      for (let i = 0; i < ring.length; i++) {
        const [x0, z0] = ring[i];
        const [x1, z1] = ring[(i + 1) % ring.length];
        const l = Math.hypot(x1 - x0, z1 - z0);
        if (l > long) [long, bearing] = [l, Math.atan2(x1 - x0, z1 - z0)];
      }
      const turn = ((bearing % Math.PI) + Math.PI) % Math.PI;
      houses.push({ mid, size: Math.sqrt(Math.abs(area) / 2), turn });
    }
  }
  const kept = houses
    .filter((o) => o.size >= HOUSE_LEAST)
    .sort((a, b) => b.size - a.size)
    .slice(0, HOUSES_MOST);
  return { lifts, pistes, houses: kept };
}

/** The hints as bytes: zig-zag varints, every coordinate a step of its own
 * grain and each told as its step from the one before. */
function encode(h) {
  const bytes = [];
  const put = (v) => {
    let z = v >= 0 ? v * 2 : -v * 2 - 1;
    while (z >= 0x80) {
      bytes.push((z & 0x7f) | 0x80);
      z >>>= 7;
    }
    bytes.push(z);
  };
  const q = (v, grain) => Math.round(v / grain);
  put(h.lifts.length);
  for (const l of h.lifts) {
    put(l.kind);
    for (const v of [...l.bottom, ...l.top]) put(q(v, COARSE));
  }
  put(h.pistes.length);
  for (const p of h.pistes) {
    put(p.grade);
    put(p.points.length);
    let [px, pz] = [0, 0];
    p.points.forEach(([x, z], i) => {
      put(q(x, COARSE) - px);
      put(q(z, COARSE) - pz);
      put(q(p.widths[i], WIDTH_STEP));
      [px, pz] = [q(x, COARSE), q(z, COARSE)];
    });
  }
  const houses = h.houses
    .map((o) => ({
      x: q(o.mid[0], FINE),
      z: q(o.mid[1], FINE),
      size: Math.min(63, q(o.size, SIZE_STEP)),
      turn: q(o.turn / Math.PI, 1 / BEARINGS) % BEARINGS,
    }))
    .sort((a, b) => a.z - b.z || a.x - b.x);
  put(houses.length);
  let [hx, hz] = [0, 0];
  for (const o of houses) {
    put(o.z - hz);
    put(o.x - hx);
    put(o.size * BEARINGS + o.turn);
    [hx, hz] = [o.x, o.z];
  }
  return Buffer.from(bytes).toString("base64");
}

// ── Run ─────────────────────────────────────────────────────────────────

const { faceHeight, loadRealFace, realFace } = await import("../engine/mapgen/real-face.ts");

const only = args.only ? new Set(args.only.split(",")) : null;
const faces = FACES.filter((f) => !only || only.has(f.id));
if (args.fetch) {
  for (const face of faces) await fetchFace(face);
}
const baked = [];
console.log("face            lifts  pistes  houses   bytes");
for (const face of faces) {
  if (!(await loadRealFace(face.id))) throw new Error(`${face.id}: bake its heights first`);
  const grid = realFace(face.id);
  const h = hintsOf(face, (x, z) => faceHeight(grid, x, z));
  const data = encode(h);
  baked.push({ id: face.id, data, grades: h.pistes.map((p) => GRADE_NAMES[p.grade]) });
  console.log(
    `${face.id.padEnd(16)}${String(h.lifts.length).padStart(5)}${String(h.pistes.length).padStart(8)}${String(h.houses.length).padStart(8)}${String(Math.round((data.length * 3) / 4)).padStart(8)}`,
  );
}
const total = baked.reduce((s, b) => s + b.data.length, 0);
console.log(`${baked.length} faces, ${(total / 1024).toFixed(1)} KB of base64`);

if (args.write) {
  // The faces baked are written; every other face's file and grades are
  // kept as they are, so adding a face never moves one already shipped.
  const grades = keptGrades();
  for (const b of baked) {
    console.log(`wrote ${writeHintFile(b)}`);
    grades.set(b.id, b.grades);
  }
  writeHintIndex(
    FACES.map((f) => f.id),
    grades,
    { coarse: COARSE, fine: FINE, size: SIZE_STEP, width: WIDTH_STEP, bearings: BEARINGS },
  );
  console.log(`wrote ${HINT_INDEX}`);
}

#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL FACES' HINTS — where the real ski area on each real face has
// its lifts, its pistes and its houses, where the town at its foot runs its
// streets, so a ski area raised on a face can be laid the way the real one
// is, and how wooded each height of it is.
//
// The offline half: it reads the map data of each face's crop off
// OpenStreetMap (the editing API's bounding-box call, a few tiles a face,
// kept in `previews/.osm/` once fetched), keeps only what a generator can
// lean on — every lift's two ends and its kind, every downhill piste as a
// line of bends with its grade and its width at each (off the piste's
// mapped area, where there is one), every building's middle, size
// and bearing, and the town's streets roughly — its car roads as a few
// bends each, the most central first, and its middle and radius
// (`scripts/lib/real-face-streets.mjs`) — turns them onto the face's map with the same crop the
// heights were baked on (`scripts/lib/real-face-crops.mjs`), and writes
// them into `engine/mapgen/real-hints/hints-<id>.ts`, a GENERATED file a
// face listed in `real-hints-index.ts` with the grades its pistes are
// signed and its woods by height (`scripts/lib/real-face-forest.mjs`: the
// forest the map draws, read onto the face's height grid — the tree line
// and the cover in eight bands), that `real-hints.ts` and `real-face.ts`
// read at run time.
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
import {
  HINT_INDEX,
  keptGrades,
  keptTrees,
  writeHintFile,
  writeHintIndex,
} from "./lib/real-face-files.mjs";
import { encodeTrees, forestPolygons, rasterise, woodsByHeight } from "./lib/real-face-forest.mjs";
import { townOf } from "./lib/real-face-streets.mjs";

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
    trees: {
      kind: "flag",
      help: "with --write, write only the woods into the index and keep every hint file",
    },
    only: {
      kind: "string",
      help: "comma-separated face ids to bake (--write writes those and keeps the rest)",
    },
  },
  "usage: npm run real-hints -- [--fetch] [--write [--trees]] [--only id,id]",
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

/** A short key of a face's crop (FNV-1a over its numbers), so a face
 * cropped afresh reads tiles fetched for the new crop, never the old. */
function cropKey(face) {
  let h = 0x811c9dc5;
  for (const ch of [face.lat, face.lon, face.east, face.north, face.bearing, face.scale].join(
    ",",
  )) {
    h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** The cached file of one tile of a face's box, keyed by its crop. */
const tileFile = (face, i, j) => join(CACHE, `${face.id}-${cropKey(face)}-${i}${j}.osm`);

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

/** Read one file of the API's XML into `into`: nodes as [lat, lon], ways
 * as their node ids and tags, relations as their member ways (and each
 * one's role) and tags. The
 * XML is the API's own, read by its fixed shape. */
function readXml(xml, into) {
  for (const m of xml.matchAll(/<node id="(\d+)"[^>]*?lat="([-\d.]+)" lon="([-\d.]+)"/g)) {
    into.nodes.set(m[1], [Number(m[2]), Number(m[3])]);
  }
  const tagsOf = (body) => {
    const tags = {};
    for (const t of body.matchAll(/<tag k="([^"]*)" v="([^"]*)"/g)) tags[t[1]] = t[2];
    return tags;
  };
  for (const m of xml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
    if (into.ways.has(m[1])) continue;
    const refs = [...m[2].matchAll(/<nd ref="(\d+)"/g)].map((r) => r[1]);
    into.ways.set(m[1], { refs, tags: tagsOf(m[2]) });
  }
  for (const m of xml.matchAll(/<relation id="(\d+)"[^>]*>([\s\S]*?)<\/relation>/g)) {
    if (into.relations.has(m[1])) continue;
    const ways = [...m[2].matchAll(/<member type="way" ref="(\d+)" role="([^"]*)"/g)];
    const members = ways.map((r) => r[1]);
    const roles = ways.map((r) => r[2]);
    into.relations.set(m[1], { members, roles, tags: tagsOf(m[2]) });
  }
  return into;
}

/** Every node, way and relation of a face's tiles. */
function readFace(face) {
  const into = { nodes: new Map(), ways: new Map(), relations: new Map() };
  for (let i = 0; i < TILES; i++) {
    for (let j = 0; j < TILES; j++) readXml(readFileSync(tileFile(face, i, j), "utf8"), into);
  }
  return into;
}

/** A relation's whole self — every member way and its nodes — kept in
 * `previews/.osm/` once fetched (the box call leaves out the members that
 * lie wholly outside the box, and a forest's ring is not whole without
 * them). Null when it is not kept and `--fetch` was not asked. */
async function relationFull(id) {
  const file = join(CACHE, `relation-${id}.osm`);
  if (!existsSync(file)) {
    if (!args.fetch) return null;
    process.stdout.write(`fetching relation ${id}… `);
    const res = await fetch(`${API.replace(/map$/, "")}relation/${id}/full`, {
      headers: { "User-Agent": "fall-line-bake/1.0 (offline terrain bake, run by hand)" },
    });
    if (!res.ok) throw new Error(`relation ${id}: ${res.status} ${await res.text()}`);
    writeFileSync(file, await res.text());
    console.log("kept");
    await new Promise((r) => setTimeout(r, 1500));
  }
  return readFileSync(file, "utf8");
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
/** A town's radius step, m. */
const TOWN_STEP = 10;
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

/** A building's ring on the map (its corners, not closed) as a house:
 * its middle, its size (the side of a square of half its area) and its
 * longest wall's bearing folded into half a turn — or null where its
 * middle is off the map or it has no area. */
function houseOf(ring) {
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
  if (Math.abs(area) < 1e-6) return null;
  const mid = [cx / (3 * area), cz / (3 * area)];
  if (!inMap(mid)) return null;
  let long = 0;
  let bearing = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, z0] = ring[i];
    const [x1, z1] = ring[(i + 1) % ring.length];
    const l = Math.hypot(x1 - x0, z1 - z0);
    if (l > long) [long, bearing] = [l, Math.atan2(x1 - x0, z1 - z0)];
  }
  const turn = ((bearing % Math.PI) + Math.PI) % Math.PI;
  return { mid, size: Math.sqrt(Math.abs(area) / 2), turn };
}

/** The closed rings a multipolygon's member ways (their node ids, each
 * possibly a piece of a ring) join into, end to end; none where a member
 * is missing from the tiles. */
function ringsOf(lines) {
  if (lines.some((l) => !l)) return [];
  const open = lines.map((l) => l.slice());
  const rings = [];
  while (open.length > 0) {
    let ring = open.shift();
    while (ring[0] !== ring.at(-1)) {
      const end = ring.at(-1);
      const i = open.findIndex((l) => l[0] === end || l.at(-1) === end);
      if (i < 0) break;
      const [l] = open.splice(i, 1);
      ring = ring.concat((l[0] === end ? l : l.slice().reverse()).slice(1));
    }
    if (ring[0] === ring.at(-1) && ring.length >= 4) rings.push(ring);
  }
  return rings;
}

/** A face's hints on its map: lifts bottom to top, pistes down their line,
 * houses by their middle, size and bearing. `height` reads the face's own
 * baked heights, so a lift's bottom is the lower of its ends. */
function hintsOf(face, data, height) {
  const { nodes, ways } = data;
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
      const house = houseOf(pts.slice(0, -1));
      if (house) houses.push(house);
    }
  }
  // A building mapped as a MULTIPOLYGON (a hotel round a courtyard, a
  // block of wings): each outer ring a building of its own, where every
  // member and node of it is in the tiles.
  for (const r of data.relations.values()) {
    if (!r.tags.building) continue;
    const outer = r.members.filter((_, i) => r.roles[i] !== "inner").map((m) => ways.get(m)?.refs);
    for (const ring of ringsOf(outer)) {
      const pts = ring.map((id) => nodes.get(id));
      if (pts.some((g) => !g)) continue;
      const house = houseOf(pts.slice(0, -1).map((g) => mapAt(face, ...g)));
      if (house) houses.push(house);
    }
  }
  const kept = houses
    .filter((o) => o.size >= HOUSE_LEAST)
    .sort((a, b) => b.size - a.size)
    .slice(0, HOUSES_MOST);
  return { lifts, pistes, houses: kept, ...townOf(face, data, thin, townBytes) };
}

/** A writer of zig-zag varints: `put` a whole number, `bytes` so far. */
function varints() {
  const bytes = [];
  const put = (v) => {
    let z = v >= 0 ? v * 2 : -v * 2 - 1;
    while (z >= 0x80) {
      bytes.push((z & 0x7f) | 0x80);
      z >>>= 7;
    }
    bytes.push(z);
  };
  return { bytes, put };
}

const q = (v, grain) => Math.round(v / grain);

/** A town (`real-face-streets.mjs`'s `townOf`) onto `put`: how many
 * streets, then — where there are any — the town's middle (`COARSE`) and
 * radius (`TOWN_STEP`), and each street's class, its bends' count and its
 * bends, each told as its step from the one before. */
function putTown(put, town, streets) {
  put(streets.length);
  if (streets.length === 0) return;
  put(q(town.x, COARSE));
  put(q(town.z, COARSE));
  put(q(town.r, TOWN_STEP));
  let [px, pz] = [0, 0];
  for (const s of streets) {
    put(s.cls);
    put(s.points.length);
    for (const [x, z] of s.points) {
      put(q(x, COARSE) - px);
      put(q(z, COARSE) - pz);
      [px, pz] = [q(x, COARSE), q(z, COARSE)];
    }
  }
}

/** How many bytes a town's streets take as baked. */
function townBytes(streets) {
  const w = varints();
  putTown(w.put, { x: 0, z: 0, r: 0 }, streets);
  return w.bytes.length;
}

/** The hints as bytes: zig-zag varints, every coordinate a step of its own
 * grain and each told as its step from the one before; the town last. */
function encode(h) {
  const { bytes, put } = varints();
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
  putTown(put, h.town, h.streets);
  return Buffer.from(bytes).toString("base64");
}

// ── Run ─────────────────────────────────────────────────────────────────

const { faceHeight, loadRealFace, realFace } = await import("../engine/mapgen/real-face.ts");
const { FACE_GRID } = await import("../engine/mapgen/real-faces-index.ts");

const only = args.only ? new Set(args.only.split(",")) : null;
const faces = FACES.filter((f) => !only || only.has(f.id));
if (args.fetch) {
  for (const face of faces) await fetchFace(face);
}
const baked = [];
console.log(
  "face            lifts  pistes  houses  streets  town b   bytes  wooded  line m  missing  bands",
);
for (const face of faces) {
  if (!(await loadRealFace(face.id))) throw new Error(`${face.id}: bake its heights first`);
  const grid = realFace(face.id);
  const data = readFace(face);
  const h = hintsOf(face, data, (x, z) => faceHeight(grid, x, z));
  const { polys, missing } = await forestPolygons(face, data, relationFull, readXml);
  const woods = woodsByHeight(rasterise(polys, FACE_GRID.n, FACE_GRID.cell), grid.heights);
  const trees = woods.trees ? encodeTrees(woods.trees) : null;
  const encoded = encode(h);
  baked.push({
    id: face.id,
    data: encoded,
    grades: h.pistes.map((p) => GRADE_NAMES[p.grade]),
    trees,
  });
  const line = woods.trees ? (woods.lo + woods.trees.line * (woods.hi - woods.lo)).toFixed(0) : "-";
  const bands = woods.trees ? woods.trees.bands.map((b) => b.toFixed(2)).join(" ") : "";
  console.log(
    `${face.id.padEnd(16)}${String(h.lifts.length).padStart(5)}${String(h.pistes.length).padStart(8)}${String(h.houses.length).padStart(8)}${String(h.streets.length).padStart(9)}${String(townBytes(h.streets)).padStart(8)}${String(Math.round((encoded.length * 3) / 4)).padStart(8)}${woods.share.toFixed(2).padStart(8)}${line.padStart(8)}${String(missing).padStart(9)}  ${bands}`,
  );
}
const total = baked.reduce((s, b) => s + b.data.length, 0);
console.log(`${baked.length} faces, ${(total / 1024).toFixed(1)} KB of base64`);

if (args.write) {
  // The faces baked are written; every other face's file, grades and woods
  // are kept as they are, so adding a face never moves one already shipped.
  // With --trees only the woods are written, every hint file kept.
  const grades = keptGrades();
  const trees = keptTrees();
  for (const b of baked) {
    if (!args.trees) {
      console.log(`wrote ${writeHintFile(b)}`);
      grades.set(b.id, b.grades);
    }
    if (b.trees) trees.set(b.id, b.trees);
    else trees.delete(b.id);
  }
  writeHintIndex(
    FACES.map((f) => f.id),
    grades,
    trees,
    {
      coarse: COARSE,
      fine: FINE,
      size: SIZE_STEP,
      width: WIDTH_STEP,
      bearings: BEARINGS,
      town: TOWN_STEP,
    },
  );
  console.log(`wrote ${HINT_INDEX}`);
}

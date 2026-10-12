#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIRSTRIP LAB — where the jump plane's strip (`airstrip.ts`) lies on
// a map, from nothing but the engine: for every map asked, the piste map
// from above round the strip (the runs in their colours, the lifts, every
// building, the village's streets, the woods, the water) with the room the
// strip's search reads laid over it (`airstrip-room.ts`: tinted where a
// strip's centre line may not run), the strip itself, its markers and its
// site's buildings, and a row in a table — which rules it was found under
// (`tier`), how far from the village, its bearing off the valley's axis,
// its grade, the least room along it and the search's time.
//
// The faces are the point: a real mountainside's valley is wherever it is,
// its town is wherever it is, and the strip must find its own floor there.
//
//   npm run airstrip -- --faces all                  # every real face, a sheet
//   npm run airstrip -- --faces alpine-9,fell-23     # some, each its own picture
//   npm run airstrip -- --seeds 1-8                  # generated mountains
//
// Writes previews/airstrip-<map>.png for each, previews/airstrip-sheet.png
// for them all, and previews/airstrip.txt (the table). Engine only: no
// three.js, no browser, no build.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";
import { renderResortPlan } from "./lib/resort-draw.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const E = await import(join(root, "engine/index.ts"));
const { FACE_INDEX } = await import(join(root, "engine/mapgen/real-faces-index.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    faces: { kind: "string", help: "real faces: a list (alpine-9,fell-23) or `all`" },
    seeds: { kind: "string", help: "generated mountains: a list or a range (1-8)" },
    seed: { kind: "number", default: 38, help: "the seed a real face is raised with" },
    size: { kind: "number", default: 1400, help: "the picture's side round the strip, m" },
    px: { kind: "number", default: 700, help: "a picture's side, px" },
    thumb: { kind: "number", default: 360, help: "a sheet thumbnail's side, px" },
  },
  "usage: npm run airstrip -- (--faces all | --faces a,b | --seeds 1-8) [--seed n]",
);

const range = (s) =>
  s.split(",").flatMap((p) => {
    const m = /^(\d+)-(\d+)$/.exec(p);
    if (!m) return [Number(p)];
    const out = [];
    for (let i = Number(m[1]); i <= Number(m[2]); i++) out.push(i);
    return out;
  });
const allFaces = () => FACE_INDEX.map((e) => e.id);
const maps = [];
if (args.faces) {
  const ids = args.faces === "all" ? allFaces() : args.faces.split(",");
  for (const id of ids) maps.push({ face: id, seed: args.seed, name: id });
}
if (args.seeds) for (const seed of range(args.seeds)) maps.push({ seed, name: `seed-${seed}` });
if (maps.length === 0) maps.push({ seed: args.seed, name: `seed-${args.seed}` });

const dir = join(root, "previews");
mkdirSync(dir, { recursive: true });
const S = E.PLANE.strip;
const f = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : "-");

/** The strip's frame: a point `along` its heading and `across` it. */
const stripAt = (s, along, across) => ({
  x: s.x + Math.sin(s.heading) * along + Math.cos(s.heading) * across,
  z: s.z + Math.cos(s.heading) * along - Math.sin(s.heading) * across,
});

const rows = [];
const thumbs = [];
console.log("map            tier     build_ms strip_ms  from_m  turn°  grade%  room_m  site");
for (const m of maps) {
  if (m.face) await E.loadRealFace(m.face);
  const t0 = performance.now();
  const level = E.generateLevel(m.seed, m.face ? { face: m.face } : {});
  // What the strip's field reads, built first so the strip's own time is its search's.
  E.cabinsOf(level);
  E.villageOf(level);
  E.liftPlans(level);
  E.stripRoomAt(level, 0, 0);
  const t1 = performance.now();
  const strip = E.airstripOf(level);
  const t2 = performance.now();
  const site = E.stripSiteOf(level);
  const v = level.resort?.village ?? strip;
  const from = Math.hypot(strip.x - v.x, strip.z - v.z);
  const off = Math.abs(
    ((((strip.heading - Math.PI / 2) % Math.PI) + Math.PI * 1.5) % Math.PI) - Math.PI / 2,
  );
  const grade =
    (strip.end.y - strip.start.y) /
    Math.hypot(strip.end.x - strip.start.x, strip.end.z - strip.start.z);
  let room = Infinity;
  for (let s = -strip.length / 2; s <= strip.length / 2; s += 4) {
    const p = stripAt(strip, s, 0);
    room = Math.min(room, E.stripRoomAt(level, p.x, p.z));
  }
  const row = {
    name: m.name,
    tier: strip.tier,
    build: t1 - t0,
    ms: t2 - t1,
    from,
    turn: (off * 180) / Math.PI,
    grade: grade * 100,
    room,
    site: site.buildings.map((b) => b.kind).join("+") || "none",
  };
  rows.push(row);
  console.log(
    `${row.name.padEnd(14)} ${row.tier.padEnd(8)} ${f(row.build).padStart(8)} ${f(row.ms).padStart(8)} ${f(from).padStart(7)} ${f(row.turn).padStart(6)} ${f(row.grade, 1).padStart(7)} ${f(room).padStart(7)}  ${row.site}`,
  );
  const pic = picture(level, strip, site, `${m.name}  ${strip.tier.toUpperCase()}`);
  if (maps.length <= 12) {
    writeFileSync(join(dir, `airstrip-${m.name}.png`), pic.toPng());
  }
  thumbs.push({ pic, name: m.name, tier: strip.tier });
}

writeFileSync(
  join(dir, "airstrip.txt"),
  [
    "map tier build_ms strip_ms from_m turn_deg grade_pct room_m site",
    ...rows.map((r) =>
      [
        r.name,
        r.tier,
        f(r.build),
        f(r.ms),
        f(r.from),
        f(r.turn),
        f(r.grade, 1),
        f(r.room),
        r.site,
      ].join(" "),
    ),
  ].join("\n") + "\n",
);
const tally = {};
for (const r of rows) tally[r.tier] = (tally[r.tier] ?? 0) + 1;
console.log(
  `\n${rows.length} maps: ${Object.entries(tally)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ")}; search ${f(Math.max(...rows.map((r) => r.ms)))} ms at most`,
);

// The sheet: every map's picture shrunk.
const T = args.thumb;
const cols = Math.min(8, thumbs.length);
const sheet = createDrawing(cols * T, Math.ceil(thumbs.length / cols) * T, [246, 244, 238]);
thumbs.forEach((t, k) => {
  const ox = (k % cols) * T;
  const oy = Math.floor(k / cols) * T;
  const src = t.pic;
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const c = src.get(Math.floor((x / T) * src.width), Math.floor((y / T) * src.height));
      if (c) sheet.set(ox + x, oy + y, c);
    }
  }
  sheet.rect(ox, oy, T - 1, T - 1, [24, 24, 28]);
});
writeFileSync(join(dir, "airstrip-sheet.png"), sheet.toPng());
console.log("wrote previews/airstrip-sheet.png, previews/airstrip.txt");

/** One map round its strip: the plan, the room, the strip and its site. */
function picture(level, strip, site, title) {
  const side = Math.min(level.size, args.size);
  const clamp = (c) => Math.max(0, Math.min(level.size - side, c - side / 2));
  const view = { x: clamp(strip.x), z: clamp(strip.z), size: side };
  const scale = args.px / side;
  const pic = renderResortPlan({
    level,
    scale,
    title,
    course: false,
    cabins: E.cabinsOf(level),
    village: E.villageOf(level),
    view,
  });
  // The plan's own frame (`renderResortPlan`: 12 px in, 40 px down).
  const px = (x) => 12 + (x - view.x) * scale;
  const py = (z) => 40 + (z - view.z) * scale;
  // Where a strict strip's centre line may not run: a red wash.
  const need = S.width / 2 + S.clear;
  const W = Math.ceil(side * scale);
  for (let j = 0; j < W; j += 2) {
    for (let i = 0; i < W; i += 2) {
      const x = view.x + (i + 0.5) / scale;
      const z = view.z + (j + 0.5) / scale;
      if (E.stripRoomAt(level, x, z) < need) pic.fillRect(12 + i, 40 + j, 2, 2, [220, 40, 40, 90]);
    }
  }
  // The strip, its markers and its buildings.
  const corner = (a, b) => {
    const p = stripAt(strip, a, b);
    return [px(p.x), py(p.z)];
  };
  const h = strip.length / 2;
  const w = strip.width / 2;
  pic.poly([corner(-h, -w), corner(h, -w), corner(h, w), corner(-h, w)], [255, 150, 30, 220]);
  pic.polyline([corner(-h, -w), corner(h, -w), corner(h, w), corner(-h, w)], [20, 20, 20], 2, true);
  pic.disk(px(strip.start.x), py(strip.start.z), 5, [20, 160, 40]);
  pic.disk(px(strip.end.x), py(strip.end.z), 5, [200, 30, 30]);
  for (const b of site.buildings) {
    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    const pts = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([a, c]) => [
      px(b.x + (fz * (a * b.width)) / 2 + (fx * (c * b.depth)) / 2),
      py(b.z - (fx * (a * b.width)) / 2 + (fz * (c * b.depth)) / 2),
    ]);
    pic.poly(pts, [60, 60, 70]);
  }
  pic.disk(px(site.sock.x), py(site.sock.z), 3, [255, 120, 0]);
  return pic;
}

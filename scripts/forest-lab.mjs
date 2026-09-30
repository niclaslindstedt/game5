#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FOREST LAB — the woods of one map (or a sweep of them) MEASURED and
// drawn from above, from nothing but the engine and the tree table.
//
// `make level` shows where a wood is; this shows what it is LIKE TO BE IN:
// how many trees and of which kinds, how many clumps, whether there is
// always a way between two groups of trees, and above all how far a skier
// SEES into it — every trunk and every crown at the skier's eye height,
// each crown as wide as its variant's silhouette is there (`crownAt`,
// `pwa/src/game/tree-variants.ts`) and as solid as its kind is (a spruce a
// wall of needles, a larch in winter a lattice). Four numbers carry it:
//
//   SIGHT IN   the median distance a ray from the skier's eye goes inside a
//              wood before it meets a crown or a trunk (capped at 200 m)
//   SIGHT OUT  the same from the edge of the track, looking into the woods
//              either side — what a skier sees going past
//   CLEAR      the narrowest gap under the crowns (at a skier's height)
//              between two trees of different groups — a clump's own
//              trunks may close up, but never two groups
//   SEALED     the share of the open snow in the drawn window a skier
//              cannot reach from its edge — a pocket walled in by crowns
//
// A picture: previews/forest-<seed>.png — a window of the woods beside the
// track, each crown drawn at its eye-height width in its kind's colour
// over its full spread, the clumps tied together, the lanes showing as
// the lines no trunk stands on, sight rays from the window's middle, and
// any sealed pocket in red. `--compare` draws the version-1 woods of the
// same seed beside it.
//
//   node --experimental-strip-types scripts/forest-lab.mjs --seed 38
//   node --experimental-strip-types scripts/forest-lab.mjs --seed 38 --compare
//   node --experimental-strip-types scripts/forest-lab.mjs --seed 1 --count 12
//   node --experimental-strip-types scripts/forest-lab.mjs --seed 5 --region alpine

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";
import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);
const { generateLevel, analyzeLevel, CURRENT_GENERATOR_VERSION, TREE_KINDS } = await import(
  join(root, "engine/index.ts")
);
const { treeVariant, crownAt } = await import(join(root, "pwa/src/game/tree-variants.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed (the first of a sweep)" },
    count: {
      kind: "number",
      default: 1,
      help: "how many seeds from --seed to sweep (table only past 1)",
    },
    region: {
      kind: "string",
      default: "alpine",
      help: "the kind of snow country (R21): alpine, fell, continental, maritime",
    },
    version: {
      kind: "number",
      default: 0,
      help: "the generator version to build by (0: the current one)",
    },
    compare: {
      kind: "flag",
      help: "also build the seed on version 1, measured and drawn beside it",
    },
    window: { kind: "number", default: 300, help: "the drawn window's side, m" },
    scale: { kind: "number", default: 2.5, help: "pixels per metre in the picture" },
    at: {
      kind: "string",
      default: "",
      help: "the window's middle as x,z (default: the woodiest stretch of the track)",
    },
    eye: {
      kind: "number",
      default: 2.2,
      help: "the skier's eye over the snow, m (the chase lens's height)",
    },
    out: { kind: "string", default: "", help: "file name under previews/ (no extension)" },
  },
  "usage: npm run forest -- --seed n [--count n] [--region id] [--compare] [--window m] [--at x,z]",
);

const SIGHT_CAP = 200;
/** A skier's half-width and the height his body stands to, m. */
const SKIER_HALF = 0.6;
const SKIER_H = 1;
const INK = {
  bg: [18, 24, 30],
  text: [230, 236, 242],
  dim: [150, 162, 174],
  track: [150, 160, 172],
  sealed: [220, 60, 60, 200],
  ray: [255, 214, 90, 150],
  clump: [255, 255, 255, 120],
};
/** Each kind's colour in the picture: the conifers in greens and olives,
 * the bare trees in browns, greys and mauves. */
const KIND_INK = {
  spruce: [36, 92, 60],
  fir: [26, 86, 92],
  pine: [132, 128, 60],
  larch: [176, 136, 92],
  blackspruce: [20, 56, 40],
  stonepine: [70, 110, 60],
  whitepine: [96, 140, 128],
  lodgepole: [150, 150, 80],
  hemlock: [60, 130, 80],
  juniper: [30, 70, 70],
  dwarfpine: [90, 100, 50],
  snag: [140, 136, 128],
  birch: [178, 150, 184],
  aspen: [170, 180, 160],
  rowan: [200, 70, 70],
  alder: [90, 76, 70],
  willow: [200, 130, 60],
  beech: [190, 110, 60],
  maple: [150, 120, 100],
  ash: [160, 150, 130],
};

/** A trunk's drawn crown radius at height `h` over its foot, m, and how
 * solid it is there. */
function crownOf(t, h) {
  const v = treeVariant(t.kind, t.x, t.z);
  const r = t.crown * 0.95 * crownAt(v, h / t.height);
  return { v, r, solid: v.opacity };
}

/** A bucket grid of the trees, 16 m cells, for rays and neighbours. */
function bucketTrees(trees) {
  const CELL = 16;
  const map = new Map();
  trees.forEach((t, i) => {
    const key = Math.floor(t.x / CELL) * 8192 + Math.floor(t.z / CELL);
    const list = map.get(key);
    if (list) list.push(i);
    else map.set(key, [i]);
  });
  const near = (x, z, r) => {
    const out = [];
    for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
      for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
        for (const i of map.get(cx * 8192 + cz) ?? []) out.push(i);
      }
    }
    return out;
  };
  return { CELL, near };
}

/** How far a ray from (x, z) along (dx, dz) goes at `eye` over the snow
 * before it meets a trunk or a crown solid enough to stop it. A crown of
 * opacity o stops a ray that passes within o of its radius — a lattice
 * stops only the rays that go near its middle. */
function sightFrom(level, grid, x, z, dx, dz, eye) {
  const step = grid.CELL;
  let best = SIGHT_CAP;
  const seen = new Set();
  for (let s = 0; s < SIGHT_CAP + step && s < best + step; s += step) {
    for (const i of grid.near(x + dx * s, z + dz * s, step)) {
      if (seen.has(i)) continue;
      seen.add(i);
      const t = level.trees[i];
      const h = level.groundAt(x, z) + eye - t.y;
      const c = crownOf(t, h);
      const r = Math.max(t.radius, c.r * c.solid);
      const ox = t.x - x;
      const oz = t.z - z;
      const along = ox * dx + oz * dz;
      if (along < 0) continue;
      const miss2 = ox * ox + oz * oz - along * along;
      if (miss2 > r * r) continue;
      const hitAt = along - Math.sqrt(r * r - miss2);
      if (hitAt < best) best = Math.max(0, hitAt);
    }
  }
  return best;
}

/** A tiny deterministic hash for the lab's own sample points. */
function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const median = (xs) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const quantile = (xs, q) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
};

/** Everything measured about one map's woods. */
function measure(level, eye) {
  const trees = level.trees;
  const grid = bucketTrees(trees);
  const kinds = Object.fromEntries(TREE_KINDS.map((k) => [k, 0]));
  const clumps = new Set();
  let inClumps = 0;
  for (const t of trees) {
    kinds[t.kind ?? "spruce"]++;
    if (t.clump !== undefined) {
      clumps.add(t.clump);
      inClumps++;
    }
  }
  // CLEAR: the narrowest gap under the crowns between two groups.
  const clears = [];
  let clear = Infinity;
  for (const t of trees) {
    const ct = crownOf(t, SKIER_H).r;
    for (const j of grid.near(t.x, t.z, 12)) {
      const u = trees[j];
      if (u === t || (t.clump !== undefined && u.clump === t.clump)) continue;
      if (u.x < t.x || (u.x === t.x && u.z <= t.z)) continue;
      const d = Math.hypot(u.x - t.x, u.z - t.z) - ct - crownOf(u, SKIER_H).r;
      clear = Math.min(clear, d);
      if (d < 6) clears.push(d);
    }
  }
  // SIGHT IN: from points inside a wood (three trees within 15 m, the point
  // itself clear of every crown), twenty-four rays each.
  const sightIn = [];
  let points = 0;
  for (let k = 0; points < 240 && k < 20000; k++) {
    const x = level.size * (0.15 + 0.7 * hash(k, 1));
    const z = level.size * (0.15 + 0.7 * hash(k, 2));
    const near = grid.near(x, z, 15).filter((i) => Math.hypot(trees[i].x - x, trees[i].z - z) < 15);
    if (near.length < 3) continue;
    if (
      near.some((i) => Math.hypot(trees[i].x - x, trees[i].z - z) < crownOf(trees[i], eye).r + 0.5)
    ) {
      continue;
    }
    points++;
    for (let a = 0; a < 24; a++) {
      const ang = ((a + hash(k, 3)) / 24) * Math.PI * 2;
      sightIn.push(sightFrom(level, grid, x, z, Math.cos(ang), Math.sin(ang), eye));
    }
  }
  // SIGHT OUT: from the track's edges, into the woods either side.
  const sightOut = [];
  const pts = level.track.points;
  const every = Math.max(1, Math.round(25 / (level.track.length / pts.length)));
  for (let i = 0; i < pts.length; i += every) {
    const p = pts[i];
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    for (const side of [-1, 1]) {
      const ex = p.x + rx * side * (p.width / 2 + 2);
      const ez = p.z + rz * side * (p.width / 2 + 2);
      for (const off of [-0.35, 0, 0.35]) {
        const c = Math.cos(off);
        const s = Math.sin(off) * side;
        const dx = rx * side * c - rz * s;
        const dz = rz * side * c + rx * s;
        sightOut.push(sightFrom(level, grid, ex, ez, dx, dz, eye));
      }
    }
  }
  return {
    trees: trees.length,
    kinds,
    clumps: clumps.size,
    inClumps,
    clear,
    clearP5: quantile(clears, 0.05),
    sightIn: median(sightIn),
    sightInP25: quantile(sightIn, 0.25),
    sightOut: median(sightOut),
    points,
    grid,
  };
}

/** Where to look: the stretch of track with the most trees within half a
 * window of it. */
function woodiest(level, grid, half) {
  let best = { x: level.size / 2, z: level.size / 2, n: -1 };
  const pts = level.track.points;
  for (let i = 0; i < pts.length; i += 25) {
    const p = pts[i];
    const n = grid.near(p.x, p.z, half).length;
    if (n > best.n) best = { x: p.x, z: p.z, n };
  }
  return best;
}

/** One panel: the window drawn at `scale`, onto `d` at (ox, oy). */
function drawPanel(d, ox, oy, level, m, centre, win, scale, eye, title) {
  const px = Math.round(win * scale);
  const x0 = centre.x - win / 2;
  const z0 = centre.z - win / 2;
  const toPx = (x, z) => [ox + (x - x0) * scale, oy + (z - z0) * scale];
  // The snow, hill-shaded, and the packed track greyed in.
  for (let j = 0; j < px; j += 2) {
    for (let i = 0; i < px; i += 2) {
      const x = x0 + i / scale;
      const z = z0 + j / scale;
      const e = 1.5;
      const gx = level.groundAt(x + e, z) - level.groundAt(x - e, z);
      const gz = level.groundAt(x, z + e) - level.groundAt(x, z - e);
      const shade = Math.max(0.55, Math.min(1.05, 0.9 - (gx * 0.6 + gz * 0.4) * 0.35));
      const packed = level.packedAt(x, z);
      const base = [236 * shade, 240 * shade, 246 * shade];
      const c = base.map((v, k) =>
        Math.min(255, Math.max(0, v + (INK.track[k] - v) * packed * 0.6)),
      );
      d.fillRect(ox + i, oy + j, 2, 2, c);
    }
  }
  // Which open snow a skier can reach from the window's edge: a 1 m grid,
  // blocked where a crown at a skier's height (plus his half-width) stands.
  const n = Math.round(win);
  const blocked = new Uint8Array(n * n);
  for (const i of m.grid.near(centre.x, centre.z, win * 0.75)) {
    const t = level.trees[i];
    const r = Math.max(t.radius, crownOf(t, SKIER_H).r) + SKIER_HALF;
    for (let gz = Math.floor(t.z - z0 - r); gz <= Math.ceil(t.z - z0 + r); gz++) {
      for (let gx = Math.floor(t.x - x0 - r); gx <= Math.ceil(t.x - x0 + r); gx++) {
        if (gx < 0 || gz < 0 || gx >= n || gz >= n) continue;
        if (Math.hypot(gx + 0.5 - (t.x - x0), gz + 0.5 - (t.z - z0)) < r) blocked[gz * n + gx] = 1;
      }
    }
  }
  const reached = new Uint8Array(n * n);
  const queue = [];
  for (let k = 0; k < n; k++) {
    for (const [gx, gz] of [
      [k, 0],
      [k, n - 1],
      [0, k],
      [n - 1, k],
    ]) {
      const c = gz * n + gx;
      if (!blocked[c] && !reached[c]) {
        reached[c] = 1;
        queue.push(c);
      }
    }
  }
  while (queue.length) {
    const c = queue.pop();
    const gx = c % n;
    const gz = (c - gx) / n;
    for (const [ax, az] of [
      [gx + 1, gz],
      [gx - 1, gz],
      [gx, gz + 1],
      [gx, gz - 1],
    ]) {
      if (ax < 0 || az < 0 || ax >= n || az >= n) continue;
      const q = az * n + ax;
      if (blocked[q] || reached[q]) continue;
      reached[q] = 1;
      queue.push(q);
    }
  }
  let open = 0;
  let sealed = 0;
  for (let c = 0; c < n * n; c++) {
    if (blocked[c]) continue;
    open++;
    if (!reached[c]) {
      sealed++;
      const gx = c % n;
      d.fillRect(ox + gx * scale, oy + ((c - gx) / n) * scale, scale, scale, INK.sealed);
    }
  }
  // The trees: the full spread faint, the crown at the eye solid by kind.
  const inWin = m.grid
    .near(centre.x, centre.z, win * 0.75)
    .map((i) => level.trees[i])
    .filter(
      (t) => Math.abs(t.x - centre.x) < win / 2 - 2 && Math.abs(t.z - centre.z) < win / 2 - 2,
    );
  for (const t of inWin) {
    const [cx, cy] = toPx(t.x, t.z);
    const ink = KIND_INK[t.kind ?? "spruce"];
    d.disk(cx, cy, t.crown * 0.95 * scale, [...ink, 60]);
  }
  for (const t of inWin) {
    const [cx, cy] = toPx(t.x, t.z);
    const ink = KIND_INK[t.kind ?? "spruce"];
    const c = crownOf(t, level.groundAt(t.x, t.z) + eye - t.y);
    if (c.r > 0.05) d.disk(cx, cy, c.r * scale, [...ink, Math.round(90 + 150 * c.solid)]);
    d.disk(cx, cy, Math.max(1.2, t.radius * scale), [40, 28, 20]);
  }
  // The clumps tied to their middles.
  const byClump = new Map();
  for (const t of inWin) {
    if (t.clump === undefined) continue;
    const list = byClump.get(t.clump) ?? [];
    list.push(t);
    byClump.set(t.clump, list);
  }
  for (const list of byClump.values()) {
    const mx = list.reduce((a, t) => a + t.x, 0) / list.length;
    const mz = list.reduce((a, t) => a + t.z, 0) / list.length;
    const [cx, cy] = toPx(mx, mz);
    for (const t of list) {
      const [tx, ty] = toPx(t.x, t.z);
      d.line(cx, cy, tx, ty, INK.clump, 1);
    }
  }
  // Sight rays from the window's middle, if it is not inside a crown.
  for (let a = 0; a < 32; a++) {
    const ang = (a / 32) * Math.PI * 2;
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    // Clipped at the window's edge.
    const edge = Math.min(Math.abs(win / 2 / (dx || 1e-9)), Math.abs(win / 2 / (dz || 1e-9)));
    const s = Math.min(edge, sightFrom(level, m.grid, centre.x, centre.z, dx, dz, eye));
    const [ax, ay] = toPx(centre.x, centre.z);
    const [bx, by] = toPx(centre.x + Math.cos(ang) * s, centre.z + Math.sin(ang) * s);
    d.line(ax, ay, bx, by, INK.ray, 1);
  }
  d.text(title, ox + 6, oy + 6, [20, 26, 34], 2);
  // A 50 m scale bar.
  d.fillRect(ox + 8, oy + px - 14, 50 * scale, 4, [20, 26, 34]);
  d.text("50 M", ox + 12 + 50 * scale, oy + px - 18, [20, 26, 34], 1);
  return { sealed: open > 0 ? sealed / open : 0 };
}

const f = (v, digits = 1) => (Number.isFinite(v) ? v.toFixed(digits) : "-");
const header =
  "seed    ver  trees  clumps  in-clump  clear  clr-p5  sight-in  p25   sight-out  mix";
const row = (seed, version, m) =>
  `${String(seed).padEnd(7)} ${String(version).padStart(3)} ${String(m.trees).padStart(6)} ` +
  `${String(m.clumps).padStart(7)} ${f((100 * m.inClumps) / Math.max(1, m.trees), 0).padStart(7)}% ` +
  `${f(m.clear).padStart(6)} ${f(m.clearP5).padStart(7)} ${f(m.sightIn).padStart(9)} ${f(m.sightInP25).padStart(5)} ` +
  `${f(m.sightOut).padStart(10)}  ` +
  TREE_KINDS.filter((k) => m.kinds[k] > 0)
    .map((k) => `${k} ${f((100 * m.kinds[k]) / Math.max(1, m.trees), 0)}%`)
    .join(" ");

const current = args.version || CURRENT_GENERATOR_VERSION;
const versions = [current];
mkdirSync(join(root, "previews"), { recursive: true });

console.log(`forest — ${args.region}, eye ${args.eye} m`);
console.log(header);
const sums = new Map();
for (let s = args.seed; s < args.seed + args.count; s++) {
  const built = versions.map((version) => {
    const level = generateLevel(s, { region: args.region, version });
    const analysis = analyzeLevel(level);
    const errors = analysis.findings.filter((x) => x.severity === "error");
    const m = measure(level, args.eye);
    console.log(
      row(s, version, m) + (errors.length ? `  ! ${errors.map((e) => e.message).join("; ")}` : ""),
    );
    const acc = sums.get(version) ?? [];
    acc.push(m);
    sums.set(version, acc);
    return { level, m, version };
  });
  if (args.count > 1) continue;
  // The picture.
  const first = built[built.length - 1];
  let centre;
  if (args.at) {
    const [x, z] = args.at.split(",").map(Number);
    centre = { x, z };
  } else {
    centre = woodiest(first.level, first.m.grid, args.window / 2);
  }
  const panel = Math.round(args.window * args.scale);
  const pad = 12;
  const foot = 70;
  const d = createDrawing(built.length * (panel + pad) + pad, panel + pad * 2 + foot, INK.bg);
  built.forEach((b, k) => {
    const ox = pad + k * (panel + pad);
    const { sealed } = drawPanel(
      d,
      ox,
      pad,
      b.level,
      b.m,
      centre,
      args.window,
      args.scale,
      args.eye,
      `SEED ${s} V${b.version}`,
    );
    const lines = [
      `TREES ${b.m.trees}  CLUMPS ${b.m.clumps}  CLEAR ${f(b.m.clear)} M  SEALED ${f(100 * sealed, 2)}%`,
      `SIGHT IN ${f(b.m.sightIn)} M  SIGHT OUT ${f(b.m.sightOut)} M  (EYE ${args.eye} M)`,
      TREE_KINDS.filter((kk) => b.m.kinds[kk] > 0)
        .map((kk) => `${kk} ${f((100 * b.m.kinds[kk]) / b.m.trees, 0)}%`)
        .join("  "),
    ];
    lines.forEach((line, i) => d.text(line, ox, pad + panel + 10 + i * 18, INK.text, 2));
  });
  const name = args.out || `forest-${s}${args.region === "alpine" ? "" : `-${args.region}`}`;
  const file = join(root, "previews", `${name}.png`);
  writeFileSync(file, d.toPng());
  console.log(`${file.replace(`${root}/`, "")}  (window at ${f(centre.x, 0)},${f(centre.z, 0)})`);
}
if (args.count > 1) {
  for (const [version, ms] of sums) {
    const mean = (k) => ms.reduce((a, m) => a + m[k], 0) / ms.length;
    console.log(
      `mean v${version}: trees ${f(mean("trees"), 0)}, clumps ${f(mean("clumps"), 0)}, ` +
        `clear min ${f(Math.min(...ms.map((m) => m.clear)))} m, sight in ${f(mean("sightIn"))} m, ` +
        `sight out ${f(mean("sightOut"))} m`,
    );
  }
}

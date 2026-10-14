#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STEERING LAB (`make bike-steer`): the downhill bike's answer to its
// bars, ridden by the REAL bodies in pure Node (`tests/support/bike-steer.ts`):
// for every speed and throw of the bars, the countersteer's dip, the time
// until the turn is FELT (3° of heading) and MADE (90 % of its yaw rate), the
// radius and lean it settles at, and the FLIP MAP — which turns are ridden
// and which throw him and how. Prints the table, draws previews/bike-steer.png
// (the radius against speed, the time to feel the turn, and the flip map),
// and keeps a --json for a --compare after.
//
//   node scripts/bike-steer-lab.mjs [--raw] [--json=FILE] [--compare=FILE] [--out=PNG]

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    raw: { kind: "flag", default: false, help: "ride with the assist off" },
    json: { kind: "string", default: "", help: "write the table to this file" },
    compare: { kind: "string", default: "", help: "a kept --json to print beside this run" },
    out: { kind: "string", default: "previews/bike-steer.png", help: "the chart" },
  },
  "usage: node scripts/bike-steer-lab.mjs [--raw] [--json=FILE] [--compare=FILE] [--out=PNG]",
);

aliasEngine(root);
const { flipMap, SPEEDS, THROWS, RIDDEN, RAW } = await import(
  join(root, "tests/support/bike-steer.ts")
);

const rows = flipMap(args.raw ? RAW : RIDDEN);
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const was = (r) => before?.rows.find((b) => b.v === r.v && b.steer === r.steer);

const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "-");
const pad = (s, n) => String(s).padStart(n);
console.log(
  `THE BARS (${args.raw ? "assist off" : "assist on"})${before ? "   [before → after]" : ""}`,
);
console.log(
  `${pad("km/h", 5)} ${pad("bars", 5)} ${pad("dip°", 6)} ${pad("felt s", 12)} ${pad("made s", 12)} ${pad("R m", 14)} ${pad("lean°", 12)}  down`,
);
const two = (r, key, d) => {
  const b = was(r);
  return b ? `${f(b[key], d)}→${f(r[key], d)}` : f(r[key], d);
};
for (const r of rows) {
  const b = was(r);
  const down = r.crash ? `${r.crash} ${f(r.crashAt, 1)}s` : "";
  const downB = b ? (b.crash ? `${b.crash}` : "ok") + " → " : "";
  console.log(
    `${pad((r.v * 3.6).toFixed(0), 5)} ${pad(r.steer.toFixed(1), 5)} ${pad(two(r, "dip", 1), 6)} ${pad(two(r, "felt"), 12)} ${pad(two(r, "made"), 12)} ${pad(two(r, "radius", 1), 14)} ${pad(two(r, "lean", 0), 12)}  ${downB}${down || (b ? "ok" : "")}`,
  );
}

if (args.json) writeFileSync(args.json, JSON.stringify({ rows }, null, 1));

// ---- the chart ----
const W = 1240;
const H = 560;
const INK = {
  bg: [18, 20, 26],
  text: [230, 232, 236],
  dim: [130, 136, 150],
  grid: [44, 48, 58],
  red: [232, 84, 72],
  amber: [236, 176, 64],
  green: [90, 196, 120],
};
const SHADES = [
  [96, 160, 240],
  [120, 200, 220],
  [140, 220, 160],
  [200, 220, 120],
  [236, 176, 64],
  [236, 120, 80],
  [220, 80, 140],
];
const d = createDrawing(W, H, INK.bg);
d.text(`DOWNHILL BIKE STEERING · ${args.raw ? "ASSIST OFF" : "ASSIST ON"}`, 12, 10, INK.text, 2);

function panel(x0, y0, w, h, title, xs, ys, xl, yl) {
  d.text(title, x0, y0 - 16, INK.text);
  d.rect(x0, y0, w, h, INK.grid);
  d.text(xl, x0 + w - 60, y0 + h + 14, INK.dim);
  d.text(yl, x0, y0 + h + 14, INK.dim);
  return {
    X: (v) => x0 + ((v - xs[0]) / (xs[1] - xs[0])) * w,
    Y: (v) => y0 + h - ((Math.min(Math.max(v, ys[0]), ys[1]) - ys[0]) / (ys[1] - ys[0])) * h,
  };
}
const kmh = SPEEDS.map((v) => v * 3.6);
const xs = [kmh[0] - 2, kmh[kmh.length - 1] + 2];

// The radius against speed, a line a throw.
const p1 = panel(30, 70, 340, 380, "SETTLED RADIUS, M (LOG)", xs, [0, 3], "km/h", "1 10 100 1000");
for (let k = 0; k <= 3; k++) d.line(30, p1.Y(k), 370, p1.Y(k), INK.grid);
THROWS.forEach((s, i) => {
  const pts = rows
    .filter((r) => r.steer === s && Number.isFinite(r.radius))
    .map((r) => [p1.X(r.v * 3.6), p1.Y(Math.log10(r.radius))]);
  if (pts.length > 1) d.polyline(pts, SHADES[i], 2);
  d.text(`bars ${s}`, 300, 80 + i * 12, SHADES[i]);
});

// The time until the turn bites (a quarter of its yaw rate), the kept
// run's beside it dimmed.
const p2 = panel(
  420,
  70,
  340,
  380,
  "TIME UNTIL THE TURN BITES, S",
  xs,
  [0, 1.5],
  "km/h",
  "0..1.5 s",
);
for (let k = 0; k <= 3; k++) d.line(420, p2.Y(k * 0.5), 760, p2.Y(k * 0.5), INK.grid);
const dimmed = (c) => c.map((x) => Math.round(x * 0.45 + 18 * 0.55));
for (const [set, dim] of [
  [before?.rows ?? [], true],
  [rows, false],
]) {
  THROWS.forEach((s, i) => {
    const pts = set
      .filter((r) => r.steer === s && Number.isFinite(r.bite))
      .map((r) => [p2.X(r.v * 3.6), p2.Y(r.bite)]);
    if (pts.length > 1) d.polyline(pts, dim ? dimmed(SHADES[i]) : SHADES[i], dim ? 1 : 2);
  });
}
if (before) d.text("dim: before", 680, 80, INK.dim);

// The flip map.
d.text("FLIP MAP (GREEN RIDDEN, RED DOWN)", 810, 54, INK.text);
const CW = 48;
const CH = 52;
THROWS.forEach((s, i) => d.text(`${s}`, 870 + i * CW + 14, 74, INK.dim));
SPEEDS.forEach((v, j) => {
  d.text(`${(v * 3.6).toFixed(0)}`, 820, 96 + j * CH + 18, INK.dim);
  THROWS.forEach((s, i) => {
    const r = rows.find((q) => q.v === v && q.steer === s);
    const x = 870 + i * CW;
    const y = 90 + j * CH;
    d.fillRect(x, y, CW - 3, CH - 3, r.crash ? INK.red : INK.green);
    d.text(r.crash ? r.crash.slice(0, 7) : `${f(r.radius, 0)}m`, x + 4, y + 12, INK.bg);
    if (!r.crash) d.text(`${f(r.lean, 0)}deg`, x + 4, y + 28, INK.bg);
  });
});
d.text("rows km/h, columns bars", 820, 90 + SPEEDS.length * CH + 6, INK.dim);
mkdirSync(dirname(join(root, args.out)), { recursive: true });
writeFileSync(join(root, args.out), d.toPng());
console.log(`\nwrote ${args.out}`);

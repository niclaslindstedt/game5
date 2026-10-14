#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FALL LAB (`make falls`): what a fall from a height does to a skier,
// by the height, the steepness of the snow he meets, what that snow is and
// how he meets it — on his skis landed true, on his skis landed crooked,
// or thrown on his back, his side, his head or his seat. Every cell is a
// case of `tests/support/fall-matrix.ts` drawn many times with the
// INJURIES switch on: how often he DIED, the median worst AIS and the
// median injury severity score. `tests/fall_lab_test.ts` holds its corners.
//
// A table on the terminal (a panel a snow and a landing, a row a height, a
// column a slope: `dead% AIS/ISS`), and a chart (previews/falls.png): the
// same panels as heat maps, a cell red as he dies in it and amber as hurt.
//
//   make falls                                   the whole matrix
//   make falls ARGS="--grounds=groomed --how=feet,back"
//   make falls ARGS="--heights=5,10,20 --slopes=0,30"
//   make falls ARGS="--json=previews/falls-before.json"
//   make falls ARGS="--compare=previews/falls-before.json"
//
// Pure Node: the engine at 120 Hz, no renderer.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { createDrawing } from "@niclaslindstedt/oss-game-framework/tooling/draw";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);
const F = await import(join(root, "tests/support/fall-matrix.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    heights: { kind: "string", default: "3,5,8,10,12,15,20,25,30,40", help: "drop heights, m" },
    slopes: { kind: "string", default: "0,15,25,35,45", help: "the snow's steepness, degrees" },
    grounds: { kind: "string", default: "powder,soft,groomed,ice", help: "the snows" },
    how: { kind: "string", default: "feet,crooked,back,side,head", help: "the landings" },
    along: { kind: "number", default: 5, help: "speed across the ground, m/s" },
    trials: { kind: "number", default: F.FALL_TRIALS, help: "trials a cell" },
    json: { kind: "string", help: "write the matrix to this file (a baseline)" },
    compare: { kind: "string", help: "a baseline to print beside this run" },
    out: { kind: "string", default: "previews/falls.png", help: "the chart" },
  },
  "usage: make falls ARGS='[--heights a,b] [--slopes a,b] [--grounds g] [--how h] [--json f] [--compare f]'",
);

const list = (s, num) => s.split(",").map((x) => (num ? Number(x) : x.trim()));
const heights = list(args.heights, true);
const slopes = list(args.slopes, true);
const grounds = list(args.grounds);
const hows = list(args.how);
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;

const key = (ground, how, height, slope) => `${ground}|${how}|${height}|${slope}`;
const out = {};
for (const ground of grounds)
  for (const how of hows)
    for (const height of heights)
      for (const slope of slopes) {
        const r = F.fallRates({ height, slope, ground, how, along: args.along }, args.trials);
        out[key(ground, how, height, slope)] = r;
      }

const cell = (r) =>
  r
    ? `${String(Math.round(r.dead * 100)).padStart(3)}% ${r.worst}/${String(r.iss).padStart(2)}`
    : "";
for (const ground of grounds)
  for (const how of hows) {
    console.log(
      `\n${ground.toUpperCase()} · ${how}   (dead% AIS/ISS${before ? "   [before]" : ""})`,
    );
    console.log(`  h m  ${slopes.map((s) => `${s}°`.padStart(before ? 26 : 12)).join("")}`);
    for (const height of heights) {
      const row = slopes.map((slope) => {
        const k = key(ground, how, height, slope);
        const now = cell(out[k]).padStart(12);
        return before ? `${now} [${cell(before[k]).padStart(11)}]` : now;
      });
      console.log(`  ${String(height).padStart(3)}  ${row.join("")}`);
    }
  }

if (args.json) {
  mkdirSync(dirname(join(root, args.json)), { recursive: true });
  writeFileSync(join(root, args.json), JSON.stringify(out, null, 1));
  console.log(`\nwrote ${args.json}`);
}

// THE CHART: a panel a snow (rows) and a landing (columns), a cell a
// height (down) and a slope (across).
const CW = 44;
const CH = 18;
const PAD = 40;
const PW = PAD + slopes.length * CW + 16;
const PH = 34 + heights.length * CH + 12;
const W = 120 + hows.length * PW;
const H = 60 + grounds.length * PH;
const INK = { bg: [16, 19, 26], text: [226, 230, 238], dim: [140, 148, 160] };
const d = createDrawing(W, H, INK.bg);
d.text("FALLS FROM A HEIGHT · DEATH RATE (RED) AND WORST AIS (AMBER)", 12, 10, INK.text, 2);
d.text("rows: drop height, m · columns: the snow's slope · cell: dead% and AIS", 12, 32, INK.dim);
const colour = (r) => {
  const hurt = Math.min(1, r.worst / 5);
  const base = [30 + 150 * hurt, 34 + 110 * hurt, 44 - 10 * hurt];
  const red = [200, 30, 40];
  return base.map((c, i) => Math.round(c + (red[i] - c) * r.dead));
};
grounds.forEach((ground, gi) => {
  const y0 = 60 + gi * PH;
  d.text(ground.toUpperCase(), 12, y0 + 30, INK.text, 2);
  hows.forEach((how, hi) => {
    const x0 = 120 + hi * PW;
    d.text(how.toUpperCase(), x0 + PAD, y0, INK.text);
    slopes.forEach((s, si) => d.text(`${s}°`, x0 + PAD + si * CW + 10, y0 + 14, INK.dim));
    heights.forEach((h, ri) => {
      const y = y0 + 26 + ri * CH;
      d.text(`${h}`, x0 + 10, y + 5, INK.dim);
      slopes.forEach((s, si) => {
        const r = out[key(ground, how, h, s)];
        const x = x0 + PAD + si * CW;
        d.fillRect(x, y, CW - 2, CH - 2, colour(r));
        d.text(r.dead > 0 ? `${Math.round(r.dead * 100)}%` : `${r.worst}`, x + 6, y + 5, INK.text);
      });
    });
  });
});
mkdirSync(dirname(join(root, args.out)), { recursive: true });
writeFileSync(join(root, args.out), d.toPng());
console.log(`wrote ${args.out}`);

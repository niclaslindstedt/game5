#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE TURN LAB (`make sled-turn`): every turn of
// `tests/support/sled-turns.ts` — the sled held at a speed on the flat, on
// the groomer and in powder, the bars at full lock — ridden by the REAL
// ENGINE, pure Node, seconds. One row a turn: the band a rider expects,
// the radius of the circle it settled on, the sideways pull that took, the
// time to turn through 90°, the way on through the turn, the most it rolled
// and whether it threw him. A row outside its band, or thrown, is marked
// `✗`, and the lab exits non-zero.
//
//   node scripts/sled-turn-lab.mjs [--only=id,id] [--left] [--json=FILE] [--compare=FILE]

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    only: { kind: "string", default: "", help: "the turns to run, by id, comma-separated" },
    left: { kind: "boolean", default: false, help: "turn to the left (the right by default)" },
    json: { kind: "string", default: "", help: "write the table to this file" },
    compare: { kind: "string", default: "", help: "a kept --json to print beside this run" },
  },
  "usage: node scripts/sled-turn-lab.mjs [--only=id,id] [--left] [--json=FILE] [--compare=FILE]",
);

aliasEngine(root);
const L = await import(join(root, "tests/support/sled-turns.ts"));

const only = args.only ? new Set(args.only.split(",")) : null;
const rows = L.SLED_TURNS.filter((r) => !only || only.has(r.id));
const kept = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const was = new Map((kept ?? []).map((r) => [r.id, r]));

const pad = (s, n) => String(s).padEnd(n);
const num = (v, d = 1) => v.toFixed(d).padStart(5);

const out = [];
let wrong = 0;
console.log(
  `${pad("turn", 12)} ${pad("wants m", 8)}  radius ${kept ? "before " : ""} pull g  90° s  km/h  roll  what`,
);
for (const row of rows) {
  const r = L.rideTurn(row, args.left ? -1 : 1);
  out.push(r);
  const ok = !r.thrown && r.quarter > 0 && r.radius >= row.radius[0] && r.radius <= row.radius[1];
  if (!ok) wrong++;
  const before = was.get(row.id);
  console.log(
    `${ok ? " " : "✗"}${pad(row.id, 11)} ${pad(`${row.radius[0]}–${row.radius[1]}`, 8)}  ${num(r.radius)} ${kept ? (before ? num(before.radius) : "    -") + "  " : ""} ${num(r.pull, 2)}  ${num(r.quarter, 2)} ${num(r.kmh, 0)} ${num(r.roll, 0)}  ${row.what}${r.thrown ? " — THROWN" : ""}`,
  );
}
console.log(`\n${rows.length - wrong} of ${rows.length} turns came out inside their bands.`);
if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 2));
if (wrong) process.exitCode = 1;

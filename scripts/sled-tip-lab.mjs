#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE ROLLOVER LAB (`make sled-tip`): every row of
// `tests/support/sled-tips.ts` — a turn held, flicked, a slalom of locks and
// full throttle at full lock on the flat, and a traverse into or off a 20°
// and a 30° face — on the groomer and in powder from a thin cover to
// bottomless, from a crawl to 80 km/h, ridden by the REAL ENGINE, pure Node.
// One row a ride: what a rider expects (UP, OVER, or either), whether it
// threw him and when, the most it rolled off the snow's plane and the way
// on. A row whose outcome is not the one expected is marked `✗`, and the
// lab exits non-zero.
//
//   node scripts/sled-tip-lab.mjs [--only=id,id] [--surface=deep] [--json=FILE] [--compare=FILE]

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
    only: { kind: "string", default: "", help: "the rows to ride, by id, comma-separated" },
    surface: {
      kind: "string",
      default: "",
      help: "only this surface (groomer, thin, powder, deep, bottomless)",
    },
    json: { kind: "string", default: "", help: "write the table to this file" },
    compare: { kind: "string", default: "", help: "a kept --json to print beside this run" },
  },
  "usage: node scripts/sled-tip-lab.mjs [--only=id,id] [--surface=deep] [--json=FILE] [--compare=FILE]",
);

aliasEngine(root);
const L = await import(join(root, "tests/support/sled-tips.ts"));

const only = args.only ? new Set(args.only.split(",")) : null;
const rows = L.SLED_TIPS.filter(
  (r) => (!only || only.has(r.id)) && (!args.surface || r.surface === args.surface),
);
const kept = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const was = new Map((kept ?? []).map((r) => [r.id, r]));

const pad = (s, n) => String(s).padEnd(n);
const num = (v, d = 0) => v.toFixed(d).padStart(4);
const fate = (r) => (r.thrown >= 0 ? `OVER ${r.thrown.toFixed(1)}s` : "up");

const out = [];
let wrong = 0;
let over = 0;
console.log(
  `${pad("ride", 26)} ${pad("wants", 6)} ${pad("did", 10)} ${kept ? pad("before", 10) + " " : ""}roll° km/h  what`,
);
for (const row of rows) {
  const r = L.rideTip(row);
  out.push(r);
  const ok = L.tipOk(row, r);
  if (!ok) wrong++;
  if (r.thrown >= 0) over++;
  const before = was.get(row.id);
  const slope = row.slope ? ` across ${row.slope}°` : "";
  console.log(
    `${ok ? " " : "✗"}${pad(row.id, 25)} ${pad(row.wants, 6)} ${pad(fate(r), 10)} ${kept ? pad(before ? fate(before) : "-", 10) + " " : ""}${num(r.roll)} ${num(r.kmh)}  ${L.SLED_TIP_MOVES[row.move]}${slope}, ${row.surface} at ${row.kmh}`,
  );
}
console.log(
  `\n${rows.length - wrong} of ${rows.length} rides came out as a rider expects; ${over} went over.`,
);
if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 2));
if (wrong) process.exitCode = 1;

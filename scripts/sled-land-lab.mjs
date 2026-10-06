#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE LANDING LAB (`make sled-land`): every staged ride of
// `tests/support/sled-landings.ts` — rollers, whoops, hard turns, a
// sidehill, kickers onto the flat and onto a landing, the nose dropped or
// thrown back in the air, a lip banked hard, drops off a ledge, a cliff, a
// bank and a wall — ridden by the REAL ENGINE, pure Node, seconds. One row
// a ride: what a rider expects (RIDE it out, or THROWN), what happened, the
// longest flight, the hardest landing into the snow (m/s along its
// normal), the most it rolled and pitched, and the way on at the end. A row
// whose outcome is not the one expected is marked `✗`, and the lab exits
// non-zero.
//
//   node scripts/sled-land-lab.mjs [--only=id,id] [--json=FILE] [--compare=FILE]

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
    only: { kind: "string", default: "", help: "the rides to run, by id, comma-separated" },
    json: { kind: "string", default: "", help: "write the table to this file" },
    compare: { kind: "string", default: "", help: "a kept --json to print beside this run" },
  },
  "usage: node scripts/sled-land-lab.mjs [--only=id,id] [--json=FILE] [--compare=FILE]",
);

aliasEngine(root);
const L = await import(join(root, "tests/support/sled-landings.ts"));

const only = args.only ? new Set(args.only.split(",")) : null;
const rows = L.SLED_LANDINGS.filter((r) => !only || only.has(r.id));
const kept = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const was = new Map((kept ?? []).map((r) => [r.id, r]));

const said = (r) => (r.thrown ? `THROWN ${r.at.toFixed(1)}s` : "rode");
const pad = (s, n) => String(s).padEnd(n);
const num = (v, d = 1) => v.toFixed(d).padStart(5);

const out = [];
let wrong = 0;
console.log(
  `${pad("ride", 14)} ${pad("wants", 7)} ${pad("got", 12)} ${kept ? pad("before", 12) : ""}  air s  into  roll pitch  km/h  what`,
);
for (const row of rows) {
  const r = L.rideLanding(row);
  out.push(r);
  const ok = r.thrown === row.throws;
  if (!ok) wrong++;
  const before = was.get(row.id);
  console.log(
    `${ok ? " " : "✗"}${pad(row.id, 13)} ${pad(row.throws ? "THROWN" : "ride", 7)} ${pad(said(r), 12)} ${kept ? pad(before ? said(before) : "-", 12) : ""} ${num(r.air, 2)} ${num(r.impact)} ${num(r.roll, 0)} ${num(r.pitch, 0)} ${num(r.kmh, 0)}  ${row.what}`,
  );
}
console.log(`\n${rows.length - wrong} of ${rows.length} rides came out as a rider expects.`);
if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 2));
if (wrong > 0) process.exitCode = 1;

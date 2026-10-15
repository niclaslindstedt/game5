#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HURT BY HIS OWN BIKE (`make bike-tangle`): the downhill bike crashed again
// and again by the game's own step (`tests/support/bike-tangles.ts` — the
// rows `tests/bike_tangle_test.ts` samples): over the bars off a ledge and
// laid down at full lock on a steep meadow, at 20, 35, 50 and 65 km/h, each
// crash a few centimetres off the last, on a run with its INJURIES on. Each
// row prints what the bike did to him — the crashes it struck him in, the
// limbs it caught, the strikes dealt at the throw, the injuries taken under
// its blows, the pieces it tore off and the deaths — and the parts that did
// it. Pure Node.
//
//   node scripts/bike-tangle-lab.mjs [--only=id] [--runs=N] [--json=FILE] [--compare=FILE]

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
    only: { kind: "string", default: "", help: "rows to crash, by id, comma-separated" },
    runs: { kind: "number", default: 0, help: "crashes a row (default the row's own)" },
    json: { kind: "string", default: "", help: "write the table to this file" },
    compare: { kind: "string", default: "", help: "a kept --json to print beside this run" },
  },
  "usage: node scripts/bike-tangle-lab.mjs [--only=id] [--runs=N] [--json=FILE] [--compare=FILE]",
);

aliasEngine(root);
const { TANGLE_ROWS, runRow, sumRow } = await import(join(root, "tests/support/bike-tangles.ts"));

const only = args.only ? args.only.split(",").map((s) => s.trim()) : [];
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const kept = new Map((before?.rows ?? []).map((r) => [r.id, r]));

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const pct = (n, of) => `${lpad(((100 * n) / Math.max(1, of)).toFixed(0), 3)}%`;

console.log(
  `${pad("row", 8)} ${pad("what", 40)} ${lpad("crash", 5)} ${lpad("struck", 6)} ${lpad("hurt", 5)} ${lpad("caught", 6)} ${lpad("dealt", 6)} ${lpad("torn", 5)} ${lpad("died", 5)} ${lpad("yank", 5)}  parts${before ? "  (before: hurt caught torn)" : ""}`,
);
const out = { rows: [] };
for (const row of TANGLE_ROWS) {
  if (only.length && !only.includes(row.id)) continue;
  const r = args.runs > 0 ? { ...row, runs: args.runs } : row;
  const results = runRow(r);
  const s = sumRow(r, results);
  const torn = results.flatMap((x) => x.torn);
  const parts = Object.entries(s.parts)
    .map(([p, n]) => `${p} ${n}`)
    .join(", ");
  const was = kept.get(r.id);
  const beside = was
    ? `  (${pct(was.hurt, was.thrown)} ${pct(was.snagged, was.thrown)} ${pct(was.torn, was.thrown)})`
    : "";
  console.log(
    `${pad(r.id, 8)} ${pad(r.label, 40)} ${lpad(s.thrown, 5)} ${pct(s.hit, s.thrown)}  ${pct(s.hurt, s.thrown)}  ${pct(s.snagged, s.thrown)}  ${pct(s.struck, s.thrown)} ${pct(s.torn, s.thrown)} ${pct(s.died, s.thrown)} ${lpad(s.yank.toFixed(1), 5)}  ${parts || "—"}${torn.length ? ` · torn ${torn.join(", ")}` : ""}${beside}`,
  );
  out.rows.push(s);
}
if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 2));
console.log(
  "\nstruck: the bike's parts met his body · hurt: an injury under one of its blows · caught: a limb held in it · dealt: struck at the throw (bar end, stem, ring) · yank: the hardest snatch of a caught limb, m/s",
);

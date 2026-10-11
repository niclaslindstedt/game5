#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AVALANCHE LAB (`make avalanche-flow`): slabs released on the bench's
// LEE SLOPE (`tests/support/avalanche-scenes.ts` — a 38° powder face loaded
// by a wind down it under a steady snowfall, easing onto a flat run-out),
// stepped by the REAL ENGINE (`avalanche.ts`), pure Node. Three tables:
//
//   RELEASES — one slab a run seed, nobody on it: its width, length,
//     thickness and volume, the flow's fastest parcel at 2, 5, 10 and 20 s,
//     the fastest it ever ran, its run-out from the crown, how long it ran,
//     its parcels and their bytes, and what stepping it cost a step (ms).
//   LINES — a skier on each line of `AVALANCHE_LINES` through a slab let go
//     under him (straight down it, out of its flank, slow across, stopped,
//     in its path below, beside it): escaped, caught (when), buried (how
//     deep, how long his air is dealt), surfaced or untouched. A line that
//     does not come out as a skier on it should is marked `✗`, and the lab
//     exits non-zero.
//   TRIGGER — the metres a skier traverses the loaded face before it lets
//     go of its own, a run seed a ride.
//
//   node scripts/avalanche-lab.mjs [--seeds=1..8] [--only=id,id] [--wind=12] [--fall=0.5]
//                                  [--json=FILE] [--compare=FILE]

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
    seeds: {
      kind: "string",
      default: "1..8",
      help: "run seeds for the releases and the trigger (a..b or a,b,c)",
    },
    only: { kind: "string", default: "", help: "the skier lines to ride, by id, comma-separated" },
    wind: { kind: "number", default: 12, help: "the wind down the face, m/s" },
    fall: { kind: "number", default: 0.5, help: "the sky's snowfall, 0..1" },
    json: { kind: "string", default: "", help: "write the tables to this file" },
    compare: { kind: "string", default: "", help: "a kept --json to print beside this run" },
  },
  "usage: node scripts/avalanche-lab.mjs [--seeds=1..8] [--only=id,id] [--wind=12] [--fall=0.5] [--json=FILE] [--compare=FILE]",
);

aliasEngine(root);
const L = await import(join(root, "tests/support/avalanche-scenes.ts"));

function seedsOf(spec) {
  const m = /^(\d+)\.\.(\d+)$/.exec(spec);
  if (m) {
    const out = [];
    for (let s = Number(m[1]); s <= Number(m[2]); s++) out.push(s);
    return out;
  }
  return spec.split(",").map(Number);
}

const seeds = seedsOf(args.seeds);
const level = L.leeLevel(args.wind, args.fall);
const kept = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const pad = (s, n) => String(s).padEnd(n);
const num = (v, n = 6, d = 0) => (v < 0 ? "-" : v.toFixed(d)).padStart(n);

console.log(
  `avalanche lab — the bench's lee slope: 38° face, wind ${args.wind} m/s down it, snowfall ${args.fall}; ` +
    `release band ${L.BAND.rise}–${L.BAND.gone}°\n`,
);

// RELEASES
console.log("RELEASES (nobody on the slab)");
console.log(
  `${pad("seed", 8)} ${pad("wide", 6)} ${pad("long", 6)} ${pad("deep", 5)} ${pad("m³", 7)}  front@2  @5    @10   @20   top  run-out  ran s  cells   KB  ms/step`,
);
const releases = [];
for (const seed of seeds) {
  const r = L.flowAlone(seed, level);
  releases.push(r);
  const was = kept?.releases?.find((k) => k.id === r.id);
  console.log(
    `${pad(r.id, 8)} ${num(r.width)} ${num(r.length)} ${num(r.slabDepth, 5, 2)} ${num(r.volume, 7)}  ${r.front
      .map((v) => num(v * 3.6, 5))
      .join(
        " ",
      )} ${num(r.top * 3.6, 5)} ${num(r.runout, 7)} ${num(r.ran, 6, 1)} ${num(r.cells, 6)} ${num(
      r.bytes / 1024,
      4,
      1,
    )} ${num(r.cost, 8, 3)}${was ? `   (before: top ${num(was.top * 3.6, 0)} km/h, run-out ${num(was.runout, 0)} m)` : ""}`,
  );
}
console.log("  (speeds in km/h, lengths in m)\n");

// LINES
const only = args.only ? new Set(args.only.split(",")) : null;
const lines = L.AVALANCHE_LINES.filter((l) => l.release && (!only || only.has(l.id)));
console.log("LINES (a slab let go under or above him)");
console.log(
  `${pad("line", 10)} ${pad("wants", 10)} ${pad("did", 26)} ${kept ? pad("before", 26) + " " : ""}what`,
);
const fate = (r) =>
  r.outcome === "buried"
    ? `BURIED ${r.depth.toFixed(2)} m, ${r.air.toFixed(0)} s air`
    : r.outcome === "surfaced"
      ? `surfaced ${r.depth.toFixed(2)} m`
      : r.caughtAt >= 0
        ? `caught ${r.caughtAt.toFixed(1)} s`
        : r.outcome;
const rows = [];
let wrong = 0;
for (const line of lines) {
  const r = L.rideLine(line, 70, undefined, level);
  rows.push(r);
  const ok = L.lineOk(line, r);
  if (!ok) wrong++;
  const was = kept?.lines?.find((k) => k.id === r.id);
  const caught = r.caughtAt >= 0 ? ` (caught at ${r.caughtAt.toFixed(1)} s)` : "";
  console.log(
    `${ok ? " " : "✗"}${pad(line.id, 9)} ${pad(line.wants, 10)} ${pad(fate(r) + caught, 26)} ${kept ? pad(was ? fate(was) : "-", 26) + " " : ""}${line.what}`,
  );
}
console.log(
  `\n${lines.length - wrong} of ${lines.length} lines came out as a skier on them should.\n`,
);

// TRIGGER
const metres = L.triggerMetres(seeds, level);
const went = metres.filter((m) => m >= 0);
const mean = went.length ? went.reduce((a, b) => a + b, 0) / went.length : -1;
console.log("TRIGGER (traversing the loaded face until it lets go)");
console.log(
  `  metres a seed: ${metres.map((m) => (m < 0 ? "held" : m.toFixed(0))).join(", ")}  · mean ${mean < 0 ? "-" : mean.toFixed(0)} m over ${went.length} of ${metres.length}` +
    (kept?.trigger ? `  (before: mean ${kept.trigger.mean.toFixed(0)} m)` : ""),
);

if (args.json) {
  writeFileSync(
    args.json,
    JSON.stringify({ releases, lines: rows, trigger: { metres, mean } }, null, 2),
  );
}
if (wrong) process.exitCode = 1;

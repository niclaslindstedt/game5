#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE'S COLLISION LAB (`make bike-hit`): the downhill bike ridden by
// the game's own step into everything a summer mountain stands in its way
// (`tests/support/bike-hits.ts` — the same rows `tests/bike_hit_test.ts`
// holds): a trunk head-on and glancing at 10, 20 and 35 km/h, a rock garden,
// a lift tower, a mast, a building's wall, a parked car, the race line's
// tape, a bench's cut and fill, a steep meadow and a pond. Each row prints
// what came of it — thrown or not and how, the closing speed, the hardest
// blow and the injuries — and is held to what should (`✗` and the fault
// where not: a solid stood inside, a bike frozen while it threw him, a
// restart into a solid). Then the injuries of every throw summed by region,
// beside what riders in lift-served bike parks break. Pure Node; exits
// non-zero on a fault.
//
//   node scripts/bike-hit-lab.mjs [--only=id,group] [--json=FILE] [--compare=FILE]

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
    only: { kind: "string", default: "", help: "rows to ride, by id or group, comma-separated" },
    json: { kind: "string", default: "", help: "write the table to this file" },
    compare: { kind: "string", default: "", help: "a kept --json to print beside this run" },
  },
  "usage: node scripts/bike-hit-lab.mjs [--only=id,group] [--json=FILE] [--compare=FILE]",
);

aliasEngine(root);
const { HIT_ROWS, hitFaults } = await import(join(root, "tests/support/bike-hits.ts"));

const only = args.only ? args.only.split(",").map((s) => s.trim()) : [];
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const kept = new Map((before?.rows ?? []).map((r) => [r.id, r]));

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const f1 = (v) => (v === null || v === undefined ? "—" : v.toFixed(1));
const f2 = (v) => (v === null || v === undefined ? "—" : v.toFixed(2));

/** The injuries' region, as the bike-park surveys count them. */
const REGION = {
  head: "head & face",
  neck: "neck & spine",
  back: "neck & spine",
  shoulderL: "shoulder & collarbone",
  shoulderR: "shoulder & collarbone",
  chest: "trunk",
  belly: "trunk",
  pelvis: "trunk",
  armL: "arm, wrist & hand",
  armR: "arm, wrist & hand",
  wristL: "arm, wrist & hand",
  wristR: "arm, wrist & hand",
  handL: "arm, wrist & hand",
  handR: "arm, wrist & hand",
};

const out = { rows: [] };
let failed = 0;
const regions = {};
console.log(
  `${pad("row", 11)} ${pad("what", 44)} ${pad("thrown", 8)} ${lpad("hit m/s", 7)} ${lpad("g", 5)} ${pad("part", 10)} ${lpad("ISS", 4)} ${lpad("bike in", 7)} ${lpad("body in", 7)} ${lpad("bike on", 7)} ${lpad("went", 5)} ${lpad("restart", 7)}  injuries${before ? "  (before)" : ""}`,
);
let group = "";
for (const r of HIT_ROWS) {
  if (only.length && !only.includes(r.id) && !only.includes(r.group)) continue;
  if (r.group !== group) {
    group = r.group;
    console.log(`— ${group}`);
  }
  const t0 = performance.now();
  let res;
  try {
    res = r.run();
  } catch (err) {
    failed++;
    console.log(`${pad(r.id, 11)} ${pad(r.label, 44)} ✗ could not stage: ${err.message}`);
    continue;
  }
  const ms = performance.now() - t0;
  const faults = hitFaults(r, res);
  if (faults.length) failed++;
  if (res.thrown) {
    for (const i of res.injuries) {
      const part = i.split(":")[0];
      const key = REGION[part.replace(/[LR]$/, "")] ?? REGION[part] ?? "leg & knee";
      regions[key] = (regions[key] ?? 0) + 1;
    }
  }
  const was = kept.get(r.id);
  const beside = was
    ? `  (${was.thrown ? `thrown ${was.how ?? ""}` : "ridden"}, ${was.g.toFixed(0)} g${was.faults.length ? `, ✗ ${was.faults.join("; ")}` : ""})`
    : "";
  const thrown = res.thrown ? (res.how ?? "yes") : "no";
  const inj = res.injuries.map((i) => i.split(":").slice(1).join(" ")).join(", ");
  console.log(
    `${pad(r.id, 11)} ${pad(r.label, 44)} ${pad(thrown, 8)} ${lpad(f1(res.hit), 7)} ${lpad(res.g.toFixed(0), 5)} ${pad(res.part ?? "—", 10)} ${lpad(res.iss, 4)} ${lpad(f2(res.bikeIn > 0 ? res.bikeIn : 0), 7)} ${lpad(f2(res.riderIn), 7)} ${lpad(res.thrown ? f1(res.bikeOn) : "—", 7)} ${lpad(f1(res.went), 5)} ${lpad(res.restartIn === null ? "—" : f2(res.restartIn), 7)} ${faults.length ? `✗ ${faults.join("; ")} · ` : "  "}${inj || "none"}${beside}`,
  );
  out.rows.push({ id: r.id, group: r.group, ...res, faults, ms: Math.round(ms) });
}

console.log(
  "\n— the throws' injuries by region (lift-served parks: shoulder & collarbone 34%, arm 26%, head 17%)",
);
const total = Object.values(regions).reduce((a, b) => a + b, 0);
for (const [k, n] of Object.entries(regions).sort((a, b) => b[1] - a[1])) {
  console.log(
    `${pad(k, 24)} ${lpad(n, 3)}  ${lpad(((100 * n) / Math.max(1, total)).toFixed(0), 3)}%`,
  );
}
out.regions = regions;

if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 2));
console.log(`\n${failed === 0 ? "every row as it should be" : `${failed} row(s) at fault`}`);
process.exit(failed === 0 ? 0 : 1);

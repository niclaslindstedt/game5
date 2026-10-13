#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE LAB (`make bike-ride`): the downhill bike (`bike-body.ts`) ridden
// by the REAL bodies, pure Node, through every row `docs/downhill-bike.md`'s
// evals name (`tests/support/bike-rides.ts` — the same rows the suite holds):
// the sag, the coast and the rolling resistance on each surface, the pedals,
// the brakes and the endo, the lean in a turn and the radius at full bars,
// the weave and the capsize with the hands off, the drops, the 6 m table
// landed, cased and overshot, the roots and the rocks, a berm and a bunny
// hop — each against its band, `✗` where it falls outside (the lab then exits
// non-zero). With `--bot`, the bot (`bike-pilot.ts`) rides every trail of a
// summer map's bike park from its head to its foot on each seed
// (`tests/support/bike-bot.ts`; a map takes some 25 s to build).
//
//   node scripts/bike-ride-lab.mjs [--only=id,group] [--bot] [--seeds=38,7]
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
    only: { kind: "string", default: "", help: "rows to ride, by id or group, comma-separated" },
    bot: {
      kind: "flag",
      default: false,
      help: "also ride the bot down every trail of the seeds' parks",
    },
    seeds: {
      kind: "string",
      default: "38,7",
      help: "the summer maps the bot rides (comma-separated)",
    },
    json: { kind: "string", default: "", help: "write the table to this file" },
    compare: { kind: "string", default: "", help: "a kept --json to print beside this run" },
  },
  "usage: node scripts/bike-ride-lab.mjs [--only=id,group] [--bot] [--seeds=38,7] [--json=FILE] [--compare=FILE]",
);

aliasEngine(root);
const { BIKE_ROWS, rowPasses } = await import(join(root, "tests/support/bike-rides.ts"));

const only = args.only ? args.only.split(",").map((s) => s.trim()) : [];
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const kept = new Map((before?.rows ?? []).map((r) => [r.id, r]));

const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);
const fmt = (v) =>
  Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);

const out = { rows: [], bot: [] };
let failed = 0;
console.log(
  `${pad("row", 22)} ${pad("what", 58)} ${lpad("value", 8)} ${pad("", 5)} ${pad("band", 12)} ${pad("", 2)} note${before ? "  (before)" : ""}`,
);
let group = "";
for (const r of BIKE_ROWS) {
  if (only.length && !only.includes(r.id) && !only.includes(r.group)) continue;
  if (r.group !== group) {
    group = r.group;
    console.log(`— ${group}`);
  }
  const t0 = performance.now();
  const res = r.run();
  const ms = performance.now() - t0;
  const ok = rowPasses(r, res);
  if (!ok) failed++;
  const band = r.band ? `${r.band[0]}–${r.band[1]}` : "";
  const was = kept.get(r.id);
  const beside = was ? `  (${fmt(was.value)}${was.ok ? "" : " ✗"})` : "";
  console.log(
    `${pad(r.id, 22)} ${pad(r.label, 58)} ${lpad(fmt(res.value), 8)} ${pad(r.unit, 5)} ${pad(band, 12)} ${ok ? "  " : "✗ "}${res.note ?? ""}${beside}`,
  );
  out.rows.push({
    id: r.id,
    group: r.group,
    value: res.value,
    note: res.note ?? "",
    ok,
    ms: Math.round(ms),
  });
}

if (args.bot) {
  const { parkTrails, rideTrail, botPasses, BOT_FALLS } = await import(
    join(root, "tests/support/bike-bot.ts")
  );
  const seeds = args.seeds.split(",").map((s) => Number(s.trim()));
  const keptBot = new Map((before?.bot ?? []).map((r) => [`${r.seed}:${r.trail}`, r]));
  console.log("\n— the bot down every trail (home, and its falls a km inside its grade's band)");
  console.log(
    `${pad("seed", 5)} ${pad("trail", 6)} ${pad("grade", 6)} ${lpad("length", 7)} ${lpad("time s", 7)} ${lpad("mean", 6)} ${lpad("top", 6)} ${lpad("air", 4)} ${lpad("long s", 6)} ${lpad("hard g", 6)} ${lpad("falls", 6)} ${lpad("/km", 5)} ${pad("band", 6)} ${pad("home", 5)} landings · falls${before ? "  (before)" : ""}`,
  );
  for (const seed of seeds) {
    for (const t of parkTrails(seed)) {
      const r = rideTrail(seed, t.id);
      const perKm = r.crashes.length / Math.max(0.1, r.reached / 1000);
      const ok = botPasses(r);
      if (!ok) failed++;
      const band = BOT_FALLS[r.kind === "race" ? "race" : r.grade];
      const lands = Object.entries(r.landings)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${k} ${n}`)
        .join(", ");
      const how = {};
      for (const c of r.crashes) how[c] = (how[c] ?? 0) + 1;
      const falls = Object.entries(how)
        .map(([k, n]) => `${k} ${n}`)
        .join(", ");
      const was = keptBot.get(`${seed}:${t.id}`);
      const beside = was ? `  (${was.home ? "home" : "NOT home"}, ${was.perKm.toFixed(1)}/km)` : "";
      console.log(
        `${pad(seed, 5)} ${pad(r.trail, 6)} ${pad(r.kind === "race" ? "race" : r.grade, 6)} ${lpad(r.length.toFixed(0), 7)} ${lpad(r.seconds.toFixed(0), 7)} ${lpad(r.mean.toFixed(1), 6)} ${lpad(r.top.toFixed(1), 6)} ${lpad(r.flights, 4)} ${lpad(r.longest.toFixed(2), 6)} ${lpad(r.hardest.toFixed(1), 6)} ${lpad(r.crashes.length, 6)} ${lpad(perKm.toFixed(1), 5)} ${pad(`≤${band}`, 6)} ${pad(r.home ? "yes" : "NO", 5)} ${ok ? "  " : "✗ "}${lands || "—"} · ${falls || "none"}${beside}`,
      );
      out.bot.push({ ...r, perKm, ok });
    }
  }
}

if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 2));
console.log(`\n${failed === 0 ? "every row in its band" : `${failed} row(s) out of band`}`);
process.exit(failed === 0 ? 0 : 1);

#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARAMOTOR'S WIND LAB (`make para-wind`): what the weather does to the
// free ride's powered wing (`engine/game/para.ts` in the air of
// `para-air.ts`). Every row flies the REAL ENGINE in Node on the bot's
// hands (`paraPilot`: off the summit on full throttle, then holding 60 m
// over the snow and turning down the fall line), on a generated map under
// one sky — each of R19's weathers at its band's middle wind, then a sweep
// of the wind's strength straight down the face and across it — and says
// how the flight went:
//
//   wind   the mean wind at the wing over the flight, km/h
//   lift   the air's rise off the slopes it met, m/s: the most (ridge lift)
//          and the least (the lee's sink)
//   rough  the eddies' sigma, m/s, mean over the flight
//   folds  the wing's collapses in the air: frontal / asymmetric, and the
//          deepest share of it folded
//   stall  seconds stalled
//   back   the share of the flight the wing made no way over the ground
//          along its heading (the wind stronger than it flies)
//   low    the least height over the snow once he had flown 10 s, m — how
//          close the air brought him down
//   air    seconds off the snow
//   end    how it ended: flying at the end, or the wing brought down and cut
//          away (`collapse`), or the pilot thrown
//
// Seconds, no browser. Deterministic: the same flags print the same table.
//
//   node scripts/para-wind-lab.mjs                    every row on seed 38
//   node scripts/para-wind-lab.mjs --seed=7 --seconds=120
//   node scripts/para-wind-lab.mjs --rows=storm,down-12
//   node scripts/para-wind-lab.mjs --json=previews/para-wind-before.json
//   node scripts/para-wind-lab.mjs --compare=previews/para-wind-before.json

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const KINDS = ["fog", "clear", "flurries", "fair", "overcast", "high", "snow", "storm"];
/** The fall line's bearing a wind blows FROM straight down it, and across. */
const DOWN = Math.PI;
const ACROSS = Math.PI / 2;
const SWEEP = [0, 3, 6, 9, 12, 15];

const ROWS = [
  ...KINDS.map((kind) => ({ id: kind, sky: { weather: kind } })),
  ...SWEEP.map((w) => ({
    id: `down-${w}`,
    sky: { weather: { kind: "fair", wind: w, windFrom: DOWN } },
  })),
  ...SWEEP.map((w) => ({
    id: `across-${w}`,
    sky: { weather: { kind: "fair", wind: w, windFrom: ACROSS } },
  })),
];

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map flown" },
    seconds: { kind: "number", default: 90, help: "how long each row is flown, s" },
    rows: {
      kind: "string",
      default: "",
      help: `the rows (${ROWS.map((r) => r.id).join(", ")}); every one when left out`,
    },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/para-wind-lab.mjs [--seed=38] [--seconds=90] [--rows=a,b] [--json=file] [--compare=file]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));

const wanted = args.rows ? args.rows.split(",") : ROWS.map((r) => r.id);
for (const id of wanted) {
  if (!ROWS.some((r) => r.id === id)) {
    console.error(`unknown row "${id}"`);
    process.exit(2);
  }
}

const level = E.generateLevel(args.seed);

function flyRow(row) {
  const state = E.createGame({
    level,
    mode: "free",
    para: true,
    crowd: 0,
    quiet: true,
    sky: row.sky,
  });
  const n = Math.round(args.seconds / E.TUNING.dt);
  const out = {
    id: row.id,
    wind: 0,
    liftMax: 0,
    liftMin: 0,
    rough: 0,
    frontal: 0,
    side: 0,
    deepest: 0,
    stall: 0,
    back: 0,
    low: Infinity,
    air: 0,
    end: "flying",
  };
  let samples = 0;
  for (let i = 0; i < n; i++) {
    E.step(state, E.paraPilot(state));
    for (const e of state.events) {
      if (e.kind !== "para") continue;
      if (e.phase === "fold") {
        if (state.para.foldSide === 0) out.frontal++;
        else out.side++;
      }
      if (e.phase === "collapse") out.end = state.skier.thrown ? "thrown" : "collapse";
    }
    const p = state.para;
    if (!p || p.mode === "dropped") break;
    if (p.mode !== "flown" || !p.flying) continue;
    samples++;
    out.air += E.TUNING.dt;
    out.wind += p.wind;
    out.rough += p.rough;
    out.liftMax = Math.max(out.liftMax, p.lift);
    out.liftMin = Math.min(out.liftMin, p.lift);
    out.deepest = Math.max(out.deepest, p.fold);
    if (p.stalled) out.stall += E.TUNING.dt;
    const c = state.skier;
    if (c.vx * Math.sin(p.heading) + c.vz * Math.cos(p.heading) < 0) out.back++;
    if (out.air > 10) out.low = Math.min(out.low, p.agl);
  }
  if (samples > 0) {
    out.wind = (out.wind / samples) * 3.6;
    out.rough /= samples;
    out.back /= samples;
  }
  if (!Number.isFinite(out.low)) out.low = 0;
  if (state.skier.thrown && out.end === "flying") out.end = "thrown";
  return out;
}

const table = ROWS.filter((r) => wanted.includes(r.id)).map(flyRow);

const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const was = (id) => before?.rows.find((r) => r.id === id);

const head =
  "row          wind  lift+  lift-  rough  folds    deep  stall  back    low    air  end";
console.log(`para wind — seed ${args.seed}, ${args.seconds} s a row, the bot's hands\n`);
console.log(head);
for (const r of table) {
  const line =
    `${r.id.padEnd(11)} ${r.wind.toFixed(0).padStart(5)} ${r.liftMax.toFixed(1).padStart(6)} ` +
    `${r.liftMin.toFixed(1).padStart(6)} ${r.rough.toFixed(2).padStart(6)} ` +
    `${`${r.frontal}/${r.side}`.padStart(6)} ${r.deepest.toFixed(2).padStart(7)} ` +
    `${r.stall.toFixed(1).padStart(6)} ${(r.back * 100).toFixed(0).padStart(4)}% ` +
    `${r.low.toFixed(0).padStart(6)} ${r.air.toFixed(0).padStart(6)}  ${r.end}`;
  console.log(line);
  const b = was(r.id);
  if (b) {
    console.log(
      `  was      ${b.wind.toFixed(0).padStart(5)} ${b.liftMax.toFixed(1).padStart(6)} ` +
        `${b.liftMin.toFixed(1).padStart(6)} ${b.rough.toFixed(2).padStart(6)} ` +
        `${`${b.frontal}/${b.side}`.padStart(6)} ${b.deepest.toFixed(2).padStart(7)} ` +
        `${b.stall.toFixed(1).padStart(6)} ${(b.back * 100).toFixed(0).padStart(4)}% ` +
        `${(b.low ?? 0).toFixed(0).padStart(6)} ${b.air.toFixed(0).padStart(6)}  ${b.end}`,
    );
  }
}
if (args.json) {
  writeFileSync(
    args.json,
    JSON.stringify({ seed: args.seed, seconds: args.seconds, rows: table }, null, 2),
  );
  console.log(`\nwrote ${args.json}`);
}

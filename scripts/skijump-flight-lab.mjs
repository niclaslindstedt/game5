#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMP'S FLIGHT LAB (`make skijump-flight`): what a jump off the
// ski jumping hill (R43) does, jumped by the REAL ENGINE in Node — the bar,
// the tracks (`engine/game/jump-inrun.ts`), the take-off, the flight
// (`jump-flight.ts`) and the landing on the engine's own skier — on a
// generated map's hill, at the light build on the jumping skis. THE loop
// for the in-run, the take-off, the polar and the landing: run it before
// and after every change.
//
// THE IN-RUN: every few gates' speed over the edge in calm air, ridden on
// the engine's own step at the hill's density, and the jury's gate (the
// lowest reaching the hill's design speed).
//
// THE JUMPS, one a row — a scripted jumper: off the bar at once, the
// take-off pressed `timing` s off perfect (early negative, `none` never),
// in the air the lean held at `lean` (−1 forward, the skis flatter to the
// air; +1 back, sat up) under the assist's hand, the telemark the
// assist's; a STAGED wind along the hill (`wind`, m/s, head positive) in
// place of the map's — or the bot's own hands (`bot`), and the bot in the
// map's own air (`bot-map`):
//
//   edge   the speed over the edge, km/h; `cells` through the photocells
//   push   the speed the take-off gave at right angles to the table, m/s
//   time   the flight's time, s
//   peak   the highest his centre rose over the slope, m, and how far down
//          the hill, m
//   dist   the distance credited, m (to the half metre)
//   land   the speed he came down at, km/h, and into the slope, m/s
//   load   the landing's load on the legs, g (the engine's `landingLoad`)
//   how    how he came down (telemark, two-footed, late, fall) and what
//          came of it by the fall line (clean, touch, fall)
//   err    the mean distance of his angle of attack from the ideal, °
//
// THE FACTORS, the norm's way: the metres a metre of in-run buys at the
// jury's gate (gate ±4, `perfect`), and a m/s of head and of tail wind
// (±3 m/s), beside the hill's published sheets.
//
// Seconds a row after the map's build (~15 s), no browser. Deterministic:
// the same flags print the same table.
//
//   node scripts/skijump-flight-lab.mjs
//   node scripts/skijump-flight-lab.mjs --seed=7 --hill=normal
//   node scripts/skijump-flight-lab.mjs --rows=design,head-3,tail-3
//   node scripts/skijump-flight-lab.mjs --json=previews/skijump-before.json
//   node scripts/skijump-flight-lab.mjs --compare=previews/skijump-before.json

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The rows: the gate (`top`, `design`, `low`, or ±n gates off the design),
 * the take-off's timing, s (null never pressed), the staged head wind, m/s,
 * the lean held in the air, the assist's hand, and the bot. */
const ROWS = [
  { id: "design", gate: "design", timing: 0, wind: 0, lean: 0 },
  { id: "top", gate: "top", timing: 0, wind: 0, lean: 0 },
  { id: "low", gate: "low", timing: 0, wind: 0, lean: 0 },
  { id: "gate+4", gate: 4, timing: 0, wind: 0, lean: 0 },
  { id: "gate-4", gate: -4, timing: 0, wind: 0, lean: 0 },
  { id: "early-.05", gate: "design", timing: -0.05, wind: 0, lean: 0 },
  { id: "early-.1", gate: "design", timing: -0.1, wind: 0, lean: 0 },
  { id: "early-.2", gate: "design", timing: -0.2, wind: 0, lean: 0 },
  { id: "late+.05", gate: "design", timing: 0.05, wind: 0, lean: 0 },
  { id: "late+.1", gate: "design", timing: 0.1, wind: 0, lean: 0 },
  { id: "none", gate: "design", timing: null, wind: 0, lean: 0 },
  ...[-3, -2, -1, 1, 2, 3].map((w) => ({
    id: w > 0 ? `head+${w}` : `tail${w}`,
    gate: "design",
    timing: 0,
    wind: w,
    lean: 0,
  })),
  { id: "flat", gate: "design", timing: 0, wind: 0, lean: -0.6 },
  { id: "flatter", gate: "design", timing: 0, wind: 0, lean: -1 },
  { id: "steep", gate: "design", timing: 0, wind: 0, lean: 0.6 },
  { id: "bare", gate: "design", timing: 0, wind: 0, lean: 0, hand: 0 },
  { id: "bare-flat", gate: "design", timing: 0, wind: 0, lean: -1, hand: 0 },
  { id: "bare-back", gate: "design", timing: 0, wind: 0, lean: 1, hand: 0 },
  { id: "top-head+3", gate: "top", timing: 0, wind: 3, lean: 0 },
  { id: "bot", gate: "design", bot: true, wind: 0 },
  { id: "bot-map", gate: "design", bot: true, wind: null },
];

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map the hill is built over" },
    hill: { kind: "string", default: "large", help: "the hill (large, normal)" },
    rows: {
      kind: "string",
      default: "",
      help: `the jumps (${ROWS.map((r) => r.id).join(", ")}); every one when left out`,
    },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/skijump-flight-lab.mjs [--seed=38] [--hill=large] [--rows=a,b] [--json=file] [--compare=file]",
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
if (args.hill !== "large" && args.hill !== "normal") {
  console.error(`unknown hill "${args.hill}" (large, normal)`);
  process.exit(2);
}

const base = E.generateLevel(args.seed);
const spec = E.withRider(E.ALBATROSS, E.riderById("light"));
const mass = spec.skierMass + spec.gearMass;
const probe = E.createGame({ level: base, mode: "skiJump", hill: args.hill, spec, quiet: true });
const hill = probe.level.skiJump;
const density = probe.jump.density;
const jury = probe.jump.gate;
const top = hill.gates.length - 1;

function gateOf(g) {
  if (g === "design") return jury;
  if (g === "top") return top;
  if (g === "low") return 0;
  return Math.max(0, Math.min(top, jury + g));
}

function hands(state, row) {
  const j = state.jump;
  if (row.bot || !j || j.stage === "down") return E.botInput(state);
  if (j.stage === "bar") return { ...E.NEUTRAL_INPUT, tuck: 1 };
  if (j.stage === "tracks") {
    const press = row.timing !== null && E.timeToEdge(state) <= E.JUMP.takeOff.push - row.timing;
    return { ...E.NEUTRAL_INPUT, tuck: 1, jump: press };
  }
  return { ...E.NEUTRAL_INPUT, tuck: 1, lean: row.lean };
}

function jumpRow(row) {
  const state = E.createGame({
    level: base,
    mode: "skiJump",
    hill: args.hill,
    spec,
    gate: gateOf(row.gate),
    countdown: 0,
    quiet: true,
    assist: { yaw: 1, air: row.hand ?? 1 },
  });
  if (row.wind !== null) state.jump.staged = { head: row.wind, across: 0 };
  const n = Math.round(40 / E.TUNING.dt);
  // ...and a second past the fall line, for the out-run's verdict.
  let past = Math.round(1 / E.TUNING.dt);
  for (let i = 0; i < n && past > 0; i++) {
    E.step(state, hands(state, row));
    if (state.phase === "finished" || state.progress.out) past -= 1;
  }
  const r = state.jump.record;
  return {
    id: row.id,
    gate: r.gate,
    timing: r.timing,
    wind: r.wind,
    edge: r.edgeSpeed * 3.6,
    cells: r.inRunSpeed * 3.6,
    push: r.push,
    time: r.flightTime,
    peak: r.peak,
    peakAt: r.peakAt,
    dist: r.distance,
    land: r.landingSpeed * 3.6,
    into: r.into,
    load: r.load,
    landing: r.landing ?? "-",
    outcome: state.progress.out ? "fall" : r.outcome,
    err: r.attitude,
  };
}

const rows = ROWS.filter((r) => wanted.includes(r.id));
const table = rows.map(jumpRow);

// THE IN-RUN.
const inRun = [];
for (let g = 0; g <= top; g += 3) {
  inRun.push({ gate: hill.gates[g].number, speed: E.gateSpeed(hill, g, density, mass) * 3.6 });
}
if (top % 3 !== 0) {
  inRun.push({ gate: hill.gates[top].number, speed: E.gateSpeed(hill, top, density, mass) * 3.6 });
}

// THE FACTORS, the norm's way, where their rows were jumped.
const byId = (id) => table.find((r) => r.id === id);
const factors = {};
const up = byId("gate+4");
const down = byId("gate-4");
if (up && down) {
  const metres = hill.gates[gateOf(4)].e - hill.gates[gateOf(-4)].e;
  factors.gate = ((up.dist - down.dist) / metres) * hill.metre;
}
const head = byId("head+3");
const tail = byId("tail-3");
const calm = byId("design");
if (head && calm) factors.head = ((head.dist - calm.dist) / 3) * hill.metre;
if (tail && calm) factors.tail = ((calm.dist - tail.dist) / 3) * hill.metre;

const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const was = (id) => before?.rows.find((r) => r.id === id);

const f1 = (v, n = 6) => (v === null || v === undefined ? "-" : v.toFixed(1)).padStart(n);
const f2 = (v, n = 6) => (v === null || v === undefined ? "-" : v.toFixed(2)).padStart(n);
const line = (r) =>
  `${String(r.gate).padStart(4)} ${f2(r.timing)} ${f1(r.wind, 5)} ${f1(r.edge)} ${f1(r.cells)} ` +
  `${f2(r.push, 5)} ${f2(r.time, 5)} ${f1(r.peak, 5)} ${f1(r.peakAt, 6)} ${f1(r.dist)} ` +
  `${f1(r.land)} ${f2(r.into, 5)} ${f2(r.load, 5)}  ${r.landing.padEnd(9)} ${r.outcome.padEnd(7)} ${f1(r.err, 5)}`;

console.log(
  `ski jump flight — seed ${args.seed}, the ${hill.hill} hill (HS ${hill.hs}, K ${hill.w}), ` +
    `the light build (${mass.toFixed(1)} kg), air ${density.toFixed(3)} kg/m³\n`,
);
console.log("THE IN-RUN — the speed over the edge in calm air, km/h");
console.log(inRun.map((g) => `${g.gate}: ${g.speed.toFixed(1)}`).join("  "));
console.log(
  `the jury's gate ${hill.gates[jury].number} (design ${(hill.speed * 3.6).toFixed(1)} km/h); ` +
    `the generator's ${hill.gates[hill.design].number}\n`,
);
console.log(
  "row          gate timing  wind   edge  cells  push  time  peak     @    dist   land  into  load  how       end      err",
);
for (const r of table) {
  console.log(`${r.id.padEnd(12)} ${line(r)}`);
  const b = was(r.id);
  if (b) console.log(`  was        ${line(b)}`);
}
console.log("\nTHE FACTORS — points, measured; the hill's scoring numbers beside them");
const say = (k, mine, sheet) =>
  console.log(`  ${k.padEnd(5)} ${mine === undefined ? "-" : mine.toFixed(2)}  (${sheet})`);
say("gate", factors.gate, `${hill.gateFactor} a metre of in-run`);
say("head", factors.head, `${hill.headFactor} a m/s`);
say("tail", factors.tail, `${hill.tailFactor} a m/s`);
if (args.json) {
  writeFileSync(
    args.json,
    JSON.stringify(
      { seed: args.seed, hill: args.hill, inRun, jury, rows: table, factors },
      null,
      2,
    ),
  );
  console.log(`\nwrote ${args.json}`);
}

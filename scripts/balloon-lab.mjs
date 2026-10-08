#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOT AIR BALLOON'S FLIGHT LAB (`make balloon-flight`): the free ride's
// balloon (`engine/game/balloon.ts`, its air `balloon-air.ts`) flown by the
// REAL ENGINE in Node, one scripted flight a row, on a generated map:
//
//   pilot      the bot's hands (`balloonPilot`) holding 120 m over the snow
//   high       ...holding 300 m — the faster wind aloft carries it further
//   hop        a 15 s burn off the tether, then nothing: up, cooling, down
//   cold       never a burn: the tether never lets go
//   vent       the bot to 150 m, then the parachute valve pulled and held
//   overheat   the burner held open from the start: the fabric cooked
//   jump       the bot for 60 s, then over the side — his own landing
//   walk       the bot, walking the basket corner to corner
//   breeze     the bot under a 6 m/s wind (the map's), the day's on top
//   gale       the bot under a storm's wind: burning in it lights it
//
// Columns:
//   secs   how long the row flew (to its end or the clock's)
//   top    the highest the basket went over the snow, m
//   climb  the fastest climb and the fastest sink, m/s
//   lag    seconds from the first burn to a climb of 0.5 m/s
//   tmax   the envelope's hottest, °C
//   fuel   propane burnt, kg
//   up     metres carried toward the summit (along the up-valley wind's
//          way at the site), and the rise of the ground under it, m
//   fire   when the fabric took light, s ("-" never)
//   end    how it ended: flying, tethered, landed, down (empty), crash,
//          jumped/landed or jumped/wipeout, burning
//
// Seconds, no browser. Deterministic: the same flags print the same table.
//
//   node scripts/balloon-lab.mjs                      every row on seed 38
//   node scripts/balloon-lab.mjs --seed=7 --seconds=600
//   node scripts/balloon-lab.mjs --rows=pilot,gale --trace=pilot
//   node scripts/balloon-lab.mjs --json=previews/balloon-before.json
//   node scripts/balloon-lab.mjs --compare=previews/balloon-before.json

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const ROWS = ["pilot", "high", "hop", "cold", "vent", "overheat", "jump", "walk", "breeze", "gale"];

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map flown" },
    seconds: { kind: "number", default: 300, help: "the longest a row is flown, s" },
    rows: { kind: "string", default: "", help: `the rows (${ROWS.join(", ")}); all when left out` },
    trace: { kind: "string", default: "", help: "print this row's flight every 5 s" },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/balloon-lab.mjs [--seed=38] [--seconds=300] [--rows=a,b] [--trace=row] [--json=file] [--compare=file]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));

const wanted = args.rows ? args.rows.split(",") : ROWS;
for (const id of wanted) {
  if (!ROWS.includes(id)) {
    console.error(`unknown row "${id}"`);
    process.exit(2);
  }
}

const level = E.generateLevel(args.seed);
const N = E.NEUTRAL_INPUT;

/** Each row's sky and hands: `(state, t, row)` → the input this step. */
const SCRIPTS = {
  pilot: { hands: (s) => E.balloonPilot(s) },
  high: { hands: (s) => E.balloonPilot(s, 300) },
  hop: { hands: (s, t) => ({ ...N, tuck: t < 15 ? 1 : 0 }) },
  cold: { hands: () => N },
  vent: {
    hands: (s, t, row) => {
      if (!row.venting && s.balloon.agl > 150) row.venting = true;
      return row.venting ? { ...N, brake: 1 } : E.balloonPilot(s, 200);
    },
  },
  overheat: { hands: () => ({ ...N, tuck: 1 }) },
  jump: {
    hands: (s, t) =>
      t >= 60 && s.balloon.aboard
        ? { ...N, machine: true }
        : s.balloon.aboard
          ? E.balloonPilot(s)
          : N,
  },
  walk: {
    hands: (s, t) => {
      const p = E.balloonPilot(s);
      const leg = Math.floor(t / 4) % 4;
      return { ...p, steer: leg < 2 ? 1 : -1, lean: leg % 2 === 0 ? -1 : 1 };
    },
  },
  breeze: { sky: { weather: { kind: "fair", wind: 6 } }, hands: (s) => E.balloonPilot(s) },
  gale: { sky: { weather: "storm" }, hands: (s) => E.balloonPilot(s) },
};

function flyRow(id) {
  const script = SCRIPTS[id];
  const map = script.sky ? E.withSky(level, script.sky) : level;
  const state = E.createGame({ level: map, mode: "free", balloon: true, crowd: 0, quiet: true });
  const b = state.balloon;
  const way = E.upValley(map, b.x, b.z);
  const x0 = b.x;
  const z0 = b.z;
  const g0 = map.groundAt(x0, z0);
  const out = {
    id,
    secs: 0,
    top: 0,
    climbMax: 0,
    sinkMax: 0,
    lag: null,
    tmax: b.temp,
    fuel: 0,
    up: 0,
    rise: 0,
    fire: null,
    walkMost: 0,
    end: "flying",
  };
  const row = {};
  let firstBurn = null;
  const n = Math.round(args.seconds / E.TUNING.dt);
  const trace = args.trace === id;
  for (let i = 0; i < n; i++) {
    const t = state.t;
    const input = script.hands(state, t, row);
    if (input.tuck >= 0.5 && firstBurn === null && b.aboard) firstBurn = t;
    E.step(state, input);
    const bb = state.balloon;
    for (const e of state.events) {
      if (e.kind === "balloon") {
        if (e.phase === "fire" && out.fire === null) out.fire = state.t;
        if (e.phase === "crash") out.end = "crash";
        if (e.phase === "jump") out.end = "jumped";
        if (e.phase === "down" && out.end === "flying") out.end = "down";
      }
      if (e.kind === "wipeout" && out.end === "jumped") out.end = "jumped/wipeout";
      if (e.kind === "land" && out.end === "jumped") out.end = "jumped/landed";
    }
    out.secs = state.t;
    out.top = Math.max(out.top, bb.agl);
    out.climbMax = Math.max(out.climbMax, bb.climb);
    out.sinkMax = Math.min(out.sinkMax, bb.climb);
    out.tmax = Math.max(out.tmax, bb.temp);
    if (out.lag === null && firstBurn !== null && bb.climb > 0.5) out.lag = state.t - firstBurn;
    out.walkMost = Math.max(out.walkMost, Math.abs(bb.walkX), Math.abs(bb.walkZ));
    out.up = (bb.x - x0) * Math.sin(way) + (bb.z - z0) * Math.cos(way);
    out.rise = map.groundAt(bb.x, bb.z) - g0;
    if (trace && i % 600 === 0) {
      console.log(
        `  ${id} ${state.t.toFixed(0).padStart(4)}s ${bb.mode.padEnd(8)} agl ${bb.agl.toFixed(0).padStart(5)} ` +
          `climb ${bb.climb.toFixed(2).padStart(6)} T ${bb.temp.toFixed(1).padStart(6)} amb ${bb.ambient.toFixed(1)} ` +
          `fuel ${bb.fuel.toFixed(1)} wind ${bb.wind.toFixed(1)} air past ${bb.shear.toFixed(1)} ` +
          `scorch ${bb.scorch.toFixed(2)} burnt ${bb.burnt.toFixed(2)} up ${out.up.toFixed(0)}`,
      );
    }
    // A row is over once the balloon is down for good and he is not riding
    // anything of it — or he has landed his jump.
    if (out.end === "crash" && state.t - (out.crashT ??= state.t) > 1) break;
    if (out.end.startsWith("jumped/")) break;
    if (bb.mode === "down" && !bb.aboard && out.end === "down") break;
  }
  out.fuel = E.BALLOON.mass.fuel - b.fuel;
  if (out.end === "flying") {
    if (b.mode === "tethered") out.end = "tethered";
    else if (b.grounded) out.end = "landed";
    if (b.burning) out.end = "burning";
  }
  if (out.end === "crash" && out.fire !== null) out.end = "fire+crash";
  delete out.crashT;
  return out;
}

const table = wanted.map(flyRow);
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const was = (id) => before?.rows.find((r) => r.id === id);

const f = (v, d = 1, w = 6) => (v === null || v === undefined ? "-" : v.toFixed(d)).padStart(w);
function line(r) {
  return (
    `${f(r.secs, 0)} ${f(r.top, 0)} ${f(r.climbMax, 1, 5)}/${f(r.sinkMax, 1, 5).trimStart().padEnd(5)} ` +
    `${f(r.lag, 0, 4)} ${f(r.tmax, 0, 5)} ${f(r.fuel, 1, 5)} ${f(r.up, 0, 6)} ${f(r.rise, 0, 5)} ` +
    `${f(r.fire, 0, 5)}  ${r.end}`
  );
}
console.log(`balloon flight — seed ${args.seed}, up to ${args.seconds} s a row\n`);
console.log("row         secs    top climb/sink   lag  tmax  fuel     up  rise  fire  end");
for (const r of table) {
  console.log(`${r.id.padEnd(9)} ${line(r)}`);
  const b = was(r.id);
  if (b) console.log(`  was     ${line(b)}`);
}
if (args.json) {
  writeFileSync(
    args.json,
    JSON.stringify({ seed: args.seed, seconds: args.seconds, rows: table }, null, 2),
  );
  console.log(`\nwrote ${args.json}`);
}

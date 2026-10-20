#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S FLIGHT TABLE — the army's helicopters (`engine/game/army.ts`,
// their numbers `engine/game/defs/army.ts`) hunting a man off the real
// engine on a real map, a row a star and a quarry:
//
//   * `skier`: the bot skiing the piste away from them;
//   * `heli`: the man in the stolen helicopter, the bot's hands flying it
//     corner to corner of the map at its cruise.
//
// For each: when the first machine came in over the edge and when it was
// on station (inside 1.5 orbits of him); the slant range from each machine
// hunting him to him while seen — the median and the 10th and 90th
// percentiles (the standoff the pylon turn or the echelon holds); the
// share of the time he was seen; the rounds the door guns fired, the
// rounds in him, whether he died (the INJURIES switch on) or his machine
// was brought down, and when; and the least height of any machine over
// the snow under its disc and over the crowns — with the count of steps
// it was under the floor it must never break (`ARMY.terrain.floor`),
// which must be 0.
//
// Nothing drawn; tens of seconds. The rows are the before and after of any
// change to the army's flight or guns.
//
// `--table=air` is THE PARAMOTORS AND BALLOONS' table instead
// (`engine/game/army-air.ts`, `army-para.ts`, `army-balloon.ts`), a row a
// star and a quarry — `skier` (the bot skiing away), `still` (stood where
// the hunt found him) and `chase` (him in the stolen helicopter, the bot's
// hands flying it at the nearest paramotor, to bring it down): the
// paramotors and the balloons out and the most at once, when the first was
// on the map and when one first fired (the first contact); the rifle
// bursts and the rockets fired, the rockets that burst within their throw
// of him and the times he was thrown; the army's own vehicles knocked out
// by a burst; the paramotors brought down by him; the paramotors and
// balloons LOST BY MISTAKE (flown into the snow or a crown, crashed or
// burnt — always 0); the least height of a paramotor over the snow and
// over the crowns; his death or arrest; and the step's cost (the wall time
// of a whole engine step while hunted, its mean and its 99th percentile).
// `--alone` holds back the rest of the roster (the door gunners, the
// soldiers, the lifts, the snowmobiles and the ground waves), so what the
// row shows is the air's own.
//
//   node scripts/army-flight.mjs
//   node scripts/army-flight.mjs --stars=2,4 --quarry=heli --seconds=180
//   node scripts/army-flight.mjs --sfw --json=previews/army-flight.json
//   node scripts/army-flight.mjs --table=air --stars=4,5 --alone

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed" },
    stars: { kind: "string", default: "1,2,3,4,5", help: "the stars, comma-separated" },
    quarry: { kind: "string", default: "skier,heli", help: "who is hunted: skier, heli" },
    seconds: { kind: "number", default: 150, help: "how long each hunt is run, s" },
    sfw: { kind: "flag", default: false, help: "SAFE FOR WORK on (the INJURIES switch off)" },
    table: {
      kind: "string",
      default: "heli",
      help: "the table: heli, or air (paramotors and balloons)",
    },
    alone: {
      kind: "flag",
      default: false,
      help: "the air table: the rest of the roster held back (gunners, soldiers, lifts, snowmobiles, waves)",
    },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
  },
  "usage: node scripts/army-flight.mjs [--seed=n] [--stars=a,b] [--quarry=skier,heli] [--seconds=s] [--sfw] [--table=heli|air] [--alone] [--json=FILE]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));

const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
const level = E.generateLevel(args.seed);
const dt = E.TUNING.dt;
const pct = (xs, p) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

/** The bot's corners of the map for the stolen helicopter to run through. */
function corners(size) {
  const m = size * 0.2;
  return [
    { x: m, z: m },
    { x: size - m, z: m },
    { x: size - m, z: size - m },
    { x: m, z: size - m },
  ];
}

function hunt(stars, quarry) {
  const heli = quarry === "heli";
  const s = E.createGame({
    level,
    seed: args.seed,
    mode: "free",
    quiet: true,
    crowd: 0,
    gore: !args.sfw,
    sfw: args.sfw,
    ...(heli ? { heli: true } : {}),
  });
  const way = corners(level.size);
  let leg = 0;
  // Up off the pad first, then the hunt raised.
  if (heli) {
    for (let i = 0; i < 6 / dt; i++)
      E.step(s, E.pilotInput(s, { x: s.heli.x, z: s.heli.z, height: 200 }));
  }
  E.setWanted(s, stars);
  const t0 = s.t;
  const row = {
    stars,
    quarry,
    in: NaN,
    station: NaN,
    ranges: [],
    seen: 0,
    looks: 0,
    fired: 0,
    hits: 0,
    dead: NaN,
    downed: NaN,
    clear: Infinity,
    crowns: Infinity,
    under: 0,
    helis: 0,
  };
  const trunks = [];
  const R = E.ARMY_HELI.rotor.radius;
  for (let i = 0; i < args.seconds / dt; i++) {
    let input;
    if (heli && s.heli?.rider && s.heli.mode !== "wreck") {
      const c = way[leg % way.length];
      if (Math.hypot(c.x - s.heli.x, c.z - s.heli.z) < 150) leg++;
      input = E.pilotInput(s, { x: c.x, z: c.z, height: 200 });
    } else input = E.botInput(s);
    E.step(s, input);
    const t = s.t - t0;
    const w = s.wanted;
    if (!w) break;
    row.looks++;
    if (w.seen) row.seen++;
    const q = E.quarryOf(s);
    for (const h of E.armyHelis(s)) {
      if (h.phase !== "hunt") continue;
      row.helis = Math.max(row.helis, E.armyHelis(s).length);
      if (Number.isNaN(row.in)) row.in = t;
      const d = Math.hypot(h.x - q.x, h.y - q.y, h.z - q.z);
      if (Number.isNaN(row.station) && Math.hypot(h.x - q.x, h.z - q.z) < 1.5 * E.ARMY.orbit.radius)
        row.station = t;
      if (w.seen && !Number.isNaN(row.station)) row.ranges.push(d);
      // The snow under the disc and the crowns it sweeps.
      let ground = level.groundAt(h.x, h.z);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        ground = Math.max(ground, level.groundAt(h.x + Math.sin(a) * R, h.z + Math.cos(a) * R));
      }
      row.clear = Math.min(row.clear, h.y - ground);
      if (h.y < ground + E.ARMY.terrain.floor - 1e-6) row.under++;
      for (const j of E.treesNear(level, h.x, h.z, R, trunks)) {
        const tr = level.trees[j];
        row.crowns = Math.min(row.crowns, h.y - (tr.y + tr.height));
      }
    }
    if (Number.isNaN(row.dead) && s.gore && s.gore.dead >= 0) row.dead = t;
    if (heli && Number.isNaN(row.downed) && s.heli?.mode === "wreck") row.downed = t;
  }
  const g = s.gunfire;
  row.fired = g ? g.fired : 0;
  row.hits = g ? g.hits : 0;
  return row;
}

if (args.table === "air") {
  const { airTable } = await import("./lib/army-air-table.mjs");
  airTable(E, level, args, list);
  process.exit(0);
}

const rows = [];
for (const quarry of list(args.quarry))
  for (const stars of list(args.stars).map(Number)) rows.push(hunt(stars, quarry));

const f = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : "—");
console.log(
  `seed ${args.seed}, ${args.seconds} s a hunt, ${args.sfw ? "SAFE FOR WORK" : "INJURIES on"}\n`,
);
console.log(
  "| Quarry | Stars | Machines | In, s | On station, s | Range p10 / med / p90, m | Seen | Rounds | In him | Dead, s | Downed, s | Least over snow, m | Over crowns, m | Under floor |",
);
console.log(
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
);
for (const r of rows) {
  console.log(
    `| ${r.quarry} | ${r.stars} | ${r.helis} | ${f(r.in)} | ${f(r.station)} | ${f(pct(r.ranges, 0.1))} / ${f(pct(r.ranges, 0.5))} / ${f(pct(r.ranges, 0.9))} | ${f((100 * r.seen) / Math.max(1, r.looks))}% | ${r.fired} | ${r.hits} | ${f(r.dead)} | ${f(r.downed)} | ${f(r.clear, 1)} | ${f(r.crowns, 1)} | ${r.under} |`,
  );
}
if (args.json) {
  const out = join(root, args.json);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify(
      rows.map(({ ranges, ...r }) => ({ ...r, range: pct(ranges, 0.5) })),
      null,
      2,
    ),
  );
}

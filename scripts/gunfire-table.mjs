#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GUNFIRE TABLE — what each of the army's weapons (`engine/game/defs/weapons.ts`,
// flown by `engine/game/gunfire.ts`) does at range, off the real engine:
//
//   * the BALLISTICS: the round's time of flight, the speed it keeps, the
//     energy it carries and the drop the aim takes up, at every range;
//   * the SHOOTING: a stand-in shooter fires one burst (or one rocket, one
//     shell) at a skier crossing in front of him, `--trials` times off
//     different seeds, on a flat drag strip (`tests/support/synthetic.ts`)
//     with the INJURIES switch on — the share of rounds that hit him, the
//     share of bursts that hit him at all, the share that killed him
//     (watched for `--after` s, so a wound that bleeds him out counts), and
//     the median MISS: how near to the middle of his body each round that
//     missed came (a burst's: how near to him it went off).
//
// Nothing drawn; seconds. The rows are the before and after of any change
// to a weapon's numbers, the aim or the body's wounds.
//
//   node scripts/gunfire-table.mjs
//   node scripts/gunfire-table.mjs --weapons=rifle,doorGun --trials=80
//   node scripts/gunfire-table.mjs --speed=20 --json=previews/gunfire-table.json

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
    weapons: {
      kind: "string",
      default: "rifle,doorGun,heavyGun,rocket,tankGun",
      help: "which weapons, comma-separated",
    },
    ranges: {
      kind: "string",
      default: "50,100,200,300,400,600,800",
      help: "the ranges, m, comma-separated (past a weapon's reach, left out)",
    },
    trials: { kind: "number", default: 40, help: "bursts fired at each range" },
    speed: {
      kind: "number",
      default: 12,
      help: "how fast he crosses in front of the shooter, m/s",
    },
    up: {
      kind: "number",
      default: NaN,
      help: "the shooter's height over the snow, m (1.5 on the ground; the door gun 30 up)",
    },
    after: { kind: "number", default: 8, help: "how long he is watched after the burst, s" },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
  },
  "usage: node scripts/gunfire-table.mjs [--weapons=a,b] [--ranges=a,b] [--trials=n] [--speed=v] [--up=m] [--json=FILE]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));

const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
const weapons = list(args.weapons);
for (const w of weapons) {
  if (!E.WEAPONS[w]) {
    console.error(`unknown weapon "${w}" (${Object.keys(E.WEAPONS).join(", ")})`);
    process.exit(2);
  }
}
const ranges = list(args.ranges).map(Number);
const level = S.flatLevel();
const G = 9.81;

/** One burst at range `d` off seed `seed`: what it did. */
function burst(weapon, d, seed) {
  const s = E.createGame({ level, seed, mode: "free", quiet: true, crowd: 0, gore: true });
  // He crosses along +x at `speed`; the shooter stands `d` m off to his side.
  E.placeRun(s, { x: 0, z: 0, heading: Math.PI / 2, speed: args.speed });
  const up = Number.isFinite(args.up) ? args.up : weapon === "doorGun" ? 30 : 1.5;
  const gun = E.armGun(s, 1, weapon, 0, level.groundAt(0, d) + up, d);
  let fired = false;
  let hits = 0;
  let done = -1;
  /** Each round's nearest pass to him, by its id. */
  const near = new Map();
  const misses = [];
  for (let i = 0; i < Math.round(30 / E.TUNING.dt); i++) {
    if (!fired) fired = E.fireAt(s, gun, { kind: "quarry" }, "aim");
    E.step(s, E.NEUTRAL_INPUT);
    const c = E.bodyCentre(s);
    for (const r of s.gunfire.rounds) {
      const d = Math.hypot(r.x - c.x, r.y - c.y, r.z - c.z);
      near.set(r.id, Math.min(near.get(r.id) ?? Infinity, d));
    }
    for (const e of s.events) {
      if (e.kind !== "gunfire") continue;
      if (e.phase === "hit") hits++;
      if (e.phase === "blast") misses.push(Math.hypot(e.x - c.x, e.y - c.y, e.z - c.z));
    }
    if (done < 0 && fired && gun.left === 0 && s.gunfire.rounds.length === 0) done = s.t;
    if (done >= 0 && s.t - done > args.after) break;
  }
  if (E.WEAPONS[weapon].kind === "gun") misses.push(...[...near.values()].filter((d) => d > 0.25));
  return {
    fired: s.gunfire.fired,
    struck: s.gunfire.hits,
    hits,
    dead: !!s.gore && s.gore.dead >= 0,
    misses,
  };
}

const median = (xs) => {
  if (!xs.length) return NaN;
  const v = [...xs].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
};
const pct = (x) => `${(100 * x).toFixed(0)}%`.padStart(5);
const f = (x, n = 1) => (Number.isFinite(x) ? x.toFixed(n) : "-");

const rows = [];
console.log(
  `gunfire table — ${args.trials} bursts a range at a skier crossing at ${args.speed} m/s, INJURIES on`,
);
console.log(
  "weapon    range   tof s  speed m/s   energy kJ  drop m | rounds  hit/rd  burst hit  killed  miss m",
);
for (const w of weapons) {
  const def = E.WEAPONS[w];
  for (const d of ranges) {
    if (d > def.reach) continue;
    const tof = E.flightTime(def, d);
    const v = E.speedAt(def, d);
    const j = E.energyAt(def, d);
    const drop = 0.5 * G * tof * tof;
    let fired = 0;
    let struck = 0;
    let hitBursts = 0;
    let dead = 0;
    const misses = [];
    for (let k = 0; k < args.trials; k++) {
      const r = burst(w, d, 1000 + k);
      fired += r.fired;
      struck += r.struck;
      if (r.struck > 0 || r.hits > 0) hitBursts++;
      if (r.dead) dead++;
      misses.push(...r.misses);
    }
    const row = {
      weapon: w,
      range: d,
      tof,
      speed: v,
      energy: j,
      drop,
      rounds: fired / args.trials,
      hitShare: fired ? struck / fired : 0,
      burstHit: hitBursts / args.trials,
      killed: dead / args.trials,
      miss: median(misses),
    };
    rows.push(row);
    console.log(
      `${w.padEnd(9)} ${String(d).padStart(5)} ${f(tof, 2).padStart(7)} ${f(v, 0).padStart(10)} ` +
        `${f(j / 1000, 2).padStart(11)} ${f(drop, 2).padStart(7)} | ${f(row.rounds, 1).padStart(6)} ` +
        `${pct(row.hitShare).padStart(7)} ${pct(row.burstHit).padStart(10)} ${pct(row.killed).padStart(7)} ` +
        `${f(row.miss, 1).padStart(7)}`,
    );
  }
}

if (args.json) {
  mkdirSync(dirname(args.json), { recursive: true });
  writeFileSync(args.json, JSON.stringify({ args, rows }, null, 2));
  console.log(`wrote ${args.json}`);
}

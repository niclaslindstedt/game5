#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY ON THE GROUND TABLE — the soldiers the wanted level sends after
// a man on the snow (`engine/game/army-ground.ts`, their numbers
// `engine/game/defs/army-ground.ts`), hunted off the real engine on a real
// map, a row a star and a quarry:
//
//   * `skier`: the bot skiing the piste away from them;
//   * `still`: a man stood still where the hunt found him (what an arrest,
//     a kneeling rifleman and a squad closing in are measured on).
//
// For each: when the first machine set down (or hovered for the rope) and
// how many men it put down, landings and fast ropes counted; when the
// first soldier had him in his sights (the first stop to fire — the time
// from that landing to the first contact); the soldiers' rounds and the
// rounds of theirs in him; when he died (INJURIES on) or was ARRESTED
// (`--sfw`); the squads picked up again (the leapfrog); the most men on a
// lift at once and how many rode one; the men knocked down by him; and
// the men STUCK — a soldier who should be moving and barely moved for
// three windows running — which must be 0. With `--sfw`, a round of
// theirs in him is a failure: that column must read 0.
//
// THE SNOWMOBILES' TABLE (`engine/game/army-sled.ts`, their numbers
// `engine/game/defs/army-sled.ts`), from the same hunts: how many machines
// came out of the village and the most at once, when the first did and
// when the first made a short halt to fire, the halts, the gunners' rounds
// and the rounds of theirs in him, his death or his arrest, the crews off
// to take him in, the machines dug out, and the machines STUCK — one that
// barely moved for three windows running, digging included — which must
// be 0. `--alone` hunts him with the snowmobiles alone: the roster's door
// gunners, soldiers and lifts held back for the run (the helicopters fly
// unarmed overhead), so what the table measures is the machines.
//
// Nothing drawn; tens of seconds.
//
//   node scripts/army-ground.mjs
//   node scripts/army-ground.mjs --stars=3,5 --quarry=still --sfw
//   node scripts/army-ground.mjs --json=previews/army-ground.json
//   node scripts/army-ground.mjs --table=sleds --alone

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
    stars: { kind: "string", default: "2,3,4,5", help: "the stars, comma-separated" },
    quarry: { kind: "string", default: "skier,still", help: "who is hunted: skier, still" },
    seconds: { kind: "number", default: 180, help: "how long each hunt is run, s" },
    sfw: { kind: "flag", default: false, help: "SAFE FOR WORK on (the INJURIES switch off)" },
    table: { kind: "string", default: "troops,sleds", help: "the tables: troops, sleds" },
    alone: {
      kind: "flag",
      default: false,
      help: "the snowmobiles alone: no door gunners, soldiers or lifts",
    },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
  },
  "usage: node scripts/army-ground.mjs [--seed=n] [--stars=a,b] [--quarry=skier,still] [--seconds=s] [--sfw] [--table=troops,sleds] [--alone] [--json=FILE]",
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
const tables = new Set(list(args.table));
// THE SNOWMOBILES ALONE: every row's men but theirs held back for the run.
if (args.alone) {
  for (const row of E.WANTED.roster) {
    row.gunners = 0;
    row.soldiers = 0;
    row.lifted = 0;
  }
}

function hunt(stars, quarry) {
  const s = E.createGame({
    level,
    seed: args.seed,
    mode: "free",
    quiet: true,
    crowd: 0,
    gore: !args.sfw,
    sfw: args.sfw,
  });
  // Off the start and down the hill a little before the hunt is raised.
  for (let i = 0; i < 4 / dt; i++) E.step(s, E.botInput(s));
  E.setWanted(s, stars);
  const t0 = s.t;
  const row = {
    stars,
    quarry,
    landed: NaN,
    landings: 0,
    ropes: 0,
    put: 0,
    contact: NaN,
    fired: 0,
    hits: 0,
    dead: NaN,
    arrested: NaN,
    picked: 0,
    lifted: 0,
    onLift: 0,
    down: 0,
    stuck: 0,
    sleds: 0,
    sledsAtOnce: 0,
    sledOut: NaN,
    sledHalt: NaN,
    halts: 0,
    sledFired: 0,
    sledHits: 0,
    dismounts: 0,
    dug: 0,
    sledStuck: 0,
  };
  const stuck = new Set();
  const rode = new Set();
  const sledsOut = new Set();
  const sledsStuck = new Set();
  for (let i = 0; i < args.seconds / dt; i++) {
    E.step(s, quarry === "still" ? E.NEUTRAL_INPUT : E.botInput(s));
    const t = s.t - t0;
    for (const e of s.events) {
      if (e.kind === "army" && e.change === "landed") {
        const h = s.army?.helis.find((m) => m.id === e.id);
        if (h?.task?.kind === "drop") {
          if (Number.isNaN(row.landed)) row.landed = t;
          if (h.task.rope) row.ropes++;
          else row.landings++;
        }
      }
      if (e.kind === "soldier" && e.change === "aim" && Number.isNaN(row.contact)) row.contact = t;
      if (e.kind === "soldier" && e.change === "down") row.down++;
      if (e.kind === "soldier" && e.change === "arrest" && Number.isNaN(row.arrested))
        row.arrested = t;
      if (e.kind === "gunfire" && (e.weapon === "rifle" || e.weapon === "rocket")) {
        if (e.phase === "shot") row.fired++;
        if (e.phase === "hit") row.hits++;
      }
      if (e.kind === "gunfire" && e.weapon === "lmg") {
        if (e.phase === "shot") row.sledFired++;
        if (e.phase === "hit") row.sledHits++;
      }
      if (e.kind === "army-sled") {
        if (e.change === "out") {
          sledsOut.add(e.id);
          if (Number.isNaN(row.sledOut)) row.sledOut = t;
        }
        if (e.change === "halt") {
          row.halts++;
          if (Number.isNaN(row.sledHalt)) row.sledHalt = t;
        }
        if (e.change === "dismount") row.dismounts++;
        if (e.change === "dug") row.dug++;
      }
    }
    let riding = 0;
    for (const m of E.armyTroops(s)) {
      if (m.slow >= 3) stuck.add(m.id);
      if (m.mode === "ride") {
        riding++;
        rode.add(m.id);
      }
    }
    row.onLift = Math.max(row.onLift, riding);
    let driving = 0;
    for (const m of E.armySleds?.(s) ?? []) {
      if (m.slow >= 3) sledsStuck.add(m.id);
      if (m.mode === "drive" || m.mode === "halt") driving++;
    }
    row.sledsAtOnce = Math.max(row.sledsAtOnce, driving);
    if (Number.isNaN(row.dead) && s.gore && s.gore.dead >= 0) row.dead = t;
    if (s.wanted?.ended && s.wanted.ended !== "escaped" && t > (row.arrested || row.dead) + 8)
      break;
  }
  row.put = s.army?.dropped ?? 0;
  row.picked = s.army?.picked ?? 0;
  row.lifted = rode.size;
  row.stuck = stuck.size;
  row.sleds = sledsOut.size;
  row.sledStuck = sledsStuck.size;
  return row;
}

const rows = [];
for (const quarry of list(args.quarry))
  for (const stars of list(args.stars).map(Number)) rows.push(hunt(stars, quarry));

const f = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : "—");
console.log(
  `seed ${args.seed}, ${args.seconds} s a hunt, ${args.sfw ? "SAFE FOR WORK" : "INJURIES on"}` +
    `${args.alone ? ", the snowmobiles alone" : ""}\n`,
);
if (tables.has("troops")) troopTable();
if (tables.has("sleds")) sledTable();

function troopTable() {
  console.log(
    "| Quarry | Stars | Set down, s | Landed / roped | Men put down | First contact, s | Rounds | In him | Dead, s | Arrested, s | Picked up | Rode a lift (most at once) | Knocked down | Stuck |",
  );
  console.log(
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const r of rows) {
    console.log(
      `| ${r.quarry} | ${r.stars} | ${f(r.landed)} | ${r.landings} / ${r.ropes} | ${r.put} | ${f(r.contact)} | ${r.fired} | ${r.hits} | ${f(r.dead)} | ${f(r.arrested)} | ${r.picked} | ${r.lifted} (${r.onLift}) | ${r.down} | ${r.stuck} |`,
    );
  }
  console.log("");
}

function sledTable() {
  console.log(
    "| Quarry | Stars | Snowmobiles out (most at once) | First out, s | First halt, s | Halts | Rounds | In him | Dead, s | Arrested, s | Crews off to arrest | Dug out | Stuck |",
  );
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rows) {
    console.log(
      `| ${r.quarry} | ${r.stars} | ${r.sleds} (${r.sledsAtOnce}) | ${f(r.sledOut)} | ${f(r.sledHalt)} | ${r.halts} | ${r.sledFired} | ${r.sledHits} | ${f(r.dead)} | ${f(r.arrested)} | ${r.dismounts} | ${r.dug} | ${r.sledStuck} |`,
    );
  }
  console.log("");
}
if (args.json) {
  const out = join(root, args.json);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(rows, null, 2));
}

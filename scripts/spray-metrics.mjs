#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SPRAY METRICS LAB (`make spray-metrics`): HOW MUCH SNOW does a turn
// throw, how fast, how high, how far and WHICH WAY — for a pair of skis and
// for a board. Every row is a run the REAL ENGINE skis on a synthetic strip
// (`tests/support/synthetic.ts`) — a pair × a kind of snow × a manoeuvre
// (running straight, linked carves, a skidded turn, checks, a hockey stop)
// × a speed — and every frame of it is flown through the game's own spray
// pool (`spray-sim.ts`, the same code `spray.ts` draws), at 60 frames a
// second, exactly as the renderer flies it.
//
// The columns: the grains thrown a second; the grains alive at once (what a
// frame draws); the mean launch speed off the snow; the mean peak height and
// reach of a grain; how fast the edges slide across their own line
// (`edgeSlips` — a clean carve slides across nothing, a hockey stop at its
// whole speed); and AHEAD, the share of the sheet's throw along the way he
// is going (a hockey stop throws its wall ahead and down the hill, never
// back at him).
//
// It answers what a picture cannot: whether a carve throws a thin fan and a
// stop a wall, whether a board throws as a pair does, and by how much a
// change moved it. Pure Node, seconds; `make spray` photographs the rows.
//
//   node scripts/spray-metrics.mjs                       both pairs, groomed and powder, every move
//   node scripts/spray-metrics.mjs --skis=lynx --moves=stop --speeds=20,40,60
//   node scripts/spray-metrics.mjs --json=previews/spray-before.json
//   node scripts/spray-metrics.mjs --compare=previews/spray-before.json

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MOVES = ["straight", "carve", "skid", "check", "stop"];
const args = parseArgs(
  process.argv.slice(2),
  {
    skis: {
      kind: "string",
      default: "chamois,lynx",
      help: "the pairs (a board's id rides a board)",
    },
    snow: {
      kind: "string",
      default: "groomed,soft",
      help: "the kinds of snow (groomed,hard,soft,new,wet,ice)",
    },
    moves: {
      kind: "string",
      default: MOVES.join(","),
      help: `the manoeuvres (${MOVES.join(", ")})`,
    },
    speeds: { kind: "string", default: "20,40,60", help: "the speeds, km/h" },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/spray-metrics.mjs [--skis=a,b] [--snow=a,b] [--moves=a,b] [--speeds=a,b] [--json=f] [--compare=f]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));
const P = await import(join(root, "pwa/src/game/spray-sim.ts"));
const { SNOW } = await import(join(root, "pwa/src/game/snowpack.ts"));
const H = await import(join(root, "pwa/src/game/hold-input.ts"));

/** The strip's pitch for a held speed (the cloud lab's). */
const pitchFor = (kmh) =>
  Math.tan(((kmh <= 12 ? 2 : kmh <= 20 ? 4 : kmh <= 30 ? 7 : kmh <= 50 ? 10 : 14) * Math.PI) / 180);
const FRAME = 1 / 60;

function measure(pair, kind, moveName, kmh) {
  const spec = E.pairById(pair);
  const snow = SNOW[kind];
  const packed = kind === "groomed" || kind === "hard" || kind === "ice" ? 1 : 0;
  const stop = moveName === "stop";
  const level = S.flatLevel(
    stop ? { packed } : { packed, grade: pitchFor(kmh), slopeFrom: 200, size: 4000 },
  );
  const state = E.createGame({ level, spec, rivals: 0, countdown: 0, quiet: true });
  E.placeRun(
    state,
    stop
      ? { x: 1500, z: 200, heading: 0, speed: kmh / 3.6 }
      : { x: 2000, z: 600, heading: 0, speed: kmh / 3.6 },
  );
  const pool = P.createSprayPool(20000);
  const slips = [P.emptySlip(), P.emptySlip()];
  // A stop and a skidded turn are over in a couple of seconds; the rest are
  // measured once they have settled into their rhythm.
  const short = stop || moveName === "skid";
  const seconds = short ? 2.5 : 5;
  const from = short ? 0.4 : 1.5;
  const t0 = state.t;
  const steps = Math.round(seconds * E.TUNING.physicsHz);
  const acc = { n: 0, alive: 0, slide: 0, ridden: 0, ahead: 0, aheadW: 0 };
  let tally = { thrown: 0, launch: 0, high: 0, reach: 0, done: 0 };
  let frames = 0;
  for (let i = 0; i < steps; i++) {
    const t = state.t - t0;
    E.step(state, H.holdInput(state, kmh, 0, moveName, t));
    if (i % 2 === 1) continue; // a frame every second step: 60 a second
    const c = state.skier;
    // Where the sheet is thrown against where he is going, before the frame.
    const before = pool.stats();
    if (t >= from) {
      tally.thrown += before.thrown;
      tally.launch += before.launch;
      tally.high += before.high;
      tally.reach += before.reach;
      tally.done += before.done;
    }
    pool.emit(c, level, FRAME, 0, snow);
    pool.step(FRAME, level);
    if (t < from) continue;
    frames++;
    const n = P.edgeSlips(c, slips);
    let slide = 0;
    for (let k = 0; k < n; k++) {
      slide += slips[k].slide * slips[k].share;
      if (slips[k].share > 0 && slips[k].slide > 0.6 && c.speed > 0.5) {
        const w = slips[k].share * slips[k].slide;
        acc.ahead += w * ((slips[k].across.x * c.vx + slips[k].across.z * c.vz) / c.speed);
        acc.aheadW += w;
      }
    }
    let alive = 0;
    for (let j = 0; j < pool.cap; j++) if (pool.alpha[j] > 0.004) alive++;
    acc.n++;
    acc.alive += alive;
    acc.slide += slide;
    acc.ridden += c.speed;
  }
  const last = pool.stats();
  tally.thrown += last.thrown;
  tally.launch += last.launch;
  const window = frames * FRAME;
  const m = (v) => (acc.n ? v / acc.n : 0);
  return {
    id: `${pair}/${kind}/${moveName}/${kmh}`,
    pair,
    snow: kind,
    move: moveName,
    kmh,
    ridden: m(acc.ridden) * 3.6,
    rate: window > 0 ? tally.thrown / window : 0,
    alive: m(acc.alive),
    launch: tally.thrown ? tally.launch / tally.thrown : 0,
    high: tally.done ? tally.high / tally.done : 0,
    reach: tally.done ? tally.reach / tally.done : 0,
    slide: m(acc.slide),
    ahead: acc.aheadW > 0 ? acc.ahead / acc.aheadW : null,
  };
}

const pairs = args.skis.split(",");
const kinds = args.snow.split(",");
const moves = args.moves.split(",");
for (const mv of moves) {
  if (!MOVES.includes(mv)) {
    console.error(`unknown move "${mv}" (${MOVES.join(", ")})`);
    process.exit(2);
  }
}
const speeds = args.speeds.split(",").map(Number);
const rows = [];
for (const p of pairs)
  for (const k of kinds) {
    if (!SNOW[k]) {
      console.error(`unknown snow "${k}"`);
      process.exit(2);
    }
    for (const mv of moves) for (const v of speeds) rows.push(measure(p, k, mv, v));
  }

const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const pad = (s, n) => String(s).padStart(n);
const fmt = (v, d) => (v === null || !Number.isFinite(v) ? "—" : v.toFixed(d));
console.log("spray metrics · the heavy spray a turn throws, flown as spray.ts flies it");
console.log(
  [
    "pair/snow/move".padEnd(24),
    pad("km/h", 5),
    pad("ridden", 7),
    pad("grains/s", 14),
    pad("alive", 7),
    pad("launch", 7),
    pad("high m", 7),
    pad("reach m", 8),
    pad("slide", 6),
    pad("ahead", 6),
  ].join(""),
);
for (const r of rows) {
  const old = before?.find((b) => b.id === r.id);
  const rate = old ? `${fmt(old.rate, 0)}→${fmt(r.rate, 0)}` : fmt(r.rate, 0);
  console.log(
    [
      `${r.pair}/${r.snow}/${r.move}`.padEnd(24),
      pad(r.kmh, 5),
      pad(fmt(r.ridden, 0), 7),
      pad(rate, 14),
      pad(fmt(r.alive, 0), 7),
      pad(fmt(r.launch, 1), 7),
      pad(fmt(r.high, 2), 7),
      pad(fmt(r.reach, 2), 8),
      pad(fmt(r.slide, 1), 6),
      pad(fmt(r.ahead, 2), 6),
    ].join(""),
  );
}
if (args.json) writeFileSync(args.json, JSON.stringify(rows, null, 1));

#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW MASS LAB (`make snow-mass`): the spray WEIGHED — how many
// kilograms of snow a turn or a stop throws, how deep the edge cut to throw
// it, and where it went (how high the grains rose and how far they came
// down), each row held to the band a real one sits in. Every row is a ride
// the real engine skis on a synthetic strip (`tests/support/synthetic.ts`),
// every frame flown through the `mass` spray model (`spray-mass.ts`) at 60
// frames a second, as the renderer flies it.
//
// THE BANDS are the research's (the hardness and densities of skiing
// mechanics' field work, the grains and fall speeds of the settling laws,
// and what film of real stops and turns shows): a hockey stop off a groomer
// throws 10–25 kg in a fan under the hip that reaches 1.5–3.5 m; off ice,
// under a kilo and a half of dust that barely leaves the snow; off spring
// snow, 20–60 kg of heavy clumps thrown short; a carve on the groomer a
// flick of a few hundred grams; powder thrown over the head (new snow's
// grains to the chest, the cloud — `dustOf` — the rest). A row outside
// its band is printed with a cross. Pure Node, seconds.
//
//   node scripts/snow-mass-lab.mjs
//   node scripts/snow-mass-lab.mjs --rows=stop/groomed,stop/ice --json=a.json
//   node scripts/snow-mass-lab.mjs --compare=a.json

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
    rows: {
      kind: "string",
      default: "",
      help: "only these rows (move/snow[/pair], comma-separated)",
    },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: { kind: "string", default: "", help: "a JSON table to print the change against" },
  },
  "usage: node scripts/snow-mass-lab.mjs [--rows=a,b] [--json=f] [--compare=f]",
);

aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));
const M = await import(join(root, "pwa/src/game/spray-mass.ts"));
const MP = await import(join(root, "pwa/src/game/spray-mass-pool.ts"));
const P = await import(join(root, "pwa/src/game/spray-sim.ts"));
const { SNOW } = await import(join(root, "pwa/src/game/snowpack.ts"));
const H = await import(join(root, "pwa/src/game/hold-input.ts"));

/** THE ROWS: a move on a snow from a speed on a pair, and the bands it is
 * held to — kilograms thrown (the whole ride), the grains' p90 height over
 * the snow and their p90 reach, m. */
const ROWS = [
  {
    move: "stop",
    snow: "groomed",
    pair: "chamois",
    kmh: 40,
    kg: [10, 25],
    high: [0.3, 1.2],
    reach: [1.5, 3.5],
  },
  {
    move: "stop",
    snow: "hard",
    pair: "chamois",
    kmh: 40,
    kg: [8, 30],
    high: [0.3, 1.2],
    reach: [1.2, 3.5],
  },
  {
    move: "stop",
    snow: "ice",
    pair: "chamois",
    kmh: 40,
    kg: [0, 1.5],
    high: [0, 0.35],
    reach: [0, 1.5],
  },
  {
    move: "stop",
    snow: "wet",
    pair: "chamois",
    kmh: 40,
    kg: [20, 60],
    high: [0.2, 0.8],
    reach: [0.8, 2.5],
  },
  {
    move: "stop",
    snow: "soft",
    pair: "chamois",
    kmh: 40,
    kg: [25, 120],
    high: [0.8, 2.5],
    reach: [1, 3.5],
  },
  {
    move: "stop",
    snow: "new",
    pair: "chamois",
    kmh: 40,
    kg: [8, 120],
    high: [0.8, 3],
    reach: [0.8, 3.5],
  },
  {
    move: "carve",
    snow: "groomed",
    pair: "chamois",
    kmh: 50,
    kg: [0, 3],
    high: [0.05, 0.6],
    reach: [0.2, 2.5],
  },
  {
    move: "carve",
    snow: "soft",
    pair: "chamois",
    kmh: 50,
    kg: [2, 60],
    high: [0.3, 2.5],
    reach: [0.5, 4],
  },
  {
    move: "stop",
    snow: "groomed",
    pair: "lynx",
    kmh: 40,
    kg: [8, 30],
    high: [0.3, 1.5],
    reach: [1.5, 3.5],
  },
  {
    move: "stop-left",
    snow: "groomed",
    pair: "lynx",
    kmh: 40,
    kg: [8, 30],
    high: [0.3, 1.5],
    reach: [1.2, 3.5],
  },
  {
    move: "stop",
    snow: "soft",
    pair: "lynx",
    kmh: 40,
    kg: [12, 150],
    high: [0.8, 2.8],
    reach: [1, 4],
  },
];

const FRAME = 1 / 60;
const pitchFor = (kmh) => Math.tan(((kmh <= 30 ? 7 : kmh <= 50 ? 10 : 14) * Math.PI) / 180);
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : NaN;
};
const p90 = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.9))];
};

function measure(row) {
  const spec = E.pairById(row.pair);
  const snow = SNOW[row.snow];
  const packed = ["groomed", "hard", "ice"].includes(row.snow) ? 1 : 0;
  const stop = row.move.startsWith("stop");
  const level = S.flatLevel(
    stop ? { packed } : { packed, grade: pitchFor(row.kmh), slopeFrom: 200, size: 4000 },
  );
  const state = E.createGame({ level, spec, rivals: 0, countdown: 0, quiet: true });
  E.placeRun(
    state,
    stop
      ? { x: 1500, z: 200, heading: 0, speed: row.kmh / 3.6 }
      : { x: 2000, z: 600, heading: 0, speed: row.kmh / 3.6 },
  );
  const heights = [];
  const reaches = [];
  // WHICH WAY IT WAS THROWN: every parcel's launch against the ground, off
  // the way the skier was going when the ride began (+z) — its way along
  // the snow, summed, and its rise off the snow, each.
  let wayX = 0;
  let wayZ = 0;
  let ahead = 0;
  let thrown = 0;
  const rises = [];
  const pool = MP.createMassPool(30000, {
    spawn: (i) => {
      const vx = pool.vel[i * 3];
      const vy = pool.vel[i * 3 + 1];
      const vz = pool.vel[i * 3 + 2];
      const flat = Math.hypot(vx, vz);
      if (flat < 0.3) return;
      wayX += vx / flat;
      wayZ += vz / flat;
      // Ahead of the skier: faster down his way than he goes.
      if (vz > state.skier.vz) ahead++;
      thrown++;
      rises.push((Math.atan2(vy, flat) * 180) / Math.PI);
    },
    retire: (_i, peak, reach) => {
      heights.push(peak);
      reaches.push(reach);
    },
  });
  const slips = [P.emptySlip(), P.emptySlip()];
  const seconds = stop ? 2.6 : 5;
  const t0 = state.t;
  let kg = { cut: 0, shove: 0, bow: 0, lip: 0, burst: 0, dust: 0, berm: 0 };
  let peakRate = 0;
  let depth = 0;
  let depthN = 0;
  let parcels = 0;
  let alive = 0;
  let ms = 0;
  let frames = 0;
  const steps = Math.round(seconds * E.TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    const t = state.t - t0;
    let input = H.holdInput(state, row.kmh, 0, stop ? "stop" : row.move, t);
    if (row.move === "stop-left" && t >= 0.35) input = { ...input, steer: -1 };
    E.step(state, input);
    if (i % 2 === 1) continue;
    const a = performance.now();
    pool.emit(state.skier, level, FRAME, 0, snow);
    pool.step(FRAME, level);
    ms += performance.now() - a;
    frames++;
    const w = pool.weighed();
    const frameKg = w.cut + w.shove + w.bow + w.lip;
    peakRate = Math.max(peakRate, frameKg / FRAME);
    for (const k of Object.keys(kg)) kg[k] += w[k];
    parcels += pool.stats().thrown;
    let live = 0;
    for (let j = 0; j < pool.cap; j++) if (pool.alpha[j] > 0.004) live++;
    alive = Math.max(alive, live);
    // How deep the loaded edge cut while it slid.
    const n = P.edgeSlips(state.skier, slips);
    for (let k = 0; k < n; k++) {
      const e = slips[k];
      if (e.share < 0.5 || e.slide < 1) continue;
      const load =
        state.skier.contacts.reduce((s, c) => s + (c.touching ? c.load : 0), 0) * e.share;
      const len = Math.hypot(e.tip.x - e.tail.x, e.tip.z - e.tail.z);
      depth += M.edgeDepth(load, state.skier.edge, len, M.hardnessOf(snow));
      depthN++;
    }
  }
  // Let the last of it come down.
  for (let i = 0; i < 180; i++) pool.step(FRAME, level);
  return {
    id: `${row.move}/${row.snow}/${row.pair}`,
    kmh: row.kmh,
    kg: kg.cut + kg.shove + kg.bow + kg.lip,
    berm: kg.berm ?? 0,
    way: thrown ? (Math.atan2(Math.abs(wayX), wayZ) * 180) / Math.PI : NaN,
    rise: rises.length ? median(rises) : NaN,
    outrun: thrown ? ahead / thrown : NaN,
    by: { cut: kg.cut, shove: kg.shove, lip: kg.lip, bow: kg.bow },
    peakRate,
    dust: kg.dust,
    depthMm: depthN ? (depth / depthN) * 1000 : 0,
    high: p90(heights),
    top: heights.length ? Math.max(...heights) : 0,
    reach: p90(reaches),
    parcels,
    alive,
    msPerFrame: ms / Math.max(1, frames),
    bands: { kg: row.kg, high: row.high, reach: row.reach },
  };
}

const want = args.rows.split(",").filter(Boolean);
const rows = ROWS.filter(
  (r) => !want.length || want.some((w) => `${r.move}/${r.snow}/${r.pair}`.startsWith(w)),
).map(measure);
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const fmt = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : "—");
const inBand = (v, b) => v >= b[0] && v <= b[1];
const cell = (v, b, d, w) => `${fmt(v, d)}${inBand(v, b) ? " " : "✗"}`.padStart(w);
console.log("snow mass lab · the spray weighed (✗ outside the band a real one sits in)");
console.log(
  [
    "move/snow/pair".padEnd(26),
    "km/h".padStart(5),
    "kg".padStart(9),
    "peak kg/s".padStart(10),
    "dust kg".padStart(8),
    "edge mm".padStart(8),
    "p90 high m".padStart(11),
    "p90 reach m".padStart(12),
    "parcels".padStart(8),
    "alive".padStart(6),
    "ms/frame".padStart(9),
    "way°".padStart(6),
    "rise°".padStart(6),
    "ahead".padStart(6),
  ].join(""),
);
let out = 0;
for (const r of rows) {
  const old = before?.find((b) => b.id === r.id);
  const ok =
    inBand(r.kg, r.bands.kg) && inBand(r.high, r.bands.high) && inBand(r.reach, r.bands.reach);
  if (!ok) out++;
  console.log(
    [
      r.id.padEnd(26),
      String(r.kmh).padStart(5),
      cell(r.kg, r.bands.kg, 1, 9),
      fmt(r.peakRate, 1).padStart(10),
      fmt(r.dust, 2).padStart(8),
      fmt(r.depthMm, 1).padStart(8),
      cell(r.high, r.bands.high, 2, 11),
      cell(r.reach, r.bands.reach, 2, 12),
      String(r.parcels).padStart(8),
      String(r.alive).padStart(6),
      fmt(r.msPerFrame, 3).padStart(9),
      fmt(r.way, 0).padStart(6),
      fmt(r.rise, 0).padStart(6),
      fmt(r.outrun, 2).padStart(6),
      `  top ${fmt(r.top, 1)} cut ${fmt(r.by.cut, 1)} shove ${fmt(r.by.shove, 1)} lip ${fmt(r.by.lip, 1)} bow ${fmt(r.by.bow, 1)} berm ${fmt(r.berm, 1)}`,
    ].join("") +
      (old ? `   was ${fmt(old.kg, 1)} kg, ${fmt(old.high, 2)} / ${fmt(old.reach, 2)} m` : ""),
  );
}
console.log(`${rows.length - out} of ${rows.length} rows inside every band`);
if (args.json) writeFileSync(args.json, JSON.stringify(rows, null, 1));

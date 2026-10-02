#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDE LAB — the skier on the snow, in sequence, drawn as a diagram.
//
// `npm run sim` counts jumps and tree hits and a screenshot shows one frame
// of one; neither answers what the skier was DOING at each moment — how he
// stood, how fast he got going, when he came up onto the powder, at what
// angle he left the lip and how hard he came down. So this stages one
// scenario (`lib/ride-scenarios.mjs`) on a SYNTHETIC map with `placeRun`,
// skis it with a scripted input through the real engine at 120 Hz (no
// renderer, no browser — the engine and a PNG canvas), prints the numbers
// that decide the feel, and draws the run (`lib/ride-draw.mjs`).
//
//   npm run ride                       every scenario, one table
//   npm run ride -- kicker             one scenario
//   npm run ride -- schuss --seconds 30
//   npm run ride -- --skis eagle       one pair of the catalog
//   npm run ride -- --skis all         every scenario on every pair, one table
//   npm run ride -- --card             THE ROSTER CARD: one row a pair, the
//                                      figures that tell the classes apart
//   npm run ride -- backflip           a trick scenario (backflip, frontflip,
//                                      spin, pose, kicker-flip), skied in a
//                                      tricks run and scored
//
// Writes previews/ride-<scenario>.png. Required before and after any change
// to the legs, the snow, the poles, the edge, the skid or the air.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { drawRun } from "./lib/ride-draw.mjs";
import { SCENARIOS, SCENARIO_IDS } from "./lib/ride-scenarios.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));

const args = parseArgs(
  process.argv.slice(2),
  {
    scenario: { kind: "string", help: `which (${SCENARIO_IDS.join(", ")}); a bare word works too` },
    seconds: { kind: "number", help: "how long to ski (the scenario's own when left out)" },
    skis: {
      kind: "string",
      default: "chamois",
      help: `the pair (${E.SKI_CATALOG.map((s) => s.id).join(", ")}), or all`,
    },
    resilience: {
      kind: "number",
      default: 1,
      help: "how much the skier can take before he goes down: 0 a club skier, 1 a professional",
    },
    "no-png": { kind: "flag", help: "print the numbers, draw nothing" },
    card: {
      kind: "flag",
      help: "the roster card: one row a pair (every pair unless --skis names one)",
    },
    out: { kind: "string", default: "previews", help: "where the pictures go" },
  },
  "usage: npm run ride -- [scenario] [--skis id|all] [--seconds s] [--resilience 0..1] [--no-png] [--out dir]",
);

if (args.skis !== "all" && !E.isSkiId(args.skis)) {
  console.error(`unknown skis "${args.skis}" (${E.SKI_CATALOG.map((s) => s.id).join(", ")}, all)`);
  process.exit(2);
}
const roster =
  args.skis === "all" || (args.card && args.skis === "chamois" && !process.argv.includes("--skis"))
    ? E.SKI_CATALOG
    : [E.skisById(args.skis)];

const wanted = args.scenario ?? args._[0];
if (wanted && !SCENARIO_IDS.includes(wanted)) {
  console.error(`unknown scenario "${wanted}" (${SCENARIO_IDS.join(", ")})`);
  process.exit(2);
}
const chosen = wanted ? SCENARIOS.filter((s) => s.id === wanted) : SCENARIOS;

/** Ski a scenario and keep a frame every step. */
function record(scenario, spec) {
  const level = scenario.level(S);
  const state = E.createGame({
    level,
    mode: scenario.mode,
    snowDepth: scenario.snow,
    rivals: 0,
    countdown: 0,
    spec,
    resilience: args.resilience,
    quiet: true,
  });
  E.placeRun(state, scenario.place(S));
  // A scenario that needs a moment placeRun cannot stand — the skis slid
  // across the way, an edge already stood up — sets it here.
  scenario.prepare?.(state, S);
  const seconds = args.seconds ?? scenario.seconds;
  const frames = [];
  const events = [];
  const c = state.skier;
  let dist = 0;
  const t0 = state.t;
  const steps = Math.round(seconds * E.TUNING.physicsHz);
  // The boot's station on the left ski: what the sink is read off.
  const probe = c.contacts.findIndex((k) => k.station === "mid");
  for (let i = 0; i <= steps; i++) {
    const t = state.t - t0;
    if (i > 0) {
      const x0 = c.x;
      const z0 = c.z;
      E.step(state, scenario.input(t, state));
      dist += Math.hypot(c.x - x0, c.z - z0);
      for (const e of state.events) events.push({ ...e, t: e.t - t0 });
    }
    frames.push({
      t: state.t - t0,
      x: c.x,
      y: c.y,
      z: c.z,
      dist,
      ground: level.groundAt(c.x, c.z),
      sink: c.sinks[probe],
      speed: c.speed,
      way: c.way,
      edge: c.edge,
      skid: c.skid,
      crouch: c.crouch,
      sideSlip: c.sideSlip,
      heading: c.heading,
      wy: c.wy,
      // The share of the skier's load on the tips — what the lean moves.
      tipLoad:
        c.contacts.reduce((sum, p) => sum + (p.station === "tip" ? p.load : 0), 0) /
        Math.max(
          1,
          c.contacts.reduce((sum, p) => sum + p.load, 0),
        ),
      pitch: c.pitch,
      roll: c.roll,
      airborne: c.airborne,
      skiComp: (c.skiCompression[0] + c.skiCompression[1]) / 2,
      trench: c.trench,
      // His body, once he is off the skis (`crash.ts`).
      thrown: c.thrown !== null,
      rx: c.thrown ? c.thrown.x : c.x,
      ry: c.thrown ? c.thrown.y : c.y,
      rz: c.thrown ? c.thrown.z : c.z,
      tumble: c.thrown ? c.thrown.tumble : 0,
    });
  }
  return { frames, events, trees: level.trees };
}

/** THE ROSTER CARD's columns: a scenario, the figure off its table, and the
 * heading it is printed under. Each is a figure the scenario already
 * measures, so the card and the full table can never disagree. */
const CARD = [
  ["schuss", "top km/h", "top"],
  ["schuss", "0-100 km/h s", "0-100"],
  ["powder", "0-50 km/h s", "pow 0-50"],
  ["powder", "planed at km/h", "planes"],
  ["turn-in", "settled g", "g @80"],
  ["turn-in", "to 90% yaw s", "turn-in"],
  ["carve-powder", "lateral g", "pow g"],
  ["hockey-stop", "stop m", "stop m"],
  ["kicker", "harsh", "kicker"],
  ["climb", "climbed m", "climb m"],
];

if (args.card) {
  console.log(`ride lab — the roster card, engine ${E.engineVersion}\n`);
  const head = ["skis", ...CARD.map((c) => c[2])];
  const rows = [head];
  for (const spec of roster) {
    const cache = new Map();
    const row = [`${spec.id} (${spec.kind.toLowerCase()})`];
    for (const [id, label] of CARD) {
      if (!cache.has(id)) {
        const scenario = SCENARIOS.find((s) => s.id === id);
        cache.set(id, new Map(scenario.measure(record(scenario, spec))));
      }
      row.push(String(cache.get(id).get(label) ?? "—"));
    }
    rows.push(row);
  }
  const widths = head.map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  for (const r of rows) console.log("  " + r.map((v, i) => v.padEnd(widths[i])).join("  "));
  process.exit(0);
}

console.log(`ride lab — engine ${E.engineVersion} at ${E.TUNING.physicsHz} Hz · skis ${args.skis}`);
if (!args["no-png"]) mkdirSync(join(root, args.out), { recursive: true });
for (const scenario of chosen) {
  console.log(`\n${scenario.id.padEnd(13)} ${scenario.title}`);
  for (const spec of roster) {
    const run = record(scenario, spec);
    const lines = scenario.measure(run);
    const who = roster.length > 1 ? `${spec.id.padEnd(10)} ` : "";
    console.log("  " + who + lines.map(([k, v]) => `${k} ${v}`).join(" · "));
    if (!args["no-png"]) {
      const tag = roster.length > 1 || spec.id !== "chamois" ? `-${spec.id}` : "";
      const file = join(root, args.out, `ride-${scenario.id}${tag}.png`);
      writeFileSync(file, drawRun(run, scenario, lines));
    }
  }
}
if (!args["no-png"]) console.log(`\nwrote ${args.out}/ride-*.png`);

#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DAMAGE LAB (`make damage`): the HUD's BODY PANEL and G METER as the
// player reads them — the anatomy figure with its flesh and its bones, the
// word, the lines under it — drawn by the game's own components and
// stylesheets (`hud-body.tsx`, `body-figure.ts`, `body-tile.ts`,
// `body.css`) over bodies of two kinds:
//
//   STAGED   built injury by injury off the engine's catalog in the page
//            (sound, bruises, hairlines, breaks, organs, a trunk at speed,
//            every bone cracked, every bone broken);
//   RIDDEN   a ride-lab scenario (`lib/ride-scenarios.mjs`) skied through
//            the real engine here, the body kept at its WORST moment —
//            before the reset that mends him.
//
// It writes `previews/damage-<sheet>.png` and prints each body's facts —
// its injury severity score, what its bones show and what its lines say:
//
//   panels     every body in a 1280×720 frame, the panel's strip of it
//   viewports  one body (`--case`) at 1280×720, 390×844 and 844×390, whole
//   plate      the figure enlarged: sound, every bone cracked, every bone
//              broken, a trunk at speed
//   force      the figure enlarged with every bone fractured at one energy
//              a column: a hairline, a simple break struck lightly and
//              harder, a wedge, shattered, shattered hard
//   closeup    the force ladder up close, a window a row: the shoulder and
//              arm, the pelvis and thighs, the shins
//   blows      HIGH-G CRASHES skied through the engine, the figure enlarged
//              over each: a trunk head-on and a trunk on the shoulder at
//              rising speeds, a fall onto his side from rising heights, a
//              drop flat onto the skis — every fracture printed with the
//              energy that did it over its even chance's
//   refs       the enlarged figure over every image in `--refs=DIR`, each
//              cropped to the figure's box (92 × 211, head up) — the way to
//              check a trace. References stay LOCAL: never committed.
//
//   node scripts/damage-preview.mjs                          every sheet
//   node scripts/damage-preview.mjs --sheet=panels --scenarios=tree,drop-big
//   node scripts/damage-preview.mjs --sheet=viewports --case=broken
//   node scripts/damage-preview.mjs --sheet=force,blows
//   node scripts/damage-preview.mjs --sheet=refs --refs=/path/to/crops

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

import { SCENARIOS, SCENARIO_IDS } from "./lib/ride-scenarios.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".damage-preview");
const outDir = join(root, "previews");
const SHEETS = ["panels", "viewports", "plate", "back", "force", "closeup", "blows", "refs"];

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: {
      kind: "string",
      default: "",
      help: `the sheets (${SHEETS.join(", ")}), comma-separated; every one but refs when left out`,
    },
    scenarios: {
      kind: "string",
      default: "tree,tree-glance,shoulder,nose-in,catch,drop-side,rollover,drop-big",
      help: "the ride-lab scenarios skied for a ridden body each, comma-separated ('' none)",
    },
    case: { kind: "string", default: "tree", help: "the body the viewports sheet draws" },
    refs: {
      kind: "string",
      default: "",
      help: "a directory of local reference images (refs sheet)",
    },
    "skip-build": { kind: "flag", default: false, help: "reuse the last bundle" },
    timeout: { kind: "number", default: 120, help: "seconds a sheet may take" },
  },
  "usage: node scripts/damage-preview.mjs [--sheet=panels,viewports,plate,back,force,closeup,blows,refs] [--scenarios=a,b] [--case=id] [--refs=DIR]",
);

const sheets = args.sheet ? args.sheet.split(",") : SHEETS.filter((s) => s !== "refs" || args.refs);
const bad = sheets.find((s) => !SHEETS.includes(s));
if (bad) {
  console.error(`unknown sheet "${bad}" (${SHEETS.join(", ")})`);
  process.exit(2);
}
const wanted = args.scenarios ? args.scenarios.split(",") : [];
const unknown = wanted.find((s) => !SCENARIO_IDS.includes(s));
if (unknown) {
  console.error(`unknown scenario "${unknown}" (${SCENARIO_IDS.join(", ")})`);
  process.exit(2);
}

// THE RIDDEN BODIES: each scenario skied through the engine, the body kept
// at its worst — the highest severity, then the most injuries — before
// anything mends it.
aliasEngine(root);
const E = await import(join(root, "engine/index.ts"));
const S = await import(join(root, "tests/support/synthetic.ts"));
/** One scenario skied, the body at its worst. */
function ride(id, title, scenario) {
  const state = E.createGame({
    level: scenario.level(S),
    mode: scenario.mode,
    snowDepth: scenario.snow,
    rivals: 0,
    countdown: 0,
    quiet: true,
  });
  E.placeRun(state, scenario.place(S));
  scenario.prepare?.(state, S);
  const t0 = state.t;
  let best = structuredClone(state.skier.body);
  let rank = [0, 0];
  const steps = Math.round(Math.max(scenario.seconds, 4) * E.TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    E.step(state, scenario.input(state.t - t0, state));
    const b = state.skier.body;
    const r = [E.severityOf(b), b.injuries.length];
    // A worse body, or the same one with a fracture struck harder since.
    if (r[0] > rank[0] || (r[0] === rank[0] && r[1] > rank[1]) || harder(b, best)) {
      rank = r;
      best = structuredClone(b);
    }
  }
  // Read a second after the last injury, so nothing is still blinking.
  const last = best.injuries.reduce((m, h) => Math.max(m, h.t), 0);
  return { id, title, body: best, t: last + 5, peak: state.skier.body.fallPeak };
}

/** Whether `b` is `was` with a fracture struck harder. */
function harder(b, was) {
  if (b.injuries.length !== was.injuries.length) return false;
  return b.injuries.some((h, i) => (h.energy ?? 1) > (was.injuries[i].energy ?? 1));
}

const ridden = wanted.map((id) =>
  ride(
    `ride:${id}`,
    `RIDDEN: ${id}`,
    SCENARIOS.find((s) => s.id === id),
  ),
);

// THE HIGH-G CRASHES: the ride lab's own scenarios, harder and harder.
const by = (id) => SCENARIOS.find((s) => s.id === id);
const BLOWS = [
  ...[50, 80, 110, 140].map((kmh) => [
    `trunk-${kmh}`,
    `A TRUNK HEAD-ON AT ${kmh} KM/H`,
    { ...by("tree"), place: (S) => ({ ...by("tree").place(S), speed: kmh / 3.6 }) },
  ]),
  ...[5, 9, 13].map((ms) => [
    `shoulder-${ms}`,
    `A TRUNK ON THE SHOULDER AT ${Math.round(ms * 3.6)} KM/H SIDEWAYS`,
    { ...by("shoulder"), prepare: (st) => void (st.skier.vx = ms) },
  ]),
  ...[2.5, 6, 12].map((h) => [
    `side-${h}`,
    `ONTO HIS SIDE FROM ${h} M AT 70 KM/H`,
    { ...by("drop-side"), place: () => ({ ...by("drop-side").place(), height: h }) },
  ]),
  ...[8, 16].map((h) => [
    `drop-${h}`,
    `FLAT ONTO THE SKIS FROM ${h} M`,
    { ...by("drop-big"), place: () => ({ ...by("drop-big").place(), height: h + 1 }) },
  ]),
];
const blows = sheets.includes("blows")
  ? BLOWS.map(([id, title, scenario]) => ride(`blow:${id}`, title, scenario))
  : [];
for (const b of blows) console.log(`  ${b.id.padEnd(16)} hardest fall ${b.peak.toFixed(0)} g`);

mkdirSync(outDir, { recursive: true });
if (!args["skip-build"] || !existsSync(join(buildDir, "damage-preview.html"))) {
  const { build } = await import("vite");
  await build({
    configFile: false,
    logLevel: "warn",
    root: join(root, "pwa"),
    base: "./",
    resolve: { alias: { "@engine": join(root, "engine", "index.ts") } },
    build: {
      outDir: buildDir,
      emptyOutDir: true,
      chunkSizeWarningLimit: 4000,
      rollupOptions: { input: join(root, "pwa", "damage-preview.html") },
    },
  });
}
// The references beside the page, this run's only.
const refs = [];
rmSync(join(buildDir, "refs"), { recursive: true, force: true });
if (args.refs) {
  const dir = resolve(args.refs);
  if (!existsSync(dir)) {
    console.error(`no directory at ${args.refs}`);
    process.exit(2);
  }
  mkdirSync(join(buildDir, "refs"), { recursive: true });
  for (const file of readdirSync(dir)
    .filter((f) => /\.(png|jpe?g|webp|svg)$/i.test(f))
    .sort()) {
    copyFileSync(join(dir, file), join(buildDir, "refs", file));
    refs.push(`refs/${file}`);
  }
}

const found = await findChromium();
if (!found) process.exit(1);
const server = await serveDir(buildDir);
const browser = await found.chromium.launch({ executablePath: found.executablePath });

let crashed = null;
for (const sheet of sheets) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", (err) => {
    crashed ??= err;
    console.error(`[pageerror] ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error(`[console] ${msg.text()}`);
  });
  page.setDefaultTimeout(args.timeout * 1000);
  const t0 = Date.now();
  await page.goto(
    `${server.url}damage-preview.html?sheet=${sheet}&case=${encodeURIComponent(args.case)}`,
  );
  await page.waitForFunction("window.__damage !== undefined");
  const cases = sheet === "blows" ? blows : ridden;
  const drawn = await page.evaluate(([r, f]) => globalThis.__damage.build(r, f), [cases, refs]);
  if (crashed) process.exit(1);
  const box = await page.locator("#sheet").boundingBox();
  if (box) {
    await page.setViewportSize({
      width: Math.max(800, Math.ceil(box.width)),
      height: Math.max(600, Math.ceil(box.height)),
    });
  }
  const out = join(outDir, `damage-${sheet}.png`);
  await page.locator("#sheet").screenshot({ path: out });
  console.log(
    `${out.replace(`${root}/`, "")}  ${drawn.note}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
  );
  for (const line of drawn.table) console.log(`  ${line}`);
  await page.close();
}
await browser.close();
await server.close();

#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REPLAY CAMERA LAB — a run ridden and recorded the way the app records
// one, then watched back through the app's own transport (the director
// pacing the picture and choosing the moment) on one rung of the watching
// ladder after another, photographed through the game's own renderer every
// `--every` wall seconds and MEASURED: how far the lens stands from the
// skier, how far off the middle of the frame he is, and whether the snow
// stands between them.
//
//   tree     skied into a lone trunk at 50 km/h — the instant replay of a crash
//   edge     an edge caught tucked on the steepest pitch
//   run      the bot down the top of the piste, watched from the start
//   finish   the bot through the finish line
//
// Each scene and rung is one contact sheet, previews/replaycam-<scene>-<rung>.png,
// and a line of the table: the median and the worst distance, the share of
// frames with him more than 20° off the axis, and the share behind the snow.
// `--json=FILE` writes the table, `--compare=FILE` prints it beside one.
//
//   node scripts/replaycam-preview.mjs                       # every scene, every rung
//   node scripts/replaycam-preview.mjs --scene=tree --rung=tv,close

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".replaycam-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    scene: {
      kind: "string",
      default: "",
      help: "which scenes, comma-separated (tree, edge, run, finish); every one when left out",
    },
    rung: {
      kind: "string",
      default: "",
      help: "which rungs of the watching ladder, comma-separated; the replay's own when left out",
    },
    seed: { kind: "number", default: 2, help: "the map's seed" },
    every: { kind: "number", default: 0.5, help: "wall seconds between two frames shot" },
    most: { kind: "number", default: 14, help: "the most wall seconds a recording is watched" },
    width: { kind: "number", default: 1280, help: "a frame's width, px" },
    height: { kind: "number", default: 720, help: "a frame's height, px" },
    cols: { kind: "number", default: 4, help: "tiles a row on a sheet" },
    scale: { kind: "number", default: 0.4, help: "a tile's size as a share of the frame" },
    json: { kind: "string", default: "", help: "write the table to this file" },
    compare: { kind: "string", default: "", help: "print the table beside one written by --json" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/replaycam-preview.mjs [--scene=a,b] [--rung=a,b] [--seed=n] [--json=f] [--compare=f]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "replaycam-preview.html"))) {
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
      chunkSizeWarningLimit: 2000,
      rollupOptions: { input: { lab: join(root, "pwa", "replaycam-preview.html") } },
    },
  });
}
cpSync(join(root, "pwa", "models"), join(buildDir, "models"), { recursive: true });

const found = await findChromium();
if (!found) process.exit(1);

const server = await serveDir(buildDir);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const viewport = { width: args.width, height: args.height };
const page = await browser.newPage({ viewport });
let crashed = null;
page.on("pageerror", (err) => {
  crashed ??= err;
  console.error(`[pageerror] ${err.message}`);
});
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") console.error(`[console] ${msg.text()}`);
});
page.setDefaultTimeout(args.timeout * 1000);

/** `work`, or a failure the moment the page throws. */
function guarded(work) {
  return Promise.race([
    work,
    new Promise((_, fail) => {
      const watch = setInterval(() => {
        if (crashed) {
          clearInterval(watch);
          fail(crashed);
        }
      }, 200);
      watch.unref();
    }),
  ]);
}

const query = new URLSearchParams({
  seed: String(args.seed),
  w: String(args.width),
  h: String(args.height),
  cols: String(args.cols),
  scale: String(args.scale),
  every: String(args.every),
  most: String(args.most),
}).toString();
await page.goto(`${server.url}replaycam-preview.html?${query}`);
await guarded(page.waitForFunction("window.__replaycam !== undefined"));
const note = await guarded(page.evaluate("window.__replaycam.ready"));
/** @type {string[]} */
const scenes = await page.evaluate("window.__replaycam.scenes");
/** @type {string[]} */
const rungs = await page.evaluate("window.__replaycam.rungs");
const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
const wantScenes = list(args.scene);
const wantRungs = list(args.rung);
for (const [want, have, what] of [
  [wantScenes, scenes, "scene"],
  [wantRungs, rungs, "rung"],
])
  for (const s of want)
    if (!have.includes(s)) {
      console.error(`unknown ${what} "${s}" (${have.join(", ")})`);
      process.exit(2);
    }

/** A recording's frames reduced to the table's row. */
function rowOf(measures) {
  const d = measures.map((m) => m.dist).sort((a, b) => a - b);
  const share = (f) => measures.filter(f).length / Math.max(1, measures.length);
  return {
    median: d[Math.floor(d.length / 2)] ?? 0,
    worst: d[d.length - 1] ?? 0,
    off: share((m) => m.off > 20),
    lost: share((m) => m.off > 35),
    snow: share((m) => m.blocked),
  };
}

console.log(`replay camera — seed ${args.seed}: ${note}`);
const table = {};
const pick = wantRungs.length ? wantRungs : rungs;
for (const scene of scenes) {
  if (wantScenes.length && !wantScenes.includes(scene)) continue;
  for (const rung of pick) {
    const t0 = Date.now();
    const { frames, measures } = await guarded(
      page.evaluate(([s, r]) => globalThis.__replaycam.sheet(s, r), [scene, rung]),
    );
    const box = await page.locator("#sheet").boundingBox();
    await page.setViewportSize({
      width: Math.max(args.width, Math.ceil(box.width)),
      height: Math.ceil(box.y + box.height),
    });
    const out = join(outDir, `replaycam-${scene}-${rung}.png`);
    await page.locator("#sheet").screenshot({ path: out });
    await page.setViewportSize(viewport);
    table[`${scene}/${rung}`] = rowOf(measures);
    console.log(
      `${out.replace(`${root}/`, "")}  ${frames.length} frames  (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
    );
  }
}

const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const pct = (v) => `${Math.round(v * 100)}%`.padStart(5);
const cell = (r) =>
  `${r.median.toFixed(1).padStart(6)} ${r.worst.toFixed(1).padStart(6)} ${pct(r.off)} ${pct(r.lost)} ${pct(r.snow)}`;
console.log(
  `\n${"scene/rung".padEnd(18)} median  worst  >20°  >35° snow${before ? "   | before" : ""}`,
);
for (const [k, r] of Object.entries(table)) {
  const b = before?.[k];
  console.log(`${k.padEnd(18)} ${cell(r)}${b ? `   | ${cell(b)}` : ""}`);
}
if (args.json) writeFileSync(args.json, `${JSON.stringify(table, null, 2)}\n`);

await browser.close();
await server.close();

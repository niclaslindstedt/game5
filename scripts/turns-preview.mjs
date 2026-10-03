#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TURNS LAB — the skier TURNING AND STOPPING as the game draws him, as
// labelled contact sheets: `previews/turns-<seed>-<view>.png`, one a lens.
// Each ROW is a move at a speed — ONE TURN held, linked CARVED turns, a
// SKIDDED turn, a HOCKEY STOP (the held moves of `hold-input.ts`, the ones
// a link's `?hold=` and the cloud lab ride) — and each COLUMN a moment of
// it, ridden on a real map's snow through the game's own renderer: the
// skis and the skier as every build draws them (the committed models), the
// tracks they cut, the spray and the cloud they throw.
//
// Every cell prints the speed, the inclination, each ski's share of the
// load and each ski's gap to the snow (`ski-stand.ts`): turning, both skis
// stay on the snow — the outside one carrying two thirds of him and more
// and throwing the snow — and the inside leg folds while the outside one
// stays long. The LOW lens, down at the snow behind him, is where a ski
// off the snow shows against the light.
//
// It exists because a turn and a stop are motions on a slope: whether the
// skis stay on the snow, which ski the spray comes off, how the body
// inclines over them — the skier lab (`make skier`) draws him over a
// plane, and a screenshot of the game is one moment of one camera. The
// page (`pwa/src/tools/turns-harness.ts`) does the drawing; this builds it
// into a one-off bundle (never deployed), serves it and photographs the
// sheets in a headless Chromium — `CHROMIUM_PATH` overrides where one is
// looked for.
//
//   node scripts/turns-preview.mjs
//   node scripts/turns-preview.mjs --views=low,side --moves=stop --speeds=30,60
//   node scripts/turns-preview.mjs --moves=turn,skid --times=0.5,1,1.5,2 --views=chase
//   node scripts/turns-preview.mjs --where=meadow --moves=carve --speeds=30,50
//   node scripts/turns-preview.mjs --seed=7 --at=0.6 --skip-build

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".turns-preview");
const outDir = join(root, "previews");
const VIEWS = ["chase", "low", "behind", "side", "front", "high"];

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed" },
    region: {
      kind: "string",
      default: "",
      help: "the kind of snow country (R21); alpine if unset",
    },
    moves: {
      kind: "string",
      default: "turn,carve,skid,stop",
      help: "the moves, rows (turn, carve, skid, stop, check, straight — hold-input.ts)",
    },
    speeds: {
      kind: "string",
      default: "25,50,75",
      help: "the speeds each move starts at, km/h, rows",
    },
    times: { kind: "string", default: "0.4,0.8,1.2,1.6,2,2.4", help: "the moments, s, columns" },
    views: {
      kind: "string",
      default: "chase,low",
      help: `the lenses, a sheet each (${VIEWS.join(", ")})`,
    },
    where: {
      kind: "string",
      default: "piste",
      help: "the stage: piste (its groomer) or meadow (the open powder off it)",
    },
    at: { kind: "number", default: 1 / 3, help: "how far down the piste the ride starts, 0..1" },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 360, help: "one cell's width, px" },
    height: { kind: "number", default: 240, help: "one cell's height, px" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a sheet may take, s" },
  },
  "usage: node scripts/turns-preview.mjs [--moves=a,b] [--speeds=a,b] [--times=a,b] [--views=a,b] [--where=piste|meadow] [--skip-build]",
);

const views = args.views.split(",").filter(Boolean);
for (const v of views) {
  if (!VIEWS.includes(v)) {
    console.error(`unknown view "${v}" (${VIEWS.join(", ")})`);
    process.exit(2);
  }
}
mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "turns-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "turns-preview.html") },
    },
  });
}

const found = await findChromium();
if (!found) process.exit(1);
const server = await serveDir(buildDir);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

let crashed = null;
for (const view of views) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (err) => {
    crashed ??= err;
    console.error(`[pageerror] ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error(`[console] ${msg.text()}`);
  });
  page.setDefaultTimeout(args.timeout * 1000);
  const query = new URLSearchParams({
    seed: String(args.seed),
    region: args.region,
    moves: args.moves,
    speeds: args.speeds,
    times: args.times,
    view,
    where: args.where,
    at: String(args.at),
    quality: args.quality,
    w: String(args.width),
    h: String(args.height),
  }).toString();
  const t0 = Date.now();
  await page.goto(`${server.url}turns-preview.html?${query}`);
  await page.waitForFunction("window.__turns !== undefined");
  await page.evaluate("window.__turns.ready");
  if (crashed) process.exit(1);
  const drawn = await page.evaluate(() => globalThis.__turns.sheet());
  if (crashed) process.exit(1);
  // An element's picture is clipped at the viewport: size it to the sheet.
  await page.setViewportSize({ width: drawn.w, height: drawn.h });
  const out = join(outDir, `turns-${args.seed}-${view}.png`);
  await page.locator("#sheet").screenshot({ path: out });
  console.log(
    `${out.replace(`${root}/`, "")}  ${drawn.rows}×${drawn.cols}: ${drawn.note}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
  );
  await page.close();
}
await browser.close();
await server.close();

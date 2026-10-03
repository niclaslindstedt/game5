#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWFALL LAB — the falling snow as a skier sees it at speed: every
// falling sky, ridden INTO its wind, WITH it and ACROSS it, at a ladder of
// speeds, as two labelled contact sheets and a table:
//
//   previews/snowfall-<seed>.png       the game's own frame of each ride
//   previews/snowfall-<seed>-flow.png  the flakes alone over black, several
//                                      frames laid over each other, so each
//                                      flake's way across the picture is a
//                                      track
//
// It exists because what the fall looks like is the sum of three motions —
// the wind carrying it, its own fall, and the lens running through it — and
// the last is the one a still of a race cannot show: at 100 km/h every
// flake should come at the lens at 100 km/h, streaming out of the point the
// skier is heading for, and no flake should be one the eye can follow. The
// table is the plan's arithmetic (`pwa/src/game/snowfall-plan.ts`, the same
// the shader is handed) for each cell: the lens's velocity measured off the
// lens, the wind, the air past the lens and how much of it comes AT it.
//
// The page (`pwa/src/tools/snowfall-harness.ts`) draws through the game's
// own renderer; this script builds it into a one-off bundle (never
// deployed), serves it and photographs the sheets in a headless Chromium —
// `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/snowfall-preview.mjs
//   node scripts/snowfall-preview.mjs --weathers=storm --rides=into --speeds=0,50,100,150
//   node scripts/snowfall-preview.mjs --camera=tips --sheets=flow --strobe=12 --json

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".snowfall-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map whose open meadow is ridden" },
    weathers: {
      kind: "string",
      default: "flurries,snow,storm",
      help: "the skies, rows (clear — the air's crystals alone — flurries, snow, storm)",
    },
    rides: {
      kind: "string",
      default: "into,with,across",
      help: "the ride's way to the wind, rows under each sky (into, with, across)",
    },
    speeds: { kind: "string", default: "0,30,60,100,140", help: "the speeds held, km/h — columns" },
    camera: { kind: "string", default: "chase", help: "the lens (tips, helmet, chase, far, high)" },
    sheets: { kind: "string", default: "frame,flow", help: "which sheets (frame, flow)" },
    strobe: { kind: "number", default: 8, help: "frames laid over each other on the flow sheet" },
    ride: { kind: "number", default: 1, help: "seconds ridden before the picture" },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 320, help: "one cell's width, px" },
    height: { kind: "number", default: 180, help: "one cell's height, px" },
    json: { kind: "flag", help: "print the table as JSON instead" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1200, help: "how long the whole run may take, s" },
  },
  "usage: node scripts/snowfall-preview.mjs [--seed=n] [--weathers=a,b] [--rides=a,b] [--speeds=a,b] [--camera=rung] [--sheets=frame,flow] [--json] [--skip-build]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "snowfall-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "snowfall-preview.html") },
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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

let crashed = null;
page.on("pageerror", (err) => {
  crashed ??= err;
  console.error(`[pageerror] ${err.message}`);
});
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") console.error(`[console] ${msg.text()}`);
});
page.setDefaultTimeout(args.timeout * 1000);

const query = new URLSearchParams({
  seed: String(args.seed),
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
  weathers: args.weathers,
  rides: args.rides,
  speeds: args.speeds,
  camera: args.camera,
  strobe: String(args.strobe),
  ride: String(args.ride),
}).toString();
const say = args.json ? () => {} : (line) => console.log(line);
say(
  `snowfall — seed ${args.seed}, ${args.weathers} × ${args.rides} the wind × ${args.speeds} km/h, ${args.camera}, ${args.quality} quality`,
);
const t0 = Date.now();
await page.goto(`${server.url}snowfall-preview.html?${query}`);
await page.waitForFunction("window.__snowfall !== undefined");
await page.evaluate("window.__snowfall.ready");
if (crashed) process.exit(1);

let cells = [];
for (const kind of String(args.sheets).split(",")) {
  if (kind !== "frame" && kind !== "flow") {
    console.error(`unknown sheet "${kind}" (frame, flow)`);
    process.exit(2);
  }
  // A long sheet is minutes of software rasterizing: size the viewport to
  // it, or the photograph is clipped at the page's edge.
  const drawn = await page.evaluate((k) => globalThis.__snowfall.sheet(k), kind);
  if (crashed) process.exit(1);
  const box = await page.locator("#sheet").boundingBox();
  await page.setViewportSize({
    width: Math.ceil(Math.max(1280, box?.width ?? 0)),
    height: Math.ceil(Math.max(720, box?.height ?? 0)),
  });
  const out = join(outDir, `snowfall-${args.seed}${kind === "frame" ? "" : `-${kind}`}.png`);
  await page.locator("#sheet").screenshot({ path: out });
  cells = await page.evaluate(() => globalThis.__snowfall.cells());
  say(`${out.replace(`${root}/`, "")}  ${drawn.rows}×${drawn.cols}: ${drawn.note}`);
}

if (args.json) {
  console.log(JSON.stringify({ seed: args.seed, camera: args.camera, cells }, null, 2));
} else {
  const pad = (s, n) => String(s).padStart(n);
  console.log(
    `\n${"sky".padEnd(9)}${"ride".padEnd(7)}${pad("km/h", 5)}${pad("skier", 7)}${pad("lens", 6)}${pad("wind", 6)}` +
      `${pad("air m/s", 9)}${pad("at lens", 9)}${pad("smear m", 9)}${pad("cross s", 9)}`,
  );
  for (const c of cells) {
    console.log(
      `${c.weather.padEnd(9)}${c.ride.padEnd(7)}${pad(c.kmh, 5)}${pad(c.skier.toFixed(0), 7)}${pad(c.lens.toFixed(0), 6)}` +
        `${pad(c.wind.toFixed(1), 6)}${pad(c.air.toFixed(1), 9)}${pad(c.toward.toFixed(1), 9)}` +
        `${pad(c.smear.toFixed(2), 9)}${pad(Number.isFinite(c.cross) ? c.cross.toFixed(2) : "—", 9)}`,
    );
  }
  console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

await browser.close();
await server.close();

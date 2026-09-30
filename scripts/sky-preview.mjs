#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY LAB — every weather R19 deals against every few hours of the
// clock, day and night, on ONE seed seen from ONE place, as a single
// labelled contact sheet: `previews/sky-<seed>.png`.
//
// It exists because a map is dealt one sky at one hour, so a screenshot of a
// race can only ever say whether that one sky is wrong — and the sky here is
// a LADDER (clear to blizzard, noon to midnight), which is judged side by
// side or not at all. The page does the drawing
// (`pwa/src/tools/sky-harness.ts`, through the game's own renderer): the map,
// its day and its latitude stay the seed's, and only the weather and the
// start hour move, so every cell is the same ground under a different sky.
// This script builds that page into a one-off bundle (never deployed),
// serves it, and photographs the sheet in a headless Chromium —
// `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/sky-preview.mjs
//   node scripts/sky-preview.mjs --seed=12 --hours=6,9,12,15,18 --view=vista
//   node scripts/sky-preview.mjs --weathers=overcast,blizzard,fog --skip-build

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".sky-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed (its day and latitude are kept)" },
    hours: {
      kind: "string",
      default: "0,3,6,9,12,15,18,21",
      help: "the start hours, solar, comma-separated — the sheet's columns",
    },
    weathers: {
      kind: "string",
      default: "",
      help: "only these rows (clear,fair,flurries,high,overcast,snow 0.4,storm,blizzard,fog,fair +8cm)",
    },
    view: { kind: "string", default: "chase", help: "chase (behind the grid) or vista (the rim)" },
    quality: {
      kind: "string",
      default: "high",
      help: "the picture preset (low, medium, high — settings-video.ts)",
    },
    width: { kind: "number", default: 320, help: "one cell's width, px" },
    height: { kind: "number", default: 180, help: "one cell's height, px" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1200, help: "how long the whole run may take, s" },
  },
  "usage: node scripts/sky-preview.mjs [--seed=n] [--hours=a,b] [--weathers=a,b] [--view=vista] [--skip-build]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "sky-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "sky-preview.html") },
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
  hours: args.hours,
  weathers: args.weathers,
  view: args.view,
}).toString();
console.log(`sky — seed ${args.seed}, ${args.view}, hours ${args.hours}, ${args.quality} quality`);
const t0 = Date.now();
await page.goto(`${server.url}sky-preview.html?${query}`);
await page.waitForFunction("window.__sky !== undefined");
await page.evaluate("window.__sky.ready");
if (crashed) process.exit(1);
const drawn = await page.evaluate(() => globalThis.__sky.sheet());
if (crashed) process.exit(1);
const out = join(outDir, `sky-${args.seed}${args.view === "chase" ? "" : `-${args.view}`}.png`);
await page.locator("#sheet").screenshot({ path: out });
console.log(
  `${out.replace(`${root}/`, "")}  ${drawn.rows}×${drawn.cols}: ${drawn.note}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
);

await browser.close();
await server.close();

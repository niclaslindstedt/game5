#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CONTRAILS LAB — the airliners' trails in the sky over ONE seed, drawn
// through the game's own renderer from a skier's eye on the snow, as a
// labelled contact sheet (`previews/contrails-<seed>-<sheet>.png`):
//
//   life   (the default) one trail through its life overhead and low: being
//          laid, a short one in dry air, and a persistent one at 1, 5, 15
//          and 40 minutes old
//   sky    the plan's own sky an hour into the run under a clear, a fair and
//          a humid high sky, and a cold and a warm air mass at the same
//          moment, up and toward the horizon both ways
//   dusk   a fresh, a fifteen- and a forty-minute trail through the evening,
//          toward the sun and up: the afternoon to the night
//
// Every cell is captioned with the air at 10.5 km and, for the plan's own
// sky, how many of the hour's flights trail and how many of those last.
// The page (`pwa/src/tools/contrails-harness.ts`) does the drawing; this
// script builds it into a one-off bundle (never deployed), serves it and
// photographs the sheet in a headless Chromium (`CHROMIUM_PATH`).
//
//   node scripts/contrails-preview.mjs
//   node scripts/contrails-preview.mjs --sheet=dusk --quality=low
//   node scripts/contrails-preview.mjs --sheet=sky --seed=7 --skip-build

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".contrails-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed (its day and latitude are kept)" },
    sheet: {
      kind: "string",
      default: "life",
      help: "life, sky, dusk or frames (plain in-game frames)",
    },
    hour: { kind: "number", default: 11, help: "the solar hour of the life and sky sheets" },
    quality: {
      kind: "string",
      default: "high",
      help: "the picture preset (low, medium, high, max — settings-video.ts)",
    },
    width: { kind: "number", default: 480, help: "one cell's width, px" },
    height: { kind: "number", default: 300, help: "one cell's height, px" },
    none: {
      kind: "flag",
      help: "the dusk sheet with no trails forced (the sky alone, to compare)",
    },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1200, help: "how long the whole run may take, s" },
  },
  "usage: node scripts/contrails-preview.mjs [--sheet=life|sky|dusk] [--seed=n] [--hour=h] [--quality=high] [--skip-build]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "contrails-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "contrails-preview.html") },
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
  sheet: args.sheet,
  hour: String(args.hour),
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
  none: args.none ? "1" : "0",
}).toString();
console.log(`contrails — seed ${args.seed}, ${args.sheet}, ${args.quality} quality`);
const t0 = Date.now();
await page.goto(`${server.url}contrails-preview.html?${query}`);
await page.waitForFunction("window.__contrails !== undefined");
await page.evaluate("window.__contrails.ready");
if (crashed) process.exit(1);
const drawn = await page.evaluate(() => globalThis.__contrails.sheet());
if (crashed) process.exit(1);
const out = join(outDir, `contrails-${args.seed}-${args.sheet}.png`);
await page.locator("#sheet").screenshot({ path: out });
for (const line of drawn.lines) console.log(`  ${line}`);
console.log(
  `${out.replace(`${root}/`, "")}  ${drawn.rows}×${drawn.cols}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
);

await browser.close();
await server.close();

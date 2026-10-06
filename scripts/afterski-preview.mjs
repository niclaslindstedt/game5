#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AFTERSKI LAB — a free ride on one seed drawn through the game's own
// renderer at the afterski's moments (`pwa/src/tools/afterski-harness.ts`):
// the lodges from the snow, the party inside at a few moments, the drunk
// picture through his own eyes at a ladder of buzz, and a buzzed fall worked
// off on foot as a strip of frames. Every view is a PNG in `previews/`
// (`afterski-<view>.png`). The page is built into a one-off bundle (never
// deployed), served and photographed in a headless Chromium —
// `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/afterski-preview.mjs
//   node scripts/afterski-preview.mjs --views=inside-4,inside-9,eyes-0.6
//   node scripts/afterski-preview.mjs --seed=7 --skip-build

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".afterski-preview");
const outDir = join(root, "previews");

const VIEWS = [
  "lodge",
  "lodge-near",
  "lodge-2",
  "inside-3",
  "inside-5",
  "inside-9",
  "inside-18",
  "eyes-0",
  "eyes-0.3",
  "eyes-0.6",
  "eyes-1",
  "chase-0.8",
  "fetch-0.5",
  "fetch-2.5",
  "fetch-6",
  "fetch-12",
  "fetch-20",
  "fetch-30",
];

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed" },
    hour: {
      kind: "number",
      default: -1,
      help: "the sun's solar hour; the map's own when left out",
    },
    views: {
      kind: "string",
      default: "",
      help: `only these views, comma-separated (${VIEWS.join(",")}; inside-<s>, eyes-<b>, chase-<b>, fetch-<s> at any figure)`,
    },
    width: { kind: "number", default: 1280, help: "picture width, px" },
    height: { kind: "number", default: 720, help: "picture height, px" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 900, help: "how long the whole run may take, s" },
  },
  "usage: node scripts/afterski-preview.mjs [--seed=n] [--hour=h] [--views=a,b] [--skip-build]",
);

mkdirSync(outDir, { recursive: true });
if (!args["skip-build"] || !existsSync(join(buildDir, "afterski-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "afterski-preview.html") },
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
const page = await browser.newPage({ viewport: { width: args.width, height: args.height } });
let crashed = null;
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
  w: String(args.width),
  h: String(args.height),
  ...(args.hour >= 0 ? { hour: String(args.hour) } : {}),
}).toString();
console.log(`afterski — seed ${args.seed}, ${args.width}×${args.height}`);
await page.goto(`${server.url}afterski-preview.html?${query}`);
await page.waitForFunction("window.__afterski !== undefined");
await page.evaluate("window.__afterski.ready");
if (crashed) process.exit(1);

const wanted = args.views ? args.views.split(",").map((v) => v.trim()) : VIEWS;
for (const view of wanted) {
  const t0 = Date.now();
  const shot = await page.evaluate((name) => globalThis.__afterski.shoot(name), view);
  if (crashed) process.exit(1);
  const out = join(outDir, `afterski-${args.hour >= 0 ? `h${args.hour}-` : ""}${view}.png`);
  await page.locator("body").screenshot({ path: out });
  console.log(
    `${out.replace(`${root}/`, "")}  ${shot.note}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
  );
}

await browser.close();
await server.close();

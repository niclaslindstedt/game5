#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE'S PICTURE LAB — the summer free ride's bike and its
// rider (`pwa/src/game/bike-view.ts`, `skier-bike.ts`, `camera-bike.ts`)
// ridden on the real engine by the bot and photographed through the game's
// own renderer at named moments: the camera ladder's rungs down a trail,
// close beside and ahead of him, in the air, thrown in a crash with the bike
// loose, afoot beside it, and in a chair's load zone and up the lift.
//
// One contact sheet, previews/<out>.png, and every frame alone,
// previews/<out>-<view>.png. The page (`pwa/src/tools/bike-harness.ts`) is
// built into a one-off bundle (never part of the app's build), served and
// driven in a headless Chromium — `CHROMIUM_PATH` overrides where one is
// looked for.
//
//   node scripts/bike-preview.mjs                      # every view, seed 38
//   node scripts/bike-preview.mjs --views=chase,side --trail=B2
//   node scripts/bike-preview.mjs --out-dir=/some/round1

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".bike-preview");

const args = parseArgs(
  process.argv.slice(2),
  {
    views: {
      kind: "string",
      default: "",
      help: "only these views, comma-separated (chase, tips, helmet, far, side, front, air, crash, tree, afoot, push, queue, lift, closeup, whip, table, footout, brake, snag, torn, safe)",
    },
    hour: { kind: "number", default: 11, help: "the solar hour" },
    seed: { kind: "number", default: 38, help: "the map's seed" },
    trail: { kind: "string", default: "B1", help: "the trail the bot rides (B1, B2, …)" },
    look: { kind: "string", default: "trail", help: "the bike and its rider: trail or freeride" },
    at: {
      kind: "number",
      default: 9,
      help: "seconds down the trail the riding shots are taken at",
    },
    "out-dir": { kind: "string", default: "", help: "where the pictures go (default previews/)" },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 1280, help: "a frame's width, px" },
    height: { kind: "number", default: 720, help: "a frame's height, px" },
    cols: { kind: "number", default: 4, help: "tiles a row on a sheet" },
    scale: { kind: "number", default: 0.5, help: "a tile's size as a share of the frame" },
    out: { kind: "string", default: "", help: "file stem under previews/ (no extension)" },
    "sheets-only": { kind: "flag", help: "write the contact sheet, not every frame alone" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long the sheet may take to draw, s" },
  },
  "usage: node scripts/bike-preview.mjs [--views=a,b] [--seed=n] [--trail=id] [--out-dir=dir] [--skip-build]",
);

const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const outDir = args["out-dir"] || join(root, "previews");
mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "bike-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "bike-preview.html") },
    },
  });
}
// The committed models (the skis) go beside the page, where the renderer
// fetches them.
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

const stem = args.out || `bike-${args.seed}`;
const query = new URLSearchParams({
  seed: String(args.seed),
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
  cols: String(args.cols),
  scale: String(args.scale),
  hour: String(args.hour),
  trail: args.trail,
  at: String(args.at),
  bikelook: args.look,
}).toString();
/** `work`, or a failure the moment the page throws — never the timeout
 * burnt on a page that died. */
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

await page.goto(`${server.url}bike-preview.html?${query}`);
await guarded(page.waitForFunction("window.__bike !== undefined"));
const note = await guarded(page.evaluate("window.__bike.ready"));
/** @type {string[]} */
const all = await page.evaluate("window.__bike.views");
const want = list(args.views);
const shot = want.length ? all.filter((v) => want.includes(v)) : all;
if (!shot.length) {
  console.error(`no view matches "${args.views}" (${all.join(", ")})`);
  process.exit(2);
}
console.log(`downhill bike — ${note}`);
const safe = (s) => s.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "");
const t0 = Date.now();
const { frames } = await guarded(page.evaluate((v) => globalThis.__bike.sheet(v), shot));
if (!args["sheets-only"]) {
  for (const f of frames) {
    const file = join(outDir, `${stem}-${safe(f.view)}.png`);
    writeFileSync(file, Buffer.from(f.png.split(",")[1], "base64"));
  }
}
// An element is photographed within the viewport: open it to the sheet.
const box = await page.locator("#sheet").boundingBox();
await page.setViewportSize({
  width: Math.max(args.width, Math.ceil(box.width)),
  height: Math.ceil(box.y + box.height),
});
const out = join(outDir, `${stem}.png`);
await page.locator("#sheet").screenshot({ path: out });
console.log(
  `${out.replace(`${root}/`, "")}  ${frames.length} frames  (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
);

await browser.close();
await server.close();

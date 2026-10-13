#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL RIDER'S STUDIO LAB — the procedural rig's bike and rider
// (`pwa/src/game/bike-dh-build.ts`, `bike-rider-build.ts`) on a studio floor,
// the rider solved by the game's own inverse kinematics (`bike-rider-ik.ts`)
// on the poses the bot rides down a real trail on the engine: cruising, the
// hardest turn, the deepest crouch, the longest flight, the hardest landing,
// the hardest braking and pedalling, each from the side, ahead and behind,
// and a filmstrip through the landing. Seconds where the world lab
// (`make bike ARGS=--rig=ik`) is minutes; that one judges the pair in game.
//
// One contact sheet, previews/<out>.png, and every frame alone.
//
//   node scripts/bike-rig-preview.mjs
//   node scripts/bike-rig-preview.mjs --trail=B2 --out-dir=/some/round1

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".bike-rig-preview");

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed" },
    trail: { kind: "string", default: "B1", help: "the trail the bot rides (B1, B2, …)" },
    for: { kind: "number", default: 40, help: "seconds of the trail ridden" },
    film: { kind: "number", default: 8, help: "frames in the landing's filmstrip" },
    "out-dir": { kind: "string", default: "", help: "where the pictures go (default previews/)" },
    width: { kind: "number", default: 960, help: "a frame's width, px" },
    height: { kind: "number", default: 720, help: "a frame's height, px" },
    cols: { kind: "number", default: 3, help: "tiles a row on a sheet" },
    scale: { kind: "number", default: 0.5, help: "a tile's size as a share of the frame" },
    out: { kind: "string", default: "", help: "file stem (no extension)" },
    "sheets-only": { kind: "flag", help: "write the contact sheet, not every frame alone" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 600, help: "how long the sheet may take to draw, s" },
  },
  "usage: node scripts/bike-rig-preview.mjs [--seed=n] [--trail=id] [--out-dir=dir] [--skip-build]",
);

const outDir = args["out-dir"] || join(root, "previews");
mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "bike-rig-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "bike-rig-preview.html") },
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

const stem = args.out || `bike-rig-${args.seed}`;
const query = new URLSearchParams({
  seed: String(args.seed),
  trail: args.trail,
  for: String(args.for),
  film: String(args.film),
  w: String(args.width),
  h: String(args.height),
  cols: String(args.cols),
  scale: String(args.scale),
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

await page.goto(`${server.url}bike-rig-preview.html?${query}`);
await guarded(page.waitForFunction("window.__rig !== undefined"));
const note = await guarded(page.evaluate("window.__rig.ready"));
console.log(`downhill rider studio — ${note}`);
const safe = (s) => s.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "");
const t0 = Date.now();
const { frames } = await guarded(page.evaluate(() => globalThis.__rig.sheet()));
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

#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CABLE GRIND LAB — a free ride with the skier dropped onto a lift's
// rope square across it and ridden on a script (a slide, a swap, a press, a pop with a
// 360 and back onto the rope, then on until a carrier throws him off),
// drawn through the game's own renderer and photographed a row a lens, a
// column a moment: `previews/grind-<lift>-<seed>.png`.
//
// The page (`pwa/src/tools/grind-harness.ts`) rides the script unbroken at
// sixty frames a second; this script builds it into a one-off bundle (never
// part of the app's build), serves it and drives it in a headless Chromium
// — `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/grind-preview.mjs
//   node scripts/grind-preview.mjs --skis=lynx          (the snowboard)
//   node scripts/grind-preview.mjs --land=along         (astride the rope: the straddle)
//   node scripts/grind-preview.mjs --lift=drag --views=side,chase
//   node scripts/grind-preview.mjs --at=0.5,1.5,3.3 --skip-build

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".grind-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed" },
    region: {
      kind: "string",
      default: "alpine",
      help: "the kind of snow country (R21): alpine, fell, continental, maritime",
    },
    lift: {
      kind: "string",
      default: "chair",
      help: "the lift whose rope is ground: chair, gondola, drag",
    },
    camera: {
      kind: "string",
      default: "chase",
      help: "the camera rung (chase, far, high, helmet, tips)",
    },
    at: { kind: "string", default: "", help: "the moments photographed, s from the drop" },
    views: {
      kind: "string",
      default: "side,back,front,chase",
      help: "the lenses a row each: side, back, front, top, chase (the game's camera)",
    },
    skis: {
      kind: "string",
      default: "",
      help: "the pair he rides by its id (lynx: the snowboard); the reference skis when left out",
    },
    land: {
      kind: "string",
      default: "across",
      help: "how the skis come down onto the rope: across (a slide) or along (astride it, the straddle)",
    },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 1280, help: "a frame's width, px" },
    height: { kind: "number", default: 720, help: "a frame's height, px" },
    scale: { kind: "number", default: 0.3, help: "a tile's size as a share of the frame" },
    out: { kind: "string", default: "", help: "file stem under previews/ (no extension)" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 900, help: "how long the whole run may take, s" },
  },
  "usage: node scripts/grind-preview.mjs [--seed=n] [--region=id] [--lift=kind] [--skis=id] [--views=…] [--at=s,…] [--skip-build]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "grind-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "grind-preview.html") },
    },
  });
}
// The committed models go beside the page, where the renderer fetches them.
cpSync(join(root, "pwa", "models"), join(buildDir, "models"), { recursive: true });

/** playwright-core from this tree, or else from the global install the web
 * sessions carry. */
async function loadChromium() {
  try {
    return (await import("playwright-core")).chromium;
  } catch {
    /* fall through */
  }
  try {
    const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    for (const name of ["playwright-core", "playwright"]) {
      try {
        const req = createRequire(join(globalRoot, "playwright", "package.json"));
        return req(name).chromium;
      } catch {
        /* next */
      }
    }
  } catch {
    /* fall through */
  }
  console.error("playwright-core is not installed — `npm i --no-save playwright-core`");
  process.exit(1);
}

const chromium = await loadChromium();
const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
if (!existsSync(executablePath)) {
  console.error(`no Chromium at ${executablePath} — set CHROMIUM_PATH`);
  process.exit(1);
}

const server = await serveDir(buildDir);
const browser = await chromium.launch({
  executablePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: args.width, height: args.height } });
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
  region: args.region,
  camera: args.camera,
  lift: args.lift,
  views: args.views,
  ...(args.at ? { at: args.at } : {}),
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
  scale: String(args.scale),
  ...(args.skis ? { skis: args.skis } : {}),
  land: args.land,
}).toString();
await page.goto(`${server.url}grind-preview.html?${query}`);
await page.waitForFunction("window.__grind !== undefined");
await page.evaluate("window.__grind.ready");
const t0 = Date.now();
const shot = await page.evaluate(() => globalThis.__grind.sheet());
if (crashed) process.exit(1);
const tag =
  (args.region === "alpine" ? "" : `-${args.region}`) +
  (args.skis ? `-${args.skis}` : "") +
  (args.land === "along" ? "-along" : "");
const out = join(outDir, `${args.out || `grind-${args.lift}-${args.seed}${tag}`}.png`);
await page.locator("#sheet").screenshot({ path: out });
console.log(
  `${out.replace(`${root}/`, "")}  ${shot.note}, ${shot.tiles} tiles  (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
);

await browser.close();
await server.close();

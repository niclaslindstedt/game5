#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFT RIDE LAB — a free ride begun on the chairlift, carried to the top,
// stood off on the unload ramp and led away onto its run, drawn through the
// game's own renderer and camera and photographed at moments set round the
// unload into one contact sheet: `previews/lift-ride-<seed>.png`.
//
// It exists because a camera is judged on how it FOLLOWS — close behind the
// rider on the chair, on his back as he stands up and slides down the ramp,
// opening out to the chase as he skis away — and a screenshot jumped to a
// moment (`make screenshots --surface free-top`) snaps the lens fresh and
// shows none of that. The page (`pwa/src/tools/lift-ride-harness.ts`) rides
// the run unbroken at sixty frames a second; this script builds it into a
// one-off bundle (never part of the app's build), serves it and drives it in
// a headless Chromium — `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/lift-ride-preview.mjs
//   node scripts/lift-ride-preview.mjs --seed=4 --region=maritime
//   node scripts/lift-ride-preview.mjs --at=-6,-3,-1,0,0.5,1,1.5,2,3,4,6,9
//   node scripts/lift-ride-preview.mjs --camera=far --skip-build

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".lift-ride-preview");
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
    spot: {
      kind: "string",
      default: "",
      help: "the free ride's spot, x,z (m) — the chair whose run passes nearest it; the start when left out",
    },
    camera: {
      kind: "string",
      default: "chase",
      help: "the camera rung (chase, far, high, helmet, tips)",
    },
    at: {
      kind: "string",
      default: "-12,-6,-3,-1.5,-0.5,0.5,1.5,3,4.5,6,8,11",
      help: "the moments photographed, s round the unload (negative on the chair)",
    },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 1280, help: "a frame's width, px" },
    height: { kind: "number", default: 720, help: "a frame's height, px" },
    cols: { kind: "number", default: 3, help: "tiles a row" },
    scale: { kind: "number", default: 0.5, help: "a tile's size as a share of the frame" },
    out: { kind: "string", default: "", help: "file stem under previews/ (no extension)" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 900, help: "how long the whole run may take, s" },
  },
  "usage: node scripts/lift-ride-preview.mjs [--seed=n] [--region=id] [--spot=x,z] [--camera=rung] [--at=s,…] [--skip-build]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "lift-ride-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "lift-ride-preview.html") },
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
  at: args.at,
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
  cols: String(args.cols),
  scale: String(args.scale),
  ...(args.spot ? { spot: args.spot } : {}),
}).toString();
await page.goto(`${server.url}lift-ride-preview.html?${query}`);
await page.waitForFunction("window.__liftRide !== undefined");
await page.evaluate("window.__liftRide.ready");
const t0 = Date.now();
const shot = await page.evaluate(() => globalThis.__liftRide.sheet());
if (crashed) process.exit(1);
const stem =
  args.out ||
  `lift-ride-${args.seed}${args.region === "alpine" ? "" : `-${args.region}`}${args.camera === "chase" ? "" : `-${args.camera}`}`;
const out = join(outDir, `${stem}.png`);
await page.locator("#sheet").screenshot({ path: out });
console.log(
  `${out.replace(`${root}/`, "")}  ${shot.note}, ${shot.tiles} tiles  (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
);

await browser.close();
await server.close();

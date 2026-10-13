#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE STUDIO — the downhill bike (`pwa/src/game/bike-build.ts`) and its
// rider (`skier-bike.ts`) drawn in a plain studio, with no mountain and no
// run, so a change to either is seen in seconds; and, pointed at a folder of
// local REFERENCE photographs (`--refs DIR`, never committed), each of them
// beside the bike as the same lens sees it and, where `refs.json` marks the
// axles, the bike drawn over the photograph to its own scale.
//
//   node scripts/bike-studio.mjs                     # the bike from every side
//   node scripts/bike-studio.mjs --sheet=rider       # the rider's moments
//   node scripts/bike-studio.mjs --sheet=refs --refs=/some/refs
//
// refs.json is a list of { file, view, axles?, pose?, bare? }: `view` the
// side shown ("drive" — the chain's side — or "brake", or a studio lens:
// front-3q, rear-3q, brake-3q, front, top, low), `axles` the rear and front
// axles' centres in the photograph's pixels, `pose` the rider's moment
// (attack, pedal, pedal2, brake, crouch, air, lean-l, lean-r, land).
//
// One contact sheet, previews/bike-studio-<sheet>.png, and every frame alone
// beside it. The page (`pwa/src/tools/bike-studio-harness.ts`) is built into
// a one-off bundle and driven in a headless Chromium (`CHROMIUM_PATH`).

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".bike-studio");

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: { kind: "string", default: "bike", help: "bike, rider or refs" },
    views: { kind: "string", default: "", help: "only these lenses, comma-separated" },
    refs: {
      kind: "string",
      default: "",
      help: "a folder of reference photographs with a refs.json",
    },
    kit: { kind: "string", default: "0", help: "the rider's start-line outfit slot" },
    width: { kind: "number", default: 900, help: "a frame's width, px" },
    height: { kind: "number", default: 600, help: "a frame's height, px" },
    "out-dir": { kind: "string", default: "", help: "where the pictures go (default previews/)" },
    out: { kind: "string", default: "", help: "file stem (no extension)" },
    "sheets-only": { kind: "flag", help: "write the contact sheet, not every frame alone" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
  },
  "usage: node scripts/bike-studio.mjs [--sheet=bike|rider|refs] [--refs=DIR] [--views=a,b]",
);

const outDir = args["out-dir"] || join(root, "previews");
mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "bike-studio-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "bike-studio-preview.html") },
    },
  });
}
// The references beside the page, for this run only.
rmSync(join(buildDir, "refs"), { recursive: true, force: true });
if (args.refs) cpSync(resolve(args.refs), join(buildDir, "refs"), { recursive: true });

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
page.setDefaultTimeout(600_000);

const query = new URLSearchParams({
  sheet: args.sheet,
  views: args.views,
  kit: args.kit,
  w: String(args.width),
  h: String(args.height),
}).toString();
await page.goto(`${server.url}bike-studio-preview.html?${query}`);
await page.waitForFunction("window.__studio !== undefined");
console.log(`bike studio — ${await page.evaluate("window.__studio.ready")}`);
const t0 = Date.now();
const { frames } = await page.evaluate(() => globalThis.__studio.sheet());
if (crashed) process.exit(1);
const stem = args.out || `bike-studio-${args.sheet}`;
const safe = (s) => s.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "");
if (!args["sheets-only"]) {
  for (const f of frames) {
    writeFileSync(
      join(outDir, `${stem}-${safe(f.view)}.png`),
      Buffer.from(f.png.split(",")[1], "base64"),
    );
  }
}
await page.waitForFunction('[...document.querySelectorAll("#sheet img")].every((i) => i.complete)');
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

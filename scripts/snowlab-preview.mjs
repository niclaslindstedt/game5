#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW LAB: the snow as skis and a board work it, through the game's own
// renderer (`pwa/src/tools/snowlab-harness.ts`) — the carve on the groomer,
// a hockey stop on skis, a snowboard's heel and toe stops, a powder turn, a
// fall's crater and the track from the chase lens, each under the day's sun
// and a low one — drawn with the deformable snow ON and OFF (the game before
// it) as two sheets, `previews/snowlab-<seed>-on.png` and `-off.png`.
//
// `--perf` instead rides the carve from the chase lens at each picture
// preset, with the deformable snow on and off, and prints what a frame costs:
// its milliseconds (drawn and drained — under the software GPU a lab runs
// on, a comparison between rows, not a frame rate), its draw calls and its
// triangles.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".snowlab-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed" },
    scenes: {
      kind: "string",
      default: "",
      help: "the rows (carve, stop, heel, toe, powder, crater, track); every one if unset",
    },
    suns: { kind: "string", default: "26,7", help: "the suns, degrees up, columns" },
    deform: { kind: "string", default: "on,off", help: "the sheets: the deformable snow on, off" },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 480, help: "one cell's width, px" },
    height: { kind: "number", default: 300, help: "one cell's height, px" },
    perf: { kind: "flag", help: "time a frame at each preset, on and off, instead" },
    json: { kind: "string", default: "", help: "with --perf, write the table here" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a sheet may take, s" },
  },
  "usage: node scripts/snowlab-preview.mjs [--scenes=a,b] [--suns=a,b] [--deform=on,off] [--perf] [--skip-build]",
);
mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "snowlab-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "snowlab-preview.html") },
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
/** A page at `query`, ready. */
async function open(query) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (err) => {
    crashed ??= err;
    console.error(`[pageerror] ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error(`[console] ${msg.text()}`);
  });
  page.setDefaultTimeout(args.timeout * 1000);
  await page.goto(`${server.url}snowlab-preview.html?${new URLSearchParams(query)}`);
  await page.waitForFunction("window.__snowlab !== undefined");
  await page.evaluate("window.__snowlab.ready");
  if (crashed) process.exit(1);
  return page;
}

const deforms = args.deform.split(",").filter(Boolean);
if (args.perf) {
  const rows = [];
  for (const quality of ["low", "medium", "high"]) {
    for (const deform of deforms) {
      const page = await open({
        seed: String(args.seed),
        quality,
        deform,
        w: "960",
        h: "540",
      });
      const r = await page.evaluate(() => globalThis.__snowlab.perf());
      if (crashed) process.exit(1);
      rows.push({ quality, deform, ...r });
      await page.close();
    }
  }
  console.log("preset  snow   ms/frame  calls  triangles");
  for (const r of rows) {
    console.log(
      `${r.quality.padEnd(7)} ${r.deform.padEnd(5)} ${r.ms.toFixed(1).padStart(9)} ${r.calls.toFixed(0).padStart(6)} ${(r.triangles / 1000).toFixed(0).padStart(9)}k`,
    );
  }
  if (args.json) writeFileSync(args.json, JSON.stringify(rows, null, 2));
} else {
  for (const deform of deforms) {
    const page = await open({
      seed: String(args.seed),
      scenes: args.scenes,
      suns: args.suns,
      deform,
      quality: args.quality,
      w: String(args.width),
      h: String(args.height),
    });
    const t0 = Date.now();
    const drawn = await page.evaluate(() => globalThis.__snowlab.sheet());
    if (crashed) process.exit(1);
    // An element's picture is clipped at the viewport: size it to the sheet.
    await page.setViewportSize({ width: drawn.w, height: drawn.h });
    const tag = args.quality === "high" ? "" : `-${args.quality}`;
    const out = join(outDir, `snowlab-${args.seed}${tag}-${deform}.png`);
    await page.locator("#sheet").screenshot({ path: out });
    console.log(
      `${out.replace(`${root}/`, "")}  ${drawn.rows}×${drawn.cols}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
    );
    await page.close();
  }
}
await browser.close();
await server.close();

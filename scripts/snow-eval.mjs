#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW EVAL LAB — the snow effects a skier makes, as the game draws
// them, on FIXED SHARED SCENES: a carve on the groomer, a hockey stop on
// skis, a snowboard's two stops, turns in deep powder, the crater a fall
// out of the air leaves, and a powder line seen from the chase camera and
// looked back along — each at two moments under a day's sun and a low one,
// as one contact sheet, `previews/snow-eval-<seed>[-cpu]-<quality>.png`. And
// the spray's cost: the stop and the powder ridden at the LOW, MEDIUM and
// HIGH pictures, the spray's own CPU work a frame, the bytes it sends the
// GPU, the most particles in the air and the whole frame's time read back
// (swiftshader's, so a ratio rather than a phone's milliseconds), printed
// and written as `previews/snow-eval-perf[-cpu].json`.
//
// The page (`pwa/src/tools/snow-eval-harness.ts`) does the drawing; this
// builds it into a one-off bundle (never deployed), serves it and
// photographs the sheet in a headless Chromium — `CHROMIUM_PATH` overrides
// where one is looked for.
//
//   node scripts/snow-eval.mjs
//   node scripts/snow-eval.mjs --gpu=0                the CPU spray, for the before
//   node scripts/snow-eval.mjs --scenes=stop,crater --perf=0
//   node scripts/snow-eval.mjs --quality=low --skip-build

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".snow-eval");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed" },
    region: { kind: "string", default: "", help: "the kind of snow country (R21)" },
    scenes: {
      kind: "string",
      default: "carve,stop,heel,toe,powder,crater,chase,track",
      help: "the scenes, rows",
    },
    gpu: { kind: "number", default: 1, help: "1 the GPU spray, 0 the CPU pool" },
    quality: { kind: "string", default: "high", help: "the sheet's picture (low, medium, high)" },
    perf: { kind: "number", default: 1, help: "1 times the spray at three pictures too" },
    sheet: { kind: "number", default: 1, help: "1 draws the contact sheet" },
    width: { kind: "number", default: 400, help: "one cell's width, px" },
    height: { kind: "number", default: 260, help: "one cell's height, px" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 2400, help: "how long the sheet may take, s" },
  },
  "usage: node scripts/snow-eval.mjs [--scenes=a,b] [--gpu=0|1] [--quality=high] [--perf=0] [--skip-build]",
);
mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "snow-eval-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "snow-eval-preview.html") },
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
  if (msg.type() === "error") console.error(`[console] ${msg.text()}`);
});
page.setDefaultTimeout(args.timeout * 1000);
const query = new URLSearchParams({
  seed: String(args.seed),
  region: args.region,
  scenes: args.scenes,
  gpu: String(args.gpu),
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
}).toString();
const tag = args.gpu ? "" : "-cpu";
await page.goto(`${server.url}snow-eval-preview.html?${query}`);
await page.waitForFunction("window.__snowEval !== undefined");
await page.evaluate("window.__snowEval.ready");
if (crashed) process.exit(1);

if (args.sheet) {
  const t0 = Date.now();
  const drawn = await page.evaluate(() => globalThis.__snowEval.sheet());
  if (crashed) process.exit(1);
  await page.setViewportSize({ width: drawn.w, height: drawn.h });
  const out = join(outDir, `snow-eval-${args.seed}${tag}-${args.quality}.png`);
  await page.locator("#sheet").screenshot({ path: out });
  console.log(
    `${out.replace(`${root}/`, "")}  ${drawn.rows}×${drawn.cols}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
  );
}

if (args.perf) {
  const rows = await page.evaluate(() => globalThis.__snowEval.perf());
  if (crashed) process.exit(1);
  console.log(
    `\n${args.gpu ? "GPU" : "CPU"} spray   tier    scene   frame ms  spray ms  in air  bytes/frame`,
  );
  for (const r of rows) {
    console.log(
      `            ${r.tier.padEnd(7)} ${r.scene.padEnd(7)} ${r.frameMs.toFixed(1).padStart(8)}  ${r.sprayMs.toFixed(3).padStart(8)}  ${String(r.live).padStart(6)}  ${String(r.bytes).padStart(10)}`,
    );
  }
  writeFileSync(join(outDir, `snow-eval-perf${tag}.json`), `${JSON.stringify(rows, null, 2)}\n`);
}
await browser.close();
await server.close();

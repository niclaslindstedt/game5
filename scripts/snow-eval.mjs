#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW EVAL LAB — the snow a skier and a snowboarder throw and leave on
// FIXED SCENES (a carve on the groomer, a hockey stop on skis, a board's
// heelside and toeside stops, a powder turn, a fall's crater in powder, the
// line a run cuts seen from the chase lens), by day and under a low sun,
// through the game's own renderer, and what it costs at the LOW, MEDIUM and
// HIGH presets. Writes `previews/snow-eval/sheet.png` (every scene a row),
// every cell alone (`<scene>-<light>-<lens>.png`) and `perf.json` — and the
// FILM SCORE: the scenes a real one was measured for (`spray-film.ts`), six
// moments each side-on to the throw, the drawn snow scored against the film
// (`film.png`, `film.json`; 100 the film, ~50 every number twice off).
//
// The page (`pwa/src/tools/snow-eval-harness.ts`) does the drawing; this
// builds it into a one-off bundle (never deployed), serves it and
// photographs it in a headless Chromium — `CHROMIUM_PATH` overrides where
// one is looked for.
//
//   node scripts/snow-eval.mjs
//   node scripts/snow-eval.mjs --scenes=hockey,board-heel --skip-build
//   node scripts/snow-eval.mjs --model=sheet --out=previews/snow-eval-before
//   node scripts/snow-eval.mjs --lights=low,overcast,night --film=none --no-perf
//   node scripts/snow-eval.mjs --no-sheet --no-perf --film=day,low --scenes=hockey

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".snow-eval-preview");

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed" },
    scenes: {
      kind: "string",
      default: "",
      help: "only these scenes (carve, hockey, board-heel, board-toe, powder, crater, track)",
    },
    out: { kind: "string", default: "previews/snow-eval", help: "where the pictures go" },
    model: {
      kind: "string",
      default: "",
      help: "fly the spray as this model (the game's own unless said)",
    },
    lights: {
      kind: "string",
      default: "day,low",
      help: "the sheet's lights beside the day (low, overcast, night)",
    },
    film: {
      kind: "string",
      default: "day,low",
      help: "the film score's lights (day, low, overcast, night; none skips it)",
    },
    "no-sheet": { kind: "flag", help: "skip the picture sheet" },
    width: { kind: "number", default: 480, help: "one cell's width, px" },
    height: { kind: "number", default: 320, help: "one cell's height, px" },
    "no-perf": { kind: "flag", help: "skip the cost at the three presets" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 2400, help: "how long the sheet may take, s" },
  },
  "usage: node scripts/snow-eval.mjs [--scenes=a,b] [--out=dir] [--no-perf] [--skip-build]",
);

const outDir = resolve(root, args.out);
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
page.setDefaultTimeout(args.timeout * 1000);
const query = new URLSearchParams({
  seed: String(args.seed),
  scenes: args.scenes,
  model: args.model,
  lights: args.lights,
  film: args.film === "none" ? "" : args.film,
  w: String(args.width),
  h: String(args.height),
}).toString();
const t0 = Date.now();
await page.goto(`${server.url}snow-eval-preview.html?${query}`);
await page.waitForFunction("window.__snowEval !== undefined");
await page.evaluate("window.__snowEval.ready");
if (crashed) process.exit(1);
if (!args["no-sheet"]) {
  const drawn = await page.evaluate(() => globalThis.__snowEval.sheet());
  if (crashed) process.exit(1);
  await page.setViewportSize({ width: drawn.w, height: drawn.h });
  const sheetPath = join(outDir, "sheet.png");
  await page.locator("#sheet").screenshot({ path: sheetPath });
  for (const c of drawn.cells) {
    await page.screenshot({
      path: join(outDir, `${c.name}.png`),
      clip: { x: c.x, y: c.y, width: c.w, height: c.h },
    });
  }
  console.log(
    `${sheetPath.replace(`${root}/`, "")} and ${drawn.cells.length} cells (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
  );
}
if (args.film !== "none") {
  const t1 = Date.now();
  const film = await page.evaluate(() => globalThis.__snowEval.film());
  if (crashed) process.exit(1);
  await page.setViewportSize({ width: film.w, height: film.h });
  await page.locator("#sheet").screenshot({ path: join(outDir, "film.png") });
  writeFileSync(join(outDir, "film.json"), JSON.stringify(film, null, 2));
  console.log(
    `film score (${((Date.now() - t1) / 1000).toFixed(0)} s): 100 the film, ~50 twice off`,
  );
  console.log("scene        light      mean   throw° off travel   off fall line");
  for (const r of film.means.rows) {
    console.log(
      `${r.scene.padEnd(12)} ${r.light.padEnd(9)} ${r.mean.toFixed(1).padStart(5)}   ${String(Math.round(r.toTravel ?? NaN)).padStart(17)}   ${String(Math.round(r.toFall ?? NaN)).padStart(13)}`,
    );
  }
  console.log(`overall                ${film.means.overall.toFixed(1).padStart(5)}`);
}
if (!args["no-perf"]) {
  const rows = await page.evaluate(() => globalThis.__snowEval.perf());
  writeFileSync(join(outDir, "perf.json"), JSON.stringify(rows, null, 2));
  console.log(
    "preset   frame ms   without spray+cloud   spray quads  cloud quads  draw calls  (swiftshader)",
  );
  for (const r of rows) {
    console.log(
      `${r.tier.padEnd(8)} ${r.frameMs.toFixed(1).padStart(8)}  ${r.withoutMs.toFixed(1).padStart(20)}  ${String(Math.round(r.sprayInstances)).padStart(12)}  ${String(Math.round(r.cloudInstances)).padStart(11)}  ${String(r.drawCalls).padStart(10)}`,
    );
  }
}
await browser.close();
await server.close();

#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW EVAL LAB — the snow a skier and a snowboarder throw and leave on
// FIXED SCENES (a carve on the groomer, a hockey stop on skis, a board's
// heelside and toeside stops, a powder turn, a fall's crater in powder, the
// line a run cuts seen from the chase lens), by day and under a low sun,
// through the game's own renderer, and what it costs at the LOW, MEDIUM and
// HIGH presets — the spray's own CPU work, the bytes it sends, the parcels in
// the air, each way the spray is flown (`--perf-flight`). Writes `previews/snow-eval/sheet.png` (every scene a row),
// every cell alone (`<scene>-<light>-<lens>.png`) and `perf.json` — and the
// FILM SCORE: the scenes a real one was measured for (`spray-film.ts`), six
// moments each side-on to the throw, the drawn snow scored against the film
// (`film.png`, `film.json`; 100 the film, ~50 every number twice off) —
// and, with `--under`, THE SKIS UNDER THE SNOW: how far each ski's tip,
// middle and tail stand under the snow drawn round it from the chase lens,
// at every TERRAIN and TRAILS stop and both RESOLUTION ends (`under.png`,
// `under.json`; `pwa/src/tools/snow-eval-skis.ts`).
//
// The page (`pwa/src/tools/snow-eval-harness.ts`) does the drawing; this
// builds it into a one-off bundle (never deployed), serves it and
// photographs it in a headless Chromium — `CHROMIUM_PATH` overrides where
// one is looked for.
//
//   node scripts/snow-eval.mjs
//   node scripts/snow-eval.mjs --scenes=hockey,board-heel --skip-build
//   node scripts/snow-eval.mjs --lights=low,overcast,night --film=none --no-perf
//   node scripts/snow-eval.mjs --no-sheet --no-perf --film=day,low --scenes=hockey
//   node scripts/snow-eval.mjs --flight=cpu --out=previews/snow-eval-cpu   (the spray on the CPU)
//   node scripts/snow-eval.mjs --no-sheet --film=none --perf=hockey --perf-flight=gpu
//   node scripts/snow-eval.mjs --no-sheet --film=none --no-perf --under=all

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
    "deform-perf": {
      kind: "flag",
      help: "the deformable snow's cost at each TRAILS stop (HIGH preset): ms, draw calls, triangles",
    },
    "no-deform": {
      kind: "flag",
      help: "draw without the deformable snow (the trail map alone, the before)",
    },
    under: {
      kind: "string",
      default: "",
      help: "the skis-under-the-snow table and sheet: scene ids (groomer, report, carve, powder, powder-carve) or all",
    },
    width: { kind: "number", default: 480, help: "one cell's width, px" },
    height: { kind: "number", default: 320, help: "one cell's height, px" },
    "no-perf": { kind: "flag", help: "skip the cost at the three presets" },
    flight: {
      kind: "string",
      default: "",
      help: "fly the weighed spray on the cpu or the gpu at every stop (the SPRAY row's own way unless said)",
    },
    perf: { kind: "string", default: "hockey,powder", help: "the scenes the cost is read on" },
    "perf-flight": {
      kind: "string",
      default: "cpu,gpu",
      help: "the ways the cost is read with (cpu, gpu)",
    },
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
  lights: args.lights,
  flight: args.flight,
  perf: args.perf,
  perfFlight: args["perf-flight"],
  film: args.film === "none" ? "" : args.film,
  under: args.under,
  deform: args["no-deform"] ? "0" : "1",
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
if (args["deform-perf"]) {
  const rows = await page.evaluate(() => globalThis.__snowEval.deformPerf());
  if (crashed) process.exit(1);
  writeFileSync(join(outDir, "deform-perf.json"), JSON.stringify(rows, null, 2));
  console.log(
    "the deformable snow by TRAILS stop (HIGH preset; software GL ms read against each other)",
  );
  console.log("scene    trails  frame ms  trail ms  calls  triangles  patch tris  dug kg");
  for (const r of rows) {
    console.log(
      `${r.scene.padEnd(8)} ${r.trails.padEnd(7)} ${r.frameMs.toFixed(1).padStart(8)}  ${r.trailMs.toFixed(2).padStart(8)}  ${String(r.calls).padStart(5)}  ${String(r.triangles).padStart(9)}  ${String(r.patch).padStart(10)}  ${r.dug.toFixed(2).padStart(6)}`,
    );
  }
}
if (args.under) {
  const t2 = Date.now();
  const drawn = await page.evaluate(() => globalThis.__snowEval.under());
  if (crashed) process.exit(1);
  await page.setViewportSize({ width: drawn.w, height: drawn.h });
  await page.locator("#sheet").screenshot({ path: join(outDir, "under.png") });
  writeFileSync(join(outDir, "under.json"), JSON.stringify(drawn.rows, null, 2));
  console.log(
    `skis under the drawn snow (${((Date.now() - t2) / 1000).toFixed(0)} s), cm worst / mean, hidden = share > 2 cm under`,
  );
  const cm = (s) =>
    Number.isFinite(s.worst)
      ? `${(s.worst * 100).toFixed(1).padStart(5)}/${(s.mean * 100).toFixed(1).padStart(5)}`
      : "    –/    –";
  console.log("scene         terrain trails res   tip          mid          tail         hidden");
  for (const r of drawn.rows) {
    console.log(
      `${r.scene.padEnd(13)} ${r.terrain.padEnd(7)} ${r.trails.padEnd(6)} ${r.resolution.padEnd(5)} ${cm(r.tip)}  ${cm(r.mid)}  ${cm(r.tail)}  ${(r.hidden * 100).toFixed(0).padStart(4)} %`,
    );
  }
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
  console.log(
    "scene        light      mean   plume° off travel   off fall line   throw° off travel   off fall line",
  );
  for (const r of film.means.rows) {
    console.log(
      `${r.scene.padEnd(12)} ${r.light.padEnd(9)} ${r.mean.toFixed(1).padStart(5)}   ${String(Math.round(r.toTravel ?? NaN)).padStart(17)}   ${String(Math.round(r.toFall ?? NaN)).padStart(13)}   ${String(Math.round(r.throwTravel ?? NaN)).padStart(17)}   ${String(Math.round(r.throwFall ?? NaN)).padStart(13)}`,
    );
  }
  console.log(`overall                ${film.means.overall.toFixed(1).padStart(5)}`);
}
if (!args["no-perf"]) {
  const rows = await page.evaluate(() => globalThis.__snowEval.perf());
  writeFileSync(join(outDir, "perf.json"), JSON.stringify(rows, null, 2));
  console.log(
    "scene    preset  flight  spray cpu ms  bytes/frame  in air  spray quads  cloud quads  draw calls  frame ms  without  (frame ms swiftshader)",
  );
  for (const r of rows) {
    console.log(
      `${r.scene.padEnd(8)} ${r.tier.padEnd(7)} ${r.flight.padEnd(6)} ${r.sprayCpuMs.toFixed(3).padStart(13)}  ${String(Math.round(r.bytesPerFrame)).padStart(11)}  ${String(r.live).padStart(6)}  ${String(Math.round(r.sprayInstances)).padStart(11)}  ${String(Math.round(r.cloudInstances)).padStart(11)}  ${String(r.drawCalls).padStart(10)}  ${r.frameMs.toFixed(1).padStart(8)}  ${r.withoutMs.toFixed(1).padStart(7)}`,
    );
  }
}
await browser.close();
await server.close();

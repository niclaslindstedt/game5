#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW-REFERENCE LAB — the snow a rider throws and leaves as the game
// draws it, laid against what real riders were MEASURED throwing
// (`pwa/src/game/spray-film.ts`): `previews/snowref-<seed>-<sheet>-<sun>.png`
// and, for the spray, `previews/snowref-<seed>-spray-<sun>.json` — every
// moment's top, reach and area, the game's beside the film's, and its score.
//
//   spray  the shared scenes (a carve on the groomer, a ski hockey stop, a
//          board's heelside and toeside stops, a turn in powder) at their
//          moments, side-on to the throw, the film's envelope dashed and the
//          game's solid over each cell
//   marks  a fall in powder from beside and over the hole; the track line
//          behind six seconds of carves on the groomer and in powder
//   perf   the hockey stop's busiest moment at LOW, MEDIUM and HIGH
//
// Each sheet at every sun height asked (`--suns`, degrees: the day's 28 and
// the low sun's 8 by default). The page (`pwa/src/tools/snowref-harness.ts`)
// does the drawing; this builds it into a one-off bundle (never deployed),
// serves it and photographs the sheets in a headless Chromium —
// `CHROMIUM_PATH` overrides where one is looked for. The table it prints is
// the score by scene and sun, the number a change is judged by.
//
//   node scripts/snowref-preview.mjs
//   node scripts/snowref-preview.mjs --sheets=spray --suns=28 --moves=stop,boardHeel
//   node scripts/snowref-preview.mjs --sheets=marks,perf --skip-build

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".snowref-preview");
const outDir = join(root, "previews");
const SHEETS = ["spray", "marks", "perf"];

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed" },
    region: {
      kind: "string",
      default: "",
      help: "the kind of snow country (R21); alpine if unset",
    },
    sheets: {
      kind: "string",
      default: "spray,marks,perf",
      help: `the sheets (${SHEETS.join(", ")})`,
    },
    suns: { kind: "string", default: "28,8", help: "the sun's heights, degrees, a sheet each" },
    moves: {
      kind: "string",
      default: "carve,stop,boardHeel,boardToe,powder",
      help: "the spray sheet's scenes (spray-film.ts's FILM_MOVES)",
    },
    times: { kind: "string", default: "0.4,0.8,1.2,1.6,2,2.4", help: "the spray's moments, s" },
    at: {
      kind: "number",
      default: 1 / 3,
      help: "how far down the piste the groomer scenes start, 0..1",
    },
    width: { kind: "number", default: 400, help: "one cell's width, px" },
    height: { kind: "number", default: 260, help: "one cell's height, px" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a sheet may take, s" },
  },
  "usage: node scripts/snowref-preview.mjs [--sheets=spray,marks,perf] [--suns=28,8] [--moves=a,b] [--skip-build]",
);

const sheets = args.sheets.split(",").filter(Boolean);
for (const s of sheets) {
  if (!SHEETS.includes(s)) {
    console.error(`unknown sheet "${s}" (${SHEETS.join(", ")})`);
    process.exit(2);
  }
}
const suns = args.suns.split(",").filter(Boolean).map(Number);
mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "snowref-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "snowref-preview.html") },
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
const table = [];
for (const sheet of sheets) {
  // The perf sheet is one sun's: the light does not change its cost.
  for (const sun of sheet === "perf" ? suns.slice(0, 1) : suns) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on("pageerror", (err) => {
      crashed ??= err;
      console.error(`[pageerror] ${err.message}`);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("404"))
        console.error(`[console] ${msg.text()}`);
    });
    page.setDefaultTimeout(args.timeout * 1000);
    const query = new URLSearchParams({
      seed: String(args.seed),
      region: args.region,
      sheet,
      sun: String(sun),
      moves: args.moves,
      times: args.times,
      at: String(args.at),
      w: String(args.width),
      h: String(args.height),
    }).toString();
    const t0 = Date.now();
    await page.goto(`${server.url}snowref-preview.html?${query}`);
    await page.waitForFunction("window.__snowref !== undefined");
    await page.evaluate("window.__snowref.ready");
    if (crashed) process.exit(1);
    const drawn = await page.evaluate(() => globalThis.__snowref.sheet());
    if (crashed) process.exit(1);
    await page.setViewportSize({ width: drawn.w, height: drawn.h });
    const base = `snowref-${args.seed}-${sheet}${sheet === "perf" ? "" : `-sun${sun}`}`;
    const out = join(outDir, `${base}.png`);
    await page.locator("#sheet").screenshot({ path: out });
    console.log(
      `${out.replace(`${root}/`, "")}  ${drawn.note}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
    );
    if (sheet === "spray") {
      writeFileSync(join(outDir, `${base}.json`), JSON.stringify(drawn.scores, null, 1));
      const by = new Map();
      for (const s of drawn.scores) {
        const row = by.get(s.move) ?? [];
        row.push(s.score);
        by.set(s.move, row);
      }
      for (const [move, row] of by) {
        table.push({ sun, move, mean: row.reduce((a, b) => a + b, 0) / row.length, cells: row });
      }
    }
    for (const line of drawn.perf) console.log(`  ${line}`);
    await page.close();
  }
}
await browser.close();
await server.close();

if (table.length) {
  console.log("\nscore against the film, 0..100 (100 the film exactly; ~50 every number ×2 off)");
  console.log("sun  scene        mean   by moment");
  for (const r of table) {
    console.log(
      `${String(r.sun).padStart(3)}  ${r.move.padEnd(11)} ${r.mean.toFixed(1).padStart(5)}   ${r.cells.map((c) => c.toFixed(0).padStart(3)).join(" ")}`,
    );
  }
  const all = table.reduce((a, r) => a + r.mean, 0) / table.length;
  console.log(`overall ${all.toFixed(1)}`);
}

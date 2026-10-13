#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY LAB — the sky over ONE seed seen from ONE place, drawn through
// the game's own renderer as a labelled contact sheet and MEASURED cell by
// cell. Three sheets (`--sheet`):
//
//   weathers   (the default) every weather R19 deals against every few
//              hours of the clock, day and night — `previews/sky-<seed>.png`
//   timelapse  one weather (the first of `--weathers`, CLEAR by default)
//              and one view, the sun swept from an hour and a half before
//              sunrise to two and a half after sunset every `--step` game
//              minutes — `previews/sky-<seed>-timelapse[-<view>].png`
//   tiers      every picture preset at dawn, the golden hour, noon, the low
//              sun, sunset, the blue hour and night —
//              `previews/sky-<seed>-tiers[-<view>].png`
//
// Every cell is measured (`pwa/src/tools/sky-eval.ts`): the model's zenith
// and horizon luminance and colour temperature, the sun's disc's, the key
// and the hemisphere, the drawn sky's, the lit and shaded snow's luminance
// and their ratio, how blue the shade and how warm the light, and the frame's
// draw time — printed as a table, `--json=FILE` before a change and
// `--compare=FILE` after, as the repo's other labs do.
//
// It exists because a map is dealt one sky at one hour, so a screenshot of a
// race can only ever say whether that one sky is wrong — and the sky here is
// a LADDER (clear to blizzard, noon to midnight), which is judged side by
// side or not at all. The page does the drawing
// (`pwa/src/tools/sky-harness.ts`, through the game's own renderer): the map,
// its day and its latitude stay the seed's, and only the weather and the
// start hour move, so every cell is the same ground under a different sky.
// This script builds that page into a one-off bundle (never deployed),
// serves it, and photographs the sheet in a headless Chromium —
// `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/sky-preview.mjs
//   node scripts/sky-preview.mjs --seed=12 --hours=6,9,12,15,18 --view=vista
//   node scripts/sky-preview.mjs --weathers=overcast,blizzard,fog --skip-build
//   node scripts/sky-preview.mjs --sheet=timelapse --view=antisun --step=20
//   node scripts/sky-preview.mjs --sheet=tiers --json=previews/sky-tiers-before.json

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".sky-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed (its day and latitude are kept)" },
    sheet: { kind: "string", default: "weathers", help: "weathers, timelapse or tiers" },
    hours: {
      kind: "string",
      default: "",
      help: "the hours, solar, comma-separated (each sheet has its own default)",
    },
    step: { kind: "number", default: 20, help: "the time-lapse's step, game minutes" },
    cols: { kind: "number", default: 8, help: "the time-lapse's frames a row" },
    weathers: {
      kind: "string",
      default: "",
      help: "only these rows (clear,fair,flurries,high,overcast,snow 0.4,storm,blizzard,fog,fair +8cm); the time-lapse and tiers take the first",
    },
    view: {
      kind: "string",
      default: "chase",
      help: "chase (behind the grid), vista (the rim), sunrise / sunset (toward the sun's bearing then) or antisun (away from the sunset)",
    },
    json: { kind: "string", default: "", help: "write every cell's numbers to this JSON file" },
    compare: { kind: "string", default: "", help: "a JSON file to print the change against" },
    quality: {
      kind: "string",
      default: "high",
      help: "the picture preset (low, medium, high — settings-video.ts)",
    },
    width: { kind: "number", default: 320, help: "one cell's width, px" },
    height: { kind: "number", default: 180, help: "one cell's height, px" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1200, help: "how long the whole run may take, s" },
  },
  "usage: node scripts/sky-preview.mjs [--sheet=weathers|timelapse|tiers] [--seed=n] [--hours=a,b] [--weathers=a,b] [--view=vista] [--json=f] [--compare=f] [--skip-build]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "sky-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "sky-preview.html") },
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
  if (msg.type() === "error" || msg.type() === "warning") console.error(`[console] ${msg.text()}`);
});
page.setDefaultTimeout(args.timeout * 1000);

const query = new URLSearchParams({
  seed: String(args.seed),
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
  sheet: args.sheet,
  hours: args.hours,
  step: String(args.step),
  cols: String(args.cols),
  weathers: args.weathers,
  view: args.view,
}).toString();
console.log(`sky — seed ${args.seed}, ${args.sheet}, ${args.view}, ${args.quality} quality`);
const t0 = Date.now();
await page.goto(`${server.url}sky-preview.html?${query}`);
await page.waitForFunction("window.__sky !== undefined");
await page.evaluate("window.__sky.ready");
if (crashed) process.exit(1);
const drawn = await page.evaluate(() => globalThis.__sky.sheet());
if (crashed) process.exit(1);
const sheetPart = args.sheet === "weathers" ? "" : `-${args.sheet}`;
const viewPart = args.view === "chase" ? "" : `-${args.view}`;
const out = join(outDir, `sky-${args.seed}${sheetPart}${viewPart}.png`);
await page.locator("#sheet").screenshot({ path: out });
console.log(
  `${out.replace(`${root}/`, "")}  ${drawn.rows}×${drawn.cols}: ${drawn.note}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
);

await browser.close();
await server.close();

// THE NUMBERS: every cell, and its change against `--compare`.
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const COLS = [
  "id",
  "elev",
  "zenL",
  "horL",
  "zenK",
  "horK",
  "sunK",
  "keyI",
  "amb",
  "skyL",
  "skyK",
  "litL",
  "shadeL",
  "ratio",
  "shadeBlue",
  "litWarm",
  "ms",
];
const show = (v) => (v === null || v === undefined ? "—" : String(v));
const delta = (now, old) => {
  if (typeof now !== "number" || typeof old !== "number" || now === old) return "";
  const d = Math.round((now - old) * 1000) / 1000;
  return ` (${d > 0 ? "+" : ""}${d})`;
};
const lines = drawn.cells.map((c) => {
  const old = before?.cells?.find((b) => b.id === c.id);
  return COLS.map((k) => show(c[k]) + (old && k !== "id" ? delta(c[k], old[k]) : ""));
});
const widths = COLS.map((k, i) => Math.max(k.length, ...lines.map((l) => l[i].length)));
console.log(COLS.map((k, i) => k.padEnd(widths[i])).join(" "));
for (const l of lines) console.log(l.map((v, i) => v.padEnd(widths[i])).join(" "));
if (args.json) {
  const meta = { seed: args.seed, sheet: args.sheet, view: args.view, quality: args.quality };
  writeFileSync(args.json, JSON.stringify({ ...meta, cells: drawn.cells }, null, 2));
  console.log(`wrote ${args.json}`);
}

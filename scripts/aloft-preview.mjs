#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ALOFT LAB — what a lens HIGH OVER THE SNOW sees at each DISTANCE
// stop, and what it costs: a grid of frames, a row a height over the snow
// and a column a DISTANCE stop, each lens stood over the ski area's base
// looking up its mountain to the summit, as a craft climbing out of the
// valley would:
//
//   previews/aloft-<seed>.png   the grid, each frame captioned with its
//                               draw calls, triangles, the ground's and the
//                               woods' triangles and the world phase's ms
//
// It exists because the DISTANCE row was tuned for a skier on the snow,
// where the mist closing at a few hundred metres hides nothing he needs —
// and a pilot in the same mist cannot find the mountain. The table is the
// cost side of the same question: keep `--json` before a change and
// `--compare` after.
//
// The page (`pwa/src/tools/aloft-harness.ts`) draws through the game's own
// renderer; this script builds it into a one-off bundle (never deployed),
// serves it and photographs the sheet in a headless Chromium —
// `CHROMIUM_PATH` overrides where one is looked for. A software rasterizer
// prices nothing on the card: the triangles and calls are structure, the
// world phase's ms the processor's, and the frame's ms (the submit's
// included) is the software rasterizer's own and stalls at random.
//
//   node scripts/aloft-preview.mjs
//   node scripts/aloft-preview.mjs --heights=2,300,1500 --distances=low,max
//   node scripts/aloft-preview.mjs --json=previews/aloft-before.json
//   node scripts/aloft-preview.mjs --compare=previews/aloft-before.json

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".aloft-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map flown over (a free ride's)" },
    face: { kind: "string", default: "", help: "raise the map on a real face (alpine-1 …)" },
    heights: {
      kind: "string",
      default: "2,60,200,600,1500",
      help: "the rows: the lens's height over the snow, m",
    },
    distances: {
      kind: "string",
      default: "low,medium,high,max",
      help: "the columns: DISTANCE stops",
    },
    quality: {
      kind: "string",
      default: "low",
      help: "the picture preset under the DISTANCE row (low, medium, high)",
    },
    frames: { kind: "number", default: 5, help: "frames timed a cell (the median is kept)" },
    width: { kind: "number", default: 480, help: "one frame's width, px" },
    height: { kind: "number", default: 270, help: "one frame's height, px" },
    json: { kind: "string", default: "", help: "write the table as JSON to this file too" },
    compare: { kind: "string", default: "", help: "a --json file to print beside the table" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long the whole run may take, s" },
  },
  "usage: node scripts/aloft-preview.mjs [--seed=n] [--heights=a,b] [--distances=a,b] [--json=file] [--compare=file]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "aloft-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "aloft-preview.html") },
    },
  });
}

// The committed models go beside the page, where the renderer fetches them.
cpSync(join(root, "pwa", "models"), join(buildDir, "models"), { recursive: true });

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
  ...(args.face ? { face: args.face } : {}),
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
  heights: args.heights,
  distances: args.distances,
  frames: String(args.frames),
}).toString();
console.log(
  `aloft — seed ${args.seed}${args.face ? ` on ${args.face}` : ""}, ${args.quality} picture`,
);
const t0 = Date.now();
await page.goto(`${server.url}aloft-preview.html?${query}`);
await page.waitForFunction("window.__aloft !== undefined");
await page.evaluate("window.__aloft.ready");
if (crashed) process.exit(1);

await page.evaluate(() => globalThis.__aloft.sheet());
if (crashed) process.exit(1);
const box = await page.locator("#sheet").boundingBox();
await page.setViewportSize({
  width: Math.ceil(Math.max(1280, box?.width ?? 0)),
  height: Math.ceil(Math.max(720, box?.height ?? 0)),
});
const out = join(outDir, `aloft-${args.face || args.seed}.png`);
await page.locator("#sheet").screenshot({ path: out });
const rows = await page.evaluate(() => globalThis.__aloft.rows());
console.log(out.replace(`${root}/`, ""));

if (args.json) writeFileSync(args.json, JSON.stringify({ seed: args.seed, rows }, null, 2));
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")).rows : [];
const was = (r) => before.find((b) => b.distance === r.distance && b.over === r.over);
const pad = (s, n) => String(s).padStart(n);
const beside = (now, then, digits = 0) =>
  then === undefined
    ? pad(now.toFixed(digits), 8)
    : pad(`${then.toFixed(digits)}→${now.toFixed(digits)}`, 14);
console.log(
  `\n${"distance".padEnd(9)}${pad("up m", 6)}  calls  tris k  ground k  woods k  world ms  frame ms`,
);
for (const r of rows) {
  const b = was(r);
  console.log(
    `${r.distance.padEnd(9)}${pad(r.over, 6)}  ${beside(r.calls, b?.calls)} ${beside(r.triangles / 1000, b && b.triangles / 1000)} ` +
      `${beside(r.terrain, b?.terrain)} ${beside(r.forest, b?.forest)} ${beside(r.worldMs, b?.worldMs, 2)} ${beside(r.frameMs, b?.frameMs, 1)}`,
  );
}
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s)`);

await browser.close();
await server.close();

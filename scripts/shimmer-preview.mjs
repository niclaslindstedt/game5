#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHIMMER LAB — how much of the far mountain FLICKERS as the lens
// moves: a lens slid a few centimetres a frame across the rockiest face
// (or, `--along`, half a metre a frame toward it, as a skier rides at it), every frame read back, and each pixel's mean SECOND difference of
// brightness taken (a steady drift drops out; a pixel that jumps and comes
// back does not). One labelled contact sheet and a table:
//
//   previews/shimmer-<seed>-<grade>.png   each shot's first frame, its
//                                         heat map (brighter the worse) and
//                                         the snow through its crags (red)
//
// It exists because a flicker is a thing between frames, which no still
// shows: the far rock faces sparkling and crawling as the skier rides is
// detail finer than a pixel — a facet's own shade and light, the snow and
// the rock fighting over a depth — picked one frame and not the next.
// The table's FLICKER is the mean over the ground's pixels (×1000), HOT
// the share past 0.02 of full white, CRAG the share of the frame in the
// rock skin, THROUGH the share of that the snow is drawn in front of and
// BLINK the share where the snow and the rock swap places and back over
// three frames — keep `--json` before a change and read the table again
// after.
//
// The page (`pwa/src/tools/shimmer-harness.ts`) draws through the game's own
// renderer; this script builds it into a one-off bundle (never deployed),
// serves it and photographs the sheet in a headless Chromium —
// `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/shimmer-preview.mjs
//   node scripts/shimmer-preview.mjs --face=alpine-1 --along --step=0.5 --frames=16 --shots=rock-200,rock-400,rock-800
//   node scripts/shimmer-preview.mjs --json > before.json

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".shimmer-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map whose mountain is looked at" },
    grade: {
      kind: "string",
      default: "black",
      help: "the piste grade the map is built to (a black carries the most rock)",
    },
    hide: {
      kind: "string",
      default: "",
      help: "hide these from every frame too (shadow, forest, …: the benchmark's slices)",
    },
    face: { kind: "string", default: "", help: "raise the map on a real face (alpine-1 …)" },
    shots: {
      kind: "string",
      default: "rock-150,rock-300,rock-600,rock-1200",
      help: "the lenses, rows (rock-<m>, the rockiest face from <m> m out, and valley, the base looking up at it)",
    },
    along: {
      kind: "flag",
      help: "slide the lens toward the face (riding at it) rather than across",
    },
    ground: {
      kind: "flag",
      help: "draw the snow alone (the woods, the crags, the lifts and the field hidden)",
    },
    frames: { kind: "number", default: 12, help: "frames read a shot" },
    step: { kind: "number", default: 0.01, help: "how far the lens slides a frame, m" },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 640, help: "one frame's width, px" },
    height: { kind: "number", default: 360, help: "one frame's height, px" },
    json: { kind: "flag", help: "print the table as JSON instead" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1200, help: "how long the whole run may take, s" },
  },
  "usage: node scripts/shimmer-preview.mjs [--seed=n] [--shots=a,b] [--frames=n] [--step=m] [--json] [--skip-build]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "shimmer-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "shimmer-preview.html") },
    },
  });
}

// The committed models go beside the page, where the renderer fetches
// them from (`loadModels`).
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
  if (msg.type() === "error" || msg.type() === "warning") console.error(`[console] ${msg.text()}`);
});
page.setDefaultTimeout(args.timeout * 1000);

const query = new URLSearchParams({
  seed: String(args.seed),
  grade: args.grade,
  ...(args.face ? { face: args.face } : {}),
  ...(args.hide ? { hide: args.hide } : {}),
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
  shots: args.shots,
  frames: String(args.frames),
  step: String(args.step),
  ...(args.ground ? { ground: "1" } : {}),
  ...(args.along ? { along: "1" } : {}),
}).toString();
const say = args.json ? () => {} : (line) => console.log(line);
say(
  `shimmer — seed ${args.seed}, ${args.shots}, ${args.frames} frames at ${args.step} m, ${args.quality} quality`,
);
const t0 = Date.now();
await page.goto(`${server.url}shimmer-preview.html?${query}`);
await page.waitForFunction("window.__shimmer !== undefined");
await page.evaluate("window.__shimmer.ready");
if (crashed) process.exit(1);

const drawn = await page.evaluate(() => globalThis.__shimmer.sheet());
if (crashed) process.exit(1);
const box = await page.locator("#sheet").boundingBox();
await page.setViewportSize({
  width: Math.ceil(Math.max(1280, box?.width ?? 0)),
  height: Math.ceil(Math.max(720, box?.height ?? 0)),
});
const out = join(outDir, `shimmer-${args.seed}-${args.face || args.grade}.png`);
await page.locator("#sheet").screenshot({ path: out });
const rows = await page.evaluate(() => globalThis.__shimmer.rows());
say(`${out.replace(`${root}/`, "")}  ${drawn.rows} shots: ${drawn.note}`);

if (args.json) {
  console.log(
    JSON.stringify({ seed: args.seed, frames: args.frames, step: args.step, rows }, null, 2),
  );
} else {
  const pad = (s, n) => String(s).padStart(n);
  console.log(
    `\n${"shot".padEnd(10)}${pad("range m", 9)}${pad("flicker", 9)}${pad("hot %", 8)}${pad("crag %", 8)}${pad("through %", 11)}${pad("blink %", 9)}`,
  );
  for (const r of rows) {
    console.log(
      `${r.shot.padEnd(10)}${pad(r.range.toFixed(0), 9)}${pad(r.flicker.toFixed(2), 9)}${pad(r.hot.toFixed(2), 8)}` +
        `${pad(r.crag.toFixed(1), 8)}${pad(r.through.toFixed(1), 11)}${pad(r.blink.toFixed(2), 9)}`,
    );
  }
  console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

await browser.close();
await server.close();

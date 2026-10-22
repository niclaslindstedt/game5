#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMER LAB — a free ride's mountain in MIDSUMMER (`engine/game/
// summer.ts`, the ground `summer-ground.ts`, drawn by `pwa/src/game/
// summer-glsl.ts` and `summer-grass.ts`) photographed through the game's own
// renderer at named views found off the summer ground itself — a meadow at
// eye height and a hand's breadth over it, a ski run in summer, a vista
// down to the valley, up a lift's line, over the village, the turf above the
// tree line and a July snow patch — at each hour asked. `--winter` draws the
// same views on the same map in its own winter, the before beside the after.
//
// One contact sheet, previews/<out>.png, and every frame alone,
// previews/<out>-<view>-<hour>.png. The page (`pwa/src/tools/
// summer-harness.ts`) is built into a one-off bundle (never part of the
// app's build), served and driven in a headless Chromium — `CHROMIUM_PATH`
// overrides where one is looked for.
//
//   node scripts/summer-preview.mjs                          # every view at 10 and 17.5 h
//   node scripts/summer-preview.mjs --region=fell --hours=12
//   node scripts/summer-preview.mjs --views=meadow,grass --winter

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

import { assertBackend, rendererArgs, rendererFlag, renderersOf } from "./lib/backend-flag.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".summer-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    views: {
      kind: "string",
      default: "",
      help: "only these views, comma-separated (meadow, grass, piste, vista, lift, village, turf, patch)",
    },
    hours: { kind: "string", default: "10,17.5", help: "the solar hours, comma-separated" },
    seed: { kind: "number", default: 38, help: "the map's seed" },
    region: {
      kind: "string",
      default: "",
      help: "the kind of snow country (R21): alpine, fell, continental, maritime; the alpine when left out",
    },
    weather: {
      kind: "string",
      default: "fair",
      help: "the sky (clear, fair, high, overcast, fog)",
    },
    winter: { kind: "flag", help: "draw the same views in the map's own winter (the before)" },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 1280, help: "a frame's width, px" },
    height: { kind: "number", default: 720, help: "a frame's height, px" },
    cols: { kind: "number", default: 4, help: "tiles a row on a sheet" },
    scale: { kind: "number", default: 0.5, help: "a tile's size as a share of the frame" },
    out: { kind: "string", default: "", help: "file stem under previews/ (no extension)" },
    "sheets-only": { kind: "flag", help: "write the contact sheet, not every frame alone" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    renderer: rendererFlag(),
    timeout: { kind: "number", default: 1800, help: "how long the sheet may take to draw, s" },
  },
  "usage: node scripts/summer-preview.mjs [--views=a,b] [--hours=h,h] [--seed=n] [--region=id] [--weather=k] [--winter] [--skip-build] [--renderer=b]",
);

const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "summer-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "summer-preview.html") },
    },
  });
}
// The committed models (the skis) go beside the page, where the renderer
// fetches them.
cpSync(join(root, "pwa", "models"), join(buildDir, "models"), { recursive: true });

const found = await findChromium();
if (!found) process.exit(1);

const server = await serveDir(buildDir);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    ...rendererArgs(renderersOf(args.renderer)),
  ],
});
const viewport = { width: args.width, height: args.height };
const page = await browser.newPage({ viewport });
let crashed = null;
page.on("pageerror", (err) => {
  crashed ??= err;
  console.error(`[pageerror] ${err.message}`);
});
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") console.error(`[console] ${msg.text()}`);
});
page.setDefaultTimeout(args.timeout * 1000);

const stem =
  args.out || `summer${args.region ? `-${args.region}` : ""}${args.winter ? "-winter" : ""}`;
const query = new URLSearchParams({
  seed: String(args.seed),
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
  cols: String(args.cols),
  scale: String(args.scale),
  weather: args.weather,
  hours: args.hours,
  ...(args.region ? { region: args.region } : {}),
  ...(args.winter ? { winter: "1" } : {}),
  ...(args.renderer !== "webgl" ? { renderer: args.renderer } : {}),
}).toString();
/** `work`, or a failure the moment the page throws — never the timeout
 * burnt on a page that died. */
function guarded(work) {
  return Promise.race([
    work,
    new Promise((_, fail) => {
      const watch = setInterval(() => {
        if (crashed) {
          clearInterval(watch);
          fail(crashed);
        }
      }, 200);
      watch.unref();
    }),
  ]);
}

await page.goto(`${server.url}summer-preview.html?${query}`);
await guarded(page.waitForFunction("window.__summer !== undefined"));
const note = await guarded(page.evaluate("window.__summer.ready"));
await assertBackend(page, args.renderer);
/** @type {string[]} */
const all = await page.evaluate("window.__summer.views");
const want = list(args.views);
const shot = want.length ? all.filter((v) => want.includes(v.slice(0, v.lastIndexOf("-")))) : all;
if (!shot.length) {
  console.error(`no view matches "${args.views}" (${all.join(", ")})`);
  process.exit(2);
}
console.log(`summer — seed ${args.seed}${args.region ? ` ${args.region}` : ""}: ${note}`);
const safe = (s) => s.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "");
const t0 = Date.now();
const { frames } = await guarded(page.evaluate((v) => globalThis.__summer.sheet(v), shot));
if (!args["sheets-only"]) {
  for (const f of frames) {
    const file = join(outDir, `${stem}-${safe(f.view)}.png`);
    writeFileSync(file, Buffer.from(f.png.split(",")[1], "base64"));
  }
}
// An element is photographed within the viewport: open it to the sheet.
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

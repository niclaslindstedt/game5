#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE THROUGH THE DAY LAB — one spot of a free ride's piste
// (`engine/game/piste-day.ts`, drawn by `pwa/src/game/snow-glsl.ts`) under
// one sky at the hours of a day, photographed through the game's own
// renderer, so the night's corduroy at the first chair, the skied-up
// afternoon, a spring sun's slush and its evening freeze, and the new snow a
// snowing sky lays on the runs can be judged side by side:
//
//   clear, fair, overcast, flurries, snow, storm
//            one sheet a sky: every hour (`--hours`, 9,12,15,18 by default)
//            from two lenses — `down` the piste from eye height and `near`,
//            close in on the snow at the skier's feet
//
// Each SHEET is one contact sheet, previews/piste-day-<sky>.png, and every
// frame is also written alone, previews/piste-day-<view>-<hour>.png. The page
// (`pwa/src/tools/piste-day-harness.ts`) stands each frame's free ride up
// with the engine's own deal of the runs for that sky and hour, so a seed's
// sheet is the same sheet twice. This script builds it into a one-off bundle
// (never part of the app's build), serves it and drives it in a headless
// Chromium — `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/piste-day-preview.mjs                       # clear, snow and storm
//   node scripts/piste-day-preview.mjs --sheet=clear --day=80  # a spring day
//   node scripts/piste-day-preview.mjs --hours=8,12,16,19 --views=clear-near

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".piste-day-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: {
      kind: "string",
      default: "clear,snow,storm",
      help: "which skies, comma-separated (clear, fair, overcast, flurries, snow, storm)",
    },
    views: {
      kind: "string",
      default: "",
      help: "only these views, comma-separated (<sky>-down, <sky>-near)",
    },
    seed: { kind: "number", default: 38, help: "the map's seed" },
    region: {
      kind: "string",
      default: "",
      help: "the kind of snow country (R21): alpine, fell, continental, maritime; the alpine when left out",
    },
    hours: {
      kind: "string",
      default: "9,12,15,18",
      help: "the solar hours of the day, comma-separated",
    },
    day: {
      kind: "number",
      default: NaN,
      help: "the day of the year (80 a spring one); the map's own when left out",
    },
    at: {
      kind: "number",
      default: 0.3,
      help: "the spot, as a share of the piste's length down it",
    },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 1280, help: "a frame's width, px" },
    height: { kind: "number", default: 720, help: "a frame's height, px" },
    cols: { kind: "number", default: 4, help: "tiles a row on a sheet" },
    scale: { kind: "number", default: 0.5, help: "a tile's size as a share of the frame" },
    out: { kind: "string", default: "piste-day", help: "file stem under previews/ (no extension)" },
    "sheets-only": { kind: "flag", help: "write the contact sheets, not every frame alone" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/piste-day-preview.mjs [--sheet=a,b] [--views=a,b] [--seed=n] [--region=id] [--hours=a,b] [--day=n] [--skip-build]",
);

const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "piste-day-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "piste-day-preview.html") },
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
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
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

const query = new URLSearchParams({
  seed: String(args.seed),
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
  cols: String(args.cols),
  scale: String(args.scale),
  hours: args.hours,
  at: String(args.at),
  ...(args.region ? { region: args.region } : {}),
  ...(Number.isFinite(args.day) ? { day: String(args.day) } : {}),
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

await page.goto(`${server.url}piste-day-preview.html?${query}`);
await guarded(page.waitForFunction("window.__piste !== undefined"));
const note = await guarded(page.evaluate("window.__piste.ready"));
/** @type {Record<string, string[]>} */
const groups = await page.evaluate("window.__piste.groups");

const allViews = Object.values(groups).flat();
const wantSheets = list(args.sheet);
const wantViews = list(args.views);
for (const s of wantSheets) {
  if (!groups[s]) {
    console.error(`unknown sheet "${s}" (${Object.keys(groups).join(", ")})`);
    process.exit(2);
  }
}
for (const v of wantViews) {
  if (!allViews.includes(v)) {
    console.error(`unknown view "${v}" (${allViews.join(", ")})`);
    process.exit(2);
  }
}

console.log(`piste-day — seed ${args.seed}${args.region ? ` ${args.region}` : ""}: ${note}`);
const safe = (s) => s.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "");
for (const [group, views] of Object.entries(groups)) {
  if (wantSheets.length && !wantSheets.includes(group)) continue;
  const shot = wantViews.length ? views.filter((v) => wantViews.includes(v)) : views;
  if (!shot.length) continue;
  const t0 = Date.now();
  const { frames } = await guarded(
    page.evaluate(([g, v]) => globalThis.__piste.sheet(g, v), [group, shot]),
  );
  if (!args["sheets-only"]) {
    for (const f of frames) {
      const file = join(outDir, `${args.out}-${safe(f.view)}-${safe(f.label)}.png`);
      writeFileSync(file, Buffer.from(f.png.split(",")[1], "base64"));
    }
  }
  // An element is photographed within the viewport: open it to the sheet.
  const box = await page.locator("#sheet").boundingBox();
  await page.setViewportSize({
    width: Math.max(args.width, Math.ceil(box.width)),
    height: Math.ceil(box.y + box.height),
  });
  const out = join(outDir, `${args.out}-${group}.png`);
  await page.locator("#sheet").screenshot({ path: out });
  await page.setViewportSize(viewport);
  const suffix = wantViews.length ? ` (${shot.join(", ")})` : "";
  console.log(
    `${out.replace(`${root}/`, "")}  ${frames.length} frames${suffix}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
  );
}

await browser.close();
await server.close();

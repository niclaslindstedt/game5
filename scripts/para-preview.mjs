#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARAMOTOR LAB — the free ride's paramotor (`docs/paramotor.md`;
// `engine/game/para.ts`, drawn by `pwa/src/game/para-scene.ts`, framed by
// `camera-para.ts`) staged at every moment it has and photographed through
// the game's own renderer, so the wing, its lines and the motor can be
// judged by eye and iterated on until they look right in the game:
//
//   summit     on the summit, the wing held overhead (the chase, behind,
//              the side, the front, from under the canopy, far off)
//   launch     skiing off: the wing let fly, the skis leaving the snow
//   flight     in the air on the bot's hands (the chase, a quarter, the
//              side, the front, from below, from above)
//   turn       a toggle pulled each way, then both brakes down
//   lean       the lean held forward and back, from the side and behind
//   landing    the final glide, the flare, speed riding under the wing
//   drop       the rig released, skiing on, the canopy and the motor lying
//              on the snow
//   gear       close up: the motor on his back, the cage and the propeller,
//              the risers, the canopy's underside
//   turntable  the rig in flight from eight sides
//   lenses     every rung of the game's camera in flight
//   night      in the air at 21:00
//
// Each GROUP is one contact sheet, previews/para-<group>.png, and every
// frame is also written alone, previews/para-<view>-<label>.png. The page
// (`pwa/src/tools/para-harness.ts`, its scenes in `para-scenes.ts`) stages
// each run on the engine and steps it itself, never on a wall clock, so a
// seed's sheet is the same sheet twice. This script builds it into a
// one-off bundle (never part of the app's build), serves it and drives it
// in a headless Chromium — `CHROMIUM_PATH` overrides where one is looked
// for.
//
//   node scripts/para-preview.mjs                       # every sheet
//   node scripts/para-preview.mjs --sheet=flight,gear
//   node scripts/para-preview.mjs --views=turntable     # just those views
//   node scripts/para-preview.mjs --seed=7 --weather=clear
//   node scripts/para-preview.mjs --sheet=gear --skip-build

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".para-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: {
      kind: "string",
      default: "",
      help: "which sheets, comma-separated (summit, launch, flight, turn, lean, landing, fold, drop, gear, turntable, lenses, night); every one when left out",
    },
    views: {
      kind: "string",
      default: "",
      help: "only these views, comma-separated (the same names as the sheets)",
    },
    seed: { kind: "number", default: 38, help: "the map's seed" },
    region: {
      kind: "string",
      default: "",
      help: "the kind of snow country (R21): alpine, fell, continental, maritime; the alpine when left out",
    },
    hour: {
      kind: "number",
      default: NaN,
      help: "the solar hour every sheet is drawn under (the map's own unless named; the night sheet is 21)",
    },
    weather: {
      kind: "string",
      default: "",
      help: "the sky every sheet is drawn under (clear, fair, flurries, high, overcast, snow, storm, fog); the map's own when left out",
    },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 1280, help: "a frame's width, px" },
    height: { kind: "number", default: 720, help: "a frame's height, px" },
    cols: { kind: "number", default: 3, help: "tiles a row on a sheet" },
    scale: { kind: "number", default: 0.5, help: "a tile's size as a share of the frame" },
    out: { kind: "string", default: "para", help: "file stem under previews/ (no extension)" },
    "sheets-only": { kind: "flag", help: "write the contact sheets, not every frame alone" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/para-preview.mjs [--sheet=a,b] [--views=a,b] [--seed=n] [--region=id] [--hour=h] [--weather=kind] [--skip-build]",
);

const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "para-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "para-preview.html") },
    },
  });
}
// The committed models (the skis) go beside the page,
// where the renderer fetches them.
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
  ...(args.region ? { region: args.region } : {}),
  ...(Number.isFinite(args.hour) ? { hour: String(args.hour) } : {}),
  ...(args.weather ? { weather: args.weather } : {}),
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

await page.goto(`${server.url}para-preview.html?${query}`);
await guarded(page.waitForFunction("window.__para !== undefined"));
const note = await guarded(page.evaluate("window.__para.ready"));
/** @type {Record<string, string[]>} */
const groups = await page.evaluate("window.__para.groups");

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

console.log(`para — seed ${args.seed}${args.region ? ` ${args.region}` : ""}: ${note}`);
const safe = (s) => s.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "");
for (const [group, views] of Object.entries(groups)) {
  if (wantSheets.length && !wantSheets.includes(group)) continue;
  const shot = wantViews.length ? views.filter((v) => wantViews.includes(v)) : views;
  if (!shot.length) continue;
  const t0 = Date.now();
  const { frames } = await guarded(
    page.evaluate(([g, v]) => globalThis.__para.sheet(g, v), [group, shot]),
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

#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GUNFIRE LAB — a stand-in shooter firing at a skier on the piste
// (`engine/game/gunfire.ts`, drawn by `pwa/src/game/gunfire-view.ts`), the
// real engine stepped and photographed through the game's own renderer
// with the INJURIES switch on, so the look of the fire can be judged and
// iterated on:
//
//   day   rifle (its flash over the shooter's shoulder, its strikes),
//         doorgun (the tracers from the air, the rounds coming in, the
//         strikes round him), rocket (in flight on its smoke, the burst,
//         the smoke after)
//   dusk  the same three under the evening's sky (--dusk=h)
//   sfw   SAFE FOR WORK: the rifle's and the door gun's warning fire
//
// Each frame is captioned with the time since the first shot, the rounds
// fired and the hits, its milliseconds, draw calls and triangles. Each
// GROUP is one contact sheet, previews/gunfire-<group>.png, and every frame
// is also written alone. The page (`pwa/src/tools/gunfire-harness.ts`)
// steps the engine itself, never on a wall clock, so a seed's sheet is the
// same sheet twice. Built into a one-off bundle (never part of the app's
// build), served and driven in a headless Chromium — `CHROMIUM_PATH`
// overrides where one is looked for. The numbers behind the pictures — the
// hits and the spread against range — are `scripts/gunfire-table.mjs`'s.
//
//   node scripts/gunfire-preview.mjs                  # every sheet
//   node scripts/gunfire-preview.mjs --sheet=dusk
//   node scripts/gunfire-preview.mjs --views=rocket --at=0.6

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".gunfire-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: {
      kind: "string",
      default: "",
      help: "which sheets, comma-separated (day, dusk, sfw); every one when left out",
    },
    views: {
      kind: "string",
      default: "",
      help: "only these views, comma-separated (rifle, doorgun, rocket, dusk-rifle, dusk-doorgun, dusk-rocket, sfw-rifle, sfw-doorgun)",
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
      help: "the solar hour the day sheets are drawn under (13 when left out)",
    },
    dusk: { kind: "number", default: 17, help: "the hour the dusk sheet is drawn under" },
    speed: { kind: "number", default: 12, help: "how fast he skis down the piste, m/s" },
    at: {
      kind: "number",
      default: 0.4,
      help: "where on the piste he is stood, a share of its length",
    },
    weather: {
      kind: "string",
      default: "",
      help: "the sky (clear, fair, high, overcast, flurries, snow, storm, fog); clear when left out",
    },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 1280, help: "a frame's width, px" },
    height: { kind: "number", default: 720, help: "a frame's height, px" },
    cols: { kind: "number", default: 2, help: "tiles a row on a sheet" },
    scale: { kind: "number", default: 0.5, help: "a tile's size as a share of the frame" },
    out: { kind: "string", default: "gunfire", help: "file stem under previews/ (no extension)" },
    "sheets-only": { kind: "flag", help: "write the contact sheets, not every frame alone" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/gunfire-preview.mjs [--sheet=a,b] [--views=a,b] [--seed=n] [--region=id] [--hour=h] [--dusk=h] [--speed=v] [--at=share] [--weather=kind] [--skip-build]",
);

const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "gunfire-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "gunfire-preview.html") },
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
  dusk: String(args.dusk),
  speed: String(args.speed),
  at: String(args.at),
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

await page.goto(`${server.url}gunfire-preview.html?${query}`);
await guarded(page.waitForFunction("window.__gunfire !== undefined"));
const note = await guarded(page.evaluate("window.__gunfire.ready"));
/** @type {Record<string, string[]>} */
const groups = await page.evaluate("window.__gunfire.groups");

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

console.log(`gunfire — seed ${args.seed}${args.region ? ` ${args.region}` : ""}: ${note}`);
const safe = (s) => s.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "");
for (const [group, views] of Object.entries(groups)) {
  if (wantSheets.length && !wantSheets.includes(group)) continue;
  const shot = wantViews.length ? views.filter((v) => wantViews.includes(v)) : views;
  if (!shot.length) continue;
  const t0 = Date.now();
  const { frames } = await guarded(
    page.evaluate(([g, v]) => globalThis.__gunfire.sheet(g, v), [group, shot]),
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

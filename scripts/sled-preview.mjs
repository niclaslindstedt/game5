#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE LAB — the free ride's snowmobile (`docs/snowmobile.md`;
// `engine/game/sled.ts`, drawn by `pwa/src/game/sled-view.ts`, held by
// `sled-scene.ts`, its rider posed by `skier-sled.ts`) staged at every
// moment it has and photographed through the game's own renderer, so each
// can be judged by eye and iterated on:
//
//   park       park (the parked machine at its spot from a quarter, the
//              side, behind and far off), call (a skier 50, 25 and 8 m off
//              it, the halo calling him)
//   board      board (a skier riding in and taken on, his skis racked),
//              rider (stood on the boards: the side, the front, a quarter,
//              his own eye)
//   groomer    groomer (pinned from the spot on the packed valley floor at
//              1 and 4 s, a turn)
//   powder     powder (sunk at rest in the meadow's powder, the launch out
//              of it, planing), roost (pinned from a crawl: the belt spinning
//              and throwing), carve (rolled onto its side through a powder
//              turn and over the other way)
//   climb      climb (up the steep face: on it, the side, the high-mark,
//              from below)
//   tracks     tracks (a weaving line through the meadow, looked back over)
//   hop        hop (the jump pressed twice: stepped off, the skis on)
//   crash      crash (flung over on a hard turn: going over, down)
//   night      night (riding at 21:00, the lamp from the front)
//   turntable  turntable (the parked machine from eight sides)
//   lenses     lenses (every rung of the game's camera riding it on the
//              groomer), lenses-powder (each through a powder turn)
//   cockpit    cockpit (the HELMET rung's cockpit at idle, flat out, both
//              turns and braking), cockpit-close (each hand, the levers and
//              the display close), cockpit-powder, cockpit-night
//
// Each GROUP is one contact sheet, previews/sled-<group>.png, and every
// frame is also written alone, previews/sled-<view>-<label>.png. The page
// (`pwa/src/tools/sled-harness.ts`, its scenes in `sled-scenes.ts`, its
// places off `heli-spots.ts`) stages each run on the engine on the rider's
// own controls and steps it itself, never on a wall clock, so a seed's
// sheet is the same sheet twice. This script builds it into a one-off
// bundle (never part of the app's build), serves it and drives it in a
// headless Chromium — `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/sled-preview.mjs                       # every sheet
//   node scripts/sled-preview.mjs --sheet=powder,climb
//   node scripts/sled-preview.mjs --views=roost,tracks  # just those views
//   node scripts/sled-preview.mjs --seed=7 --region=maritime --weather=clear
//   node scripts/sled-preview.mjs --sheet=turntable --skip-build

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".sled-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: {
      kind: "string",
      default: "",
      help: "which sheets, comma-separated (park, board, groomer, powder, climb, tracks, hop, crash, night, turntable, lenses, cockpit); every one when left out",
    },
    views: {
      kind: "string",
      default: "",
      help: "only these views, comma-separated (park, call, board, rider, groomer, powder, roost, carve, climb, tracks, hop, crash, night, turntable, lenses, lenses-powder, cockpit, cockpit-close, cockpit-powder, cockpit-night)",
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
    out: { kind: "string", default: "sled", help: "file stem under previews/ (no extension)" },
    "sheets-only": { kind: "flag", help: "write the contact sheets, not every frame alone" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/sled-preview.mjs [--sheet=a,b] [--views=a,b] [--seed=n] [--region=id] [--hour=h] [--weather=kind] [--skip-build]",
);

const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "sled-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "sled-preview.html") },
    },
  });
}
// The committed models (the snowmobile, the skis) go beside the page,
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

await page.goto(`${server.url}sled-preview.html?${query}`);
await guarded(page.waitForFunction("window.__sled !== undefined"));
const note = await guarded(page.evaluate("window.__sled.ready"));
/** @type {Record<string, string[]>} */
const groups = await page.evaluate("window.__sled.groups");

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

console.log(`sled — seed ${args.seed}${args.region ? ` ${args.region}` : ""}: ${note}`);
const safe = (s) => s.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "");
for (const [group, views] of Object.entries(groups)) {
  if (wantSheets.length && !wantSheets.includes(group)) continue;
  const shot = wantViews.length ? views.filter((v) => wantViews.includes(v)) : views;
  if (!shot.length) continue;
  const t0 = Date.now();
  const { frames } = await guarded(
    page.evaluate(([g, v]) => globalThis.__sled.sheet(g, v), [group, shot]),
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

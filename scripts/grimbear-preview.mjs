#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GRIMBEAR LAB — the beast a free ride meets now and then
// (`engine/game/grimbear.ts`, drawn by `pwa/src/game/grimbear-view.ts`,
// posed by `grimbear-pose.ts`) staged at every moment he has and
// photographed through the game's own renderer, so each can be judged by
// eye and iterated on:
//
//   figure   turntable (the figure stood from eight sides, a skier beside
//            him for his size)
//   gait     stride (his run strobed across one stride, side on), walk
//            (the walk he leaves on, the same)
//   moves    moves (lurking, running, roaring, the maul and its blow,
//            walking off — each from a quarter)
//   ambush   ambush (ridden: unseen from the skier's chase lens, behind his
//            trunk from beside, out of the trees, coming, on him)
//   kill     kill (the catch frame by frame from one lens planted square to
//            it — the reach, the throw, the beast over him, walking off),
//            kill-cam (the same as the player sees it: the death cam, then
//            stood up at the top of the slope)
//   miss     miss (a run that misses, frame by frame: the dive at him, the
//            swipe through the air beside him, stumbling on, roaring)
//   chase    chase (after the catch: out of the trees, running after him,
//            falling behind, pulled up roaring)
//   night    night (his eyes behind the trunk, in the headlamp)
//
// Each GROUP is one contact sheet, previews/grimbear-<group>.png, and every
// frame is also written alone, previews/grimbear-<view>-<label>.png. The
// page (`pwa/src/tools/grimbear-harness.ts`, its scenes in
// `grimbear-scenes.ts`) steps the engine itself with the bot skiing, never
// on a wall clock, so a seed's sheet is the same sheet twice. This script
// builds it into a one-off bundle (never part of the app's build), serves
// it and drives it in a headless Chromium — `CHROMIUM_PATH` overrides where
// one is looked for.
//
//   node scripts/grimbear-preview.mjs                    # every sheet
//   node scripts/grimbear-preview.mjs --sheet=kill,moves
//   node scripts/grimbear-preview.mjs --views=stride     # just those views
//   node scripts/grimbear-preview.mjs --seed=12 --hour=16

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".grimbear-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: {
      kind: "string",
      default: "",
      help: "which sheets, comma-separated (figure, gait, moves, ambush, kill, miss, chase, night); every one when left out",
    },
    views: {
      kind: "string",
      default: "",
      help: "only these views, comma-separated (turntable, stride, walk, moves, ambush, kill, kill-cam, miss, chase, night)",
    },
    seed: { kind: "number", default: 2, help: "the map's seed" },
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
    out: { kind: "string", default: "grimbear", help: "file stem under previews/ (no extension)" },
    "sheets-only": { kind: "flag", help: "write the contact sheets, not every frame alone" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/grimbear-preview.mjs [--sheet=a,b] [--views=a,b] [--seed=n] [--region=id] [--hour=h] [--weather=kind] [--skip-build]",
);

const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "grimbear-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "grimbear-preview.html") },
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

await page.goto(`${server.url}grimbear-preview.html?${query}`);
await guarded(page.waitForFunction("window.__grimbear !== undefined"));
const note = await guarded(page.evaluate("window.__grimbear.ready"));
/** @type {Record<string, string[]>} */
const groups = await page.evaluate("window.__grimbear.groups");

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

console.log(`grimbear — seed ${args.seed}${args.region ? ` ${args.region}` : ""}: ${note}`);
const safe = (s) => s.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "");
for (const [group, views] of Object.entries(groups)) {
  if (wantSheets.length && !wantSheets.includes(group)) continue;
  const shot = wantViews.length ? views.filter((v) => wantViews.includes(v)) : views;
  if (!shot.length) continue;
  const t0 = Date.now();
  const { frames } = await guarded(
    page.evaluate(([g, v]) => globalThis.__grimbear.sheet(g, v), [group, shot]),
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

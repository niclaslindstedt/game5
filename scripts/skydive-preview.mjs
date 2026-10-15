#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVE LAB — the free ride's skydive (`engine/game/chute.ts`, drawn
// by `pwa/src/game/chute-scene.ts` over `chute-canopy.ts`, `chute-gear.ts`
// and `chute-rig-plan.ts`, the body posed by `skier-skydive.ts`, framed by
// `camera-skydive.ts` and `camera-para.ts`) staged at every moment it has
// and photographed through the game's own renderer, so the rig, the canopy
// and the body can be judged by eye in the game:
//
//   gear       the harness-container on him from behind, the side
//              and the front (the pilot chute's handle, the cut-away pad,
//              the reserve's handle, the leg straps)
//   exit       poised in the plane's door, the exit and the swing into the
//              arch frame by frame
//   freefall   belly to earth, a turn each way, tracking, head down
//   deploy     the opening frame by frame: the reach, the throw, the bag
//              lifted, line stretch, the snivel, the slider coming down,
//              full — off his side and on the game's chase lens
//   shape      the sport main from behind, the side, below, the front, over
//              its top skin (the bridle, the bag, the pilot chute) and in a turn
//   canopy     flown hands off, a toggle each way, the front risers, the
//              flare, and the landing on the bot's hands
//   cutaway    the pad punched, the canopy streaming down, lying on the snow
//   crash      no pull: into the snow, the rig strapped to the body as it is
//              thrown and as it lies
//   reserve    after a cut-away the reserve pulled and opening frame by
//              frame, flown from behind, the side, below and over, beside
//              the main, and flared down onto the skis
//   snag       caught in a crown and on a lift's rope, hanging under it
//   lenses     every rung of the game's camera in freefall, through the
//              opening and under the canopy
//   night      the freefall, the opening and the canopy at 21:00
//
// Each GROUP is one contact sheet, previews/skydive-<group>.png, and every
// frame is also written alone, previews/skydive-<view>-<label>.png. The page
// (`pwa/src/tools/skydive-harness.ts`, its scenes in `skydive-scenes.ts`)
// stages each run on the engine and steps it itself, never on a wall
// clock, so a seed's sheet is the same sheet twice. This script builds it
// into a one-off bundle (never part of the app's build), serves it with
// the committed models beside it and drives it in a headless Chromium —
// `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/skydive-preview.mjs                       # every sheet
//   node scripts/skydive-preview.mjs --sheet=deploy,canopy
//   node scripts/skydive-preview.mjs --seed=7 --weather=clear
//   node scripts/skydive-preview.mjs --sheet=gear --skip-build

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".skydive-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: {
      kind: "string",
      default: "",
      help: "which sheets, comma-separated (gear, worn, exit, freefall, deploy, canopy, shape, cutaway, crash, reserve, snag, lenses, night, stages, speed); every one when left out",
    },
    views: {
      kind: "string",
      default: "",
      help: "only these views, comma-separated (the same names as the sheets)",
    },
    seed: { kind: "number", default: 38, help: "the map's seed" },
    skis: {
      kind: "string",
      default: "",
      help: "the pair he jumps on (lynx: a snowboard); the all-mountain pair when left out — the pictures then go under previews/skydive-<skis>-*",
    },
    region: {
      kind: "string",
      default: "",
      help: "the kind of snow country (R21): alpine, fell, continental, maritime; the alpine when left out",
    },
    hour: {
      kind: "number",
      default: NaN,
      help: "the solar hour every sheet is drawn under (the map's own unless named; the model sheet's night is 21)",
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
    out: { kind: "string", default: "skydive", help: "file stem under previews/ (no extension)" },
    "sheets-only": { kind: "flag", help: "write the contact sheets, not every frame alone" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/skydive-preview.mjs [--sheet=a,b] [--views=a,b] [--seed=n] [--skis=id] [--region=id] [--hour=h] [--weather=kind] [--skip-build]",
);

// Another pair's pictures beside the skier's, never over them.
const stem = args.skis && args.out === "skydive" ? `skydive-${args.skis}` : args.out;

const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "skydive-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "skydive-preview.html") },
    },
  });
}
// The committed models (the skis, the plane) go beside the page, where
// the renderer fetches them.
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
  ...(args.skis ? { skis: args.skis } : {}),
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

await page.goto(`${server.url}skydive-preview.html?${query}`);
await guarded(page.waitForFunction("window.__skydive !== undefined"));
const note = await guarded(page.evaluate("window.__skydive.ready"));
/** @type {Record<string, string[]>} */
const groups = await page.evaluate("window.__skydive.groups");

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

console.log(`skydive — seed ${args.seed}${args.region ? ` ${args.region}` : ""}: ${note}`);
const safe = (s) => s.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "");
for (const [group, views] of Object.entries(groups)) {
  if (wantSheets.length && !wantSheets.includes(group)) continue;
  const shot = wantViews.length ? views.filter((v) => wantViews.includes(v)) : views;
  if (!shot.length) continue;
  const t0 = Date.now();
  const { frames } = await guarded(
    page.evaluate(([g, v]) => globalThis.__skydive.sheet(g, v), [group, shot]),
  );
  if (!args["sheets-only"]) {
    for (const f of frames) {
      const file = join(outDir, `${stem}-${safe(f.view)}-${safe(f.label)}.png`);
      writeFileSync(file, Buffer.from(f.png.split(",")[1], "base64"));
    }
  }
  // An element is photographed within the viewport: open it to the sheet.
  const box = await page.locator("#sheet").boundingBox();
  await page.setViewportSize({
    width: Math.max(args.width, Math.ceil(box.width)),
    height: Math.ceil(box.y + box.height),
  });
  const out = join(outDir, `${stem}-${group}.png`);
  await page.locator("#sheet").screenshot({ path: out });
  await page.setViewportSize(viewport);
  const suffix = wantViews.length ? ` (${shot.join(", ")})` : "";
  console.log(
    `${out.replace(`${root}/`, "")}  ${frames.length} frames${suffix}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
  );
}

await browser.close();
await server.close();

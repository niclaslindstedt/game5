#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AVALANCHE LAB — a slab avalanche (`engine/game/avalanche.ts`) as the
// game draws it (`pwa/src/game/avalanche-view.ts`, `avalanche-glsl.ts`),
// released on a generated free ride's loaded lee face and photographed
// through the game's own renderer, so the look can be judged by eye against
// what a real slab avalanche looks like (`docs/avalanche.md` § As drawn):
//
//   release   the crown cracking and the slab starting off, 0–2 s
//   flow      the front and its powder cloud from beside and from below,
//             at 3, 6, 10 and 15 s
//   debris    the deposit after the flow stops, close, at its toe and far,
//             and the crown and the bed from below
//   caught    a skier crossing the slab when it breaks, from the chase
//   night     the flow and the debris at hour 21, under the headlamp
//
// Each GROUP is one contact sheet, previews/avalanche-<group>.png, and every
// frame is also written alone, previews/avalanche-<view>-<label>.png. Each
// frame's cost (the draw's wall time with the GPU finished, its draw calls
// and triangles) is printed under the sheet: a frame with the slide in it
// against one without is what the effect costs. The page
// (`pwa/src/tools/avalanche-harness.ts`) steps the engine itself, never on a
// wall clock, so a seed's sheet is the same sheet twice. This script builds
// it into a one-off bundle (never part of the app's build), serves it and
// drives it in a headless Chromium — `CHROMIUM_PATH` overrides where one is
// looked for.
//
//   node scripts/avalanche-preview.mjs                  # every sheet
//   node scripts/avalanche-preview.mjs --sheet=flow,debris
//   node scripts/avalanche-preview.mjs --seed=7 --region=maritime --at=1200,900

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".avalanche-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: {
      kind: "string",
      default: "",
      help: "which sheets, comma-separated (release, flow, debris, caught, night); every one when left out",
    },
    views: {
      kind: "string",
      default: "",
      help: "only these views, comma-separated (release, beside, below, debris, caught, night)",
    },
    seed: {
      kind: "number",
      default: 7,
      help: "the map's seed (7: an open face whose slide stops in sight, 330 m down)",
    },
    region: {
      kind: "string",
      default: "",
      help: "the kind of snow country (R21): alpine, fell, continental, maritime; the alpine when left out",
    },
    at: {
      kind: "string",
      default: "",
      help: "where the slab breaks, x,z in map metres; the most avalanche-prone open face when left out",
    },
    snow: { kind: "number", default: 3, help: "the snow dial (1 the ordinary snow)" },
    depth: {
      kind: "number",
      default: 0.6,
      help: "the slab's depth wanted, m: the run's seed is picked so its slab is nearest it",
    },
    hour: { kind: "number", default: 11, help: "the solar hour the sheets are drawn under" },
    weather: {
      kind: "string",
      default: "clear",
      help: "the sky (R19's kinds: clear, fair, overcast, snow, storm, fog …); dealt keeps the map's own",
    },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 1280, help: "a frame's width, px" },
    height: { kind: "number", default: 720, help: "a frame's height, px" },
    cols: { kind: "number", default: 2, help: "tiles a row on a sheet" },
    scale: { kind: "number", default: 0.5, help: "a tile's size as a share of the frame" },
    out: { kind: "string", default: "avalanche", help: "file stem under previews/ (no extension)" },
    "sheets-only": { kind: "flag", help: "write the contact sheets, not every frame alone" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/avalanche-preview.mjs [--sheet=a,b] [--views=a,b] [--seed=n] [--region=id] [--at=x,z] [--snow=d] [--hour=h] [--skip-build]",
);

const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "avalanche-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "avalanche-preview.html") },
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
  ...(args.at ? { at: args.at } : {}),
  snow: String(args.snow),
  depth: String(args.depth),
  hour: String(args.hour),
  weather: args.weather,
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

await page.goto(`${server.url}avalanche-preview.html?${query}`);
await guarded(page.waitForFunction("window.__avalanche !== undefined"));
const note = await guarded(page.evaluate("window.__avalanche.ready"));
/** @type {Record<string, string[]>} */
const groups = await page.evaluate("window.__avalanche.groups");

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

console.log(`avalanche — seed ${args.seed}${args.region ? ` ${args.region}` : ""}: ${note}`);
const safe = (s) => s.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "");
for (const [group, views] of Object.entries(groups)) {
  if (wantSheets.length && !wantSheets.includes(group)) continue;
  const shot = wantViews.length ? views.filter((v) => wantViews.includes(v)) : views;
  if (!shot.length) continue;
  const t0 = Date.now();
  const { frames, costs } = await guarded(
    page.evaluate(([g, v]) => globalThis.__avalanche.sheet(g, v), [group, shot]),
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
  for (const c of costs) {
    console.log(
      `  ${c.label.padEnd(44)} ${c.ms.toFixed(1).padStart(7)} ms  ${String(c.calls).padStart(4)} calls  ${String(c.triangles).padStart(8)} tris`,
    );
  }
}

await browser.close();
await server.close();

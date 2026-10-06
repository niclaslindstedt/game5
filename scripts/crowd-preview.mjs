#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CROWD LAB — the free ride's amateurs (`engine/game/crowd.ts`, drawn by
// `pwa/src/game/crowd-view.ts`), photographed: contact sheets of every body
// at every pose and cut, and the crowd out on a real mountain through the
// game's own renderer.
//
//   figures   every body × the stance and each of the player's poses its
//             morph targets are (`crowd-rig.ts`)      → previews/crowd-figures.png
//   lods      every body at its NEAR, MID and FAR cut, with the triangles,
//             and the far cut at the game's size       → previews/crowd-lods.png
//   moments   the poses blended as the crowd is drawn: carves, the tuck, the
//             wedge, a hockey stop, a double pole, a kicker
//                                                      → previews/crowd-moments.png
//   falls     an amateur thrown onto the ragdoll three ways and strobed as he
//             goes over, lies and gets up, on the snow he is on
//                                                      → previews/crowd-falls.png
//   dress     a real crowd's groups in what they were dealt
//                                                      → previews/crowd-dress.png
//   slope     the crowd on `--seed`'s mountain `--t` s into a free ride, at
//             the views `busy`, `group`, `chase`, `kicker`, `overview`,
//             `queue` (the longest lift queue at its foot) and `chairs`
//             (a chair line with its riders, from under it), and
//             `fall-<s>` (an amateur shouldered over, <s> s after)
//                                                      → previews/crowd-slope-<view>.png
//
// The page does the drawing (`pwa/src/tools/crowd-harness.ts`); this builds
// it into a one-off bundle (never deployed), serves it and photographs it in
// a headless Chromium — `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/crowd-preview.mjs                       # every sheet
//   node scripts/crowd-preview.mjs --sheet=figures,lods
//   node scripts/crowd-preview.mjs --sheet=slope --seed=7 --t=90 --views=busy,group
//   node scripts/crowd-preview.mjs --bodies=child,oldWoman --sheet=moments
//   node scripts/crowd-preview.mjs --sheet=falls
//   node scripts/crowd-preview.mjs --sheet=slope --views=fall-0.3,fall-1,fall-3,fall-6
//   node scripts/crowd-preview.mjs --skip-build          # reuse the last bundle

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".crowd-preview");
const outDir = join(root, "previews");

const SHEETS = ["figures", "lods", "moments", "falls", "dress", "slope"];
const VIEWS = ["busy", "group", "chase", "kicker", "overview", "queue", "chairs"];

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: {
      kind: "string",
      default: SHEETS.join(","),
      help: `which sheets, comma-separated (${SHEETS.join(", ")})`,
    },
    bodies: {
      kind: "string",
      default: "",
      help: "only these bodies on the figure sheets (man,woman,teen,child,oldMan,oldWoman,freerider,retro)",
    },
    seed: {
      kind: "number",
      default: 38,
      help: "the free ride's map, for the dress and slope sheets",
    },
    t: { kind: "number", default: 60, help: "seconds of free ride before the slope's first view" },
    views: {
      kind: "string",
      default: VIEWS.join(","),
      help: `the slope's views, comma-separated (${VIEWS.join(", ")}, and fall-<s>: an amateur shouldered over, <s> s after)`,
    },
    width: { kind: "number", default: 1280, help: "the slope's picture width, px" },
    height: { kind: "number", default: 720, help: "the slope's picture height, px" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 900, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/crowd-preview.mjs [--sheet=figures,lods,moments,falls,dress,slope] [--bodies=a,b] [--seed=n] [--t=s] [--views=a,b] [--skip-build]",
);

const sheets = args.sheet.split(",").map((s) => s.trim());
for (const s of sheets) {
  if (!SHEETS.includes(s)) {
    console.error(`unknown sheet "${s}" (${SHEETS.join(", ")})`);
    process.exit(2);
  }
}
const views = args.views.split(",").map((v) => v.trim());
for (const v of views) {
  if (!VIEWS.includes(v) && !/^fall-\d+(\.\d+)?$/.test(v)) {
    console.error(`unknown view "${v}" (${VIEWS.join(", ")})`);
    process.exit(2);
  }
}

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "crowd-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "crowd-preview.html") },
    },
  });
}
// The slope draws the player's modelled skis and skier, as the game does.
cpSync(join(root, "pwa", "models"), join(buildDir, "models"), { recursive: true });

const found = await findChromium();
if (!found) process.exit(1);

const server = await serveDir(buildDir);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

/** Open the page on a sheet; resolve once it says it is done — or fail at
 * once on a page error rather than burning the timeout on a crash. */
async function open(sheet, extra, viewport) {
  const page = await browser.newPage({ viewport });
  let crashed = null;
  page.on("pageerror", (err) => {
    crashed ??= err;
    console.error(`[pageerror] ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error(`[console] ${msg.text()}`);
  });
  page.setDefaultTimeout(args.timeout * 1000);
  const params = new URLSearchParams({ sheet, seed: String(args.seed), ...extra });
  if (args.bodies) params.set("bodies", args.bodies);
  await page.goto(`${server.url}crowd-preview.html?${params}`);
  await Promise.race([
    page.waitForFunction("window.__done === true", undefined, { timeout: args.timeout * 1000 }),
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
  return page;
}

console.log(`crowd — seed ${args.seed}, sheets ${sheets.join(", ")}`);
for (const sheet of sheets) {
  const t0 = Date.now();
  if (sheet === "slope") {
    const page = await open(
      "slope",
      { t: String(args.t), w: String(args.width), h: String(args.height) },
      { width: args.width, height: args.height },
    );
    for (const view of views) {
      const note = await page.evaluate((v) => globalThis.__crowd.shoot(v), view);
      const out = join(outDir, `crowd-slope-${args.seed}-${view}.png`);
      await page.locator("canvas#stage").screenshot({ path: out });
      console.log(`${out.replace(`${root}/`, "")}  ${note}`);
    }
    await page.close();
    continue;
  }
  const page = await open(sheet, {}, { width: 1600, height: 900 });
  const stage = await page.$("canvas#stage");
  const box = await stage.boundingBox();
  await page.setViewportSize({ width: Math.ceil(box.width), height: Math.ceil(box.height) });
  const out = join(outDir, `crowd-${sheet}.png`);
  await page.screenshot({ path: out, fullPage: true });
  console.log(`${out.replace(`${root}/`, "")}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  await page.close();
}

await browser.close();
await server.close();

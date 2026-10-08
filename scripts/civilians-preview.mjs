#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CIVILIANS LAB — the free ride's people on foot (`civilian-plan.ts`,
// drawn by `pwa/src/game/civilians-view.ts`), photographed: contact sheets
// of every body at every move, the moves strobed, the props close, and the
// ski area through the game's own renderer by day and after dark.
//
//   figures   every body × the stance and each pose its morph targets are
//             (`civilian-moves.ts`), front and side   → previews/civilians/figures.png
//   moves     every activity strobed over its cycle as the view blends it
//                                                     → previews/civilians/moves.png
//   props     the skis on a shoulder, the mug, the beer, the shovel, the
//             broom, the snowball, the heads, the staff, a deck chair, a
//             snowman, the cuts                       → previews/civilians/props.png
//   resort    `--seed`'s free ride at `--views` (lift, terrace, yard, base,
//             walker, cocoa, kids, overview) by day, and `--night` of them
//             at `--night-hour`                       → previews/civilians/resort-<seed>-<view>[-night].png
//
// The page does the drawing (`pwa/src/tools/civilians-harness.ts`); this
// builds it into a one-off bundle (never deployed), serves it and
// photographs it in a headless Chromium — `CHROMIUM_PATH` overrides where
// one is looked for.
//
//   node scripts/civilians-preview.mjs                    # every sheet
//   node scripts/civilians-preview.mjs --sheet=figures --bodies=man,child
//   node scripts/civilians-preview.mjs --sheet=resort --seed=7 --views=terrace --night=
//   node scripts/civilians-preview.mjs --skip-build       # reuse the last bundle

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".civilians-preview");

const SHEETS = ["figures", "moves", "props", "resort"];
const VIEWS = ["lift", "terrace", "yard", "base", "walker", "cocoa", "kids", "overview"];

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
      help: "only these bodies on the figures sheet (man,woman,teen,child,oldMan,oldWoman,freerider,retro)",
    },
    seed: { kind: "number", default: 38, help: "the free ride's map, for the resort sheet" },
    hour: {
      kind: "number",
      default: -1,
      help: "the resort's daytime hour (default the map's own)",
    },
    views: {
      kind: "string",
      default: VIEWS.join(","),
      help: `the resort's daytime views, comma-separated (${VIEWS.join(", ")})`,
    },
    night: {
      kind: "string",
      default: "terrace,base",
      help: "the resort's views again after dark (empty for none)",
    },
    "night-hour": { kind: "number", default: 21, help: "the hour the night views are at" },
    out: { kind: "string", default: "previews/civilians", help: "where the pictures go" },
    tag: { kind: "string", default: "", help: "a suffix on every file name (a round's name)" },
    width: { kind: "number", default: 1280, help: "the resort's picture width, px" },
    height: { kind: "number", default: 720, help: "the resort's picture height, px" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 900, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/civilians-preview.mjs [--sheet=figures,moves,props,resort] [--bodies=a,b] [--seed=n] [--views=a,b] [--night=a,b] [--tag=round1] [--skip-build]",
);

const sheets = args.sheet.split(",").map((s) => s.trim());
for (const s of sheets) {
  if (!SHEETS.includes(s)) {
    console.error(`unknown sheet "${s}" (${SHEETS.join(", ")})`);
    process.exit(2);
  }
}
const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
const views = list(args.views);
const nights = list(args.night);
for (const v of [...views, ...nights]) {
  if (!VIEWS.includes(v)) {
    console.error(`unknown view "${v}" (${VIEWS.join(", ")})`);
    process.exit(2);
  }
}
const outDir = join(root, args.out);
mkdirSync(outDir, { recursive: true });
const tag = args.tag ? `-${args.tag}` : "";

if (!args["skip-build"] || !existsSync(join(buildDir, "civilians-preview.html"))) {
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
      chunkSizeWarningLimit: 4000,
      rollupOptions: { input: join(root, "pwa", "civilians-preview.html") },
    },
  });
}
// The resort draws the player's modelled skis and skier, as the game does.
cpSync(join(root, "pwa", "models"), join(buildDir, "models"), { recursive: true });

const found = await findChromium();
if (!found) process.exit(1);

const server = await serveDir(buildDir);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

/** Open the page on a sheet; resolve once it says it is done — or fail at
 * once on a page error. */
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
  await page.goto(`${server.url}civilians-preview.html?${params}`);
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

const rel = (p) => p.replace(`${root}/`, "");
console.log(`civilians — seed ${args.seed}, sheets ${sheets.join(", ")}`);
for (const sheet of sheets) {
  const t0 = Date.now();
  if (sheet === "resort") {
    for (const [names, hour, suffix] of [
      [views, args.hour, ""],
      [nights, args["night-hour"], "-night"],
    ]) {
      if (names.length === 0) continue;
      const extra = { w: String(args.width), h: String(args.height) };
      if (hour >= 0) extra.hour = String(hour);
      const page = await open("resort", extra, { width: args.width, height: args.height });
      for (const view of names) {
        const note = await page.evaluate((v) => globalThis.__civilians.shoot(v), view);
        const out = join(outDir, `resort-${args.seed}-${view}${suffix}${tag}.png`);
        await page.locator("canvas#stage").screenshot({ path: out });
        console.log(`${rel(out)}  ${note}`);
      }
      await page.close();
    }
    continue;
  }
  const page = await open(sheet, {}, { width: 1600, height: 900 });
  const stage = await page.$("canvas#stage");
  const box = await stage.boundingBox();
  await page.setViewportSize({ width: Math.ceil(box.width), height: Math.ceil(box.height) });
  const out = join(outDir, `${sheet}${tag}.png`);
  await page.screenshot({ path: out, fullPage: true });
  console.log(`${rel(out)}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  await page.close();
}

await browser.close();
await server.close();

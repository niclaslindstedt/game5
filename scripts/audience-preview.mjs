#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AUDIENCE LAB — the crowd a race is watched by (`spectator-plan.ts`,
// drawn and moved by `pwa/src/game/spectators.ts` and
// `spectator-shapes.ts`), photographed: contact sheets of the fan figure
// and its moves, and the crowd on a real race through the game's own
// renderer.
//
//   moves   every style (clap, wave, bell, flag, jump, sign, horn, film)
//           through its animation: at rest, a racer coming, frames a tenth
//           of a second apart with him level, turned to follow him past
//                                                   → previews/audience-moves.png
//   looks   the first fans `--seed`'s plan deals, in what they were dealt
//                                                   → previews/audience-looks.png
//   cuts    a few of them at the NEAR, MID and FAR cuts, with the triangles, and
//           the far cut at the game's size          → previews/audience-cuts.png
//   race    the crowd on `--seed`'s race (`--mode`), the bot skiing, at the
//           views `start`, `course` (up a slalom's course from its middle),
//           `combo` (a slalom's combination), `turn`, `pitch`, `jump`, `line`, `slope`,
//           `pass-0` … `pass-5` (one bank of the finish slope frame by
//           frame as the racer passes), `idle` (that bank with the racer
//           far up the hill), `finish`, `stand`, `screen`, `arena`,
//           `overview` and `chase`
//                                                   → previews/audience-race-<seed>-<view>.png
//
// The page does the drawing (`pwa/src/tools/audience-harness.ts`); this
// builds it into a one-off bundle (never deployed), serves it and
// photographs it in a headless Chromium — `CHROMIUM_PATH` overrides where
// one is looked for.
//
//   node scripts/audience-preview.mjs                          # every sheet
//   node scripts/audience-preview.mjs --sheet=moves
//   node scripts/audience-preview.mjs --sheet=race --seed=7 --views=jump,stand,arena
//   node scripts/audience-preview.mjs --sheet=race --mode=free  # (a free ride: none)
//   node scripts/audience-preview.mjs --sheet=race --hour=19    # under the lights
//   node scripts/audience-preview.mjs --skip-build             # reuse the last bundle

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".audience-preview");
const outDir = join(root, "previews");

const SHEETS = ["moves", "looks", "cuts", "race"];
const PASS = [0, 1, 2, 3, 4, 5].map((k) => `pass-${k}`);
const VIEWS = [
  "idle",
  "start",
  "course",
  "combo",
  "turn",
  "pitch",
  "jump",
  "line",
  "slope",
  ...PASS,
  "finish",
  "stand",
  "screen",
  "arena",
  "overview",
  "chase",
];
const MODES = ["slalom", "timeTrial", "tricks", "free"];

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: {
      kind: "string",
      default: SHEETS.join(","),
      help: `which sheets, comma-separated (${SHEETS.join(", ")})`,
    },
    seed: {
      kind: "number",
      default: 38,
      help: "the race's map, for the looks, cuts and race sheets",
    },
    mode: {
      kind: "string",
      default: "slalom",
      help: `the run the race sheet skis (${MODES.join(", ")})`,
    },
    views: {
      kind: "string",
      default: VIEWS.join(","),
      help: `the race's views, comma-separated (${VIEWS.join(", ")}; "pass" for all six pass frames)`,
    },
    hour: {
      kind: "number",
      default: NaN,
      help: "the solar hour the race sheet is under (the map's own unless named)",
    },
    width: { kind: "number", default: 1280, help: "the race's picture width, px" },
    height: { kind: "number", default: 720, help: "the race's picture height, px" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 900, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/audience-preview.mjs [--sheet=moves,looks,cuts,race] [--seed=n] [--mode=slalom] [--views=a,b] [--hour=h] [--skip-build]",
);

const sheets = args.sheet.split(",").map((s) => s.trim());
for (const s of sheets) {
  if (!SHEETS.includes(s)) {
    console.error(`unknown sheet "${s}" (${SHEETS.join(", ")})`);
    process.exit(2);
  }
}
if (!MODES.includes(args.mode)) {
  console.error(`unknown mode "${args.mode}" (${MODES.join(", ")})`);
  process.exit(2);
}
const views = args.views
  .split(",")
  .map((v) => v.trim())
  .flatMap((v) => (v === "pass" ? PASS : [v]));
for (const v of views) {
  if (!VIEWS.includes(v)) {
    console.error(`unknown view "${v}" (${VIEWS.join(", ")})`);
    process.exit(2);
  }
}

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "audience-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "audience-preview.html") },
    },
  });
}
// The race draws the player's modelled skis and skier, as the game does.
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
  const params = new URLSearchParams({ sheet, seed: String(args.seed), mode: args.mode, ...extra });
  if (Number.isFinite(args.hour)) params.set("hour", String(args.hour));
  await page.goto(`${server.url}audience-preview.html?${params}`);
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

console.log(`audience — seed ${args.seed}, mode ${args.mode}, sheets ${sheets.join(", ")}`);
for (const sheet of sheets) {
  const t0 = Date.now();
  if (sheet === "race") {
    const page = await open(
      "race",
      { w: String(args.width), h: String(args.height) },
      { width: args.width, height: args.height },
    );
    const ordered = await page.evaluate((v) => globalThis.__aud.order(v), views);
    const tag = args.mode === "slalom" ? "" : `-${args.mode}`;
    for (const view of ordered) {
      const note = await page.evaluate((v) => globalThis.__aud.shoot(v), view);
      const out = join(outDir, `audience-race-${args.seed}${tag}-${view}.png`);
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
  const out = join(outDir, `audience-${sheet}.png`);
  await page.screenshot({ path: out, fullPage: true });
  console.log(`${out.replace(`${root}/`, "")}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  await page.close();
}

await browser.close();
await server.close();

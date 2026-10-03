#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELMET LAB (`make helmet`): the skier's head in its helmet, the
// code's (the dressed skier's, `dress-head.ts` over `helmet-shape.ts`)
// and a modelled skier's (a candidate from `make blender KIND=skier`)
// side by side, posed by the game's own pose — `previews/helmet-<sheet>.png`:
//
//   views    every source and kit a row: the front, the three-quarter, the
//            side, the rear three-quarter, the back, above, and the chase
//            camera's angle
//   wire     the same with every triangle's edges drawn, and the head's
//            triangles counted by material — where the budget went
//   profile  side, front and top, flat on a centimetre grid, with the
//            envelope a real adult ski helmet fills dashed over it
//   game     the head's window in a 1280×720 frame from the chase and far
//            cameras, stood and tucked, enlarged without smoothing
//
// It exists because the helmet is what the chase camera looks at for the
// whole run, thirty pixels across, and a change to it is judged three
// ways at once: does it read as a ski helmet up close, did the triangles
// go where the silhouette needs them, and what is left of it at the
// game's own pixels.
//
//   node scripts/helmet-preview.mjs                      every sheet, slot 0
//   node scripts/helmet-preview.mjs --sheet=wire --slots=0,1,2,3
//   node scripts/helmet-preview.mjs --model=previews/blender/skier0-lod0.glb
//                                  a modelled skier beside the code's

import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".helmet-preview");
const outDir = join(root, "previews");
const SHEETS = ["views", "wire", "profile", "game"];

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: {
      kind: "string",
      default: "",
      help: `the sheets (${SHEETS.join(", ")}), comma-separated; every one when left out`,
    },
    slots: { kind: "string", default: "0", help: "the start-line kits, comma-separated (0..3)" },
    model: {
      kind: "string",
      default: "",
      help: "modelled skiers (.glb), comma-separated, drawn beside the code's",
    },
    code: { kind: "flag", default: true, help: "draw the code's helmet (--code=0: not)" },
    cell: { kind: "number", default: 300, help: "a cell's width, px" },
    "skip-build": { kind: "flag", default: false, help: "reuse the last bundle" },
    timeout: { kind: "number", default: 120, help: "seconds a sheet may take" },
  },
  "usage: node scripts/helmet-preview.mjs [--sheet=views,wire,profile,game] [--slots=0,1] [--model=a.glb] [--code=0]",
);

const sheets = args.sheet ? args.sheet.split(",") : SHEETS;
const bad = sheets.find((s) => !SHEETS.includes(s));
if (bad) {
  console.error(`unknown sheet "${bad}" (${SHEETS.join(", ")})`);
  process.exit(2);
}

mkdirSync(outDir, { recursive: true });
if (!args["skip-build"] || !existsSync(join(buildDir, "helmet-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "helmet-preview.html") },
    },
  });
}
// The committed models beside the page, as the game fetches them; every
// candidate beside them under its own name.
cpSync(join(root, "pwa", "models"), join(buildDir, "models"), { recursive: true });
const sources = [];
if (args.code) sources.push("code");
for (const file of args.model ? args.model.split(",") : []) {
  const from = resolve(root, file);
  if (!existsSync(from)) {
    console.error(`no model at ${file}`);
    process.exit(2);
  }
  mkdirSync(join(buildDir, "candidates"), { recursive: true });
  copyFileSync(from, join(buildDir, "candidates", basename(from)));
  sources.push(`candidates/${basename(from)}`);
}

const found = await findChromium();
if (!found) process.exit(1);
const server = await serveDir(buildDir);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

let crashed = null;
for (const sheet of sheets) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  page.on("pageerror", (err) => {
    crashed ??= err;
    console.error(`[pageerror] ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error(`[console] ${msg.text()}`);
  });
  page.setDefaultTimeout(args.timeout * 1000);
  const query = new URLSearchParams({
    sheet,
    slots: args.slots,
    sources: sources.join(","),
    cell: String(args.cell),
  }).toString();
  const t0 = Date.now();
  await page.goto(`${server.url}helmet-preview.html?${query}`);
  await page.waitForFunction("window.__helmet !== undefined");
  await page.evaluate("window.__helmet.ready");
  if (crashed) process.exit(1);
  const drawn = await page.evaluate(() => globalThis.__helmet.sheet());
  if (crashed) process.exit(1);
  const out = join(outDir, `helmet-${sheet}.png`);
  // The viewport sized to the sheet, or a wide one is cut at its edge.
  const box = await page.locator("#sheet").boundingBox();
  if (box) {
    await page.setViewportSize({
      width: Math.max(800, Math.ceil(box.width)),
      height: Math.max(600, Math.ceil(box.height)),
    });
  }
  await page.locator("#sheet").screenshot({ path: out });
  console.log(
    `${out.replace(`${root}/`, "")}  ${drawn.rows}×${drawn.cols}: ${drawn.note}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
  );
  for (const line of drawn.table) console.log(`  ${line}`);
  await page.close();
}
await browser.close();
await server.close();

#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GEAR LAB (`make gear`): the skier in his kit — every jacket, pair of
// pants, helmet, pair of gloves and pair of poles of the catalog
// (`outfit.ts`) and both bodies, cut on the loom and skinned on the rig
// (`dress.ts`, `skier-dress.ts`) — drawn by the game's own builder and
// posed by the game's own pose, beside a MODELLED skier when one is asked
// for — `previews/gear-<sheet>.png`:
//
//   catalog   every piece of the slots asked for, over the default kit, a
//             row a piece, from four sides and close on what it is
//   outfits   every start-line outfit asked for, from four sides
//   poses     the first outfit through the moves the rig is posed in
//   game      every outfit at the chase and far cameras' own pixels
//   wire      the outfits' triangles, counted by mesh
//   compare   the dressed figure beside each `--model` (a Blender glTF,
//             e.g. `make blender KIND=skier`'s previews/blender/skier0-lod0.glb)
//             in one kit, with each one's triangles and making cost
//   refs      local reference photographs (`--refs=DIR`: jpg, png or webp
//             files named by slot — `jacket-…`, `pants-…`, `helmet-…`,
//             `gloves-…`, `poles-…`, `body-…`) beside the pieces as drawn.
//             They stay where they are: never copied under the tree, never
//             committed (AGENTS.md: name no real product)
//
// It exists because a garment is judged three ways at once: does it read
// as the real thing beside a photograph, does it bend where he does
// through every move, and what is left of it at the game's own pixels.
//
//   node scripts/gear-preview.mjs                          every sheet
//   node scripts/gear-preview.mjs --sheet=catalog --slots=jacket,pants
//   node scripts/gear-preview.mjs --sheet=poses --outfits=woman.puffer.baggy.visor.mitten.powder
//   node scripts/gear-preview.mjs --sheet=compare --model=previews/blender/skier0-lod0.glb
//   node scripts/gear-preview.mjs --sheet=refs --refs=/path/to/scratch/refs

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".gear-preview");
const outDir = join(root, "previews");
const SHEETS = ["catalog", "outfits", "poses", "game", "wire", "compare", "refs"];
const SLOTS = ["body", "weight", "jacket", "pants", "helmet", "gloves", "poles"];

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: {
      kind: "string",
      default: "",
      help: `the sheets (${SHEETS.join(", ")}), comma-separated; every one but refs when left out`,
    },
    slots: {
      kind: "string",
      default: SLOTS.join(","),
      help: `the catalog's slots (${SLOTS.join(", ")}), comma-separated`,
    },
    outfits: {
      kind: "string",
      default: "0,1,2,3",
      help: "outfits: start-line slots (0..3) or seven ids body.weight.jacket.pants.helmet.gloves.poles, comma-separated",
    },
    model: {
      kind: "string",
      default: "",
      help: "modelled skiers (.glb) to set beside the dressed figure on the compare and game sheets",
    },
    refs: {
      kind: "string",
      default: "",
      help: "a directory of local reference photographs, named by slot (the refs sheet)",
    },
    skis: { kind: "string", default: "chamois", help: "the pair he stands on" },
    cell: { kind: "number", default: 300, help: "a cell's width, px" },
    "skip-build": { kind: "flag", default: false, help: "reuse the last bundle" },
    timeout: { kind: "number", default: 180, help: "seconds a sheet may take" },
  },
  "usage: node scripts/gear-preview.mjs [--sheet=catalog,outfits,poses,game,wire,compare,refs] [--slots=jacket] [--outfits=0,1] [--model=a.glb] [--refs=DIR]",
);

const sheets = args.sheet ? args.sheet.split(",") : SHEETS.filter((s) => s !== "refs");
const bad = sheets.find((s) => !SHEETS.includes(s));
if (bad) {
  console.error(`unknown sheet "${bad}" (${SHEETS.join(", ")})`);
  process.exit(2);
}
const badSlot = args.slots.split(",").find((s) => !SLOTS.includes(s));
if (badSlot) {
  console.error(`unknown slot "${badSlot}" (${SLOTS.join(", ")})`);
  process.exit(2);
}

mkdirSync(outDir, { recursive: true });
if (!args["skip-build"] || !existsSync(join(buildDir, "gear-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "gear-preview.html") },
    },
  });
}

// The models beside the page under their own names; the references in a
// scratch folder of the bundle (itself gitignored), cleared every run.
const models = [];
for (const file of args.model ? args.model.split(",") : []) {
  const from = resolve(root, file);
  if (!existsSync(from)) {
    console.error(`no model at ${file}`);
    process.exit(2);
  }
  mkdirSync(join(buildDir, "candidates"), { recursive: true });
  copyFileSync(from, join(buildDir, "candidates", basename(from)));
  models.push(`candidates/${basename(from)}`);
}
const refDir = join(buildDir, "refs");
rmSync(refDir, { recursive: true, force: true });
const refs = [];
if (args.refs) {
  const from = resolve(args.refs);
  if (!existsSync(from)) {
    console.error(`no directory at ${args.refs}`);
    process.exit(2);
  }
  mkdirSync(refDir, { recursive: true });
  for (const f of readdirSync(from).sort()) {
    if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
    copyFileSync(join(from, f), join(refDir, f));
    refs.push(`refs/${f}`);
  }
}
// The committed models (the skis) beside the page, as the game fetches them.
const committed = join(root, "pwa", "models");
if (existsSync(committed)) {
  mkdirSync(join(buildDir, "models"), { recursive: true });
  for (const f of readdirSync(committed))
    copyFileSync(join(committed, f), join(buildDir, "models", f));
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
    outfits: args.outfits,
    models: models.join(","),
    refs: refs.join(","),
    skis: args.skis,
    cell: String(args.cell),
  }).toString();
  const t0 = Date.now();
  await page.goto(`${server.url}gear-preview.html?${query}`);
  await page.waitForFunction("window.__gear !== undefined");
  await page.evaluate("window.__gear.ready");
  if (crashed) process.exit(1);
  const drawn = await page.evaluate(() => globalThis.__gear.sheet());
  if (crashed) process.exit(1);
  // The pictures the refs sheet lays over the canvas, loaded.
  await page.evaluate(() =>
    Promise.all(
      [...globalThis.document.images].map((i) =>
        i.complete ? null : new Promise((done) => i.addEventListener("load", done, { once: true })),
      ),
    ),
  );
  const out = join(outDir, `gear-${sheet}.png`);
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
rmSync(refDir, { recursive: true, force: true });

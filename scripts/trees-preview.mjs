#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREE LAB — every kind of tree that grows and each of its ten variants,
// side by side, as one labelled contact sheet: `previews/trees.png` (a row
// a kind, a column a variant; `trees-sketch.png` for the far band's).
//
// A screenshot of a race cannot review a wood: a tree there is one of a
// thousand, half behind the next. Whether the ten spruces are ten or one
// copied is a question for a sheet, drawn through the game's own builder
// (`tree-shapes.ts`) and material at one size, over snow, seen from the
// skier's head (2.2 m) a few metres off — what a skier sees under a crown.
//
// The page does the drawing (`pwa/src/tools/trees-harness.ts`); this builds
// it into a one-off bundle (never deployed), serves it and photographs it in
// a headless Chromium — `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/trees-preview.mjs
//   node scripts/trees-preview.mjs --kinds=pine,larch --region=alpine
//   node scripts/trees-preview.mjs --sketch           # the far band's sketches
//   node scripts/trees-preview.mjs --skip-build       # reuse the last bundle
//   node scripts/trees-preview.mjs --models           # the MODELLED trees (pwa/models/trees/)
//   node scripts/trees-preview.mjs --models --from=previews/blender --compare
//                                   # a lab run's models, each kind's code row above them

import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".trees-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    kinds: { kind: "string", default: "", help: "only these kinds (e.g. pine,larch)" },
    region: {
      kind: "string",
      default: "alpine",
      help: "whose paint: alpine, fell, continental, maritime",
    },
    sketch: { kind: "flag", help: "draw the far band's sketches instead" },
    models: { kind: "flag", help: "draw the MODELLED trees (every <kind>.glb in --from)" },
    from: {
      kind: "string",
      default: "pwa/models/trees",
      help: "where --models finds them (previews/blender: a make blender run's)",
    },
    compare: { kind: "flag", help: "with --models: each kind's code-built row above its models" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 600, help: "how long the sheet may take to draw, s" },
    out: { kind: "string", default: "", help: "where the sheet is written" },
  },
  "usage: node scripts/trees-preview.mjs [--kinds=a,b] [--region=id] [--sketch] [--models] [--from=dir] [--compare] [--skip-build] [--out=path]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "trees-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "trees-preview.html") },
    },
  });
}

// The models go beside the page, where the harness fetches them from.
const models = args.models ? args.from : "";
if (models) {
  const into = join(buildDir, "models", "trees");
  mkdirSync(into, { recursive: true });
  for (const f of readdirSync(join(root, models))) {
    if (/^[a-z]+\.glb$/.test(f)) copyFileSync(join(root, models, f), join(into, f));
  }
}

const found = await findChromium();
if (!found) process.exit(1);

const server = await serveDir(buildDir);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1900, height: 1500 } });

// A PAGE ERROR IS FATAL, AND IT HAS TO SAY SO: the page signals it is done by
// setting `window.__done`, so a module that threw never sets it and the wait
// below would burn its whole timeout on a crash that reads as a slow machine.
let crashed = null;
page.on("pageerror", (err) => {
  crashed ??= err;
  console.error(`[pageerror] ${err.message}`);
});
page.on("console", (msg) => {
  if (msg.type() === "error") console.error(`[console] ${msg.text()}`);
});

const params = new URLSearchParams({ region: args.region });
if (args.kinds) params.set("kinds", args.kinds);
if (args.sketch) params.set("sketch", "1");
if (models) params.set("models", args.compare ? "compare" : "1");
const query = `?${params}`;
const out =
  args.out ||
  join(
    outDir,
    `trees${models ? (args.compare ? "-compare" : "-models") : ""}${args.sketch ? "-sketch" : ""}${args.region === "alpine" ? "" : `-${args.region}`}.png`,
  );
console.log(
  `trees — ${args.kinds || "every kind"}, ${args.region}${args.sketch ? ", sketches" : ""}${models ? `, models from ${models}` : ""}`,
);
await page.goto(`${server.url}trees-preview.html${query}`);
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

const stage = await page.$("canvas#stage");
const box = await stage.boundingBox();
await page.setViewportSize({ width: Math.ceil(box.width), height: Math.ceil(box.height) });
await page.screenshot({ path: out, fullPage: true });
console.log(out.replace(`${root}/`, ""));

await browser.close();
await server.close();

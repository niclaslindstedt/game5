#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WILDLIFE LAB — every bird over the woods and every animal in the snow,
// side by side, as one labelled contact sheet: `previews/birds.png`.
//
// A screenshot of a race cannot review a roster: a bird there is a dozen
// pixels forty metres up and an animal is whichever one that stretch of
// wood held, at whatever point of its round the frame caught. The roster is
// a ladder of silhouettes, and a ladder is judged side by side. Each cell
// draws its species three times through the game's own geometry and
// material — a bird gliding, mid-beat and folded; an animal stood, running
// and grazing — over a metre rule, labelled with its size and its rarity.
//
// The page does the drawing (`pwa/src/tools/birds-harness.ts`); this builds
// it into a one-off bundle (never deployed), serves it and photographs it in
// a headless Chromium — `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/birds-preview.mjs
//   node scripts/birds-preview.mjs --rows=raven,ptarmigan,reindeer
//   node scripts/birds-preview.mjs --models          # the MODELLED roster (pwa/models/birds, beasts)
//   node scripts/birds-preview.mjs --models --from=previews/blender --compare
//                                   # a lab run's models, each species' code cell beside its model's
//   node scripts/birds-preview.mjs --skip-build      # reuse the last bundle

import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".birds-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    rows: {
      kind: "string",
      default: "",
      help: "only these species, birds or animals (e.g. raven,ptarmigan,reindeer)",
    },
    models: {
      kind: "flag",
      help: "draw the MODELLED birds and animals (every <id>.glb in --from)",
    },
    from: {
      kind: "string",
      default: "pwa/models",
      help: "where --models finds them, in birds/ and beasts/ (previews/blender: a make blender run's, flat)",
    },
    compare: {
      kind: "flag",
      help: "with --models: each species' code-built cell beside its model's",
    },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 600, help: "how long the sheet may take to draw, s" },
    out: {
      kind: "string",
      default: "",
      help: "where the sheet is written (previews/birds[-models|-compare].png)",
    },
  },
  "usage: node scripts/birds-preview.mjs [--rows=a,b] [--models] [--from=dir] [--compare] [--skip-build] [--out=path]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "birds-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "birds-preview.html") },
    },
  });
}

// The models go beside the page, where the harness fetches them from: a
// published tree keeps its birds/ and beasts/; a lab run's are flat.
const models = args.models ? args.from : "";
if (models) {
  for (const dir of ["birds", "beasts"]) {
    const into = join(buildDir, "models", dir);
    mkdirSync(into, { recursive: true });
    const from = existsSync(join(root, models, dir)) ? join(root, models, dir) : join(root, models);
    for (const f of readdirSync(from)) {
      if (/^[a-z]+\.glb$/.test(f)) copyFileSync(join(from, f), join(into, f));
    }
  }
}

const found = await findChromium();
if (!found) process.exit(1);

const server = await serveDir(buildDir);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1360, height: 720 } });

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

const params = new URLSearchParams();
if (args.rows) params.set("rows", args.rows);
if (models) params.set("models", args.compare ? "compare" : "1");
const query = params.size ? `?${params}` : "";
const out =
  args.out || join(outDir, `birds${models ? (args.compare ? "-compare" : "-models") : ""}.png`);
console.log(
  `birds — ${args.rows || "every bird and every animal"}${models ? `, models from ${models}` : ""}`,
);
await page.goto(`${server.url}birds-preview.html${query}`);
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

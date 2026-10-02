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
// skier's head (2.2 m) a few metres off — what a skier sees under a crown —
// at any of the three cuts the forest draws (full, mid, far), and with its
// trunk at the girth of any age (`--ages`: sapling to veteran).
//
// The page does the drawing (`pwa/src/tools/trees-harness.ts`); this builds
// it into a one-off bundle (never deployed), serves it and photographs it in
// a headless Chromium — `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/trees-preview.mjs
//   node scripts/trees-preview.mjs --kinds=pine,larch --region=alpine
//   node scripts/trees-preview.mjs --lod=1            # the mid cut (--lod=2 / --sketch: the far band's)
//   node scripts/trees-preview.mjs --ages             # each kind's lead variant, sapling to veteran
//   node scripts/trees-preview.mjs --skip-build       # reuse the last bundle

import { existsSync, mkdirSync } from "node:fs";
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
    lod: {
      kind: "number",
      default: 0,
      help: "the cut drawn: 0 full, 1 mid, 2 the far band's sketch",
    },
    sketch: { kind: "flag", help: "draw the far band's sketches instead (--lod=2)" },
    ages: {
      kind: "flag",
      help: "each kind's lead variant at the ages a wood holds, sapling to veteran",
    },
    age: { kind: "number", default: 90, help: "the age every trunk is drawn at, years" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 600, help: "how long the sheet may take to draw, s" },
    out: { kind: "string", default: "", help: "where the sheet is written" },
  },
  "usage: node scripts/trees-preview.mjs [--kinds=a,b] [--region=id] [--lod=0|1|2] [--sketch] [--ages] [--age=years] [--skip-build] [--out=path]",
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
const lod = args.sketch ? 2 : Math.max(0, Math.min(2, Math.round(args.lod)));
params.set("lod", String(lod));
params.set("age", String(args.age));
if (args.ages) params.set("ages", "1");
const query = `?${params}`;
const cut = ["", "-mid", "-sketch"][lod];
const out =
  args.out ||
  join(
    outDir,
    `trees${args.ages ? "-ages" : ""}${cut}${args.region === "alpine" ? "" : `-${args.region}`}.png`,
  );
console.log(
  `trees — ${args.kinds || "every kind"}, ${args.region}, ${["full", "mid", "far"][lod]} cut${args.ages ? ", by age" : `, ${args.age} yr`}`,
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

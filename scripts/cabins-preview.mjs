#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CABIN LAB — every kind of log building the ski area keeps beside its
// runs and lanes (`defs/cabins.ts`), built by the game's own builder
// (`cabin-shapes.ts`) and drawn through the game's own material, as one
// labelled contact sheet: `previews/cabins.png` — a row a kind, a column a
// view (front and back at three quarters, the side, the skier's eye from
// the snow below, from above, the far cut, and at night with its windows
// lit), each terraced on a slope so the plinth's reach to the snow shows —
// and a table of every kind's triangles at each cut.
//
// Where the cabins STAND is the engine's (`cabins.ts`); it is drawn from
// above by `make resort` and in the game by `make world`'s `cabin` and
// `cabins-air` views.
//
// The page does the drawing (`pwa/src/tools/cabins-harness.ts`); this builds
// it into a one-off bundle (never deployed), serves it and photographs it in
// a headless Chromium — `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/cabins-preview.mjs
//   node scripts/cabins-preview.mjs --kinds=hut,shed
//   node scripts/cabins-preview.mjs --skip-build       # reuse the last bundle

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".cabins-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    kinds: {
      kind: "string",
      default: "",
      help: "only these kinds (hut, cabin, chalet, shed, afterski)",
    },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 600, help: "how long the sheet may take to draw, s" },
    out: { kind: "string", default: "", help: "where the sheet is written" },
  },
  "usage: node scripts/cabins-preview.mjs [--kinds=a,b] [--skip-build] [--out=path]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "cabins-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "cabins-preview.html") },
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
const page = await browser.newPage({ viewport: { width: 2200, height: 1100 } });

// A page error is fatal and says so, rather than burning the timeout.
let crashed = null;
page.on("pageerror", (err) => {
  crashed ??= err;
  console.error(`[pageerror] ${err.message}`);
});
page.on("console", (msg) => {
  if (msg.type() === "error") console.error(`[console] ${msg.text()}`);
});

const params = new URLSearchParams();
if (args.kinds) params.set("kinds", args.kinds);
const out =
  args.out || join(outDir, `cabins${args.kinds ? `-${args.kinds.replace(/,/g, "-")}` : ""}.png`);
console.log(`cabins — ${args.kinds || "every kind"}`);
await page.goto(`${server.url}cabins-preview.html?${params}`);
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

const tris = await page.evaluate("window.__tris");
console.log("kind     near   far");
for (const [kind, [near, far]] of Object.entries(tris)) {
  console.log(`${kind.padEnd(8)} ${String(near).padStart(5)} ${String(far).padStart(5)}`);
}
const stage = await page.$("canvas#stage");
const box = await stage.boundingBox();
await page.setViewportSize({ width: Math.ceil(box.width), height: Math.ceil(box.height) });
await page.screenshot({ path: out, fullPage: true });
console.log(out.replace(`${root}/`, ""));

await browser.close();
await server.close();

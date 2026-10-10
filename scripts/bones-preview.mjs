#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BONES LAB — every long bone that can stand out through the skin in
// an open fracture (`pwa/src/game/gore-bones.ts`, laid by the gore view
// on a run with the INJURIES switch on), built by the game's own builder
// and drawn in the gore view's own wet material on a limb of the game's
// measure, as one labelled contact sheet: `previews/bones.png` — a row a
// bone (the humerus, the radius, the ulna, the femur, the tibia), a column
// a grade (a simple break, a wedge, shattered) at three quarters, then the
// simple break from the side, above, behind and as far as the chase lens
// sees it. The same breaks on the skier in the game are the gore lab's
// `bones` sheet (`make gore ARGS=--sheet=bones`).
//
// The page does the drawing (`pwa/src/tools/bones-harness.ts`); this builds
// it into a one-off bundle (never deployed), serves it and photographs it in
// a headless Chromium — `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/bones-preview.mjs
//   node scripts/bones-preview.mjs --bones=humerusL,tibiaL
//   node scripts/bones-preview.mjs --skip-build       # reuse the last bundle

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".bones-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    bones: {
      kind: "string",
      default: "",
      help: "only these bones (humerusL, radiusL, ulnaL, femurL, tibiaL)",
    },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 600, help: "how long the sheet may take to draw, s" },
    out: { kind: "string", default: "", help: "where the sheet is written" },
  },
  "usage: node scripts/bones-preview.mjs [--bones=a,b] [--skip-build] [--out=path]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "bones-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "bones-preview.html") },
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
const page = await browser.newPage({ viewport: { width: 2600, height: 1400 } });

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
if (args.bones) params.set("bones", args.bones);
const out =
  args.out || join(outDir, `bones${args.bones ? `-${args.bones.replace(/,/g, "-")}` : ""}.png`);
console.log(`bones — ${args.bones || "every bone"}`);
await page.goto(`${server.url}bones-preview.html?${params}`);
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

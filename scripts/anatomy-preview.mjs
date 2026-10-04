#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ANATOMY LAB (`make anatomy`): the HUD body's BONES, traced off the
// public-domain skeleton plate (`references/anatomy/skeleton-front.svg`) and
// laid into the traced figure joint by joint (`pwa/src/tools/anatomy-map.ts`),
// then checked against the plate they came from. Writes:
//
//   previews/anatomy-overlay.png  the plate's own drawing of every bone,
//                                 warped by that bone's map, inside the
//                                 flesh outline; our bones' outlines and the
//                                 figure's joints over it; the HUD's figure
//   previews/anatomy-bones.png    every bone alone: the plate's drawing of it
//                                 with the trace (left), the mapped bone over
//                                 its warped drawing in the flesh (right), and
//                                 how much of it falls outside the flesh
//
// and prints a table: each bone's rings, area and area OUTSIDE the flesh
// (none should be), and the figure's segments against a body's proportions.
// With --write it writes the bones as `pwa/src/game/body-bones.ts` (a
// GENERATED file — never edited by hand: move a landmark and write again).
//
//   node scripts/anatomy-preview.mjs              the sheets and the table
//   node scripts/anatomy-preview.mjs --write      ...and the bones module

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".anatomy-preview");
const outDir = join(root, "previews");
const PLATE = join(root, "references", "anatomy", "skeleton-front.svg");
const MODULE = join(root, "pwa", "src", "game", "body-bones.ts");

const args = parseArgs(
  process.argv.slice(2),
  {
    write: { kind: "flag", default: false, help: "write pwa/src/game/body-bones.ts" },
    "skip-build": { kind: "flag", default: false, help: "reuse the last bundle" },
    timeout: { kind: "number", default: 180, help: "seconds the lab may take" },
  },
  "usage: node scripts/anatomy-preview.mjs [--write] [--skip-build]",
);

mkdirSync(outDir, { recursive: true });
if (!args["skip-build"] || !existsSync(join(buildDir, "anatomy-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "anatomy-preview.html") },
    },
  });
}
copyFileSync(PLATE, join(buildDir, "skeleton-front.svg"));

const found = await findChromium();
if (!found) process.exit(1);
const server = await serveDir(buildDir);
const browser = await found.chromium.launch({ executablePath: found.executablePath });
const page = await browser.newPage({ viewport: { width: 2200, height: 1400 } });
let crashed = null;
page.on("pageerror", (err) => {
  crashed ??= err;
  console.error(`[pageerror] ${err.message}`);
});
page.setDefaultTimeout(args.timeout * 1000);
const t0 = Date.now();
await page.goto(`${server.url}anatomy-preview.html`);
await page.waitForFunction("window.__anatomy !== undefined");
const result = await page.evaluate(() => globalThis.__anatomy.run());
if (crashed) process.exit(1);
await page.waitForTimeout(300);
for (const sheet of ["overlay", "bones"]) {
  const el = page.locator(`#sheet-${sheet}`);
  const box = await el.boundingBox();
  if (box) {
    await page.setViewportSize({
      width: Math.max(800, Math.ceil(box.x + box.width)),
      height: Math.max(600, Math.ceil(box.y + box.height)),
    });
  }
  const out = join(outDir, `anatomy-${sheet}.png`);
  await el.screenshot({ path: out });
  console.log(out.replace(`${root}/`, ""));
}
console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
for (const line of result.table) console.log(`  ${line}`);
if (args.write) {
  writeFileSync(MODULE, result.module);
  execFileSync("npx", ["prettier", "--write", MODULE], { cwd: root, stdio: "ignore" });
  console.log(`wrote ${MODULE.replace(`${root}/`, "")}`);
}
await browser.close();
await server.close();

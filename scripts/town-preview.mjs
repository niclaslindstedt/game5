#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TOWN LAB — a free ride on one seed skied into the village and drawn
// through the game's own renderer (`pwa/src/tools/town-harness.ts`) as
// strips of frames: the stop on the street, out of the bindings, the pair
// up onto the shoulder, walking the street with it, and the pair off the
// shoulder and back in once he is off the streets. Each sheet is a PNG in
// `previews/` (`town-<sheet>.png`). The page is built into a one-off
// bundle (never deployed), served and photographed in a headless Chromium —
// `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/town-preview.mjs
//   node scripts/town-preview.mjs --sheets=out,pick --tile=360
//   node scripts/town-preview.mjs --seed=7 --skip-build

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".town-preview");
const outDir = join(root, "previews");

/** A run of frames `from` to `to` s after `anchor`, every `every` s. */
const strip = (anchor, from, to, every) => {
  const out = [];
  for (let s = from; s <= to + 1e-6; s += every) out.push(`${anchor}:${s.toFixed(2)}`);
  return out;
};

const SHEETS = {
  // The stop and out of the bindings: the heels popped, the step back.
  out: { lens: "front", frames: strip("stop", 0, 2.1, 0.3) },
  // Bent for the pair, stood on its tails, clapped, up onto the shoulder.
  pick: { lens: "front", frames: strip("stop", 2.1, 4.9, 0.35) },
  // The same seen from his right side.
  "pick-side": { lens: "side", frames: strip("stop", 2.1, 4.9, 0.35) },
  // Walking the street with the pair on his shoulder, from round him.
  carry: {
    lens: "front",
    frames: ["walk:1.00", "walk:1.25", "walk:1.50", "walk:1.75"],
  },
  "carry-side": { lens: "side", frames: ["walk:2.00", "walk:2.25", "walk:2.50", "walk:2.75"] },
  "carry-back": { lens: "back", frames: ["walk:3.00", "walk:3.25"] },
  // The game's own chase lens behind him walking.
  chase: { lens: "chase", frames: ["walk:3.50", "walk:4.50"], cols: 2 },
  // Off the streets: the pair off his shoulder and laid down.
  drop: { lens: "front", frames: strip("leave", 0, 2.4, 0.3) },
  // Back into the bindings and away.
  clip: { lens: "front", frames: strip("leave", 2.4, 4.0, 0.2) },
};

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed" },
    hour: {
      kind: "number",
      default: -1,
      help: "the sun's solar hour; the map's own when left out",
    },
    sheets: {
      kind: "string",
      default: "",
      help: `only these sheets, comma-separated (${Object.keys(SHEETS).join(",")})`,
    },
    tile: { kind: "number", default: 420, help: "one frame's size, px (square)" },
    along: { kind: "number", default: 5, help: "how long he walks the street before leaving, s" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 900, help: "how long the whole run may take, s" },
  },
  "usage: node scripts/town-preview.mjs [--seed=n] [--hour=h] [--sheets=a,b] [--tile=px] [--skip-build]",
);

mkdirSync(outDir, { recursive: true });
if (!args["skip-build"] || !existsSync(join(buildDir, "town-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "town-preview.html") },
    },
  });
}
cpSync(join(root, "pwa", "models"), join(buildDir, "models"), { recursive: true });

const names = args.sheets ? args.sheets.split(",").map((s) => s.trim()) : Object.keys(SHEETS);
for (const n of names) if (!SHEETS[n]) throw new Error(`no sheet "${n}"`);

const found = await findChromium();
if (!found) process.exit(1);
const server = await serveDir(buildDir);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: args.tile, height: args.tile } });
let crashed = null;
page.on("pageerror", (err) => {
  crashed ??= err;
  console.error(`[pageerror] ${err.message}`);
});
page.on("console", (msg) => {
  if (msg.type() === "error") console.error(`[console] ${msg.text()}`);
});
page.setDefaultTimeout(args.timeout * 1000);

const query = new URLSearchParams({
  seed: String(args.seed),
  tile: String(args.tile),
  along: String(args.along),
  ...(args.hour >= 0 ? { hour: String(args.hour) } : {}),
}).toString();
console.log(`town — seed ${args.seed}, ${args.tile} px frames`);
await page.goto(`${server.url}town-preview.html?${query}`);
await page.waitForFunction("window.__town !== undefined");
await page.evaluate("window.__town.ready");
if (crashed) process.exit(1);

const t0 = Date.now();
const sheets = names.map((name) => ({ name, ...SHEETS[name] }));
const shots = await page.evaluate((list) => globalThis.__town.run(list), sheets);
if (crashed) process.exit(1);
for (const shot of shots) {
  const out = join(outDir, `town-${args.hour >= 0 ? `h${args.hour}-` : ""}${shot.name}.png`);
  writeFileSync(out, Buffer.from(shot.png.split(",")[1], "base64"));
  console.log(out.replace(`${root}/`, ""));
  for (const note of shot.notes) console.log(`  ${note}`);
}
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);

await browser.close();
await server.close();

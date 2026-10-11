#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMP LAB — the ski jumping hill (R43, `engine/mapgen/ski-jump.ts`,
// drawn by `pwa/src/game/ski-jump-view.ts` over the places
// `ski-jump-plan.ts` reads off `Level.skiJump`) and a jump off it, staged
// on the engine and photographed through the game's own renderer, so the
// hill can be judged by eye against a real one and iterated on:
//
//   hill     the empty hill: from the broadcast's side, from the out-run
//            looking up, down the in-run from the tower, from the judges'
//            tower, from the air, its silhouette against the sky — and the
//            same at hour 21, lit
//   inrun    the jumper on the bar, in the tracks (chase, tips, beside) and
//            at the edge
//   flight   in the air over the landing hill from the side and behind
//   landing  touching down at the boards, the telemark, the out-run, the K
//            and HS lines
//   structure  the raised in-run: the deck on its truss and piers from the
//            side and from below, the tower, the jumper on the deck
//   broadcast  a whole jump through the game's broadcast director, bar to
//            out-run (`camera-skijump.ts`)
//   jumper   the jumper's body through every phase (`skier-jumper.ts`):
//            on the bar, the in-run crouch, the take-off, the early flight,
//            the stable V, the landing made ready, the telemark and the
//            out-run — each close from the side, the front, behind and
//            above (`--views=jumper-vee` one phase)
//
// Each GROUP is one contact sheet, previews/skijump-<group>.png, and every
// frame is also written alone, previews/skijump-<view>-<label>.png; every
// caption carries the frame's draw calls and triangles. The page
// (`pwa/src/tools/skijump-harness.ts`, its scenes in `skijump-scenes.ts`)
// steps the jump itself on the bot's hands, never on a wall clock. This
// script builds it into a one-off bundle (never part of the app's build),
// serves it and drives it in a headless Chromium — `CHROMIUM_PATH`
// overrides where one is looked for.
//
//   node scripts/skijump-preview.mjs                    # every sheet
//   node scripts/skijump-preview.mjs --sheet=hill,landing
//   node scripts/skijump-preview.mjs --views=night      # just those views
//   node scripts/skijump-preview.mjs --seed=7 --hill=normal --skip-build

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".skijump-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: {
      kind: "string",
      default: "",
      help: "which sheets, comma-separated (hill, structure, broadcast, inrun, flight, landing, jumper); every one when left out",
    },
    views: {
      kind: "string",
      default: "",
      help: "only these views, comma-separated (hill, night, structure, broadcast, inrun, flight, landing, jumper-bar … jumper-outrun)",
    },
    seed: { kind: "number", default: 38, help: "the map's seed" },
    hill: { kind: "string", default: "large", help: "the hill: large or normal" },
    hour: {
      kind: "number",
      default: NaN,
      help: "the solar hour every sheet is drawn under (the map's own unless named; the night view is 21)",
    },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 1280, help: "a frame's width, px" },
    height: { kind: "number", default: 720, help: "a frame's height, px" },
    cols: { kind: "number", default: 3, help: "tiles a row on a sheet" },
    scale: { kind: "number", default: 0.5, help: "a tile's size as a share of the frame" },
    out: { kind: "string", default: "skijump", help: "file stem under previews/ (no extension)" },
    "sheets-only": { kind: "flag", help: "write the contact sheets, not every frame alone" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/skijump-preview.mjs [--sheet=a,b] [--views=a,b] [--seed=n] [--hill=large|normal] [--hour=h] [--skip-build]",
);

const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "skijump-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "skijump-preview.html") },
    },
  });
}
// The committed models (the skis) go beside the page,
// where the renderer fetches them.
cpSync(join(root, "pwa", "models"), join(buildDir, "models"), { recursive: true });

const found = await findChromium();
if (!found) process.exit(1);

const server = await serveDir(buildDir);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const viewport = { width: args.width, height: args.height };
const page = await browser.newPage({ viewport });
let crashed = null;
page.on("pageerror", (err) => {
  crashed ??= err;
  console.error(`[pageerror] ${err.message}`);
});
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") console.error(`[console] ${msg.text()}`);
});
page.setDefaultTimeout(args.timeout * 1000);

const query = new URLSearchParams({
  seed: String(args.seed),
  hill: args.hill,
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
  cols: String(args.cols),
  scale: String(args.scale),
  ...(Number.isFinite(args.hour) ? { hour: String(args.hour) } : {}),
}).toString();
/** `work`, or a failure the moment the page throws — never the timeout
 * burnt on a page that died. */
function guarded(work) {
  return Promise.race([
    work,
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
}

await page.goto(`${server.url}skijump-preview.html?${query}`);
await guarded(page.waitForFunction("window.__skijump !== undefined"));
const note = await guarded(page.evaluate("window.__skijump.ready"));
/** @type {Record<string, string[]>} */
const groups = await page.evaluate("window.__skijump.groups");

const allViews = Object.values(groups).flat();
const wantSheets = list(args.sheet);
const wantViews = list(args.views);
for (const s of wantSheets) {
  if (!groups[s]) {
    console.error(`unknown sheet "${s}" (${Object.keys(groups).join(", ")})`);
    process.exit(2);
  }
}
for (const v of wantViews) {
  if (!allViews.includes(v)) {
    console.error(`unknown view "${v}" (${allViews.join(", ")})`);
    process.exit(2);
  }
}

console.log(`skijump — seed ${args.seed}: ${note}`);
const safe = (s) => s.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "");
for (const [group, views] of Object.entries(groups)) {
  if (wantSheets.length && !wantSheets.includes(group)) continue;
  const shot = wantViews.length ? views.filter((v) => wantViews.includes(v)) : views;
  if (!shot.length) continue;
  const t0 = Date.now();
  const { frames } = await guarded(
    page.evaluate(([g, v]) => globalThis.__skijump.sheet(g, v), [group, shot]),
  );
  if (!args["sheets-only"]) {
    for (const f of frames) {
      const file = join(outDir, `${args.out}-${safe(f.view)}-${safe(f.label)}.png`);
      writeFileSync(file, Buffer.from(f.png.split(",")[1], "base64"));
    }
  }
  // An element is photographed within the viewport: open it to the sheet.
  const box = await page.locator("#sheet").boundingBox();
  await page.setViewportSize({
    width: Math.max(args.width, Math.ceil(box.width)),
    height: Math.ceil(box.y + box.height),
  });
  const out = join(outDir, `${args.out}-${group}.png`);
  await page.locator("#sheet").screenshot({ path: out });
  await page.setViewportSize(viewport);
  const suffix = wantViews.length ? ` (${shot.join(", ")})` : "";
  console.log(
    `${out.replace(`${root}/`, "")}  ${frames.length} frames${suffix}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
  );
}

await browser.close();
await server.close();

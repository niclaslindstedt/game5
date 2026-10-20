#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE X-RAY LAB — the hard blows the X-ray cam slows down for, run the way
// the app runs them (the read ahead and the director of `xray-run.ts`
// pacing the run and pointing the lens) and photographed through the
// game's own renderer every `--every` wall seconds, so the whole sequence
// reads as one strip: the lead in, the skeleton under the glass, the bone
// cracking, the pans to the next one, the tear, the body pulled back from,
// the death.
//
//   trunk       skied at a lone trunk at 80 km/h
//   trunk-fast  skied at one at 108 km/h
//   head        flown head first into one
//   slam        thrown on his side onto the piste, sliding on
//   fall        off a cliff 200 m onto the flat snow
//   fall-high   off one 400 m: the skis land first and the body slams on
//               down, each bone breaking as its part meets the snow
//   post        skied at a steel upright (a lamp's pole, a lift's tower)
//   cable       flown across a chair's rope at 90 km/h, his chest to it
//   person-60   skied into an amateur stopped on his run at 60 km/h
//   person-90   the same at 90 km/h
//   anatomy     no blow: he stands still under the glass, the lens circling
//               the ribs, the spine, the skull, the pelvis and the whole of
//               him in turn — the skeleton and the organs judged at rest
//
// `--impact` runs them with the X-RAY CAM switch OFF: the IMPACT cam's
// side-on slow motion of a body crushed on a solid, sliced by a rope or
// run into a person (`person-60`, `person-90`),
// previews/impact-<scene>.png.
//
// Each scene is one contact sheet, previews/xray-<scene>.png. The page
// (`pwa/src/tools/xray-harness.ts`, its stagings the gore lab's) steps the
// engine itself, a frame a sixtieth of a second by fiat, so a seed's sheet
// is the same sheet twice. This script builds it into a one-off bundle
// (never part of the app's build), serves it and drives it in a headless
// Chromium — `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/xray-preview.mjs                 # every scene
//   node scripts/xray-preview.mjs --scene=trunk
//   node scripts/xray-preview.mjs --impact --scene=trunk-fast,post,cable

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".xray-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    scene: {
      kind: "string",
      default: "",
      help: "which scenes, comma-separated (trunk-fast, post, head, slam, fall, fall-high, spike, spike-post, groomer, maul, heli, cable, cable-shins, rotor, person-60, person-90, anatomy); every one when left out",
    },
    seed: { kind: "number", default: 2, help: "the map's seed" },
    every: { kind: "number", default: 0.5, help: "wall seconds between two frames shot" },
    most: { kind: "number", default: 18, help: "the most wall seconds a scene runs" },
    again: {
      kind: "number",
      default: 0,
      help: "times a death is stood up again as a new run (as the app restarts) and died again",
    },
    width: { kind: "number", default: 1280, help: "a frame's width, px" },
    height: { kind: "number", default: 720, help: "a frame's height, px" },
    cols: { kind: "number", default: 4, help: "tiles a row on a sheet" },
    scale: { kind: "number", default: 0.4, help: "a tile's size as a share of the frame" },
    impact: { kind: "flag", help: "the X-ray switch off: the impact cam alone" },
    frames: {
      kind: "string",
      default: "",
      help: "a folder to write every frame shot into as well, full size (<kind>-<scene>-<n>.png)",
    },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/xray-preview.mjs [--scene=a,b] [--seed=n] [--every=s] [--skip-build]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "xray-preview.html"))) {
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
      rollupOptions: { input: { lab: join(root, "pwa", "xray-preview.html") } },
    },
  });
}
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

/** `work`, or a failure the moment the page throws. */
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

const query = new URLSearchParams({
  seed: String(args.seed),
  w: String(args.width),
  h: String(args.height),
  cols: String(args.cols),
  scale: String(args.scale),
  every: String(args.every),
  most: String(args.most),
  again: String(args.again),
  xray: args.impact ? "0" : "1",
}).toString();
await page.goto(`${server.url}xray-preview.html?${query}`);
await guarded(page.waitForFunction("window.__xray !== undefined"));
const note = await guarded(page.evaluate("window.__xray.ready"));
/** @type {string[]} */
const scenes = await page.evaluate("window.__xray.scenes");
const want = args.scene
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
for (const s of want)
  if (!scenes.includes(s)) {
    console.error(`unknown scene "${s}" (${scenes.join(", ")})`);
    process.exit(2);
  }

console.log(`xray — seed ${args.seed}: ${note}`);
for (const scene of scenes) {
  if (want.length && !want.includes(scene)) continue;
  const t0 = Date.now();
  const { frames } = await guarded(page.evaluate((s) => globalThis.__xray.sheet(s), scene));
  const box = await page.locator("#sheet").boundingBox();
  await page.setViewportSize({
    width: Math.max(args.width, Math.ceil(box.width)),
    height: Math.ceil(box.y + box.height),
  });
  const out = join(outDir, `${args.impact ? "impact" : "xray"}-${scene}.png`);
  if (args.frames) {
    mkdirSync(args.frames, { recursive: true });
    frames.forEach((f, n) => {
      const name = `${args.impact ? "impact" : "xray"}-${scene}-${String(n).padStart(2, "0")}.png`;
      writeFileSync(join(args.frames, name), Buffer.from(f.png.split(",")[1], "base64"));
    });
  }
  await page.locator("#sheet").screenshot({ path: out });
  await page.setViewportSize(viewport);
  console.log(
    `${out.replace(`${root}/`, "")}  ${frames.length} frames  (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
  );
}

await browser.close();
await server.close();

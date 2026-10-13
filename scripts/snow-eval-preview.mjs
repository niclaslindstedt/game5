#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW EVAL LAB — the shared scenes an eval round over the snow's
// effects is judged on (`.agents/skills/eval-labs`): linked carves on the
// groomer, a hockey stop on skis, a snowboard's heelside and toeside stops,
// linked turns in deep powder, a fall's crater in it and the track a carve
// left — each by day and under a low sun the spray is backlit by, through
// the game's own renderer from the game's CHASE lens and a HERO lens, one
// picture a cell: `previews/snow-eval/<scene>-<light>-<lens>.png`. With
// `--perf` it also times the carve scene's frames at the LOW, MEDIUM and
// HIGH pictures (`previews/snow-eval/perf.json`; swiftshader, so the
// numbers are RELATIVE, one build against another on this machine).
//
// The page (`pwa/src/tools/snow-eval-harness.ts`) does the drawing; this
// builds it into a one-off bundle (never deployed), serves it and saves
// what it hands back. Each light is its own page, so no light's tracks lie
// under another's, and each scene is its own page too.
//
//   node scripts/snow-eval-preview.mjs
//   node scripts/snow-eval-preview.mjs --scenes=hockey,heel --lights=low
//   node scripts/snow-eval-preview.mjs --perf --skip-build

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".snow-eval-preview");
const SCENES = ["carve", "hockey", "heel", "toe", "powder", "crater", "track"];

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed" },
    scenes: {
      kind: "string",
      default: SCENES.join(","),
      help: `the scenes (${SCENES.join(", ")})`,
    },
    lights: { kind: "string", default: "day,low", help: "the lights (day, low)" },
    quality: { kind: "string", default: "high", help: "the picture preset the scenes are shot at" },
    out: { kind: "string", default: "previews/snow-eval", help: "where the pictures go" },
    hide: {
      kind: "string",
      default: "",
      help: "take these out of the picture (cloud, spray) — a diagnosis",
    },
    perf: { kind: "flag", help: "also time the carve scene at low, medium and high" },
    frames: { kind: "number", default: 90, help: "frames timed a tier" },
    width: { kind: "number", default: 640, help: "a cell's width, px" },
    height: { kind: "number", default: 400, help: "a cell's height, px" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a light may take, s" },
  },
  "usage: node scripts/snow-eval-preview.mjs [--scenes=a,b] [--lights=day,low] [--perf] [--skip-build]",
);

const scenes = args.scenes.split(",").filter(Boolean);
for (const s of scenes) {
  if (!SCENES.includes(s)) {
    console.error(`unknown scene "${s}" (${SCENES.join(", ")})`);
    process.exit(2);
  }
}
const outDir = resolve(root, args.out);
mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "snow-eval-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "snow-eval-preview.html") },
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

let crashed = null;
async function open(quality, scene) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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
    scene,
    quality,
    hide: args.hide,
    w: String(args.width),
    h: String(args.height),
  }).toString();
  await page.goto(`${server.url}snow-eval-preview.html?${query}`);
  await page.waitForFunction("window.__snowEval !== undefined");
  await page.evaluate("window.__snowEval.ready");
  return page;
}

const notes = [];
// A page a scene and a light: the renderer loaded for that scene's pair and
// snow, and no other scene's tracks on its map.
for (const light of args.lights.split(",").filter(Boolean)) {
  for (const scene of scenes) {
    const t0 = Date.now();
    const page = await open(args.quality, scene);
    if (crashed) process.exit(1);
    const cells = await page.evaluate(
      ([s, l]) => globalThis.__snowEval.shoot(s, l),
      [[scene], light],
    );
    if (crashed) process.exit(1);
    for (const c of cells) {
      const file = join(outDir, `${c.name}.png`);
      writeFileSync(file, Buffer.from(c.url.split(",")[1], "base64"));
      notes.push({ name: c.name, note: c.note });
      console.log(`${file.replace(`${root}/`, "")}  ${c.note}`);
    }
    console.log(`${scene} ${light}: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    await page.close();
  }
}
writeFileSync(join(outDir, "notes.json"), JSON.stringify(notes, null, 2));

if (args.perf) {
  const page = await open("high", "carve");
  const res = await page.evaluate(
    ([t, f]) => globalThis.__snowEval.perf(t, f),
    [["low", "medium", "high"], args.frames],
  );
  for (const r of res) console.log(`perf ${r.tier.padEnd(6)} ${r.ms.toFixed(1)} ms/frame`);
  writeFileSync(join(outDir, "perf.json"), JSON.stringify(res, null, 2));
  await page.close();
}
await browser.close();
await server.close();
if (crashed) process.exit(1);

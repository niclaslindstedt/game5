#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB — one seed stood up, ridden by the bot, and photographed
// through the game's own renderer at a list of named moments:
// `previews/world-<view>.png`.
//
// It exists because the world is judged by LOOKING. Whether the snow reads
// as snow — powdery, sunlit, glittering, blue in its shade — and whether the
// furrows a skier cuts read behind him, are questions no number answers. The
// page does the work (`pwa/src/tools/world-harness.tsx`): one continuous run,
// so the trails in a later view are the trails that run really cut. This
// script builds that page into a one-off bundle (the harness is not part of
// the app's build and is never deployed), serves it, and drives it in a
// headless Chromium — `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/world-preview.mjs
//   node scripts/world-preview.mjs --seed=12 --views=powder,lookback
//   node scripts/world-preview.mjs --skip-build --frames=30   # time 30 frames
//
// The views, in the order the run reaches them: spawn, powder, powder-high,
// lookback, furrow, track, tips, helmet, far, jump, drop (late in a flight,
// falling fast), landing, vista, cliff,
// cliff-edge, forest,
// approach-140, approach-90, approach-60, approach-40 (the forest view's line
// walked in toward the wood — a shadow that appears between two of them was
// switched on by the lens coming nearer), chase-60, chase-90, chase-120 (the
// chase boom a minute, a minute and a half and two minutes down the run —
// the skier's shadow at every height of the face; `chase-<s>` at any
// second), orbit, and last, staged rather
// than ridden to: wipeout and wipeout-lie (the player put into the nearest
// trunk flat out, then where the skier came to rest); then the wildlife:
// herd (the biggest animal the map holds, from beside it), birds (the flock
// most in the air, from the snow under it) and prints (last night's prints
// on a fox's round, the player stood off it so the fine trail map is over it).

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".world-preview");
const outDir = join(root, "previews");

const VIEWS = [
  "spawn",
  "powder",
  "powder-high",
  "lookback",
  "furrow",
  "track",
  "tips",
  "helmet",
  "far",
  "jump",
  "drop",
  "landing",
  "vista",
  "cliff",
  "cliff-edge",
  "forest",
  "approach-140",
  "approach-90",
  "approach-60",
  "approach-40",
  "chase-60",
  "chase-90",
  "chase-120",
  "orbit",
  "wipeout",
  "wipeout-lie",
  "herd",
  "birds",
  "prints",
  "deep",
  "deep-side",
];

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed" },
    region: {
      kind: "string",
      default: "alpine",
      help: "the kind of snow country (R21): alpine, fell, continental, maritime",
    },
    hour: {
      kind: "number",
      default: -1,
      help: "the sun's solar hour (withSky, as the app's ?hour=); the map's own when left out",
    },
    grade: {
      kind: "string",
      help: "the piste grade (R23): green, blue, red, black — the seed's own when left out",
    },
    snow: {
      kind: "number",
      default: 0,
      help: "the run's snow dial (SNOW_DIAL: 1 the ordinary 40 cm, 2.5 a metre); the map's race snow when left out",
    },
    views: {
      kind: "string",
      default: "",
      help: `only these views, comma-separated (${VIEWS.join(",")})`,
    },
    quality: {
      kind: "string",
      default: "high",
      help: "the picture preset (low, medium, high — settings-video.ts)",
    },
    shadows: {
      kind: "string",
      default: "",
      help: "the SHADOWS row over the preset (off, skiers, medium, high)",
    },
    picture: {
      kind: "string",
      default: "",
      help: "picture rows over the preset, as the app's ?picture= (distance:max,shadows:off)",
    },
    width: { kind: "number", default: 1280, help: "picture width, px" },
    height: { kind: "number", default: 720, help: "picture height, px" },
    frames: {
      kind: "number",
      default: 0,
      help: "after the views, time this many drawn frames and print ms/frame",
    },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 900, help: "how long the whole run may take, s" },
  },
  "usage: node scripts/world-preview.mjs [--seed=n] [--region=id] [--grade=id] [--hour=h] [--views=a,b] [--quality=low] [--shadows=skiers] [--skip-build]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "world-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "world-preview.html") },
    },
  });
}
// The committed models go beside the page, where the renderer fetches
// them from (`loadModels`), so the lab draws what the game draws.
cpSync(join(root, "pwa", "models"), join(buildDir, "models"), { recursive: true });

/** playwright-core from this tree, or else from the global install the
 * web sessions carry. */
async function loadChromium() {
  try {
    return (await import("playwright-core")).chromium;
  } catch {
    /* fall through */
  }
  try {
    const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    for (const name of ["playwright-core", "playwright"]) {
      try {
        const req = createRequire(join(globalRoot, "playwright", "package.json"));
        return req(name).chromium;
      } catch {
        /* next */
      }
    }
  } catch {
    /* fall through */
  }
  console.error("playwright-core is not installed — `npm i --no-save playwright-core`");
  process.exit(1);
}

const chromium = await loadChromium();
const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
if (!existsSync(executablePath)) {
  console.error(`no Chromium at ${executablePath} — set CHROMIUM_PATH`);
  process.exit(1);
}

const server = await serveDir(buildDir);
const browser = await chromium.launch({
  executablePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: args.width, height: args.height } });

// A page error is fatal and has to SAY so, rather than surfacing as a
// timeout that reads as a slow machine.
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
  region: args.region,
  ...(args.grade ? { grade: args.grade } : {}),
  quality: args.quality,
  ...(args.shadows ? { shadows: args.shadows } : {}),
  ...(args.picture ? { picture: args.picture } : {}),
  ...(args.snow > 0 ? { snow: String(args.snow) } : {}),
  ...(args.hour >= 0 ? { hour: String(args.hour) } : {}),
  w: String(args.width),
  h: String(args.height),
}).toString();
console.log(
  `world — seed ${args.seed}, ${args.region}, ${args.quality} quality${args.shadows ? `, shadows ${args.shadows}` : ""}, ${args.width}×${args.height}`,
);
await page.goto(`${server.url}world-preview.html?${query}`);
await page.waitForFunction("window.__world !== undefined");
await page.evaluate("window.__world.ready");
if (crashed) process.exit(1);

const wanted = args.views ? args.views.split(",").map((v) => v.trim()) : VIEWS;
// The run is continuous: a view is reached by riding through every view
// before it, so the list is walked in the lab's own order.
// A chase view at any second (`chase-45`) rides in the chase series' place,
// in the order of its clock.
const isChase = (v) => /^chase-\d+$/.test(v);
const chases = wanted.filter(isChase).sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)));
const order = VIEWS.flatMap((v) => (v === "chase-60" ? chases : isChase(v) ? [] : [v]));
for (const view of order.filter((v) => wanted.includes(v))) {
  const t0 = Date.now();
  const shot = await page.evaluate((name) => globalThis.__world.shoot(name), view);
  if (crashed) process.exit(1);
  const out = join(
    outDir,
    `world-${args.region === "alpine" ? "" : `${args.region}-`}${args.grade ? `${args.grade}-` : ""}${args.snow > 0 ? `snow${args.snow}-` : ""}${args.hour >= 0 ? `h${args.hour}-` : ""}${view}.png`,
  );
  await page.locator("body").screenshot({ path: out });
  console.log(
    `${out.replace(`${root}/`, "")}  ${shot.note}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
  );
}

if (args.frames > 0) {
  const r = await page.evaluate((n) => globalThis.__world.frameMs(n), args.frames);
  console.log(
    `frame: ${r.ms.toFixed(1)} ms (software rasterizer — structure, not speed), ` +
      `${r.calls} draw calls, ${(r.triangles / 1000).toFixed(0)}k triangles`,
  );
}

await browser.close();
await server.close();

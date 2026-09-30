#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOUD LAB — the snow a skier rips up, and the furrow it leaves, as one
// labelled contact sheet: `previews/cloud-<seed>.png`. Each ROW is one ride
// across an open meadow — a kind of snow (`snowpack.ts`: groomed, hard,
// soft, new, wet, ice, or `map` for the map's own) × a light × a held
// speed — and each COLUMN the same moment of it from another angle: the
// game's own CHASE camera, the SIDE (the rooster tail's profile), the FRONT
// (the skier coming with his cloud behind it), HIGH (the plume's shape from
// above), TRAIL (from where the ride began, the curtain hanging along the
// line), UNDER (low beside the tail, looking up through it) and FURROW
// (down on the trail just behind the skier — the snow's walls and berm). With
// `--cols=times` the columns are moments of one ride from the first view,
// which is how the cloud's LIFE is judged: the stall, the swell, the drift.
//
// The lights are a sky and where the sun stands to the ride: FRONT (the sun
// behind the chase camera), BACK (the chase camera into the sun, the cloud
// backlit), SIDE, LOW (a sun a few degrees up, backlit), OVERCAST, SNOWING
// and NIGHT (the headlamps and a taillight in the cloud).
//
// It exists because a cloud is a moving, lit volume: whether it stalls and
// hangs, whether its shaded side goes blue, whether its edge goes silver
// against the sun, whether wet snow throws clumps and no cloud — none of it
// shows in one frame of one camera. The page does the drawing
// (`pwa/src/tools/cloud-harness.ts`, through the game's own renderer); this
// builds it into a one-off bundle (never deployed), serves it and
// photographs the sheet in a headless Chromium — `CHROMIUM_PATH` overrides
// where one is looked for.
//
//   node scripts/cloud-preview.mjs
//   node scripts/cloud-preview.mjs --snow=groomed,hard,soft,new,wet --light=back --speeds=60
//   node scripts/cloud-preview.mjs --light=front,back,side,low,overcast,night --speeds=30,90
//   node scripts/cloud-preview.mjs --cols=times --times=0.3,0.8,1.5,3,5 --views=side
//   node scripts/cloud-preview.mjs --coast=2 --skip-build

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".cloud-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    seed: { kind: "number", default: 38, help: "the map's seed (its meadow is the stage)" },
    region: {
      kind: "string",
      default: "",
      help: "the kind of snow country (R21); alpine if unset",
    },
    snow: {
      kind: "string",
      default: "soft,new",
      help: "the kinds of snow, rows (groomed,hard,soft,new,wet,ice,map)",
    },
    light: {
      kind: "string",
      default: "front,back,night",
      help: "the lights, rows (front,back,side,low,overcast,snowing,night)",
    },
    speeds: { kind: "string", default: "40,80", help: "the held speeds, km/h, rows" },
    views: {
      kind: "string",
      default: "chase,side,front,trail,under",
      help: "the angles, columns (chase,side,front,high,trail,under,furrow)",
    },
    cols: { kind: "string", default: "views", help: "views, or times (one view at --times)" },
    times: { kind: "string", default: "0.4,1,2,3.5", help: "the moments of --cols=times, s" },
    ride: { kind: "number", default: 2.5, help: "seconds ridden before the shot" },
    coast: { kind: "number", default: 0, help: "seconds coasted out of the tuck after it" },
    dial: { kind: "number", default: 1, help: "the snow dial (SNOW_DIAL: 0.25–2)" },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 400, help: "one cell's width, px" },
    height: { kind: "number", default: 225, help: "one cell's height, px" },
    out: { kind: "string", default: "", help: "the sheet's name under previews/ (cloud-<seed>)" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long the whole run may take, s" },
  },
  "usage: node scripts/cloud-preview.mjs [--snow=a,b] [--light=a,b] [--speeds=a,b] [--views=a,b] [--cols=times] [--skip-build]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "cloud-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "cloud-preview.html") },
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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

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
  snow: args.snow,
  light: args.light,
  speeds: args.speeds,
  views: args.views,
  cols: args.cols,
  times: args.times,
  ride: String(args.ride),
  coast: String(args.coast),
  dial: String(args.dial),
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
}).toString();
console.log(
  `cloud — seed ${args.seed}, snow ${args.snow}, light ${args.light}, ${args.speeds} km/h, ${args.cols === "times" ? `times ${args.times}` : `views ${args.views}`}`,
);
const t0 = Date.now();
await page.goto(`${server.url}cloud-preview.html?${query}`);
await page.waitForFunction("window.__cloud !== undefined");
await page.evaluate("window.__cloud.ready");
if (crashed) process.exit(1);
const drawn = await page.evaluate(() => globalThis.__cloud.sheet());
if (crashed) process.exit(1);
const out = join(outDir, `${args.out || `cloud-${args.seed}`}.png`);
await page.locator("#sheet").screenshot({ path: out });
console.log(
  `${out.replace(`${root}/`, "")}  ${drawn.rows}×${drawn.cols}: ${drawn.note}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
);

await browser.close();
await server.close();

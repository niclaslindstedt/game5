#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELICOPTER LAB — the free ride's helicopter (`docs/helicopter.md`;
// `engine/game/heli.ts`, drawn by `pwa/src/game/heli-view.ts`,
// `explosion.ts`, `camera-heli.ts`, held by `heli-scene.ts`) staged at
// every event it has and photographed through the game's own renderer, so
// each can be judged by eye and iterated on:
//
//   pad        pad (the parked machine: its own chase, far and high lenses,
//              and a ground-level quarter from the front and from behind),
//              call (a skier riding in from 130, 85, 40, 14 m — the machine
//              and its pad lit up inside 90 m — and taken on at the skid)
//   board      board (sat on the skid on the pad as the rotor spools up;
//              the rider close up from the side, the front and a quarter,
//              and his own eye), spool (the rotor spooling up from above:
//              the blades, their smear, the haze, the strobed ghost — three
//              frames 1/60 s apart at each moment)
//   lift       liftoff (off the pad at 0.5 … 8 s), wash (hovering 3, 8, 15
//              and 30 m over deep powder, the snow cloud built up for 3 s,
//              from the chase lens and from the snow 40 m off)
//   flight     cruise (chase, far, high), turn (banked into a turn), eye (the
//              rider's eye in cruise and over a steep face)
//   land       land (flown in and set down on the highest summit flat),
//              landed (the rotor turning there; the skier stepping off)
//   drop       drop (pushed off over a face too steep to land on: 0, 0.5, 1,
//              2 s), plunge (pushed off 60 m over a steep face and watched
//              down onto it and down it: the fall look), fall and impact
//              (40 m into deep powder), home (the
//              machine flying home, seen from the skier on the snow)
//   crash      crash (into the snow: the airframe torn apart and the
//              fireball at 0 … 6 s through the game's own crash lens,
//              pulled back from the chase), thrown (the rider the blast
//              flings, followed from the side), crash-nose (the same from the
//              nose lens), crash-fast (flown in at 32 m/s, from the far
//              lens), wreck (burning, from the snow), restart (back on the
//              pad)
//   handover   a press of the camera key mid-flight: chase to the nose
//              lens, frame by frame, and on to the far lens
//   night      night (the pad calling, a hover, a burst for the beacon,
//              cruising — under the stars at 21:00)
//   turntable  turntable (the model alone: 8 angles close, 8 at chase
//              range, and the rotor at speed from the side and above)
//
// Each GROUP is one contact sheet, previews/heli-<group>.png, and every
// frame is also written alone, previews/heli-<view>-<label>.png. The page
// (`pwa/src/tools/heli-harness.ts`, its scenes in `heli-scenes.ts` and its
// places in `heli-spots.ts`) stages each run on the engine — the machine
// flown by the bot pilot (`pilotInput`, to an aim), the drop the jump's
// press — and steps it itself, never on a wall clock, so a seed's sheet is
// the same sheet twice. This script builds it into a one-off bundle (never
// part of the app's build), serves it and drives it in a headless
// Chromium — `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/heli-preview.mjs                       # every sheet
//   node scripts/heli-preview.mjs --sheet=crash,drop
//   node scripts/heli-preview.mjs --views=wash,impact   # just those views
//   node scripts/heli-preview.mjs --seed=7 --region=fell --weather=clear
//   node scripts/heli-preview.mjs --sheet=turntable --skip-build

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".heli-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: {
      kind: "string",
      default: "",
      help: "which sheets, comma-separated (pad, board, lift, flight, land, drop, crash, handover, night, turntable); every one when left out",
    },
    views: {
      kind: "string",
      default: "",
      help: "only these views, comma-separated (pad, call, board, spool, liftoff, wash, cruise, turn, eye, land, landed, drop, plunge, fall, impact, home, crash, thrown, crash-nose, crash-fast, wreck, restart, handover, night, turntable)",
    },
    seed: { kind: "number", default: 38, help: "the map's seed" },
    region: {
      kind: "string",
      default: "",
      help: "the kind of snow country (R21): alpine, fell, continental, maritime; the alpine when left out",
    },
    hour: {
      kind: "number",
      default: NaN,
      help: "the solar hour every sheet is drawn under (the map's own unless named; the night sheet is 21)",
    },
    weather: {
      kind: "string",
      default: "",
      help: "the sky every sheet is drawn under (clear, fair, flurries, high, overcast, snow, storm, fog); the map's own when left out",
    },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 1280, help: "a frame's width, px" },
    height: { kind: "number", default: 720, help: "a frame's height, px" },
    cols: { kind: "number", default: 3, help: "tiles a row on a sheet" },
    scale: { kind: "number", default: 0.5, help: "a tile's size as a share of the frame" },
    out: { kind: "string", default: "heli", help: "file stem under previews/ (no extension)" },
    "sheets-only": { kind: "flag", help: "write the contact sheets, not every frame alone" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/heli-preview.mjs [--sheet=a,b] [--views=a,b] [--seed=n] [--region=id] [--hour=h] [--weather=kind] [--skip-build]",
);

const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "heli-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "heli-preview.html") },
    },
  });
}
// The committed models (the helicopter, the skis) go beside the page,
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
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
  cols: String(args.cols),
  scale: String(args.scale),
  ...(args.region ? { region: args.region } : {}),
  ...(Number.isFinite(args.hour) ? { hour: String(args.hour) } : {}),
  ...(args.weather ? { weather: args.weather } : {}),
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

await page.goto(`${server.url}heli-preview.html?${query}`);
await guarded(page.waitForFunction("window.__heli !== undefined"));
const note = await guarded(page.evaluate("window.__heli.ready"));
/** @type {Record<string, string[]>} */
const groups = await page.evaluate("window.__heli.groups");

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

console.log(`heli — seed ${args.seed}${args.region ? ` ${args.region}` : ""}: ${note}`);
const safe = (s) => s.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "");
for (const [group, views] of Object.entries(groups)) {
  if (wantSheets.length && !wantSheets.includes(group)) continue;
  const shot = wantViews.length ? views.filter((v) => wantViews.includes(v)) : views;
  if (!shot.length) continue;
  const t0 = Date.now();
  const { frames } = await guarded(
    page.evaluate(([g, v]) => globalThis.__heli.sheet(g, v), [group, shot]),
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

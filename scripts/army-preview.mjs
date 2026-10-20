#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY LAB — the army AS DRAWN: the military helicopter
// (`pwa/src/game/army-heli-view.ts`, its model `make models KIND=army`) and
// the winter infantry (`pwa/src/game/soldier-shapes.ts`, posed by
// `soldier-pose.ts`), stood on a real mountain and photographed through the
// game's own renderer, so the look can be judged and iterated on
// (`docs/army.md`):
//
//   heli      turntable (eight bearings round it landed), close (the door
//             gun and its gunner, the doorway, the nose, the tail rotor,
//             the skids, the rope bar), doors (both open, the gunners on
//             their guns, a section sat in the doorways), squad (landed,
//             its section out on the snow round it)
//   flight    flight-day, flight-dusk (--dusk=h): in the air over the
//             slope, the rotors turning, the gunner on his gun, a man on
//             the fast rope
//   hunt      hunt-2, hunt-4 (a hunted free ride run on the real engine,
//             the bot skiing away, the army's helicopters after him at two
//             and four stars), hunt-heli (him in the stolen air ambulance,
//             chased): from behind him at the machine, beside its door, wide
//   ground    ground-land (a machine set down, its squad spilling out and
//             kneeling), ground-file (skiing in file after him),
//             ground-fire (a soldier knelt on his skis firing), ground-lift
//             (a lift's squad on a chair), ground-arrest (SAFE FOR WORK:
//             him face down, held, the squad round him) — a hunted free
//             ride on the real engine, him stood still
//   soldiers  ski, foot, rocket (every pose from the front, the side and
//             behind at the chase camera's range, a row a pose), gunner
//             (sat at his door gun at each aim), lods (the three cuts)
//   sleds     sled-chase (a crewed snowmobile after him), sled-halt (its
//             short halt broadside, the gunner firing), sled-arrest (SAFE
//             FOR WORK: the crew off it and him held) — a hunted free ride
//             on the real engine, him stood still
//
// Each frame is captioned with its milliseconds, draw calls and triangles.
// Each VIEW is one contact sheet, previews/army-<view>.png, and every
// frame is also written alone. Built into a one-off bundle (never part of
// the app's build), served and driven in a headless Chromium —
// `CHROMIUM_PATH` overrides where one is looked for.
//
//   node scripts/army-preview.mjs                  # every sheet
//   node scripts/army-preview.mjs --sheet=soldiers
//   node scripts/army-preview.mjs --views=doors,flight-dusk --smock=whites

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".army-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    sheet: {
      kind: "string",
      default: "",
      help: "which sheets, comma-separated (heli, flight, hunt, ground, soldiers, sleds); every one when left out",
    },
    views: {
      kind: "string",
      default: "",
      help: "only these views, comma-separated (turntable, close, doors, squad, flight-day, flight-dusk, hunt-2, hunt-4, hunt-heli, ground-land, ground-file, ground-fire, ground-lift, ground-arrest, sled-chase, sled-halt, sled-arrest, ski, foot, rocket, gunner, lods)",
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
      help: "the solar hour the day sheets are drawn under (13 when left out)",
    },
    dusk: { kind: "number", default: 17.2, help: "the hour the dusk sheet is drawn under" },
    poses: {
      kind: "string",
      default: "",
      help: "only these poses on the soldiers' sheets, comma-separated (aim, kneel, ski, sit…); every one when left out",
    },
    smock: {
      kind: "string",
      default: "camo",
      help: "what the soldiers wear over their uniforms: camo (the snow camouflage) or whites",
    },
    weather: {
      kind: "string",
      default: "",
      help: "the sky (clear, fair, high, overcast, flurries, snow, storm, fog); clear when left out",
    },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 1280, help: "a frame's width, px" },
    height: { kind: "number", default: 720, help: "a frame's height, px" },
    scale: {
      kind: "number",
      default: 0.5,
      help: "a two-column tile's size as a share of the frame",
    },
    out: { kind: "string", default: "army", help: "file stem under previews/ (no extension)" },
    "sheets-only": { kind: "flag", help: "write the contact sheets, not every frame alone" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/army-preview.mjs [--sheet=a,b] [--views=a,b] [--seed=n] [--region=id] [--hour=h] [--dusk=h] [--smock=camo|whites] [--weather=kind] [--skip-build]",
);

const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "army-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "army-preview.html") },
    },
  });
}
// The committed models (the skis and the army's machine) go beside the page, where the renderer
// fetches them.
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
  dusk: String(args.dusk),
  smock: args.smock,
  ...(args.poses ? { poses: args.poses } : {}),
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
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

await page.goto(`${server.url}army-preview.html?${query}`);
await guarded(page.waitForFunction("window.__army !== undefined"));
const note = await guarded(page.evaluate("window.__army.ready"));
/** @type {Record<string, string[]>} */
const groups = await page.evaluate("window.__army.groups");

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

console.log(`army — seed ${args.seed}${args.region ? ` ${args.region}` : ""}: ${note}`);
const safe = (s) => s.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "");
for (const [group, views] of Object.entries(groups)) {
  if (wantSheets.length && !wantSheets.includes(group)) continue;
  const shot = wantViews.length ? views.filter((v) => wantViews.includes(v)) : views;
  for (const v of shot) {
    const t0 = Date.now();
    const { frames } = await guarded(
      page.evaluate(([g, vs]) => globalThis.__army.sheet(g, vs), [group, [v]]),
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
    const out = join(outDir, `${args.out}-${v}.png`);
    await page.locator("#sheet").screenshot({ path: out });
    await page.setViewportSize(viewport);
    console.log(
      `${out.replace(`${root}/`, "")}  ${frames.length} frames  (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
    );
  }
}

await browser.close();
await server.close();

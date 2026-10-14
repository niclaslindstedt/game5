#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FILM CAMERA LAB — the menu's backdrop (a showcase ridden by the daring
// bot) seen through the film director's camera (`camera-cinema.ts`,
// `cinema-director.ts`) in the game's own renderer, two ways:
//
//   live     as under the front door: the run read ahead (`cinema-ahead.ts`),
//            lenses planted for what is coming, slow motion over a long hang
//   replay   the same showcase recorded and watched back on the FILM angle
//
// Each mode is a FILMSTRIP — a contact sheet of a frame every `--every`
// wall seconds, captioned with the shot, its number in the edit, the lens's
// distance and how far off the axis he is (previews/cinema-<mode>.jpg) —
// a sheet of ONE FRAME A SHOT, the one with him nearest the middle
// (previews/cinema-<mode>-shots.jpg), and a line of the table: the shots
// cut, the kinds used, the mean shot length in wall seconds, the share of
// frames with him in the frame, near the middle (12°) and behind the snow,
// how many frames had the lens in the snow or inside a solid (a crown, a
// trunk, a house, a tower), the longest take in wall seconds, and how tall
// he stands in the jump shots (the median share of the frame's height). `--json=FILE` writes the
// table, `--compare=FILE` prints it beside one.
//
//   node scripts/cinema-preview.mjs                     # both modes, seed 7
//   node scripts/cinema-preview.mjs --mode=live --seed=6 --most=60

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".cinema-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    mode: {
      kind: "string",
      default: "live,replay",
      help: "which modes, comma-separated (live, replay)",
    },
    seed: { kind: "number", default: 7, help: "the map's seed" },
    take: { kind: "number", default: 0, help: "the showcase's take (how it is skied)" },
    every: { kind: "number", default: 0.5, help: "wall seconds between two frames shot" },
    most: { kind: "number", default: 50, help: "the most wall seconds watched" },
    width: { kind: "number", default: 960, help: "a frame's width, px" },
    height: { kind: "number", default: 540, help: "a frame's height, px" },
    cols: { kind: "number", default: 6, help: "tiles a row on a sheet" },
    scale: { kind: "number", default: 0.3, help: "a tile's size as a share of the frame" },
    json: { kind: "string", default: "", help: "write the table to this file" },
    compare: { kind: "string", default: "", help: "print the table beside one written by --json" },
    frames: {
      kind: "flag",
      help: "also write every frame shot, whole, to previews/cinema-<mode>/",
    },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 3600, help: "how long a sheet may take to draw, s" },
  },
  "usage: node scripts/cinema-preview.mjs [--mode=live,replay] [--seed=n] [--most=s] [--json=f] [--compare=f]",
);

mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "cinema-preview.html"))) {
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
      rollupOptions: { input: { lab: join(root, "pwa", "cinema-preview.html") } },
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
  take: String(args.take),
  w: String(args.width),
  h: String(args.height),
  cols: String(args.cols),
  scale: String(args.scale),
  every: String(args.every),
  most: String(args.most),
}).toString();
await page.goto(`${server.url}cinema-preview.html?${query}`);
await guarded(page.waitForFunction("window.__cinema !== undefined"));
const note = await guarded(page.evaluate("window.__cinema.ready"));
const modes = args.mode
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
for (const m of modes)
  if (m !== "live" && m !== "replay") {
    console.error(`unknown mode "${m}" (live, replay)`);
    process.exit(2);
  }

/** A watch's frames reduced to the table's row. */
function rowOf(measures) {
  const share = (f) => measures.filter(f).length / Math.max(1, measures.length);
  const takes = new Map();
  for (const m of measures) if (m.n >= 0) takes.set(m.n, (takes.get(m.n) ?? 0) + 1);
  const kinds = new Set(measures.map((m) => m.kind).filter((k) => k !== "-"));
  const lengths = [...takes.values()].map((f) => f / 60);
  const jumps = measures
    .filter((m) => ["hero", "lip", "hang"].includes(m.kind) && m.inFrame)
    .map((m) => m.size)
    .sort((a, b) => a - b);
  return {
    shots: takes.size,
    longest: Math.max(0, ...lengths),
    jump: jumps.length ? jumps[Math.floor(jumps.length / 2)] : 0,
    solid: measures.filter((m) => m.solid).length,
    kinds: kinds.size,
    mean: lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length),
    framed: share((m) => m.inFrame),
    centred: share((m) => m.off < 12),
    snow: share((m) => m.blocked),
    buried: measures.filter((m) => m.buried).length,
    used: [...kinds].sort().join(","),
  };
}

/** The page's sheet, shot as a JPEG. */
async function shoot(out) {
  const box = await page.locator("#sheet").boundingBox();
  await page.setViewportSize({
    width: Math.max(args.width, Math.ceil(box.width)),
    height: Math.ceil(box.y + box.height),
  });
  await page.locator("#sheet").screenshot({ path: out, type: "jpeg", quality: 80 });
  await page.setViewportSize(viewport);
  console.log(out.replace(`${root}/`, ""));
}

console.log(`film camera — seed ${args.seed} take ${args.take}: ${note}`);
const table = {};
for (const mode of modes) {
  const t0 = Date.now();
  const { frames, measures, picks } = await guarded(
    page.evaluate((m) => globalThis.__cinema.sheet(m), mode),
  );
  console.log(`${mode}: ${frames.length} frames (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  await shoot(join(outDir, `cinema-${mode}.jpg`));
  if (args.frames) {
    // EVERY FRAME WHOLE, named by its wall second and its take, to pick stills from.
    const dir = join(outDir, `cinema-${mode}`);
    mkdirSync(dir, { recursive: true });
    for (const f of frames) {
      const name = `${f.label.replace("s", "").padStart(5, "0")}-${f.kind}.jpg`;
      writeFileSync(join(dir, name), Buffer.from(f.png.split(",")[1], "base64"));
    }
  }
  await guarded(page.evaluate((p) => globalThis.__cinema.picks(p), picks));
  await shoot(join(outDir, `cinema-${mode}-shots.jpg`));
  table[mode] = rowOf(measures);
}

const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const pct = (v) => `${Math.round(v * 100)}%`.padStart(5);
const cell = (r) =>
  `${String(r.shots).padStart(5)} ${String(r.kinds).padStart(5)} ${r.mean.toFixed(2).padStart(6)} ${(r.longest ?? 0).toFixed(1).padStart(6)} ${pct(r.framed)} ${pct(r.centred)} ${pct(r.snow)} ${String(r.buried).padStart(6)} ${String(r.solid ?? "-").padStart(5)} ${pct(r.jump ?? 0)}`;
console.log(
  `\n${"mode".padEnd(8)} shots kinds  mean s  most s frame  <12°  snow buried solid  jump${before ? "   | before" : ""}`,
);
for (const [k, r] of Object.entries(table)) {
  const b = before?.[k];
  console.log(`${k.padEnd(8)} ${cell(r)}${b ? `   | ${cell(b)}` : ""}`);
  console.log(`         ${r.used}`);
}
if (args.json) writeFileSync(args.json, `${JSON.stringify(table, null, 2)}\n`);

await browser.close();
await server.close();

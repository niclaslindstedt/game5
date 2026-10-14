#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE'S FILM LAB (`make bike-film`): the rider and his bike
// MOVING together, photographed as FILMSTRIPS through the game's own
// renderer. Every clip of `pwa/src/tools/bike-clips.ts` (the pedal, the
// turns, the berm, the pump, the jump, the whip, the table, the landing, the
// brake, the foot out, the crash, the push and the lift — the same windows
// `make bike-motion` measures) is ridden on the real engine, drawn every
// frame as the game draws it, and shot at evenly spaced moments of its
// window from each angle asked (side, front, rear, chase, orbit): a sheet a
// clip, a row an angle, a column a moment, its figures under each frame.
//
// `--gif` films each clip again from one angle at a frame rate of its own
// and writes it as an animated GIF (ffmpeg) at real speed or slowed — the
// motion as motion. `--refs=DIR` lays reference photographs at the head of
// each clip's rows: any image in DIR whose name starts with the clip's id
// (`jump-1.jpg`, `whip.webp`, …). References are studied locally and are
// NEVER committed (the router's rule on third parties' pictures).
//
// Output: previews/<stem>-<clip>.png a sheet a clip (and every frame alone
// with --frames-too), previews/<stem>-<clip>-<angle>.gif with --gif.
// The page (`pwa/src/tools/bike-film-harness.ts`) is built into a one-off
// bundle, served and driven in a headless Chromium (`CHROMIUM_PATH`).
//
//   node scripts/bike-film.mjs                            every clip
//   node scripts/bike-film.mjs --clip=jump,whip --angles=side,rear,chase
//   node scripts/bike-film.mjs --clip=land --gif --slow=4
//   node scripts/bike-film.mjs --refs=$HOME/dh-refs --out-dir=/some/round2

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".bike-film");

const args = parseArgs(
  process.argv.slice(2),
  {
    clip: {
      kind: "string",
      default: "",
      help: "the clips, comma-separated; every one when left out",
    },
    angles: {
      kind: "string",
      default: "side,front,chase",
      help: "the angles a strip a clip (side, front, rear, chase, orbit)",
    },
    frames: { kind: "number", default: 8, help: "moments a strip" },
    cols: { kind: "number", default: 8, help: "moments a row before a strip wraps" },
    look: {
      kind: "string",
      default: "freeride",
      help: "the bike and its rider: freeride or trail",
    },
    refs: {
      kind: "string",
      default: "",
      help: "a local folder of reference photographs (never committed)",
    },
    gif: { kind: "flag", help: "film each clip as an animated GIF too (needs ffmpeg)" },
    "gif-angle": { kind: "string", default: "side", help: "the GIF's angle" },
    "gif-fps": { kind: "number", default: 20, help: "the GIF's frames a second of the ride" },
    slow: { kind: "number", default: 1, help: "the GIF slowed this many times" },
    "out-dir": { kind: "string", default: "", help: "where the pictures go (default previews/)" },
    out: { kind: "string", default: "bike-film", help: "file stem" },
    quality: { kind: "string", default: "low", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 640, help: "a frame's width, px" },
    height: { kind: "number", default: 360, help: "a frame's height, px" },
    "frames-too": { kind: "flag", help: "write every frame alone as well as the sheets" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 3600, help: "how long the page may take, s" },
  },
  "usage: node scripts/bike-film.mjs [--clip=a,b] [--angles=side,chase] [--gif] [--refs=DIR] [--out-dir=dir]",
);

const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
const outDir = args["out-dir"] ? resolve(args["out-dir"]) : join(root, "previews");
mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "bike-film-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "bike-film-preview.html") },
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
const page = await browser.newPage({ viewport: { width: args.width, height: args.height } });
let crashed = null;
page.on("pageerror", (err) => {
  crashed ??= err;
  console.error(`[pageerror] ${err.message}`);
});
page.on("console", (msg) => {
  if (msg.type() === "error") console.error(`[console] ${msg.text()}`);
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
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
  bikelook: args.look,
}).toString();
await page.goto(`${server.url}bike-film-preview.html?${query}`);
await guarded(page.waitForFunction("window.__film !== undefined"));
const note = await guarded(page.evaluate("window.__film.ready"));
const all = await page.evaluate("window.__film.clips");
const want = list(args.clip);
for (const id of want)
  if (!all.some((c) => c.id === id)) {
    console.error(`no clip "${id}" (${all.map((c) => c.id).join(", ")})`);
    process.exit(2);
  }
const clips = want.length ? all.filter((c) => want.includes(c.id)) : all;
const angles = list(args.angles);
console.log(`bike film — ${note}`);

/** The reference photographs for `clip`, as data URLs. */
const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
function refsOf(clip) {
  if (!args.refs) return [];
  const dir = resolve(args.refs);
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().startsWith(clip) && MIME[extname(f).toLowerCase()])
    .sort()
    .map((f) => ({
      name: f,
      src: `data:${MIME[extname(f).toLowerCase()]};base64,${readFileSync(join(dir, f)).toString("base64")}`,
    }));
}

const write = (file, png) => writeFileSync(file, Buffer.from(png.split(",")[1], "base64"));
for (const clip of clips) {
  const t0 = Date.now();
  const frames = await guarded(
    page.evaluate(([c, a, n]) => globalThis.__film.frames(c, a, n), [clip.id, angles, args.frames]),
  );
  if (!frames.length) {
    console.log(`${clip.id}: not ridden`);
    continue;
  }
  if (args["frames-too"])
    for (const f of frames)
      write(join(outDir, `${args.out}-${clip.id}-${f.angle}-${f.k}.png`), f.png);
  await guarded(
    page.evaluate(
      ([c, f, r, k]) => globalThis.__film.lay(c, f, r, k),
      [clip.id, frames, refsOf(clip.id), args.cols],
    ),
  );
  const box = await page.locator("#sheet").boundingBox();
  await page.setViewportSize({
    width: Math.max(args.width, Math.ceil(box.width)),
    height: Math.ceil(box.y + box.height),
  });
  const out = join(outDir, `${args.out}-${clip.id}.png`);
  await page.locator("#sheet").screenshot({ path: out });
  await page.setViewportSize({ width: args.width, height: args.height });
  console.log(
    `${out.replace(`${root}/`, "")}  ${frames.length} frames  (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
  );

  if (args.gif) {
    const t1 = Date.now();
    // The window's length off the strip's own captions' times.
    const ts = frames.map((f) => f.t);
    const span = Math.max(...ts) - Math.min(...ts);
    const n = Math.max(2, Math.round(span * args["gif-fps"]) + 1);
    const film = await guarded(
      page.evaluate(
        ([c, a, k]) => globalThis.__film.frames(c, a, k),
        [clip.id, [args["gif-angle"]], n],
      ),
    );
    const tmp = mkdtempSync(join(tmpdir(), "bike-gif-"));
    film.forEach((f, i) => write(join(tmp, `f${String(i).padStart(4, "0")}.png`), f.png));
    const rate = (n - 1) / Math.max(1e-3, span) / Math.max(0.05, args.slow);
    const gif = join(outDir, `${args.out}-${clip.id}-${args["gif-angle"]}.gif`);
    const ff = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-framerate",
        rate.toFixed(3),
        "-i",
        join(tmp, "f%04d.png"),
        "-vf",
        `scale=${args.width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
        "-loop",
        "0",
        gif,
      ],
      { stdio: "inherit" },
    );
    rmSync(tmp, { recursive: true, force: true });
    if (ff.status === 0)
      console.log(
        `${gif.replace(`${root}/`, "")}  ${n} frames at ${rate.toFixed(1)} fps  (${((Date.now() - t1) / 1000).toFixed(0)} s)`,
      );
    else console.error(`ffmpeg failed for ${clip.id} (is it installed?)`);
  }
}

await browser.close();
await server.close();

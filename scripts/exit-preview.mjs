#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE EXIT CUT LAB — the leap out of the jump plane's door, off the
// helicopter's skid and over the balloon's rim, shot as a film
// (`pwa/src/game/camera-exit.ts`: his eyes as he goes, the camera flyer
// facing him with the craft behind, the look back up at it, the long lens
// from the craft down at him) and handed back to the game's lens — filmed
// through the game's own renderer at the pace the app runs it (the leap in
// slow motion), on a wide screen and a phone held upright, so the cut can
// be judged as a player sees it:
//
//   previews/exit-<craft>-<screen>.png    the filmstrip: a still at each
//                                          moment of the cut, captioned
//                                          with the shot, the run's and the
//                                          wall's clock and the pace
//   previews/exit-<craft>-<screen>.mp4    with --video: every frame, as a
//                                          clip at thirty a second (ffmpeg)
//
// The page (`pwa/src/tools/exit-harness.ts`) flies each craft up on its
// pilot's hands and jumps on the machine press, never on a wall clock, so
// a seed's film is the same film twice. Built into a one-off bundle (never
// part of the app's build), served with the committed models beside it and
// driven in a headless Chromium — `CHROMIUM_PATH` overrides where one is
// looked for.
//
//   node scripts/exit-preview.mjs                          # all three, both screens
//   node scripts/exit-preview.mjs --craft=heli --screen=phone
//   node scripts/exit-preview.mjs --video --craft=plane --skip-build

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".exit-preview");
const outDir = join(root, "previews");

const args = parseArgs(
  process.argv.slice(2),
  {
    craft: {
      kind: "string",
      default: "plane,heli,balloon,para",
      help: "which crafts, comma-separated (plane, heli, balloon, para)",
    },
    screen: {
      kind: "string",
      default: "desktop,phone",
      help: "which screens, comma-separated (desktop 1280×720, phone 390×844)",
    },
    rung: {
      kind: "string",
      default: "chase",
      help: "the camera rung he rides on, which the cut hands back to (tips, helmet, chase, far, high, orbit)",
    },
    at: {
      kind: "string",
      default: "-0.5,0.02,0.25,0.5,0.8,1.2,1.7,2.2,2.7,3.2,3.8,4.4,5,5.6,6.3,7.2",
      help: "the filmstrip's moments, s since the exit (negative: aboard before it)",
    },
    video: { kind: "flag", help: "also film every frame and write a clip with ffmpeg" },
    until: { kind: "number", default: 8, help: "how long after the exit a clip runs, s" },
    seed: { kind: "number", default: 38, help: "the map's seed" },
    region: { kind: "string", default: "", help: "the kind of snow country (R21)" },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 3600, help: "how long a film may take, s" },
  },
  "usage: node scripts/exit-preview.mjs [--craft=a,b] [--screen=desktop,phone] [--rung=chase] [--video] [--seed=n] [--skip-build]",
);

const SCREENS = {
  desktop: { width: 1280, height: 720, cols: 4, scale: 0.5 },
  phone: { width: 390, height: 844, cols: 8, scale: 0.6 },
};
const CRAFTS = ["plane", "heli", "balloon", "para"];
const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
const crafts = list(args.craft);
const screens = list(args.screen);
for (const c of crafts) {
  if (!CRAFTS.includes(c)) {
    console.error(`unknown craft "${c}" (${CRAFTS.join(", ")})`);
    process.exit(2);
  }
}
for (const s of screens) {
  if (!SCREENS[s]) {
    console.error(`unknown screen "${s}" (${Object.keys(SCREENS).join(", ")})`);
    process.exit(2);
  }
}
const moments = list(args.at).map(Number);

mkdirSync(outDir, { recursive: true });
if (!args["skip-build"] || !existsSync(join(buildDir, "exit-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "exit-preview.html") },
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

for (const screenName of screens) {
  const S = SCREENS[screenName];
  const viewport = { width: S.width, height: S.height };
  const page = await browser.newPage({ viewport });
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
    quality: args.quality,
    w: String(S.width),
    h: String(S.height),
    cols: String(S.cols),
    scale: String(S.scale),
    jpeg: args.video ? "1" : "0",
    ...(args.region ? { region: args.region } : {}),
  }).toString();
  await page.goto(`${server.url}exit-preview.html?${query}`);
  await page.waitForFunction("window.__exit !== undefined");
  const note = await page.evaluate("window.__exit.ready");
  console.log(`exit — ${screenName}: ${note}`);
  if (crashed) throw crashed;

  for (const craft of crafts) {
    const t0 = Date.now();
    const { frames } = await page.evaluate(
      ([c, o]) => globalThis.__exit.film(c, o),
      [craft, { rung: args.rung, at: moments, until: args.until }],
    );
    await page.evaluate(
      ([t, f]) => globalThis.__exit.sheet(t, f),
      [`${craft} on ${args.rung}, ${screenName}`, frames],
    );
    const box = await page.locator("#sheet").boundingBox();
    await page.setViewportSize({
      width: Math.max(S.width, Math.ceil(box.width)),
      height: Math.ceil(box.y + box.height),
    });
    const out = join(outDir, `exit-${craft}-${screenName}.png`);
    await page.locator("#sheet").screenshot({ path: out });
    await page.setViewportSize(viewport);
    console.log(
      `${out.replace(`${root}/`, "")}  ${frames.length} frames  (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
    );

    if (!args.video) continue;
    const t1 = Date.now();
    const clip = await page.evaluate(
      ([c, o]) => globalThis.__exit.film(c, o),
      [craft, { rung: args.rung, until: args.until, every: 2, before: 1.2, pull: true }],
    );
    const dir = mkdtempSync(join(tmpdir(), "exit-"));
    clip.frames.forEach((f, i) => {
      writeFileSync(
        join(dir, `${String(i).padStart(5, "0")}.jpg`),
        Buffer.from(f.png.split(",")[1], "base64"),
      );
    });
    const mp4 = join(outDir, `exit-${craft}-${screenName}.mp4`);
    const ff = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-framerate",
        "30",
        "-i",
        join(dir, "%05d.jpg"),
        "-pix_fmt",
        "yuv420p",
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        mp4,
      ],
      { stdio: "inherit" },
    );
    rmSync(dir, { recursive: true, force: true });
    if (ff.status !== 0) console.error("ffmpeg failed (is it installed?)");
    else
      console.log(
        `${mp4.replace(`${root}/`, "")}  ${clip.frames.length} frames  (${((Date.now() - t1) / 1000).toFixed(1)} s)`,
      );
  }
  await page.close();
}

await browser.close();
await server.close();

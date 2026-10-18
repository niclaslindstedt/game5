#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GORE COST LAB — what a body torn apart costs a frame. A high-speed hit
// with the INJURIES switch on (`engine/game/gore.ts`, drawn by
// `pwa/src/game/gore-view.ts` and `gore-blood.ts`) is staged as the gore
// lab stages it and skied on frame by frame through the game's own renderer,
// and every frame is measured (`pwa/src/tools/gore-cost-harness.ts`):
//
//   cpu      the processor's whole `draw`, ms; `gore` the gore view's own
//            update inside it
//   wait     the wait for the card to finish the frame (a pixel read back)
//   calls    draw calls, the window's median (as `gcalls` and `meshes`);
//            `links` programs linked during the frame (each one a stall
//            on a phone's driver); `up` KB uploaded into buffers and
//            textures
//   big↑     the biggest single upload of a frame, KB; `gup` what the
//            twin uploads with the gore over without it, KB
//   drops    blood in the air; `splats`, `pools` blots on the snow; `meshes`
//            and `gtris` what the gore group hands the card
//   twin     the frame drawn again still, with the gore and without it,
//            each waited on: the gap is what DRAWING the gore costs (its
//            submit and its pixels), its update aside
//
// The rows are summed by window from the hit — the half second before it,
// the hit's first quarter second, then on — with the worst frame of each
// scene beside them, what the gore held at the end by kind, the last
// frame's uploads by call and size, and every program linked after the hit
// (with three's key for it: the field that differs from one already linked
// says what moved). On the host's GPU by default (a Mac's is a tiled GPU
// like a phone's, a lot faster); `--swiftshader` for software GL, which
// prices only structure. Each scene is run in a browser of its own so the
// programs linked are that scene's.
//
//   node scripts/gore-cost.mjs                          # every scene
//   node scripts/gore-cost.mjs --scene=trunk,mangled
//   node scripts/gore-cost.mjs --width=844 --height=390 --dpr=3 --quality=low
//   node scripts/gore-cost.mjs --json previews/gore-cost-before.json
//   node scripts/gore-cost.mjs --compare previews/gore-cost-before.json

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".gore-cost");

const args = parseArgs(
  process.argv.slice(2),
  {
    scene: {
      kind: "string",
      default: "",
      help: "which hits, comma-separated (trunk, mangled, decapitation, crush); every one when left out",
    },
    seed: { kind: "number", default: 2, help: "the map's seed" },
    region: {
      kind: "string",
      default: "",
      help: "the kind of snow country (R21); alpine when left out",
    },
    quality: { kind: "string", default: "medium", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 1280, help: "the picture's width, CSS px" },
    height: { kind: "number", default: 720, help: "the picture's height, CSS px" },
    dpr: { kind: "number", default: 1, help: "device pixels a CSS pixel (a phone's is 3)" },
    seconds: { kind: "number", default: 6, help: "how long after the hit to measure, s" },
    twins: {
      kind: "number",
      default: 2,
      help: "still twin pairs a frame (the best is kept); 0 skips them",
    },
    swiftshader: { kind: "flag", help: "draw with software GL rather than the host's GPU" },
    json: { kind: "string", default: "", help: "write every row to this JSON file" },
    compare: { kind: "string", default: "", help: "a JSON from --json to print beside this run" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
  },
  "usage: node scripts/gore-cost.mjs [--scene=a,b] [--seed=n] [--quality=q] [--width=w --height=h --dpr=d] [--json=f] [--compare=f]",
);

const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

mkdirSync(join(root, "previews"), { recursive: true });
if (!args["skip-build"] || !existsSync(join(buildDir, "gore-cost-preview.html"))) {
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
      rollupOptions: { input: { lab: join(root, "pwa", "gore-cost-preview.html") } },
    },
  });
}
// The committed models (the skis) go beside the page, where the renderer fetches them.
cpSync(join(root, "pwa", "models"), join(buildDir, "models"), { recursive: true });

const found = await findChromium();
if (!found) process.exit(1);
const server = await serveDir(buildDir);
const launch = () =>
  found.chromium.launch({
    executablePath: found.executablePath,
    args: args.swiftshader
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
      : ["--enable-gpu", "--ignore-gpu-blocklist"],
  });

const query = new URLSearchParams({
  seed: String(args.seed),
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
  dpr: String(args.dpr),
  seconds: String(args.seconds),
  twins: String(args.twins),
  ...(args.region ? { region: args.region } : {}),
}).toString();

/** One scene in a browser of its own. */
async function measure(scene) {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: args.width, height: args.height } });
  let crashed = null;
  page.on("pageerror", (err) => (crashed ??= err));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error(`[console] ${msg.text()}`);
  });
  page.setDefaultTimeout(600_000);
  const t0 = Date.now();
  await page.goto(`${server.url}gore-cost-preview.html?${query}`);
  await page.waitForFunction("window.__goreCost !== undefined");
  await page.evaluate("window.__goreCost.ready");
  const t1 = Date.now();
  const scenes = await page.evaluate("window.__goreCost.scenes");
  if (!scenes.includes(scene)) {
    await browser.close();
    throw new Error(`unknown scene "${scene}" (${scenes.join(", ")})`);
  }
  const out = await page.evaluate((s) => globalThis.__goreCost.run(s), scene);
  console.log(
    `${scene}: loaded in ${((t1 - t0) / 1000).toFixed(0)} s, run in ${((Date.now() - t1) / 1000).toFixed(0)} s`,
  );
  await browser.close();
  if (crashed) throw crashed;
  return out;
}

const ALL = ["trunk", "mangled", "decapitation", "crush"];
const scenes = list(args.scene).length ? list(args.scene) : ALL;
/** The windows from the hit the rows are summed over, s. */
const WINDOWS = [
  ["before", -0.5, 0],
  ["0-.25", 0, 0.25],
  [".25-1", 0.25, 1],
  ["1-3", 1, 3],
  ["3-6", 3, 6],
  ["6+", 6, Infinity],
];

const p50 = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const max = (xs) => (xs.length ? Math.max(...xs) : 0);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/** One window's figures. */
function summarise(rows) {
  const col = (k) => rows.map((r) => r[k]);
  const twin = rows.map((r) => r.shown - r.hidden);
  return {
    frames: rows.length,
    cpu: p50(col("cpu")),
    cpuMax: max(col("cpu")),
    gore: p50(col("gore")),
    goreMax: max(col("gore")),
    wait: p50(col("wait")),
    frameMax: max(rows.map((r) => r.cpu + r.wait)),
    calls: p50(col("calls")),
    goreCalls: p50(rows.map((r) => r.shownCalls - r.hiddenCalls)),
    links: sum(col("links")),
    up: mean(col("upload")),
    upMax: max(col("upload")),
    drops: max(col("drops")),
    splats: max(col("splats")),
    meshes: p50(col("meshes")),
    gtris: max(col("goreTris")),
    ptris: max(col("pieceTris")),
    btris: max(col("bloodTris")),
    gup: mean(rows.map((r) => r.shownUp - r.hiddenUp)),
    big: max(col("big")),
    twin: mean(twin),
    twinMax: max(twin),
  };
}

const COLUMNS = [
  ["window", (w) => w.name, 7],
  ["n", (w) => w.frames, 4],
  ["cpu", (w) => w.cpu.toFixed(2), 6],
  ["cpu↑", (w) => w.cpuMax.toFixed(1), 6],
  ["gore", (w) => w.gore.toFixed(2), 6],
  ["gore↑", (w) => w.goreMax.toFixed(1), 6],
  ["wait", (w) => w.wait.toFixed(2), 6],
  ["frame↑", (w) => w.frameMax.toFixed(1), 7],
  ["calls", (w) => w.calls, 6],
  ["gcalls", (w) => w.goreCalls, 6],
  ["links", (w) => w.links, 5],
  ["up KB", (w) => w.up.toFixed(0), 6],
  ["up↑", (w) => w.upMax.toFixed(0), 6],
  ["big↑", (w) => w.big.toFixed(0), 6],
  ["gup KB", (w) => w.gup.toFixed(0), 6],
  ["drops", (w) => w.drops, 6],
  ["splats", (w) => w.splats, 6],
  ["meshes", (w) => w.meshes, 6],
  ["gtris", (w) => Math.round(w.gtris), 7],
  ["ptris", (w) => Math.round(w.ptris), 7],
  ["btris", (w) => Math.round(w.btris), 7],
  ["twin", (w) => w.twin.toFixed(2), 6],
  ["twin↑", (w) => w.twinMax.toFixed(1), 6],
];
const pad = (s, n) => String(s).padStart(n);

function table(name, note, rows, before, linked = [], uploads = [], held = []) {
  console.log(`\n${name} — ${note}`);
  console.log(COLUMNS.map(([h, , n]) => pad(h, n)).join(" "));
  for (const [w, a, b] of WINDOWS) {
    const inside = rows.filter((r) => r.t >= a && r.t < b);
    if (!inside.length) continue;
    const s = { name: w, ...summarise(inside) };
    console.log(COLUMNS.map(([, f, n]) => pad(f(s), n)).join(" "));
    const was = before?.filter((r) => r.t >= a && r.t < b);
    if (was?.length) {
      const o = { name: "  was", ...summarise(was) };
      console.log(COLUMNS.map(([, f, n]) => pad(f(o), n)).join(" "));
    }
  }
  const worst = rows.reduce((a, r) => (r.cpu + r.wait > a.cpu + a.wait ? r : a), rows[0]);
  if (worst) {
    console.log(
      `  worst frame t ${worst.t.toFixed(3)} s: cpu ${worst.cpu.toFixed(1)} (gore ${worst.gore.toFixed(1)}) + wait ${worst.wait.toFixed(1)} ms, ${worst.links} links, ${worst.upload.toFixed(0)} KB up`,
    );
    const late = rows[rows.length - 1];
    console.log(
      `  last frame's biggest upload: ${late.big.toFixed(0)} KB (${late.bigWhat}), the twin's with the gore ${late.shownUp.toFixed(0)} KB, without ${late.hiddenUp.toFixed(0)} KB`,
    );
  }
  if (held.length) console.log(`  the gore at the end: ${held.join("; ")}`);
  if (uploads.length) console.log(`  the last frame's uploads (twins in): ${uploads.join("; ")}`);
  if (linked.length) console.log(`  linked after the hit: ${linked.join("; ")}`);
  const t = rows.filter((r) => r.t >= 0);
  console.log(
    `  after the hit: gore update ${sum(t.map((r) => r.gore)).toFixed(0)} ms in all, twin ${mean(t.map((r) => r.shown - r.hidden)).toFixed(2)} ms a frame, ${sum(t.map((r) => r.links))} links, ${(sum(t.map((r) => r.upload)) / 1024).toFixed(1)} MB up`,
  );
}

const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const out = { args, scenes: {} };
console.log(
  `gore cost — seed ${args.seed}, ${args.quality}, ${args.width}×${args.height} at ${args.dpr}×, ${args.swiftshader ? "software GL" : "host GPU"}`,
);
for (const scene of scenes) {
  const { rows, note, linked, uploads, held } = await measure(scene);
  out.scenes[scene] = { note, rows, linked };
  table(scene, note, rows, before?.scenes?.[scene]?.rows, linked, uploads, held);
}
if (args.json) {
  writeFileSync(args.json, JSON.stringify(out));
  console.log(`\nrows → ${args.json}`);
}
await server.close();

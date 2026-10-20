#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HITCHES LAB: the moments of a free ride that have been felt as a
// stall — the rescue flown in, the police's scene laid, the ski patrol
// driven up, the police machine taken and flown — each played through the
// game's own renderer in a page of its own (`pwa/hitches-preview.html`,
// `pwa/src/tools/hitches-harness.ts`), so each is met as a phone meets it:
// nothing of it built or compiled before. Every frame is drawn and timed to
// the GPU's end, and every program the driver links is counted
// (`linkProgram` wrapped before the page's own scripts run).
//
// A row a scenario: the frames, the median frame, the longest, the frames
// over the stall line (`--stall` ms past the median), the time lost to them,
// and the programs linked after the world was stood up. `--detail` lists each
// scenario's worst frames with the run clock they fell at.
//
// Software GL (SwiftShader) prices the processor's half and the driver's
// compiles, never a GPU's: read the PROGRAMS and the stalls' shape here,
// and the milliseconds on a device.
//
//   node scripts/hitches.mjs                          # every scenario
//   node scripts/hitches.mjs --scenario=police,steal --detail
//   node scripts/hitches.mjs --json=previews/hitches-before.json
//   node scripts/hitches.mjs --compare=previews/hitches-before.json

import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCENARIOS = ["ride", "crowd", "police", "sleds", "steal"];

const args = parseArgs(
  process.argv.slice(2),
  {
    scenario: {
      kind: "string",
      default: SCENARIOS.join(","),
      help: `which moments, comma-separated (${SCENARIOS.join(", ")})`,
    },
    seed: { kind: "number", default: 2, help: "the map's seed" },
    at: { kind: "number", default: 0.45, help: "where down the piste the scene is, a share" },
    region: { kind: "string", default: "", help: "the kind of snow country (R21)" },
    quality: { kind: "string", default: "low", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 320, help: "the canvas's width, px" },
    height: { kind: "number", default: 180, help: "the canvas's height, px" },
    fps: { kind: "number", default: 30, help: "frames a second of run clock drawn" },
    stall: { kind: "number", default: 100, help: "a frame this many ms past the median stalls" },
    detail: { kind: "flag", help: "list each scenario's worst frames" },
    json: { kind: "string", default: "", help: "write the rows to this file" },
    compare: { kind: "string", default: "", help: "a file written by --json: show it beside" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 3600, help: "how long a scenario may take, s" },
  },
  "usage: node scripts/hitches.mjs [--scenario=a,b] [--seed=n] [--detail] [--json=FILE] [--compare=FILE]",
);

const page = "hitches-preview";
const buildDir = join(root, "previews", `.${page}`);
if (!args["skip-build"] || !existsSync(join(buildDir, `${page}.html`))) {
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
      rollupOptions: { input: join(root, "pwa", `${page}.html`) },
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

/** Every program linked, counted on the page's window. */
const COUNT_LINKS = () => {
  for (const proto of [
    globalThis.WebGL2RenderingContext.prototype,
    globalThis.WebGLRenderingContext.prototype,
  ]) {
    const link = proto.linkProgram;
    proto.linkProgram = function (program) {
      globalThis.__links = (globalThis.__links ?? 0) + 1;
      return link.call(this, program);
    };
  }
};

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

const out = {};
for (const name of args.scenario
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)) {
  if (!SCENARIOS.includes(name)) {
    console.error(`unknown scenario "${name}" (${SCENARIOS.join(", ")})`);
    process.exit(2);
  }
  const tab = await browser.newPage({ viewport: { width: args.width, height: args.height } });
  tab.setDefaultTimeout(args.timeout * 1000);
  tab.on("pageerror", (err) => console.error(`[pageerror] ${err.message}`));
  await tab.addInitScript(COUNT_LINKS);
  const query = new URLSearchParams({
    scenario: name,
    seed: String(args.seed),
    at: String(args.at),
    quality: args.quality,
    w: String(args.width),
    h: String(args.height),
    fps: String(args.fps),
    ...(args.region ? { region: args.region } : {}),
  });
  const t0 = Date.now();
  await tab.goto(`${server.url}${page}.html?${query}`);
  await tab.waitForFunction("window.__hitches !== undefined");
  await tab.evaluate("window.__hitches.ready");
  const before = await tab.evaluate("window.__links ?? 0");
  const { note, rows } = await tab.evaluate("window.__hitches.run()");
  await tab.close();
  const mid = median(rows.map((r) => r.ms));
  const stalls = rows.filter((r) => r.ms > mid + args.stall);
  out[name] = {
    note,
    frames: rows.length,
    median: mid,
    worst: Math.max(0, ...rows.map((r) => r.ms)),
    stalls: stalls.length,
    lost: stalls.reduce((a, r) => a + r.ms - mid, 0),
    links: rows.reduce((a, r) => a + r.links, 0),
    linksAtLoad: before,
    top: [...rows].sort((a, b) => b.ms - a.ms).slice(0, 8),
    took: (Date.now() - t0) / 1000,
  };
}
await browser.close();
await server.close();

const was = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : {};
const pad = (s, n) => String(s).padStart(n);
const beside = (name, key, digits = 0) => {
  const w = was[name]?.[key];
  return w === undefined ? "" : ` (${w.toFixed(digits)})`;
};
console.log(
  `${"scenario".padEnd(8)} ${pad("frames", 7)} ${pad("median ms", 16)} ${pad("worst ms", 18)} ${pad("stalls", 12)} ${pad("lost ms", 18)} ${pad("programs", 12)}`,
);
for (const [name, r] of Object.entries(out)) {
  console.log(
    `${name.padEnd(8)} ${pad(r.frames, 7)} ${pad(r.median.toFixed(0) + beside(name, "median"), 16)} ${pad(r.worst.toFixed(0) + beside(name, "worst"), 18)} ${pad(r.stalls + beside(name, "stalls"), 12)} ${pad(r.lost.toFixed(0) + beside(name, "lost"), 18)} ${pad(r.links + beside(name, "links"), 12)}   ${r.note} · ${r.took.toFixed(0)} s`,
  );
  if (args.detail)
    for (const f of r.top)
      console.log(`           t ${f.t.toFixed(2)} s  ${f.ms.toFixed(0)} ms  ${f.links} programs`);
}
if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 2));

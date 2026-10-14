#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK EVAL LAB — the mountain's rock (the skin over every wall too
// steep for snow and every rocky cliff's face) drawn through the game's own
// renderer from a FIXED LIST OF SCENES on fixed maps, every scene PRICED, so
// two ways of building rock (its shape, its shading, its cuts, its culling)
// can be laid side by side on the same pictures and the same numbers.
//
// The scenes (`pwa/src/tools/rock-eval-harness.ts`) are pure functions of
// the map — where its rock lies, its cliffs, its mountain, its piste — never
// of a ride: at the foot of the rockiest face, the face from 40, 150, 400 and
// 1200 m, the highest rock against the sky, the tallest cliff from 28 m, from
// the piste nearest the face, from the air, and from the valley. They are
// drawn on a few GROUPS of map and sky: seed 38's black (the most rock) at
// 11:00, again under a low sun and in falling snow, the fell, continental and
// maritime countries, a real face and the summer.
//
// Every scene is priced twice, with the rock and without it (the renderer's
// own A/B, `setHidden(["rocks"])`): the rock's draw calls and triangles (the
// shadow pass's included) are the difference, the scene walk's count of what
// the `rocks` group draws beside them, and the frame's ms in a SOFTWARE
// rasterizer — a number to compare two builds by on one machine, never a
// phone's. Beside the price: the PHYSICS GAP (the drawn rock near the lens
// against the rock a body meets — cm), the SETTLE time (how long the rock in
// view took to build), the SHIMMER of the far face as the lens slides across
// it, and the APPROACH from 800 m to 20 m at the rockiest face (`pop` the
// largest step over the median: a tile swapping its cut).
//
// Out: `previews/rock-eval/<group>-<scene>.png`, `rock-eval.txt` (the
// table), `index.html` and `rock-eval.png` (the sheet: every scene with its
// numbers, and `--refs=DIR`'s photographs beside the scene whose name a file
// starts with — references stay local and are never committed).
// `--json=FILE` writes the numbers, `--compare=FILE` prints this run beside
// a run written before.
//
//   node scripts/rock-eval.mjs
//   node scripts/rock-eval.mjs --groups=alpine --scenes=foot,face-150
//   node scripts/rock-eval.mjs --json=previews/rocks-before.json
//   node scripts/rock-eval.mjs --compare=previews/rocks-before.json --refs=~/refs/rock
//   node scripts/rock-eval.mjs --quality=low        # the LOW preset's rock

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".rock-eval-preview");

const ALL = [
  "foot",
  "face-40",
  "face-150",
  "face-400",
  "face-1200",
  "skyline",
  "cliff",
  "piste",
  "aerial",
  "valley",
];
/** THE GROUPS: a map and a sky each, and the scenes drawn on it. */
const GROUPS = {
  alpine: { seed: 38, grade: "black", hour: 11, weather: "clear", scenes: ALL },
  low: {
    seed: 38,
    grade: "black",
    hour: 16.3,
    weather: "clear",
    scenes: ["foot", "face-150", "skyline"],
  },
  snow: { seed: 38, grade: "black", hour: 12, weather: "snow", scenes: ["foot", "face-150"] },
  fell: {
    seed: 38,
    grade: "black",
    region: "fell",
    hour: 11,
    weather: "clear",
    scenes: ["foot", "face-150"],
  },
  continental: {
    seed: 7,
    grade: "black",
    region: "continental",
    hour: 11,
    weather: "clear",
    scenes: ["foot", "face-150", "cliff"],
  },
  maritime: {
    seed: 38,
    grade: "black",
    region: "maritime",
    hour: 11,
    weather: "fair",
    scenes: ["foot", "face-150"],
  },
  real: {
    seed: 38,
    face: "alpine-1",
    hour: 11,
    weather: "clear",
    scenes: ["foot", "face-150", "skyline", "valley"],
  },
  summer: {
    seed: 38,
    grade: "black",
    summer: true,
    hour: 11,
    weather: "clear",
    scenes: ["foot", "face-150"],
  },
};

const args = parseArgs(
  process.argv.slice(2),
  {
    groups: {
      kind: "string",
      default: "",
      help: `only these groups (${Object.keys(GROUPS).join(", ")})`,
    },
    scenes: { kind: "string", default: "", help: "only these scenes in each group" },
    quality: { kind: "string", default: "high", help: "the picture preset: low, medium, high" },
    frames: { kind: "number", default: 2, help: "frames timed for each half of a scene's price" },
    approach: {
      kind: "flag",
      help: "only the approach walk and the shimmer (with the alpine group)",
    },
    "no-approach": { kind: "flag", help: "skip the approach walk and the shimmer" },
    "no-cost": { kind: "flag", help: "pictures only, no prices" },
    refs: {
      kind: "string",
      default: "",
      help: "a local folder of reference photographs (never committed)",
    },
    json: { kind: "string", default: "", help: "write the numbers here" },
    compare: { kind: "string", default: "", help: "print beside the numbers written here before" },
    out: { kind: "string", default: "previews/rock-eval", help: "where the pictures go" },
    width: { kind: "number", default: 1280, help: "canvas width, px" },
    height: { kind: "number", default: 720, help: "canvas height, px" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 14400, help: "how long the whole run may take, s" },
  },
  "usage: node scripts/rock-eval.mjs [--groups=a,b] [--scenes=a,b] [--quality=high] [--refs=DIR] [--json=FILE] [--compare=FILE] [--skip-build]",
);

const outDir = resolve(root, args.out);
mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "rock-eval-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "rock-eval-preview.html") },
    },
  });
}
cpSync(join(root, "pwa", "models"), join(buildDir, "models"), { recursive: true });

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
        return createRequire(join(globalRoot, "playwright", "package.json"))(name).chromium;
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

const wantGroups = args.approach
  ? ["alpine"]
  : args.groups
    ? args.groups.split(",").map((g) => g.trim())
    : Object.keys(GROUPS);
const wantScenes = args.scenes ? args.scenes.split(",").map((s) => s.trim()) : null;

/** Every number this run read. */
const result = { quality: args.quality, maps: {}, scenes: {}, approach: null, shimmer: null };

const cm = (m) => (m * 100).toFixed(0);

for (const name of wantGroups) {
  const g = GROUPS[name];
  if (!g) {
    console.error(`no group ${name} (${Object.keys(GROUPS).join(", ")})`);
    process.exit(1);
  }
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
  const query = new URLSearchParams({
    seed: String(g.seed),
    ...(g.grade ? { grade: g.grade } : {}),
    ...(g.region ? { region: g.region } : {}),
    ...(g.face ? { face: g.face } : {}),
    ...(g.summer ? { summer: "1" } : {}),
    hour: String(g.hour),
    weather: g.weather,
    quality: args.quality,
    w: String(args.width),
    h: String(args.height),
  }).toString();
  await page.goto(`${server.url}rock-eval-preview.html?${query}`);
  await page.waitForFunction("window.__rocks !== undefined");
  const map = await page.evaluate("window.__rocks.ready");
  if (crashed) process.exit(1);
  result.maps[name] = map;
  console.log(
    `${name}: seed ${g.seed} ${g.face ?? g.region ?? "alpine"}${g.summer ? " summer" : ""} ${g.hour}:00 ${g.weather} — ` +
      `${map.rockCells} rock cells of 12 m, ${map.cliffs} rocky cliffs, loaded in ${(map.loadMs / 1000).toFixed(1)} s`,
  );
  const scenes = args.approach ? [] : g.scenes.filter((s) => !wantScenes || wantScenes.includes(s));
  for (const scene of scenes) {
    const id = `${name}-${scene}`;
    const shot = await page.evaluate((s) => globalThis.__rocks.shoot(s), scene);
    if (crashed) process.exit(1);
    await page.locator("body").screenshot({ path: join(outDir, `${id}.png`) });
    let cost = null;
    let held = null;
    if (!args["no-cost"] && shot.note !== "none on this map") {
      cost = await page.evaluate((n) => globalThis.__rocks.cost(n), args.frames);
      held = await page.evaluate(() => globalThis.__rocks.stats());
    }
    result.scenes[id] = { ...shot, cost, held };
    console.log(`  ${id.padEnd(22)} ${cost ? line(result.scenes[id]) : shot.note}`);
  }
  if (name === "alpine" && !args["no-approach"] && (!wantScenes || args.approach)) {
    const far = await page.evaluate(() => globalThis.__rocks.shimmer("face-400", 10, 0.02));
    const farthest = await page.evaluate(() => globalThis.__rocks.shimmer("face-1200", 10, 0.05));
    result.shimmer = { "face-400": far, "face-1200": farthest };
    console.log(
      `  shimmer: face-400 ${far.toFixed(2)}, face-1200 ${farthest.toFixed(2)} (×1000, lower is steadier)`,
    );
    const steps = await page.evaluate(() => globalThis.__rocks.approach(800, 20, 10));
    const sorted = [...steps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 1e-6;
    const worst = Math.max(...steps);
    const at = 800 - 10 * (steps.indexOf(worst) + 1);
    result.approach = { steps, median, worst, at, pop: worst / median };
    console.log(
      `  approach 800→20 m: median change ${median.toFixed(2)}, worst ${worst.toFixed(2)} at ${at} m ` +
        `(pop ${(worst / median).toFixed(1)}×)`,
    );
  }
  await page.close();
}

/** One scene's numbers on a line. */
function line(r) {
  const c = r.cost;
  const calls = c.calls - c.callsBare;
  const tris = (c.triangles - c.trianglesBare) / 1000;
  const gap = r.gap ? `gap ${cm(r.gap.mean)}/${cm(r.gap.p95)} cm (mean/p95)` : "gap n/a";
  return (
    `rock ${String(calls).padStart(3)} calls ${tris.toFixed(0).padStart(5)}k tris ` +
    `(${(c.rockTriangles / 1000).toFixed(0)}k in view) · ` +
    `frame ${c.ms.toFixed(0)} ms (${(c.ms - c.msBare).toFixed(0)} the rock) · ` +
    `world ${(c.worldMs - c.worldMsBare).toFixed(2)} ms · settle ${r.settleMs.toFixed(0)} ms · ` +
    `held ${((r.held?.triangles ?? 0) / 1000).toFixed(0)}k tris ${((r.held?.bytes ?? 0) / 1048576).toFixed(1)} MB · ${gap}`
  );
}

// THE TABLE, and the totals a candidate is weighed by.
const rows = Object.entries(result.scenes).filter(([, r]) => r.cost);
const mean = (f) => rows.reduce((a, [, r]) => a + f(r), 0) / (rows.length || 1);
const gapped = rows.filter(([, r]) => r.gap);
result.totals = rows.length
  ? {
      scenes: rows.length,
      rockCalls: mean((r) => r.cost.calls - r.cost.callsBare),
      rockTriangles: mean((r) => r.cost.triangles - r.cost.trianglesBare),
      rockMs: mean((r) => r.cost.ms - r.cost.msBare),
      frameMs: mean((r) => r.cost.ms),
      worldMs: mean((r) => r.cost.worldMs - r.cost.worldMsBare),
      settleMs: mean((r) => r.settleMs),
      heldTriangles: mean((r) => r.held?.triangles ?? 0),
      heldBytes: mean((r) => r.held?.bytes ?? 0),
      gapMean: gapped.length
        ? gapped.reduce((a, [, r]) => a + r.gap.mean, 0) / gapped.length
        : null,
      gapP95: gapped.length ? Math.max(...gapped.map(([, r]) => r.gap.p95)) : null,
    }
  : null;
const t = result.totals;
const text = [
  `rock eval — ${args.quality} preset, ${args.width}×${args.height}, software rasterizer (compare builds, not machines)`,
  "",
  ...Object.entries(result.maps).map(
    ([n, m]) =>
      `${n.padEnd(12)} ${m.rockCells} rock cells · ${m.cliffs} cliffs · load ${(m.loadMs / 1000).toFixed(1)} s`,
  ),
  "",
  ...rows.map(([id, r]) => `${id.padEnd(22)} ${line(r)}`),
  ...(t
    ? [
        "",
        `MEAN over ${t.scenes} scenes: rock ${t.rockCalls.toFixed(0)} calls, ${(t.rockTriangles / 1000).toFixed(0)}k tris, ` +
          `${t.rockMs.toFixed(0)} ms of a ${t.frameMs.toFixed(0)} ms frame, ${t.worldMs.toFixed(2)} ms of the world's CPU, ` +
          `settle ${t.settleMs.toFixed(0)} ms, held ${(t.heldTriangles / 1000).toFixed(0)}k tris ${(t.heldBytes / 1048576).toFixed(1)} MB` +
          (t.gapMean !== null
            ? `, physics gap mean ${cm(t.gapMean)} cm, worst p95 ${cm(t.gapP95)} cm`
            : ""),
      ]
    : []),
  ...(result.shimmer
    ? [
        `SHIMMER face-400 ${result.shimmer["face-400"].toFixed(2)}, face-1200 ${result.shimmer["face-1200"].toFixed(2)}`,
      ]
    : []),
  ...(result.approach
    ? [
        `APPROACH 800→20 m: median ${result.approach.median.toFixed(2)}, worst ${result.approach.worst.toFixed(2)} at ${result.approach.at} m, pop ${result.approach.pop.toFixed(1)}×`,
      ]
    : []),
].join("\n");
writeFileSync(join(outDir, "rock-eval.txt"), `${text}\n`);
if (args.json) writeFileSync(resolve(args.json), JSON.stringify(result, null, 1));

if (args.compare) {
  const before = JSON.parse(readFileSync(resolve(args.compare), "utf8"));
  console.log("\nBEFORE → AFTER (rock calls, rock k tris, rock ms, gap p95 cm)");
  const f = (r) => [
    r.cost.calls - r.cost.callsBare,
    (r.cost.triangles - r.cost.trianglesBare) / 1000,
    r.cost.ms - r.cost.msBare,
    r.gap ? r.gap.p95 * 100 : NaN,
  ];
  for (const [id, r] of rows) {
    const b = before.scenes?.[id];
    if (!b?.cost) continue;
    const [bc, bt, bm, bg] = f(b);
    const [ac, at, am, ag] = f(r);
    console.log(
      `${id.padEnd(22)} ${String(bc).padStart(3)} → ${String(ac).padStart(3)}   ` +
        `${bt.toFixed(0).padStart(5)} → ${at.toFixed(0).padStart(5)}   ${bm.toFixed(0).padStart(5)} → ${am.toFixed(0).padStart(5)}   ` +
        `${bg.toFixed(0).padStart(4)} → ${ag.toFixed(0).padStart(4)}`,
    );
  }
  const bt = before.totals;
  if (bt && t)
    console.log(
      `MEAN${" ".repeat(18)} ${bt.rockCalls.toFixed(0).padStart(3)} → ${t.rockCalls.toFixed(0).padStart(3)}   ` +
        `${(bt.rockTriangles / 1000).toFixed(0).padStart(5)} → ${(t.rockTriangles / 1000).toFixed(0).padStart(5)}   ` +
        `${bt.rockMs.toFixed(0).padStart(5)} → ${t.rockMs.toFixed(0).padStart(5)}   settle ${bt.settleMs.toFixed(0)} → ${t.settleMs.toFixed(0)} ms`,
    );
  if (before.shimmer && result.shimmer)
    console.log(
      `shimmer face-400 ${before.shimmer["face-400"].toFixed(2)} → ${result.shimmer["face-400"].toFixed(2)}, ` +
        `face-1200 ${before.shimmer["face-1200"].toFixed(2)} → ${result.shimmer["face-1200"].toFixed(2)}`,
    );
  if (before.approach && result.approach)
    console.log(`pop ${before.approach.pop.toFixed(1)}× → ${result.approach.pop.toFixed(1)}×`);
}

// THE SHEET: every scene with its numbers, the references beside it.
const refsDir = args.refs ? resolve(args.refs.replace(/^~/, process.env.HOME ?? "~")) : "";
const refs =
  refsDir && existsSync(refsDir)
    ? readdirSync(refsDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    : [];
if (refs.length) {
  mkdirSync(join(outDir, "refs"), { recursive: true });
  for (const f of refs) cpSync(join(refsDir, f), join(outDir, "refs", f));
}
const esc = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const cards = Object.entries(result.scenes)
  .map(([id, r]) => {
    const scene = id.split("-").slice(1).join("-");
    const mine = refs.filter((f) => f.startsWith(`${id}`) || f.startsWith(`${scene}`));
    return `<figure><img src="${id}.png"><figcaption><b>${esc(id)}</b> · ${esc(r.note)}<br>${r.cost ? esc(line(r)) : ""}</figcaption>${mine.map((f) => `<img class="ref" src="refs/${esc(f)}">`).join("")}</figure>`;
  })
  .join("\n");
const curve = result.approach
  ? `<figure class="wide"><svg viewBox="0 0 ${result.approach.steps.length} 100" preserveAspectRatio="none"><polyline fill="none" stroke="#7cf" stroke-width="0.6" vector-effect="non-scaling-stroke" points="${result.approach.steps
      .map((v, i) => `${i},${100 - (100 * v) / (result.approach.worst || 1)}`)
      .join(
        " ",
      )}"/></svg><figcaption><b>approach</b> 800 m → 20 m at the rockiest face, each 10 m step's change off the last (a spike is a pop): median ${result.approach.median.toFixed(2)}, worst ${result.approach.worst.toFixed(2)} at ${result.approach.at} m, pop ${result.approach.pop.toFixed(1)}×</figcaption></figure>`
  : "";
writeFileSync(
  join(outDir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Rock eval</title><style>
body{margin:0;background:#11161b;color:#dde;font:12px/1.35 monospace;padding:10px}
main{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
figure{margin:0}img{width:100%;display:block}img.ref{margin-top:4px}
figure.wide{grid-column:1/-1}svg{width:100%;height:90px;background:#0b0f13}
pre{white-space:pre-wrap}</style><pre>${esc(text)}</pre><main>${cards}${curve}</main>`,
);
const sheet = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
await sheet.goto(`file://${join(outDir, "index.html")}`);
await sheet.screenshot({ path: join(outDir, "rock-eval.png"), fullPage: true });
await browser.close();
await server.close();
console.log(`\n${text}\n\nsheet: ${join(outDir, "rock-eval.png").replace(`${root}/`, "")}`);

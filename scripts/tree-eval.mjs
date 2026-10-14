#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREES EVAL LAB — the woods drawn through the game's own renderer from
// a FIXED LIST OF SCENES on fixed maps, every scene PRICED, so two ways of
// building a forest (its trees, their cuts, their instancing) can be laid
// side by side on the same pictures and the same numbers.
//
// The scenes (`pwa/src/tools/tree-eval-harness.ts`) are pure functions of
// the map — where its trees stand, its mountain, its piste — never of a
// ride: inside the densest stand, its edge from 34 m and 12 m, the piste
// where the woods crowd it, the tree line, the valley floor up the face,
// 600 m off and 250 m up, 140 m over the woods, a pine stand and a broadleaf
// stand. They are drawn on a few GROUPS of map and sky: seed 38's alpine at
// 11:00 and again at night and in falling snow, and the fell, continental
// and maritime woods.
//
// Every scene is priced twice, with the woods and without them (the
// renderer's own A/B, `setHidden`): the forest's draw calls and triangles
// (the shadow pass's included) are the difference, the scene walk's count
// of what the `forest` group would draw beside them, and the frame's ms in
// a SOFTWARE rasterizer — a number to compare two builds by on one machine,
// never a phone's. The APPROACH walks the lens in toward the densest wood
// from 400 m to 20 m in 5 m steps and reads how much each frame changed off
// the last: a smooth walk is a smooth curve, a tree that swaps its cut is a
// spike (`pop` is the largest step over the median).
//
// Out: `previews/tree-eval/<group>-<scene>.png`, `tree-eval.txt` (the
// table), `index.html` and `tree-eval.png` (the sheet: every scene with its
// price under it, and `--refs=DIR`'s photographs beside the scene whose
// name a file starts with — references stay local and are never
// committed). `--json=FILE` writes the numbers, `--compare=FILE` prints
// this run beside a run written before.
//
//   node scripts/tree-eval.mjs
//   node scripts/tree-eval.mjs --groups=alpine --scenes=inside,edge
//   node scripts/tree-eval.mjs --json=previews/trees-before.json
//   node scripts/tree-eval.mjs --compare=previews/trees-before.json --refs=~/refs/trees
//   node scripts/tree-eval.mjs --quality=low        # the LOW preset's woods

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".tree-eval-preview");

/** THE GROUPS: a map and a sky each, and the scenes drawn on it. */
const GROUPS = {
  alpine: {
    seed: 38,
    hour: 11,
    weather: "clear",
    scenes: [
      "inside",
      "edge",
      "close",
      "piste",
      "treeline",
      "valley",
      "far",
      "aerial",
      "pines",
      "broadleaf",
    ],
  },
  night: { seed: 38, hour: 21, weather: "clear", scenes: ["piste", "edge"] },
  snow: { seed: 38, hour: 12, weather: "snow", scenes: ["piste", "edge"] },
  fell: {
    seed: 38,
    region: "fell",
    hour: 11,
    weather: "clear",
    scenes: ["edge", "valley", "broadleaf"],
  },
  continental: {
    seed: 7,
    region: "continental",
    hour: 11,
    weather: "clear",
    scenes: ["edge", "pines", "valley"],
  },
  maritime: { seed: 38, region: "maritime", hour: 11, weather: "fair", scenes: ["edge", "inside"] },
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
    approach: { kind: "flag", help: "only the approach walk (with the alpine group)" },
    "no-approach": { kind: "flag", help: "skip the approach walk" },
    "no-cost": { kind: "flag", help: "pictures only, no prices" },
    refs: {
      kind: "string",
      default: "",
      help: "a local folder of reference photographs (never committed)",
    },
    json: { kind: "string", default: "", help: "write the numbers here" },
    compare: { kind: "string", default: "", help: "print beside the numbers written here before" },
    out: { kind: "string", default: "previews/tree-eval", help: "where the pictures go" },
    width: { kind: "number", default: 1280, help: "canvas width, px" },
    height: { kind: "number", default: 720, help: "canvas height, px" },
    "skip-build": { kind: "flag", help: "reuse the bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long the whole run may take, s" },
  },
  "usage: node scripts/tree-eval.mjs [--groups=a,b] [--scenes=a,b] [--quality=high] [--refs=DIR] [--json=FILE] [--compare=FILE] [--skip-build]",
);

const outDir = resolve(root, args.out);
mkdirSync(outDir, { recursive: true });

if (!args["skip-build"] || !existsSync(join(buildDir, "tree-eval-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "tree-eval-preview.html") },
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
const result = { quality: args.quality, maps: {}, scenes: {}, approach: null };

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
    ...(g.region ? { region: g.region } : {}),
    hour: String(g.hour),
    weather: g.weather,
    quality: args.quality,
    w: String(args.width),
    h: String(args.height),
  }).toString();
  await page.goto(`${server.url}tree-eval-preview.html?${query}`);
  await page.waitForFunction("window.__trees !== undefined");
  const map = await page.evaluate("window.__trees.ready");
  if (crashed) process.exit(1);
  result.maps[name] = map;
  console.log(
    `${name}: seed ${g.seed} ${g.region ?? "alpine"} ${g.hour}:00 ${g.weather} — ${map.trees} trees, ` +
      `loaded in ${(map.loadMs / 1000).toFixed(1)} s, forest ${map.geometries} geometries ` +
      `${(map.forestBytes / 1048576).toFixed(1)} MB`,
  );
  const scenes = args.approach ? [] : g.scenes.filter((s) => !wantScenes || wantScenes.includes(s));
  for (const scene of scenes) {
    const id = `${name}-${scene}`;
    const note = await page.evaluate((s) => globalThis.__trees.shoot(s), scene);
    if (crashed) process.exit(1);
    await page.locator("body").screenshot({ path: join(outDir, `${id}.png`) });
    let cost = null;
    if (!args["no-cost"] && note !== "none on this map") {
      cost = await page.evaluate((n) => globalThis.__trees.cost(n), args.frames);
    }
    result.scenes[id] = { note, cost };
    console.log(`  ${id.padEnd(22)} ${cost ? line(cost) : note}`);
  }
  if (name === "alpine" && !args["no-approach"] && (!wantScenes || args.approach)) {
    const steps = await page.evaluate(() => globalThis.__trees.approach(400, 20, 5));
    const sorted = [...steps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 1e-6;
    const worst = Math.max(...steps);
    const at = 400 - 5 * (steps.indexOf(worst) + 1);
    result.approach = { steps, median, worst, at, pop: worst / median };
    console.log(
      `  approach 400→20 m: median change ${median.toFixed(2)}, worst ${worst.toFixed(2)} at ${at} m ` +
        `(pop ${(worst / median).toFixed(1)}×)`,
    );
  }
  await page.close();
}

/** One scene's price on a line. */
function line(c) {
  const calls = c.calls - c.callsBare;
  const tris = (c.triangles - c.trianglesBare) / 1000;
  return (
    `forest ${String(calls).padStart(4)} calls ${tris.toFixed(0).padStart(6)}k tris ` +
    `(${c.forestObjects} drawn, ${(c.forestTriangles / 1000).toFixed(0)}k in view) · ` +
    `frame ${c.ms.toFixed(0)} ms (${(c.ms - c.msBare).toFixed(0)} the woods) · ` +
    `world ${c.worldMs.toFixed(2)} ms (${(c.worldMs - c.worldMsBare).toFixed(2)} the woods)`
  );
}

// THE TABLE, and the totals a candidate is weighed by.
const rows = Object.entries(result.scenes).filter(([, r]) => r.cost);
const sum = (f) => rows.reduce((a, [, r]) => a + f(r.cost), 0);
result.totals = rows.length
  ? {
      scenes: rows.length,
      forestCalls: sum((c) => c.calls - c.callsBare) / rows.length,
      forestTriangles: sum((c) => c.triangles - c.trianglesBare) / rows.length,
      forestMs: sum((c) => c.ms - c.msBare) / rows.length,
      frameMs: sum((c) => c.ms) / rows.length,
      worldMs: sum((c) => c.worldMs - c.worldMsBare) / rows.length,
    }
  : null;
const text = [
  `trees eval — ${args.quality} preset, ${args.width}×${args.height}, software rasterizer (compare builds, not machines)`,
  "",
  ...Object.entries(result.maps).map(
    ([n, m]) =>
      `${n.padEnd(12)} ${m.trees} trees · load ${(m.loadMs / 1000).toFixed(1)} s · forest ${m.geometries} geometries ${(m.forestBytes / 1048576).toFixed(1)} MB`,
  ),
  "",
  ...rows.map(([id, r]) => `${id.padEnd(22)} ${line(r.cost)}`),
  ...(result.totals
    ? [
        "",
        `MEAN over ${result.totals.scenes} scenes: forest ${result.totals.forestCalls.toFixed(0)} calls, ` +
          `${(result.totals.forestTriangles / 1000).toFixed(0)}k tris, ${result.totals.forestMs.toFixed(0)} ms of a ` +
          `${result.totals.frameMs.toFixed(0)} ms frame, ${result.totals.worldMs.toFixed(2)} ms of the world's CPU`,
      ]
    : []),
  ...(result.approach
    ? [
        `APPROACH 400→20 m: median ${result.approach.median.toFixed(2)}, worst ${result.approach.worst.toFixed(2)} at ${result.approach.at} m, pop ${result.approach.pop.toFixed(1)}×`,
      ]
    : []),
].join("\n");
writeFileSync(join(outDir, "tree-eval.txt"), `${text}\n`);
if (args.json) writeFileSync(resolve(args.json), JSON.stringify(result, null, 1));

if (args.compare) {
  const before = JSON.parse(readFileSync(resolve(args.compare), "utf8"));
  console.log("\nBEFORE → AFTER (forest calls, forest k tris, woods ms)");
  for (const [id, r] of rows) {
    const b = before.scenes?.[id]?.cost;
    if (!b) continue;
    const f = (c) => [
      c.calls - c.callsBare,
      (c.triangles - c.trianglesBare) / 1000,
      c.ms - c.msBare,
    ];
    const [bc, bt, bm] = f(b);
    const [ac, at, am] = f(r.cost);
    console.log(
      `${id.padEnd(22)} ${String(bc).padStart(4)} → ${String(ac).padStart(4)}   ` +
        `${bt.toFixed(0).padStart(6)} → ${at.toFixed(0).padStart(6)}   ${bm.toFixed(0).padStart(5)} → ${am.toFixed(0).padStart(5)}`,
    );
  }
  if (before.totals && result.totals)
    console.log(
      `MEAN${" ".repeat(18)} ${before.totals.forestCalls.toFixed(0).padStart(4)} → ${result.totals.forestCalls.toFixed(0).padStart(4)}   ` +
        `${(before.totals.forestTriangles / 1000).toFixed(0).padStart(6)} → ${(result.totals.forestTriangles / 1000).toFixed(0).padStart(6)}   ` +
        `${before.totals.forestMs.toFixed(0).padStart(5)} → ${result.totals.forestMs.toFixed(0).padStart(5)}`,
    );
  if (before.approach && result.approach)
    console.log(`pop ${before.approach.pop.toFixed(1)}× → ${result.approach.pop.toFixed(1)}×`);
}

// THE SHEET: every scene with its price, the references beside it.
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
    return `<figure><img src="${id}.png"><figcaption><b>${esc(id)}</b> · ${esc(r.note)}<br>${r.cost ? esc(line(r.cost)) : ""}</figcaption>${mine.map((f) => `<img class="ref" src="refs/${esc(f)}">`).join("")}</figure>`;
  })
  .join("\n");
const curve = result.approach
  ? `<figure class="wide"><svg viewBox="0 0 ${result.approach.steps.length} 100" preserveAspectRatio="none"><polyline fill="none" stroke="#7cf" stroke-width="0.6" vector-effect="non-scaling-stroke" points="${result.approach.steps
      .map((v, i) => `${i},${100 - (100 * v) / (result.approach.worst || 1)}`)
      .join(
        " ",
      )}"/></svg><figcaption><b>approach</b> 400 m → 20 m, each 5 m step's change off the last (a spike is a pop): median ${result.approach.median.toFixed(2)}, worst ${result.approach.worst.toFixed(2)} at ${result.approach.at} m, pop ${result.approach.pop.toFixed(1)}×</figcaption></figure>`
  : "";
writeFileSync(
  join(outDir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Trees eval</title><style>
body{margin:0;background:#11161b;color:#dde;font:12px/1.35 monospace;padding:10px}
main{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
figure{margin:0}img{width:100%;display:block}img.ref{margin-top:4px}
figure.wide{grid-column:1/-1}svg{width:100%;height:90px;background:#0b0f13}
pre{white-space:pre-wrap}</style><pre>${esc(text)}</pre><main>${cards}${curve}</main>`,
);
const sheet = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
await sheet.goto(`file://${join(outDir, "index.html")}`);
await sheet.screenshot({ path: join(outDir, "tree-eval.png"), fullPage: true });
await browser.close();
await server.close();
console.log(`\n${text}\n\nsheet: ${join(outDir, "tree-eval.png").replace(`${root}/`, "")}`);

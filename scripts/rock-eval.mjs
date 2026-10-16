#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK EVAL LAB — the mountain's rock (the skin over every wall too
// steep for snow and every rocky cliff's face) drawn through the game's own
// renderer from a FIXED LIST OF SCENES on fixed maps, every scene PRICED, so
// two ways of building rock (its shape, its shading, its cuts, its culling)
// can be laid side by side on the same pictures and the same numbers.
//
// The scenes (`pwa/src/tools/rock-eval-scenes.ts`) are pure functions of
// the map — where its rock lies, its cliffs, its mountain, its piste — never
// of a ride: at the foot of the rockiest face; the face from 40, 150, 250,
// 400 and 1200 m; the highest rock against the sky; the tallest cliff from
// 28 m, and from 20 and 60 m square on and 45° off; up a gully and across a
// buttress; along the wall's foot and over the talus ground below the
// tallest cliff; a skier's eye down the piste where the rock is nearest it;
// from the piste nearest the face, from the air and from the valley. They
// are drawn on GROUPS of map and sky: seed 38's black (the most rock) at
// 11:00, again under a low sun, at night and in falling snow, the fell,
// continental and maritime countries (the maritime lays no rock — its row's
// `rock` is off — so its scenes show what a candidate would add there), a
// real face and the summer.
//
// EVERY SCENE IS READ FROM NOTHING: the rock let go and built whole at the
// scene's own lens and the ground's shading baked before a frame is read,
// and every frame READ drawn with no time passing (the sparkle, the woods'
// sway and the wildlife run on the renderer's clock, which every earlier
// frame moved on), so the order the scenes are drawn in never moves a
// number. The shimmer is therefore the lens's alone — read with the falling
// crystals, the spray and its cloud hidden, and without the sparkle's
// twinkle round 1 counted in. The ORDER CHECK proves it on every alpine run:
// face-400 read first and again after everything else (the picture's change
// and its shimmer both times), beside the shimmer read round 1's way — the
// tiles as the approach left them — which is what moved.
//
// Every scene is priced, interleaved twice: whole, without the rock (the
// renderer's own A/B, `setHidden(["rocks"])`: the rock's draw calls and
// triangles, the shadow pass's included, and its ms), without the GROUND
// (`terrain` hidden: the ground's ms, where rock drawn in the ground's shader
// is paid) and, on a build whose `terrain` group carries a `rockGround`
// switch, without the ground's own rock. The ms are a SOFTWARE rasterizer's —
// compare two builds on one machine, never a phone's. Beside the price: the
// PHYSICS GAP (the drawn rock against the rock a body meets, within 250 m of
// the lens and within 50 m — cm; a ground that draws rock says where through
// `rockDrawnAt`), the SETTLE time (the rock in view built from nothing), the
// SHIMMER of the 250, 400 and 1200 m faces as the lens slides across them,
// the APPROACH from 800 m to 20 m at the rockiest face (`pop` the largest
// step over the median: a tile swapping its cut), and the FLICKER at 150,
// 300, 600 and 1200 m off `make shimmer` itself (run after, on the same
// preset), so one run gives it all.
//
// Out: `previews/rock-eval/<group>-<scene>.png` (or `.jpg`), `rock-eval.txt`
// (the table), `index.html` (every scene by group), `scenes.html` (the same
// lens on every map side by side), `flicker.png` (make shimmer's sheet) and
// `rock-eval.png` (one of the two pages photographed, `--sheet`). `--refs=DIR`
// lays photographs beside the scene whose name a file starts with (local,
// never committed). `--json=FILE` writes the numbers, `--compare=FILE` prints
// this run beside a run written before (round 1's JSON too).
//
//   node scripts/rock-eval.mjs
//   node scripts/rock-eval.mjs --groups=alpine --scenes=foot,face-150
//   node scripts/rock-eval.mjs --order-check            # the proof alone, quick
//   node scripts/rock-eval.mjs --json=previews/rocks-before.json
//   node scripts/rock-eval.mjs --compare=previews/rocks-before.json --refs=~/refs/rock
//   node scripts/rock-eval.mjs --quality=low        # the LOW preset's rock

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync, execSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

import { compare, line, pages, table, totals } from "./lib/rock-eval-report.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".rock-eval-preview");

/** Every scene, in the order a group draws them (round 1's names kept). */
const ALL = [
  "foot",
  "face-40",
  "face-150",
  "face-250",
  "face-400",
  "face-1200",
  "skyline",
  "cliff",
  "cliff-20",
  "cliff-20-oblique",
  "cliff-60",
  "cliff-60-oblique",
  "gully",
  "buttress",
  "wall-foot",
  "talus",
  "talus-apron",
  "chase",
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
    scenes: ["foot", "face-150", "face-400", "skyline", "cliff-60-oblique", "buttress"],
  },
  night: {
    seed: 38,
    grade: "black",
    hour: 21,
    weather: "clear",
    scenes: ["foot", "face-150", "face-400", "cliff-20", "chase"],
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
    scenes: ["foot", "face-150", "cliff", "cliff-20", "cliff-60-oblique", "gully", "talus", "talus-apron"],
  },
  maritime: {
    seed: 38,
    grade: "black",
    region: "maritime",
    hour: 11,
    weather: "fair",
    scenes: ["foot", "face-150", "gully", "cliff-20"],
  },
  real: {
    seed: 38,
    face: "alpine-1",
    hour: 11,
    weather: "clear",
    scenes: [
      "foot",
      "face-150",
      "face-250",
      "skyline",
      "valley",
      "cliff-20",
      "cliff-20-oblique",
      "cliff-60",
      "cliff-60-oblique",
      "gully",
      "buttress",
      "talus",
      "talus-apron",
      "chase",
    ],
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
/** The faces whose shimmer is read (the alpine group), and the scenes the
 * quick `--order-check` stands at between its two readings. */
const SHIMMER = ["face-250", "face-400", "face-1200"];
const ORDER_SCENE = "face-400";
const ORDER_BETWEEN = ["foot", "cliff-20", "face-1200"];

const args = parseArgs(
  process.argv.slice(2),
  {
    groups: {
      kind: "string",
      default: "",
      help: `only these groups (${Object.keys(GROUPS).join(", ")})`,
    },
    scenes: {
      kind: "string",
      default: "",
      help: `only these scenes in each group (${ALL.join(", ")})`,
    },
    quality: { kind: "string", default: "high", help: "the picture preset: low, medium, high" },
    frames: { kind: "number", default: 2, help: "frames timed for each pass of a scene's price" },
    approach: {
      kind: "flag",
      help: "only the approach walk, the shimmer and the order check (with the alpine group)",
    },
    "no-approach": { kind: "flag", help: "skip the approach walk and the shimmer" },
    "no-cost": { kind: "flag", help: "pictures only, no prices" },
    "order-check": {
      kind: "flag",
      help: `only the order check, quick: ${ORDER_SCENE} read, then ${ORDER_BETWEEN.join(", ")}, then ${ORDER_SCENE} again`,
    },
    "no-order-check": { kind: "flag", help: "skip the order check on the alpine group" },
    "no-flicker": { kind: "flag", help: "skip make shimmer's flicker at 150–1200 m" },
    "flicker-shots": {
      kind: "string",
      default: "rock-150,rock-300,rock-600,rock-1200",
      help: "make shimmer's shots (rock-<m>, valley)",
    },
    sheet: {
      kind: "string",
      default: "group",
      help: "which page rock-eval.png photographs: group (a map a row) or scene (a lens a row)",
    },
    format: { kind: "string", default: "png", help: "the scenes' pictures: png or jpg" },
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
    "skip-build": { kind: "flag", help: "reuse the bundles from the last run" },
    timeout: { kind: "number", default: 14400, help: "how long the whole run may take, s" },
  },
  "usage: node scripts/rock-eval.mjs [--groups=a,b] [--scenes=a,b] [--quality=high] [--order-check] [--sheet=group|scene] [--format=png|jpg] [--refs=DIR] [--json=FILE] [--compare=FILE] [--skip-build]",
);

const outDir = resolve(root, args.out);
mkdirSync(outDir, { recursive: true });
const ext = args.format === "jpg" ? "jpg" : "png";

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

const quick = args["order-check"];
const wantGroups =
  args.approach || quick
    ? ["alpine"]
    : args.groups
      ? args.groups.split(",").map((g) => g.trim())
      : Object.keys(GROUPS);
const wantScenes = args.scenes ? args.scenes.split(",").map((s) => s.trim()) : null;

/** Every number this run read. */
const result = {
  quality: args.quality,
  maps: {},
  groupNotes: {},
  scenes: {},
  approach: null,
  shimmer: null,
  orderCheck: null,
  flicker: null,
};

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
  result.groupNotes[name] =
    `seed ${g.seed} ${g.face ?? g.region ?? "alpine"}${g.summer ? " summer" : ""} ${g.hour}:00 ${g.weather}`;
  console.log(
    `${name}: ${result.groupNotes[name]} — ` +
      `${map.rockCells} rock cells of 12 m, ${map.cliffs} rocky cliffs, loaded in ${(map.loadMs / 1000).toFixed(1)} s` +
      ` (hooks: rockReset ${map.rockReset}, rockGround ${map.rockGround}, rockDrawnAt ${map.rockDrawnAt})`,
  );
  const alpine = name === "alpine";
  const checking = alpine && !args["no-order-check"];
  const order = { scene: ORDER_SCENE, between: [] };
  if (checking) {
    // THE ORDER CHECK's first reading, before anything else is drawn.
    await page.evaluate((s) => globalThis.__rocks.mark(s), ORDER_SCENE);
    order.shimmerFirst = await page.evaluate(
      (s) => globalThis.__rocks.shimmer(s, 10, 0.02, true),
      ORDER_SCENE,
    );
    console.log(
      `  order check: ${ORDER_SCENE} read first, shimmer ${order.shimmerFirst.toFixed(2)}`,
    );
  }
  const scenes = args.approach
    ? []
    : quick
      ? (wantScenes ?? ORDER_BETWEEN)
      : g.scenes.filter((s) => !wantScenes || wantScenes.includes(s));
  for (const scene of scenes) {
    const id = `${name}-${scene}`;
    const shot = await page.evaluate((s) => globalThis.__rocks.shoot(s), scene);
    if (crashed) process.exit(1);
    order.between.push(scene);
    if (!shot.clean)
      console.warn(`  ${id}: the rock did not let go before the scene (held triangles)`);
    await page.locator("body").screenshot({
      path: join(outDir, `${id}.${ext}`),
      ...(ext === "jpg" ? { type: "jpeg", quality: 85 } : {}),
    });
    let cost = null;
    let held = null;
    if (!args["no-cost"] && !quick && shot.note !== "none on this map") {
      cost = await page.evaluate((n) => globalThis.__rocks.cost(n), args.frames);
      held = await page.evaluate(() => globalThis.__rocks.stats());
    }
    result.scenes[id] = { ...shot, cost, held };
    console.log(`  ${id.padEnd(26)} ${cost ? line(result.scenes[id]) : shot.note}`);
  }
  if (alpine && !quick && !args["no-approach"] && (!wantScenes || args.approach)) {
    result.shimmer = {};
    for (const s of SHIMMER) {
      const slide = s === "face-1200" ? 0.05 : 0.02;
      result.shimmer[s] = await page.evaluate(
        ([n, d]) => globalThis.__rocks.shimmer(n, 10, d, true),
        [s, slide],
      );
    }
    console.log(
      `  shimmer: ${Object.entries(result.shimmer)
        .map(([k, v]) => `${k} ${v.toFixed(2)}`)
        .join(", ")} (×1000, lower is steadier)`,
    );
    const steps = await page.evaluate(() => globalThis.__rocks.approach(800, 20, 10));
    order.between.push("the approach 800→20 m");
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
  if (checking && quick) {
    // A shimmer read at another face between the two readings too: the
    // full run's shimmer pass reads face-400 right after face-250's.
    await page.evaluate(() => globalThis.__rocks.shimmer("face-250", 10, 0.02, true));
    order.between.push("face-250's shimmer");
  }
  if (checking) {
    // Round 1's way, the tiles as the last lens left them, then the
    // reading again from nothing.
    order.shimmerUnsettled = await page.evaluate(
      (s) => globalThis.__rocks.shimmer(s, 10, 0.02, false),
      ORDER_SCENE,
    );
    const again = await page.evaluate((s) => globalThis.__rocks.recheck(s), ORDER_SCENE);
    order.shimmerLast = await page.evaluate(
      (s) => globalThis.__rocks.shimmer(s, 10, 0.02, true),
      ORDER_SCENE,
    );
    result.orderCheck = { ...order, ...again };
    console.log(
      `  order check: ${ORDER_SCENE} again after ${order.between.join(", ")} — picture change ${again.change.toFixed(3)}, ` +
        `rock in view ${again.rockTriangles.join(" → ")}, shimmer ${order.shimmerFirst.toFixed(2)} → ${order.shimmerLast.toFixed(2)} ` +
        `(unsettled after the last lens, round 1's way: ${order.shimmerUnsettled.toFixed(2)})`,
    );
  }
  await page.close();
}
await browser.close();
await server.close();

// THE FLICKER: make shimmer itself, on the same preset, after this run's
// browser has closed so the two never share the processor.
if (
  !args["no-flicker"] &&
  !quick &&
  wantGroups.includes("alpine") &&
  (!wantScenes || args.approach)
) {
  const g = GROUPS.alpine;
  try {
    const out = execFileSync(
      process.execPath,
      [
        join(root, "scripts", "shimmer-preview.mjs"),
        "--json",
        `--seed=${g.seed}`,
        `--grade=${g.grade}`,
        `--quality=${args.quality}`,
        `--shots=${args["flicker-shots"]}`,
        ...(args["skip-build"] ? ["--skip-build"] : []),
      ],
      { cwd: root, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "inherit"] },
    );
    const json = JSON.parse(out.slice(out.indexOf('{\n  "seed"')));
    const sheet = "flicker.png";
    cpSync(join(root, "previews", `shimmer-${g.seed}-${g.grade}.png`), join(outDir, sheet));
    result.flicker = {
      seed: g.seed,
      grade: g.grade,
      frames: json.frames,
      step: json.step,
      rows: json.rows,
      sheet,
    };
    console.log(
      `  flicker: ${json.rows.map((r) => `${r.shot} ${r.flicker.toFixed(2)}`).join(", ")} (make shimmer, ×1000)`,
    );
  } catch (err) {
    console.error(`make shimmer failed: ${err.message}`);
  }
}

result.totals = totals(result);
const text = table(result, args);
writeFileSync(join(outDir, "rock-eval.txt"), `${text}\n`);
if (args.json) writeFileSync(resolve(args.json), JSON.stringify(result, null, 1));
if (args.compare)
  console.log(compare(JSON.parse(readFileSync(resolve(args.compare), "utf8")), result));

// THE PAGES: every scene by group and by scene, the references beside it.
const refsDir = args.refs ? resolve(args.refs.replace(/^~/, process.env.HOME ?? "~")) : "";
const refs =
  refsDir && existsSync(refsDir)
    ? readdirSync(refsDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    : [];
if (refs.length) {
  mkdirSync(join(outDir, "refs"), { recursive: true });
  for (const f of refs) cpSync(join(refsDir, f), join(outDir, "refs", f));
}
const written = pages(result, text, ext, refs, Object.keys(GROUPS));
for (const [file, html] of Object.entries(written)) writeFileSync(join(outDir, file), html);
const shotBrowser = await chromium.launch({ executablePath });
const sheet = await shotBrowser.newPage({ viewport: { width: 1800, height: 1000 } });
await sheet.goto(`file://${join(outDir, args.sheet === "scene" ? "scenes.html" : "index.html")}`);
await sheet.waitForLoadState("load");
await sheet.screenshot({ path: join(outDir, "rock-eval.png"), fullPage: true });
await shotBrowser.close();
console.log(
  `\n${text}\n\npages: ${join(outDir, "index.html").replace(`${root}/`, "")}, scenes.html; sheet: rock-eval.png`,
);

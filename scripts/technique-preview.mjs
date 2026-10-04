#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TECHNIQUE LAB — how each riding TECHNIQUE (`engine/game/defs/
// technique.ts`: the free skier, the slalom racer, and the giant slalom,
// super-G and downhill rows no mode deals yet) LOOKS and MEASURES, so a
// row can be iterated on. Each technique is skied by the bot down one
// course on one seed — each on its discipline's own pair unless `--skis`
// says otherwise — and:
//
//   THE TABLE (printed; `--json` to save, `--compare` to diff against a
//   saved run): the peak edge (the mean of each turn's), the turn time
//   (between flips of the edge), the radius a tenth of the turning frames
//   turn tighter than, the most yaw, the mean and peak speed, the mean and
//   most skid angle, the legs' peak load in body weights (over a tenth of a
//   second), the share of the run tucked — the rhythm read by the ride
//   lab's own `rhythmOf` — each beside its RESEARCH TARGET for the row's
//   discipline (`scripts/lib/technique-measure.mjs`, off
//   `docs/disciplines.md`) and marked ▲ or ▼ outside it;
//
//   THE SHEETS (previews/technique-<seed>-<sheet>.png, the game's own
//   renderer on a harness page, `pwa/src/tools/technique-harness.ts`):
//   PATH — a stretch of the course from straight above, the skier strobed
//   over the line he draws, a panel a technique side by side; BEHIND — a TV
//   lens up the course behind him at the transition, the edge set, the apex
//   and the exit of one turn, a row a technique; SIDE — that apex from his
//   outside, the front and his inside; TURNS — how SHARP each turns (below);
//
//   THE TURN SHAPES (`scripts/lib/technique-shape.mjs`): every technique
//   skied down ONE COMMON open slope with no gates, a scripted rhythm at its
//   own researched turn time and turn speed (`SHAPE_DRIVE`) rather than the
//   bot, so the physics shows what each does with a linked carve; drawn from
//   above at ONE scale side by side, the line coloured by its radius, each
//   apex labelled with its radius, turn time and peak edge, the target
//   radius drawn at one; the medians as the table's `shape …` rows.
//
// THE COURSE (`--course`): `slalom` skis every row down seed's slalom (R31,
// under its strict gates — a row that straddles or misses a gate is out
// there, and is measured up to it), `piste` down the open piste under it
// (gates every hundred metres or so, a time trial); `auto`, the default,
// skis the slalom racer and the free skier down the slalom and the giant
// slalom, super-G and downhill rows down the piste — their 30–50 m
// sidecuts cannot make a slalom's 5 m turns, so on the slalom course they
// are out within three gates (`NATURAL_COURSE`).
//
// The table is measured in Node off the engine (seconds; `--sheets=none`
// stops there, no browser); the page skis the same runs again for the
// pictures, and the lab says so if a run there ended at a different time.
// The sheets need a Chromium like `world` — `CHROMIUM_PATH` overrides
// where one is looked for.
//
//   node --experimental-strip-types scripts/technique-preview.mjs
//   node … scripts/technique-preview.mjs --techniques=slalom,free --sheets=none
//   node … scripts/technique-preview.mjs --course=piste --sheets=path
//   node … scripts/technique-preview.mjs --skis=swift --course=slalom
//   node … scripts/technique-preview.mjs --json=previews/tech-before.json --sheets=none
//   node … scripts/technique-preview.mjs --compare=previews/tech-before.json

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { aliasEngine } from "@niclaslindstedt/oss-game-framework/tooling/alias";
import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

import {
  NATURAL_COURSE,
  NATURAL_SKIS,
  coursesOf,
  resultOf,
  skiRow,
  statsOf,
  tableOf,
  TARGETS,
} from "./lib/technique-measure.mjs";
import {
  SHAPE_COURSE,
  SHAPE_DRIVE,
  shapeOf,
  shapeSeconds,
  skiShape,
} from "./lib/technique-shape.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "previews", ".technique-preview");
const outDir = join(root, "previews");
const SHEETS = ["path", "behind", "side", "turns"];
const COURSES = ["auto", "slalom", "piste"];

aliasEngine(root);
const E = await import(join(root, "engine", "index.ts"));
const S = await import(join(root, "tests", "support", "synthetic.ts"));
const IDS = Object.keys(E.TECHNIQUES);
const PAIRS = E.SKI_CATALOG.map((s) => s.id);

const args = parseArgs(
  process.argv.slice(2),
  {
    techniques: {
      kind: "string",
      default: IDS.join(","),
      help: `the techniques, a row each (${IDS.join(", ")})`,
    },
    seed: { kind: "number", default: 38, help: "the mountain's seed" },
    skis: {
      kind: "string",
      default: "",
      help: `the pair: one for every row or one a row (${PAIRS.join(", ")}); each discipline's own when unset (${IDS.map((id) => `${id} ${NATURAL_SKIS[id]}`).join(", ")})`,
    },
    course: {
      kind: "string",
      default: "auto",
      help: "slalom (R31, every row), piste (the open piste, every row) or auto (the slalom for the slalom and free rows, the piste for the speed events)",
    },
    sheets: {
      kind: "string",
      default: SHEETS.join(","),
      help: `the sheets (${SHEETS.join(", ")}), or none for the table alone`,
    },
    span: {
      kind: "number",
      default: 0,
      help: "the stretch of course the path shows and the turn is picked from, m (60 on the slalom, 300 on the piste when 0)",
    },
    strobe: { kind: "number", default: 0.25, help: "the path's strobe, s" },
    quality: { kind: "string", default: "high", help: "the picture preset (low, medium, high)" },
    width: { kind: "number", default: 360, help: "a behind or side cell's width, px" },
    height: { kind: "number", default: 240, help: "a behind or side cell's height, px" },
    "path-width": { kind: "number", default: 240, help: "a path panel's width, px" },
    "path-height": { kind: "number", default: 900, help: "a path panel's height, px" },
    json: { kind: "string", default: "", help: "write the table as JSON to this file" },
    compare: {
      kind: "string",
      default: "",
      help: "a saved --json table to print the change against",
    },
    "skip-build": { kind: "flag", help: "reuse the page's bundle from the last run" },
    timeout: { kind: "number", default: 1800, help: "how long the page may take, s" },
  },
  "usage: node --experimental-strip-types scripts/technique-preview.mjs [--techniques=a,b] [--skis=id|a,b] [--course=auto|slalom|piste] [--sheets=path,behind,side|none] [--json=f] [--compare=f]",
);

const fail = (msg) => {
  console.error(msg);
  process.exit(2);
};
const techniques = args.techniques.split(",").filter(Boolean);
for (const t of techniques)
  if (!IDS.includes(t)) fail(`unknown technique "${t}" (${IDS.join(", ")})`);
const skis = args.skis.split(",").filter(Boolean);
for (const s of skis) if (!PAIRS.includes(s)) fail(`unknown skis "${s}" (${PAIRS.join(", ")})`);
if (skis.length > 1 && skis.length !== techniques.length) {
  fail(`--skis names ${skis.length} pairs for ${techniques.length} techniques`);
}
if (!COURSES.includes(args.course)) fail(`unknown course "${args.course}" (${COURSES.join(", ")})`);
const sheets = args.sheets === "none" ? [] : args.sheets.split(",").filter(Boolean);
for (const s of sheets)
  if (!SHEETS.includes(s)) fail(`unknown sheet "${s}" (${SHEETS.join(", ")})`);

const rows = techniques.map((technique, i) => ({
  technique,
  skis: skis.length === 0 ? NATURAL_SKIS[technique] : (skis[i] ?? skis[0]),
  course: args.course === "auto" ? NATURAL_COURSE[technique] : args.course,
}));

// THE TABLE, off the engine.
const t0 = Date.now();
const courses = coursesOf(E, args.seed);
for (const row of rows) {
  const { frames, result } = skiRow(E, courses, row);
  row.result = result;
  row.stats = statsOf(frames);
}
// THE TURN SHAPES, every row down the common slope for the same time.
const shapeFor = shapeSeconds(rows.map((r) => r.technique));
for (const row of rows) {
  row.shape = shapeOf(skiShape(E, S, row, shapeFor));
  Object.assign(row.stats, row.shape.stats);
}
const slalom = courses.slalom.slalom;
console.log(
  `technique lab — engine ${E.engineVersion} · seed ${args.seed} · course ${args.course} ` +
    `(slalom ${slalom.from.toFixed(0)}–${slalom.to.toFixed(0)} m, ${slalom.vertical.toFixed(0)} m of vertical, ` +
    `${courses.slalom.checkpoints.length} gates; piste ${courses.piste.track.length.toFixed(0)} m, ` +
    `${courses.piste.checkpoints.length} gates) · the bot · ${((Date.now() - t0) / 1000).toFixed(1)} s\n`,
);
const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
for (const line of tableOf(rows, before)) console.log(line);
if (args.json) {
  const saved = {
    seed: args.seed,
    course: args.course,
    rows: rows.map(({ technique, skis: pair, course, result, stats }) => ({
      technique,
      skis: pair,
      course,
      result: resultOf(result),
      stats,
    })),
  };
  writeFileSync(args.json, JSON.stringify(saved, null, 1));
  console.log(`\nwrote ${args.json}`);
}
if (sheets.length === 0) process.exit(0);

// THE SHEETS, on the harness page.
mkdirSync(outDir, { recursive: true });
if (!args["skip-build"] || !existsSync(join(buildDir, "technique-preview.html"))) {
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
      rollupOptions: { input: join(root, "pwa", "technique-preview.html") },
    },
  });
}

const found = await findChromium();
if (!found) process.exit(1);
const server = await serveDir(buildDir);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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
  rows: rows.map((r) => `${r.technique}:${r.skis}:${r.course}`).join(","),
  quality: args.quality,
  w: String(args.width),
  h: String(args.height),
  pw: String(args["path-width"]),
  ph: String(args["path-height"]),
  strobe: String(args.strobe),
  "span-slalom": String(args.span || 60),
  "span-piste": String(args.span || 300),
}).toString();
const t1 = Date.now();
await page.goto(`${server.url}technique-preview.html?${query}`);
await page.waitForFunction("window.__tech !== undefined");
await page.evaluate("window.__tech.ready");
if (crashed) process.exit(1);
// The turn shapes are measured here and handed to the page to draw.
await page.evaluate((d) => globalThis.__tech.setShapes(d), {
  course: SHAPE_COURSE,
  seconds: shapeFor,
  rows: rows.map((r) => ({
    technique: r.technique,
    skis: r.skis,
    drive: SHAPE_DRIVE[r.technique],
    line: r.shape.line,
    turns: r.shape.turns,
    thrown: r.shape.thrown,
    band: TARGETS[r.technique].shapeRadius ?? null,
  })),
});
const ran = sheets.some((s) => s !== "turns")
  ? await page.evaluate(() => globalThis.__tech.run())
  : [];
if (crashed) process.exit(1);
console.log("");
ran.forEach((r, i) => {
  // The page's run is the table's run again, step for step while the two
  // runtimes' floating point agrees — Node's and Chromium's last digit of a
  // transcendental can differ, and the bot's run drifts a few steps over a
  // minute from there; past a second the pictures are of another run.
  const off = r.end - rows[i].result.end;
  const note =
    Math.abs(off) < 1e-6
      ? ""
      : ` — the page's run ended ${off > 0 ? "+" : ""}${off.toFixed(2)} s off the table's${Math.abs(off) > 1 ? " (WARNING: the pictures are not the measured run)" : ""}`;
  console.log(`${r.technique}: ${r.turn}${note}`);
});
for (const name of sheets) {
  const drawn = await page.evaluate((n) => globalThis.__tech.sheet(n), name);
  // An element's picture is clipped at the viewport: size it to the sheet.
  await page.setViewportSize({ width: drawn.w, height: drawn.h });
  const out = join(outDir, `technique-${args.seed}-${name}.png`);
  await page.locator("#sheet").screenshot({ path: out });
  console.log(`${out.replace(`${root}/`, "")}  ${drawn.w}×${drawn.h}`);
}
console.log(`(the sheets took ${((Date.now() - t1) / 1000).toFixed(0)} s)`);
await browser.close();
await server.close();

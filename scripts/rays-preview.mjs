#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RAYS LAB — the PICTURE row RAYS (`pwa/src/game/rays-tsl.ts`,
// `docs/webgpu.md` part 18) judged by LOOKING: every scene where one of its
// effects matters photographed twice through the game's own renderer, the
// row OFF and the row at a stop, the same moment of the same run, and laid
// side by side with the difference between them drawn beside (brightened
// eight times, so a halo, a band or a crawl of noise shows at once):
// `previews/rays-<scene>-<view>.png`.
//
//   forest       the woods at noon: the shade at the trunks' feet, under
//                the boughs, the sketch band's edge
//   forest-low   the same at a low sun: the long shadows and the shade
//   skier        the chase lens and the helmet's: the boots and the skis
//                on the snow (the contact shadows), the furrows
//   village      a free ride's street and square: walls' feet, eaves
//   night        the street after dark: lamps, no sun
//   lake         the water lab's lake from the air and from a skier's
//                chase at noon: the mirror (MAX)
//   lake-summer  the lake in summer, open
//
// The world scenes ride `scripts/world-preview.mjs`, the lakes
// `scripts/water-preview.mjs`, each with `--picture=rays:<stop>`; both are
// driven on WebGPU (SwiftShader here) unless `--renderer` says otherwise,
// since classic WebGL draws no rays at all.
//
//   node scripts/rays-preview.mjs                          # every scene, MAX
//   node scripts/rays-preview.mjs --scenes=skier --stop=high
//   node scripts/rays-preview.mjs --scenes=lake --skip-build

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "previews");
const shotDir = join(outDir, "rays");

/** Each scene: the lab it rides, its flags, its views. */
const SCENES = {
  forest: { lab: "world", args: ["--hour=12"], views: ["forest", "approach-40"] },
  "forest-low": { lab: "world", args: ["--hour=16.5"], views: ["forest", "approach-40"] },
  skier: { lab: "world", args: ["--hour=12"], views: ["chase-6", "helmet", "spawn"] },
  village: {
    lab: "world",
    args: ["--free", "--hour=12"],
    views: ["village-street", "village-square"],
  },
  night: { lab: "world", args: ["--free", "--hour=21"], views: ["village-street"] },
  lake: { lab: "water", args: ["--hour=12"], views: ["aerial", "chase", "open-calm"] },
  "lake-summer": { lab: "water", args: ["--hour=12"], views: ["summer"] },
};

const args = parseArgs(
  process.argv.slice(2),
  {
    scenes: {
      kind: "string",
      default: "",
      help: `which scenes, comma-separated (${Object.keys(SCENES).join(", ")}); every one when left out`,
    },
    stop: { kind: "string", default: "max", help: "the RAYS stop beside OFF (low, high, max)" },
    quality: { kind: "string", default: "high", help: "the picture preset under the row" },
    renderer: {
      kind: "string",
      default: "webgpu",
      help: "the back end (webgpu, webgpu-gl; webgl draws no rays)",
    },
    width: { kind: "number", default: 960, help: "a picture's width, px" },
    height: { kind: "number", default: 540, help: "a picture's height, px" },
    "skip-build": { kind: "flag", help: "reuse each lab's bundle from its last run" },
    "compare-only": { kind: "flag", help: "lay out the pictures already taken; take none" },
  },
  "usage: node scripts/rays-preview.mjs [--scenes=a,b] [--stop=max] [--quality=high] [--renderer=webgpu] [--skip-build] [--compare-only]",
);

if (!["low", "high", "max"].includes(args.stop)) {
  console.error(`unknown --stop "${args.stop}" (low, high, max)`);
  process.exit(2);
}
const wanted = args.scenes ? args.scenes.split(",").map((s) => s.trim()) : Object.keys(SCENES);
for (const s of wanted) {
  if (!SCENES[s]) {
    console.error(`unknown scene "${s}" (${Object.keys(SCENES).join(", ")})`);
    process.exit(2);
  }
}
mkdirSync(shotDir, { recursive: true });

/** Run `lab` for `scene` at RAYS `stop`, and move what it wrote into the
 * lab's own folder as `<scene>-<view>-<stop>.png`. */
const built = new Set();
function take(name, scene, stop) {
  const started = Date.now() - 1000;
  const script = scene.lab === "world" ? "world-preview.mjs" : "water-preview.mjs";
  const flags = [
    `--renderer=${args.renderer}`,
    `--quality=${args.quality}`,
    `--picture=rays:${stop}`,
    `--width=${args.width}`,
    `--height=${args.height}`,
    `--views=${scene.views.join(",")}`,
    ...scene.args,
    ...(scene.lab === "water" ? ["--out=rays-water"] : []),
    ...(args["skip-build"] || built.has(scene.lab) ? ["--skip-build"] : []),
  ];
  console.log(`${name} at ${stop}: node scripts/${script} ${flags.join(" ")}`);
  execFileSync("node", [join(root, "scripts", script), ...flags], { stdio: "inherit" });
  built.add(scene.lab);
  const fresh = readdirSync(outDir)
    .filter((f) => f.endsWith(".png"))
    .filter((f) => statSync(join(outDir, f)).mtimeMs >= started);
  for (const view of scene.views) {
    const file =
      scene.lab === "world"
        ? fresh.find((f) => f.startsWith("world-") && f.endsWith(`-${view}.png`))
        : fresh.find((f) => f.startsWith(`rays-water-${view}-`));
    if (!file) {
      console.error(`no picture of ${view} came out of ${script}`);
      process.exit(1);
    }
    renameSync(join(outDir, file), join(shotDir, `${name}-${view}-${stop}.png`));
  }
}

if (!args["compare-only"]) {
  for (const name of wanted) {
    take(name, SCENES[name], "off");
    take(name, SCENES[name], args.stop);
  }
}

// THE SHEETS: off, on and their difference, measured.
/* global document, Image, ImageData, OffscreenCanvas, FileReader -- the
   sheet is laid out and measured inside the page. */
const found = await findChromium();
if (!found) process.exit(1);
const browser = await found.chromium.launch({ executablePath: found.executablePath });
const page = await browser.newPage({ viewport: { width: 1600, height: 600 } });
const png = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
for (const name of wanted) {
  for (const view of SCENES[name].views) {
    const off = join(shotDir, `${name}-${view}-off.png`);
    const on = join(shotDir, `${name}-${view}-${args.stop}.png`);
    if (!existsSync(off) || !existsSync(on)) continue;
    await page.setContent(
      `<body style="margin:0;background:#111;color:#eee;font:14px monospace">` +
        `<div id="row" style="display:flex;gap:6px;padding:6px"></div></body>`,
    );
    const stats = await page.evaluate(
      async ([a, b, stop]) => {
        const load = (src) =>
          new Promise((done) => {
            const img = new Image();
            img.onload = () => done(img);
            img.src = src;
          });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        const w = ia.width;
        const h = ia.height;
        const read = (img) => {
          const c = new OffscreenCanvas(w, h);
          const g = c.getContext("2d");
          g.drawImage(img, 0, 0);
          return g.getImageData(0, 0, w, h);
        };
        const da = read(ia);
        const db = read(ib);
        const diff = new ImageData(w, h);
        let sum = 0;
        let darker = 0;
        let lighter = 0;
        for (let i = 0; i < da.data.length; i += 4) {
          let pixel = 0;
          for (let k = 0; k < 3; k++) {
            const d = db.data[i + k] - da.data[i + k];
            sum += Math.abs(d);
            pixel += d;
            diff.data[i + k] = Math.min(255, Math.abs(d) * 8);
          }
          diff.data[i + 3] = 255;
          if (pixel < -6) darker++;
          if (pixel > 6) lighter++;
        }
        const n = w * h;
        const cell = (label, src) => {
          const box = document.createElement("div");
          box.innerHTML = `<div style="padding:2px 0">${label}</div>`;
          const img = new Image();
          img.src = src;
          img.style.width = `${Math.round(w / 2)}px`;
          box.append(img);
          document.getElementById("row").append(box);
        };
        const dc = new OffscreenCanvas(w, h);
        dc.getContext("2d").putImageData(diff, 0, 0);
        const blob = await dc.convertToBlob();
        const url = await new Promise((done) => {
          const r = new FileReader();
          r.onload = () => done(r.result);
          r.readAsDataURL(blob);
        });
        cell("RAYS OFF", a);
        cell(`RAYS ${stop.toUpperCase()}`, b);
        cell("DIFFERENCE ×8", url);
        await new Promise((done) => setTimeout(done, 50));
        return {
          mean: sum / (n * 3),
          darker: darker / n,
          lighter: lighter / n,
        };
      },
      [png(off), png(on), args.stop],
    );
    const out = join(outDir, `rays-${name}-${view}.png`);
    await page.locator("#row").screenshot({ path: out });
    console.log(
      `${out.replace(`${root}/`, "")}  mean |Δ| ${stats.mean.toFixed(2)}, ` +
        `${(stats.darker * 100).toFixed(1)} % darker, ${(stats.lighter * 100).toFixed(1)} % lighter`,
    );
  }
}
await browser.close();

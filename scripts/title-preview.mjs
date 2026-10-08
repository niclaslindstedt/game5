#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TITLE LAB: the title scene (`title-stage.tsx` over the plates in
// `pwa/src/title/`) photographed on the BUILT SITE at fixed title times and
// the reference viewports — the question being whether the scene reads as
// key art: the reveal, the logo on clean sky, the snow, the spindrift, the
// sparkle, the rays and the bloom, and no seam in the parallax at a steep
// edge.
//
// Each frame is the attract card and the scene under it FROZEN at one title
// time (`?splash=1&titleT=<s>`: the scene's clock, the card's reveal and
// every animation on it held at that instant — `url-params.ts`), so two runs
// of one time are one picture and a before/after compares like with like.
// `--menu` adds the front door over the title at each time
// (`?menu=root&titleT=<s>`), framed as the door frames it.
//
//   make title                                   # 0.5, 2, 4, 8, 30 s × three viewports
//   make title ARGS="--times 2,8 --viewport desktop --menu"
//   make title ARGS="--sheet"                    # and a contact sheet of them all
//
// Writes previews/title-<t>-<viewport>.png (and title-menu-…, title-sheet.png).
// Needs a built pwa/dist (`make build` first, every time), a Chromium and
// `npm i --no-save playwright-core`; a software rasterizer draws a frame in
// seconds, so the timeouts are long.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "pwa", "dist");

/** The three reference viewports (§35.2), as `screenshot.mjs` states them. */
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true },
  landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true },
};

const args = parseArgs(
  process.argv.slice(2),
  {
    times: { kind: "string", default: "0.5,2,4,8,30", help: "title times to freeze, s" },
    viewport: {
      kind: "string",
      default: "all",
      help: `${Object.keys(VIEWPORTS).join(", ")} or all`,
    },
    menu: { kind: "flag", help: "the front door over the title at each time too" },
    sheet: { kind: "flag", help: "a contact sheet of every capture (previews/title-sheet.png)" },
    out: { kind: "string", default: join(root, "previews"), help: "where the pictures go" },
    timeout: { kind: "number", default: 240, help: "seconds to wait for a frame" },
  },
  "usage: node scripts/title-preview.mjs [--times a,b] [--viewport v] [--menu] [--sheet] [--out dir] [--timeout s]",
);

const times = String(args.times)
  .split(",")
  .map(Number)
  .filter((t) => Number.isFinite(t) && t >= 0);
const viewports =
  args.viewport === "all" ? Object.keys(VIEWPORTS) : String(args.viewport).split(",");
for (const v of viewports) {
  if (!VIEWPORTS[v]) {
    console.error(`unknown viewport "${v}" (${Object.keys(VIEWPORTS).join(", ")}, all)`);
    process.exit(2);
  }
}
if (!existsSync(join(dist, "index.html"))) {
  console.error(`no built site at ${dist} — run \`make build\` first`);
  process.exit(2);
}
const found = await findChromium();
if (!found) process.exit(2);
mkdirSync(args.out, { recursive: true });
const site = await serveDir(dist);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const ms = args.timeout * 1000;
console.log(`title — t ${times.join(", ")} s, ${viewports.join("+")}, serving ${site.url}`);

const shots = [];
let failures = 0;

/** One frozen frame: the page at a viewport, the scene's first frame drawn
 * and the card (or the door) up, then two more animation frames so the
 * frozen picture is the one on the screen. */
async function capture(label, query, viewport, wait) {
  const page = await browser.newPage(VIEWPORTS[viewport]);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on(
    "console",
    (m) => (m.type() === "error" || m.type() === "warning") && errors.push(m.text()),
  );
  const file = join(args.out, `${label}-${viewport}.png`);
  try {
    await page.goto(`${site.url}?${query}&seed=38&probe=0`, { waitUntil: "load" });
    await page.waitForSelector(".title-canvas[data-drawn], .title-poster", { timeout: ms });
    await page.waitForSelector(wait, { timeout: ms });
    // Two animation frames, asked as page source (it runs in the page).
    await page.evaluate(
      "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))",
    );
    await page.waitForTimeout(400);
    // The stage falls back to the bare plate as a poster on any failure (a
    // shader that will not compile among them) — a picture that would pass
    // for the scene at a glance, so it is a failure here, said out loud.
    if (await page.$(".title-poster")) throw new Error("the scene fell back to its poster");
    await page.screenshot({ path: file, timeout: ms });
    shots.push({ label: `${label} ${viewport}`, file });
    console.log(`  ${file}`);
  } catch (e) {
    failures++;
    console.error(`  FAILED ${file}: ${String(e.message).split("\n")[0]}`);
  }
  for (const e of errors) console.error(`    ${e}`);
  await page.close();
}

for (const viewport of viewports) {
  for (const t of times) {
    await capture(
      `title-${t}`,
      `splash=1&titleT=${t}`,
      viewport,
      ".splash:not([data-phase=loading])",
    );
    if (args.menu)
      await capture(`title-menu-${t}`, `menu=root&titleT=${t}`, viewport, ".menu-card-root");
  }
}

if (args.sheet && shots.length > 0) {
  // The sheet is laid out by the browser: every capture an <img>, captioned.
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
  const cells = shots
    .map(
      (s) =>
        `<figure><img src="data:image/png;base64,${readFileSync(s.file).toString("base64")}"><figcaption>${s.label}</figcaption></figure>`,
    )
    .join("");
  await page.setContent(
    `<style>body{margin:0;background:#0a1726;color:#cfe;font:12px sans-serif;display:grid;gap:8px;padding:8px;
     grid-template-columns:repeat(${times.length * (args.menu ? 2 : 1)},max-content);align-items:start}
     figure{margin:0}img{display:block;height:260px}figcaption{padding:2px 0}</style>${cells}`,
  );
  const file = join(args.out, "title-sheet.png");
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  ${file}`);
  await page.close();
}

await browser.close();
site.close?.();
process.exit(failures > 0 ? 1 : 0);

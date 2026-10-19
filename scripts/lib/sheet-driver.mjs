// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CONTACT-SHEET DRIVER the rescue and the police labs share
// (`scripts/rescue-preview.mjs`, `scripts/police-preview.mjs`): build a
// harness page into a one-off bundle (never part of the app's build), serve
// it, open it in a headless Chromium and, group by group, have the page's
// `window.__<api>.sheet(group, views)` shoot its views, writing every frame
// alone (previews/<out>-<view>-<label>.png) and the group's contact sheet
// (previews/<out>-<group>.png). The page exposes `ready` (a note on what it
// staged), `groups` (each group's views) and `sheet`.

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const list = (s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * Shoot the sheets of the harness page `page` (`pwa/<page>.html`) whose API
 * is `window.__<api>`. `args` carries the shared flags (sheet, views,
 * width, height, out, sheets-only, skip-build, timeout); `query` the page's
 * own search parameters; `title` names the lab on the console.
 */
export async function shootSheets({ root, page, api, args, query, title }) {
  const buildDir = join(root, "previews", `.${page}`);
  const outDir = join(root, "previews");
  mkdirSync(outDir, { recursive: true });
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
        chunkSizeWarningLimit: 2000,
        rollupOptions: { input: join(root, "pwa", `${page}.html`) },
      },
    });
  }
  // The committed models go beside the page, where the renderer fetches them.
  cpSync(join(root, "pwa", "models"), join(buildDir, "models"), { recursive: true });

  const found = await findChromium();
  if (!found) process.exit(1);
  const server = await serveDir(buildDir);
  const browser = await found.chromium.launch({
    executablePath: found.executablePath,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const viewport = { width: args.width, height: args.height };
  const tab = await browser.newPage({ viewport });
  let crashed = null;
  tab.on("pageerror", (err) => {
    crashed ??= err;
    console.error(`[pageerror] ${err.message}`);
  });
  tab.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning")
      console.error(`[console] ${msg.text()}`);
  });
  tab.setDefaultTimeout(args.timeout * 1000);
  /** `work`, or a failure the moment the page throws — never the timeout
   * burnt on a page that died. */
  const guarded = (work) =>
    Promise.race([
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

  await tab.goto(`${server.url}${page}.html?${new URLSearchParams(query).toString()}`);
  await guarded(tab.waitForFunction(`window.__${api} !== undefined`));
  const note = await guarded(tab.evaluate(`window.__${api}.ready`));
  /** @type {Record<string, string[]>} */
  const groups = await tab.evaluate(`window.__${api}.groups`);
  const allViews = Object.values(groups).flat();
  const wantSheets = list(args.sheet);
  const wantViews = list(args.views);
  for (const s of wantSheets) {
    if (!groups[s]) {
      console.error(`unknown sheet "${s}" (${Object.keys(groups).join(", ")})`);
      process.exit(2);
    }
  }
  for (const v of wantViews) {
    if (!allViews.includes(v)) {
      console.error(`unknown view "${v}" (${allViews.join(", ")})`);
      process.exit(2);
    }
  }

  console.log(`${title}: ${note}`);
  const safe = (s) => s.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "");
  for (const [group, views] of Object.entries(groups)) {
    if (wantSheets.length && !wantSheets.includes(group)) continue;
    const shot = wantViews.length ? views.filter((v) => wantViews.includes(v)) : views;
    if (!shot.length) continue;
    const t0 = Date.now();
    const { frames } = await guarded(
      tab.evaluate(([a, g, v]) => globalThis[`__${a}`].sheet(g, v), [api, group, shot]),
    );
    if (!args["sheets-only"]) {
      for (const f of frames) {
        const file = join(outDir, `${args.out}-${safe(f.view)}-${safe(f.label)}.png`);
        writeFileSync(file, Buffer.from(f.png.split(",")[1], "base64"));
      }
    }
    // An element is photographed within the viewport: open it to the sheet.
    const box = await tab.locator("#sheet").boundingBox();
    await tab.setViewportSize({
      width: Math.max(args.width, Math.ceil(box.width)),
      height: Math.ceil(box.y + box.height),
    });
    const out = join(outDir, `${args.out}-${group}.png`);
    await tab.locator("#sheet").screenshot({ path: out });
    await tab.setViewportSize(viewport);
    const suffix = wantViews.length ? ` (${shot.join(", ")})` : "";
    console.log(
      `${out.replace(`${root}/`, "")}  ${frames.length} frames${suffix}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
    );
  }
  await browser.close();
  await server.close();
}

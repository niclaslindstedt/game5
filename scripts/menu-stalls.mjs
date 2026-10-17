#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// MENU STALLS: how long the page's own thread is blocked on each card a
// player walks through on the way onto the snow, on a phone held on its side
// with its processor throttled. Serves pwa/dist (so `make build` first),
// opens a card by its URL, walks NEXT through the cards after it, and on
// each one records every frame's gap for a while after it opens and while a
// finger drags across the stage — the place a stutter is felt — and then
// presses RIDE and times the loading card to the run's first frame.
//
//   node scripts/menu-stalls.mjs [--flow=free,race] [--cpu=4] [--json=FILE]
//
// The `quick` flow presses QUICK START on the front door after `--door`
// seconds there (0: at once) and times the loading card to the run's first
// frame, writing down what the card said along the way (`--shots=DIR` keeps
// a picture of it a second).
//
// A row a card: the time until its stage is ready, the frames longer than
// 50 ms, the longest frame and the blocked time (the sum of every frame's
// gap past 50 ms), first on arriving and then over the drag; the `ride` row's
// ready is the loading card's whole time.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const args = parseArgs(
  process.argv.slice(2),
  {
    flow: { kind: "string", default: "free,race", help: "the flows walked: free, race, quick" },
    cpu: { kind: "number", default: 4, help: "the processor's throttle, × slower" },
    settle: { kind: "number", default: 4, help: "seconds watched on arriving at a card" },
    json: { kind: "string", default: "", help: "write the rows to this file" },
    door: { kind: "number", default: 0, help: "quick: seconds on the front door before the press" },
    shots: { kind: "string", default: "", help: "quick: a picture of the loading card a second" },
    compare: { kind: "string", default: "", help: "a file written by --json: show it beside" },
  },
  "node scripts/menu-stalls.mjs [--flow=free,race] [--cpu=4] [--json=FILE] [--compare=FILE]",
);

const dist = join(process.cwd(), "pwa", "dist");
const found = await findChromium();
if (!found) process.exit(2);
const site = await serveDir(dist);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

/** The flows: a first card by its URL, then the cards NEXT walks to. */
const FLOWS = {
  free: { url: { menu: "start", mode: "free" }, cards: ["start", "rider", "gear"] },
  race: { url: { menu: "levels", mode: "slalom" }, cards: ["levels", "rider", "gear"] },
};

/** Watch the frames from now: every gap between two animation frames. */
const watch = (page) =>
  page.evaluate(() => {
    const w = (globalThis.__gaps = { gaps: [], last: performance.now(), on: true });
    const tick = (now) => {
      if (!w.on) return;
      w.gaps.push(now - w.last);
      w.last = now;
      globalThis.requestAnimationFrame(tick);
    };
    globalThis.requestAnimationFrame(tick);
  });
const stop = (page) =>
  page.evaluate(() => {
    const w = globalThis.__gaps;
    w.on = false;
    // The gap still open (a frame that has not come back) counts too.
    w.gaps.push(performance.now() - w.last);
    return w.gaps;
  });
const sum = (gaps) => {
  const long = gaps.filter((g) => g > 50);
  return {
    long: long.length,
    worst: Math.round(Math.max(0, ...gaps)),
    blocked: Math.round(long.reduce((a, g) => a + g - 16.7, 0)),
  };
};

/** QUICK START off the front door: the loading card timed, and read. */
async function quick(page) {
  await page.goto(`${site.url}?probe=0&menu=root`, { waitUntil: "load" });
  const tile = page.locator('[data-menu="quick"]');
  await tile.waitFor({ timeout: 120000 });
  // A press while the door is still coming in is lost: a second for that.
  await page.waitForTimeout(1000 + args.door * 1000);
  await watch(page);
  const at = Date.now();
  await tile.click();
  const said = [];
  let shot = 0;
  for (;;) {
    const read = await page.evaluate(() => {
      const text = (sel) => globalThis.document.querySelector(sel)?.textContent?.trim() ?? "";
      const fill = globalThis.document.querySelector(".loading-bar-fill");
      return {
        ready: globalThis.__SH_READY__ === true,
        step: text(".loading-step"),
        detail: text(".loading-count"),
        bar: fill ? globalThis.getComputedStyle(fill).transform : "",
      };
    });
    if (read.ready) break;
    const t = Date.now() - at;
    const line = `${read.step} | ${read.detail}`;
    if (said.at(-1)?.line !== line) said.push({ t, line });
    if (args.shots && t >= shot * 1000) {
      await page.screenshot({
        path: join(args.shots, `quick-${String(shot).padStart(2, "0")}.png`),
      });
      shot++;
    }
    if (t > 300000) throw new Error("the load did not finish");
    await page.waitForTimeout(100);
  }
  const ready = Date.now() - at;
  for (const s of said) console.log(`  ${(s.t / 1000).toFixed(1).padStart(6)} s  ${s.line}`);
  return { flow: "quick", card: "ride", ready, arrive: sum(await stop(page)), drag: null };
}

const rows = [];
for (const flow of String(args.flow).split(",")) {
  if (flow === "quick") {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    page.on("pageerror", (e) => console.error(`  pageerror: ${e.message}`));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: args.cpu });
    rows.push(await quick(page));
    await page.close();
    continue;
  }
  const plan = FLOWS[flow];
  const page = await browser.newPage({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  page.on("pageerror", (e) => console.error(`  pageerror: ${e.message}`));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: args.cpu });
  const q = new URLSearchParams({ probe: "0", ...plan.url });
  const t0 = Date.now();
  await page.goto(`${site.url}?${q}`, { waitUntil: "load" });
  for (const [i, card] of plan.cards.entries()) {
    if (i > 0) {
      await watch(page);
      const at = Date.now();
      await page.locator("[data-nav-next]").first().click({ timeout: 180000 });
      const stage = page.locator(".menu-stage[data-ready]");
      await stage.waitFor({ timeout: 60000 });
      const ready = Date.now() - at;
      await page.waitForTimeout(args.settle * 1000);
      const arrive = sum(await stop(page));
      // THE DRAG: a finger across the picture's free left half, there and
      // back, as a skier turns the rider round to look at him.
      await watch(page);
      const y = 220;
      await page.mouse.move(120, y);
      await page.mouse.down();
      for (let k = 0; k < 60; k++) {
        await page.mouse.move(120 + 200 * Math.sin((k / 60) * Math.PI * 2), y);
        await page.waitForTimeout(25);
      }
      await page.mouse.up();
      const drag = sum(await stop(page));
      rows.push({ flow, card, ready, arrive, drag });
      if (card === "gear") {
        // RIDE: the loading card, timed from the press to the run's first
        // frame — what was stood up ahead is what it no longer waits for.
        await watch(page);
        const at = Date.now();
        await page.locator("[data-nav-next]").first().click({ timeout: 180000 });
        await page.waitForFunction(() => globalThis.__SH_READY__ === true, null, {
          timeout: 300000,
          polling: 250,
        });
        rows.push({
          flow,
          card: "ride",
          ready: Date.now() - at,
          arrive: sum(await stop(page)),
          drag: null,
        });
      }
    } else {
      // The first card: its own load, watched for the settle — a chart, a
      // map being raised, and the stage warmed behind it.
      await watch(page);
      await page.locator("[data-nav-next]").first().waitFor({ timeout: 120000 });
      await page.waitForTimeout(args.settle * 1000);
      rows.push({ flow, card, ready: Date.now() - t0, arrive: sum(await stop(page)), drag: null });
      // Long enough for the warm-up behind the card to have been asked for.
      await page.waitForTimeout(8000);
    }
  }
  await page.close();
}
await browser.close();
site.close?.();

const before = args.compare ? JSON.parse(readFileSync(args.compare, "utf8")) : null;
const was = (r) => before?.find((b) => b.flow === r.flow && b.card === r.card);
const cell = (v, b) => (b === undefined ? `${v}` : `${b}→${v}`);
console.log(`menu stalls — 844×390 touch, cpu ×${args.cpu}`);
console.log("flow  card    ready ms   arrive: long/worst/blocked ms   drag: long/worst/blocked ms");
for (const r of rows) {
  const b = was(r);
  const a = r.arrive;
  const d = r.drag;
  console.log(
    [
      r.flow.padEnd(5),
      r.card.padEnd(7),
      cell(r.ready, b?.ready).padStart(10),
      `   ${cell(a.long, b?.arrive.long)} / ${cell(a.worst, b?.arrive.worst)} / ${cell(a.blocked, b?.arrive.blocked)}`.padEnd(
        34,
      ),
      d
        ? `   ${cell(d.long, b?.drag?.long)} / ${cell(d.worst, b?.drag?.worst)} / ${cell(d.blocked, b?.drag?.blocked)}`
        : "   —",
    ].join(" "),
  );
}
if (args.json) writeFileSync(args.json, JSON.stringify(rows, null, 2));

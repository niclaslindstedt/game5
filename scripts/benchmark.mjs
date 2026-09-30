#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DEVELOPER ▸ BENCHMARK, from the command line: the BUILT site (`make build`
// first) opened on `?bench=1` in headless Chromium, the pinned race run to
// its end, and the report COPY DEBUG REPORT would put on the clipboard
// printed here (`window.__SH_BENCH__`, `benchmark-report.ts`).
//
// It is the same run a person starts on a phone from the developer page —
// the same plan, the same pump, the same report — so a score from here and
// one pasted off a device are two readings of one instrument. What differs
// is the machine: headless Chromium draws through a SOFTWARE rasteriser
// (SwiftShader) unless `--gpu` asks for the host's own, so a score from here
// is a statement about this build's CPU cost and a regression's shape, and
// never a figure to hold a phone to.
//
// ON THE HOST'S GPU the report carries the card's own timer, pass by pass
// (`gpu-timer.ts`); `--split` cuts the scene's pass by subsystem as well, and
// `--hide` draws the race WITHOUT some subsystems. `--ab` hides each
// subsystem a frame in turn inside the one run and bills what each one cost
// the card as the difference — the reading a tiled GPU's split cannot give,
// and immune to the machine drifting between two runs.

import process from "node:process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(
  process.argv.slice(2),
  {
    width: { kind: "number", default: 1280, help: "viewport width, CSS px" },
    height: { kind: "number", default: 720, help: "viewport height, CSS px" },
    video: { kind: "string", help: "picture preset for the visit (low, medium, high)" },
    gpu: { kind: "flag", help: "draw on the host's GPU rather than SwiftShader" },
    split: { kind: "flag", help: "cut the GPU timer's scene pass by subsystem too" },
    hide: { kind: "string", help: "draw without these subsystems, comma-separated (HIDEABLE)" },
    ab: { kind: "flag", help: "hide each subsystem a frame in turn and time each on the GPU" },
    picture: {
      kind: "string",
      help: "picture rows over the preset, row:stop by commas (?picture=)",
    },
    costs: {
      kind: "flag",
      help: "price every stop of every picture row against the top picture (writes previews/picture-costs.json)",
    },
    reprice: {
      kind: "flag",
      help: "print the cost table from the last --costs run's JSON, running nothing",
    },
    timeout: { kind: "number", default: 3600, help: "seconds to wait for the run to finish" },
    out: { kind: "string", default: "previews/benchmark.txt", help: "where the report is written" },
    dist: {
      kind: "string",
      default: "pwa/dist",
      help: "the built site to run (a second build, for A-against-B)",
    },
  },
  "make bench [ARGS=...] — run DEVELOPER ▸ BENCHMARK on the built site and print its report",
);

if (args.reprice) {
  const priced = JSON.parse(readFileSync(join(root, "previews", "picture-costs.json"), "utf8"));
  console.log(costTable(await ladders(), priced));
  process.exit(0);
}

const dist = join(root, args.dist);
if (!existsSync(join(dist, "index.html"))) {
  console.error(`no built site at ${dist} — run \`make build\` first`);
  process.exit(2);
}
const found = await findChromium();
if (!found) process.exit(2);

const site = await serveDir(dist);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: args.gpu
    ? ["--enable-gpu", "--ignore-gpu-blocklist"]
    : ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

/** One whole benchmark in a fresh page, drawn without `hide`; its report. */
async function run(hide, picture = args.picture, extra = {}) {
  const page = await browser.newPage({ viewport: { width: args.width, height: args.height } });
  page.on("pageerror", (err) => console.error(`pageerror: ${err.message}`));
  const query = new URLSearchParams({ bench: "1", splash: "0", probe: "0" });
  if (args.video) query.set("video", args.video);
  if (args.split) query.set("gpu", "split");
  if (args.ab) query.set("ab", "1");
  if (hide) query.set("hide", hide);
  if (picture) query.set("picture", picture);
  for (const [key, value] of Object.entries(extra)) query.set(key, value);
  const url = `${site.url}?${query}`;
  if (!args.costs) {
    console.log(`benchmark — ${url} at ${args.width}×${args.height}${args.gpu ? " (gpu)" : ""}`);
  }
  try {
    await page.goto(url);
    await page.waitForFunction(() => typeof globalThis.__SH_BENCH__ === "string", null, {
      timeout: args.timeout * 1000,
      polling: 1000,
    });
    return await page.evaluate(() => globalThis.__SH_BENCH__);
  } catch (e) {
    console.error(`the benchmark did not finish: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  } finally {
    await page.close();
  }
}

/** The picture rows and their ladders, cheapest first — `PICTURE_LADDERS`
 * in `settings-video.ts`, which a script on plain Node reads through the
 * alias rather than restating. */
async function ladders() {
  const { aliasEngine } = await import("@niclaslindstedt/oss-game-framework/tooling/alias");
  aliasEngine(root);
  return (await import("../pwa/src/game/settings-video.ts")).PICTURE_LADDERS;
}

/** The frame end to end and the card's own, ms, off a report. */
function times(report) {
  const wall = /^\s+wall\s+([\d.]+) ms/m.exec(report ?? "");
  const card = /^\s+card\s+([\d.]+) ms/m.exec(report ?? "");
  return { wall: wall ? Number(wall[1]) : NaN, card: card ? Number(card[1]) : NaN };
}

/** THE PRICE LIST — what every stop of every picture row costs, for
 * `picture-fit.ts`. Each stop is run with the other rows at the top, a
 * short stretch (`?frames=`), three times, the top picture run beside it
 * each time; its price is its frame as a SHARE of the top picture's read
 * around it, so a machine warming up and slowing through the list (a
 * laptop does, over half an hour) scales both and the share survives. And
 * from TWO VIEWS: the race's own, and the VISTA across the whole basin —
 * DISTANCE is nearly free in the woods and dear from a hilltop, and a
 * picture has to hold on its dearest view. */
async function priceList() {
  const all = await ladders();
  const top = Object.fromEntries(Object.entries(all).map(([row, l]) => [row, l[l.length - 1]]));
  const pic = (over) =>
    Object.entries({ ...top, ...over })
      .map(([row, stop]) => `${row}:${stop}`)
      .join(",");
  const FRAMES = 600;
  const ROUNDS = 3;
  const bench = async (view, over) => {
    const extra = { frames: String(FRAMES) };
    if (view === "vista") extra.view = "vista";
    return times(await run("", pic(over), extra));
  };
  const views = {};
  for (const view of ["race", "vista"]) {
    const rows = {};
    const topRuns = [];
    // Each stop's last top run is the next stop's first.
    let before = await bench(view, {});
    topRuns.push(before);
    for (const [row, ladder] of Object.entries(all)) {
      rows[row] = {};
      for (const stop of ladder.slice(0, -1)) {
        const shares = { wall: [], card: [] };
        for (let r = 0; r < ROUNDS; r++) {
          const t = await bench(view, { [row]: stop });
          const after = await bench(view, {});
          topRuns.push(after);
          for (const k of ["wall", "card"]) shares[k].push(t[k] / ((before[k] + after[k]) / 2));
          before = after;
        }
        const mid = (v) => [...v].sort((a, b) => a - b)[v.length >> 1];
        rows[row][stop] = { wall: mid(shares.wall), card: mid(shares.card) };
        console.log(
          `  ${view.padEnd(6)} ${`${row} ${stop}`.padEnd(20)} ${(rows[row][stop].wall * 100).toFixed(1)}% of the top frame  (card ${(rows[row][stop].card * 100).toFixed(1)}%)`,
        );
      }
    }
    const low = Object.fromEntries(Object.entries(all).map(([row, l]) => [row, l[0]]));
    const floor = await bench(view, low);
    const after = await bench(view, {});
    topRuns.push(after);
    const floorShare = {
      wall: floor.wall / ((before.wall + after.wall) / 2),
      card: floor.card / ((before.card + after.card) / 2),
    };
    const topWall = topRuns.map((t) => t.wall).sort((a, b) => a - b)[topRuns.length >> 1];
    const topCard = topRuns.map((t) => t.card).sort((a, b) => a - b)[topRuns.length >> 1];
    views[view] = {
      top: { wall: topWall, card: topCard },
      floor: floorShare,
      rows,
    };
  }
  const lines = [
    `PICTURE PRICE LIST — ${args.width}×${args.height}, the benchmark race, ${FRAMES}-frame runs`,
    "  each stop's frame as a share of the top picture's around it, from the race's view and the vista",
    "  row          stop       race    vista",
  ];
  for (const [row, ladder] of Object.entries(all)) {
    for (const stop of ladder.slice(0, -1)) {
      const r = views.race.rows[row][stop].wall;
      const v = views.vista.rows[row][stop].wall;
      lines.push(
        `  ${row.padEnd(12)} ${stop.padEnd(8)} ${(r * 100).toFixed(1).padStart(6)}% ${(v * 100).toFixed(1).padStart(6)}%`,
      );
    }
  }
  for (const view of ["race", "vista"]) {
    lines.push(
      `  top picture, ${view}: wall ${views[view].top.wall.toFixed(2)} ms  card ${views[view].top.card.toFixed(3)} ms; ` +
        `every row at its cheapest: ${(views[view].floor.wall * 100).toFixed(1)}%`,
    );
  }
  const json = join(root, "previews", "picture-costs.json");
  const priced = { width: args.width, height: args.height, frames: FRAMES, views };
  writeFileSync(json, JSON.stringify(priced, null, 2));
  lines.push("  (the numbers: previews/picture-costs.json)", "", costTable(all, priced));
  return lines.join("\n");
}

/** THE TABLE `PICTURE_PRICES` takes: each stop's ms over its row's cheapest,
 * off the view where it is dearest — the share of the top frame it saves
 * there, times that view's top frame — levelled so no stop is priced under
 * the one below it (that is noise, not a stop paying for itself). */
function costTable(all, priced) {
  const views = Object.values(priced.views);
  const out = ["COSTS FOR picture-fit.ts, ms over each row's cheapest stop (the dearer view's)"];
  let floor = Infinity;
  for (const v of views) floor = Math.min(floor, v.floor.wall * v.top.wall);
  out.push(`  FLOOR_MS = ${floor.toFixed(2)}`);
  for (const [row, ladder] of Object.entries(all)) {
    const saved = (v, stop) =>
      stop === ladder[ladder.length - 1] ? 0 : (1 - v.rows[row][stop].wall) * v.top.wall;
    let last = 0;
    const cells = ladder.map((stop, i) => {
      const cost =
        i === 0 ? 0 : Math.max(...views.map((v) => saved(v, ladder[0]) - saved(v, stop)));
      last = Math.max(last, cost);
      return `${stop} ${last.toFixed(2)}`;
    });
    out.push(`  ${row.padEnd(12)} ${cells.join("  ")}`);
  }
  return out.join("\n");
}

const text = args.costs ? await priceList() : await run(args.hide ?? "");
await browser.close();
site.close();
if (text === null) process.exit(1);

console.log(text);
const out = join(root, args.out);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${text}\n`);
console.log(`\nwrote ${args.out}`);

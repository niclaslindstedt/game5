#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SCREENSHOTS of the real build: serves pwa/dist, opens the app in headless
// Chromium, waits for the app to say the frame is ready, and captures it at
// the three reference viewports (§35.2) — desktop landscape 1280×720, phone
// portrait 390×844 and phone LANDSCAPE 844×390, the phones at 2× and with a
// TOUCHSCREEN — into the gitignored previews/. The third is the one the game
// is actually held at, and the only one that reaches the short-landscape
// rules, so a layout judged on the other two has not been judged where it is
// played.
//
// THE CONTRACT WITH THE APP (pwa/src/game/url-params.ts):
//   ?start=race&seed=<n>&t=<s>&shot=1
//     a race on the map built off `seed`, `t` seconds of it already ridden
//     by the bot, held still once drawn so nothing moves under the shutter.
//   ?paused=1        ...held under the pause card instead.
//   ?camera=<rung>   the run's camera: tips, helmet, chase, far, high.
//   ?mode=trial      the run is a TIME TRIAL rather than a race (--trial).
//   ?mode=tricks     ...or a TRICKS run on the seed's trick field (--tricks).
//   ?splash=1 / ?menu=root   the attract card / the front door;
//   ?menu=options|keys       OPTIONS, and its KEYS page.
//   ?menu=skis[&skis=id]     the ski card RACE opens, on a pair.
//   ?menu=start      the free ride's start card (its chart built in a worker).
//   ?start=free      a FREE RIDE on the start card's stored map and day.
//   ?video=<tier>    ride at a picture preset (low, medium, high) this visit.
//   ?weather=<kind>  the map under another sky (clear, fair, high, overcast,
//                    snow, fog), and ?hour=<h> from another start hour.
//   ?region=<id>     the seed's map built in another kind of snow country
//   ?grade=<id>      the seed's piste built to a grade (--grade, R23)
//                    (R21: alpine, fell, continental, maritime).
//   ?probe=0         always sent: the first-visit probe must not move the
//                    picture under the shutter.
//   ?update=1        the new-build button, as if a build were waiting.
//   window.__SH_READY__ === true
//     set by the app once a race's frame has been drawn. This tool waits for
//     it (30 s, then a clear error).
//
//   node scripts/screenshot.mjs                          # the race at 10 s
//   node scripts/screenshot.mjs --scene grid             # on the lights
//   node scripts/screenshot.mjs --surface all            # every card
//   node scripts/screenshot.mjs --surface menu,loading --viewport phone
//   node scripts/screenshot.mjs --scene race --camera tips --seed 7
//   node scripts/screenshot.mjs --weather all --viewport desktop   # every sky
//   node scripts/screenshot.mjs --weather snow --hour 21            # a night fall
//
// Needs a built pwa/dist (`npm run build` — first, every time: a stale dist
// photographs the last change), a Chromium and a driver (scripts/lib/
// chromium.mjs says where both are looked for).

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { findChromium } from "@niclaslindstedt/oss-game-framework/tooling/chromium";
import { parseArgs } from "@niclaslindstedt/oss-game-framework/tooling/cli";
import { serveDir } from "@niclaslindstedt/oss-game-framework/tooling/serve-dist";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "pwa", "dist");
const outDir = join(root, "previews");

/** Every sky R19 deals, for `--weather all` (`WEATHER_KINDS`). */
const WEATHERS = ["clear", "fair", "flurries", "high", "overcast", "snow", "storm", "fog"];

/** THE STAGED MOMENTS of a race, as seconds into it — the whole of what a
 * scene is here, since the race itself is the scenario. */
const SCENES = {
  /** On the grid, the lights on. */
  grid: 0.5,
  /** GO just gone. */
  go: 3.4,
  /** Racing, the field strung out. */
  race: 12,
  /** Well down the mountain. */
  late: 60,
};

/** THE CARDS, and how to photograph each one. A card is not a race's frame,
 * so these do not wait on `__SH_READY__` — what says a card is up is the
 * card being in the DOM. `settle` is the beat after it the card's arrival
 * animation needs. `press` is a button pressed on the way in, for the one
 * surface reached by a press rather than by a URL; `prime` is a race stood
 * up and a key pressed on it FIRST, in the same tab, for a card that shows
 * what a run left behind (the gallery's roll). */
const SURFACES = {
  // The title and the invitation, which wait for the first map to be built.
  splash: { params: { splash: "1" }, wait: ".splash-prompt", settle: 900 },
  menu: { params: { menu: "root" }, wait: ".menu-card-root", settle: 1200 },
  // The loading card is up for as long as a map takes to build and no
  // longer, so it is photographed on the first frame it is in the DOM.
  loading: {
    params: { menu: "skis" },
    press: ".skis-done",
    pressAfter: 1500,
    wait: ".loading-card",
    settle: 60,
  },
  pause: { params: { paused: "1", t: "14" }, wait: ".menu-card-pause", settle: 700 },
  // THE CAMPAIGN CARD and the LEVEL CARD a RACE picks its pinned map on,
  // straight off the URL (`?menu=campaign|levels`).
  campaign: { params: { menu: "campaign" }, wait: ".menu-card-campaign", settle: 900 },
  levels: { params: { menu: "levels" }, wait: ".menu-card-levels", settle: 900 },
  // THE TRICK MAP CARD a TRICKS run picks its map on (`?menu=tricks`).
  tricks: { params: { menu: "tricks", mode: "tricks" }, wait: ".menu-card-levels", settle: 900 },
  // OPTIONS and its KEYS page, straight off the URL (`?menu=options|keys`).
  options: { params: { menu: "options" }, wait: ".menu-card-options", settle: 900 },
  keys: { params: { menu: "keys" }, wait: ".menu-card-keys", settle: 900 },
  // THE DEVELOPER PAGE (`?menu=dev` lets it out, as the title's hold does)
  // and the two pages behind it.
  dev: { params: { menu: "dev" }, wait: ".menu-card-options", settle: 900 },
  unlocks: { params: { menu: "unlocks" }, wait: ".dev-locks", settle: 900 },
  // The list itself is empty on a fresh visit (and an empty box is "hidden"
  // to a wait), so the line over it says the card is up.
  "bench-history": { params: { menu: "benchHistory" }, wait: ".dev-line", settle: 900 },
  // THE SKI CARD, straight off the URL; the rack is its own chunk and
  // builds the pair on its first frame, so it is given a moment.
  skis: { params: { menu: "skis" }, wait: ".skis-pick-canvas", settle: 1800 },
  "skis-powder": {
    params: { menu: "skis", skis: "marmot" },
    wait: ".skis-pick-canvas",
    settle: 1800,
  },
  // THE FREE RIDE'S START CARD: waited on until its chart — a whole map
  // generated in a worker — has landed on it.
  start: { params: { menu: "start" }, wait: ".seed-preview-map image", settle: 700 },
  // ...and the free ride itself, twenty seconds in, held still: the HUD's
  // best air and distance where the race's place and laps would be.
  free: {
    params: { start: "free", t: "20", shot: "1" },
    wait: ".hud-best-air",
    settle: 1500,
  },
  // THE GALLERY as a fresh visit finds it: the roll lives in IndexedDB and a
  // new browser context has none, so what this photographs is the empty
  // state — which is the surface most players see first.
  gallery: { params: { menu: "gallery" }, wait: ".menu-card-gallery", settle: 700 },
  // ...and with a picture in it: a race ridden fourteen seconds, ENTER pressed
  // (the whole shutter — the grab, the HUD layer, the stamp, the encode, the
  // roll), and the gallery opened in the same tab, so the store is the one
  // the picture was filed in.
  "gallery-roll": {
    prime: { params: { start: "race", t: "14", shot: "1" }, key: "Enter" },
    params: { menu: "gallery" },
    wait: ".gallery-img",
    settle: 900,
  },
};

/** The reference viewports — and the phone is a TOUCHSCREEN, not a narrow
 * desktop window: the HUD's thumb zones and the splash's TAP ask the device
 * what it is. */
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true },
  landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true },
};

const args = parseArgs(
  process.argv.slice(2),
  {
    scene: {
      kind: "string",
      default: "race",
      help: `which moment of a race (${Object.keys(SCENES).join(", ")}, all)`,
    },
    surface: {
      kind: "string",
      help: `a card instead of a race (${Object.keys(SURFACES).join(", ")}, all)`,
    },
    seed: { kind: "number", default: 38, help: "map seed" },
    t: { kind: "number", help: "seconds into the race (overrides the scene's own)" },
    camera: { kind: "string", help: "tips, helmet, chase, far, high" },
    video: { kind: "string", help: "picture preset for the visit (low, medium, high)" },
    update: { kind: "flag", help: "draw the new-build button (?update=1)" },
    weather: { kind: "string", help: `ride under this sky (${WEATHERS.join(", ")}, all)` },
    region: {
      kind: "string",
      help: "build the seed's map in this kind of snow country (alpine, fell, continental, maritime)",
    },
    grade: {
      kind: "string",
      help: "build the seed's piste to this grade (green, blue, red, black)",
    },
    hour: { kind: "number", help: "the race's solar start hour, 0–24" },
    trial: { kind: "flag", help: "a time trial rather than a race (?mode=trial)" },
    tricks: { kind: "flag", help: "a tricks run on the trick field (?mode=tricks)" },
    viewport: {
      kind: "string",
      default: "all",
      help: `${Object.keys(VIEWPORTS).join(", ")} or all`,
    },
    timeout: { kind: "number", default: 45, help: "seconds to wait for the frame" },
  },
  "usage: node scripts/screenshot.mjs [--scene name | --surface name] [--seed n] [--t s] " +
    "[--camera rung] [--video tier] [--weather kind] [--hour h] [--region id] [--grade id] [--update] [--trial] [--tricks] [--viewport v] [--timeout s]",
);
const viewports =
  args.viewport === "all" ? Object.keys(VIEWPORTS) : String(args.viewport).split(",");
for (const v of viewports) {
  if (!VIEWPORTS[v]) {
    console.error(`unknown viewport "${v}" (${Object.keys(VIEWPORTS).join(", ")}, all)`);
    process.exit(2);
  }
}
if (!existsSync(join(dist, "index.html"))) {
  console.error(`no built site at ${dist} — run \`npm run build\` first`);
  process.exit(2);
}
const found = await findChromium();
if (!found) process.exit(2);

mkdirSync(outDir, { recursive: true });
const site = await serveDir(dist);
const browser = await found.chromium.launch({
  executablePath: found.executablePath,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
console.log(
  `screenshots — seed ${args.seed}, ${viewports.join("+")}, serving ${dist} at ${site.url}`,
);

let failures = 0;

/** One capture: a page at a viewport, the URL the contract names, the wait,
 * the file. Console errors and page errors are printed under the file name:
 * a screenshot of a frame the app threw on is a screenshot of the wrong
 * thing. */
async function capture(name, params, viewportName, surface) {
  const page = await browser.newPage({ ...VIEWPORTS[viewportName] });
  const problems = [];
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      problems.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  const url = `${site.url}?${new URLSearchParams(params)}`;
  const file = join(outDir, `shot-${name}-${viewportName}.png`);
  try {
    if (surface?.prime) {
      // A surface that needs something done in the game first: a race stood
      // up, a key pressed on it, and the receipt waited for.
      const base = Object.fromEntries(Object.entries(params).filter(([k]) => k !== "menu"));
      const primed = new URLSearchParams({ ...base, ...surface.prime.params });
      await page.goto(`${site.url}?${primed}`, { waitUntil: "load" });
      await page.waitForFunction("window.__SH_READY__ === true", null, {
        timeout: args.timeout * 1000,
      });
      await page.keyboard.press(surface.prime.key);
      // The receipt says the picture is in the roll (or that it failed).
      await page.waitForFunction(
        "[...document.querySelectorAll('.hud-flash')].some((f) => /PICTURE/.test(f.textContent))",
        null,
        { timeout: args.timeout * 1000 },
      );
    }
    await page.goto(url, { waitUntil: "load" });
    if (surface) {
      if (surface.press) {
        await page.waitForSelector(surface.press, { timeout: args.timeout * 1000 });
        await page.waitForTimeout(surface.pressAfter ?? 0);
        // Through the DOM rather than `.click()`: a card Preact re-renders
        // every tick never settles for the actionability check.
        await page.evaluate(
          (sel) => globalThis.document.querySelector(sel)?.click(),
          surface.press,
        );
      }
      await page.waitForSelector(surface.wait, { timeout: args.timeout * 1000 });
      await page.waitForTimeout(surface.settle);
    } else {
      await page.waitForFunction("window.__SH_READY__ === true", null, {
        timeout: args.timeout * 1000,
      });
      // The minimap's ground is baked in a worker and can land after the
      // frame does — the race is frozen at its moment, so waiting for it
      // costs the picture nothing. A HUD with no plate does not wait.
      await page
        .waitForFunction(
          "!document.querySelector('.hud-minimap') || !!document.querySelector('.hud-minimap image')",
          null,
          { timeout: 15_000 },
        )
        .catch(() => problems.push("the minimap's ground had not landed"));
      // One more beat for the HUD's first snapshot to be drawn.
      await page.waitForTimeout(250);
    }
    // The same patience as the waits: a card over a software-rendered race at
    // twice the pixels can take longer than the default to hand a frame over.
    await page.screenshot({ path: file, timeout: args.timeout * 1000 });
    console.log(`previews/shot-${name}-${viewportName}.png  ← ${url}`);
  } catch (err) {
    failures += 1;
    const ready = await page.evaluate("window.__SH_READY__").catch(() => undefined);
    console.error(
      `!! ${name} (${viewportName}): ${err.message.split("\n")[0]}` +
        (surface
          ? ` — no "${surface.wait}" after ${args.timeout} s (${url})`
          : ` — window.__SH_READY__ is ${String(ready)} after ${args.timeout} s (${url})`),
    );
  }
  for (const p of problems) console.log(`   ${p}`);
  await page.close();
}

if (args.surface) {
  const names = args.surface === "all" ? Object.keys(SURFACES) : String(args.surface).split(",");
  for (const name of names) {
    const surface = SURFACES[name];
    if (!surface) {
      console.error(`unknown surface "${name}" (${Object.keys(SURFACES).join(", ")}, all)`);
      failures += 1;
      continue;
    }
    const params = { seed: String(args.seed), probe: "0", ...surface.params };
    if (args.region !== undefined) params.region = String(args.region);
    if (args.grade !== undefined) params.grade = String(args.grade);
    if (args.video !== undefined) params.video = String(args.video);
    if (args.update) params.update = "1";
    if (args.camera !== undefined) params.camera = String(args.camera);
    for (const v of viewports)
      await capture(
        `${name}${args.region !== undefined ? `-${args.region}` : ""}` +
          `${args.grade !== undefined ? `-${args.grade}` : ""}${args.update ? "-update" : ""}`,
        params,
        v,
        surface,
      );
  }
} else {
  const scenes = args.scene === "all" ? Object.keys(SCENES) : String(args.scene).split(",");
  const skies =
    args.weather === "all"
      ? WEATHERS
      : args.weather === undefined
        ? [undefined]
        : String(args.weather).split(",");
  for (const sky of skies) {
    if (sky !== undefined && !WEATHERS.includes(sky)) {
      console.error(`unknown weather "${sky}" (${WEATHERS.join(", ")}, all)`);
      process.exit(2);
    }
  }
  for (const scene of scenes)
    for (const sky of skies) {
      if (!(scene in SCENES)) {
        console.error(`unknown scene "${scene}" (${Object.keys(SCENES).join(", ")}, all)`);
        failures += 1;
        continue;
      }
      const params = {
        start: "race",
        seed: String(args.seed),
        t: String(args.t ?? SCENES[scene]),
        shot: "1",
      };
      if (args.camera !== undefined) params.camera = String(args.camera);
      if (args.video !== undefined) params.video = String(args.video);
      if (args.update) params.update = "1";
      if (sky !== undefined) params.weather = sky;
      if (args.hour !== undefined) params.hour = String(args.hour);
      if (args.region !== undefined) params.region = String(args.region);
      if (args.grade !== undefined) params.grade = String(args.grade);
      if (args.trial) params.mode = "trial";
      if (args.tricks) params.mode = "tricks";
      const name =
        `${scene}${args.trial ? "-trial" : ""}${args.tricks ? "-tricks" : ""}${sky !== undefined ? `-${sky}` : ""}` +
        `${args.hour !== undefined ? `-h${args.hour}` : ""}` +
        `${args.region !== undefined ? `-${args.region}` : ""}` +
        `${args.grade !== undefined ? `-${args.grade}` : ""}` +
        `${args.t !== undefined ? `-t${args.t}` : ""}` +
        `${args.camera !== undefined ? `-${args.camera}` : ""}` +
        `${args.video !== undefined ? `-${args.video}` : ""}${args.update ? "-update" : ""}`;
      for (const v of viewports) await capture(name, params, v);
    }
}

await browser.close();
await site.close();
if (failures > 0) {
  console.error(`\n${failures} capture(s) failed`);
  process.exit(1);
}

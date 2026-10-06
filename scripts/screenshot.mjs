#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SCREENSHOTS of the real build: serves pwa/dist, opens the app in headless
// Chromium, waits for the app to say the frame is ready, and captures it at
// the three reference viewports (§35.2) — desktop landscape 1280×720, phone
// portrait 390×844 and phone LANDSCAPE 844×390, the phones at 2× and with a
// TOUCHSCREEN — into the gitignored previews/. The third is the one the game
// is actually held at, and the only one that reaches the short-landscape
// rules, so a layout judged on the other two has not been judged where it is
// played. Two more hold a current notched phone on its side as it really is
// (`iphone`, 852×393, its notch and home-bar insets emulated, and
// `iphone-browser`, the same under a browser's bar along the top) — the
// shape a card has to fit without scrolling anything but a list. Every
// capture of a card says what scrolls: a card scrolling WHOLE is a fault, a
// page's body scrolling under its head is a list doing its job.
//
// THE CONTRACT WITH THE APP (pwa/src/game/url-params.ts):
//   ?start=race&seed=<n>&t=<s>&shot=1
//     a race on the map built off `seed`, `t` seconds of it already ridden
//     by the bot, held still once drawn so nothing moves under the shutter.
//   ?paused=1        ...held under the pause card instead.
//   ?camera=<rung>   the run's camera: tips, helmet, chase, far, high.
//   ?mode=trial      the run is a TIME TRIAL rather than a race (--trial).
//   ?mode=tricks     ...or a TRICKS run on the seed's trick field (--tricks).
//   ?mode=downhill   ...or a DOWNHILL's training run (--downhill; with
//                    --run2 its race).
//   ?mode=superg     ...or a SUPER-G's one run (--superg).
//   ?mode=gs         ...or a GIANT SLALOM's first run (--gs; with --run2
//                    its second).
//   ?mode=skicross   ...or a SKI CROSS's qualification (--skicross; with
//                    --run2 its first heat, four out of the start gate).
//   ?mode=speedski   ...or a SPEED RACE's qualification (--speedski; with
//                    --run2 its final).
//   ?mode=bigair     ...or a BIG AIR contest's first jump (--bigair; with
//                    --run2 its second).
//   ?mode=knuckle    ...or a KNUCKLE HUCK's jam on its knuckle (--knuckle).
//   ?mode=slopestyle ...or a SLOPESTYLE contest's first run (--slopestyle;
//                    with --run2 its second).
//   ?mode=railjam    ...or a RAIL JAM on its set (--railjam).
//   ?mode=halfpipe   ...or a HALFPIPE contest's first run (--halfpipe).
//   ?skis=<id>       the player's pair for the run (--skis).
//   ?heli=1          a free ride begun on the helicopter (--surface heli*).
//   ?sled=1          a free ride begun on the snowmobile (--surface sled*).
//   ?afterski=1      a free ride begun inside the valley's afterski lodge
//                    (--surface afterski).
//   ?buzz=<0..1>     a free ride begun with a buzz (--surface buzzed).
//   ?run=2           a slalom's SECOND RUN, the first skied by the bot (--run2).
//   ?splash=1 / ?menu=root   the attract card / the front door;
//   ?menu=options|keys       OPTIONS, and its KEYS page.
//   ?menu=skis[&skis=id]     the ski card RACE opens, on a pair.
//   ?menu=dress      the DRESS card behind the ski card's CUSTOMIZE SKIER.
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
//   ?pose=x,z,h,v    the player's skis stood there once the pre-roll is
//                    ridden (--pose: plan metres, heading rad, speed m/s —
//                    the REPRO line's, or the cloud lab's meadow).
//   ?hold=<kmh>,<move>,<s>  ...and ridden on HELD at that speed in a move
//                    (--hold, a capture a speed; --move, --hold-for): the
//                    game's own frame of what a speed looks like — the
//                    snow cloud it raises, the skier at it.
//   window.__SH_READY__ === true
//     set by the app once a race's frame has been drawn. This tool waits for
//     it (30 s, then a clear error).
//
//   node scripts/screenshot.mjs                          # the race at 10 s
//   node scripts/screenshot.mjs --scene grid             # on the lights
//   node scripts/screenshot.mjs --surface all            # every card
//   node scripts/screenshot.mjs --pose 1884,1036,0,5 --hold 15,40,70 --move check  # the cloud at speeds
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
  // ...and the one a DOWNHILL picks its black on (`?menu=levels&mode=downhill`).
  "downhill-levels": {
    params: { menu: "levels", mode: "downhill" },
    wait: ".menu-card-levels",
    settle: 900,
  },
  // ...the SUPER-G's nine (`?menu=levels&mode=superg`), and THE RACE CARD
  // the front door's RACE tile opens (`?menu=races`).
  "superg-levels": {
    params: { menu: "levels", mode: "superg" },
    wait: ".menu-card-levels",
    settle: 900,
  },
  // ...the GIANT SLALOM's nine (`?menu=levels&mode=gs`).
  "gs-levels": {
    params: { menu: "levels", mode: "gs" },
    wait: ".menu-card-levels",
    settle: 900,
  },
  // ...the SKI CROSS's nine (`?menu=levels&mode=skicross`).
  "skicross-levels": {
    params: { menu: "levels", mode: "skicross" },
    wait: ".menu-card-levels",
    settle: 900,
  },
  // ...THE TRICKS CARD the front door's TRICKS tile opens
  // (`?menu=freestyle`), and the trick map card a big air contest is picked
  // on (`?menu=tricks&mode=bigair`).
  freestyle: { params: { menu: "freestyle" }, wait: ".menu-card-races", settle: 900 },
  "bigair-maps": {
    params: { menu: "tricks", mode: "bigair" },
    wait: ".menu-card-levels",
    settle: 900,
  },
  // ...a halfpipe contest's (`?menu=tricks&mode=halfpipe`).
  "halfpipe-maps": {
    params: { menu: "tricks", mode: "halfpipe" },
    wait: ".menu-card-levels",
    settle: 900,
  },
  // ...a rail jam's (`?menu=tricks&mode=railjam`).
  "railjam-maps": {
    params: { menu: "tricks", mode: "railjam" },
    wait: ".menu-card-levels",
    settle: 900,
  },
  // ...a slopestyle contest's (`?menu=tricks&mode=slopestyle`).
  "slopestyle-maps": {
    params: { menu: "tricks", mode: "slopestyle" },
    wait: ".menu-card-levels",
    settle: 900,
  },
  // ...and a knuckle huck's (`?menu=tricks&mode=knuckle`).
  "knuckle-maps": {
    params: { menu: "tricks", mode: "knuckle" },
    wait: ".menu-card-levels",
    settle: 900,
  },
  // ...SPEED SKIING's nine (`?menu=levels&mode=speedski`).
  "speedski-levels": {
    params: { menu: "levels", mode: "speedski" },
    wait: ".menu-card-levels",
    settle: 900,
  },
  races: { params: { menu: "races" }, wait: ".menu-card-races", settle: 900 },
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
  // ...and on the super-G pair, the one SPEED CARVE fills.
  "skis-superg": {
    params: { menu: "skis", skis: "falcon" },
    wait: ".skis-pick-canvas",
    settle: 1800,
  },
  // ...and on the ski-cross pair, the one BERM fills.
  "skis-cross": {
    params: { menu: "skis", skis: "wolverine" },
    wait: ".skis-pick-canvas",
    settle: 1800,
  },
  // ...and on the speed ski, the one TOP SPEED fills.
  "skis-speed": {
    params: { menu: "skis", skis: "peregrine" },
    wait: ".skis-pick-canvas",
    settle: 1800,
  },
  // THE DRESS CARD: the skier on the same stand, framed on him.
  dress: { params: { menu: "dress" }, wait: ".dress-stage canvas", settle: 1800 },
  // THE FREE RIDE'S START CARD: waited on until its chart — a whole map
  // generated in a worker — has landed on it.
  start: { params: { menu: "start" }, wait: ".seed-preview-map image", settle: 700 },
  // ...and the free ride itself, twenty seconds in, held still: no run's
  // figures over it — the map's seed alone at the top left.
  free: {
    params: { start: "free", t: "20", shot: "1" },
    wait: ".hud-seed",
    settle: 1500,
  },
  // THE FREE RIDE'S ARRIVAL BY LIFT (`lift-ride.ts`): seated on the chair
  // for its last few seconds (`lift.arrive`), at the top station, and led
  // off the pad.
  "free-chair": {
    params: { start: "free", t: "1", shot: "1" },
    wait: ".hud-seed",
    settle: 1500,
  },
  "free-top": {
    params: { start: "free", t: "3", shot: "1" },
    wait: ".hud-seed",
    settle: 1500,
  },
  "free-off": {
    params: { start: "free", t: "8", shot: "1" },
    wait: ".hud-seed",
    settle: 1500,
  },
  // THE FREE RIDE'S HELICOPTER (`heli.ts`, `?heli=1`): sat on its skid on
  // the pad, lifting off into its own wash, and flown up the mountain by the
  // pre-roll's pilot.
  "heli-pad": {
    params: { start: "free", heli: "1", t: "0.5", shot: "1" },
    wait: ".hud-heli",
    settle: 1500,
  },
  "heli-wash": {
    params: { start: "free", heli: "1", t: "4", shot: "1" },
    wait: ".hud-heli",
    settle: 1500,
  },
  heli: {
    params: { start: "free", heli: "1", t: "30", shot: "1" },
    wait: ".hud-heli",
    settle: 1500,
  },
  // THE FREE RIDE'S SNOWMOBILE (`sled.ts`, `?sled=1`): stood on its boards
  // at the bottom with the skis racked, riding away up the valley throwing
  // its roost, and climbing the mountain on the pre-roll's hands
  // (`sledPilot`).
  "sled-park": {
    params: { start: "free", sled: "1", t: "0.5", shot: "1" },
    wait: ".hud-sled",
    settle: 1500,
  },
  "sled-go": {
    params: { start: "free", sled: "1", t: "3", shot: "1" },
    wait: ".hud-sled",
    settle: 1500,
  },
  sled: {
    params: { start: "free", sled: "1", t: "20", shot: "1" },
    wait: ".hud-sled",
    settle: 1500,
  },
  // THE AFTERSKI (`afterski.ts`, `?afterski=1`): inside the valley's lodge
  // with the party under way, two beers down; and a BUZZED
  // run (`?buzz=`), down the mountain through his own eyes on the pre-roll's
  // hands.
  afterski: {
    params: { start: "free", afterski: "1", t: "21", shot: "1" },
    wait: ".hud-afterski-room",
    settle: 1500,
  },
  buzzed: {
    params: { start: "free", buzz: "0.4", camera: "helmet", t: "11", shot: "1" },
    wait: ".hud-buzz",
    settle: 1500,
  },
  // THE FREE RIDE'S PARAMOTOR (`para.ts`, `?para=1`): on the summit with
  // the wing held overhead, skiing off under it as it flies, and in the air
  // on the pre-roll's hands (`paraPilot`), the engine run up.
  "para-ready": {
    params: { start: "free", para: "1", t: "0.5", shot: "1" },
    wait: ".hud-para",
    settle: 1500,
  },
  "para-go": {
    params: { start: "free", para: "1", t: "4", shot: "1" },
    wait: ".hud-para",
    settle: 1500,
  },
  para: {
    params: { start: "free", para: "1", t: "20", shot: "1" },
    wait: ".hud-para",
    settle: 1500,
  },
  // THE GALLERY as a fresh visit finds it: the roll lives in IndexedDB and a
  // new browser context has none, so what this photographs is the empty
  // state — which is the surface most players see first.
  gallery: { params: { menu: "gallery" }, wait: ".menu-card-gallery", settle: 700 },
  // ...and with a picture in it: a race ridden fourteen seconds, P pressed
  // (the whole shutter — the grab, the HUD layer, the stamp, the encode, the
  // roll), and the gallery opened in the same tab, so the store is the one
  // the picture was filed in.
  "gallery-roll": {
    prime: { params: { start: "race", t: "14", shot: "1" }, key: "KeyP" },
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
  // THE PHONE THE GAME IS HELD AT, as it really is: a current notched phone
  // on its side, its insets emulated (the notch's 59 px on both long edges,
  // the home bar's 21 under) — so every `env(safe-area-inset-*)` the cards
  // pad by is paid for in the picture. Full-screen (the store app, an
  // installed PWA), and under the browser's own bar along the top.
  iphone: {
    viewport: { width: 852, height: 393 },
    deviceScaleFactor: 3,
    hasTouch: true,
    insets: { top: 0, left: 59, right: 59, bottom: 21 },
  },
  "iphone-browser": {
    viewport: { width: 852, height: 340 },
    deviceScaleFactor: 3,
    hasTouch: true,
    insets: { top: 0, left: 59, right: 59, bottom: 21 },
  },
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
    t: {
      kind: "number",
      help: "seconds into the race, or a riding surface (overrides the scene's own)",
    },
    camera: { kind: "string", help: "tips, helmet, chase, far, high" },
    pose: {
      kind: "string",
      help: "stand the player's skis at x,z,heading,speed (m, m, rad, m/s) once the pre-roll is ridden (?pose=)",
    },
    hold: {
      kind: "string",
      help: "then ride on HELD at these speeds, km/h, a capture each (?hold=) — what the cloud looks like at a speed",
    },
    move: {
      kind: "string",
      default: "straight",
      help: "the held ride's move (straight, carve, turn, skid, check, stop, skate)",
    },
    "hold-for": { kind: "number", default: 3, help: "seconds the held ride is ridden" },
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
    skis: {
      kind: "string",
      help: "the player's pair for the run (?skis=: chamois, swift, chough, falcon, eagle, wolverine, peregrine, marmot, hare)",
    },
    downhill: {
      kind: "flag",
      help: "a downhill's training run (?mode=downhill; with --run2 its race)",
    },
    superg: { kind: "flag", help: "a super-G's one run (?mode=superg)" },
    gs: { kind: "flag", help: "a giant slalom's first run (?mode=gs; --run2 its second)" },
    skicross: {
      kind: "flag",
      help: "a ski cross's qualification (?mode=skicross; --run2 its first heat)",
    },
    bigair: {
      kind: "flag",
      help: "a big air contest's first jump (?mode=bigair; --run2 its second)",
    },
    knuckle: { kind: "flag", help: "a knuckle huck's jam on its knuckle (?mode=knuckle)" },
    railjam: { kind: "flag", help: "a rail jam on its set (?mode=railjam)" },
    halfpipe: { kind: "flag", help: "a halfpipe contest's first run (?mode=halfpipe)" },
    slopestyle: {
      kind: "flag",
      help: "a slopestyle contest's first run (?mode=slopestyle; --run2 its second)",
    },
    speedski: {
      kind: "flag",
      help: "a speed race's qualification (?mode=speedski; --run2 its final)",
    },
    run2: { kind: "flag", help: "a slalom's second run, the first skied by the bot (?run=2)" },
    "no-poles": { kind: "flag", help: "the player skis without poles, the hard mode (?poles=0)" },
    viewport: {
      kind: "string",
      default: "all",
      help: `${Object.keys(VIEWPORTS).join(", ")} or all`,
    },
    timeout: { kind: "number", default: 45, help: "seconds to wait for the frame" },
  },
  "usage: node scripts/screenshot.mjs [--scene name | --surface name] [--seed n] [--t s] [--pose x,z,h,v] [--hold kmh,… --move m --hold-for s] " +
    "[--camera rung] [--video tier] [--weather kind] [--hour h] [--region id] [--grade id] [--update] [--trial] [--tricks] [--downhill] [--superg] [--gs] [--skicross] [--speedski] [--bigair] [--knuckle] [--slopestyle] [--railjam] [--halfpipe] [--skis id] [--run2] [--no-poles] [--viewport v] [--timeout s]",
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
  const { insets, ...device } = VIEWPORTS[viewportName];
  const page = await browser.newPage(device);
  if (insets) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets });
  }
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
          "!document.querySelector('.hud-minimap') || !!document.querySelector('.hud-minimap[data-ground]')",
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
    // A CARD THAT OUTGREW THE VIEWPORT PHOTOGRAPHS PERFECTLY — its last
    // press just sits below the fold — so the overrun is measured and said.
    // A card scrolling WHOLE is a fault (its head goes with it); a page's
    // body scrolling under a head that stays is a list doing its job, and is
    // said so it can be judged.
    const over = await page.evaluate(() =>
      [...globalThis.document.querySelectorAll(".menu-card, .menu-body")]
        .filter((el) => el.scrollHeight - el.clientHeight > 1)
        .map((el) =>
          el.classList.contains("menu-body")
            ? `   its body scrolls by ${el.scrollHeight - el.clientHeight} px`
            : `!! ${[...el.classList].at(-1)} scrolls whole by ${el.scrollHeight - el.clientHeight} px`,
        ),
    );
    problems.push(...over);
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
    if (args["no-poles"]) params.poles = "0";
    // A surface that rides a run (`free`) is held at `--t` when given.
    if (args.t !== undefined && params.t !== undefined) params.t = String(args.t);
    for (const v of viewports)
      await capture(
        `${name}${args.region !== undefined ? `-${args.region}` : ""}` +
          `${args.grade !== undefined ? `-${args.grade}` : ""}${args.update ? "-update" : ""}` +
          `${args.t !== undefined && params.t !== undefined ? `-t${args.t}` : ""}` +
          `${args["no-poles"] ? "-nopoles" : ""}`,
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
  const holds = args.hold === undefined ? [undefined] : String(args.hold).split(",");
  for (const scene of scenes)
    for (const sky of skies)
      for (const hold of holds) {
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
        if (args.downhill) params.mode = "downhill";
        if (args.superg) params.mode = "superg";
        if (args.gs) params.mode = "gs";
        if (args.speedski) params.mode = "speedski";
        if (args.skicross) params.mode = "skicross";
        if (args.bigair) params.mode = "bigair";
        if (args.knuckle) params.mode = "knuckle";
        if (args.slopestyle) params.mode = "slopestyle";
        if (args.railjam) params.mode = "railjam";
        if (args.halfpipe) params.mode = "halfpipe";
        if (args.skis !== undefined) params.skis = String(args.skis);
        if (args.run2) params.run = "2";
        if (args["no-poles"]) params.poles = "0";
        if (args.pose !== undefined) params.pose = String(args.pose);
        if (hold !== undefined) params.hold = `${hold},${args.move},${args["hold-for"]}`;
        const name =
          `${scene}${args.trial ? "-trial" : ""}${args.tricks ? "-tricks" : ""}${args.downhill ? "-downhill" : ""}${args.superg ? "-superg" : ""}${args.gs ? "-gs" : ""}${args.speedski ? "-speedski" : ""}${args.skicross ? "-skicross" : ""}${args.bigair ? "-bigair" : ""}${args.knuckle ? "-knuckle" : ""}${args.slopestyle ? "-slopestyle" : ""}${args.railjam ? "-railjam" : ""}${args.halfpipe ? "-halfpipe" : ""}${args.skis !== undefined ? `-${args.skis}` : ""}${args.run2 ? "-run2" : ""}${sky !== undefined ? `-${sky}` : ""}` +
          `${args.hour !== undefined ? `-h${args.hour}` : ""}` +
          `${args.region !== undefined ? `-${args.region}` : ""}` +
          `${args.grade !== undefined ? `-${args.grade}` : ""}` +
          `${args.t !== undefined ? `-t${args.t}` : ""}` +
          `${args.camera !== undefined ? `-${args.camera}` : ""}` +
          `${args.video !== undefined ? `-${args.video}` : ""}${args.update ? "-update" : ""}` +
          `${args["no-poles"] ? "-nopoles" : ""}` +
          `${args.pose !== undefined ? "-posed" : ""}${hold !== undefined ? `-hold${hold}-${args.move}` : ""}`;
        for (const v of viewports) await capture(name, params, v);
      }
}

await browser.close();
await site.close();
if (failures > 0) {
  console.error(`\n${failures} capture(s) failed`);
  process.exit(1);
}

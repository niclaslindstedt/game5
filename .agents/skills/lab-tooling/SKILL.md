---
name: lab-tooling
description: "Use when writing or changing a LAB, a PREVIEW or any script under `scripts/` — a new Make target, a new flag on an existing one, a picture drawn in pure Node, a harness page drawn in a browser, a scratch probe over the built site, a meter. Owns the shelf every tool is built from (the framework's `tooling/*`: the flag parser, the raster and the PNG encoder, the `@engine` alias, the static server, the Chromium finder; and `scripts/lib/`: the level and ride painters, the ride scenarios, the glTF packer), the harness-page pattern (`make world`), the rule that a lab reads the game's own modules and never restates one, the URL contract the built app answers to (`url-params.ts`), and where a new tool is registered (the Makefile, `package.json`, the README's Usage table, the router's labs table). Load it BEFORE writing a one-off script: what you need is usually on the shelf."
---

# Lab tooling — how a measurement is built here

This project is tuned by measuring and LOOKING, and every subject skill ends
with a lab: `make sim`, `make ride`, `make level`, `make analyze`,
`make world`, `make skis`, `make audition`, `make screenshots`, `make profile`. They are
all built from ONE shelf, and the shelf is the reason a new lab is an
afternoon rather than a week — and the reason a session that writes its own
PNG encoder, flag parser or static server has reinvented something three
imports away.

**Before writing one, look at the sibling repos' `scripts/`.** `game3` (the
jet-ski game) and `game2` (the rally game) have deeper shelves — contact
sheets, schematic labs, a sky sheet, a craft elevation sheet, tape record and
replay, a debug-shot repro. Read their answer first and adapt it; never import
from them.

**Read this skill's lessons first** — `npx ogf-skill-lessons
lab-tooling --list`. Load **`skill-reflection`** at both ends and
**`write-code`** beside this one (its rules on `--experimental-strip-types`
and `aliasEngine` are the ones a script trips on first).

## Two kinds of lab, and which to build

| Kind | Runs in | Costs | Answers |
| --- | --- | --- | --- |
| **Pure Node** — loads the engine (and, through the alias, an app module), draws with the framework's `tooling/draw` / `tooling/png`, writes a PNG and a table | `node --experimental-strip-types`, no build, no browser | seconds | NUMBERS and GEOMETRY: a map from above (`level`), a scorecard (`analyze`), a ride in profile (`ride`), a balance table (`sim`) |
| **Browser-driven** — serves a page in headless Chromium and photographs or meters it | `playwright-core` over Chromium (`CHROMIUM_PATH`) | tens of seconds to minutes | LIGHT and COST: the snow, the sky, the HUD, what a frame costs, what a mix measures |

**Build the pure-Node lab whenever the question can be asked of the engine.**
It runs on CI without a browser, it runs on every seed in a loop, and it
cannot photograph a stale build. The browser lab has two shapes:

- **The built site** (`scripts/screenshot.mjs`, `profile-render.mjs`):
  `serveDir` serves `pwa/dist/` on a real origin, the tool opens the app at a
  URL that stands the race at a moment, waits for `window.__SH_READY__`, and
  shoots or meters. **`make build` first, every time** — a stale dist
  photographs the last change.
- **A harness page** (`make world`): a page of its own under
  `pwa/src/tools/<name>.tsx` with `pwa/<name>-preview.html` beside it (with
  `noindex`), built by the driver into a one-off bundle under
  `previews/.<name>-preview/` (so no `make build`), exposing a small
  `window.__<name>` API the driver calls. `skis-harness.ts` is the
  CONTACT-SHEET form of it (as `sky-harness.ts` is): one canvas, a scissored
  viewport a cell, orthographic elevations on a metre grid beside the
  game's own cameras, labels as DOM over the canvas — the pattern for any
  "every X by every Y" sheet. `cloud-harness.ts` is the RIDDEN sheet: a
  row is a staged ride (`placeRun` on an open meadow the page finds, a
  held speed, the sun turned to the ride through `setSky` and a heading off
  its azimuth, a snow kind laid by `setSnow`), a column one angle of its
  moment or one moment of its angle. `world-harness.tsx` stands one seed
  up, lets the bot ride it and draws named views through the game's own
  renderer. Vite builds only `index.html`, so a harness never ships.
  `audition.mjs` is the third shape — a page WRITTEN by the script, played
  by a person or metered headlessly.

## The shelf: the framework's `tooling/*`, then `scripts/lib/`

The generic half is `@niclaslindstedt/oss-game-framework/tooling/<name>` (shared with the sibling games — a bug in it is fixed THERE); the rest is this game's own, in `scripts/lib/`.

| Module | Gives every tool |
| --- | --- |
| `tooling/cli` | THE COMMAND LINE, once: `parseArgs(argv, spec, usage)` from one table of flags — `--help` printing every flag with its default, a non-zero exit on an unknown flag (a measurement tool that ignores a mistyped flag reports a confident wrong number), `--name=value` and `--name value`, positionals |
| `tooling/draw` | A SMALL RASTER: boxes, lines, circles, polylines, a 5×7 bitmap font (`FONT_5X7`, upper case), alpha blending |
| `tooling/png` | The PNG encoder (`encodePng`, `encodeRgbaPng`, `createCanvas`) — zlib only; the icon generator uses it too |
| `tooling/alias` | `aliasEngine(root)` (and `aliasModules` for any other alias) — a resolve hook handing `@engine` to `engine/index.ts`, so a plain-Node script can `import()` an APP module (`skier-pose.ts`, `trail-stamp.ts`, `sky.ts`) instead of restating its table. Call it BEFORE the dynamic import |
| `tooling/serve-dist` | `serveDir(dir)` — a directory on a real origin on a free port, as deployed, because the service worker, the manifest and `localStorage` behave differently off `file://` |
| `tooling/chromium` | `findChromium()` — where a Chromium and a driver are looked for; `CHROMIUM_PATH` wins |
| `scripts/lib/level-draw.mjs` | The map from above: `renderLevelMap({ level, scale, title, lines })`, the marks and labels every map lab shares |
| `scripts/lib/ride-draw.mjs` | The skier in profile over the ground he crossed: `drawRun` |
| `scripts/lib/ride-scenarios.mjs` | The ride lab's staged moments — a `RunMoment` and a scripted input each, on the SYNTHETIC maps (`SCENARIOS`, `SCENARIO_IDS`) |

The `scripts/` entries are the worked examples: `level-map.mjs` for a picture
plus a table plus `--json`, `analyze-level.mjs` for a scorecard that exits
non-zero, `ride-lab.mjs` for staged scenarios, `simulate-run.mjs` for a sweep
with `--json`, `world-preview.mjs` for a harness page and its one-off bundle,
`screenshot.mjs` for driving the built site, `profile-render.mjs` for a
meter, `audition.mjs` for a page written by concatenation.

## The URL contract

A browser lab does not click through menus. `pwa/src/game/url-params.ts`
states every parameter the app reads (DOM-free, so
`tests/menu_system_test.ts` reads it), and `scripts/screenshot.mjs`'s header
is the tool's side of it: `?seed=` (the map), `?start=slalom` (straight onto the
grid), `?t=` (seconds already ridden by the bot), `?shot=1` (held still once
drawn), `?paused=1` (under the pause card), `?camera=` (a rung),
`?splash=1` / `?menu=root` (a card), `?update=1` (the new-build button).
**The writer and the reader move together**: a parameter added to a tool is
read in `url-params.ts` in the same change, documented in
`docs/configuration.md`, and proved by running the tool. Readiness is
`window.__SH_READY__` (set in `App.tsx` once a race's frame is drawn); before
it the loading card is up and every keystroke is dropped, so a probe that
holds a key before it reads a clean zero and calls the feature broken.

## Craft rules

- **A lab reads the game's own modules and restates nothing.** The track on
  the map is `Level.track`; the nearest point is `nearestTrackPoint`; the
  furrow's depth is `drawnDepth`; the sky is `skyLookAt`. A number typed into
  a script is wrong the day the model moves, silently.
- **A lab prints its inputs beside its outputs** — the seed, the scenario,
  the flags in force — on the picture's title and in the table, so a PR's
  before/after can be checked to be the same measurement.
- **Every tool parses through `tooling/cli`.** A hand-rolled `process.argv` scan
  has no `--help` and no unknown-flag exit.
- **`--experimental-strip-types` refuses anything that emits code**: no enums,
  no parameter properties, no namespaces in anything a script imports. The
  first sign is `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` on an import three files
  from the change; neither `make lint` nor `make test` catches it — run the
  lab.
- **Output goes to `previews/`**, gitignored, named after the subject and
  its inputs (`level-38.png`, `ride-kicker.png`, `world-powder.png`), never
  committed.
- **A browser lab takes `CHROMIUM_PATH`** (`/opt/pw-browsers/chromium` in a
  web session) and needs `npm i --no-save playwright-core`.
- **A browser lab drives the BUILT site or its own bundle, never `npm run
  dev`.** The dev server has no service worker and a different base path.
- **A scratch probe is a lab you did not register.** Ten lines over
  `serveDir` and `playwright-core` are legitimate; keep them under
  `previews/` (inside the tree, so `playwright-core` resolves, and
  gitignored) and out of the commit — and if the same probe is written twice,
  it is a flag on the tool it duplicates.
- **A lab that draws the WORLD reuses the renderer**, as `make world` does,
  or the picture lies about what a race will show.

## Labs for MOTION: when something "looks hacky" or "isn't smooth"

An animation complaint is a complaint about TIME, and a single frame — a
screenshot, a contact sheet of poses — cannot show it. Before touching the
pose, build (or reuse) a lab that draws the motion OVER TIME, several ways at
once, because each way shows a different fault. The worked examples are
`make sag` (`scripts/sag-lab.mjs`) and `make lean` (`scripts/lean-lab.mjs`,
over `scripts/lib/lean-signal.mjs` and `lean-draw.mjs`); start from them.

**Draw the frames the renderer draws, not the engine's steps.** The engine
steps at 120 Hz and a display draws at 60, 144 or a wobbling rate: feed the
framework's `loop/run-clock` frame times at `--fps`, draw the body between
two steps with `interp.ts`'s `observe` / `sample`, step every view-side
spring by the FRAME's `dt`, and lay and pose the figure line for line as the
view does it (`skis-body.ts`'s `pose`: the stand at the drawn orientation's
inclination, the chatter, the kick, the technique's stance, `poseInputOf`,
`skierPose`, the pivot about the feet). A judder that lives between steps —
a raw per-step value mixed with an interpolated one — shows only this way,
and only at a frame rate that does not divide the step rate: always run
`--fps=144` beside 60.

**Read the motion as CHANNELS, layer by layer, in the order it is made**
(the engine's reading → the view's eased spring → each drawn part in the
world). A roughness that appears at one layer and not the one before it is
that layer's — the table points at the culprit before anyone guesses.
Measure angles in the WORLD where the eye sees them (the drawn pose stood on
the drawn orientation and pivot), never in the body frame the engine rolls.

**Number smoothness in terms an eye agrees with** (`lean-signal.mjs`):
`shiver` (what is left after a ~25 ms Gaussian smoothing, RMS — a frame-rate
shake in degrees), `rough` (the share of the RATE's power above a few hertz —
a swing is slow, a kink or a snap is not), turning points per cycle of the
reference motion (1.00 is one swing a turn; more is a bump inside it), and
the lag behind the source (the rates' cross-correlation). A peak jerk alone
is a poor guide: a legitimate quick transition has a big one.

**Draw the alternative views — each catches what the others miss:**

| View | Shows |
| --- | --- |
| A ROW A MOMENT (the sag-lab layout): the figure at its WORST frame on the left, its neighbours ±50 ms as grey ghosts, and the trace of the whole moment on the right with the worst frame marked | the one sheet a reviewer reads first: which moment, how bad, what it looks like |
| TRACES of every channel on one scale, with the course's events (gates, landings) marked | lag, overshoot, a part leaning the wrong way, a rule handing over to another |
| RATES under them | a kink in the trace is a step in the rate |
| THE RESIDUE after the shiver's smoothing, magnified ×5 | a regular ripple (a buzz at a fixed frequency) long before the trace shows it |
| A STROBE of the figure every N frames across the window, from the view the complaint is about (behind, for a lean) | uneven spacing, a jump, a pose that pops for one frame |
| PHASE PORTRAITS — each channel against its rate over the whole run | a smooth periodic motion is a clean loop; jitter is fuzz, a kink a spike off the loop |

**Give the lab ABLATION flags, so the cause is proven, not guessed:**
`--without=<stage>` takes one stage the view lays on the pose out (the
chatter, the lead, the plant, the block, the transition, the spring, the
interpolation); `--inputs` ranks every number the pose is handed by its own
roughness; `--ease=<input>` puts one input through a critically damped
follower before posing — the input whose easing removes the shiver is the
one carrying it. Report findings as these before/after numbers.

And as every lab: `--json` before, `--compare` after, the inputs printed on
the picture and the table, pure Node so it runs in seconds on any seed.

## Registering a tool

A tool exists when a session that has never seen it can find it. One change,
all of these:

1. `scripts/<name>.mjs` with a header saying what question it answers and the
   commands to run it; `#!/usr/bin/env node`, the SPDX line; flags through
   the framework's `tooling/cli`.
2. `package.json`: `"<name>": "node --experimental-strip-types
   --disable-warning=ExperimentalWarning scripts/<name>.mjs"` for a pure-Node
   lab; plain `node scripts/<name>.mjs` for a browser one.
3. The `Makefile`: a target (and its `.PHONY`) with a comment saying what it
   draws and example invocations, mapping `SEED=`, `SCENARIO=`, `SCENE=`,
   `ARGS=` onto the flags the way its neighbours do.
4. `README.md`'s Usage table — one row.
5. `AGENTS.md`'s labs table, if a subject now OWES the lab before and after
   a change, and the owning skill's own workflow.
6. For a harness page: `pwa/src/tools/<name>.tsx`, `pwa/<name>-preview.html`
   (with `noindex` and a comment saying it never ships), the driver's one-off
   build.

Then run `--help`, run it once with no flags and once with every flag, and
put the output in the PR.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth a fragment: a
thing the shelf turned out not to have, a probe written twice, a URL
parameter that was read but never documented.

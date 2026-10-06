---
name: playtest
description: "Use to verify gameplay changes in the running game and to evaluate game feel and look. Two photographers: `make world` (one seed skied by the bot, drawn through the game's own renderer at named views — spawn, powder, lookback, furrow, track, tips, helmet, far, jump, landing, vista, forest, approach-140…40, orbit — no build needed) and `make screenshots` (the BUILT app at moments of a run — grid, go, race, late — and its cards, at the three reference viewports). Closes the loop the sim numbers can't: does it LOOK and READ right on the snow."
---

# Playtesting

Engine tests prove rules, the labs prove the models and `make sim` proves
balance; playtesting proves the game **works and reads right in the real
renderer**. Every gameplay, rendering or input change ends with a look at the
actual pixels before it ships. Numbers say whether the game is _sound_;
pictures say whether it _looks and reads_ right.

**Before starting, read this skill's lessons** —
`npx ogf-skill-lessons playtest --list`. Load **`skill-reflection`**
at both ends of the session.

## Tooling

| Piece | Role |
| --- | --- |
| `scripts/world-preview.mjs` (`make world`) | THE WORLD LAB: builds its own bundle from `pwa/world-preview.html` (never deployed), stands one seed up, lets the bot ski it — the player's pair and the field — and draws named views through the game's own renderer to `previews/world-<view>.png`. ONE continuous run, so the tracks in the pictures are the tracks that run cut. `ARGS=--views=a,b` a subset, `--frames=n` times drawn frames, `--quality=low`, `--skip-build`, `REGION=` |
| `scripts/screenshot.mjs` (`make screenshots`) | THE BUILT APP: serves `pwa/dist`, opens `?start=slalom&seed=&t=&shot=1` (a run with `t` seconds already skied by the bot, held still once drawn), waits for `window.__SH_READY__`, captures at 1280×720, 390×844 and 844×390 (the phones at 2× with a touchscreen). `SCENE=grid/go/race/late/all`, `CAMERA=tips/helmet/chase/far/high`, `SEED=`, `ARGS="--t 20"`, `ARGS="--surface all"` for the cards, `ARGS="--region fell"`, `ARGS=--update` |
| `make ride SCENARIO=<name>` | The moment on the BENCH — the skier over the snow he crossed, with the numbers. No build, no browser, seconds. If the table does not show the moment, no picture will |
| `make level SEED=<n>` | The mountain from above — when the question is the course, not the rendering |
| `npm run dev` | The headed loop — ski your working copy for anything a still can't judge (the tuck, the lean, the edge, the skid, the sound) |

### Environment

`playwright-core` is installed with `npm i --no-save playwright-core`; only the
browser binary is separate. In Claude web sessions Chromium is preinstalled:

```sh
CHROMIUM_PATH=/opt/pw-browsers/chromium make world SEED=38
CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots SCENE=race
```

Never run `playwright install`; point `CHROMIUM_PATH` at an existing binary.
`make screenshots` needs `make build` first, every time — a stale dist
photographs the last change. `make world` builds its own bundle.

### The views and the moments

| `make world` view | What it photographs |
| --- | --- |
| `spawn` | The start line four abreast behind the start gate under the summit ridge, on the lights |
| `powder`, `powder-high` | The first drift across the piste (R17) — the plume, the sink — close and from the high boom |
| `lookback`, `furrow` | Back up the tracks the player has cut; close on them |
| `track` | On the groomed piste at pace — the corduroy, the gates' panels, the edge poles |
| `tips`, `helmet`, `far` | The bolted and far rungs of the camera ladder |
| `jump`, `drop`, `landing` | Off a kicker — the hang; late in the flight, falling fast (the chase lens must still hold the skier); the puff coming down |
| `vista`, `forest` | The mountain from above, the valley floor and the finish far below; in the woods |
| `approach-140`, `-90`, `-60`, `-40` | The forest view's line walked in toward the wood: what a tree's shadow does as the lens closes on it. A shadow that appears between two of them was switched on by distance to the lens — the fault the caster set exists to prevent |
| `orbit` | Round the skier — the menu's camera |

| `make screenshots` scene | Seconds in |
| --- | --- |
| `grid` | 0.5 — on the lights |
| `go` | 3.4 — GO just gone, the poles out |
| `race` | 12 — racing, the field strung out down the first pitch |
| `late` | 60 — well down the mountain |

**A scene is a moment of a real run skied by the bot**, so what is in the
frame is whatever that seed's run did at that second. When a moment matters
more than a seed (a landing, a tree), use the view that seeks it (`jump`,
`landing`) or bench it with `make ride` first.

**A new player-visible feature earns a way to be photographed in the same
change** — a view in `world-harness.tsx` (and `VIEWS` in
`world-preview.mjs`), or a `SCENES` / `SURFACES` entry in `screenshot.mjs`. A
surface no lab reaches is a surface no future sweep will ever look at.

## Running

**Look at the PNGs with the Read tool** — every judgement is made on a
picture, not on source. Watch the harness's `[pageerror]` lines too: a clean
picture over a page error is a lie.

### MEASURE the moment before chasing it

A picture that waits for a moment the run never produces shows a skier
cruising and says nothing about why. Before re-shooting — certainly before
re-shooting twice — ask the bench: `make ride SCENARIO=kicker` says whether
the skier left the snow and when he came down; `make level SEED=<n>` says
whether that seed's piste has a kicker at all and where. The question is not
"is the shutter too early" but "does this moment exist at this seed".

### Two traps

- **A canvas is not proof of a running game.** The canvas paints from frame
  one; a static frame with plausible HUD chrome can still mean the loop died.
  Check the HUD's live numbers (the clock differing between two `t` values)
  and the `[pageerror]` log before trusting a frame.
- **Same seed, same `t`, same run.** A run is deterministic, so two shots at
  the same seed and `t` are the same moment — which is what makes a
  before/after honest. Two at different `t` are different moments, and "the
  spray got bigger" between them is the clock, not the change. (The tracks
  are the one thing that differs if the renderer's stamping changed.)

## Evaluating

Judge each picture against the game's own bar (`game-feel` owns the
reference):

- **The snow reads as snow.** Bright, blue in shade, glitter toward the sun,
  the groomed piste greyer and combed — and the skier standing IN it, his
  tracks under him, never floating a hand above the snow or sunk through it.
  That gap is the one visible way the engine and the renderer can disagree.
- **The tracks read.** Two thin lines behind every skier, opening on the
  outside ski through a carve, persisting.
- **The skier's attitude reads.** Angulated into a turn, tucked on a
  straight, tips up off a lip, the knees folded on a landing, the body
  standing in the air.
- **Speed reads.** The plume, the trees and the gates streaming past, the
  speedo climbing — `race` should look fast at every viewport, and the
  mountain should FALL AWAY ahead of the skier.
- **The HUD is legible over the world** — over bright snow and over the dark
  forest both.
- **Portrait is a real game, not a cropped landscape.** The tuck lever and
  the edge thumb reachable, the next gate's panels visible far enough ahead
  to aim.
- **Nothing regressed in the scenery** — the ridges on the horizon, the woods
  where the plan put them and stopping at the tree line, no seams in the
  clipmap, no trees on the piste.

For feel questions (the tuck's response, the lean's authority, the carve,
the skid), run headed: `npm run dev` and ski. A picture cannot judge an
input curve.

## Skill self-improvement

Load the **`skill-reflection`** skill before this session commits. A settled
visual rule of thumb ("the tracks must show in every powder shot", "the HUD
fails over sunlit snow at noon") is worth recording — read the past ones
before you evaluate, not after.

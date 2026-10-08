---
name: debug-tools
description: "Use when a problem arrives as a FRAME, a PLACE or a SLOW PHONE rather than a repro — 'the furrow stops here', 'it stutters in the woods on my phone', a screenshot with the developer overlay in it. Owns the in-game developer page (the seven-second hold on the front door's title), its instruments — the frame rate and frame cost, the physics readouts, the trail-map overlay, the engine log, the free camera — the REPRO line and the URL that reads it back, DEVELOPER ▸ UNLOCKS, and DEVELOPER ▸ BENCHMARK with its report, its history and `make bench`."
---

# The in-game developer tools

A phone has no console. Everything a fix needs from a device — how fast the
picture is arriving, what the frame spent its milliseconds on, what the snow
under each probe is doing, where exactly the thing was — has to be readable
ON the device, and has to leave it as text somebody can paste. That is this
skill's whole subject, ported from the sibling games (the rally game's
debug overlay and REPRO line, the jet-ski game's developer page and
benchmark) and retyped for snow.

> **Every developer report carries a REPRO line, and the line is a URL the
> app reads back.** A frame somebody found by poking at the game is a frame
> anybody can stand in front of. Anything added to the line must be read by
> `url-params.ts`, or the line is a caption and not a repro.

## Getting in

Hold the front door's TITLE (the mark and the name) for seven seconds
(`DEV_HOLD_MS`, `menu-hold.ts`). Nothing fills while it is held — a hidden
door does not advertise itself — and the DEVELOPER chip appearing on the
strip along the foot is the receipt. `?menu=dev` opens the page and lets it
out the same way. LOCK on the page shuts it again; OPTIONS ▸ RESTORE
DEFAULTS deliberately does not.

## The tools

| Tool | What it answers | Where it lives |
| --- | --- | --- |
| FRAME RATE | How fast the picture is arriving, smoothed (a stall over 400 ms is skipped, not averaged in) | `frame-rate.ts` |
| FRAME COST | The engine's steps beside the renderer's own bill: pose, trail, world, submit, and the draw calls, triangles, programs, geometries, textures | `renderer.ts`'s `cost()`, `FrameCost` in `benchmark-report.ts` |
| PHYSICS | Every probe's load (N), sink and travel (cm), whether it touches; the packed share, the way, the revs, the snow dial | `physicsOf` in `debug-readout.ts` |
| TRAIL MAP | The two maps the snow reads its furrows off, drawn flat in the corner (depth warm, berm blue) | `trail-overlay.ts` |
| ENGINE LOG | The engine's `debug` lines switched on (`setDebugEnabled`) and its last eight on screen | `output-bridge.ts`'s buffer |
| FREE CAMERA | The lens off the ladder: I K fly, J L slide, U O sink and climb, shift faster, drag to look — over a run, a held run or a replay | `free-fly.ts` |
| UNLOCKS | The campaign's board set by hand, shelf by shelf, on a prefix | `campaign-unlocks.ts`, `menu-unlocks.tsx` |
| BENCHMARK | A pinned race timed as fast as the machine draws, scored, kept, and reported | `benchmark*.ts`, `bench-run.ts`, `menu-bench.tsx` |

Every switch is an instrument, never a change to the game, and every one is
dark until the page has been let out (`dev-tools.ts`). They go dark for the
whole of a benchmark, load and warm-up included: an instrument left on
would be timed with the race.

## The REPRO line

`reproQuery` in `debug-readout.ts`, read back by `url-params.ts`:

```
?start=slalom&seed=39&mode=downhill&skis=swift&t=41.25&camera=chase&weather=fair&hour=11&pose=x,z,heading,speed&splash=0
```

- `t` pre-rides the run with the BOT to that second — the clock, the lights,
  the field and the gates owed — and `pose` then stands the player's
  skier where he was, at his forward speed (`placeRun`).
- The weather and the start hour are the map's own, laid over it as a sky.
- WHAT IT CANNOT CARRY is how the player rode there: the field is where the
  bot's run would have left it. A bug in the field's positions is a REPLAY's
  to show (watch it back from the pause card), not a link's.
- A free ride's start-card day and snow dial are not URL parameters; a free
  ride's repro stands on the stored start card.

The overlay prints the line at its foot; the developer page's COPY REPRO
LINK puts the whole URL on the clipboard.

## The benchmark

The loop that makes performance work on a real phone possible:

1. On the device: DEVELOPER ▸ BENCHMARK. The pinned race (`benchmark-plan.ts`
   — seed 37, the race with the whole field, chase camera, fair sky at 11:00,
   1800 frames at a sixtieth) is stood up behind the loading card, its lights
   counted out there as the warm-up, then timed.
2. The score is an INDEX: 100 is real time. The red line is the run so far;
   the blue line each reading's own frame — a blue line that falls while the
   red one holds is a machine slowing down (on a phone, the thermal governor).
3. COPY DEBUG REPORT: the conditions (the map, the skis, the buffer, every
   row of OPTIONS ▸ PICTURE), WHERE THE FRAME WENT (sim, render and its four
   slices, the GPU fence, the gap between frames — every figure a run TOTAL
   over the frames, never a single frame's clamped clock), the counters, the
   scene by subsystem (`scene-tally.ts`), and every reading.
4. Move ONE picture row, run it again, and read the two against each other —
   BENCHMARK HISTORY keeps the last twenty whole, and copies any one run's
   report or the sheet of all of them.

`make bench` runs the same benchmark on the built site in headless Chromium
and prints the report (`make build` first). Headless Chromium draws in
SOFTWARE, so its score is this build's CPU cost and a regression's shape —
never a figure to hold a phone to. It is slow: at `--video low` and
640×360 the thirty seconds took a quarter of an hour on a four-core container.

`make bench ARGS=--gpu` draws on the host's own GPU instead, and wherever
the browser offers `EXT_disjoint_timer_query_webgl2` the report carries THE
GPU'S OWN TIMER (`gpu-timer.ts`, `?gpu=`): WHERE THE GPU WENT, pass by pass —
the trail maps, the skiers' maps, the sun's map, the scene, the grade.
`--ab` (`?ab=1`) adds the INTERLEAVED A/B: each frame is drawn without one
subsystem in turn (`HIDEABLE`), and the table bills each subsystem as the
difference it makes to the card's frame. That is how a subsystem's GPU cost
is read. `--split` (`?gpu=split`) cuts the scene's pass by subsystem with
timer queries instead, which a tiled GPU cannot do honestly (its lesson says
why). `--hide a,b` (`?hide=`) draws a whole run without some subsystems, and
`--dist <dir>` benchmarks a second build, so two builds can be run
alternately in one sitting.

What to put in a PR that changes what a frame costs: `make profile` before
and after, and a BENCHMARK report from each (off a device when the change is
about a device) — on a machine with a GPU, `--gpu --ab`, both builds
alternated.

## When you change these tools

- **The round trip is the contract.** A new word on the REPRO line is read
  by `readParams` in the same PR, and `tests/benchmark_test.ts`'s REPRO case
  grows the assertion.
- **The benchmark plan is pinned on purpose.** Moving the seed, the sky or
  the frame count makes every kept score incomparable with the next; say so
  in the PR, and keep `tests/benchmark_test.ts`'s claims (woods, a kicker,
  daylight, a whole number of steps a frame) true of the new plan.
- **A new renderer phase is a new `FrameCost` slice**, summed in
  `benchmark.ts`, printed in `benchmark-report.ts` and kept by
  `benchmark-history.ts`'s reader — or the breakdown's `rest` quietly grows.
- The words are `strings-dev.ts`'s; the look is `pwa/src/dev.css`.

---
name: perf-optimization
description: "Use when the task is to make the game RUN FASTER or STEADIER — a higher frame rate, fewer dropped or long frames, a phone that stutters, a loading card that takes too long — in the engine or the renderer, as a round of optimization rather than a feature. Owns the loop (find the dearest thing by the price list and the meters, measure it alone, change it, prove nothing moved that must not, measure again), the cost map of a frame (the engine's steps, the renderer's CPU phases, the GPU's passes, the per-pixel work every lit material carries), `make cpu-cost` (the processor's half of a frame timed in Node with a hash of what it filled), which meter answers which question in a container with no GPU and which needs a real one, the proofs a speed-up owes (bit-identical output, the sim digests, the instance hash), and the ledger of what has been tried, what it bought and what is still open. Not the price list itself (`picture-pricing`), the benchmark's internals (`debug-tools`) or a feature's look (its own skill)."
---

# Engine and graphics optimization

A frame here is four things, and a round of optimization starts by knowing
which of them is dear on the machine in question:

| Part | Where | What it costs | Meter |
| --- | --- | --- | --- |
| THE ENGINE | `engine/` — `step` at 120 Hz, two a frame at 60 fps; the bot decides inside `step` for every rival | processor | `make cpu-cost ARGS="--suite engine"`, `make sim` |
| THE RENDERER'S CPU | `pwa/src/game/renderer.ts`'s `draw`: the `pose` phase (riders posed), `trail` (stamps), `world` (the views' `update`s — forest, lifts, crowd, spray, cloud, snowfall), `submit` (three's `render`: the scene walk, the matrices, the render lists, every draw call) | processor, and the uploads it queues | `make cpu-cost` (views and pose, in Node), the benchmark's WHERE THE FRAME WENT |
| THE GPU'S PASSES | the trail maps, the four riders' shadow maps (SHADOWS HIGH), the sun's map, the scene, the region's grade | the card | `make bench ARGS="--gpu --ab"` on a machine with a GPU |
| THE FLOOR | what no PICTURE row takes off: the grade pass, the sky, the processor's submit — about two fifths of the reference frame | both | `FLOOR_MS` in `picture-fit.ts` |

**Prioritise by the price list.** `PICTURE_PRICES` in `picture-fit.ts` is the
measured cost of every stop of every PICTURE row on the reference machine,
and it is the honest ranking of where a frame goes: start with the dearest
stop (SHADOWS HIGH, DISTANCE, FOREST, RESOLUTION, in that order when this
skill was written), find what that stop actually buys in the code, and cut
the cost without cutting the look. A stop made cheaper owes a re-price
(`picture-pricing`), on a real GPU.

**Read the lessons first** — `npx ogf-skill-lessons perf-optimization`, and
`debug-tools`' and `picture-pricing`'s (the measuring traps), and
`write-code`'s first two (the bit-exact proof, the program cache key). Load
**`skill-reflection`** at both ends and record what a round taught: this
skill exists so the next round starts where this one stopped.

## The loop

1. **Pick by cost.** The price list for the GPU and the floor, `make
   cpu-cost` for the processor. A cost under ~0.05 ms is not a target.
2. **Measure it ALONE**, in the cheapest meter that isolates it: a Node
   probe for anything that runs without WebGL (every view's `update`, the
   pose, the engine), the benchmark's A/B for a GPU subsystem. A whole-game
   number moves with the machine's heat and its neighbours by more than most
   single changes are worth.
3. **Profile before guessing.** `node --cpu-prof` over the probe (the
   self-time table is a twenty-line script over the `.cpuprofile`), and the
   inspector's sampling heap profiler with collected objects counted for
   garbage (a plain `--heap-prof` shows only what survived — no garbage at
   all). In the browser, a CDP `Profiler.start` over a `?bench=1` page.
4. **Change it**, the smallest change that removes the work: hoist a lookup
   out of a per-instance loop, drop an allocation, skip an upload nothing
   reads, skip a walk nothing needs, fold four texture reads into one.
5. **Prove nothing moved that must not.** See *The proofs*.
6. **Measure again, back to back with the before**, on the same machine in
   the same state, and keep both outputs for the PR.
7. **Write it down**: a row in the ledger (`docs/performance.md`), and a lesson for a trap.

## Which meter answers what — and where it can run

| Question | Meter | Runs in a container? |
| --- | --- | --- |
| What one engine step costs, per mode | `make cpu-cost ARGS="--suite engine"` | yes |
| What a view's per-frame update costs on the processor (forest refill, lifts, crowd, the riders' pose) | `make cpu-cost` | yes — three.js builds instance buffers without WebGL |
| Draw calls, triangles, programs, binds, uploads a frame | `make profile` (built site) | yes — the counts are the GPU's whatever rasterizes them |
| The browser's main-thread JS by function | a CDP profile over `?bench=1&frames=N` | yes, slowly (below) |
| What a pass or a subsystem costs the GPU | `make bench ARGS="--gpu --ab"` (`gpu-timer.ts`) | **no** — SwiftShader prices the CPU |
| What a PICTURE stop costs end to end | `make bench ARGS="--gpu --costs"` | **no** — an hour on a real GPU |
| Frame-time spikes | the benchmark's snapshot fps line, DEVELOPER ▸ FRAME COST on the device | on a device |

**In a cloud container there is no GPU.** Chromium draws through
SwiftShader on the processor: at 1280×720 a frame of the race took seconds,
and even at 320×180 the 600-frame benchmark took over half an hour on four
cores, because SwiftShader is vertex-bound on the woods and the crowd. Use
it for STRUCTURE (counts, which pass exists, what the main thread does) and
never for a GPU price. Anything a GPU-side change buys has to be argued
from structure (fewer fetches, fewer passes, fewer vertices) and confirmed
by someone with a GPU running `make bench ARGS="--gpu --ab"` before and
after — say so in the PR. Run browser labs one at a time: two SwiftShader
pages, or a SwiftShader page and a Node probe, slow each other by 2× and
make every timing beside them worthless.

## `make cpu-cost`

`scripts/cpu-cost.mjs`: the engine per mode (the benchmark race, a free
ride with its crowd, the free ride on the snowmobile, a slalom, a downhill)
per step, and the views — the
FOREST's refill along the benchmark race behind a chase lens at any
FOREST/DISTANCE/SHADOWS stop, the GROUND's cull (the triangles it leaves
drawn of the whole clipmap's), the LIFTS, the free ride's CROWD and the four
riders' POSE — per frame, each with a HASH of what it filled (every drawn
instance's bytes, every skinned mesh's bones). `performance.now()` is pinned
to the frame inside the lab, so a dissolve or anything else on the wall
clock fills the same bytes on every run.

```sh
make cpu-cost                                     # every suite
make cpu-cost ARGS="--suite forest,pose"          # some
make cpu-cost ARGS="--forest medium --distance low --shadows off"
make cpu-cost ARGS="--json previews/cpu-before.json"
make cpu-cost ARGS="--compare previews/cpu-before.json"   # p50 beside, hash (same)/(CHANGED)
```

A view not in it yet is a suite to add, not a probe to write twice: build
the view in Node with `createHazeUniforms()`, ride the bot under it, time
`update`, hash its group. Anything needing a canvas (a texture drawn with
2D, the spectators' arena screen) needs a stub or stays in the browser.

## The proofs a speed-up owes

- **A refactor that must change nothing changes no byte.** For a view: the
  `make cpu-cost` hash, before (`git stash push <file>`) and after, at the
  same `--frames`. For the engine: `write-code`'s lesson — a whole-Level
  float hash and `make sim`'s digests, never `levelDigest` alone.
- **A shader change that must look the same** is looked at: `make world`
  or `make screenshots` before and after at the views it touches (a
  SHADOWS change: a skier's own shadow on the snow at `chase` and `tips`),
  and its maths argued line by line in the PR — a hardware filter replacing
  a hand-written one has to sample the same texels with the same weights.
- **A change to what three is handed** (a uniform's type, a texture's
  format, a material flag) is compiled: `make build` and one `make
  screenshots` frame at least, because a wrong sampler type is a black
  frame and a console error, not a type error.

## Three checks that are always worth a round's first hour

They found the biggest wins of the first round, and none of them is a
price-list row:

- **Read the scene against what the settings should build.** The
  benchmark report's WHAT WAS STANDING THERE lists every bucket's objects
  and triangles. Work out what one of each should be (`terrainTriangles`
  for the ground, the riders, the woods' bands) and compare: the first
  round found the terrain at exactly twice `terrainTriangles` — fourteen
  levels where the settings build seven — and behind it a whole second
  copy of the scene (the next bullet). A whole multiple is never noise.
- **Is anything loaded twice?** `renderer.load` is async and breathes
  between its steps; the front door's scenery and a run begun over it can
  overlap, and a load that resumes after a newer one's `unload` adds its
  groups for good. The renderer now drops a superseded load at its next
  breath (`loads` in `renderer.ts`); anything else async that adds to the
  scene owes the same guard.
- **Does three re-derive programs every frame?** In a CDP profile of the
  built site, three's `getParameters` and `getProgramCacheKeyParameters`
  (minified, so read the source at the profile's line and column — a
  ten-line script prints each hot function's first 150 characters) belong
  to a material's FIRST draw. Seen every frame, something moves what a
  program is keyed by: the light counts a render sees (a pass of the same
  scene that sees fewer lights — the fix above), the fog, the tone mapping
  or the output target between passes of one scene.
- **Does a program link after the card lifts?** Patch
  `WebGL2RenderingContext.prototype.linkProgram` in a Playwright
  `addInitScript`, note `__SH_READY__` at each link, and stand the run late
  with `?t=` (software GL advances a few game seconds a minute, so a run
  ridden from its start never reaches its finish arena). three's
  `compile` / `compileAsync` builds every mesh's own program and NONE of
  its shadow pass's depth programs; `environment.ts`'s `warmShadows` links
  those behind the card now, and a new pass outside the scene owes the
  same (`trail-map.ts`'s `compile` is the pattern).

## Where the time went

The ledger — every round, what it changed, what it bought and how — is
[`docs/performance.md`](../../../docs/performance.md). Read the rows for the
subsystem a round touches before starting it, and add a row there at its end,
with the machine and the meter that measured it.

## Open leads, ranked

Each is a real cost found in a round and not taken, with why:

- **The deformable snow's patch, what is left of it** (~0.5 ms of round 14's
  6.3 ms): not its fold's own arithmetic (0.08) nor its touched cells
  (folding them at 12 or 16 px bought nothing), so its 58k vertices' ground
  work and its zero-area triangles. The patch is drawn whole, behind the lens
  too: wedges like the rings', or a coarse base grid with fine tiles where a
  tool has touched.
- **The other skiers' lines on the piste** (`pisteTracks`, ~0.5 ms): the
  loop's arithmetic, not the shader's registers (switched off by its uniform
  it saves what removing it does), and in the six lines' setup — skipping a
  far line before or after its wave bought nothing.
- **The free ride's crowd, in the engine (round 9's profile).** `stepCrowd`
  is ~0.45 ms a step (two a frame) with 400 amateurs, most of it `move`'s
  own arithmetic (two `sampleRun`s an amateur), `place`'s ground read and
  `standApart`'s pairs on the one run 240 of them share. Nothing in it is
  wasted work; a cut is a cheaper crowd (amateurs far from the lens stepped
  less often), which moves its state and owes its own proof.
- **The riders' pose** (`make cpu-cost`'s `pose`, ~0.65 ms for four):
  spread over `skier-figure.ts`'s `lay` and `skierBones`, the dress's pose
  and three's `updateMatrixWorld`, with no one hot spot.

- **The canvas's own multisampling under a graded region.** The fell, the
  continental and the maritime draw the scene into the grade's multisampled
  half-float target and then ONE quad onto a canvas that is multisampled
  too (`antialias` on the context), which the browser resolves every frame.
  The alpine draws straight onto the canvas and needs it. The context's
  multisampling is fixed when it is made, so the fix is a context without it
  and the alpine drawn through the pass too — dearer for the alpine, cheaper
  for the rest. Needs the GPU A/B on both kinds of map before anyone decides. Measured on an M3 Max, maritime race at 1080p: the canvas's multisampling 0.2 ms, the grade target's 4× 1.2 ms (2× saves 0.2). ANTIALIAS is now an OFF / 2× / 4× picture row, priced and fitted like the rest; this lead is what is left of it: a canvas made multisampled still resolves under a graded region.

- **The sun's map's filter** is no longer a lead: three (0.186) reads it
  through a comparing sampler, five hardware taps a pixel — the sixteen
  RGBA reads this lead was written against are gone.
- **Map generation, what is left of it** (round 2 took a third off, below).
  A free ride's map is ~3 s in Node, nearly all of it the ski area: the
  massif's bake (~0.55 s, fifteen noise reads a cell over 2.25 M cells),
  `stampRun` (~0.33 s; order-dependent through its float32 distances, so
  not prunable bit for bit — `.lessons/`), the run walks' `nearest` and
  `chooseHeading`, the lanes' raster. Any speed-up must pass `write-code`'s
  bit-exact proof, because every pinned map's digest stands on it. And the
  front door's own map is still generated ON THE MAIN THREAD when the app
  mounts (`raceOrFallback`), seconds before the first frame on a phone: a
  worker could build it and hand it over as the start card's does.
- **The snow cloud's FILL on a snowmobile.** Its roost and bow wave throw
  the heli wash's whiteout recipe (big, slow, 4.5 s) back at the chase
  lens: up to 200 puffs live in powder, and behind the chase lens 1.15
  screens of cloud a frame on average, 4 at p95 and 12 at worst (a scratch
  probe of the puffs' quads against the lens). Nearly all of it is puffs the
  lens's VEIL thins to 12% — almost invisible, shaded in full. Cheapening a
  faint puff's shading (skipping its relief reads) bought ~1.5% under
  software GL and could not be shown to buy more, so it was not shipped.
  What would cut it is fewer of those pixels: a lighter recipe for the
  roost, or a veil that drops what it thins. Either changes the look, so it
  is a design call, not a speed-up.
- **The helicopter, the jump plane and the rescue machine** have 15, 28
  and 19 primitives; `mergeParts` would take them, but each changes
  materials at run time by name (the livery, the faded blades, the glass),
  so a merge needs those kept out by `keep` first.
- **Three's own scene walk** (`updateMatrixWorld` ~0.45 ms, `projectObject`
  ~1.3 ms of the no-draw frame) and the uniforms it sends per draw are
  most of what is left of `submit`; static groups could be frozen
  (`matrixAutoUpdate = false`), but the forest and the gates are ~150 of
  ~830 objects, so small.
- **The riders' matrices are composed twice a frame**: `posed-merge.ts`'s
  `update` forces the root's subtree, and the scene's own walk composes it
  again. ~76 objects a rider, so small.

## Skill self-improvement

Record what a round taught — a meter that lied, a change that bought
nothing, a cost that moved with the machine — as a lesson fragment under
`.agents/skills/perf-optimization/.lessons/` via **`skill-reflection`**,
and move a ledger row's number when a later round re-measures it.

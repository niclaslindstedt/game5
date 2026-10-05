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
7. **Write it down here**: a row in the ledger, and a lesson for a trap.

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
ride with its crowd, a slalom, a downhill) per step, and the views — the
FOREST's refill along the benchmark race behind a chase lens at any
FOREST/DISTANCE/SHADOWS stop, the LIFTS, the free ride's CROWD and the four
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

## Where the time went (the ledger)

Measured on a four-core cloud container in Node 22, `make cpu-cost`, p50
per frame, before → after; the GPU rows are argued from structure and owe a
real GPU's A/B. The benchmark under SwiftShader, 320×180, every row at its
top, before → after round 1: draw calls 345 → 266, triangles 1.34M →
~0.75M with the scene single and fewer again with the ground culled (see the round-1 PR), programs 58 → 46, textures 89 → 50, the renderer's processor half
16.9 → 12.3 ms (`submit` 10.6 → 6.4), the sun's shadow pass 68 → 29 ms of
SwiftShader's time.

| Round | What | Before → after | How |
| --- | --- | --- | --- |
| 1 | FOREST refill (HIGH/HIGH/HIGH, 34k trees, the benchmark race) | 1.32 → 0.70 ms, same hash | `place()` made three `subarray` views per tree per refill (~12k garbage objects a frame) and looked each attribute up by name; the band now holds each mesh's arrays once and copies by index. Empty shapes are no longer re-sent. The garbage it leaves a frame fell about 3× (what remains is mostly three's own update-range objects, one per attribute sent). |
| 1 | SHADOWS HIGH receivers (every lit pixel) | 36 → 9 texture reads per rider's box; a quarter of the code | The riders' atlas is a `DepthTexture` read through a `sampler2DShadow` (`LessEqualCompare`, linear): one tap is the GPU's own four compares blended bilinearly, which `heroLerp` did by hand. Colour writes off in the pass. |
| 1 | SHADOWS HIGH passes (CPU) | four whole-scene walks → four walks of the riders alone | three's `render` visits every object whatever its layer; the scene's other children are switched off for the four passes. |
| 1 | Every lit material's program re-derived every frame under SHADOWS HIGH (three's `getParameters`, `getProgram` and its cache key: the second-dearest JS in the browser profile after the forest's refill) | every frame → never | three keys a render's lights by how many of each it sees and re-derives every lit material's program when that key moves; the riders' passes saw no light and moved it twice a frame. Every light now carries the passes' layers and the groups holding one stay in their walk. |
| 1 | THE WHOLE SCENE, TWICE (every mode, whenever a run was begun while the front door's scenery was still loading — the benchmark always) | 2 → 1 of every group: 1.34M → ~0.92M triangles a frame on the benchmark, every draw call and every view's `update` halved | `renderer.load` is async; a superseded load now stops at its next breath instead of adding its terrain, woods, lifts, crowd and riders after the newer load's `unload`. |
| 1 | A shadow program linked mid-run (a slalom's finish, ~32 s in) | 1 → 0 programs linked after the card lifts (`?start=slalom&t=40`); 7 more linked on the card | `warmShadows`: one pass of the sun's map over the whole map with every caster shown, behind the loading card. |
| 1 | THE GROUND'S VERTICES | every level's whole ring → the wedges the lens can see (`TERRAIN_WEDGES`, 16 a ring; one draw a level still) | Each level drew all round the lens with culling off (the shader places the vertices, so three has no bound). A ring's triangles are laid wedge by wedge twice round, each wedge's box over the map's heights plus the rim's rise is tested against the frustum, and the ring draws the one range holding every wedge seen. Level 0, which the lens stands in, is drawn whole. Pixel-identical at chase, far and high. A first try cut each level in four quarters: every quarter meets at the level's centre, where the lens is, so every quarter always touched the frustum and nothing was culled — the tally caught it. |

## Open leads, ranked

Each is a real cost found in a round and not taken, with why:

- **The canvas's own multisampling under a graded region.** The fell, the
  continental and the maritime draw the scene into the grade's multisampled
  half-float target and then ONE quad onto a canvas that is multisampled
  too (`antialias` on the context), which the browser resolves every frame.
  The alpine draws straight onto the canvas and needs it. The context's
  multisampling is fixed when it is made, so the fix is a context without it
  and the alpine drawn through the pass too — dearer for the alpine, cheaper
  for the rest. Needs the GPU A/B on both kinds of map before anyone decides.
- **The sun's shadow map under SHADOWS HIGH** holds only what does not move
  much (the woods, the lifts' chairs, the animals, the gates' poles) and is
  redrawn every frame because its box follows the lens. Redrawn every other
  frame it would keep its shadows exactly where they are (the receivers read
  the map with the matrix it was drawn with), the movers a frame late. Not
  under MEDIUM, where the skiers are in it. Needs the GPU A/B and a look.
- **The sun's map is three's PCF-soft over RGBA-packed depth** — sixteen
  reads a pixel inside the shadow's reach — on every lit material. A
  comparing sampler would do it in four, but it is three's shadow system,
  not ours: a change there is a graft as big as the haze's.
- **Map generation on the loading card.** A free ride's map took 8.5 s in
  Node, most of it the ski area (`net-index.ts`'s `scan`, `network-build.ts`,
  `station-clear.ts`). It moves no frame, but it is the wait every run
  starts with; a speed-up there must pass `write-code`'s bit-exact proof,
  because every pinned map's digest stands on it.
- **The riders' matrices are composed twice a frame**: `posed-merge.ts`'s
  `update` forces the root's subtree, and the scene's own walk composes it
  again. ~76 objects a rider, so small.

## Skill self-improvement

Record what a round taught — a meter that lied, a change that bought
nothing, a cost that moved with the machine — as a lesson fragment under
`.agents/skills/perf-optimization/.lessons/` via **`skill-reflection`**,
and move a ledger row's number when a later round re-measures it.

# The WebGPU port

The world is drawn by three's `WebGLRenderer`. The port moves it onto three's
node renderer (`WebGPURenderer` from `three/webgpu`), which draws on WebGPU
where the browser has an adapter and on its own WebGL2 back end where it does
not. The work lands a system at a time, each one a part below. **Until the
flip (part 15) the default is WebGL and it draws exactly as before.** The
webgpu paths are switched on per visit and draw whatever has been ported so
far. Anything not yet ported is skipped or hidden, and the frame says so.

## The switch

| Link | What draws the world | `__SH_BACKEND__` |
| --- | --- | --- |
| (none), `?renderer=webgl` | `WebGLRenderer`, as always | `webgl` |
| `?renderer=webgpu` | the node renderer on a WebGPU device; three's WebGL2 back end when there is no adapter | `webgpu`, or `webgpu-gl` when it fell back |
| `?renderer=webgpu-gl` | the node renderer on its WebGL2 back end, even where WebGPU exists | `webgpu-gl` |

`pwa/src/game/gpu-backend.ts` parses the word (`readBackend`, `chooseBackend`)
and holds the register below. It is DOM-free and three-free, so the suite
reads it (`tests/gpu_backend_test.ts`). A labelled back end is what the page
really drew on, and a fallback is never reported as WebGPU.

## The pieces

- **`render-seam.ts`** is what the world renderer draws through. It holds the
  renderer (`gl`), whether it is three's WebGL one (`native`), the promise it
  is ready on, the texture cap, the per-frame counter reset, the normalized
  counters (`info()`: draw calls, triangles, points, programs, geometries,
  textures) and the dispose. `webglSeam` is the default and makes the
  `WebGLRenderer` exactly as `renderer.ts` did before.
- **`gpu-device.ts`** is fetched as its own chunk only when a webgpu path is
  asked for, so the WebGL build never loads the node renderer. It does five
  things:
  - It asks the adapter for a device with the adapter's OWN limits. The
    defaults would be 16 textures a stage and 128 MiB buffers, whatever the
    card offers.
  - It turns on every optional feature the adapter has: `shader-f16`,
    `timestamp-query`, `float32-filterable`, `core-features-and-limits` and
    each `texture-compression-*`.
  - It watches `device.lost`.
  - It shims the identity texture-view swizzle that three r186 passes and
    some Chromium releases reject.
  - It installs the seam factory.
- **`gpu-quarantine.ts`** hides, for one frame, every object the node
  renderer cannot draw yet, and shows each again after. A material is hidden
  in either of two cases:
  - It is a `ShaderMaterial`, which the node renderer draws as a bare node
    material.
  - It is flagged `userData.glsl`: a material whose `onBeforeCompile` grafts
    GLSL (the node renderer drops the hook), or an object whose draw reaches
    for the WebGL context.
  The flag goes on through `glslOnly(target, family)`, and `hazeMaterial`
  sets it on every graft it makes. The counts are kept by family and by where
  in the scene the object sits.
- **`renderer-instruments.ts`** holds the frame's instruments, moved out of
  `renderer.ts`: the GPU timer, the per-object cost hooks, the hide-list, the
  drain and the bill. On WebGL they are what they were. On the webgpu paths
  the WebGL-only hooks are not installed and the counts come from the seam's
  `info()`. **The shape of `FrameCost` is the same on every back end**, so
  the benchmark, the developer page and the profiler read one shape.

## The register — what the webgpu paths draw

`GPU_PORTS` in `gpu-backend.ts` is the list. Each row is a render PASS that
is skipped (`runsPass`) or a material FAMILY that is hidden (`quarantinedOn`)
until its part is ported. Porting one flips its `ported` to true. The tests
hold that every pass runs on WebGL and that only the ported ones run on the
webgpu paths.

| Row | Kind | Part | What it is |
| --- | --- | --- | --- |
| `sky-gpu` | pass | 3 | the sky's LUT passes |
| `clouds` | pass | 10 | the cloud shadow, slab and volume |
| `trail-map` | pass | 5 | the stamps rasterised into the trail maps |
| `deform` | pass | 5 | the deform field |
| `hero-shadow` | pass | 6 | the skiers' own shadow maps |
| `shadow-depth` | pass | 6 | the shadow depth sort and kinds |
| `env-warm` | pass | 14 | the shader warm-up |
| `grade-pass` | pass | 7 | the region's grade (the frame draws straight to the canvas instead) |
| `snow-under` | pass | 14 | the snow under the skis |
| `trail-overlay` | pass | 14 | the trail overlay |
| `gpu-timer` | pass | 14 | the timer queries |
| `shader` | material | 2 | any `ShaderMaterial` |
| `terrain` | material | 4 | the clipmap's snow |
| `forest-batch` | material | 8 | the woods' multi-draw batch |
| `haze-graft` | material | 2 | a `hazeMaterial` with grafted GLSL |
| `model-merged` | material | 12 | the merged models (the skis) |
| `wingsuit` | material | 12 | the wingsuit figure |
| `gore-tree` | material | 11 | the gore on a tree |

On the webgpu paths after part 1, the frame draws these: the skier's body,
the gate poles, the netting and fences, the lifts with their chairs and
towers, the HUD, all lit by the hemisphere and the sun. It does not draw the
sky (black), the terrain, the woods, the skis, the crowd or any haze. The
benchmark report and the developer page say which, on the `RENDERER` line
and the `SKIPPED` / `QUARANTINED` lines under it.

## Measuring both paths

Every browser lab takes `--renderer=webgl|webgpu|webgpu-gl`
(`scripts/lib/backend-flag.mjs`). The flag gives the lab the query
parameter, the Chromium switches that back end needs, and a check
(`assertBackend`) that fails the lab when the page drew on a different back
end than the one asked for. `make bench ARGS="--renderer=both"` runs the
benchmark on each back end and closes with the two side by side. The labs
that take the flag are `make bench`, `make screenshots`, `make world` and
`make profile`. `make profile`'s WebGL meter counts nothing on the webgpu
paths until part 14.

**WebGPU in a headless container** needs more than the obvious switches. With
only `--enable-unsafe-webgpu --enable-features=Vulkan
--use-webgpu-adapter=swiftshader`, a device is made and then LOST the moment
a canvas is configured on it. The GPU process's own Vulkan has to be
SwiftShader too (`--use-vulkan=swiftshader`), with ANGLE on SwiftShader
beside it. `backend-flag.mjs` passes the whole set. With `--gpu` the adapter
is the host's own card.

## The ledger — one row per part

What each part moved, measured on both paths. Container numbers are
SwiftShader: they say what the STRUCTURE is (draw calls, pipelines, what is
drawn), never a phone's milliseconds. A real GPU's numbers come from
DEVELOPER ▸ BENCHMARK on the device, which prints the same `RENDERER`
lines.

| Part | Date | Path | Draw calls | Triangles | Programs / pipelines | CPU render ms | Submit ms | Skipped / hidden | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 Scaffolding | 2026-10-19 | webgl | 100 | 231 677 | 51 programs | 12.47 | 5.83 | 0 / 0 | the WebGL race shot is pixel-identical to main's |
| 1 Scaffolding | 2026-10-19 | webgpu | 72 | 89 025 | 41 programs, 29 pipelines | 270.38 | 266.35 | 11 passes / 38 meshes | SwiftShader's Vulkan. The submit includes the first pipelines' compiles. The webgl wall ms is the readPixels fence's and is not comparable |

Part 1 was measured with `make bench ARGS="--renderer=both --frames 60 --width
640 --height 360 --video low"` on seed 20 (the woods and a kicker, four skis).

## Systems ported

- [x] 1 Scaffolding: the seam, the device, the switch, the quarantine, the instruments, the lab flag, this ledger
- [ ] 2 Haze and lights (`shader`, `haze-graft`)
- [ ] 3 Sky (`sky-gpu`)
- [ ] 4 Terrain and snow I (`terrain`)
- [ ] 5 Trails and deform (`trail-map`, `deform`)
- [ ] 6 Shadows (`hero-shadow`, `shadow-depth`)
- [ ] 7 Grade and post (`grade-pass`)
- [ ] 8 Forest (`forest-batch`)
- [ ] 9 Particles and air
- [ ] 10 Clouds (`clouds`)
- [ ] 11 Figures (`gore-tree`)
- [ ] 12 Skier, models, effects (`model-merged`, `wingsuit`)
- [ ] 13 Buildings and props
- [ ] 14 Instruments and tools (`env-warm`, `snow-under`, `trail-overlay`, `gpu-timer`)
- [ ] 15 The flip: webgpu by default, `?renderer=webgl` kept as the way back, the picture's prices re-measured
- [ ] 16 The GLSL deleted, and the quarantine with it
- [ ] 17 Compute (WebGPU only)
- [ ] 18 Ray-marched effects

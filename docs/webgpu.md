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
  textures), the scene's dressing (`dress`, once) with the frame's two ends
  (`beginFrame`, `endFrame`), and the dispose. `webglSeam` is the default
  and makes the `WebGLRenderer` exactly as `renderer.ts` did before; its
  `dress` and `endFrame` do nothing.
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
- **`gpu-dress.ts`** dresses the scene for the node renderer (part 2). It
  hangs the haze on the scene as its fog node, gives the key, the sky and
  the lamps their light nodes, and finishes every material's node copy (see
  below). It is reached only through `gpu-device.ts`'s chunk, together with
  `haze-tsl.ts`, `lights-tsl.ts` and `glow-tsl.ts`. `tests/haze_tsl_test.ts`
  holds that nothing else imports `three/webgpu` or `three/tsl`.
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
| `sky-gpu` | pass | 3 | the sky's LUT passes. Ported |
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
| `haze` | material | 2 | the haze on a hazed material, with the key's extras, the shade lift and the lamps; a glow's fade. Ported |
| `sky` | material | 3 | the dome, the far ranges and the sky's passes, each drawn by its node twin. Ported |
| `shader` | material | 9 | every other `ShaderMaterial`: the spray first, then the clouds and the rest in their own parts |
| `terrain` | material | 4 | the clipmap's snow |
| `forest-batch` | material | 8 | the woods' multi-draw batch |
| `haze-graft` | material | 11 | a `hazeMaterial` with grafted GLSL of its own (the figures' gaits, the rock's keep, the tree cards…), each drawn again in its owner's part |
| `model-merged` | material | 12 | the merged models (the skis) |
| `wingsuit` | material | 12 | the wingsuit figure |
| `gore-tree` | material | 11 | the gore on a tree |

On the webgpu paths after part 3, the frame draws these:

- the sky: the dome with the sun, the moon, the stars and the Milky Way,
  the contrails and LOW's cloud shell, and the far ranges
- the skier's body
- the gate poles, the netting and the fences
- the lifts, with their chairs and towers
- the lamps' glows
- the HUD

All of it is hazed and lit by the key and the sky as WebGL lights them, and
by the lamps at night. The frame does not draw the terrain, the woods, the
skis or the crowd. The benchmark report and the
developer page list what is missing on the `RENDERER` line and on the
`SKIPPED` / `QUARANTINED` lines under it.

## The haze and the lights (part 2)

WebGL's world materials carry the haze, the key's extras and the lamps as
GLSL that `hazeMaterial` grafts in (`haze.ts`). The node renderer drops every
graft. The webgpu paths therefore restate them as nodes over the SAME
uniforms. Each node reads its slot of `HazeUniforms` by reference, so
`writeHaze` and every other writer drive both back ends and no number has a
second copy.

- **The haze is the scene's fog node** (`haze-tsl.ts`'s `hazeFog`). It
  restates `HAZE_FRAGMENT` term for term:
  - the air's colour and amount
  - the twilight's lift
  - the far colour behind the mist's wall
  - the sea of cloud

  Fog stays on only on the node copy of a material that `hazeMaterial`
  marked (`userData.haze`), because WebGL hazes only those.
- **The key and the sky are classes of their own** (`world-lights.ts`:
  `KeyLight`, `SkyLight`), made on every back end. On WebGL they are three's
  directional and hemisphere lights. The node renderer finds a light's node
  by the light's class, so `lights-tsl.ts` hangs its nodes on them:
  - the key is coloured by height, taken down by the mountain's shadow and
    faded at the shadow box's rim;
  - the sky's light is lifted in the mountain's shade.

  The lamps are a light of their own (`LampsLight`), which the dressing adds
  to the scene. **A flag on these classes must be a word three does not
  read.** r186 reads `isSunLight` as its own cascaded sun, and a key flagged
  that way throws on WebGL.
- **The mist's wall and a glow's fade** finish the node copy of a material
  (`maskNode`, `opacityNode`, `glow-tsl.ts`).
- **Glow points are drawn as sprites.** WebGPU draws every point one pixel
  across, so each glowing `THREE.Points` gets a stand-in: one instanced
  sprite over the same buffers, sized as the point was and held at least
  `MIN_PX` across. The points are hidden while their stand-in draws.
- **The key's shadow map is drawn before anything samples it.** The node
  renderer makes the map's depth texture the first time a material binds it.
  It then makes the texture again when the shadow pass first draws.
  - The failure: if a key's map stood out for the first frames, every lit
    pipeline stayed bound to a destroyed texture, and the device refused
    every frame after that.
  - The fix: the dressing asks at once for any map that has never been
    drawn.
  - `environment.ts` also leaves the node renderer's map alone when the
    SHADOWS row resizes it, because that shadow resizes its own map.

**THE FOG RUNS BEFORE THE TONE MAPPING.**

- **On WebGL**, the haze replaces `fog_fragment`. When the frame goes
  straight onto the canvas, three runs `fog_fragment` after the tone mapping
  and the sRGB encoding. So the haze is mixed in display space, and that is
  what lets the far rim meet the dome without a seam.
- **On the node renderer**, the fog runs first, in linear light, and a pass
  tone maps the frame afterwards.
- **WebGL does not always draw straight onto the canvas.** It draws
  through its grade target in these cases, and then it too hazes in linear
  light, before the target's pass:
  - a graded region;
  - an ANTIALIAS stop other than the samples the canvas was made with (LOW
    asks for two);
  - the buzz or the blaze.

  `region-picture.ts`'s `drawsStraight` is that decision. The webgpu
  paths' picture (`render-seam.ts`'s `directPicture`) keeps the same
  inputs and asks it every frame (`seam.hazeInDisplay`).
- **How the fog node squares the two.** The node renderer's frame always
  goes straight to the canvas through ACES until the grade pass is ported.
  Where WebGL's frame would go straight too, the fog node:
  1. carries the material's colour and the air's into display space, using
     the output pass's own transform (`toDisplay`);
  2. mixes them there;
  3. carries the result back (`fromDisplay`).

  The output pass then lands on the pixel WebGL makes. Where WebGL would
  draw through its target, the fog node mixes in linear light, as WebGL
  does. A pixel with no haze keeps its colour to the bit.

**Where the two paths still differ:**

- **The lit colour under the haze.** Measured on the chairs of seed 38's
  lift, inside the outline, from 20 m out to 300 m, at noon and at dusk, on
  LOW and on HIGH. The haze matches WebGL's to a few levels at every
  distance. A lit surface is still about 8–15 levels lower in blue on the
  webgpu paths, near and far alike, and part 1's frame was lower by the
  same amount. Part 3 shows the gap is not in the lighting either: the
  dome is lit by nothing, and its sky is still 8–11 levels lower in blue
  (and 3–5 in green) at noon, on LOW's table and on HIGH's passes alike
  (seed 38's vista, rows 30–100). The node ACES fit accounts for under one
  level of it, and brightens. What is left sits after the twin's linear
  colour: the output pass or the canvas. That is part 7's to find.

- **Three's NODE ACES fit is not quite its GLSL one.** The node fit also
  multiplies the `0.432951` by `0.983729`, so the node canvas is a hair
  darker in the mid-tones. Squaring that belongs to part 7. The inverse used
  here is the node fit's, because that is the one the fog node has to undo.

**Stand-ins until their parts:**

- The aerial-perspective volume (`aerialShade`) is read since part 3, as
  WebGL reads it.
- The clouds' shadow on the key (part 10) is 1.
- The skiers' own shadow maps (part 6) take nothing from the key.
- A material's own share of colour through the haze (`HAZE_KEEP`, on the
  snow and the rock) is not read, because both are hidden until their parts.

## The sky (part 3)

The node renderer would draw a `ShaderMaterial` as a bare node material, so
the sky's materials get **node twins**. `nodeTwin(material, "sky", kind)`
(`gpu-backend.ts`) flags a ShaderMaterial with the twin it takes and puts
it in the `sky` family, which the quarantine lets through. `gpu-dress.ts`'s
`fromMaterial` hook asks `sky-twins-tsl.ts` first. It answers with the
twin, made once a material over that material's OWN `uniforms` (read by
reference, as the haze's slots are) and copying its pipeline state (side,
depth, blending, polygon offset). WebGL never reads the flag, so its
picture is the same to the bit.

| Twin | ShaderMaterial | TSL |
| --- | --- | --- |
| `dome` | `sky-dome.ts` | `sky-dome-tsl.ts`, with `night-sky-tsl.ts` (the stars, the Milky Way, the moon), `cloud-shell-tsl.ts` and `contrail-tsl.ts` |
| `far` | `far-ranges.ts` (the rings and the disc) | `far-ranges-tsl.ts` |
| `trans`, `ms`, `view`, `froxel` | `sky-gpu.ts`'s passes | `sky-atmo-tsl.ts` |

**The GPU sky's passes run on the node renderer** through the same
`gl.render` of the same quads. Their targets are three's `RenderTarget`
there, and three samples a target the WebGPU way on both of its back
ends, so every table is laid out as WebGL lays it. HIGH's aerial volume is
read by the haze's `aerialShade`, as on WebGL. LOW's sky (`sky-table.ts`)
needs no pass.

**What the twins do differently, and why:**

- A define changed after the first draw does not rebuild a node pipeline.
  So `PLAIN_SKY` is read off the material's defines each frame
  (`onRenderUpdate`), not compiled in.
- WebGL tone maps the dome and the far ranges in their own shaders. On the
  node renderer the output pass does it, and the far ranges' haze is mixed
  in display space through the fog node's own `hazeOver`, as part 2's
  materials are.
- **The cloud noise is a 2D sheet**, not a 3D texture. SwiftShader's Dawn
  refuses every write into a 3D texture, and then refuses every frame.
  `noiseAtlas` lays the slices out in a grid, each with a one-texel
  border wrapped off its opposite edge, so the sampler's own filter
  repeats as the 3D one does. The depth is filtered between two slices
  by hand.
- LOW's cloud shell is every tier's on the webgpu paths until the clouds'
  passes are ported (part 10). MEDIUM's slab and HIGH's volume are
  pictures drawn before the frame, and those passes are skipped. So a deck
  that WebGL's volume closes over the whole sky (OVERCAST at HIGH) can
  leave a strip of sky at the top of the frame on the webgpu paths, and
  how it reads at HIGH depends on the cells drawn before it in `make sky`'s
  sheet. At LOW the overcast matches WebGL's.

`tests/sky_tsl_test.ts` holds the flags, the quarantine, the register, every
twin built on plain Node, and the sheet against the field.

## Measuring both paths

Every browser lab takes `--renderer=webgl|webgpu|webgpu-gl`
(`scripts/lib/backend-flag.mjs`). The flag gives the lab the query
parameter, the Chromium switches that back end needs, and a check
(`assertBackend`) that fails the lab when the page drew on a different back
end than the one asked for. `make bench ARGS="--renderer=both"` runs the
benchmark on each back end and closes with the two side by side. The labs
that take the flag are `make bench`, `make screenshots`, `make world`,
`make sky` and `make profile`. `make sky` times the GPU sky's passes on
WebGL only. `make profile`'s WebGL meter counts nothing on the webgpu
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
| 2 Haze and lights | 2026-10-19 | webgl | 100 | 231 677 | 51 programs | 12.04 | 5.48 | 0 / 0 | the WebGL world shots (spawn, far) are pixel-identical to part 1's |
| 2 Haze and lights | 2026-10-19 | webgpu | 72 (72 before) | 89 025 | 42 programs, 29 pipelines (41, 29 before) | 505.16 (313.05 before) | 500.39 (309.02 before) | 11 passes / 38 meshes (11 / 38 before) | Every material drawn before is now hazed and lit as on WebGL, and nothing new is drawn. The submit is two mid-run frames compiling the larger hazed pipelines on SwiftShader (965 ms and 1 143 ms; the other readings are 7–8 ms) |
| 3 Sky | 2026-10-19 | webgl | 100 | 231 882 | 51 programs | 14.63 | 6.75 | 0 / 0 | the 18 WebGL world shots (seed 38; LOW and HIGH; 12, 17.5 and 23 h; vista, far, spawn) are pixel-identical to part 2's |
| 3 Sky | 2026-10-19 | webgpu | 75 (72 before) | 101 667 (89 025) | 48 programs, 32 pipelines (42, 29 before) | 686.38 (481.77 before) | 681.18 (477.73 before) | 10 passes / 35 meshes (11 / 38 before) | The dome, the far ranges and the sky's passes draw. The steady readings are 6–19 ms; the mean is the frames compiling the sky's pipelines on SwiftShader (one of 2 203 ms). At HIGH: 92 draws (89), 164 537 triangles (125 591), 73 programs and 48 pipelines (63, 43), 950.21 ms (497.81) with steady readings of 9–12 ms |

Parts 1 to 3 were measured with `make bench ARGS="--renderer=both --frames 60 --width
640 --height 360 --video low"` on seed 20 (the woods and a kicker, four skis).

## Systems ported

- [x] 1 Scaffolding: the seam, the device, the switch, the quarantine, the instruments, the lab flag, this ledger
- [x] 2 Haze and lights (`haze`): the fog node, the key, the sky, the lamps, the wall, the glows as sprites
- [x] 3 Sky (`sky-gpu`, `sky`): the dome, the night sky, the contrails, LOW's cloud shell, the far ranges, the LUT passes and the aerial volume, each as a node twin
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

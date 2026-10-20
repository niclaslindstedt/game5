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
| `trail-map` | pass | 5 | the stamps rasterised into the trail maps, the window's copy and the new snow's fill, each drawn by its node twin. Ported |
| `deform` | pass | 5 | the deform field's upload and its shade, drawn by its node twin. Ported |
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
| `terrain` | material | 4 | the clipmap's every level, its snow, its rock and a summer's ground, drawn by its node twin. Ported |
| `forest-batch` | material | 8 | the woods' multi-draw batch |
| `haze-graft` | material | 11 | a `hazeMaterial` with grafted GLSL of its own (the figures' gaits, the rock's keep, the tree cards…), each drawn again in its owner's part |
| `model-merged` | material | 12 | the merged models (the skis) |
| `wingsuit` | material | 12 | the wingsuit figure |
| `gore-tree` | material | 11 | the gore on a tree |

On the webgpu paths after part 5, the frame draws these:

- the sky: the dome with the sun, the moon, the stars and the Milky Way,
  the contrails and LOW's cloud shell, and the far ranges
- the ground: the clipmap's every level, its snow, its rock and strata, a
  summer's ground, and the deformable snow's mesh
- the snow's marks: every skier's furrows, grooves and berms, the swaths
  and belts the machines lay, the other skiers' lines through the
  corduroy, the tree wells, the avalanche's bed and debris, and the
  deformable snow's cuts, heaps and craters with the sun they hide
- the skier's body
- the gate poles, the netting and the fences
- the lifts, with their chairs and towers
- the lamps' glows
- the HUD

All of it is hazed and lit by the key and the sky as WebGL lights them, and
by the lamps at night. The frame does not draw the woods, the skis, the
cabins or the crowd. The benchmark report and the
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
- A material's own share of colour through the haze (`HAZE_KEEP`) is read
  by the ground since part 4 (`hazeOver`'s `keep`). The rock's own graft
  waits for its part (11).

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

## The ground (part 4)

The ground's material is a `MeshStandardMaterial` with `snow-glsl.ts`
grafted into it, so like the sky it gets a **node twin**.
`nodeTwin(material, "terrain", "ground")` flags it, and `groundSpecs` holds
what the twin is built over: the uniforms the graft reads (`shared`, the
level's `own`, the trail's and the haze's), whether it cuts the rooms, and
whether it is summer. `sky-twins-tsl.ts` answers the flag with
`terrain-tsl.ts`'s `groundTwin`. WebGL never reads either, so its picture is
the same to the bit.

| Piece | GLSL | TSL |
| --- | --- | --- |
| The vertex: the grid placed round the lens, the CDLOD morph, the four exact height fetches, the rim's rise, the loose cover, the skis' clearance, the hole under the finer level, the normal | `snow-vertex-glsl.ts`, `ski-clear.ts` | `terrain-tsl.ts` |
| What the snow is at a pixel: the ground map, the corduroy and its wear, the wind's crust and sastrugi, the ice, the rock and its share, the micro-relief, the new snow's cover | `snow-glsl.ts`, `snow-relief-glsl.ts` | `snow-sample-tsl.ts` |
| The hashes, the noise and its gradient, the glints | `snow-noise-glsl.ts` | `snow-noise-tsl.ts` |
| The rock's beds | `strata-glsl.ts` | `strata-tsl.ts` |
| The snow's own light: the sky by direction, the bumps' shadows and the thin edge, the flat light, the lamps with their glints and the piste light, the sun's wrap, glitter and glare, the shade lift | `snow-sky-glsl.ts`, `snow-sun-glsl.ts`, `snow-lamps-glsl.ts` | `snow-light-tsl.ts` (`SnowLightingModel`) |
| A summer's ground | `summer-glsl.ts` | `summer-tsl.ts` |
| The room cut | `room-cuts.ts` | `terrain-tsl.ts`'s `inRoomCut`, as the mask |

**How the twin is built:**

- `GroundMaterial` is a `MeshStandardNodeMaterial`. Its `positionNode` is
  the vertex above, and the world point and the mesh's normal go to the
  fragment as varyings. `setupDiffuseColor` samples the snow and colours
  it, and the roughness and the normal (off the ground map's slope, never
  the mesh's) are assigned there too. `SnowLightingModel` extends three's
  physical model: the sky replaces the hemisphere, and the snow's own steps
  run after three's lights, in WebGL's order. `setupOutput` hazes it
  through `hazeOver`, keeping the rock's own share (`HAZE_KEEP`).
- **One level's own uniforms are read off the material drawn.** Every
  level's material reads the same graph, so the node renderer builds the
  program's nodes once and draws every level with them. A uniform that
  names its own object would hand every level the first level's values,
  and one in the render group, whose buffer is one for the whole render,
  would hand them the last one's. So each ground material carries its
  level's centre, spacing and hole (and the deformable snow's mesh's grid
  and fold) as `userData.groundOwn` (`terrain.ts`), and the twin reads them
  with `materialReference` (`snow-sample-tsl.ts`'s `ownSlot`).
- **The renderer is told to refresh the ground every frame.** It refreshes a
  draw's uniforms only when the material's or the mesh's own fields move,
  and the ground's never do: its levels move by their uniforms alone. A
  node on the material (`groundNode`, set by `groundTwin`) makes it refresh
  every frame, as it does for any node material.
- **The lights' nodes read the material drawn, not the twin.** The snow
  lights its own lamps, so `groundTwin` marks the drawn material
  `ownLamps` too. Marked on the twin alone, the scene's lamps were added
  again and the floodlit piste at dusk was drawn about twice as bright.
- **The lit colour is a variable before the haze reads it.** `hazeOver`
  branches on display space. Built first inside one branch, three declared
  the lighting's constants (`dfg`, `multiScatteringCompensation`) again in
  the other, and the shader failed to compile.
- **No texture read takes three's uv matrix** (`tap` and `texel` in
  `haze-tsl.ts`). Three gives every `sample` a mat3 of its own in the
  object's uniforms. No map here has a transform, and the ground has dozens
  of reads, so that was 76 matrices a draw.
- The footprints the derivatives take (the glints' cells, the corduroy's
  and the cups' filters) are taken in uniform control flow, before the
  branches that read them.

**Stand-ins until their parts:**

- Part 5 (done; see the next section): the trail map's relief in the
  vertex and the furrows, grooves and wear per pixel; the piste tracks; the
  tree wells; the avalanche; the deformable snow's field.
- Part 6: the skiers' own shadow maps. Three's own shadow of the key is read.

**What the twin binds**, counted off the generated shaders of seed 38's
level material:

| Stage | WebGPU, LOW | WebGPU, HIGH | `webgpu-gl`, HIGH (WebGL2 caps each stage at 16) |
| --- | --- | --- | --- |
| Vertex | 3 textures, 1 sampler | 3 textures, 1 sampler | 3 texture units |
| Fragment | 6 textures, 4 samplers | 8 textures, 7 samplers | 8 texture units |

The vertex reads the ground map (sampled), the heights and the far rim
(both fetched by texel, with no sampler). The fragment reads the ground
map, the track's direction map, three's BRDF table, the mountain's shade,
the aerial-perspective atlas and the sky's table. At HIGH it also reads the
key's shadow map (a depth texture and its comparison sampler), and the sky
is HIGH's view table. The float maps that cannot be filtered are fetched by
texel and take no sampler. A summer map adds its two maps.

`tests/terrain_tsl_test.ts` holds the register, the flags, the specs, the
level's own uniforms on every material, and every twin built on plain Node
(plain, cut, deformed and in summer) with its mask and its refresh node.

## The snow's marks (part 5)

The trail maps (`trail-map.ts`) and the deformable snow's shade
(`deform-shade.ts`) are drawn by `ShaderMaterial` passes into render
targets of their own, so like the sky's passes each pass gets a **node
twin** (`trail-map-tsl.ts`), flagged with `nodeTwin` in the trail map's or
the field's family. The ground's twin then reads the maps those passes
fill. WebGL never reads either, so its picture is the same to the bit.

| Piece | GLSL | TSL |
| --- | --- | --- |
| The furrow's stamp (a capsule per segment, its profile, MAX-blended), the swath's and the belt's stamp, the window's copy as it follows the player, the new snow's fill (reverse-subtracted) | `trail-map.ts` | `trail-map-tsl.ts` |
| The deformable snow's shade: the field's height marched toward the sun, a cell at a time | `deform-shade.ts`, `deform-glsl.ts` | `trail-map-tsl.ts`'s `deformShadeTwin` |
| The trail map read: the depth and the berm, the swath and the belt, the relief, the field's weight and height, the sun it hides; the tree wells' depth | `trail-map.ts`'s `TRAIL_GLSL`, `deform-glsl.ts`, `tree-wells.ts` | `trail-tsl.ts` |
| The vertex lowered: a tent over the fine map close in, the coarse map further out, the field on its own mesh; the wells and the avalanche; the field's mesh folded only where no tool has touched it | `snow-vertex-glsl.ts` | `terrain-tsl.ts` |
| The furrows, the walls, the scuff and the trench per pixel; the skis' grooves; the belts' lugs; the wells' slope and albedo; the trench's light | `snow-trail-glsl.ts`, `ski-clear.ts`'s `SKI_GROOVE_GLSL` | `snow-trail-tsl.ts` |
| The other skiers' lines through the corduroy | `piste-tracks.ts` | `piste-tracks-tsl.ts` |
| The avalanche's bed, debris, lumps and albedo | `avalanche-glsl.ts` | `slide-tsl.ts` |

**How the passes are built:**

- **The maps keep WebGL's layout.** On the node renderer a target's row 0
  is at the top, and both of its back ends flip a render target's uv when
  it is sampled. So the stamp's quad is placed with clip y negated, and a
  full-screen pass's uv is `(x/2 + 1/2, 1/2 − y/2)`. A texel of the map
  then lies at `(p − origin) / span` on every path, and the ground reads it
  with the same uv on all three.
- **Every blend field is copied off the ShaderMaterial** (`passMaterial`):
  the stamp's MAX and the fill's reverse subtract, with every factor One.
- **The targets are three's own `RenderTarget`** on the node renderer, and
  WebGL's on WebGL (`createTrailMap(…, node)`, `createDeformShade(…,
  node)`).
- **A pass's bindings are refreshed every draw.** The renderer refreshes
  a draw's texture bindings only when the material's own fields move, and a
  pass's never do. Without that, the window's copy sampled the map a swap
  had just made its target, and WebGPU refused the frame. `passMaterial`
  puts a node on the source material (`passNode`), as `groundTwin` does.
- **The deformable snow's shade draws through a lens with a projection**
  (an orthographic camera), since the node renderer updates the lens it is
  handed.
- **The deformable snow's shade reads the field by texel**
  (`screenCoordinate`), which is not flipped.
- The empty field (`NO_DEFORM`) is wrapped as the field is, so one sampler
  fits both.

**How the ground reads them:**

- Each read is a real function of the generated shader (a layout Fn,
  `trailAt`, `trailRelief`, `deformAt`, `wellDepth`, `pisteLine`, `slideAt`
  and the rest). The vertex reads the relief nine times and the fragment
  reads it a dozen times. Inlined, each read would be that many copies.
  Each set of functions is made once per uniforms object, so no builder
  meets two functions of one name.
- **The vertex has its own set of those functions** (`trailSlots(t,
  true)`, named with a `V`). A function is generated once per material, and
  the textures it reads are named after the stage that built it first. Read
  from the other stage too, it named a binding that stage does not have,
  and the fragment failed to compile.
- The maps are re-pointed as the window moves (the fine map and its spare
  swap) and as the field is bound. Each texture node follows its slot
  every render (`texSlot`), with its `keep` in the graph.
- Every map is read at its first level, as the GLSL's `textureLod(…, 0.0)`
  reads it. The footprints (the lugs' phase, the track frame's, the
  slide's) are taken in uniform control flow.

**Still stand-ins:** the developer's trail corner (`trail-overlay`) and the
probe of the snow over the skis (`snow-under`) wait for part 14.

**What the ground binds after part 5**, counted the same way:

| Stage | WebGPU, LOW | WebGPU, HIGH | `webgpu-gl`, LOW | `webgpu-gl`, HIGH (WebGL2 caps each stage at 16) |
| --- | --- | --- | --- | --- |
| Vertex | 8 textures, 5 samplers (3, 1 before) | 8 textures, 6 samplers (3, 1 before) | 8 texture units | 8 texture units (3 before) |
| Fragment | 12 textures, 9 samplers (6, 4 before) | 14 textures, 13 samplers (8, 7 before) | 12 texture units | 14 texture units (8 before) |

Counted off the shaders seed 38's level material hands the driver (every
`texture_*` and `sampler` binding a stage declares, and every sampler
uniform on `webgpu-gl`). The vertex now also reads the coarse and the fine
trail map, the deformable snow's field, the well map and the avalanche's
debris. The fragment also reads the two trail maps, the field, the well
map, the debris and the other skiers' track frame. `webgpu-gl` stays two
units under WebGL2's cap at HIGH.

`tests/trail_tsl_test.ts` holds the register, every pass's flag and family,
the targets on each renderer, and every twin built on plain Node with its
blending.

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
| 4 Terrain and snow I | 2026-10-19 | webgl | 100 | 231 882 | 51 programs | 11.53 | 5.18 | 0 / 0 | the 24 WebGL world shots (seed 38; LOW and HIGH; 12 and 17.5 h; spawn, powder, track, far, vista, approach-90) are pixel-identical to part 3's. At HIGH: 110 draws, 686 162 triangles, 67 programs, 15.81 ms |
| 4 Terrain and snow I | 2026-10-19 | webgpu | 80 (75 before) | 143 959 (101 667) | 50 programs, 33 pipelines (48, 32 before) | 1 205.50 (863.36 before) | 1 200.86 (857.04 before) | 10 passes / 29 meshes (10 / 35 before) | The ground draws: every clipmap level, the warm-up mesh and the deformable snow's mesh. The steady readings are 7–12 ms; the mean is two frames compiling the ground's pipelines on SwiftShader (3 607 and 3 928 ms). At HIGH: 99 draws (76), 382 157 triangles (128 069), 75 programs and 49 pipelines (73, 48), 3 918.37 ms (1 168.06) with steady readings of 8–14 ms and one compiling frame of 11 669 ms |
| 5 Trails and deform | 2026-10-20 | webgl | 100 | 231 883 | 51 programs | 11.37 | 4.98 | 0 / 0 | the 14 WebGL world shots (seed 38; LOW and HIGH; track, furrow, tips, powder, lookback, chase-6, chase-10) are pixel-identical to part 4's. At HIGH: 110 draws, 686 010 triangles, 67 programs, 15.87 ms |
| 5 Trails and deform | 2026-10-20 | webgpu | 80 (80 before) | 144 327 (144 327) | 54 programs, 35 pipelines (50, 33 before) | 2 641.54 (1 200.00 before) | 2 636.21 (1 195.36 before) | 8 passes / 29 meshes (10 / 29 before) | The trail maps' passes and the deformable snow's shade run, and the ground draws every mark off them. The steady readings are 7–12 ms; the mean is one frame compiling the larger ground and the passes' pipelines on SwiftShader (6 776 ms; 3 863 before). At HIGH: 83 draws (82), 467 545 triangles (345 591: the deformable snow's mesh is kept fine where a tool has touched it), 81 programs and 52 pipelines (75, 49), 7 595.57 ms (2 873.97) with steady readings of 9–18 ms and one compiling frame of 28 194 ms (11 717) |

Parts 1 to 5 were measured with `make bench ARGS="--renderer=both --frames 60 --width
640 --height 360 --video low"` on seed 20 (the woods and a kicker, four skis).

## Systems ported

- [x] 1 Scaffolding: the seam, the device, the switch, the quarantine, the instruments, the lab flag, this ledger
- [x] 2 Haze and lights (`haze`): the fog node, the key, the sky, the lamps, the wall, the glows as sprites
- [x] 3 Sky (`sky-gpu`, `sky`): the dome, the night sky, the contrails, LOW's cloud shell, the far ranges, the LUT passes and the aerial volume, each as a node twin
- [x] 4 Terrain and snow I (`terrain`): the clipmap's vertices, the snow's sample, colour and light, the strata, summer, the room cut, each as the ground's node twin
- [x] 5 Trails and deform (`trail-map`, `deform`): the trail maps' four passes and the deformable snow's shade as node twins; the furrows, grooves, piste tracks, tree wells, avalanche and deformable snow in the ground's twin
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

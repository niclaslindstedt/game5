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
  `haze-tsl.ts`, `lights-tsl.ts`, `glow-tsl.ts` and every later part's TSL
  (the grade's `grade-tsl.ts`, handed to the picture as the seam's `post`). `tests/haze_tsl_test.ts`
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
| `clouds` | pass | 10 | the cloud shadow, MEDIUM's slab and HIGH's volume (its fresh share and its carried picture), each pass drawn by its node twin. Ported |
| `trail-map` | pass | 5 | the stamps rasterised into the trail maps, the window's copy and the new snow's fill, each drawn by its node twin. Ported |
| `deform` | pass | 5 | the deform field's upload and its shade, drawn by its node twin. Ported |
| `hero-shadow` | pass | 6 | the skiers' own shadow maps, one depth atlas, read by the key's light. Ported |
| `shadow-depth` | pass | 16 | WebGL's sun-map depth by kind and its opaque sort. The node renderer's shadow pass does not need it, so it stays WebGL-only until the GLSL goes |
| `env-warm` | pass | 6 | the warm-up: every pipeline built behind the card (`warmNode`). Ported |
| `grade-pass` | pass | 7 | the region's grade, the buzz and the blaze over the frame, with the tone map and the sRGB curve done by hand. Ported |
| `snow-under` | pass | 14 | the snow under the skis |
| `trail-overlay` | pass | 14 | the trail overlay |
| `gpu-timer` | pass | 14 | the timer queries |
| `haze` | material | 2 | the haze on a hazed material, with the key's extras, the shade lift and the lamps; a glow's fade. Ported |
| `sky` | material | 3 | the dome, the far ranges and the sky's passes, each drawn by its node twin. Ported |
| `particles` | material | 9 | the spray, the snowfall and the spindrift, the snow cloud and its shadow, the billboards, the sparks and the snow guns' plumes, each drawn by its node twin or, for a `gl_PointSize` point, by a stand-in a quad a point. Ported |
| `shader` | material | 11 | every other `ShaderMaterial`: the figures, then the effects in their own parts. The clouds' passes were the first of them, ported in part 10 |
| `terrain` | material | 4 | the clipmap's every level, its snow, its rock and a summer's ground, drawn by its node twin. Ported |
| `forest-batch` | material | 8 | the woods' multi-draw batch, drawn shape by shape instanced on the node renderer (`forest-nodes.ts`). Ported |
| `haze-graft` | material | 11 | a `hazeMaterial` with grafted GLSL of its own (the figures' gaits, the rock's keep, the tree cards…), each drawn again in its owner's part |
| `model-merged` | material | 12 | the merged models (the skis) |
| `wingsuit` | material | 12 | the wingsuit figure |
| `gore-tree` | material | 11 | the gore on a tree |

On the webgpu paths after part 10, the frame draws these:

- the sky: the dome with the sun, the moon, the stars and the Milky Way,
  the contrails, and the far ranges
- the clouds at every tier: LOW's shell, MEDIUM's slab, HIGH's and MAX's
  raymarched volume with the low deck, and their shadow on the ground and
  in the key's light
- the ground: the clipmap's every level, its snow, its rock and strata, a
  summer's ground, and the deformable snow's mesh
- the snow's marks: every skier's furrows, grooves and berms, the swaths
  and belts the machines lay, the other skiers' lines through the
  corduroy, the tree wells, the avalanche's bed and debris, and the
  deformable snow's cuts, heaps and craters with the sun they hide
- the shadows: the key's (cut where the mountain already shades the
  ground) and every skier's own at HIGH
- the skier's body
- the gate poles, the netting and the fences
- the lifts, with their chairs and towers
- the lamps' glows
- the woods: the faceted cuts, the card trees at MEDIUM and HIGH, the
  hand-over's dither between them, the snow on the boughs, the wind in the
  crowns, and their shadows in the key's map
- the particles and the air: the spray's sheet and wall, the snowfall and
  the spindrift, the snow cloud and its shadow on the slope, the crash's
  fire and smoke and every other billboard, the sparks and the snow guns'
  plumes
- the region's grade over the whole frame, and the buzz and the blaze
- the HUD

All of it is hazed and lit by the key and the sky as WebGL lights them, and
by the lamps at night. The frame does not draw the skis, the cabins, the
crags or the crowd. The benchmark report and the
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

  `region-picture.ts`'s `drawsStraight` is that decision. Since part 7 the
  same picture draws on every back end, and on the node renderer it tells
  the haze every frame where to mix (`NodePicture.hazeInDisplay`).
- **How the fog node squares the two.** Where the frame goes straight onto
  the canvas, through three's own output pass, the fog node:
  1. carries the material's colour and the air's into display space, using
     the output pass's own transform (`toDisplay`);
  2. mixes them there;
  3. carries the result back (`fromDisplay`).

  The output pass then lands on the pixel WebGL makes. Where the frame
  goes through the grade's target, the fog node mixes in linear light, as
  WebGL does. A pixel with no haze keeps its colour to the bit. No region's
  grade is the identity today, so every frame goes through the target on
  every back end (part 7), and the display-space mix waits for a neutral
  row.

**Where the two paths still differ:**

- **The lit colour under the haze** was 8–15 levels lower in blue on the
  webgpu paths from part 1 to part 6, the dome's sky as much as a lit
  surface. It was the grade: the alpine is graded, its shade split pulls
  everything below white toward a deep blue, and the node frame went
  straight to the canvas without it. Part 7 draws the grade and closes it
  (see part 7 for the measurement).

- **Three's NODE ACES fit is not quite its GLSL one.** The node fit also
  multiplies the `0.432951` by `0.983729`, so three's node output pass is a
  hair darker in the mid-tones. The grade's pass (part 7) tone maps with the
  GLSL fit by hand (`grade-tsl.ts`'s `acesGlsl`), so a graded frame matches
  WebGL's. The fog node's inverse is still the node fit's, because that is
  the one a frame drawn straight goes through.

**Stand-ins until their parts:**

- The aerial-perspective volume (`aerialShade`) is read since part 3, as
  WebGL reads it.
- The clouds' shadow on the key is read since part 10.
- The skiers' own shadow maps are read since part 6.
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
- Until part 10, LOW's cloud shell was every tier's on the webgpu paths:
  MEDIUM's slab and HIGH's volume are pictures drawn before the frame, and
  those passes were skipped. A deck that WebGL's volume closes over the
  whole sky (OVERCAST at HIGH) left a strip of sky at the top of the frame.
  Part 10 draws the passes, and the dome reads their picture by its tier.

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
- Part 6 (done; see its section): the skiers' own shadow maps, and the
  mountain's cut in the key's.

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
  Each set of functions is made once per uniforms object and, since part 6,
  once per ground material (see part 6's traps).
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

## The shadows and the warm-up (part 6)

The key's shadow, the mountain's cut in it and the skiers' own shadow maps
now draw on the webgpu paths, and the warm-up builds every pipeline behind
the loading card. WebGL's code path is untouched, so its picture is the same
to the bit.

| Piece | WebGL | Node renderer |
| --- | --- | --- |
| The key's shadow map: PCF (three's Vogel disk under interleaved gradient noise on both renderers), the key's bias and normal bias, the size the SHADOWS stop gives it, its cadence (`autoUpdate` / `needsUpdate`), the shadow box's fit and its rim fade | three's `WebGLShadowMap`, `shadow-box.ts`, `haze.ts` | three's `ShadowNode`, read by `lights-tsl.ts`'s key through `shadowFaded`, over the same light and the same box |
| A caster cut where the mountain already shades it, so a lift's shadow does not double the mountain's | `terrain-shade.ts`'s `createShadeDepth` graft on each caster's `customDepthMaterial` | `shadows-tsl.ts`'s `KeyShadowNode`: each caster `castInLight` dressed gets the mountain's mask as its `maskShadowNode` (`castMask`) |
| The skiers' own shadow maps: a quarter each of one depth atlas, nine comparing taps, the darkest of them and the key's | `hero-shadow.ts`, `HERO_SHADOW_GLSL` | `hero-shadow.ts` (a node `RenderTarget`, the matrices from `heroBias`), `shadows-tsl.ts`'s `heroShadowed`, folded into the key's light |
| The depth the skiers' passes draw with | `createShadeDepth` | `shadeDepthTwin`, picked by the dressing off the material's `shadeCast` flag |
| The warm-up | `environment.ts`'s `warm` (three's `compile` by parts, the trail passes' compile, the shadow map drawn once) | `environment.ts`'s `warmNode`, then `RenderSeam.settled` |

`shadow-depth` stays a WebGL-only pass, and its row now names part 16. On
WebGL it sorts the sun map's depth by kind and draws the opaque casters in
order. The node renderer draws its shadow pass with an override material of
its own and reads each caster's mask off it, so the pass has nothing to do
there. It is deleted with the GLSL.

**How the warm-up works.** The node renderer builds a pipeline the first
frame a draw needs it, on the thread that draws. A frame that meets a new
material stalls for as long as the device takes to compile it. That was
seconds on SwiftShader and is a hitch on a phone. So `warmNode` draws the
whole scene once, behind the card, through one pixel of the canvas (a 1×1
scissor). Every mesh is shown and none is culled. What the quarantine hides
is left out, and so is the deformable snow's mesh (see the traps). The key's shadow pass is drawn into it with its box opened over
the whole map. Then `RenderSeam.settled` waits for the device to finish:
`onSubmittedWorkDone` on WebGPU, and a polled fence on `webgpu-gl`. That
wait matters as much as the draw. A software device compiles a pipeline's
code the first time it RUNS it, not when it is made. Without the wait, the
first frame of the run paid for the warm-up's queue: no pipeline was made
mid-run, but the first frame took 31 s at LOW.

**The traps:**

- **Three keeps a function's code once per renderer.** A layout `Fn`'s
  WGSL is cached by the function node, back end wide, and the uniforms it
  names are declared only in the first program that built it. The plain,
  the cut and the summer ground are three programs. When they shared one
  set of trail, well and slide functions, the second one to build failed
  with `struct member nodeUniformN not found`. This was latent since part 4:
  it bites the first frame a cut or summer ground appears mid-run, and the
  warm-up, which shows every variant at once, made it certain. So each ground
  material builds its own set (`trailSlots(t, vertex, own)`, `wellReader`,
  `slideSlots`).
- **A shadow map's depth texture is made twice.** Three makes it as a
  plain texture the first time a material binds it, and makes it again
  under the bindings the first time its pass draws into it. Every pipeline
  built in between stays bound to the texture destroyed, and the device
  refuses every frame after. The first frame of a run hides this, because
  it draws the map before it binds it. The warm-up binds first. So
  `KeyShadowNode` makes the map as a target on the GPU in the same breath
  (`initRenderTarget`).
- **The deformable snow's mesh is not warmed.** It is hidden until the
  field is on and the lens is over it. When the warm-up drew it, the
  clipmap's far levels were drawn grey and unhazed for the rest of the run
  (the far ranges at HIGH, the far disc at LOW). It made no difference
  whether it was drawn before the levels or after them in a second pass, or
  whether it had a program of its own. Drawing the same mesh with a level's
  material left the picture right, so the cause is in the mesh's own
  material. The cause is not pinned. The mesh asks to be left out
  (`userData.warmApart`) and is built the first frame it is drawn, as before
  part 6.
- **`compileAsync` is not a warm-up here.** In r186 it skips the shadow
  pass (`_isPreCompiling`). It also applies each object's overrides
  straight away but builds their nodes later, so the ground's shadow twin
  is built without its mask. A real draw through one pixel builds the
  real thing.
- **`.element(i)` on a `vec4` slot is the whole vector**, read as an
  array. The atlas's per-slot switches and biases are read with `.x`, `.y`,
  `.z` and `.w`.
- **The node atlas is top down.** A quarter's viewport is counted from the
  top on both node back ends, and a sampled v runs down. `heroBias` writes
  the matrices with v flipped, and with WebGPU's clip z in 0..1. A target's
  scissor applies only with the canvas's scissor test on, so the atlas
  draws by viewport alone on the node renderer.

**What a draw binds after part 6**, counted on `webgpu-gl` (sampler
uniforms per stage of every linked program, race on seed 20; WebGL2's floor,
and a phone's, is 16 a stage):

| Program | LOW, before | LOW, after | HIGH, before | HIGH, after |
| --- | --- | --- | --- | --- |
| The ground, fragment | 12 | 12 | 14 | 15 |
| The ground, vertex | 8 | 8 | 8 | 8 |
| A lit object (the gates, the lifts, the skier's body), fragment: the most common, and the most | 4, 5 at most | 4, 5 at most | 6, 6 at most | 7, 8 at most |

At HIGH the ground reads the skiers' atlas besides the key's map, and a lit
object reads it too. Below HIGH the atlas is off and LOW binds nothing more than
before. The ground stays a unit under the cap.

**The warm-up, measured.** The race on seed 20 at 640×360, from the moment
the card lifts, on SwiftShader's WebGPU:

| | LOW, before | LOW, after | HIGH, before | HIGH, after |
| --- | --- | --- | --- | --- |
| Pipelines built mid-run | 6 | 0 | 2 | 0 |
| First frame after the card | 17 672 ms | 3 258 ms | 24 509 ms | 7 717 ms |
| Worst frame of the run | 18 822 ms | 3 475 ms | 25 521 ms | 11 154 ms |
| Median frame | 1 420 ms | 1 481 ms | 5 639 ms | 5 583 ms |
| Load, to the card lifting | 69 s | 108 s | 72 s | 122 s |

The race is watched for 90 s (LOW) and 150 s (HIGH) after the card lifts,
at 640×360. The compiles move under the card, and the load is longer by
what they cost. At HIGH the worst frame left comes two minutes in and is
the device's steady work, not a compile. `webgpu-gl` at HIGH builds no
program mid-run either (207 are linked before the card).

**Stand-ins left:** none here. The clouds' shadow on the key
(`cloudShadow`) was 1 until part 10.

`tests/shadows_tsl_test.ts` holds the register rows, `heroBias` (WebGL's
literal, and both node layouts), the atlas on each renderer, the
`shadeCast` flag, the node half built on plain Node and re-pointed, the
key's map masking only a dressed caster, and `warmNode`'s draw and
everything it puts back.

## The grade and the post (part 7)

The region's grade, the buzz and the blaze now draw on the webgpu paths.
WebGL's code path is untouched, so its picture is the same to the bit.

| Piece | WebGL | Node renderer |
| --- | --- | --- |
| Where the frame is drawn | `grade-pass.ts`'s half-float `WebGLRenderTarget`, multisampled as the ANTIALIAS row asks | the same pass over three's own `RenderTarget` (`createGradePass(samples, node)`) |
| What decides it | `region-picture.ts` (`drawsStraight`, the samples, the buzz, the blaze) | the same picture, handed the seam's `post` (`NodePicture`): the canvas's samples, the node grade, where the haze mixes, the counters |
| The pass | a `ShaderMaterial` quad, `GRADE_FRAGMENT` | `grade-tsl.ts`'s `gradeOutput` on a `RenderPipeline`, over the pass's own uniforms by reference |
| The tone map and the sRGB curve | three's `tonemapping_fragment` and `colorspace_fragment` in the quad | done by hand in the quad (`acesGlsl`, `sRGBTransferOETF`), the pipeline's `outputColorTransform` off |
| The warm-up | three's `compile` against the pass's target | `warmNode` draws through one pixel of the pass's target, the target the caller set |

**The order is WebGL's.** Three's node output transform would run after
everything the quad does. WebGL's pass tone maps before the grade and
encodes after it, so the quad does both itself, in that order: the buzz's
and the shimmer's reads, the tone map, the grade, the buzz's edges and the
blaze, the sRGB curve. The scene is drawn into the target in linear light
(the node renderer tone maps nothing into a target), so the haze mixes
there as WebGL's does (`hazeInDisplay(false)`).

**The steady blue deficit was the grade.** Parts 1 to 6 measured the node
frame 8–15 levels short in blue, the dome as much as a lit surface, and
looked for it in the output pass and the canvas. Neither is the cause. A
patch of flat colour drawn by a `MeshBasicMaterial` with ACES and sRGB
lands on the same canvas byte, to a level, on WebGL, WebGPU and `webgpu-gl`,
read back from the canvas or from a screenshot. Drawn in the game, the
same patch came out as (134, 182, 234) on WebGL and (137, 179, 220) on
WebGPU. Only WebGL's moved. The alpine's grade is not the identity (a
shade split toward `#3f6ab0`, a touch of contrast and colour), and the
grade's model (`gradeTone`) takes (136, 179, 219) to (133, 182, 234).
Every WebGL frame went through the grade, and the node frame went
straight to the canvas without it. `colour-grade.ts`'s comment that the
alpine is the identity was stale and is corrected.

Measured on `make world SEED=38` at 1280×720 (spawn, chase-6, track, far),
as webgpu's mean minus WebGL's on the same view, in canvas levels (R, G, B).
The sky is the top 120 rows and the snow the bottom 240, each averaged over
the four views:

| Quality | Hour | Sky, before | Sky, after | Snow, before | Snow, after |
| --- | --- | --- | --- | --- | --- |
| LOW | 9 | +3.3 −1.3 −12.6 | +0.2 +0.2 +0.2 | −0.6 −2.1 −9.0 | −0.7 +0.1 +0.6 |
| LOW | 12 | +3.0 −1.8 −13.0 | +0.2 +0.2 +0.2 | −2.5 −3.7 −9.8 | −1.3 −0.6 −0.3 |
| LOW | 16.5 | +1.0 −1.1 −8.8 | +0.1 +0.2 +0.3 | −1.7 −1.5 −4.9 | −2.0 −1.7 −1.5 |
| HIGH | 9 | −4.8 −6.5 −12.8 | −8.0 −4.9 +0.3 | +5.8 +2.7 −6.6 | +5.6 +4.8 +3.2 |
| HIGH | 12 | −5.2 −7.1 −13.8 | −8.2 −5.1 −0.3 | −2.6 −3.9 −10.1 | −1.6 −0.9 −0.3 |
| HIGH | 16.5 | −7.2 −5.3 −5.6 | −8.5 −3.5 +5.1 | +5.9 +3.1 −4.0 | +5.2 +2.6 −0.2 |

At LOW the sky now matches WebGL's to a fifth of a level, and the snow to
one or two. The blue is gone at HIGH too. What is left at HIGH is not the
grade. The sky's red is the clouds, which the webgpu paths still draw as
LOW's shell (part 10). The snow's few levels in the morning and the late
afternoon are the woods' and the cabins' shadows and shapes, which are not
drawn there yet (parts 8 and 13). `webgpu-gl` measures the same as WebGPU
to a fifth of a level. The buzz and the blaze, forced on over seed 38's
far view at LOW, land within a level of WebGL's on both node back ends,
the flames rising from the foot of the frame on all three.

**What a draw binds after part 7**, counted on `webgpu-gl` the same way
(seed 38's spawn view): the grade's quad binds one texture unit. The most
any fragment program binds is 12 at LOW and 15 at HIGH, the ground, as
before. The most any vertex program binds is 8.

**The traps:**

- **The alpine is graded.** `isNeutral` is false for every region today,
  so a frame drawn straight onto the canvas is never the normal case on
  any back end. The display-space haze (`toDisplay`, part 2) now serves
  only a neutral row, and none exists.
- **A target's scissor is its own.** On the node renderer a render target
  is cut by its own `scissor`, and only while the canvas's scissor test is
  on. So `warmNode` sets the target's scissor to one pixel and puts it
  back.
- **A pipeline is built for its target.** The pass's target is half float
  at the ANTIALIAS row's samples, and the canvas's frame is drawn at the
  canvas's samples. So the warm-up draws into the target the frame will
  use, and changing the ANTIALIAS row builds new pipelines.
- **Three's node ACES fit is not its GLSL one** (part 2). The grade uses
  the GLSL fit, restated in `acesGlsl`, and `tests/grade_tsl_test.ts`
  holds it to three's chunk.

`tests/grade_tsl_test.ts` holds the register row, the alpine's grade
behind the deficit, the pass on each renderer over one set of uniforms,
the picture's order on the node renderer (the haze told, the scene into
the target, the grade after, the counters before it), the node grade
built on plain Node as a `RenderPipeline` with its output transform off,
every number of `GRADE_FRAGMENT` restated in the TSL, and the warm-up
through a target's own scissor.

## The woods (part 8)

The woods now draw on the webgpu paths: the faceted cuts, the card trees,
the hand-over between bands, the snow on the boughs, the wind in the crowns
and the trees' shadows in the key's map. WebGL's code path is untouched, so
its picture is the same to the bit.

| Piece | WebGL | Node renderer |
| --- | --- | --- |
| The draw | one `BatchedMesh` a batch, sent as one `multiDraw*InstancedWEBGL` a pass (`forest-batch.ts`, `multi-draw.ts`): a sub-draw a shape, each drawn once a tree | `forest-nodes.ts`: every shape a mesh of its own in each pass that draws it, an `InstancedBufferGeometry` drawn once a tree listed for it — one draw a shape in use |
| Which tree a vertex is | `gl_DrawID` finds the shape's run of the list, `gl_InstanceID` the slot in it | the shape's own instanced `treeWord`, the same 32-bit word (`slotWord`: the tree, the dither window) |
| The tree table | every tree's matrix and numbers in two float textures, written once a map | the same two textures, read by texel (`forest-tsl.ts`'s `treeFrame`) |
| The girth, the wind | `GIRTH_VERTEX`, `TREE_WIND_VERTEX` | `treeFrame`; the matrix's inverse is its columns over their squared lengths, since a tree's matrix is a turn and a stretch |
| The faceted cuts' snow and tint, the dither | `TREE_SNOW_VERTEX`, `graftTree` | `TreeMaterial`: the tint a varying, the dither the `maskNode` |
| The card trees | `tree-card-material.ts`'s `graftCards`, `graftCardTree` | `CardTreeMaterial`: the atlas's four channels, the snow by the sky and the load, the edge-on fade, the underside, the backlight as the `emissiveNode` off the key's colour and direction |
| The casters | the batch's second list, drawn through `createShadeDepth` with the batch's graft | meshes of their own, on a layer only the key's shadow camera sees (`WOODS_CASTERS`), drawn by a `positionNode` and cut by `castMask` |
| How the materials reach the forest | `forest.ts` makes them | the dressing makes a kit (`woodsKit`) and the seam hands it to `forest.ts` (`RenderSeam.woods`); `forest.ts` imports nothing of three's node half |

**What stays the same:** the bands, the draw distance, the far share, the
variants, the card band and the casters by the FOREST, DISTANCE and SHADOWS
rows (`settings-video.ts`); the cells, the frustum test, the hand-over and
the casters' set (`forest.ts`). Both back ends fill the same lists from the
same code, and `tests/forest_tsl_test.ts` holds that they list the same
trees at every FOREST stop. The tree wells' trunks are a plain hazed
instanced mesh and drew from part 2; the wells in the snow are the
ground's (part 5).

**A shape's room is counted, never grown.** Each shape's draw holds every
tree that can be drawn as it (`roomOf` over the map's trees and their rows),
so its buffer is made once with the batch and only its first `n` words are
sent each refill.

**The traps:**

- **A `BatchedMesh` draws one instance a sub-draw on the node renderer.**
  The multi-draw's instanced twin has no path in three's node back ends, so
  the woods are drawn shape by shape. That is a draw a shape in use (see
  the counts below) where WebGL makes one a pass. Indirect draws off a
  compute cull (part 17) take it back to a few.
- **The shadow pass reads its position off the material it is handed**,
  the object's own, not its node copy (`Renderer.renderObject`). A classic
  material flagged for a twin would be drawn into the key's map without its
  vertex. So the woods' materials are node materials from the start,
  made by the dressing, and the casters' material carries its
  `positionNode` and its `maskShadowNode`.
- **A picture's mesh that must not cast, and a caster that must not be
  seen.** WebGL's batch draws two lists off one object. Here the casters
  are meshes of their own with `castShadow` on, on a layer the lens never
  enables. Three's shadow pass keeps a shadow camera's own layers once any
  layer past the first is on, so the dressing enables `WOODS_CASTERS` on the
  key's shadow camera. The skiers' atlas (layers 7 to 10) never sees them.
- **A void `Fn` adds itself to the stack when it is called.** Calling
  `.toStack()` on it as well would run the vertex twice.

**What the draw costs in calls.** The benchmark's race on seed 20 counts the
woods as 34 objects at LOW (25 254 triangles, as WebGL's one batch) and 147
at HIGH (162 382 triangles against WebGL's two objects of 150 694; the extra
is the casters, which WebGL's tally does not count apart). The frame's draw
calls go from 79 to 114 at LOW and from 85 to 223 at HIGH, where the card
band, the faceted bands and the casters each draw a shape at a time.

**How near the picture came.** `make world SEED=38` on webgpu against WebGL,
the mean absolute difference per channel (0 to 255) over 9, 12 and 16.5 h,
before this part and after it:

| FOREST | spawn | chase-6 | track | far | forest |
| --- | --- | --- | --- | --- | --- |
| LOW | 4.5 → 3.3 | 4.0 → 2.5 | 6.6 → 3.0 | 4.7 → 2.8 | 52.6 → 1.9 |
| HIGH | 9.1 → 4.7 | 12.1 → 4.5 | 10.5 → 4.7 | 14.4 → 4.0 | 41.8 → 2.1 |

What is left is what the other parts still owe (the cabins, the crags, the
crowd, the particles and the clouds). The 30 WebGL shots are pixel-identical
to part 7's.

**What a draw binds after part 8**, counted on `webgpu-gl` the same way
(sampler uniforms per stage of every linked program, race on seed 20):

| Program | LOW | HIGH |
| --- | --- | --- |
| The faceted cuts, vertex / fragment | 2 / 4 | 2 / 7 |
| The card trees, vertex / fragment | — | 2 / 8 |
| The casters, vertex / fragment | — (LOW casts no trees) | 2 / 1 |
| The most any program binds, vertex / fragment | 8 / 12 (the ground, as before) | 8 / 15 (the ground, as before) |

The vertex reads the tree table's two textures. The card trees' fragment
adds the atlas to what a lit object binds. The casters' fragment reads the
mountain's shade. Every program stays under WebGL2's 16.

`tests/forest_tsl_test.ts` holds the register row, a forest handed the
kit holding no batch, its picture's meshes casting nothing and its casters
on their own layer, the same trees listed as WebGL's batch at every FOREST
stop, each shape's room and words, and the kit's materials made on plain
Node.

## The particles and the air (part 9)

The spray, the snowfall and the spindrift, the snow cloud and its shadow on
the slope, the billboards (the crash's fire and smoke, the halos, a gun's
beads and smoke, the balloon's flame), the sparks and the snow guns' plumes
now draw on the webgpu paths. WebGL's code path is untouched, so its
picture is the same to the bit.

| Piece | WebGL | Node renderer |
| --- | --- | --- |
| The spray, the CPU pool | `spray.ts`'s instanced quads, `spray-glsl.ts`'s `sprayVertex` and `SPRAY_FRAGMENT` | `spray-tsl.ts`'s `sprayTwin` over the same packed grains (`poolParcel`) |
| The spray, the GPU ring | `gpu-spray.ts`: each parcel flown in the vertex stage (`SPRAY_FLIGHT_GLSL`) | the same flight in TSL (`spray-flight-tsl.ts`'s `ringParcel`: the steps, the slide, the seed off the instance), then the same draw as the pool's |
| The snowfall | `snowfall.ts`'s instanced quads: the box about the lens, the smear over the shutter | `snowfall-tsl.ts`'s `fallTwin` |
| The spindrift | `THREE.Points` sized by `gl_PointSize` | a stand-in: one quad mesh instanced a grain over the points' own buffers, as many device pixels across as the point (`driftStand`) |
| The snow cloud and its shadow | `snow-cloud-glsl.ts`'s puffs and `snow-cloud-shadow.ts`'s blots, instanced quads | `snow-cloud-tsl.ts`'s `cloudTwin` and `shadowTwin` |
| The billboards | `billboards.ts`: one instanced batch a texture, mode 0 the texture's cell, 1 the fire, 2 the smoke | `billboards-tsl.ts`'s `billboardTwin`, a twin a batch |
| The sparks' heads | a `PointsMaterial` | a glow's sprite with nothing faded, held a pixel across as WebGL holds a point (`glow-tsl.ts`, `sprite: "plain"`) |
| The plumes | `snow-gun-plume.ts`'s instanced quads | `plume-tsl.ts`'s `plumeTwin` |
| The light in the air | `snow-air-light.ts` (the key by height, the sky on four faces), the lamps' loop, `HAZE_AMOUNT_GLSL` | `air-tsl.ts`: `airLight`, `airSky`, `lampsThrough`, `lampsAt`, `airHaze`, shared by every twin |

**What stays the same:** every count, share and size. The SPRAY row's
share, the grains a pool holds, the ring's parcels, the flakes a weather
lets fall and the cloud's puffs are decided by the same code on every back
end (`settings-video.ts`, `spray.ts`, `snowfall.ts`, `snow-cloud.ts`), and
every one of these but the spindrift and the sparks' heads was already one
instanced quad a particle on WebGL. Only the two `gl_PointSize` users needed
a new draw. A stand draws exactly as many quads as WebGL draws points (the
points' draw range), and the points are kept out of the frame while it
does.

**The twins read the ShaderMaterial's own uniforms by reference**, as the
sky's do (part 3). Each system's material carries its flag
(`nodeTwin(material, "particles", kind)`), and `particle-twins-tsl.ts`
hands the twin for it. The pipeline (the blending, the depth, the polygon
offset) is still the ShaderMaterial's. The cloud's shadow keeps its
MULTIPLY.

**The traps:**

- **Materials with the same code share one program on the node renderer.**
  It keys a draw's program by the material's own fields and its
  `customProgramCacheKey`, and `userData` is not one of them. Every
  billboard batch is its own ShaderMaterial with one shader, so they all
  shared the first batch's node state: its texture, its cells and its
  clock. `nodeTwin(…, own)` gives each such material a field of its own
  (`twinOwn`), and the key tells them apart. Only the billboards need it:
  every other system has one material.
- **A twin's bindings are refreshed only if the material drawn has a node.**
  The node renderer's material observer refreshes a draw fully when the
  material has a node property, and otherwise only what it thinks changed.
  A ShaderMaterial has none, so the clock and the lens stood still. Each
  twin hangs its fragment node on the ShaderMaterial (`twinNode`), as the
  trail map's passes do.
- **A texture read after a branch is refused on WebGPU.** An implicit-LOD
  read must be in uniform control flow, and a fragment that may be
  discarded leaves it. The cloud's noise has no mips, so it is read at its
  first level (`.level(0)`), the texel WebGL's read finds. The billboards'
  texture is read before the modes branch, and the piste lights' table at
  its first level.
- **GLSL's `mod` is not TSL's.** GLSL's `mod` is `x - y * floor(x / y)`,
  and a back end's `%` keeps the sign of `x`. The box about the lens and a
  plume's puff's age are restated as the GLSL has them.
- **A plain attribute handed to `instancedBufferAttribute` is read by the
  vertex.** The node renderer steps a buffer by the instance only when the
  attribute itself is an `InstancedBufferAttribute`. The spindrift's stand
  first read its points' plain buffers, so every quad was drawn between the
  first four grains. On seed 38's powder and furrow views at LOW the slope
  under the lens was washed white. A stand now reads
  instanced mirrors of the points' buffers over the same arrays
  (`glow-tsl.ts`'s `perPoint`), brought up to their sources' versions each
  frame. The glows' sprites (part 2) read their positions and colours the
  same way now.
- **An empty stand is still drawn.** A stand with no points has no
  instances, and three skips its draw. It still builds its pipeline, so it
  is kept visible, and the warm-up builds it behind the card rather than
  the first frame a grain blows.

**What the warm-up builds.** Every pipeline the race needs is built
behind the card, the new ones too. Watched on SwiftShader's WebGPU at LOW,
the race builds 47 pipelines where it built 42. The five new ones (the
spray, the fall, the spindrift's stand, the cloud and its shadow) are built
in the warm-up's burst. The three built after the card lifts are built
there before this part as well.

**How near the picture came.** `make world SEED=38` on webgpu against
WebGL, the mean absolute difference per channel (0 to 255) over 9, 12 and
16.5 h, before this part and after it. The whole frame, and the box round
the skier's feet where the spray and the cloud are thrown (520×420 px):

| Quality | View | Whole frame | Round the feet |
| --- | --- | --- | --- |
| LOW | powder | 3.6 → 3.5 | 4.7 → 4.3 |
| LOW | landing | 3.3 → 3.3 | 2.9 → 2.8 |
| LOW | far | 3.4 → 3.3 | 2.9 → 2.7 |
| HIGH | powder | 6.4 → 6.2 | 6.3 → 5.4 |
| HIGH | landing | 5.2 → 5.2 | 4.2 → 4.0 |
| HIGH | far | 5.4 → 5.3 | 4.3 → 3.9 |
| LOW, snowing at 12 h | powder | 1.7 → 1.6 | 3.6 → 3.4 |
| HIGH, snowing at 12 h | chase-6 | 1.6 → 1.3 | 3.7 → 3.5 |
| HIGH, snowing at 12 h | powder | 1.7 → 1.5 | 3.5 → 3.2 |

The spawn, chase-6 and furrow views hold within a tenth of a level. What
is left is what the other parts still owe: the skis (part 12) and the
crowd (part 11), which stand right where the spray is thrown. `webgpu-gl`
lands within 0.7 of WebGPU on every view. The 42 WebGL shots (LOW and HIGH,
9, 12 and 16.5 h, and snowing at 12 h) are pixel-identical to part 8's.

**What a draw binds after part 9**, counted on `webgpu-gl` the same way
(sampler uniforms per stage of every linked program, race on seed 20):

| Program | Vertex / fragment, LOW and HIGH |
| --- | --- |
| The spray | 1 / 2 |
| The snowfall | 1 / 0 |
| The spindrift's stand | 0 / 0 |
| The snow cloud | 1 / 3 |
| The cloud's shadow | 1 / 0 |
| The most any program binds | 8 / 12 at LOW, 8 / 15 at HIGH (the ground, as before) |

Each vertex stage but the stand's reads the piste lights' table. The spray's
and the cloud's fragments read it again where a beam lights the snow in the
air, and the cloud reads its noise besides. The billboards and the plumes
are not drawn in the race and were not counted. Every program stays under
WebGL2's 16.

`tests/particles_tsl_test.ts` holds the register row, every system's flag
(the spindrift's and the sparks' as stands), the billboards' keys apart and
nobody else's, every twin made on plain Node once a material as a node
material over its ShaderMaterial's pipeline, and the stands drawing as many
quads as WebGL draws points, hiding the points and putting them back.

## The clouds (part 10)

The clouds' passes now run on the webgpu paths: the shadow map the ground
and the key read, MEDIUM's slab and HIGH's and MAX's raymarched volume.
Before this part every tier drew LOW's shell and the key's cloud shadow was
1. WebGL's code path is untouched, so its picture is the same to the bit.

| Piece | WebGL | Node renderer |
| --- | --- | --- |
| The shadow map | `clouds.ts`'s pass: a layer's optical depth a channel, over the span the ground lies in | `cloud-pass-tsl.ts`'s `shadowPassTwin`, into a `RenderTarget` of the node renderer's own |
| The shadow on the ground and in the air | `CLOUD_GLSL`'s `cloudShadow`, in `hazeMaterial`'s key (`DIR_INFO`) and `snow-air-light.ts` | `cloudShadow` / `cloudShadowSlots` in `cloud-pass-tsl.ts`, read by the key's light node (`lights-tsl.ts`) and `air-tsl.ts`'s key |
| MEDIUM's slab | `CLOUD_SLAB_GLSL`, `STEPS` and `LIGHT` by tier | `slabTwin`: the same march, its light reads unrolled |
| HIGH's volume, whole | `cloud-volume.ts`'s `MARCH` with `WHOLE` | `cloud-volume-tsl.ts`'s `marchTwin` |
| HIGH's volume, a fresh share | `MARCH` into two attachments: the cloud and its distance | `marchTwin`: one march, its two outputs off a TSL struct, into a target of `count: 2` |
| HIGH's volume, carried | `CARRY`: the fresh texels as they are, the rest reprojected off the last picture and clamped to the fresh neighbourhood | `carryTwin`, the texel reads at their centres |
| The volume's noise | two 3D textures | the same noise laid on 2D sheets (`noiseAtlas`, part 3), every channel |
| The dome | reads the pass's picture by its tier (`CLOUD_SLAB`: 0 the shell, 1 the slab's tent, 2 the volume's picture) | `sky-dome-tsl.ts` the same, `CLOUD_SLAB` read off the defines each frame |

The low deck and the sea of cloud are the volume's and the haze's (part 2)
and come with them. Each pass is a full-screen `NodeMaterial`
(`cloudPass`) over its ShaderMaterial's own uniforms. `nodeTwin` names it
(`clouds` / `cloud-map`, `cloud-slab`, `cloud-march`, `cloud-carry`), and
`sky-twins-tsl.ts` makes it the first time the pass is drawn.
`clouds.ts` and `cloud-volume.ts` decide what is drawn when on every back
end, and only the target's class differs (`cloudTarget`).

**The `shader` row** moved to part 11. It held every ShaderMaterial not
ported yet, and the clouds' were the first of them. It now names the
figures' and the effects'.

**Traps found here:**

- **A vec4 slot's `.element(k)` is the whole vector**, not its k-th
  component. The shadow's per-layer optical depth is read by name
  (`.x`, `.y`, `.z`). With `.element` WGSL compared a float with a vec4 and
  refused the pipeline.
- **A stage takes at most 12 uniform buffers on WebGPU.** Each uniform
  array is one buffer of its own, so the volume's march, with eleven arrays
  a layer, came to 13. `packLayers` (`cloud-shell-tsl.ts`) packs every
  per-layer array into one `uniformArray`, refreshed before each render
  (`onRenderUpdate`).
- **A stage's output must BE the output struct.** A `Fn` that returns
  `outputStruct` fails with "struct member m0 not found". The march returns
  a TSL `struct` of its own (`CloudMarched`), and the fragment node is
  `outputStruct(out.get("cloud"), …)` over the one call, so the march is
  made once and read twice.
- **A select inside a select can fail on the GL fallback.** After the
  build, the GLSL builder asks the output node's type again, outside the
  isolated branch the inner select was set up in. It then builds a
  variable with no stack to stand on ("reading 'addToStack'"), and the
  pass draws black. WebGPU's builder does not ask. The carry settles its
  result by `If` and assignment instead.
- **`.toVar()` needs a stack.** `cloudShadow` is a light's term, built
  where there is no function, so it is wrapped in a `Fn` of its own.
- **A target bound before its pass first draws is made twice** on the node
  renderer, and the second one is never drawn into. So the shadow map is
  drawn on the first frame on the node renderer, even under a sky with no
  layer. WebGL still skips it.
- **The atlas follows its data.** A `Data3DTexture`'s default format is
  RGBA, so `noiseAtlas` counts the channels off the data's length (one or
  four) rather than off the format.
- **Passes draw only once the renderer is initialised** (`drawable()`).
  The warm-up (`Environment.warmNode`) updates the clouds and the dome
  first, so their pipelines are built behind the card.

**How near the picture came.** `make world SEED=38` on webgpu against
WebGL: the mean absolute difference per channel (0 to 255), before this
part and after it. The whole frame below the caption, and its top 120 rows
(the sky):

| Quality | Weather, hour | View | Whole frame | Sky |
| --- | --- | --- | --- | --- |
| HIGH | overcast, 12 h | spawn | 17.97 → 3.49 | 0.43 → 0.19 |
| HIGH | overcast, 12 h | far | 18.90 → 2.46 | 0.56 → 0.29 |
| HIGH | overcast, 12 h | chase-6 | 15.41 → 2.85 | 1.04 → 0.03 |
| HIGH | overcast, 12 h | vista | 1.93 → 0.07 | 0.26 → 0.01 |
| HIGH | overcast, 9 h | spawn | 5.33 → 0.88 | 0.44 → 0.22 |
| HIGH | overcast, 16.5 h | chase-6 | 4.34 → 3.10 | 1.11 → 0.04 |
| HIGH | fair, 12 h | spawn | 12.34 → 3.90 | 13.21 → 2.63 |
| HIGH | fair, 12 h | far | 11.58 → 3.00 | 8.42 → 3.22 |
| HIGH | fair, 12 h | vista | 7.03 → 1.31 | 13.23 → 2.74 |
| HIGH | clear, 9 h | spawn | 3.16 → 1.86 | 7.56 → 3.84 |
| HIGH | clear, 12 h | chase-6 | 5.05 → 4.06 | 7.96 → 5.32 |
| HIGH | clear, 16.5 h | spawn | 5.69 → 4.76 | 8.50 → 4.97 |
| HIGH | snowing, 12 h | spawn | 2.86 → 2.86 | 0.02 → 0.02 |
| LOW | overcast, 12 h | far | 18.80 → 2.56 | 0.59 → 0.51 |
| LOW | overcast, 9 h | spawn | 5.05 → 1.67 | 0.34 → 0.34 |
| LOW | overcast, 16.5 h | spawn | 4.56 → 5.18 | 0.36 → 0.36 |
| LOW | fair, 12 h | spawn | 9.78 → 3.39 | 0.34 → 0.34 |
| LOW | clear, 9 h | far | 1.68 → 0.95 | 0.61 → 0.61 |

The big moves are the cloud shadow. Under a broken sky the ground was lit
as if no cloud stood over it, and under a deck it was lit by a key the
deck should have dimmed. The sky's own moves are HIGH's slab and volume,
which used to be LOW's shell. What is left on the sky at HIGH is the
volume's own per-pixel jitter, which a still catches on both back ends
in different places. Only one row moved the wrong way: LOW, overcast at
16.5 h, about half a level darker, an even dim of the evening's warm key
over the whole frame. The snow's own shading (parts 4 and 5) is most of
what is left on the ground.

`webgpu-gl` draws the same clouds, and lands as near: at HIGH at 12 h,
overcast 17.82 → 3.29 (spawn) and 18.75 → 2.27 (far), fair 12.14 → 3.48
(spawn) and 7.01 → 0.96 (vista), its sky within 2.4 of WebGL's on every
view. The carried volume drew black there until the carry stopped nesting
its selects (see the traps). The 64
WebGL shots (LOW and HIGH; clear and overcast at 9, 12 and 16.5 h; fair and
snowing at 12 h; spawn, far, vista, chase-6) are byte-identical to part 9's.

**What a draw binds after part 10**, counted on `webgpu-gl` (sampler
uniforms per stage of every linked program, the race on seed 20):

| | LOW | HIGH |
| --- | --- | --- |
| The most any program binds, vertex / fragment | 8 / 13 (8 / 12 before) | 8 / 16 (8 / 15 before) |
| Which program | the ground | the ground |
| Programs linked | 43 | 97 |

The ground's fragment reads the cloud shadow map now, one unit more at
every tier. **At HIGH it sits at WebGL2's 16 exactly**, so the next
texture the ground reads on the GL fallback must share a unit or pack
into one it has.

`tests/clouds_tsl_test.ts` holds the register rows, the passes drawn by
their twins into the node renderer's targets (the map, the slab with its
tier's steps, the volume whole and then fresh into two nearest-filtered
attachments and carried), the shadow drawn once on the node renderer with
no layer, WebGL's own targets on WebGL, every twin made once on plain Node
with its pass node, the atlas's channels, the key's slot re-pointed at the
map the clouds draw, and the dome's read by its tier.

## Measuring both paths

Every browser lab takes `--renderer=webgl|webgpu|webgpu-gl`
(`scripts/lib/backend-flag.mjs`). The flag gives the lab the query
parameter, the Chromium switches that back end needs, and a check
(`assertBackend`) that fails the lab when the page drew on a different back
end than the one asked for. `make bench ARGS="--renderer=both"` runs the
benchmark on each back end and closes with the two side by side. The labs
that take the flag are `make bench`, `make screenshots`, `make world`,
`make sky`, `make snowfall`, `make cloud` and `make profile`. `make world`
takes `--weather=` as well, so a fall can be photographed over a run. `make sky` times the GPU sky's passes on
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
| 6 Shadows and the warm-up | 2026-10-20 | webgl | 100 | 231 882 | 51 programs | 12.18 | 5.77 | 0 / 0 | the 24 WebGL world shots (seed 38; LOW and HIGH; 9, 12 and 16.5 h; spawn, chase-6, track, far) are pixel-identical to part 5's. At HIGH: 110 draws, 686 162 triangles, 67 programs, 18.43 ms |
| 6 Shadows and the warm-up | 2026-10-20 | webgpu | 80 (80 before) | 144 327 (144 327) | 62 programs, 40 pipelines (54, 35 before) | 2 459.63 (1 849.30 before) | 2 453.48 (1 842.99) | 6 passes / 29 meshes (8 / 29 before) | The key's map with the mountain's cut, the skiers' atlas and the warm-up. The warm-up builds every pipeline before the run, so more are counted (the cut ground and what was hidden at the start). The steady readings are 8–19 ms; the mean is the device's queue on SwiftShader, and the last reading drains it (7 842 ms; 7 800 before). Two runs of the same build differ by a third here, as WebGL's own mean does (1 371 and 981 ms for one code path). At HIGH: 83 draws (100), 460 791 triangles (497 357), 121 programs and 89 pipelines (81, 52), 9 472.08 ms (9 416.62) with steady readings of 17–27 ms and a last reading of 43 689 ms (36 624). The game's own race builds no pipeline after the card lifts (see part 6) |
| 7 Grade and post | 2026-10-20 | webgl | 100 | 231 877 | 51 programs | 12.60 (13.86 before) | 5.83 (6.21) | 0 / 0 | the 24 WebGL world shots (seed 38; LOW and HIGH; 9, 12 and 16.5 h; spawn, chase-6, track, far) are pixel-identical to part 6's. At HIGH: 110 draws, 686 187 triangles, 67 programs, 19.66 ms (20.16) |
| 7 Grade and post | 2026-10-20 | webgpu | 79 (80 before) | 143 958 (144 327) | 62 programs, 40 pipelines (62, 40 before) | 1 333.19 (2 422.07 before) | 1 325.83 (2 415.02) | 5 passes / 29 meshes (6 / 29 before) | The grade, the buzz and the blaze draw, and the blue deficit is closed. The grade's pipeline takes the place of three's output pass, so the counts hold. The steady readings are 10–12 ms; the mean is the device's queue on SwiftShader, which the last reading drains (4 078 ms; 8 194 before), and two runs of one build differ by that much (part 6). At HIGH: 85 draws (83), 464 052 triangles (460 791), 121 programs and 89 pipelines (121, 89), 9 951.81 ms (10 389.35) with steady readings of 17–24 ms (12–19) and a last reading of 40 829 ms (41 815) |
| 8 Forest | 2026-10-20 | webgl | 100 | 231 883 | 51 programs | 15.51 (14.74 before) | 7.11 (6.93) | 0 / 0 | the 30 WebGL world shots (seed 38; LOW and HIGH; 9, 12 and 16.5 h; spawn, chase-6, track, far, forest) are pixel-identical to part 7's. At HIGH: 110 draws, 686 042 triangles, 67 programs, 21.24 ms (20.13) |
| 8 Forest | 2026-10-20 | webgpu | 114 (79 before) | 170 808 (144 326) | 64 programs, 41 pipelines (62, 40 before) | 969.29 (979.56 before) | 962.21 (972.75) | 5 passes / 28 meshes (5 / 29 before) | The woods draw, a shape at a time, and cast into the key's map. The steady readings are 9–10 ms (10–12); the mean is the device's queue on SwiftShader, which the last reading drains (5 000 ms). At HIGH: 223 draws (85), 610 385 triangles (464 052), 126 programs and 92 pipelines (121, 89), 10 375.37 ms (10 319.44) with steady readings of 24–37 ms (14–22) and a last reading of 58 728 ms (44 918). Indirect draws off a compute cull (part 17) take the draws back |
| 9 Particles and air | 2026-10-21 | webgl | 100 | 231 883 | 51 programs | 13.65 (13.42 before) | 6.35 (6.34) | 0 / 0 | the 42 WebGL world shots (seed 38; LOW and HIGH; 9, 12 and 16.5 h; spawn, chase-6, powder, furrow, landing, far; and snowing at 12 h) are pixel-identical to part 8's. At HIGH: 110 draws, 686 162 triangles, 67 programs, 16.57 ms (21.46) |
| 9 Particles and air | 2026-10-21 | webgpu | 116 (114 before) | 173 541 (170 618) | 74 programs, 46 pipelines (64, 41 before) | 828.40 (1 040.77 before) | 821.09 (1 033.81) | 5 passes / 24 meshes (5 / 28 before) | The spray, the snowfall and the snow cloud and its shadow draw. The steady readings are 10–11 ms (11–17); the mean is the device's queue on SwiftShader, which one reading drains (3 892 ms; 4 030 before). At HIGH: 224 draws (223), 616 797 triangles (610 097), 136 programs and 97 pipelines (126, 92), 7 936.49 ms (9 420.68) with steady readings of 29–33 ms (17–29) and a last reading of 41 606 ms (41 315) |
| 10 Clouds | 2026-10-21 | webgl | 100 (101 before) | 231 880 (231 913) | 51 programs | 18.89 (18.88 before) | 9.24 (8.57) | 0 / 0 | the 64 WebGL world shots (seed 38; LOW and HIGH; clear and overcast at 9, 12 and 16.5 h, fair and snowing at 12 h; spawn, far, vista, chase-6) are byte-identical to part 9's. At HIGH: 110 draws, 686 187 triangles, 67 programs, 23.42 ms (22.24). The container ran the world lab beside the bench, so every ms here is higher than part 9's |
| 10 Clouds | 2026-10-21 | webgpu | 116 (115 before) | 173 759 (173 523) | 76 programs, 47 pipelines (74, 46 before) | 1 215.71 (2 316.78 before) | 1 208.27 (2 306.20) | 4 passes / 24 meshes (5 / 24 before) | The cloud shadow, the slab and the volume draw; at LOW the shadow map's pass is the new pipeline. The steady readings are 6–18 ms (7–15); the mean is the device's queue on SwiftShader, which the last reading drained before (10 111 ms) and none drains here. At HIGH: 226 draws (224), 625 856 triangles (617 124), 143 programs and 101 pipelines (136, 97), 11 508.58 ms (15 237.89) with steady readings of 19–21 ms (21–41) and two draining readings of 66 381 and 39 448 ms (one of 72 688). Snowing at HIGH (`--views snow`, webgpu alone): 227 draws (234), 633 740 triangles (637 066), 139 programs and 99 pipelines (132, 95), 7 841.75 ms (7 580.92) with steady readings of 17–22 ms (15–24) and one draining reading of 32 958 ms (none) |

Parts 1 to 10 were measured with `make bench ARGS="--renderer=both --frames 60 --width
640 --height 360 --video low"` on seed 20 (the woods and a kicker, four skis), and from
part 3 again with `--video high` for the numbers under "At HIGH".

## Systems ported

- [x] 1 Scaffolding: the seam, the device, the switch, the quarantine, the instruments, the lab flag, this ledger
- [x] 2 Haze and lights (`haze`): the fog node, the key, the sky, the lamps, the wall, the glows as sprites
- [x] 3 Sky (`sky-gpu`, `sky`): the dome, the night sky, the contrails, LOW's cloud shell, the far ranges, the LUT passes and the aerial volume, each as a node twin
- [x] 4 Terrain and snow I (`terrain`): the clipmap's vertices, the snow's sample, colour and light, the strata, summer, the room cut, each as the ground's node twin
- [x] 5 Trails and deform (`trail-map`, `deform`): the trail maps' four passes and the deformable snow's shade as node twins; the furrows, grooves, piste tracks, tree wells, avalanche and deformable snow in the ground's twin
- [x] 6 Shadows and the warm-up (`hero-shadow`, `env-warm`): the key's map with the mountain's cut, the skiers' atlas, every pipeline built behind the card; `shadow-depth` kept for WebGL until part 16
- [x] 7 Grade and post (`grade-pass`): the region's grade, the buzz and the blaze as a `RenderPipeline` over the pass's own uniforms, the tone map and the sRGB curve by hand in WebGL's order; the warm-up through the grade's target
- [x] 8 Forest (`forest-batch`): every shape drawn instanced over WebGL's tree table, the faceted, card and casters' materials in TSL, the casters on a layer of their own in the key's map
- [x] 9 Particles and air (`particles`): the spray (the CPU pool and the GPU ring), the snowfall, the snow cloud and its shadow, the billboards and the plumes as node twins; the spindrift and the sparks' heads drawn by stand-ins, a quad a point
- [x] 10 Clouds (`clouds`): the cloud shadow on the ground and the key, MEDIUM's slab, HIGH's volume (whole, then a fresh share into two targets and the rest carried) as node twins drawn into the node renderer's targets; the dome reads their picture by its tier; the `shader` row moved to part 11
- [ ] 11 Figures (`gore-tree`)
- [ ] 12 Skier, models, effects (`model-merged`, `wingsuit`)
- [ ] 13 Buildings and props
- [ ] 14 Instruments and tools (`snow-under`, `trail-overlay`, `gpu-timer`)
- [ ] 15 The flip: webgpu by default, `?renderer=webgl` kept as the way back, the picture's prices re-measured
- [ ] 16 The GLSL deleted, and the quarantine with it (`shadow-depth` too)
- [ ] 17 Compute (WebGPU only)
- [ ] 18 Ray-marched effects

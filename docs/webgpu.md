# The WebGPU port

The world was drawn by three's `WebGLRenderer`. The port moves it onto
three's node renderer (`WebGPURenderer` from `three/webgpu`), which draws on
WebGPU where the browser has an adapter and on its own WebGL2 back end where
it does not. The work lands a system at a time, each one a part below.
**Since the flip (part 15) the node renderer is the default**: WebGPU where
the device has it, its WebGL2 back end where not. The classic
`WebGLRenderer` is one setting away and still draws exactly as before, to
the byte. Anything not yet ported is skipped or hidden, and the frame says
so.

## The switch

| Link | What draws the world | `__SH_BACKEND__` |
| --- | --- | --- |
| (none), `?renderer=auto` | the node renderer on a WebGPU device that can present; its WebGL2 back end when there is no adapter, no device, the canvas cannot be configured, or the device was lost at load earlier in this tab | `webgpu`, or `webgpu-gl` |
| `?renderer=webgpu` | the node renderer on a WebGPU device, even after a fallback; its WebGL2 back end when there is none | `webgpu`, or `webgpu-gl` when it fell back |
| `?renderer=webgpu-gl` | the node renderer on its WebGL2 back end, even where WebGPU exists | `webgpu-gl` |
| `?renderer=webgl` | the classic `WebGLRenderer`, as before the port: the way back | `webgl` |

The ask is the link's word, over DEVELOPER ▸ RENDERER (stored as
`Settings.renderer`, AUTO, WEBGL2 NODES or CLASSIC WEBGL), over `auto`. It
is read ONCE a visit, when the game opens: the renderer is made before the
first card, so the row says it takes effect the next time.

`pwa/src/game/gpu-backend.ts` parses the word (`readBackend`, `chooseBackend`)
and holds the register below. It is DOM-free and three-free, so the suite
reads it (`tests/gpu_backend_test.ts`). A labelled back end is what the page
really drew on, and a fallback is never reported as WebGPU.

**The fallback at load** (`gpu-device.ts`). `auto` asks for an adapter and
a device with the adapter's own limits, then PROBES it: a canvas of four pixels
is configured on the device and cleared, and the device has to answer within
four seconds without being lost. A device that fails any step is destroyed
and the node renderer is made on WebGL2 instead, in the same load. A device
lost before the first frame is drawn, or a renderer whose `init` rejects,
marks the tab (`sessionStorage`'s `fall-line.gpu-fell-back`) and reloads
once: the second load goes straight to WebGL2, so the player sees the
loading card twice and never a black page. A device lost after the first
frame marks the tab and the next visit falls back. `webgpu` and
`webgpu-gl` named by a link do not read the mark.

**The labs draw on WebGL unless asked** (`LAB_BACKEND`,
`scripts/lib/backend-flag.mjs`): their pictures stay the ones taken before
the flip, and SwiftShader's WebGPU spends seconds on a frame. A harness page
reads `pageBackend` (the link's word, else `webgl`); the gear stage behind
the menu follows the game's ask (`setVisitBackend`). A lab that drives the
built site names its back end in the link, `webgl` too.

**The platform shells assume nothing.** Neither the desktop shell
(`tauri/`, the system WebView) nor the store app (`native/`, a WebView over
`http://localhost`, a secure context) names a renderer: each page asks for
`auto` and falls back the same way. A WebView without WebGPU draws WebGL2
nodes.

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
| `snow-under` | pass | 14 | the snow lab's probe under the skis: the depth copied into a float target and read back, by its node twin, read asynchronously. Ported |
| `trail-overlay` | pass | 14 | the developer page's trail corner, by its node twin, made again when the maps are rebuilt. Ported; its marks show from part 15, when the stamps themselves were drawn on the node paths |
| `gpu-timer` | pass | 14 | the GPU's own timer: WebGL's queries, or the node renderer's timestamp queries filed by slice (`gpu-timer-node.ts`) where the device writes them. Ported |
| `haze` | material | 2 | the haze on a hazed material, with the key's extras, the shade lift and the lamps; a glow's fade. Ported |
| `sky` | material | 3 | the dome, the far ranges and the sky's passes, each drawn by its node twin. Ported |
| `particles` | material | 9 | the spray, the snowfall and the spindrift, the snow cloud and its shadow, the billboards, the sparks and the snow guns' plumes, each drawn by its node twin or, for a `gl_PointSize` point, by a stand-in a quad a point. Ported |
| `shader` | material | 16 | a `ShaderMaterial` no port draws. Nothing the game or a lab draws is left in it: the clouds' passes left it in part 10, the dogs' steam in part 11, the effects in part 12, the props in part 13 and the gear stage's sky in part 14. A ShaderMaterial added before its twin is hidden here, and the row goes with the GLSL (part 16) |
| `effects` | material | 12 | the rotors' and the propellers' smear, the black fade through a lift's station, the balloon's burner, a skier's burn (the flames, the glow, the sparks, the smoke) and the X-ray cam (the bones and organs, the glass, the mask, the veil, the blood), each drawn by its node twin. Ported |
| `terrain` | material | 4 | the clipmap's every level, its snow, its rock and a summer's ground, drawn by its node twin. Ported |
| `forest-batch` | material | 8 | the woods' multi-draw batch, drawn shape by shape instanced on the node renderer (`forest-nodes.ts`). Ported |
| `figures` | material | 11 | the crowd, the people on foot, the dogs and their steam, the traffic, a race's fans, the birds and the animals, each drawn by its figure twin, and the shadow of every caster whose depth carries a graft. Ported |
| `haze-graft` | material | 16 | a `hazeMaterial` with grafted GLSL of its own that no port draws yet. Nothing is left in it: the figures' grafts left it in part 11, the cloths' in part 12, the props' in part 13 and the gear stage's snow and meadow in part 14. A graft added before its port is hidden here, and the row goes with the GLSL (part 16) |
| `props` | material | 13 | the buildings (every facade, the cabins, the start house, the stands, the arenas, the stations, the tunnels), the rooms inside, the crags and the talus, the printed signs, the water, a summer's grass and a slab's walls by their node grafts; the challenges' flags, a slab's plates, the floodlights' haloes and the fires by their node twins. Ported |
| `model-merged` | material | 12 | the merged models (the skis and boards, the machines' parts): the metalness, the roughness and the coat off each vertex, by their node graft. Ported |
| `skier` | material | 12 | the posed parts' rigid normals, the dressed kit's flutter, by their node grafts; the X-ray's dissolve on his skin. Ported |
| `wingsuit` | material | 12 | the wingsuit's colourway, by its node graft. Ported |
| `cloth` | material | 12 | the sky canopy's and the paramotor's panels, the lines' light, the balloon's envelope, by their node grafts. Ported |
| `gore-tree` | material | 11 | the blood on a tree a skier struck, drawn by its figure twin. Ported |

On the webgpu paths after part 14, the frame draws these:

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
- the skier: his body and his dressed kit with its flutter, the modelled
  skis and the snowboard, the code's skis and their bindings and boots, the
  wingsuit, a ski cut by a rope
- the machines: the snowmobile's and the piste machine's merged parts, the
  helicopter's and the plane's rotor and propeller, the canopies and the
  paramotor's lines, the balloon's envelope and its burner
- the effects: the black fade through a lift's station, a skier burning,
  the X-ray cam
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
- the figures: the free ride's amateurs and the people on foot, the dogs
  and their steam, the traffic with its lamps lit, a race's fans in the
  stands and along the course, the birds and the animals and their prints,
  the blood on a struck tree, and their shadows
- the region's grade over the whole frame, and the buzz and the blaze
- the buildings: every facade with its painted stack and its panes lit
  after dark, the cabins, the start house and the hut, a race's stands
  and its arenas, the lifts' stations, the wind tunnels, the rooms inside
  with the sun kept out
- the props: the crags and the talus under them, the printed signs, the
  lakes and the streams with their ice, a summer's grass, the challenges'
  flags, a slab's plates and walls, the floodlights' haloes, the camp
  fires and the bonfires
- the instruments: the developer page's trail corner, and the GPU's own
  timer where the device writes timestamps
- the HUD

All of it is hazed and lit by the key and the sky as WebGL lights them, and
by the lamps at night. The gear stage behind the rider and gear cards and
every lab page that draws its own sheet draw on the link's back end too
(part 14). **Nothing is skipped or hidden on the webgpu paths but
`shadow-depth`**, WebGL's own sun-map depth, which the node renderer's
shadow pass does not need. `shader` and `haze-graft` hold nothing; they
stay as guards for a material added before its port, and go with the
GLSL in part 16. The benchmark report and the developer page list what is
missing on the `RENDERER` line and on the `SKIPPED` / `QUARANTINED` lines
under it.

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
  the counts below) where WebGL makes one a pass. On WebGPU, part 17 takes
  it back to one render object a pass with indirect draws (the cull stays
  the processor's).
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

## The figures (part 11)

The figures now draw on the webgpu paths: the free ride's amateurs and
the people on foot, the dogs and the steam off a fresh pile, the traffic,
a race's fans, the birds, the animals and their prints, and the blood on
a struck tree. Before this part every one of them was hidden. On WebGL
each is a classic material with GLSL grafted into it (`hazeMaterial`'s
`extra`), and WebGL's code path is untouched, so its picture is the same
to the bit. The people at the fires and what they hold, the dogs' piles
and the civilians' props are plain hazed materials and needed nothing.

| Figure | WebGL | Node renderer |
| --- | --- | --- |
| The amateurs | `crowd-shapes.ts`'s `crowdMaterial`: the outfit painted off the instance's dress, a struck one's blood | `people-tsl.ts`'s `crowdSpec` |
| The people on foot | `civilian-shapes.ts`: the crowd's paint over nine slots, the parts an instance does not wear folded away, in his shadow too | `civilianSpec`, and its shadow (`figureShadowOf`) |
| The dogs, their steam | `dog-shapes.ts`: each slot an sRGB colour off the packed coat; `dogs-view.ts`'s `gl_PointSize` puffs | `dogSpec`; `steamStand`, a quad a puff |
| The traffic | `traffic-view.ts`: the instance's paint, the lamps lit and folded, the roughness off the vertex, the bus's windows | `trafficSpec` |
| A race's fans | `spectator-shapes.ts`'s `POSE_GLSL`: the look, the racers near, the arena's roar, the wave, the moves, the flag | `fans-tsl.ts`'s `fanSpec` |
| The birds | `bird-shapes.ts`: the wing's hinge at the wrist | `wildlife-tsl.ts`'s `birdSpec` |
| The animals | `beast-shapes.ts` and `beast-crush.ts`: the gait, the head, the crush of a struck one, in its shadow too | `beastSpec`, and its shadow |
| The blooded tree | `gore-tree.ts`: the stain's front down the bark | `figure-twins-tsl.ts`'s `goreTreeSpec` |

Each material is flagged `figureTwin(material, kind, own)` (`gpu-backend.ts`)
with the uniform objects its graft reads. The dressing hands the node
renderer a FIGURE TWIN in its place (`figureTwinOf`): a copy of the
material, field for field as three's library copies one, whose vertex and
paint are the graft's in TSL (`figure-tsl.ts`).

**The graft runs where WebGL runs it.** Three's node material moves a
vertex by its morphs, then by its instance, then by its `positionNode`.
A graft that folds a wing or swings a leg runs in the figure's own frame,
before the instance's matrix, so a twin's `setupPosition` is its own
(`FigurePose`): `early` before the morphs (GLSL's `begin_vertex`), `late`
after them, `instance` in place of three's matrix, `post` after it, and
`paint` for the vertex colour (GLSL's `color_vertex`).

**The shadow takes the same vertex where WebGL's does.** The node
renderer's shadow pass draws every caster with one material of its own,
and never reads a `customDepthMaterial`. Where WebGL's depth carries the
graft (the civilians' folds, an animal's gait and crush; `figureDepth`),
the key's shadow node hands the pass a shadow material of the figure's own
for that caster (`figureShadow`, `shadows-tsl.ts`). Every other caster is
drawn as WebGL draws it.

**Traps found here:**

- **Three's program cache does not see a material's own values.** It
  reduces an object-valued field to `{}`, so materials with the same
  fields share one program, and a uniform naming its own object hands all
  of them the first one's value. A figure's own numbers (a species' wrist,
  a beast's gait, a stain's front) are read off the material drawn instead
  (`own`, `materialReference` on `userData.figureOwn`).
- **A draw's uniforms are refreshed in full only for a material with a
  node of its own**, and the material three checks is the classic one. The
  twin hangs a node on it (`figureNode`).
- **Three multiplies the instance's colour into the diffuse colour.** WebGL's
  graft puts it in the vertex colour already, so a painted twin leaves
  three's multiply out (`setupDiffuseColor`).
- **A pipeline takes at most eight vertex buffers on WebGPU**, and the node
  renderer binds every attribute a vertex reads as one of its own. The
  traffic read ten and the fans and the civilians nine. The attributes
  that never change are read from one interleaved copy (`interleave`,
  `packed`), made the first time the twin is built.
- **Three reads an instance's matrix off a uniform array sized to the
  mesh's count**, so every count writes a vertex program of its own. The
  race's stands came to 183 programs, one a stand and cut. A fan's matrix
  is a translation set once, so the twin reads it as an attribute
  (`aHome`, packed with his looks), and every stand shares one program.
- **A uniform array made in each build names its buffer anew** and
  writes a program for every object. The fans' racers' array is made once
  a material (`skierArray`).
- **A layout function's code is written once for every program.** Three
  writes a `Fn` with `setLayout` once and hands the same code to every
  program after, with the names the first program gave the uniforms and
  textures it reads. A second program that numbers them otherwise is
  refused ("unresolved value", "struct member not found"), and the frame
  it was in is dropped. On the free ride the ground's trail reads hit
  this after the first view, on both node back ends. That is why the
  lab's free-ride views after the first showed the first one's frame.
  `node-fixes-tsl.ts` writes the code again for each program and stage.
- **Three's morphs on an instanced mesh** read each instance's weights off
  its morph texture, and leave the mesh's own weights' uniform array
  unbuilt. Three still copies into that array every frame, and the copy
  threw. `node-fixes-tsl.ts` skips a copy into a buffer that was never
  made.
- **An `If` whose callback returns a node is a return statement.**
  `If(c, () => v.assign(x))` returns the assignment, so it is built as a
  `return`, and three warns of a return in an inline `Fn`. Every branch is
  a block.

**How near the picture came.** `make world SEED=38` at HIGH at 12 h,
webgpu against WebGL: the mean absolute difference per channel (0 to 255)
over the frame below the caption, before this part and after it.

| Ride | View | webgpu | webgpu-gl |
| --- | --- | --- | --- |
| free ride | herd (a hare 7 m off) | 65.12 → 1.09 | 64.94 → 0.91 |
| free ride | route-amateur-close | 18.68 → 1.43 | 43.12 → 1.40 |
| free ride | village-traffic | 53.50 → 51.11 | 53.48 → 51.08 |
| free ride | village-cyclist | 23.37 → 20.72 | 23.25 → 20.62 |
| free ride | village-plaza | 18.05 → 17.68 | 17.97 → 17.57 |
| free ride | birds | 4.62 → 4.62 | 4.51 → 4.51 |
| slalom | race-stand | 17.49 → 10.18 | 17.15 → 9.66 |
| slalom | finish | 15.05 → 11.54 | 14.79 → 11.14 |
| slalom | gate | 8.53 → 5.36 | 8.31 → 4.95 |

The herd and the close view moved most because of the layout fix, not the
figures. Before it, the frame after the free ride's first view was
dropped, and the lab saved the last frame that was drawn, a view of
somewhere else. The village's views are still far off because the
buildings, the streets' lamps and the signs are part 13's. What is left at
the stands is their structure, which is the buildings' too. The birds are
a few pixels at that range, and both back ends draw them the same. The
standard views (spawn, chase-6, track and far, at 9, 12 and 16.5 h)
moved by at most 0.05, and each one came nearer, on both node back ends. The 27
WebGL shots (the standard views at LOW and HIGH, the free ride's eight,
the slalom's three) are byte-identical to part 10's.

**What a draw binds after part 11**, counted on `webgpu-gl` (sampler
uniforms per stage of every linked program, the race on seed 20):

| | LOW | HIGH |
| --- | --- | --- |
| The most any program binds, vertex / fragment | 8 / 13 (8 / 13 before) | 8 / 16 (8 / 16 before) |
| Which program | the ground | the ground |
| Programs linked | 58 (43 before) | 131 (97 before) |

No figure binds a texture the haze and the key do not already bind, and
the ground is untouched, so it is still at WebGL2's 16 at HIGH.

`tests/figures_tsl_test.ts` holds the register rows; the flags on every
material; the uniforms a twin reads, which are the objects WebGL's graft
is handed; WebGL's program keys, kept as before; every twin made on plain
Node as a copy of its material with the graft's vertex and paint; the
shadows of the casters whose depth takes the graft, and no others; the
steam's stand; the packed attributes; and the two builder fixes.

## The skier, the models and the effects (part 12)

The skier's own kit and the machines now draw whole on the webgpu paths:
the modelled skis and boards, the merged parts of the snowmobile and the
piste machine, the posed parts merged into one draw (the code's skis with
their bindings and boots, the snowboard), the dressed kit's flutter, the wingsuit, the sky
canopy and the paramotor's wing and lines, the balloon's envelope, the
helicopter's and the plane's rotor and propeller smear, the black fade
through a lift's station, the balloon's burner, a burning skier and the
X-ray cam. Before this part each was hidden, and the frame showed the
skier's body standing on nothing. WebGL's code path is untouched, so its
picture is the same to the bit.

There are two kinds of port here.

**A classic material with a graft of its own** is flagged
`nodeGraft(material, family, kind)` (`gpu-backend.ts`). Three's library
copies it field for field as for any classic material, and the dressing
finishes the copy with the graft's nodes (`finishGraft`,
`model-grafts-tsl.ts`; `cloth-tsl.ts` for the cloths):

| Graft | WebGL | Node renderer |
| --- | --- | --- |
| `pbr` | `model-merge.ts`: the merged look's metalness, roughness and clearcoat read off each vertex (`pbr`) | the three nodes off the same attribute; the coat only on a physical copy |
| `rigid` | `posed-merge.ts`: a part's normal through the inverse transpose of its bone, so a stretched part (a binding's plate, a boot's shell) is lit as its own normal matrix lit it | a `positionNode` that sets `normalLocal` the same way, after three's skinning |
| `flutter` | `player-model.ts`'s `withFlutter` (the dressed kit, `skier-dress.ts`): the loose cloth trailed and flapped down the air past him, the suit's shiver on its lee | a `positionNode`, after the skin as WebGL's runs after `skinning_vertex`, over the material's own `graftOwn` |
| `wingsuit` | `wingsuit-figure.ts`: the colourway painted off each vertex's place on its wing | `colorNode`, a program a colourway |
| `sky-canopy`, `para-canopy` | the canopies' panels painted off the cloth's place | `colorNode` off the same paint |
| `line-light` | `para-motor.ts`'s `litLine`: the sky's light on a line | the light times the colour |
| `envelope` | `balloon-envelope.ts`: the gores' palette and scheme, the tapes, the scorch and the fire's front, the glow of the burner through the fabric, the daylight through it, the embers | `colorNode` and `emissiveNode` term for term |

**A ShaderMaterial** is flagged `nodeTwin(material, "effects", kind)` and
drawn by a node twin (`effects-tsl.ts`): the rotor's smear (`rotor-disc.ts`),
the lift's fade (`lifts.ts`), the burner's jets and pilots
(`balloon-flame-tsl.ts`), a skier's burn in four draws (`burn-tsl.ts`, over
the fire's own flame, sparks and smoke in `fire-tsl.ts`, which part 13 can
reuse for the props' fires) and the X-ray's bones and organs, its glass and its
mask on his rig, its veil and its blood (`xray-tsl.ts`). The X-ray's
dissolve of his skin is a graft on his skin's copies (`dissolveSkin`): the
dropped patches as its mask, the glowing edge laid over its output.

**The graft's vertex is set on the copy alone.** The node renderer's shadow
passes copy the `positionNode` of the material DRAWN, which is the classic
one. WebGL's depth takes none of these grafts (three's own depth, or the
skiers' `createShadeDepth`), so neither does the node renderer's: the
shadows of a fluttering kit and of a posed bike are WebGL's. Both the key's
map and the skiers' atlas draw the skis and the kit as before; the atlas
drew them even while they were hidden, since it renders before the
quarantine.

**Traps found here:**

- **ShaderMaterials with the same GLSL share one program on the node
  renderer too.** Its cache keys a material by its fields and its shader
  strings, so the X-ray's hundred bones, the balloon's four jets and two
  helicopters' rotors would all draw with the first one's uniforms. Every
  effect twin reads its numbers off the material drawn (`shaderOwn`, a
  `materialReference` on `uniforms.<name>.value`), and a graft's off
  `userData.graftOwn` (`graftOwn`).
- **The node renderer ignores a material's own clipping planes.** It clips
  by a `ClippingGroup` in the scene and nothing else, so a ski cut by a rope
  (`ski-cut-view.ts`) drew whole. A copy whose material carries planes
  takes them as its mask, read per object off the material drawn. The cut
  part still casts its shadow on the node renderer (WebGL's `clipShadows`).
- **A clear inside the frame's pass is not a clear.** The X-ray's veil
  clears the depth under him in its `onBeforeRender` on WebGL. The node
  renderer's `clear` makes a pass of its own, submitted before the frame's
  and, through the output target, may even present it. On the node
  renderer the veil is drawn at the far plane through every depth instead
  (`depthFunc` always, the depth written), and its `onBeforeRender` skips
  the clear.
- **A copy is made again for every pipeline build**, so what finishes it
  must be a pure function of the material: a flag or a uniform object on
  `userData`, never state kept on the copy.
- **A `materialReference` resolves to the material being BUILT**, which is
  the copy or the twin, not the classic material, and the copy's `uniforms`
  and `userData` are not the classic material's objects. The X-ray's bones
  read an undefined uniform and drew black. Every own uniform resolves per
  draw against `object.material` (`objectOwn`, `figure-tsl.ts`).
- **A clone carries the flags but not the graft.** `Material.clone()` copies
  `userData` as JSON but not `onBeforeCompile`, so a flag kept on `userData`
  told the node renderer to graft a gore piece WebGL draws plain. The flags
  are kept by identity (`graftOf`, `dissolves`), and a clone that does keep
  its graft (`ski-cut-view.ts`'s `clippedClone`) is flagged again.
- **Not every name in three's shader language is exported.**
  `modelNormalViewMatrix` is undefined, and a node built on it throws only
  when the pipeline is built. The view's normal matrix is
  `highpModelNormalViewMatrix`. The test checks every name a TSL module
  destructures.

**How near the picture came.** `make world SEED=38` at HIGH, webgpu against
WebGL: the mean absolute difference per channel (0 to 255) over the whole
frame, before this part and after it.

| View | 9 h webgpu | 9 h webgpu-gl | 12 h webgpu | 12 h webgpu-gl | 16.5 h webgpu | 16.5 h webgpu-gl |
| --- | --- | --- | --- | --- | --- | --- |
| spawn | 1.83 → 1.30 | 1.47 → 0.93 | 4.05 → 3.53 | 3.72 → 3.19 | 4.74 → 4.28 | 4.48 → 4.02 |
| chase-6 | 2.85 → 2.60 | 2.66 → 2.40 | 4.20 → 3.87 | 3.87 → 3.52 | 4.88 → 4.67 | 4.72 → 4.50 |
| tips | 17.16 → 3.92 | 16.87 → 3.62 | 18.59 → 4.96 | 18.34 → 4.68 | 12.87 → 4.55 | 12.65 → 4.31 |
| helmet | 3.10 → 2.76 | 2.88 → 2.52 | 4.38 → 3.91 | 4.08 → 3.59 | 4.71 → 4.32 | 4.50 → 4.10 |
| landing | 2.25 → 2.04 | 1.87 → 1.65 | 3.28 → 3.06 | 2.87 → 2.63 | 3.95 → 3.80 | 3.68 → 3.52 |
| track | 2.09 → 1.77 | 1.70 → 1.37 | 3.70 → 3.39 | 3.32 → 3.00 | 5.03 → 4.84 | 4.75 → 4.54 |
| far | 2.50 → 2.24 | 2.18 → 1.91 | 3.29 → 3.04 | 2.89 → 2.64 | 4.10 → 3.95 | 3.84 → 3.68 |

Every view came nearer on both node back ends. The tips view moved most,
because the skis fill its lower half and were missing before. In the other
views the skier is a small share of the frame. At 12 h the dressed hiker's
chase view went from 3.96 to 3.39 (webgpu) and from 3.74 to 3.16
(webgpu-gl), and a second pair of skis' chase view from 3.54 to 3.40 and
from 3.21 to 3.06. The machines' labs, `webgpu-gl` against WebGL over the
whole frame:

| Lab | View | Before → after |
| --- | --- | --- |
| `make heli` | the rotor spooled up, 3.6 s | 5.69 → 0.87 |
| `make heli` | the rotor at 1 s | 3.10 → 0.83 |
| `make plane` | the model at 45° | 1.50 → 1.41 |
| `make plane` | the model at 180° | 2.04 → 1.77 |
| `make balloon` | the burner by day, close | 23.02 → 5.17 |
| `make balloon` | the burner by day, from the chase | 14.04 → 4.97 |

`make xray`'s anatomy stills now draw the bones, the organs and the glass
over him as WebGL does. Before, they showed his kit standing whole. The 21
WebGL world shots above are byte-identical to part 11's.

**What is still off.** In a run the X-ray cam has taken after a death
(`make xray`'s `trunk-fast`), the node renderer draws the bones and the
organs but not the glass, and his helmet and his hard kit stay solid under
the veil. The dissolve is on his skin's copies and the shells hang on his
rig, as in the anatomy stills, which draw right, so the gap is in what the
death scene changes. The plane's night views are much brighter on
`webgpu-gl` than on WebGL, before this part as after it. Its cause is not
found yet.

**What a draw binds after part 12**, counted on `webgpu-gl` (sampler
uniforms per stage of every linked program, the race on seed 20):

| | LOW | HIGH |
| --- | --- | --- |
| The most any program binds, vertex / fragment | 8 / 13 (8 / 13 before) | 8 / 16 (8 / 16 before) |
| Which program | the ground | the ground |
| Programs linked | 60 (58 before) | 137 (131 before) |

The ground binds the same samplers as before, so it is still at WebGL2's
16 at HIGH. None of this part's grafts and twins samples a texture of its
own. The new programs are the field's modelled skis, which were held back
before, and their grafts.

`tests/skier_tsl_test.ts` holds the register rows; the flags and the
uniforms a graft reads, which are the objects WebGL's graft is handed;
every effect's ShaderMaterial flagged with its twin, and every twin made on
plain Node; the graft's nodes on the copy alone; the clipping planes as a
mask; the dissolve; and the veil's clear skipped on the node renderer.

## The buildings and the props (part 13)

The mountain's buildings and its props now draw on the webgpu paths: every
building cut from the facade kit (the village's houses, the cabins, the
start house and the hut, a race's stands and its arenas, the lifts'
stations, the wind tunnels, the gates' furniture), the rooms inside, the
crags and the talus, the printed signs, the lakes and the streams, a
summer's grass, the challenges' flags, a slab's plates and walls, the
floodlights' haloes and the fires. Before this part each was hidden
(`haze-graft` and `shader`), and a free ride's village was an empty
street. WebGL's code path is untouched, so its picture is the same to the
bit.

**A classic material with a graft of its own** is flagged
`nodeGraft(material, "props", kind)` and finished on the library's copy
(`finishProp`, `props-tsl.ts`):

| Graft | WebGL | Node renderer |
| --- | --- | --- |
| `facade` | `facade-material.ts`'s `graftFacade`: the layer's colour under the vertex colour, its roughness and its relief off the painted stack; `cabins-view.ts`'s `graftGlow`: the panes lit as the dark comes on | the same two texture arrays (`facadeTextures`), the relief bent in the surface's own frame off the screen derivatives, the glow as the emissive; the wall's mask as every hazed material's |
| `interiors` | `interiors-view.ts`: the stack, the room's own light, the sun kept out | the same, with the key's light node told to skip the copy (`userData.indoor`, `lights-tsl.ts`) |
| `print-bump` | `print-bump.ts`: a printed board's bump read off its colour as stored | the same read, as the normal |
| `slab-walls` | `avalanche-plates.ts`: a stretch the crack has not reached folded under the snow, the rest drawn a little nearer the lens | a `positionNode` for the fold, a `vertexNode` for the pull, through a varying between them |
| `rock`, `talus` | `rocks.ts`: the facets calmed with distance, the laminae, joints, streaks, rust and lichen, the rime, the bump, the haze kept thinner over bare stone, a stone sunk by the snow | `rock-tsl.ts`, term for term; the copy hazes itself (`hazeOver`'s `keep`) |
| `water` | `water-glsl.ts`: the shore, the ice and its snow, the waves, a stream's run, the mirror of the sky and the hills | `water-tsl.ts`; every texture read in uniform control flow (the early returns are `select`s) |
| `grass` | `summer-grass.ts`: each tuft stood on the grid round the lens off the ground's own maps, thinned, flowered and blown | `grass-tsl.ts`; the maps read at their first level in the vertex stage |

Every graft's numbers are the objects WebGL's graft is handed
(`userData.graftOwn`), read per draw off the material drawn.

**A ShaderMaterial, or a graft that moves its vertex before the
instance's matrix**, is flagged `nodeTwin(material, "props", kind)` and
drawn by a twin (`prop-twins-tsl.ts`): the flags' sail and pennant and a
slab's plates as figure twins (`figure-tsl.ts`), each flag swung to the
wind in its instance's own frame off an instanced copy of the mesh's
matrices; the floodlights' haloes; and the fires' embers, flames, glow,
sparks and smoke over part 12's fire fragments (`fire-tsl.ts`).

**Traps found here:**

- **Take the lit colour into a variable before a branch reads it.** An
  override of `setupOutput` that hands the lit colour straight to
  `hazeOver` (whose `If`s read it) drew the rock black: the builder first
  met the colour's node inside a branch, so the output read it where it
  was never set. The colour is taken into a `toVar` in the main flow
  first, as the ground's twin already did.
- **A `normalNode` is built in a sub-build of its own.** Three builds the
  normal in its `NORMAL` sub-build, and a `property` read there is named
  for the sub-build (`NORMAL_<name>`, `getSubBuildProperty`), not the
  variable the colour assigned. The water's normal comes out of its
  colour's work, so it goes to `normalFromColour` (`figure-tsl.ts`) and
  the lighting reads it in the main flow, after the colour.
- **A plain number where a helper calls a node's method fails only when
  the pipeline is built.** The water handed the haze's mist a `0` for its
  rise. Three logged one `TypeError` from its shader language, dropped the
  pipeline, and the lakes drew black. A helper's argument is a node
  (`float(0)`), and a lab's console is read for `THREE.TSL` lines.
- **A figure's own instancing must hand the instance's colour on.**
  Three's diffuse multiplies by `vInstanceColor`, which its instancing
  node assigns. A figure pose with an `instance` hook of its own skipped
  that node, so the flags' instance colour was zero and the sail drew
  black. `figure-tsl.ts` assigns it from the mesh's `instanceColor` when the
  pose moves the instance itself.
- **`materialColor` carries the material's map.** Read at the plain uv, it
  laid the whole print over each cell of the sail. The sail reads the
  colour alone (`materialReference("color")`), as WebGL's graft replaces
  `map_fragment`.
- **The warm-up must not stand a geometry with nothing in it.** The talus
  has no position attribute before its first stones, and building its
  pipeline warned on every attribute. `standAll` skips such a mesh on the
  node renderer.

The cloth of a flag is flat-shaded and carries no normal. The shadow's
normal bias reads one all the same, so the twin hands a bare geometry a
constant normal; nothing in the picture uses it.

**How near the picture came.** `make world SEED=38` at HIGH, each node back
end against WebGL: the mean absolute difference per channel (0 to 255)
over the whole frame, before this part and after it.

| View | 12 h webgpu | 12 h webgpu-gl |
| --- | --- | --- |
| free ride: village-plaza | 17.16 → 1.90 | 17.05 → 1.57 |
| free ride: village-street | 36.55 → 1.00 | 36.54 → 0.82 |
| free ride: village-air | 6.51 → 1.75 | 5.35 → 0.27 |
| free ride: village-traffic | 51.49 → 0.70 | 51.47 → 0.57 |
| free ride: cabin-near | 140.09 → 0.15 | 140.09 → 0.10 |
| free ride: lift-station | 8.21 → 3.51 | 7.84 → 3.12 |
| free ride: station-chair-foot | 22.02 → 2.32 | 21.89 → 2.19 |
| free ride: tunnel-mouth | 3.66 → 2.32 | 3.34 → 1.96 |
| free ride: rocks-near | 12.54 → 3.26 | 12.53 → 3.18 |
| free ride: rocks-cliff | 23.77 → 2.33 | 23.75 → 2.21 |
| free ride: sign | 2.82 → 1.83 | 2.56 → 1.57 |
| free ride: route-head | 1.87 → 0.64 | 1.75 → 0.52 |
| free ride: challenge-start | 3.65 → 3.45 | 3.36 → 3.14 |
| slalom: race-stand | 9.86 → 4.29 | 9.38 → 3.76 |
| slalom: race-house | 32.86 → 20.40 | 32.54 → 20.05 |
| slalom: finish | 11.20 → 3.56 | 10.75 → 3.05 |
| slalom: gate | 5.20 → 4.65 | 4.79 → 4.22 |
| race: spawn | 3.58 → 3.48 | 3.23 → 3.12 |
| race: track | 3.44 → 3.36 | 3.06 → 2.96 |
| race: far | 3.06 → 2.93 | 2.68 → 2.53 |
| race: vista | 1.31 → 1.28 | 1.25 → 1.23 |

At 21 h the free ride's village-street went from 36.01 to 7.66 (webgpu)
and from 32.99 to 0.32 (webgpu-gl), and its plaza from 12.19 to 1.20 and
from 11.99 to 0.44. The 23 WebGL shots are byte-identical to part 12's but
for six pixels of the night street's sky, which differ by up to 7 from one
run of the same build to the next. The labs, `webgpu-gl` against WebGL over
the whole frame:

| Lab | View | Before → after |
| --- | --- | --- |
| `make water` | the tarn in summer | 17.98 → 0.40 |
| `make water` | the valley's lake in summer | 4.70 → 1.91 |
| `make water` | the tarn in the thaw | 17.01 → 0.37 |
| `make fires` | a camp fire, close | 22.10 → 2.57 |
| `make fires` | a camp fire at night, close | 21.67 → 4.14 |
| `make fires` | a bonfire, close | 8.21 → 2.88 |
| `make avalanche` | the release at 2 s, at the crown | 6.23 → 2.72 |
| `make avalanche` | the debris, far across | 1.46 → 0.20 |
| `make summer` | the grass at 10 h | 2.18 → 0.35 |
| `make summer` | the meadow at 10 h | 2.00 → 0.39 |
| `make snowguns` | the night side, the cone | 2.40 → 1.93 |

**What is still off.** The slalom's start house is drawn, but the snow in
front of it is lighter on both node back ends than on WebGL, before this
part as after it. On `webgpu` (Vulkan) the lamps at night light the street
in hard-edged tiles, and they did before this part too; `webgpu-gl` does
not. The camp fires' flames read as sparks more than tongues next to
WebGL's. The rock's tipped normal (`STRATA_NORMAL`) leaves the node
renderer's picture unchanged even when it is pushed far over, so the
laminae's bump is not seen there yet.

**What a draw binds after part 13**, counted on `webgpu-gl` (sampler
uniforms per stage of every linked program; the race on seed 20 as part 12
counted it, and seed 38's free ride at HIGH after the warm-up):

| | LOW (race) | HIGH (race) | HIGH, the free ride at 21 h | HIGH, the free ride in summer |
| --- | --- | --- | --- | --- |
| The most any program binds, vertex / fragment | 8 / 13 (8 / 13 before) | 8 / 16 (8 / 16 before) | 8 / 16 | 8 / 11 |
| Which program | the ground | the ground | the ground | the ground |
| Programs linked | 74 (60 before) | 160 (137 before) | 578 | 524 |

The ground binds the same samplers as before, so it is still at WebGL2's
16 at HIGH, and no other program comes near it: the next is 8 / 14. The
facades read their two texture arrays, the water its shore and its
horizon, a summer's tufts the ground's maps in the vertex stage, each in a
program of its own. None of them adds a sampler to the ground's.


`tests/props_tsl_test.ts` holds the register rows; every graft and twin's
flag where its material is made; the numbers a graft reads, which are the
objects WebGL's graft is handed; every graft's nodes on the copy alone and
the facade's wall mask; the rooms kept from the sun; every twin made on
plain Node; and every TSL name the modules destructure.

## The instruments and the tools (part 14)

The frame's instruments and the pages that draw on a renderer of their own
now run on the webgpu paths. Before this part the benchmark's `WHERE THE
GPU WENT` section, the developer page's trail corner and the snow lab's
probe under the skis were WebGL's alone (`gpu-timer`, `trail-overlay` and
`snow-under` were skipped), the benchmark waited for a WebGPU device by
reading no pixel at all, and every harness page and the gear stage behind
the rider and gear cards made a `WebGLRenderer` whatever the link asked
for. WebGL's code path is untouched, so its picture is the same to the bit.

**The GPU's own timer** (`gpu-timer-node.ts`) is the same `GpuTimer` as
WebGL's, answered by three's timestamp queries. Three brackets each RENDER
PASS with one (`backend.trackTimestamp`, turned on for as long as the timer
lives), so a slice is every pass begun while it was on top of the stack:
the trail maps under `trail`, the skiers' atlas under `hero`, the picture
under `scene`, the grade under `grade`, the overlay under `overlay`, and a
pass into a shadow map's depth under `shadow` whatever is on top. The sky's
and the clouds' own passes, which WebGL does not time either, are begun
under nothing and are not counted. SPLIT cannot cut inside a pass, so the
node renderer's timer runs as PASSES and the report says so. A frame asks
three to resolve what was written (`resolveTimestampsAsync`), and the
answers come back frames later; a frame is summed once every pass it noted
is in, and given up on (`dropped`) when it lags twelve frames.

Where the device cannot write timestamps the timer is off, as WebGL's is
without the disjoint extension. On WebGPU that is the device's own
`timestamp-query` feature, which `gpu-device.ts` asks for whenever the
adapter offers it (three's `hasTimestamp` reads true on every WebGPU
device, so it is not asked). On the WebGL2 back end it is the same
extension WebGL's timer uses.

**The fence** is the device's queue on WebGPU. WebGL's benchmark waits for
the GPU by reading one pixel back (`drain`), which blocks until every draw
before it is done. A WebGPU device has no blocking read, so the world
renderer's `drainLater` hands back the time until
`device.queue.onSubmittedWorkDone()` answers, and the benchmark's pump
awaits it before it closes the frame (`benchFrame` is cut in two:
`drawBench` and `closeBench`). Where the sync drain already waited
(WebGL, and the node renderer's WebGL2 back end, whose context is read the
same way) `drainLater` is null and nothing changes. PRESET ▸ AUTO's timing
(`picture-auto.ts`'s `drawn`) waits the same way.

**The instruments' passes** are node twins over the instruments' own
materials (`instruments-tsl.ts`):

| Pass | WebGL | Node renderer |
| --- | --- | --- |
| `trail-overlay` | the developer page's corner: each trail map drawn straight to the canvas through a GLSL copy, the stamps' colours mixed over a dark ground | the same sixteen taps and the same mix, with the sRGB curve applied in the twin; the draw is made with the output transform off (a linear colour space, no tone mapping) so it reaches the canvas without three's output pass, and its box is placed from the top, the node renderer's viewport origin |
| `snow-under` | the snow lab's probe: the depth under each ski copied into a float target and read back with `readRenderTargetPixels` | the depth read by its texel (`screenCoordinate`), the target read back with `readRenderTargetPixelsAsync`, row 0 the top on WebGPU; the depth taken as 0..1 under WebGPU's clip space and as −1..1 elsewhere |

**What the instruments read.** `make bench` on seed 20 at LOW, in the
container (SwiftShader, whose WebGPU adapter offers `timestamp-query`):

| | WebGL | webgpu, before | webgpu, after |
| --- | --- | --- | --- |
| render (the processor's half) | 13.54 ms | 993.49 ms | 17.24 ms |
| gpu (the fence) | 957.25 ms | 0.00 ms | 1 001.09 ms |
| wall | 974.33 ms | 996.16 ms | 1 020.62 ms |
| the GPU's timer, a frame | trail 2.605, scene 192.724, grade 6.900 | none | trail 1.392, scene 740.360, grade 7.205 |
| skipped | — | `shadow-depth`, `snow-under`, `trail-overlay`, `gpu-timer` | `shadow-depth` |

Before this part nothing waited for the device, so its work landed on
whichever frame's submit stalled and the processor's half read as the
card's. The fence now bills it where it belongs. At HIGH the timer reads
trail 37.3, hero 43.8, shadow 12.7, scene 7 245.5 and grade 12.5 ms a
frame on webgpu (WebGL's queries: 34.4, 51.1, 14.2, 784.8, 13.7).
SwiftShader's timestamps are a software rasteriser's: they say where the
card's frame goes, not a phone's milliseconds. DEVELOPER ▸ BENCHMARK on a
device prints the same section from its own GPU.

`make profile ARGS="--scene race"` (seed 38, 1280×720) per frame: WebGL
178 draws, 760 368 triangles, 92 program binds, 162 texture binds;
webgpu-gl (WebGL's context, patched as before) 264 draws, 838 033
triangles, 156, 563; webgpu (the device's meter; before this part every
column read 0) 264 draws, 838 672 triangles, 163 pipeline binds, 407 bind
groups. The two node back ends agree on the draws.

The snow lab's probe (`make snow-eval ARGS="--under=groomer
--renderer=webgpu"`) reads the skis under the drawn snow on WebGPU within
0.2 cm of WebGL's, every row of the table (tip, mid and tail, the worst
and the mean, at every terrain, trails and resolution stop), and hides
none (0 % on both). The gear lab's outfits sheet on `webgpu-gl` differs
from WebGL's by 0.50 a channel on average (see the traps).

`make gore-cost ARGS="--scene=trunk --swiftshader --renderer=webgpu"`
(seed 2, MEDIUM, 640×360) now counts the device's pipelines: the hit on a
trunk builds **44 pipelines in its first quarter second**, two for each of
the 22 lumps (a `ShadowMaterial` and a `MeshStandardMaterial` pipeline
each, under the same names), with no pipeline built in the frames before
it or after. Its worst frame is that one (1 358.8 ms of the processor on
SwiftShader, 37.7 of them the gore's). Each lump has a pipeline of its
own where one would serve them all; why three keys them apart, and
warming them behind the card as part 6 does the world's, are for the
flip's sweep (part 15).

**What is still off.** The trail corner's two squares draw in place on
both node back ends and leave the picture whole, but they read empty: the
marks WebGL shows in them at the same moment (a few hundred pixels of
stamps and berms on seed 20 at 10 s) are not there, while the ground
draws the same maps' furrows. The twin's read of the maps is the open
question; the corner is a developer's instrument and draws nothing of the
game's, so it does not hold the flip, and it is carried to part 15.

**The gear stage's backdrop** (`stage-backdrop.ts`, behind the rider and
gear cards) is the `shader` row's last tenant. Its snow and its meadow are
finished by node grafts on the copy (`stage-snow`, `stage-meadow`,
`stage-tsl.ts`: the corduroy, the drift and the glitter), and its sky by a
node twin (`stage-sky`). The stage makes its renderer through `createGpu`.

**A renderer of its own** (`own-gpu.ts`'s `createGpu`): the gear stage and
the twelve harness pages that made a `WebGLRenderer` (audience, birds,
board, bones, cabins, civilians, crowd, gear, helmet, skier, skis, trees)
now ask for one on the link's back end. On WebGL it IS the bare
`WebGLRenderer` with the switches the page used before. On the webgpu
paths it is the node renderer on the world renderer's device
(`ownRenderer` in `gpu-device.ts`), and every scene it draws is dressed the
first time it is drawn, so a material made the game's way draws as the
game draws it. A world renderer's page (the snow lab, the gore lab) calls
`labBackend` first, which readies the seam. Every one of those labs, the
snow lab and the gore lab now take `--renderer=`.

**The labs' meters.** `make profile`'s WebGPU meter counts on the device's
own encoders, patched before the page's scripts run: every draw a pass or a
bundle records, every `setPipeline` as a program bind and every
`setBindGroup` as a texture bind, the textures made and the bytes written
through the queue. An indirect draw's triangles are on the GPU and are not
counted. `make gore-cost` counts the device's PIPELINES as its links (named
by their label or their vertex module's) and the queue's writes as its
uploads, and waits on the device's queue.

**Traps found here:**

- **Three's timestamp query is named for the frame, and the frame moves
  only in three's own loop.** A query's `uid` ends in `info.frame`, which
  three moves on only inside `setAnimationLoop`. The game draws from its
  own `requestAnimationFrame`, so every frame's queries had the same name
  and each one's answer overwrote the last. The timer moves `info.frame`
  on itself, once a frame.
- **The benchmark asks for its timer before the node renderer is ready.**
  WebGL's context exists the moment the renderer is made, but the node
  renderer's back end has no device until `init` resolves, and the
  benchmark turns its timer on at the start of the scene, before the
  world's load has waited for it. The first runs read no timestamp
  support and printed no GPU section, on a device that has the feature.
  The instruments ask the seam again once `ready` resolves
  (`renderer-instruments.ts`), unless another mode was asked in between.
- **The node renderer's viewport is measured from the top, on both of its
  back ends.** The trail corner's box, placed from the bottom as on WebGL,
  drew at the top of the screen. A readback's row 0 is the top on WebGPU and
  the bottom on the WebGL2 back end and on WebGL.
- **A canvas draw goes through three's output pass when the output wants
  tone mapping or an sRGB curve.** The node renderer then draws into a
  framebuffer target of its own and copies it out through the tone map and
  the curve, so a quad meant to land on the finished picture as it is
  would be re-graded, through a pass the world's frame does not need. The
  instrument's draw sets a linear colour space and no tone mapping for its
  own draw and puts them back after; the twin applies the sRGB curve
  itself, as WebGL's GLSL does.
- **A sampled draw onto the canvas after the grade wipes the picture.**
  The grade's pass is a full-screen pass, which three draws unsampled
  straight onto the canvas. A later draw onto the canvas with the
  renderer's own samples loads the canvas's MSAA buffer, which nothing
  wrote this frame, and resolves it over the whole picture: with the trail
  corner on, the world drew black around its two squares. The corner's
  scene is marked a full-screen pass (`isQuadMesh`, which only the node
  renderer reads), so it is drawn unsampled too.
- **A square's map is the trail's own uniform.** The corner swapped one
  material's map between its two draws; it now has a material a map, each
  over the trail's own uniform object, so the twin follows the slot as the
  ground's does.
- **A sheet's cells are laid out from the bottom.** Every lab that draws a
  grid of cells sets each one's viewport with y counted up from the
  canvas's foot, as WebGL counts it. On the node renderer the first runs
  drew the gear lab's rows upside down, each under the wrong label (a
  mean difference of 45.44 per channel against WebGL's sheet). The
  renderer of its own counts the canvas's viewport and scissor from the
  bottom (`bottomUp` in `gpu-device.ts`), so a lab's layout is the same
  on every back end: the gear lab's outfits sheet now differs from
  WebGL's by 0.50.
- **A lab's clear colour is tone mapped on the node renderer.** A page of
  its own that clears to a colour and tone maps the frame sees the colour
  through the tone map on the node renderer (its clear goes into the
  framebuffer target), and as given on WebGL. The tree lab's sheet ground is
  a shade lighter on the node paths for that reason; nothing of the game's
  own picture clears to a colour it reads.
- **A library is hooked once a renderer.** The dressing that finishes
  every material's node copy hooks three's node library. The gear stage
  and a harness dress several scenes on one renderer, and a second hook
  wrapped the first (`hookLibrary`, guarded by a `WeakSet`).
- **A page's own fog is kept.** A harness scene that sets a classic
  `scene.fog` keeps it: the dressing hangs the haze as the fog node only on
  a scene with none of its own, and a copy's `fog` is left as the material
  set it.
- **The tree lab's trunks draw without their girth.** The woods' girth is
  read per instance in the woods' own node path (`forest-tsl.ts`), which
  the game's forest uses; the tree lab draws the shapes as plain meshes, so
  its trunks are drawn at their base girth on the node paths. The game's
  woods are not affected.

## The flip (part 15)

**The default is `auto`.** A visit with no `renderer` in its link and
nothing picked on DEVELOPER ▸ RENDERER draws on the node renderer: on a
WebGPU device that passes the probe (see *The switch*), else on its WebGL2
back end. `?renderer=webgl` and DEVELOPER ▸ RENDERER ▸ CLASSIC WEBGL are the
way back to the `WebGLRenderer`, which draws exactly what it drew before:
the 14 WebGL world shots below are byte-identical to part 14's. The row is a
fact about the machine (`DEVICE_SETTINGS`), so the cloud save never carries
it.

**The fallback, tested** in headless Chromium against the built site (the
race on seed 20 at LOW), each case in a fresh browser:

| Case | What the page did | `__SH_BACKEND__` |
| --- | --- | --- |
| no link, no WebGPU switches (no adapter) | the node renderer on WebGL2 | `webgpu-gl` |
| no link, an adapter whose canvas is lost on configure (the container's "half" switches) | the probe failed, the device was destroyed, WebGL2 in the same load | `webgpu-gl` |
| no link, the full WebGPU switches | the probe passed | `webgpu` |
| `?renderer=webgl` | the classic renderer | `webgl` |
| CLASSIC WEBGL stored on the developer page | the classic renderer | `webgl` |
| the tab already marked as fallen back | WebGL2 at once, no device asked for | `webgpu-gl` |
| the device reported lost 15 s into the load (a test hook) | the tab marked and reloaded once, then WebGL2 | `webgpu-gl` |

No case drew a black page, and none reloaded more than once.

**The trail maps' stamps were culled on the node paths.** The stamp's twin
writes each quad with v turned to the maps' top-down rows, which turns its
winding, and the node renderer culls by the ORIGINAL material's side, not
the twin's. Every stamp was a back face and was dropped, so the developer's
trail corner read empty. The stamp and the swath materials are drawn
double-sided (WebGL's quads face front, so WebGL draws the same), and the
corner's squares are made again when a load rebuilds the maps. The corner
now shows the marks WebGL shows at the same moment. The world lab's views
below moved by a few pixels at most.

**The gore's lumps each built two pipelines at the hit.** Three's render
object adds the mesh's own id to the key of every instanced mesh, and each
one's instance buffer is a uniform named by its node's id in the shader, so
no two instanced meshes share a pipeline, even with one material and one
geometry layout. The lumps were 22 instanced blocks made at the hit, a
picture and a shadow pipeline each: 44 pipelines in the hit's first
quarter second. Now every shape a view can throw has a STANDING block from
the load (`createLumps(material, shapes)`): hidden while empty, emptied
rather than let go, and drawn one instance by the warm-up behind the card
(`standAll` gives an empty instanced mesh a count of one for the warm-up's
draw). A death hands the dead a baked mesh (`lay`) and the next rider keeps
the blocks. The crowd's and the animals' gore stand theirs the same way.
`make gore-cost ARGS="--scene=trunk --swiftshader --renderer=webgpu
--twins=0 --seconds=2"` (seed 2, MEDIUM, 640×360):

| | Before | After |
| --- | --- | --- |
| Pipelines built in the hit's first quarter second | 44 | 0 |
| Pipelines built after the hit, in all | 44 | 0 |
| Worst processor frame of that quarter second | 1 848.8 ms | 309.7 ms |
| The gore's own update in it | 64.5 ms | 46.7 ms |

On WebGL a program is keyed by its material, so the primer already covered
the lumps there, and the standing blocks change nothing it draws.

**What the loading card builds.** The game's race on seed 20 at 640×360 on
SwiftShader's WebGPU, watched from the moment the card lifts (the part 6
method; 60 s at LOW, 90 s at HIGH):

| | LOW, before | LOW, after | HIGH, before | HIGH, after |
| --- | --- | --- | --- | --- |
| Pipelines built before the card lifts | 300 | 325 | 533 | 599 |
| Pipelines built after it | 0 | 0 | 0 | 0 |

The new ones are the gore's standing blocks and their shadows, and the
stamps' pipelines now that they draw. No pipeline is built mid-run on
either preset.

**How near the picture is.** `make world SEED=38` at 12 h on the new
default (`--renderer=auto`, which drew on `webgpu`) against WebGL, the mean
absolute difference per channel (0 to 255), part 14's webgpu beside it:

| Quality | View | Part 14 | Part 15 |
| --- | --- | --- | --- |
| HIGH | spawn | 3.48 | 3.48 |
| HIGH | far | 2.94 | 2.94 |
| HIGH | vista | 1.28 | 1.28 |
| HIGH | track | 3.36 | 3.36 |
| HIGH | chase-6 | 3.48 | 3.48 |
| HIGH | tips | 4.92 | 4.92 |
| HIGH | village street (free ride) | 1.00 | 1.00 |
| LOW | spawn | 2.82 | 2.82 |
| LOW | far | 2.25 | 2.25 |
| LOW | vista | 0.62 | 0.62 |
| LOW | track | 2.41 | 2.41 |
| LOW | chase-6 | 2.35 | 2.35 |
| LOW | tips | 3.32 | 3.32 |
| LOW | village street (free ride) | 0.92 | 0.92 |

No view moved by as much as a hundredth, and none is worse. What still
differs is part 14's: at the tips camera WebGL shows the near ski's shadow
and its groove where the node renderer does not, and on the groomed track
the two draw the field's grooves differently.

**The picture's prices, re-measured for the node renderer** (`PICTURE_PRICES`
in `picture-fit.ts`, which AUTO fits by). There was no GPU to hand, so the
list is an ESTIMATE: SwiftShader prices the processor, and its numbers are
RELATIVE, never a device's. Seven rows were lowered to their cheapest stop
against the top picture on the benchmark's race, on the new default and on
WebGL, in the same software at 320×180 (`make bench ARGS="--costs --cheapest
--rounds 1 --frames 60 --width 320 --height 180 --views race --rows …"`; the
two flags are this part's, for a software device: the whole list at the
plan's 600 frames and three rounds is days there). Each row's share of the
frame on the node renderer over its share on WebGL scaled the reference
machine's WebGL prices:

| Row | Share of the top frame, WebGL | Node renderer | Ratio | Prices (each stop over the cheapest, ms) |
| --- | --- | --- | --- | --- |
| RESOLUTION | 19.0 % | 21.5 % | 1.13 | 0.72, 2.26 → 0.82, 2.56 |
| DISTANCE | 32.0 % | 36.7 % | 1.15 | 0.36, 0.85, 1.50 → 0.41, 0.97, 1.72 |
| TERRAIN | 15.8 % | 20.8 % | 1.31 | 0.32, 1.19 → 0.42, 1.56 |
| TRAILS | 23.3 % | 10.2 % | 0.44, held at 0.5 | 0.37, 1.18, 1.35 → 0.18, 0.59, 0.68 |
| FOREST | 8.8 % | 9.5 % | 1.09 | 0.16, 0.38 → 0.17, 0.41 |
| SHADOWS | 10.7 % | 2.5 % | 0.23, held at 0.5 | 0.80, 0.88, 1.45 → 0.40, 0.44, 0.72 |
| ANTIALIAS | 56.2 % | 58.2 % | 1.04 | 1.22, 1.60 → 1.26, 1.66 |
| every row at its cheapest | 5.4 % | 5.3 % | 0.99 | `FLOOR_MS` 3.56 → 3.53 |

One software run is noisy, so no row moved further than half or twice its
WebGL price. SPRAY, LAMPS, SKY and HORIZON keep WebGL's. The top frame was
3 433 ms on WebGL and 5 866–6 081 ms on the node renderer, the processor's
own work in software, and says nothing about a device. The benefits did not
move.

**What AUTO keeps.** The fit only reads the costs relative to each other
(the probe's timed frame scales the whole list), so the question is whether
a machine slower than the reference still keeps the look. On a machine N
times slower than the reference at the top picture, fitted twice as the
probe fits:

| N | Before (WebGL prices) | After |
| --- | --- | --- |
| 1 | the top picture | the top picture |
| 1.5 | RESOLUTION LOW, DISTANCE HIGH, ANTIALIAS OFF, the rest at the top | RESOLUTION LOW, ANTIALIAS OFF, the rest at the top |
| 2 | ...TERRAIN LOW, SHADOWS MEDIUM, LAMPS LOW (worth 200) | ...DISTANCE HIGH, TERRAIN MEDIUM, SHADOWS MEDIUM (worth 218) |
| 3 | TRAILS LOW, SHADOWS OFF, FOREST HIGH (worth 122) | TRAILS LOW, SHADOWS MEDIUM, FOREST LOW (worth 148) |
| 4 | nearly the floor, TRAILS OFF (worth 17) | TRAILS LOW kept, the rest low (worth 55) |
| 6 or more | the floor | the floor |

Nobody is dropped to LOW who was not before; a machine two to four times
slower than the reference keeps more of the look, mostly the trails and
the shadows the node renderer prices lower. SwiftShader itself times a
frame of a second or more, past six times slower, and AUTO picks the floor
there as before. `tests/video_test.ts` holds the ladders (every row priced,
the cheapest stop 0/0, neither cost nor benefit falling up a ladder).
**Owed:** a real GPU's list on the node renderer, from DEVELOPER ▸ PICTURE
COSTS (or `make bench ARGS="--gpu --costs"`) on a phone and on a laptop.

**Traps found here:**

- **The node renderer culls by the material drawn, not by its twin.** A
  twin that turns a quad's winding has to be paired with a double-sided
  original.
- **Three keys every instanced mesh apart.** An instanced mesh made
  mid-run is a new pipeline (two with shadows) whatever material it
  shares, so a pool of them is made at the load and kept.
- **The warm-up draws nothing of an empty instanced mesh.** It is given
  one instance for the warm-up's draw and put back.
- **A lab that names no renderer now photographs the node renderer** if it
  drives the built site, since the site's default is `auto`. Every lab's
  flag defaults to `webgl` and names it in the link.

## Compute: what pays, and the woods drawn indirect (part 17)

Part 17 was to move the processor's per-frame work onto the GPU where it
pays, on WebGPU only, with the current path kept for `webgpu-gl` and WebGL.
The candidates were the forest's cull and its draws, the snow cloud, the
spray, the snowfall, the trail stamps and the deformable snow. They were
measured first, and only the dearest was moved.

**What each candidate costs the processor.** A CPU profile of the game's
race on seed 20 at HIGH on WebGPU (SwiftShader, 640×360, an unminified
build, 150 s after the card lifts, CDP's sampling profiler, the samples
under a one-off canvas upload left out), each system's own time a frame:

| System | Processor a frame | What it is | Moved? |
| --- | --- | --- | --- |
| The woods' draws (three's work per render object) | 3.7 ms at HIGH, 0.9 at LOW (the no-draw meter below: what folding them in took off three's `render`) | a render object, a bindings check and a draw a shape in use: 147 of the frame's 252 at HIGH | **yes: one indirect draw a pass** |
| The deformable snow (`deform-snow.ts`: the press and the takes, the walls' settle, its shade pass) | 3.8 ms (1.9 press and takes, 0.7 settle, 1.2 the shade's pass) | a field of 5 cm cells round the player, MEDIUM and HIGH | no (below) |
| The trail maps (`trail-map.ts`'s `update`) | 1.4 ms | three's own pass to draw the stamps; the stamps themselves 0.03 ms | no (below) |
| The woods' cull and refill (`forest.ts`'s `update` less the crags') | 0.5 ms | the cells in the frustum, the hand-over, the lists | no (below) |
| The spray (`spray.ts`'s emit and update) | 0.11 ms | the throws; the flight is already the GPU's (`gpu-spray.ts`) | no |
| The snow cloud (`snow-cloud.ts`'s emit and update) | 0.02 ms | a few hundred puffs flown, shaded sun-first and sorted | no |
| The snowfall (`snowfall.ts`'s update) | under 0.01 ms | the flakes are the GPU's already; 900 grains of spindrift | no |

The woods' draws were the one candidate that is both dear and moveable
without changing the picture.

**The woods in one indirect draw a pass** (`forest-indirect.ts`). Since
part 8 the node renderer drew the woods a shape at a time: a mesh, a render
object and a draw for every shape in use, 147 at HIGH. Three's per-object
work for each (its bindings, its pipeline, its buffers set) is processor time
every frame. On a WebGPU device that offers `indirect-first-instance`, every
shape is now packed into ONE geometry, and each pass is ONE mesh drawn
indirect: an argument block a shape (its indices, the trees listed for it,
its first index, its first vertex, and its first instance), from which three
issues one `drawIndexedIndirect` a shape in use off the one render object.

- **The list is the same.** The words are the same 32-bit words
  (`slotWord`), one instanced attribute for the pass, each shape's run at a
  fixed place (its room, counted once). The draw's first instance points the
  shape at its run, so the vertex reads its word as before. The woods'
  materials (`forest-tsl.ts`) are unchanged.
- **The cull is still the processor's** (`forest.ts`), the same trees in the
  same order as every other path. The argument blocks are written by the
  processor too: a shape's count is its run's length.
- **The draws come back to a few**: the picture's faceted woods, their
  casters, and HIGH's card woods, one render object each.
- **Elsewhere nothing changed.** The kit offers the indirect batch only
  where the device has the feature (`woodsKit`'s `indirect`, asked of the
  device by the dressing). On the WebGL2 back end, and on a WebGPU device
  without the feature, the woods are drawn a shape at a time as in part 8.
  WebGL draws its one multi-draw batch, untouched.

**What it bought.** The benchmark's race on seed 20, 640×360, SwiftShader's
WebGPU, before and after, back to back:

| | LOW, before | LOW, after | HIGH, before | HIGH, after |
| --- | --- | --- | --- | --- |
| Draw calls a frame (render objects) | 133 | 98 | 252 | 110 |
| The woods' objects | 37 | 1 | 153 | 3 |
| Pipelines | 79 | 79 | 167 | 167 |
| Processor, render (the no-draw meter, 300 frames) | 8.30 ms | 7.39 ms | 18.12 ms | 14.79 ms |
| of it `submit` (three's `render`) | 5.11 ms | 4.20 ms | 10.94 ms | 7.23 ms |
| Processor, render (the plain benchmark, 60 frames) | 14.38 ms | 12.65 ms | 25.94 ms | see below |

THE NO-DRAW METER is the benchmark with every draw on the encoder stubbed to
nothing (an init script over `GPURenderPassEncoder`), so the main thread is
priced without SwiftShader rasterising under it, as performance round 5
priced WebGL. The plain benchmark's processor numbers on SwiftShader's WebGPU
move with the device's queue: one reading of its 60 frames can hold a frame
that waited a second for the queue (HIGH after: a mean of 967 ms out of
readings of 19–47 ms). The encoder still issues one draw a shape in use, so
the GPU's own work is the same; what is saved is three's processor work a
render object. On a phone, where the processor is often the frame's floor,
that is the gain. Owes a device's benchmark.

**The lists are the same bytes.** `make cpu-cost ARGS="--suite forest
--woods webgl|nodes|indirect"` (the new `--woods` flag fills the node
renderer's lists in Node with plain materials) hashes every run of words
each path draws: `6544342d8ffe` for WebGL's batch, the shapes drawn
instanced and the indirect pass alike, over 600 frames of the benchmark's
race at HIGH. The fill itself costs the same (p50 0.21, 0.28 and 0.23 ms).

**Why the others stayed where they are:**

- **The deformable snow** is the dearest left (3.8 ms), but it is not a
  field a GPU can settle the same way. The press, the takes and the settle
  are in-place sweeps whose order is part of the look (a wall slumps along
  the sweep, alternating each pass). The spray's budget reads the kilograms
  dug (`thrown()`) in the same frame, and the takes weigh the snow still
  standing before they dig. A GPU field would need a readback a frame late,
  or a different (Jacobi) settle that looks different. A lead, not a
  speed-up.
- **The trail stamps are already the GPU's**: the stamps are quads blended
  MAX into the maps, and the processor's 1.4 ms is three's own pass, not the
  stamping (0.03 ms). WGSL's atomics work on storage buffers only, not on
  storage textures, so an `atomicMax` stamp would need a buffer, a copy into
  the texture the ground filters, and a pass of its own: more passes for no
  processor time.
- **The woods' cull** is 0.5 ms and runs only when the lens has moved. The
  hand-over keeps each tree's dissolve on the wall clock with hysteresis,
  so a GPU cull would need that state on the GPU, and every path's lists are
  held equal by the suite today. The indirect draws took the dearer half.
- **The spray, the snow cloud and the snowfall** cost a tenth of a
  millisecond or less. The spray's flight and the snowfall's flakes have
  been the GPU's since before the port (`gpu-spray.ts`, the fall's box).
  The cloud's self-shadow is a sun-first walk where each puff is shaded by
  those before it, and its shadow blots and the snow lab read the puffs on
  the processor.

**Metal-reachable features.** `indirect-first-instance` is now asked for
wherever the adapter has it (`gpu-device.ts`), as every other feature the
port uses is. SwiftShader's adapter offers it; a device's benchmark says
whether it does (its WHAT WAS STANDING THERE reads `woods-indirect` rows in
place of `woods`). Timestamp queries measured the GPU's passes (the
benchmark's WHERE THE GPU WENT, unmoved: the scene pass's share is the
same, since the encoder draws the same shapes). `shader-f16` is still asked
for, and still unused: no shader was written here.

**Pipelines after the card.** The game's race on seed 20, 640×360,
SwiftShader's WebGPU, watched from the moment the card lifts (the part 6
method):

| Build | Picture | Pipelines before the run | After the card |
| --- | --- | --: | --: |
| Before | LOW | 325 | 0 |
| After | LOW | 325 | 0 |
| After | HIGH | 599 | 0 |

The indirect passes are compiled by the loading card's warm-up like every
other mesh, so nothing is built mid-run. Dawn's one warning in these runs
(`Draw with an index count of 0 is unusual`) is printed by the build before
this part too, so it is not the woods'.

**How near the picture is.** `make world SEED=38` at 12 h on WebGPU, after
against before, the mean absolute difference per channel (0 to 255):

| View | LOW | HIGH |
| --- | --: | --: |
| spawn | 0 (byte-identical) | 0.00001 (one pixel) |
| far | 0 (byte-identical) | 0 (byte-identical) |
| vista | 0 (byte-identical) | 0 (byte-identical) |
| track | 0 (byte-identical) | 0 (byte-identical) |
| chase-6 | 0 (byte-identical) | 0 (byte-identical) |
| powder | 0 (byte-identical) | 0 (byte-identical) |
| forest | 0 (byte-identical) | 0.00001 (one pixel) |

The two pixels that moved are where two trees' faces meet at the same
depth: the indirect pass draws the shapes in the shape table's order, the
instanced meshes were drawn in three's sorted order, and the depth test
keeps whichever came first. A probe that counted the encoder's calls during
two of these shots read 78 indirect draws, so the shots above are the
indirect path's and not the old one's.

The effect labs on WebGPU, after against before: `make snowfall
ARGS=--renderer=webgpu` byte-identical (the frame sheet and the flow
sheet); `make cloud ARGS=--renderer=webgpu` 0.00014 (313 pixels of 5.9
million, the most 23 levels, all on tree edges behind the cloud: the same
draw order). The spray lab (`make spray`, the turns lab) draws on WebGL
only and its code is untouched; `make forest` is a map of where the trees
stand, made in Node, and reads nothing drawn.

The 14 WebGL shots (`?renderer=webgl`, the same seven views at LOW and
HIGH) are byte-identical to before.
`webgpu-gl` draws the woods a shape at a time as before, so no program it
links changed: the most any binds is still the ground's, 16 at HIGH.

**Traps found here:**

- **The scene is dressed before three's `init` resolves**, so
  `renderer.backend.device` is still null when the woods' kit is made. Ask
  the device the seam was handed, never three's back end, for a feature.
- **A first instance in an indirect draw needs `indirect-first-instance`.**
  Without the feature WebGPU validates a non-zero `firstInstance` in the
  buffer as a draw of nothing, not an error: the woods would vanish without
  a message.
- **Three counts a render object as one draw**, whatever it issues. The
  frame's `drawCalls` falls by the shapes folded in, while the encoder still
  makes a draw a shape. The triangle counter reads the draw range times the
  instance count, so each pass's draw range is set to its mean shape's
  indices.

## Measuring both paths

Every browser lab takes `--renderer=webgl|webgpu|webgpu-gl|auto`
(`scripts/lib/backend-flag.mjs`), `webgl` when it is left out (part 15):
`auto` is what a player gets. The flag gives the lab the query
parameter, the Chromium switches that back end needs, and a check
(`assertBackend`) that fails the lab when the page drew on a different back
end than the one asked for. `make bench ARGS="--renderer=both"` runs the
benchmark on each back end and closes with the two side by side. The labs
that take the flag are `make bench`, `make screenshots`, `make world`,
`make sky`, `make snowfall`, `make cloud`, `make xray`, `make heli`,
`make plane`, `make balloon`, `make fires`, `make water`, `make snowguns`,
`make summer`, `make avalanche`, `make profile`, and from part 14 every
lab whose page draws its own sheet (`make trees`, `make birds`,
`make cabins`, `make crowd`, `make civilians`, `make audience`,
`make board`, `make bones`, `make gear`, `make helmet`, `make skier`,
`make skis`), `make snow-eval` and `make gore-cost`. `make world`
takes `--weather=` as well, so a fall can be photographed over a run.
`make sky` times the GPU sky's passes on WebGL only. `make profile`
counts on WebGL's context on `webgl` and `webgpu-gl`, and on the device's
encoders on `webgpu` (part 14).

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
| 8 Forest | 2026-10-20 | webgpu | 114 (79 before) | 170 808 (144 326) | 64 programs, 41 pipelines (62, 40 before) | 969.29 (979.56 before) | 962.21 (972.75) | 5 passes / 28 meshes (5 / 29 before) | The woods draw, a shape at a time, and cast into the key's map. The steady readings are 9–10 ms (10–12); the mean is the device's queue on SwiftShader, which the last reading drains (5 000 ms). At HIGH: 223 draws (85), 610 385 triangles (464 052), 126 programs and 92 pipelines (121, 89), 10 375.37 ms (10 319.44) with steady readings of 24–37 ms (14–22) and a last reading of 58 728 ms (44 918). Part 17's indirect draws take the draws back on WebGPU |
| 9 Particles and air | 2026-10-21 | webgl | 100 | 231 883 | 51 programs | 13.65 (13.42 before) | 6.35 (6.34) | 0 / 0 | the 42 WebGL world shots (seed 38; LOW and HIGH; 9, 12 and 16.5 h; spawn, chase-6, powder, furrow, landing, far; and snowing at 12 h) are pixel-identical to part 8's. At HIGH: 110 draws, 686 162 triangles, 67 programs, 16.57 ms (21.46) |
| 9 Particles and air | 2026-10-21 | webgpu | 116 (114 before) | 173 541 (170 618) | 74 programs, 46 pipelines (64, 41 before) | 828.40 (1 040.77 before) | 821.09 (1 033.81) | 5 passes / 24 meshes (5 / 28 before) | The spray, the snowfall and the snow cloud and its shadow draw. The steady readings are 10–11 ms (11–17); the mean is the device's queue on SwiftShader, which one reading drains (3 892 ms; 4 030 before). At HIGH: 224 draws (223), 616 797 triangles (610 097), 136 programs and 97 pipelines (126, 92), 7 936.49 ms (9 420.68) with steady readings of 29–33 ms (17–29) and a last reading of 41 606 ms (41 315) |
| 10 Clouds | 2026-10-21 | webgl | 100 (101 before) | 231 880 (231 913) | 51 programs | 18.89 (18.88 before) | 9.24 (8.57) | 0 / 0 | the 64 WebGL world shots (seed 38; LOW and HIGH; clear and overcast at 9, 12 and 16.5 h, fair and snowing at 12 h; spawn, far, vista, chase-6) are byte-identical to part 9's. At HIGH: 110 draws, 686 187 triangles, 67 programs, 23.42 ms (22.24). The container ran the world lab beside the bench, so every ms here is higher than part 9's |
| 10 Clouds | 2026-10-21 | webgpu | 116 (115 before) | 173 759 (173 523) | 76 programs, 47 pipelines (74, 46 before) | 1 215.71 (2 316.78 before) | 1 208.27 (2 306.20) | 4 passes / 24 meshes (5 / 24 before) | The cloud shadow, the slab and the volume draw; at LOW the shadow map's pass is the new pipeline. The steady readings are 6–18 ms (7–15); the mean is the device's queue on SwiftShader, which the last reading drained before (10 111 ms) and none drains here. At HIGH: 226 draws (224), 625 856 triangles (617 124), 143 programs and 101 pipelines (136, 97), 11 508.58 ms (15 237.89) with steady readings of 19–21 ms (21–41) and two draining readings of 66 381 and 39 448 ms (one of 72 688). Snowing at HIGH (`--views snow`, webgpu alone): 227 draws (234), 633 740 triangles (637 066), 139 programs and 99 pipelines (132, 95), 7 841.75 ms (7 580.92) with steady readings of 17–22 ms (15–24) and one draining reading of 32 958 ms (none) |
| 11 Figures | 2026-10-21 | webgl | 100 | 231 877 (231 883) | 51 programs | 12.27 (13.61 before) | 5.30 (6.32) | 0 / 0 | the WebGL world shots (seed 38; LOW and HIGH; 9, 12 and 16.5 h; spawn, chase-6, track, far; the free ride's figures and a slalom's stands at 12 h) are byte-identical to part 10's. At HIGH: 110 draws, 686 162 triangles, 67 programs, 17.55 ms (17.69) |
| 11 Figures | 2026-10-21 | webgpu | 123 (116 before) | 217 032 (173 731) | 94 programs, 62 pipelines (76, 47 before) | 861.49 (785.23 before) | 855.41 (779.34) | 4 passes / 16 meshes (4 / 24 before) | The race's fans and animals draw. The new pipelines are the fans' (one program for all their stands), the animals' (one for every herd's count: three's own instancing) and their shadows'. The steady readings are 7–13 ms (8–10); the mean is the device's queue on SwiftShader, which two readings drain (3 787 and 3 987 ms; 3 835 and 4 474 before). At HIGH: 243 draws (233), 672 010 triangles (627 849), 182 programs and 135 pipelines (143, 101), 7 990.37 ms (7 454.24) with steady readings of 20–22 ms (15–26) and two draining readings of 41 498 and 40 820 ms (one of 39 509) |
| 12 Skier, models, effects | 2026-10-22 | webgl | 100 | 231 883 (231 877) | 51 programs | 12.05 (11.93 before) | 5.69 (5.27) | 0 / 0 | the 21 WebGL world shots (seed 38 at HIGH; 9, 12 and 16.5 h; spawn, chase-6, tips, helmet, landing, track, far) are byte-identical to part 11's. At HIGH: 110 draws, 686 162 triangles, 67 programs, 17.02 ms (16.98) |
| 12 Skier, models, effects | 2026-10-22 | webgpu | 127 (123 before) | 225 611 (217 032) | 100 programs, 64 pipelines (94, 62 before) | 839.63 (809.29 before) | 833.26 (803.32) | 4 passes / 12 meshes (4 / 16 before) | The four skiers' modelled skis draw (`model-merged:field ×4` left the quarantine), with their grafts on the copy and WebGL's shadows. The steady readings are 8–16 ms (9–13); the mean is the device's queue on SwiftShader, which one reading drains (3 938 ms; two of 3 643 and 3 849 before). At HIGH: 246 draws (243), 680 405 triangles (672 010), 192 programs and 141 pipelines (182, 135), 6 826.17 ms (7 846.98) with steady readings of 18–29 ms (22–35) and no draining reading among the four printed (two of 40 379 and 41 074 before). What is left hidden is part 13's cabins, gates and stands |
| 13 Buildings and props | 2026-10-22 | webgl | 100 | 231 883 (231 913) | 51 programs | 13.64 (13.36 before) | 5.83 (5.64) | 0 / 0 | the 23 WebGL world shots (seed 38 at HIGH; 12 h: spawn, far, vista, track, thirteen of the free ride's buildings and props, four of a slalom's; 21 h: the free ride's village street and plaza) are byte-identical to part 12's but for six pixels of the night sky that move from run to run. At HIGH: 110 draws, 686 162 triangles, 67 programs, 18.77 ms (22.72) |
| 13 Buildings and props | 2026-10-22 | webgpu | 133 (128 before) | 231 669 (225 825) | 117 programs, 79 pipelines (100, 64 before) | 974.14 (1 191.44 before) | 967.55 (1 183.70) | 4 passes / 0 meshes (4 / 12 before) | The race's cabins, its gates' furniture and its stands draw (`haze-graft:cabins ×10 · haze-graft:checkpoints ×1 · haze-graft:audience ×1` left the quarantine, and nothing is hidden now). The new pipelines are the cabins', the gates' furniture's and the stands', which were hidden before. The steady readings are 13–17 ms (10–18); the mean is the device's queue on SwiftShader, which the last reading drains (4 121 ms; 7 287 before). At HIGH: 243 draws (237), 673 385 triangles (676 629), 220 programs and 167 pipelines (192, 141), 8 466.84 ms (12 548.06) with steady readings of 16–26 ms (21–42) and one draining reading of 37 423 ms (two of 66 182 and 69 420) |
| 14 Instruments and tools | 2026-10-22 | webgl | 100 | 231 883 (231 877) | 51 programs | 13.54 (13.97 before) | 5.85 (6.21) | 0 / 0 | the WebGL world shots (seed 38 at HIGH, 12 h: spawn, far, track, chase-6) are byte-identical to part 13's. The GPU's timer (WebGL's queries, as before): trail 2.605, hero 0.002, scene 192.724, grade 6.900 ms a frame (2.591, 0.002, 165.043, 7.594 before) over 59 frames. At HIGH: 110 draws, 686 190 triangles, 67 programs, 19.72 ms (19.59); the timer: trail 34.4, hero 51.1, shadow 14.2, scene 784.8, grade 13.7 ms (37.3, 55.3, 15.1, 907.4, 15.3) |
| 14 Instruments and tools | 2026-10-22 | webgpu | 133 (134 before) | 231 434 (231 682) | 117 programs, 79 pipelines (117, 79 before) | 17.24 (993.49 before) | 9.62 (986.33) | 1 pass / 0 meshes (4 / 0 before) | `snow-under`, `trail-overlay` and `gpu-timer` run; `shadow-depth` alone is skipped. THE FENCE IS THE DEVICE'S QUEUE NOW: the frame waits for SwiftShader's work (1 001.09 ms a frame; 0.00 before, when nothing waited and the work landed on whichever frame's submit stalled), so the processor's half reads as itself (17 ms) and the wall is the card's (1 020.62 ms; 996.16 before). THE GPU'S TIMER on SwiftShader's `timestamp-query`: trail 1.392, scene 740.360, grade 7.205 ms a frame, 748.957 summed, over 59 frames (no section before). At HIGH: 253 draws (244), 686 498 triangles (676 653), 220 programs and 167 pipelines (220, 167), render 1 157.36 ms (9 393.83), gpu 7 420.28 ms (0.00), wall 8 580.01 ms (9 396.87); the timer: trail 37.331, hero 43.845, shadow 12.683, scene 7 245.496, grade 12.536 ms, 7 351.891 summed |
| 15 The flip | 2026-10-23 | webgl (`?renderer=webgl`) | 100 | 231 883 (231 883) | 51 programs | 11.52 (13.54 before) | 5.52 (5.85) | 0 / 0 | the way back: the 14 WebGL world shots (seed 38, 12 h, LOW and HIGH: spawn, far, vista, track, chase-6, tips and the free ride's village street) are byte-identical to part 14's. Wall 870.27 ms. At HIGH: 110 draws, 686 162 triangles, 67 programs, 16.59 ms (19.72) |
| 15 The flip | 2026-10-23 | auto (drew on webgpu) | 133 (133 before) | 231 669 (231 434) | 117 programs, 79 pipelines (117, 79 before) | 14.71 (17.24 before) | 8.07 (9.62) | 1 pass / 0 meshes (1 / 0 before) | THE DEFAULT. Nothing new is drawn in the benchmark's race; the gore's standing blocks are hidden until a hit, so they are neither drawn nor counted here (the warm-up builds them behind the card: see this part). Wall 856.17 ms (1 020.62), the device's queue on SwiftShader. At HIGH: 252 draws (253), 685 819 triangles (686 498), 220 programs and 167 pipelines (220, 167), render 27.17 ms (1 157.36), wall 7 639.03 ms (8 580.01) |
| 17 Compute | 2026-10-23 | webgl (`?renderer=webgl`) | 100 | 231 883 (231 877) | 51 programs | 10.82 (11.46 before) | 5.14 (5.12) | 0 / 0 | untouched: the 14 WebGL world shots (seed 38, 12 h, LOW and HIGH: spawn, far, vista, track, chase-6, powder, forest) are byte-identical to the build before this part. At HIGH: 110 draws, 686 010 triangles, 67 programs, 15.95 ms (17.80) |
| 17 Compute | 2026-10-23 | webgpu | 100 (133 before) | 231 657 (231 434) | 117 programs, 79 pipelines (117, 79 before) | 12.65 (14.38 before) | 6.74 (8.04) | 1 pass / 0 meshes (1 / 0 before) | The woods are one indirect draw a pass (`woods-indirect`: 1 object at LOW where 34 were). THE NO-DRAW METER (every encoder draw stubbed, 300 frames): render 7.39 ms (8.30), submit 4.20 (5.11). At HIGH: 110 draws (252), 687 129 triangles (686 010), 220 programs and 167 pipelines (220, 167), the woods 3 objects (147); the plain mean is one reading that waited on the device's queue (967.00 ms; readings of 19–47 ms against 21–37 before), so the no-draw meter reads it: render 14.79 ms (18.12), submit 7.23 (10.94) |

Parts 1 to 17 were measured with `make bench ARGS="--renderer=both --frames 60 --width
640 --height 360 --video low"` on seed 20 (the woods and a kicker, four skis), and from
part 3 again with `--video high` for the numbers under "At HIGH" (part 15 with `--renderer=webgl` and `--renderer=auto`, one back end a run; part 17 with `--renderer=webgl` and `--renderer=webgpu`, and its no-draw meter at 300 frames).

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
- [x] 11 Figures (`figures`, `gore-tree`): the crowd, the civilians, the dogs and their steam, the traffic, the fans, the birds, the animals and the blooded tree as figure twins whose vertex runs the graft where WebGL's does; the shadow of a caster whose depth carries the graft moved the same way; two fixes to three's node builder; `shader` moved to part 12, `haze-graft` to 13
- [x] 12 Skier, models, effects (`model-merged`, `skier`, `wingsuit`, `cloth`, `effects`): the merged models' metal, roughness and coat, the posed parts' normals, the kit's flutter, the wingsuit's paint, the canopies, the lines and the envelope as node grafts on the copy; a material's own clipping planes as its mask; the rotors, the lift's fade, the burner, the burn and the X-ray as node twins over the material drawn; `shader` moved to part 13
- [x] 13 Buildings and props (`props`): every facade, the rooms, the crags and the talus, the signs' bump, the water, a summer's grass and a slab's walls as node grafts on the copy; the flags, a slab's plates, the floodlights' haloes and the fires as node twins, the flags and the plates as figure twins; the instance's colour handed on by a figure's own instancing; `shader` and `haze-graft` moved to part 14
- [x] 14 Instruments and tools (`snow-under`, `trail-overlay`, `gpu-timer`): the GPU's timer off the node renderer's timestamp queries, the device's queue as the benchmark's and AUTO's fence, the trail corner and the snow probe as node twins read back asynchronously, the gear stage's backdrop by node grafts and a twin, every harness's renderer of its own through `createGpu`, the WebGPU meters in `make profile` and `make gore-cost`; `shader` and `haze-graft` emptied and kept as guards until part 16
- [x] 15 The flip: `auto` by default (WebGPU, else WebGL2 nodes, with a probe and a fallback at load), `?renderer=webgl` and DEVELOPER ▸ RENDERER the way back, the trail maps' stamps drawn on the node paths, the gore's lump blocks standing and warmed behind the card, the picture's prices re-measured for the node renderer
- [ ] 16 The GLSL deleted, and the quarantine with it (`shadow-depth` too)
- [x] 17 Compute (WebGPU only): measured first; the woods drawn as one indirect draw a pass off `indirect-first-instance`; the deformable snow, the trail stamps, the woods' cull, the spray, the snow cloud and the snowfall kept on their paths, each with why
- [ ] 18 Ray-marched effects

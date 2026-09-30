---
name: snow-look
description: "Use when working on how the SNOW LOOKS — the snow as DRAWN rather than as simulated: the terrain's shader (`snow-glsl.ts` grafted into a MeshStandardMaterial by `terrain.ts`), the ground read per pixel off the gradient texture, the wrap lighting and its blue terminator, the GLITTER (world-space crystal facets flaring when they line the sun up with the eye), the sheen at a grazing angle, the GROOMED PISTE (greyer, shinier, the comb's corduroy along it), the rock and the crust the region paints, the forest tint past the far band, and the DEFORMATION — the world-space trail map every skier's stations are stamped into (`trail-stamp.ts` decides each capsule, `trail-map.ts` keeps the coarse and fine maps), lowering the snow in the vertex shader and bending the normal per pixel. Not what the snow DOES to the skis (`ski-physics` — `snow.ts` is the engine's), not the sky it is lit by (`atmosphere`), not the spray in the air (`visual-effects`)."
---

# The snow's look — the snow as drawn

The snow is the product's face: it fills most of every frame. `ski-physics`
owns what the snow DOES — how far it lets a station sink, what it costs,
what an edge holds in it; this skill owns everything between the generator's
heightfield and the pixel: the light on it, the grain of the groomed piste,
the glitter, and the tracks every skier leaves. The one rule under all of it:
**nothing here moves the ground the physics skis.** A vertex is the
generator's own height, lowered only by the trail map, and everything else
this skill does happens to the LIGHT.

**Read this skill's lessons first** — `npx ogf-skill-lessons
snow-look --list`. Load **`skill-reflection`** at both ends of the session
and **`write-code`** beside this one.

| Load beside this one | For |
| --- | --- |
| `ski-physics` | the sink the track is floored at — a groove that is too shallow in powder may be a physics question |
| `atmosphere` | the sun, the sky's blue and the haze every light here reads |
| `visual-effects` | the spray in the air over the tracks |
| `nature` | the terrain mesh (the clipmap) and the trees the forest tint stands for |
| `add-region` | what a region paints over the snow — the crust, the sastrugi, the rock, the rime |
| `game-feel` | whether the snow reads as speed at skiing pace |

## The files, one direction of flow

| File | Owns |
| --- | --- |
| `pwa/src/game/terrain.ts` | The clipmap mesh (`nature`'s geometry) and the GRAFT: `snow-glsl.ts`'s chunks spliced into a `MeshStandardMaterial`, the textures per level (the heights, the GROUND map — gradient, packed, wooded — the piste's direction, and the region's SURFACE map of crust and ice), `TERRAIN_QUALITY` |
| `pwa/src/game/snow-glsl.ts` | HOW THE SNOW IS LIT, per pixel: the slope off the ground's gradient texture (never the mesh's normals — the clipmap's rings would show on every face), fine noise over it, WRAP LIGHTING for the soft blue terminator (`SSS`), the GLITTER (world hashed into cells, a random facet each, a flare where it lines the sun up with the eye, faded before a cell is smaller than a pixel), the GROOMED PISTE (greyer, shinier, no glitter, the CORDUROY along the piste's direction, `LOOSE` powder standing over it), the region's crust, sastrugi and rock (`region-look.ts`'s numbers), the forest tint, and `GLARE` — snow painted brighter than white so the tone mapper brings the lit side down to an unclipped white |
| `pwa/src/game/trail-stamp.ts` | WHAT A SKI LEAVES, as arithmetic, three-free: every contact (`SkierState.contacts` — the tip, mid and tail station of each ski) lays a CAPSULE from where it touched at the last stamp to where it touches now, so a track is continuous at any speed and frame rate; `drawnDepth` (the physics' sink or the powder's own furrow, whichever is deeper, scaled by how much of the snow was powder, and cut narrower and deeper the more edge the ski stands on); the windrow beside it (`furrowProfile`); `TRAIL` — every number; a station that jumped further than `TRAIL.jump` is a reset, not a track; a thrown skier's slide as a wider gouge of its own (`bodyStampOf`) |
| `pwa/src/game/snowpack.ts` | WHAT KIND OF SNOW IS HERE (three-free, `visual-effects`' too): groomed, hard, soft, new, wet, ice, blended off the packed field, the crust, the ice, the new snow and a thaw. Given the snow, `drawnDepth` takes the groove's depth off its `give`, and every `Stamp` carries its `wall` (0 sloughed … 1 square — `wallPower` is the cross-section's exponent, `trail-map.ts`'s stamp shader reads it) and its windrow share. Soft is the picture the game had before, so a stamp with no snow said draws as it always did |
| `pwa/src/game/trail-map.ts` | THE TRAIL MAP, on the GPU in world space: a COARSE map over the whole mountain (every stamp of every skier, for the life of the run — a rival's track across the face is still there when the player comes down it) and a FINE window round the player at a few centimetres a texel, moved when he skis off its centre (the old window copied, the new edge filled from the coarse map). Each stamp an instanced quad with MAX blending: a groove skied twice is as deep as the deeper, and a windrow never fills a trough. `TRAIL_GLSL`'s `trailAt` is the one decoder |
| `pwa/src/game/renderer.ts` | Stamps every skier's stations each frame (even with `present` off, so a fast-forward still cuts its tracks) and hands the terrain the trail uniforms |
| `pwa/src/identity.ts` | `PALETTE.snow`, `snowShadow`, `track` — the colours the shader is keyed on |

## The two tracks, and why

Each ski runs a ski-width wide, the two a stance apart; through a schuss they
are two thin parallel lines, and through a carve the outside ski's groove
deepens and narrows as the edge goes over while the inside one lightens. That
is a skier's signature — **two thin lines that open and deepen on the outside
ski through every turn** — and it falls out of the stations rather than being
drawn as a decal. A change that makes the tracks read as one smear, as a
wide band or as six little lines has broken the one picture a player
recognises.

## The judgement: LOOK, at the right moments

There is no bench for light. The lab is `make world` — one run skied by the
bot, drawn through the game's own renderer — because a track only exists
after somebody has skied through the snow:

```sh
make world SEED=38 ARGS=--views=furrow,lookback,powder,powder-high   # the tracks: close, behind, in powder, from above
make world SEED=38 ARGS=--views=track,tips                           # the groomed piste and its corduroy
make world SEED=38 ARGS=--views=vista,forest                         # the snow at range, the rock above the tree line, the forest tint
```

(`CHROMIUM_PATH=/opt/pw-browsers/chromium` in a web session; it builds its own
bundle, so no `make build`.) Three habits:

- **Judge under a LOW sun as well as a high one.** The glitter, the wrap and
  the trough walls are all sun-angle effects; a seed dealt an early hour
  (`make level SEED=<n>` prints it) is where a change breaks.
- **Zoom.** Crop the tracks at full resolution — two grooves read as two only
  up close, and at a quarter size you are judging the tone.
- **Paint the raw channel.** When a track looks wrong, write `trailAt`'s depth
  straight into the colour in a diagnostic build before touching a number —
  one shot says "the map is empty" (a stamping bug) or "the map is right and
  the light is wrong" (a shader bug), where five tuning rounds guess.

Then the built app: `make build`, `make screenshots` at every viewport.
`make profile` before and after anything that adds a pass, a texture read or a
stamp — the trail map's stamping and the clipmap's fill are the dearest parts
of the frame.

## The rules

- **What is drawn IS what is simulated — with one deliberate exaggeration,
  stated once.** The ground is the generator's heightfield, sampled on the
  GPU. The groove is `drawnDepth`: never SHALLOWER than the physics' sink (a
  ski must never ride above its own track), deeper where the powder would
  honestly leave a hand-deep furrow at a speed the physics floats over.
- **The shading never sees the mesh.** The slope comes from the gradient
  texture, the grooves from the trail map's own finite differences. A snow
  lit by the clipmap's vertex normals shows its rings on every face.
- **Pressed snow is barely darker than fresh.** What makes a groove read is
  its SHAPE — walls turned from the sun, a floor that sees less sky. A groove
  painted dark reads as a dirt road.
- **The glitter is world-space and still.** Glints sit on the snow and
  twinkle as the LENS moves; a glitter hashed in screen space crawls with
  the camera. Fade it with distance before a cell is smaller than a pixel, or
  it aliases into grey noise.
- **The groomed piste is packed snow, not a road.** Greyer and shinier by a
  touch, the corduroy along the piste's direction, no glitter (the crystals
  are crushed). `packedAt` is the one field that says where it is — the same
  one the physics reads for grip.
- **Snow is brighter than its paint.** `GLARE` pushes the tone past white so
  a low sun does not arrive grey; a change that clips the lit side to flat
  white has lost the sheen.
- **MAX blending, two maps, one decoder.** A new stamp source (a rival, a
  landing crater, an animal's print) goes through `stampsOf` and the same
  instanced quad; a second encoding of depth drifts from `trailAt`.
- **A stamp is continuous and a reset is not a track.** Capsules from the
  last touch to this one, broken on a jump past `TRAIL.jump` — a reset that
  drew a groove across the map is `world_render_test`'s case.
- **Every hand-written shader ends with `#include <colorspace_fragment>`**
  and reads the haze through `hazeMaterial`.

## What the change obliges elsewhere

- `make world` pictures (furrow, track, vista) before and after, under an
  early and a late sun, and `make profile`, in the PR.
- `npx vitest run tests/world_render_test.ts` (the track's arithmetic).
- The renderer bullet in `docs/architecture.md`; a `.changes/unreleased/`
  fragment — the snow is what the player looks at.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth a fragment: a
track that was a stamping bug and looked like a shader bug (or the other way
round), a term that only read right zoomed, a sun angle a change was never
judged at.

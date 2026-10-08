---
name: buildings
description: "Use when building, rebuilding or improving any BUILDING on the mountain: a lift station (its house, the terminal hood, the booth, a gondola's hall and platform roof, a drag's hut), the slalom start house, the start hut, the finish arena's stands, platform and video wall, the wind tunnels, and any new building (a ticket office, a restaurant, a ski school hut, a patrol hut); and when porting the log cabins or the afterski lodge onto the same method. Owns the method: real-world references studied first, the building stated in the materials it is really made of, LOW-POLY geometry from the facade kit (`facade-kit.ts`) carrying the textures PAINTED IN CODE (`facade-paint.ts`: colour, roughness and relief in a texture array), one mesh a kind of building for the whole map, and the screenshot lab loop that iterates it in the game's own renderer until it reads (`make buildings`, `make world ARGS=--views=stations`). Also: adding a material to the stack, the winding rule, the night check, the budget and the tests (`tests/facade_test.ts`)."
---

# Buildings: references, a kit, painted materials, a lab

The mountain's buildings are made one way, so a new one costs an afternoon and
looks like it belongs: **study the real thing, build it out of a few dozen
boxes and roofs, let painted materials carry the detail, and look at it in
the game until it reads.** Everything here was learned rebuilding the lift
stations from bare boxes (`docs/buildings.md` is the record of what they are
and why).

## The pieces you build with

| Module | Use it for |
| --- | --- |
| `pwa/src/game/facade-paint.ts` | THE MATERIALS (`FACADE.*`): plain, boards, cladding, roof, panel, concrete, glazing, window, shutter, door, snow, steel, louvre, and the log buildings' layers (stone and render among them, which the village builds with too). Each is a 256 px tile whose size in metres is `FACADE_TILE`; `once` tiles are laid once over a quad (a window, a door) and `glazing` is laid once up its band and repeated along it. |
| `pwa/src/game/facade-kit.ts` | THE KIT, in a building's own frame (x across, y up, z along), set down with `at(x, y, z, yaw)`: `box`, `prism`, `frustum`, `column`, `wall`, `quad`, `cap`, `gableRoof`, `monoRoof`, `flatRoof` (each with its fascia, soffit, verges and a SNOW BLANKET run over the eave), `inset` (a pane or a door stood proud of a wall, lit at night when asked). |
| `pwa/src/game/facade-mesh.ts` | `facadeGeometry(kit.out)` and `facadeMaterial(haze, name)`: one mesh, one draw, for every building of a kind. |
| `pwa/src/game/station-build.ts` | The worked example: every station end and its pieces, from the engine's own footprints (`stationHouses`) and the layout (`station-plan.ts`). |
| `pwa/src/game/race-build.ts`, `arena-build.ts` | The start house and hut, the grandstands, the leader's platform and the video tower; `strut()` (a tube between two points, for scaffold) and `snowWall()` (a wall whose foot follows the snow). |

The VERTEX COLOUR TINTS the material: the ribbed sheet is painted light grey,
so `0xc0392e` makes a red booth and `0x9aa4ad` a grey hall from the same
tile. Leave a material white (`0xffffff`) to show it as painted.

## The loop

1. **Find out what it really is.** Search for descriptions and photographs
   of the real building (the operators' and architects' own pages, lift
   enthusiasts' galleries, open image libraries). Note the facts the shape
   hangs on: its parts, its proportions in metres, what each surface is made
   of and how that weathers, where the snow sits. Look at the photographs
   with the Read tool; keep any you download in the scratchpad, NEVER in the
   tree, and never name the resort, the maker or the model anywhere
   (`CLAUDE.md`: name no real product or place). The facts go into
   `docs/buildings.md` in your own words.
2. **Take the footprint from what already stands.** A building the engine
   collides with has its box in the engine (`stationHouses`, `CABINS`); the
   drawing stands on that footprint, its walls from under the snow
   (`base`) up, its roof over it. Never move a solid to suit a drawing.
3. **Rough it out in the kit**: plinth (concrete, from under the snow to a
   little over the highest corner), walls in their material, openings as
   `inset`s, the roof with its overhang and snow. A few hundred triangles a
   building; the materials do the rest.
4. **Look at it in the game.** Add the building to a lab sheet (below),
   render it BEFORE and after, read every picture, and iterate at least
   three rounds: proportions first, then materials and tints, then the
   details that sell it (a band of colour, a mast, a door canopy, a vent).
5. **Check it after dark** (`--hour=21`): the panes marked lit glow; the
   rest goes dark.
6. **Hold it**: extend `tests/facade_test.ts` (attributes filled, on its
   footprint, within budget) and the docs; changeset fragment.

## The lab

`make buildings` draws the station sheet (`previews/world-free-stations.png`):
every kind of station's foot and top from three sides in the game's own
renderer (`pwa/src/tools/station-view.ts`), then the race sheet
(`race-buildings`, `pwa/src/tools/race-buildings-view.ts`: the start house on
a slalom, the hut, the arena) and the tunnel sheet (`tunnels`,
`pwa/src/tools/tunnel-view.ts`: the fan house, the gallery and the exit
portal from three sides, and from inside the lane). Every sheet's shots are gathered in
`pwa/src/tools/building-shots.ts`, so the harness (at its 1000-line cap)
needs no new line for a new sheet. A new building gets its own
sheet the same way: a module in `pwa/src/tools/` exporting its shots, wired
into `building-shots.ts`, and its view names added to
`VIEWS` in `scripts/world-preview.mjs` (a name missing there is silently
skipped). `station-<kind>-<end>` is one frame at 1280 × 720 for a close look.

## Adding a material

A new layer is a case in `paintPixel`, a row in `FACADE`, `FACADE_TILE` and
`RELIEF`, and `FACADE_LAYERS` raised. Paint it as the real thing is made:
the pattern from its measured spacing (a board's width, a rib's pitch), the
tone from how it weathers, a HEIGHT for every pixel (the relief the normals
are cut from: proud parts high, joints and gaps at 0). A repeating tile's
noise must be periodic (`noise`/`fbm` take cells across the tile) or the
suite's seam test fails. Dump the stack to a PNG and look at it before you
look at a building (a scratch script over `paintFacades` and the framework's
`encodeRgbaPng`).

## Traps

- **Winding.** Faces are lit by the normal their winding gives; a face wound
  the wrong way is invisible from outside. `wall`/`inset` from (x0, z0) to
  (x1, z1) faces (−dz, dx): a run along +x faces +z, along −x faces −z,
  along −z faces +x, along +z faces −x. A `prism` outline runs
  (x0, z0) → (x1, z0) → (x1, z1) → (x0, z1). The kit test checks a box and a
  roof face out; check a new shape in the lab from both sides.
- **Two labs at once collide.** Every `make world` builds into
  `previews/.world-preview`; two running together (two agents) break each
  other's bundle. Run them one after the other.
- **The stack is painted on the main thread** once a page (about half a
  second at 256 px); a material that costs more noise octaves costs load
  time for every player.
- **Image libraries rate-limit** scripted searches: send a user agent and
  pause between calls, and fall back to the search engine's results.

## The log cabins

The cabins, chalets, sheds and the afterski lodge (`cabin-shapes.ts`,
`lodge-shapes.ts`, `cabin-parts.ts`) were ported onto the stack by keeping
the LOGS as geometry and painting everything between: a whole course is one
faceted log (sixteen triangles, its hidden flats left out), and its bark
and end grain are layers of their own; windows, doors, shutters, stone,
firewood, balustrades, render and quoins are flat faces in their material,
with only the casings, reveals and sills left proud for depth. The bench
carries the facade's attributes as MARKS (`cabinBench`: `facadeLayer`,
`facadeUv`), so a part built the old way is matte and a part that names
its material (`face`, `laid`, `box`/`wallBox`'s `layer`) is painted — one
geometry, one draw, the facade material. The far cut paints the courses on
flat walls (`logWall`), which let the hand-over come nearer the lens.

What it taught, worth keeping for the next building:

- **Measure where the triangles go before choosing what to paint.** The
  logs looked like the cost; they were a third of it. A window as boxes
  was 84 triangles, a woodpile 191, a stone plinth face 70 — the small
  repeated parts are where a building spends.
- **A lit pane on a painted casement lights the whole quad** unless the
  material masks it: `facade-material.ts` lights a casement's glass only
  (its smoothest texels). Give a new glowing layer the same care.
- **A woodpile or a balustrade reads by its contrast**, not its geometry:
  paint the pieces packed and the shadow between them mid-dark, or the
  face goes black at range.

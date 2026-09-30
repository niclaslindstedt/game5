---
name: nature
description: "Use when working on the NATURE the run goes through — the snow-loaded conifers and bare broadleaves (where the generator stands them under R14, their height and crown, the glades and clearings between the woods, the TREE LINE as an altitude and the krummholz band of stunted trees under it) and the CLUMPS and LANES the woods grow in (so there is always a way through and a skier sees in), the twenty KINDS (spruce, fir, pine, larch, black spruce, stone pine, white pine, lodgepole, hemlock, juniper, dwarf pine, snag; birch, aspen, rowan, alder, willow, beech, maple, ash) and each kind's ten VARIANTS (`tree-variants.ts` — modelled in Blender off those rows and drawn from `tree-models.ts`, or built in code by `tree-shapes.ts` behind `VITE_MODEL_TREES=0`), and how `pwa/src/game/forest.ts` draws them (the white-over-green banding, two bands of distance and a shadow-only caster set, the woods carried to the horizon by the terrain's forest tint); the mountain as a LANDSCAPE (the summit ridge and the side ridges as the horizon, the bare high snow and rock above the tree line, the spurs, gullies and bowls as they read from the piste); the ground as a mesh (`terrain.ts`'s clipmap reaching past the ridges); and the WILDLIFE — every region's own roster of birds and animals (species, never places), with their rarity ladder, their rounds, their fright and the prints they leave in the trail map, all presentation, all dealt off the map's seed on generators of their own. There are no biomes and no rocks as objects in this game. Owns the look-first loop for all of it: `make forest` (the woods measured — sightlines, gaps, clumps — and drawn from above), `make trees`' variant sheet, `make world`'s forest, vista, herd, birds and prints views, `make birds`' roster sheet, `make level`'s plan, `make profile`."
---

# The nature: the woods, the mountain, the snow on both

The world IS half the game's look — the piste is a packed line down it. This
skill owns what the mountain is COVERED in and how it reads: where the trees
stand and where they stop, how they are drawn, the landscape the piste runs
down as a thing seen from the skis, and the ground mesh that carries it to
the horizon. The snow's own light — the glitter, the blue shadows, the
groomed grain, the grooves — is `snow-look`'s; the rules that shape the
mountain and the piste are `mapgen-improvement`'s.

**FOUR KINDS OF COUNTRY (R21).** The alpine — a steep face under a summit
ridge, spruce, fir, larch and stone pine to a tree line at half the vertical,
rock on the steep faces, wind crust on the crests — is the country every rule
and every paint was written against; the fell (low rounded country in the far
north, birch at a low tree line, sastrugi on the crust), the continental (a
taller, colder, drier face; lodgepole, white pine, spruce, fir and aspen to a
high tree line) and the maritime (deep heavy snow; fir and birch, rime on the
tree line) are rows over it (`engine/mapgen/regions.ts`: the woods' density,
height, tree line and roster; `pwa/src/game/region-look.ts`: the needles, the
bough load, the birch's bark and twigs, the rime, the far woods' tint). A
new one is `add-region`'s checklist. There is no water but a fell's frozen
tarn, and no rocks as objects; the wildlife's rosters name the regions each
row lives in (`regions` on a row, filtered by `level.region`).

**THE TREE LINE IS AN ALTITUDE.** Nothing grows above `forest.treeLine` of
the way up the vertical (a share the region sets); the `forest.krummholz`
band under it grows stunted, wind-shaped trees; the tall woods are low down,
in the valleys and the gullies. It is the one thing that makes the summit
read as high and the finish read as low, and it is a rule (R14), not a paint.

**THE WILDLIFE NEVER MOVES A MAP.** Every flock and group is placed off
`level.seed` XOR a salt of its own (`BIRD_SALT`, `BEAST_SALT`) on a fresh
`createRng`, reading only what the `Level` publishes (`wild-ground.ts`) and
writing nothing back; poses are pure functions of the engine's clock. A
placement that drew from the generator's stream or wrote into the `Level`
would move a pinned campaign map's digest (`tests/generator_version_test.ts`)
— and `tests/birds_test.ts` holds that it does not.

**Read this skill's lessons first** —
`npx ogf-skill-lessons nature --list`. Load **`skill-reflection`**
at both ends of the session, and **`write-code`** beside this one for any
code change.

## The rosters, by region — species, never places

Every row of `bird-defs.ts` and `beast-defs.ts` names the regions it lives in
and a map lays only its own region's rows. A species is named for what it IS;
no roster names the range it was read off.

| Region | Birds | Animals |
| --- | --- | --- |
| alpine | alpine chough (flocks at the ridge — the one bird every skier sees), raven, golden eagle, nutcracker (in the stone pines), ptarmigan and snow finch (flushed off the snow), bearded vulture (rare) | chamois (the steep wooded faces), ibex (the sunny rock), mountain hare, red fox, roe deer and red deer (the valley woods), a lynx (rare) |
| fell | ptarmigan (willow in the birch, rock on the bare top), raven, snow bunting, golden eagle | reindeer herds, mountain hare, arctic fox, a wolverine (rare) |
| continental | raven, golden eagle, nutcracker, grouse | elk, mule deer, a moose (on the piste's edge), mountain goat and bighorn (the crags), snowshoe hare, coyote, a wolf pack (rare) |
| maritime | sea eagle, raven, jay | serow (solitary, the wooded slopes), sika deer, hare, fox, a macaque troop (rare; drawn as a beast) |

Marmots hibernate through the season and are never drawn. No tree bird
lives above the tree line; nothing lives on a tarn's ice. A new species is a
row in the defs plus a shape variant of an existing builder (`bird-shapes.ts`,
`beast-shapes.ts`), and — where a build carries the models — a Blender model
(`blender-assets`).

## The files, one direction of flow

| File | Owns |
| --- | --- |
| `engine/mapgen/forest.ts` | WHERE EVERY TREE STANDS (R14): first the CLUMPS (a chance a `forest.clumps.spacing` cell, off hashes of the forest's seed — a few trunks close round a centre, one kind to a clump), then one candidate per `forest.spacing` cell, jittered, at `forest.open` of the woods' density; refused on a LANE (`forest.lanes`, winding lines cut down every wood) and within `forest.gap` of any tree but its own clump's; kept with the probability the forest noise gives its spot (woods inside the forest, `forest.glade` of that density out in the glades); `forest.clearings` cut out of the woods; refused by rule — near the piste (`forest.corridor`), too steep (`maxSlope`), above the TREE LINE (`treeLine` of the vertical, stunted through the `krummholz` band under it), on a kicker or a cliff band, in the start's clearing. Taller in the thick of a wood and down in the valley, shorter at a wood's edge and up the face. Drawn off the attempt's stream in a fixed order |
| `engine/mapgen/rules.ts` (`forest`) | The numbers: spacing, the noise's scale, the glade share, the clearings, height (6–19 m), trunk, crown, corridor, slope, the tree line and the krummholz band |
| `engine/mapgen/types.ts` (`TreeDef`) | `x, z, y, height, radius` (the TRUNK — what the skier meets), `crown`, `kind` (drawn only), `clump` |
| `engine/mapgen/versions.ts` | The generator as this game launched with it; a trait a later version keeps for the pinned maps |
| `pwa/src/game/tree-variants.ts` | THE TEN VARIANTS OF EVERY KIND as data (three-free): the crown's base and top, its width and taper, how solid it is to the eye, the lean, and the form's own numbers; `variantAt` (a hash of the trunk's place) and `crownAt`, the SILHOUETTE the lens-clear and the forest lab both read |
| `scripts/blender/tree.py`, `pwa/src/game/tree-models.ts` | Every variant MODELLED (what the forest draws): the same rows made in Blender (`make blender KIND=tree ID=<kind>` — boughs lofted and drooping over a dark core with the snow along their tops, lobed needle pads on branches off a flared stem, a larch's arms with hanging twigs, a broadleaf's limbs forking into fans of twigs), one glTF a kind in `pwa/models/trees/`, dressed per map in the region's paint with only the snow its load reaches (and the rime a maritime tree line wears). Judge it on `make trees ARGS="--models --from=previews/blender --compare"` (the code's row over the model's), then `make build` + `screenshots`; the `blender-assets` skill owns the making |
| `pwa/src/game/tree-shapes.ts` | Every variant BUILT in code (a kind with no model, and every kind under `VITE_MODEL_TREES=0`): the conifer's drooping skirts (a nodding leader, a club top, a ragged column), the pine's pads on one stem or several (or in flat layers), the larch's and the snag's skeletons, a broadleaf's stems and fans of twigs with its berries, kept leaves or keys; a sketch of each for the far band; each kind's paint off the region's (`KIND_TONES`) |
| `engine/game/collision.ts` | The trunk as a cylinder the skier meets — the `collision` skill's |
| `engine/mapgen/terrain.ts` | The mountain's shape (R2, R3) — the `mapgen-improvement` skill's, but every judgement about how it READS is this one's |
| `pwa/src/game/forest.ts` | THE WOODS AS DRAWN: one instanced mesh per variant a map grows (sized to its own trees; `FOREST_LOOK[row].shapes` is the budget of them, shared among the kinds by their counts, the far band and the casters one shape a kind), each tree scaled to its own height and crown, turned and tinted by a hash of where it stands; instanced in TWO bands of distance (FULL, then FAR — one sketch a kind), binned into 64 m cells and frustum-tested per frame; and a THIRD SET that is drawn only into the shadow map — every tree whose shadow can reach the sun's circle (`shadow-box.ts`'s `castsInto`), whatever band draws it and whichever side of the lens it stands, under SHADOWS MEDIUM and HIGH only (SKIERS casts no tree), each its own crown on FOREST HIGH and the sketch drawn a touch inside it below that (`FOREST_LOOK[row].casters`). No band casts: a band decided by distance to the lens is a shadow that switches on as the skier comes nearer. `FOREST_LOOK`, `SHADOW_LOOK` |
| `pwa/src/game/terrain.ts` | THE GROUND AS A MESH: a camera-centred CLIPMAP of nested grids (a quarter metre a vertex at the lens, doubling per level, eight levels past the ridges), nothing baked into the mesh — the vertex shader reads the heights from a float texture of the generator's own heightfield. Three textures per level: the heights, the GROUND map (gradient, packed, how wooded), the piste's direction. `TERRAIN_QUALITY` |
| `pwa/src/game/snow-glsl.ts` | The terrain's shader — `snow-look`'s — but its FOREST TINT (the woods past the far band, read off the ground map) and its ROCK (the steep faces above the tree line, `region-look.ts`'s) are where this skill's trees end and the ground's paint begins; the two must agree on where a wood is and where the woods stop |
| `pwa/src/identity.ts` | `PALETTE.pine`, `pineDark`, `snow`, `snowShadow` — the colours every piece of nature is drawn from |
| `pwa/src/game/rarity.ts`, `wild-ground.ts` | The RARITY LADDER (`perKm` → a word, and the drawn fraction that makes a count of it) and the questions both wildlife placers ask a map: the nearest trunk, the piste, the drawn snow's height, the slope, the tree line |
| `pwa/src/game/bird-defs.ts`, `bird-roost.ts`, `bird-plan.ts` | THE BIRDS: the roster (a plain array, every row naming its regions), where every flock lives (a spruce crown, a burrow in a glade, a crag on the ridge) and its circuit held over the canopy or the face, and `birdPose` — the cycle, the circuit, the wings, the FLUSH (`flushAt`, any skier) and the skeins crossing in March (`crossingAt`, by the map's day) |
| `pwa/src/game/beast-defs.ts`, `beast-plan.ts`, `beast-tracks.ts` | THE ANIMALS IN THE SNOW: the roster, where every group lives (a wood's edge, a glade, a crag — never on or beside the piste), `beastPose` — a round walked in a closed-form cycle of standing and moving — and the FRIGHT (`spookAt`); the PRINTS as trail-map stamps in the species' own pattern |
| `pwa/src/game/bird-shapes.ts`, `beast-shapes.ts`, `birds.ts`, `beasts.ts`, `wildlife.ts` | The wildlife as drawn: one instanced mesh a species (a draw call each, only while one is in reach), the wings and the legs and the head moved in the vertex shader, the haze through `hazeMaterial`; the renderer's two memories (the flushes, the frights) and the prints laid again whenever the fine trail window moves |

## How the mountain should read

- **The ridges are the horizon.** Every shot from the piste has the summit
  ridge or a side ridge in it: bare high snow and rock above the tree line,
  the spurs and gullies climbing out of the forest. A frame with no ridge in
  it reads as a field anywhere; a frame looking DOWN the fall line has the
  valley floor and the finish far below, which is the sense of height the
  whole game runs on.
- **Woods and glades, not an even stubble.** The forest noise is slow on
  purpose: a wood you schuss through, a glade you cross, a clearing cut into
  the wood. A density that is the same everywhere reads as a lawn of trees
  at range and as a wall up close.
- **Trees thin with height and stop.** Shorter at a wood's edge and up the
  face, stunted through the krummholz, gone above the tree line — the same
  ladder any real mountain has, and the one thing that makes the top read as
  high.
- **A loaded conifer is its banding.** White over dark green, tier over
  tier. A tree that is all green reads as summer; all white reads as a cone.
  The kinds, their ten variants each and the per-tree tint are what stop a
  wood reading as one tree copied — judge a new variant on `make trees`
  beside its nine siblings.
- **A wood is seen INTO, and skied THROUGH.** Clumps bunch the trunks so the
  ground between is open; lanes give the eye a line down the fall line;
  pines and self-pruned stand trees are bare under the lens's height. `make
  forest` measures it: SIGHT IN is how far the eye goes inside a wood, CLEAR
  the narrowest way between two groups, SEALED any pocket a skier cannot
  reach (always 0).
- **The piste is cut through the woods, never planted over.** `forest.corridor`
  keeps trunks clear of the piste's edge; a trunk inside it is a generator
  bug (`analysis` reports `treesOnCorridor`).

## The rules

- **The engine stands every tree; the renderer draws exactly those.** The
  trunk drawn is `TreeDef.x/z/radius` — a tree drawn somewhere else is a
  tree the skier passes through or hits in thin air. Decorative scatter the
  skier cannot hit (a bush, a sapling) would be the renderer's own, placed
  deterministically off the level, and must never stand on the piste.
- **Placement is deterministic and in a fixed order.** A tree added to the
  middle of the draw order moves every tree after it on every seed.
- **Instanced, banded, culled.** Tens of thousands of trees, so every change
  is judged in `make profile`: a new shape is a new instanced mesh per band;
  a per-tree allocation per frame is a stutter.
- **Past the far band the terrain carries the woods.** The ground map's
  wooded channel is what tints the snow dark where the far forest is; a
  change to where trees stand that does not move that channel leaves a
  painted wood with no trees in it, or trees on white snow at range — and a
  tree line moved in the rules without moving the tint leaves a painted wood
  above the last tree.
- **The ground mesh is the generator's heightfield, sampled.** Nothing in
  `terrain.ts` invents a height; a spur that is not in `Level.ground` is not
  in the picture either.

## The loop

1. **Plan**: `make level SEED=<n>` — where the woods, glades and clearings
   fall, where the tree line runs, and where the trees stand against the
   piste; `make forest SEED=<n> ARGS=--compare` for what being in them is
   like, and `COUNT=12` for the sweep's means before and after.
2. **Look**: `make world SEED=<n> ARGS=--views=forest,vista,track,spawn`
   (its own bundle; `CHROMIUM_PATH=/opt/pw-browsers/chromium` in a web
   session). `forest` is in the woods, `vista` the mountain from above,
   `track` the piste down it, `spawn` the start line under the ridge. Judge
   with the Read tool at full size AND at a quarter — the woods have to read
   at range.
3. **Cost**: `make profile` before and after — draw calls and triangles per
   band.
4. **More than one seed, more than one region.** A mountain that reads well
   on one seed has read badly on the next; look at three, and at the fell
   and the maritime beside the alpine.
5. **The built app**: `make build`, `make screenshots` for the game's own
   framing at the reference viewports.
6. If a rule moved: `mapgen-improvement`'s loop (`make analyze`, the
   verbatim mirror in `docs/level-generator.md`, `make sim`).
7. **The wildlife**: `make birds` for the roster side by side (the
   silhouettes, the paint, three poses each over a metre rule), then
   `make world ARGS=--views=herd,birds,prints` for them on the mountain, and
   `tests/birds_test.ts` for the claims (no digest moved, nothing on the
   piste, every row's regions, the flush and the fright as rules). A cry is
   `sound-effects`' (`audio/bird-voice.ts`, `bird-bank.ts`) and owes `make
   audition`.

## What the change obliges elsewhere

- `make world` pictures and `make profile` before and after, in the PR.
- A placement change is a generator change: `make analyze` tally,
  `make sim` both tables, `tests/mapgen_test.ts`.
- A `.changes/unreleased/` fragment when a player would see it.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth recording: a
density or a shape that read wrong at range and right up close, a band
distance that popped, a tint that did not match the trees it stood for, a
tree line that read as a paint rather than an altitude.

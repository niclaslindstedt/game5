---
name: blender-assets
description: "Use when a game asset is to be MODELLED IN BLENDER off the game's own data — the skis (a pair with its bindings, boots and poles), the skier, every bird and animal of the wildlife and the course's marks (the gate and its panel, the edge pole, the start hut and the finish arch) today; any other drawn thing when its kind is added — for studio renders, a real-time glTF with LODs, or to find out how good an authored version of something the game builds in code could look. Owns `make blender` (`scripts/blender.mjs` and the KINDS under `scripts/blender/kinds/`, each the JSON the game's data for one is handed as), the Blender shelf (`scripts/blender/lib.py`: the helpers, the studio, the rig, the game-budget export; `static.py`: the role-painted static mesh the wildlife and the marks are built as) and each kind's builder (`scripts/blender/skis.py`, `skier.py`, `bird.py`, `beast.py`, `gate.py`), the RIG every model carries and the clips baked into it (the game-side contracts `ski-rig.ts` and `skier-rig.ts`), the lab sheet that sets a model beside the game's own (`make skis ARGS=--asset=…`), THE MODELS IN THE GAME (the `VITE_MODEL_SKIS` / `VITE_MODEL_SKIERS` / `VITE_MODEL_BIRDS` / `VITE_MODEL_BEASTS` / `VITE_MODEL_GATES` build switches, `make models`, `pwa/models-plugin.ts`, `skier-models.ts`, `bird-models.ts`, `beast-models.ts`, `gate-models.ts` over `model-parts.ts`, the meshopt packer `scripts/lib/glb-pack.mjs`: packed, loaded, dressed, posed in place of the code's drawn parts), the frame a model is stated in and turned back from, the triangle budget and its LODs, installing and running Blender headless on macOS and Linux, reference photographs (local only, never committed, never named), and adding a new kind. Not the game's own builders (`ski-design`, `nature`, `skier`) — though they are what every model is held against — and not the TREES, which are not modelled: every one is built procedurally in code (`tree-shapes.ts`, `nature`)."
---

# Blender assets

The game draws its **skis, skier, birds, animals and the course's marks
from the models made here** — committed in `pwa/models/` by `make
models` — and builds everything else (and, one switch away, every one of
those too) in code (§ "The models in the game"). This skill is the other
road, kept open on purpose — the same things MODELLED in Blender, off the
same numbers, so that the question "how good could it look, and what would
it cost?" is answered with a render, a triangle count and a picture in the
game's own lab rather than a guess, and so that a desktop build could one
day ship authored assets without the models drifting from the physics.

Three rules make that possible, and every step below serves one of them:

1. **A model is built off the game's data, never off numbers of its own.**
   The driver hands Blender the very tables the game's builder reads (a
   pair: `SKI_CATALOG` and `SKI_LOOKS`; an animal: its row and style) as
   one JSON file. A modelled
   pair therefore has the physics' length, waist, sidecut and mount to the
   millimetre, and when a trace moves, the model moves with it on the next
   run. A hand-typed dimension in a builder is the drift this rules out.
2. **The lab's outputs are not committed; the game's models are.** Every
   render, `.blend` and LOD lands in the gitignored `previews/blender/`;
   only `make models` publishes — the LOD0 of every pair and the skier and
   every static model (packed), with their sources' stamps, into
   `pwa/models/` — and those are committed.
3. **A model is judged beside the game's own**, in the game's renderer, with
   the game's skier on it — not only in a Blender studio, which flatters
   everything.

**Before starting, read this skill's lessons** —
`npx ogf-skill-lessons blender-assets --list`. Load
`skill-reflection` at both ends, `lab-tooling` for any change to the driver
or the lab, and the skill that owns the asset's SUBJECT (`ski-design` for a
pair, `skier` for the figure) — its judging rules apply to a model too.

## Where everything lives

| Piece | Role |
| --- | --- |
| `scripts/blender.mjs` | THE DRIVER (`make blender`): loads every KIND under `scripts/blender/kinds/<kind>.mjs` (its ids, the JSON of the game's data for one, its builder, its default), finds Blender, runs each QUALITY, echoes what matters (`BONES`, `CLIPS`, `TRIANGLES`, what was saved, any traceback) and fails on a Python error. A kind's data module is in its own sources alone, so a kind added moves no other stamp |
| `scripts/blender/lib.py` | THE SHELF every builder imports: the scene, `mat`, the geometry (`loft`, `superellipse`, `tube`, `cyl`, `box`, `ellipsoid`, `coil`, `catmull`, `resample`, boolean cutters), THE RIG (`rides`, `bone`, `marker`, `clip`, `morph`), and `finish()` — the rig built and skinned, the clips baked, the studio, the Cycles stills, the join into one skinned mesh, LOD0 and the decimated LODs as glTF |
| `scripts/blender/skier.py` | THE SKIER BUILDER (`KIND=skier`, `ID=skier0…3` a start-line slot's kit): one SUIT that bends (a man of the ANSUR II survey's mean measure in a racer's kit, lofted a piece a bone, remeshed into one skin, creased where a joint bends, cut along the hem, yoke, cuff and lap planes before it is coloured, weighted across each joint between the two bones that meet there) and rigid parts on one bone each — the helmet laid on the game's MEASURED shell (`helmetReach` / `helmetPart` sampled on a grid) with the goggles on it, the boots, the gloves |
| `scripts/blender/static.py` | THE STATIC SHELF (the wildlife, the marks): `Sheet` (every face a ROLE, every vertex a tone), `loft`, `tube`, `fin`, `blob`, `role_mat`, `publish` (the root's extras, the export, the stills: `three`, `under`, `side`, `front`, `back`, `detail`) |
| `scripts/blender/bird.py`, `beast.py`, `gate.py` | THE WILDLIFE AND THE MARKS: a bird off its roster row, an animal off its row and style, the gate pole and its panel, the edge pole, the start hut and the finish arch off `GATE` / `ARCH` (§ "The birds, the animals and the marks") |
| `pwa/src/game/model-parts.ts`, `bird-models.ts`, `beast-models.ts`, `gate-models.ts` | THE STATIC MODELS IN THE GAME: one reader (`readStaticModel`: the parts by mesh name, a role a primitive, the root's extras), `Assembly` (dressed parts into one tagged geometry), and each kind's loader dressing off the game's own styles |
| `scripts/lib/glb-pack.mjs` | THE PACKER every published static model goes through (quantized, meshopt) |
| `pwa/src/game/skier-rig.ts` | THE SKIER'S CONTRACT: `skierBones(pose)` (every bone's frame off a `SkierPose` — the game's own spans, rolled to face each joint's bend, the head turned as `skier-figure.ts` turns it; a pelvis and a chest, HALF BONES at the hips, knees, shoulders and elbows, the hands along their poles, the feet in their boots), `STANDING` (the pose he is bound in), `skierClips()` (every clip SAMPLED off the game's `skierPose` and `stepSkierSpring`), `rigSkier` (a loaded model's bones set to a pose, or a clip played) |
| `scripts/blender/skis.py` | THE SKIS BUILDER: the two skis (the tip's rise and the rocker, the sidecut's waist, the tail; the topsheet, the base, the edges), the bindings at the mount, the boots in them, the poles with their baskets and grips — every dimension off the spec and the trace |
| `pwa/src/tools/skis-harness.ts` + `scripts/skis-preview.mjs` | THE ASSET SHEETS (`make skis ARGS=--asset=a.glb,b.glb`): `asset` — the builder's pair in the first row, each model below it, every one stood on by the game's skier through `skierStance`; `rig` — builder and models posed at the same engine moments (an edge each way, each leg's compression, the skid); `clips` — the first model's clips played across their length (and a `--skier=` model's, him alone); `figure` — a modelled skier beside the game's own on the builder's pair in every pose. A `--skier=` model also stands on the models on the asset and rig sheets |
| `pwa/src/game/ski-rig.ts` | THE GAME'S SIDE OF THE RIG: a modelled pair posed off `SkierState` exactly as `ski-gear.ts` / `skis-body.ts` pose the builder's (the skis turned by `skiAngle`, tipped by `edge`, each riding its leg's compression; the poles planted or tucked), and its clips played |
| `previews/blender/` | Everything made: `<id>.json` (what Blender was handed), `<id>-render-<view>.png`, `<id>-game-*.png`, `<id>-lod{0,1,2}.glb`, `<id>-{render,game}.blend` |

## The loop

1. **Look at what the game draws first**: `make skis ARGS="--sheet=pairs
   --views=side,top,three --cell=640"` (or the subject's own lab). That is
   the bar a model has to clear.
2. **Get references — locally.** A clean studio side and top view of a real
   ski of the class, and a three-quarter view of a skier in a racing kit (a
   free-licensed one from a public media archive is good). They go in the
   session's scratchpad ONLY: never under the tree, never in an artifact,
   never named — not the maker, not the model, not in a file name. Refer to
   them as "a giant slalom ski's top view". (`AGENTS.md`: NAME NO REAL
   PRODUCT.)
3. **Iterate fast in render quality**, one or two views, few samples:
   `make blender ID=chamois ARGS="--quality=render --views=three,side --samples=24"`
   — about half a minute a pass once the kernels are compiled (`ID=all`
   runs every pair in turn). READ the pictures beside the references.
   Silhouette first (from the top: the sidecut; from the side: the tip's
   rise and the camber), then the three-quarter, then detail.
4. **Then the budget**: `make blender ID=chamois ARGS=--quality=game` — the
   parts joined into one skinned mesh on the rig, the clips baked, LOD0 and
   two LODs exported, every count printed.
5. **Then the game's lab**: `make skis ARGS="--asset=previews/blender/chamois-lod0.glb,previews/blender/chamois-lod1.glb --views=side,three,chase --cell=480"`
   → `previews/skis-asset-chamois.png`. The chase view is the verdict, as it
   is for the builder's pair (`ski-design`): the skier's back, the two skis
   either side of him with their tips showing, the poles, at sixty pixels.
   Then the rig: `--sheet=rig,clips` (with `--views=three,front`) — the
   model beside the builder's pair at the same moments, and every clip
   played. A ski that tips the other way, a boot that leaves its binding, a
   clip that shows another clip's pose are all read off these two sheets.
6. **Report** before and after with the pictures and the triangle table.

## The frame

A builder states its asset in the frame the game's data is in, and nothing
else. A pair is modelled in the **trace's** frame: Blender x to the skier's
right, y forward from the tails (the trace's z), z up from the snow (the
trace's y). glTF export turns Blender's z-up to y-up with forward on
**-z**. The lab turns it back — a half turn about y, then the trace set on
the spec exactly as `lookFrame` sets it (`z(0)` as the offset, `stretch` on
z), the body frame's origin at the CoG height — and stands the game's skier
on it with `skierStance(spec)`, the same function the builder stands him
with. A new kind states its frame in its builder's header and its lab does
the turn; never bake a turn into a model.

## Modelling craft

What each kind's first renders got wrong and the move that fixed it is a
LESSON of this skill (`npx ogf-skill-lessons blender-assets --list`: the
ski's loft-and-crease craft, the wildlife's keyed sections and fingers) —
read the ones scoped to the builder you are in before the first pass.

## The budget

A pair is a small asset: two thin lofts, two bindings, two boots and two
poles. The game quality — fewer segments on every tube, the ski lofted at a
handful of sections, no boolean holes, the baskets a ring — is measured on
the reference pair at the first game-quality pass and written into the
lessons (the render model runs to tens of thousands of triangles; LOD0
should sit in the low thousands, with the boots the spread between the
classes). LOD0 is indistinguishable from the render model at any game
range. It is **one skinned mesh** on the rig, the first one draw per
material.

## The rig and the clips

A model the game could ski has to move where the game's pair moves, and by
the same numbers, so the rig is the game's posing written into the model
(`lib.py`'s header, `skis.py`'s):

- **Every part rides ONE bone, rigidly** (weight 1): `rides(name)` before
  making the parts. That is how the game draws its own figures
  (`posed-merge.ts`: every part a bone).
- **DRIVERS** are the bones the game sets off the engine: the pair's
  `ski_l` / `ski_r` (a bone along each ski at its mount, turned by
  `skiAngle` and tipped by `edge`), `leg_l` / `leg_r` (each ski's rise on
  its leg's compression), `pole_l` / `pole_r` (planted, swung, or tucked
  under the arms). `ski-rig.ts` poses them off the numbers `ski-gear.ts`
  poses the builder's by, exported from there, and handed to Blender in the
  JSON so the clips run the same travel. Never restate either.
- **The clips** are keyed on the drivers a frame at a time, BAKED visually
  (`nla.bake`), and each laid on an NLA track of its name, exported with
  `export_animation_mode=NLA_TRACKS`: one glTF animation a clip. The pair
  carries `edge`, `skid`, `leg_travel`, `landing` and `pole_plant`.
- **Traps met.** An NLA track left unmuted PLAYS under the next clip's
  bake, and every later clip carries the earlier ones' pose — mute each as
  it is laid, unmute at the end, and leave `use_nla` off so the stills are
  at rest. A three.js action set to its full length wraps to frame 0 —
  `LoopOnce` with `clampWhenFinished`. A joined mesh takes its DATA name
  from the active part; name both. The sides are the MODEL's (`_l` is x
  negative in the trace frame), and a glTF turned to face the game puts
  that at the game's +x — so the lab matches skis to the engine's by which
  side of the skier they stand on, never by name.

**The lower LODs are a blind decimation**, and it shows: up close LOD2 tears
(a ski's edge stepped, a broken topsheet stripe). Fine at the range a rival
is drawn at; a real LOD2 is a hand-built low model (a ski a flat quad
strip, the boot a box), which is open work.

## The skier

The game's skier has NO clips: `skierPose` places every joint off the
engine's readings and `skier-figure.ts` lays each part from joint to joint.
So a modelled skier's BONES are those spans (`skierBones`), bound in the
standing pose (`STANDING`), and the game's own pose drives him bone for
bone — a carve's angulation, a tuck, a landing's fold, a grab are the
game's arithmetic, not a second animation. His clips are that arithmetic
SAMPLED in Node (an edge each way, the tuck and the stand, a jump and its
fold on the legs' spring, the three grabs blended in and out, a pole plant)
and handed to Blender as every bone's frame at every frame (`clip()` with a
`matrix`). Nothing about how he moves is written in Python.

- **The frame.** He is stated as `(-x, z, y)` of the skier's body frame —
  a turn, not a mirror — so he faces +y like a modelled pair and the lab's
  one half turn sets him on the game's joints exactly. His sides are the
  ENGINE's (`_l` is the pose's index 0), unlike a pair model's.
- **A figure that bends is one mesh weighted across its joints**, where a
  pair's parts are rigid: `weights(ob, fn)` gives a part per-vertex weights;
  `skier.py` shares a vertex between the nearest bone and its joint
  neighbours by how much nearer each is (4 cm apart is half against a
  third). The helmet, boots and gloves stay rigid.
- **Colour on a skinned hull stops on a PLANE**: cut the mesh along it
  (`bmesh.ops.bisect_plane`) before colouring by face, or every colour edge
  is the stair of the faces it was laid in. Colouring by NEAREST BONE makes
  a jagged edge wherever two bones' regions meet — the yoke is "above a
  plane", not "nearest the head".
- **The body is MEASURED, the kit is ADDED.** The flesh round the game's
  bones is the ANSUR II survey's mean man (US Army 2012, 4,082 men: the
  public male file, read locally — every breadth, depth and circumference,
  and each trunk level's height between the hip joint and the neck's base
  laid onto the game's spine); `skier.py`'s `ANSUR` table is those means,
  cited, and nothing else. The kit is `EASE`, metres a side over the body,
  after what a downhill racer wears: a close speed suit over a back
  protector, padded shin guards, hard shell boots to mid-calf, gloves, a
  helmet with the goggles on it. Change a garment in `EASE`, never the
  body.
- **Loft a piece a bone, then REMESH into one skin** (voxel, 6 mm in the
  render, 16 mm and a decimation to budget in the game): a shoulder flows
  into its sleeve and a seat into its thighs, where lofts meeting at a
  joint crease and a skin modifier's hull is a box a section. The remesh
  fills VOLUMES — an open tube (a loft left uncapped) vanishes whole, so
  every piece is capped.
- **Folds are ridges across a bone on the surface's own normal**, on the
  side a joint closes (the crook of the elbow, the back of the knee), all
  round where cloth bunches (a sleeve above the glove, the suit over the
  boot's cuff): `FOLDS`, a few millimetres each, is what makes a suit read
  as cloth and not rubber.
- **Colour by a plane wherever a bone gives way to another**: the hem, the
  yoke, the cuffs — and the LAPS, square across each thigh, since a tucked
  skier's thighs lie above the hem's plane and "nearest bone" leaves a
  ragged edge in three.js where it looked fine in a still.
- **THE KIT IS A SKIER'S**, not a racer-over-a-machine's: a fitted
  quilted jacket to under the seat with a stood collar, the second colour
  on the yoke, a centre-front zip, the cuffs and a stripe down the outside
  of each sleeve (each a plane the suit is cut along — the stripes a plane
  along the arm bone a few centimetres out); softshell pants flared over
  the boot; GLOVES CLOSED ROUND THE GRIP (a palm, four fingers wrapped round
  the shaft along the bend's side, a thumb over the top — at game quality a
  finger is five points of tube); an OPEN helmet (the measured shell cut at
  the port AND everything under it across its width — a ski helmet's front
  rim is its brow) over a head in a dark balaclava, and GOGGLES on the face
  bent round a cylinder about the head's up, centred on the port, their
  outline a squared superellipse shaped row by row (a culled cell grid is a
  staircase). The helmet's openings are eased along themselves a few
  passes: a grid cut is stairs.
- **THE CLOTH IS A TEXTURE, AND ONE MODEL DRESSES EVERY KIT**: the fabric
  is a height in the suit's own frame (the jacket QUILTED in channels
  8.5 cm apart round the body, a ripstop's 8 mm grid on every garment, the
  pants mottled), rendered straight from the shader in the studio and, at
  game quality, BAKED onto a smart unwrap of the suit: a DETAIL map (the
  fabric's shade × ambient occlusion, EMIT bake) and a tangent NORMAL map
  (the height's bump on a diffuse, NORMAL bake), 1024², exported WebP
  (`export_image_format`). The suit's materials multiply the kit's colour
  over the detail, which three.js reads as `color × map` — so `dressOf`
  still recolours every slot. Every other part in a garment's material (the
  gaiters) is unwrapped onto a plain corner of both maps (white, flat).
- **No sheen on anything exported**: Blender's sheen goes into the glTF as
  a sheen extension three.js draws as a pale bloom.
- **Budget**: the figure's LOD0 sits under 10k triangles (the suit
  decimated to a few thousand quads' worth, the helmet's grid every fourth
  of the render's sample and single-sided — nothing sees under it — boots,
  guards and gloves the rest), the lower LODs a third and a tenth of it;
  render quality is the 6 mm remesh.

## The trees are not modelled

Every tree is built PROCEDURALLY in code (`tree-shapes.ts` over
`tree-mesh.ts`; the `nature` skill): chunky and faceted, ten variants a kind
at three levels of detail, its trunk widened in the vertex shader to the
tree's age. The Blender tree builder was retired with that change: one
builder in code now makes every cut of every variant, its trunk tagged for
the girth, at a fraction of the modelled trees' triangles. `scripts/blender.mjs`'s header still names the
trees: it is a stamped source of every static half, and editing it asks for
`make models` to be run again.

## Blender, headless, on macOS

- **Installing.** The Homebrew cask can crawl (tens of KB/s); ranged
  parallel `curl` from the release server is far faster — then CHECK THE
  SHA-256 against the release's checksum file (a range can come back short
  and silently). Copy the app out of the DMG with `ditto`, not `cp -R`.
- **The hang.** An app copied without its files' times carries stale
  bytecode; Python's first import tries to rewrite it inside the signed
  bundle, macOS's app protection holds the write, and Blender sits at 0 %
  CPU for ever with nothing in its log. The driver runs Blender with
  `PYTHONDONTWRITEBYTECODE=1` AND `--python-use-system-env` (without the
  flag Blender ignores the variable). `sample <pid>` showing `os_open`
  under Python's init is the tell.
- **A Python error exits 0** unless Blender is given `--python-exit-code 1`;
  the driver passes it.
- **Cycles on Metal** works headless; the first render compiles kernels for
  ~3 minutes, then a 1280×720 still at 32 samples is seconds.
- **API traps (5.x):** `use_nodes` is deprecated (set it in a `try`);
  Principled inputs are `Coat Weight`, `Transmission Weight`, `Emission
  Color`; the RGBA Mix node's colours are inputs 6 and 7 and its result
  output 2; a Math node's `MULTIPLY_ADD` third input defaults to 0.5, not 0;
  creases are the `crease_edge` float attribute; `bmesh.ops.create_cone`
  takes `radius1`/`radius2`; curve objects must be converted to meshes
  before a join or an export.

**On Linux**: the release tarball (SHA-256 checked), on the PATH or
`BLENDER=`; Cycles falls back to the CPU itself. Where only the `bpy`
module is installed (a Claude web session: `python3 -c "import bpy"`), the
driver runs the builders through it and there is no `blender` binary to
find. Models made there differ from macOS ones only in their floats' last
bits.

## The birds, the animals and the marks

`KIND=bird`, `KIND=beast`, `KIND=gate` (`ID=gate`, `edge-pole`, `start-hut`,
`finish-arch`): STATIC models — no rig, no colour in
the file, a face a ROLE the game paints (`birdRoleColour`, `beastRoleColour`,
`gateRoleColour` — a gate's panel red or blue by its index), the tone's R a
shade — one glTF each, published packed (`birds/<id>.glb`, `beasts/<id>.glb`,
`gates/<id>.glb`), ~2 s a model; `make models SET=birds` (`beasts`, `gates`)
one half.

- **The frame** (`static.py`'s header): Blender x the game's x, z its y,
  −y its z — the exporter's own turn of the game's frame, so the loader
  turns NOTHING and left stays left. A bill and a nose point down −y; a
  panel streams along +x. (A pair is the other way: its trace is y forward
  and its lab does a half turn.)
- **The shader's tags come off the MESH NAMES**: `body` + `wing` (`aWing`);
  `body`, `head` (all that grazes: `aHead`), `leg_lf` … `leg_rh` (`aLeg` =
  1 + `LEG_PHASE`, `aHip` the root's `hip`), `tail`; the head's pivot on
  the root. The code's own graft flaps, walks and grazes the model, lit
  smooth. A gate's `panel` carries the hinge the code swings when a skier
  brushes it.
- **The arch is made at ONE reach** (`ARCH.modelReach`) and `archModel`
  stretches it with `remap`: the span to the finish line's width, each leg
  down to its own foot, the foot's hardware moved whole. The banner, the
  arena's fences and the line dyed on the snow stay the code's.
- **Judge a bird FROM BELOW** (`--views=under`), an animal from the side, a
  gate from the skier's approach; then `make birds ARGS="--models
  --from=previews/blender --compare"` and `make world` (which loads the
  committed models). The modelling heuristics are the lessons.

## Adding a kind (…)

1. **The data.** A module `scripts/blender/kinds/<kind>.mjs` exporting
   `kind`: `ids()`, and `data(id)` returning the game's OWN tables for one
   (an animal: its row and style from `beast-defs.ts` / `beast-shapes.ts`)
   — imported through `aliasEngine`, never restated — its `builder`, its
   `fallback` id and a `help` line. The driver finds it by its file name.
2. **The builder**, `scripts/blender/<kind>.py`: `from lib import *`, its
   frame stated in its header, `rides()` / `bone()` for the rig, `clip()`
   for what it plays, `finish(name, OUT, SAMPLES, centre, size)` at the end
   — or, for a static kind, `from static import *`, a `Sheet` a part and
   `publish(name, made, OUT, extras=…)`. A helper two kinds need goes into
   `lib.py` or `static.py`. Its sources (the builder, its data module, the
   shelf, the game data it reads) are a list in `pwa/models-plugin.ts` and
   a half of `MODEL_HALVES`, stamped apart in `sources.json`.
3. **The lab.** The kind's own lab owes an asset view like the skis lab's
   (`--asset=`), with the turn back into the game's frame in the lab, not
   in the model, and a rig sheet posing it by the game's own numbers beside
   the builder's (the pair's `rig` sheet and `ski-rig.ts` are the pattern).
4. Register nothing new: `make blender KIND=<kind>` is already the target.
   Update this skill's table and the README's `make blender` row.

## The registry

`pwa/src/game/model-registry.ts` is the one list of every kind of object the game draws and whether what the player sees is a Blender model or code — its ids, its code builder (always one: the switch's other side), its Blender builder, committed files and switch when modelled. `docs/models.md` is its table (`make model-registry`), and `tests/model_registry_test.ts` holds the Blender rows to exactly what `modelFiles` packs. **Modelling a kind is a row flipped from `code` to `blender` in the same change that ships its models**; the suite fails until the row, the files and the page agree.

## The models in the game

Every build draws them — local, CI, the site's slots, a release, the
desktop and store apps — unless SWITCHED BACK (`VITE_MODEL_SKIS=0`,
`VITE_MODEL_SKIERS=0`, `VITE_MODEL_BIRDS=0`,
`VITE_MODEL_BEASTS=0`, `VITE_MODEL_GATES=0` in the environment or the root
`.env`; `model-switch.ts`). Every workflow's build step hands on the
repository variables of the same names, so `make ci-models MODELS=off`
switches every CI build back with no commit. `docs/configuration.md` is
the description; what a session needs:

- **Committed, stamped, drift-tested.** `make models` makes every pair and
  `skier0` at game quality (no stills), every bird, animal and mark
  (seconds each), and `scripts/models.mjs` publishes the LOD0s into
  `pwa/models/<id>.glb` / `skier.glb` and the static models packed into
  `birds/`, `beasts/`, `gates/`, with `sources.json`: one hash a
  half (`MODEL_HALVES` in `pwa/models-plugin.ts` — the builders, the
  driver, the kind's data module, and the game data they read).
  `tests/models_test.ts` recomputes each: a change to any source FAILS the
  suite until `make models SET=<half>` is run and `pwa/models/` committed
  with it. CI therefore needs no Blender. Add a file a builder reads to
  its half's list, or its changes go unseen.
- **Packed by the build** (`pwa/models-plugin.ts`, before `appPwa` so the
  worker precaches them; a build whose model is missing FAILS, naming
  `make models`) and **fetched before anything is built** — `loadModels()`
  where the renderer's chunk lands (`use-render-kit.ts`) and where the
  ski card's turntable lands (`ski-picker.tsx`).
- **The code pair is still built and still the pair.** `attachModels`
  hangs the model beside it and COLLAPSES the code's drawn parts out of the
  merged draw (`posed-merge.ts`); the lamp, the bound, the thrown skier and
  every reader of a `SkierModel` go on as they were. The pair is posed by
  `ski-rig.ts`, the skier by `skier-rig.ts` at the figure's own pose. "Up"
  and "side" are the PAIR's (`rigAsset` reads them off the loaded scene's
  frame), never the lab's floor.
- **Dressed, not repainted by hand.** `dressOf` maps each material's NAME
  (as `skis.py` / `skier.py` name it — `tests/models_test.ts` reads them)
  to the topsheet's colour or to the code pair's own base, edge and lamp
  materials; every other material goes through the world's `wrap`. A
  topsheet's graphic does not reach a model (open work). One skier model
  for every kit.
- **Cost**: a pair's LOD0 in the low thousands of triangles, the skier's
  under 10k, a bird 300–600, an animal 550–700, the arch ~3.5k; the lower
  LODs are packed by nothing yet (open work: rivals at range on LOD1).

## Skill self-improvement

Load **`skill-reflection`** before a session that used this skill commits.
What belongs here: a Blender or glTF trap met, a budget measured on a new
kind, a modelling move that made a class read (or failed to), a kind added.

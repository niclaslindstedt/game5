---
name: blender-assets
description: "Use when a game asset is to be MODELLED IN BLENDER off the game's own data — the skis (a pair with its bindings, boots and poles) and the skier today; any other drawn thing when its kind is added — for studio renders, a real-time glTF with LODs, or to find out how good an authored version of something the game builds in code could look. Owns `make blender` (`scripts/blender.mjs` and the KINDS under `scripts/blender/kinds/`, each the JSON the game's data for one is handed as), the Blender shelf (`scripts/blender/lib.py`: the helpers, the studio, the rig, the game-budget export) and each kind's builder (`scripts/blender/skis.py`, `skier.py`), the RIG every model carries and the clips baked into it (the game-side contracts `ski-rig.ts` and `skier-rig.ts`), the lab sheet that sets a model beside the game's own (`make skis ARGS=--asset=…`), THE MODELS IN THE GAME (the skis: the `VITE_MODEL_SKIS` build switch, `make models`, `pwa/models-plugin.ts`, `skier-models.ts`: packed, loaded, dressed, posed in place of the code's drawn parts), the frame a model is stated in and turned back from, the triangle budget and its LODs, installing and running Blender headless on macOS and Linux, reference photographs (local only, never committed, never named), and adding a new kind. Not the game's own builders (`ski-design`, `nature`, `skier`) — though they are what every model is held against — and not the TREES, the WILDLIFE or the COURSE'S MARKS, which are not modelled: every one is built procedurally in code (`tree-shapes.ts`, `bird-shapes.ts`, `beast-shapes.ts`, `mark-shapes.ts`; `nature`, `collision`)."
---

# Blender assets

The game draws its **skis from the models made here** — committed in
`pwa/models/` by `make models` — and builds everything else (and, one
switch away, the skis too) in code; the SKIER is dressed in code from a
gear catalog (`skier-gear`), and his Blender model is the labs'
comparison (§ "The models in the game"). This skill is the other
road, kept open on purpose — the same things MODELLED in Blender, off the
same numbers, so that the question "how good could it look, and what would
it cost?" is answered with a render, a triangle count and a picture in the
game's own lab rather than a guess, and so that a desktop build could one
day ship authored assets without the models drifting from the physics.

Three rules make that possible, and every step below serves one of them:

1. **A model is built off the game's data, never off numbers of its own.**
   The driver hands Blender the very tables the game's builder reads (a
   pair: `SKI_CATALOG` and `SKI_LOOKS`; the skier: his pose and bones) as
   one JSON file. A modelled
   pair therefore has the physics' length, waist, sidecut and mount to the
   millimetre, and when a trace moves, the model moves with it on the next
   run. A hand-typed dimension in a builder is the drift this rules out.
2. **The lab's outputs are not committed; the game's models are.** Every
   render, `.blend` and LOD lands in the gitignored `previews/blender/`;
   only `make models` publishes — the LOD0 of every pair and the skier,
   with their sources' stamp, into `pwa/models/` — and those are
   committed.
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
| `scripts/blender/skier.py` | THE SKIER BUILDER (`KIND=skier`, `ID=skier0…3` a start-line slot's kit): one SUIT that bends (a man of the ANSUR II survey's mean measure in a racer's kit, lofted a piece a bone, remeshed into one skin, creased where a joint bends, cut along the hem, yoke, cuff and lap planes before it is coloured, weighted across each joint between the two bones that meet there) and rigid parts on one bone each — the head in its helmet as the GAME'S OWN TRIANGLES (`helmet-shape.ts`'s `helmetParts`, handed in with their normals and the lens's unwrap — so the model's helmet is the code's, triangle for triangle), the boots, the gloves |
| `pwa/src/game/skier-rig.ts` | THE SKIER'S CONTRACT: `skierBones(pose)` (every bone's frame off a `SkierPose` — the game's own spans, rolled to face each joint's bend, the head turned as `skier-figure.ts` turns it; a pelvis and a chest, HALF BONES at the hips, knees, shoulders and elbows, the hands along their poles, the feet in their boots), `STANDING` (the pose he is bound in), `skierClips()` (every clip SAMPLED off the game's `skierPose` and `stepSkierSpring`), `rigSkier` (a loaded model's bones set to a pose, or a clip played) |
| `scripts/blender/heli.py` | THE HELICOPTER BUILDER (`KIND=heli`, off `HELI` in `engine/game/defs/heli.ts`): THREE RIGID NODES and no rig — `heli_body` (origin the skid datum), `heli_rotor` (origin the hub, turning about its local up) and `heli_tail_rotor` (origin its hub, turning about its local x). The cabin's skin is one parametric surface whose windows, door seams and livery are FIELDS traced into the mesh as constrained edges (`delaunay_2d_cdt` in the surface's own (y, angle) plane), its normals the surface's own — crisp outlines and smooth shading at any budget; the LODs are the builder at a coarser cut, not a decimation (LOD0 ~14k triangles, LOD1 ~6k); its proportions are traced off the class's published three-view, laid over the builder's orthographic `oside`, `otop` and `ofront` stills (100 px/m, kept local like any reference). Published by `make models KIND=heli`, stamped apart as the `heli` half |
| `scripts/blender/sled.py` | THE SNOWMOBILE BUILDER (`KIND=sled`, off `SLED` in `engine/game/defs/sled.ts` and the mountain class's trace in `pwa/src/game/sled-look.ts`, the sibling sled game's builder cut into nodes): RIGID NODES and no rig — `sled_body`, `sled_bars` (origin the post's foot), `sled_ski_l` / `sled_ski_r` (origin the spindle's foot), `sled_track` (origin the drive sprocket) with its child `sled_lugs` carrying ONE MORPH (`run`, every paddle moved a step round the loop — kept out of the joins, which would lose the key), and `sled_rack` (the rider's pair and poles, materials `rack_ski` / `rack_trim` / `rack_base` the game dresses). In the TRACE's frame; `sled-view.ts` turns it a half turn and shifts it by `SLED.trace`. Its `.glb` is exported with `export_morph=True`. |
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
ski's loft-and-crease craft) —
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
  finger is five points of tube); the HEAD IN ITS HELMET built from `helmet-shape.ts`'s triangles, a material a part (`PAINT` in `skier.py`), its normals set as custom normals so the stripe's cut and the rolled rim shade as the code's do — the shell is designed THERE, in TypeScript, never in the builder; `make helmet` sets the two side by side.
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
  decimated to a few thousand quads' worth, the head in its helmet the game's
  own cut of `helmetParts` (some 3,400 triangles; a still takes the finer cut) — boots,
  guards and gloves the rest), the lower LODs a third and a tenth of it;
  render quality is the 6 mm remesh.

## The trees, the wildlife and the marks are not modelled

Every tree, bird, animal and mark of the course is built PROCEDURALLY in
code on one bench (`tree-mesh.ts`; `tree-shapes.ts`, `bird-shapes.ts`,
`beast-shapes.ts`, `mark-shapes.ts` — the `nature` and `collision`
skills): chunky and faceted, at more than one level of detail, its moving
parts MARKED for the vertex shader (a trunk's girth, a wing's flap, a leg's
swing, an antler grown to its age) — at a fraction of a model's triangles,
and one builder makes every cut of every form. `scripts/blender.mjs`'s
header still names the trees, the wildlife and the marks as kinds: it is a
stamped source of the skis and the skier (`MODEL_SOURCES`), so editing it
asks for `make models` to be run again (which needs Blender) — leave it
until the next time the skis or the skier are remade, and fix its header
then.

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

## Adding a kind (…)

1. **The data.** A module `scripts/blender/kinds/<kind>.mjs` exporting
   `kind`: `ids()`, and `data(id)` returning the game's OWN tables for one
   (a pair: its row from `defs/skis.ts` and its trace from `ski-looks.ts`)
   — imported through `aliasEngine`, never restated — its `builder`, its
   `fallback` id and a `help` line. The driver finds it by its file name.
2. **The builder**, `scripts/blender/<kind>.py`: `from lib import *`, its
   frame stated in its header, `rides()` / `bone()` for the rig, `clip()`
   for what it plays, `finish(name, OUT, SAMPLES, centre, size)` at the end.
   A helper two kinds need goes into `lib.py`. Its sources (the builder,
   its data module, the shelf, the game data it reads) are a list in
   `pwa/models-plugin.ts` and a half of `MODEL_HALVES`, stamped apart in
   `sources.json`.
3. **The lab.** The kind's own lab owes an asset view like the skis lab's
   (`--asset=`), with the turn back into the game's frame in the lab, not
   in the model, and a rig sheet posing it by the game's own numbers beside
   the builder's (the pair's `rig` sheet and `ski-rig.ts` are the pattern).
4. Register nothing new: `make blender KIND=<kind>` is already the target.
   Update this skill's table and the README's `make blender` row.

## The registry

`pwa/src/game/model-registry.ts` is the one list of every kind of object the game draws and whether what the player sees is a Blender model or code — its ids, its code builder (always one: the switch's other side), its Blender builder, committed files and switch when modelled. `docs/models.md` is its table (`make model-registry`), and `tests/model_registry_test.ts` holds the Blender rows to exactly what `modelFiles` packs. **Modelling a kind is a row flipped from `code` to `blender` in the same change that ships its models**; the suite fails until the row, the files and the page agree.

## The models in the game

THE SKIER IS NOT SHIPPED AS A MODEL. The gear is a catalog to mix (two
bodies under five jackets, four pants, four helmets, gloves and poles),
and a modelled skier is one suit: the game dresses him in code instead
(`skier-gear`: each piece cut onto the rig in its bind pose and skinned on
the very bones `skier-rig.ts` states, so a modelled skier and the dressed
one are posed alike). `make blender KIND=skier` still models one suit —
the comparison `make gear ARGS="--sheet=compare --model=…"` sets beside
the dressed skier — and `skier-rig.ts`, `skier.py` and `dressOf`'s skier
half serve that.

Every build draws the SKIS — local, CI, the site's slots, a release, the
desktop and store apps — unless SWITCHED BACK (`VITE_MODEL_SKIS=0` in the
environment or the root `.env`; `model-switch.ts`). Every workflow's
build step hands on the repository variable of the same name, so
`make ci-models MODELS=off`
switches every CI build back with no commit. `docs/configuration.md` is
the description; what a session needs:

- **Committed, stamped, drift-tested.** `make models` makes every pair at
  game quality (no stills), and `scripts/models.mjs` publishes the LOD0s
  into `pwa/models/<id>.glb` with `sources.json`
  (`MODEL_HALVES` in `pwa/models-plugin.ts` — the builders, the driver,
  the kinds' data modules, and the game data they read).
  `tests/models_test.ts` recomputes it: a change to any source FAILS the
  suite until `make models` is run and `pwa/models/` committed with it. CI therefore needs no Blender. Add a file a builder reads to
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
  `ski-rig.ts` (a lab's Blender skier by `skier-rig.ts` at the figure's own
  pose). "Up"
  and "side" are the PAIR's (`rigAsset` reads them off the loaded scene's
  frame), never the lab's floor.
- **Dressed, not repainted by hand.** `dressOf` maps each material's NAME
  (as `skis.py` / `skier.py` name it — `tests/models_test.ts` reads them)
  to the topsheet's colour or to the code pair's own base, edge and lamp
  materials; every other material goes through the world's `wrap`. A
  pair's GRAPHIC is cut into its model (a pair is sold in one topsheet):
  `skis.py` lays the pattern's decals in `white` — the trim — exactly where
  `ski-gear.ts`' `decalGeometry` lays the code pair's, and a race pair's
  number panel in `base`; `ski-topsheets.ts` is a `MODEL_SOURCES` file. A
  lab's Blender skier takes an outfit's colours (`outfit.ts`' `coloursOf`).
- **Cost**: a pair's LOD0 in the low thousands of triangles, the skier's
  under 10k; the lower LODs are packed by nothing yet (open work: rivals at range on LOD1).

## Skill self-improvement

Load **`skill-reflection`** before a session that used this skill commits.
What belongs here: a Blender or glTF trap met, a budget measured on a new
kind, a modelling move that made a class read (or failed to), a kind added.

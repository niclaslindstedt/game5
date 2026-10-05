# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
.PHONY: world sky cloud snowfall cloud-metrics turns technique skis skier poleless skate-turns helmet damage hud-body gear skier-metrics blender models model-registry ci-models birds crowd audience lift-ride heli sled trees forest build test lint fmt fmt-check release clean install icons sim level resort analyze rate difficulty routes ride audition screenshots profile bench hooks shellcheck actionlint changelog bump docs tauri tauri-test tauri-lint tauri-fmt desktop native-install native-bundle native-typecheck native-ios native-iphone native-android

build:
	npm run build

# The vitest suite. SHARD=i/N runs only the i-th of N slices of the test
# FILES — how CI fans the suite out across runners (six of them); a bare
# `make test` is still the whole thing, and stays the definition of green.
# The slices are cut by each file's measured time, not by count
# (`tests/support/shards.ts`).
#
# Sharding splits at file granularity, so the SLOWEST SINGLE FILE is the
# floor and more runners cannot get under it: share one corpus of built maps
# between the rules a file asserts rather than rebuilding it per rule, and
# split a file whose subject is really two.
test:
	npm test -- $(if $(SHARD),--shard=$(SHARD),)

lint:
	npm run lint

fmt:
	npm run fmt

fmt-check:
	npm run fmt:check

release:
	npm run build

clean:
	rm -rf pwa/dist node_modules pwa/node_modules previews

install:
	npm install

# Regenerate the PWA install icons and the favicon from the app mark (keep
# pwa/public/icons/icon.svg and pwa/src/game/app-mark.ts in lockstep).
icons:
	npm run icons

# THE WORLD LAB: one seed ridden by the bot and photographed through the
# game's own renderer at named moments — previews/world-<view>.png. Builds
# its own one-off bundle from pwa/world-preview.html (never deployed) and
# needs a Chromium: CHROMIUM_PATH=/opt/pw-browsers/chromium in a web
# session. SEED=n picks the map; ARGS="--views=powder,lookback" a subset.
world:
	npm run world -- $(if $(SEED),--seed $(SEED),) $(if $(REGION),--region $(REGION),) $(if $(GRADE),--grade $(GRADE),) $(ARGS)

# THE SKIS LAB: every pair and its skier built with the game's own
# builder and drawn on labelled contact sheets — previews/skis-<sheet>.png:
# the catalog by view (side, front, rear, three-quarter, chase), one
# pair's skier in every pose, and a landing as a time-lapse of the body
# on its legs. Its own one-off bundle from pwa/skis-preview.html (never
# deployed); needs a Chromium like `world`. SKIS=id picks the pair the
# poses and the landing stand on; ARGS="--sheet=poses" one sheet.
skis:
	npm run skis -- $(if $(SKIS),--skis $(SKIS),) $(ARGS)

# THE SKIER LAB: the skier IN MOTION as the game draws him — every move (a
# skate stride, a double pole, a jump loaded, sprung and landed, a hockey
# stop, a carve cut hard, the tuck, a landing, a wipeout) skied by the real
# engine, the committed models posed through its states and photographed
# from five sides a frame a column — previews/skier-<move>.png — and a
# turntable round his stance, his tuck and a skate stride; and, at the
# lab's MOMENTS, close up (ARGS=--sheet=closeup), his hands, boots, head
# and jacket (--sheet=detail), at the game's own pixels (--sheet=game) and
# his skin's stretch off its bind (--sheet=stretch). Its own one-off
# bundle from pwa/skier-preview.html; needs a Chromium like `world`.
# MOVE=skate,jump a subset; ARGS="--code" the code's figure.
skier:
	npm run skier -- $(if $(MOVE),--move $(MOVE),) $(ARGS)

# THE POLELESS LAB: what a skier WITHOUT POLES (the hard mode) does with his
# hands — every poleless move of the skier lab skied by the real engine and
# each fist measured (its swing, its bob, the wave a stride, its jolt in
# the world and off the hips, any snap, whether the arm forward is the one
# on the side of the leg that pushed, how far it crosses), then the moves
# photographed through the skier lab (previews/skier-bare-*.png). Pure
# Node for the table; the sheets need a Chromium like `world`.
# MOVE=bare-skate a subset; ARGS=--no-shots the table alone;
# ARGS="--json=a.json" / "--compare=a.json" before and after.
poleless:
	npm run poleless -- $(if $(MOVE),--move $(MOVE),) $(ARGS)

# THE SKATE TURNS LAB: how a skier turns at a crawl — stepped round, the
# skate turned to one side — from each speed with the steer held, with and
# without poles (the heading turned at 1, 2 and 3 s, how long to come round
# 90° and on what radius, the speed kept against the same run straight),
# then the turning moves photographed through the skier lab: from above
# over the line he draws (previews/skier-path-*.png) and a frame a column.
# ARGS=--no-shots the table alone; ARGS=--grade=0.08 down a pitch;
# ARGS="--json=a.json" / "--compare=a.json" before and after.
skate-turns:
	npm run skate-turns -- $(if $(MOVE),--move $(MOVE),) $(ARGS)

# THE HELMET LAB: the head in its helmet, the code's and the committed
# model's side by side — every side (previews/helmet-views.png), every
# triangle's edges and the head's count (helmet-wire.png), flat on a
# centimetre grid against a real helmet's envelope (helmet-profile.png)
# and at the chase and far cameras' own pixels (helmet-game.png). Its own
# one-off bundle from pwa/helmet-preview.html; needs a Chromium like
# `world`. SLOTS=0,1,2,3 the kits; ARGS="--model=previews/blender/skier0-lod0.glb"
# a candidate beside the committed model.
helmet:
	npm run helmet -- $(if $(SLOTS),--slots $(SLOTS),) $(ARGS)

# THE DAMAGE LAB: the HUD's body panel and g meter as the player reads
# them, drawn by the game's own components and stylesheets over staged
# bodies (sound, bruises, hairlines, breaks, organs, a trunk, every bone
# cracked, every bone broken) and ride-lab crashes skied through the
# engine (the body at its worst, before the reset mends it) — the panel's
# strip of a 1280×720 frame (previews/damage-panels.png), one body at the
# three reference viewports (damage-viewports.png, CASE=id) and the figure
# enlarged (damage-plate.png); ARGS="--refs=DIR" lays local references
# under it (damage-refs.png). Its own one-off bundle; needs a Chromium.
damage:
	npm run damage -- $(if $(CASE),--case $(CASE),) $(ARGS)

# THE HUD BODY LAB: the HUD's anatomy figure made from a whole 3D body —
# one man's CT (BodyParts3D, fetched on first use into the gitignored
# previews/.bodyparts3d/), every bone and the skin a mesh of its own — the
# feet turned so the toes show, the trunk cut along the spine into a FRONT
# and a BACK, each seen orthographically, lit, and traced: the outline, the
# parts cut at the body's seams, every bone's silhouette and its shading,
# the order the depths say, a crack's mark. The model lit beside the figure
# traced (previews/hud-body-front.png, hud-body-back.png) and a table of
# every bone. ARGS=--write writes the GENERATED pwa/src/game/body-model.ts.
# Pure Node; needs curl and unzip the first time.
hud-body:
	npm run hud-body -- $(ARGS)

# THE GEAR LAB: the skier in every piece of his kit — the catalog's
# jackets, pants, helmets, gloves and poles and both bodies, cut on the
# loom and skinned on the rig — from every side (previews/gear-catalog.png),
# every start-line outfit (gear-outfits.png), one outfit through the moves
# (gear-poses.png), at the game's own pixels (gear-game.png), wired and
# counted (gear-wire.png), beside a modelled skier (gear-compare.png,
# ARGS=--model=previews/blender/skier0-lod0.glb) and beside local reference
# photographs never committed (gear-refs.png, ARGS="--sheet=refs --refs=DIR").
# Its own one-off bundle from pwa/gear-preview.html; needs a Chromium like
# `world`. SLOTS=jacket,pants the catalog's slots; OUTFITS=0,1 the outfits.
gear:
	npm run gear -- $(if $(SLOTS),--slots $(SLOTS),) $(if $(OUTFITS),--outfits $(OUTFITS),) $(ARGS)

# THE SKIER METRICS LAB: is his pose a real skier's? Every move skied by the
# engine in pure Node, the game's pose measured frame by frame (the knees,
# the hips, the shins in their boots, the centre of mass over the feet, the
# angulation, the head against the horizon, a limb through another, a
# joint that snaps) and held to bands off coaching and biomechanics; the
# table, and the share of frames at fault. Seconds, no browser.
# MOVE=carve,tuck a subset; ARGS="--faults" every fault;
# ARGS="--json=a.json" / "--compare=a.json" a before and after.
skier-metrics:
	npm run skier-metrics -- $(if $(MOVE),--move $(MOVE),) $(ARGS)

# THE BLENDER LAB: a game asset MODELLED in Blender off the game's own data
# (a pair: its spec and its class's traced look) — studio renders, the
# game-budget glTF with two LODs and the .blend files, in previews/blender/.
# Nothing is committed; `make skis ARGS=--asset=previews/blender/chamois-lod0.glb`
# sets a model beside the builder's. Needs Blender (BLENDER= its executable).
# KIND=skis, ID=eagle picks the asset; ARGS="--quality=game --views=three".
blender:
	npm run blender -- $(if $(KIND),--kind $(KIND),) $(if $(ID),--id $(ID),) $(ARGS)

# The models the game ships: every pair of skis, the heli-ski helicopter
# and the mountain snowmobile, game quality (no stills), made by Blender and published into
# the COMMITTED pwa/models/ with a stamp of their sources a kind —
# tests/models_test.ts fails when a model is older than what it is made
# from. KIND=skis, KIND=heli or KIND=sled makes and publishes that kind alone. Needs
# Blender (or the bpy module: scripts/bpy-blender.sh). A build draws them
# unless switched back (VITE_MODEL_SKIS=0, VITE_MODEL_HELI=0,
# VITE_MODEL_SLED=0). The skier
# (dressed in code, `make gear`), the trees, the wildlife and the course's
# marks are built in code and have no models; `make blender KIND=skier`
# still models the skier for the labs.
models:
	$(if $(filter all skis,$(or $(KIND),all)),npm run blender -- --kind skis --id all --quality=game --views=none,)
	$(if $(filter all heli,$(or $(KIND),all)),npm run blender -- --kind heli --quality=game --views=none,)
	$(if $(filter all sled,$(or $(KIND),all)),npm run blender -- --kind sled --quality=game --views=none,)
	node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/models.mjs --kind $(or $(KIND),all)

# Switch the models on or off for every CI build — the repository
# VARIABLE the workflows hand the build (needs gh, and the right to set
# it): `make ci-models MODELS=off` draws the code-built skis on the next
# deploy with no commit; MODELS=on (or deleting the variable) puts the
# models back.
ci-models:
	@case "$(MODELS)" in \
	  off) gh variable set VITE_MODEL_SKIS --body 0 || exit 1 ;; \
	  on) gh variable set VITE_MODEL_SKIS --body 1 || exit 1 ;; \
	  *) echo "usage: make ci-models MODELS=on|off" >&2; exit 2 ;; \
	esac
	@gh variable list | grep VITE_MODEL || true

# THE SKY LAB: every weather (R19) against every three hours of the clock,
# day and night, on one seed seen from one place, as one labelled contact
# sheet — previews/sky-<seed>.png. Its own one-off bundle from
# pwa/sky-preview.html (never deployed); needs a Chromium like `world`.
# SEED=n picks the map (its day and latitude are kept);
# ARGS="--hours=6,12,18 --view=vista --weathers=overcast,fog" narrows it.
sky:
	npm run sky -- $(if $(SEED),--seed $(SEED),) $(ARGS)

# THE CLOUD LAB: the snow a skier throws up and the groove he leaves, as one
# labelled contact sheet — previews/cloud-<seed>.png. Each row one ride
# across the seed's open meadow, or the piste with ARGS=--where=piste (a
# kind of snow × a light × a move — straight, carve, turn, skid, check,
# stop, skate —
# × a held speed),
# each column the same moment from another angle (chase, side, front, high,
# trail, under, furrow), or with ARGS=--cols=times one angle at several
# moments. Its own one-off bundle from pwa/cloud-preview.html (never
# deployed); needs a Chromium like `world`. SEED=n, REGION=id;
# ARGS="--snow=groomed,hard,soft,new,wet --light=back,low,night --speeds=30,90";
# ARGS="--moves=straight,check,stop --speeds=10,25,55".
cloud:
	npm run cloud -- $(if $(SEED),--seed $(SEED),) $(if $(REGION),--region $(REGION),) $(ARGS)

# THE SNOWFALL LAB: the falling snow as a skier sees it at speed — every
# falling sky ridden INTO its wind, WITH it and ACROSS it at a ladder of
# speeds, as two contact sheets (previews/snowfall-<seed>.png, the game's
# frame; previews/snowfall-<seed>-flow.png, the flakes alone over several
# frames, each one's way across the picture a track) and a table of the air
# past the lens. Its own one-off bundle from pwa/snowfall-preview.html (never
# deployed); needs a Chromium like `world`. SEED=n;
# ARGS="--weathers=storm --rides=into --speeds=0,50,100,150 --camera=tips".
snowfall:
	npm run snowfall -- $(if $(SEED),--seed $(SEED),) $(ARGS)

# THE CLOUD METRICS LAB: how MUCH snow cloud a skier raises — each kind of
# snow × move × speed skied by the engine in pure Node and every frame read
# as snow-cloud.ts reads it: the puffs a second, the cloud alive behind him
# (its opacity-weighted area, against his own silhouette), how high, how
# long. Whether the cloud grows with speed, and by how much a change moved
# it. Seconds, no browser. ARGS="--snow=new --moves=check,stop
# --speeds=10,20,40"; ARGS="--json=a.json" / "--compare=a.json".
cloud-metrics:
	npm run cloud-metrics -- $(ARGS)

# THE TURNS LAB: the skier TURNING AND STOPPING as the game draws him — one
# turn held, linked carves, a skidded turn and a hockey stop (the held moves
# of hold-input.ts), each at several speeds, ridden on a real map's piste
# through the game's own renderer (the models, the tracks, the spray, the
# cloud) and photographed at moments of each — previews/turns-<seed>-<view>.png,
# a sheet a lens (chase, low at the snow, behind, side, front, high). Every
# cell prints the speed, the inclination, each ski's share of the load and
# its gap to the snow (ski-stand.ts). Its own one-off bundle from
# pwa/turns-preview.html (never deployed); needs a Chromium like `world`.
# SEED=n, REGION=id; ARGS="--views=low,side --moves=stop --speeds=30,60";
# ARGS="--where=meadow --moves=carve".
turns:
	npm run turns -- $(if $(SEED),--seed $(SEED),) $(if $(REGION),--region $(REGION),) $(ARGS)

# THE TECHNIQUE LAB: how each riding technique (defs/technique.ts — free,
# slalom, giant slalom, super-G, downhill) LOOKS and MEASURES, skied by the
# bot down one course on one seed, each on its discipline's own pair. A
# TABLE (peak and most edge, turn time, the tightest tenth's radius, yaw,
# speed, skid, peak force in body weights, share tucked) beside the research
# targets of docs/disciplines.md, marked outside them; and three sheets
# through the game's own renderer — previews/technique-<seed>-path.png (a
# stretch from above, strobed over his line), -behind.png (a TV lens through
# one turn), -side.png (its apex from outside, front and inside) and
# -turns.png (every technique's own linked carve down one open slope by a
# scripted rhythm, from above at one scale, the line coloured by its radius,
# each apex labelled — how sharp each turns; its medians are the table's
# `shape` rows). The course of the other sheets: auto (the slalom for the
# slalom and free rows, the open piste for
# the speed events), slalom or piste. Its own one-off bundle from
# pwa/technique-preview.html (never deployed); needs a Chromium like `world`
# — ARGS=--sheets=none is the table alone, in seconds, no browser.
# SEED=n; ARGS="--techniques=slalom,free --skis=swift --course=slalom";
# ARGS="--json=a.json" / "--compare=a.json".
technique:
	npm run technique -- $(if $(SEED),--seed $(SEED),) $(ARGS)

# THE WILDLIFE LAB: every bird over the woods and every animal in the snow
# side by side, three poses each (each in the next of its forms: an old
# male, a female, a youngster) through the game's own procedural geometry
# and material, over a metre rule — previews/birds.png. Its own one-off
# bundle from pwa/birds-preview.html (never deployed); needs a Chromium
# like `world`. ARGS="--rows=raven,ptarmigan,reindeer" narrows it;
# ARGS=--lod=far draws the far cut, --lod=both each species at both.
birds:
	npm run birds -- $(ARGS)

# THE CROWD LAB: the free ride's amateurs — every body at the stance and at
# each of the player's poses its figure is morphed between (figures), its
# NEAR, MID and FAR cut with the triangles (lods), the poses blended as the
# crowd is drawn (moments), a real crowd's groups in what they were dealt
# (dress), and the crowd on SEED's mountain through the game's renderer
# (slope: busy, group, chase, kicker, overview) — previews/crowd-*.png. Its
# own one-off bundle from pwa/crowd-preview.html (never deployed); needs a
# Chromium like `world`. SEED=n; ARGS="--sheet=slope --t=90 --views=busy";
# ARGS="--sheet=figures --bodies=child,oldWoman".
crowd:
	npm run crowd -- $(if $(SEED),--seed $(SEED),) $(ARGS)

# THE AUDIENCE LAB: a race's crowd — every fan style through its animation
# (moves: at rest, a racer coming, frame by frame as he passes, turned to
# follow him), a map's dealt crowd in what it wears (looks), the near and
# far cuts (cuts), and the crowd on SEED's race through the game's renderer
# with the bot skiing (race: start, turn, pitch, jump, line, slope, pass-0…5,
# finish, stand, arena, overview, chase) — previews/audience-*.png. Its own
# one-off bundle from pwa/audience-preview.html (never deployed); needs a
# Chromium like `world`. SEED=n; ARGS="--sheet=race --views=stand,arena";
# ARGS="--sheet=race --views=pass --hour=19"; ARGS="--sheet=moves".
audience:
	npm run audience -- $(if $(SEED),--seed $(SEED),) $(ARGS)

# THE LIFT RIDE LAB: a free ride begun on the chairlift, carried to the
# top, stood off down the unload ramp and its lane past the station house,
# turned at the signs and led onto its run — ridden unbroken at sixty
# frames a second through the game's renderer and camera, so the lens's
# springs are the ones a player sees, and photographed at moments round the
# unload into one sheet, previews/lift-ride-<seed>.png. Its own one-off
# bundle from pwa/lift-ride-preview.html (never deployed); needs a Chromium
# like `world`. SEED=n REGION=id; ARGS="--camera=far --at=-3,0,1,2,4,8".
lift-ride:
	npm run lift-ride -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE HELICOPTER LAB: the free ride's helicopter staged at every event it
# has and photographed through the game's renderer — parked on its pad and
# lit up for a skier riding in, boarded (the rotor spooling, the rider on
# the skid close up), lifting off and hovering in its wash over deep powder,
# cruising and banked, the rider's eye, set down on a summit flat and
# stepped off, the drop over a steep face and the fall into the powder, the
# machine flying home, the crash's explosion frame by frame and the burning
# wreck, the restart, the night, and the model alone on a turntable — one
# contact sheet a group, previews/heli-<group>.png, and every frame alone,
# previews/heli-<view>-<label>.png. Its own one-off bundle from
# pwa/heli-preview.html (never deployed); needs a Chromium like `world`.
# SEED=n REGION=id; ARGS="--sheet=crash,drop"; ARGS="--views=wash,impact";
# ARGS="--weather=clear --sheets-only".
heli:
	npm run heli -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE SNOWMOBILE LAB: the free ride's snowmobile staged at every moment it
# has — parked and calling, boarded, on the groomer, in powder (sunk, the
# launch, the roost off a spinning belt, a carve onto its side), up a steep
# face, the tracks it leaves, hopped off, rolled over, at night, the model
# alone — through the game's own renderer. One contact sheet a group,
# previews/sled-<group>.png, and every frame alone,
# previews/sled-<view>-<label>.png. Its own one-off bundle from
# pwa/sled-preview.html (never deployed); needs a Chromium like `world`.
# ARGS="--sheet=powder,climb" a few sheets, "--views=roost" a few views.
sled:
	npm run sled -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE TREE LAB: every kind of tree (spruce, fir, pine, larch, birch…) and
# each of its ten variants side by side through the game's own procedural
# builder and material, over snow, seen from the skier's head (2.2 m)
# standing off each tree — previews/trees.png. Its own one-off bundle from
# pwa/trees-preview.html (never deployed); needs a Chromium like `world`.
# REGION=id paints it as that country; ARGS="--kinds=pine,larch", "--lod=1"
# (the mid cut), "--lod=2" (the far band's sketch) or "--ages" (each kind's
# trunk from a sapling to a veteran).
trees:
	npm run trees -- $(if $(REGION),--region $(REGION),) $(ARGS)

# THE FOREST LAB: what it is like to be IN a map's woods, from the engine
# and the tree table alone (pure Node, seconds): the trees and their kinds,
# the clumps, the narrowest gap between two groups, how far a skier sees
# into the woods and from the piste, any pocket a skier cannot reach — and
# a window of the woods from above, previews/forest-<seed>.png.
# `make forest SEED=38 ARGS=--compare` (version 1 beside it) · `COUNT=12`
forest:
	npm run forest -- $(if $(SEED),--seed $(SEED),) $(if $(COUNT),--count $(COUNT),) $(if $(REGION),--region $(REGION),) $(ARGS)

# ---------------------------------------------------------------------------
# The desktop app (tauri/)
# ---------------------------------------------------------------------------
#
# A thin wrapper around the same built website, for Windows, macOS and Linux
# — `tauri/README.md` is the tree, `docs/platforms.md` is where it sits. It is
# Rust, so it has its own toolchain and its own linter, and none of it is on
# the root suite's path: `make test` and `make lint` stop at this tree's edge.
# These targets are how it is checked; `.github/workflows/desktop-tauri.yml`
# runs them on every push that touches it.

# Build the site into tauri/webroot/, compile the shell, and launch it.
tauri:
	npm run tauri -- $(ARGS)

# The decision layer's whole test suite, and DELIBERATELY only that crate:
# `powderrun-shell` depends on no GUI toolkit, so this target runs on an
# ordinary CI runner with a Rust toolchain and nothing else. The app crate has
# no tests of its own by design (every decision lives in the library), and
# compiling it needs the platform's webview development libraries — which is
# what `make tauri-lint` and `make tauri` are for.
tauri-test:
	npm run tauri:test

# clippy at zero warnings, the peer of `make lint` for this tree. This one DOES
# need the webview libraries: it checks both crates.
tauri-lint:
	npm run tauri:lint

# rustfmt in place, the peer of `make fmt`.
tauri-fmt:
	npm run tauri:fmt

# Package this machine's desktop downloads into tauri/release/ — the release
# workflow's per-platform job, runnable by hand. `ARGS="--target <triple>"`
# for an explicit target.
desktop:
	npm run tauri:package -- $(ARGS)

# ---------------------------------------------------------------------------
# THE STORE APP (native/): an Expo WebView over a copy of the site bundled
# inside the app. OUTSIDE the npm workspace with a dependency tree of its own,
# so it is installed on its own and typechecked on its own — the root lint
# never sees it. `native/README.md` is the tree, `native/RELEASING.md` the
# submission run-through.
#
# `native-bundle` builds the website and packs it into the zip the app serves.
# THE APP SHIPS WHATEVER ZIP IS ON DISK, so a stale one silently installs the
# last change's game: run it before every device build and every EAS build
# (`native-iphone` and the npm build scripts do it for you).
# ---------------------------------------------------------------------------
native-install:
	npm run native:install

native-bundle:
	npm run native:bundle

native-typecheck:
	npm run native:typecheck

native-ios:
	npm run native:ios

# THE PHONE: build the store app and put it on a REAL iPhone over USB, then
# launch it. Bundles the site, regenerates ios/, signs, installs — one command
# from a clean checkout, and the only way to judge the haptics, which a
# simulator has none of. `make native-iphone ARGS="--device 'my iPhone'"`
# picks between several; ARGS="--skip-bundle" reuses the packed site.
native-iphone:
	npm run native:ios:device -- $(ARGS)

native-android:
	npm run native:android

# Headless balance sweep: the bot rides generated maps through the real
# engine and prints the pace / laps / air / hits table, per seed. Also CI's
# `simulate` job — it exits non-zero when the bot finishes NO seed.
# `make sim` · `make sim SEEDS=3,7`
sim:
	npm run sim -- $(if $(SEEDS),--seeds $(SEEDS),) $(if $(REGION),--region $(REGION),) $(if $(GRADE),--grade $(GRADE),) $(ARGS)

# THE LEVEL MAP: one map from above, from the engine alone — no build, no
# browser. The hills, the forest, the track and every checkpoint numbered,
# the spawn and the grid, drawn to previews/level-<seed>.png, with a table
# of the checkpoints beside it. A claim about "the third checkpoint on seed
# 38" is a claim about a row here.
# `make level SEED=38` · `make level SEED=38 ARGS=--json`
level:
	npm run level -- $(if $(SEED),--seed $(SEED),) $(if $(REGION),--region $(REGION),) $(if $(GRADE),--grade $(GRADE),) $(ARGS)

# THE RESORT LAB: the whole ski area a seed builds (R25–R28), from the engine
# alone — the piste map from above (every run in its colour, the lifts, the
# course raced), the panorama over the valley, every course's profile, and a
# listing of the lifts, the runs, the courses and the findings, to
# previews/resort-<seed>*. COUNT=n sweeps instead, one row a seed.
# `make resort SEED=7` · `make resort SEED=7 REGION=fell ARGS="--course 4"` · `make resort COUNT=24`
resort:
	npm run resort -- $(if $(SEED),--seed $(SEED),) $(if $(COUNT),--count $(COUNT),) $(if $(REGION),--region $(REGION),) $(if $(GRADE),--grade $(GRADE),) $(ARGS)

# SCORE generated maps instead of looking at them: each check a band, and a
# finding names what is wrong. The measuring half of the generator loop;
# `make level` is the looking half. Exits non-zero on any error finding.
# `make analyze SEED=7` · `make analyze COUNT=24`
analyze:
	npm run analyze -- $(if $(SEED),--seed $(SEED),) $(if $(COUNT),--count $(COUNT),) $(if $(REGION),--region $(REGION),) $(if $(GRADE),--grade $(GRADE),) $(ARGS)

# RATE generated maps — how HARD each one is and what KIND of hard, on the
# eight axes of engine/rating/ folded into one index. `--stats` is the
# population per axis; CAMPAIGN=1 audits the committed ladder (every map on
# its own version and held to its digest, the bot's time, the climb).
# `make rate` · `make rate COUNT=96 ARGS=--stats` · `make rate CAMPAIGN=1`
rate:
	npm run rate -- $(if $(SEED),--seed $(SEED),) $(if $(SEEDS),--seeds $(SEEDS),) $(if $(COUNT),--count $(COUNT),) $(if $(CAMPAIGN),--campaign,) $(if $(RACE),--race $(RACE),) $(ARGS)

# THE DIFFICULTY SCHEMATIC: one map from above with what makes it hard drawn
# over it — the corners, the climbs, the drifts, the walled woods — and the
# eight axes beside it, to previews/difficulty-<seed>.png. CAMPAIGN=1 draws
# one sheet per committed map.
# `make difficulty SEED=38` · `make difficulty CAMPAIGN=1`
difficulty:
	npm run difficulty -- $(if $(SEED),--seed $(SEED),) $(if $(CAMPAIGN),--campaign,) $(ARGS)

# THE CAMPAIGN'S ROUTES: every pinned map's loop written down as the line its
# box on the card draws (pwa/src/game/campaign-routes.ts, generated).
# `make routes` · `make routes ARGS=--check`
routes:
	npm run routes -- $(ARGS)

# THE MODEL REGISTRY: which assets are Blender models and which the code
# generates, written into docs/models.md from pwa/src/game/model-registry.ts.
# `make model-registry` · `make model-registry ARGS=--check`
model-registry:
	npm run model-registry -- $(ARGS)

# THE RIDE LAB — the skier on the snow, drawn in profile over the ground it
# crossed, with the numbers that decide the next step beside each cell. One
# staged scenario at a time, through the real engine and a canvas. Required
# before/after any change to the skis, the edge, the sink or the flight.
# `make ride SCENARIO=jump` · `make ride ARGS=--all`
ride:
	npm run ride -- $(if $(SCENARIO),--scenario $(SCENARIO),) $(if $(SEED),--seed $(SEED),) $(ARGS)

# THE EAR: the audio review page, previews/audition.html — every sound on a
# button and the beds (the engine, the track on the snow, the wind) under
# sliders, played by the repo's own synth. Pure Node to build; a browser to
# hear. `ARGS=--meter` drives it headlessly and prints every level.
# `make audition` · `make audition ARGS=--meter`
audition:
	npm run audition -- $(ARGS)

# Drive the built app headlessly and screenshot it at the reference
# viewports. Needs a built pwa/dist (`make build` first, every time),
# `npm i --no-save playwright-core` and a Chromium (CHROMIUM_PATH overrides
# discovery). `make screenshots SEED=38` · `make screenshots SCENE=jump CAMERA=chase`
screenshots:
	node scripts/screenshot.mjs $(if $(SCENE),--scene $(SCENE),) $(if $(SEED),--seed $(SEED),) \
		$(if $(CAMERA),--camera $(CAMERA),) $(ARGS)

# Meter what one frame costs the renderer: draw calls, triangles, program
# and texture binds. Same Chromium requirements as `screenshots`. Run it
# before and after any rendering change.
# `make profile` · `make profile ARGS="--seed 7"`
profile:
	npm run profile -- $(ARGS)

# DEVELOPER ▸ BENCHMARK off the command line: the built site on `?bench=1`,
# the pinned race timed to its end, and the report COPY DEBUG REPORT would
# copy printed and written to previews/benchmark.txt. Headless Chromium draws
# in software, so read its score as this build's cost, not a phone's.
# `make bench` · `make bench ARGS="--width 640 --height 360 --video low"`
bench:
	npm run bench -- $(ARGS)

shellcheck:
	shellcheck scripts/*.sh .githooks/*

actionlint:
	actionlint -color

# Install the repo's git hooks (pre-commit format check, conventional
# commit message lint).
hooks:
	git config core.hooksPath .githooks
	@echo "git hooks installed (core.hooksPath = .githooks)"

docs:
	@echo "see docs/"

# Local preview of what the release workflow will write to CHANGELOG.md.
# Pass the planned version: `make changelog VERSION=0.2.0`. Consumes the
# fragments in .changes/unreleased/ — run inside a scratch branch or
# revert afterwards if you only wanted a preview.
changelog:
	@test -n "$(VERSION)" || { \
		echo "usage: make changelog VERSION=X.Y.Z"; exit 2; \
	}
	npx ogf-collate-changelog $(VERSION)

# Print the semver bump (patch/minor/major) the release workflow will
# auto-derive from the current .changes/unreleased/ fragments. Read-only.
bump:
	@npx ogf-compute-bump

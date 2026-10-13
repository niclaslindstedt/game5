# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
.PHONY: bike bike-park bike-look bike-ride bike-hit title-scene title world buildings interiors lifts sky sky-solar sky-table cloud snowfall shimmer aloft cloud-metrics spray-metrics spray-eval spray turns snowlab technique skis skier revert hop-switch poleless skate-turns skate-climb sidestep helmet damage injuries hud-body gear glove-metrics skier-metrics air-lean board board-metrics board-motion sag landing lean blender models model-registry ci-models birds crowd civilians audience lift-ride grind lift-board lift-flow lift-path heli sled sled-land sled-turn sled-tip grimbear avalanche-flow avalanche rescue gore bones xray xray-body replay-cam groomer snowguns water tree-wells trails piste-day snow summer judder menu-stalls trees cabins forest build test lint fmt fmt-check release clean install icons sim level resort lift-tops challenges-table junctions analyze rate difficulty routes real-faces far-faces real-hints world-map ride audition screenshots profile bench cpu-cost hooks shellcheck actionlint changelog bump docs tauri tauri-test tauri-lint tauri-fmt desktop native-install native-bundle native-typecheck native-ios native-iphone native-android para para-wind balloon-flight plane-flight airstrip skijump-flight skijump-hills plane skijump skydive-flight wingsuit-flight wingsuit skydive speed-cam balloon afterski town exit-cam jolt

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

# THE BUILDINGS LAB: every kind of lift station's foot and top from three
# sides, through the game's own renderer, as one sheet —
# previews/world-free-stations.png (`docs/buildings.md`, the `buildings`
# skill), then the slalom's start house and the finish arena —
# previews/world-race-buildings.png, then the wind tunnels' fan house,
# gallery and exit portal — previews/world-free-tunnels.png, then the ski
# area's village and mountain buildings — previews/world-free-village.png
# (and village-plaza, village-lift), and its streets — village-air (the
# plan from the air), village-street (down the main street at eye
# height), village-square and village-back; then every building's SOLID
# drawn over it and the skier skied into a wall — previews/world-free-walls.png
# (`walls-view.ts`). ARGS=--hour=21 shows the
# panes and the street lamps lit after dark.
buildings:
	npm run world -- --free --views=stations $(if $(SEED),--seed $(SEED),) $(if $(REGION),--region $(REGION),) $(ARGS)
	npm run world -- --slalom --hour=12 --views=race-buildings $(if $(SEED),--seed $(SEED),) $(if $(REGION),--region $(REGION),) $(ARGS)
	npm run world -- --free --views=tunnels $(if $(SEED),--seed $(SEED),) $(if $(REGION),--region $(REGION),) $(ARGS)
	npm run world -- --free --views=village-plaza,village-lift,village,village-air,village-street,village-square,village-back $(if $(SEED),--seed $(SEED),) $(if $(REGION),--region $(REGION),) $(ARGS)
	npm run world -- --free --views=walls $(if $(SEED),--seed $(SEED),) $(if $(REGION),--region $(REGION),) $(ARGS)

# THE ROOMS LAB: the furnished ground floor of every kind of building
# (`interior-build.ts`, `interior-layouts.ts`, `interior-pieces.ts`) through
# the game's own renderer, the lens stood inside — previews/world-free-interiors.png
# (every kind from its door, a front corner and the back) and
# room-<kind> / room-<kind>-door one close. ARGS=--hour=21 the lamps after
# dark; `make world ARGS="--free --views=room-shop"` one room.
interiors:
	npm run world -- --free --views=room-restaurant,room-shop,room-mountainHut,room-house,interiors $(if $(SEED),--seed $(SEED),) $(if $(REGION),--region $(REGION),) $(ARGS)

# THE LIFTS LAB: the lifts' hardware as drawn (`lifts.ts`, `lift-shapes.ts`,
# `docs/lifts.md`) through the game's own renderer — a chair's tower from
# three sides and at chase range, a gondola's and a drag's tower, a chair
# from three sides, a gondola cabin from two, a T-bar, the lines from a
# skier's eye and a bullwheel — previews/world-free-lifts.png by day and
# previews/world-free-h21-lifts.png after dark, then one part a frame
# (world-free-lift-tower/-chair/-cabin/-tbar.png).
lifts:
	npm run world -- --free --hour=11 --views=lift-tower,lift-chair,lift-cabin,lift-tbar,lifts $(if $(SEED),--seed $(SEED),) $(if $(REGION),--region $(REGION),) $(ARGS)
	npm run world -- --free --hour=21 --views=lifts --skip-build $(if $(SEED),--seed $(SEED),) $(if $(REGION),--region $(REGION),) $(ARGS)
	npm run world -- --free --hour=11 --views=lift-turns --width 1920 --height 1080 --skip-build $(if $(SEED),--seed $(SEED),) $(if $(REGION),--region $(REGION),) $(ARGS)

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

# THE REVERT LAB: a skier riding switch slowed under 15 km/h turning round
# to ride forward (`engine/game/switch.ts`), on the skier lab — the revert
# as he slides out of it, the same with the edge held, hopped round off a
# jump under 40 km/h, and what follows it
# (the poles and the skate) frame by frame from behind, the side, the front,
# straight down and the chase lens (previews/skier-revert*.png), where it
# takes him (previews/skier-path-revert*.png) and close up at its moments
# (previews/skier-closeup.png). ARGS as the skier lab's.
revert:
	npm run skier -- --move revert,revert-steer,revert-hop,revert-away --sheet moves,path,closeup --moment switch,revert-in,revert-mid,revert-hop,revert-out --views back,side,front,top,chase $(ARGS)

# THE HOP INTO SWITCH LAB: a skier riding forward who loads a jump with the
# edge held, winds up against it, pops and is hopped half round in the air
# off it to land riding switch (`engine/game/switch.ts`'s `hopSwitch`), on
# the skier lab — to the right, to the left, off a quick tap, the edge
# pressed just after the pop, and riding switch away after it — frame by frame from behind, the side, the front,
# straight down and the chase lens (previews/skier-hop-switch*.png), where
# it takes him (previews/skier-path-hop-switch*.png) and close up at its
# moments (previews/skier-closeup.png). ARGS as the skier lab's.
hop-switch:
	npm run skier -- --move hop-switch,hop-switch-left,hop-switch-tap,hop-switch-late,hop-switch-away --sheet moves,path,closeup --moment hop-wind,hop-lead,hop-half,hop-landed --views back,side,front,top,chase $(ARGS)

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

# THE SKATE CLIMB LAB: how a skater's stride changes up a rise — off a
# crawl with the tuck held up each grade, his speed, the hill's pull,
# strides a second, metres a stride and the push's and poles' shares of
# it; then the climb's moves photographed over the same two seconds on
# the flat and up 8, 16 and 24 % (previews/skier-climb-*.png).
# ARGS=--no-shots the table alone; ARGS="--json=a.json" / "--compare=a.json"
# before and after.
skate-climb:
	npm run skate-climb -- $(ARGS)

sidestep:
	npm run sidestep -- $(ARGS)

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
# enlarged (damage-plate.png), every bone fractured at one energy a column
# from a hairline to shattered (damage-force.png, and up close in
# damage-closeup.png), the bones' snap frame by frame (damage-snap.png),
# and HIGH-G CRASHES skied through the engine — a
# trunk head-on and on the shoulder at rising speeds, falls from rising
# heights — each with the energy behind every fracture (damage-blows.png);
# ARGS="--refs=DIR" lays local references under it (damage-refs.png). Its
# own one-off bundle; needs a Chromium.
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

# THE GLOVE METRICS LAB: is every glove a real glove's size on the hand in
# it? Each glove cut on the loom in pure Node and measured in the fist's own
# frame (the knuckles' girth, breadth and thickness, the fingers, the middle
# finger's length round the grip, the thumb, the wrist, the cuff's mouth,
# flare and length) against bands off a real hand's survey and real gloves,
# and every jacket's sleeve at every build checked for a point poking out
# through the cuff (GLOVES=gauntlet,race, BODY=man, ARGS=--profile the
# girth every centimetre, ARGS=--where each poke, ARGS="--json=a.json" /
# "--compare=a.json").
glove-metrics:
	npm run glove-metrics -- $(if $(GLOVES),--gloves $(GLOVES),) $(if $(BODY),--body $(BODY),) $(ARGS)

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

# THE AIR-LEAN LAB: the body in the air with the lean held FORWARD — a
# kicker flown fully and half forward, a cliff dropped forward, the kicker
# unleaned and leaned back as controls — skied by the engine in pure Node,
# each candidate shape of `skier-flight.ts`'s `AIR_FORE` measured side on
# in the world against a skier's bands and drawn as stick figures
# (previews/air-lean.png). ARGS="--json=a.json" / "--compare=a.json" a
# before and after; ARGS=--search walks the knobs to the best score.
air-lean:
	npm run air-lean -- $(ARGS)

# THE BOARD LAB: the snowboard as the game draws it (`board-body.ts`) — the
# deck's top, base and profile and bowed by a carve, the deck dressed with
# its strap bindings and soft boots from four sides and at chase range, a
# binding alone and a boot in it from four sides — one contact sheet,
# previews/board.png, and the triangles. Its own one-off bundle from
# pwa/board-preview.html; needs a Chromium like `world`. The rider on it
# is the skier lab's: `make skier ARGS=--skis=lynx`. ARGS=--board=<id> another
# board; ARGS=--sheet=range every board a row at one scale
# (previews/board-range.png).
board:
	npm run board -- $(ARGS)

# THE BOARD METRICS LAB: is the snowboarder's pose a real rider's? The
# skier lab's board moments ridden by the engine in pure Node and the pose
# (`board-pose.ts`) measured — the knees, the hips and shoulders against
# the board, the head against his travel, the low carve's hand over the
# snow, the hips over the working edge — against bands off the research.
# Seconds, no browser. ARGS="--moment=toe,heel"; ARGS="--json=a.json" /
# "--compare=a.json" a before and after.
board-metrics:
	npm run board-metrics -- $(ARGS)

# THE BOARD MOTION LAB: the snowboarder's pose as MOTION — each board move
# ridden by the engine in pure Node and the pose plotted over its whole time
# (the knees, the hips and the shoulders against the board, the head's yaw
# off his travel, the shins against the snow) against the metrics' bands:
# previews/board-motion.png and a table of each move's frames out of band.
# ARGS="--move=skate,toe"; "--json=a.json" / "--compare=a.json" a before and
# after; "--film" the moves' filmstrips too (chase and side, the skier lab).
board-motion:
	npm run board-motion -- $(ARGS)

# THE JOLT LAB: every animated figure the game draws driven through its
# moves in pure Node (the player on skis and on a board, the lifts and the
# machines, the crowd, the people on foot, the wildlife) and each joint's
# jolt read frame by frame — the worst joint a scene, the snaps and the
# POPS (a joint flung out of line and back). previews/jolt.png and a table;
# ARGS="--family=skier --move=turns", "--trace=3.8,3.95 --joint=hand_r.tip",
# "--json=a.json" / "--compare=a.json".
jolt:
	npm run jolt -- $(ARGS)

# THE SAG LAB: the body PULLED DOWN onto his legs — landings, a pitch run
# out onto the flat, a stop down a pitch, rollers, a tuck, and generated
# maps skied fast by the bot — posed with the legs' spring and again
# without it, so what the spring adds to his forward lean is read apart
# (the fold's share and the held pitch's), against bands: never bowed past
# level with the slope, the trunk following the shins, the weight over the
# boots. A table and previews/sag.png (the worst frame of each, and its
# trace). Seconds, no browser. MOMENT=drop-1,runout a subset; SEED=7,38
# the maps; ARGS="--worst" the worst frames; ARGS="--json=a.json" /
# "--compare=a.json" a before and after.
sag:
	npm run sag -- $(if $(MOMENT),--moment $(MOMENT),) $(if $(SEED),--seed $(SEED),) $(ARGS)

# THE INJURY LAB: does a moment hurt a skier the way it hurts a body? Every
# scenario in tests/support/injury-scenarios.ts stages him at the moment
# before a blow — thrown and posed (head first, on his back, a side, his
# hands, a shoulder, his seat, feet first) into the snow by its kind
# (powder, soft, the groomer, ice), a trunk, a lift tower's steel or its
# pad, a cabin's log wall; or on his skis off a cliff, in the back seat,
# over the tips, an edge caught, into a solid — and draws it many times,
# each row's rates against what it expects (a broken neck, the legs, the
# spine shattered, the kidneys torn, the brain…) and what it must never do.
# Pure Node, seconds; exits non-zero on a miss. ARGS="--only=head-ice",
# "--list" every rate, "--json" a baseline, "--compare previews/injuries.json".
injuries:
	npm run injuries -- $(ARGS)

# THE LANDING LAB: does he ride away the landings the mountain hands him?
# Generated mountains skied the way a player does — down the piste and
# across the open face at a run's speed, the tuck HELD over every crest and
# the jump sprung off the slope on half the runs — every landing a row (its
# load in g, its equivalent fall height, how far off true, the tips into the
# slope) and the share that threw him, by how hard. Pure Node, a few
# minutes. ARGS="--seeds 16", "--json" a baseline, "--compare FILE" beside
# it, "--list" every fall with a --trace line to ski it step by step.
# ARGS=--lean=-1 holds the lean forward in the air (a player MEANING to land
# on his tips); ARGS=--attitudes the sweep of drops set down off true —
# tips, tails, rolled, sideways — each cell ridden away or what threw him.
landing:
	npm run landing -- $(ARGS)

# THE LEAN LAB: how SMOOTHLY the slalom racer leans from turn to turn. A
# slalom skied by the bot and staged rhythms of turns on the open pitch,
# every frame drawn as the renderer draws it (the run clock at --fps, the
# body between two steps, the legs' spring, the pair on the snow, the pose
# in the world) and read as leans layer by layer — the engine's, the
# spring's, the drawn legs', trunk's and head's — for how far each swings,
# how much it shivers, how rough it is above 5 Hz, its bumps a turn and its
# lag. A table and previews/lean.png (each run's worst frame from behind
# and its trace) and previews/lean-<row>.png (strips, a strobe, phase
# portraits). Seconds, no browser. ROW=course,rhythm a subset; SEED=38,7
# the maps; ARGS="--without=chatter" / "--ease=roll" / "--inputs" to find
# a roughness's source; ARGS="--json=a.json" / "--compare=a.json" a before
# and after.
lean:
	npm run lean -- $(if $(ROW),--row $(ROW),) $(if $(SEED),--seed $(SEED),) $(ARGS)

# THE BLENDER LAB: a game asset MODELLED in Blender off the game's own data
# (a pair: its spec and its class's traced look) — studio renders, the
# game-budget glTF with two LODs and the .blend files, in previews/blender/.
# Nothing is committed; `make skis ARGS=--asset=previews/blender/chamois-lod0.glb`
# sets a model beside the builder's. Needs Blender (BLENDER= its executable).
# KIND=skis, ID=eagle picks the asset; ARGS="--quality=game --views=three".
blender:
	npm run blender -- $(if $(KIND),--kind $(KIND),) $(if $(ID),--id $(ID),) $(ARGS)

# The models the game ships: every pair of skis, the heli-ski helicopter
# and its air ambulance,
# the mountain snowmobile, the night's piste machine and the jump plane, game quality (no
# stills), made by Blender and published into
# the COMMITTED pwa/models/ with a stamp of their sources a kind —
# tests/models_test.ts fails when a model is older than what it is made
# from. KIND=skis, KIND=heli, KIND=rescue (the air ambulance), KIND=sled, KIND=groomer or KIND=plane makes and publishes that kind alone. Needs
# Blender (or the bpy module: scripts/bpy-blender.sh). A build draws them
# unless switched back (VITE_MODEL_SKIS=0, VITE_MODEL_HELI=0,
# VITE_MODEL_SLED=0, VITE_MODEL_GROOMER=0, VITE_MODEL_PLANE=0). The skier
# (dressed in code, `make gear`), the trees, the wildlife and the course's
# marks are built in code and have no models; `make blender KIND=skier`
# still models the skier for the labs.
models:
	$(if $(filter all skis,$(or $(KIND),all)),npm run blender -- --kind skis --id all --quality=game --views=none,)
	$(if $(filter all heli,$(or $(KIND),all)),npm run blender -- --kind heli --quality=game --views=none,)
	$(if $(filter all rescue,$(or $(KIND),all)),npm run blender -- --kind rescue --quality=game --views=none,)
	$(if $(filter all sled,$(or $(KIND),all)),npm run blender -- --kind sled --quality=game --views=none,)
	$(if $(filter all groomer,$(or $(KIND),all)),npm run blender -- --kind groomer --quality=game --views=none,)
	$(if $(filter all plane,$(or $(KIND),all)),npm run blender -- --kind plane --quality=game --views=none,)
	node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/models.mjs --kind $(or $(KIND),all)

# The title scene's plates: the game's key art, path-traced in Blender
# (`scripts/blender/title.py` over `kinds/title.mjs`, which writes the game's
# own dressed skier into previews/blender/ — `scripts/dressed-skier.mjs`, the
# player's DEFAULT_OUTFIT off the game's loom — for the scene to pose) and
# published into the COMMITTED pwa/src/title/ with a
# stamp of their sources (tests/title_scene_test.ts holds it). A full
# render is a long one (an hour and more on a CPU); a draft is
# `TITLE_SIZE=768 make blender KIND=title ARGS=--samples=32`.
#   make title-scene                      the plates, 256 samples
#   make title-scene SAMPLES=128          fewer samples
title-scene:
	npm run blender -- --kind title --quality=render --samples=$(or $(SAMPLES),256)
	node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/title-plates.mjs

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

# THE SKY LAB: the sky over one seed from one place through the game's own
# renderer, as a labelled contact sheet, every cell measured (the zenith's
# and horizon's luminance and colour temperature, the sun's, the drawn sky,
# the lit and shaded snow and their ratio, the frame's ms). Three sheets:
# every weather (R19) against every three hours (previews/sky-<seed>.png);
# ARGS=--sheet=timelapse one weather swept from before sunrise into the
# night every --step game minutes (-timelapse[-<view>].png); and
# ARGS=--sheet=tiers every picture preset at dawn, noon, sunset and night.
# Its own one-off bundle from pwa/sky-preview.html (never deployed); needs a
# Chromium like `world`. SEED=n picks the map (its day and latitude are
# kept); ARGS="--hours=6,12,18 --view=vista|sunset|sunrise|antisun
# --weathers=overcast,fog" narrows it; --json=FILE before a change,
# --compare=FILE after.
sky:
	npm run sky -- $(if $(SEED),--seed $(SEED),) $(ARGS)

# THE SUN AND MOON LAB: the game's sun and moon (`sunAtRun`, `moonAtRun`)
# held against a reference (the NOAA arithmetic after Meeus with
# refraction; the almanacs' low-precision moon) at the real faces' own
# latitudes and longitudes and the generated bands' edges, through the
# season — the declination, the elevation and azimuth over the day, the
# sunrise, the day length, civil and nautical twilight, the equation of
# time and the moon. Pure Node, seconds. ARGS=--json=FILE before,
# --compare=FILE after.
sky-solar:
	npm run sky-solar -- $(ARGS)

# THE SKY TABLE: the physical atmosphere (atmosphere-model.ts, Hillaire's
# model over fresh snow) evaluated offline into the table every SkyLook
# reads (pwa/src/game/sky-table.ts, GENERATED): the sky's radiance by the
# azimuth from the sun and the view's elevation, the sun's transmittance
# and the sky's irradiance harmonics, by the sun's elevation and the lens's
# altitude. Pure Node, seconds. Prints the summary; ARGS=--write rewrites
# the table (after a change to the model, its constants or the layout).
sky-table:
	npm run sky-table -- $(ARGS)

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

# THE SHIMMER LAB: how much of the far mountain FLICKERS as the lens moves —
# a lens slid a few centimetres a frame across the rockiest face (or, with
# --along, toward it) from several ranges, every frame read back and each
# pixel's mean second difference of brightness taken, with the share of the
# crags the snow blinks over, as a contact sheet
# (previews/shimmer-<seed>-<grade>.png: each first frame, its heat map and
# its crags) and a table. Its own one-off bundle from
# pwa/shimmer-preview.html (never deployed); needs a Chromium like `world`.
# SEED=n; ARGS="--face=alpine-1 --along --step=0.5 --frames=16 --json".
shimmer:
	npm run shimmer -- $(if $(SEED),--seed $(SEED),) $(ARGS)

# THE ALOFT LAB: what a lens high over the snow sees at each DISTANCE stop
# (`view-aloft.ts`: the reach growing with the height, the ground's fine
# levels left out under it, the woods cut by their slant distance), as a
# grid — a row a height over the snow, a column a stop — each frame
# captioned with its draw calls, triangles, the ground's and the woods'
# triangles and the world phase's ms (previews/aloft-<seed>.png) and a
# table. Its own one-off bundle from pwa/aloft-preview.html (never
# deployed); needs a Chromium like `world`. SEED=n;
# ARGS="--heights=2,300,1500 --distances=low,max --json=FILE --compare=FILE".
aloft:
	npm run aloft -- $(if $(SEED),--seed $(SEED),) $(ARGS)

# THE CLOUD METRICS LAB: how MUCH snow cloud a skier raises — each kind of
# snow × move × speed skied by the engine in pure Node and every frame read
# as snow-cloud.ts reads it: the puffs a second, the cloud alive behind him
# (its opacity-weighted area, against his own silhouette), how high, how
# long. Whether the cloud grows with speed, and by how much a change moved
# it. Seconds, no browser. ARGS="--snow=new --moves=check,stop
# --speeds=10,20,40"; ARGS="--json=a.json" / "--compare=a.json".
cloud-metrics:
	npm run cloud-metrics -- $(ARGS)

# THE SPRAY METRICS LAB: how much SNOW a turn throws, how fast, how high,
# how far and which way — a pair of skis and a board × a kind of snow × a
# move (straight, carve, skid, check, stop) × a speed, skied by the engine in
# pure Node and every frame flown through the game's own spray pool
# (spray-sim.ts). Seconds, no browser. ARGS="--skis=lynx --moves=stop
# --speeds=20,40,60"; ARGS="--json=a.json" / "--compare=a.json".
spray-metrics:
	npm run spray-metrics -- $(ARGS)

# THE SPRAY EVAL: which way of flying the spray is best — the four models
# spray-sim.ts carries (puff, streak, drag, sheet) flown through the same
# carves, skids and stops on the groomer and in powder, each scored against
# what a real turn throws (which way, how fast, how high and far, how a
# carve's compares with a skid's, how the fines hang, how thin the curtain,
# how a grain is drawn, the cost) — and the game's model through a stop on
# every age of snow at three depths. Pure Node, seconds.
# ARGS="--models=drag,sheet", "--detail=sheet" (run by run), "--ages".
spray-eval:
	npm run spray-eval -- $(ARGS)

# THE SPRAY LAB: the snow a turn throws off the skis AND off a board, as the
# game draws it — the turns lab (below) ridden on the Chamois and the Lynx
# through linked carves, a skidded turn and a hockey stop, from a lens close
# in front of the skis and from the chase lens, on the groomer and in the
# meadow's powder: previews/turns-<seed>[-lynx]-close.png and -chase.png
# (the meadow's written over the piste's — WHERE=meadow alone for those).
# SEED=n; WHERE=piste|meadow; ARGS="--speeds=30,60 --times=0.5,1";
# ARGS="--spray=puff" another model, "--age=wet" a snow age, "--depth=2".
spray:
	for pair in chamois lynx; do npm run turns -- --skis=$$pair --where=$(or $(WHERE),piste) --moves=carve,skid,stop --speeds=45 --times=0.6,1,1.4 --views=close,chase --width=480 --height=320 $(if $(SEED),--seed $(SEED),) $(ARGS) || exit 1; done

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

# THE SNOW LAB: the snow as skis and a board work it, through the game's
# own renderer — a carve on the groomer, a hockey stop on skis, a board's
# heel and toe stops, a powder turn, a fall's crater and the track from the
# chase lens, under the day's sun and a low one — with the deformable snow
# (deform-snow.ts) on and off: previews/snowlab-<seed>-on.png and -off.png.
# ARGS=--perf times a frame at each preset, on and off. Its own one-off
# bundle from pwa/snowlab-preview.html; needs a Chromium like `world`.
# SEED=n; ARGS="--scenes=stop,powder --suns=26".
snowlab:
	npm run snowlab -- $(if $(SEED),--seed $(SEED),) $(ARGS)

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

# THE CIVILIANS LAB: the free ride's people on foot — every body at every
# pose its figure is morphed between (figures), each activity strobed as the
# view blends it (moves), the things they hold and the deck chairs and
# snowmen with the heads, the staff and the cuts (props), and SEED's ski area
# through the game's renderer (resort: lift, terrace, yard, base, walker,
# cocoa, kids, overview; terrace and base again at hour 21) —
# previews/civilians/*.png. Its own one-off bundle from
# pwa/civilians-preview.html (never deployed); needs a Chromium like `world`.
# SEED=n; ARGS="--sheet=resort --views=terrace --night="; ARGS=--tag=round1.
civilians:
	npm run civilians -- $(if $(SEED),--seed $(SEED),) $(ARGS)

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

# THE CABLE GRIND: a free ride dropped onto a lift's rope and ridden on a
# script (the slide, a press, a pop and a spin back onto it, a carrier
# throwing him off) through the game's own renderer, a row a lens, as one
# sheet, previews/grind-<lift>-<seed>.png (`ARGS=--skis=lynx` on a board,
# `--lift=drag|gondola`). Its own bundle from pwa/grind-preview.html; needs
# a Chromium (CHROMIUM_PATH).
grind:
	npm run grind -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE GETTING ON AND OFF LAB, as filmed: every way on and off a lift — a
# chair's load and unload, a T-bar's pick-up and release, a gondola's
# step-in and step-out (`pwa/src/tools/lift-stage.ts`) — ridden on the real
# engine through the game's renderer and photographed frame by frame, a
# row a lens (the lift line's flanks, from down the line, the game's own
# chase), one sheet a stage, previews/lift-strip-<stage>-<seed>.png. The
# lift-ride lab's bundle; needs a Chromium. STAGE=chair-load,…|all
# SEED=n REGION=id; ARGS="--views=side,back,top,chase --frames=14".
lift-board:
	npm run lift-ride -- --strip=$(if $(STAGE),$(STAGE),all) $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE GETTING ON AND OFF LAB, numbered (pure Node, seconds): each stage
# ridden on the engine and posed at 60 fps as the view poses him, and the
# hand-overs measured — the origin's fastest move, a joint's pop, the
# heading's swivel, the boots' sink and float, the seconds faded black and
# how long each part takes against the research's bands — with a strobe
# from above and the side and its traces, previews/lift-flow.png.
# STAGE= SEED= REGION=; ARGS="--json=previews/lift-flow-before.json" before
# a change and ARGS="--compare=previews/lift-flow-before.json" after;
# ARGS="--list" names each worst frame, "--dump=t0,t1 --joint=handsL" walks it.
lift-flow:
	npm run lift-flow -- $(if $(STAGE),--stage=$(STAGE),) $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE LIFT PATH LAB (pure Node, seconds): a gondola's rider traced in plan
# through both stations — every approach to the foot station's door, the
# platform, his cabin and the walk out at the top — with the houses, the
# rail, his cabin's box and his skis drawn every quarter second, and the
# seconds anything of him shows through a wall, previews/lift-path.png.
# SEED= REGION=; ARGS="--json=previews/lift-path-before.json" before a
# change and ARGS="--compare=previews/lift-path-before.json" after;
# ARGS="--list" names every frame through a wall.
lift-path:
	npm run lift-path -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

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

# THE SNOWMOBILE LANDING LAB: every staged ride of
# tests/support/sled-landings.ts — rollers, whoops, hard turns, a sidehill,
# kickers onto the flat and onto a landing, the nose dropped or thrown back
# in the air, a lip banked hard, drops, a cliff, a bank and a wall — ridden
# by the real engine, one row a ride: thrown or ridden out against what a
# rider expects, the flight, the landing's speed into the snow, the roll
# and pitch. Pure Node, seconds; exits non-zero on a row that is not as
# expected. ARGS="--json=a.json" before, "--compare=a.json" after.
sled-land:
	npm run sled-land -- $(ARGS)

# THE SNOWMOBILE TURN LAB: every turn of tests/support/sled-turns.ts — the
# sled at full lock on the flat at a crawl, 25, 40 and 60 km/h, on the
# groomer and in powder — ridden by the real engine, one row a turn: the
# circle it settles on against the band a rider expects, the sideways pull,
# the time to turn 90°, the roll. Pure Node, seconds; exits non-zero on a
# row outside its band. ARGS="--json=a.json" before, "--compare=a.json"
# after; ARGS=--left the other way round.
sled-turn:
	npm run sled-turn -- $(ARGS)

# THE SNOWMOBILE ROLLOVER LAB: every ride of tests/support/sled-tips.ts —
# full lock held, flicked, a slalom of locks and full throttle at full lock
# on the flat, and a traverse into or off a 20° and a 30° face — on the
# groomer and in powder from a thin cover to bottomless, a crawl to 80 km/h,
# ridden by the real engine: one row a ride, thrown or not against what a
# rider expects, the most it rolled, the way on. Pure Node; exits non-zero
# on a row that is not as expected. ARGS="--json=a.json" before,
# "--compare=a.json" after; ARGS=--surface=deep one snow.
sled-tip:
	npm run sled-tip -- $(ARGS)

# THE AVALANCHE LAB: slabs let go on the bench's lee slope (a loaded 38°
# powder face onto a flat run-out, tests/support/avalanche-scenes.ts) and
# stepped by the real engine (avalanche.ts): every release's size, the
# flow's speed over time, its run-out and what a step of it costs; a skier
# on each line through it (out ahead, out of the flank, slow, stopped, in
# its path, beside it) — escaped, caught, buried how deep; and how far a
# traverse of the loaded face goes before it lets go. Pure Node; exits
# non-zero on a line that is not as expected. ARGS="--json=a.json" before,
# "--compare=a.json" after; ARGS="--wind=6 --fall=0" another day.
avalanche-flow:
	npm run avalanche-flow -- $(ARGS)

# THE AVALANCHE AS DRAWN: a slab let go on a generated free ride's loaded
# lee face and photographed through the game's own renderer (avalanche-
# view.ts, avalanche-glsl.ts) — the crown cracking and the slab breaking
# into blocks (release), the front and its powder cloud from beside and
# below (flow), the deposit and the bed (debris), a skier crossing it when
# it goes (caught) and the flow and debris under the headlamp (night). One
# contact sheet a group, previews/avalanche-<group>.png, every frame alone,
# and what each frame cost (ms, draw calls, triangles). Its own one-off
# bundle from pwa/avalanche-preview.html (never deployed); needs a Chromium.
# SEED=, REGION=, SNOW= (the dial) and ARGS= (--sheet=flow, --at=x,z).
avalanche:
	npm run avalanche -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(if $(SNOW),--snow=$(SNOW),) $(ARGS)

# THE PARAMOTOR LAB: the free ride's paramotor staged at every moment it has
# — on the summit under the held wing, the launch, in the air, a turn and
# the brakes, the landing and speed riding, the rig dropped and lying on the
# snow, the gear close up, eight sides, every camera rung, after dark —
# through the game's own renderer. One contact sheet a group,
# previews/para-<group>.png, and every frame alone,
# previews/para-<view>-<label>.png. Its own one-off bundle from
# pwa/para-preview.html (never deployed); needs a Chromium like `world`.
# ARGS="--sheet=flight,gear" a few sheets, "--views=turntable" a few views.
para:
	npm run para -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE PARAMOTOR'S WIND LAB: what the weather does to a flight under the
# powered wing — each of R19's weathers and a sweep of the wind down the
# face and across it, flown on the bot's hands in pure Node: the wind at the
# wing, ridge lift and the lee's sink, the turbulence, the folds, the stall,
# the share flown backwards, the lowest height and how it ended.
# ARGS="--json=previews/para-wind-before.json" before a change,
# "--compare=previews/para-wind-before.json" after; "--rows=storm,down-9".
para-wind:
	npm run para-wind -- $(if $(SEED),--seed=$(SEED),) $(ARGS)

# THE HOT AIR BALLOON'S FLIGHT LAB: scripted flights of the free ride's
# balloon in pure Node — the bot's hands holding a height, a hop off the
# tether, the valve held, the burner held till the fabric cooks, a jump over
# the side, a walk about the basket, a breeze and a gale: the top, the climb
# and the sink, the lag from a burn to a climb, the envelope's hottest, the
# propane burnt, the way carried up the mountain, the fire and the end.
# ARGS="--json=previews/balloon-before.json" before a change,
# "--compare=previews/balloon-before.json" after; "--rows=pilot,gale --trace=pilot".
balloon-flight:
	npm run balloon-flight -- $(if $(SEED),--seed=$(SEED),) $(ARGS)

# THE JUMP PLANE'S FLIGHT LAB: the take-off roll, the climb, the top speed
# low and high, the stall clean and with flaps and its recovery, a loop, a
# roll, the glide and the map's edge, each against the class's band, in
# pure Node (`scripts/plane-flight-lab.mjs`; ARGS=--json=FILE before,
# --compare=FILE after; SEED= flies the roll on a generated map's strip).
plane-flight:
	npm run plane-flight -- $(if $(SEED),--seed=$(SEED),) $(ARGS)

# THE AIRSTRIP LAB: where the jump plane's strip lies on each map, from the
# engine alone (`scripts/airstrip-lab.mjs`): the piste map round it, the
# room the search reads, the strip and its site, a picture a map, a sheet
# and a table. ARGS="--faces all" every real face, --seeds 1-8 generated.
airstrip:
	npm run airstrip -- $(if $(SEED),--seed=$(SEED),) $(ARGS)

# THE SKI JUMP'S FLIGHT LAB: the in-run's speed over the edge at every few
# gates, then jumps off the ski jumping hill (R43) jumped by the real engine —
# the take-off early, late and never, the wind along the hill, the lean, the
# assist off, the bot — and the hill's gate and wind factors beside its
# sheets, in pure Node (`scripts/skijump-flight-lab.mjs`; ARGS=--json=FILE
# before, --compare=FILE after; SEED= another map's hill).
skijump-flight:
	npm run skijump-flight -- $(if $(SEED),--seed=$(SEED),) $(ARGS)

# THE SKI JUMPING HILLS LAB: what the hill R43 cuts makes of a map — the
# earth it moves under the landing hill and the out-run, the in-run's deck
# over the ground and the cut under it, the ground beside the out-run for
# the stadium, the bot's jump — over a sweep of seeds and countries, or the
# committed hills audited against their digests, in pure Node
# (`scripts/skijump-hills-lab.mjs`; ARGS="--seeds=1-30 --regions=fell
# --hill=normal --bot", ARGS="--pinned --bot").
skijump-hills:
	npm run skijump-hills -- $(ARGS)

# THE JUMP PLANE LAB: the free ride's jump plane — the Blender model where
# the build packs it (`make models KIND=plane`), the code's stand-in where it
# does not — parked on its strip from eight sides by day and after dark, the
# take-off roll, in the air, its surfaces held over, the skier in its door,
# every camera rung, what the pilot's eye sees and the wreck, through the
# game's own renderer. One contact sheet a group, previews/plane-<group>.png,
# and every frame alone, previews/plane-<view>-<label>.png. Its own one-off
# bundle from pwa/plane-preview.html (never deployed); needs a Chromium like
# `world`. ARGS="--sheet=model,door" a few sheets.
plane:
	npm run plane -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE SKI JUMP LAB: the ski jumping hill (R43) as drawn and a jump off it,
# through the game's own renderer — the empty hill from the broadcast's
# side, the out-run, down the in-run, the judges' tower, the air and its
# silhouette, by day and at hour 21 (`hill`); the jumper on the bar, in the
# tracks and at the edge (`inrun`); in the air (`flight`); touching down
# among the distance boards and the K and HS lines (`landing`). One contact
# sheet a group, previews/skijump-<group>.png, and every frame alone,
# previews/skijump-<view>-<label>.png, each captioned with its draw calls
# and triangles. Its own one-off bundle from pwa/skijump-preview.html (never
# deployed); needs a Chromium like `world`. ARGS="--sheet=hill,landing",
# "--hill=normal".
skijump:
	npm run skijump -- $(if $(SEED),--seed=$(SEED),) $(ARGS)

# THE SKYDIVE'S FLIGHT LAB: the exit, the freefall's terminal speeds, the
# staged opening, the canopy's polar, turns and flare, the landing, the
# cut-away, the snags and the map's edge, beside the class's bands — pure
# Node (`scripts/skydive-flight-lab.mjs`; ARGS=--json=FILE before,
# --compare=FILE after; SEED= the whole jump and the lift snag's map).
skydive-flight:
	npm run skydive-flight -- $(if $(SEED),--seed=$(SEED),) $(ARGS)

# THE WINGSUIT'S FLIGHT LAB: the glide, the dive, the flare, the short
# period and the phugoid, the turn, the exit off the mountain and out of the
# plane's door, the pull and the BASE canopy, the landing on his boots, the
# map's edge and the bot's whole flight, beside the class's bands — pure
# Node (`scripts/wingsuit-flight-lab.mjs`; ARGS=--json=FILE before,
# --compare=FILE after; SEED= the exit's and the whole flight's map).
wingsuit-flight:
	npm run wingsuit-flight -- $(if $(SEED),--seed=$(SEED),) $(ARGS)

# THE SKYDIVE LAB: the free ride's skydive through the game's own renderer —
# the harness-container on him, poised in the plane's door and the exit
# frame by frame, belly to earth, the turns, the track and head down, the
# opening frame by frame (the pull, the pilot chute, the bag, line stretch,
# the snivel, the slider down, full), the canopy flown, its toggles, risers
# and flare and the landing, the cut-away and the canopy on the snow, caught
# in a crown and on a lift's rope, every camera rung and after dark. One
# contact sheet a group, previews/skydive-<group>.png, and every frame
# alone, previews/skydive-<view>-<label>.png. Its own one-off bundle from
# pwa/skydive-preview.html (never deployed); needs a Chromium like `world`.
# ARGS="--sheet=deploy,canopy" a few sheets.
skydive:
	npm run skydive -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE EXIT CUT LAB: the leap out of the jump plane, off the helicopter's skid
# and over the balloon's rim shot as a film (`camera-exit.ts`) and handed back
# to the game's lens — filmed through the game's own renderer at the app's
# slowed pace, a filmstrip a craft a screen (desktop and a phone held
# upright), previews/exit-<craft>-<screen>.png; ARGS=--video a clip each
# (ffmpeg), --craft=heli --screen=phone some, --rung=helmet another rung.
# Its own one-off bundle from pwa/exit-preview.html; needs a Chromium.
exit-cam:
	npm run exit-cam -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE WINGSUIT LAB: the free ride's wingsuit through the game's own renderer
# — the suit round a turntable flying and stood slack, the bot's ride frame
# by frame (the exit off a ledge or a hovering helicopter's skid, the suit
# pressurising, the glide, the pull, the BASE canopy and its arm wings
# unzipped, the flare, landed and walking), the turns, the dive and the
# flare, every camera rung and after dark. One contact sheet a group,
# previews/wingsuit-<group>.png, and every frame alone,
# previews/wingsuit-<view>-<label>.png. Its own one-off bundle from
# pwa/wingsuit-preview.html (never deployed); needs a Chromium like
# `world`. ARGS="--sheet=suit,poses" a few sheets.
wingsuit:
	npm run wingsuit -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE SPEED LAB (`camera-pace.ts`, the chase lenses' sense of speed): the
# same lens at several speeds, as screenshot sequences through the game's
# own renderer — the wingsuit's launch flown round behind him and its
# flare, glide and dive (previews/wingsuit-speed.png), the skydive's fall
# from the door's speed to terminal and its track (previews/skydive-
# speed.png), and the chase down a downhill and on a snowboard at four
# moments of a run (previews/world-downhill-chase-<s>.png, previews/
# world-lynx-chase-<s>.png). Run it before and after a change to how speed
# reads. SEED= another map.
speed-cam:
	npm run wingsuit -- $(if $(SEED),--seed=$(SEED),) --sheet=speed
	npm run skydive -- $(if $(SEED),--seed=$(SEED),) --sheet=speed
	npm run world -- $(if $(SEED),--seed $(SEED),) --downhill --views=chase-4,chase-10,chase-20,chase-35
	npm run world -- $(if $(SEED),--seed $(SEED),) --skis=lynx --views=chase-4,chase-10,chase-20

# THE BALLOON LAB: the free ride's hot air balloon staged at every moment it
# has — tethered on the valley floor, in flight over the mountain, the
# basket, burner and skirt close up, up into the mouth, the parachute
# pulled, leant over in the wind, after dark with the burner lit, burning,
# laid on the snow, every colourway, the walk, eight sides, over the side,
# every camera rung — and its fire: the burner lit and going out, the
# envelope catching in a gale, burning, falling and the wreck smouldering
# (`fire`, `catch`, `inferno`) — through the game's own renderer. One contact sheet a
# group, previews/balloon-<group>.png, and every frame alone,
# previews/balloon-<view>-<label>.png. Its own one-off bundle from
# pwa/balloon-preview.html (never deployed); needs a Chromium like `world`.
# ARGS="--sheet=tethered,basket" a few sheets, "--views=night" a few views.
balloon:
	npm run balloon -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE GRIMBEAR LAB: the free ride's grimbear staged at every moment he has —
# the figure from eight sides, his run and walk across one stride, each
# move, the ambush ridden, THE KILL frame by frame and as the death cam
# shows it, the chase that comes up short, after dark — through the game's
# own renderer. One contact sheet a group, previews/grimbear-<group>.png,
# and every frame alone, previews/grimbear-<view>-<label>.png. Its own
# one-off bundle from pwa/grimbear-preview.html (never deployed); needs a
# Chromium like `world`. ARGS="--sheet=kill,moves", "--views=stride".
grimbear:
	npm run grimbear -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE RESCUE LAB: the air ambulance on the run after an injured one
# (docs/rescue.md) — where it lands, the crew scooping him onto the
# stretcher frame by frame (--sheet=scoop) and lifting it, the carry stride by stride, the loading through the door, the
# lift-off and the wash, the next run skied past it, after dark — through
# the game's own renderer. One contact sheet a group, previews/rescue-<group>.png,
# and every frame alone. Its own one-off bundle from pwa/rescue-preview.html
# (never deployed); needs a Chromium like `world`. ARGS="--sheet=carry,load", "--at=0.6".
rescue:
	npm run rescue -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE GORE LAB: a body torn apart on a run with the INJURIES switch on —
# skied into a trunk, flown into one head first, thrown onto the snow, onto
# his feet, onto a tree's top or a post's, caught by the grimbear — frame by
# frame through the game's own renderer, with the blood spurting on the
# beat and the snow red under him. One contact sheet a group,
# previews/gore-<group>.png, and every frame alone. Its own one-off bundle
# from pwa/gore-preview.html (never deployed); needs a Chromium like
# `world`. ARGS="--sheet=trunk,blood", "--views=spray".
gore:
	npm run gore -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE BONES LAB: every long bone that can break out through the skin
# (`gore-bones.ts`), built by the game's own builder on a limb of the game's
# measure — a row a bone, a column a grade (simple, wedge, shattered) and
# the simple break from the side, above, behind and far — close, under a
# winter sun. previews/bones.png. Its own one-off bundle from
# pwa/bones-preview.html (never deployed); needs a Chromium like `world`.
# ARGS="--bones=humerusL,tibiaL". The bones on the skier are the gore
# lab's `--sheet=bones`.
bones:
	npm run bones -- $(ARGS)

# THE X-RAY LAB: a hard blow on a run with the INJURIES switch on, run the
# way the app runs it — the read ahead, the run slowed, the lens closing on
# the bone that breaks, the pans to the next one and the limb torn, the
# whole body and the death — photographed every half second of wall
# through the game's own renderer: previews/xray-<scene>.png. Its own
# one-off bundle from pwa/xray-preview.html; needs a Chromium like `world`.
# ARGS="--scene=trunk|trunk-fast|head|slam --most=14".
xray:
	npm run xray -- $(if $(SEED),--seed=$(SEED),) $(ARGS)

# THE X-RAY SKELETON: every bone and organ of BodyParts3D (fetched into
# the gitignored previews/.bodyparts3d/), thinned and fitted onto the
# skier's rig, drawn inside his dressed outline (previews/xray-body.png);
# ARGS=--write regenerates pwa/src/game/xray-model.ts.
xray-body:
	npm run xray-body -- $(ARGS)


# THE REPLAY CAMERA LAB: a run recorded as the app records one and watched
# back through its own transport on each rung of the watching ladder,
# photographed and measured against the skier:
# previews/replaycam-<scene>-<rung>.png. Its own one-off bundle from
# pwa/replaycam-preview.html; needs a Chromium like `world`.
replay-cam:
	npm run replay-cam -- $(if $(SEED),--seed=$(SEED),) $(ARGS)

# THE PISTE MACHINE LAB: the free ride's night groomers photographed
# through the game's own renderer — the figure from eight sides and up
# close, at work by day, at dusk, after dark with every lamp lit, in the
# fall and the storm, the corduroy from the skier's chase, driven on its
# own camera ladder, and skied into frame by frame. One contact sheet a
# group, previews/groomer-<group>.png, and every frame alone. Its own
# one-off bundle from pwa/groomer-preview.html (never deployed); needs a
# Chromium like `world`. ARGS="--sheet=night,snow", "--views=turntable".
groomer:
	npm run groomer -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE SNOW GUN LAB: a thin season's snow guns on a free ride through the
# game's own renderer — a fan gun on its carriage and on its column and a
# lance from a few metres, a running gun's cone side on and down its run,
# the whale it lays, the skier skiing past on the chase, and the plumes
# under the floodlights. One contact sheet a group, previews/snowguns-
# <group>.png, and every frame alone. Its own one-off bundle from
# pwa/snowguns-preview.html (never deployed); needs a Chromium like
# `world`. ARGS="--sheet=plume", "--day=70 --hour=8" (a late season).
snowguns:
	npm run snowguns -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE WATER LAB: the lakes and the streams through the game's own renderer,
# on a map with placeholder water laid on it — the valley lake and the tarn
# through the seasons, open water still and in a wind, the shore ice, black
# ice, scoured snow, rotten ice and its moat, the light, and the game's own
# views. One contact sheet a group, previews/water-<group>.png, and every
# frame alone. Its own one-off bundle from pwa/water-preview.html (never
# deployed); needs a Chromium like `world`. FACE=fell-1 a real face;
# ARGS="--sheet=states".
water:
	npm run water -- $(if $(SEED),--seed=$(SEED),) $(if $(FACE),--face=$(FACE),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE TREE WELL LAB: the hollows round the trunks in deep powder photographed
# through the game's own renderer — one well from every side and at the
# ordinary snow beside it (look), a skier sliding in and stuck (fall), and
# under the headlamp (night). One contact sheet a group,
# previews/tree-wells-<group>.png, and every frame alone. Its own one-off
# bundle from pwa/tree-wells-preview.html (never deployed); needs a Chromium.
# SEED=, REGION=, SNOW= (the dial) and ARGS= (--sheet=look, --views=below).
tree-wells:
	npm run tree-wells -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(if $(SNOW),--snow=$(SNOW),) $(ARGS)

# THE TRAILS LAB: the furrow a skier cuts in three depths of snow — the
# groomer's pencil lines, settled powder's trough and a metre of fresh's
# trench — each cut by the engine under the same scripted turns and
# photographed through the game's own renderer from below, from above and
# close (bands), under a low sun (low) and by the headlamp (night). One
# contact sheet a group, previews/trails-<group>.png, and every frame alone.
# Its own one-off bundle from pwa/trails-preview.html (never deployed);
# needs a Chromium. SEED=, REGION= and ARGS= (--sheet=bands, --low=16).
trails:
	npm run trails -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE PISTE THROUGH THE DAY LAB: one spot of a free ride's piste under a
# sky at the hours of a day — the night's corduroy at the first chair, the
# skied-up afternoon, a spring sun's slush and its evening freeze, and the
# new snow a snowing sky lays on it — through the game's own renderer. One
# contact sheet a sky, previews/piste-day-<sky>.png, and every frame alone.
# Its own one-off bundle from pwa/piste-day-preview.html (never deployed);
# needs a Chromium like `world`. ARGS="--sheet=clear --day=80",
# "--hours=8,12,16,19".
piste-day:
	npm run piste-day -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE SNOW LAB: one spot of a mountain's loose snow beside its piste at
# every age of the snow — the map's own, new, settled, old, wind-packed,
# sun-crusted, hoar and wet (snow-age.ts) — through the game's own renderer,
# from the same place under the same sun. One contact sheet a lens
# (down, sun — the glare — away, near, far), previews/snow-<lens>.png, and
# every frame alone. Its own one-off bundle from pwa/snow-preview.html (never
# deployed); needs a Chromium. ARGS="--sheet=sun --hour=15", "--weather=fair".
snow:
	npm run snow -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE SUMMER LAB: a free ride's mountain in midsummer (summer.ts, drawn by
# summer-glsl.ts and summer-grass.ts) through the game's own renderer at
# named views found off the summer ground — a meadow, a hand's breadth over
# it, a ski run, a vista, a lift line, the village, the turf above the tree
# line and a July snow patch — at two hours: previews/summer.png and every
# frame alone. Its own one-off bundle from pwa/summer-preview.html (never
# deployed); needs a Chromium. ARGS=--winter the same views in winter (the
# before), ARGS="--hours=12 --views=meadow,grass", REGION=fell.
summer:
	npm run summer -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE JUDDER LAB: how smoothly a free ride's machine (the snowmobile or the
# helicopter) and its rider are DRAWN from frame to frame — the bot rides
# it, the app's run clock is fed frames at each frame rate with a display's
# wobble, both bodies are drawn by the game's own interp.ts, and each frame
# is held to the engine's poses either side of it: the machine's error, the
# rider's slide off his place on it, the jump between frames. A row a frame
# rate and previews/judder-<machine>-<seed>.png. Pure Node, seconds.
# `make judder` · `make judder MACHINE=heli SEED=7` ·
# ARGS="--fps=60,45 --at=25"; ARGS="--json=a.json" / "--compare=a.json".
judder:
	npm run judder -- $(if $(SEED),--seed $(SEED),) $(if $(MACHINE),--machine $(MACHINE),) $(ARGS)

# THE MENU STALLS: how long the page's own thread is blocked on each card on
# the way onto the snow — the free ride's start card and a race's level
# card, then the rider and gear cards (on arriving, and under a finger
# turning the rider round) and RIDE's loading card — on a phone held on its
# side with its processor throttled. Drives the BUILT site, so `make build`
# first. ARGS="--flow=race", "--cpu=6", "--json=a.json" / "--compare=a.json"
# a before and after.
menu-stalls:
	node scripts/menu-stalls.mjs $(ARGS)

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

# THE CABIN LAB: every kind of log building the ski area keeps beside its
# runs and lanes (hut, cabin, chalet, woodshed) through the game's own
# procedural builder and material, terraced on a slope — front and back at
# three quarters, the side, from the snow, from above, the far cut and at
# night — previews/cabins.png, with each kind's triangles at both cuts. Its
# own one-off bundle from pwa/cabins-preview.html (never deployed); needs a
# Chromium like `world`. ARGS="--kinds=hut,shed" draws a subset. Where they
# STAND is `make resort`'s plan and `make world ARGS=--views=cabin,cabins-air`.
cabins:
	npm run cabins -- $(ARGS)

# THE AFTERSKI LAB: a free ride drawn through the game's own renderer at the
# afterski's moments — the lodges and their racks from the snow, the party
# inside (inside-<s>), the drunk picture through his own eyes at a ladder of
# buzz (eyes-<b>, chase-<b>), and a buzzed fall worked off on foot as a strip
# of frames (fetch-<s>) — each previews/afterski-<view>.png. Its own one-off
# bundle from pwa/afterski-preview.html (never deployed); needs a Chromium
# like `world`. SEED=n another map; ARGS="--views=inside-4,eyes-0.6".
afterski:
	npm run afterski -- --seed=$(or $(SEED),38) $(ARGS)

# THE TOWN LAB: a free ride skied into the village and the skis taken off
# (engine/game/town.ts) — the stop, out of the bindings (out), the pair up
# onto the shoulder (pick, pick-side), walking with it (carry, carry-side,
# carry-back, chase), off the shoulder and back in off the streets (drop,
# clip) — each previews/town-<sheet>.png. Its own one-off bundle from
# pwa/town-preview.html (never deployed); needs a Chromium like `world`.
# SEED=n another map; ARGS="--sheets=pick,carry --tile=360".
town:
	npm run town -- --seed=$(or $(SEED),38) $(ARGS)

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

# THE LIFT TOPS LAB: every run off every lift's top ridden by a skier who
# follows its sign — stood off the lift with nothing leading him, steered
# down the lane, for the ramp's head and down the ramp onto the run — one
# row a run: its ramp, how far under the top it starts, how far he ever
# climbed, whether he got there. Pure Node over the engine.
# `make lift-tops SEED=38` · `make lift-tops COUNT=12 REGION=fell` ·
# `make lift-tops SEED=2 REGION=maritime ARGS="--weather storm"`
lift-tops:
	npm run lift-tops -- $(if $(SEED),--seed $(SEED),) $(if $(COUNT),--count $(COUNT),) $(if $(REGION),--region $(REGION),) $(ARGS)

# THE CHALLENGES LAB: what a free ride map deals (the timed lines, the trick
# goals, the hidden spots, the summits) and every timed line skied by the
# bot, judged by the challenges' own judge — one row a line: its run and
# colour, length, drop, par, the three medal times, the bot's time and
# medal. The table the medals are calibrated by. Pure Node over the engine.
# `make challenges-table SEED=38` · `make challenges-table COUNT=8` ·
# `make challenges-table FACE=alpine-1` · `ARGS=--no-ski` the deal alone
challenges-table:
	npm run challenges-table -- $(if $(SEED),--seed $(SEED),) $(if $(COUNT),--count $(COUNT),) $(if $(REGION),--region $(REGION),) $(if $(FACE),--face $(FACE),) $(ARGS)

# THE JUNCTIONS LAB: where the groomed snow BREAKS — a lip, a step or a
# wall where a lane leaves a piste, a run merges into another, or anywhere
# on a run nothing was built to be jumped — read down the fall line on every
# packed metre, the kickers, drops and pads left out, one row a seed by
# kind. `--versions=7,8` builds the same seeds by an older generator beside
# the current one; `--sheet` draws the worst as relief. Pure Node.
# `make junctions SEED=3 REGION=continental ARGS=--list` ·
# `make junctions COUNT=10 ARGS="--versions=7,8 --sheet"`
junctions:
	npm run junctions -- $(if $(SEED),--seed $(SEED),) $(if $(COUNT),--count $(COUNT),) $(if $(REGION),--region $(REGION),) $(ARGS)

# THE BIKE PARK LAB (R44, R45): a summer ski area's bike park from the
# engine alone — the plan (every trail in its grade's colour, its features
# marked, the race line taped, the junctions), every trail's profile over
# the ground it is benched into, and a table a trail with the analyzer's
# findings, to previews/bike-park-<seed>*; COUNT sweeps, one row a seed.
# `make bike-park SEED=7` · `make bike-park COUNT=24` · `ARGS=--face=alpine-1`
bike-park:
	npm run bike-park -- $(if $(SEED),--seed $(SEED),) $(if $(COUNT),--count $(COUNT),) $(if $(REGION),--region $(REGION),) $(ARGS)

# THE BIKE PARK'S PICTURE LAB: a summer free ride's bike park through the
# game's own renderer at named views found off the park — a berm close, a
# tabletop from the side, a flow trail from above, a rock garden, a drop,
# the race line between its tapes, the trail heads on a lift's apron:
# previews/bike-look-<seed>.png and every frame alone. Its own one-off
# bundle from pwa/bike-park-preview.html; needs a Chromium.
# `make bike-look SEED=38` · `ARGS="--views=berm,table --face=continental-2"`
bike-look:
	npm run bike-look -- $(if $(SEED),--seed=$(SEED),) $(if $(REGION),--region=$(REGION),) $(ARGS)

# THE DOWNHILL BIKE'S PICTURE LAB: the summer free ride's bike and rider
# ridden by the bot through the game's own renderer — the camera ladder's
# rungs down a trail (chase, the bar-cam, his eyes, far), close beside and
# ahead of him, in the air, thrown in a crash with the bike loose, afoot,
# in a chair's load zone and up the lift: previews/bike-<seed>.png and
# every frame alone. Its own one-off bundle from pwa/bike-preview.html;
# needs a Chromium.
# `make bike` · `make bike SEED=7 ARGS="--views=chase,side --trail=B2"`
bike:
	npm run bike -- $(if $(SEED),--seed=$(SEED),) $(ARGS)

# THE DOWNHILL BIKE LAB: the bike (engine/game/bike*.ts) ridden by the real
# engine through every bench row tests/support/bike-rides.ts names — the
# sag, the coast on each ground, the pedals, the brakes and the endo, the
# lean and the turn, the weave and the capsize, the drops, the table landed,
# cased and overshot, roots, rocks, a berm and a hop — each against its band.
# ARGS=--bot also rides the bot down every trail of the seeds' parks (home,
# its falls a km inside its grade's band; a few minutes). Pure Node; exits
# non-zero on a row out of band. ARGS="--json=a.json" before,
# "--compare=a.json" after.
bike-ride:
	npm run bike-ride -- $(ARGS)

# THE BIKE AGAINST THE WORLD: the downhill bike ridden by the real engine
# into everything a summer mountain stands in its way, one row a meeting
# (tests/support/bike-hits.ts) — a 30 cm trunk head-on and glancing at 10,
# 20 and 35 km/h, a trunk beside a trail, a black's rock garden on the
# bot's line and coasted into, a lift's tower, a mast, a building's wall, a
# parked car, the race line's taped edge, a bench's cut and fill, a steep
# meadow, a pond — each read for the throw and its how, the closing speed,
# the peak g and the part, the injuries and their severity score, any solid
# stood inside, the bike frozen or not, and the restart; then the throws'
# injuries by region beside the bike-park surveys'. Pure Node; exits
# non-zero on a row at fault. ARGS="--json=a.json" before,
# "--compare=a.json" after; ARGS=--only=trunk,tower.
bike-hit:
	npm run bike-hit -- $(ARGS)

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
# population per axis; RACE=<discipline> audits that discipline's nine race
# maps (every map on its own version and held to its digest, the bot's time).
# `make rate` · `make rate COUNT=96 ARGS=--stats` · `make rate RACE=superG`
rate:
	npm run rate -- $(if $(SEED),--seed $(SEED),) $(if $(SEEDS),--seeds $(SEEDS),) $(if $(COUNT),--count $(COUNT),) $(if $(RACE),--race $(RACE),) $(ARGS)

# THE DIFFICULTY SCHEMATIC: one map from above with what makes it hard drawn
# over it — the corners, the climbs, the drifts, the walled woods — and the
# eight axes beside it, to previews/difficulty-<seed>.png. RACE=<discipline>
# draws one sheet per race map of that discipline.
# `make difficulty SEED=38` · `make difficulty RACE=downhill`
difficulty:
	npm run difficulty -- $(if $(SEED),--seed $(SEED),) $(if $(RACE),--race $(RACE),) $(ARGS)

# THE MAP ROUTES: every pinned map's loop written down as the line its box
# on the card draws (pwa/src/game/map-routes.ts, generated).
# `make routes` · `make routes ARGS=--check`
routes:
	npm run routes -- $(ARGS)

# THE REAL FACES: real mountainsides off the 30 m elevation model, cropped,
# smoothed and baked into engine/mapgen/real-faces/face-<id>.ts, a file a
# face, and the index beside them (generated; docs/real-faces.md). The tiles
# are fetched once into previews/.dem/. `--search` finds a new face's crop.
# `make real-faces ARGS="--fetch --search --only id"` · `ARGS="--only id --write"`
real-faces:
	npm run real-faces -- $(ARGS)

# THE FAR COUNTRY round each real face: the real ranges to 60 km off the
# 90 m elevation model, on the far ranges' polar layout, baked into
# pwa/src/game/far-faces/far-<id>.ts, a file a face (generated;
# docs/far-ranges.md). The tiles are fetched once into previews/.dem90/.
# `make far-faces ARGS=--fetch` · `ARGS="--only id --write"`
far-faces:
	npm run far-faces -- $(ARGS)

# The real faces' HINTS: the real ski area's lifts, pistes and houses on
# each face, read off OpenStreetMap and baked coarsely into
# engine/mapgen/real-hints/hints-<id>.ts and the index beside them
# (generated, ODbL; docs/real-faces.md). The map data is fetched once into
# previews/.osm/.
# `make real-hints ARGS="--fetch --only id"` · `ARGS="--only id --write"`
real-hints:
	npm run real-hints -- $(ARGS)

# THE WORLD MAP the free ride's WHERE steps are drawn over: Natural Earth's
# 1:50 m land, borders and lakes (public domain), simplified and baked into
# pwa/src/game/world-map-data.ts (generated). The layers are fetched once
# into previews/.ne/.
# `make world-map ARGS=--fetch` · `make world-map ARGS=--write`
world-map:
	npm run world-map -- $(ARGS)

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

# THE TITLE SCENE as the player meets it: the attract card and the scene
# under it FROZEN at title times (`?titleT=`), at the reference viewports,
# on the built site (`make build` first, every time). `ARGS=--menu` the
# front door over it at each time too; `--sheet` a contact sheet.
# `make title` · `make title ARGS="--times 2,8 --viewport desktop --menu"`
title:
	npm run title -- $(ARGS)

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

# WHAT THE PROCESSOR PAYS A FRAME, in plain Node — no build, no browser, no
# GPU: one engine step per mode, and the renderer's CPU work that needs no
# WebGL (the forest's refill, the lifts, the crowd, the riders' pose), each
# with a hash of what it filled so a speed-up is proved to change nothing.
# `make cpu-cost` · `make cpu-cost ARGS="--suite forest --json previews/cpu-before.json"`
cpu-cost:
	npm run cpu-cost -- $(ARGS)

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

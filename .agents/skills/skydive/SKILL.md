---
name: skydive
description: "Use when working on THE SKYDIVE — the free ride's jump out of the jump plane's open door: the exit into the slipstream and its attitude, the freefall (the body's drag areas belly, tracking and head down at the air's real density, the flat turn), the press sequence (jump, open, cut away, reserve), the staged deployment and its numbers (the pilot chute, the bag, line stretch, the snivel, the slider, full inflation, the opening shock), the sport main flown on its lines (`canopy.ts`, shared with the paramotor: toggles, brakes and flare, risers), the cut-away, the RESERVE (the 7-cell square off a spring pilot chute and a free bag, `CHUTE.reserve`), the auto-release on landing, the canopy caught in a crown or on a lift's rope, tower or carrier and the crown drape, the restart in the door (or in the craft he left), THE SKYDIVE OUT OF ANOTHER CRAFT (the helicopter's skid, the balloon's side, the paramotor's dropped rig — `craftFreefall`, `ChuteState.from`, `CHUTE.craft`), the bot's landing pattern, the drawing (the harness-container, the canopy, the bridle, bag and pilot chute over it, the body through every stage), the lenses, the sound, the `make skydive` sheets and `make skydive-flight` with its exit rows — and the AIRBORNE EDGE it shares with every craft (`airBounds`). Not the plane it jumps from (`airplane`), not the paramotor's own flight (`engine-system`, `ski-physics`)."
---

# The skydive

A skydive is three bodies of physics in a row — a body in freefall, a
system opening over seconds, a canopy flown down on its lines — and a
drawing that must read at every stage, frame by frame through the opening.
Every change is judged by two questions: **does the engine's number sit
inside the sport's measured band** (`make skydive-flight`), and **does the
stage read right in the game's renderer** (`make skydive`)?
`docs/skydive.md` is the description; this skill is the procedure.

**Read this skill's lessons first** — `npx ogf-skill-lessons skydive --list`.
Load **`skill-reflection`** at both ends, **`write-code`** beside this one,
**`airplane`** for the door and the jump run, **`skier`** for the body,
**`game-feel`** for the lenses, **`sound-effects`** for the sound and
**`crash`** for a fall that ends on the snow.

## Where it lives

| Piece | File |
| --- | --- |
| Every number: the container, the pilot chute and bridle, the bag, the main and its slider, the reserve (`CHUTE.reserve`: its canopy, polar, trim, pilot chute and stages; `wingOf` picks the canopy flying), the polar, the trim, brakes, risers and turn, the freefall's areas, the exit, the deployment's stages, the fill, the stretch, the shock band, the flare, the hand-over, the dropped canopy, the snag reaches, the bot | `engine/game/defs/chute.ts` (`CHUTE`, `jumperMass`) |
| The step: the exit, the freefall, the opening, the canopy (`flyChute` after the skier's own step), the cut-away, the reserve's pull, the landing, the snag, the restart; `skydiveAt` stands one up (`reserve: true` under the reserve) | `engine/game/chute.ts`, `chute-state.ts` (`ChuteMode`: exit, freefall, deploying, open, released, landed, snagged; `reserve` once it is pulled, the main's `piece` and the reserve's `sparePiece`) |
| The ram-air maths shared with the paramotor (`lineDir`, `wayOf`, `liftDrag`, `swingDamp`, `pullLines`, `crownAt`, `fallPiece`, `hangUnder`) | `engine/game/canopy.ts` |
| The bot's hands: the pull, the pattern, the flare; `skydiveInput` for the labs | `engine/game/chute-pilot.ts` (`chutePilot`, `landingSpotOf`), hooked into `engine/sim/bot.ts` |
| The ONE entry from a craft: the plane's `jump`, the helicopter's `drop`, the balloon's `jump`, the paramotor's `drop` — high enough (`CHUTE.craft.least`), a skydive in its exit; `from` names the craft, `exitClear` its clear, `restart` puts him back in it | `chute.ts`'s `craftFreefall` (called first by `stepChute`, and again by `run.ts` after `paraPress` for the balloon and the paramotor, which step after it), `chute-state.ts`'s `ChuteCraft`, `defs/chute.ts`'s `CHUTE.craft` / `exitClear` |
| The rig drawn on him in a craft | `chute-scene.ts`'s `rigWorn` (read by `machines.ts`) |
| The edge | `AIR_BOUNDS.skydive` (on his body) and `.chute` (under the canopy), `collision.ts`'s `airBoundsAt` |
| The harness-container on his bones | `pwa/src/game/chute-gear.ts` |
| The sport main and the reserve (`SKY_WING`, `RESERVE_WING`, their paints — `WingShape`s over the paramotor's cloth) | `pwa/src/game/chute-canopy.ts`, `para-canopy.ts` |
| The loose pieces: the pilot chute, the bridle, the bag, the slider, the cut-away streamer, the cloth on the snow, the crown and rope drapes, the rig over the canopy (`OVER`, `overCanopy`, `flownOver`, `crownDrape`) | `pwa/src/game/chute-rig-plan.ts` (three-free) |
| Every stage drawn (a kit a canopy, the main's and the reserve's, each on its own clock; the reserve's spring pilot chute and free bag), the eyes and the own-eyes hiding | `pwa/src/game/chute-scene.ts` (through `machines.ts`) |
| The body through every stage, laid from a square stand | `pwa/src/game/skier-skydive.ts` (`SkydiveShape`, `skydivePose`, `squareStand`, `squareSkis`), read by `skis-body.ts`'s `setSkydive` |
| The snowboarder through every stage: the skier's arms, square to his front, the board across his feet (`boardSkydiveYaw` turns him out of the door, square in the air and side-on at the flare) | `pwa/src/game/board-skydive.ts`, read by `board-model.ts`'s `setSkydive`; `tests/board_skydive_test.ts` |
| The lenses | `pwa/src/game/camera-skydive.ts` (the freefall's flyer, the opening), `camera-para.ts`'s `CHUTE_RIGS` (under the canopy); in a wingsuit `camera-wingsuit.ts` (the chase, side and helmet lenses along his line, the hover exit framed off the helicopter's side, every change flown round him) and `haze.ts`'s `uMistAloft` (the mist measured across the ground under a high lens); `tests/camera_wingsuit_test.ts` |
| The HUD, the words | `plane-hud.ts`'s `chuteOf`, `hud-plane.tsx`, `strings-chute.ts`, `run-news.ts` |
| The sound | `audio/chute-voice.ts`, `chute-bed.ts` (`rideShares`: the ride bed silent while he falls), `chute-bank.ts` |
| THE WINGSUIT on the same step (`ChuteState.suit` `"wingsuit"`, no skis, no reserve): the flight, the exit and its hover, the BASE canopy (`CHUTE.base`), the landing on his boots, the bot | `engine/game/wingsuit.ts`, `wingsuit-start.ts`, `wingsuit-pilot.ts`, `defs/wingsuit.ts`; `docs/wingsuit.md`; `tests/wingsuit_test.ts` |
| THE WINGSUIT AS DRAWN: the shapes and the pose (`skier-wingsuit.ts`), the wings lofted off the joints (`wingsuit-cloth.ts`, `wingsuit-figure.ts`), the colourways and the paint (`wingsuit-look.ts`), the dress (`wingsuit-dress.ts`), the flyer posed (`wingsuit-body.ts`, read by `skis-body.ts`'s `setWingsuit`), the BASE rig (`chute-gear.ts`, `chute-scene.ts`, `chute-canopy.ts`'s `BASE_WING`), the hover helicopter (`wingsuit-hover.ts`) | `pwa/src/game/`; `tests/wingsuit_look_test.ts`; `make wingsuit` over `pwa/wingsuit-preview.html`, `pwa/src/tools/wingsuit-harness.ts`, `wingsuit-scenes.ts` |
| The labs | `scripts/skydive-flight-lab.mjs`, `scripts/wingsuit-flight-lab.mjs`, `scripts/wingsuit-preview.mjs`; `scripts/skydive-preview.mjs` over `pwa/skydive-preview.html`, `pwa/src/tools/skydive-harness.ts`, `skydive-scenes.ts` |

## The numbers it is held to

| Moment | Band | Lab row |
| --- | --- | --- |
| Out of the door to the air from below | 8–10 s | `exit` |
| His body laid onto the wind | 30–60° at 0.5 s, 45–75° at 1.5 s | `exit-0.5s`, `exit-1.5s` |
| Terminal belly near the snow / at 3,800 m / head down | 54–56 / 62–67 / 85–90 m/s | `terminal`, `terminal-high`, `head-down` |
| The track's glide | 0.5–1 | `track` |
| 4,000 m to 1,000 m | 50–60 s | `ff-time` |
| Throw to line stretch / to full | 1–1.5 / 3–4 s | `open-stretch`, `open-full` |
| Height the opening costs / its peak | 150–250 m / 3–6 g | `open-lost`, `open-g` |
| The canopy hands off: forward / sink / glide | 10–13 m/s / 4–5 m/s / 2.5–3 | `canopy-fwd`, `-sink`, `-glide` |
| The flare | under 2 m/s of sink | `flare` |
| Caught in a crown / on a rope, hanging over the snow | > 0 m | `snag-tree`, `snag-lift` |
| The reserve: pull to line stretch / to full | ≈1 / 2–3 s | `reserve-stretch`, `reserve-full` |
| The reserve: height from the cut-away to full / its peak near terminal | < 90 m / 3–6 g | `reserve-lost`, `reserve-g` |
| The reserve hands off: forward / sink / glide / landed flared | 11–14 m/s / 4.5–5.5 m/s / 2.2–2.8 / < 2.5 m/s | `reserve-fwd`, `-sink`, `-glide`, `-land` |
| Nearest the edge tracking / under a canopy | > 0 m | `edge-track`, `edge-canopy` |
| Out of the paramotor / the helicopter / the balloon: the height he left it at; landed on the bot's pattern | > 100 m; < 4 m/s of sink | `para-`, `heli-`, `balloon-out` / `-open` / `-land` |
| THE WINGSUIT: glide / across / sink | 3.0–3.5 / 150–190 km/h / 10–14 m/s | `wingsuit-flight`'s `glide-ratio`, `-across`, `-sink` |
| The wingsuit's dive / flare | ≥ 250 km/h / a climb of 10–40 m | `dive-top`, `flare-gain`, `flare-sink` |
| The wingsuit's exit: drop / time to flying | 60–120 m / 4–7 s | `exit-drop`, `exit-time` |
| The BASE canopy: full / height / forward / sink | 3–5 s / 60–150 m / 8–10 m/s / 3.5–5 m/s | `pull-full`, `pull-lost`, `canopy-fwd`, `canopy-sink` |

## The labs

- **`make skydive-flight`** (pure Node, seconds) — before AND after every
  change to `CHUTE`, `chute.ts`, `canopy.ts` or `chute-pilot.ts`:
  `ARGS=--json=previews/skydive-before.json`, then `--compare=…`. The rows
  above, plus `turn-full`, `turn-half`, `land`, `cutaway` and `jump` (the
  bot's whole jump on seed 38: the exit height, the pull, how far from its
  spot it lands) and the craft's own rows (the paramotor's `para-out` with the
  motor's distance off him 1.5 s after the drop). A change to `canopy.ts` also owes `make para-wind`
  `--compare` (the paramotor unmoved) and `tests/para_test.ts`.
- **`make wingsuit-flight`** (pure Node, seconds) — the same before and
  after every change to `WINGSUIT`, `CHUTE.base`, `wingsuit*.ts` or the
  chute step the suit rides on; a change to the chute step owes both labs.
- **`make skydive`** (browser, its own bundle) — every sheet before and
  after a change to the look: `gear`, `worn` (the rig close from every side
  on the snow after a landing, riding on, under the canopy and in freefall —
  the sheet for any change to `chute-gear.ts`, on the skis AND `--skis=lynx`), `exit`, `freefall`, `deploy` (the
  opening frame by frame, off his side and on the chase lens), `shape` (the
  main from behind, the side, below, the front, the top skin with the
  bridle, bag and pilot chute, in a turn), `canopy` (hands off, the toggles,
  the front risers, the flare, the landing on the bot's hands), `cutaway`
  (high, and low so the cloth lies on the snow), `reserve` (the handle, the
  opening frame by frame, four sides beside the main, the flare and the
  let-go), `snag` (the crown — its
  `crown over` and `crown round` views — and a lift's rope), `lenses` (every
  rung in freefall, the opening and under the canopy), `night` and `stages`
  (every stage of the body close on one sheet), `craft` (the paramotor flown,
  its motor falling away, the freefall, the canopy; the helicopter's skid,
  the push-off, the freefall, the canopy; the balloon's basket, over the
  side, the freefall, the canopy — `Stage.fresh(ride)` stands up the craft).
  `make para ARGS=--sheet=drop` holds the paramotor's side. `ARGS=--skis=lynx` jumps on a
  snowboard (its pictures go under `previews/skydive-lynx-*`): a change to
  the body owes `--sheet=stages` on the skis and on the board.
  `ARGS=--sheet=…`, `--views=…`, `SEED=`, `REGION=`; prefix with
  `CHROMIUM_PATH=/opt/pw-browsers/chromium` in a cloud session. A change to
  the cloth also owes `make para` (`para-canopy.ts` is shared).
- **`make sim`** — its digests unmoved: the skydive is an option of a free
  ride (`CreateGameOptions.chute`), never a `RunRule`.
- **The game**: `make build`, then `make screenshots ARGS="--surface
  chute-free,chute-open,chute"` at the three viewports (`chute-open` is the
  opening's last second, t = 8.2 s).
- **The suite**: `npx vitest run tests/chute_test.ts tests/chute_look_test.ts
  tests/para_look_test.ts tests/para_test.ts tests/para_wind_test.ts
  tests/heli_test.ts tests/balloon_test.ts
  tests/plane_test.ts tests/air_bounds_test.ts tests/plane_hud_test.ts
  tests/plane_audio_test.ts tests/determinism_test.ts`.

## The rules

- **THE OPENING IS DRAG, NOT A SCRIPT.** Each stage of `CHUTE.deploy` is a
  drag area the air meets; the shock is what that drag does to him. Retime a
  stage and read `open-lost` and `open-g` — never clamp the g.
- **ONE CANOPY MATHS.** `canopy.ts` is the paramotor's and the skydive's;
  a change there is a change to both. The paramotor stays bit-identical
  unless the change means to move it (`para-wind`'s JSON, `para_test`).
  Likewise the cloth: `para-canopy.ts` without a `WingShape` is the
  paramotor's, byte for byte (`para_look_test`).
- **THE PRESS IS THE NEXT THING.** Jump, open, cut away, reserve; the
  landing releases by itself, and the reserve is never cut away. The HUD names the next press. A press in the exit's first
  `CHUTE.exit.clear` s does nothing (the tail passes over).
- **A fall ends as any fall does.** A freefall or a cut-away is handed to the
  skier's own step 2.5 m over the snow and judged by the crash code; thrown,
  the ride restarts in the plane's door, or in the craft he left. Snagged,
  he hangs until **R**.
- **ONE WAY INTO THE SKYDIVE.** Every craft's way off in the air is read by
  `craftFreefall` off the step's events and nowhere else; a new craft adds its
  event to `leftCraft`, its restart to `restart` and its stage to the lab.
  Below `CHUTE.craft.least` he falls as a skier (the old rows stand). The
  craft goes on stepping while he falls (`run.ts`).
- **THE BOT NEVER JUMPS FROM THE DOOR.** A pre-roll stays aboard; the bot
  flies the skydive once he is out, and `skydiveInput` jumps for the labs.
  Its pattern is downwind, base and final to a spot, a holding turn of at
  most 0.45 toggle — never a full-toggle spiral.
- **THE AIRBORNE EDGE IS ONE RULE.** `airBoundsAt` with `AIR_BOUNDS.skydive`
  (320 m: a track at 40 m/s turned round at his flat turn's rate) on his
  body and `.chute` (100 m) under the canopy — the same wind and turn every
  craft in the air shares, never a wall. A canopy flown over a wind tunnel is
  never caught: the tunnels take only under `TUNING.tunnel.roof` (8 m).
- **Pure.** Nothing draws from `state.rng`; `make sim` before and after.

## What the passes learned

- **A high lens saw only mist.** The DISTANCE row's mist closes on the 3D
  distance at any height, so from 900 m over the snow even straight down
  was three parts mist and a level chase lens saw nothing but haze. A
  wingsuit's lens high over the snow measures the mist across the ground
  instead (`haze.ts`'s `uMistAloft`, set by `machines.ts`; 0 on every other
  ride, so no other look moves) — and frames him LOOKING DOWN along his
  line, never level. Judge a wingsuit lens on `make wingsuit ARGS=--sheet=chase`'s
  `chase-face` row (the bot's own flight a few hundred metres over the face),
  not only the 900 m `chase-glide`.

- **A lens that bails is every lens.** Leaving the plane bailed TIPS and
  HELMET to CHASE, so every first-person shot was really the chase; and a
  planted lens re-showed his figure, so his own head filled the frame. The
  skydive has its own eyes (`chute-scene.ts`'s `eyes`) and hides his figure
  and rig on them (`machines.figureShown`).
- **The crown drape hung off the cone's foot.** A snag point just outside
  the foliage made every cloth point "hang off the rim" from the bottom of
  the cone. The drape is laid from the snag's own height, like a sheet over
  the crown's top 3.2 m held out by the boughs.
- **The slider drew as a bow tie** (its quad's vertex order); **the box's
  legs were asymmetric** (the engine's last snow readings turned one leg
  out) — so the body is laid from a square stand with the skis level.
- **The first second was too upright.** The exit body is the box laid on the
  engine's attitude, which climbed slowly from 0°; the poised exit leads the
  air's angle (`exit.lead`, `.poise`, `.body`) and the two exit rows hold it.
- **The rig rides the bridle off the top centre.** At full canopy the bag and
  pilot chute floated at the trailing edge; they now sit over the top skin's
  middle and settle aft as a real one does.
- **The rig is laid in the CHEST bone's frame, which starts at the WAIST.**
  The neck's base is only 0.275 m up it and the shoulders' line 0.215; the
  first rig took the origin for mid-chest and stood its shoulder webs 0.5 m
  up, a frame floating beside the helmet. Size anything worn on the trunk
  off `dress-body.ts` (the back some 0.15 m behind the spine through the
  jacket), and hold it in `tests/chute_gear_test.ts`. An extrusion laid onto
  the back by a z map that reverses its depth is a reflection: mirror x too,
  or every face renders inside out.
- **Nothing is heard twice.** The ride bed's wind is zero aboard the plane and
  through the exit, freefall and deployment; the chute's own roar carries it.

## Known gaps

- **No automatic activation device.** A cut-away not followed by the press
  is a fall to the snow; firing the reserve by itself would move the
  `cutaway` row and its test.
- A snag on a moving chair is held where it caught.
- The harness-container is drawn under the paramotor's motor and shows
  through its cage from some angles; the rig worn under a motor frame is not
  modelled as one piece with it.
- The crown drape is a cone model; a slim fir reads as cloth in the crown.
- The stabilizers read as small white triangles from straight behind; the
  opening's HELMET shows his gloves as dark slabs at the frame's edge.
- The snowboarder's HELMET eyes in the door still look along the plane,
  where his figure is turned to face out of the door.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth recording: a
band a row left, a stage that read wrong frame by frame, a lens that
bailed, a shared piece (`canopy.ts`, `para-canopy.ts`) that moved the
paramotor.

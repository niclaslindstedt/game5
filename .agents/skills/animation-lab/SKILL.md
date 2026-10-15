---
name: animation-lab
description: "Use when an ANIMATION is to be debugged, improved or judged — the rider on skis, on a snowboard or on the downhill bike, or any other figure the game poses — 'he twitches', 'the arm pops', 'the knee snaps through', 'the walk looks stiff', 'make the turns look natural'. Owns `make anim` (`scripts/anim-lab.mjs` over `scripts/lib/anim-*.mjs`): every scene ridden by the real engine in pure Node and the real model posed off every step, drawn as filmstrips (shaded, hidden-line wireframe, bones coloured by jolt) from three sides, onion skins with the tips' paths, and charts against the clock (every joint angle and its acceleration, each joint's jolt, each limb's stretch, the tips' speeds, the clips); the table and its thresholds, how to read a sheet, the before-and-after loop, and how to set the lab up for a new animation or a new figure."
---

# The animation lab: see every frame, measure every joint

An animation bug is almost never visible in one still. A pose switched
rather than blended, an elbow flipping, a hand-off between two ways of
drawing him, a limb stretched by a solver, a knee through the other — each
is a frame or two, and each is a NUMBER before it is a picture. `make anim`
puts both side by side for every animation of the player's rider:

```sh
make anim                                      # skier, board and bike: every scene
make anim ARGS="--family=bike"                 # one family
make anim ARGS="--family=skier --move=carve,jump"
make anim ARGS="--family=ride"                 # the machines and seats (lifts, sled, heli, chute, …)
make anim ARGS="--no-render"                   # bones, onion skins and charts alone (fast)
make anim ARGS="--json=previews/anim-before.json"
make anim ARGS="--family=skier --no-sheets --snaps"  # every angle snap and snapping joint listed by time
make anim ARGS="--compare=previews/anim-before.json"
```

Pure Node, no browser, no build: a scene takes seconds (the bike's summer
map takes ~15 s to generate once). Out come `previews/anim/<family>-<scene>.png`
(a sheet a scene), `previews/anim/summary.png` (every row in colour) and
`previews/anim/index.html` (the table with every sheet under it — publish it
or open it locally). Load `skier` (the figure), `skier-improvement` (the
realism loop) and `lab-tooling` (the shelf) beside this skill.

## How a scene is made

The lab reuses the JOLT LAB's reader (`scripts/lib/jolt-rider.mjs`,
`createRiderReader`): it builds the scene's `GameState`, steps the REAL
engine (`E.step`) at 120 Hz, and every frame (60 Hz by default, `--hz`)
poses the REAL model (`createSkisModel`, the code-built figure the renderer
uses) exactly as the renderer poses it — `model.pose(...)`, with the
scene's `seat` called first as `machines.ts`'s `seat` is. It then reads every
bone of the dressed skin in the SKIER'S BODY FRAME (x his right, y up, z
forward; the engine's place and turn taken off), so a carve's lean or a
spin is not a jolt, and whatever the drawing does over it is. Where the
engine JUMPS that root a quarter metre to a couple of metres in one step (a
remount onto a bike's frame, a step off beside it), the renderer's hand-off
(`pose-handoff.ts`) eases the drawn body across over 0.25 s, so the reader
eases the frame it reads in across the same way (`JUMP`, `JUMP_EASE`) —
otherwise the root's jump is billed to the limbs. The bike family rides the
trail look's rider by default; `--bike-look=freeride` measures the freerider
the animator carries (`bike-anim.ts`'s `animatedStyle`) instead.

A scene is `{ id, title, seconds, window?, game(), place?(), input(t,
state), seat?(model, state, dt), bike? }`:

- `game()` makes the state (any `createGame` options; stepping it forward
  inside `game()` starts the scene part way into a ride, as the bike's
  scenes do).
- `input(t, state)` is the controls at scene time `t` (a bot's hands —
  `bikePilot`, `slalom` steer — or a script; a one-step press is `t === 0`
  or a window one step wide).
- `seat` is whatever the renderer does to the model before posing it
  (`setBiking`/`setStood` for the bike, `setPerch`, `setSled`, …). If the
  game's renderer calls something before `pose`, the scene must too, or the
  lab draws a different animation from the game's.
- `window` is the stretch the filmstrips spread their frames over.

The lab hooks in through `ctx.onFrame(model, state, sample, at, scene)`
(called by the reader after each read): it adds the head's, chest's and
pelvis's facing (`sample.axes`) every frame and, at the filmstrip moments,
captures the posed model's triangles (`anim-raster.mjs`'s `captureModel`)
and the bike's stick (`anim-families.mjs`'s `bikeSticks`).

## The families

| family | scenes | where |
| --- | --- | --- |
| `skier` | every move of the skier labs on the Chamois: `skier-moves.mjs` and the revert, hop-switch, pole, climb, flip and air-lean moves | `anim-families.mjs`'s `SKI_MOVES` |
| `board` | every move of `board-figure-moves.mjs` and the loops, on the Lynx | `anim-families.mjs` |
| `bike` | seed 38's trail B1 ridden by the bot (`start`, `air`, `trail`, `berms`) and off it walking the bike and back on (`walk`) | `anim-families.mjs`'s `BIKE_SCENES` |
| `ride` | the jolt lab's machines and seats (lifts, sled, heli, para, balloon, chute, wingsuit, ski jump, town, afterski, doors) — by name only | `jolt-ride.mjs` |

## The sheet, top to bottom

1. **The head**: the scene and its verdict — red where it fails.
2. **Filmstrips**, a column a moment (`--frames`, 8), a row a way of drawing
   him, every row at one scale so what moves between cells is the motion:
   - SHADED from the side (his right, forward to the right), behind and the
     front three-quarter: the skinned mesh skinned on the CPU with three's
     own `applyBoneTransform`, z-buffered, a key light — the silhouette and
     the cloth as a frame of the game holds them.
   - WIRE from the side and behind: the mesh's hidden-line wireframe over a
     dimmed fill — a garment folding inside out, a seam torn, a collapsed
     skin show here first.
   - BONES from the side and behind: the skeleton over a ghost of the fill,
     left blue, right red, the spine white, each joint's dot coloured by its
     jolt that frame (dark → green → yellow → red past the line).
   - A cell framed RED is a frame that snaps. The bike is drawn as a grey
     stick (frame, fork, bars, cranks, wheels) off the engine's pose and
     `bike-look.ts`, so the hands read against the grips and the feet
     against the pedals.
3. **Onion skins** from the side, behind and above: every frame's bones laid
   over the others (old blue to new orange, a snap's frame red) and the paths
   of the head, hands and boots coloured by speed. A smooth motion is a fan
   of nested curves; a pop is a spike off one.
4. **Charts** against the scene's clock, the PHASES banded along the top
   (`snow`, `air`, `thrown`, `bike`, `afoot`, `lift …`), the filmstrip's
   moments as grey lines and every snap as a red line down all of them:
   - joint angles in four groups (legs: knee, hip, ankle; arms: elbow,
     shoulder, elbow out (the upper arm off to his side), wrist; trunk: pitch, roll, the shoulders' twist over the
     hips, the hips' yaw; head: pitch, yaw, off the chest, and the hips'
     height over the boots);
   - the angles' acceleration, |deg/s²| on a log scale, the red line the
     angle snap;
   - each joint's jolt as a heatmap, a row a joint and a column a frame;
   - each limb's length off its middle, %, the dashed band ±3 %;
   - the tips' speeds in the body frame, m/s;
   - clips, a tick a frame.

## The measures and their lines (`anim-measure.mjs`)

| measure | what | line | what crosses it |
| --- | --- | --- | --- |
| **snap** | a joint's second difference as an acceleration, m/s² (`jolt-measure.mjs`) | 150 (`--most`) | a pose switched not blended, a hand-off between two drawings, a joint jumping. A body moving as a body stays under ~100; a centimetre's jump in one 120 Hz frame is 144 |
| **pop** | two jolts past the line in a row, the second turned back against the first | any | a point drawn somewhere for a frame and back — a one-frame glitch |
| **angle snap** | an angle's acceleration, deg/s² | 25 000 (`--angle-most`) | a knee or elbow flipping, a joint driven to a hard stop (a cusp in the angle chart: a V where a curve should be round) |
| **stretch** | a held limb's length off its middle (thigh, shin, foot, upper arm, forearm, head) | 3 % (`--stretch-most`) | an IK target out of reach, a rig scaled, a bone fed the wrong parent |
| **clip** | knees or boots closer than 7 cm, a hand or elbow within 9 cm of the spine's segment | any | a limb through another or the trunk |
| **jerk rms** | the joints' third difference, m/s³ | none | a reading: the smoother the lower — compare it before and after a change to the same scene |
| **elbow°** | how far out to his side the elbows ride: the 90th percentile over the scene of the wider upper arm's angle off the trunk's plane, deg | none | a reading: elbows tucked to the ribs read 15–35 working the poles, wings held out 70+ |

A scene is CLEAN when it has no snap, no pop, no angle snap, no stretched
limb and no clip. Some scenes are not meant to be clean — a wipeout's throw
onto the ragdoll, a reset, a mount onto a machine are real discontinuities —
so read the phase band: a snap exactly at a phase change is a HAND-OFF to
judge (should it be blended?), a snap inside one phase is a bug.

## Reading a sheet: symptom → where to look

- **Red frames periodic with a gait** (the bike's walk, a skate's push) and
  V-shaped cusps in the knee chart: a gait whose leg is driven to straight
  and bounced, not eased — the gait function's curve (`skier-gait.ts`,
  `walkingPose`), not the spring.
- **One red column at a phase change**: two ways of drawing him handed over
  in one frame (`pose-handoff.ts`, a `seat`, `setStood`): blend it.
- **A pole or hand tip red where the hand is quiet**: the pole's own swing
  or plant (`skier-stroke.ts`), or the pole re-gripped.
- **Angle snaps on a wrist alone**: the hand's frame flipping (an `atan2`
  across ±180, a look-at with a degenerate up).
- **Stretch over the band**: the limb solver's reach (`skier-limbs.ts`) —
  the grips or the bindings set further than the arm or leg is long.
- **A clip tick**: the pose's own place for the knees or hands
  (`technique-pose.ts`, `skier-pose.ts`), not the mesh.
- **Shaded fine, wire wrong**: the skin (`dress-loft.ts`), not the pose.
- **Onion spike**: one frame's pose wrong — take its time off the chart and
  run `make jolt ARGS="--family=… --move=… --trace=t0,t1 --joint=name"`
  to print it frame by frame.

## The loop

1. `make anim ARGS="--family=… --json=previews/anim-before.json"` — keep the
   table and the sheets of the scenes you will touch (copy them aside: the
   next run overwrites `previews/anim/`).
2. Read the sheets; name the defect by its row (scene, joint, time, phase).
3. Fix it where the symptom table points; add a test in the figure's suite
   (`tests/skier_pose_test.ts`, `board_pose_test.ts`, `bike_look_test.ts`)
   where the defect is a rule.
4. `make anim ARGS="--family=… --compare=previews/anim-before.json"` — the
   table prints each row against its before. The defect's row is clean, no
   other row worse.
5. Run the figure's own labs (`skier-metrics`, `board-motion`, `jolt`,
   `skier`, `bike`) — the animation lab says it is smooth, those say it is
   a real skier's or rider's pose.
6. Put the before and after sheets and the compare table in the PR.

Realism is not smoothness: a smooth animation can still be a wrong one. Hold
the pose to real technique (`skier-metrics`'s bands, `board-metrics`, the
research in `docs/`), and use this lab to make sure every change lands
without snaps, pops, stretch or clips.

## Setting the lab up for a new animation

- **A new move of an existing figure**: add it to its moves file
  (`skier-moves.mjs`, `board-figure-moves.mjs`, or `anim-families.mjs`'s
  `BIKE_SCENES`) in the scene shape above; the skier lab, the jolt lab and
  this lab all pick it up.
- **A new way the rider is seated or carried** (a machine): give the scene
  the renderer's `seat` for it, copied from `machines.ts` (call the very
  functions it calls, never a restated pose), and add its phase to
  `jolt-rider.mjs`'s `phaseOf`.
- **A new family** in `anim-families.mjs`: a function returning `{ id, say,
  scenes }`; add it to `FAMILY_IDS` (and `DEFAULT_FAMILIES` if it is the
  rider's).
- **Something drawn beside him** (a machine, a board): add a stick like
  `bikeSticks` (points in his body frame off the engine's pose and the
  drawing's own geometry), or pass its `Object3D` to `captureModel` as
  `extra` to rasterize it shaded.
- **A figure that is not the player's model** (the crowd, the people on
  foot, the wildlife): their samples come from the jolt lab's families
  (`jolt-people.mjs`, `jolt-wild.mjs`, `pointsOf`); `measure` and the chart
  half of `drawSheet` read any samples of named points, and `SPANS` /
  `ANGLES` are the skeleton they assume — give a new skeleton its own spans
  and angles rather than bending the rider's.
- **A new measure**: add it to `measure` and `verdictOf`, chart it in
  `anim-draw.mjs`'s `chartsOf`, add its column to the table, the summary and
  `anim-report.mjs`, and a row to the table above.
- Keep every file under the 1000-line cap; the sheet's rows are data
  (`STRIPS` in `anim-draw.mjs`), so a row is added there.

## Its neighbours

- `make jolt` — the same jolt measure across every animated figure in the
  game (the crowd, the people, the wildlife too), with `--trace` frame by
  frame. This lab is its deep view of the rider.
- `make skier` — the skier and board figure rendered through the GAME's
  renderer in Chromium (materials, lighting, shadows), filmstrips from five
  sides; `ARGS=--wire` its wireframe. Use it for the final look; use this
  lab for the motion.
- `make bike` — the bike and its rider through the game's renderer at named
  moments.
- `make skier-metrics`, `make board-metrics`, `make board-motion` — the pose
  held to a real skier's and rider's bands.
- `make lean`, `make sag`, `make landing`, `make air-lean` — one aspect of
  the skier's body each, measured deeper.

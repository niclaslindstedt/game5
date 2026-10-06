---
name: skier-improvement
description: "Use when the ask is to make THE SKIER MORE REALISTIC — his pose, his motion, his model, his skinning, his textures — rather than to change one thing about him: 'the skier looks wrong', 'make the rider more lifelike', 'iterate on the skier until it is better'. Owns the IMPROVEMENT LOOP and its harnesses: `make skier-metrics` (the game's pose measured frame by frame off the real engine and held to a skier's bands — joint angles, each shin in its boot, the centre of mass over the feet, angulation, the head against the horizon, limbs through limbs, snaps — with the share of frames at fault), the skier lab's sheets at its MOMENTS (`closeup`, `detail`, `game` at a 1280×720 frame's own pixels, `stretch` — the skin coloured by each triangle's stretch off its bind), the model rebuilt in Blender and published, the honest before (the final bands run against the original code in a worktree), and the lessons the first pass learned: why shoulders 'level' in the body frame sit a skier sideways, why a boot must hold the shin, why an elbow flips, why a half bone must turn from rest, why a twitch is a second difference. What he IS is the `skier` skill's; the Blender shelf is `blender-assets`'."
---

# Making the skier more realistic

The skier is judged three ways and improved one axis at a time: by
NUMBERS (is the pose a skier's?), by PICTURES (does it read, close up and at
the game's sixty pixels?) and by the SKIN (does the model bend without
tearing?). Each has a harness; every round runs all three before and after
and keeps both. Load `skier` (what he is, where everything lives) and
`write-code` beside this; `blender-assets` when the model is rebuilt.

## The harnesses

| Command | Question | Read it |
| --- | --- | --- |
| `make skier-metrics ARGS="--json=previews/m-before.json"` | Is the pose a skier's? | A move a row (`scripts/lib/skier-moves.mjs`), the mean of each reading over its window, and the share of frames at fault; `kneeR` (the knees' range) and `ride` (the head's share of the boots' bounce — the legs as springs, read on the `bumps` move); every snap judged in the WORLD, where the eye sees it; `--faults` every fault with the engine's state beside it; `--compare=` the change. Pure Node, seconds |
| `make sag ARGS="--json=previews/sag-before.json"` | Does he go over too far when he is pulled DOWN onto his legs? | The staged pulls down (landings, a run-out, a stop, rollers, a tuck) and a generated map skied fast by the bot, each posed with the legs' spring and without it: the forward lean the spring adds and its split, what the shins add, the head over the hips and knees, and the share of frames past `bow`, `waist` and `tipsy`; `--worst` the worst frames, `--compare=` the change, `previews/sag.png` the worst frame of each. Pure Node, seconds |
| `make lean ARGS="--json=previews/lean-before.json"` | Does his LEAN move smoothly from turn to turn? | A slalom and staged rhythms of turns drawn frame by frame as the renderer draws them, each lean read layer by layer — the engine's incline, the spring's roll, the drawn legs, trunk and head — for its shiver (what a 25 ms smoothing leaves), roughness (the rate's power above 5 Hz), turning points a turn (1.00 is one swing) and lag; the layer where a roughness first appears is its source, and `--without=` / `--ease=` / `--inputs` prove which; `--fps=144` the frames between steps; `previews/lean.png` the worst frame of each. Pure Node, seconds |
| `make skier ARGS=--sheet=closeup` | Does he look right? | The lab's MOMENTS (stance, carve, cut, plant, tuck, pole, skate, air, landing, hockey, skid, thrown) a row, four sides, big cells. `MOVE=`/`--moment=` a subset |
| `make skier ARGS=--sheet=detail` | Do the parts hold? | Each hand on its grip, the boots in the bindings, the head, the jacket front and back — framed off the model's own bones |
| `make skier ARGS=--sheet=game` | Does it READ in the game? | The chase and far cameras at a 1280×720 frame's own pixels, enlarged unsmoothed. Judge here last: a detail that is not here does not exist for a player |
| `make skier ARGS=--sheet=stretch` | Does the skin bend? | Every triangle coloured by its area off its bind (blue crushed, red stretched) and the share outside 0.6–1.6 by region, printed. A moment at exactly 0 % is a pose AT the bind, not a perfect one |
| `make skier MOVE=jump ARGS="--sheet=moves --views=back,side"` | Does it MOVE right? | A column a moment across a move; twitches show here before anywhere |
| `make gear` | Does the KIT fit him through every move? | The game's skier is DRESSED in code (`skier-gear`): every piece and outfit from four sides, one outfit through the moves, the game's pixels, a Blender skier beside (`--sheet=compare --model=…`) |
| `make blender KIND=skier ID=skier0 ARGS="--quality=game --views=none"` | A modelled skier, for the labs' comparison | A minute. Never shipped: the game draws the dressed skier |

The bands live in `scripts/skier-metrics.mjs` (`BANDS`) and say where each
number comes from: the cuff's own forward lean (0.22 rad) is the least a
shin can stand at; balanced, the centre of mass is over the middle of the
foot; a racer's angulation is 15–30°; a tuck has the back 55–85° over and
rounded. A band that faults a deliberate pose (a jump being loaded is not
a bad stance) is narrowed by its `when`, never loosened.

## The loop

1. `make skier-metrics` with `--json` — the before. When the bands
   themselves change mid-session, recompute the before HONESTLY: `git
   worktree add` the base, copy the metrics script and its libs in, export
   `poseInputOf` there, run it.
2. Read the worst move's `--faults`: the engine's state is printed beside
   each fault, so a fault is a number with a cause.
3. LOOK at it (`closeup`, `detail`, the move's strip) before changing
   anything — a metric can be measuring the wrong thing (a frontal angle
   inflated by a forward lean; a shin measured in the body frame when the
   skis are thrown across).
4. One axis: a pose number in `skier-pose.ts`, a bone in `skier-rig.ts`, a
   weight or a bake in `scripts/blender/skier.py`.
5. Re-measure, re-look, run `tests/skier_pose_test.ts` and
   `tests/world_render_test.ts`. A test that encodes the old model is
   updated to the new rule, saying why — never deleted.
6. The model rebuilt when bones, weights or the bake moved; `stretch` and
   `detail` re-shot.
7. At the end: `make models`, `make build`, a `make
   screenshots` frame of the grid and a race, and the before/after table.

## What the first pass learned

- **The body frame is already rolled.** The pose is stated in the PAIR's
  frame, and the engine rolls the pair into the turn. "Shoulders level" in
  that frame is a trunk thrown OUT of the turn in the world — the skier sat
  sideways in a chair. Measure leans in the world (`trunkLean`,
  `headRoll`), and pass the pair's roll in (`SkierPoseInput.roll`).
- **The boot holds the shin.** Solve the knee in the boot's plane at at
  least the cuff's lean (`bootKnee`), then through `solveLimb` so no bone
  stretches. Legs too long for it: SINK the hips (never pull them sideways —
  that kills the skate's sway) and move the hands with them, or every arm's
  reach changes and the elbows flip.
- **An elbow solved to a fixed pole vector flips** when a stroke swings the
  arm along it. Bend it off the arm itself: `cross(across, arm)` plus a
  small outward flare.
- **A twitch is a second difference.** A double-pole's fists move 5 cm a
  frame and are fine; a joint whose MOTION changes by 3 cm in a frame
  (100 m/s²) is a snap. Engine flags (`airborne`, a `jumpLoad` zeroed at the
  pop) are steps: ease them in the view's spring (`skier-spring.ts`), never
  in the engine.
- **A half bone turns half way FROM REST.** Averaging two bones' axes flips
  at a hip or a shoulder, where the trunk points up and the limb down. Take
  each bone's rotation off its rest, halve the two (`qhalf`), apply to the
  parent's rest. Every weight split must end at four influences,
  renormalised. Wider blends alone do not fix a 90° fold.
- **Texture detail is placed in BODY terms.** Bake the suit's position,
  normal and garment into float maps, compute the height of the
  construction (zips, seams, pockets, hem) per texel in numpy, then bake the
  normal from a bump of that height (`garment_height`, `bake_cloth`).
- **Colours picked a grid cell at a time are stairs.** Ease the boundary
  chain in the shell's own parameters and lay it back on the measured
  surface.
- **Blender in a cloud session:** fetch the version `pwa/models/sources.json`
  names from download.blender.org into `/opt/blender` and set `BLENDER`.

## Skill self-improvement

Load **`skill-reflection`** before this session ends. Worth recording: a
band that faulted a correct pose (and the `when` that fixed it), a metric
that measured the wrong frame, a skinning fix and its `stretch` numbers
before and after.

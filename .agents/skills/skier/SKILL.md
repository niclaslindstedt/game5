---
name: skier
description: "Use when working on THE SKIER — the figure standing on the skis: how he is posed on them (the boots in the bindings, the hands on the pole grips, the knees bent, the stance a ski is skied in), how his body answers the engine's readings (the knees folded by the legs' compression, each shin held in its boot, a carve an inclined column hinged at the hips with the eyes held toward the horizon, the weight fore and aft with the lean, the crouch of the tuck, the poles planted at a crawl and tucked under the arms at speed, compact in the air, a landing folded into the knees, the grabs of a tricks run), and how he looks from behind at chase range. Owns `pwa/src/game/skier-pose.ts` (the pose as three-free arithmetic: `BODY`, `MOUNTS`, `solveLimb`, `skierPose`, with the gait in `skier-gait.ts` and the view's own state between frames — the body on its legs, the air and a jump's load eased, his own clock — in `skier-spring.ts`), `skier-figure.ts` (the figure in his kit), `skier-cloth.ts` (the cloth he is built of) and `skier-helmet.ts` (the head, the helmet and the goggles), the skier's cases in `tests/world_render_test.ts` and `tests/skier_pose_test.ts`, and the loop: `make skier-metrics` (the pose measured against a skier's bands), `make skier` (every MOVE — setting off, the skate, the double pole, the jump, the hockey stop, the hard cut, the tuck, a landing, a wipeout — skied by the real engine and the committed models posed through its states from five sides, and a turntable; `--sheet=closeup,detail,game,stretch` at its moments), `make skis ARGS=--sheet=skier` (close up), `--sheet=poses` and `--sheet=landing`, `make world` (orbit, jump, landing), then the built app with `make screenshots`."
---

# The skier

The skier is the one human thing in the frame, and the chase camera looks at
his back for the whole run. He is **posed from the engine's readings**, never
animated by hand: `skier-pose.ts` places every joint in the engine's own
body frame from a `SkierPoseInput`, and `skier-figure.ts` hangs the figure on
those points.

**SKIS ARE SKIED ON BENT KNEES.** A skier stands with his boots clamped in
the bindings a stance apart, the knees flexed, the hips over the boots, the
hands forward on the poles — and every input moves that stance. The base
pose is that athletic stand, and it is the engine that bends it: the legs'
compression folds the knees, the edge angulates the hips inside the arc with
the upper body counter-rotated over the outside ski, the lean moves the
weight fore and aft, the tuck folds him down with the poles under his arms.

**HIS KNEES ARE THE ENGINE'S LEGS.** The legs are the physics' only
suspension (`suspension.ts`, `LegSpec`), so each knee's bend is read straight
off `SkierState.skiCompression` (left, right) — a landing folds them by what
the legs took, a rough groomer jiggles them. Beside that the view keeps a
small SPRING of its own (`SkierSpring`, stepped with the frame's `dt` in
`skis-body.ts`): the upper body as a mass on the legs, kicked by every change
in the engine's climb (`SkierState.vy`), so a landing that stops him dead
leaves the torso still coming down and springing back. **THE CROUCH** is the
engine's `crouch` (the tuck after its lag): 0 stood tall, 1 folded into a
full tuck — the back rounded, the poles under the arms, the head up. **IN
A CARVE** he is an inclined column with a hinge at the hips: the legs lean
in with the skis (each shin held in its boot, so the knees go in with the
edge), the trunk leans in too but less (`ANGULATE_SHARE` of the legs' lean
IN THE WORLD — the engine has already rolled the pair), the shoulders turned
toward the outside ski and the eyes held toward the horizon — never sat
sideways with his hips shoved inside and his trunk thrown out over the
outside ski, which is what "shoulders level" in the body's own frame gave. **THE GAIT** at a crawl is the engine's own drive (`gaitOf`, off
`SkierState.drive` and `stride`, the same strides the push comes in —
`poles.ts`): SETTING OFF on the flat or down a pitch he DOUBLE-POLES —
the diagonal stride is only for climbing a rise (the pair's `pitch`), a
man walking on skis everywhere else; SKATING, the skis opened into a V, a
leg driven out AND back off its ski's INSIDE edge (`Gait.tilt`) while the
hips are carried across over the flat gliding ski, both poles planted with
every push; and DOUBLE-POLING, the trunk already 40° over at the plant
with the elbows bent and out, crunched to 60° and the arms driven back past
the hips until they are long. The double pole's arms are swung FROM THE
SHOULDERS (`DOUBLE_ARM`, `armAt`); the stride's off the stance
(`STRIDE_STROKE`: the arms opposite, two strides a cycle); every pushed
pole BITES — its basket on the snow behind the fist (`strokePole`) — and is
a rigid rod TURNED through the stroke, never a tip placed and jumped to; the suite samples a
whole cycle and fails a joint that moves more than a few centimetres
between neighbouring samples; one statement the skis (`ski-gear.ts`, `ski-rig.ts`)
and the figure both read, so a boot never leaves its ski. A JUMP loading
(`jumpLoad`) sinks him and draws the arms back; the pop (`popped`) throws
them up. CUT HARD (`carve`) the angulation deepens and the inside hand goes
toward the snow; in a HOCKEY STOP (`skid`) the legs lean across the
pivoted skis, the shoulders facing on down the hill, and a skier braking
rises out of his tuck (`SKID_RISE`) — never a knee folded up past his hip.
AT SPEED he plants a pole on every new turn: the view's spring times it off
the edge changing sides (`SkierSpring.plantT`), and the rod swings round
the OUTSIDE to the snow ahead and back (`TURN_PLANT`) — a 1.2 m pole from a
fist nearer the snow than that cannot pass vertical. His SHIN BENDS ONLY ABOVE THE BOOT'S CUFF
(`SHIN_ABOVE_CUFF`) — the boot holds the rest — which is what lets the
stance stand on real knees.

**HE IS A MAN IN CLOTHES, NOT A STACK OF CAPSULES.** Dressed after
photographs of skiers seen from behind: a helmet with goggles over the eyes
(no face showing but the chin and the mouth), built as a model of its own
(`skier-helmet.ts`) and MEASURED off a photograph of a real ski helmet: a
HOLLOW shell, round-crowned, its rim low over the ears and the nape, the
goggles a wide strap-held frame ON the face filling the port under the
shell's brow, the strap round the outside of the shell; a shell jacket that
is one padded mass from the hem to the shoulders under a contrasting yoke;
sleeves bunched into gloves; ski pants over tall stiff boots with their
buckles (`SkierStyle`: jacket, accent, pants, helmet, goggles, boots). Every
part is CLOTH (`skier-cloth.ts`): coarse, boxy shaped sections (eight sides a
limb) whose silhouette carries the garment — the bagging at the knee, the
pads, a few big creases in the crook of each joint — rather than fine round
tubes. Each limb is turned about its bone so its +z faces where the joint
bends, so a knee pad is on the knee. The whole figure stands on the traced
bindings (`MOUNTS.boot` in `skis-body.ts`), so every pair's skier stands on
its own skis.

**Before starting, read this skill's lessons** —
`npx ogf-skill-lessons skier --list`. Load `skill-reflection` at
both ends, `write-code` beside this for any code change, and `ski-design`
when the skis he stands on are what moves.

## Where everything lives

| Piece | Role |
| --- | --- |
| `pwa/src/game/skier-pose.ts` | `BODY` (the limb lengths and proportions, m — the same bones `TUNING.crash.body` throws, `tests/crash_test.ts` holds the two together), `MOUNTS` (where the bindings, the pole grips and the base hips are fixed to the skis), `solveLimb` (two bones toward a target, bent toward a pole), `skierPose(input)` → every joint. Three-free, so the suite reads it |
| `pwa/src/game/skier-ragdoll.ts` | `ragdollPose` — the figure hung on the engine's `Thrown.points` once he is off his skis, as the same joints `skierPose` places |
| `pwa/src/game/skier-figure.ts` | `createSkier(style)`: the figure in the slot's `SkierStyle` — each limb a fixed shape hung from its joint and turned to face its bend (only ever turned, never stretched), the torso in its own frame, the helmet |
| `pwa/src/game/skier-helmet.ts` | The head, the helmet and the goggles, in the head's frame: `helmetShell` (the outer skin laid on an around-and-up grid with the port's cells left open, the liner, the rim along every open edge), `buildHelmet` (the head and chin, the goggles on the face, the strap, the vents) |
| `pwa/src/game/skier-cloth.ts` | What he is built of: `shaped` (rings of a rounded box along a line, smoothed and folded, rings laid only as densely as a fold needs), `cloth` (a limb's creases and pads), `torsoFold` (the jacket gathered, draped, the blades under it). A crease wants three rings a ridge or it breaks into a saw |
| `pwa/src/game/posed-merge.ts` | The posed tree — skis, poles and skier — drawn as ONE mesh, every part a rigid BONE of it, so the GPU lays each part through its matrix (in every pass, the shadows included); a part hidden with its ancestors (the skier in the helmet view) collapses to nothing |
| `pwa/src/game/skis-body.ts` | Hangs the skier on the skis; the bindings and the poles he is fixed to are drawn there |
| `engine/game/skier.ts` | Where his MASS actually is: `hipRight`, `hipAft`, `crouch`, `edge` and `skiCompression` on `SkierState`, lagging the edge, the lean and the tuck by `TUNING.skier.lag` and `crouchRate` |
| `pwa/src/game/skier-stroke.ts` | THE ARMS' STROKES (`DOUBLE_ARM` swung from the shoulder, `STRIDE_STROKE` off the stance; each pushed pole biting the snow behind its fist, `strokePole`, a rod turned through the cycle, its recovery a heading and a tilt carried clear of the snow), THE PUSH HELD TO THE SNOW (`holdPush`, `pinnedSwing`: the arm driven back as fast as the snow passes the basket where it bit, off the pose at the plant) and THE TURN'S POLE PLANT (`TURN_PLANT`, `plantPole`: the rod swung round the outside to the snow ahead and back); `skier-vec.ts` the few vectors both are posed with |
| `pwa/src/game/skier-gait.ts` | THE GAIT at a crawl (`gaitOf`): the double pole he sets off on, the diagonal stride (only up a rise), the skate's V off the pushing ski's inside edge, and what each does to each ski as drawn |
| `pwa/src/game/skier-limbs.ts` | The limbs' geometry: `solveLimb`, the boot's frame and the knee its cuff allows (`bootFrame`, `bootKnee`, `CUFF`) |
| `pwa/src/game/skier-spring.ts` | The view's own state between frames: the body's spring on its legs, the air and a jump's load eased, the hips, edge, roll and the skid's pivot followed (`drawnSkiAngle` — the skis are drawn on it too), the start gate's stance eased in and out (`ready`, off `inStartGate`), his own clock |
| `scripts/skier-metrics.mjs`, `scripts/lib/skier-measure.mjs` | THE METRICS LAB: the pose measured (angles, the shins in their boots, the centre of mass over the feet, angulation, the head against the horizon, limbs through limbs, snaps) and held to bands |
| `tests/world_render_test.ts`, `tests/skier_pose_test.ts` | The pose held: boots in the bindings, each shin in its boot, hands on the grips, the carve an inclined column hinged at the hips, the eyes toward the horizon, the back rounded in the tuck, compact in the air, alive stood still; the half bones turn half way and the hands close round the poles |

## How he is posed

1. The HIPS go where the engine has put his mass — `hipRight`, `hipAft` off
   `MOUNTS.hips` — as far as the BOOTS ALLOW: the legs lean with the skis'
   own tilt in the pair's frame (`edge` − the pair's `roll`), the hips
   within a band of it the knees angulate (`KNEE_IN`, more on a steep edge,
   `KNEE_STEEP`), measured from the edged boots and swung over them as a
   column of the legs' own length — never slid across at a standing
   height. The whole lower body stands in the SKIS' frame, turned with the
   skid's pivot; the PELVIS turns with the skis as a hockey stop throws them
   across (the hip joints, `SkierPose.hipJoints`, lie along it). The body
   above the boots follows the engine's hip shift, edge and roll on the
   view's critically damped spring (`SkierSpring.hip`, `.edge`, `.roll`):
   those readings start and stop at full rate, and a step in their rate is
   a snap at the head.
2. The BOOTS are IN THE BINDINGS (`MOUNTS.boot`, one a ski) and EACH SHIN
   IS HELD BY ITS BOOT: in the boot's own plane (`SkierPose.boots` — turned
   and tipped with the ski), leaning forward of the ski's normal at least
   the cuff's own lean (`CUFF`). The knee is found on that plane
   (`bootKnee`) and the leg solved through it; a hip too high for the cuff
   SINKS until the knee can be reached — a skier in ski boots never stands
   on straight legs.
3. A CARVE is an INCLINED COLUMN WITH A HINGE AT THE HIPS: the legs lean
   in with the skis, the trunk comes back up `ANGULATE_SHARE` of the legs'
   lean IN THE WORLD, never out past the vertical. The shoulders
   COUNTER-ROTATE toward the outside ski (`TWIST`), the pelvis half as far,
   by how far into the turn the hips are — never by the steer key, which
   flips in a step.
4. The BACK is two spans (`SkierPose.waist`: the lumbar and the chest's),
   bent through `SPINE_ROUND` — near straight standing, rounded in the
   tuck, curled over the poles and folded by a landing.
5. The HEAD keeps the EYES TOWARD THE HORIZON: it rolls back off the
   trunk's lean in the world (the pair's own `roll`) to `HEAD_LEAN` of it,
   as far as `NECK_ROLL` turns it (`SkierPose.headRoll`).
6. The HANDS hold the POLE GRIPS, forward and apart; each elbow bends in
   the plane through the shoulders' line (down for a fist ahead, back and
   up for a fist driven behind) with a small outward flare — never a fixed
   pole vector, which an arm swung along it flips across.
7. In the AIR he is COMPACT (`AIR_SINK`: the body sinks toward the skis,
   the knees stay bent) and goes into the air and out of it as MOTIONS —
   the view's `SkierSpring.air` and `load` ease the flag and the jump's
   load (`skier-spring.ts`); a fresh LANDING folds the knees on the
   spring; a GRAB folds him to a ski.
8. STOOD STILL (`idle`, faded in below a walk) he breathes, shifts his
   weight, glances about and works the grips on his own clock — started at
   his kit's own offset so four on a start line are not in step. IN THE
   START GATE (`ready`, eased off `inStartGate`: the lights, and a rival
   still held after GO) he crouches over poles planted ahead of the wand,
   the arms set at the double pole's plant — so GO's first push starts
   from where he stands (every first push starts at its plant).
9. AT A WALK the skis are drawn on their bases (`skiTilt`'s `WALK_TILT`):
   the engine steers a crawl on a full edge, and a figure stood on a 40°
   edge with no speed to lean on is a man tipped over sideways.
10. THROWN, the ragdoll's foot is the ANKLE: the cloth stops at the cuff up
   that shin and the FOOT in its boot's liner is squared below it — the
   model's feet ride the boot bones, hidden in the shells on the skis.

Everything he does is a `SkierState` field the engine wrote (`hipRight`,
`hipAft`, `crouch`, `lean`, `steer`, `edge`, `roll`, `skiCompression`,
`airborne`, `landing`, `jumpLoad`, `popped`, `drive`, `speed`) or
`TrickState.pose`, eased only by the view's own spring; nothing re-derives
intent from physics deltas.

## The loop

00. `make skier-metrics ARGS="--json=previews/metrics-before.json"` BEFORE
   the change and `ARGS="--compare=previews/metrics-before.json"` after —
   the pose measured against a skier's bands, frame by frame, in seconds.
   `ARGS=--faults` lists every fault. Read the `skier-improvement` skill for
   what each band means and how a fault is chased.
0. `make skier` (`MOVE=skate,jump` a subset; `ARGS=--code` the code's
   figure) — the skier IN MOTION: `previews/skier-<move>.png`, a column a
   moment across the move's window and a row a view (behind, the rear
   three-quarter, the side, the front three-quarter, the front), and
   `previews/skier-turntable.png`. Every move is `scripts/lib/skier-moves.mjs`
   — a run the engine skis — so a pose number is judged on what the game
   really does, frame after frame: a twitch, a boot off its ski or an arm
   through the body shows up a column later.
   At the lab's MOMENTS: `ARGS=--sheet=closeup` (four sides, big cells),
   `--sheet=detail` (each hand on its grip, the boots, the head, the
   jacket front and back), `--sheet=game` (the chase and far cameras at a
   1280×720 frame's own pixels, enlarged unsmoothed — what a player reads)
   and `--sheet=stretch` (the skin coloured by each triangle's stretch off
   its bind, the share outside the band printed by region).
1. `make skis ARGS=--sheet=skier` — him CLOSE UP in the poses that read
   most, from behind at the chase camera's height, the rear three-quarter,
   the side and the front three-quarter (`--slot=n` another kit). Judge the
   clothing here; a dark kit hides its folds, so light the pants in a
   scratch copy of the style to see them, and never commit it. The HEAD
   has its own sheet, `make skis ARGS=--sheet=head`: the helmet alone in
   every kit from the front, three-quarters, the side, the rear
   three-quarter, the back and the chase camera's height, and a PROFILE on
   a centimetre grid centred on the head's middle. A helmet change starts
   from a PHOTOGRAPH of a real one (a freely licensed one, kept out of the
   tree): grid it, scale it to a known length, read the numbers off it, and
   lay the profile beside it at the same scale.
2. `make world SEED=38 ARGS=--views=orbit,far,jump,landing` — round him,
   at range, in the air and coming down. Judge from BEHIND first (that is
   the game's view), then the side for the stance, the crouch and the
   poles.
3. A pose change is a number in `skierPose` or `MOUNTS`; a body change is
   `BODY`; a look change is `skier-figure.ts`'s figure or a `SkierStyle`. One
   axis, re-shoot, look.
4. `npx vitest run tests/world_render_test.ts tests/skier_pose_test.ts` —
   the pose cases.
5. `make build`, then `make screenshots` (a bright seed) and crop the skier
   at 3× to judge; at 1280 px he is sixty pixels tall and a pose reads only
   as a silhouette.
6. `make profile`: four skiers on the start line, each merged into his
   skis' one draw (`posed-merge.ts`) — that is the invariant, not the
   triangle count.

## Judging him

- **From behind, at sixty pixels, he must read as a skier on his skis**: the
  helmet, the shoulders, the jacket against the snow, the poles out, the two
  skis under him. Contrast does the work, not detail — and a skier in white
  is gone.
- **Boots in the bindings, hands on the grips, always.** A boot floating off
  a ski is the first thing a player sees.
- **The body answers the skis.** Carve: he angulates inside it. Lean back:
  he sits back and the tips lift. Tuck: he folds, the poles come under his
  arms. Air: he stands and draws the skis up. Landing: the knees take it,
  then settle. Nothing snaps — every motion is the engine's own lag or a
  spring.
- **Proportions are `BODY`'s.** Fix a REACH at the mounts or the pose, never
  by lengthening a leg or an arm.

## A modelled skier

`make blender KIND=skier` models him in Blender off `BODY`, the skiing
stance and the helmet's measured shell — his flesh the ANSUR II survey's mean
man and his kit a racer's (a padded shell jacket, a back protector under it,
shin and forearm guards, tall buckled boots, gloves), which is also the
reference to hold this figure's proportions to — skinned on bones that ARE
the pose's spans (`pwa/src/game/skier-rig.ts`'s `skierBones`), with clips
sampled off `skierPose` and `stepSkierSpring` — so a change here moves the
model and its clips on the next run.
`make skis ARGS="--sheet=figure --skier=previews/blender/skier0-lod0.glb"`
sets it beside this figure in every pose. `blender-assets` owns it.

## Thrown

Once the engine has him off his skis (`SkierState.thrown`, the `crash`
skill), the figure is hung on the engine's ragdoll: `ragdollPose` reads the
trunk's frame and every joint off `Thrown.points`, and `skis-body.ts` lays
him in the root's frame at that place and turn so the one merged draw still
carries him; `interp.ts` carries the points between two steps and
`trail-stamp.ts` presses every bone of him into the snow. The skis go on
without him — the yard sale — drawn where the engine left them.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth recording: a
pose number that fixed a read at chase range, a mount a spec change broke, a
motion that read as a twitch.

---
name: skier
description: "Use when working on THE SKIER — the figure standing on the skis: how he is posed on them (the boots in the bindings, the hands on the pole grips, the knees bent, the stance a ski is skied in), how his body answers the engine's readings (the knees folded by the legs' compression, the hips angulated inside a carve, the weight fore and aft with the lean, the crouch of the tuck, the poles planted at a crawl and tucked under the arms at speed, standing taller in the air, a landing folded into the knees, the grabs of a tricks run), and how he looks from behind at chase range. Owns `pwa/src/game/skier-pose.ts` (the pose as three-free arithmetic: `BODY`, `MOUNTS`, `solveLimb`, `skierPose`, and the body on its legs — `createSkierSpring` / `stepSkierSpring`), `skier-figure.ts` (the figure in his kit), `skier-cloth.ts` (the cloth he is built of) and `skier-helmet.ts` (the head, the helmet and the goggles), the skier's cases in `tests/world_render_test.ts` and `tests/skier_pose_test.ts`, and the loop: `make skier` (every MOVE — setting off, the skate, the double pole, the jump, the hockey stop, the hard cut, the tuck, a landing, a wipeout — skied by the real engine and the committed models posed through its states from five sides, and a turntable), `make skis ARGS=--sheet=skier` (close up), `--sheet=poses` and `--sheet=landing`, `make world` (orbit, jump, landing), then the built app with `make screenshots`."
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
full tuck — the back flat, the poles under the arms, the head up. **HUNG
INSIDE** a carve his hips go past the outside ski (`HANG` × the engine's
`hipRight`) and his shoulders stay nearer level (`HANG_ROLL` — the
angulation, not a lean of the whole body), the inside knee driven in, the
head looking round the arc. **THE GAIT** at a crawl is the engine's own drive (`gaitOf`, off
`SkierState.drive` and `stride`, the same strides the push comes in —
`poles.ts`): SKATING, the skis opened into a V, a leg pushed out along its
ski and lifted back in while the hips ride the other, and DOUBLE-POLING,
both poles planted ahead, the trunk folded over them and the arms swept
through past the hips; one statement the skis (`ski-gear.ts`, `ski-rig.ts`)
and the figure both read, so a boot never leaves its ski. A JUMP loading
(`jumpLoad`) sinks him and draws the arms back; the pop (`popped`) throws
them up. CUT HARD (`carve`) the angulation deepens and the inside hand goes
toward the snow; in a HOCKEY STOP (`skid`) he sits into it, the shoulders
facing on down the hill. His SHIN BENDS ONLY ABOVE THE BOOT'S CUFF
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
| `pwa/src/game/skier-pose.ts` | `BODY` (the limb lengths and proportions, m — the same bones `TUNING.crash.body` throws, `tests/crash_test.ts` holds the two together), `MOUNTS` (where the bindings, the pole grips and the base hips are fixed to the skis), `solveLimb` (two bones toward a target, bent toward a pole), `skierPose(input)` → every joint; `ragdollPose` (the figure hung on the engine's `Thrown.points` once he is off his skis). Three-free, so the suite reads it |
| `pwa/src/game/skier-figure.ts` | `createSkier(style)`: the figure in the slot's `SkierStyle` — each limb a fixed shape hung from its joint and turned to face its bend (only ever turned, never stretched), the torso in its own frame, the helmet |
| `pwa/src/game/skier-helmet.ts` | The head, the helmet and the goggles, in the head's frame: `helmetShell` (the outer skin laid on an around-and-up grid with the port's cells left open, the liner, the rim along every open edge), `buildHelmet` (the head and chin, the goggles on the face, the strap, the vents) |
| `pwa/src/game/skier-cloth.ts` | What he is built of: `shaped` (rings of a rounded box along a line, smoothed and folded, rings laid only as densely as a fold needs), `cloth` (a limb's creases and pads), `torsoFold` (the jacket gathered, draped, the blades under it). A crease wants three rings a ridge or it breaks into a saw |
| `pwa/src/game/posed-merge.ts` | The posed tree — skis, poles and skier — drawn as ONE mesh, every part a rigid BONE of it, so the GPU lays each part through its matrix (in every pass, the shadows included); a part hidden with its ancestors (the skier in the helmet view) collapses to nothing |
| `pwa/src/game/skis-body.ts` | Hangs the skier on the skis; the bindings and the poles he is fixed to are drawn there |
| `engine/game/skier.ts` | Where his MASS actually is: `hipRight`, `hipAft`, `crouch`, `edge` and `skiCompression` on `SkierState`, lagging the edge, the lean and the tuck by `TUNING.skier.lag` and `crouchRate` |
| `tests/world_render_test.ts`, `tests/skier_pose_test.ts` | The pose held: boots in the bindings, hands on the grips, a hang to the right moves his hips right, a lean back moves him back, a full tuck folds him under a height |

## How he is posed

1. The HIPS go where the engine has put his mass — `hipRight`, `hipAft` off
   `MOUNTS.hips` — so the physics' own lag is the pose's lag.
2. The TORSO pitches with `lean` (+1 back sits the hips down and back, −1
   throws him forward over the tips), folds with `crouch` into the tuck,
   and counter-rotates over the outside ski in a carve (`edge`).
3. The BOOTS are IN THE BINDINGS (`MOUNTS.boot`, one a ski), and each leg is
   solved back to its hip with the knee forward and in, bent by that ski's
   `skiCompression`. A binding out of reach is reached for along the same
   line, fully extended — a leg is never stretched.
4. The HANDS hold the POLE GRIPS (`MOUNTS.grip`), forward and apart in the
   stance, swung with the plant at a crawl, drawn in under the arms in the
   tuck; each arm is solved back to its shoulder with the elbow out.
5. In the AIR he stands taller and draws the skis up; a fresh LANDING
   (`landing`, seconds since the last) folds the knees and recovers; a GRAB
   (`TrickState.pose`) folds the body to the ski, kicks the skis apart or
   fore and aft.

Everything he does is a `SkierState` field the engine wrote (`hipRight`,
`hipAft`, `crouch`, `lean`, `steer`, `edge`, `skiCompression`, `airborne`,
`landing`) or `TrickState.pose`; nothing re-derives intent from physics
deltas.

## The loop

0. `make skier` (`MOVE=skate,jump` a subset; `ARGS=--code` the code's
   figure) — the skier IN MOTION: `previews/skier-<move>.png`, a column a
   moment across the move's window and a row a view (behind, the rear
   three-quarter, the side, the front three-quarter, the front), and
   `previews/skier-turntable.png`. Every move is `scripts/lib/skier-moves.mjs`
   — a run the engine skis — so a pose number is judged on what the game
   really does, frame after frame: a twitch, a boot off its ski or an arm
   through the body shows up a column later.
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

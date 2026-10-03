---
name: ski-design
description: "Use when designing or changing how the SKIS LOOK — a pair's silhouette from the side and from above (the tip's rise, the sidecut's waist, the tail), the bindings and the boots on them, the poles, the topsheets (the paint, the trim, the graphic) and each pair's ONE topsheet, its graphic cut into the Blender model too. Owns the low-poly builder (`pwa/src/game/skis-body.ts` the skis, the bindings and the boots; `ski-gear.ts` the poles and what moves — the skis turned by `skiAngle`, tipped by `edge`, riding their leg's compression — both built in the engine's own body frame off `defs/skis.ts` and each class's TRACED LOOK in `ski-looks.ts`), the topsheets (`ski-topsheets.ts`), the style a pair is dressed in (`pairStyle`, each slot's skier `SLOT_DRESS`), and the trace-render-compare loop: `make skis` for contact sheets of every pair by view, topsheet and pose, `make world` for a skied run, then the built app with `make screenshots`, LOOK, refine, then verify at speed."
---

# Ski design

A pair of skis is not modelled in a DCC tool: it is **generated**, off two
sources. Its SPEC (`engine/game/defs/skis.ts`) says how long the skis are,
how wide at the tip, the waist and the tail, where the boot stands on them
(`mount`), how far apart they stand (`stance`) and how much the tip is
lifted (`rocker`); its class's TRACED LOOK (`pwa/src/game/ski-looks.ts`) says
what it looks like — the tip's rise and its point, the sidecut's curve seen
from above, the tail's shape (a flat tail on a race ski, a lifted twin-tip
on the park ski), the binding's toe and heel pieces, the boot's cuff — traced
point by point off a studio photograph of a real ski of the class, drawn back
over the photograph to check the line, scaled by the class's published
length, and kept as metres with no make or model. `lookFrame` carries a trace
onto a spec by pinning the traced boot centre to the spec's `mount` and the
traced tip and tail to its `length`; the spec's widths were themselves read
off the trace, so the stretch is 1 (`tests/topsheet_test.ts`). The skier is
carried by the traced binding's height over the base, so his boots stand on
the bindings the trace drew (`MOUNTS.boot` in `skier-pose.ts`). Designing the
skis means editing a trace, the builder or a topsheet and LOOKING, never
guessing from numbers.

**Before starting, read this skill's lessons** —
`npx ogf-skill-lessons ski-design --list`. Load `skill-reflection`
at both ends, and `write-code` beside this skill for any code change.

## Where everything lives

| Piece | Role |
| --- | --- |
| `pwa/src/game/ski-looks.ts` | THE TRACES, one per class, in the trace's own frame (z forward from the tail, y up from the base, x out from the ski's centreline), and `lookFrame` onto a spec. Three-free |
| `pwa/src/game/skis-body.ts` | THE SKIS (`createSkiModel`): each ski lofted off the traced profile and the spec's widths — the tip's rise, the camber and the rocker, the sidecut's waist, the tail — with its steel edges as a dark line, the topsheet's paint and graphic on its deck, the binding (toe, heel, the brake arms) at the mount, and the boot in it; and the skier. `pairStyle` dresses a pair in its own topsheet with a skier on it (`SLOT_DRESS`: each start-line slot's outfit) |
| `pwa/src/game/ski-gear.ts` | WHAT MOVES, posed off the engine's readings: each ski turned by `skiAngle` (the skid's pivot and the edge's toe-in) and tipped by `edge` about its own long axis, riding its leg's compression under the boot; the POLES in the skier's hands — swung and planted at a crawl (`plantPulse`), tucked under the arms in a tuck — and their baskets |
| `pwa/src/game/ski-topsheets.ts` | THE TOPSHEETS: ONE per pair, never picked (the paint, the trim the graphic is cut in, the sidewalls' and bindings' dark, the boots' shell, the poles' shaft) and the GRAPHICS (twin rails, a stripe, a swoosh, a two-tone split, chevrons, a race block with its number panel) stated in the deck's own (u, v) — laid as decals on the code's pair (`decalGeometry`) and cut into the Blender model the same way (`scripts/blender/skis.py`'s `decal`, handed the pattern by `kinds/skis.mjs`), so a topsheet change is a `make models`. Never white, never pale blue: a pair must read against snow |
| `pwa/src/game/posed-merge.ts` | ONE DRAW PER POSED FIGURE: the skis, the poles and the skier are posed as a tree of small meshes (a group a ski, a capsule a limb), but every part is taken off the picture and what is drawn is one vertex-coloured mesh per skier, each part a rigid bone of it that the GPU lays through the part's matrix (a skinned mesh, so every shadow pass follows the pose). A new part goes into the tree and is merged like the rest, never drawn on its own |
| `pwa/src/game/skier-figure.ts`, `skier-pose.ts` | The skier — the `skier` skill's. His boots and his hands are fixed to this builder's bindings and pole grips through `MOUNTS` in `skier-pose.ts`, so moving the bindings or the poles moves him |
| `engine/game/defs/skis.ts` | NOT this skill's file — the physics' spec. The builder READS `length`, `waist`, `tipWidth`, `tailWidth`, `sidecut`, `rocker`, `stance`, `mount`, `cogHeight`, the legs' travel, `poleReach`; a style never restates them |
| `pwa/src/game/renderer.ts` | Places each model off its `SkierState` (interpolated in `interp.ts`) — the mesh's origin is the CoG, so it pitches and rolls about the point the physics does. A slot whose run is on another pair than its model was built off is REBUILT (a new pick skied on the same map) |
| `pwa/src/game/ski-turntable.ts` | The ski card's rack: the same builder, in the topsheet picked, the pair stood on a disc of snow with the skier beside it, turning (`make screenshots ARGS="--surface skis,skis-powder"`, or `?menu=skis&skis=<id>`) |
| `scripts/skis-preview.mjs`, `pwa/src/tools/skis-harness.ts` | `make skis` — THE SKIS LAB: contact sheets built with the game's own builder. `asset` (`--asset=a.glb`: a pair MODELLED in Blender beside the builder's — the `blender-assets` skill), `pairs` (every pair by side, above, front, three-quarter and chase — the elevations orthographic on a metre grid), `topsheets`, `poses` (one pair, every pose the skier takes), `landing` (the body on its legs through a landing, a frame every 60 ms). No `make build` |
| `pwa/src/identity.ts` | The PALETTE — the player's slot is `PALETTE.flag`, the slalom red |
| `scripts/world-preview.mjs` | `make world` — one map skied by the bot, photographed through the game's own renderer at named views (`tips`, `helmet`, `far`, `orbit`, `jump`, `landing`, …). Its own bundle, no `make build` |

## The loop: world → LOOK → iterate → the built app

1. **Shoot the current state**: `make skis` (every sheet; `ARGS="--sheet=pairs
   --views=side,above --cell=640"` for silhouettes big enough to judge a
   line), the pairs on the ski card (`make screenshots ARGS="--surface
   skis,skis-powder"`), then `make world SEED=38
   ARGS=--views=orbit,far,jump,landing` (with
   `CHROMIUM_PATH=/opt/pw-browsers/chromium` in a web session). `orbit` walks
   round the skier; `far` is his read at range; `jump` and `landing` show the
   skis hanging and the legs taking the hit. Keep the pictures — the PR owes
   before and after.
2. **Change one axis at a time** — a profile, a proportion, a colour — and
   re-shoot. A change that moved three things teaches nothing.
3. **LOOK — with the Read tool.** Judge the silhouette from the side, from
   above (the sidecut has to read) and from behind.
4. **Then the built app**: `make build`, then `make screenshots` (the chase
   camera at its real range, at every reference viewport). The landscape
   frame is the verdict; `make world` only diagnoses.
5. **`make profile`** — the skis are four pairs on the start line; a part
   that added a draw call added four.

**A NEW TRACE** is taken the way the six were: a clean studio side view and
a top view of a real ski of the class (kept out of the repository, and
nothing about it named), pixel picks cropped and zoomed, scaled by a
published length, the polyline drawn back over the photograph and LOOKED at
before a number is kept, then the widths read into the spec.

## Judging the skis

- **The chase view is the verdict.** The skier is judged from behind and a
  little above, at speed, maybe 60 px tall — the two skis either side under
  him, the tails and the edges biting, the poles tucked, must read THERE.
- **It reads as a pair of skis.** Two long narrow planks with lifted tips,
  bindings at their middles with boots clamped in, a sidecut visible from
  above, poles in the hands. A pair that reads as a snowboard or as two
  planks with no tip has lost a line.
- **Six classes told apart at a glance.** The downhill ski is LONG and narrow
  with a low tip, the slalom ski short, the powder ski fat with a lifted
  tip, the park ski turned up at both ends. Judge the six side by side on the
  `pairs` sheet from above.
- **Four slots, told apart at a hundred metres against white.** The player's
  red, and three rivals chosen for contrast against snow and pine — never
  white, never pale blue. A rival colour that vanishes in the snow is a race
  nobody can read.
- **The skis are on the snow.** At rest the drawn skis sit at the sag the
  legs settle at (`rest` in `make ride`); a pair drawn above its own
  contacts hovers, one drawn below sinks through its own trail. An edged
  ski stands on its edge, the deck tipped inward — a ski that carves flat
  is a picture the physics contradicts.
- **Match the world's art direction**: faceted low-poly, flat-shaded under
  the scene's sun and sky light, colours as hex in the style table or the
  palette. Judge under a low sun as well as at midday (`?seed=` deals the
  hour; pick a seed with an early one).

## The rules

- **The builder reads the spec; the style adds only what the spec does not
  say.** Colours are style; the length, the widths, the mount and the stance
  are the spec's. A drawn dimension that restates a physics number drifts on
  the next spec change.
- **The mesh's origin is the CoG.** The physics pitches and rolls about it; a
  mesh whose origin is the boot swings the tips through the snow for nothing
  the physics did.
- **What moves, moves off the engine's readings.** The skis' pivot is
  `skiAngle`, their tip about the long axis is `edge`, not the input; each
  ski's travel is its leg's compression; the crouch is `crouch`. A part
  animated off the INPUT leads the physics and reads as a puppet.
- **Build once, move per frame.** Geometry and materials are built once per
  model; the renderer only moves them. An allocation in the frame loop is a
  leak that shows as a stutter minutes in.
- **One draw per skier.** `posed-merge.ts` draws the whole posed tree as one
  mesh; a part added outside it is a draw call times four skiers times the
  shadow pass. `make profile` holds the count.
- **The skier reaches what is drawn.** Moving the bindings or the pole grips
  moves `MOUNTS` with them, or his boots float off the skis and his hands
  hold nothing — `tests/world_render_test.ts` reads the pose.

## What the change obliges elsewhere

- `make world` before and after, `make screenshots`, `make profile` in the PR.
- A `.changes/unreleased/` fragment — the skis are under the player's feet
  for the whole run.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. What belongs here:
a proportion that reads wrong at chase range and right up close, a colour
that vanishes against snow or pine, a part the builder was missing.

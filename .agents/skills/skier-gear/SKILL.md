---
name: skier-gear
description: "Use when working on WHAT THE SKIER WEARS — the gear catalog (`pwa/src/game/outfit.ts`: two BODIES, the JACKETS, PANTS, HELMETS, GLOVES and POLES, each sold in its own colours, the default kit and each rival's), how a piece is CUT (the loom `dress-loft.ts`: lofted tubes and rigid parts laid in the rig's bind pose and weighted across its bones; the body's measure `dress-body.ts`; the jackets and pants `dress-garments.ts`; the helmets, the braid and the gloves `dress-head.ts`; the outfit cut and kept `dress.ts`), how a dressed skier is DRAWN (`skier-dress.ts`: the skin on the rig, posed bone for bone by the game's pose; the poles in `skier-figure.ts`), the DRESS card behind the ski card's CUSTOMIZE SKIER press (`menu-dress.tsx`, `Settings.outfit`), and the loop that judges it: `make gear` — every piece from every side, every outfit, one outfit through the moves, the game's own pixels, the triangles, a Blender skier beside the dressed one, and local reference photographs beside the pieces. Adding a jacket, a pair of pants, a helmet, gloves or poles, a body, a garment's cut or colourway, a fit at a joint, or the dress card's rows."
---

# The skier's gear

The skier is drawn as **his clothes**: an OUTFIT (one body, one jacket, one
pair of pants, one helmet, gloves and poles off `outfit.ts`) is cut onto a
loom in the pose the rig is bound in, every vertex weighted across the
rig's own bones, and the game's pose bends it bone for bone — the knee, the
hip, the elbow and the small of the back as one cloth. Nothing is drawn
under the kit: a garment is the body's MEASURE plus its EASE, so the jacket
is his silhouette and the face is the only skin. Every piece is SOLD IN ITS
OWN COLOURS — nothing is painted on the DRESS card, as a pair of skis is its
one topsheet.

**Why procedural, not Blender.** The gear is a catalog to MIX: six slots of
four or five pieces is hundreds of skiers, two bodies under every jacket.
A modelled skier is one suit (`make blender KIND=skier`, kept as the labs'
comparison): to mix it, every garment would be a skinned mesh of its own
re-made through Blender on every change (some 55 s a build), re-stamped and
committed, and a woman's body a second suit under each. Cut in code, a
piece is a few sections and a colour rule, built at run time in tens of
milliseconds from the very bones the pose drives — and `make gear
--sheet=compare` sets the two side by side at the same moves (the dressed
skier reads as a jacket over pants, yoke, zip and hem, at fewer triangles
than the model's 9,920). Change a garment HERE, never in a builder.

**Before starting, read this skill's lessons** —
`npx ogf-skill-lessons skier-gear --list`. Load `skill-reflection` at both
ends, `write-code` beside this for any code change, `skier` when the POSE
is what moves (the dress never moves a joint), and `menu-system` for the
card's chrome.

## Where everything lives

| Piece | Role |
| --- | --- |
| `pwa/src/game/outfit.ts` | THE CATALOG: `BODIES`, `JACKETS`, `PANTS`, `HELMETS`, `GLOVES`, `POLES` (each a real kind of kit, its colours its own), `GEAR` / `GEAR_SLOTS` (the card's order), `DEFAULT_OUTFIT`, `RIVAL_OUTFITS` (each rival's jacket in his slot's colour, `skier-colours.ts`), `outfitOf` (a stored blob made an outfit), `stepGear`, `coloursOf` (an outfit's colours as a modelled skier's materials). Three-free, DOM-free |
| `pwa/src/game/dress-loft.ts` | THE LOOM: `bindPose` (the rig's `STANDING` frames), `clothWeights` (the Blender suit's rule ported: shared between the nearest bone and its neighbours, the half bones across a hinge, the trunk split pelvis to chest), `createLoom().tube` (a superellipse loft along a centreline, sections smoothed, a fold, a colour rule cut on exact ring and column lines — `cuts`, `angles`), `.rigid` (triangles riding one bone), `linear` (sRGB to the vertex colour's linear) |
| `pwa/src/game/dress-body.ts` | THE BODY AS MEASURES: the ANSUR II means for the man (the Blender suit's own) and the woman, laid on the game's ONE skeleton (`BODY` — the engine's ragdoll's too), so a woman is her measure, never other bones |
| `pwa/src/game/dress-garments.ts` | THE JACKETS AND THE PANTS: each cut (`JACKET_CUT`, `PANTS_CUT`: ease, hem, flare, quilt), the seat and the jacket clear of it (`seatAt`), the colour rules, the collar and the neck gaiter, the hood, the sleeves, the legs, the feet in their liners |
| `pwa/src/game/dress-head.ts` | THE HEAD AND THE HANDS: `helmet-shape.ts`'s measured shell under each helmet's own parts (the freeride's ear pads and peak, the visor, the slalom chin guard), a woman's braid, the gloves (the fist on the hand bone, the cuff on the forearm's) |
| `pwa/src/game/dress.ts` | `dressOutfit` — an outfit (and a skin's tone) cut once into its two meshes and kept |
| `pwa/src/game/skier-dress.ts` | `createDressed` — the two meshes (cloth, matt; hard goods, a shine) skinned on a skeleton of `SKIER_BONES`, posed by `skierBones`; a ghost's colours washed pale |
| `pwa/src/game/skier-figure.ts` | The figure: the dressed skin, the outfit's POLES (alloy, carbon, the downhill racer's bent shaft, the powder basket's petals) and the head's frame the lamp hangs on |
| `pwa/src/game/menu-dress.tsx` | THE DRESS CARD (and `SkisCards`, how the shell routes it with the ski card): six `StepRow`s and the skier on the ski card's stand framed on him |
| `scripts/gear-preview.mjs`, `pwa/src/tools/gear-harness.ts`, `pwa/gear-preview.html` | THE GEAR LAB (`make gear`) |
| `scripts/dressed-skier.mjs` | THE DRESSED SKIER AS A glTF: `DEFAULT_OUTFIT` cut on the loom and written skinned for Blender — the TITLE SCENE poses this one (`title_rider.py`), so a change to any dress module stales the title's stamp (`plates.ts`'s `TITLE_SOURCES`) and owes `make title-scene` |
| `tests/outfit_test.ts` | The catalog, the pick kept, and every outfit's skin: whole weights on the rig's bones, colours its pieces' own, the triangle budget, a woman's waist, and the jacket over the pants through a full tuck |

## The loop

1. **Before**: `make gear` (every sheet but refs) — keep the PNGs.
   `SLOTS=jacket` narrows the catalog; `OUTFITS=0,woman.anorak.cargo.slalom.race.speed`
   names outfits (start-line slots or seven ids).
2. **References, local only**: photographs of the real kind of piece (a
   studio front and back, a skier seen from behind) in the session's
   scratchpad, named by slot (`jacket-1.jpg`, `pants-2.jpg`), never under
   the tree and never named for a maker — `make gear ARGS="--sheet=refs
   --refs=<scratch dir>"` sets them beside the pieces as drawn. A free
   public media archive serves thumbnails; space the requests or it
   answers 429.
3. **Cut**: a piece is its row in `outfit.ts` and its cut (`JACKET_CUT`,
   `PANTS_CUT`, a helmet's parts) and colour rule. Keep a new colour edge
   on a ring or a column (`cuts`, `angles`), or it is a stair of faces.
4. **Judge**: `catalog` (the piece from four sides and close), `poses` (it
   through every move — a garment's fault shows at a joint first: the
   tuck, the grabs, a carve), `game` (the chase and far cameras' pixels:
   contrast does the work, detail does not), `wire` (where the triangles
   went), `compare` (beside a modelled skier: `ARGS=--model=previews/blender/skier0-lod0.glb`
   after `make blender KIND=skier ID=skier0 ARGS="--quality=game --views=none"`).
5. **Hold**: `npx vitest run tests/outfit_test.ts` — add a piece and the
   suite cuts it in every combination the catalog makes.
6. `make build`, `make screenshots ARGS="--surface skis,dress"` and a race
   (`--scene grid,race`) — the field in its outfits on the snow.

## Craft (what the first pass learned)

- **Layer by ease, and keep the layers on the same bones.** The pants'
  seat and the jacket over it ride the trunk ALONE (`among: ["spine"]`);
  a share of a thigh on the seat, or of an arm on the jacket's hem,
  swings one through the other as the hips fold. The legs carry the
  thighs, from the HIP JOINT down — a thigh lofted above the joint swings
  out through the seat in a tuck.
- **The rig's hip joints stand a stance apart** (`BODY.hip` 12 cm, wider
  than a body's): draw the thighs' tops in (`HIP_IN`) and close the seat
  in to the waist above them (`seatAt`), or the pants bulge past the hips
  and a woman's waist is never narrower than a man's.
- **Loft straight down under the seat**, not down the pelvis's axis: the
  pelvis is pitched forward and a long hem lofted along it juts out behind.
- **A sleeve starts INSIDE the torso and is capped**: a big first ring at
  the shoulder joint stands proud of the shoulder line as spikes.
- **Fill the neck**: a knit gaiter from the collar up to the helmet's rim,
  or the background shows between them.
- **A woman is her measure** (ANSUR II's women's means), a TAILORED cut
  (the jacket taken in at the waist) and a braid out from under the
  helmet — never other bones: one skeleton is every pose and animation.

## Skill self-improvement

Load **`skill-reflection`** before a session that used this skill commits.
Worth recording: a fit fault at a joint and the weight or ease that cured
it, a piece that read at chase range (or vanished), a reference that
changed a cut.

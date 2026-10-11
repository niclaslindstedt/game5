---
name: airplane
description: "Use when working on THE JUMP PLANE — the free ride's single-turboprop, strut-braced high-wing utility plane on wheel-skis that the player flies by hand from its strip below the village, the skier stood in its open door: its design and its model in Blender (`make blender KIND=plane`, `make models KIND=plane`, `pwa/models/plane.glb`), the six-degree-of-freedom flight model and its tuning (the sections and their stall, the trim, the rigging against the propeller, the player's stick reach and the pull to the buffet), the aerobatics `make plane-flight` holds (loops, rolls, the hammerhead, inverted flight, the spin), the pilot's hands (take-off, the climb, the jump run, the way home and the landing), the cockpit and the camera ladder (TIPS the cockpit, HELMET his eyes in the door), the AIRSTRIP (its search, its obstacle corridor, its site and solids — and why nothing else may avoid it: the digest trap), the crash and the burning wreck, the sound, the `make plane` lab's sheets, and the AIRBORNE EDGE every craft in the air shares (`airBounds`, `AIR_BOUNDS`). Not the skydive out of its door (`skydive`), not the helicopter (`engine-system`, `blender-assets`)."
---

# The jump plane

The jump plane is a game of its own inside the ski game: a real airframe
flown by hand, as honestly as the helicopter, that can be looped and rolled
because the physics allows it and not because a script does. Every change
here is judged by two questions: **does the engine's number sit inside the
class's measured band** (`make plane-flight`), and **does it read right in
the game's own renderer** (`make plane`)? `docs/airplane.md` is the
description; this skill is the procedure.

**Read this skill's lessons first** — `npx ogf-skill-lessons airplane --list`.
Load **`skill-reflection`** at both ends, **`write-code`** beside this one,
**`blender-assets`** for the model, **`sound-effects`** for the sound,
**`buildings`** for the strip's buildings, **`game-feel`** for the lenses and
**`skydive`** for anything after the jump.

## Where it lives

| Piece | File |
| --- | --- |
| Every number and the geometry the model is built to — the mass, the wing, the tail, the fin, the engine and propeller, the controls, the gear, the door, the jump, the crash, the strip, the pilot's schedule | `engine/game/defs/plane.ts` (`PLANE`) |
| The step: the flight, the skis on the snow, boarding (`planeWithin`), the jump (`jump()` — the skydive's hook), stepping off, the crash (`struck`, `crash`), the restart, a lab's stand-up (`planeAloft`) | `engine/game/plane.ts`, `plane-state.ts` |
| The air on every surface: the sections' lift curves through the stall, the tail, the fin, the body's drag, the propeller's thrust (`thrustAt`), the rigging as section camber, the air at a moment (`planeAir`) | `engine/game/plane-aero.ts` |
| The bot's hands: `planeInput` in the door (never jumps), `homeControls` after the jump, `planeHold` for the labs | `engine/game/plane-pilot.ts`, hooked into `engine/sim/bot.ts` |
| The strip: the search (`airstripOf`, `onStrip`), its corridor (`airstrip-corridor.ts`), its markers and buildings (`stripSiteOf`), its solids (`meetStrip`, `ragdollOutOfStrip`, `planeBoxes`) | `engine/game/airstrip.ts`, `airstrip-corridor.ts`, `airstrip-site.ts`, `airstrip-solids.ts` |
| The fire: fuel burn, the fireball, the pool fire, the kinds | `engine/game/defs/plane-wreck.ts` (`PLANE_WRECK`) |
| THE AIRBORNE EDGE every craft shares | `engine/game/defs/air-bounds.ts` (`AIR_BOUNDS`), `collision.ts`'s `airBounds` / `airBoundsAt`, `TUNING.bounds.air` |
| The exports | `engine/game/plane-api.ts` (into `engine/index.ts`, which is at its cap) |
| The player's hands and keys: the eased stick, its reach with the airspeed, the pull to the buffet, the lever, the flaps | `pwa/src/game/input-plane.ts` (`samplePlane`), `settings-plane-keys.ts`, `input.ts`'s `PlaneHand` |
| The model: the builder and its kind | `scripts/blender/plane.py`, `plane_skin.py`, `plane_studio.py`, `scripts/blender/kinds/plane.mjs`; committed `pwa/models/plane.glb` + `sources.json` |
| Posed in the game: the model or the stand-in, the prop's disc, the surfaces, the door, the lamps | `pwa/src/game/plane-view.ts`, `plane-standin.ts`, `rotor-disc.ts`, `skier-models.ts` (`MODELS.plane`), `model-registry.ts` |
| Hung on the rider's line, the wreck and the crash lens wired, the inside decided | `pwa/src/game/plane-scene.ts`, through `machines.ts` |
| The cockpit | `plane-cockpit-plan.ts` (three-free: the layout, `planeGaugesOf`, `planeHeadOf`), `plane-cockpit.ts`, `-glass.ts`, `-paint.ts`, `-shroud.ts`, `-parts.ts`, `-pilot.ts` |
| The camera ladder | `pwa/src/game/camera-plane.ts` (three-free) |
| The crash as drawn | `plane-shatter.ts` (the cut and the break plan `BREAK`), `plane-wreck-view.ts`, `explosion.ts` (`ExplosionLook`), `fireball.ts`, `camera-crash.ts` |
| The strip as drawn | `strip-ground.ts` (three-free: the packed, combed ground stamp), `strip-build.ts`, `strip-view.ts`; `terrain.ts`'s `layGround`; the minimap's and the chart's strip |
| The HUD, the words | `plane-hud.ts` (DOM-free), `hud-plane.tsx`, `plane.css`, `strings-plane.ts`, `run-news.ts` |
| The sound | `audio/plane-voice.ts`, `plane-bed.ts`, `plane-bank.ts`; the listener's `cabin` and `doorway` columns |
| The start | `free-ride.ts`'s `PLANE_RUN`, `run-pick.ts`, `url-params.ts` (`?plane=1`) |
| The labs | `scripts/plane-flight-lab.mjs`; `scripts/plane-preview.mjs` over `pwa/plane-preview.html`, `pwa/src/tools/plane-harness.ts`, `plane-scenes.ts`, `plane-cockpit-scenes.ts`, `plane-crash-scenes.ts`, `plane-strip-scenes.ts` |

## The labs

- **`make plane-flight`** (pure Node, seconds) — before AND after every
  change to `PLANE`, `plane-aero.ts`, `plane.ts`, `plane-pilot.ts` or
  `input-plane.ts`: `ARGS=--json=previews/plane-before.json`, then
  `--compare=…`. The class rows (`roll` 200–300 m, `climb` ≈5 m/s,
  `top-high` 115–125 kt, `stall-clean` 52–58 kt, `stall-flaps` <52 kt,
  `glide`, `roll-rate`, `bounds` >0) and the AEROBATIC rows flown on the
  PLAYER's hand through `samplePlane` (`p-loop`, `p-loop-38`, `p-loop-38hi`
  — 360° each — `p-aroll`, `p-barrel`, `p-hammer` 150–210°, `p-invert`,
  `p-spin`). `SEED=` flies the roll on a generated map's own strip.
- **`make plane`** (browser, its own bundle) — every sheet before and after a
  change to the look: `model` (eight sides, day and night), `strip` (the
  roll and lift-off), `flight` (six sides on the pilot's hands, the surfaces
  held over), `door`, `lenses`, `cockpit` (the eye on the strip, climbing,
  banked, a FLOWN loop's top, night; the panel, displays, quadrant,
  overhead, pedals, controls thrown, the pilot from outside), `crash` (the
  fireball, the wreck at 5/30/90 s, day and night), `crash-kinds` (nose,
  cart, belly, spin, tree frame by frame — `--cols=4`; one sheet of 60-odd
  frames loses the WebGL context) and `airstrip` (approach, overhead,
  village, down the runway, apron, buildings, sock, day and night;
  `--face=<id>` raises a real face). `ARGS=--sheet=…`, `--views=…`,
  `--hour=`, `--weather=`, `SEED=`, `REGION=`. Prefix with
  `CHROMIUM_PATH=/opt/pw-browsers/chromium` in a cloud session.
- **The model**: `make blender KIND=plane` (renders to `previews/blender/`,
  judged against local reference side views — never committed, never
  named), then `make models KIND=plane` and COMMIT `pwa/models/plane.glb`
  and `sources.json`. Any edit to `plane.py`, `plane_skin.py`,
  `plane_studio.py`, `kinds/plane.mjs` or `defs/plane.ts` moves the stamp
  `tests/models_test.ts` holds — run `make fmt` first, so the
  stamp is cut over the sources as they will be committed. The glb is byte-stable: two runs give one sha1.
- **`make sim`** — its digests unmoved, always: the plane is an option of a
  free ride (`CreateGameOptions.plane`), never a `RunRule`.
- **The game**: `make build`, then `make screenshots ARGS="--surface
  plane-strip,plane,plane-door"` (`--timeout 150` on a cold browser) at the
  three viewports.
- **The suite**: `npx vitest run tests/plane_test.ts tests/input_plane_test.ts
  tests/airstrip_test.ts tests/air_bounds_test.ts tests/camera_plane_test.ts
  tests/plane_cockpit_test.ts tests/plane_hud_test.ts tests/plane_card_test.ts
  tests/plane_wreck_test.ts tests/plane_audio_test.ts tests/heli_test.ts
  tests/para_test.ts tests/balloon_test.ts tests/models_test.ts
  tests/model_registry_test.ts tests/determinism_test.ts`.

## The rules

- **THE FLIGHT IS THE PHYSICS.** No scripted manoeuvre, no hidden autopilot
  on the player's stick. A loop that will not come round is a fault in the
  trim, the rigging, the stick's reach or the aero — find which with the
  `p-*` rows, never by steering the plane round.
- **TRIM, THEN RIG, THEN REACH — in that order.** The airframe must trim
  where its comment says (45 m/s on climb power, stick centred: the tail's
  incidence); the propeller's torque roll and swirl yaw must be rigged out
  at the cruise (`aero.rig`: the ailerons set apart, the fin offset); only
  then is the player's stick tuned (`input-plane.ts`: `PITCH_FULL`,
  `PUSH_LEAST`, `ROLL_FULL`, `ROLL_LEAST`, the buffet's 8 %). A plane that
  drifts into a bank with the stick centred makes every loop a wingover.
- **The player's hand pulls to the buffet, never past it** — except back
  stick with full rudder, a deliberate spin entry. The stick's reach grows as
  the plane slows ((28/v)²), so without the buffet ease a held key reaches
  full travel at a loop's top and stalls it inverted.
- **One geometry.** Every point the model, the stand-in, the cockpit, the
  shatter and the strike points use is in `PLANE`. The model is HANDED the
  table; it never states a number of its own. The engine's −x is the
  picture's right (the jump door) — say so where it matters.
- **THE STRIP AVOIDS EVERYTHING; NOTHING AVOIDS THE STRIP.** Adding the strip
  (or its buildings, `stripSiteOf`) to any other placement's keep-off list —
  the cabins, the village, the lodges, the crowd's spots — moves every map's
  digest. The strip is searched last, round the world as dealt, and every
  bearing is scored against its corridor (lift ropes, the helipad); a seed
  with no clear room keeps the least-bad strip, never moves the world.
- **Free ride only.** The strip's solids are gated on `rules.heli`; the plane
  and the wreck draw nothing from `state.rng`. `make sim` before and after.
- **THE AIRBORNE EDGE IS ONE RULE.** `airBounds` / `airBoundsAt` and the
  `AIR_BOUNDS` table turn back the plane, the helicopter, the paramotor, the
  balloon and the skydiver alike: a wind growing as the square of the depth
  in a band, the pilot's hand turned toward the middle, faded in between 40
  and 140 m over the snow. Never a wall, never a second copy per craft. The
  plane's hand is measured off the NEAREST edge, full only within about 60°
  of straight out, acts only upright and never weakens the player's own
  pull; `keepInBounds` (the skier, the races) is not touched. The wind
  tunnels take a skier only under `TUNING.tunnel.roof` (8 m).
- **Files at the cap.** `engine/index.ts`, `state.ts`, `renderer.ts` and
  `App.tsx` sit at or near 1000 lines: export through `plane-api.ts`, hang
  views through `machines.ts`, extract before adding.
- **Name no maker.** The class is "a single-turboprop utility plane of the
  class jump operators fly", its numbers its band; never a make, a model or
  an operator — in the code, the model's names, the docs or a lesson.

## What the passes learned

- **A comment's trim is a claim to measure.** The airframe was trimmed at
  about 33 m/s while its comment said 45; the push could not dive at full
  power, so a loop's entry speed was out of reach. Measure the trim
  (`plane_test` holds it) before tuning anything the player feels.
- **The bounds hand flew the loop.** Near an edge (seed 38's strip lies
  inside the 900 m band) the edge hand injected aileron through every loop
  and roll. It now acts only upright and off the nearest edge.
- **The cockpit lens through the culled cowling.** The pilot's eye sits
  close under the cowling's line: a front-side-only skin dropped the nose
  from the seat. The skin stays two-sided; the glass goes near-clear from
  inside.
- **Shadows tinted magenta were the pool fire's light by day.** Sky blue
  plus a point light's orange; the pool's light is 8 % by day and full at
  night (`explosion.ts`'s `dusk`).
- **A plane slides past its own fireball.** The crash lens stood inside the
  ball on a belly slide; it is pushed only while clear of trunks and of where
  the ball went up, and turned out of a low sun.
- **Stale contacts puffed snow in the sky.** The skier's last snow contacts
  were emitting spray and cloud along every flight; nothing is emitted while
  he rides aboard.
- **TIPS is the airframe's lens, HELMET is his.** The cockpit moved to TIPS
  (as the helicopter's TIPS is its nose lens) so HELMET stays his own eyes
  from the door through the freefall to the canopy.

## Known gaps

- The spin is steep and fast (about 130 kt at α ≈ 20°): a spiral more than a
  developed spin; the elevator cannot hold the nose higher in the stall.
- A naive barrel roll comes out nose-low.
- The 900 m band covers most strips (115.6 m spare in `bounds`; 750 m gave
  42.6 m and 650 m crossed the edge) — narrowing it is a measured change.
- Seed 3 keeps some corridor intrusion; loose skis, the crowd and the other
  machines pass through the strip's solids.
- The cockpit's coaming is flat-shaded low poly; the planted nose-in crash
  shots show the sky's blue in the shadows.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth recording: a
band a row left, a manoeuvre that came out of the physics differently than
the lab said, a lens or a cut that broke the picture, a placement that moved
a digest.

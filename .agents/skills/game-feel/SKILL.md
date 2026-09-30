---
name: game-feel
description: "Use when the task is about how the game FEELS to ski — the sensation of a skier meeting snow (the edge biting the groomer and the carve holding, the skid's scrub, the float onto the powder and the turn on the base there, the tuck gathering speed, the kick off a roller, the hang, the landing), the sense of speed down a mountain, the camera's framing, how pace and danger read on screen. The feeling of skiing IS the core product; this skill owns the reference (the arcade winter racers of the late 90s, with a modern look), the levers that create the sensation across the snow, the stations and the legs, the generator's rollers and kickers and the camera, how the levers interact, and the look-first verification loop. Load it for any change whose acceptance test is 'does it feel like skiing', alongside the skill that owns the specific subsystem being edited."
---

# Game feel — the skier meeting the snow

The whole game is one sensation: a skier on a ground that is TWO grounds —
a groomed piste the edges bite and carve on, and deep powder the skis sink
into at walking pace and float up onto as speed builds. A change can pass
every test and still fail the product: **the acceptance test for feel is a
ride table, a picture or a run, looked at**, next to the reference. This
skill owns that judgement and the levers behind it.

**Read this skill's lessons first** —
`npx ogf-skill-lessons game-feel`. Record what a tuning session
learns at the end (`skill-reflection` owns the format).

## The reference: the arcade winter racers

The arcade skiing and snowboard racers of the late nineties are the north
star for how snow and a body on it should read — named as a GENRE, never as
a title (the router's rule). What they got right, and what every lever
below is measured against:

- **The snow is a PARTICIPANT, not a floor.** The piste is fast and sure; the
  powder beside it is slow and deep and costs you, until you carry enough
  speed to plane it. Leaving the groomed line is a decision with a price.
- **Speed is felt through the BODY, not the speedo.** The knees working over
  every roller while the torso floats, the skis chattering on a hard patch,
  the sheet of snow off a skidded turn, the trail you leave — a skier at
  110 km/h tucked down a smooth pitch reads slower than one at 70 through
  rollers and powder.
- **Air is a moment.** A roller taken at speed throws you: the edges stop
  hissing, the wind is all there is, the skis drift, and the landing is a
  decision — lean back to lift the tips, lean forward to drop them, match
  the slope you are coming down on. Every flight has a launch, a hang and a
  landing that each read distinctly, and a flat landing HURTS.
- **The turn is the edge.** On the groomer the skis are tipped over and the
  sidecut carves the arc, the body inclined inside it with the hips
  angulated; in powder the edges are buried and the whole body rolls the
  skis onto their bases and comes round. Tucked, angulated, stood tall — the
  skier's body is how skis are skied and it has to show.
- **Speed is bought with the tuck, and a bend costs it.** The tuck is the
  throttle: fold down and the drag comes off, stand up and it comes back. A
  bend carved at full edge scrubs a little; a bend skidded scrubs a lot.
- **The camera stays low and behind, and the horizon breathes.** Close over
  the tails, low enough that the next roller hides the dip behind it; it
  follows the skier's heave with a lag, swings through the turn, and a big
  landing shakes it.
- **The gates are the course.** Red and blue panels read from a distance,
  the next one is always findable (the arrow says where), and missing one
  costs.

Two frames to hold in mind: a groomed piste dropping through a snow-loaded
forest at speed, for the rhythm of the rollers and the gates; and an open
powder bowl above the trees in low winter sun, for the float, the glitter
and the fresh line cut behind the skier. `make world` names these views
`track`, `furrow` and `powder`.

## The levers, and who owns each

Feel is produced by several subsystems TOGETHER. A change to one usually
needs a sympathetic change in another — deeper powder with no more speed to
plane it is a game that is harder, not more dramatic.

| Lever | Where | Owning skill |
| --- | --- | --- |
| How the skier answers the snow: the legs, the sink, the edge and the skid, the tuck, the carve, the air | `engine/game/skier.ts`, `suspension.ts`, `snow.ts`, `poles.ts`, `flight.ts`, `defs/tuning.ts` | `ski-physics` |
| A pair's own numbers: length, waist, sidecut, flex, the tuck's drag, the legs | `engine/game/defs/skis.ts` | `ski-tuning` |
| The country: the mountain's pitch and its rollers, the kickers, the piste's bends and its length, how much powder there is beside it | `engine/mapgen/rules.ts` | `mapgen-improvement` |
| The camera: the ladder, its rigs, the flown hand-over | `pwa/src/game/camera.ts`, `camera-rigs.ts` | (this skill) |
| What the skier throws and leaves: the spray off the tips and the tails, the skid's sheet, the landing puff, the trail, a pulse in the hands | `pwa/src/game/spray.ts`, `trail-stamp.ts`, `rumble.ts` | `visual-effects` |
| The snow's LIGHT: the glitter, the blue in the shadows, the groomer's grain, the trough walls | `pwa/src/game/snow-glsl.ts`, `terrain.ts`, `trail-map.ts` | `snow-look` |
| The sky and the sun the snow is lit by | `pwa/src/game/sky.ts`, `environment.ts`, `haze.ts` | `atmosphere` |
| The skier on his skis | `pwa/src/game/skier-pose.ts`, `skier-figure.ts` | `skier` |
| What is heard: the wind, the edges' hiss and chatter, the powder's rush, the skid's scrape | `pwa/src/game/audio/` | `sound-effects` |

What each contributes:

- **The two grounds are the drama.** The planing speed (`snow.planeSpeed`),
  the sink and the plough decide how long powder holds a skier and how much
  a line off the piste costs; the grip blend by `packed` decides how sure
  the groomer is.
- **The stations are the skier's nerves.** Six stations on two skis read the
  snow, and their lever arms turn a roller into pitch and a traverse into
  roll. Softer legs read as a sofa; stiffer as stilts.
- **The kickers and the rollers are the air.** R3's rollers and R4 and R9's
  kickers shape crests so they throw; the profile (t² to the lip, steepest
  at the lip) is what makes a kicker a jump rather than a hill. A kicker
  that flattens at its top hands the skier no upward speed.
- **The camera sits low and follows with a lag.** A lens that rides the
  skier's heave exactly reads a field of rollers as nothing; one fixed in
  height reads it as the skier bouncing. The answer is in between
  (`heightFollow`, `heightFollowAir` per rung).
- **Speed only feels fast against scale.** Trunks passing close, gate panels
  flicking by, the trail beside the piste — a wide empty bowl at 100 km/h
  reads as 40.

## The camera module, and what it decides

The camera is this skill's own subsystem. `camera-rigs.ts` is the ladder as
data and arithmetic, three-free so `tests/world_render_test.ts` reads it;
`camera.ts` puts the answer on a three.js camera, with the flown hand-over.

| Question | Where |
| --- | --- |
| The rungs, and the order `C` walks them | `RIGS` in `camera-rigs.ts` (`tips`, `helmet`, `chase`, `far`, `high`, and `orbit` for the menu); `RUN_CAMERAS` / `nextCamera` in `settings.ts` |
| Where a BOLTED lens sits on the skier, and how much of his pitch and roll it takes | `tips` / `helmet`: `eye`, `rollShare` — the lens pitches and rolls WITH the body, which is the whole sensation of those views; the helmet view is first person, the tips view a lens low at the ski tips |
| Where a BOOM lens stands behind, and how it pulls back with speed | `dist`, `distPerSpeed`, `height`, `fovPerSpeed`, `fovMax` |
| How it follows the heave, on the snow and in the air | `heightFollow`, `heightFollowAir`, `followRate` |
| Looking through a skid | `slipWeight` — the blend between the skis' line and the way |
| Never losing the skier off a jump or a cliff | `lagMax` (the most the sprung height may trail, eased into with a tanh) and `frame` (the share of the vertical half-fov the skier is kept inside — the look TILTS past a knee at half of it); `tiltToFrame` |
| Never inside the snow | `clearance` |
| Never inside a gate pole or the finish arch; a tree is let through | `camera-clear.ts` — the `LineClear` a boom pulls its arm in against: the gate poles and the start hut and the finish arch (`start-arch.ts`), walked from the helmet out. The SKIED booms are handed it with `{ trees: false }` — an arm pulled in for every trunk flicking past is a jolt at the skier, and a bough across the frame for a moment is the lesser fault; the planted lenses (the broadcast, the death cam) keep out of the trees AS DRAWN (a lens meets the crown, not the trunk) |
| A switch that is a move rather than a cut | `HANDOVER` seconds of `blendLens` in `camera.ts` |
| Which rung each shell surface gets | `cameraFor` in `shell.ts` |
| The player thrown: the lens off the ladder, after the body, the slow motion into the impact and the rise over him | `camera-death.ts` (`DEATH`, `frameDeath`); the rate reaches the app as `renderer.timeRate()` — slow motion is fewer steps per frame and nothing else |

**A reading that moves where the camera STANDS is taken before the lens is
placed.** The snow height under the lens, the follow target and the
pull-back are all sampled AT the lens; a boom moved after that sample stands
over snow read a metre away, and on a roller that is a shot that pumps.

## The workflow

1. **State the feeling** being tuned in one sentence ("a kicker at 90 km/h
   should hang long enough to correct the pitch, and a flat landing should
   cost you"), and find the reference moment for it.
2. **Change the smallest set of levers** that plausibly produce it. Numbers
   in `defs/tuning.ts`, `defs/skis.ts` or `rules.ts`, not new mechanics,
   unless the mechanic is the gap.
3. **Read it on the bench BEFORE looking at it.** Every feel lever has a lab
   that runs in seconds with no build:

   ```sh
   make ride SCENARIO=accel-powder   # the float: when the skis plane
   make ride SCENARIO=kicker         # the air: launch, hang, carry, landing
   make ride SCENARIO=turn           # the carve: radius, g, the inclination
   make ride SCENARIO=turn-powder    # the turn on the base
   make level SEED=<n>               # the map: where the kickers and the bends are
   ```

   The ride table is where a claim is made. A feel that cannot be pointed at
   in a row is a feel that will not survive the next tuning pass.
4. **`make sim` before and after** any engine or rules lever — the feeling is
   never allowed to cost the bot the map (finishes, pace, resets and hits are
   the regression surface).
5. **LOOK**: `make world SEED=<n>` (its own bundle, no `make build`) for the
   renderer's views of one skied run; then `make build` and
   `make screenshots` for the app (in web sessions
   `CHROMIUM_PATH=/opt/pw-browsers/chromium`). Compare proportions, not vibes:
   how much of the frame is snow, where is the horizon, does the skier's
   attitude read, is there snow in the air where the edges meet it? **Every
   camera framing change gets a PORTRAIT shot** (390×844): the fov is
   vertical, so landscape cannot show what a phone held upright does.
6. **Iterate camera and FX freely** — they are presentation and cost nothing
   to re-tune. Engine feel numbers move in small steps, each re-labbed.

## Hard-earned constraints

- **What is drawn IS what is simulated.** The terrain is the engine's own
  heightfield and the skier stands on the engine's own contacts. The trail
  is the one deliberate exaggeration, and it is stated in one place: the
  drawn furrow is the physics' `sink` or the powder's own furrow, whichever
  is deeper (`drawnDepth` in `trail-stamp.ts`) — never shallower than the
  support the skis ride on. Deeper powder is a `ski-physics` change.
- **Powder must cost, and speed must buy it back.** Any help that lets a slow
  skier plane powder flattens the choice between the piste and the line
  beside it.
- **The skier inclines into the turn; he does not slide flat.** A skier who
  yaws round on the groomer with no inclination reads as a hovercraft; one
  who slides sideways through every bend reads as a skid every time. The
  arcade hand on the yaw (`steer.yawHold`) is there to stop spins, not to
  add turn; the skid is the BRAKE and reads as one.
- **The tuck is the only accelerator, and the slope pays for it.** A term
  that makes a skier faster on a flat has put a motor in the game.
- **The landing is charged for what the flight put in** — the speed INTO the
  slope, not the fall height. Landing on the downslope of a kicker is fast;
  landing flat past it is not. A landing charged every time a station
  chatters over a roller is a skier who stops dead in a mogul field.
- **Anything that vibrates the lens is a few incommensurate oscillators
  under 8 Hz on a decaying envelope**, never a fresh random offset per frame:
  white noise at a real landing's amplitude is a broken picture, and at 30
  fps it aliases into a slow lurch.
- The renderer never mutates `GameState`; feel state that must persist
  (camera smoothing, the spray's decay, the trail map) lives in renderer-side
  closures and resets with the next map.
- Readouts the FX need from the skier (the tuck, the edge, the skid, the
  lean, the crouch) are `SkierState` / `SkierInput` fields the engine wrote —
  the renderer never re-derives intent from physics deltas.
- The screen is a MIRROR of the engine's map view: work in world coords and
  stay sign-consistent; never flip a sign in the camera to fix a perceived
  left/right issue. Heading 0 is +z and grows clockwise from above; forward
  is `(sin h, cos h)`.
- Speed thresholds quoted in feel terms convert as 100 km/h ≈ 27.8 m/s; the
  engine is all metres and seconds.

## What the change obliges elsewhere

- A lever in `tuning.ts` / `skis.ts` → `docs/riding.md`, the ride lab's
  before/after, `make sim` both tables.
- A camera change → `make screenshots` at every reference viewport in the PR.
- A user-visible change → a `.changes/unreleased/` fragment (`changelog`).

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth recording: a
lever that reliably fixes a feel complaint, a coupling between a snow number
and a map number, a camera fraction that turned out to be the whole
difference — and the reference moment a session found itself comparing
against, so the next one starts there.

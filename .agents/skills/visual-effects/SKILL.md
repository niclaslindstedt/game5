---
name: visual-effects
description: "Use when creating or tuning what the SKIS THROW OFF, what they LEAVE and what the skier FEELS — the WEIGHED spray (the kilograms of snow an edge cuts and a ski shoves, the sheet off a skidded turn, the powder off the tips and the tails in a carve, the landing puff, flown on the GPU and dug out of the deformable snow as one snow budget), the snow cloud, the tracks' STAMPING (every station laid as a capsule into the trail map, the drawn depth, an edged ski's narrower deeper groove, the windrow, the break on a reset), and the vibration table under the player's thumbs (the chatter on hard snow, a landing, a trunk, a fall, the gate's tick). Covers the event → effect flow (the engine emits events and writes `SkierState`; the renderer turns them into transient visuals and pulses), the two surfaces (the three.js scene for the air, the trail map for the snow), the low-poly art direction the effects sit inside, and the loops that judge them — zoomed pictures and the snow lab's bench (`make snow-eval`, `make snow-mass`). Not the snow's own light (`snow-look`) and not the sky (`atmosphere`)."
---

# Visual effects — what the skis throw off

Transient FX are **presentation only**: the engine knows nothing of them. It
emits an EVENT or writes a `SkierState` reading, and the app turns that into
a short-lived drawn thing, a groove in the snow or a pulse in the hands. An
effect never changes what happens, only how it reads. The renderer reads
`GameState`; it never mutates state and never steps physics.

**Read this skill's lessons first** — `npx ogf-skill-lessons
visual-effects --list`. Load **`skill-reflection`** at both ends of the
session and **`write-code`** beside this one. For the snow the track is drawn
in, `snow-look`; for the sound the same moment makes, `sound-effects` — the
pulse and the sound read the same event, and where they disagree it is on
purpose.

## The two surfaces

Pick by what the effect is anchored to:

| Surface | Use for | Lives in |
| --- | --- | --- |
| **The three.js scene** | Anything IN THE AIR: the skid's sheet, the powder off the tips and tails, the landing puff — the heavy grains and clumps as one pool of sprites, and the fine SNOW CLOUD they raise as one instanced draw of volume-shaded puffs, both lit as the snow is and faded into the same haze | `pwa/src/game/spray.ts`, `snow-cloud.ts` |
| **The trail map, and the deformable snow over it** | Anything IN THE SNOW: every groove a ski's station presses, the windrow beside it — stamped as capsules into a world-space map the terrain shader lowers the snow by and shades; at TRAILS MEDIUM and HIGH also pressed into the 5 cm height field round the player, which the spray's own takes dig and which slumps into a crater or a berm | `pwa/src/game/trail-stamp.ts` decides each stamp (three-free), `trail-map.ts` keeps the maps and `deform-field.ts` the field (`snow-look`'s), `renderer.ts` stamps every skier every frame |

There is no third surface: a decal or a second mesh laid over the snow is lit
differently from the ground under it and reads as paint. The LENS's reaction
(the flown hand-over, a landing's kick) is the camera's — `camera.ts` under
`game-feel`.

**WHICH SKI THROWS IT.** A turning skier stands on his OUTSIDE ski — 95 %
of him at a crawl, three quarters at a cruise, two thirds in a fast carve
(`ski-stand.ts`'s `skiShares`, laid over the engine's two loads, which its
equal legs carry alike) — and the snow comes off that ski's edge: the
spray's sheet and the cloud's per-ski sheet go by each ski's share (the two
together throwing what the pair does), and the skid's wall rises off the
loaded ski's boot. Judge it with `make turns ARGS=--views=low`.

## The modules

| Effect | Where |
| --- | --- |
| THE SEAM: `edgeSlips` (the one reading of a sliding edge — the skier's velocity read across the skis as they stand pivoted, along the WHOLE loaded edge: a ski's tip to tail, a board's one long edge, each ski by its share) and `createSprayPool`, which hands the renderer the weighed pool. There is ONE model; the counted ones it replaced (and their `spray-eval` lab) are retired | `spray-sim.ts` (three-free, `tests/spray_test.ts`) |
| THE WEIGHED SPRAY: the KILOGRAMS that leave the snow — the layer an edge sliding across its line planes off (its depth off the snow's hardness and the skier's load: a hockey stop's 15–20 kg off a groomer, a kilo of dust off ice, wet clumps off spring snow), the loose snow a ski shoves (a share thrown, the rest into the berm), the bow wave off the tips in deep snow, the lip off a railed tail, a landing and a body's burst — then what it is made of (fragments, aggregates, clumps, dust) and each grain's own fall speed; thrown FORWARD, from under the skis and DOWN THE SLOPE; the same mass at every SPRAY stop, the stop a share of the parcels drawn | `spray-mass.ts` (the numbers, `MASS`), `spray-mass-pool.ts` (the emitter and the CPU flight), `tests/spray_mass_test.ts` |
| THE GRAINS AS DRAWN: one instanced draw, each grain a STREAK along its motion over a short shutter (a dot cloud reads as foam), thinned by its length, let go of near the lens, glowing against a low sun and glinting | `spray.ts` |
| THE GRAINS FLOWN ON THE GPU: each parcel written once at its throw into a ring (`gpu-spray.ts`, 1.5× the pool for the splashes written ahead, and cut each frame to the parcels the pool itself would hold, `uOldest` — a bigger ring keeps more of a saturated powder plume than the pool and lowers its film score) and flown off the clock in the vertex shader (`spray-flight.ts`'s `SPRAY_FLIGHT_GLSL` and its TypeScript twin `flyLaunch`, which lay the pool's own 60 Hz frame on their smooth grid: the first frame's drag, the frame-stepped lag, the landing on the frame, gravity raised to the pool's faster fall — without them a stop holds 7 % more snow in the air than the CPU's); the emitter, the kilograms and the look stay the CPU's and part 3's. A change to the CPU flight (`spray-mass-pool.ts`'s `step`) is a change to BOTH, held by `tests/spray_flight_test.ts`; which stops fly on the GPU is `SPRAY_GPU` | `gpu-spray.ts`, `spray-flight.ts`, `spray-glsl.ts` |
| ONE SNOW BUDGET: every kilogram the weighed spray throws (an edge's cut, shove and lip, the bow wave, a landing, a body's burst) and every kilogram it shoves into a berm filed as a TAKE where it left the snow, and the deformable snow digs exactly that out — its `thrown()` is the spray's kilograms (`tests/deform_field_test.ts`, within 1 %) and the cloud reads the same emit (`dustOf`). A change to what the emitter throws moves the hole with it | `snow-takes.ts`, `spray-mass-pool.ts`, `deform-field.ts` |
| THE LANDING PUFF: a ring of powder from under a skier coming down, sized by how hard — read off the airborne → grounded TRANSITION rather than the `land` event, so a frame that ran two steps cannot swallow it and a rival's landing throws the same puff | `spray.ts` |
| THE SNOW CLOUD: the fine powder a skid, a powder turn, a landing and a wipeout raise — the rooster tail that stalls, swells, drifts and hangs. What each source throws out of which snow and how a puff flies, swells and thins is `snow-cloud-plan.ts` (three-free, `tests/snow_cloud_test.ts`) — `driveOf` / `carveOf` read a skier into its inputs, and `loftOf` scales every recipe (rate, size, swell, hang, lift) by how much a speed LOFTS; the flight, the sort, the whole cloud's self-shadow (a sun-first walk through a hashed grid), the chase lens's VEIL through the player's own tail are `snow-cloud.ts`; the shader (domain-warped body, two-lobe Henyey–Greenstein glow, a multiple-scattering fill, glints, lamps, the soft meeting with the snow) is `snow-cloud-glsl.ts`, and its SHADOW on the slope `snow-cloud-shadow.ts` | `snow-cloud-plan.ts`, `snow-cloud.ts`, `snow-cloud-glsl.ts`, `snow-cloud-shadow.ts` |
| HOW SNOW IN THE AIR IS LIT: the key by height, through the weather's cloud and past the mountain, and the sky's irradiance on four faces — one chunk the spray, the cloud and its shadow all read, by the sky's own names | `snow-air-light.ts` |
| THE KINDS OF SNOW: groomed, hard, soft, new, wet, ice — where each lies (the packed field, the crust, the ice, a snowing sky's new layer and `fresh`, a spring thaw) and what each does to the cloud, the spray's clumps, a groove's depth, WALLS and windrow, and a print (a crust carries a light foot) | `snowpack.ts` (three-free, `tests/snowpack_test.ts`) |
| THE TRACKS: a capsule per station from its last touch to this one; `drawnDepth` (the sink or the powder's furrow, whichever is deeper, cut narrower and deeper the more edge the ski stands on); `furrowProfile` for the windrow; `TRAIL.jump` breaks the line on a reset; a thrown skier's slide gouges a wider furrow of its own | `trail-stamp.ts`; `tests/world_render_test.ts` |
| WHAT IS FELT: the CHATTER on hard snow read off `skiCompression` every step, a landing, a trunk, a fall (read off the state — there is no event), a gate's light tick; what does NOT rumble and why | `pwa/src/game/rumble.ts` (DOM-free; `tests/rumble_test.ts`) |
| The motor: the browser's Vibration API or the store shell's tap, the player's switch | `pwa/src/game/haptics.ts` — the only `navigator.vibrate`; the phone's half is `platform-shells`' |

## The flow: reading → effect → draw

1. **The engine says what happened.** A moment is a `GameEvent` (`land`,
   `hit`, `checkpoint`…); a condition is a `SkierState` field the engine
   wrote (`tuck`, `brake`, `skid`, `edge`, `packed`, `skiAngle`, `airborne`,
   `contacts`, `skiCompression`). Event-driven for "at the moment of",
   state-driven for "while". The renderer never re-derives intent from
   physics deltas.
2. **Observe every STEP where a reading spikes, draw every frame.** A
   reading that spikes for two steps is a random sample of itself if read
   once per frame. `rumble.ts` reads the chatter per step and pays it out no
   oftener than its gap; the puff reads a transition, not a frame's state.
3. **The trail is stamped every frame, drawn or not.** `renderer.draw` with
   `present` off still stamps — which is how a fast-forward (the world lab,
   a pre-rolled screenshot) arrives with the tracks that run actually cut.
4. **The effect animates by its own progress** off the sim clock, so a
   pre-rolled still carries the same spray the player would see.

## The art direction — effects must sit inside it

The world is faceted low-poly under a sun and a sky light, every texture made
in code. Snow in the air is:

- **A cloud of fine powder, not droplets.** Soft sprites that grow a little
  as the cloud disperses, lit the sun's colour on the lit side and the sky's
  blue in shade, fading into the same haze as the face. A spray lit flat
  white reads as foam; one lit grey reads as smoke.
- **Motion carries it.** Speed reads through spawn rate, inherited velocity
  and lifetime; a sheet that streams off a hockey stop sells 90 km/h better
  than any texture. On the groomer there is little loose snow — a thin dust
  off the edges; in powder, a plume off every turn.
- **The tracks are the signature.** Two thin lines, close together and
  parallel through a schuss, opening and deepening on the outside ski
  through a carve. It is what a player sees behind every rival, and it
  persists for the whole run.

## Craft rules

- **Presentation-only, structurally.** No effect writes `GameState`, draws
  from `state.rng` or feeds anything back into `step()`. Renderer-side
  randomness uses its own source, deterministic per run.
- **Budget per frequency.** The spray and the stamping run continuously for
  four skiers: pre-allocated pools, no per-frame allocation, one geometry
  and one material per system, one draw for the whole spray.
- **A track never lies about the physics.** Drawn no shallower than the
  support the ski rides on; broken on a reset rather than swept across the
  map.
- **A pulse is sized against the RUN, not a held key.** Size a rumble
  threshold from the bot skiing the piste at pace (`botInput`), never from a
  probe holding a tuck on the start line; and a phone has ONE motor and no
  mixer, so every buzz spent on news is a buzz taken off the next landing.
- **Events for sound too.** If the moment would also want audio, the EVENT
  carries what audio needs, designed once and read by `audio/route.ts` and
  `rumble.ts` alike.
- **Reduced motion.** Anything screen-filling or flashing needs a
  `prefers-reduced-motion` fallback that keeps the information.

## The iterate loop — LOOK at it, ZOOMED

1. **`make cloud`** is the snow cloud's own lab: one run per row across
   the seed's open bowl — a kind of snow (`--snow=`) × a light
   (`--light=front,back,side,low,overcast,snowing,night`) × a held speed —
   photographed from several angles at one moment (`--views=chase,side,
   front,high,trail,under,furrow`), or one angle at several moments
   (`--cols=times`). The LIGHT is the sun turned to the run, so BACK is
   always the chase lens looking into the sun through the cloud. Run it
   before and after, both sheets in the PR.
   `--moves=straight,carve,turn,skid,check,stop,skate` rides each row in a
   manoeuvre (the controls are `hold-input.ts`'s, the app's own held
   ride) and `--where=piste` stands it on the groomer.
2. **`make cloud-metrics`** is the NUMBERS behind those sheets: the same
   rows ridden by the engine in pure Node, every frame read as
   `snow-cloud.ts` reads it — puffs a second, the opacity-weighted AREA
   alive behind him, that area against his silhouette (`× skier`), how
   high, how long it hangs, how long a curtain. `--json=` the before,
   `--compare=` the after; a picture says what it looks like, this says
   whether it GROWS with speed.
3. **The game's own frame at a speed:** `make build`, then `make
   screenshots ARGS="--pose x,z,heading,v --hold 12,30,60 --move check"`
   — the player stood there (a deep spot off the piste reads the cloud
   best; the REPRO line gives one) and ridden for `--hold-for` seconds at
   each speed down the fall line, drawn as he goes (`?hold=`), so the
   cloud in the picture is the one that speed raises, through the chase
   lens and its veil.
4. **`make world SEED=38`** reaches the moments in one skied run:
   `powder` and `powder-high` for the powder turn's plume, `jump` and
   `landing` for the puff, `furrow` and `lookback` for the tracks, `track`
   for the thin dust on the groomer. It builds its own bundle; no
   `make build`.
5. **Zoom** — crop the skier at full resolution (`make cloud
   ARGS="--width=800 --height=450"`); at a quarter size you are judging a
   smudge.
6. **Bench the numbers** when the question is WHEN rather than HOW:
   `make ride SCENARIO=kicker` says when the skier leaves and lands, so the
   puff's frame is known before it is looked for; `SCENARIO=hockey-stop`
   when the skid's sheet starts and stops.
7. **Ski it** for anything that moves — a spray's timing and a pulse show in
   no still: `npm run dev`, or `make screenshots` at two offsets
   (`ARGS="--t 12"`, `--t 13`).
8. **The snow lab's bench**, for the spray as a whole: `make snow-eval`
   films every scene, reads the drawn parcels back and scores them
   (`film.json`, `perf.json`, kept from before beside after), and
   `make snow-mass` weighs them in pure Node (`--json=` before,
   `--compare=` after). A change to the emitter or the flight owes
   both.
9. Judge, refine the worst beat, re-shoot. `make profile` before and after.

## What the spray taught

- **Weigh the snow, then draw it.** Counting grains (the old `drag`,
  `sheet`, `streak` and `puff` models) gave a spray whose size was a
  tuning knob; the weighed spray's size is the snow's hardness, the load
  and the slide, so a stop on ice is dust and one in spring snow a heavy
  wall without a number of its own. `make snow-mass` holds every scene's
  kilograms to a band (`--json=` before, `--compare=` after) and
  `make snow-eval` scores the picture as filmed; together they superseded
  `spray-eval`, which scored the counted models and is gone.
- **The edge's SLIDE throws the snow, not the brake key.** Read the
  velocity across the skis as they stand: a carve slides across nothing
  and throws a thin tail, a hockey stop slides at its whole speed and
  throws a wall — and the wall goes AHEAD, FROM UNDER THE SKIS and DOWN
  THE HILL, the way the edge slides (`make snow-eval`'s throw angles,
  `make spray-metrics`' `ahead` column), never back at him.
- **A board is one long edge**, not two skis: emit along its whole deck
  with the whole load, or a board's stop throws half a pair's.
- **Streaks, not dots.** A grain at 10 m/s drawn as a disc reads as foam
  or hail; drawn along its motion over ~45 ms it reads as spray.
- **The mist rises off the same edge, the same way** — the cloud's wall
  read off the edge's slide (`snow-cloud.ts`), smaller and more numerous
  puffs on a groomer's thin skin (`bodyOf`), or it reads as balls.
- **Fade a grain near the lens**, as the cloud does: a grain a metre off
  is an egg across the picture.
- **Fly a grain at its own fall speed.** Measured snow falls at half a
  metre a second as crystals, three to six as the chips an edge cuts and
  some nine as a clump: the weighed spray's drag is set per grain by that
  speed (`settleSpeed`), so the fines hang (and are handed to the cloud
  as `dustOf`) while the chips fly far and a clump breaks where it lands.
- **The pool is flown twice, and both must agree.** The CPU's flight
  (`spray-mass-pool.ts`'s `step`) is the reference the labs fly in Node;
  the game flies the same parcels in the vertex shader (`spray-flight.ts`).
  A change to one is a change to both, `tests/spray_flight_test.ts`.
- **What is thrown is dug.** Every kilogram leaves a TAKE in
  `snow-takes.ts` and the deformable snow digs it out, so a stop's hole
  and its wall are one snow budget; a spray tuned up without the hole
  moving with it has broken `tests/deform_field_test.ts`.
- **The snow's AGE makes the spray** (`snowpack.ts`'s `ageSnow`, off the
  same `SnowAge` the terrain is drawn by): new snow fine and light, old
  snow coarse and clumpy, a wind slab or a crust in plates, hoar glinting,
  wet snow heavy, short and cloudless. Its depth (the snow dial) scales
  how much is thrown and how high. `make snow-mass ARGS="--rows=none
  --ages"` prints the age and depth table.
- `make snow-eval` (the film score and throw angles of every scene, the
  perf rows, `--under=all` the skis against the drawn snow, `--deform-perf`
  the deformable snow's cost, `--lights=low,overcast,night`),
  `make snow-mass`, `make spray` (both pairs, close and chase,
  `WHERE=meadow`; `--age=`, `--depth=`) and `make spray-metrics` are the
  labs; the turns lab takes `--skis=lynx`.

## How snow in the air is lit

- **By the sky's own names, never a pair of colours of its own.** The
  spray and the cloud read `snow-air-light.ts`: the key light taken by
  height (`keyAtHeight`), through the weather's cloud (`cloudShadow`) and
  PAST THE MOUNTAIN (`terrainLit`), and the sky's irradiance
  (`skyIrradiance`) on four faces — up, down, toward the key and away. A
  lit/shade pair of uniforms of the effect's own lit a stop in the
  mountain's shade as if in the sun: a white fan glowing over blue snow.
- **Read once a particle in the vertex stage**, handed on as varyings: a
  grain or a puff is far smaller than the light's own detail. The lamps
  are the fragment's (`LAMP_GLSL`'s `lampReach`, `pisteLight`) — a beam is
  narrower than a plume. After dark nothing else lights it.
- **A backlit low sun is gold, and that is right.** The air over a slope
  turned from a grazing sun is still in the sun: the snow on the ground
  goes blue while what is thrown into the air glows. Do not "fix" it dark.
- **White over white reads by its SHADOW.** By day a powder plume vanishes
  against the slope unless it lays its shadow on it
  (`snow-cloud-shadow.ts`). Lay that shadow on the snow AS DRAWN — the
  engine's ground plus the loose cover (`LOOSE`) — or it lies under the
  powder's surface and shows only in the trench. Multiply in the picture's
  LINEAR light (the grade pass draws to a half-float target), never a
  gamma'd one.
- **A lab's map snow may throw no cloud at all.** Seed 38's snow is old,
  sun-crusted and thawed wet under a 32° sun, so `ageSnow` leaves almost
  no fines: stage a powder scene's snow (`snow-eval-harness.ts`'s `snowOf`)
  before tuning the cloud by it.

## What the cloud taught (the snow cloud's own rules)

- **Shade the CLOUD, not the puff.** A puff lit and self-shadowed on its
  own gets a bright rim on its sun side, and a stream of them reads as a
  string of rings. The shadow is the whole cloud's (the sun-first walk),
  the glow against the sun is the whole cloud's thinness, and a puff's own
  relief is a light touch over that.
- **Snow is never grey.** Ice scatters nearly all it stops: a shadow deep
  in the plume is lit again by the cloud round it (the multiple-scatter
  octave). Single scattering alone turns a snow cloud into dust.
- **The chase lens rides in its own tail.** Without the veil the player's
  skier disappears into his own cloud at any speed in powder. A planted
  lens (a replay's broadcast, a lab view) sees the cloud whole.
- **A crawl lofts almost nothing.** Below about 15 km/h a ski shoves the
  powder aside and it falls straight back; the fine cloud is lofted by
  speed. Scale the WHOLE recipe by it (`loftOf`: rate, size, swell, hang
  and lift, each down to a floor) — a cloud whose size is set by the
  plough's depth alone is bigger at a walk than at 60 km/h (it was: 55 %
  of the 60 km/h cloud at 10 km/h) and sits on the slow skier like a ball.
  A landing and a wipeout's burst are an impact, not a speed: they take
  the full loft.
- **The veil reaches past him.** The lens sees through the cloud BEHIND
  the skier, but a carve throws puffs beside and a metre ahead of the
  boots; a veil that stops at his feet leaves a white ball over him.
- **A faint puff is still fill.** The biggest puffs on the screen are the
  near and veiled ones; cull them in the vertex shader, not by alpha.
- **Fade into the snow on the ball's front surface**, not the card's
  plane, or a lens looking down cuts every puff into a crescent.

## Ship checklist

- [ ] Presentation-only — no simulation state touched, no `state.rng` draws.
- [ ] Right surface: the scene for the air, the trail map for the snow, the
      camera module for the lens.
- [ ] Sits inside the art direction: lit as the snow is, fading into the
      haze, no foreign fidelity.
- [ ] Pooled allocations; observed per step where the reading spikes.
- [ ] You LOOKED at it zoomed, at two moments.
- [ ] `make snow-eval` and `make snow-mass` before and after for anything
      the spray throws; `make cloud` before and after for anything in the
      air, both sheets in the PR; `make cloud-metrics` `--json` before and `--compare`
      after when HOW MUCH moved.
- [ ] `npx vitest run tests/world_render_test.ts tests/rumble_test.ts
      tests/snow_cloud_test.ts tests/snowpack_test.ts tests/spray_test.ts
      tests/spray_mass_test.ts tests/spray_flight_test.ts`;
      `make profile` both tables in the PR.
- [ ] A `.changes/unreleased/` fragment — effects are player-visible.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth a fragment: a
beat that only read zoomed, a reading that turned out to be sampled rather
than seen, a pulse sized off the wrong run.

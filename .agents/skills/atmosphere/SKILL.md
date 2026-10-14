---
name: atmosphere
description: "Use when working on the SKY and the air under it — the sun and the moon for a map's place and date at the hour the run has reached (R15, `sunAtRun`, the SKY'S CLOCK: five minutes on the snow an hour of sun), the physical atmosphere they shine through (Hillaire's model, baked for LOW, on the GPU for MEDIUM and HIGH, `SkyLook` the one look every frame reads), the sky's light on the ground (the harmonics, the key by height, alpenglow, the twilight's lift and the dawn shade's), the haze and the aerial perspective, the true horizon and the FAR RANGES to it, the mountain's own shadow and the shadow box — and over that the WEATHER R19 deals and a free ride's FRONT that turns it (its cloud field by tier: shell, slab, raymarched volume; the low deck and the sea of cloud; the fall in squalls and the new snow it lays; the spindrift; the flat light), and the NIGHT (the moon at its true size, phase and light, the stars by local sidereal time, the airglow, the piste lights, the floods and every headlamp). Owns `pwa/src/game/sky*.ts`, `atmosphere-model.ts`, `haze.ts`, `horizon.ts`, the cloud's files (`clouds.ts`, `cloud-field.ts`, `cloud-light.ts`, `cloud-glsl.ts`, `cloud-volume*.ts`, `cloud-front.ts`), `low-deck.ts`, `far-ranges*.ts`, `night-sky.ts`, `moon-glsl.ts`, `starfield.ts`, `snowfall*.ts`, `headlamp.ts`, `piste-light*.ts`, `shadow-box.ts`, `terrain-shadow.ts`, `environment.ts`; on the engine side `clock.ts`, `wind.ts`, `snowfall.ts`, R15 (`mapgen/sun.ts`), R19 (`mapgen/weather.ts`) and the front (`mapgen/front.ts`); and the labs `make sky`, `make sky-table`, `make sky-solar`, `make snowfall`. Not the snow the light lands on (`snow-look`), not the trees (`nature`), not what the skis throw (`visual-effects`)."
---

# The atmosphere: the sun, the sky, the air and the weather

Everything over the snow and in the air between the lens and the horizon.
The picture is set here before a single track is drawn: the sun's height
decides the palette, the sky's colour decides what colour a shadow on snow
is, the air decides how far the far ridges read. A change here moves every
picture in the game.

**Read the lessons first** (`npx ogf-skill-lessons atmosphere --list`); load
**`skill-reflection`** at both ends and **`write-code`** beside this one for
any code change. `snow-look` owns what the light does once it is on the
snow; `picture-pricing` owns what the sky's tiers cost.

## What a map is dealt, and what moves

A MAP IS DEALT ONE SKY AT ONE HOUR (R15, R19): a seeded day at a seeded
latitude in its region's band, a start hour, one of eight weathers off a
stream of its own, and on a quarter of the maps an evening start. A REAL
FACE is stood at its own latitude, longitude and true north (`withPlace`),
half a year on south of the equator. Then, ALL OF IT PRESENTATION:

- **The sun moves with the run.** The sky's clock runs the start hour on
  with `state.t` (`SKY_CLOCK`, 12 — five real minutes an hour of sun), so a
  long free ride sees the sun set, the lamps come on and the stars come out.
- **A free ride's weather can change.** Its map carries a FRONT
  (`Level.front`, dealt off the seed on its own salt): the dealt sky turning
  into up to three others over game hours, the fall and the wind following
  it, the cloud field morphing rather than swapping. Never on a race, a
  tricks run or in summer; `?front=0` holds the weather.
- **The fall breathes in squalls** and lays NEW SNOW at a real fall's rate
  (`GameState.fresh`) — the one thing a sky does to the physics.

## The engine's half (the FACTS)

The engine decides the facts and has no opinion about colour.

| Fact | Where |
| --- | --- |
| The day (R15): latitude in the region's band, a day January–March, a start hour with the sun at least `sun.minElevation` up; the generator keeps its own cosine (`declinationOf`), so nothing a seed builds moves for the sky | `engine/mapgen/sun.ts` (`dealSun`, `withPlace`, `seasonDay`), `LEVEL_RULES.sun` |
| The sun and moon at a moment, for a REAL INSTANT: local apparent solar time on a date in one nominal year, NOAA's declination and equation of time, the apparent (refracted) elevation; the moon off its real orbit and phase; sunrise, sunset and the twilights as an almanac states them; a clock shown to the player (`clockHourOf`) | `engine/game/clock.ts` (`sunAtRun(level, t?, rate?)`, `moonAtRun`, `skyHourAt`, `skyLevelAt`, `skyDateOf`, `sunWindowOf`, `clockHourOf`, `SKY_CLOCK`) over the framework's `core/solar` |
| The weather (R19), dealt last off its own stream; a sky picked by hand (`withSky`) | `engine/mapgen/weather.ts` (`dealWeather`, `weatherOf`, `withSky`) |
| A free ride's FRONT: dealt (`dealFront`, `FRONT_TURNS`), laid on by `createGame` only under `RunRules.front`, asked at a moment (`frontAt`: the two skies and the eased share; `weatherAt`: the fall, fog and wind mixed); with no front both hand back the dealt sky itself, bit for bit | `engine/mapgen/front.ts`; `tests/weather_front_test.ts` |
| The wind: a pure function of (level, t) at 10 m over open ground, never up the mountain; the AIR WHERE A SKIER IS (log law, exposure, the woods' shelter) | `engine/game/wind.ts` (`windAt`, `airAt`, `airflowAt`), `TUNING.wind` |
| The fall at a moment, the view it leaves, the new snow it lays | `engine/game/snowfall.ts` (`snowAt`, `visibilityIn`, `freshRate`); `snow.ts`'s `packedUnder` / `depthUnder` |

## The app's half (the PICTURE), by subject

Every file below is three-free unless it names a pass or a mesh; the
three-free ones are what the suite reads.

| Subject | Files | Owns |
| --- | --- | --- |
| THE CLOCK | `sky-clock.ts` | The app's rate (`setSkyClock`, off `?skyclock=`) and the one door every reader of the hour asks: `sunNow`, `moonNow`, `skyHourNow`, `skyLevelNow` |
| THE MODEL | `atmosphere-model.ts`, `sky-table-format.ts`, `sky-table.ts` (GENERATED), `sky-atmosphere.ts` | Hillaire's model (2020) with Earth's researched constants and `SKY_GROUND_ALBEDO`; never run in a frame — `make sky-table ARGS=--write` bakes it; `atmosphereRow` reads the table, `EXPOSURE` / `exposureOf` is the eye's adaptation, `AMBIENT_LIFT` |
| THE LOOK | `sky.ts` | `skyLookAt(level, t, rate?, eyeY?)` → the ONE `SkyLook`: the dome's exposed grid pressed by `DOME`, the sun's colour, the key, the sky light (`irradiance` harmonics), the haze and Earth's shadow on the low air (`hazeShadow`), the twilight's lift (`light`, `TWILIGHT`), the dawn shade's lift (`shadeLift`), the lamps' share (`lampLight`), the night, the cloud and the deck laid over it; under a front, the two skies' looks mixed (`blendLook`) |
| THE GPU SKY | `sky-gpu-plan.ts`, `sky-gpu-glsl.ts`, `sky-gpu.ts` | The same model in WebGL2 on MEDIUM and up (`SKY_TIER`): transmittance and multiple scattering once a weather, a sky-view table on LOW's own layout redrawn only when the sun, the exposure or the veil move (`SKY_REDRAW`); HIGH's aerial-perspective froxels (`aerialShade`); no WebGL2 falls back to LOW; `forceSkyTier` is the lab's |
| THE LIGHT ON THE GROUND | `sky-light.ts` (and `snow-sky-glsl.ts`, `snow-look`'s) | `skyIrradiance(n)` off the harmonics; THE KEY BY HEIGHT (`sunAtHeight`, `keyBandsFor`, `keyAtHeight`) — alpenglow is the transmittance at each band's own horizon |
| THE AIR | `haze.ts`, `horizon.ts` | `SKY_GLSL` and every world material's haze (`hazeMaterial`, `HAZE_FRAGMENT`); the uniforms shared by reference (`createHazeUniforms`); the true horizon's dip (`horizonDip`, `uFar`) and the far ground under it (`farColour`) |
| THE DOME | `sky-dome.ts`, `environment.ts` | The dome with the sun and moon discs and the 22° halo, through the same tone mapping as the world; the scene's key and hemisphere, re-read every frame; the shadow box aimed; the arena's floods |
| THE FAR RANGES | `far-ranges-field.ts`, `far-ranges-plan.ts`, `far-ranges.ts`, `far-faces.ts` (+ GENERATED `far-faces/`) | Real ground to the horizon, dealt or a real face's; rings by tier (`FAR_RINGS`, `FAR_TIER`) as the backdrop, the map's own coarse disc, each vertex lit through the air to its height and cut under its own horizon; the clipmap's rim (`FAR_RIM_GLSL`); `docs/far-ranges.md` |
| THE CLOUD | `cloud-field.ts`, `cloud-light.ts`, `cloud-glsl.ts`, `clouds.ts` | Each weather's layers at their genera's real heights, dealt, carried by the wind aloft, living a few minutes; the light on each layer (the sun's transmitted colour); LOW's shell, MEDIUM's slab (`CLOUD_TIER`), the halo, `cloudShadow`; `meanPass` the key is dimmed by |
| THE VOLUME | `cloud-volume-plan.ts`, `cloud-volume-noise.ts`, `cloud-noise-worker.ts`, `cloud-volume-glsl.ts`, `cloud-volume.ts` | HIGH's and MAX's raymarch (`VOLUME_LOOK`): Perlin-Worley noise made in a worker, Beer and powder light, a quarter-resolution picture reprojected with a block of pixels marched afresh a frame, a CUT (`isCut`) marching it whole; MEDIUM's slab until the noise lands |
| THE FRONT AS DRAWN | `cloud-front.ts` | The field morphed slot by slot (low, mid, high), a genus easing into the next under a dip, each slot's drift the INTEGRAL of its speed (`frontEaseArea`) |
| THE LOW DECK | `low-deck.ts` | The inversion's stratus (`dealLowDeck`), where an eye stands against it (`deckZone`): under (a ceiling), inside (fog), over (the sea, `haze.ts`'s `seaTop`) |
| THE MOUNTAIN'S SHADOW | `terrain-shadow.ts`, `terrain-shade.ts`, `terrain-shadow-worker.ts`, `shadow-box.ts`, `hero-shadow.ts` | The horizon map toward the key (`bakeHorizon`, `terrainLit`, blended across a turning sun by `HorizonBlend`); the shadow box ahead of the lens and its fade; the casters by where their shadow falls (`castsInto`); the skiers' own maps |
| THE NIGHT | `night-sky.ts`, `moon-glsl.ts`, `starfield.ts` | The moon's true size, phase, light and colour, earthshine, the eye's partial adaptation (`NIGHT`), the moonlit sky and airglow, the limiting magnitude; the disc drawn as a lit sphere; the stars turned to local sidereal time, sized in pixels, drawn past the faintest the sky lets through |
| THE LAMPS | `headlamp.ts`, `piste-light-plan.ts`, `piste-lights.ts`, `glow-sprite.ts` | Every headlamp and `dealLamps` into `LAMP_SLOTS` (scaled by `lampLight`); the piste lights' researched layout, asymmetric beam and baked light (`bakePisteLight`, read as `pisteLight`) |
| THE FALL | `snowfall-plan.ts`, `snowfall.ts` | The flakes as the smear of their velocity past the lens, the spindrift off the crests |

## The rules

- **ONE `SkyLook`, ONE SUN.** Anything that needs how bright, how warm or
  where the light is reads the look; nothing restates an elevation or a sun
  colour, and nothing caches a look across a frame.
- **THE SKY RUNS ON THE RUN'S OWN CLOCK, and nothing the race reads does.**
  Every reader of the hour asks `sky-clock.ts` — the sky, the stars, the
  snow's thaw, the birds, the sound, the people on foot, the cockpits — and
  never `level.sun.hour` or a bare `sunAtRun(level)`, which are the START
  hour. What a run DEALS off the sun at create (the night crowd, the piste
  machines, the snow guns, the piste's day) reads the start hour and stays
  as dealt: flipped mid-run it would move a digest and pop people out of
  the world. The rate is the app's, never engine state — 12 in the game,
  held (0) on every lab page that does not ask and on a link that names an
  `?hour=` — and a replay, re-skiing `state.t`, meets the same sky.
  Anything that follows the light reads it every frame, or when the sun has
  moved a step; a value worked out once at load is a bug.
- **THE FRONT IS THE ENGINE'S, AND ONLY A FREE RIDE'S.** `frontAt` /
  `weatherAt` are pure in (level, t) off their own salt; races never read
  them and `make sim` must not move. What is still read off the DEALT sky
  at create (the snowpack, the snow's age, the avalanche's load, the
  paramotor's turbulence) stays so on purpose until a part moves it.
- **A MIXED LOOK MIXES ITS SWITCHES.** `blendLook` mixes every number, and
  some numbers are switches: an `=== n` or `> n` against a mixed field puts
  the pop wherever it crosses n, often at the end of the change. A switch
  gets a share of its own (`CloudLook.lid`, 0..1). And anything placed by
  `speed · t` (a cloud slot's drift, a cell's life) is the integral of its
  speed, or a changed speed multiplies the run's whole time and the field
  races kilometres.
- **NOTHING MOVES IN STEPS.** The mountain's shadow is drawn between a map
  behind the key and one ahead (`HorizonBlend`); the shadow box's key is
  stepped (`steadyKey`) so its texel snap holds; a front's change and a
  deck's zones are blended over a margin. A per-frame continuous direction
  in a texel-snapped frame is a crawl; a jump of a threshold is a pop.
- **THE CLEAR SKY IS THE PHYSICS; WHAT IS TUNED IS THE EYE.** The glow, the
  Belt of Venus, Earth's shadow, the blue hour and the sun's colour come out
  of `atmosphere-model.ts` — never paint one into `sky.ts`. A look change
  may move the exposure (`EXPOSURE`), the dome's press (`DOME`), the lifts
  (`AMBIENT_LIFT`, `TWILIGHT`, the shade lift) and the night's eye
  (`NIGHT`). A model constant moved owes its source and `make sky-table
  ARGS=--write`.
- **ONE MODEL, THREE SKIES — a tier buys detail, never colour.** LOW's grid
  and the GPU's tables are the same march on the same layout, exposed by the
  same look numbers; a change to how `sky.ts` presses the grid is made in
  `VIEW_FRAGMENT` too, or the tiers part (`--sheet=skytier`, mean ΔE against
  LOW near 2 or under). The light on the snow is the table's at every tier.
  The SKY and the CLOUD ride the DISTANCE row (`SKY_TIER`, `CLOUD_TIER`,
  `FAR_TIER`); a row of their own waits on a real GPU's price saying HIGH
  against MEDIUM is over a millisecond.
- **THE SHADOWS ARE BLUE, AND THAT IS THE SKY'S JOB.** Shade is the sky's
  harmonics on the normal; grey shade is harmonics that lost their blue,
  never a shader wanting a tint. The key has a HEIGHT: the peaks keep a red
  sun after the valley loses it. The world's light is `SkyLook.light` (the
  exposure lifted through the twilight, the dome left alone); the lamps are
  scaled by `lampLight`, so a floodlight is lost under a twilight sky and
  is the whole light at night.
- **A DARK DAWN SHADE IS LIFTED IN THE SHADOW ONLY.** The low sun's lift
  multiplies the sky light only where `terrainLit` is low (`shadeLift`,
  `SHADE_LIFT`); laid on all the sky light it also cooled the sunset's
  golden key and greyed the dawn haze. Sunrise and sunset share elevations,
  so no profile by elevation alone can tell them apart — check both.
- **A LID IS DARKER THAN THE SNOW UNDER IT**, or overcast reads as a white
  sheet; and a deck brought to a target grey keeps its RELIEF (shade its
  floor by the point's height in the column). Judge a deck at noon and on a
  crop of its lumps, never by its mean alone.
- **THE SKY OVER SNOW IS BRIGHT** and its horizon a pale blue; a saturated
  horizon reads as summer. **The sun's colour is the air it crossed.**
- **CLOUDS TAKE THE SUN'S TRANSMITTED COLOUR** along their own path to
  their own height (`cloud-light.ts`): at golden hour the sunward edges and
  bases glow orange and red, the far ones warmest, the cirrus pink after
  sunset. A cloud lit by a constant key is the cold sunset the revamp
  replaced.
- **THE AIR IS THE SKY IN THAT DIRECTION.** Every world material fades
  through `hazeMaterial` into `skyColour` along its own direction (times
  `aerialShade` on HIGH); never three's fog, never a second haze path. After
  sunset the valleys' air is in Earth's shadow (`hazeShadow`), and a far
  ridge stands dark against the glow.
- **REAL GROUND TO THE HORIZON, never a skybox.** The far ranges are lit by
  the moving sun; under the true horizon's dip the fill is `farColour`, and
  the DISTANCE mist releases the rings and lets the ground past its wall be
  ground (`uMistOpen`), never a grey band.
- **THE NIGHT IS RECKONED, NOT PAINTED.** The moon's size, phase, light and
  colour and the stars the sky lets through come off `night-sky.ts`; the
  stars come out by the sky's brightness (`starLimit`), never by a sun
  elevation, and are SIZED IN PIXELS. Judge moonlight on a face AWAY from
  every lamp by the snow's MEAN — under a floodlight the moon cannot show —
  and fit the night's ambient to the RENDERED ratio (three's ambient reads
  about a sixth as bright as the key on snow).
- **MANY STILL LAMPS ARE A BAKE, NOT SLOTS.** The six `LAMP_SLOTS` are for
  lamps that move; the piste lights are one vector irradiance texture baked
  the first time the lamps come on. A slope flood is cut off above its aim
  (`beamShare`) or it lights the woods. A lamp on a skier hangs on the
  HEAD's frame, aimed off the head's own forward; `helmet-shape.ts` is a
  model source, so build off its exports and never edit it for a lamp.
- **ANYTHING IN THE AIR THE LENS RUNS THROUGH IS A SMEAR** of its velocity
  past the lens, measured off the camera frame to frame (`createLensTrack`),
  its light spread along the smear; a dot at speed strobes and reads as
  riding along.
- **THE SHADOW STANDS AHEAD OF THE LENS AND FADES AT ITS RIM**; what casts
  is decided by where its shadow falls (`castsInto`), never by distance or
  the frustum; the mountain shades itself (`terrainLit`) and a caster's
  depth pass drops what the mountain already shades (`castInLight`).
- **LINEAR LIGHT, AND EVERY HAND-WRITTEN SHADER CLOSES THE LOOP** with
  `#include <colorspace_fragment>` (and the dome's tone mapping), or it is
  half as bright as authored. GLSL ES reserves `half`, `input`, `output`,
  `filter`, `sample`: a local so named fails only on the GPU, where three
  logs it and draws nothing — only a lab that draws the material catches it.

## The seams the summer thread stands on

The summer ground (`summer-glsl.ts`) reads the sky ONLY through these, which
are extended and never renamed: GLSL `skyColour(dir)`, `hazeColour(dir)`,
`hazeAmount(dist, rise)`, `mistBand(dir)`, `terrainLit(...)`,
`skyIrradiance(n)`, `cloudShadow(worldPos)`; three's key
DirectionalLight; and the uniforms `uSunDir`, `uSunPos`, `uSunCol`, `uFlat`,
`uGlitter` in `HazeUniforms`. New sky code for the snow goes in
`snow-sky-glsl.ts`, hooked into `snow-glsl.ts` by ONE call where the light
is summed. Nothing in the sky assumes snow under it: the ground's albedo is
a parameter (`SKY_GROUND_ALBEDO`), and any day of the year at any latitude
must hold (a 77° noon sun, the midnight sun, the polar night — `make
sky-solar` carries those rows).

## The labs, and how to read them

The sky is judged on SHEETS, side by side, with numbers: a map is dealt one
sky at one hour, so a race's screenshot can only say whether that one is
wrong. Run each sheet `--json=FILE` before and `--compare=FILE` after; the
pictures land under `previews/`.

| Lab | For | Read |
| --- | --- | --- |
| `make sky-table` (`ARGS=--write`) | a model change, read before any picture | the zenith's and anti-solar horizon's luminance and blueness, the sun's transmittance, row by row |
| `make sky-solar` | the sun and moon | the worst rows against the NOAA reference: declination and elevation ≤ 0.05°, sunrise ≤ 1 min, moon ≤ 1° |
| `make sky` (`--sheet=weathers`, the default) | every weather × hours on one seed | the look as a whole; `ARGS="--hours=10,17 --weathers=fair,storm --width=640"` zooms |
| `make sky ARGS=--sheet=timelapse` (`--view=chase\|vista\|sunrise\|sunset\|antisun`, `--step=`, `--clock`, `--front`) | the day through, one view | each cell's `elev`, the model's `zenL`/`horL`, the drawn `skyL`/`skyK`, the snow's `litL`, `shadeL`, `ratio`, `shadeBlue`, `litWarm`, and `ms`. At sunrise and sunset the lit snow must read warm and the shade blue — `litWarm` and `shadeBlue` well apart from noon's; `--clock` walks the run's own clock (every frame drawn, the shadow baked ahead) and `--front` shows a front coming in (`a→b NN%` on each cell) |
| `--sheet=tiers`, `--sheet=skytier` | the presets, and the sky's own tiers forced | `dE`, `dSky`, `dE95` against LOW (stay near 2 or under) and the GPU passes' `ms` |
| `--sheet=far` (`--maps=`, `--no-far`) | the far ranges, a region or `face:<id>` a row | dawn, noon, sunset, dusk; `ms` against `msOff` and the tiers' triangles |
| `--sheet=clouds`, `cloudlapse`, `sunclouds`, `cloudshadow` | the cloud by tier, its motion, the sunset close-up, its shadow | `skyRB` and `warm` on the golden cells; the close-up must glow |
| `--sheet=cloudmotion` | the volume's reprojection | `dE` / `dE95` of the carried picture against a whole march, still to a whip pan; its header times every tier's pass alone (`sky-cloud-cost.ts`, a 1-pixel `readPixels` as the fence, because `finish` does not block headless) |
| `--sheet=lowdeck` | a run down through a deck | over, at the top, inside, at the base, under, and the sea at sunset |
| `--sheet=moon` | the night | the drawn disc against its true angle (perigee, apogee), and the snow's mean on a lamp-free face under a full, a quarter and no moon (about 3× and 8× apart) |
| `make snowfall` | the fall at speed | the flow sheet's tracks running out of the heading point |
| `make world ARGS="--hour=<h> --views=vista,chase-60"` (and `--free --skyclock=12`) | the same in a bot's run | an EARLY and a LATE hour, and `--hour=21` for the night |

Then `npx vitest run tests/atmosphere_test.ts tests/world_render_test.ts
tests/sky_light_test.ts tests/night_sky_test.ts tests/cloud_field_test.ts
tests/cloud_volume_test.ts tests/low_deck_test.ts tests/far_ranges_test.ts
tests/terrain_shadow_test.ts tests/weather_front_test.ts` for what the
change reaches, and `make sim` (digests unmoved) for anything under
`engine/`. Software GL (SwiftShader) times STRUCTURE, never speed: a lab's
`ms` is relative, and a price is `picture-pricing`'s, on a real GPU. When a
picture is "somehow flat", sample a column of pixels through the skyline —
the step at the horizon is a number.

## What a change owes elsewhere

- `make sky` sheets (and `make world` at an early and a late hour) before
  and after, in the PR; a pass's cost re-measured, and a stop's price
  (`picture-pricing`) when it moves.
- R15's bands → `docs/level-generator.md` (verbatim), `make analyze`;
  R19 or the front → `make sim` unmoved, `tests/weather_front_test.ts`.
- `docs/architecture.md`'s renderer bullet and `docs/configuration.md`'s
  `hour`, `skyclock`, `weather` and `front` rows; `docs/far-ranges.md` for
  the far country.
- A `.changes/unreleased/` fragment — the sky is what the player looks at.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth a fragment:
a colour that only read right in linear light, an hour at which the palette
broke while the rest held, a pop at a threshold, a lab that measured the
wrong pixels.

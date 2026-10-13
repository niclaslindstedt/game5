---
name: atmosphere
description: "Use when working on the SKY and the air under it — where the sun stands at the hour the run has reached (the start hour run on by the sky's clock, five minutes an hour) on its day at its latitude (R15, `sunAtRun`), what colour it makes the dome, the two lights and the blue in the snow's shadows, the haze every far slope dissolves into (one sky function read along each surface's own direction), and the key light's one shadow map over a circle ahead of the lens that every shadow fades out at the rim of — and over that the WEATHER R19 deals (clear, fair, flurries, high cloud, overcast, a steady fall, a storm, valley fog), its cloud, its falling snow in squalls and the new snow it lays (`snowAt`, `GameState.fresh`), its spindrift, its flat light, and the NIGHT an evening map rides into (the moon at its true size, phase and light — `night-sky.ts`, `moon-glsl.ts` — the stars and the Milky Way on the sky as it stands that night — `starfield.ts` — the floodlight masts down every run — `piste-light-plan.ts`, `piste-lights.ts` — the finish arena's floodlights and every skier's headlamp — `headlamp.ts`). Owns `pwa/src/game/sky.ts` (the colour model, three-free), `haze.ts`, `sky-dome.ts`, `environment.ts`, `snowfall.ts` (over `snowfall-plan.ts`: the fall's velocity past the lens), `starfield.ts`, and on the engine side `engine/game/clock.ts` (the sun and the moon), `engine/game/wind.ts`, `engine/game/snowfall.ts`, R15 in `mapgen/sun.ts` and R19 in `mapgen/weather.ts`; and `make sky`, the contact sheet that is the only honest way to judge any of it, with `make snowfall` for the fall at speed. Not the snow the light lands on (`snow-look`), not the trees (`nature`), not what the skis throw (`visual-effects`)."
---

# The atmosphere: the sun, the sky and the haze

Everything over the snow and in the air between the lens and the far ridges.
The picture is set here before a single track is drawn: the sun's elevation
decides the palette, the sky's blue decides what colour a shadow on snow is,
the haze decides how far the valley floor and the far ridges read. A change
here moves every picture in the game.

**A MAP IS DEALT ONE SKY AT ONE HOUR** (R15, R19): a seeded day at a seeded
latitude, one of eight weathers off a stream of its own (the bright ones most
days), and on a quarter of the maps an evening start at or after sunset.
THE SUN MOVES WITH THE RUN: the hour is the START hour, and the sky's clock
runs it on with `state.t` at twelve times real time (five minutes on the
snow an hour of sun — `SKY_CLOCK`), so a long free ride sees the sun go
down, the lamps come on and the stars come out; the fall breathes in
squalls and lays new snow. A
season's cast is NOT BUILT — `game3`'s `SEASON_LOOKS` is where it starts.

**Read this skill's lessons first** — `npx ogf-skill-lessons
atmosphere --list`. Load **`skill-reflection`** at both ends and
**`write-code`** beside this one for any code change.

## The engine's half, and the app's

The engine decides the FACTS and the app decides the PICTURE; nothing in the
engine has an opinion about colour.

| Fact | Where |
| --- | --- |
| The map's day: a latitude in the region's band (R21 — the alpine's 44–48°N, the fell's 60–69°N, the continental's 39–52°N, the maritime's 36–44°N), a day of the year (January to March) and a starting solar hour (9–16 h) at which the sun is at least `sun.minElevation` up (R15) | `engine/mapgen/sun.ts` (`dealSun`, `declinationOf`), `LEVEL_RULES.sun`, `regions.ts`'s `sun` |
| Where the sun stands over a run — at the map's START hour when no time is named (what every create-time decision reads), and at run time `t` on the SKY'S CLOCK (`skyHourAt`, `skyLevelAt`: the start hour run on at `SKY_CLOCK.rate`, past 24 h into the next day) for the picture — reckoned for a REAL INSTANT: the map's day a date in one nominal year (`SKY_YEAR`), its hour local apparent solar time, the declination and the equation of time off NOAA's series, the elevation the APPARENT one (lifted by the refraction; `trueElevation` beside it). The generator's R15 keeps its own cosine (`declinationOf`) — what a seed builds never moves for the sky | `sunAtRun(level, t?, rate?)`, `SKY_CLOCK`, `skyHourAt`, `skyLevelAt`, `skyDateOf` in `engine/game/clock.ts`; the app's rate and its readers' one door `pwa/src/game/sky-clock.ts` (`setSkyClock` off `?skyclock=`, `sunNow`, `moonNow`, `skyHourNow`, `skyLevelNow`) over the framework's `core/solar` `sunOnDate` |
| Sunrise and sunset as an almanac states them (the upper limb, the refraction counted) and any twilight's window — the whole clock under the midnight sun, null in the polar night | `sunWindowOf(level, depth?)` in `clock.ts` (`sunWindowOnDate`) |
| The moon: its place off its REAL ORBIT (Schlyter's series: its ecliptic latitude, the major standstill's ±28° swing, the parallax) and its real phase on the map's date | `moonAtRun(level, t?, rate?)`, `moonAgeOn` in `clock.ts` over the framework's `core/solar` `moonOnDate` |
| WHERE A MAP IS ON THE GLOBE: a generated map at its dealt latitude on the prime meridian; a REAL FACE stood at its own latitude, longitude and true north when a run is created (`withPlace` off `realFacePlace` — the sky only, nothing rebuilt), half a year on south of the equator (`seasonDay`, and the free ride's SEASON stops with it, `seasonOn`); a clock shown to the player reads the place's (`clockHourOf`: the equation of time and the zone's meridian off the solar hour) | `withPlace`, `seasonDay` in `engine/mapgen/sun.ts`; `clockHourOf` in `clock.ts`; `pwa/src/game/free-ride.ts`'s `seasonOn` |
| THE WEATHER (R19): the sky, the fall, the fog, the mean wind and its bearing, the evening — dealt last off its own stream so it moves nothing the map builds | `engine/mapgen/weather.ts` (`dealWeather`, `weatherOf`, `weatherFor`, `withSky`), `LEVEL_RULES.weather` |
| The wind at a moment: the mean breathing in gusts, veering, NEVER UP THE MOUNTAIN (a bearing up the fall line mirrored across it, `downhillFrom`; the mean as anything drawn reads it, `windFromOf`) — a PURE function of (level, t) at 10 m over open ground, drawing nothing from `state.rng`; and the AIR WHERE A SKIER IS — the log law down to his body, the mountain's exposure, the woods' shelter — which his drag is against (`air.ts`) and which he hears and the HUD reads | `windAt`, `windFromOf`, `downhillFrom`, `airAt`, `airflowAt` in `engine/game/wind.ts`, `TUNING.wind` |
| The fall at a moment (the squalls, a storm's blown snow) and the view it leaves — pure the same way — and the NEW SNOW it lays at a real fall's rate (`GameState.fresh`), the one thing a sky does to the physics | `snowAt`, `visibilityIn`, `freshRate` in `engine/game/snowfall.ts`; `packedUnder` / `depthUnder` in `snow.ts` |
| The astronomy: the sun's elevation and bearing at an hour, a latitude and a declination (`sunAt`); and on a real date at a longitude — the declination and equation of time, the refraction, upper-limb sunrise, the twilights, the moon's orbit (`sunOnDate`, `sunWindowOnDate`, `moonOnDate`). `make sky-solar` holds the game's sky to a NOAA reference at the real faces' places and the bands' edges through the year | the framework's `core/solar` — the generic pool |

## The files, one direction of flow

| File | Owns |
| --- | --- |
| `pwa/src/game/atmosphere-model.ts` | THE PHYSICAL ATMOSPHERE, three-free: Hillaire's model (2020) — the transmittance table on Bruneton's parametrisation, the multiple-scattering table (the infinite series summed as Ψ = L₂/(1 − f_ms), the snow's albedo in it), the sky's radiance marched with the planet's shadow, the sun through the air, the sky's irradiance as L2 harmonics (the sky above and the lit snow below). EARTH's constants per km: Rayleigh (5.802, 13.558, 33.1)·10⁻³ on 8 km, the aerosol's scattering 3.996·10⁻³ and extinction 4.4·10⁻³ on 1.2 km with g 0.8, ozone (0.65, 1.881, 0.085)·10⁻³ in a tent round 25 km; `SKY_GROUND_ALBEDO` the ground's parameter (snow 0.85; a summer's meadow beside it). Never runs in a frame — `make sky-table` bakes it |
| `pwa/src/game/sky-table-format.ts`, `sky-table.ts` (GENERATED) | The table's layout (38 sun elevations, a degree apart through the twilights, × the sea and 3 km; each row a 10 × 9 grid of radiance by the azimuth from the sun and the view's elevation, the sun's transmittance and 27 harmonics) and the table itself, 16-bit log codes. `make sky-table ARGS=--write` after any change to the model; `tests/atmosphere_test.ts` holds it to the model |
| `pwa/src/game/sky-atmosphere.ts` | The table read at run time (`atmosphereRow`: log-mixed between rows, a few hundred exponentials, read again only when the sun has moved a hundredth of a degree) and THE EYE'S ADAPTATION (`EXPOSURE`, `exposureOf` over `adaptingLight`: a little by day, much more through the twilights, capped so the night falls), and `AMBIENT_LIFT` (the sunlit slopes round the lens the model's level floor does not see) |
| `pwa/src/game/sky-gpu-plan.ts`, `sky-gpu-glsl.ts`, `sky-gpu.ts` | THE GPU SKY (MEDIUM and up, `SKY_TIER`): the same Hillaire model in WebGL2 — the transmittance and multiple-scattering tables once, a SKY-VIEW table on the baked grid's own layout redrawn only as the sun, the exposure, the dome's mean, the night's rows or the veil move (`SKY_REDRAW`), exposed exactly as `sky.ts` exposes the grid, so a tier changes the DETAIL and never the colours; a lid hands `uSkyView` back to the grid. On HIGH the AERIAL-PERSPECTIVE froxel volume (the share of the air's light the sun gives, marched through the map's ground) read by `aerialShade`. No WebGL2 or float target falls back to LOW; `forceSkyTier` is the lab's |
| `pwa/src/game/sky.ts` | WHAT COLOUR THE AIR IS: `skyLookAt(level, t)` → a `SkyLook` built on the physical row — the dome's exposed radiance grid (`view`, pressed about its own mean by `DOME` as an eye on the sky sees it, its grazing row pulled toward the one over it), the zenith and horizon read off it, the sun's colour its transmittance, the key exposed, the sky's light (`skyLight`, `groundLight`, `ambient` and the world-turned `irradiance` harmonics), the haze and after sunset the low air in Earth's shadow (`hazeShadow`); the night, the moon and the weather's LID laid over it. Linear RGB throughout. THREE-FREE, so `tests/world_render_test.ts` and `tests/atmosphere_test.ts` read the whole model |
| `pwa/src/game/haze.ts` | ONE SKY FUNCTION IN GLSL (`SKY_GLSL`, `skyColour(dir)`) and the haze every world material fades into, drawn from it along that surface's own direction (`HAZE_FRAGMENT`, `hazeMaterial`) — replacing three's one-colour fog; the uniforms ONE object shared by reference (`createHazeUniforms`, `writeHaze`) |
| `pwa/src/game/horizon.ts` | THE TRUE HORIZON: the dip a raised lens sees (`horizonDip`, acos(R′/(R′+h)) on a sphere stretched by the standard refraction — 1.1° from a 1.45 km summit, never the level), the lens's height over the far country (`heightOverFar`, written into `uFar` every frame). Under it the dome and the mist's wall are `haze.ts`'s `farColour`: the far ground (`SkyLook.farGround` / `.farKey`, a third's albedo, its faces turned to the lens) seen through the air by the length of the way down to it — the horizon's colour where it meets the sky, darker further down. Never a sky-coloured wall under the level |
| `pwa/src/game/night-sky.ts` | THE NIGHT AS NUMBERS, three-free (`tests/night_sky_test.ts`): the moon's distance on the date and its true radius (`moonDistance`, `moonRadius`: 29.4′–33.5′ across), the phase angle, its light by the phase law and the square of the distance (`phaseLaw`, `moonLux`), the surge over the lit disc (`surfaceSurge`), earthshine; the eye's partial adaptation (`NIGHT`, `nightGain`) that sets the moon's key and the night's ambient; the night sky's glow by the dome's rows (the moonlit sky off the physical table at the moon's height, pressed about its zenith; the airglow, `airglowShare`); the zenith's surface brightness and the faintest star (`limitingMagnitude`) — all of it `nightOf`, laid into the look by `sky.ts` |
| `pwa/src/game/moon-glsl.ts` | THE MOON AS DRAWN: a sphere at its true angle lit at the phase angle from the sun's side, Lommel–Seeliger pressed, the seas in its own frame north to the pole, the earthshine; the corona in thin cloud |
| `pwa/src/game/starfield.ts` | THE STARS: the sphere turned to the LOCAL SIDEREAL TIME of the map's hour and date at its latitude (`skyTurnOf`, `turnBasis`), so the Milky Way stands where it really does; two shells off the sky's census by magnitude, SIZED IN PIXELS, dimmed and reddened by their air mass, twinkling by it, and drawn only past the faintest the sky's brightness at that pixel lets through — the sibling jet-ski game's design, retyped |
| `pwa/src/game/sky-dome.ts` | The dome: `skyColour` painted on a sphere round the lens with the sun's disc on it, through the same tone mapping and output conversion as every lit surface, so the haze meets it with no seam |
| `pwa/src/game/snowfall.ts` | THE SNOW IN THE AIR: a wrapped box of flakes round the lens moved by one vector a frame (how hard it snows is the draw range; the SPRAY row caps the pool; a flake in the player's beam or the arena's floodlights lights up), and the spindrift lifted off the crests on the CPU when the wind can lift dry snow |
| `pwa/src/game/environment.ts` | Hangs it in the scene: the key light and the hemisphere light, the dome, the haze, re-read EVERY FRAME off the run's own clock; the key light's shadow box, aimed at a circle `SHADOW_LOOK[row].reach` (SKIERS: tight, the figures alone; MEDIUM and HIGH: every tree's too) round a point ahead of the lens and snapped to whole texels so a tree's shadow edge does not crawl, its normal bias scaled with the texel; at night the finish arena's FLOODLIGHTS on the run-out |
| `pwa/src/game/cloud-field.ts` | THE CLOUD FIELD (three-free): each weather's layers at their genera's real heights over the valley floor, dealt off the map's seed, carried by `windAloft` / `veerAloft`, evolving over a few-minute life; the tileable 3D noise and its CPU twin; a column's bottom and top; the mean pass the key is dimmed by (`meanPass`) |
| `pwa/src/game/cloud-light.ts` | The light on each layer (three-free): the sun through the air to that layer's height, pressed as the dome is; the sky on its top and base; the halo's strength; the fog sea's colour |
| `pwa/src/game/cloud-glsl.ts` | The field in GLSL: LOW's shell, MEDIUM's slab (HIGH's until the volume's noise is made), the 22° halo, and `cloudShadow` every world material multiplies into its key |
| `pwa/src/game/clouds.ts` | The passes: the noise texture, the shadow map laid over the map, the half-resolution slab (`CLOUD_TIER`), the uniforms each frame and HIGH's and MAX's volume handed over to `cloud-volume.ts`; each layer's `shade` (0 over a low deck's top: it no longer dims the key) |
| `pwa/src/game/cloud-volume-noise.ts`, `cloud-noise-worker.ts` | THE VOLUME'S NOISE, made in code: a 64³ Perlin-Worley shape (a gradient fbm dilated by a cellular one, and three cellular fbms) and a 32³ cellular detail, tiling, built in a worker in about a second (`volumeNoise`); `shapeOf` the shader's own read of a shape texel |
| `pwa/src/game/cloud-volume-plan.ts` | THE VOLUME'S PLAN, three-free: HIGH's and MAX's steps and light reads (`VOLUME_LOOK`), the ordered block a frame's fresh pixels walk (`bayerOrder`), the kept and fresh sizes, what a CUT is (`CUT`, `isCut` — the whole picture marched again), each genus's carve (`carveOf`: the tiles, the detail's bite, the boil) and its wrapped offsets (`carveOffsets`) |
| `pwa/src/game/cloud-volume-glsl.ts`, `cloud-volume.ts` | THE RAYMARCHED VOLUME (HIGH, MAX): each layer a spherical shell under the field as its weather map, marched from a jittered start in adaptive steps, the detail's bite faded with distance; lit by Beer's law with the powder term, multiple-scatter octaves and a two-stream floor, the light's march finished by the deck's own way out of its layer (through the top by day, the base after sunset), the sun's colour the one `cloud-light.ts` deals each layer, the moon a soft ambient; a quarter-resolution picture reprojected (MRT, a motion-aware clamp), a block's pixel marched afresh a frame |
| `pwa/src/game/low-deck.ts` | THE LOW DECK, three-free: the inversion's stratus a half of the overcast days and a few fair ones deal, its top a third to three quarters up the mountain (`dealLowDeck`), and where an eye stands against it (`deckZone`); `sky.ts`'s `skyLookAt(level, t, rate, eyeY)` blends the under, inside and over looks off it, the sea's top lumped by `haze.ts`'s `seaLumps`. `make sky ARGS=--sheet=lowdeck` rides a run down through it |
| `pwa/src/game/headlamp.ts` | THE LAMPS AFTER DARK: every skier's HEADLAMP, strapped to the brow of his helmet on the head's own frame (so on the code's helmet and the model's alike — one shell, `helmet-shape.ts`'s `helmetReach`) — a narrow SPOT and a WIDE FLOOD round it, a neutral-white LED, its lens glowing and its halo seen from ahead — and `dealLamps`, which deals the `LAMP_SLOTS` (`haze.ts`) every frame: the player's lamp first, then the floods, then the field's within reach of the lens. Each slot carries its own colour and beam; `LAMP_GLSL`'s `lampReach` is the one beam every shader reads (the snow with its glitter, the trees, gates and skiers through `hazeMaterial`'s lamp term, the falling flakes, the snow cloud) |
| `pwa/src/game/piste-light-plan.ts` | THE PISTE LIGHTS' LAYOUT, three-free, researched (the numbers are in its header): masts about 50 m apart, 10–18 m light points, 4000 K floods for 30 lx aimed down and across the run; the ASYMMETRIC beam (`beamShare`), whose sharp cut-off above the aim is what leaves the woods past the edge dark; and the BAKE (`bakePisteLight`, 4 m a texel, crests shadowing). `tests/piste_lights_test.ts` holds the recreational class (20 lx mean, 4 lx minimum, under 1 lx 30 m past the edge) |
| `pwa/src/game/piste-lights.ts` | The masts as drawn (four instanced draws: pole, crossarm, housing, glass), the haloes (one instanced quad a glass, turned to the lens, a few pixels at least so a lit run reads across the valley) and the bake uploaded the first time the lamps come on, as one half-float texture every shader reads through `LAMP_GLSL`'s `pisteLight` — never through the six lamp slots, which are the moving lamps'. One lux is `LUX_TO_LAMP` in the slots' units, set so a headlamp's spot and a mast's pool sit on one scale. Built by `gates.ts`, lit by its `setLamps` |
| `pwa/src/game/shadow-box.ts` | WHERE THE SHADOW STANDS, three-free: the circle ahead of the lens (`aimShadow`), its fade (`shadowFade`), how long a tree's shadow is at this sun (`shadowLength`) and whether it reaches the circle (`castsInto` — what `forest.ts` picks its casters by). The fade itself is a graft on three's `lights_fragment_begin` inside `hazeMaterial`, so every world material fades the same shadow at the same rim |
| `pwa/src/game/terrain-shadow.ts` | THE MOUNTAIN'S OWN SHADOW, three-free: the HORIZON each texel sees along the key's bearing (`bakeHorizon`, one convex-hull sweep), the key's share under it (`sunlitShare`) and the GLSL (`terrainLit`). Only a new BEARING needs a bake, and a TURNING key is drawn between a map behind it and one baked ahead (`HorizonBlend`) so a ridge's shadow glides; a key that jumps is a cut |
| `pwa/src/game/terrain-shade.ts` | The horizon on the GPU: asked of `terrain-shadow-worker.ts` (off the thread — a million samples), uploaded as one half-float texture, on while the SHADOWS row casts at all; and `shadeDepth` / `castInLight`, the depth every caster draws into the key's map and the skiers' own through, which throws away what the mountain already shades |
| `pwa/src/game/hero-shadow.ts` | THE SKIERS' OWN SHADOWS (SHADOWS HIGH): every skier and his skis — the player and the field, a quadrant of one atlas each — cast into a map of their own, a box in the key light's frame just round their bound (`heroFrame` in `shadow-box.ts`) following them exactly — millimetres a texel where the wide map's are centimetres — and are taken OUT of the wide map, so no blurred copy swims round the sharp one. Every world material takes the darkest of them (`haze.ts`'s `heroShadowed`) |
| `pwa/src/game/far-ranges-field.ts`, `far-ranges-plan.ts`, `far-ranges.ts` | THE FAR RANGES (`docs/far-ranges.md`): real ground to the horizon, never a skybox — dealt off the seed on its own salt or a real face's off the 90 m model (`far-faces.ts`); rings by tier and a coarse disc behind the clipmap, each vertex lit through the air to its own height and cut under its own horizon; the haze eased past 4 km and the clipmap's RIM (`FAR_RIM_GLSL`) meeting it. `make sky ARGS=--sheet=far` is its lab |

## The rules

- **THE SKY RUNS ON THE RUN'S OWN CLOCK, and nothing the race reads does.**
  Every reader of the hour asks `sky-clock.ts` (`sunNow`, `moonNow`,
  `skyHourNow`, `skyLookAt(level, state.t)`) — the sky, the stars, the
  snow's thaw (re-packed as the sun moves), the birds, the sound, the people
  on foot, the cockpits' clocks — and never `level.sun.hour` or a bare
  `sunAtRun(level)`, which are the START hour. What a run DEALS off the sun
  when it is created (the night crowd, the piste machines, the snow guns,
  the piste's day) reads the start hour and stays as dealt: flipped mid-run
  it would move a digest and pop people out of the world. The rate is the
  app's, never engine state — 12 in the game, held (0) on every lab page
  that does not ask and on a link that names an `?hour=` — and a replay,
  re-skiing `state.t`, is met under the same sky. Anything that must follow
  the light as it changes reads it EVERY FRAME (or re-reads when the sun has
  moved a step); a value worked out once at load off the sun is a bug now.
- **A turning sun moves no edge in steps.** The mountain's shadow is drawn
  between a map behind the key and one ahead of it (`HorizonBlend`); the
  shadow box's key is stepped (`steadyKey`, a thousandth of a radian) so its
  frame stands between steps and the texel snap still holds a tree's edge.
  A per-frame continuous direction in a texel-snapped frame is a crawl.

- **The `SkyLook` is the one sun.** Anything that needs how bright, how
  warm or where the light is reads it; nothing restates an elevation or a
  sun colour, and nothing caches a look across a frame.
- **THE SHADOWS ARE BLUE, AND THAT IS THE SKY'S JOB.** What fills a shadow on
  snow is the sky: every world material reads the physical sky's irradiance
  harmonics on its normal (`sky-light.ts`'s `skyIrradiance`, `uSkySh`), so
  shade is the zenith's blue by a low sun and the Belt's pink after it.
  Shade that reads grey is harmonics that lost their blue, not a shader
  that needs a tint. THE KEY HAS A HEIGHT (`keyAtHeight`, `keyBandsFor`):
  the peaks keep a red sun minutes after the valley loses it — alpenglow is
  the transmittance at each band's own horizon, never a paint. The world's
  light is `SkyLook.light` (the exposure lifted through the twilight, the
  dome left as it is), and the lamps are scaled by `lampLight` so a
  floodlight is lost under a twilight sky and is the night's whole light.
- **The sky over snow is bright.** Fresh snow sends most of the light back
  up; a winter horizon is a pale, almost white blue. A saturated horizon
  reads as summer.
- **The sun's colour is the air it crossed**, not a table of hand-picked
  oranges: a low February sun at 62°N is gold because of the air mass, and
  the model says so.
- **THE CLEAR SKY IS THE PHYSICS; WHAT IS TUNED IS THE EYE.** The glow, the
  Belt of Venus, Earth's shadow and the blue hour come out of
  `atmosphere-model.ts` and its researched constants — never paint one into
  `sky.ts`. What a look change may move is the exposure (`EXPOSURE`), the
  dome's tone (`DOME`) and the lift (`AMBIENT_LIFT`); a constant of the
  model moved owes its source and `make sky-table ARGS=--write`.
- **ONE MODEL, THREE SKIES — a tier buys detail, never colour.** LOW's
  baked grid and the GPU's MEDIUM and HIGH tables are the same march on the
  same layout, exposed by the same `SkyLook` numbers (`exposure`,
  `domeMean`, `veil`, `altitude`); a change to how `sky.ts` exposes or
  presses the grid is made in `VIEW_FRAGMENT` too, or the tiers part
  (`make sky ARGS=--sheet=skytier`: mean ΔE against LOW stays near 2 or
  under). The light on the snow is the table's at every tier. Far ground
  drawn with `hazeMaterial` gets the aerial perspective for nothing — never
  a second haze path.
- **THE NIGHT IS RECKONED, NOT PAINTED.** The moon's size, phase, light
  and colour, the night sky's brightness and the stars it lets through all
  come off `night-sky.ts`'s physics; what is tuned is the EYE (`NIGHT`: the
  adaptation's slope, the key's, the ambient's and the sky's units, `DISC`
  the moon's press). Judge it on `make sky ARGS=--sheet=moon` — the
  measured disc against its true angle, and the snow's mean under a full,
  a quarter and no moon (about 3× and 8×) on a face away from the lamps:
  under a floodlight the moon cannot show, and the snow's `litL` reads
  lamps and glints, not the night. The stars come out by the sky's
  brightness (`starLimit`), never by a sun elevation.
- **After sunset the valleys' air is in Earth's shadow.** The far ridges
  stand dark against the glow (`hazeShadow`); a haze that takes the glow's
  orange onto the ground reads as a fire, not a dusk.
- **The haze is the sky in that direction.** A ridge two kilometres off
  dissolves into exactly the sky behind it — warmer toward the sun, bluer
  away. A flat fog colour stands in the picture as a grey band; never
  reintroduce three's own fog in a world material, use `hazeMaterial`.
- **Linear light, and every hand-written shader closes the loop.** `sky.ts`
  authors linear RGB; a `ShaderMaterial` that writes straight to
  `gl_FragColor` skips the output conversion and hands out a picture half as
  bright as authored — which reads as a far slope glowing brighter than the
  sky, never as "too dark". Every custom one ends with
  `#include <colorspace_fragment>` (and the tone mapping the dome shares).
- **The shadow stands ahead of the lens, not round the skier**, and FADES at
  its rim. A chase camera puts the skier at the bottom of the frame, so a
  box round him spends half its texels behind the lens; and a map that
  simply stops is a straight line across the snow that shadows pop over as
  it travels. Past the circle the haze and the terrain's forest tint carry
  the woods. Widening it to shadow the whole face is a blurred shadow for
  every tree.
- **The mountain shades itself, and what stands in its shade casts
  nothing.** A face turned from a low sun is in the shade of the ground
  above it; the key's shadow map cannot say so (the ground is not drawn
  into it, and could not be at its reach), so the horizon map does, taken
  with the map the darker of the two — one shadow model, the key taken away
  and the sky left. And a caster's depth pass discards what the mountain
  already shades (`shadeDepth`): without it a skier in a face's shade still
  takes the sun on his body and throws a long, thin shadow down-sun onto the
  first sunlit crest ahead — tens of metres from his feet, closing in as he
  skis toward it. A caster added anywhere goes through `castInLight`.
- **What casts is decided by where the shadow falls**, never by how near
  its tree is to the lens (`castsInto`). A caster set cut by distance to the
  lens, or by the view frustum, is a shadow that appears as the skier
  closes on a wood, and one that vanishes when the lens turns away from the
  tree standing behind it. The casters are their own shadow-only set —
  three picks its shadow pass off the MAIN camera's layers, so a layer
  cannot hide them from the picture; their material clips every vertex
  instead.

## The loop

**`make sky-table`** prints the physical sky row by row (the zenith's and
the anti-solar horizon's luminance and blueness, the sun's transmittance)
before any picture: a model change is read there first.
**`make sky` FIRST** for the picture — every weather (with a light fall and a blizzard) against
every three hours on one seed from one place, as one sheet
(`previews/sky-<seed>.png`; `ARGS="--hours=10,17,22 --weathers=fair,blizzard
--width=640 --height=360"` to zoom a few cells). A map is dealt one sky at one
hour, so a race's screenshot can only say whether that one is wrong; the
ladder is judged side by side. The time-lapse (`--sheet=timelapse`) sets the
hour cell by cell; with `--clock` it walks the RUN'S OWN CLOCK instead (the
sky's clock at `--rate`, every frame between two cells drawn, the mountain's
shadow baked ahead and blended as in a run) — what a player sees as the sun
goes down. Then each subject's own sheet, `--json` before and `--compare` after:

- `--sheet=skytier` — the three SKY TIERS forced over six suns, each cell's ΔE against LOW (`dE`, `dSky`, `dE95`) and the GPU passes' ms; any GPU sky change.
- `--sheet=moon` — THE NIGHT (`sky-night-sheet.ts`): a lunation on a long lens, perigee against apogee at one zoom with the drawn diameter measured, the full moon rising, the snow and the sky under a full, a quarter and no moon.
- `--sheet=clouds`, `sunclouds`, `cloudmotion`, `lowdeck` — THE CLOUD: every weather under each tier; the sunset close-up; the reprojected volume against whole marches (`sky-cloud-cost.ts` times each pass, a 1-pixel `readPixels` as the fence because `finish` does not block headless); the low deck from over it to under it.
- `make world ARGS="--free --hour=<h> --skyclock=12 --views=chase-0,chase-60,…"` — the same through a bot's run.
- `make snowfall` — THE FALLING SNOW: each falling sky ridden at 0–140 km/h, the frame and the flakes' tracks (`-flow.png`, running out of the heading point at speed), with the table of the air past the lens off `snowfall-plan.ts`.

Then:

1. `make world SEED=<n> ARGS=--views=vista,powder,forest` at seeds with an
   EARLY and a LATE hour (`make level SEED=<n>` prints the day; a low sun is
   where a palette change breaks; `ARGS=--hour=15.3` puts any map under one)
   — the dome, the haze on the rim, the blue in the shadows. A shadow that
   changes as the skier descends is the chase series: `chase-<s>` views at
   any second of the run (`chase-60,chase-90,chase-120` by default).
2. `npx vitest run tests/terrain_shadow_test.ts` — the mountain's shadow on
   hand-built ground: a wall's shade as long as the key throws it, a face
   turned from the key.
3. Sample a column of pixels through the skyline when a picture is "somehow
   flat" rather than arguing about it — the step at the horizon is a number.
4. `npx vitest run tests/world_render_test.ts` — the colour model.
5. `make build`, `make screenshots` — the game's framing at every viewport;
   `make profile` if the shadow or a pass changed.

## What the change obliges elsewhere

- `make world` pictures at an early and a late hour, before and after, in the
  PR; `make profile` for a shadow or pass change.
- A change to R15's bands → `docs/level-generator.md` (verbatim), `make
  analyze`, `tests/mapgen_test.ts`.
- The renderer bullet in `docs/architecture.md`.
- A `.changes/unreleased/` fragment — the sky is what the player looks at.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth a fragment: a
colour that only read right in linear light, an hour at which the palette
broke while the rest held, a shadow artefact and its cause.

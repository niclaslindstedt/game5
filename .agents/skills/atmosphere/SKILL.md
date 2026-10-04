---
name: atmosphere
description: "Use when working on the SKY and the air under it — where the sun stands at the map's hour (still for the whole run) on its day at its latitude (R15, `sunAtRun`), what colour it makes the dome, the two lights and the blue in the snow's shadows, the haze every far slope dissolves into (one sky function read along each surface's own direction), and the key light's one shadow map over a circle ahead of the lens that every shadow fades out at the rim of — and over that the WEATHER R19 deals (clear, fair, flurries, high cloud, overcast, a steady fall, a storm, valley fog), its cloud, its falling snow in squalls and the new snow it lays (`snowAt`, `GameState.fresh`), its spindrift, its flat light, and the NIGHT an evening map rides into (the moon as the key, the stars and the Milky Way — `starfield.ts` — the floodlight masts down every run — `piste-light-plan.ts`, `piste-lights.ts` — the finish arena's floodlights and every skier's headlamp — `headlamp.ts`). Owns `pwa/src/game/sky.ts` (the colour model, three-free), `haze.ts`, `sky-dome.ts`, `environment.ts`, `snowfall.ts` (over `snowfall-plan.ts`: the fall's velocity past the lens), `starfield.ts`, and on the engine side `engine/game/clock.ts` (the sun and the moon), `engine/game/wind.ts`, `engine/game/snowfall.ts`, R15 in `mapgen/sun.ts` and R19 in `mapgen/weather.ts`; and `make sky`, the contact sheet that is the only honest way to judge any of it, with `make snowfall` for the fall at speed. Not the snow the light lands on (`snow-look`), not the trees (`nature`), not what the skis throw (`visual-effects`)."
---

# The atmosphere: the sun, the sky and the haze

Everything over the snow and in the air between the lens and the far ridges.
The picture is set here before a single track is drawn: the sun's elevation
decides the palette, the sky's blue decides what colour a shadow on snow is,
the haze decides how far the valley floor and the far ridges read. A change
here moves every picture in the game.

**A MAP IS DEALT ONE SKY AT ONE HOUR** (R15, R19): a seeded day at a seeded
latitude, one of eight weathers off a stream of its own (the bright ones most
days), and on a quarter of the maps an evening start at or after sunset. The
sun does not move over a run; what changes is the fall, in squalls, and the
new snow it lays. A
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
| Where the sun stands over a run — at the map's hour, STILL from the green to the flag | `sunAtRun(level)` in `engine/game/clock.ts` |
| The moon: its place and its phase off the map's day (a nominal year, so R15's two months carry two lunations) | `moonAtRun(level)`, `moonAgeOn` in `clock.ts` over the framework's `core/solar` `moonAt` |
| THE WEATHER (R19): the sky, the fall, the fog, the mean wind and its bearing, the evening — dealt last off its own stream so it moves nothing the map builds | `engine/mapgen/weather.ts` (`dealWeather`, `weatherOf`, `weatherFor`, `withSky`), `LEVEL_RULES.weather` |
| The wind at a moment: the mean breathing in gusts, veering — a PURE function of (level, t), drawing nothing from `state.rng`, read by nothing in the physics | `windAt` in `engine/game/wind.ts` |
| The fall at a moment (the squalls, a storm's blown snow) and the view it leaves — pure the same way — and the NEW SNOW it lays at a real fall's rate (`GameState.fresh`), the one thing a sky does to the physics | `snowAt`, `visibilityIn`, `freshRate` in `engine/game/snowfall.ts`; `packedUnder` / `depthUnder` in `snow.ts` |
| The astronomy: the sun's elevation and bearing at an hour, a latitude and a declination | the framework's `core/solar` (`sunAt`) — the generic pool |

## The files, one direction of flow

| File | Owns |
| --- | --- |
| `pwa/src/game/sky.ts` | WHAT COLOUR THE AIR IS: `skyLookAt(level, t)` → a `SkyLook` — the dome's zenith and horizon, the sun's own colour through the air it crossed (per-channel transmittance `exp(−k · airmass)` over the Kasten–Young air mass, `airMass`, `sunTint`), the two halves of the hemisphere light, the haze. Linear RGB throughout. THREE-FREE, so `tests/world_render_test.ts` reads the whole model |
| `pwa/src/game/haze.ts` | ONE SKY FUNCTION IN GLSL (`SKY_GLSL`, `skyColour(dir)`) and the haze every world material fades into, drawn from it along that surface's own direction (`HAZE_FRAGMENT`, `hazeMaterial`) — replacing three's one-colour fog; the uniforms ONE object shared by reference (`createHazeUniforms`, `writeHaze`) |
| `pwa/src/game/starfield.ts` | THE NIGHT SKY: the sphere of stars turned to the map's hour, day and latitude (`skyTurnOf`, `turnBasis`), two shells of stars SIZED IN PIXELS off the ray's derivative, the twinkle, the Milky Way at its real tilt with its rift, the moon's glare washing the faint sky out — the sibling jet-ski game's design, retyped |
| `pwa/src/game/sky-dome.ts` | The dome: `skyColour` painted on a sphere round the lens with the sun's disc on it, through the same tone mapping and output conversion as every lit surface, so the haze meets it with no seam |
| `pwa/src/game/snowfall.ts` | THE SNOW IN THE AIR: a wrapped box of flakes round the lens moved by one vector a frame (how hard it snows is the draw range; the SPRAY row caps the pool; a flake in the player's beam or the arena's floodlights lights up), and the spindrift lifted off the crests on the CPU when the wind can lift dry snow |
| `pwa/src/game/environment.ts` | Hangs it in the scene: the key light and the hemisphere light, the dome, the haze, re-read EVERY FRAME off the run's own clock; the key light's shadow box, aimed at a circle `SHADOW_LOOK[row].reach` (SKIERS: tight, the figures alone; MEDIUM and HIGH: every tree's too) round a point ahead of the lens and snapped to whole texels so a tree's shadow edge does not crawl, its normal bias scaled with the texel; at night the finish arena's FLOODLIGHTS on the run-out |
| `pwa/src/game/headlamp.ts` | THE LAMPS AFTER DARK: every skier's HEADLAMP, strapped to the brow of his helmet on the head's own frame (so on the code's helmet and the model's alike — one shell, `helmet-shape.ts`'s `helmetReach`) — a narrow SPOT and a WIDE FLOOD round it, a neutral-white LED, its lens glowing and its halo seen from ahead — and `dealLamps`, which deals the `LAMP_SLOTS` (`haze.ts`) every frame: the player's lamp first, then the floods, then the field's within reach of the lens. Each slot carries its own colour and beam; `LAMP_GLSL`'s `lampReach` is the one beam every shader reads (the snow with its glitter, the trees, gates and skiers through `hazeMaterial`'s lamp term, the falling flakes, the snow cloud) |
| `pwa/src/game/piste-light-plan.ts` | THE PISTE LIGHTS' LAYOUT, three-free, RESEARCHED (the sources' numbers are in its header): masts some 50 m apart down every run on one side (both past 70 m of width), `out` m past the edge, a light point of 10–18 m by the width, one to three 4000 K LED floods each sized for 30 lx and aimed down and across the run; the ASYMMETRIC beam (`beamShare`: thrown out at its aim from the nadir, slow toward the mast's foot, cut off sharply above the aim — the cut-off is what leaves the woods past the far edge dark; a round 60° beam tipped down throws its top edge nearly level and lights the trees tens of metres off); and the BAKE (`bakePisteLight`): the vector irradiance on the ground over the whole map, 4 m a texel, a crest between lamp and snow its shadow. `tests/piste_lights_test.ts` holds it to the recreational class (20 lx mean, 4 lx minimum) and the snow 30 m past the edge under 1 lx |
| `pwa/src/game/piste-lights.ts` | The masts as drawn (four instanced draws: pole, crossarm, housing, glass), the haloes (one instanced quad a glass, turned to the lens, a few pixels at least so a lit run reads across the valley) and the bake uploaded the first time the lamps come on, as one half-float texture every shader reads through `LAMP_GLSL`'s `pisteLight` — never through the six lamp slots, which are the moving lamps'. One lux is `LUX_TO_LAMP` in the slots' units, set so a headlamp's spot and a mast's pool sit on one scale. Built by `gates.ts`, lit by its `setLamps` |
| `pwa/src/game/shadow-box.ts` | WHERE THE SHADOW STANDS, three-free: the circle ahead of the lens (`aimShadow`), its fade (`shadowFade`), how long a tree's shadow is at this sun (`shadowLength`) and whether it reaches the circle (`castsInto` — what `forest.ts` picks its casters by). The fade itself is a graft on three's `lights_fragment_begin` inside `hazeMaterial`, so every world material fades the same shadow at the same rim |
| `pwa/src/game/terrain-shadow.ts` | THE MOUNTAIN'S OWN SHADOW, three-free: the HORIZON every texel of a grid over the whole map sees along the key's bearing, baked by one convex-hull sweep of the engine's heightfield (`bakeHorizon`), and the share of the key a point under it takes (`sunlitShare`, a band as soft as the sun's disc) — and the same in GLSL (`TERRAIN_SHADOW_GLSL`'s `terrainLit`). The key stands still over a run, so it is baked once a map and again only when the key's BEARING moves (`bakedFor`); its elevation is compared per pixel |
| `pwa/src/game/terrain-shade.ts` | The horizon on the GPU: asked of `terrain-shadow-worker.ts` (off the thread — a million samples), uploaded as one half-float texture, on while the SHADOWS row casts at all; and `shadeDepth` / `castInLight`, the depth every caster draws into the key's map and the skiers' own through, which throws away what the mountain already shades |
| `pwa/src/game/hero-shadow.ts` | THE SKIERS' OWN SHADOWS (SHADOWS HIGH): every skier and his skis — the player and the field, a quadrant of one atlas each — cast into a map of their own, a box in the key light's frame just round their bound (`heroFrame` in `shadow-box.ts`) following them exactly — millimetres a texel where the wide map's are centimetres — and are taken OUT of the wide map, so no blurred copy swims round the sharp one. Every world material takes the darkest of them (`haze.ts`'s `heroShadowed`) |

## The rules

- **The sun is the single input, and it is asked every frame.** Anything
  that needs to know how bright, how warm or where the light is reads the
  `SkyLook` — the snow's glitter and sheen, the haze, the shadows. Nothing
  restates an elevation or picks its own sun colour, and nothing caches a
  look across a frame: a card or a lab can change the sky under a live
  scene, and the fall breathes in squalls.
- **THE SHADOWS ARE BLUE, AND THAT IS THE SKY'S JOB.** What fills a shadow on
  snow is the sky, so the hemisphere's upper colour is a real blue and the
  bounce under it near-white. Shade that reads grey is a hemisphere light
  that lost its blue, not a snow shader that needs a tint.
- **The sky over snow is bright.** Fresh snow sends most of the light back
  up; a winter horizon is a pale, almost white blue. A saturated horizon
  reads as summer.
- **The sun's colour is the air it crossed**, not a table of hand-picked
  oranges: a low February sun at 62°N is gold because of the air mass, and
  the model says so.
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

**`make sky` FIRST** — every weather (with a light fall and a blizzard) against
every three hours on one seed from one place, as one sheet
(`previews/sky-<seed>.png`; `ARGS="--hours=10,17,22 --weathers=fair,blizzard
--width=640 --height=360"` to zoom a few cells). A map is dealt one sky at one
hour, so a race's screenshot can only say whether that one is wrong; the
ladder is judged side by side. A change to the FALLING SNOW (how it moves,
how a flake is drawn) owes **`make snowfall`** before and after as well: each
falling sky ridden into, with and across its wind at 0–140 km/h, the game's
frame (`previews/snowfall-<seed>.png`) and the flakes alone laid over several
frames (`-flow.png`, every flake's way across the picture a track — at speed
they run out of the heading point, unbroken), with the table of the air past
the lens off `snowfall-plan.ts`. Then:

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

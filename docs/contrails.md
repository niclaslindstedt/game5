# Contrails

The airliners' trails in the winter sky over the mountain. They show up now
and then (about one flight a minute crosses the sky within view), some as a
short line that is gone in seconds, some as a trail that spreads into a band
of cirrus and drifts away on the wind aloft. Whether a plane leaves a trail,
and whether the trail lasts, is decided by the air it flies through. Under a
humid high sky, the trails build up into a cross-hatch.

They are PRESENTATION ONLY. The plan is a pure function of the map's seed,
its day and sky, and the run's clock `t`, dealt off a salt of its own and
never `state.rng`, so no digest can see it. They draw in every mode that has
a sky.

## What the research says

- **Formation: the Schmidt–Appleman criterion.** Engine exhaust is hot and
  wet. As it mixes into the cold ambient air, the mixture's state moves
  along a straight line on a temperature–vapour-pressure chart, with slope
  `G = c_p · p · EI_H2O / (ε · Q · (1 − η))`. Kerosene gives
  `EI_H2O = 1.25` kg/kg and `Q = 43.2` MJ/kg; `ε = 0.622`, and a modern
  engine has an overall efficiency of `η ≈ 0.3`. A trail forms where that
  line crosses water saturation, which happens when the ambient air is
  colder than a threshold:
  - in saturated air, about −40 °C at cruise pressures;
  - in dry air, a few degrees colder still.

  The plan uses Schumann's fit for the saturated threshold:
  `T_LM = −46.46 + 9.43 ln(G − 0.053) + 0.72 ln²(G − 0.053)` (°C,
  `G` in Pa/K). Below saturation, the threshold drops by about 4.6 K times
  the dryness (`formationTemp`).
- **Persistence: ice supersaturation.** Once formed, the ice crystals
  survive only in air that is saturated with respect to ICE. In drier air
  they sublimate within seconds to a minute, which gives a short trail. In
  ice-supersaturated air (`RHi > 1`) they grow and the trail spreads into a
  contrail cirrus band. Such layers are a few hundred metres to a couple of
  kilometres deep. They are common ahead of a warm front and under a
  sheet of high cirrus, and rare in clear, dry high pressure.
- **How a trail lives.**
  - It is born behind the plane after a short dark gap (the exhaust's water
    takes a second or so to freeze out), as two lines that merge into one
    within seconds.
  - The wake's vortex pair carries it down a hundred metres or two in the
    first minutes.
  - The Crow instability makes the line wavy, then pinches it into a row of
    puffs after a minute or two.
  - A lasting trail then spreads at one to a few metres a second, wind
    shear drawing it out into a fibrous band that is kilometres wide within
    the hour, until it fades into the cirrus it has become.
- **Light.** At 10–11 km a trail is still in the sun about 3° below the
  ground's horizon. That is some ten minutes after sunset at mid-latitudes
  in winter, so trails glow pink and red over a dark valley. Once the sun
  is past nautical twilight at their height (12° under their own horizon)
  they are gone from a dark night. Only a bright moon high in the sky shows
  one, as a faint grey line that mostly dims the stars behind it
  (`contrails.ts`'s `nightShow`, at most `CONTRAIL.moonShow`). A plane's
  glint needs the sun on it (`glintOf`); its lights are far too small to
  show. Toward the horizon the air between hazes the trails.

## How it is built

| File | What it holds |
| --- | --- |
| `pwa/src/game/contrail-plan.ts` | Three-free and DOM-free. The numbers (`CONTRAIL`) and the air aloft: `airAloft` (the one swappable temperature function, below), `tropopauseOf`, `pressureAt`, `formationTemp`. The humid layer by weather and window (`humidLayerAt`), the timetable (`flightsOfSlot`, `flightsBetween`: slots of 60 s, 0–3 flights each, about one a minute, on a map's two airways or across them), and each flight's trail at a moment (`trailAt`: the segment from the plane back to its oldest surviving point, each point drifted by the wind aloft since it was laid, its age linear along it). Also `widthAt`, `tauAt`, `sinkOf`, `contrailShow` (hidden under an overcast's lid) and `contrailsAt` (ranked and capped). |
| `pwa/src/game/contrail-glsl.ts` | The dome's term. For each trail it intersects the view ray with the trail's altitude plane, then again at the height the trail has sunk to. It draws the lateral profile (two lines merging, one line, a flat-topped band), the Crow wave and puffs, fibres along an old band, and the optical depth (`tauAt` restated). A pixel-footprint widening conserves the line's energy, every pattern fades out before it nears a pixel (no hatching far off), and a plane glint sits at the head. The trail's colour is the ice's light, hazed by `cloudAir`. |
| `pwa/src/game/contrails.ts` | Packs the plan's trails into 16 slots of uniforms each frame on the run's clock, capped by the DISTANCE row (`settings-video.ts`'s `CONTRAIL_LOOK`: 8 trails and no fibres on LOW, 12 on MEDIUM, 16 on HIGH and MAX). |
| `cloud-light.ts` | `CloudSky.ice`: the sun's and the sky's light at `ICE_ALTITUDE` (10.5 km), so the sky's clock moves the trails' colour. |
| `sky-dome.ts`, `environment.ts` | The dome composites the trails just before the cloud stack, so they sit behind every cloud and the mountains and in front of the sun, moon and stars. |

**What a skier sees of the traffic.** A pair of eyes on the snow sees
far less than the timetable holds.
- A plane glints only within 55 km slant of the lens, fading out from
  25 km, and only while the sun is on it: one soft point, never a light at
  night.
- A short trail is drawn only within 55 km, fading from 30 km.
- At most three crossings (a plane or a young or short trail) are drawn at
  once, the nearest, and at most three glints in all. A dry day shows one
  or two lines; a humid one shows those plus its lasting bands.
- A humid layer is patchy: only 55 % of the flights through its heights
  cross its supersaturated air, so some trail for an hour and the next
  leaves a short line.

**Cost.** No mesh, no pass, no texture and no draw call: the term runs
inside the dome's fragment shader, which is already drawn. For every sky
pixel it loops over at most `CONTRAIL_LOOK[tier].trails` slots, with early
outs (below the horizon, past a trail's reach, past its ends). It adds no
sampler to the ground shader. The CPU side is a few hundred flops a frame
plus a memoized timetable.

### The temperature, in one place

`airAloft(level, t, altitude)` in `contrail-plan.ts` is the ONLY place the
trails read a temperature. Today it is:
- the seed's day and latitude through `airOn` (the lake-ice model's
  near-surface air at sea level),
- plus an air mass dealt off the seed (±8 K, `airMassOf`),
- falling at the standard lapse rate of 6.5 K/km to a tropopause that is
  lower toward the pole and in winter (`tropopauseOf`),
- isothermal above that, never colder than −62 °C.

The engine's air-temperature model (`airTempAt` / `freeAirTempAt`) can
replace its body without touching anything else. Labs force the air mass
with `forceAirMass`.

## The lab

`make contrails` (`scripts/contrails-preview.mjs`, `pwa/contrails-preview.html`,
`pwa/src/tools/contrails-harness.ts`) draws contact sheets through the game's
own renderer from a skier's eye on the piste:

- `life`: one trail laid, short in dry air, and lasting at 1, 5, 15 and 40
  minutes, up and toward the horizon, beside a cell with no trails.
- `sky`: the plan's own sky an hour in, under clear, fair and humid high
  skies and with a cold and a warm air mass forced. Each caption gives the
  air at 10.5 km, how many of the hour's flights trail and last, and how
  many are drawn.
- `dusk`: three trails from the afternoon through sunset, ten minutes
  after it, the blue hour and the night (`--none` the sky alone).
- `frames`: plain in-game frames of a fair and a humid high sky an hour in
  and the humid sky after dark.

`ARGS="--width=960 --height=600"` makes the cells big enough to judge a
young trail's detail.

## Open

- The flights fly straight and level; no turns, climbs or descents near an
  airport.
- No shadow of a trail on the cloud below it, and no distrails (the clear
  lane a plane cuts through a cloud deck).
- The humid layer is one per window at one height. Real
  ice-supersaturated regions are patchy and sloped.

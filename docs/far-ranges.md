# The far ranges

A map is 4 × 4 km of one mountain face. The eye on a real one sees much more: from a summit in a
high range, on a clear winter day, range after range stands to the horizon a hundred kilometres and more
away. The far ranges are that country — real ground, low in detail, lit by the run's own sun, drawn
from the map's edge out to the horizon — never a painted skybox, because the sun moves.

Presentation only: nothing here touches the engine's state or its stream, and no digest moves.

## What a skyline is made of — the numbers

These are the facts the dealt country is built to and the lab is judged against. They are restated
from general physical geography and atmospheric optics; no single source is quoted.

| | alpine | fell | continental | maritime |
| --- | --- | --- | --- | --- |
| Peaks over the sea | 2,500–4,000 m (the highest massifs past 4,500) | 800–1,500 m | 3,000–4,300 m | 1,500–3,000 m |
| Valley floors | 400–1,500 m | 200–600 m | 1,500–2,500 m | 100–800 m |
| Relief, floor to crest | 1.5–3 km | 0.3–0.8 km | 1–2 km | 1–2 km, steep |
| Main ridges apart | 5–10 km | 10–20 km | 8–15 km | 3–6 km |
| Valleys | glacial troughs, floors 1–3 km wide | broad, open | wide basins | deep, narrow |
| Tree line | 1,800–2,200 m | 400–900 m (birch) | 3,000–3,500 m | 1,500–2,500 m |

**Layers.** From a summit, three to six layered ranges stand behind one another, each paler and bluer
than the one before (aerial perspective). From a valley floor, the facing range closes the view a few
kilometres off and the valley leads out between the ranges.

**How far the air lets you see.** Pure air (Rayleigh scattering at 550 nm, sea level) has an
extinction of about 1.35 × 10⁻⁵ per metre — a meteorological visual range near 290 km. Cold, dry
winter air over the mountains carries little aerosol: 100–200 km is common after a cold front, an
extinction of 1/25,000–1/50,000 per metre. Valleys under a winter inversion hold the haze; the
peaks stand clear above it.

**How big a far range looks.** A range's angular height is its relief over its distance less the
Earth's curve, which drops the ground by d²/2R′ with R′ the Earth's radius stretched 7/6 by the
standard refraction (about 7,430 km):

| Relief | Distance | Curve's drop | Angular height |
| --- | --- | --- | --- |
| 2 km | 10 km | 7 m | 11.3° |
| 2 km | 30 km | 61 m | 3.7° |
| 3 km | 60 km | 242 m | 2.6° |
| 3 km | 100 km | 673 m | 1.3° |

**Alpenglow and Earth's shadow.** A point h metres up sees the sun √(2h/R′) under the level longer
than the valley does — 1.6° from 3 km, eight to ten minutes at mid-latitudes in winter. So at
dusk the valley falls into shade first, the peaks keep a deep orange sun that reddens as it crosses
more air, and the shadow line climbs the faces until only the highest summits are lit.

## How it is built

| File | Owns |
| --- | --- |
| `pwa/src/game/far-ranges-field.ts` | THE COUNTRY as heights, three-free: a region's character (`FAR_CHARACTER`, relief as multiples of the map's own vertical so the skyline keeps the proportions of the mountain skied), the dealt country off the map's seed on a salt of its own (`FAR_SALT`), kept on a polar grid round the map (`dealtGrid`, 256 spokes × 48 rings to 100 km), and the ground anywhere (`farHeightAt`): the map's own inside, eased out of the map's edge into the country — no step at the edge |
| `pwa/src/game/far-ranges-plan.ts` | THE MESHES, three-free: the rings a tier (`FAR_RINGS`), the map's coarse disc, every vertex's albedo (snow, the woods under the tree line, the region's rock on the faces too steep for snow, water), the horizon a vertex sees toward the key (`horizonToward`), the heights the key light is reckoned at (`keyBands`), the RIM the clipmap carries past the map's edge (`rimGrid`, `FAR_RIM_GLSL`), the air between the ranges (`FAR_AIR`) and the mist's release (`FAR_MIST_FADE`) |
| `pwa/src/game/far-ranges.ts` | THE DRAWING: the rings as the backdrop (after the dome, pinned in front of the far plane, no depth written, outermost first), the disc at its real depth behind the clipmap, the shader (the key through the air down to each face's height, cut where the key is under that point's horizon, the sky's hemisphere, the Earth's curve, the haze), the horizons marched again a millisecond a frame as the sun turns |
| `pwa/src/game/far-face-codec.ts`, `far-faces.ts`, `far-faces-index.ts` (GENERATED), `far-faces/far-<id>.ts` (GENERATED) | THE REAL COUNTRY round a real face, off the 90 m elevation model, fetched with the face (`make far-faces`, `scripts/far-faces.mjs`, the tiles read by `scripts/lib/dem-tiles.mjs`) |

**The dealt country.** Every map's +z runs down its fall line, so the summit ridge is the map's top
edge and its valley floor the bottom. Behind the ridge the main massif stands highest; across the
valley the facing range; along it, both ways, the valley leads out between them, meandering, and side
valleys cut the ranges where a slow noise crosses nought. The crests are ridged noise bent off straight
lines, as sharp as the region's (a knife edge in the alpine, a rounded back on the fells), and the
valley floors climb gently away from the map.

**The seam.** Inside the map the ground is the map's; just past the edge it is the edge's own height,
smoothed along the edge within 200 m out and eased into the dealt country over `blendReach` (1.5–3 km
by region; 400 m on a real face, whose country is the real one round it). The clipmap's own ground past
the edge is the same ground (`FAR_RIM_GLSL`), so the clipmap's last ring meets the first ring of the
far ranges.

**Light.** Each vertex is lit by the key through the air down to its own height (`sunTransmittance`
at the height over the sea of four bands from the valley floor up past the highest peaks), so the
peaks keep a warm sun after the valleys lose it; and cut off where the key is under the horizon that
vertex sees along the key's bearing, so one range shades the next and the shadow line climbs the
faces at dusk. The sky's hemisphere fills the shade.

**Air.** The game's haze (`sky.ts`, 1/6,000 per metre on a clear day) is a depth cue sized to the
map's few kilometres. A far range is hazed by it over the first 4 km of the way and by a fifth of it
past that — 1/30,000 on a clear day, inside the clear winter air's band above — so a range 30 km off
keeps a fifth of its contrast and one at 100 km is nearly the sky behind it. A weather's own
thickening (a fall, a fog) carries through. While the ranges stand, the map's coarse disc carries
the ground on past the DISTANCE row's wall, so the mist need not close there: it is LET OPEN
(`haze.ts`'s `uMistOpen`) — the air's own colour, at most `MIST_OPEN` (0.45) of it, and a floor under
the haze rather than a second colour over it — and the disc and the rings keep the same floor, so the
haze only ever thickens outward and the ground, the disc and the rings fade on one curve with no band
of mist between them. Drawn without the ranges, the mist closes whole at its wall as before, and the
ranges' own mist is let go again with every 2.5 km past it.

**Tiers.** The DISTANCE row picks the rings: LOW 96 spokes × 14 rings to 60 km, MEDIUM 192 × 30 to
80 km, HIGH (and MAX) 320 × 46 to 100 km; the disc is 64 × 64 at every tier. A real face's country
reaches 60 km.

**A painted horizon.** The HORIZON row's PAINTED puts the rings away and paints them on the dome instead
(`far-silhouette.ts`, `sky-dome.ts`'s `paintSkyline`): each of 512 bearings is walked out from the
map's edge over the same ground the rings stand on, the curve laid in, and the crest seen highest from
an eye over the map's middle kept for two layers — within 12 km and past it — as its height and its
distance, baked once a map into a 512 × 1 texture. The dome turns each into an angle from where the
lens stands and lays the far layer, then the near, over the sky as the far ground through the same
air: snow at the crests and the woods' darker country a degree under them, each face lit as the crest
runs and the sun stands to it, and the foot of a range seen through the valleys' air. The map's own
disc still stands past the clipmap. Every preset stands the 3D rings, a PLAIN sky too; PAINTED is
picked by hand.

## The lab

`make sky ARGS=--sheet=far` — a map a row (`--maps=alpine,fell,continental,maritime,face:alpine-1`,
the default) at dawn, noon, the valley at one o'clock, sunset and dusk, every cell timed with the
ranges and without them (the `msOff` column), each row's rings built and counted at every tier.
`--no-far` draws any sheet without them (the before picture).

## Still open

- The aerial-perspective volume (HIGH) marches toward the sun through the map's ground only, so the far
  ranges cast no shadow on the air yet.
- The far country casts no shadow on the map, and the map's own shadow map does not reach the rings: a
  range shades another only through the per-vertex horizon.
- Glaciers are drawn as snow; the dealt country has no lakes.
- A real face's country reaches 60 km; past it the dome's far ground stands in.

# A ski mountain in summer

This page holds the research for SUMMER: the same mountain as the winter's, on a day in mid-July (day 196), with the snow gone. It covers what grows where, where snow is left lying, what colour the ground is, and what a ski area does to its slopes once the lifts carry bikes. It covers the game's four regions. Each one is a KIND of country, never a place: the alpine, the fell, the continental and the maritime. It ends with the numbers a terrain shader and a ground classifier need.

Every number is restated from published field work or measured off reference photographs. Where a number is our own estimate, the text says so. The reference photographs are kept outside the tree, with their licences, as research material. None is committed.

## The belts by height

A mountain in summer reads as BELTS stacked by height. Each belt has its own plants and its own colour, and the borders between them are ragged rather than drawn with a ruler.

In a high mid-latitude range (the game's alpine), the published belts are:

| Belt | Height | What grows |
| --- | --- | --- |
| Colline | up to ~800 m | hay meadows, broadleaf woods, farms |
| Montane | to ~1500 m on the outer ranges, ~2000 m in the central ones | spruce and fir forest; meadows mown once or twice a summer, or grazed |
| Subalpine | up to the forest limit: ~1800 m on the cooler outer edge, 2200–2300 m on the warm inner side | larch and stone pine thinning into KRUMMHOLZ (dwarf mountain pine, green alder, willow scrub, the odd stunted larch or spruce) |
| Alpine | from the tree line to ~2600 m on the outer ranges, ~3100 m in the central ones | grassland and dwarf-shrub heath: a turf mostly a hand high or less |
| Nival | above that | bare rock, rubble and scree, cushion plants in sheltered pockets, snow and ice |

Grazing pulls the ACTUAL tree line well below the CLIMATIC one. Centuries of summer pasture cleared the top few hundred metres of forest, so the woods often stop in a straight, man-made edge with open pasture above it. That is exactly where most ski areas cut their runs.

The other three regions shift the same belts:

- **Fell** (the game's row: a base of 350–500 m and a tree line at 600–1000 m, 60–69° north). The forest is BIRCH: low, bright yellow-green in July, thinning upward into a scrub of dwarf birch and willow. Above it lies a dwarf-shrub HEATH of crowberry, bilberry and heather, dark olive. The driest, most wind-scoured crests carry pale grey-green LICHEN mats; reindeer lichen reads as almost cream from a distance. Bogs fill the hollows and the flats, and boulder fields lie on the tops. At latitude 66–69° on day 196 the sun does not set (or barely does), so the light stays low and warm all night.
- **Continental** (a base of 2300–2700 m and a tree line at 3000–3500 m, 39–52°). A dry country. Dark lodgepole, spruce and fir stand in blocks broken by groves of ASPEN, whose leaves are a brighter, bluer green than the conifers. The montane meadows are green and full of flowers in early July and turn straw-gold by August. The alpine tundra is low turf and cushion plants. TALUS (broken rock) covers far more ground than in the alpine. Afternoon thunderstorms are the norm.
- **Maritime** (deep, heavy snow; fir and birch). A wet, lush country. The grass and herbs are tall, dense and dark green. In some ranges thickets of DWARF BAMBOO grass 1–2 m tall cover whole slopes below and around the tree line. Mist and low cloud are common. Peat and moorland lie on the flatter tops and saddles, with dark, wet, black-brown soil wherever the turf is broken.

## Snow left lying in July

A summer mountain is NOT snow-free. Snow PATCHES survive in the same places year after year, because the snow that feeds them is drifted, avalanched or shaded rather than simply fallen:

- **Where:** under steep north- and northeast-facing cliffs and in the gullies and hollows below them (the shade, and the avalanche debris and drift that pile up there); in lee hollows behind ridges (drift); in sinkholes and cirque floors. A patch on a south-facing slope is rare and small.
- **When:** in the maritime uplands studied, the last patches melt from mid to late July. At the alpine and continental tops they survive into August, and some never melt. On day 196 a ski mountain should keep patches mostly in the top third of its relief and mostly on the shaded aspects. The best-known fell patches lie in lee hollows above the tree line.
- **Look:** in July a patch is no longer white. Its surface is dimpled into sun cups 10–40 cm across, and it is grey-dirty with dust, needles and rock grit, especially at the downhill edge. It has a sharp, scalloped outline and a dark wet ring of soaked ground and fresh green around its foot. The upper edge is often undercut by meltwater. A patch's albedo (0.4–0.7) is well under fresh snow's (0.8–0.9).
- **Size:** most are tens of metres across. A deep avalanche gully can hold a patch a few hundred metres long and 20–50 m wide.

Glaciers are beyond this game's mountain. The alpine row's summit sits 1420–1620 m above a valley floor 10–20 m above the sea, and that is no glacier country. On a real face with a high summit, though, a small cirque glacier above the top station is plausible.

## Colours

These are measured off reference photographs of each kind of ground in summer. The images are processed camera JPEGs, so each colour is a BAND to aim inside, not a reflectance. Each row gives the median pixel of that kind of ground, with the 10th and 90th percentiles, in sRGB and in linear RGB (the shader's space).

| Ground | Median sRGB | Linear (median) | p10 – p90 sRGB |
| --- | --- | --- | --- |
| Lush valley meadow, sunlit (July) | `#98b05d` | 0.314, 0.434, 0.109 | `#7a9940` – `#b2c181` |
| High meadow in flower, sunlit | `#729139` | 0.168, 0.283, 0.041 | `#4a6322` – `#99b35f` |
| Alpine turf above the tree line | `#717c2f` | 0.165, 0.202, 0.028 | `#485916` – `#969a56` |
| A summer piste through spruce, in shade | `#555f32` | 0.091, 0.114, 0.032 | `#333b24` – `#6d7540` |
| Grazed dry pasture, late summer | `#9a9c6e` | 0.323, 0.332, 0.156 | `#6a6d47` – `#b4b68a` |
| Subalpine pasture going brown (August) | `#726136` | 0.168, 0.120, 0.037 | `#5a4c2a` – `#8a7447` |
| Dry continental slope, straw-gold | `#c39c68` | 0.546, 0.332, 0.138 | `#7a6342` – `#e4be8d` |
| Heath, dwarf shrubs (fell, maritime) | `#545726` | 0.089, 0.095, 0.019 | `#393b1c` – `#6d6c35` |
| Moorland grass and sedge | `#6e7646` | 0.156, 0.181, 0.061 | `#4d5632` – `#94966c` |
| Trail tread: machine-built pale gravel | `#c0a88e` | 0.527, 0.392, 0.270 | `#776843` – `#e8d1bd` |
| Trail tread: woodland loam | `#7e7560` | 0.209, 0.178, 0.117 | `#4f4638` – `#c9bda2` |
| Trail tread: peat (maritime, fell) | `#755f5a` | 0.178, 0.114, 0.102 | `#5c4642` – `#9e8277` |
| Bare earth on a graded piste | `#a69875` | 0.381, 0.314, 0.178 | `#7d7156` – `#c7b897` |
| Scree, brown volcanic | `#988972` | 0.314, 0.250, 0.168 | `#605748` – `#bcac96` |
| Rock, grey crystalline | `#7e7e82` | 0.209, 0.209, 0.223 | `#5a5b5e` – `#bcbaba` |
| Rock, warm sandstone and flysch | `#948f88` | 0.296, 0.275, 0.246 | `#65625d` – `#bcb5ac` |
| Rock, pale limestone | `#aeadb4` | 0.423, 0.418, 0.456 | `#5b5a57` – `#c9c7ce` |
| Snow patch in July (blue in the shade) | `#e0e9f6` | 0.745, 0.815, 0.922 | `#d1d8df` – `#fafeff` |

A few things to read off the table:

- Green is weak in the linear values. Even the lushest meadow's linear blue is around 0.1, and the darkest heath's around 0.02, so a "grass green" picked in sRGB by eye nearly always comes out too saturated. The meadows are olive and yellow-green, never emerald.
- The ground BRIGHTENS and YELLOWS as the summer dries it. Lush valley meadow, alpine turf, dry pasture and the dry continental slope form one line. A season slider can run along it.
- Machine-built bike trail is the PALEST thing on the mountain below the rock: pale beige gravel with a linear red of about 0.5. That makes it read from the far side of the valley as a pale scribble across the green, much as a groomed piste reads against the woods in winter.
- These are the standard textbook albedos to cross-check a shader's lit result: fresh snow 0.80–0.90, old snow and firn 0.40–0.70, green grass 0.20–0.25, dry grass 0.25–0.30, bare soil 0.10–0.25, conifer forest 0.08–0.15, rock 0.10–0.30.

## A ski run in summer

The most useful single fact here comes from a survey of machine-graded ski pistes at twelve resorts in a high mid-latitude range (Wipf et al., Journal of Applied Ecology, 2005). Graded runs carried about FIVE TIMES the bare ground of the untouched slope beside them, plus lower plant cover and fewer species. Re-seeding had not brought them back after thirty years. Above roughly 2000–2500 m, re-sown grass mostly fails, and high runs re-seeded by spraying keep very little cover. Pistes that were only groomed over the natural turf, never graded, differ far less from their surroundings.

So a summer piste is:

- **A grass CORRIDOR** down the hill, cut through the forest below the tree line with an edge as sharp as the winter's. It is mown or grazed short, mostly 3–15 cm, against 20–60 cm of uncut meadow in the valley and 2–10 cm of alpine turf above the tree line.
- **Scarred where it was graded.** The ground is bare on the cut-and-fill benches, at the steepest pitches, along the lift line and on the cat tracks. The bare share runs from about 5–15% on a natural-turf run in the montane belt to 40–80% on a bulldozed run above the tree line. Bare ground shows as pale brown earth and gravel, and it is streaked down the fall line by erosion rills.
- **Crossed by WATER BARS.** These are diagonal ditches and berms, 0.3–0.6 m high, laid across the run every few tens of metres on the steeper pitches to throw runoff off to the side. They are what a summer piste has instead of rollers.
- **Fitted out for the winter.** It keeps its lift towers, snowmaking HYDRANTS (short posts at the run's edge every 40–80 m, the guns stored), the stakes of rolled-up snow fences, signposts and pads stored on the towers, and the cat tracks: gravel service roads 3–5 m wide zigzagging up the mountain, the main summer access for every machine.
- **Grazed.** Cattle or sheep on summer pasture, behind single-wire electric fences, are normal on the runs in the alpine and continental belts, and reindeer are normal on fell runs. Grazing makes TERRACETTES.

### Terracettes

Terracettes are the small steps livestock (and soil creep) cut along the contour of a grassy slope. Each is a flat tread a cow or sheep walks on, with a short riser above it, stacked one above the next all the way up the slope. Typical measures:

- **Slope:** they form on 25–40° slopes and are clearest at 30–35°.
- **Shape:** a tread 0.3–0.6 m wide, a riser 0.2–0.5 m high, repeating every 0.5–2 m up the slope.
- **Look:** a tread runs tens of metres along the slope and then merges or splits into its neighbour. From any distance they read as fine horizontal stripes on a steep pasture.

They belong only on the steep grass of grazed pasture, never on the forest floor or on a graded piste.

### The meadow at distance

The meadow's texture changes with distance:

| Distance | What the eye resolves |
| --- | --- |
| Close (<5 m) | single blades, flower heads (white, yellow, purple and blue dots no bigger than a thumbnail), the dark gaps between tussocks, stones in the turf |
| 10–50 m | a mottle of lighter and darker patches a metre or two across: wetter and drier ground, flower patches, shadow on the tussocks |
| 100 m+ | a nearly flat colour, broken only by paths, bare scars, terracette stripes, scattered rocks, the shadows of single trees, and the change of hue from a wet hollow to a dry ridge |

At distance the flowers are NOT dots. They tint whole slopes: a yellow cast in early summer, white or pink later. A meadow wet with dew or rain is darker, and a sunlit dry one is paler.

## Lakes and water

A summer mountain shows its water:

- **Tarns**, small round lakes in the cirque floors, most of them above the tree line.
- **Snowmaking reservoirs** lie at mid-mountain or near the top station. They are lined basins of tens to hundreds of thousands of cubic metres, with a fenced dam bank and a pump house, and have straighter edges than a natural lake.
- **Streams** run down every gully, fed by the last snow.
- **Wet flats and bogs** lie on the fell and maritime tops.

A tarn fed by glacier or snow melt is milky turquoise; one fed by rain on peat is dark brown-black. The game's lake-ice model already lays the water and says it is open on a July day.

## The lifts carrying bikes

In summer the lifts run for hikers and mountain bikers. A bike is CARRIED, never held by its rider on the ride:

- **Gondolas:** the bike hangs on an outside rack or hooks on the cabin, front wheel up, or a staffed station loads it inside a cabin cleared of seats.
- **Chairlifts:** a bike carrier (a hook frame on the chair's back, or a chair given over to bikes) holds the bike by its front wheel or saddle, often on every second to fourth chair. The rider takes the chair behind. Loading is by the lift staff at the bottom station, and unloading is by the staff at the top.
- **Drag lifts** do not run in summer.

The bottom station gets a bike-wash area (hose stands and a concrete pad), a hire and repair shop, racks, and a short skills area. The top station gets a staging pad where riders stand about, check their kit, read the trail map board and take the trails out.

## People on the mountain

- **Riders:** in full-face helmets, goggles, long-sleeved jerseys, knee pads and often body armour. They come in groups of two to five, wait at the trail heads, and stand at the side of the trail to watch a feature.
- **Hikers:** in boots, with packs and walking poles, families among them. They walk the service roads and their own paths, which the bike trails cross at signed crossings.
- **Paragliders:** take off from a grassy launch near a top station.
- **Others:** trail crews with mini-excavators and rakes; lift staff; cattle, sheep or reindeer grazing the runs.

## What the game needs

### The day

Summer is day 196 (mid-July) at the region's latitude. On a fell map the midnight sun is real and should be left real. Afternoon cloud and showers should be commoner on a continental map.

### Ground kinds

One kind per point, classified off what the map already knows. The bands below are our synthesis of the belts, the piste survey and the photographs. The surface column gives the bike physics' kind of surface (see [the downhill bike](downhill-bike.md)).

| Kind | Where | Colour band (linear median) | Grass height | Surface for the bike |
| --- | --- | --- | --- | --- |
| `meadow` | open ground below the tree line, slope < 30° | 0.31, 0.43, 0.11 (lush) → 0.32, 0.33, 0.16 (dry) | 20–60 cm uncut; 3–15 cm grazed | grass |
| `pasture` | as `meadow`, slope 25–40°, grazed: terracettes | 0.17, 0.28, 0.04 → 0.17, 0.12, 0.04 | 3–10 cm | grass |
| `piste` | the winter's packed field (`packedAt`) | 0.09–0.17 green, with bare scars | 3–15 cm, 5–80% bare | grass / dirt |
| `scrub` | from 300 m below the tree line up to it (krummholz) | 0.09, 0.10, 0.02 | 0.5–2 m shrub | not rideable off a trail |
| `heath` | above the tree line on the fell and maritime; dry crests elsewhere | 0.09, 0.10, 0.02 | 5–30 cm | grass (rough) |
| `turf` | above the tree line, slope < 35° | 0.17, 0.20, 0.03 | 2–10 cm | grass |
| `scree` | below cliffs and on slopes 30–38° above the tree line | 0.31, 0.25, 0.17 (brown) / 0.30, 0.28, 0.25 (grey) | — | loose rock |
| `rock` | slope > 40–45°, and the cliffs | 0.21–0.42 neutral grey | — | rock |
| `snow` | the patches (below) | 0.75, 0.82, 0.92 shade; dirty 0.6–0.7 | — | snow |
| `trail` | a bike trail's tread | 0.53, 0.39, 0.27 gravel / 0.21, 0.18, 0.12 loam / 0.18, 0.11, 0.10 peat | — | hardpack / loam / mud |
| `road` | cat tracks and service roads, 3–5 m wide | as gravel trail, a little greyer | — | gravel |
| `bog` | flat wet ground in the fell and maritime | 0.16, 0.18, 0.06 with dark water | 10–40 cm | mud |
| `water` | `Level.water` | (water shader) | — | — |
| `forest floor` | under the trees | 0.04, 0.05, 0.02 needles and moss | — | loam with roots |

### The region's tint

Each region has its own palette:

- **Alpine:** the table as measured.
- **Fell:** more `heath`, with pale lichen (about 0.55, 0.55, 0.40 linear) on dry crests and birch woods a brighter yellow-green.
- **Continental:** drier. Bias toward the straw end, use more `scree` and `rock`, and give the aspen groves their own green.
- **Maritime:** greener and darker. Grass 20–40% taller, more `bog`, peat for the dirt, and dwarf-bamboo thickets (1–2 m) as the `scrub` near the tree line.

### Snow patches

Lay snow patches with a weight built from these factors (our rule, shaped to the field reports):

- **Height:** only in the top 35% of the relief. The weight grows toward the top.
- **Aspect:** north and northeast best, falling to nothing on south faces.
- **Shape:** concave ground (gullies, hollows, under cliffs) gets four times the weight of a convex one.
- **Cover:** about 2–6% of the ground above the tree line on an alpine or continental map on day 196, 1–3% on a fell or maritime one.
- **Size and edge:** 10–60 m across, the rare gully patch up to 300 m long, with a scalloped edge, a dirty grey downhill rim and a green wet ring 1–3 m wide round it.

### Terracettes in the shader

Terracettes belong on `pasture` at 25–40° only. Draw them as stripes along the contour every 0.5–2 m, with a dark riser about a third of the period wide. Fade them out by 300 m: past that they are only a faint stripe in the slope's shade.

### Detail by distance

- **Up close:** blades and flower dots.
- **10–50 m:** a 1–2 m mottle at ±10% brightness.
- **Past 100 m:** flat colour, kept broken by the bare scars, paths, rocks and the hue change from hollow to ridge.

A meadow in flower is tinted as a whole slope, never dotted, at distance.

## What the game does

Part A of the summer work is built: the SUMMER season, its ground and its look. A bike and its park come later ([the downhill bike](downhill-bike.md), [the bike park](bike-park.md)).

- **The season.** The start card's SEASON row ends in **SUMMER**: day 196 (`SUMMER_GROUND.day`), `summer: true` on the free ride (`CreateGameOptions.summer` → `GameState.summer`, absent on every other run, so no digest moves; `?summer=1` on a link). Only a free ride is ever in summer (`summerOf`).
- **What summer takes away** (`engine/game/summer.ts`, `step.ts`): the loose snow (`packedSnow` reads every point as hard ground), the day's piste and its new snow, the tree wells, the groomers, the snow guns, the avalanches, the crowd and the night's enthusiasts, the snowmobile; the sky never snows (`summerSky`: flurries become fair cumulus, a fall or a storm an overcast); the drag lifts stand stopped (`lift-ride.ts`) and the wind tunnels are shut (`wind-tunnel.ts`).
- **The ground** (`engine/game/summer-ground.ts`, its numbers `defs/summer-ground.ts`). One kind per point, a pure function of the map baked once on a 4 m grid (`summerFieldOf`) and read by `summerGroundAt` / `summerSurfaceAt` — the kinds and surfaces in the table above, each surface a published band's middle or flagged as our estimate. The runs are stamped at their widths as short grass, a winter lane's corridor too, with only a 5 m gravel tread down it (`SUMMER_GROUND.road`). The bare scars are 10 % of a run below the tree line and 55 % above it, a little off the runs, in patches of a few metres. The snow patches lie in the top 35 % of the relief by aspect and hollowness, cut to the region's cover. Scree, scrub, bog and the forest floor lie where the table says.
- **The look** (`pwa/src/game/summer-glsl.ts`, `summer-terrain.ts`, `summer-grass.ts`). The ground shader reads the same bytes the classifier does. It draws a region's palette by height (the measured medians, `SUMMER_LOOKS`), the sunny faces drying first, a high meadow in bloom, and the meadow broken at 10–100 m into lusher, thinner and drier patches with a faint lift in flower. It draws the runs a shade darker with earth scars, the cat tracks as gravel, rock and scree on the steep and high ground, and the snow patches grey, sun-cupped and dirty at the rim with a wet green ring below. The far ranges past the map are turf and rock, with snow only far above the summit. Instanced blades and small, mostly white flowers stand round the lens, sway in the map's wind and shrink into the ground at the FOREST row's reach (18, 28 or 40 m). The trees carry no snow, and their broadleaves and larches are in leaf. The buildings' snow is folded away, the rocks' up-facing ledges are turf, and the lakes are open (the lake-ice model on day 196). No tracks are stamped and no spray or snow cloud is thrown.
- **Not yet done.** The pasture's terracettes are not drawn: stripes on the height's own contours curl into rings round every hummock. The broadleaves are their winter skeletons painted green, not leafed crowns. The grass's price on the FOREST row is an estimate, not a GPU measurement.

`make summer` is the lab: the views off the summer ground at two hours, `REGION=` another country, `ARGS=--winter` the same views in winter.

# The real faces

A free ride's resort can be raised on a REAL mountainside instead of the massif R25 deals. There are forty of them: twenty-one on the fells, eleven in the alpine, four continental and four maritime. By range, fourteen, seven and one lie in the three Nordic countries, eleven in the range across borders in the middle of Europe, and four, two and one in the three ranges overseas. Each one is a 4×4 km stretch of a real ski mountain, from its summit ridge down to its valley floor, turned so its fall line runs down the map. A `?face=` link picks one too (`docs/configuration.md`).

The start card names a face by PLACE, in three rows (`pwa/src/game/face-picks.ts`):

- **RANGE** — where it lies: a country where the range's ski areas all lie in one, or a range across borders. The Nordic ranges come first, then the rest by name. The first stop is the seed's own massif, AS DEALT.
- **AREA** — the town or mountain its ski area is known by. A range's areas are listed as a walk across it: the most northerly first, then always the nearest one not yet listed, so stepping the row moves to a neighbour. An area's parts are listed the same way.
- **PART** — the part of that area it is, shown only where the area has more than one part. Picking one sets the CLIMATE row to the face's own region.

The GRADE row filters them: a part whose real ski area signs no piste of the colour asked for is left off, then an area with no part left, then a range with no area left. A face on the card that loses its colour gives way to a part of its own area that has it, then to one of its range's, or to the seed's own massif. ORANGE leaves every face on, because the game lays its own ski routes on every face (R42).

A face's id is its region and a number (`alpine-1`, `fell-3`, …), a key that never moves. Its place — the range (a key, named in `strings-ranges.ts`), the area and the part — is written in its crop row (`scripts/lib/real-face-crops.mjs`) as the map writes the place, and baked into the face index. These three files are the only ones that name a real place. No brand, operator, lift, piste or race is named anywhere, and the bakes read no lift's or piste's name.

## Fetched when picked

Every face is a pair of generated files of its own: its heights (`engine/mapgen/real-faces/face-<id>.ts`) and its hints (`engine/mapgen/real-hints/hints-<id>.ts`). Two small generated indexes list them: `real-faces-index.ts` (each face's region and place) and `real-hints-index.ts` (the grades each face's real pistes are signed, and its woods by height). Only the indexes are in the bundle, under 400 bytes of source a face (under 100 compressed). A face's files are a chunk of their own, fetched when a map is raised on it (`loadRealFace`), and the service worker keeps each one once fetched, so a face ridden once rides offline. They are never precached.

Every host awaits `loadRealFace` before it raises or reads a face's map: the loading card's worker and the start card's, the load itself (`LoadPlan.face`, for the run's real houses), the boot (`main.tsx`, for a link's face or the stored ride's), and every lab that takes `--face`. Reading a face that is listed but not loaded throws, so a path that forgot to load one fails loudly rather than raising a different mountain.

## What a face is, and what it is not

A face replaces the massif's SHAPE and nothing else.

- **Kept from the real mountain.** The summit ridge and where its peak stands, the spurs and gullies, the shoulder and the lowest point of the valley (the village goes there), and the ground beside the ski area and behind the ridge, which the panorama and the far view show.
- **Kept from the real woods.** Its tree line, and how wooded each height of it is (below).
- **Still dealt off the seed.** The vertical, kept in R25's band. The face is stretched to it, so its grades are the game's. The lifts, the runs walked and graded down it, where each tree stands, the courses, the weather and the day are dealt too, all built onto the face as onto any massif, by the same rules and checked by the same analysis.
- **Not taken from the real resort.** Its pistes and its lifts. The piste network is the generator's own.

A real mountainside is far more rugged across its skiing face than the generator's lift and run planner can build on. Measured against each face's own mean profile, the faces stand 70–320 m RMS off it. So `massif.ts`'s `faceLift` lays the real relief in three ways:

- **Whole**, beside the ski area (outside the band the runs are laid in) and behind the summit ridge.
- **Calmed to 30 m RMS** over the skiing face (`RR.massif.real.relief`). The spurs and gullies still read; the stations and the graded runs still hold.
- **Faded out** onto the valley floor, where the village and the finish stand.

Each refused attempt lays the relief a little gentler on the next one (`real.calming`, down to `real.calmest`). That way, a face too rugged for one attempt's lifts and runs still builds instead of being refused. Some seeds' lifts will not stand on where a face's real peak, shoulder and valley are. After eight attempts, those positions are given back to the dealt ones (`real.placed`), with the real relief still laid over them. The massif's own folds (hills and ridges) are laid over the face at a third of their size, and its bowls, headwalls and the dealt flank are left off, because the real face already has its own.

Nothing changes for a map with no face. Every draw off the stream is made in the same order and the face is read only after them, so no dealt seed and no pinned map moves, and no generator version is owed.

## The real ski area's hints

A face also carries HINTS of the real ski area on it, read off OpenStreetMap. The generator leans its own ski area toward them, so a face's resort is laid roughly where the real one is. They are hints, not a plan: the generator builds and checks its stations, runs and village by its own rules, and keeps a hint only where those rules allow it.

- **Lifts.** Each real lift is kept as its two ends and its kind: a chair, a gondola (or a cable car) or a drag. Its bottom is the lower end on the face's own heights. Each of the generator's lifts is matched to the nearest unused real lift of a kind it may be (a chair is never laid on a drag), if that lift's top is within 700 m (`RR.massif.real.lift`). The lift's top moves onto the real top, at most 300 m up or down the face unless the row is the generator's to keep. Its bottom keeps its row, because the generator's lifts leave from the valley floor and most real ones leave from part way up, and moves across onto the real lift's line carried down to that row, if the carry is at most 1600 m. The peak's top station, which no lift of its own is matched to, moves onto the nearest real top within 450 m and keeps its row (`RR.massif.real.station`). The village's lift goes first, because the gondola leaves from it.
- **Pistes.** Each real downhill piste is kept as its signed colour and its line, top first, thinned so the line strays at most 6 m from its bends, with its WIDTH at every bend where the map draws the piste's area (the narrowest area round the line, read across it; 0 where none is drawn — most alpine faces have widths, the others few). Every piste slot of the generator is LAID ON the real piste whose top is nearest its start within 650 m and which falls at least a quarter of the way to the slot's target, one real piste a run (`RR.massif.real.along`). Such a run takes the real piste's COLOUR, keeps to its line (at every step it aims at the point of that piste 40 to 140 m further down the face and at most 160 m across, then through its bends), and is as wide as the real piste where the map gives a width, held to its colour's band. A slot with no real piste near is steered toward any real piste of its grade ahead of it (80 to 260 m down, at most 260 m across, `RR.massif.real.follow`) and through the bends of the nearest (`RR.massif.real.via`). A run's swing is halved while it follows one, its no-climbing rule stays the generator's, and its last two tries are walked without the hints, so a face whose real pistes do not fit still gets its runs.
- **Orange.** A real freeride or extreme piste is kept with the orange grade but never laid as a piste. The face's ORANGE ski routes are the game's own (R42), found on the finished mountain as on any map, whether the real ski area marks one or not.
- **Houses.** Each real building is kept as its middle, its size (to 1 m) and the bearing of its longest wall (`real-hints.ts`'s `HintHouse`). The largest, up to 120, stand as the face's buildings (`engine/game/real-houses.ts`), each a kind by its size, and the village's streets are laid through them where there are enough.
- **The town.** The town at the face's foot is kept ROUGHLY: its car roads, each a MAIN road (trunk to tertiary) or a STREET (residential, unclassified, living and pedestrian streets, and a service road with a name; the nameless ones are driveways, parking aisles and the ski area's tracks), joined end to end where one street was mapped as many ways, thinned to its bends within 3 m and dropped under 40 m; and the town's MIDDLE (where the most street lies within 500 m, a main road twice over) with the RADIUS that holds 60 % of its kept street (`HintStreet`, `HintTown`, baked by `scripts/lib/real-face-streets.mjs`). The streets are ranked by how much of the town they are — a main road three times a street, a long one over a short one, both by how near the middle they run — and kept the best first up to 90 streets or 1.8 KB a face. Every face has a town by that measure; the smallest are a few streets (`alpine-3` keeps 7, `alpine-4` and `fell-9` 8). The village (`engine/game/real-streets.ts`) leans on them: its centre is tried first where the most real street and house lies under its span; its main street follows a real road that runs along the valley 34–90 m out of the hub through at least 45 % of the span, smoothed over 30 m and held to a bend of 0.3 off the axis, and its back street the real one 40–100 m behind it; its cross streets stand where real streets cross between the two (three at most, the dealt ones filling in), and its road out leaves from the end nearer where a real road reaches the valley's edge, wandering up to 70 m toward it. Then every other real street within 450 m of the village or 1.3 town radii of the real town's middle is laid as a TOWN street (`StreetKind` `town`: two lanes of 2.75 m and a sidewalk on one side), every stretch of it at least 40 m long that clears what a village street keeps clear of, stays 4 m off the streets laid before it and climbs and leans no more than 16 % — up to 40 of them, the main roads and the longest first, each a dead end at both junctions. The real houses then stand along them. Where the valley's side of the hub has no room for the village's loop, a face with a town tries the hub's mountain side (with no road out), where a real town often stands above a valley floor of water. On a face the packed snow a street keeps off is the groomer's, not the fell's wind crust folded into the packed field (R21), so a fell face has a village at all. Measured on seed 1, 16 of the 40 faces had no village before (all fells); after, every face has one, with 2–40 town streets, and a face builds in the same time.

A real face holds its ski area to REALITY where a dealt massif is held to the rule book (`RR.massif.real.least`): it may carry four pistes rather than six, a top's pad may stand 0.6 m off its cut and a rope 1 m into its clearance (a real face is rougher than a dealt one), and a run laid on a real piste is billed the colour the piste is SIGNED where it measures within one colour of it, because a real ski area signs a run by more than its steepest pitch. Every other rule holds as on any map.

The hints are used only on a face's first eight attempts (`real.hinted`), the same attempts the face's peak and village are read on. After that, the stations and runs are dealt as on any face. Measured on seed 1 over the first twenty faces, a face took 4 attempts and 16 s to build before the runs were laid on real pistes and the rules gave way, and 1.45 attempts and 8 s after; a run's colour matched the real sign on 33 % of runs, up from 27 %. Nothing is kept by name: no lift, piste or place name is read. A map with no face reads no hint, so no dealt map moves.

The bake works like the heights' bake:

- `make real-hints ARGS=--fetch` reads each face's crop off the OpenStreetMap editing API, a few tiles a face, once, into the gitignored `previews/.osm/`. The tiles are kept under the face's id AND a key of its crop, so a face cropped afresh fetches its new tiles rather than reading the old crop's. A forest relation with members outside the tiles is fetched whole, once, beside them.
- `ARGS="--only <id> --write"` turns them onto the face's map with the crop the heights were baked on (`scripts/lib/real-face-crops.mjs`) and writes them into the face's GENERATED file, `engine/mapgen/real-hints/hints-<id>.ts`, and its grades into the index. Every other face's file is kept as it is. Lift ends and piste bends are kept to 2 m, a piste's width to 2 m, a house's middle and size to 1 m, a street's bends and the town's middle to 2 m and its radius to 10 m. That is about 6 KB a face, of which the town is 0.1–1.8 KB (a median of 1 KB); the table it prints has a column of each.
- `ARGS="--write --trees"` writes only the woods into the index, keeping every face's hint file as it is.
- `make resort SEED=1 ARGS="--face=alpine-1 --hints"` draws the hints over the generator's plan: the real pistes thin in their grade's colour, the real lifts in magenta, the real houses as grey ticks and the real town's streets in orange (main roads thicker) inside a dotted ring of its radius; the village's own streets are drawn in dark grey under them. `ARGS=--village` writes `<stem>-village.png` too, the village and the real town close. The world lab takes `--face` (`make buildings ARGS="--face=fell-1"`, or `npm run world -- --free --face fell-1 --views=village-air`), so the village's views can be photographed on a face.

The map data is © OpenStreetMap contributors, available under the [Open Database Licence](https://opendatacommons.org/licenses/odbl/1-0/). The baked hints are a derived database and are offered under the same licence: every file under `engine/mapgen/real-hints/` and `real-hints-index.ts` says so in its header.

## The real woods

A face also carries its WOODS BY HEIGHT, read off the forest the real map draws (`landuse=forest` and `natural=wood`, as a closed way or a multipolygon relation's rings; a relation the map call leaves members of out is fetched whole once). The bake (`scripts/lib/real-face-forest.mjs`) rasterises that forest onto the face's own 126×126 height grid, every cell's middle in a wood or not (even-odd over the rings, so a clearing cut out as an inner ring is open), and bins the cells by height between the face's lowest and highest sample:

- **The cover** in eight bands, bottom first: the share of each band's cells that is wooded.
- **The tree line**: the top of the highest of 48 fine bins (of 12 cells or more) still wooded past 5 %, as a share of that relief.

That is nine bytes a face, kept as hex in the always-loaded hint index (`HINT_TREES`), so no face's hint file had to change for it, and read by `realFaceTrees`. A face whose window is under 1 % wooded is kept as none: its map draws no forest (a bare high face, or one whose forest is not mapped), and its region's row stands in.

On a map raised on a face with woods (and only then), the generator:

- **Stands the tree line where the real one is.** The real line's height over the face's valley floor is stretched as the face is (`massif.ts`), so it lies on the map's vertical at the share of the real face's drop it stands at, instead of the region's share.
- **Thins the woods by the real cover.** R14's logistic curve under the tree line is kept and scaled by how wooded the real face is at the same height, against its densest band (`resort-woods.ts`'s `faceWoods`): the densest band keeps the whole curve, a bare one a fifth of it, so a cleared valley floor or a bare upper slope reads as a wood thinned out, never a raster of the map's polygons.

Measured over the forty, the real tree lines come out where the mountains' own are: 1,730–2,310 m in the alpine faces, 2,750–3,570 m in the continental range, 600–1,670 m in the maritime ones (the lowest on a fjord in the far north) and 480–1,180 m on the fells (the far north's lowest). Three faces have no woods of their own: two high alpine faces whose valley floors lie at or above the tree line, and a fell in the far north whose map draws no forest. The bake's table prints every face's wooded share, tree line and bands.

## The data

The heights come from the **Copernicus DEM GLO-30**, a global 30 m surface model. It is free to use and redistribute with this notice:

> © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018 provided under COPERNICUS by the European Union and ESA.

The bake works face by face:

- `make real-faces ARGS=--fetch` downloads the 1°×1° tiles the faces lie in, once, into the gitignored `previews/.dem/`. No tile is committed.
- Each face is cropped and turned onto the map's square, then smoothed with a Gaussian of 1.2 cells. The canopy and the roofs come out of the surface model; the spurs and gullies stay.
- It is kept on a 126×126 grid 32 m apart, as fine as a 30 m model honestly is, in steps of 0.5 m over its lowest point. That grid is encoded as second differences in zigzag varints, in base64.
- `ARGS="--only <id> --write"` writes the faces named into their GENERATED files, `engine/mapgen/real-faces/face-<id>.ts`, about 16 KB a face (21 KB as base64, about 8 KB served compressed), and rewrites the index. Every other face's file is kept as it is, so a new face never moves one already shipped. None of them is edited by hand.

At run time, `real-face.ts` decodes a face once and samples it bicubically, so the 2 m grid it is baked onto has no creases at 32 m.

Where each crop sits was searched once, offline: `ARGS="--fetch --search --only <id>"` tries every bearing (10° apart), offset (450 m apart, the middle kept well inside the window) and scale (0.9, 1, 1.1) around a face's middle, scores each on how much of the playable face falls down the map and how far the ridge stands over the floor, and prints the best rows. The winners are the table in `scripts/lib/real-face-crops.mjs`.

## What it costs

A face map is built like any other, so it costs the same to ski and to draw. Building one takes as long as a dealt map does, 8–40 s in Node, and a little longer on the attempts that calm a rugged face. `tests/real_faces_test.ts` holds every face to decoding to a mountain over its floor and holds one to building.

**Whole ski areas are not built, by design.** A map is a 4 km square on a 2 m grid, and each of its baked grids (the heights and the packed snow, 2001×2001 floats) is 16 MB. A real ski area 12–16 km across, on the same grid, would be 9–16 times that a grid: hundreds of megabytes before a tree is placed, with the build time growing the same way. That does not fit a phone, and a coarser grid would lose the grooves, the windrows and the moguls the physics reads. One face of a real mountain is what fits.

**Pre-baking further is not worth it.** The real heights are the part that costs a download, and that part is already baked. Baking finished resorts as well would mean shipping the baked grids, 32 MB of grids a map, against the seconds it takes to build one. A built map is already kept for the session (`resort-cache.ts`), and its chart for the start card is kept in IndexedDB (`seed-store.ts`).

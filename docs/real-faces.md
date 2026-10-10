# The real faces

A free ride's resort can be raised on a REAL mountainside instead of the massif R25 deals. There are twenty of them: eleven in the alpine, four continental, three maritime and two on the fells. Each one is a 4×4 km stretch of a real ski mountain, from its summit ridge down to its valley floor, turned so its fall line runs down the map. The start card's SHAPE row picks the COUNTRY a face lies in and its PEAK row one of that country's faces (REAL 1, REAL 2, …, numbered in the country); picking one sets the CLIMATE row to the face's own region. A `?face=` link picks one too (`docs/configuration.md`).

The GRADE row filters them: a face whose real ski area signs no piste of the colour asked for is left off the PEAK row (and a country with none off the SHAPE row), and a face on the card that loses its colour gives way to one of its country's that has it, or to the seed's own massif (`pwa/src/game/face-picks.ts`). ORANGE leaves every face on, because the game lays its own ski routes on every face (R42).

A face is named by its region and a number and nothing else (`alpine-1`, `fell-3`, …). The repository names no real place, so a face is a position on the globe and a crop, never the name of the resort it was taken from. The one thing filed beside it is its COUNTRY, an ISO code in its crop row, which the start card shows by name (`strings-countries.ts`) — never anything finer.

## Fetched when picked

Every face is a pair of generated files of its own: its heights (`engine/mapgen/real-faces/face-<id>.ts`) and its hints (`engine/mapgen/real-hints/hints-<id>.ts`). Two small generated indexes list them: `real-faces-index.ts` (each face's region and country) and `real-hints-index.ts` (the grades each face's real pistes are signed). Only the indexes are in the bundle, about 150 bytes a face. A face's files are a chunk of their own, fetched when a map is raised on it (`loadRealFace`), and the service worker keeps each one once fetched, so a face ridden once rides offline. They are never precached.

Every host awaits `loadRealFace` before it raises or reads a face's map: the loading card's worker and the start card's, the load itself (`LoadPlan.face`, for the run's real houses), the boot (`main.tsx`, for a link's face or the stored ride's), and every lab that takes `--face`. Reading a face that is listed but not loaded throws, so a path that forgot to load one fails loudly rather than raising a different mountain.

## What a face is, and what it is not

A face replaces the massif's SHAPE and nothing else.

- **Kept from the real mountain.** The summit ridge and where its peak stands, the spurs and gullies, the shoulder and the lowest point of the valley (the village goes there), and the ground beside the ski area and behind the ridge, which the panorama and the far view show.
- **Still dealt off the seed.** The vertical, kept in R25's band. The face is stretched to it, so its grades are the game's. The lifts, the runs walked and graded down it, the woods, the courses, the weather and the day are dealt too, all built onto the face as onto any massif, by the same rules and checked by the same analysis.
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

A real face holds its ski area to REALITY where a dealt massif is held to the rule book (`RR.massif.real.least`): it may carry four pistes rather than six, a top's pad may stand 0.6 m off its cut and a rope 1 m into its clearance (a real face is rougher than a dealt one), and a run laid on a real piste is billed the colour the piste is SIGNED where it measures within one colour of it, because a real ski area signs a run by more than its steepest pitch. Every other rule holds as on any map.

The hints are used only on a face's first eight attempts (`real.hinted`), the same attempts the face's peak and village are read on. After that, the stations and runs are dealt as on any face. Measured on seed 1 over the twenty faces, a face took 4 attempts and 16 s to build before the runs were laid on real pistes and the rules gave way, and 1.45 attempts and 8 s after; a run's colour matched the real sign on 33 % of runs, up from 27 %. Nothing is kept by name: no lift, piste or place name is read. A map with no face reads no hint, so no dealt map moves.

The bake works like the heights' bake:

- `make real-hints ARGS=--fetch` reads each face's crop off the OpenStreetMap editing API, a few tiles a face, once, into the gitignored `previews/.osm/`.
- `ARGS="--only <id> --write"` turns them onto the face's map with the crop the heights were baked on (`scripts/lib/real-face-crops.mjs`) and writes them into the face's GENERATED file, `engine/mapgen/real-hints/hints-<id>.ts`, and its grades into the index. Every other face's file is kept as it is. Lift ends and piste bends are kept to 2 m, a piste's width to 2 m, and a house's middle and size to 1 m. That is about 7 KB a face.
- `make resort SEED=1 ARGS="--face=alpine-1 --hints"` draws the hints over the generator's plan: the real pistes thin in their grade's colour, the real lifts in magenta and the real houses as grey ticks.

The map data is © OpenStreetMap contributors, available under the [Open Database Licence](https://opendatacommons.org/licenses/odbl/1-0/). The baked hints are a derived database and are offered under the same licence: every file under `engine/mapgen/real-hints/` and `real-hints-index.ts` says so in its header.

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

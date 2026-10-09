# The real faces

A free ride's resort can be raised on a REAL mountainside instead of the massif R25 deals. There are twenty of them: eleven in the alpine, four continental, three maritime and two on the fells. Each one is a 4×4 km stretch of a real ski mountain, from its summit ridge down to its valley floor, turned so its fall line runs down the map. The start card's SHAPE row picks one (after COUNTRY, which lists that country's faces as REAL 1, REAL 2, …), and so does a `?face=` link (`docs/configuration.md`).

A face is named by its region and a number and nothing else (`alpine-1` … `fell-2`). The repository names no real place, so a face is a position on the globe and a crop, never the name of the resort it was taken from.

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

## The data

The heights come from the **Copernicus DEM GLO-30**, a global 30 m surface model. It is free to use and redistribute with this notice:

> © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018 provided under COPERNICUS by the European Union and ESA.

The bake works face by face:

- `make real-faces ARGS=--fetch` downloads the 1°×1° tiles the faces lie in, once, into the gitignored `previews/.dem/`. No tile is committed.
- Each face is cropped and turned onto the map's square, then smoothed with a Gaussian of 1.2 cells. The canopy and the roofs come out of the surface model; the spurs and gullies stay.
- It is kept on a 126×126 grid 32 m apart, as fine as a 30 m model honestly is, in steps of 0.5 m over its lowest point. That grid is encoded as second differences in zigzag varints, in base64.
- `ARGS=--write` writes them all into the GENERATED `engine/mapgen/real-faces-data.ts`, about 16 KB a face (21 KB as base64) and 414 KB for all twenty (much less once the site is served compressed). That file is never edited by hand.

At run time, `real-face.ts` decodes a face once and samples it bicubically, so the 2 m grid it is baked onto has no creases at 32 m.

Where each crop sits was searched once, offline. The search tried every bearing, offset and scale around a face's middle and scored each on how much of the playable face falls down the map and how far the ridge stands over the floor. The winners are the table in `scripts/real-faces.mjs`.

## What it costs

A face map is built like any other, so it costs the same to ski and to draw. Building one takes as long as a dealt map does, 8–40 s in Node, and a little longer on the attempts that calm a rugged face. `tests/real_faces_test.ts` holds every face to decoding to a mountain over its floor and holds one to building.

**Whole ski areas are not built, by design.** A map is a 4 km square on a 2 m grid, and each of its baked grids (the heights and the packed snow, 2001×2001 floats) is 16 MB. A real ski area 12–16 km across, on the same grid, would be 9–16 times that a grid: hundreds of megabytes before a tree is placed, with the build time growing the same way. That does not fit a phone, and a coarser grid would lose the grooves, the windrows and the moguls the physics reads. One face of a real mountain is what fits.

**Pre-baking further is not worth it.** The real heights are the part that costs a download, and that part is already baked. Baking finished resorts as well would mean shipping the baked grids, 32 MB of grids a map, against the seconds it takes to build one. A built map is already kept for the session (`resort-cache.ts`), and its chart for the start card is kept in IndexedDB (`seed-store.ts`).

---
title: buildResort's one-resort cache must key the version — a resort trait otherwise leaks between versions of one seed
date: 2026-10-03
scope: engine/mapgen/resort-build.ts, engine/mapgen/station-pad.ts, engine/analysis/resort.ts
concepts: [versions, resorts, cache, stations]
---

The leaning summit pads (v5) are the first resort-era trait (`levelPads` on
v4), and `buildResort` caches the last resort by `seed:region:attempts` — so
a v4 campaign map and a v5 free ride of the same seed would share one build.
The version is now in the key and threaded through `attemptResort` (and
`scripts/resort-map.mjs`'s replay of it). A pad's shape rides on the
`StationPad` itself (`r`, `deck`, `lean`, `padSurface`), so the keep-off
distances read `p.r` rather than `RR.lift.pad`; the analyzer reads
`generatorTraits(level.version)` and takes the lean back out before it
holds the pad level.

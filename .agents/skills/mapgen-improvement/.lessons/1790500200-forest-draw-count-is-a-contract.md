---
title: The forest's four rng draws a cell are what keeps the day fixed — place anything new in the woods off hash2 of the forest's seed
date: 2026-09-24
scope: engine/mapgen/forest.ts, engine/mapgen/versions.ts
concepts: [forest, determinism, versions, digest]
---

`dealSun` draws off the same stream AFTER `growForest`, so a forest change
that adds or skips a single `rng` draw moves every map's sun and weather, not
just its trees. R14's clumps and lanes (version 3) are placed off
`hash2(…, seed + k)` where `seed` is the forest's own first draw — the scan
still makes exactly four draws a cell. Trunks ARE in `levelDigest`, so a
placement change still needs a version row with the old behaviour as a trait
(`scatteredForest`); the tree KIND is not in the digest and reaches every
version. `make forest SEED=n ARGS=--compare` measures both versions side by
side.

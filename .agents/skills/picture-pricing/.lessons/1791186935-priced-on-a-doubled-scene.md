---
title: The price list before October 2026 was measured on a scene drawn twice — re-price every row before trusting AUTO's proportions
date: 2026-10-05
scope: pwa/src/game/picture-fit.ts
concepts: [performance, pricing, benchmark, measurement]
---

The benchmark always began its race while the front door's scenery was still loading, and `renderer.load` let the older load add its terrain, woods, gates, lifts, crowd and riders after the newer one's `unload` — so every run of `make bench`, `--costs` included, drew two of everything (the `perf-optimization` ledger, round 1). Rows that scale with the scene (TERRAIN, FOREST, DISTANCE, SHADOWS' casters) were priced about double, and `FLOOR_MS` with them; the pixel rows less so. The same round also cut SHADOWS HIGH's receivers to a quarter of their reads, stopped three re-deriving every material each frame under SHADOWS HIGH, and culled the ground's clipmap to the view. `PICTURE_PRICES` still carries the old numbers: the next session with a real GPU owes a full `make bench ARGS="--gpu --costs"` and a note in the PR of what AUTO keeps now that it did not.

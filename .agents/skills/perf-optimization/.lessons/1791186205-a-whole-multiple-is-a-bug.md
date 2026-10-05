---
title: A bucket in the scene tally at a whole multiple of what the settings build is a second copy of the scene, not a cost to tune
date: 2026-10-05
scope: pwa/src/game/renderer.ts
concepts: [performance, loading, renderer, measurement]
---

The benchmark report's WHAT WAS STANDING THERE showed the ground at 820,128 triangles in fourteen objects: `terrainTriangles(terrainLook("high", 1300))` is 410,064 in seven. The cause was not the clipmap but `renderer.load`: async, breathing between steps, and begun twice when the benchmark (or any run picked quickly) started while the front door's scenery was still loading. The first load resumed after the second's `unload` and added its terrain, woods, gates, lifts, crowd, spray and riders for good — every frame then drew and updated two of everything. A `console.log` of each load's start and of `scene.children`' names at its end, read off a Playwright `page.on("console")` into a file, showed the overlap in one run. Before tuning anything the tally bills, compute what ONE of it should be.

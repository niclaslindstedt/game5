---
title: Standing every real building doubles the buildings a map — the placer's all-pairs checks and the renderer's per-block draws are what it costs
date: 2026-10-10
scope: engine/game/real-houses.ts, engine/game/cabins.ts, engine/game/cabin-site.ts, pwa/src/game/village-cuts.ts, pwa/src/game/cabins-view.ts, pwa/src/game/doors-view.ts
concepts: [houses, cost, lod, districts, nudges]
---

Lifting the tiers' caps and standing the biggest buildings as halls took a
face from 253 buildings to 512 on the mean and 2009 on the biggest town,
and the first cost was not the generator's attempts (unchanged) but the
placer: every candidate spot checked every roof, lift, run line and gate on
the map, so 117 nudges times thousands of houses was quadratic. A cabin
grid for the roofs and a distance pre-filter on everything else (exact and
conservative, so the same houses stand) brought it back to about the
cap's time. The second was the picture: per-96 m-block draws and a far cut
that kept small triangles doubled the valley's triangles. Districts of four
blocks a side drawn as one mesh when none is near, a distant cut past
600 m with nothing under a square metre, a third cut for the log kinds and
door leaves instanced per tile and hidden past 300 m left the draw calls
where they were and fewer triangles than before on most faces. Measure the
drop REASONS before widening the nudges: past 14 m most of the rest are
too steep or on a run's groomed snow, which no nudge cures.

A black frame in a free ride on a face at `--t 8` was not a bug: it is the
designed fade through a gondola's top station (`camera-lift.ts`'s
`LIFT_FADE`). Look at the run's frames either side of the moment before
chasing a renderer fault.

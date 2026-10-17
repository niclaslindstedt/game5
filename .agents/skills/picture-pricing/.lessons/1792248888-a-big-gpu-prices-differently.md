---
title: On a big laptop GPU the race is the dearer view for every row, the floor is about a third of the race's frame, and past four times the reference nothing fits
date: 2026-10-03
scope: pwa/src/game/picture-fit.ts
concepts: [performance, benchmark, pricing, measurement]
---

On the reference machine (a high-end laptop GPU through Metal, 1080p) the top picture drew 13.7 ms a frame from the race and 9.0 from the vista on 2026-10-17, and every row's price came out of the RACE: no row's share of the vista's lighter frame outweighed it. The pixel and pass rows dominate — RESOLUTION 3.3 ms, TRAILS HIGH 3.6 (the deformable snow), SHADOWS 2.3 — and the trees are cheap (FOREST HIGH 0.3, the woods drawn in one batch). Every row at its cheapest still draws 36% of the race's frame and 42% of the vista's (`FLOOR_MS` is the smaller), because the region's grade pass and the processor's submit do not shrink with any row. A floor that large leaves little to fit: from about four times the reference frame no picture reaches the budget, and the fit hands back the cheapest picture there is, TRAILS off too. A test that expects the slowest fit at every row's bottom stop has to expect the cheapest-COSTING picture instead (a stop priced 0 over the one under it is kept). The per-stop costs add up past the real frame (17.1 ms summed against 13.7 measured: RESOLUTION and the pixel-bound rows each saved with the others at their top), which the probe's second round absorbs as scale.

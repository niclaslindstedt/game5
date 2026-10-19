---
title: On a big laptop GPU the race is the dearer view for nearly every row, the floor is over a third of the race's frame, and past four times the reference nothing fits
date: 2026-10-03
scope: pwa/src/game/picture-fit.ts
concepts: [performance, benchmark, pricing, measurement]
---

On the reference machine (a high-end laptop GPU through Metal, 1080p), re-priced on 2026-10-19, the top picture drew 10.3 ms a frame from the race and 8.2 from the vista, and every row's price but RESOLUTION's LOW came out of the RACE (the vista's lighter frame is more of it pixels). The pixel and pass rows dominate — RESOLUTION 2.3 ms, ANTIALIASING 4× 1.6, SHADOWS HIGH 1.5, DISTANCE MAX 1.5, TRAILS HIGH 1.35, TERRAIN HIGH 1.2 — and the trees are cheap (FOREST HIGH 0.4, the woods drawn in one batch). Every row at its cheapest still draws 39% of the race's frame and 43% of the vista's (`FLOOR_MS` is the smaller), because the region's grade pass and the processor's submit do not shrink with any row. A floor that large leaves little to fit: from about four times the reference frame no picture reaches the budget, and the fit hands back the cheapest picture there is, TRAILS off too. A test that expects the slowest fit at every row's bottom stop has to expect the cheapest-COSTING picture instead (a stop priced 0 over the one under it is kept). The per-stop costs add up past the real frame (the pixel-bound rows each saved with the others at their top), which the probe's second round absorbs as scale. The whole `--costs` list took 75 minutes there.

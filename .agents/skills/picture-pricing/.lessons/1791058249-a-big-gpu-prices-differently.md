---
title: On a big laptop GPU the floor is two fifths of the frame and DISTANCE is dear from the race, not the vista — and a free stop is kept for nothing
date: 2026-10-03
scope: pwa/src/game/picture-fit.ts
concepts: [performance, benchmark, pricing, measurement]
---

On macOS, point the lab at the installed browser (`CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`): the default path is the cloud container's, and Chrome draws through Metal on the real GPU. The whole `--costs` run took about 40 minutes there. On a high-end laptop GPU at 1080p the top picture was 10.0 ms from the race and 6.4 ms from the vista, so the VISTA was the lighter view. DISTANCE LOW saved 14% of the race's frame and only 3% of the vista's, the reverse of the integrated-GPU list. The pixel rows were cheap (all of RESOLUTION 0.87 ms) and every row at its cheapest still drew 40% of the frame, because the region's grade pass and the processor's submit don't shrink with any row. A floor that large leaves little to fit: from about four times the reference frame no picture reaches the budget, so the greedy fit drops every row, TRAILS too, for nothing. TERRAIN LOW measured no cheaper than MEDIUM from either view, so MEDIUM is priced 0 and the fit always keeps it. A test that expects the slowest fit to sit at every row's bottom stop has to expect the cheapest-COSTING picture instead.

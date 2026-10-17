---
title: On a fast GPU the --sweep prices nothing — its block noise outweighs the whole ladder — so price with --costs
date: 2026-10-17
scope: pwa/src/game/picture-sweep.ts, scripts/benchmark.mjs
concepts: [benchmark, pricing, measurement, noise]
---

On the reference machine `make bench ARGS="--gpu --sweep --width 1920 --height 1080"` (five scenes × 240 blocks, about an hour) read the top picture at about 3.3 ms and every row's cheapest at 1.6 ms, with ±1.9 ms of each 40-frame block unexplained (r² 0.8). Every stop's standard error was 0.25–0.45 ms against a whole ladder of 1.8: most stops came out within one error of zero and FOREST, SHADOWS and SPRAY negative, so the table it prints levels them all to 0 — a list that would have AUTO keep every shadow for nothing. The paired `--costs` list on the same machine the same day priced SHADOWS at 2.3 ms and TRAILS at 3.6. The sweep's standard error only falls as one over the root of the blocks, so a tenth of a millisecond would take some 4000 blocks a scene: on a fast GPU use `--costs`. The sweep's report header also names the LAST block's buffer (1536×864 is RESOLUTION 80 of 1920×1080), not the viewport.

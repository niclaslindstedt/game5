---
title: Price on an idle, plugged-in machine at 1080p — a 4K list run hot came out nonsense, and a machine in use skews every run
date: 2026-09-24
scope: scripts/benchmark.mjs
concepts: [performance, benchmark, measurement, pricing]
---

The first 4K price list, run as separate whole benchmarks, drifted from 11.7 to 16.0 ms on the top picture over its 25 minutes (a laptop running hot at 4K), and priced TERRAIN LOW as dearer than HIGH. Reading each stop as a SHARE of the top frame measured just before and after it (600-frame runs, three rounds, the median) is what made a list usable, and at 1080p the shares agreed with an earlier, cruder list to within a few points. But a share only cancels drift that is SLOW. Someone working on the machine during the hour-long run adds bursts that land on one run and not the next, so run `make bench ARGS="--gpu --costs"` on an idle machine on its charger, and say in the PR if it wasn't. Price at `FIT_REFERENCE` (1920×1080). A bigger buffer amplifies the pixel rows, and it also amplifies the heat.

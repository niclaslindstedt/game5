---
title: Benchmark scores kept before the load fix drew the scene twice — never read one against a later build
date: 2026-10-05
scope: pwa/src/game/renderer.ts
concepts: [performance, benchmark, loading, measurement]
---

`?bench=1` begins its race over the front door, whose own map is still loading, and until the load guard in `renderer.ts` (`loads`) the superseded load added its whole scene after the newer one's `unload`: the report's WHAT WAS STANDING THERE showed the ground at fourteen levels where seven are built, 1.34M triangles where one copy is about 0.75M. A BENCHMARK HISTORY score from before that fix measured twice the scene, so a later build reads as a large win it partly is and partly is not. Compare builds only with `--dist`, both runs on builds that carry the guard, and read the tally's bucket counts against what the settings build before reading the score.

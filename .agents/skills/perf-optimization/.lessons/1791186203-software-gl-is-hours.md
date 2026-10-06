---
title: In a cloud container the software-GL benchmark takes half an hour for 600 frames — profile in Node, and run browser labs one at a time
date: 2026-10-05
scope: scripts/benchmark.mjs
concepts: [performance, benchmark, measurement, swiftshader]
---

`?bench=1&frames=600` at 320×180 on four cores took 35 minutes under SwiftShader (2.3 s a frame, vertex-bound on the ground and the woods, so a smaller viewport barely helps), and `make profile` at 1280×720 metered a frame or two a scene. Its CPU slices are still worth having — the report's `submit` and a CDP profile found three's per-frame program re-derivation — but take them from `frames=120`, and do the measuring in Node (`make cpu-cost`) wherever the code runs without WebGL. A Node probe timed beside a SwiftShader page reads about twice as slow, so nothing is timed while a browser lab runs.

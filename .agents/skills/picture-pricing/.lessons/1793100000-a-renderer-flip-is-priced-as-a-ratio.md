---
title: With no GPU, price a change of renderer as each row's share of the frame on the new one over the old, in the same software, and scale the reference list by it
date: 2026-10-23
scope: pwa/src/game/picture-fit.ts
concepts: [pricing, measurement, software-gl, webgpu]
---

The WebGPU flip changed what draws every stop, and a whole `--costs` list
on SwiftShader at the plan's 600 frames and three rounds is days there (a
page load alone is minutes on the node renderer, compiling its pipelines).
What worked: `--cheapest --rounds 1 --frames 60` at 320×180, `--rows` split
so no job runs past two hours, the same rows on BOTH renderers. Each row's
span (the share of the top frame its cheapest stop saves) on the new
renderer over its span on the old is a ratio that cancels most of the
software's own bias, and it scales the reference machine's GPU prices
stop by stop, keeping each ladder's shape. Two rows read far from one
(TRAILS 0.44, SHADOWS 0.23) on a single round, so each ratio was held
between a half and twice. Check the result with the fit itself: AUTO on a
machine N times slower than the reference, before and after, must not drop
anyone to the floor who was not there before. Mark the list as an
estimate owed a real GPU's numbers.

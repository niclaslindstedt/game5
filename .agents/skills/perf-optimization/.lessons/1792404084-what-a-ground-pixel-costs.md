---
title: The ground's pixel is dear enough that triangle size and SIMD coherence decide its price — test which before rewriting a block
date: 2026-10-19
scope: pwa/src/game/snow-vertex-glsl.ts, pwa/src/game/piste-tracks.ts, pwa/src/game/terrain.ts
concepts: [performance, shaders, terrain, triangles, measurement]
---

The deformable snow's 5 cm mesh cost 2.5 ms of a 9 ms GPU frame at 1080p for the same pixels level 0 draws. A GPU shades in 2×2 quads, and triangles a few pixels across waste most of each quad on the dearest shader there is. A coarser-mesh variant shows this in one run. A block's knockout saving is not proof of where its cost is, so ask three questions before rewriting:
- Switched off by a uniform with its code still compiled, does it save what deleting it saves? Then it's arithmetic, not register pressure (`pisteTracks`: yes).
- An early `continue` inside a per-pixel loop saves only where a whole SIMD group skips together. Two exact skips in the track loop bought nothing.
- A gain from draw order is not overdraw until culling the supposedly hidden triangles saves the same. Drawing the patch first saved 0.2 ms; culling level 0 under it saved nothing.

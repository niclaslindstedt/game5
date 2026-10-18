---
title: A piece torn off was a whole second body with every other bone gathered to a point — cut its skin to the triangles its bones move
date: 2026-10-18
scope: pwa/src/game/skier-dress.ts, pwa/src/game/gore-view.ts
concepts: [gore, performance, skinning, pieces]
---

`tear` dressed a second skin of the whole outfit and collapsed every bone
but the piece's, so a head off was 20k triangles skinned on the GPU (in the
picture and in the sun's map) for as long as it lay there, and four limbs
off a body was 81k. `createDressed`'s `keep` cuts the outfit's arrays down
to the triangles with any weight on the piece's bones (those the collapse
does not gather away) — 3.9k for a head, the seam still closed by the
collapse — once an outfit and piece (`cutAhead` at load). The lumps thrown
out of him are instanced by shape and baked into one mesh once still
(`gore-lumps.ts`); a mesh each was two draws each for as long as he lay.

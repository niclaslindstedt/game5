---
title: An InstancedMesh's morph weights draw nothing until morphTexture.needsUpdate is set — and fail silently
date: 2026-10-03
scope: pwa/src/tools/crowd-harness.ts, pwa/src/game/crowd-view.ts
concepts: [instancing, morph-targets, harness]
---

`InstancedMesh.setMorphAt` allocates the per-instance weight texture but does
not flag it for upload, so a harness that calls it once and renders reads a
base influence of 0 in `morphinstance_vertex` and every vertex collapses to the
origin: the sheet draws the snow and nothing else, with no console error and
no shader warning. The game's view sets `morphTexture.needsUpdate` every frame
it writes weights; a lab that draws a one-off instance must set it too. A
quick isolation: swap in a `MeshBasicMaterial` and drop the morph attributes —
if the figure appears, the morph path is the culprit.

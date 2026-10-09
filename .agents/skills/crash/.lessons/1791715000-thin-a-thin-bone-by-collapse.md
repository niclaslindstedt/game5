---
title: Thin a thin bone by collapsing edges, and build an organ the body lacks as the space it fills
date: 2026-10-09
scope: scripts/xray-body.mjs, scripts/lib/xray-thin.mjs, scripts/lib/xray-lungs.mjs, scripts/lib/xray-voxels.mjs, pwa/src/game/xray-view.ts
concepts: [xray, anatomy, decimation, lungs, clipping, lab]
---

The X-ray ribcage read as "a bunch of white boxes" because the pieces were
thinned by clustering corners on one grid: a whole ribcage at 1800 triangles
needs a cell wider than a rib is thick, so every rib became a chain of
blocks and the skull opened holes. Quadric edge collapse (refusing a collapse
that breaks the link condition or turns a face over) keeps a rib a rounded
bar at the same budget and keeps closed pieces closed. Smooth normals inside
a crease did the rest — flat shading on a low-poly bone is what reads as box.

The lungs clipped the ribs because this body has no lung surface, only the
airway tree, and its hull pushes past the ribs. Building the lung as the
space it fills (the cage read slice by slice as the nearest bone at each
bearing, over the diaphragm's top, the heart and great vessels kept out) put
it inside by construction. Many-part organs (the heart's 83, the bowel's 64)
cannot be collapsed into a budget part by part; fill them into one voxel grid
and read one surface back first. `make xray-body` prints a clipping table
(organ volume another piece runs through) — check it before looking, and
`make xray ARGS=--scene=anatomy` to look without needing a fatal fall.

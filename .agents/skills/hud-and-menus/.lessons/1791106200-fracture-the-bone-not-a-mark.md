---
title: A fracture on the HUD body is the bone's own geometry cut, never a symbol drawn on it — and a bone made of plate pieces must be fused first
date: 2026-10-04
scope: pwa/src/game/body-figure.ts, pwa/src/game/hud-body.tsx, pwa/src/tools/anatomy-harness.ts
concepts: [body-figure, anatomy, fractures]
---

A zigzag stroke stamped over a bone was rejected: it reads as a HUD marker, and it wandered off the bone. `fractureOf` instead cuts the bone along an irregular line at its mark. A hairline is a tapering fissure clipped out of the bone (the flesh shows through). A break is clip-paths: the bone less the far piece, plus the piece displaced about half a width and angulated 6–12°, and a long bone's butterfly fragment. Colour alone says the grade. Displacement is wanted; a whole bone must stay clean. Two prerequisites the lab now enforces. First, a crack's spot is snapped ONTO its bone and centred across it, with its half width measured edge to edge (a spot near an edge gave femurs r = 0.6 and invisible fissures); `hud_test` holds every mark inside its bone. Second, a bone the plate draws in pieces (the pelvis with sacrum and rami, the manubrium with sternum) is fused by a raster closing before tracing — otherwise the seams between pieces read as fractures on a healthy bone.

---
title: A fracture on the HUD body is the bone's own geometry cut, never a symbol drawn on it — its mark must sit on the bone, centred across it
date: 2026-10-04
scope: pwa/src/game/body-figure.ts, pwa/src/game/hud-body.tsx, scripts/hud-body.mjs
concepts: [body-figure, anatomy, fractures]
---

A zigzag stroke stamped over a bone was rejected: it reads as a HUD marker, and it wandered off the bone. `fractureOf` instead cuts the bone along an irregular line at its mark. A hairline is a tapering fissure clipped out of the bone (the flesh shows through). A break is clip-paths: the bone less the far piece, plus the piece displaced about half a width and angulated 6–12°, and a long bone's butterfly fragment. Colour alone says the grade, and the shading bands ride along inside the clip, so a broken bone keeps its light. Displacement is wanted; a whole bone must stay clean. The mark is what makes it read: snapped onto the part of the bone that SHOWS (no other bone drawn over it there), centred across it, its half width measured edge to edge at a pixel's centre. A mark near an edge gave femurs r = 0.6 and invisible fissures. `hud_test` holds every mark inside its bone in both views.

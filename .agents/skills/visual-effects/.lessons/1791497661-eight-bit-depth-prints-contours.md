---
title: A plate's 8-bit log depth prints contours through any noise mapped off it, at every mip — drive screen-space effects off plate UV instead
date: 2026-10-08
scope: pwa/src/game/title-glsl.ts
concepts: [title-scene, depth, banding, shader]
---

The title plate's aux R channel is depth as eight bits of a log (`near*(far/near)^r`). Mipmaps of an RGBA8 texture are themselves eight bits, so sampling a blurred LOD does NOT remove the steps: each 1/255 is a ~4 % jump in metres, and a noise field driven by metres (cloud shadows sliding over the snow) prints those steps as wiggly contours and rectangular bands, worst in the far snow. Use the depth only where a step is invisible (the parallax's small slide, off LOD 4.5, clamped) and build anything noise-driven off a plate-space perspective (`1/(v + k)` opening the UV out down the slope). To find such an artifact, output each term alone (bloom, rays, the cloud field, the depth) in the composite until the band shows in one.

---
title: A printed cloth seen from behind reads mirrored and its night glow does too — turn the word's band on back faces, glow off the same sample, and never print white on snow
date: 2026-10-11
scope: pwa/src/game/challenge-flags.ts, pwa/src/game/challenge-shapes.ts
concepts: [cloth, texture, double-sided, emissive, readability, snow]
---

The challenges' feather flags swing to the wind, so half the time the lens sees the back of the sail and the word reads mirrored. Turning only the word's band end for end on `!gl_FrontFacing` (`SAIL_MAP`) makes it read, but two traps followed: the flipped band's edges jumped a mip level (read it with `textureGrad` off the UNTURNED uv's derivatives), and at night the `emissiveMap` — sampled on its own varying — still printed the mirror over the right word. Drive the glow off the diffuse sample (`totalEmissiveRadiance *= sailPrint.rgb`) instead of a second map. And a white START sail vanished against the snow and a winter sky at 30 m: anything that must read on the mountain wants a saturated ground (the gate blue), whatever the minimap's flat white does.

---
title: A far face that reads pale is the DISTANCE row's mist, not its albedo or the haze — find out which term by drawing it
date: 2026-10-16
scope: pwa/src/game/haze.ts, pwa/src/game/rocks.ts, pwa/src/game/strata-glsl.ts
concepts: [haze, mist, far-faces, debugging, flicker]
---

Darkening the far rock's albedo by a third moved face-400's mean pixel by
one step in 255, and laying the haze thinner did nothing at all. Drawing
each term straight to `gl_FragColor` at `dithering_fragment` (the albedo,
`reflectedLight.indirectDiffuse`, `.indirectSpecular`, then `hazeAir` and
`hazeMist`) found it in four renders: with `uMistOpen` 1 the DISTANCE row's
mist is a FLOOR under the haze, already ~0.6 of the way to the sky's colour
400 m out on HIGH, and it flattens any albedo. `HAZE_KEEP` (a material's own
define, scaling `max(hzAir, mist·open)`) is the lever. But the same mist is
what hides the far skin and the ground under it trading pixels as the lens
moves: kept thin past 600 m the 600 m flicker tripled. Lay such a keep only
over a band (here 340–600 m), and run the WHOLE `make shimmer` shot list
every time — a shot list of two reads different numbers for the same build.

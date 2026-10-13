---
title: Judge the moonlight on a face away from every lamp, by the snow's MEAN — and weigh the night's ambient by how the snow reads it
date: 2026-10-13
scope: pwa/src/game/night-sky.ts
concepts: [night, moon, lamps, exposure, labs]
---

The first moon sheet measured the snow behind the start grid and found a full
moon's snow, a quarter's and a new moon's within ten per cent of each other.
The model was right; the view was wrong. The start stands under the arena's
floods and every skier's headlamp, and 30 lx of floodlight swamps a quarter of
a lux of moonlight. The sky lab's `litL` is the brightest fifth of the snow's
grey pixels, so it reads the lamps and the glints, never the night. The moon
sheet now measures the MEAN of the lower frame on the face seen from the ridge,
away from the lamps.

The second trap was the model's sum. Three's ambient units are laid as a
hemisphere in the night's blue, and the snow reads them about a sixth as
brightly as the same units of the key (`NIGHT.seen`). A ratio reckoned as
`key + ambient` promised a new-moon night an eighth of a full moon's. On screen
it came out a fortieth: black. Fit `NIGHT.ambient` to the RENDERED ratio
(`make sky ARGS=--sheet=moon`'s note line) and hold the model's test to the
same weighting.

---
title: A lens hundreds of metres over the snow sees only the DISTANCE row's mist unless it is measured across the ground
date: 2026-10-11
scope: pwa/src/game/haze.ts, pwa/src/game/machines.ts, pwa/src/game/camera-wingsuit.ts
concepts: [wingsuit, haze, mist, lens, aloft]
---

The mist (`hazeAmount`) closes on the 3D distance to a point at any height,
whole at the DISTANCE row's view (1300 m on HIGH). From 900 m over the snow
straight down is already 0.7 of the wall, so every wingsuit lens — even
HIGH looking straight down — drew a pale wash, and a level chase lens drew
nothing at all. The fix is `uMistAloft` (0 on every other ride, so nothing
else moves): measured across the ground and closed only over its last part,
the clipmap's own edge still hidden. With it, a lens must still LOOK DOWN
along his line: past the ground's edge there is only the dome's horizon.

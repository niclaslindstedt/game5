---
title: A texture that runs ALONG the way shows no motion — break the corduroy along its length, and streak what is close
date: 2026-10-01
scope: pwa/src/game/snow-glsl.ts, pwa/src/game/snowfall.ts, pwa/src/game/camera-rigs.ts
concepts: [sense-of-speed, optical-flow, corduroy, streaks, camera]
---

"50 km/h reads like 20" on the groomer had a cause no camera number fixes:
the piste's only visible texture was the comb's corduroy, and stripes
parallel to the travel look the same however fast they are skied. Wearing
the comb in patches along its length (`worn`, `chip` in the corduroy block)
and a finer albedo octave close in gave the surface something to stream.
Over open snow the air's crystals are the only near thing, and as points
they flicker rather than rush; drawing the nearest as LineSegments from the
flake back along the lens's travel (`SHUTTER` of it) reads as speed even in
a still, against the sky and the trees — white over sunlit snow, never.
Only a riding lens streaks them: `make world`'s chase views are PLANTED
(the lab's override) and show none, so look at the `tips` view or the built
app (`screenshots --t 40`). Lowering the chase (1.7 m up, 4.3 m back) and
widening its fov (to 86° at pace) did the rest, and a lower boom means the
woods test that stands the skier a few metres past the lone spruce has to
stand him closer.

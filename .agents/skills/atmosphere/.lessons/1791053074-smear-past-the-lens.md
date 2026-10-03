---
title: Anything in the air the lens runs through is drawn as the SMEAR of its velocity past the lens — a dot at speed strobes and reads as riding along
date: 2026-10-03
scope: pwa/src/game/snowfall.ts, pwa/src/game/snowfall-plan.ts
concepts: [snowfall, motion-blur, lens, wind]
---

The fall was world-anchored all along, so in world space the flakes did come at the
lens at the skier's speed — and it still looked as if the snow rode with him. At
100 km/h a near flake hops tens to hundreds of pixels between two frames; drawn as a
round dot, the eye cannot link one frame's dot to the next and follows the slow far
flakes by the vanishing point instead. The cure is to draw EVERY flake as the line it
sweeps over the frame's shutter (a full frame, so one frame's smear meets the
next's): its velocity past the lens is its own (`flakeDrift`: the wind, its fall)
less the lens's, MEASURED off the camera frame to frame (`createLensTrack`, with a
jump faster than any lens skis taken as a cut), never assumed from the skier — a
planted or a lagging lens then comes out right by itself. Spread the light along the
smear (width over length to a power under 1), or a long smear is a white bar.
`make snowfall`'s flow sheet is where a regression shows.

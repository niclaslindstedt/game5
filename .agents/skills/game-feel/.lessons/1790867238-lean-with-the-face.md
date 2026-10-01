---
title: A boom aimed level loses a steep face — lean by a share of the fall line and compose the skier, and feed a spring the trend
date: 2026-10-01
scope: pwa/src/game/camera-rigs.ts, pwa/src/game/camera-spring.ts, tests/camera_test.ts
concepts: [camera, slope, composition, spring, poles]
---

"I can barely see the skier, I can't see where I'm going" on a steep pitch was
the boom's aim being a fixed point 8 m ahead at the skier's height: on a 30°
face that looks level, the skier sinks to the foot of the frame and half the
picture is sky. The geometry decides it: with the skier COMPOSED at one place
in the frame, the arm's elevation alone sets where the horizon lands and how
much of the piste ahead shows (the band between the skier and the slope's
vanishing line is roughly the lens's elevation above the slope PLANE). So the
arm leans up the slope by `incline` (0.7 on chase) and the look follows the
composition; 1 reads the face flat, 0.5 puts the lens nearly in the slope
plane on a black and the piste ahead collapses onto the skier's head.

Two traps in second-order springs: a height spring lags a steady descent by
k1·v (1.7 m at 100 km/h down 30°, which pushes the skier low) unless it is
told the TREND (the fall line's predicted descent) with r = 2; and the
velocity-first integration order LEADS a ramp by a frame — integrate the
position first. A scratch vitest that schusses a constant face and prints
where the skier and the horizon stand (in half-fovs) answers any framing
question in a second; `make world --grade=black` then shows it.

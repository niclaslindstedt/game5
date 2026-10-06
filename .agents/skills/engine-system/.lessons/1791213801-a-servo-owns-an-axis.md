---
title: A stroke that buys an ANGLE is a servo on a body rate — stop it dead on release, and guard the pacing against a landing that is out of sight
date: 2026-10-05
scope: engine/game/strokes.ts
concepts: [strokes, servo, air, landing, NaN, pacing]
---

The tap strokes (`strokes.ts`) own an axis's rate while an angle is owed
and hand it back to the air when it is turned. Two traps the first pass
hit. Released below a "still" threshold (0.3 rad/s) the leftover yaw rate
was the air's to damp, and the air's yaw damping is light: a 180 drifted
18° in the 1.3 s before the snow came back and was judged a sideways
landing. Set the rate to zero on the step the throw finishes — the stop is
the throw's own. And `landingAhead` returns null past its three-second
horizon; read as `Infinity` time left, the trapezoid's cruise
(`room·accel − √(room²·accel² − …)`) is `∞ − ∞` = NaN, which one step later
is a NaN skier. Any pacing off the landing needs a finite branch for "no
snow in sight". The tell was a staged flight over a falling slope that
produced no events at all: check the state for NaN before the scoring.

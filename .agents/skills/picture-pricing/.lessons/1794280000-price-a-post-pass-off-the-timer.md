---
title: On SwiftShader, price a full-screen pass off the GPU's timer against another full-screen pass, never off the frame
date: 2026-10-23
scope: pwa/src/game/picture-fit.ts, pwa/src/game/rays-tsl.ts, scripts/benchmark.mjs
concepts: [performance, measurement, webgpu, swiftshader, picture-pricing]
---

SwiftShader rasterises the scene in software, so on the benchmark's race at
HIGH the scene pass takes 97 % of the GPU's time (4.6 to 4.9 s a frame at
320×180), and a few full-screen passes are lost in its noise. `make bench
ARGS="--costs --rows rays,resolution --renderer=webgpu"` ran past its hour
without a reading. The plain benchmark's GPU timer still reads each slice:
RAYS were priced as multiples of the grade's own full-screen pass (5.5, 5.8
and 6.5 times it, from three plain runs of 60 frames, about ten minutes
each), then scaled by an estimate of that pass on the reference machine. A
pass that runs on every pixel scales with the pixels, as the grade does, and
the scene does not, so the grade is the better yardstick. It is still an
estimate, and it says so where the price is written: a real GPU's prices are
owed. Run benches one at a time. Two jobs on four cores push a 60-frame run
past an hour.

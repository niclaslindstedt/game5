---
title: SwiftShader's WebGPU puts the device's queue in the processor's numbers — stub the encoder's draws to price the main thread
date: 2026-10-23
scope: pwa/src/game/forest-indirect.ts, scripts/benchmark.mjs
concepts: [performance, measurement, webgpu, swiftshader]
---

On SwiftShader's WebGPU a 60-frame benchmark's `render` mean is set by
whichever frame happened to wait on the device's queue: the woods drawn
indirect read 967 ms against 25.9 ms before, from readings of 19–47 ms
against 21–37. What reads the main thread is round 5's no-draw meter
restated for WebGPU: an init script that replaces
`GPURenderPassEncoder.prototype.draw`, `drawIndexed`, `drawIndirect` and
`drawIndexedIndirect` with no-ops. The passes, the pipelines and three's
whole per-object path still run, nothing is rasterised, and 300 frames take
minutes, not hours. It priced the woods' indirect draws at 3.7 ms of
three's `render` at HIGH (10.94 → 7.23) where the plain benchmark could not
tell. Pipelines are still built, so a warm-up is still checked by the
part 6 probe, not by this meter.

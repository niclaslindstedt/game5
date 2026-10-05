---
title: In a cloud container the built game's race shots come out a white-out — shoot them at --video low
date: 2026-10-05
scope: scripts/screenshot.mjs
concepts: [screenshots, swiftshader, video, cloud]
---

`make screenshots` of a race in a cloud session (SwiftShader, no GPU) drew the sky and a featureless white over the whole frame — no skier, no terrain — with `GL_INVALID_OPERATION: … Mismatch between texture format and sampler type` in the log; a downhill shot the same way did the same, so it is the container, not the course. `--video low` draws the race properly (the skier, the track, the woods, the HUD). The cards (`--surface …`) draw at any tier.

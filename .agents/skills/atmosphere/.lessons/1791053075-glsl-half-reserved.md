---
title: GLSL ES reserves `half` (and `input`, `output`, `filter`, `sample`…) — a local named so compiles nowhere
date: 2026-10-03
scope: pwa/src/game
concepts: [shaders, glsl]
---

A vertex shader with `vec2 half = …` passes `tsc` and eslint (it is a string) and
fails at link time on the GPU, where three only logs it and draws nothing. Name such
locals for what they hold (`halfPx`). Nothing but a lab that draws the material
(`make snowfall`, `make sky`, `make world`) catches it before a player does.

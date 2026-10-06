---
title: Under software GL, stub the draw calls to price the main thread — and look for three's hidden program changes
date: 2026-10-06
scope: pwa/src/game/
concepts: [performance, measurement, swiftshader, three]
---

Under SwiftShader, the benchmark's `submit` moved by ±1 ms from run to run whatever was changed, because rasterising runs inside the draw calls on the same machine. An init script that turns `drawElements`, `drawArrays` and their instanced forms into no-ops (`page.addInitScript`, over `WebGL2RenderingContext.prototype`) leaves every state change, uniform and upload in place and takes the rasteriser out, so the CPU profile and WHERE THE FRAME WENT price only the processor: 600 frames in about 35 s, and repeatable. Profile only the last seconds (the load compiles every program and dominates otherwise), and CDP line numbers are zero-based.

Two of three's costs that the profile showed and the code does not: the shadow map's ONE shared depth material changes program at every switch between instanced, skinned and plain casters (hand each caster a depth material of its kind), and a transparent `DoubleSide` material is drawn twice with its `version` bumped between, so its program is looked up twice a frame (two meshes, back then front, draw the same).

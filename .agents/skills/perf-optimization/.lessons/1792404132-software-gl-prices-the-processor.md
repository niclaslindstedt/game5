---
title: Under software GL, time in Node or with the draw calls stubbed, and price a shader by what a change removes — never by a branch it adds
date: 2026-10-05
scope: scripts/benchmark.mjs, pwa/src/game/
concepts: [performance, benchmark, measurement, swiftshader, shaders, three]
---

SwiftShader rasterises inside the draw calls on the processor. Three consequences:
- **It's slow.** 600 benchmark frames at 320×180 took 35 minutes on four cores, vertex-bound on the ground and the woods. Take CPU slices from `frames=120`, do the measuring in Node (`make cpu-cost`) wherever the code runs without WebGL, and never time a Node probe beside a SwiftShader page: each makes the other read about twice as slow.
- **Its `submit` moves ±1 ms from run to run whatever was changed.** An init script turning `drawElements`, `drawArrays` and their instanced forms into no-ops leaves every state change, uniform and upload in place: 600 frames in about 35 s, repeatable. Profile only the last seconds (the load's compiles dominate otherwise); CDP line numbers are zero-based. That profile is where three's hidden program changes showed: the shadow map's one depth material switching between instanced, skinned and plain casters, and a transparent `DoubleSide` material drawn twice with its `version` bumped between.
- **It runs a skipped branch at the branch's full price**, masked. A uniform `continue` over empty lamp slots cost it 175 of 385 ms; a `break` at the first empty slot (exact, `dealLamps` fills them in order) took the frame to 283. Equally, a cheaper path on a per-puff varying bought only ~1.5%, because both sides run. Price a shader by cutting it short (`gl_FragColor = …; return;` at each stage) and by work removed outright, against the same random stream.

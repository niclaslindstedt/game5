---
title: Find a mid-run stall's program by hooking linkProgram after the card and diffing its source against the nearest program linked before
date: 2026-10-19
scope: pwa/src/game/environment.ts, pwa/src/game/clouds.ts, pwa/src/game/rocks.ts
concepts: [performance, shaders, three, loading, hitches]
---

A 206 ms frame in a downhill and 80 ms in ski cross profiled as `uniformMatrix4fv` inside `setProgram`: the driver finishing a program at its first use. An init script wrapping `linkProgram` and `useProgram` that records each program's shader sources, flagged by whether `__SH_READY__` was set, then a diff of each late one against its most similar early one, names the define or attribute that moved:
- the rock skin's tiles carry normals (`HAS_NORMAL`), and only a tile built as the lens nears a cliff had them;
- the dome's `CLOUD_SLAB 2` arrives once the cloud volume's noise lands, after the card;
- the volume's whole and share-marched passes are drawn off the scene.
Warm what the run's first frame will really use: draw the clouds' real `update` at the run's own sky and clock, not a guessed define, or a clear sky relinks back on frame one. And three's `warmShadows` reads the render state the last whole `render` left, which a pass on another scene clears: warm the shadows first. A load that throws there leaves a blank page with nothing in the console.

---
title: A per-object number written into GLSL as a literal compiles one shader program per object — pass it as a uniform
date: 2026-09-24
scope: pwa/src/game/
concepts: [performance, shaders, loading]
---

three.js links one program per distinct cache key, and a graft that writes a species' wrist or a beast's head pivot into the source as `${v.toFixed(4)}` gives every species its own source, so its own key and its own compile on the loading card (the birds were nine programs and the beasts fourteen, counting their shadow-depth variants). Put the number in `shader.uniforms` inside `onBeforeCompile` and give every material of the family ONE `customProgramCacheKey`: three calls `onBeforeCompile` per material, so each keeps its own uniform values while they share the program. `hazeMaterial` keys by `name` only when a caller passes its own graft (`extra`). To count what a race compiles, patch `WebGL2RenderingContext.prototype.linkProgram` / `shaderSource` in a Playwright `addInitScript` over the built site on `?start=race`, then hash each program's sources to find byte-identical ones linked twice. A pass that renders outside the scene (the trail maps) must be compiled on its own, against its own render target, or it links on the first frame.

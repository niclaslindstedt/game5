---
title: three 0.186 swaps PCFSoftShadowMap for PCF at its first shadow render — every program compiled before that is keyed under the old type and relinked at its first draw
date: 2026-10-18
scope: pwa/src/game/renderer.ts
concepts: [performance, shaders, three, shadows, loading]
---

`shadowMap.type` is part of every lit program's cache key. three removed
PCFSoft and swaps the renderer's type to PCF inside `WebGLShadowMap.render`,
so a `compileAsync` that runs before any shadow pass builds every program
under the soft type and the first real draw builds them all again under PCF.
The world's own were saved by `warmPicture` (it draws after `warmShadows`
flipped the type), but anything compiled and then hidden before its first
draw — the gore view's primer — linked again the moment it showed: 4 to 13
programs on a high-speed hit, 50–170 ms of one frame on a desktop GPU. The
renderer now asks for `PCFShadowMap`, which is what three draws anyway. To
find a key that moved, diff three's own `gl.info.programs[].cacheKey`
before and after the stall (`make gore-cost` prints them): the field that
differs names it.

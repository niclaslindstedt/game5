---
title: A run stood up again without the loader must stand on the very Level object the renderer built, or it never steps
date: 2026-10-04
scope: pwa/src/App.tsx, pwa/src/game/pinned-run.ts, engine/mapgen/slalom.ts
concepts: [restart, renderer, level-identity, slalom, screenshots]
---

`App.tsx`'s `drawable()` compares `standing === state.level` by IDENTITY, and
`restart` adopts a new state without calling the renderer's `load`. A restart
whose `createGame` builds a NEW `Level` (an equal copy is not enough) is never
drawn or stepped: the race freezes on its lights. A slalom did exactly that,
because `setSlalom` set its course again into a fresh object; it now returns
a map that already carries the asked run's course as it is. Under the
software rasterizer a frozen restart and a slow one look the same at first —
the clock barely moves either way — so probe `state.t` over twenty seconds,
not three, before concluding either.

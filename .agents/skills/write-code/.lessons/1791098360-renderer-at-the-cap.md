---
title: renderer.ts sits at the 1000-line cap — hang a new kind of scene object off an existing view's constructor, not new fields in the renderer
date: 2026-10-04
scope: pwa/src/game/renderer.ts
concepts: file-size, renderer
---

`renderer.ts` is a line or two under `tests/file_size_test.ts`'s cap, and every new subsystem there costs a field, a dispose, a scene remove, a create and an update. The race spectators went in at zero net lines: `createPeopleView` (`spectators.ts`) returns the free ride's `CrowdView` alone, or a group holding it and the spectators, behind the same `{ group, update, dispose }` — the renderer swapped one constructor call. Keep the combined group's NAME (`crowd`): the renderer's subsystem toggles (`?hide=`, the benchmark's A/B) find a subsystem by its group's name.

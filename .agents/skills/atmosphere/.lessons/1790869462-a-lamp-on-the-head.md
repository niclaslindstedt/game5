---
title: A lamp on the skier hangs on the HEAD's frame, is aimed off the head's own forward and never edits a model source
date: 2026-10-01
scope: pwa/src/game/headlamp.ts
concepts: [headlamp, lamps, night, models, helmet]
---

The headlamp once aimed along a helmet tipped nose-down on a head the pose
already tips at the snow: the spot landed three metres ahead and burnt the
snow at the tips white. Aimed off the head's own forward (`HEADLAMP_DIP`)
it lands fifteen to twenty metres off — judge it in `make world`'s `helmet` and
`track` views at `--hour=21`, and `lookback` for the halo. Hung on
`SkierFigure.head` AFTER the posed merge, it stays out of the one draw and is
not hidden with the code's body when the Blender skier draws, whose helmet is
the same shell (`helmet-shape.ts`). And `helmet-shape.ts` is a MODEL SOURCE
(`MODEL_SOURCES` in `pwa/models-plugin.ts`): even a rename-only refactor of it
fails `tests/models_test.ts` until `make models` (Blender) is re-run — build
what the lamp needs off its exports instead.

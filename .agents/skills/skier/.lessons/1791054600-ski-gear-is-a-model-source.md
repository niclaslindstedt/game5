---
title: ski-gear.ts is one of the committed models' SOURCES — a view-only motion added there stales the stamp; lay it on from skis-body.ts
date: 2026-10-03
scope: pwa/src/game/ski-gear.ts, pwa/src/game/skis-body.ts, pwa/models-plugin.ts
concepts: [models, stamp, chatter, pose]
---

The skis' chatter (a flap and a rock per ski) was first written into
`ski-gear.ts`'s `pose`, the obvious home — and `tests/models_test.ts` went
red: `MODEL_SOURCES` (`pwa/models-plugin.ts`) hashes that file because the
drawn travel the Blender clips run to is stated there, so ANY edit to it
asks for `make models`, which needs Blender. A motion that is the view's
alone has no business moving the models' stamp: carry it on the `Stand`
(`ski-stand.ts`, not a source), let `ski-rig.ts` (not a source) pose the
model skis off it, and lay the code-built skis' share on after
`gear.pose` in `skis-body.ts`. Check `MODEL_SOURCES` before editing any
`ski-*` file.

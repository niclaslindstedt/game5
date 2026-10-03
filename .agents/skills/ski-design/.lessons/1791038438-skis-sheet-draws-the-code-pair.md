---
title: The skis lab's `skis` sheet draws the CODE pair — judge a model on the `asset` sheet or in the built app
date: 2026-10-03
scope: scripts/skis-preview.mjs, pwa/src/tools/skis-harness.ts
concepts: [models, judging, labs]
---

`make skis` builds its own bundle with no models packed (`configFile: false`, no `models-plugin`), so `loadModels` finds nothing and every sheet but `asset` shows the code-built pair (`ski-gear.ts`, its decals separate meshes). A change to `scripts/blender/skis.py` or to what it is handed is judged on `make skis SKIS=<id> ARGS="--sheet=asset --asset=pwa/models/<id>.glb"` (after `make models`), in Blender's own stills (`make blender ID=<id> ARGS="--quality=render --views=three"`), or in the built app (`make build`, `make screenshots ARGS="--surface skis"`). Note too that the asset sheet dresses both rows in the slot's colours, not the pair's topsheet.

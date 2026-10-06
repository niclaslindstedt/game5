---
title: Cut models with the Blender `sources.json` names — `pip install bpy==<it>` reproduced every untouched model byte for byte
date: 2026-10-03
scope: pwa/models/sources.json, scripts/bpy-blender.sh
concepts: [blender, headless, models, determinism, stamps]
---

`make models SET=machines` rebuilds the six pairs AND the skier, so a change
to the skier alone still re-cuts every pair. With the Blender version
`pwa/models/sources.json` records (`"blender"`) installed as the `bpy`
module (`python3.11 -m pip install --break-system-packages "bpy==4.2.0"` in
a Claude web session; the wheel is ~350 MB, pip's latest is 5.x), the
pairs came out byte-identical and only `skier.glb` moved — the diff is the
change and nothing else. Check the version first; a newer bpy re-cuts
models nobody touched. And run `make fmt` BEFORE `make models`: the stamp
hashes the sources' text, so prettier reflowing a model source after the
cut fails `tests/models_test.ts` and costs a second cut.

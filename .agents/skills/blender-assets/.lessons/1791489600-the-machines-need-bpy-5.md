---
title: The machines' builders need bpy 5.0 — 4.2.0 has no `keep_custom_normals`, whatever `sources.json` says
date: 2026-10-08
scope: pwa/models/sources.json, scripts/models.mjs, scripts/blender/heli.py
concepts: [blender, headless, models, stamps, versions]
---

`sources.json`'s `"blender": "4.2.0"` is a constant `scripts/models.mjs`
writes, not the version that cut the machines: the sled's and the groomer's
glTFs carry the 5.0 exporter's generator string, and `heli.py` fails under
`bpy==4.2.0` (`TriangulateModifier` has no `keep_custom_normals`). For the
helicopter, the air ambulance, the sled and the groomer install
`python3.11 -m pip install --break-system-packages --target <scratch>
"bpy==5.0.1"` and point `BLENDER` at a two-line wrapper that runs
`scripts/blender-bpy.py` under `python3.11` with that `PYTHONPATH` (the
repo's `bpy-blender.sh` calls `python3`, a 3.13 with no wheel). Cuts under it
are byte-stable run to run; read a glb's `"generator"` before trusting the
stamp's version.

---
title: A Linux web session gets Blender from pip — the bpy wheel of the version sources.json names
date: 2026-10-03
scope: scripts/bpy-blender.sh, pwa/models/sources.json
concepts: [blender, bpy, headless]
---

No `blender` binary is installed in a cloud session, but `pip download bpy==<version> --no-deps` then `pip install --break-system-packages` the wheel (about 520 MB; take the version from `pwa/models/sources.json`'s `blender`, 4.2.0 needs Python 3.11) is enough: `scripts/blender.mjs` finds the module through `scripts/bpy-blender.sh`. `make blender KIND=skier ID=skier0 ARGS="--quality=game --views=none"` took 55 s, and `make models` (the six pairs) 13 s with every glTF byte-identical to the macOS-made ones — so a re-stamp after a `MODEL_SOURCES` change is honest from Linux too. Delete the downloaded wheel afterwards; the disk allowance is fixed.

---
title: In a cloud container point BLENDER at /opt/blender/blender — without it the driver falls back to the bpy module and dies on "No module named 'bpy'"; a builder's own lines reach the terminal only if the driver's echo filter names them, and the driver is in EVERY model's stamp
date: 2026-10-08
scope: scripts/blender.mjs
concepts: blender, headless, tooling
---

`scripts/blender.mjs` looks for Blender at `BLENDER`, the macOS app, then `blender` on the PATH, and only then the pip `bpy` wrapper; the container's Blender sits at `/opt/blender/blender`, off the PATH, so every `make blender` / `make title-scene` there needs `BLENDER=/opt/blender/blender`. Its Cycles is CPU only (the CUDA warning is harmless) and EEVEE cannot start (no libEGL). The driver echoes only lines matching its filter (`BONES|CLIPS|TRIANGLES`, `Saved: '<path>'`, errors): a builder that reports anything else must print under one of those forms or it is dropped. Do not widen the filter for one kind: `scripts/blender.mjs` is a source of every model's stamp (`MODEL_HALVES`), so any edit to it stales all of `pwa/models/` until `make models` runs again. For a fast iteration loop call Blender on the builder directly with the kind's JSON (written once by the kind's `data()` through `aliasEngine`) instead of round-tripping the driver.

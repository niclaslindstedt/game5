#!/bin/sh
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# A `blender` for a machine that has only the `bpy` Python module (pip's
# Blender-as-a-module): `scripts/blender.mjs` and `make models` spawn this
# when BLENDER is unset and no Blender binary is on the PATH, with the very
# arguments they would hand the binary (`-b --factory-startup -P <builder>
# -- <args>`), and `scripts/blender-bpy.py` runs the builder over the module.
exec python3 "$(dirname "$0")/blender-bpy.py" "$@"

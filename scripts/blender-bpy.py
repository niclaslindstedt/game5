# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# `blender -b --factory-startup [...] -P <script> -- <args>` over the `bpy`
# MODULE: the same builder, the same arguments, no Blender binary. Everything
# before `-P` is Blender's own command line and is ignored; the script named
# by `-P` is run as `__main__` with `sys.argv` laid out the way Blender lays
# it (the script's path, then `--` and the builder's arguments), on a fresh
# factory scene. A builder that raises ends the run with exit code 1, as
# `--python-exit-code 1` would.

import os
import runpy
import sys
import traceback

argv = sys.argv[1:]
try:
    script = argv[argv.index("-P") + 1]
except (ValueError, IndexError):
    sys.stderr.write("usage: bpy-blender.sh -b [...] -P <script> -- <args>\n")
    sys.exit(2)
rest = argv[argv.index("--"):] if "--" in argv else []

import bpy  # noqa: E402  (after the argument check: importing bpy is slow)

bpy.ops.wm.read_factory_settings(use_empty=True)
sys.argv = [script, *rest]
try:
    runpy.run_path(script, run_name="__main__")
except SystemExit as e:
    code = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
except Exception:
    traceback.print_exc()
    code = 1
else:
    code = 0
# Out through `_exit`: the module's own teardown at interpreter exit can
# take the process down with a signal, which the driver would read as a
# failed pass after a build that finished.
sys.stdout.flush()
sys.stderr.flush()
os._exit(code)

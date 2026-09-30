# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# A PAIR OF SKIS MODELLED IN BLENDER off the game's own data: the spec
# (engine/game/defs/skis.ts) and its class's traced look
# (pwa/src/game/ski-looks.ts), with each ski's stations sampled off the very
# profile, plan and thickness the code lofts (`skiGeometry`), handed in as
# one JSON file by `scripts/blender.mjs --kind=skis` — the driver, and the
# only way this runs.
#
# The frame is the TRACE's: Blender x to the right, y along the ski from
# its TAIL (the trace's z), z up from the snow (the trace's y). glTF turns
# that to y up and forward on -z; the skis lab's asset sheet turns it back
# and sets it on the spec with `lookFrame`, as the builder sets a trace
# (`skier-models.ts` does the same in the game).
#
# THE RIG (lib.py's): the DRIVERS are what the game poses off the engine's
# readings as it poses its own pair (`ski-gear.ts`, `ski-rig.ts`) —
# `ski_l` / `ski_r`, each ski with its binding and boot riding its bone at
# the boot's centre, lifted by its leg's compression and the tuck's drop,
# turned about the up axis by the skid and about its own length by the
# edge. `_l` is the skier's left in THIS frame (x negative). The clips run
# the game's own drawn travel and edge tilt (handed in as `gear`).
#
# A SKI IS A BEAM WITH A SIDECUT: the top is the topsheet (`paint`, with a
# white tip panel the game dresses in the trim), the sidewalls over the
# steel edges are dark (`panel`), the base is the sintered black sheet it
# runs on (`base`). The binding's toe and heel pieces and a race plate are
# the sidewalls' dark; the boot's shell is `boot`. The game dresses every
# one by name (`dressOf` in `skier-models.ts`).

import json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
SPEC, LOOK, STATIONS, GEAR = DATA["spec"], DATA["look"], DATA["stations"], DATA["gear"]
BOOT_Y = DATA["boot"]
LENGTH = SPEC["length"]
STANCE = SPEC["stance"]

# ---------------------------------------------------------------- materials
PAINT = mat("paint", (0.62, 0.02, 0.015), rough=0.28, coat=1.0)
WHITE = mat("white", (0.85, 0.86, 0.88), rough=0.3, coat=1.0)
PANEL = mat("panel", (0.018, 0.018, 0.02), rough=0.55, coat=0.2)
BASE = mat("base", (0.008, 0.008, 0.01), rough=0.4, metal=0.2)
BOOT = mat("boot", (0.012, 0.012, 0.014), rough=0.5, coat=0.3)
ALU = mat("aluminium", (0.82, 0.82, 0.84), metal=1.0, rough=0.28)


def h_at(y):
    """The base's height over the snow at `y` m from the tail."""
    for a, b in zip(STATIONS, STATIONS[1:]):
        if a["s"] <= y <= b["s"]:
            k = (y - a["s"]) / max(1e-6, b["s"] - a["s"])
            return a["h"] + (b["h"] - a["h"]) * k, a["t"] + (b["t"] - a["t"]) * k
    last = STATIONS[-1] if y > STATIONS[-1]["s"] else STATIONS[0]
    return last["h"], last["t"]


def face_material(c):
    """Which of the loft's materials a face at centre `c` takes: the top
    (paint), the sidewalls (panel) or the base."""
    h, t = h_at(c.y)
    if c.z > h + 0.6 * t:
        return 0
    if c.z < h + 0.12 * t:
        return 2
    return 1


# ---------------------------------------------------------------- the SKIS
def ski(side):
    """One ski with its binding and boot, riding its own bone at the boot."""
    x0 = side * STANCE / 2
    name = "ski_l" if side < 0 else "ski_r"
    rides(bone(name, (x0, BOOT_Y, 0.0), (x0, BOOT_Y + 0.3, 0.0)))
    # The ski itself, lofted station by station: base left, base right,
    # edge right, top right, top left, edge left — the code's own ring.
    rings = []
    for st in STATIONS:
        w, h, t, s = st["w"], st["h"], st["t"], st["s"]
        rings.append([
            Vector((x0 - w, s, h)),
            Vector((x0 + w, s, h)),
            Vector((x0 + w, s, h + t * 0.35)),
            Vector((x0 + w * 0.92, s, h + t)),
            Vector((x0 - w * 0.92, s, h + t)),
            Vector((x0 - w, s, h + t * 0.35)),
        ])
    loft("ski", rings, [PAINT, PANEL, BASE], face_mat=face_material)
    # The tip's white panel: a patch laid a hair over the topsheet over the
    # last hand of the ski, which the game dresses in the trim.
    patch = []
    for st in STATIONS:
        if st["s"] < LENGTH * 0.84 or st["s"] > LENGTH * 0.94:
            continue
        w, h, t, s = st["w"] * 0.7, st["h"], st["t"], st["s"]
        patch.append([Vector((x0 - w, s, h + t + 0.0015)), Vector((x0 + w, s, h + t + 0.0015))])
    if len(patch) >= 2:
        loft("tip_panel", patch, [WHITE], closed=False, cap=False)
    # THE BINDING: the toe and the heel piece (a race ski's on a plate), the
    # heel's lever, the brake arms either side of the ski.
    B = LOOK["binding"]
    H = B["height"]
    top = h_at(BOOT_Y)[0] + LOOK["thick"]["boot"]
    waist = SPEC["waist"]
    if B["plate"]:
        box("plate", (x0, BOOT_Y, top + H * 0.28), (waist * 0.9, B["length"] + 0.06, H * 0.55), PANEL)
    box("toe", (x0, BOOT_Y + B["length"] / 2 - 0.045, top + H / 2), (waist * 0.95, 0.09, H), PANEL)
    box("heel", (x0, BOOT_Y - B["length"] / 2 + 0.05, top + H * 0.65), (waist * 0.95, 0.1, H * 1.3), PANEL)
    box("lever", (x0, BOOT_Y - B["length"] / 2 - 0.01, top + H * 1.3), (waist * 0.8, 0.05, 0.02), ALU)
    for s in (-1, 1):
        box("brake", (x0 + s * waist / 2, BOOT_Y, top + 0.012), (0.008, 0.16, 0.012), ALU, bevel=0)
    # THE BOOT, clamped toe and heel: the shell over the sole, its cuff
    # tipped forward as a ski boot's is, the buckles across the front.
    sole = top + H
    BT = LOOK["boot"]
    box("shell", (x0, BOOT_Y + 0.01, sole + 0.045), (0.1, BT["length"], 0.09), BOOT, bevel=0.008)
    box("toe_box", (x0, BOOT_Y + BT["length"] / 2 + 0.02, sole + 0.03), (0.08, 0.05, 0.06), BOOT, bevel=0.008)
    cuff_h = BT["height"] - 0.07
    c0 = Vector((x0, BOOT_Y - 0.01, sole + 0.07))
    c1 = c0 + Vector((0, math.sin(0.22) * cuff_h, math.cos(0.22) * cuff_h))
    cyl("cuff", c0, c1, 0.066, BOOT, r2=0.058)
    for k in range(3):
        box("buckle", (x0, BOOT_Y + 0.05 - k * 0.012, sole + 0.05 + k * 0.06), (0.06, 0.02, 0.012), ALU, bevel=0)


for side in (-1, 1):
    ski(side)

# ---------------------------------------------------------------- the CLIPS
# The game's own drawn travel and edge tilt, played: each leg folded and
# stretched through the travel, both skis tipped onto an edge and back.
lo, hi = GEAR["travel"]
tilt = GEAR["edgeTilt"]


def bump(t):
    k = 0.5 - 0.5 * math.cos(2 * math.pi * t / 2.0)
    return {"ski_l": {"lift": lo + (hi - lo) * k}, "ski_r": {"lift": lo + (hi - lo) * (1 - k)}}


def edge(t):
    return {"ski_l": {"turn": -tilt * math.sin(2 * math.pi * t / 3.0)},
            "ski_r": {"turn": -tilt * math.sin(2 * math.pi * t / 3.0)}}


clip("bump", 2.0, bump)
clip("edge", 3.0, edge)

# ---------------------------------------------------------------- the STUDIO
finish(os.path.basename(argv[0]).removesuffix(".json"), OUT, SAMPLES,
       centre=(0, LENGTH / 2, 0.25), size=LENGTH * 1.3, floor=0.0, extras={"frame": "trace"})

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
# A SKI IS A BEAM WITH A SIDECUT: the top is the topsheet (`paint`) with
# the pair's own GRAPHIC laid on it (`white`, which the game dresses in the
# trim: the decals `ski-topsheets.ts` states in the topsheet's (u, v), cut
# exactly as `ski-gear.ts`' `decalGeometry` lays them on the code's pair,
# and a race pair's number panel in the base's black), the sidewalls over
# the steel edges are dark (`panel`), the base is the sintered black sheet
# it runs on (`base`). The binding's toe and heel pieces and a race plate are
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
PATTERN = DATA["pattern"]
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


def w_at(y):
    """The ski's half width at `y` m from the tail."""
    for a, b in zip(STATIONS, STATIONS[1:]):
        if a["s"] <= y <= b["s"]:
            k = (y - a["s"]) / max(1e-6, b["s"] - a["s"])
            return a["w"] + (b["w"] - a["w"]) * k
    return (STATIONS[-1] if y > STATIONS[-1]["s"] else STATIONS[0])["w"]


def decal(name, x0, outline, m):
    """ONE DECAL of the graphic, a hair over the top face: the outline's
    (u, v) points on the ski's real top, every edge split in four so it
    follows the shovel's curve, fanned from its middle — the code pair's
    own `decalGeometry`, point for point."""
    def at(u, v):
        s = u * LENGTH
        h, t = h_at(s)
        return Vector((x0 + v * w_at(s) * 0.9, s, h + t + 0.0015))
    ring = []
    for i, (u0, v0) in enumerate(outline):
        u1, v1 = outline[(i + 1) % len(outline)]
        for k in range(4):
            f = k / 4
            ring.append(at(u0 + (u1 - u0) * f, v0 + (v1 - v0) * f))
    cu = sum(p[0] for p in outline) / len(outline)
    cv = sum(p[1] for p in outline) / len(outline)
    verts = [at(cu, cv)] + ring
    n = len(ring)
    faces = [[0, 1 + i, 1 + (i + 1) % n] for i in range(n)]
    # Faced up, whichever way round the outline is wound (an open fan has
    # no inside for the normals' recalculation to find).
    up = (ring[0] - verts[0]).cross(ring[1] - verts[0]).z
    if up < 0:
        faces = [f[::-1] for f in faces]
    return mesh_obj(name, verts, faces, [m], None, False, recalc=False)


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
    # THE GRAPHIC: the pattern's decals in the trim — and the topsheet
    # forward of a two-tone SPLIT as one more — and a race pair's number
    # panel near the tip in the base's black.
    decals = list(PATTERN["top"])
    if PATTERN.get("split"):
        sp = PATTERN["split"]
        decals.insert(0, [[sp, -0.98], [sp, 0.98], [0.995, 0.98], [0.995, -0.98]])
    for k, d in enumerate(decals):
        decal(f"decal{k}", x0, d, WHITE)
    if PATTERN.get("plates"):
        decal("plate_panel", x0, [[0.86, -0.7], [0.86, 0.7], [0.93, 0.7], [0.93, -0.7]], BASE)
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
    # THE BOOT, clamped toe and heel, shaped as a ski boot is: a LOWER
    # SHELL lofted heel to toe round the foot (tall over the heel and the
    # instep, falling to a low, rounded toe box over the binding's toe
    # piece, a little wider over the ball of the foot), the CUFF up the shin
    # tipped forward 0.22 rad with the tongue proud at its front and a
    # power strap round its top, and four buckles down its outside — the
    # silhouette the chase camera sees between the skier's pants and his
    # skis.
    sole = top + H
    BT = LOOK["boot"]
    L = BT["length"]
    shell = []
    for k in range(9):
        f = k / 8
        y = BOOT_Y - L / 2 + 0.01 + f * L
        # Height over the sole and half width, heel to toe.
        hgt = 0.13 - 0.07 * max(0.0, (f - 0.45) / 0.55) ** 1.4
        hw = 0.047 + 0.006 * math.sin(math.pi * min(1.0, f / 0.8)) - 0.012 * max(0.0, f - 0.85) / 0.15
        ring = []
        for (u, v) in superellipse(0, 0, hw, hgt / 2, 2.6, 12):
            ring.append(Vector((x0 + u, y, sole + hgt / 2 + v)))
        shell.append(ring)
    loft("shell", shell, [BOOT])
    cuff_h = BT["height"] - 0.06
    tilt = 0.22
    up = Vector((0, math.sin(tilt), math.cos(tilt)))
    c0 = Vector((x0, BOOT_Y - 0.02, sole + 0.06))
    cuff = []
    for k in range(6):
        f = k / 5
        c = c0 + up * (f * cuff_h)
        hw = 0.06 - 0.006 * f + (0.004 if k == 5 else 0)
        hd = 0.066 - 0.004 * f + (0.004 if k == 5 else 0)
        ring = []
        for (u, v) in superellipse(0, 0, hw, hd, 2.4, 12):
            # The tongue: the front of the cuff carried a little forward.
            tongue = 0.008 * max(0.0, v / hd) ** 3
            p = Vector((u, v + tongue, 0))
            # Laid square to the shin's tilted axis.
            ring.append(c + Vector((p.x, p.y * math.cos(tilt), -p.y * math.sin(tilt))))
        cuff.append(ring)
    loft("cuff", cuff, [BOOT])
    strap = c0 + up * (cuff_h - 0.02)
    box("strap", (strap.x, strap.y, strap.z), (0.128, 0.142, 0.03), PANEL, rot=(-tilt, 0, 0), bevel=0.004)
    out = 1 if x0 > 0 else -1
    for k, (f, d) in enumerate([(0.35, 0.05), (0.62, 0.035), (0.2, None), (0.62, None)]):
        if d is None:
            # Down the cuff's outside.
            p = c0 + up * (f * cuff_h) + Vector((out * 0.058, 0.02, 0))
            box("buckle", (p.x, p.y, p.z), (0.012, 0.045, 0.014), ALU, rot=(-tilt, 0, 0), bevel=0)
        else:
            # Over the instep.
            y = BOOT_Y - L / 2 + f * L
            box("buckle", (x0 + out * 0.03, y, sole + 0.12 - d), (0.03, 0.012, 0.014), ALU, rot=(0.6, 0, 0), bevel=0)


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

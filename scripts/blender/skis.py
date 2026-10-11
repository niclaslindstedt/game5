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
# the sidewalls' dark; the boot's shell is `boot`, its rubber and liner
# `boot_dark`, its accent `boot_accent` and its metal `buckle`. The game dresses every
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
BOOT = mat("boot", (0.012, 0.012, 0.014), rough=0.32, coat=0.8)
ALU = mat("aluminium", (0.82, 0.82, 0.84), metal=1.0, rough=0.28)
# The boot's own metal, apart from the binding's: a binding lets the boot
# out and the boot's buckles go with it, the brake and the lever stay.
BUCKLE = mat("buckle", (0.82, 0.82, 0.84), metal=1.0, rough=0.28)
# The boot's soft and rubber parts — the sole and its lugs, the tongue, the
# liner over the cuff, the power strap and the buckles' ladders — in a
# matt charcoal the gloss shell stands out of; and its ACCENT (the spine,
# the strap's stripe, the heel's badge), which the game dresses in the
# pair's other colour.
BOOT_DARK = mat("boot_dark", (0.03, 0.031, 0.035), rough=0.75)
BOOT_ACCENT = mat("boot_accent", (0.62, 0.02, 0.015), rough=0.35, coat=0.6)


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


# ---------------------------------------------------------------- the BOOTS
def plate(name, c, t, u, n, size, m):
    """A flat box at `c` laid on the basis t (its length), u (its width)
    and n (its thickness, out of the surface it lies on)."""
    t, u, n = t.normalized(), u.normalized(), n.normalized()
    a, b, d = size[0] / 2, size[1] / 2, size[2] / 2
    verts = [c + t * (i * a) + u * (j * b) + n * (k * d)
             for i in (-1, 1) for j in (-1, 1) for k in (-1, 1)]
    faces = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]
    return mesh_obj(name, verts, faces, [m], None, False)


def boot(x0, sole):
    """THE BOOT, clamped toe and heel, shaped as an alpine boot is: a SOLE of
    rubber with its flat TOE and HEEL LUGS where the binding takes it; the
    LOWER SHELL lofted heel to toe round the foot — tall over the heel and
    the instep, falling to a low rounded toe box, widest over the ball of
    the foot — glossy in the shell's colour over a dark rubber band round
    its foot; the CUFF up the shin, tipped forward 0.24 rad, overlapping
    the shell over a riveted PIVOT at the ankle, its back raised in a
    SPOILER with the accent's SPINE down it, the dark TONGUE down its front
    and the LINER standing out of its top; the POWER STRAP round the top
    with its stripe; and FOUR BUCKLES down the outside — two over the
    instep, two on the cuff — each a metal lever with its ladder across
    the front. From behind, at the chase camera, the boot is its heel, its
    spine and its strap between the pants and the ski."""
    BT = LOOK["boot"]
    L = BT["length"]
    out = 1 if x0 > 0 else -1
    y0 = BOOT_Y - L / 2
    M = 16
    # THE SOLE and its lugs.
    box("boot_sole", (x0, BOOT_Y, sole + 0.011), (0.088, L - 0.03, 0.022), BOOT_DARK, bevel=0.005)
    box("boot_toe_lug", (x0, y0 + L - 0.022, sole + 0.008), (0.066, 0.05, 0.016), BOOT_DARK, bevel=0.003)
    box("boot_heel_lug", (x0, y0 + 0.022, sole + 0.008), (0.07, 0.05, 0.016), BOOT_DARK, bevel=0.003)

    # THE LOWER SHELL: height over the sole and half width, heel to toe.
    def height(f):
        if f < 0.4:
            return 0.16
        return 0.16 - 0.118 * ((f - 0.4) / 0.6) ** 1.25

    def half(f):
        return 0.043 + 0.008 * math.sin(math.pi * min(1.0, f / 0.85)) - 0.016 * max(0.0, f - 0.86) / 0.14

    shell = []
    fs = [0.0, 0.025, 0.07, 0.16, 0.28, 0.4, 0.5, 0.6, 0.7, 0.78, 0.86, 0.92, 0.965, 0.99]
    for f in fs:
        y = y0 + 0.012 + f * (L - 0.02)
        # The heel and the toe rounded in: the first and last rings smaller.
        k = 0.72 + 0.28 * min(1.0, f / 0.07, (1.0 - f) / 0.06 + 0.15)
        hgt = height(f) * (0.9 + 0.1 * k)
        hw = half(f) * k
        ring = []
        for (u, v) in superellipse(0, 0, hw, hgt / 2, 2.9, M, taper_top=0.22):
            ring.append(Vector((x0 + u, y, sole + 0.014 + hgt / 2 + v)))
        shell.append(ring)

    def shell_mat(c):
        # The rubber band round the foot, and the overlap's dark FLANGE over
        # the instep's middle — what the buckles close.
        if c.z < sole + 0.034:
            return 1
        f = (c.y - y0) / L
        if 0.42 < f < 0.8 and abs(c.x - x0) < 0.006 and c.z > sole + 0.06:
            return 1
        return 0

    loft("boot_shell", shell, [BOOT, BOOT_DARK], face_mat=shell_mat)

    # THE CUFF up the shin, tipped forward, from its pivot at the ankle.
    tilt = 0.24
    up = Vector((0, math.sin(tilt), math.cos(tilt)))
    fwd = Vector((0, math.cos(tilt), -math.sin(tilt)))
    side = Vector((1, 0, 0))
    ankle = Vector((x0, y0 + 0.11, sole + 0.1))
    c0 = ankle + up * -0.045
    cuff_h = BT["height"] - 0.06
    rings = []
    hs = [0.0, 0.03, 0.08, 0.13, 0.18, cuff_h - 0.02, cuff_h]
    for h in hs:
        f = h / cuff_h
        hw = 0.06 - 0.007 * f + (0.004 if h >= cuff_h - 0.001 else 0)
        hd = 0.068 - 0.006 * f + (0.004 if h >= cuff_h - 0.001 else 0)
        c = c0 + up * h
        ring = []
        for (u, v) in superellipse(0, 0, hw, hd, 2.5, M):
            # The SPOILER: the back raised as it climbs; the front's tongue a
            # little proud.
            back = 0.012 * f * max(0.0, -v / hd) ** 2
            tongue = 0.006 * max(0.0, v / hd) ** 4
            ring.append(c + side * u + fwd * (v - back + tongue))
        rings.append(ring)

    def cuff_mat(c):
        local = c - c0
        v = local.dot(fwd)
        u = local.dot(side)
        if v > 0.05 and abs(u) < 0.022:
            return 1  # the tongue down the front
        if v < -0.05 and abs(u) < 0.012:
            return 2  # the spine
        return 0

    loft("boot_cuff", rings, [BOOT, BOOT_DARK, BOOT_ACCENT], face_mat=cuff_mat, cap=False)
    # THE LINER out of the top, and the cuff's mouth closed under it.
    top = c0 + up * cuff_h
    liner = []
    for k, (h, w) in enumerate(((-0.012, 0.0), (0.014, 0.0), (0.016, -0.012))):
        c = top + up * h
        ring = []
        for (u, v) in superellipse(0, 0, 0.056 + w, 0.062 + w, 2.4, M):
            ring.append(c + side * u + fwd * v)
        liner.append(ring)
    loft("boot_liner", liner, [BOOT_DARK])
    # THE POWER STRAP round the top: dark, its middle the accent's stripe.
    strap = []
    for h, grow in ((cuff_h - 0.048, 0.0), (cuff_h - 0.044, 0.004), (cuff_h - 0.033, 0.004),
                    (cuff_h - 0.027, 0.004), (cuff_h - 0.016, 0.004), (cuff_h - 0.012, 0.0)):
        c = c0 + up * h
        f = h / cuff_h
        hw = 0.06 - 0.007 * f + grow
        hd = 0.068 - 0.006 * f + grow
        ring = []
        for (u, v) in superellipse(0, 0, hw, hd, 2.5, M):
            back = 0.012 * f * max(0.0, -v / hd) ** 2
            ring.append(c + side * u + fwd * (v - back))
        strap.append(ring)
    loft("boot_strap", strap, [BOOT_DARK, BOOT_ACCENT], cap=False,
         face_mat=lambda c: 1 if abs((c - c0).dot(up) - (cuff_h - 0.03)) < 0.004 else 0)
    # THE PIVOT riveted through the cuff at the ankle, both sides.
    for s in (-1, 1):
        p = ankle + side * (s * 0.064)
        cyl("boot_rivet", p - side * (s * 0.004), p + side * (s * 0.004), 0.011, BUCKLE, seg=18)
    # THE BUCKLES: a lever on the outside, its ladder across the front.
    def buckle(c, n, along, i):
        t = along.cross(n)
        plate(f"buckle{i}", c + n * 0.006, t, along, n, (0.042, 0.016, 0.007), BUCKLE)
        plate(f"buckle{i}_hinge", c - t * 0.018 + n * 0.004, t, along, n, (0.01, 0.02, 0.01), BOOT_DARK)
    # Two over the instep, on the shell's upper outside corner.
    for i, f in enumerate((0.47, 0.64)):
        y = y0 + 0.012 + f * (L - 0.02)
        hgt = height(f)
        a = 0.85
        n = Vector((out * math.sin(a), 0, math.cos(a)))
        c = Vector((x0 + out * half(f) * 0.86, y, sole + 0.014 + hgt * 0.5 + hgt * 0.5 * 0.82))
        buckle(c, n, Vector((0, 1, 0)), i)
        # The ladder on the other side of the flange.
        lc = Vector((x0 - out * half(f) * 0.42, y, sole + 0.014 + hgt * 0.98))
        plate(f"ladder{i}", lc, Vector((-out, 0, 0.35)), Vector((0, 1, 0)), Vector((out * 0.35, 0, 1)),
              (0.03, 0.012, 0.005), BOOT_DARK)
    # Two on the cuff, round its front outer corner.
    for i, h in enumerate((0.085, 0.145)):
        a = 0.78
        f = h / cuff_h
        n = side * (out * math.sin(a)) + fwd * math.cos(a)
        c = c0 + up * h + side * (out * (0.06 - 0.007 * f) * 0.86) + fwd * ((0.068 - 0.006 * f) * 0.72)
        buckle(c, n, up, i + 2)
        lc = c0 + up * h + side * (-out * 0.03) + fwd * (0.068 - 0.006 * f + 0.004)
        plate(f"ladder{i + 2}", lc, side, up, fwd, (0.032, 0.012, 0.005), BOOT_DARK)
    # The heel's badge in the accent.
    plate("boot_badge", Vector((x0, y0 + 0.004, sole + 0.07)), side, Vector((0, 0, 1)),
          Vector((0, -1, 0)), (0.03, 0.022, 0.006), BOOT_ACCENT)


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
    boot(x0, top + H)


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

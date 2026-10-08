# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE AIR AMBULANCE MODELLED IN BLENDER: the heli-ski machine's airframe,
# rotors and nodes (`heli.py`'s builder, run whole off the same `HELI`) dressed
# and equipped as a mountain rescue helicopter — `scripts/blender.mjs
# --kind=rescue` is the driver, and the only way this runs. What makes it
# read as one, after the research in `docs/helicopter.md` ("The air
# ambulance"):
#
# * THE LIVERY: the whole machine in signal yellow (`trim` the skin's
#   ground, `paint` the cowling, the fins and the blade tips), a dark
#   anthracite band (`band`) low along the cabin sweeping up onto the
#   boom, the belly under it yellow, with a red pinstripe over it (`stripe`), and on each side of the
#   cabin's back a white disc (`mark_white`) carrying the six-armed blue
#   star of the medical services (`emblem`) — never a red cross.
# * THE RESCUE HOIST over the right-hand sliding door (the door the
#   stretcher and the crew go through): a post out of the roof's edge, an
#   arm out over the door, the hoist's drum on its end, the hook hung under
#   it, a status lamp (`lamp_green`) on the drum.
# * THE SEARCHLIGHT under the nose: a housing on a gimbal stub, its lens
#   (`searchlight`, glossy and NOT emissive, so the drawer lights it only
#   when it is on) looking ahead and down.
# * THE WIRE-STRIKE CUTTERS: an upper cutter on the roof ahead of the
#   cowling, a lower one under the chin, and the deflector strip up the
#   windscreen's centre post.
# * No ski basket on the left skid.
#
# THE FRAME, THE NODES AND THEIR ORIGINS are `heli.py`'s exactly — the root
# `heli` at the skid datum, `heli_body`, `heli_rotor`, `heli_tail_rotor` —
# so one drawer (`HELI_NODES`) poses either model. THE MATERIALS are the
# heli's by name (`trim`, `paint`, `stripe`, `glass`, `metal`, `dark`,
# `rotor`, `lamp`, `lamp_green`) plus `band`, `mark_white`, `emblem` and
# `searchlight`.

import math, os, sys, types

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib import box, cyl, ellipsoid, mat

# `heli.py` runs as a builder from top to bottom; its last block (from the
# studio on) makes the stills and the cuts. Everything above that block is
# run here as a module, the dressing below is laid over its names, and then
# the block itself runs — so the heli's builder is shared whole and moves no
# byte of `heli.glb`.
_PATH = os.path.join(HERE, "heli.py")
_SRC = open(_PATH).read()
_RUN = _SRC.index("\nlib._studio(")
H = types.ModuleType("heli")
H.__file__ = _PATH
exec(compile(_SRC[:_RUN], _PATH, "exec"), H.__dict__)
from mathutils import Vector

# ---------------------------------------------------------------- the livery
YELLOW = (0.95, 0.56, 0.002)


def recolour(m, rgb, coat=None):
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    if coat is not None:
        bsdf.inputs["Coat Weight"].default_value = coat


# A thinner clear coat than the heli's white: a full one washes the yellow
# out to cream under a bright sky.
recolour(H.TRIM, YELLOW, coat=0.12)
recolour(H.PAINT, YELLOW, coat=0.12)
recolour(H.STRIPE, (0.62, 0.018, 0.016))
BAND = mat("band", (0.03, 0.032, 0.037), rough=0.42, coat=0.35)
WHITE = mat("mark_white", (0.80, 0.81, 0.82), rough=0.42, coat=0.35)
EMBLEM = mat("emblem", (0.0, 0.09, 0.42), rough=0.42, coat=0.35)
LENS = mat("searchlight", (0.75, 0.78, 0.8), rough=0.05)
for _m in (BAND, WHITE, EMBLEM):
    _m.node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.12
LENS.node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.03
# The skin's slots past the heli's five: the band, the disc, the star.
S_BAND, S_WHITE, S_STAR = len(H.SKIN_MATS), len(H.SKIN_MATS) + 1, len(H.SKIN_MATS) + 2
H.SKIN_MATS += [BAND, WHITE, EMBLEM]

# The emblem on each side of the cabin's back, between the sliding door's
# trailing edge and the engine bay's hatch: metres behind the nose, height,
# the disc's radius.
# The band's depth under the livery's sweep, m.
BAND_H = 0.2
STAR_D, STAR_Z, STAR_R = 3.47, H.ht(0.6), 0.36
_heli_regions = H.regions


def star_of_life(u, v, r):
    """Inside-positive field of the six-armed star: three bars of width
    0.52 r and length 2 r, turned 60 degrees apart, their ends square."""
    w, best = 0.26 * r, None
    for k in range(3):
        a = math.pi / 2 + k * math.pi / 3
        along = u * math.cos(a) + v * math.sin(a)
        across = -u * math.sin(a) + v * math.cos(a)
        f = np.minimum(w - np.abs(across), r - np.abs(along))
        best = f if best is None else np.maximum(best, f)
    return best


def regions(X, Y, Z, seams, accent, full):
    """The heli's outlines with its livery's belly paint narrowed to an
    anthracite band under its sweep (the belly left yellow), and the white
    disc and blue star on both sides of the cabin's back."""
    D = H.NOSE - Y
    band = np.minimum(H.SWEEP(D) - Z, Z - (H.SWEEP(D) - BAND_H))
    out = [(S_BAND, p, band) if s == 1 else (s, p, f)
           for s, p, f in _heli_regions(X, Y, Z, seams, accent, full)]
    for sx in (1, -1):
        xs = sx * X
        side = xs - 0.3
        # seen from that side, the star is not mirrored: u runs aft on the
        # right and forward on the left, as a decal does
        u, v = sx * (STAR_D - D), Z - STAR_Z
        disc = STAR_R - np.hypot(u, v)
        out.append((S_WHITE, 3.7, np.minimum(disc, side)))
        out.append((S_STAR, 3.8, np.minimum(star_of_life(u, v, STAR_R * 0.82), side)))
    return out


H.regions = regions

# ---------------------------------------------------------------- the equipment
_heli_details = H.details


def belly(y):
    """The skin's lowest point at station `y`."""
    zc, _, hb, *_ = (float(np.asarray(t)) for t in H.section(y))
    return zc - hb


def hoist(Q):
    """The rescue hoist over the right-hand sliding door: a post out of the
    roof's edge, an arm out over the door, the drum on its end with the
    hook hung under it on a short cable."""
    sx = 1
    y = H.aft(2.4)
    z0 = H.ROOF - 0.12
    x0 = H.side_x(y, z0, sx) - 0.04
    top = z0 + 0.36
    reach = H.HALF + 0.72
    cyl("hoist_post", (x0, y, z0 - 0.05), (x0, y, top), 0.045, H.METAL, seg=12)
    cyl("hoist_brace", (x0, y, z0 - 0.02), (x0 + 0.45, y, top - 0.03), 0.025, H.METAL, seg=8)
    cyl("hoist_arm", (x0 - 0.05, y, top), (reach, y, top), 0.05, H.METAL, seg=12)
    box("hoist_root", (x0, y, top), (0.14, 0.16, 0.14), H.DARK, bevel=0)
    # the drum lies fore and aft under the arm's end
    cyl("hoist_drum", (reach, y + 0.36, top - 0.1), (reach, y - 0.36, top - 0.1), 0.16, H.DARK, seg=16)
    for e in (1, -1):
        cyl("hoist_cap", (reach, y + e * 0.4, top - 0.1), (reach, y + e * 0.36, top - 0.1), 0.13, H.METAL, seg=16)
    ellipsoid("hoist_lamp", (reach, y - 0.41, top - 0.02), (0.035, 0.03, 0.035), H.LAMP_G)
    hook_z = top - 0.62
    cyl("hoist_cable", (reach, y, top - 0.25), (reach, y, hook_z + 0.08), 0.008, H.DARK, seg=6)
    box("hoist_block", (reach, y, hook_z + 0.06), (0.07, 0.05, 0.1), H.PAINT, bevel=0)
    cyl("hoist_hook", (reach, y, hook_z), (reach, y, hook_z - 0.08), 0.02, H.METAL, r2=0.012, seg=8)


def searchlight(Q):
    """The searchlight under the nose, left of the landing lights: a stub
    down out of the belly, the gimbal's yoke, the housing looking ahead and
    down, its lens."""
    x, y = -0.38, H.aft(1.15)
    zb = belly(y)
    pivot = Vector((x, y, zb - 0.16))
    cyl("sl_stub", (x, y, zb + 0.02), pivot, 0.05, H.DARK, seg=12)
    box("sl_yoke", pivot, (0.3, 0.08, 0.04), H.DARK, bevel=0)
    look = Vector((0, math.cos(0.35), -math.sin(0.35)))
    back, front = pivot - look * 0.17, pivot + look * 0.14
    cyl("sl_housing", back, front, 0.13, H.DARK, r2=0.145, seg=20)
    cyl("sl_lens", front, front + look * 0.012, 0.125, LENS, seg=20)


def cutters(Q):
    """The wire-strike protection: an upper cutter on the roof ahead of the
    cowling, a lower one under the chin (each a blade raked forward, its
    jaws at the tip) and the deflector strip up the windscreen's centre
    post between them."""
    yu = H.aft(1.85)
    zu = H.top_z(yu, 0.0)
    H.wing("cutter_up", (0, yu + 0.16, zu - 0.02), (0, yu - 0.12, zu - 0.02), (0, yu + 0.3, zu + 0.42),
           (0, yu + 0.2, zu + 0.42), (1, 0, 0), 0.14, Q, H.METAL)
    box("cutter_up_jaw", (0, yu + 0.26, zu + 0.36), (0.035, 0.08, 0.1), H.DARK, rot=(0.5, 0, 0), bevel=0)
    yl = H.aft(0.9)
    zl = belly(yl)
    H.wing("cutter_low", (0, yl + 0.15, zl + 0.02), (0, yl - 0.15, zl + 0.02), (0, yl + 0.3, zl - 0.36),
           (0, yl + 0.2, zl - 0.36), (1, 0, 0), 0.14, Q, H.METAL)
    pts = []
    for d in np.linspace(0.12, 1.25, 7 if Q["full"] else 4):
        y = H.aft(float(d))
        pts.append((0, y, H.top_z(y, 0.0) + 0.012))
    H.pipe("deflector", pts, 0.014, H.METAL, Q)


def details(Q):
    _heli_details(Q)
    hoist(Q)
    searchlight(Q)
    cutters(Q)


H.details = details
H.basket = lambda Q: None

exec(compile("\n" * _SRC.count("\n", 0, _RUN) + _SRC[_RUN:], _PATH, "exec"), H.__dict__)

# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE POLICE HELICOPTER MODELLED IN BLENDER: the heli-ski machine's
# airframe, rotors and nodes (`heli.py`'s builder, run whole off the same
# `HELI`, exactly as `rescue.py` runs it) dressed and equipped as a police
# air unit's machine — `scripts/blender.mjs --kind=police` is the driver,
# and the only way this runs. What makes it read as one, after the research
# in `docs/police.md` ("The machine"):
#
# * THE LIVERY: the skin dark navy (`trim`), the cowling, the fins and the
#   blade tips white (`paint`), a white cheat line (`stripe`) over a band
#   low along the cabin that sweeps up onto the boom, the band a CHEQUER of
#   blue (`band`) and fluorescent yellow (`chequer`) in two rows — the
#   high-visibility pattern police vehicles carry.
# * THE LETTERING: POLICE in white (`mark_white`) on each side of the
#   cabin's back, reading nose-ward from either side, and large along the
#   belly, reading from below — Blender's own built-in face, laid onto the
#   skin. The generic word only: no force's name, crest or registration.
# * THE CAMERA TURRET under the chin: a gyro-stabilised ball (`turret`) on
#   a short stub, its windows (`glass`) looking ahead and down.
# * THE SEARCHLIGHT low on the right of the cabin's back, under the rear
#   seat, so a left bank does not put the skid in its beam: its lens
#   (`searchlight`, glossy and NOT emissive, as the air ambulance's, so the
#   drawer lights it only when it is on).
# * THE BLUE BEACONS (`beacon_blue`, NOT emissive: the drawer lights and
#   flashes them): one on the belly behind the cabin and one on the boom's
#   top ahead of the fin.
# * THE LOUDSPEAKER on the belly, left of the centre line, behind the
#   cabin's floor.
# * The wire-strike cutters as the air ambulance's; no hoist, no ski basket.
#
# THE FRAME, THE NODES AND THEIR ORIGINS are `heli.py`'s exactly — the root
# `heli` at the skid datum, `heli_body`, `heli_rotor`, `heli_tail_rotor` —
# so one drawer (`HELI_NODES`) poses this, the heli and the air ambulance.
# THE MATERIALS are the heli's by name plus `band`, `chequer`,
# `mark_white`, `turret`, `searchlight` and `beacon_blue`.

import math, os, sys, types

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy
import lib
from lib import box, cyl, ellipsoid, link, mat

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
NAVY = (0.009, 0.017, 0.062)
WHITE_RGB = (0.80, 0.81, 0.82)


def recolour(m, rgb, coat=None):
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    if coat is not None:
        bsdf.inputs["Coat Weight"].default_value = coat


recolour(H.TRIM, NAVY)
recolour(H.PAINT, WHITE_RGB)
recolour(H.STRIPE, WHITE_RGB)
BAND = mat("band", (0.012, 0.05, 0.33), rough=0.42, coat=0.35)
CHEQUER = mat("chequer", (0.62, 0.86, 0.012), rough=0.42, coat=0.35)
WHITE = mat("mark_white", WHITE_RGB, rough=0.42, coat=0.35)
TURRET = mat("turret", (0.42, 0.43, 0.44), rough=0.45)
LENS = mat("searchlight", (0.75, 0.78, 0.8), rough=0.05)
BEACON = mat("beacon_blue", (0.02, 0.09, 0.85), rough=0.2)
for _m in (BAND, CHEQUER, WHITE):
    _m.node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.12
LENS.node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.03
for _m in (TURRET, BEACON):
    _m.node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.03
# The skin's slots past the heli's five: the band and its yellow cells.
S_BAND, S_CHQ = len(H.SKIN_MATS), len(H.SKIN_MATS) + 1
H.SKIN_MATS += [BAND, CHEQUER]

# THE BAND: its top this far over the heli's livery sweep (metres behind the
# nose → height), its depth, two rows of cells this long, each yellow cell
# inset by a hair so no two meet at a corner; the cheat line's width and its
# gap over the band. The chequer runs from behind the chin to where the
# boom grows too slim to carry two rows.
LIFT, BAND_H, ROWS, CELL = 0.12, 0.3, 2, 0.27
GAP = 0.006
CHEAT, CHEAT_GAP = 0.045, 0.035
CHQ_D0, CHQ_D1 = 0.75, 7.25
# The band ends short of the nose, square across, the chin left navy.
BAND_D0 = 0.62
_heli_regions = H.regions


def regions(X, Y, Z, seams, accent, full):
    """The heli's outlines with its livery's belly paint narrowed to the
    band under the raised sweep (the belly left navy), its pinstripe moved
    up to a white cheat line over it, and the band's yellow cells."""
    D = H.NOSE - Y
    top = H.SWEEP(D) + LIFT
    v = Z - (top - BAND_H)
    band = np.minimum.reduce([top - Z, v, D - BAND_D0])
    out = []
    for s, p, f in _heli_regions(X, Y, Z, seams, accent, full):
        if s == 1:
            out.append((S_BAND, p, band))
        elif s != 4:
            out.append((s, p, f))
    if accent:
        out.append((4, 3, CHEAT / 2 - np.abs(Z - (top + CHEAT_GAP + CHEAT / 2))))
        h = BAND_H / ROWS
        k = np.floor(D / CELL)
        r = np.clip(np.floor(v / h), 0, ROWS - 1)
        cell = np.minimum(CELL / 2 - GAP - np.abs(D - (k + 0.5) * CELL),
                          h / 2 - GAP - np.abs(v - (r + 0.5) * h))
        yellow = np.where(np.mod(k + r, 2) == 0, cell, -1.0)
        out.append((S_CHQ, 3.2, np.minimum.reduce([yellow, band, D - CHQ_D0, CHQ_D1 - D])))
    return out


H.regions = regions

# ---------------------------------------------------------------- the lettering
WORD = "POLICE"


def bottom_z(y, x):
    """The skin's underside under the point `x` off the centre line at
    station `y`."""
    zc, _, hb, w, _, nb = (float(np.asarray(t)) for t in H.section(y))
    r = min(abs(x) / max(w, 1e-6), 1.0)
    return zc - hb * (1 - r ** nb) ** (1 / nb)


def word(name, size, place, Q):
    """POLICE in Blender's built-in face, `size` m tall in caps, as a flat
    mesh in its own (u along the line, v up the letters) plane, every
    vertex then laid by `place(u, v)` onto the skin a few millimetres
    proud of it."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = WORD
    cu.size = size / 0.72
    cu.align_x, cu.align_y = "CENTER", "CENTER"
    cu.resolution_u = 2
    ob = link(bpy.data.objects.new(name, cu))
    lib._select_only([ob])
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.view_layer.objects.active
    me = ob.data
    for vt in me.vertices:
        vt.co = place(vt.co.x, vt.co.y)
    me.materials.clear()
    me.materials.append(WHITE)
    me.polygons.foreach_set("use_smooth", [False] * len(me.polygons))
    me.update()
    return ob


def lettering(Q):
    """POLICE on each side of the cabin's back, above the band and behind
    the rear door, reading towards the nose from either side; and large
    along the belly, reading from below with the right side at the top."""
    d_mid, z_mid, size = 3.62, 2.07, 0.27
    for sx in (1, -1):
        def side(u, v, sx=sx):
            y, z = H.aft(d_mid) + sx * u, z_mid + v
            return Vector((H.side_x(y, z, sx) + sx * 0.007, y, z))
        word("police_side", size, side, Q)

    d_mid, size = 2.45, 0.5

    def belly(u, v):
        y, x = H.aft(d_mid) + u, v
        return Vector((x, y, bottom_z(y, x) - 0.007))
    word("police_belly", size, belly, Q)


# ---------------------------------------------------------------- the equipment
_heli_details = H.details


def belly(y):
    """The skin's lowest point at station `y`."""
    zc, _, hb, *_ = (float(np.asarray(t)) for t in H.section(y))
    return zc - hb


def turret(Q):
    """The camera turret under the chin, right of the cutter: a stub down
    out of the belly, the yoke's collar, the ball, its two windows looking
    ahead and a little down."""
    x, y = 0.3, H.aft(0.78)
    zb = bottom_z(y, x)
    r = 0.16
    c = Vector((x, y, zb - 0.035 - r))
    cyl("flir_stub", (x, y, zb + 0.03), (x, y, c.z + r * 0.6), 0.07, H.DARK, seg=12)
    cyl("flir_collar", (x, y, c.z + r * 0.95), (x, y, c.z + r * 0.7), 0.13, TURRET, seg=16)
    ellipsoid("flir_ball", c, (r, r, r), TURRET)
    look = Vector((0, math.cos(0.2), -math.sin(0.2)))
    side = Vector((1, 0, 0))
    for e, rr in ((-0.062, 0.05), (0.058, 0.038)):
        at = c + look * (r - 0.012) + side * e
        cyl("flir_window", at, at + look * 0.022, rr, H.GLASS, seg=12)


def searchlight(Q):
    """The searchlight low on the right under the rear seat: a stub out of
    the belly's corner, the gimbal's yoke, the housing looking ahead and
    down, its lens."""
    y = H.aft(2.55)
    x = 0.55
    zb = bottom_z(y, x)
    pivot = Vector((x + 0.08, y, zb - 0.17))
    cyl("sl_stub", (x, y, zb + 0.03), (x + 0.08, y, zb - 0.1), 0.05, H.DARK, seg=12)
    box("sl_yoke", pivot, (0.3, 0.08, 0.04), H.DARK, bevel=0)
    look = Vector((0, math.cos(0.35), -math.sin(0.35)))
    back, front = pivot - look * 0.17, pivot + look * 0.14
    cyl("sl_housing", back, front, 0.13, H.DARK, r2=0.145, seg=20)
    cyl("sl_lens", front, front + look * 0.012, 0.125, LENS, seg=20)


def beacons(Q):
    """The blue beacons: a dome on the belly behind the cabin (ahead of the
    red one) and one on the boom's top ahead of the fin."""
    y = H.RA - 0.25
    ellipsoid("beacon_belly", (0, y, float(H.fB(y)) - 0.02), (0.06, 0.09, 0.045), BEACON)
    y = H.TAIL + 1.15
    ellipsoid("beacon_tail", (0, y, float(H.fT(y)) + 0.015), (0.045, 0.07, 0.045), BEACON)


def speaker(Q):
    """The loudspeaker on the belly, left of the centre line behind the
    floor: a flat box, its grille on the face looking down and out."""
    x, y = -0.38, H.aft(3.75)
    zb = bottom_z(y, x)
    box("speaker", (x, y, zb - 0.07), (0.34, 0.24, 0.12), H.DARK, bevel=0)
    box("speaker_grille", (x - 0.02, y, zb - 0.135), (0.28, 0.2, 0.012), H.METAL, bevel=0)


def cutters(Q):
    """The wire-strike protection as the air ambulance's: an upper cutter
    on the roof ahead of the cowling, a lower one under the chin, and the
    deflector strip up the windscreen's centre post between them."""
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
    lettering(Q)
    turret(Q)
    searchlight(Q)
    beacons(Q)
    speaker(Q)
    cutters(Q)


H.details = details
H.basket = lambda Q: None

exec(compile("\n" * _SRC.count("\n", 0, _RUN) + _SRC[_RUN:], _PATH, "exec"), H.__dict__)

# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE JUMP PLANE MODELLED IN BLENDER off the game's own data: `PLANE`
# (engine/game/defs/plane.ts) handed in whole by `scripts/blender.mjs
# --kind=plane` — the driver, and the only way this runs. The fuselage's
# stations, the cowling and its exhaust stacks, the wing's span, chord,
# root, dihedral, incidence and washout and its flap's and aileron's
# shares, the lift struts and the jury struts, the tailplane and its
# elevator, the fin and its rudder and the dorsal fillet, the propeller's
# hub, diameter, blades and spinner, the gear's legs, track, wheels and
# wheel-skis and the tail ski, the cabin's floor, the jump door's opening
# and where the jumper stands are all read off it; what is drawn between
# them is the class mountain drop zones and glacier operators fly — a
# single turboprop on a long slim nose, a strut-braced constant-chord high
# wing with square tips, a tall fin swept back off a long dorsal fillet, a
# low strut-braced tailplane, a tailwheel, and wheel-skis on a tall
# wide-track main gear — its proportions laid over the class's
# photographs and checked on orthographic stills (`oside`, `otop`,
# `ofront`, 64 px/m, the nose's ring 120 px from the left).
#
# THE FRAME is the ground datum's, as `PLANE` states it but turned to
# Blender's axes: Blender x to the plane's RIGHT (the jump door's side, the
# engine's −x — see THE FRAME in defs/plane.ts), y forward (the nose: the
# engine's z), z up (the engine's y), the origin on the snow under the
# middle of the two main skis with the fuselage held level. glTF turns it to
# y up with the nose on −z; the game turns it back with a half turn about y
# (`plane-view.ts`), which puts this model's right at the engine's −x, where
# `PLANE.door` is. Nothing is baked off that frame.
#
# RIGID NODES, no rig, each a mesh: `plane_body` (everything that does not
# move, origin the datum), `plane_prop` (the spinner and the three blades,
# origin the hub, turning about its own y — the nose's axis), and the
# hinged surfaces, each with its origin ON ITS HINGE and its own x along
# it, so A POSITIVE TURN ABOUT ITS OWN x LOWERS ITS TRAILING EDGE (the
# rudder's: swings it to the plane's right): `plane_elevator`,
# `plane_rudder`, `plane_aileron_l` / `_r`, `plane_flap_l` / `_r` (the
# sides the PLANE's own, a pilot's: `_r` on the door's side) and
# `plane_door` — the jump door, slid open aft along its rails, as a jump
# plane flies. Their parent `plane` is the datum.
#
# THE MATERIALS, by name: `trim` (the livery's white ground), `paint` (its
# colour: the nose ring, the cheatline, the fin and rudder, the wing and
# tail tips, the skis), `stripe` (its pinstripe), `glass` (dark, glossy,
# opaque), `metal`, `dark` (seams, the anti-glare panel, tyres, fittings),
# `prop` (the blades), `tip` (their tips), `cabin` (the cabin's lining, its
# floor and bench), `lamp` (red: the beacon and the left wingtip's
# navigation light), `lamp_green` (the right one) and `lamp_white` (the
# strobes, the tail light, the landing light), the three emissive.

import json, math, os, sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *
from mathutils import Matrix, Vector

import plane_skin as sk
import plane_studio as studio
from plane_skin import pchip, rint, sstep

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
NAME = os.path.basename(argv[0]).removesuffix(".json")
P = DATA["plane"]

W_, T_, F_, G_ = P["wing"], P["tail"], P["fin"], P["gear"]
DOOR, CABIN, PROP, STRUT = P["door"], P["cabin"], P["prop"], P["struts"]
NOSE = P["cowling"]["front"]                 # the cowling's front ring, m along y
FIREWALL = P["cowling"]["back"]
STATIONS = [s for s in P["fuselage"]["stations"] if s["z"] <= NOSE + 1e-9]
TAIL = STATIONS[-1]["z"]
DSIDE = 1 if -DOOR["x"] > 0 else -1          # the door's side in Blender x
SLIDE = DOOR["front"] - DOOR["back"] - 0.06  # how far the door is slid open aft
HUB = Vector((0, PROP["hub"]["z"], PROP["hub"]["y"]))
SEMI = W_["span"] / 2
CHORD = W_["chord"]
R0 = 0.7

# ---------------------------------------------------------------- materials
TRIM = mat("trim", (0.82, 0.83, 0.84), rough=0.4, coat=0.3)
PAINT = mat("paint", (0.55, 0.035, 0.03), rough=0.4, coat=0.3)
STRIPE = mat("stripe", (0.02, 0.04, 0.13), rough=0.4, coat=0.3)
GLASS = mat("glass", (0.04, 0.055, 0.07), rough=0.08)
METAL = mat("metal", (0.62, 0.63, 0.65), metal=0.8, rough=0.38)
EXHAUST = mat("exhaust", (0.16, 0.13, 0.11), metal=0.7, rough=0.55)
DARK = mat("dark", (0.022, 0.023, 0.026), rough=0.7)
PROP_M = mat("prop", (0.03, 0.03, 0.033), rough=0.5)
TIP = mat("tip", (0.85, 0.6, 0.02), rough=0.45)
CABIN_M = mat("cabin", (0.2, 0.21, 0.22), rough=0.85)
LAMP = mat("lamp", (0.8, 0.03, 0.02), rough=0.3, emit=(1.0, 0.05, 0.03), emit_str=6.0)
LAMP_G = mat("lamp_green", (0.03, 0.7, 0.15), rough=0.3, emit=(0.05, 1.0, 0.25), emit_str=6.0)
LAMP_W = mat("lamp_white", (0.85, 0.87, 0.9), rough=0.2, emit=(1.0, 0.97, 0.9), emit_str=6.0)
SKIN_MATS = [TRIM, PAINT, DARK, GLASS, STRIPE]   # the skin's slots, by index
for _m in (TRIM, PAINT, STRIPE):
    _m.node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.12
# A coat roughness on a material with no coat exports a clearcoat extension
# three.js pays a physical material for: put back to Blender's default.
for _m in (GLASS, METAL, EXHAUST, DARK, PROP_M, TIP, CABIN_M, LAMP, LAMP_G, LAMP_W):
    _m.node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.03

# How fine each cut is: the render's, the game's LOD0 and its LOD1.
DETAIL = {
    "render": dict(dy=0.03, sp=0.03, tol=0.0015, seg=0.04, seams=True, full=True, foil=16,
                   spans=4, ring=40, pipe=16, smooth=6, blade=12, liner=(48, 40)),
    "lod0": dict(dy=0.14, sp=0.13, tol=0.006, seg=0.16, seams=True, full=True, foil=8,
                 spans=1, ring=16, pipe=8, smooth=2, blade=6, liner=(24, 18)),
    "lod1": dict(dy=0.3, sp=0.28, tol=0.02, seg=0.35, seams=False, full=False, foil=5,
                 spans=1, ring=10, pipe=6, smooth=1, blade=4, liner=(10, 10)),
}

# ---------------------------------------------------------------- the fuselage's surface
fT = pchip([(s["z"], s["top"]) for s in STATIONS])
fB = pchip([(s["z"], s["bottom"]) for s in STATIONS])
fW = pchip([(s["z"], s["half"]) for s in STATIONS])
CAPF, CAPT = 0.2, 0.05


def section(y):
    """The section at station `y` (m forward of the datum): its middle
    line's height, the half heights above and below it, the half width,
    the superellipse's exponents above and below and the sides' lean in
    toward the roof — a round cowl and tailcone, a boxy cabin with a flat
    belly between them."""
    y = np.asarray(y, float)
    T, B, W = fT(y), fB(y), fW(y)
    cab = sstep(1.7, 1.0, y) * (1 - sstep(-2.2, -3.6, y))
    NT, NB = 2.3 + 1.2 * cab, 2.3 + 2.0 * cab
    lean = 0.06 * cab
    vf = np.clip((y - (NOSE - CAPF)) / CAPF, 0, 1)
    vt = np.clip((TAIL + CAPT - y) / CAPT, 0, 1)
    # the tail closed to a point; the cowl's front left open as a ring the
    # spinner's back plate covers
    f = np.sqrt(1 - np.maximum(vf ** 2 * (1 - 0.55 ** 2), vt ** 2))
    zc = 0.5 * (T + B)
    return zc, T - zc, zc - B, W, NT, NB, lean, f


def skin(y, th):
    """The fuselage at station `y`, angle `th` (0 the belly's centre line,
    a quarter turn the right side, half a turn the roof) — the angle a
    POLAR one about the section's middle, so the samples lie about evenly
    round a boxy section (a superellipse's own parameter bunches them at
    the corners and leaves the flat sides, where the livery runs, coarse)."""
    zc, ht_, hb, w, nt, nb, lean, f = section(y)
    dx, dz = np.sin(th), -np.cos(th)
    top = dz > 0
    n = np.where(top, nt, nb)
    h = np.where(top, ht_, hb)
    r = (np.abs(dx / w) ** n + np.abs(dz / h) ** n) ** (-1 / n) * f
    x = r * dx
    z = zc + r * dz
    x = x * (1 - lean * np.maximum((z - zc) / np.maximum(ht_, 1e-6), 0) ** 1.5)
    return x, np.broadcast_to(y, x.shape), z


def rad(y):
    """The section's mean radius at station `y`, m — the arc an angle of
    the skin is measured as where it is triangulated."""
    _, ht_, hb, w, _, _, _, f = section(y)
    return np.maximum(0.05, 0.5 * (w + 0.5 * (ht_ + hb)) * f)


def side_x(y, z, sx=1):
    """Where the skin is at height `z` of station `y`, on the side `sx`."""
    th = np.linspace(0, math.pi, 721)
    x, _, zz = skin(np.full_like(th, y), th)
    k = int(np.argmin(np.abs(zz - z)))
    return sx * float(x[k])


def top_z(y):
    return float(fT(y))


def bottom_z(y):
    return float(fB(y))


# ---------------------------------------------------------------- the skin's fields
# The livery's cheatline: its middle's height along the fuselage, low along
# the cowl and the cabin and sweeping up the tailcone to the fin.
CHEAT = pchip([(NOSE, 1.74), (FIREWALL, 1.66), (-1.9, 1.64), (-3.4, 1.78), (-5.2, 1.98),
               (TAIL, 2.04)])
WIN0 = 1.87                                  # the cabin windows' sills
SCREEN_FOOT = 2.21                           # the windscreen's foot on the cowl


def door_field(Y, Z, xs):
    """Inside the jump door's opening (on the side `xs` > 0)."""
    return rint([DOOR["front"] - Y, Y - DOOR["back"], Z - DOOR["bottom"], DOOR["top"] - Z,
                 xs - 0.25], 0.07)


def regions(X, Y, Z, seams=True, full=True):
    """Every outline on the skin as (slot, priority, field): the windscreen,
    the cockpit doors' and the cabin's windows, the portholes, the jump
    doorway (a hole, slot -1) and the sliding door's seams on the other
    side, the cowling's panels, the anti-glare panel and the livery. The
    highest field that is positive wins; the rest of the skin is `trim`."""
    out = []
    W = fW(Y)
    for sx in (1, -1):
        xs = sx * X
        side = xs - 0.3
        screen = rint([FIREWALL - 0.03 - Y, Y - 0.46, Z - SCREEN_FOOT, xs + 0.001,
                       0.86 * W - xs], 0.06)
        out.append((3, 5, screen))
        if full:
            out.append((2, 6, np.minimum(0.022 - xs, screen)))       # its centre post
        # the cockpit door's window, its sill rising toward the nose
        sill = WIN0 + 0.12 * np.clip((Y - 0.05) / 1.0, 0, 1)
        cock = rint([1.12 - Y, Y - 0.06, Z - sill, (top_z(0.0) - 0.12) - Z], 0.08)
        out.append((3, 5, np.minimum(cock, side)))
        if seams:
            door = rint([1.2 - Y, Y + 0.02, Z - 1.12, 2.62 - Z], 0.06)
            out.append((2, 4, np.minimum(0.009 - np.abs(door), side)))
        if sx == DSIDE:
            out.append((-1, 10, door_field(Y, Z, xs)))
        else:
            # the far side's sliding door, shut: its seam and its two windows
            d = door_field(Y, Z, xs)
            if seams:
                out.append((2, 4, np.minimum(0.009 - np.abs(d), side)))
            for y0, y1 in ((-0.24, -0.86), (-1.0, -1.58)):
                out.append((3, 5, np.minimum(rint([y0 - Y, Y - y1, Z - WIN0, 2.46 - Z], 0.1),
                                             side)))
        # the porthole aft of the doors (on the far side: the door slid
        # open covers the door side's)
        if sx != DSIDE:
            out.append((3, 5, np.minimum(0.165 - np.hypot(Y + 2.32, Z - 2.12), side)))
        if seams:
            for yc in (2.35, 1.75):                               # the cowling's panels
                out.append((2, 4, np.minimum(0.008 - np.abs(Y - yc), np.minimum(Z - 1.4, xs + 0.4))))
            out.append((2, 4, np.minimum(0.008 - np.abs(Z - 1.96),
                                         rint([NOSE - 0.12 - Y, Y - FIREWALL - 0.05, side + 0.1], 0.02))))
    # the anti-glare panel over the cowling, to the windscreen's foot
    out.append((2, 3.5, rint([0.26 - np.abs(X), Y - FIREWALL + 0.05, NOSE - 0.14 - Y,
                              Z - (fT(Y) - 0.09)], 0.05)))
    # the nose ring, the cheatline and its pinstripe
    out.append((1, 3, Y - (NOSE - 0.16)))
    c = CHEAT(Y)
    out.append((1, 2, 0.075 - np.abs(Z - c)))
    if full:
        out.append((4, 2.5, 0.014 - np.abs(Z - (c + 0.105))))
    return out


def skin_rows(Q):
    rows, y = [], TAIL
    while y < NOSE - 1e-6:
        rows.append(y)
        f = 1.6 if y < -3.2 else (0.7 if y > FIREWALL + 0.1 else 1.0)
        y += Q["dy"] * f
    rows.append(NOSE)
    return rows


def build_skin(Q):
    return sk.trace("skin", skin, lambda X, Y, Z: regions(X, Y, Z, Q["seams"], Q["full"]),
                    TAIL, NOSE, skin_rows(Q), Q, SKIN_MATS, rad=rad)


def liner(Q):
    """The cabin's lining inside the skin from the firewall to the rear
    bulkhead, facing in — so the cabin seen through the doorway is a
    cabin — the doorway and the windows left open, and the bulkheads
    closing it fore and aft."""
    n_y, n_th = Q["liner"]
    y0, y1 = CABIN["back"], FIREWALL - 0.02
    ys = np.linspace(y0, y1, n_y)
    ths = np.linspace(0, 2 * math.pi, n_th, endpoint=False)
    verts, faces, fm = [], [], []
    inset = 0.035
    for y in ys:
        x, _, z = skin(np.full_like(ths, y), ths)
        nrm = sk.normals_of(skin, np.full_like(ths, y), ths)
        for k in range(n_th):
            verts.append(Vector((x[k], y, z[k])) - Vector(nrm[k]) * inset)
    cx, cy, cz = [], [], []
    for i in range(n_y - 1):
        for j in range(n_th):
            a, b = i * n_th + j, i * n_th + (j + 1) % n_th
            c, d = a + n_th, b + n_th
            faces.append([a, b, d, c])           # wound to face the cabin's inside
            m = (verts[a] + verts[b] + verts[c] + verts[d]) / 4
            cx.append(m.x)
            cy.append(m.y)
            cz.append(m.z)
    cx, cy, cz = np.array(cx), np.array(cy), np.array(cz)
    slot = np.zeros(len(faces), int)
    best = np.full(len(faces), -1e9)
    for s, prio, F in regions(cx * 1.04, cy, cz):
        win = (F > 0) & (prio > best)
        slot[win], best[win] = s, prio
    # The windows are the skin's own glass: the lining is cut away round
    # them, so the cockpit's view out and the cabin seen through the
    # doorway look through one pane.
    keep = [k for k in range(len(faces)) if slot[k] >= 0 and slot[k] != 3]
    faces = [faces[k] for k in keep]
    mesh_obj("liner", verts, faces, [CABIN_M], [0] * len(faces), smooth=True, recalc=False)
    # the rear bulkhead and the firewall's back
    for y, m in ((y0, CABIN_M), (y1, DARK)):
        x, _, z = skin(np.full_like(ths, y), ths)
        ring = [Vector((x[k] * 0.95, y, z[k] * 0.95 + 0.05 * float(section(y)[0]))) for k in range(n_th)]
        c = sum(ring, Vector()) / n_th
        f = [[k, (k + 1) % n_th, n_th] for k in range(n_th)]
        if y == y1:
            f = [list(reversed(t)) for t in f]
        mesh_obj("bulkhead", ring + [c], f, [m], smooth=False, recalc=False)


# ---------------------------------------------------------------- shapes
def pipe(name, points, r, m, Q, r_end=None, smooth=True):
    """A round tube along `points` (smoothed), its rings carried along the
    path without twisting, closed at both ends."""
    pts = [Vector(p) for p in points]
    Pp = catmull(pts, False, Q["smooth"]) if (smooth and len(pts) > 2) else pts
    n = Q["pipe"]
    t0 = (Pp[1] - Pp[0]).normalized()
    up = Vector((0, 0, 1)) if abs(t0.z) < 0.9 else Vector((1, 0, 0))
    u = (up - t0 * up.dot(t0)).normalized()
    rings = []
    for i, p in enumerate(Pp):
        t = (Pp[min(i + 1, len(Pp) - 1)] - Pp[max(i - 1, 0)]).normalized()
        u = (u - t * u.dot(t)).normalized()
        v = t.cross(u)
        rr = r if r_end is None else r + (r_end - r) * i / (len(Pp) - 1)
        rings.append([p + (u * math.cos(2 * math.pi * k / n) + v * math.sin(2 * math.pi * k / n)) * rr
                      for k in range(n)])
    return loft(name, rings, [m])


def strut(name, a, b, chord, thick, m, Q):
    """A streamlined strut from `a` to `b`: an elliptical section `chord`
    long along the airflow (y) and `thick` across it."""
    a, b = Vector(a), Vector(b)
    t = (b - a).normalized()
    f = Vector((0, 1, 0))
    f = (f - t * f.dot(t)).normalized()
    s = t.cross(f)
    n = max(8, Q["pipe"])
    rings = []
    for p in (a, b):
        ring = []
        for k in range(n):
            th = 2 * math.pi * k / n
            ca = math.cos(th)
            # a teardrop: blunt ahead, sharper aft
            ch = chord * (0.42 if ca > 0 else 0.58) * ca
            ring.append(p + f * ch + s * (thick / 2 * math.sin(th)))
        rings.append(ring)
    return loft(name, rings, [m])


def foil(n, tk, camber=0.0, u0=0.0, u1=1.0):
    """An airfoil's section (u along the chord from the leading edge, v up)
    from `u0` to `u1`, closed: the upper surface back, the lower forward —
    a four-digit section of thickness `tk`, its camber `camber` at 40 %."""
    us = [u0 + (u1 - u0) * (0.5 - 0.5 * math.cos(math.pi * k / n)) for k in range(n + 1)]

    def half(u):
        return 5 * tk * (0.2969 * math.sqrt(u) - 0.126 * u - 0.3516 * u ** 2
                         + 0.2843 * u ** 3 - 0.1036 * u ** 4)

    def mean(u):
        p = 0.4
        return camber * (2 * p * u - u * u) / p ** 2 if u < p else camber * ((1 - 2 * p) + 2 * p * u - u * u) / (1 - p) ** 2

    upper = [(u, mean(u) + half(u)) for u in reversed(us)]
    lower = [(u, mean(u) - half(u)) for u in us[1:-1]] if u0 <= 0 else [(u, mean(u) - half(u)) for u in us]
    if u0 > 0:
        return upper + lower
    return upper + lower


def plate(name, sections, m, Q, cap=True):
    """A lofted surface through `sections`, each (le, chord vector, up
    vector, u0, u1, tk, camber): a foil laid between `u0` and `u1` of the
    chord at each."""
    rings = []
    for le, ch, up, u0, u1, tk, cb in sections:
        le, ch, up = Vector(le), Vector(ch), Vector(up)
        rings.append([le + ch * u + up * (v * ch.length) for u, v in foil(Q["foil"], tk, cb, u0, u1)])
    return loft(name, rings, [m], cap=cap)


def blade(name, centre, e, t, a, rs, chord, pitch, thick, Q, m):
    """A propeller blade along `e`, moving along `t`, its pitch tipping the
    leading edge toward `a` (the thrust): a section at every radius in `rs`."""
    centre, e, t, a = map(Vector, (centre, e, t, a))
    rings = []
    for r in rs:
        c, al, tk = chord(r), pitch(r), thick(r)
        d = t * math.cos(al) + a * math.sin(al)
        nrm = -t * math.sin(al) + a * math.cos(al)
        rings.append([centre + e * r + d * (0.3 * c - u * c) + nrm * (v * c) for u, v in foil(Q["foil"], tk)])
    return loft(name, rings, [m])


# ---------------------------------------------------------------- the wing
def wing_at(x, u0=0.0, u1=1.0):
    """The wing's section at span `x` (Blender x, either side): its leading
    edge, its chord vector (incidence and washout) and its up vector (the
    dihedral)."""
    ax = abs(x)
    sx = 1 if x >= 0 else -1
    twist = W_["incidence"] - W_["washout"] * min(1.0, ax / SEMI)
    d = W_["dihedral"]
    le = Vector((x, W_["root"]["le"], W_["root"]["y"] + ax * math.tan(d)))
    # turned about the quarter chord, so the washout drops the tip's trailing edge
    q = le + Vector((0, -0.25 * CHORD, 0))
    ch = Vector((0, -math.cos(twist), -math.sin(twist))) * CHORD
    le = q - ch * 0.25
    up = Vector((-sx * math.sin(d), -math.sin(twist), math.cos(d))).normalized()
    return le, ch, up


FLAP_IN, FLAP_OUT = 0.66, SEMI * W_["flap"]["span"]
AIL_IN, AIL_OUT = FLAP_OUT + 0.03, SEMI - 0.2
FLAP_U = 1 - W_["flap"]["chord"]
AIL_U = 1 - W_["aileron"]["chord"]
WING_TK, WING_CAMBER = 0.14, 0.02


def wing(Q):
    """Both halves of the wing: the fixed part (the full chord over the
    cabin and at the tip, cut back to the flap's and the aileron's hinges
    between), the square tip in the livery's colour with its lamps."""
    for sx in (1, -1):
        def sec(x, u1):
            le, ch, up = wing_at(sx * x)
            return (le, ch, up, 0.0, u1, WING_TK, WING_CAMBER)
        n = Q["spans"]
        plate("wing_root", [sec(0, 1), sec(FLAP_IN, 1)], TRIM, Q)
        plate("wing_in", [sec(FLAP_IN + (FLAP_OUT - FLAP_IN) * k / (n * 2), FLAP_U) for k in range(n * 2 + 1)],
              TRIM, Q)
        plate("wing_out", [sec(AIL_IN + (AIL_OUT - AIL_IN) * k / (n * 2), AIL_U) for k in range(n * 2 + 1)],
              TRIM, Q)
        plate("wing_gap", [sec(FLAP_OUT, AIL_U), sec(AIL_IN, AIL_U)], TRIM, Q)
        plate("wing_tip", [sec(AIL_OUT, 1), sec(SEMI - 0.06, 1)], PAINT, Q)
        # the tip's end: the section shrunk to a rounded cap
        le, ch, up = wing_at(sx * SEMI)
        le = le + Vector((0, -0.02, 0))
        plate("wing_cap", [sec(SEMI - 0.06, 1), (le, ch * 0.985, up, 0.0, 1.0, WING_TK * 0.6, WING_CAMBER)],
              PAINT, Q)
        # THE LAMPS on the tip's leading edge: red to the left, green to
        # the right, a white strobe behind each
        le, ch, up = wing_at(sx * (SEMI + 0.01))
        ellipsoid("nav", le + ch * 0.06 + up * 0.03, (0.03, 0.07, 0.035), LAMP_G if sx > 0 else LAMP)
        ellipsoid("strobe", le + ch * 0.62 + up * 0.04, (0.025, 0.05, 0.03), LAMP_W)
    # THE LANDING LIGHT in the left wing's leading edge, and the pitot
    le, ch, up = wing_at(-2.4)
    ellipsoid("landing", le + ch * 0.012, (0.13, 0.03, 0.07), LAMP_W)
    le, ch, up = wing_at(-3.6)
    pipe("pitot", [le + ch * 0.25 - up * 0.13, le + ch * 0.25 - up * 0.16 + Vector((0, 0.05, 0)),
                   le + Vector((0, 0.35, -0.16))], 0.012, METAL, Q)


# The surfaces' nodes, by name (the game's drawer is told the same names).
SURFACE_NODES = {("flap", "r"): "plane_flap_r", ("flap", "l"): "plane_flap_l",
                 ("aileron", "r"): "plane_aileron_r", ("aileron", "l"): "plane_aileron_l"}


def surface_nodes(Q):
    """The flaps and the ailerons, each a node on its hinge."""
    out = []
    for sx, side in ((1, "r"), (-1, "l")):
        for kind, a, b, u in (("flap", FLAP_IN + 0.02, FLAP_OUT - 0.02, FLAP_U),
                              ("aileron", AIL_IN + 0.02, AIL_OUT - 0.02, AIL_U)):
            before = set(COL.objects)
            n = max(2, Q["spans"] * 2)
            secs = []
            for k in range(n + 1):
                x = sx * (a + (b - a) * k / n)
                le, ch, up = wing_at(x)
                secs.append((le, ch, up, u + 0.01, 1.0, WING_TK, WING_CAMBER))
            plate(kind, secs, TRIM if kind == "flap" else TRIM, Q)
            h0 = hinge_point(sx * a, u)
            h1 = hinge_point(sx * b, u)
            axis = (h1 - h0) * sx
            out.append(join(made_since(before), SURFACE_NODES[kind, side], h0, axis))
    return out


def hinge_point(x, u):
    le, ch, up = wing_at(x)
    return le + ch * u


def struts(Q):
    """The lift strut a side, foot to the wing at about half its span, and
    its jury strut up to the wing from a little over half way along it."""
    for sx in (1, -1):
        foot = Vector((-sx * -STRUT["foot"]["x"], STRUT["foot"]["z"], STRUT["foot"]["y"]))
        head = Vector((sx * STRUT["head"]["x"], STRUT["head"]["z"], STRUT["head"]["y"]))
        foot.x = sx * abs(foot.x)
        strut("strut", foot, head, 0.15, 0.045, METAL, Q)
        j = foot.lerp(head, STRUT["jury"])
        le, ch, up = wing_at(j.x)
        top = le + ch * 0.45 - up * 0.08
        strut("jury", j, Vector((top.x, top.y, top.z)), 0.07, 0.025, METAL, Q)
        # the fittings at both ends
        box("fitting", foot, (0.08, 0.12, 0.06), DARK, bevel=0)
        box("fitting", head + Vector((0, 0, 0.02)), (0.06, 0.12, 0.05), DARK, bevel=0)


# ---------------------------------------------------------------- the tail
def tailplane(Q):
    """The tailplane low on the tailcone (its fixed part; the elevator is a
    node), its rounded tips in the livery's colour, and the strut under
    each half."""
    le_y, y, span, chord = T_["le"], T_["y"], T_["span"] / 2, T_["chord"]
    fixed = 1 - T_["elevator"]
    for sx in (1, -1):
        def sec(x, u1, tk=0.1):
            return (Vector((sx * x, le_y, y)), Vector((0, -chord, 0)), Vector((0, 0, 1)), 0.0, u1, tk, 0.0)
        plate("stab", [sec(0, fixed), sec(span - 0.1, fixed)], TRIM, Q)
        plate("stab_tip", [sec(span - 0.1, 1), sec(span - 0.02, 1),
                           (Vector((sx * span, le_y - 0.06, y)), Vector((0, -chord * 0.88, 0)),
                            Vector((0, 0, 1)), 0.0, 1.0, 0.05, 0.0)], PAINT, Q)
        a = Vector((sx * 0.11, le_y + 0.25, bottom_z(le_y + 0.25) + 0.05))
        b = Vector((sx * 1.25, le_y - 0.3, y - 0.05))
        strut("stab_strut", a, b, 0.07, 0.025, METAL, Q)


def elevator_node(Q):
    before = set(COL.objects)
    le_y, y, span, chord = T_["le"], T_["y"], T_["span"] / 2, T_["chord"]
    fixed = 1 - T_["elevator"]
    for sx in (1, -1):
        secs = [(Vector((sx * x, le_y, y)), Vector((0, -chord, 0)), Vector((0, 0, 1)), fixed + 0.01, 1.0, 0.1, 0.0)
                for x in (0.17, span - 0.12)]
        plate("elevator", secs, TRIM, Q)
        box("elev_tip", (sx * (span - 0.11), le_y - chord * 0.8, y), (0.02, chord * 0.38, 0.03), PAINT, bevel=0)
    hinge = Vector((0, le_y - chord * fixed, y))
    cyl("torque_tube", hinge + Vector((-0.2, 0, 0)), hinge + Vector((0.2, 0, 0)), 0.02, METAL, seg=8)
    return join(made_since(before), "plane_elevator", hinge, Vector((1, 0, 0)))


def fin_at(z):
    """The fin's leading edge's y and its chord at height `z`."""
    r, t = F_["root"], F_["tip"]
    f = (z - r["y"]) / (t["y"] - r["y"])
    return r["le"] + f * (t["le"] - r["le"]), r["chord"] + f * (t["chord"] - r["chord"])


def fin(Q):
    """The fin (its fixed part; the rudder is a node) off the tailcone, its
    square top, the dorsal fillet run forward along the tailcone, the
    beacon on top and the tail light."""
    fixed = 1 - F_["rudder"]
    zr, zt = F_["root"]["y"], F_["tip"]["y"]

    def sec(z, u1=fixed, tk=0.11):
        le, ch = fin_at(z)
        return (Vector((0, le, z)), Vector((0, -ch, 0)), Vector((-1, 0, 0)), 0.0, u1, tk, 0.0)
    n = max(2, Q["spans"] * 2)
    plate("fin", [sec(zr + (zt - 0.05 - zr) * k / n) for k in range(n + 1)], PAINT, Q)
    plate("fin_cap", [sec(zt - 0.05), sec(zt, tk=0.06)], PAINT, Q)
    # the dorsal fillet, a thin wedge from the tailcone up to the fin's edge
    yd = F_["dorsal"]
    z_meet = zr + 0.75
    le_meet, _ = fin_at(z_meet)
    y_back = fin_at(zr)[0] - 0.25
    plate("dorsal", [(Vector((0, yd, top_z(yd) - 0.04)), Vector((0, y_back - yd, 0)), Vector((-1, 0, 0)),
                      0.0, 1.0, 0.06, 0.0),
                     (Vector((0, le_meet, z_meet)), Vector((0, y_back - le_meet - 0.02, 0)), Vector((-1, 0, 0)),
                      0.0, 1.0, 0.12, 0.0)], PAINT, Q)
    le, ch = fin_at(zt)
    ellipsoid("beacon", (0, le - ch * 0.3, zt + 0.03), (0.035, 0.07, 0.035), LAMP)
    ellipsoid("tail_light", (0, le - ch * fixed + 0.02, zt - 0.12), (0.02, 0.03, 0.035), LAMP_W)


def rudder_node(Q):
    before = set(COL.objects)
    fixed = 1 - F_["rudder"]
    z0, z1 = F_["root"]["y"] + 0.08, F_["tip"]["y"]

    def sec(z, tk=0.11):
        le, ch = fin_at(z)
        return (Vector((0, le, z)), Vector((0, -ch, 0)), Vector((-1, 0, 0)), fixed + 0.01, 1.0, tk, 0.0)
    n = max(2, Q["spans"] * 2)
    plate("rudder", [sec(z0 + (z1 - z0) * k / n) for k in range(n + 1)], PAINT, Q)
    # a white band across the rudder, the livery's
    plate("rudder_band", [sec(z0 + 0.62 * (z1 - z0), 0.114), sec(z0 + 0.7 * (z1 - z0), 0.114)], TRIM, Q)
    lr, cr = fin_at(F_["root"]["y"])
    lt, ct = fin_at(z1)
    h0 = Vector((0, lr - cr * fixed, F_["root"]["y"]))
    h1 = Vector((0, lt - ct * fixed, z1))
    return join(made_since(before), "plane_rudder", h0, h1 - h0)


# ---------------------------------------------------------------- the nose
def nose(Q):
    """The chin intake under the spinner, the exhaust stack each side of
    the cowling, and the oil cooler's scoop under it."""
    zc = PROP["hub"]["y"]
    a = Vector((0, NOSE - 0.12, zc - 0.3))
    b = Vector((0, NOSE + 0.02, zc - 0.3))
    n = max(12, Q["pipe"] + 4)
    rings = []
    for p, ex, ez in ((a, 0.15, 0.09), (b, 0.15, 0.09), (b + Vector((0, 0.005, 0)), 0.12, 0.06),
                      (b + Vector((0, -0.08, 0)), 0.12, 0.06)):
        rings.append([p + Vector((ex * math.cos(2 * math.pi * k / n), 0, ez * math.sin(2 * math.pi * k / n)))
                      for k in range(n)])
    loft("intake", rings[:2], [PAINT])
    loft("intake_in", rings[2:], [DARK])
    ye, ze = P["cowling"]["exhaust"]["z"], P["cowling"]["exhaust"]["y"]
    for sx in (1, -1):
        w = abs(side_x(ye, ze, sx))
        pts = [(sx * (w - 0.04), ye + 0.03, ze), (sx * (w + 0.06), ye - 0.02, ze - 0.01),
               (sx * (w + 0.14), ye - 0.14, ze - 0.04), (sx * (w + 0.17), ye - 0.3, ze - 0.07)]
        pipe("exhaust", pts, 0.062, EXHAUST, Q, r_end=0.072)
        end = Vector(pts[-1])
        d = (end - Vector(pts[-2])).normalized()
        cyl("exhaust_in", end - d * 0.05, end + d * 0.004, 0.06, DARK, seg=16)
    box("scoop", (0, 1.95, bottom_z(1.95) - 0.03), (0.22, 0.5, 0.08), DARK, bevel=0)


def prop_node(Q):
    """THE PROPELLER: the spinner and three blades, turning clockwise seen
    from the cockpit, each paddle blade twisted from root to tip, its tip
    banded."""
    before = set(COL.objects)
    R, nb = PROP["diameter"] / 2, PROP["blades"]
    rs_ = PROP["spinner"] / 2
    L = 0.46
    n = max(10, Q["ring"])
    rings = []
    steps = 8 if Q["full"] else 4
    for k in range(steps + 1):
        f = k / steps
        r = rs_ * (1 - f ** 2.2) ** 0.55 if f < 1 else 0.004
        y = HUB.y - 0.08 + L * f
        rings.append([Vector((r * math.cos(2 * math.pi * j / n), y, HUB.z + r * math.sin(2 * math.pi * j / n)))
                      for j in range(n)])
    loft("spinner", rings, [PAINT])
    rs = [0.17, 0.26, 0.45, 0.7, 0.95, R - 0.12, R - 0.04, R] if Q["full"] else [0.17, 0.45, R - 0.1, R]
    if not GAME:
        rs = list(np.linspace(0.17, R, 18))
    tip_from = R - 0.13
    chord = lambda r: (0.09 + 0.14 * float(sstep(0.17, 0.5, r))) * (1 - 0.45 * float(sstep(R - 0.12, R, r)))
    pitch = lambda r: math.radians(48 - 30 * (r - 0.17) / (R - 0.17))
    thick = lambda r: 0.09 + 0.25 * (1 - float(sstep(0.17, 0.4, r)))
    for k in range(nb):
        ph = math.pi / 2 + 2 * math.pi * k / nb
        e = Vector((math.cos(ph), 0, math.sin(ph)))
        t = Vector((0, 1, 0)).cross(e)
        a = Vector((0, 1, 0))
        blade("blade", HUB, e, t, a, [r for r in rs if r <= tip_from] + [tip_from], chord, pitch, thick, Q, PROP_M)
        blade("blade_tip", HUB, e, t, a, [tip_from] + [r for r in rs if r > tip_from], chord, pitch, thick, Q, TIP)
    return join(made_since(before), "plane_prop", HUB)


# ---------------------------------------------------------------- the gear
def wheel(c, r, w, Q, sx):
    """A tyre and its hub at `c`, its axle along x."""
    cyl("tyre", c + Vector((-w / 2, 0, 0)), c + Vector((w / 2, 0, 0)), r, DARK, seg=max(14, Q["ring"] + 4))
    cyl("hub", c + Vector((-w / 2 - 0.005, 0, 0)), c + Vector((w / 2 + 0.005, 0, 0)), r * 0.45, METAL,
        seg=max(10, Q["ring"]))


def ski(name, c, y_front, y_back, width, thick, tip, Q, m):
    """A ski along y from `y_back` to its upturned tip at `y_front`, its
    base on the snow at `c.z`, centred on `c.x`."""
    n = max(8, Q["ring"] // 2 * 2)
    L = y_front - y_back
    steps = 12 if Q["full"] else 6
    rings = []
    for k in range(steps + 1):
        f = k / steps
        y = y_back + L * f
        u = max(0.0, (f - 0.82) / 0.18)
        z = c.z + tip * u ** 1.7
        ring = []
        for j in range(n):
            th = 2 * math.pi * j / n
            cx, cz = math.cos(th), math.sin(th)
            ring.append(Vector((c.x + width / 2 * math.copysign(abs(cx) ** 0.35, cx), y,
                                z + thick / 2 + thick / 2 * math.copysign(abs(cz) ** 0.35, cz))))
        rings.append(ring)
    loft(name, rings, [m])


def gear(Q):
    """The main legs a side — the forward and aft tubes out to the axle, the
    shock strut up to the cabin's side — the wheels through their skis, the
    check cable and the bungee; the tail ski on its leaf spring."""
    L = G_["leg"]
    for sx in (1, -1):
        axle = Vector((sx * G_["track"] / 2, L["z"], G_["wheel"] + 0.04))
        root_f = Vector((sx * 0.3, L["z"] + 0.45, bottom_z(L["z"] + 0.45) + 0.02))
        root_a = Vector((sx * 0.3, L["z"] - 0.35, bottom_z(L["z"] - 0.35) + 0.02))
        pipe("leg", [root_f, axle + Vector((-sx * 0.12, 0.02, 0.05))], 0.035, METAL, Q, smooth=False)
        pipe("leg", [root_a, axle + Vector((-sx * 0.12, -0.02, 0.05))], 0.03, METAL, Q, smooth=False)
        top = Vector((sx * (side_x(L["z"], 1.35) * sx - 0.02), L["z"], 1.35))
        cyl("oleo", top, top.lerp(axle, 0.5), 0.05, METAL, seg=12)
        cyl("oleo_rod", top.lerp(axle, 0.5), axle + Vector((-sx * 0.1, 0, 0.08)), 0.03, METAL, seg=10)
        wheel(axle + Vector((sx * 0.02, 0, 0)), 0.36, 0.17, Q, sx)
        sk_ = G_["ski"]
        yf = L["z"] + sk_["front"]
        yb = yf - sk_["length"]
        ski("ski", Vector((axle.x, 0, 0)), yf, yb, sk_["width"], 0.075, sk_["tip"], Q, PAINT)
        # the pedestal from the ski's top to the axle, either side of the tyre
        for dx in (-0.13, 0.13):
            box("pedestal", (axle.x + dx, L["z"], 0.2), (0.03, 0.42, 0.24), METAL, bevel=0)
        if Q["full"]:
            pipe("check", [Vector((axle.x, yf - 0.35, 0.1)), axle + Vector((-sx * 0.05, 0.35, 0.18))],
                 0.007, DARK, Q, smooth=False)
            pipe("bungee", [Vector((axle.x, yb + 0.3, 0.09)), axle + Vector((-sx * 0.05, -0.3, 0.15))],
                 0.012, DARK, Q, smooth=False)
        if sx == DSIDE:
            # THE JUMPERS' STEP on the door's side, out over the wheel
            c = Vector((sx * 0.92, L["z"] - 0.3, 0.78))
            box("step", c, (0.36, 0.3, 0.025), DARK, bevel=0)
            cyl("step_arm", c + Vector((-sx * 0.18, 0, 0)), Vector((sx * 0.45, L["z"] - 0.3, bottom_z(L["z"] - 0.3) + 0.03)),
                0.018, METAL, seg=8)
    # THE TAIL SKI on its leaf spring under the tailcone
    tz, ty = G_["tail"]["z"], G_["tail"]["y"]
    y0 = tz + 0.62
    a = Vector((0, y0, bottom_z(y0) + 0.03))
    fork = Vector((0, tz + 0.08, ty + 0.3))
    pipe("leaf", [a, a.lerp(fork, 0.5) + Vector((0, 0, -0.05)), fork], 0.025, METAL, Q)
    w = Vector((0, tz, ty + 0.16))
    cyl("tailwheel", w + Vector((-0.04, 0, 0)), w + Vector((0.04, 0, 0)), 0.11, DARK, seg=12)
    for dx in (-0.055, 0.055):
        pipe("fork", [fork + Vector((dx, 0, 0)), w + Vector((dx, 0, 0))], 0.012, METAL, Q, smooth=False)
    ski("tail_ski", Vector((0, 0, ty)), tz + G_["tail"]["length"] * 0.55, tz - G_["tail"]["length"] * 0.45,
        G_["tail"]["width"], 0.05, 0.1, Q, PAINT)


# ---------------------------------------------------------------- the cabin and the door
def door_outline(n, inset=0.0):
    """The jump doorway's outline on the skin, as points (rounded corners)."""
    y0, y1, z0, z1, r = DOOR["back"] + inset, DOOR["front"] - inset, DOOR["bottom"] + inset, DOOR["top"] - inset, 0.07
    pts = []
    for (cy, cz, a0) in ((y1 - r, z1 - r, 0), (y0 + r, z1 - r, 90), (y0 + r, z0 + r, 180), (y1 - r, z0 + r, 270)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((cy + r * math.cos(a), cz + r * math.sin(a)))
    # long edges split so the outline follows the skin
    out = []
    for p, q in zip(pts, pts[1:] + pts[:1]):
        L = math.hypot(q[0] - p[0], q[1] - p[1])
        m = max(1, int(L / 0.12))
        for k in range(m):
            out.append((p[0] + (q[0] - p[0]) * k / m, p[1] + (q[1] - p[1]) * k / m))
    return out


def cabin(Q):
    """The doorway's frame, the cabin floor, the jumpers' bench along the far
    wall, the handrail over the door inside and the grab rail outside. The
    cockpit forward of the floor's end — the seats, the panel, the controls
    and the pilot — is the game's own (`plane-cockpit.ts`)."""
    liner(Q)
    pts = door_outline(3 if Q["full"] else 1)
    frame = [Vector((side_x(y, z, DSIDE) - DSIDE * 0.016, y, z)) for y, z in pts]
    pipe("door_frame", frame + frame[:2], 0.024, TRIM, Q, smooth=False)
    fl = CABIN["floor"]
    # the floor, as wide as the skin is at its height
    ys = np.linspace(CABIN["back"], 0.78, 8)
    half = [abs(side_x(y, fl + 0.03)) - 0.04 for y in ys]
    fv = [Vector((sx * h, y, fl)) for y, h in zip(ys, half) for sx in (-1, 1)]
    ff = [[2 * k, 2 * k + 1, 2 * k + 3, 2 * k + 2] for k in range(len(ys) - 1)]
    mesh_obj("floor", fv, ff, [DARK], [0] * len(ff), smooth=False, recalc=False)
    # the bench along the far wall, facing the door
    bx = -DSIDE * (CABIN["width"] / 2 - 0.2)
    box("bench", (bx, -1.05, fl + 0.33), (0.34, 1.9, 0.08), CABIN_M, bevel=0)
    box("bench_back", (bx - DSIDE * 0.16, -1.05, fl + 0.6), (0.06, 1.9, 0.45), CABIN_M, bevel=0)
    for y in (-0.25, -1.85):
        box("bench_leg", (bx, y, fl + 0.15), (0.3, 0.04, 0.3), METAL, bevel=0)
    # the handrail over the doorway inside, and the grab rail outside
    xr = side_x(-0.9, 2.1, DSIDE) - DSIDE * 0.12
    pipe("handrail", [(xr, DOOR["front"] - 0.05, 2.07), (xr, DOOR["back"] + 0.05, 2.07)], 0.016, METAL, Q,
         smooth=False)
    for y in (DOOR["front"] - 0.05, DOOR["back"] + 0.05):
        cyl("standoff", (xr, y, 2.07), (xr, y, 2.25), 0.012, METAL, seg=8)
    xo = side_x(DOOR["front"] - 0.4, 2.27, DSIDE) + DSIDE * 0.06
    pipe("grab", [(xo - DSIDE * 0.06, DOOR["front"] + 0.05, 2.27), (xo, DOOR["front"] - 0.05, 2.27),
                  (xo, DOOR["front"] - 0.75, 2.27), (xo - DSIDE * 0.06, DOOR["front"] - 0.85, 2.27)],
         0.016, METAL, Q, smooth=False)


def door_node(Q):
    """THE JUMP DOOR, slid open aft along its rails: a panel of the skin's
    own shape stood proud of it, its two windows, turned in at its back to
    follow the tailcone's taper; and the rails it runs on."""
    def outline(X, Y, Z):
        xs = DSIDE * X
        d = door_field(Y, Z, xs)
        out = [(-1, 9, -d)]
        for y0, y1 in ((-0.24, -0.86), (-1.0, -1.58)):
            out.append((3, 5, np.minimum(rint([y0 - Y, Y - y1, Z - WIN0, 2.06 - Z], 0.08), d)))
        c = CHEAT(Y)
        out.append((1, 2, np.minimum(0.075 - np.abs(Z - c), d)))
        out.append((4, 2.5, np.minimum(0.014 - np.abs(Z - (c + 0.105)), d)))
        out.append((2, 3, np.minimum(0.012 - np.abs(Y - (DOOR["front"] - 0.75)), np.minimum(d, 1.9 - Z))))
        return out
    before = set(COL.objects)
    sk.trace("door", skin, outline, DOOR["back"] - 0.05, DOOR["front"] + 0.05,
             [DOOR["back"] - 0.05 + k * (DOOR["front"] - DOOR["back"] + 0.1) / max(3, int(1.7 / Q["dy"]))
              for k in range(max(3, int(1.7 / Q["dy"])) + 1)], Q, SKIN_MATS, rad=rad, offset=0.03)
    door = made_since(before)
    z_mid = 1.6
    df = side_x(DOOR["front"] - SLIDE, z_mid, DSIDE) - side_x(DOOR["front"], z_mid, DSIDE)
    db = side_x(DOOR["back"] - SLIDE, z_mid, DSIDE) - side_x(DOOR["back"], z_mid, DSIDE)
    pivot = Vector((side_x(DOOR["front"], z_mid, DSIDE), DOOR["front"], z_mid))
    turn = -DSIDE * math.atan2(abs(db - df), DOOR["front"] - DOOR["back"])
    M = (Matrix.Translation(pivot + Vector((df + DSIDE * 0.012, -SLIDE, 0)))
         @ Matrix.Rotation(turn, 4, "Z")
         @ Matrix.Translation(-pivot))
    for o in door:
        o.data.transform(M)
    # the handle on the door's front edge
    hf = M @ Vector((side_x(DOOR["front"] - 0.12, 1.6, DSIDE) + DSIDE * 0.06, DOOR["front"] - 0.12, 1.6))
    box("door_handle", hf, (0.03, 0.04, 0.22), DARK, bevel=0)
    mid = (DOOR["front"] + DOOR["back"]) / 2
    shut = Vector((side_x(mid, z_mid, DSIDE), mid, z_mid))
    centre = M @ shut
    ob = join(made_since(before), "plane_door", centre)
    # How to slide it shut, in the glTF's frame (y up, the nose on -z): the
    # move from open to shut and the turn about its own y.
    d = shut - centre
    ob["shut"] = [round(d.x, 4), round(d.z, 4), round(-d.y, 4)]
    ob["turn"] = round(-turn, 4)
    return ob


def rails(Q):
    """The door's rails along the outside: under the wing's root aft of the
    doorway, and at the sill."""
    for z in (DOOR["top"] + 0.06, DOOR["bottom"] + 0.05):
        ya, yb = DOOR["front"] + 0.05, DOOR["back"] - SLIDE - 0.1
        pts = [(side_x(y, z, DSIDE) + DSIDE * 0.03, y, z) for y in np.linspace(ya, yb, 6)]
        pipe("rail", pts, 0.013, DARK, Q, smooth=False)


def details(Q):
    """The antennas, the belly's beacon, the cockpit doors' handles and the
    step under them."""
    if Q["full"]:
        y = -2.3
        pipe("whip", [(0, y, top_z(y) - 0.01), (0, y - 0.25, top_z(y) + 0.55)], 0.006, DARK, Q, smooth=False)
        box("blade_ant", (0, -1.2, bottom_z(-1.2) - 0.06), (0.012, 0.18, 0.12), DARK, rot=(0.4, 0, 0), bevel=0)
        box("elt", (0, -3.9, top_z(-3.9) + 0.05), (0.01, 0.12, 0.1), DARK, rot=(0.3, 0, 0), bevel=0)
    ellipsoid("belly_beacon", (0, -0.5, bottom_z(-0.5) - 0.01), (0.04, 0.07, 0.03), LAMP)
    for sx in (1, -1):
        y = 0.12
        box("handle", (side_x(y, 1.7, sx) + sx * 0.012, y + 0.08, 1.7), (0.02, 0.12, 0.025), METAL, bevel=0)


# ---------------------------------------------------------------- assembly
def made_since(before):
    return [o for o in COL.objects if o not in before]


def join(objs, name, origin, xaxis=None):
    """Parts into one rigid mesh, its origin at `origin` and — given an
    `xaxis` — its own x along it (a hinge), the rest of its frame as near
    the model's as that allows."""
    lib._select_only(objs)
    bpy.ops.object.convert(target="MESH")
    lib._select_only(objs)
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = ob.data.name = name
    # The join takes its parts in no fixed order; sorting every element by
    # its distance from a point off every symmetry plane puts them back in
    # one, so the model made twice is the same bytes.
    scene.cursor.location = (0.137, 9.71, 5.33)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.sort_elements(type="CURSOR_DISTANCE", elements={"VERT", "EDGE", "FACE"})
    bpy.ops.object.mode_set(mode="OBJECT")
    if "bone" in ob:
        del ob["bone"]
    M = Matrix.Translation(origin)
    if xaxis is not None and (xaxis - Vector((1, 0, 0))).length > 1e-9:
        # x the hinge, y the model's forward held square to it, z = x × y
        x = xaxis.normalized()
        y = (Vector((0, 1, 0)) - x * x.y).normalized()
        z = x.cross(y)
        M = M @ Matrix((x, y, z)).transposed().to_4x4()
    ob.data.transform(M.inverted())
    ob.matrix_world = M
    if xaxis is not None:
        ob["hinge"] = "x"
    tri = ob.modifiers.new("tri", "TRIANGULATE")
    tri.quad_method, tri.ngon_method, tri.keep_custom_normals = "FIXED", "CLIP", True
    return ob


def build(detail):
    """The plane at one cut: the root and its nodes."""
    Q = DETAIL[detail]
    before = set(COL.objects)
    build_skin(Q)
    cabin(Q)
    wing(Q)
    struts(Q)
    tailplane(Q)
    fin(Q)
    nose(Q)
    gear(Q)
    rails(Q)
    details(Q)
    body = join(made_since(before), "plane_body", Vector((0, 0, 0)))
    nodes = [body, prop_node(Q), elevator_node(Q), rudder_node(Q)]
    nodes += surface_nodes(Q)
    nodes.append(door_node(Q))
    root = bpy.data.objects.new("plane", None)
    COL.objects.link(root)
    root["frame"] = "ground datum: x right (the door's side), y forward (the nose), z up"
    for o in nodes:
        mw = o.matrix_world.copy()
        o.parent = root
        o.matrix_world = mw
    counts = {o.name: lib._tri_count([o]) for o in nodes}
    tag = "render" if detail == "render" else "game"
    print("TRIANGLES", tag, detail, sum(counts.values()), counts)
    return root, nodes


lib._studio((0, -1.6, 1.8), 16.0)
CAMS = studio.cameras(COL, NOSE)
lib._cycles(SAMPLES)
ONLY = [v for v in os.environ.get("VIEWS", "").split(",") if v]
pick = lambda default: [v for v in (ONLY or default) if v in CAMS]

if not GAME:
    root, _ = build("render")
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, f"{NAME}-render.blend"))
    studio.render(scene, CAMS, pick(list(CAMS)), os.path.join(OUT, f"{NAME}-render"))
else:
    for lod, views in (("lod0", ["three", "left3", "side", "top", "door"]), ("lod1", ["three"])):
        root, _ = build(lod)
        if lod == "lod0":
            bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, f"{NAME}-game.blend"))
        studio.render(scene, CAMS, pick(views), os.path.join(OUT, f"{NAME}-{'game' if lod == 'lod0' else 'game-lod1'}"))
        studio.export(root, os.path.join(OUT, f"{NAME}-{lod}.glb"))
        studio.remove(root)

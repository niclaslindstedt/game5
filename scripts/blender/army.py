# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE ARMY'S HELICOPTER MODELLED IN BLENDER off the game's own data:
# `ARMY_HELI` (engine/game/defs/army-heli.ts) handed in whole by
# `scripts/blender.mjs --kind=army` — the driver, and the only way this
# runs. The machine is the medium twin-engine utility helicopter armies fly
# troops in (`docs/army.md` restates the research): a long, boxy cabin
# whose blunt nose rounds over a metre and a half into a big two-piece
# windscreen and chin windows, a hinged crew door each side with a big
# window, and behind it the SLIDING CABIN DOOR, 2.4 m wide, which slides
# aft along the fuselage to stand open; a broad cowl over two turboshafts
# side by side with their exhausts turned up at its tail, a long slim boom
# with a horizontal stabiliser half way along, a swept fin carrying the
# tail rotor high on its right, skid gear on two cross tubes, a four-bladed
# rotor — and the army's kit: a 7.62 mm-class door gun on a pintle at each
# doorway's forward edge, the gunner's seat behind it, a fast-rope bar
# swung out over each door, a sensor ball under the chin, wire cutters.
#
# THE DRESS is a temporary WINTER WASH: the olive green the class is
# delivered in, with a white wash laid over its upper surfaces in broad
# irregular patches (a field on the skin, `wash`), the green showing
# through low on the sides and the belly — what armies do to their
# helicopters for a winter in the snow, and what reads on the snow and
# against the sky alike: the dark breaks it up from below, the white from
# above. Low-visibility marks in dark grey, a black anti-glare panel.
#
# THE MACHINERY IS THE HELI'S. `heli.py`'s builder (the skin as one
# parametric surface, every window, seam and paint line a field on it
# traced into the mesh, the pipes, the lofts, the export) is run here as a
# module (everything above its studio block, as `rescue.py` does), then
# its profiles, its regions and its parts are replaced by this class's,
# and its studio block runs over them — so the two machines share every
# line of method and neither moves the other's model.
#
# THE FRAME is the heli's: Blender x to the right, y forward (the nose),
# z up, the origin on the ground under the middle of the skids —
# ARMY_HELI's (x, z, y). glTF turns it to y up with the nose on -z.
#
# THE NODES (the root `army` at the skid datum): `army_body` (the airframe,
# the cabin inside, the skids, the mounts, the bars); `army_rotor` (its
# origin the hub; the blades in its local horizontal plane; it turns
# ANTICLOCKWISE seen from above); `army_tail_rotor` (its origin the tail
# rotor's hub, turning about its local x); `army_door_r` / `army_door_l`
# (each sliding door CLOSED, its origin on the doorway's forward edge at
# the sill — slid open by moving it aft along -y, `ARMY_HELI.door.slide`);
# `army_gun_r` / `army_gun_l` (each door gun square out of its door, its
# origin the pivot on its pintle — turned about its local up for the yaw
# and its local fore-and-aft axis for the elevation).
#
# THE MATERIALS, by name: `paint` (the olive green), `trim` (the white
# wash), `stripe` (the low-visibility marks), `glass`, `metal`, `dark`,
# `cabin` (the cabin's inside), `gun` (the guns' black), `rotor`, `lamp`
# and `lamp_green`.

import math, os, sys, types

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy
from lib import box, cyl, ellipsoid, loft, mat, mesh_obj
from mathutils import Vector, geometry

_PATH = os.path.join(HERE, "heli.py")
_SRC = open(_PATH).read()
_RUN = _SRC.index("\nlib._studio(")
H = types.ModuleType("heli")
H.__file__ = _PATH
exec(compile(_SRC[:_RUN], _PATH, "exec"), H.__dict__)

A = H.H
NOSE, TAIL, HALF, FLOOR, ROOF = H.NOSE, H.TAIL, H.HALF, H.FLOOR, H.ROOF
RA, HUB, TAIL_HUB = H.RA, H.HUB, H.TAIL_HUB
DOOR, GUN, CABIN_IN = A["door"], A["gun"], A["cabin"]
SILL = A["sill"]
aft, ht, pchip, sstep, rint = H.aft, H.ht, H.pchip, H.sstep, H.rint
GAME = H.GAME


# ---------------------------------------------------------------- the dress
def recolour(m, rgb, rough=0.72):
    """A military finish: flat, no clear coat."""
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Coat Weight"].default_value = 0.0
    bsdf.inputs["Coat Roughness"].default_value = 0.03
    m.diffuse_color = (*rgb, 1.0)


OLIVE = (0.052, 0.062, 0.036)
WASH = (0.62, 0.64, 0.64)
recolour(H.PAINT, OLIVE)
recolour(H.TRIM, WASH, rough=0.8)
recolour(H.STRIPE, (0.11, 0.115, 0.115))
recolour(H.ROTOR_M, (0.035, 0.037, 0.034), rough=0.6)
CABIN = mat("cabin", (0.06, 0.066, 0.058), rough=0.85)
GUN_M = mat("gun", (0.02, 0.021, 0.02), metal=0.35, rough=0.5)
for _m in (CABIN, GUN_M):
    _m.node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.03
# The skin's slots: the olive ground (0), the wash (1), the dark seams and
# panels (2), the glass (3), the marks (4) — and the doorways, cut out (5).
S_OLIVE, S_WASH, S_DARK, S_GLASS, S_MARK, S_HOLE = range(6)
# Fields that cut the skin but colour none of it on the airframe: the
# sliding door's leaf (the doorway and the lap past its edges) and its two
# windows — the door is cut out of the same surface (`build_skin`).
S_LEAF, S_DWIN = 6, 7
# The door's lap past the doorway's edges, m, and its two windows in the
# doorway's upper half (metres behind the nose; heights).
LAP = 0.05
D_WINS = [(NOSE - DOOR["front"] + 0.2, NOSE - (DOOR["front"] + DOOR["back"]) / 2 - 0.09),
          (NOSE - (DOOR["front"] + DOOR["back"]) / 2 + 0.09, NOSE - DOOR["back"] - 0.2)]
W_LO, W_HI = SILL + 0.6, DOOR["head"] - 0.12
H.SKIN_MATS = [H.PAINT, H.TRIM, H.DARK, H.GLASS, H.STRIPE]


def wash(X, Y, Z):
    """Inside-positive where the white wash lies: broad irregular patches,
    thicker up the sides and over the top (sprayed from above), thinning to
    the green low on the sides and under the belly. Metres, the skin's own
    frame, so the doors and the cowl carry on the same patches."""
    f = (np.sin(0.7 * Y + 1.3) * np.cos(1.25 * Z - 0.45 * Y + 0.6 * X)
         + 0.6 * np.sin(1.45 * Y - 0.95 * Z + 0.8 * X + 2.0)
         + 0.38 * np.cos(2.1 * Y + 0.7 * Z - 1.1 * X))
    return f + 0.4 * (Z - 1.75)


# ---------------------------------------------------------------- the profiles
# The side view's top and belly and the plan's half width along y: the
# cabin's box section from the nose's rounding back past the door's slide
# (to 3.35 m aft of the datum), the aft fuselage drawing in under the
# cowl's tail, the boom on to the fin.
Y_END = TAIL + 0.5
LT, LB, LW = 1.75, 0.95, 1.15
TIP = ht(0.37)
YB = -3.35
H.Y_END, H.LT, H.LB, H.LW, H.TIP = Y_END, LT, LB, LW, TIP
fT = pchip([(Y_END, 2.24), (-6.2, 2.3), (-4.95, 2.36), (-4.35, 2.43), (-3.75, ROOF - 0.07),
            (YB, ROOF), (aft(LT), ROOF)])
fB = pchip([(Y_END, 1.93), (-6.2, 1.8), (-4.95, 1.68), (-4.4, 1.42), (-3.9, 0.96),
            (YB, FLOOR + 0.1), (-3.05, FLOOR), (aft(LB), FLOOR)])
fW = pchip([(Y_END, 0.15), (-6.5, 0.21), (-5.0, 0.3), (-4.45, 0.45), (-3.95, 0.8),
            (-3.6, HALF - 0.08), (YB, HALF), (aft(LW), HALF)])
H.fT, H.fB, H.fW = fT, fB, fW
CAP = H.CAP


def section(y):
    """The section at `y` (as the heli's): a box cabin, its roof and belly
    rounded into near-upright sides, easing into a round boom."""
    y = np.asarray(y, float)
    T, B, W = fT(y), fB(y), fW(y)
    s = sstep(-4.7, -3.5, y)
    NT, NB = 2.0 + 1.7 * s, 2.0 + 2.1 * s
    ut = np.clip((y - aft(LT)) / LT, 0, 1)
    ub = np.clip((y - aft(LB)) / LB, 0, 1)
    uw = np.clip((y - aft(LW)) / LW, 0, 1)
    T = np.where(y > aft(LT), TIP + (ROOF - TIP) * (1 - ut ** 1.8) ** (1 / 1.8), T)
    B = np.where(y > aft(LB), TIP - (TIP - FLOOR) * (1 - ub ** 2.4) ** (1 / 2.4), B)
    W = np.where(y > aft(LW), HALF * (1 - uw ** 2.6) ** (1 / 2.6), W)
    v = np.clip((Y_END + CAP - y) / CAP, 0, 1)
    f = np.sqrt(1 - v * v)
    zc = B + 0.5 * (T - B)
    return zc, (T - zc) * f, (zc - B) * f, W * f, NT, NB


H.section = section

# ---------------------------------------------------------------- the skin's fields
# The side view's lines, metres behind the nose: the crew door's leading
# and trailing edges (leaning forward at the foot), the doorway's.
CREW0 = ((1.55, ht(0.1)), (1.72, ht(0.93)))
CREW1 = ((2.98, ht(0.08)), (3.0, ht(0.93)))
D_DOOR0, D_DOOR1 = NOSE - DOOR["front"], NOSE - DOOR["back"]
SCREEN_FOOT = TIP + 0.16
# The low-visibility mark on the boom's side: metres behind the nose, its
# height, the ring's radii.
MARK_D, MARK_Z, MARK_R = 10.35, 2.06, 0.21


def regions(X, Y, Z, seams, accent, full):
    """Every outline on the skin as (slot, priority, field); the highest
    positive field wins, the rest of the skin is olive."""
    out = []
    D = NOSE - Y
    edge = H.edge
    for sx in (1, -1):
        xs = sx * X
        side = xs - 0.32
        screen = rint([-edge(D, Z, *CREW0) - 0.05, Z - SCREEN_FOOT, xs + 0.001, ROOF - 0.1 - Z,
                       D - 0.32], 0.05)
        roofwin = rint([D - 1.02, 1.62 - D, xs - 0.14, 0.86 - xs, Z - (ROOF - 0.24)], 0.06)
        chin = rint([D - 0.42, 1.42 - D, Z - ht(0.09), ht(0.31) - Z, xs - 0.24], 0.08)
        crew = rint([edge(D, Z, *CREW0), -edge(D, Z, *CREW1), Z - ht(0.06), ht(0.93) - Z], 0.05)
        crewwin = rint([edge(D, Z, *CREW0) - 0.08, -edge(D, Z, *CREW1) - 0.08, Z - ht(0.41),
                        ht(0.87) - Z], 0.08)
        crewlow = rint([edge(D, Z, *CREW0) - 0.12, 2.6 - D, Z - ht(0.13), ht(0.33) - Z], 0.07)
        hole = rint([D - D_DOOR0, D_DOOR1 - D, Z - SILL, DOOR["head"] - Z], 0.04)
        out.append((S_HOLE, 9, np.minimum(hole, side)))
        out.append((S_LEAF, -2, np.minimum(hole + LAP, side)))
        for d0, d1 in D_WINS:
            out.append((S_DWIN, -2, np.minimum(rint([D - d0, d1 - D, Z - W_LO, W_HI - Z], 0.07), side)))
        for f in (screen, np.minimum(roofwin, xs - 0.1), np.minimum(chin, xs - 0.2),
                  np.minimum(crewwin, side), np.minimum(crewlow, side)):
            out.append((S_GLASS, 5, f))
        if full:
            out.append((S_DARK, 6, np.minimum(0.025 - xs, screen)))
        if seams:
            out.append((S_DARK, 4, np.minimum(0.01 - np.abs(crew), side)))
            # the aft fuselage's access panel and the baggage hatch behind the slide
            hatch = rint([D - 8.25, 8.95 - D, Z - ht(0.3), ht(0.62) - Z], 0.05)
            out.append((S_DARK, 4, np.minimum(0.009 - np.abs(hatch), side)))
        # the anti-glare panel on the nose, under the windscreen's foot
        out.append((S_DARK, 3.5, rint([Z - (SCREEN_FOOT - 0.12), SCREEN_FOOT - Z + 0.02, 0.5 - xs,
                                       xs + 0.001, 1.1 - D], 0.04)))
        if accent:
            ring = np.hypot(D - MARK_D, Z - MARK_Z)
            out.append((S_MARK, 3, np.minimum(np.minimum(MARK_R - ring, ring - MARK_R * 0.62),
                                              xs - 0.05)))
    out.append((S_WASH, 2, wash(X, Y, Z)))
    return out


H.regions = regions


# ---------------------------------------------------------------- the skin, the doorways cut
def build_skin(Q):
    """The heli's skin builder (`heli.py`'s `build_skin`), with the faces of
    the two doorways left out — the cabin is open behind them."""
    ys = np.arange(Y_END, NOSE + 1e-9, 0.006)
    ths = np.linspace(0, 2 * math.pi, 1024, endpoint=False)
    X, Y, Z = H.skin(ys[:, None], ths[None, :])
    polys = []
    for _, _, F in regions(X, Y, Z, Q["seams"], Q["accent"], Q["full"]):
        for line in H.contours(F, ys, ths):
            for piece in H.split_seam(line):
                if len(piece) > 2 or (len(piece) == 2 and piece[0] != piece[1]):
                    polys.append(H.simplify(piece, Q["tol"], Q["seg"]))
    rows, y = [], Y_END
    while y < NOSE - 1e-6:
        rows.append(y)
        f = Q["boom"] if y < -4.9 else (0.6 if y > aft(LT) else 1.0)
        y += Q["dy"] * f
    rows.append(NOSE)
    verts = []
    for yr in rows:
        t = np.linspace(0, 2 * math.pi, 73)
        x, _, z = H.skin(np.full_like(t, yr), t)
        perim = float(np.sum(np.hypot(np.diff(x), np.diff(z))))
        n = max(8, math.ceil(perim / Q["sp"]))
        verts += [Vector((yr, 2 * math.pi * k / n * H.R0)) for k in range(n + 1)]
    edges = []
    for p in polys:
        base = len(verts)
        verts += [Vector((float(q[0]), float(q[1]))) for q in p]
        edges += [(base + k, base + k + 1) for k in range(len(p) - 1)]
    out_v, _, out_f, *_ = geometry.delaunay_2d_cdt(verts, edges, [], 0, 1e-6)
    py = np.array([v.x for v in out_v])
    pt = np.array([v.y / H.R0 for v in out_v])
    x, _, z = H.skin(py, pt)
    p3 = np.stack([x, np.broadcast_to(py, x.shape), z], axis=1)
    index, merged, first, remap = {}, [], [], []
    for n, p in enumerate(p3):
        k = tuple(np.round(p * 2e4).astype(int))
        if k not in index:
            index[k] = len(merged)
            merged.append(p)
            first.append(n)
        remap.append(index[k])
    tris, cy, ct = [], [], []
    for f in out_f:
        a, b, c = f
        cross = (py[b] - py[a]) * (pt[c] - pt[a]) - (pt[b] - pt[a]) * (py[c] - py[a])
        tri = [remap[a], remap[b], remap[c]] if cross > 0 else [remap[a], remap[c], remap[b]]
        if len(set(tri)) < 3:
            continue
        tris.append(tri)
        cy.append((py[a] + py[b] + py[c]) / 3)
        ct.append((pt[a] + pt[b] + pt[c]) / 3)
    cx, cyy, cz = H.skin(np.array(cy), np.array(ct))
    slot = np.zeros(len(tris), int)
    best = np.full(len(tris), -1.0)
    for s, prio, F in regions(cx, cyy, cz, Q["seams"], Q["accent"], Q["full"]):
        win = (F > 0) & (prio > best)
        slot[win], best[win] = s, prio
    # THE DOOR LEAVES: the faces inside each doorway's lap, coloured as the
    # skin would be there were it not cut — the patches carry on across it
    # — with its two windows glazed.
    leafslot = np.zeros(len(tris), int)
    lbest = np.full(len(tris), -1.0)
    inleaf = np.zeros(len(tris), bool)
    for s, prio, F in regions(cx, cyy, cz, Q["seams"], Q["accent"], Q["full"]):
        if s == S_LEAF:
            inleaf |= F > 0
            continue
        if s == S_HOLE:
            continue
        p = 7.0 if s == S_DWIN else prio
        win = (F > 0) & (p > lbest)
        leafslot[win], lbest[win] = (S_GLASS if s == S_DWIN else s), p
    for sx in (1, -1):
        pick = [k for k in range(len(tris)) if inleaf[k] and np.sign(cx[k]) == sx]
        LEAVES[sx] = ([tris[k] for k in pick], [int(leafslot[k]) for k in pick], merged, first, py, pt)
    keep = slot != S_HOLE
    faces = [t for t, k in zip(tris, keep) if k]
    slot = slot[keep]
    used = sorted({i for t in faces for i in t})
    renum = {old: new for new, old in enumerate(used)}
    faces = [[renum[i] for i in t] for t in faces]
    first = np.array(first)[used]
    normals = H.skin_normals(py[first], pt[first])
    me = bpy.data.meshes.new("skin")
    me.from_pydata([tuple(merged[i]) for i in used], [], faces)
    for m in H.SKIN_MATS:
        me.materials.append(m)
    me.polygons.foreach_set("material_index", slot.tolist())
    me.polygons.foreach_set("use_smooth", [True] * len(faces))
    me.update()
    me.normals_split_custom_set_from_vertices([tuple(n) for n in normals])
    return H.link(bpy.data.objects.new("skin", me))


H.build_skin = build_skin
LEAVES = {}


def side_at(y, z, sx=1):
    return H.side_x(y, z, sx)


# ---------------------------------------------------------------- the cabin inside
def interior(Q):
    """What is seen through an open doorway: the cabin's floor out to the
    sills, its ceiling, the bulkhead behind the crew's seats and the one
    aft of the troops with its bench, the gunners' seats — in the cabin's
    dark green-grey."""
    y0, y1 = CABIN_IN["back"], CABIN_IN["front"]
    top = CABIN_IN["ceiling"]
    w = min(side_at(y, SILL + 0.02) for y in (y0, y1, 0.0)) - 0.004
    box("floor", (0, (y0 + y1) / 2, SILL - 0.03), (2 * w, y1 - y0, 0.06), CABIN, bevel=0)
    wt = min(side_at(y, top) for y in (y0, y1)) - 0.01
    box("ceiling", (0, (y0 + y1) / 2, top + 0.02), (2 * wt, y1 - y0, 0.04), CABIN, bevel=0)
    for yy in (y0, y1):
        wb = min(side_at(yy, z) for z in (SILL, (SILL + top) / 2, top)) - 0.01
        box("bulkhead", (0, yy, (SILL + top) / 2), (2 * wb, 0.04, top - SILL), CABIN, bevel=0)
    # the bench across the aft bulkhead: its pan and its back
    b = A["bench"]
    box("bench", (0, b["z"] - 0.02, b["y"] - 0.04), (2 * (w - 0.25), 0.44, 0.08), H.DARK, bevel=0)
    box("bench_back", (0, y0 + 0.06, b["y"] + 0.28), (2 * (w - 0.25), 0.06, 0.5), H.DARK, bevel=0)
    for sx in (1, -1):
        for xl in (w - 0.32, 0.3):
            cyl("bench_leg", (sx * xl, b["z"], SILL), (sx * xl, b["z"], b["y"] - 0.08), 0.02, H.METAL,
                seg=8)
        # the gunner's seat: a pan on a post, facing out of the door
        g = A["gunner"]
        box("gunner_seat", (sx * g["x"], g["z"], g["y"] - 0.04), (0.4, 0.42, 0.08), H.DARK, bevel=0)
        box("gunner_back", (sx * (g["x"] - 0.2), g["z"], g["y"] + 0.24), (0.05, 0.42, 0.44), H.DARK,
            bevel=0)
        cyl("gunner_post", (sx * g["x"], g["z"], SILL), (sx * g["x"], g["z"], g["y"] - 0.08), 0.035,
            H.METAL, seg=12)


# ---------------------------------------------------------------- the cowl
COWL0, COWL1 = 1.35, -3.75
fTc = pchip([(COWL1, ROOF + 0.08), (-3.45, ROOF + 0.4), (-3.1, ROOF + 0.56), (-1.0, ROOF + 0.62),
             (RA - 0.4, ROOF + 0.64), (RA + 0.45, ROOF + 0.62), (0.95, ROOF + 0.42), (COWL0, ROOF + 0.04)])
fWc = pchip([(COWL1, 0.42), (-3.4, 0.66), (-2.9, 0.74), (-0.6, 0.76), (RA + 0.4, 0.62),
             (1.0, 0.5), (COWL0, 0.36)])
H.fTc, H.fWc = fTc, fWc


def cowling(Q):
    """The broad hump over the cabin: the transmission's fairing ahead of
    the mast, the two turboshafts side by side behind it under one cowl,
    their intakes' screens either side, the oil cooler's grille on top at
    the back, and the two exhausts turned up and out at its tail."""
    n = Q["cowl"]
    stations = [COWL0 + (COWL1 - COWL0) * (0.5 - 0.5 * math.cos(math.pi * k / n)) for k in range(n + 1)]
    seams = (RA + 0.75, RA - 0.6, -2.2) if Q["seams"] else ()
    stations = sorted(set(stations) | {ys + e for ys in seams for e in (-0.009, 0.009)}, reverse=True)
    rings = []
    for y in stations:
        top = float(fTc(y))
        w = min(float(fWc(y)), 0.94 * float(section(y)[3]))
        zb = H.top_z(y, w) - 0.05
        zm = zb + 0.42 * (top - zb)
        ring = []
        for j in range(Q["ring"]):
            th = 2 * math.pi * j / Q["ring"]
            c, s = math.sin(th), -math.cos(th)
            ex = 4.0
            ring.append(Vector((w * math.copysign(abs(c) ** (2 / ex), c), y,
                                zm + (top - zm if s > 0 else zm - zb) * math.copysign(abs(s) ** (2 / ex), s))))
        rings.append(ring)

    def face(c):
        if any(abs(c.y - ys) < 0.009 for ys in seams):
            return 2
        return 1 if wash(np.array(c.x), np.array(c.y), np.array(c.z)) > 0 else 0

    loft("cowl", rings, [H.PAINT, H.TRIM, H.DARK], face_mat=face)
    for sx in (1, -1):
        # the intakes' screens, either side ahead of the engines
        y0, y1 = -1.15, -0.25
        w = float(fWc((y0 + y1) / 2))
        box("intake", (sx * (w + 0.004), (y0 + y1) / 2, ROOF + 0.24), (0.03, y1 - y0, 0.26), H.DARK,
            bevel=0)
        if Q["full"]:
            for k in range(5):
                yk = y0 + (k + 0.5) * (y1 - y0) / 5
                box("screen", (sx * (w + 0.014), yk, ROOF + 0.24), (0.012, 0.03, 0.24), H.METAL, bevel=0)
        # the exhausts: an oval duct out of the cowl's tail, turned up and out
        a = Vector((sx * 0.32, -3.2, ROOF + 0.32))
        b = Vector((sx * 0.5, -3.72, ROOF + 0.62))
        H.oval("exhaust", a, b, 0.17, 0.14, H.DARK, Q, rx2=0.19, rz2=0.16)
        d = (b - a).normalized()
        H.oval("exhaust_in", b - d * 0.05, b + d * 0.002, 0.16, 0.13, H.METAL, Q)
    box("cooler", (0, -2.75, float(fTc(-2.75)) + 0.01), (0.5, 0.42, 0.04), H.DARK, bevel=0)
    zt = float(fTc(RA))
    cyl("collar", (0, RA, zt - 0.06), (0, RA, zt + 0.08), 0.2, H.DARK, r2=0.15, seg=24)
    # the drive shaft's fairing along the boom's top, to the fin
    rings = []
    m = max(4, Q["spans"] * 3)
    for k in range(m + 1):
        y = -3.9 + (TAIL_HUB.y + 0.15 + 3.9) * k / m
        zt_, wf = float(fT(y)), 0.11 - 0.03 * k / m
        ring = []
        for j in range(12):
            th = 2 * math.pi * j / 12
            c, s = math.sin(th), -math.cos(th)
            ring.append(Vector((wf * math.copysign(abs(c) ** 0.5, c), y,
                                zt_ + 0.02 + 0.09 * math.copysign(abs(s) ** 0.5, s))))
        rings.append(ring)
    loft("shaft_fairing", rings, [H.PAINT])


# ---------------------------------------------------------------- the tail
FIN_TOP, FIN_FOOT = 4.05, 1.5


def tail(Q):
    """The swept fin off the boom's end with the tail rotor's gearbox high
    on its right, the ventral fin and its tail skid, the horizontal
    stabiliser across the boom half way along, the beacons."""
    yb = TAIL_HUB.y
    zt = float(fT(yb + 0.45)) - 0.04
    zb = float(fB(yb + 0.3)) + 0.04
    H.wing("fin", (0, yb + 0.55, zt), (0, Y_END + 0.02, zt), (0, TAIL + 0.42, FIN_TOP),
           (0, TAIL, FIN_TOP - 0.02), (1, 0, 0), 0.14, Q, H.PAINT)
    H.wing("ventral", (0, yb + 0.4, zb), (0, Y_END + 0.02, zb), (0, TAIL + 0.6, FIN_FOOT),
           (0, TAIL + 0.28, FIN_FOOT + 0.03), (1, 0, 0), 0.13, Q, H.PAINT)
    H.pipe("tailskid", [(0, TAIL + 0.7, FIN_FOOT + 0.12), (0, TAIL + 0.55, FIN_FOOT - 0.16),
                        (0, TAIL + 0.25, FIN_FOOT - 0.22), (0, TAIL + 0.05, FIN_FOOT - 0.14)], 0.018,
           H.METAL, Q)
    ys = -5.75
    zs = float(section(ys)[0])
    span = 1.45
    for sx in (1, -1):
        H.wing("stab", (0, ys + 0.3, zs), (0, ys - 0.3, zs), (sx * span, ys + 0.22, zs),
               (sx * span, ys - 0.24, zs), (0, 0, 1), 0.15, Q, H.TRIM)
        box("stab_cap", (sx * (span + 0.02), ys - 0.01, zs), (0.04, 0.48, 0.06), H.PAINT, bevel=0)
    gx = 0.13
    cyl("gearbox", (0, TAIL_HUB.y, TAIL_HUB.z), (2 * gx, TAIL_HUB.y, TAIL_HUB.z), 0.15, H.PAINT, r2=0.1,
        seg=20)
    cyl("tr_shaft", (gx, TAIL_HUB.y, TAIL_HUB.z), (TAIL_HUB.x - 0.05, TAIL_HUB.y, TAIL_HUB.z), 0.04,
        H.METAL, seg=16)
    for b in A["lights"]["beacons"]:
        ellipsoid("beacon", (b["x"], b["z"], b["y"]), (0.04, 0.07, 0.035), H.LAMP)


# ---------------------------------------------------------------- the army's kit
def mounts(Q):
    """At each doorway: the door gun's pintle (a post up out of the floor
    at the doorway's forward edge, an arm out to the pivot), the sliding
    door's rails along the fuselage, the fast-rope bar swung out over the
    door with a brace and its hook."""
    p = GUN["pivot"]
    for sx in (1, -1):
        base = Vector((sx * (HALF - 0.1), p["z"], SILL))
        elbow = Vector((sx * (HALF - 0.1), p["z"], p["y"] - 0.12))
        pivot = Vector((sx * p["x"], p["z"], p["y"] - 0.07))
        cyl("pintle", base, elbow, 0.035, H.METAL, seg=12)
        cyl("pintle_arm", elbow, pivot, 0.03, H.METAL, seg=12)
        cyl("pintle_top", pivot, pivot + Vector((0, 0, 0.05)), 0.04, H.DARK, seg=12)
        # the rails the door runs on, under the roof's edge and at the sill
        for zz in (DOOR["head"] + 0.05, SILL - 0.03):
            ya, yb = DOOR["front"] + 0.02, DOOR["back"] - DOOR["slide"] - 0.04
            xa, xb = side_at(ya, zz, sx), side_at(yb, zz, sx)
            cyl("rail", (xa + sx * 0.014, ya, zz), (xb + sx * 0.014, yb, zz), 0.014, H.DARK, seg=8)
        # the fast-rope bar: out from the roof's edge over the doorway
        r = A["rope"]
        root_x = side_at(r["z"], ROOF - 0.12, sx)
        a = Vector((root_x - sx * 0.05, r["z"], ROOF - 0.08))
        b = Vector((sx * r["x"], r["z"], r["y"]))
        cyl("rope_bar", a, b, 0.045, H.METAL, seg=12)
        cyl("rope_brace", (side_at(r["z"], DOOR["head"] + 0.12, sx), r["z"], DOOR["head"] + 0.12),
            b - (b - a) * 0.35, 0.025, H.METAL, seg=8)
        cyl("rope_hook", b, b - Vector((0, 0, 0.14)), 0.02, H.DARK, seg=8)
        box("rope_plate", a, (0.1, 0.18, 0.1), H.DARK, bevel=0)


def details(Q):
    """The crew doors' handles, the landing lights, the sensor ball under
    the chin, the wire cutters, the steps, the antennas, the nav lights."""
    for sx in (1, -1):
        y = aft(2.85)
        box("handle", (side_at(y, ht(0.45), sx) + sx * 0.012, y, ht(0.45)), (0.02, 0.12, 0.025),
            H.METAL, bevel=0)
        nv = A["lights"]["nav"]
        ellipsoid("nav", (sx * (side_at(nv["z"], nv["y"]) + 0.01), nv["z"], nv["y"]),
                  (0.025, 0.06, 0.03), H.LAMP_G if sx > 0 else H.LAMP)
        y = aft(1.3)
        cyl("landing", (sx * 0.3, y, FLOOR + 0.03), (sx * 0.3, y, FLOOR - 0.03), 0.08, H.METAL, seg=16)
        cyl("landing_lens", (sx * 0.3, y, FLOOR - 0.025), (sx * 0.3, y, FLOOR - 0.035), 0.065, H.GLASS,
            seg=16)
    # the sensor ball under the chin: a turret, its window looking ahead
    y = aft(0.75)
    zb = float(section(y)[0] - section(y)[2])
    cyl("turret_stub", (0, y, zb + 0.03), (0, y, zb - 0.09), 0.1, H.DARK, seg=16)
    ellipsoid("turret", (0, y, zb - 0.2), (0.17, 0.17, 0.16), H.DARK)
    cyl("turret_eye", (0, y + 0.13, zb - 0.2), (0, y + 0.18, zb - 0.2), 0.08, H.GLASS, seg=16)
    # the wire cutters: one on the roof ahead of the cowl, one under the chin
    yu = aft(1.75)
    zu = ROOF
    H.wing("cutter_up", (0, yu + 0.15, zu - 0.02), (0, yu - 0.12, zu - 0.02), (0, yu + 0.3, zu + 0.4),
           (0, yu + 0.2, zu + 0.4), (1, 0, 0), 0.14, Q, H.METAL)
    yl = aft(1.05)
    zl = float(section(yl)[0] - section(yl)[2])
    H.wing("cutter_low", (0, yl + 0.15, zl + 0.02), (0, yl - 0.15, zl + 0.02), (0, yl + 0.3, zl - 0.34),
           (0, yl + 0.2, zl - 0.34), (1, 0, 0), 0.14, Q, H.METAL)
    if Q["full"]:
        box("antenna", (0, -2.2, FLOOR - 0.08), (0.012, 0.22, 0.16), H.DARK, rot=(0.35, 0, 0), bevel=0)
        box("antenna", (0, -4.6, float(fT(-4.6)) + 0.1), (0.012, 0.2, 0.18), H.DARK, rot=(0.35, 0, 0),
            bevel=0)
        y = -5.2
        cyl("whip", (0, y, float(fB(y)) + 0.02), (0, y - 0.5, float(fB(y)) - 0.42), 0.007, H.DARK, seg=6)


def door(Q, sx):
    """One SLIDING DOOR, closed: the skin's own faces over the doorway and
    its lap (`build_skin`'s leaf), stood off the surface along its normals,
    lined inside and rimmed — so its patches and its windows are the skin's,
    crisp at any cut, and it slides aft flush along the cabin's box. Its
    rollers ride the rails; its origin is the doorway's forward edge at the
    sill."""
    faces, slots, merged, first, py, pt = LEAVES[sx]
    used = sorted({i for t in faces for i in t})
    at = {old: new for new, old in enumerate(used)}
    first = np.array(first)
    normals = H.skin_normals(py[first[used]], pt[first[used]])
    out, inn = 0.04, 0.014
    n = len(used)
    verts = [Vector(tuple(merged[i])) + Vector(tuple(normals[k])) * out for k, i in enumerate(used)]
    verts += [Vector(tuple(merged[i])) + Vector(tuple(normals[k])) * inn for k, i in enumerate(used)]
    fs, fm = [], []
    count = {}
    for t, s_ in zip(faces, slots):
        a, b, c = (at[i] for i in t)
        fs.append([a, b, c])
        fm.append(s_)
        fs.append([c + n, b + n, a + n])
        fm.append(5)
        for e in ((a, b), (b, c), (c, a)):
            k = (min(e), max(e))
            count[k] = count.get(k, 0) + (1 if e[0] < e[1] else -1) * 0 + 1
            count.setdefault(("dir",) + k, e)
    for k, m in list(count.items()):
        if k[0] == "dir" or m != 1:
            continue
        a, b = count[("dir",) + k]
        fs.append([b, a, a + n, b + n])
        fm.append(2)
    me = bpy.data.meshes.new("door")
    me.from_pydata([tuple(v) for v in verts], [], fs)
    for m in (*H.SKIN_MATS, CABIN):
        me.materials.append(m)
    me.polygons.foreach_set("material_index", fm)
    me.polygons.foreach_set("use_smooth", [True] * len(fs))
    me.update()
    H.link(bpy.data.objects.new("door", me))
    hi = DOOR["head"] + LAP
    y = DOOR["back"] + 0.25
    box("door_handle", (side_at(y, ht(0.5), sx) + sx * (out + 0.012), y, ht(0.5)), (0.025, 0.16, 0.03),
        H.METAL, bevel=0)
    for yy in (DOOR["front"] - 0.1, DOOR["back"] + 0.1):
        box("door_roller", (side_at(yy, hi, sx) + sx * 0.03, yy, hi + 0.02), (0.04, 0.08, 0.05), H.DARK,
            bevel=0)


def gun(Q, sx):
    """One DOOR GUN, square out of its door: the 7.62 mm-class general-
    purpose machine gun on its cradle — the receiver and its feed cover,
    the barrel with its gas tube, carrying handle and flash hider, the
    stock and the pistol grip — and the belt's box hung on the cradle's
    left with the belt up into the feed. Built about the pivot."""
    p = GUN["pivot"]
    o = Vector((sx * p["x"], p["z"], p["y"]))
    a = Vector((sx, 0, 0))            # along the barrel
    l = Vector((0, sx, 0))             # the gun's left
    up = Vector((0, 0, 1))
    at = lambda ahead, left=0.0, high=0.0: o + a * ahead + l * left + up * high
    rot = (0, 0, 0)
    box("receiver", at(-0.02, 0, 0.05), (0.3, 0.075, 0.12), GUN_M, rot=rot, bevel=0)
    box("feed_cover", at(-0.02, 0, 0.12), (0.2, 0.08, 0.025), GUN_M, bevel=0)
    cyl("barrel", at(0.13, 0, 0.06), at(GUN["muzzle"]["ahead"] - 0.06, 0, GUN["muzzle"]["up"] + 0.03),
        0.013, GUN_M, seg=10)
    cyl("gas_tube", at(0.13, 0, 0.025), at(0.55, 0, 0.025), 0.011, GUN_M, seg=8)
    cyl("hider", at(GUN["muzzle"]["ahead"] - 0.07, 0, GUN["muzzle"]["up"] + 0.03),
        at(GUN["muzzle"]["ahead"], 0, GUN["muzzle"]["up"] + 0.03), 0.02, GUN_M, seg=10)
    box("sight", at(0.66, 0, 0.09), (0.02, 0.012, 0.05), GUN_M, bevel=0)
    box("handle", at(0.26, 0, 0.12), (0.12, 0.02, 0.02), GUN_M, bevel=0)
    stock_a, stock_b = at(-0.17, 0, 0.04), at(GUN["stock"]["ahead"], 0, GUN["stock"]["up"])
    cyl("stock", stock_a, stock_b, 0.035, GUN_M, r2=0.048, seg=8)
    gr = GUN["grip"]
    cyl("grip", at(gr["ahead"] + 0.03, 0, -0.01), at(gr["ahead"] - 0.02, 0, gr["up"] - 0.04), 0.018,
        GUN_M, seg=8)
    cyl("cradle", at(0, 0, -0.06), at(0, 0, 0.0), 0.03, H.DARK, seg=10)
    box("cradle_arm", at(0.02, 0.06, -0.03), (0.1, 0.12, 0.03), H.DARK, bevel=0)
    box("ammo", at(0.02, 0.16, -0.06), (0.26, 0.11, 0.18), H.PAINT, bevel=0)
    box("belt", at(0.0, 0.08, 0.07), (0.05, 0.08, 0.02), H.METAL, rot=(sx * 0.6, 0, 0), bevel=0)


def rotor(Q):
    """The main rotor: the mast, the swashplate, a four-armed hub with a
    sleeve to each arm and its pitch horn, and the blades — chord off
    ARMY_HELI, twisted from root to tip, the last 0.4 m swept and tapered,
    the tips banded in the wash."""
    R, nb, c0 = H.ROTOR["radius"], H.ROTOR["blades"], H.ROTOR["chord"]
    rs = {
        None: list(np.linspace(0.62, 1.0, 5)) + list(np.linspace(1.1, R - 0.45, 14))
        + list(np.linspace(R - 0.4, R, 8)),
        "lod0": [0.62, 0.78, 1.0, 2.0, 3.6, 5.0, 6.0, R - 0.35, R - 0.14, R],
        "lod1": [0.62, 1.0, 3.6, R - 0.35, R],
    }[Q["blade"]]
    r0 = rs[0]
    chord = lambda r: (0.2 + (c0 - 0.2) * float(sstep(r0, 1.0, r))) * (1 - 0.4 * float(sstep(R - 0.4, R, r)))
    pitch = lambda r: math.radians(10 - 9 * (r - r0) / (R - r0))
    thick = lambda r: 0.12 + 0.25 * (1 - float(sstep(r0, 1.0, r)))
    sweep = lambda r: 0.14 * float(sstep(R - 0.4, R, r)) ** 1.5
    zt = float(fTc(RA))
    cyl("mast", (0, RA, zt - 0.05), HUB + Vector((0, 0, -0.03)), 0.09, H.METAL, seg=20)
    cyl("swash", HUB + Vector((0, 0, -0.42)), HUB + Vector((0, 0, -0.36)), 0.27, H.DARK, seg=28)
    cyl("swash_top", HUB + Vector((0, 0, -0.36)), HUB + Vector((0, 0, -0.31)), 0.25, H.METAL, seg=28)
    cyl("hub", HUB + Vector((0, 0, -0.08)), HUB + Vector((0, 0, 0.03)), 0.22, H.METAL, seg=28)
    ellipsoid("cap", HUB + Vector((0, 0, 0.06)), (0.16, 0.16, 0.1), H.METAL)
    tip_from = R - 0.4
    for k in range(nb):
        ph = math.pi / 4 + 2 * math.pi * k / nb
        e = Vector((math.cos(ph), math.sin(ph), 0))
        t = Vector((-math.sin(ph), math.cos(ph), 0))      # anticlockwise from above
        box("arm", HUB + e * 0.34, (0.62, 0.2, 0.05), H.DARK, rot=(0, 0, ph), bevel=0)
        cyl("sleeve", HUB + e * 0.2 + Vector((0, 0, -0.08)), HUB + e * 0.66 + Vector((0, 0, -0.05)),
            0.07, H.METAL, r2=0.055, seg=16)
        box("damper", HUB + e * 0.42 - t * 0.13 + Vector((0, 0, -0.06)), (0.36, 0.06, 0.06), H.DARK,
            rot=(0, 0, ph), bevel=0)
        horn = HUB + e * 0.42 + t * 0.13 + Vector((0, 0, -0.09))
        box("horn", horn, (0.06, 0.13, 0.035), H.METAL, rot=(0, 0, ph), bevel=0)
        if Q["full"]:
            lk = HUB + (e * math.cos(-0.35) + t * math.sin(0.35)) * 0.24 + Vector((0, 0, -0.33))
            cyl("link", lk, horn, 0.015, H.METAL, seg=8)
        H.blade("blade", HUB + Vector((0, 0, -0.05)), e, t, (0, 0, 1),
                [r for r in rs if r <= tip_from] + [tip_from], chord, pitch, thick, sweep, Q, H.ROTOR_M)
        H.blade("tipband", HUB + Vector((0, 0, -0.05)), e, t, (0, 0, 1),
                [tip_from] + [r for r in rs if r > tip_from], chord, pitch, thick, sweep, Q, H.TRIM)


def tail_rotor(Q):
    """The tail rotor: two blades on a teetering hub high on the fin's
    right, its thrust pushing the tail against the main rotor's torque."""
    R, nb, c = H.TAILR["radius"], H.TAILR["blades"], H.TAILR["chord"]
    rs = [0.12, 0.2, 0.5, 0.95, R] if Q["full"] else [0.12, 0.4, R]
    if not GAME:
        rs = list(np.linspace(0.12, R, 12))
    a = Vector((-1, 0, 0))
    hx = TAIL_HUB.x
    cyl("tr_hub", Vector((hx - 0.08, TAIL_HUB.y, TAIL_HUB.z)), Vector((hx + 0.08, TAIL_HUB.y, TAIL_HUB.z)),
        0.07, H.METAL, seg=16)
    ellipsoid("tr_cap", Vector((hx + 0.085, TAIL_HUB.y, TAIL_HUB.z)), (0.035, 0.06, 0.06), H.DARK)
    for k in range(nb):
        ps = math.pi / 2 + 2 * math.pi * k / nb
        e = Vector((0, math.cos(ps), math.sin(ps)))
        t = Vector((0, -math.sin(ps), math.cos(ps)))
        H.blade("tr_blade", TAIL_HUB, e, t, a, rs, lambda r: c - 0.03 * r / R,
                lambda r: math.radians(10 - 5 * r / R),
                lambda r: 0.12 + 0.1 * (1 - float(sstep(0.12, 0.28, r))), lambda r: 0.0, Q, H.ROTOR_M)


# ---------------------------------------------------------------- assembly
def build(detail):
    """The machine at one cut: the root and its seven nodes."""
    Q = H.DETAIL[detail]
    made = H.made_since
    before = set(H.COL.objects)
    build_skin(Q)
    interior(Q)
    cowling(Q)
    tail(Q)
    H.skids(Q)
    details(Q)
    mounts(Q)
    nodes = [H.join(made(before), "army_body", Vector((0, 0, 0)))]
    before = set(H.COL.objects)
    rotor(Q)
    nodes.append(H.join(made(before), "army_rotor", HUB))
    before = set(H.COL.objects)
    tail_rotor(Q)
    nodes.append(H.join(made(before), "army_tail_rotor", TAIL_HUB))
    p = GUN["pivot"]
    for sx, side in ((1, "r"), (-1, "l")):
        before = set(H.COL.objects)
        door(Q, sx)
        x0 = side_at(DOOR["front"], SILL, sx)
        nodes.append(H.join(made(before), f"army_door_{side}", Vector((x0, DOOR["front"], SILL))))
        before = set(H.COL.objects)
        gun(Q, sx)
        nodes.append(H.join(made(before), f"army_gun_{side}", Vector((sx * p["x"], p["z"], p["y"]))))
    root = bpy.data.objects.new("army", None)
    H.COL.objects.link(root)
    root["frame"] = "skid datum: x right, y forward (the nose), z up"
    for o in nodes:
        o.parent = root
    counts = {o.name: H.lib._tri_count([o]) for o in nodes}
    tag = "render" if detail == "render" else "game"
    print("TRIANGLES", tag, detail, sum(counts.values()), counts)
    return root, nodes


def cameras():
    """The studio's views of a machine 13 m long under a rotor 14 m across,
    and three orthographic views at 60 px/m to lay a three-view over."""
    for o in [o for o in H.COL.objects if o.type == "CAMERA"]:
        bpy.data.objects.remove(o)
    cams = {}
    views = {
        "three": ((11.0, 12.5, 4.8), (0, -1.5, 1.8), 32), "left3": ((-11.0, 12.5, 4.8), (0, -1.5, 1.8), 32),
        "side": ((30, -1.8, 2.0), (0, -1.8, 2.0), 50), "front": ((0, 32, 2.2), (0, 0, 2.0), 55),
        "rear3": ((9, -19, 5.5), (0, -2.5, 1.8), 35), "top": ((0, -1.8, 40), None, 45),
        "door": ((5.5, 2.8, 1.9), (1.1, 0.4, 1.4), 32), "gun": ((3.2, 3.2, 2.0), (1.4, 1.2, 1.4), 40),
        "chase": ((2.0, -21, 9.0), (0, -1.5, 2.0), 35),
    }
    for name, (loc, target, lens) in views.items():
        cd = bpy.data.cameras.new(name)
        cd.lens = lens
        cd.clip_end = 300
        cam = bpy.data.objects.new(name, cd)
        H.COL.objects.link(cam)
        cam.location = loc
        if target is None:
            cam.rotation_euler = (0, 0, 0)
        else:
            empty = bpy.data.objects.new(f"{name}_at", None)
            H.COL.objects.link(empty)
            empty.location = target
            tt = cam.constraints.new("TRACK_TO")
            tt.target = empty
            tt.track_axis = "TRACK_NEGATIVE_Z"
            tt.up_axis = "UP_Y"
        cams[name] = cam
    yc = (NOSE + TAIL) / 2
    for name, loc, rot in (("oside", (-40, yc, 2.0), (math.pi / 2, 0, -math.pi / 2)),
                           ("otop", (0, yc, 40), (0, 0, -math.pi / 2)),
                           ("ofront", (0, 40, 2.0), (math.pi / 2, 0, math.pi))):
        cd = bpy.data.cameras.new(name)
        cd.type = "ORTHO"
        cd.ortho_scale = 21.3
        cd.clip_end = 300
        cam = bpy.data.objects.new(name, cd)
        H.COL.objects.link(cam)
        cam.location = loc
        cam.rotation_euler = rot
        cams[name] = cam
    return cams


H.build, H.cameras = build, cameras
H.DETAIL["lod0"]["boom"] = 3.0

exec(compile("\n" * _SRC.count("\n", 0, _RUN) + _SRC[_RUN:], _PATH, "exec"), H.__dict__)

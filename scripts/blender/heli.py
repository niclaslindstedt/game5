# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE HELI-SKI HELICOPTER MODELLED IN BLENDER off the game's own data:
# `HELI` (engine/game/defs/heli.ts) handed in whole by
# `scripts/blender.mjs --kind=heli` — the driver, and the only way this runs.
# The rotor's hub, radius and blades, the tail rotor's hub, side, radius and
# blades, the skids, the cabin's width, floor and roof, the boom's height,
# the nose's and the fin's reach and the fin's top and foot (the crash's
# strike points) are all read off it; what is drawn between them is the
# light single-engine utility helicopter heli-ski operators fly.
#
# THE FRAME is the skid datum's: Blender x to the right, y forward (the
# nose), z up, the origin on the ground under the middle of the skids —
# HELI's (x, z, y). glTF turns it to y up with the nose on -z; whoever
# draws it turns it back (a half turn about y puts the nose on the game's
# +z). Nothing is baked off that frame.
#
# THREE RIGID NODES, no rig: `heli_body` (the fuselage, the cowling, the
# fins, the skids, the ski basket — everything that does not turn, its
# origin at the datum), `heli_rotor` (the mast, the swashplate, the hub and
# the blades, its origin at the hub, the blades in its local horizontal
# plane: it turns CLOCKWISE seen from above, about its local up axis) and
# `heli_tail_rotor` (its origin at the tail rotor's hub, turning about its
# local x axis, the top blade going aft). Their parent `heli` is the datum.
#
# THE MATERIALS, by name: `paint` (the livery's colour), `trim` (its
# second colour, and the blade tips), `glass` (dark, glossy, opaque — there
# is no cabin behind it), `metal`, `dark` (seams, grilles, fittings),
# `rotor` (the blades), `lamp` (red: the beacons and the left navigation
# light) and `lamp_green` (the right one), both emissive.
#
# THE CABIN'S SKIN is ONE parametric surface — a superellipse section at
# every station along y, closed into a rounded nose and the boom's end —
# and every window, door seam and livery line on it is a FIELD on that
# surface whose zero contour is traced and laid into the mesh as
# constrained edges (a constrained Delaunay triangulation in the surface's
# own (y, angle) plane): every outline is crisp at any triangle budget,
# flush, its own material, and the normals are the surface's own, so a
# coarse cut still shades smooth.

import json, math, os, sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *
from mathutils import Matrix, Vector, geometry

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
NAME = os.path.basename(argv[0]).removesuffix(".json")
H = DATA["heli"]

ROTOR, TAILR, BODY, SKID = H["rotor"], H["tail"], H["body"], H["skid"]
NOSE, TAIL = BODY["nose"], BODY["tail"]
HALF, FLOOR, ROOF, BOOM = BODY["width"] / 2, BODY["floor"], BODY["roof"], BODY["boom"]
RA = ROTOR["at"]
HUB = Vector((0, RA, ROTOR["hub"]))
_th = TAILR["hub"]
TAIL_HUB = Vector((_th["x"], _th["z"], _th["y"]))
TSIDE = 1 if TAIL_HUB.x > 0 else -1          # the side the tail rotor is on
AFT = [p for p in BODY["strike"] if p["z"] < TAIL_HUB.y + 0.6]
FIN_TOP = max(p["y"] for p in AFT)            # the fin's top strike point
FIN_FOOT = min(p["y"] for p in AFT)           # the ventral fin's foot
TRACK = SKID["track"] / 2
SKID_Z = SKID["y"]

# Where the skin changes character, off the data: the boom's end just
# ahead of the tail rotor's hub, its root behind the mast, the cabin's back
# under the mast, the nose's rounding over its last 1.35 m.
Y_END = TAIL_HUB.y - 0.12
Y_BOOM0 = RA - 3.1
Y_CAB = RA - 0.9
YN = NOSE - 1.35
TIP = FLOOR + 0.5             # the nose's foremost point, at the panel's height
R0 = 0.9                      # the metric the surface's angle is laid out in

# ---------------------------------------------------------------- materials
PAINT = mat("paint", (0.6, 0.025, 0.02), rough=0.32, coat=1.0)
TRIM = mat("trim", (0.84, 0.85, 0.86), rough=0.32, coat=1.0)
GLASS = mat("glass", (0.012, 0.016, 0.022), rough=0.04)
METAL = mat("metal", (0.62, 0.63, 0.65), metal=1.0, rough=0.34)
DARK = mat("dark", (0.025, 0.026, 0.03), rough=0.6)
ROTOR_M = mat("rotor", (0.045, 0.047, 0.05), rough=0.42)
LAMP = mat("lamp", (0.8, 0.03, 0.02), rough=0.3, emit=(1.0, 0.05, 0.03), emit_str=6.0)
LAMP_G = mat("lamp_green", (0.03, 0.7, 0.15), rough=0.3, emit=(0.05, 1.0, 0.25), emit_str=6.0)
SKIN_MATS = [TRIM, PAINT, DARK, GLASS]        # the skin's slots, by index
# The shelf sets every material's coat roughness; on one with no coat that
# alone exports a clearcoat extension, which costs a physical material in
# three.js for nothing — so it goes back to Blender's default.
for _m in (GLASS, METAL, DARK, ROTOR_M, LAMP, LAMP_G):
    _m.node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.03

# How fine each cut is: the render's, the game's LOD0 and its LOD1.
DETAIL = {
    "render": dict(dy=0.02, sp=0.022, boom=2.0, tol=0.0015, seg=0.03, seams=True, accent=True,
                   cowl=70, ring=64, wing=14, spans=6, foil=14, blade=None, tube=6, full=True),
    "lod0": dict(dy=0.15, sp=0.17, boom=3.0, tol=0.007, seg=0.18, seams=True, accent=True,
                 cowl=16, ring=20, wing=5, spans=2, foil=5, blade="lod0", tube=2, full=True),
    "lod1": dict(dy=0.26, sp=0.28, boom=3.0, tol=0.02, seg=0.35, seams=False, accent=False,
                 cowl=10, ring=12, wing=3, spans=1, foil=3,
                 blade="lod1", tube=2, full=False),
}


# ---------------------------------------------------------------- the skin's profiles
def pchip(knots):
    """A monotone cubic through `knots` (x, y): no overshoot between them."""
    knots = sorted(knots)
    xs = np.array([k[0] for k in knots], float)
    ys = np.array([k[1] for k in knots], float)
    h, d = np.diff(xs), np.diff(ys) / np.diff(xs)
    m = np.zeros_like(ys)
    for i in range(1, len(xs) - 1):
        if d[i - 1] * d[i] > 0:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])

    def f(x):
        x = np.clip(np.asarray(x, float), xs[0], xs[-1])
        i = np.clip(np.searchsorted(xs, x) - 1, 0, len(xs) - 2)
        t = (x - xs[i]) / h[i]
        t2, t3 = t * t, t * t * t
        return ((2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i]
                + (3 * t2 - 2 * t3) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1])
    return f


def sstep(a, b, x):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# The side view's top and bottom and the plan's half width, from the boom's
# end to where the nose starts rounding.
fT = pchip([(Y_END, BOOM + 0.14), (Y_END + 1.6, BOOM + 0.18), (Y_BOOM0, BOOM + 0.3),
            (Y_BOOM0 + 0.75, ROOF - 0.17), (Y_CAB - 0.55, ROOF - 0.05), (Y_CAB, ROOF), (YN, ROOF)])
fB = pchip([(Y_END, BOOM - 0.13), (Y_END + 1.6, BOOM - 0.18), (Y_BOOM0, BOOM - 0.28),
            (Y_BOOM0 + 0.6, BOOM - 0.43), (Y_CAB - 0.85, FLOOR + 0.17), (Y_CAB - 0.3, FLOOR + 0.02),
            (Y_CAB, FLOOR), (YN, FLOOR)])
fW = pchip([(Y_END, 0.14), (Y_END + 1.6, 0.18), (Y_BOOM0, 0.3), (Y_BOOM0 + 0.6, 0.52),
            (Y_CAB - 0.8, HALF - 0.1), (Y_CAB, HALF), (YN, HALF)])
CAP = 0.06


def section(y):
    """The section at `y`: its widest line's height, the half heights above
    and below it, the half width, and the superellipse's exponents above and
    below (a round boom, a cabin with flat sides and a flatter belly)."""
    y = np.asarray(y, float)
    T, B, W = fT(y), fB(y), fW(y)
    s = sstep(Y_BOOM0, Y_CAB, y)
    K, NT, NB = 0.5 - 0.08 * s, 2.0 + 0.7 * s, 2.0 + 1.6 * s
    u = np.clip((y - YN) / (NOSE - YN), 0, 1)
    nose = y > YN
    T = np.where(nose, TIP + (ROOF - TIP) * (1 - u ** 2.2) ** (1 / 2.2), T)
    B = np.where(nose, TIP - (TIP - FLOOR) * (1 - u ** 3) ** (1 / 3), B)
    W = np.where(nose, HALF * (1 - u ** 2.3) ** (1 / 2.3), W)
    v = np.clip((Y_END + CAP - y) / CAP, 0, 1)
    f = np.sqrt(1 - v * v)
    zc = B + K * (T - B)
    return zc, (T - zc) * f, (zc - B) * f, W * f, NT, NB


def skin(y, th):
    """The surface at station `y`, angle `th` (0 the belly's centre line,
    a quarter turn the right side, half a turn the roof)."""
    zc, ht, hb, w, nt, nb = section(y)
    c, s = np.sin(th), -np.cos(th)
    top = s > 0
    n = np.where(top, nt, nb)
    x = w * np.sign(c) * np.abs(c) ** (2 / n)
    z = zc + np.where(top, ht, hb) * np.sign(s) * np.abs(s) ** (2 / n)
    return x, np.broadcast_to(y, x.shape), z


def skin_normals(y, th, eps=1e-4):
    a = np.stack(skin(y, th + eps)) - np.stack(skin(y, th - eps))
    b = np.stack(skin(y + eps, th)) - np.stack(skin(y - eps, th))
    n = np.cross(b.T, a.T)
    length = np.linalg.norm(n, axis=1)
    pole = length < 1e-10
    n[pole] = np.where((y[pole] > 0)[:, None], [0, 1, 0], [0, -1, 0])
    length[pole] = 1
    return n / length[:, None]


def side_x(y, z, sx=1):
    """Where the skin is at height `z` of station `y`, on the side `sx`."""
    th = np.linspace(0, math.pi, 721)
    x, _, zz = skin(np.full_like(th, y), th)
    k = int(np.argmin(np.abs(zz - z)))
    return sx * float(x[k])


# ---------------------------------------------------------------- the skin's fields
def rint(fs, r):
    """The intersection of inside-positive fields, its corners rounded to `r`."""
    d = [r - f for f in fs]
    q = np.sqrt(sum(np.maximum(di, 0) ** 2 for di in d))
    return -(q + np.minimum(np.maximum.reduce(d), 0) - r)


def rbox(Y, Z, y0, y1, z0, z1, r):
    return rint([Y - y0, y1 - Y, Z - z0, z1 - Z], r)


SWOOSH = pchip([(Y_END, BOOM), (Y_BOOM0 - 0.5, BOOM), (Y_BOOM0 + 0.7, 1.52), (RA - 0.3, 1.1),
                (RA + 1.7, 0.95), (NOSE - 1.0, 0.86), (NOSE, 0.75)])
P0, P1 = (NOSE - 1.45, ROOF - 0.07), (NOSE - 0.75, TIP - 0.04)   # the windscreen's pillar


def pillar(Y, Z):
    """Metres forward of the windscreen's pillar, in the side view."""
    dy, dz = P1[0] - P0[0], P1[1] - P0[1]
    return ((Y - P0[0]) * -dz + (Z - P0[1]) * dy) / math.hypot(dy, dz)


def regions(X, Y, Z, seams, accent):
    """Every outline on the skin as (slot, priority, field): the windows,
    the doors' seams, the livery. The highest field that is positive wins;
    the rest of the skin is `trim`."""
    out = []
    a1 = pillar(Y, Z)
    for sx in (1, -1):
        xs = sx * X
        side = xs - 0.25
        ws = rint([a1, Z - (TIP - 0.02 + 0.06 * sstep(NOSE - 0.7, NOSE - 0.1, Y)), xs - 0.025,
                   Y - (NOSE - 1.19 - 0.26 * np.clip(xs / 0.75, 0, 1))], 0.05)
        du, dv = Y - (NOSE - 0.62), Z - (FLOOR + 0.27)
        ca, sa = math.cos(0.18), math.sin(0.18)
        chin = 0.06 * (1 - ((du * ca + dv * sa) / 0.3) ** 2 - ((dv * ca - du * sa) / 0.13) ** 2)
        front = rint([Y - (RA + 1.43), -a1 - 0.045, (NOSE - 0.9) - Y, Z - (FLOOR + 0.08),
                      (ROOF - 0.09) - Z], 0.07)
        front_win = rint([Y - (RA + 1.53), -a1 - 0.13, Z - (FLOOR + 0.66), (ROOF - 0.17) - Z], 0.09)
        rear = rbox(Y, Z, RA + 0.05, RA + 1.33, FLOOR + 0.08, ROOF - 0.09, 0.07)
        rear_win = rbox(Y, Z, RA + 0.17, RA + 1.21, FLOOR + 0.68, ROOF - 0.2, 0.1)
        hatch = rbox(Y, Z, RA - 1.6, RA - 0.72, FLOOR + 0.36, FLOOR + 0.98, 0.06)
        for f in (ws, np.minimum(chin, xs - 0.3), np.minimum(front_win, side), np.minimum(rear_win, side)):
            out.append((3, 5, f))
        if seams:
            for f in (front, rear, hatch):
                out.append((2, 4, np.minimum(0.008 - np.abs(f), side)))
    if accent:
        out.append((2, 3, 0.022 - np.abs(Z - (SWOOSH(Y) - 0.085))))
    out.append((1, 2, Z - SWOOSH(Y)))
    return out


# ---------------------------------------------------------------- tracing the outlines
def contours(F, ys, ths):
    """The zero contours of `F` (rows the stations `ys`, columns the angles
    `ths`, periodic) as polylines of (y, angle), each a marching square's
    crossings chained."""
    Nt = F.shape[1]
    Fp = np.concatenate([F, F[:, :1]], axis=1)
    thp = np.append(ths, 2 * math.pi)
    ins = Fp > 0
    A, B, C, D = ins[:-1, :-1], ins[:-1, 1:], ins[1:, 1:], ins[1:, :-1]
    code = A.astype(int) + 2 * B + 4 * C + 8 * D
    pts, segs = {}, []

    def key(e):
        return (e[0], e[1], e[2] % Nt) if e[0] == "v" else e

    def point(e):
        k = key(e)
        if k not in pts:
            kind, i, j = e
            if kind == "h":
                f0, f1 = Fp[i, j], Fp[i, j + 1]
                pts[k] = (ys[i], thp[j] + f0 / (f0 - f1) * (thp[j + 1] - thp[j]))
            else:
                f0, f1 = Fp[i, j], Fp[i + 1, j]
                pts[k] = (ys[i] + f0 / (f0 - f1) * (ys[i + 1] - ys[i]), thp[j])
        return k

    for i, j in np.argwhere((code > 0) & (code < 15)):
        corners = (A[i, j], B[i, j], C[i, j], D[i, j])
        edges = (("h", i, j), ("v", i, j + 1), ("h", i + 1, j), ("v", i, j))
        cut = [e for n, e in enumerate(edges) if corners[n] != corners[(n + 1) % 4]]
        if len(cut) == 2:
            pairs = [cut]
        elif corners[0] == (Fp[i:i + 2, j:j + 2].mean() > 0):
            pairs = [(edges[0], edges[1]), (edges[2], edges[3])]
        else:
            pairs = [(edges[3], edges[0]), (edges[1], edges[2])]
        for e0, e1 in pairs:
            segs.append((point(e0), point(e1)))
    adj = {}
    for n, (e0, e1) in enumerate(segs):
        adj.setdefault(e0, []).append(n)
        adj.setdefault(e1, []).append(n)
    used = [False] * len(segs)
    lines = []
    for n0 in range(len(segs)):
        if used[n0]:
            continue
        used[n0] = True
        chain = list(segs[n0])
        for _ in (0, 1):
            while True:
                nxt = [m for m in adj[chain[-1]] if not used[m]]
                if not nxt:
                    break
                used[nxt[0]] = True
                e0, e1 = segs[nxt[0]]
                chain.append(e1 if e0 == chain[-1] else e0)
            chain.reverse()
        lines.append([pts[k] for k in chain])
    return lines


def split_seam(poly):
    """A polyline cut where it crosses the angle's seam (the belly's centre
    line), each piece ended on the seam."""
    out, cur = [], [poly[0]]
    for p, q in zip(poly, poly[1:]):
        if abs(q[1] - p[1]) > math.pi:
            qu = q[1] + (2 * math.pi if q[1] < p[1] else -2 * math.pi)
            edge = 2 * math.pi if qu > p[1] else 0.0
            yb = p[0] + (edge - p[1]) / (qu - p[1]) * (q[0] - p[0])
            cur.append((yb, edge))
            out.append(cur)
            cur = [(yb, 2 * math.pi - edge), q]
        else:
            cur.append(q)
    out.append(cur)
    return out


def simplify(pts, tol, seg):
    """Douglas-Peucker to `tol` m, then no span longer than `seg` m."""
    P = np.array([(p[0], p[1] * R0) for p in pts])
    keep = np.zeros(len(P), bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(P) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        ab, rel = P[j] - P[i], P[i + 1:j] - P[i]
        L = math.hypot(*ab)
        dist = (np.hypot(rel[:, 0], rel[:, 1]) if L < 1e-12
                else np.abs(ab[0] * rel[:, 1] - ab[1] * rel[:, 0]) / L)
        k = int(np.argmax(dist))
        if dist[k] > tol:
            keep[i + 1 + k] = True
            stack += [(i, i + 1 + k), (i + 1 + k, j)]
    kept = P[keep]
    out = [kept[0]]
    for a, b in zip(kept, kept[1:]):
        n = max(1, math.ceil(math.hypot(*(b - a)) / seg))
        out += [a + (b - a) * (k / n) for k in range(1, n + 1)]
    return out


# ---------------------------------------------------------------- the skin
def build_skin(Q):
    """The cabin, the rear fuselage and the boom as one mesh: the surface
    sampled on rows (finer at the nose, coarse along the straight boom),
    every outline laid in as constrained edges, every triangle given its
    region's slot, every vertex the surface's own normal."""
    ys = np.arange(Y_END, NOSE + 1e-9, 0.006)
    ths = np.linspace(0, 2 * math.pi, 1024, endpoint=False)
    X, Y, Z = skin(ys[:, None], ths[None, :])
    fields = regions(X, Y, Z, Q["seams"], Q["accent"])
    polys = []
    for _, _, F in fields:
        for line in contours(F, ys, ths):
            for piece in split_seam(line):
                if len(piece) > 2 or (len(piece) == 2 and piece[0] != piece[1]):
                    polys.append(simplify(piece, Q["tol"], Q["seg"]))

    rows, y = [], Y_END
    while y < NOSE - 1e-6:
        rows.append(y)
        f = Q["boom"] if y < Y_BOOM0 - 0.4 else (0.6 if y > YN - 0.2 else 1.0)
        y += Q["dy"] * f
    rows.append(NOSE)
    verts = []
    for yr in rows:
        t = np.linspace(0, 2 * math.pi, 73)
        x, _, z = skin(np.full_like(t, yr), t)
        perim = float(np.sum(np.hypot(np.diff(x), np.diff(z))))
        n = max(8, math.ceil(perim / Q["sp"]))
        verts += [Vector((yr, 2 * math.pi * k / n * R0)) for k in range(n + 1)]
    edges = []
    for p in polys:
        base = len(verts)
        verts += [Vector((float(q[0]), float(q[1]))) for q in p]
        edges += [(base + k, base + k + 1) for k in range(len(p) - 1)]
    out_v, _, out_f, *_ = geometry.delaunay_2d_cdt(verts, edges, [], 0, 1e-6)

    py = np.array([v.x for v in out_v])
    pt = np.array([v.y / R0 for v in out_v])
    x, _, z = skin(py, pt)
    p3 = np.stack([x, np.broadcast_to(py, x.shape), z], axis=1)
    index, merged, first, remap = {}, [], [], []
    for n, p in enumerate(p3):
        k = tuple(np.round(p * 2e4).astype(int))
        if k not in index:
            index[k] = len(merged)
            merged.append(p)
            first.append(n)
        remap.append(index[k])
    faces, cy, ct = [], [], []
    for f in out_f:
        a, b, c = f
        cross = (py[b] - py[a]) * (pt[c] - pt[a]) - (pt[b] - pt[a]) * (py[c] - py[a])
        tri = [remap[a], remap[b], remap[c]] if cross > 0 else [remap[a], remap[c], remap[b]]
        if len(set(tri)) < 3:
            continue
        faces.append(tri)
        cy.append((py[a] + py[b] + py[c]) / 3)
        ct.append((pt[a] + pt[b] + pt[c]) / 3)
    cx, cyy, cz = skin(np.array(cy), np.array(ct))
    slot = np.zeros(len(faces), int)
    best = np.full(len(faces), -1)
    for s, prio, F in regions(cx, cyy, cz, Q["seams"], Q["accent"]):
        win = (F > 0) & (prio > best)
        slot[win], best[win] = s, prio
    first = np.array(first)
    normals = skin_normals(py[first], pt[first])
    me = bpy.data.meshes.new("skin")
    me.from_pydata([tuple(p) for p in merged], [], faces)
    for m in SKIN_MATS:
        me.materials.append(m)
    me.polygons.foreach_set("material_index", slot.tolist())
    me.polygons.foreach_set("use_smooth", [True] * len(faces))
    me.update()
    me.normals_split_custom_set_from_vertices([tuple(n) for n in normals])
    return link(bpy.data.objects.new("skin", me))


# ---------------------------------------------------------------- the parts
def airfoil(n, tk):
    """A symmetric section of thickness `tk` (of the chord), (u, v) round it:
    u from the leading edge (0) to the trailing edge (1)."""
    us = [0.5 - 0.5 * math.cos(math.pi * k / n) for k in range(n + 1)]
    t = lambda u: 5 * tk * (0.2969 * math.sqrt(u) - 0.126 * u - 0.3516 * u ** 2
                            + 0.2843 * u ** 3 - 0.1036 * u ** 4)
    return [(u, t(u)) for u in reversed(us)] + [(u, -t(u)) for u in us[1:-1]]


def wing(name, le0, te0, le1, te1, tdir, tk, Q, m):
    """A plate of airfoil sections from the root (le0, te0) to the tip."""
    af = airfoil(Q["wing"], tk)
    le0, te0, le1, te1, tdir = map(Vector, (le0, te0, le1, te1, tdir))
    rings = []
    for k in range(Q["spans"] + 1):
        f = k / Q["spans"]
        le, te = le0.lerp(le1, f), te0.lerp(te1, f)
        ch = te - le
        rings.append([le + ch * u + tdir * (v * ch.length) for u, v in af])
    return loft(name, rings, [m])


def blade(name, centre, e, t, a, rs, chord, pitch, thick, sweep, Q, m):
    """A rotor blade along `e`, moving along `t`, its pitch tipping the
    leading edge toward `a` (the thrust): a section at every radius in `rs`
    of `chord(r)`, `pitch(r)`, `thick(r)`, its leading edge swept back by
    `sweep(r)`."""
    centre, e, t, a = map(Vector, (centre, e, t, a))
    rings = []
    for r in rs:
        c, al, tk = chord(r), pitch(r), thick(r)
        d = t * math.cos(al) + a * math.sin(al)
        nrm = -t * math.sin(al) + a * math.cos(al)
        le = 0.25 * c - sweep(r)
        rings.append([centre + e * r + d * (le - u * c) + nrm * (v * c) for u, v in airfoil(Q["foil"], tk)])
    return loft(name, rings, [m])


fTc = pchip([(RA + 0.95, ROOF - 0.01), (RA + 0.82, ROOF + 0.21), (RA + 0.55, ROOF + 0.35),
             (RA + 0.1, ROOF + 0.41), (RA - 0.45, ROOF + 0.39), (RA - 0.75, ROOF + 0.31),
             (RA - 1.9, ROOF + 0.29), (RA - 2.45, ROOF + 0.17), (RA - 2.95, ROOF - 0.15),
             (RA - 3.35, BOOM + 0.25)])
fWc = pchip([(RA + 0.95, 0.16), (RA + 0.82, 0.38), (RA + 0.55, 0.52), (RA - 0.45, 0.55),
             (RA - 0.75, 0.6), (RA - 1.9, 0.58), (RA - 2.45, 0.48), (RA - 2.95, 0.28), (RA - 3.35, 0.1)])


def cowling(Q):
    """The hump over the cabin's back: the transmission's fairing round the
    mast, the engine's cowl behind it tapering into the boom, its foot sunk
    in the skin."""
    n = Q["cowl"]
    rings = []
    for k in range(n + 1):
        f = k / n
        y = (RA + 0.95) - 4.3 * (f ** 1.15)
        top, w = float(fTc(y)), float(fWc(y))
        zb = min(ROOF - 0.2, float(fT(y)) - 0.1)
        zc = zb + 0.42 * (top - zb)
        ring = []
        for j in range(Q["ring"]):
            th = 2 * math.pi * j / Q["ring"]
            c, s = math.sin(th), -math.cos(th)
            ex = 3.2 if s > 0 else 2.6
            ring.append(Vector((w * math.copysign(abs(c) ** (2 / ex), c), y,
                                zc + (top - zc if s > 0 else zc - zb) * math.copysign(abs(s) ** (2 / ex), s))))
        rings.append(ring)
    loft("cowl", rings, [PAINT])
    # the engine's intakes either side, its exhaust behind, the collar
    # the mast leaves the fairing through
    for sx in (1, -1):
        y0, y1 = RA - 1.55, RA - 0.95
        w = float(fWc((y0 + y1) / 2))
        box("intake", (sx * (w - 0.004), (y0 + y1) / 2, ROOF + 0.06), (0.02, y1 - y0, 0.2), DARK, bevel=0)
        if Q["full"]:
            for k in range(5):
                yk = y0 + (k + 0.5) * (y1 - y0) / 5
                box("louvre", (sx * (w + 0.006), yk, ROOF + 0.06), (0.012, 0.02, 0.19), METAL, bevel=0)
    a = Vector((0.06, RA - 2.42, ROOF + 0.07))
    b = Vector((0.08, RA - 2.92, ROOF + 0.24))
    cyl("exhaust", a, b, 0.115, METAL, r2=0.14, seg=20)
    cyl("exhaust_in", b - (b - a).normalized() * 0.03, b + (b - a).normalized() * 0.002, 0.125, DARK, seg=20)
    zt = float(fTc(RA))
    cyl("collar", (0, RA, zt - 0.06), (0, RA, zt + 0.05), 0.15, DARK, r2=0.11, seg=24)


def tail(Q):
    """The fins, the stabiliser with its end plates, the tail rotor's
    gearbox and the tail skid."""
    zb = BOOM + 0.08
    wing("fin", (0, Y_END + 0.75, zb), (0, TAIL + 0.04, zb), (0, TAIL + 0.42, FIN_TOP),
         (0, TAIL, FIN_TOP - 0.03), (1, 0, 0), 0.13, Q, PAINT)
    wing("ventral", (0, Y_END + 0.55, BOOM - 0.08), (0, TAIL + 0.08, BOOM - 0.08),
         (0, TAIL + 0.42, FIN_FOOT), (0, TAIL + 0.02, FIN_FOOT + 0.03), (1, 0, 0), 0.13, Q, PAINT)
    tube("tailskid", [(0, TAIL + 0.6, FIN_FOOT + 0.22), (0, TAIL + 0.32, FIN_FOOT + 0.02),
                      (0, TAIL + 0.03, FIN_FOOT + 0.05)], 0.016, METAL, smooth_n=Q["tube"])
    ys = RA + 0.72 * (TAIL_HUB.y - RA)
    zs = float(section(ys)[0]) + 0.02
    span = 1.1
    for sx in (1, -1):
        wing("stab", (0, ys + 0.24, zs), (0, ys - 0.26, zs), (sx * span, ys + 0.2, zs),
             (sx * span, ys - 0.24, zs), (0, 0, 1), 0.12, Q, PAINT)
        wing("plate", (sx * span, ys + 0.16, zs - 0.18), (sx * span, ys - 0.28, zs - 0.18),
             (sx * span, ys - 0.06, zs + 0.3), (sx * span, ys - 0.38, zs + 0.3), (1, 0, 0), 0.1, Q, TRIM)
        ellipsoid("nav", (sx * (span + 0.035), ys - 0.08, zs + 0.04), (0.02, 0.04, 0.025),
                  LAMP_G if sx > 0 else LAMP)
    gx = TSIDE * 0.1
    cyl("gearbox", (0, TAIL_HUB.y + 0.02, TAIL_HUB.z), (2 * gx, TAIL_HUB.y + 0.02, TAIL_HUB.z), 0.16, PAINT,
        r2=0.1, seg=20)
    cyl("tr_shaft", (gx, TAIL_HUB.y, TAIL_HUB.z), (TAIL_HUB.x - TSIDE * 0.05, TAIL_HUB.y, TAIL_HUB.z),
        0.035, METAL, seg=16)
    ellipsoid("beacon", (0, TAIL + 0.22, FIN_TOP + 0.015), (0.035, 0.07, 0.03), LAMP)
    if Q["full"]:
        cyl("whip", (0, RA - 3.4, float(fB(RA - 3.4)) + 0.02), (0, RA - 3.85, float(fB(RA - 3.4)) - 0.38),
            0.006, DARK, seg=6)


def skids(Q):
    """The two skids on their arched cross tubes, shod where they bear;
    the right skid clear between the tubes for the skier."""
    f, b, z = SKID["front"], SKID["back"], SKID_Z
    r = SKID["tube"]
    for sx in (1, -1):
        x = sx * TRACK
        tube("skid", [(x, b, z + 0.07), (x, b + 0.13, z + 0.006), (x, b + 0.35, z), (x, f - 0.4, z),
                      (x, f - 0.18, z + 0.03), (x, f - 0.06, z + 0.12), (x, f, z + 0.24),
                      (x, f - 0.03, z + 0.32)], r, METAL, smooth_n=Q["tube"])
        for c in SKID["cross"]:
            box("shoe", (x, c, z - r + 0.004), (0.05, 0.34, 0.012), DARK, bevel=0)
            box("saddle", (x, c, z + 0.05), (0.075, 0.12, 0.07), DARK, bevel=0)
            box("fitting", (sx * 0.48, c, FLOOR - 0.02), (0.16, 0.13, 0.08), DARK, bevel=0)
    for c in SKID["cross"]:
        half = [(TRACK, z + 0.03), (TRACK - 0.02, 0.22), (TRACK - 0.1, 0.45), (TRACK - 0.28, 0.6),
                (TRACK - 0.55, FLOOR - 0.055), (0, FLOOR - 0.065)]
        path = [(-x, zz) for x, zz in half] + [(x, zz) for x, zz in reversed(half[:-1])]
        tube("cross", [(x, c, zz) for x, zz in path], 0.045, METAL, smooth_n=Q["tube"])


def basket(Q):
    """The ski basket on the LEFT skid: an aluminium cage outboard of it,
    braced to the skid and the cross tubes, a few skis in it."""
    x0, x1 = -(TRACK + 0.07), -(TRACK + 0.45)
    y0, y1 = SKID["back"] + 0.25, SKID["front"] - 0.15
    z0, z1 = 0.14, 0.5
    rr = 0.014
    for x in (x0, x1):
        for z in (z0, z1):
            cyl("rail", (x, y0, z), (x, y1, z), rr, METAL, seg=12)
    n = 6 if Q["full"] else 2
    for k in range(n + 1):
        y = y0 + (y1 - y0) * k / n
        cyl("rung", (x0, y, z0), (x1, y, z0), rr, METAL, seg=12)
        cyl("rung", (x1, y, z0), (x1, y, z1), rr, METAL, seg=12)
        if k in (0, n):
            cyl("rung", (x0, y, z0), (x0, y, z1), rr, METAL, seg=12)
            cyl("rung", (x0, y, z1), (x1, y, z1), rr, METAL, seg=12)
    box("floor", ((x0 + x1) / 2, (y0 + y1) / 2, z0 + 0.008), (x0 - x1, y1 - y0, 0.006), DARK, bevel=0)
    for c in SKID["cross"]:
        cyl("brace", (x0, c, z1), (-TRACK + 0.02, c, 0.3), 0.018, METAL, seg=12)
        cyl("brace", (x0, c, z0), (-TRACK, c, SKID_Z + 0.05), 0.018, METAL, seg=12)
    if Q["full"]:
        for k, (m, dx) in enumerate(((TRIM, 0.07), (TRIM, 0.16), (PAINT, 0.25), (DARK, 0.31))):
            x = x0 - dx
            ya, yb = y0 + 0.2 + 0.05 * k, y0 + 0.2 + 0.05 * k + 1.8
            box("ski", (x, (ya + yb) / 2, z0 + 0.02 + 0.016 * (k % 2)), (0.085, yb - ya, 0.014), m, bevel=0)
            box("tip", (x, yb + 0.05, z0 + 0.05 + 0.016 * (k % 2)), (0.08, 0.13, 0.012), m,
                rot=(0.5, 0, 0), bevel=0)


def details(Q):
    """The doors' handles, a belly beacon, an antenna on the cowl."""
    for sx in (1, -1):
        for y in (RA + 1.72, RA + 0.32):
            box("handle", (side_x(y, 1.27, sx) + sx * 0.012, y, 1.27), (0.02, 0.14, 0.025), METAL, bevel=0)
    ellipsoid("belly_beacon", (0, RA - 0.6, float(fB(RA - 0.6)) - 0.015), (0.04, 0.07, 0.03), LAMP)
    if Q["full"]:
        box("antenna", (0, RA - 2.1, float(fTc(RA - 2.1)) + 0.07), (0.01, 0.18, 0.13), DARK,
            rot=(0.25, 0, 0), bevel=0)


def rotor(Q):
    """The main rotor: the mast, the swashplate and its links, the three-
    armed hub with a sleeve and an elastomer to each arm, the blades —
    chord 0.355 m, twisted 8 degrees from root to tip, the last 0.35 m swept
    and tapered, the tips banded in the trim."""
    R, nb = ROTOR["radius"], ROTOR["blades"]
    rs = {
        None: list(np.linspace(0.5, 0.8, 5)) + list(np.linspace(0.9, R - 0.4, 12))
        + list(np.linspace(R - 0.35, R, 8)),
        "lod0": [0.5, 0.62, 0.78, 1.5, 2.8, 4.0, 4.8, R - 0.3, R - 0.12, R],
        "lod1": [0.5, 0.78, 2.8, R - 0.3, R],
    }[Q["blade"]]
    c0, r0 = 0.355, rs[0]
    chord = lambda r: (0.16 + (c0 - 0.16) * float(sstep(r0, 0.8, r))) * (1 - 0.4 * float(sstep(R - 0.35, R, r)))
    pitch = lambda r: math.radians(9 - 8 * (r - r0) / (R - r0))
    thick = lambda r: 0.12 + 0.25 * (1 - float(sstep(r0, 0.8, r)))
    sweep = lambda r: 0.12 * float(sstep(R - 0.35, R, r)) ** 1.5
    zt = float(fTc(RA))
    cyl("mast", (0, RA, zt - 0.05), HUB + Vector((0, 0, -0.03)), 0.07, METAL, seg=20)
    cyl("swash", HUB + Vector((0, 0, -0.33)), HUB + Vector((0, 0, -0.29)), 0.22, DARK, seg=28)
    cyl("swash_top", HUB + Vector((0, 0, -0.29)), HUB + Vector((0, 0, -0.25)), 0.2, METAL, seg=28)
    cyl("hub", HUB + Vector((0, 0, -0.05)), HUB + Vector((0, 0, 0.03)), 0.17, METAL, seg=28)
    ellipsoid("cap", HUB + Vector((0, 0, 0.04)), (0.12, 0.12, 0.07), METAL)
    tip_from = R - 0.32
    for k in range(nb):
        ph = -math.pi / 2 + 2 * math.pi * k / nb
        e = Vector((math.cos(ph), math.sin(ph), 0))
        t = Vector((math.sin(ph), -math.cos(ph), 0))
        box("arm", HUB + e * 0.24, (0.48, 0.12, 0.045), DARK, rot=(0, 0, ph), bevel=0 if GAME else 0.006)
        cyl("sleeve", HUB + e * 0.14 + Vector((0, 0, -0.07)), HUB + e * 0.55 + Vector((0, 0, -0.04)),
            0.055, METAL, r2=0.045, seg=16)
        box("adapter", HUB + e * 0.36 + Vector((0, 0, -0.1)), (0.12, 0.1, 0.07), DARK, rot=(0, 0, ph), bevel=0)
        horn = HUB + e * 0.34 + t * 0.1 + Vector((0, 0, -0.06))
        box("horn", horn, (0.05, 0.1, 0.03), METAL, rot=(0, 0, ph), bevel=0)
        if Q["full"]:
            lk = HUB + (e * math.cos(0.35) + t * math.sin(0.35)) * 0.2 + Vector((0, 0, -0.27))
            cyl("link", lk, horn, 0.012, METAL, seg=8)
        a = Vector((0, 0, 1))
        blade("blade", HUB + Vector((0, 0, -0.04)), e, t, a, [r for r in rs if r <= tip_from] + [tip_from],
              chord, pitch, thick, sweep, Q, ROTOR_M)
        blade("tipband", HUB + Vector((0, 0, -0.04)), e, t, a, [tip_from] + [r for r in rs if r > tip_from],
              chord, pitch, thick, sweep, Q, TRIM)


def tail_rotor(Q):
    """The tail rotor: two blades on a teetering hub, its top blade going
    aft; its thrust pushes the tail against the main rotor's torque."""
    R, nb = TAILR["radius"], TAILR["blades"]
    rs = [0.1, 0.16, 0.4, 0.7, R] if Q["full"] else [0.1, 0.3, R]
    if not GAME:
        rs = list(np.linspace(0.1, R, 12))
    a = Vector((-TSIDE, 0, 0))
    hx = TAIL_HUB.x
    cyl("tr_hub", Vector((hx - 0.07, TAIL_HUB.y, TAIL_HUB.z)), Vector((hx + 0.07, TAIL_HUB.y, TAIL_HUB.z)),
        0.06, METAL, seg=16)
    ellipsoid("tr_cap", Vector((hx + TSIDE * 0.075, TAIL_HUB.y, TAIL_HUB.z)), (0.03, 0.05, 0.05), DARK)
    for k in range(nb):
        ps = math.pi / 2 + 2 * math.pi * k / nb
        e = Vector((0, math.cos(ps), math.sin(ps)))
        t = Vector((0, -math.sin(ps), math.cos(ps)))
        blade("tr_blade", TAIL_HUB, e, t, a, rs, lambda r: 0.18 - 0.02 * r / R,
              lambda r: math.radians(10 - 5 * r / R), lambda r: 0.12 + 0.1 * (1 - float(sstep(0.1, 0.25, r))),
              lambda r: 0.0, Q, ROTOR_M)


# ---------------------------------------------------------------- assembly
def made_since(before):
    return [o for o in COL.objects if o not in before]


def join(objs, name, origin):
    """Parts into one rigid mesh, its origin at `origin` (modifiers applied,
    curves made meshes)."""
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
    ob.data.transform(Matrix.Translation(-origin))
    ob.location = origin
    # Triangulated here, on fixed diagonals, rather than left to the export.
    tri = ob.modifiers.new("tri", "TRIANGULATE")
    tri.quad_method, tri.ngon_method, tri.keep_custom_normals = "FIXED", "CLIP", True
    return ob


def build(detail):
    """The helicopter at one cut: the root and its three nodes."""
    Q = DETAIL[detail]
    before = set(COL.objects)
    build_skin(Q)
    cowling(Q)
    tail(Q)
    skids(Q)
    basket(Q)
    details(Q)
    body = join(made_since(before), "heli_body", Vector((0, 0, 0)))
    before = set(COL.objects)
    rotor(Q)
    rot = join(made_since(before), "heli_rotor", HUB)
    before = set(COL.objects)
    tail_rotor(Q)
    tr = join(made_since(before), "heli_tail_rotor", TAIL_HUB)
    root = bpy.data.objects.new("heli", None)
    COL.objects.link(root)
    root["frame"] = "skid datum: x right, y forward (the nose), z up"
    for o in (body, rot, tr):
        o.parent = root
    counts = {o.name: lib._tri_count([o]) for o in (body, rot, tr)}
    tag = "render" if detail == "render" else "game"
    print("TRIANGLES", tag, detail, sum(counts.values()), counts)
    return root, [body, rot, tr]


def cameras():
    """The studio's views of a machine 11 m long under a rotor 10.7 m across."""
    for o in [o for o in COL.objects if o.type == "CAMERA"]:
        bpy.data.objects.remove(o)
    cams = {}
    views = {
        "three": ((8.0, 9.5, 4.0), (0, -1.0, 1.6), 32), "left3": ((-8.0, 9.5, 4.0), (0, -1.0, 1.6), 32),
        "side": ((24, -1.3, 1.8), (0, -1.3, 1.8), 50), "front": ((0, 26, 1.9), (0, 0, 1.7), 55),
        "rear3": ((7, -15, 4.5), (0, -2, 1.6), 35), "top": ((0, -1.0, 32), None, 45),
        "hub": ((2.2, 2.6, 3.9), (0, 0.1, 2.9), 40), "skid": ((4.2, 3.2, 1.3), (0.6, 0.2, 0.8), 30),
        "basket": ((-4.0, 3.5, 1.6), (-1.2, 0.1, 0.5), 32), "tail": ((3.5, -9.6, 2.4), (0, -6.0, 1.7), 40),
    }
    for name, (loc, target, lens) in views.items():
        cd = bpy.data.cameras.new(name)
        cd.lens = lens
        cd.clip_end = 300
        cam = bpy.data.objects.new(name, cd)
        COL.objects.link(cam)
        cam.location = loc
        if target is None:
            cam.rotation_euler = (0, 0, 0)
        else:
            empty = bpy.data.objects.new(f"{name}_at", None)
            COL.objects.link(empty)
            empty.location = target
            tt = cam.constraints.new("TRACK_TO")
            tt.target = empty
            tt.track_axis = "TRACK_NEGATIVE_Z"
            tt.up_axis = "UP_Y"
        cams[name] = cam
    return cams


def render(cams, views, tag):
    for v in views:
        scene.camera = cams[v]
        scene.render.filepath = os.path.join(OUT, f"{NAME}-{tag}-{v}.png")
        bpy.ops.render.render(write_still=True)


def export(root, path):
    lib._select_only([root] + list(root.children))
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_apply=True, export_extras=True,
                              export_skins=False, export_animations=False, export_morph=False)


def remove(root):
    for o in [root] + list(root.children):
        bpy.data.objects.remove(o)
    for me in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(me)


lib._studio((0, -1.3, 1.6), 12.0)
CAMS = cameras()
lib._cycles(SAMPLES)
ONLY = [v for v in os.environ.get("VIEWS", "").split(",") if v]
pick = lambda default: [v for v in (ONLY or default) if v in CAMS]

if not GAME:
    root, _ = build("render")
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, f"{NAME}-render.blend"))
    render(CAMS, pick(list(CAMS)), "render")
else:
    for lod, views in (("lod0", ["three", "left3", "side", "top"]), ("lod1", ["three"])):
        root, _ = build(lod)
        if lod == "lod0":
            bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, f"{NAME}-game.blend"))
        render(CAMS, pick(views), "game" if lod == "lod0" else "game-lod1")
        export(root, os.path.join(OUT, f"{NAME}-{lod}.glb"))
        remove(root)

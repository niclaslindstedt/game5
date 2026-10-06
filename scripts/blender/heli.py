# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE HELI-SKI HELICOPTER MODELLED IN BLENDER off the game's own data:
# `HELI` (engine/game/defs/heli.ts) handed in whole by
# `scripts/blender.mjs --kind=heli` — the driver, and the only way this runs.
# The rotor's hub, radius and blades, the tail rotor's hub, side, radius and
# blades, the skids and their cross tubes, the cabin's width, floor and roof,
# the boom's height, the nose's and the fin's reach and the fin's top and
# the ventral fin's foot (the crash's strike points) are all read off it;
# what is drawn between them is the light single-engine utility helicopter
# heli-ski operators fly, its proportions traced off that class's published
# three-view: a short, tall cabin whose nose rounds over two metres from
# the roof down to a tip a third of the way up and over a metre and a half
# under it, a flat floor, a boxy transmission and engine cowl on the roof,
# and a conical boom whose top runs level while its belly rises straight to
# the tail.
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
# THE MATERIALS, by name: `trim` (the livery's white ground), `paint` (its
# colour: the belly band, the cowling, the fins, the blade tips), `stripe`
# (its pinstripe), `glass` (dark, glossy, opaque — there is no cabin behind
# it), `metal`, `dark` (seams, grilles, the anti-glare panel, fittings),
# `rotor` (the blades), `lamp` (red: the beacons and the left navigation
# light) and `lamp_green` (the right one), both emissive. The paint is a
# satin finish under a thin clear coat — a working machine's, not a toy's.
#
# THE CABIN'S SKIN is ONE parametric surface — a superellipse section at
# every station along y, closed into the nose and the boom's end — and
# every window, door seam and livery line on it is a FIELD on that surface
# whose zero contour is traced and laid into the mesh as constrained edges
# (a constrained Delaunay triangulation in the surface's own (y, angle)
# plane): every outline is crisp at any triangle budget, flush, its own
# material, and the normals are the surface's own, so a coarse cut still
# shades smooth.

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
FINS = [p for p in BODY["strike"] if p["x"] == 0 and p["z"] < TAIL_HUB.y - 0.4]
FIN_TOP = max(p["y"] for p in FINS)           # the fin's top strike point
FIN_FOOT = min(p["y"] for p in FINS)          # the ventral fin's foot
TRACK = SKID["track"] / 2
SKID_Z = SKID["y"]


def aft(d):
    """The station `d` metres behind the nose's tip."""
    return NOSE - d


def ht(f):
    """The height a share `f` of the way from the cabin's floor to its roof."""
    return FLOOR + f * (ROOF - FLOOR)


# Where the skin changes character, off the data: the nose rounding from
# the roof over its first 2 m, from the floor over its first 1.5 m and in
# plan over its first 1.3 m, its tip a third of the way up the cabin; the
# boom's top running level from behind the cowl, its belly rising straight
# from behind the cabin to its end a little short of the fin's top.
TIP = ht(0.34)
LT, LB, LW = 2.0, 1.5, 1.3
BOOM_TOP = BOOM + 0.17
Y_END = TAIL + 0.62
YB0 = RA - 1.4
R0 = 0.9                      # the metric the surface's angle is laid out in
CAP = 0.06

# ---------------------------------------------------------------- materials
TRIM = mat("trim", (0.80, 0.81, 0.82), rough=0.42, coat=0.35)
PAINT = mat("paint", (0.50, 0.03, 0.026), rough=0.42, coat=0.35)
STRIPE = mat("stripe", (0.02, 0.035, 0.11), rough=0.42, coat=0.35)
GLASS = mat("glass", (0.045, 0.06, 0.08), rough=0.1)
METAL = mat("metal", (0.66, 0.67, 0.69), metal=0.75, rough=0.4)
DARK = mat("dark", (0.022, 0.023, 0.026), rough=0.7)
ROTOR_M = mat("rotor", (0.05, 0.052, 0.056), rough=0.55)
LAMP = mat("lamp", (0.8, 0.03, 0.02), rough=0.3, emit=(1.0, 0.05, 0.03), emit_str=6.0)
LAMP_G = mat("lamp_green", (0.03, 0.7, 0.15), rough=0.3, emit=(0.05, 1.0, 0.25), emit_str=6.0)
SKIN_MATS = [TRIM, PAINT, DARK, GLASS, STRIPE]   # the skin's slots, by index
for _m in (TRIM, PAINT, STRIPE):
    _m.node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.12
# The shelf sets every material's coat roughness; on one with no coat that
# alone exports a clearcoat extension, which costs a physical material in
# three.js for nothing — so it goes back to Blender's default.
for _m in (GLASS, METAL, DARK, ROTOR_M, LAMP, LAMP_G):
    _m.node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.03

# How fine each cut is: the render's, the game's LOD0 and its LOD1.
DETAIL = {
    "render": dict(dy=0.02, sp=0.022, boom=2.0, tol=0.0015, seg=0.03, seams=True, accent=True,
                   cowl=60, ring=48, wing=14, spans=6, foil=14, blade=None, pipe=16, smooth=8, full=True),
    "lod0": dict(dy=0.13, sp=0.15, boom=3.0, tol=0.006, seg=0.16, seams=True, accent=True,
                 cowl=18, ring=20, wing=5, spans=2, foil=5, blade="lod0", pipe=8, smooth=3, full=True),
    "lod1": dict(dy=0.26, sp=0.28, boom=3.0, tol=0.02, seg=0.35, seams=False, accent=False,
                 cowl=10, ring=12, wing=3, spans=1, foil=3, blade="lod1", pipe=6, smooth=2, full=False),
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


# The side view's top and bottom and the plan's half width aft of the nose.
fT = pchip([(Y_END, BOOM_TOP - 0.03), (RA - 1.65, BOOM_TOP), (RA - 1.25, BOOM_TOP + 0.13),
            (RA - 0.85, ROOF - 0.1), (RA - 0.35, ROOF - 0.015), (RA + 0.3, ROOF), (aft(LT), ROOF)])
_bend = BOOM - 0.12
fB = pchip([(Y_END, _bend), ((Y_END + YB0) / 2, (_bend + FLOOR + 0.48) / 2), (YB0, FLOOR + 0.48),
            (RA - 0.85, FLOOR + 0.13), (RA - 0.45, FLOOR + 0.02), (RA - 0.25, FLOOR), (aft(LB), FLOOR)])
fW = pchip([(Y_END, 0.13), (aft(8.2), 0.21), (aft(4.92), 0.41), (aft(4.07), 0.6), (aft(3.23), HALF - 0.07),
            (aft(2.4), HALF), (aft(LW), HALF)])


def section(y):
    """The section at `y`: its widest line's height, the half heights above
    and below it, the half width, and the superellipse's exponents above and
    below (a round boom; a cabin with near-upright sides, its roof and floor
    rounded into them)."""
    y = np.asarray(y, float)
    T, B, W = fT(y), fB(y), fW(y)
    s = sstep(RA - 1.7, RA - 0.3, y)
    NT, NB = 2.0 + 1.0 * s, 2.0 + 1.4 * s
    ut = np.clip((y - aft(LT)) / LT, 0, 1)
    ub = np.clip((y - aft(LB)) / LB, 0, 1)
    uw = np.clip((y - aft(LW)) / LW, 0, 1)
    T = np.where(y > aft(LT), TIP + (ROOF - TIP) * np.sqrt(1 - ut ** 2), T)
    B = np.where(y > aft(LB), TIP - (TIP - FLOOR) * (1 - ub ** 2.3) ** (1 / 2.3), B)
    W = np.where(y > aft(LW), HALF * (1 - uw ** 2.3) ** (1 / 2.3), W)
    v = np.clip((Y_END + CAP - y) / CAP, 0, 1)
    f = np.sqrt(1 - v * v)
    zc = B + 0.5 * (T - B)
    return zc, (T - zc) * f, (zc - B) * f, W * f, NT, NB


def skin(y, th):
    """The surface at station `y`, angle `th` (0 the belly's centre line,
    a quarter turn the right side, half a turn the roof)."""
    zc, ht_, hb, w, nt, nb = section(y)
    c, s = np.sin(th), -np.cos(th)
    top = s > 0
    n = np.where(top, nt, nb)
    x = w * np.sign(c) * np.abs(c) ** (2 / n)
    z = zc + np.where(top, ht_, hb) * np.sign(s) * np.abs(s) ** (2 / n)
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


def top_z(y, x):
    """The skin's upper surface over the point `x` off the centre line at
    station `y` (its side, past its half width)."""
    zc, h, _, w, nt, _ = (float(np.asarray(v)) for v in section(y))
    r = min(abs(x) / max(w, 1e-6), 1.0)
    return zc + h * (1 - r ** nt) ** (1 / nt)


# ---------------------------------------------------------------- the skin's fields
def rint(fs, r):
    """The intersection of inside-positive fields, its corners rounded to `r`."""
    d = [r - f for f in fs]
    q = np.sqrt(sum(np.maximum(di, 0) ** 2 for di in d))
    return -(q + np.minimum(np.maximum.reduce(d), 0) - r)


def edge(D, Z, p, q):
    """Metres aft of the side view's line through `p` and `q` ((d, z), `q`
    the upper)."""
    nd, nz = q[1] - p[1], -(q[0] - p[0])
    return ((D - p[0]) * nd + (Z - p[1]) * nz) / math.hypot(nd, nz)


# The side view's lines, as (metres behind the nose, height): the front
# door's leading edge (the windscreen's pillar just ahead of it) and
# trailing edge, both leaning forward at the foot, and the rear door's
# trailing edge.
DOOR1 = ((0.78, ht(0.17)), (1.2, ht(0.86)))
DOOR2 = ((1.68, ht(0.16)), (1.92, ht(0.83)))
DOOR3 = ((2.66, ht(0.15)), (2.84, ht(0.84)))
SILL, HEAD = ht(0.19), ht(0.835)
WIN0, WIN1 = ht(0.44), ht(0.785)
# The livery's band: red under this line (metres behind the nose → height),
# low along the cabin and sweeping up behind it onto the boom's side.
SWEEP = pchip([(0.0, ht(0.3)), (0.6, ht(0.21)), (1.5, ht(0.185)), (2.7, ht(0.2)), (3.6, ht(0.33)),
               (4.4, ht(0.56)), (5.3, BOOM - 0.02), (NOSE - Y_END + 0.1, BOOM - 0.02)])


def screen_foot(xs):
    """The windscreen's lower edge: a hand over the nose's tip, running
    back round the nose nearly level to the pillar's foot."""
    return TIP + 0.19 - 0.05 * np.clip(xs / HALF, 0, 1) ** 2


def regions(X, Y, Z, seams, accent, full):
    """Every outline on the skin as (slot, priority, field): the windows,
    the doors' seams, the anti-glare panel, the livery. The highest field
    that is positive wins; the rest of the skin is `trim`."""
    out = []
    D = NOSE - Y
    for sx in (1, -1):
        xs = sx * X
        side = xs - 0.28
        foot = screen_foot(xs)
        screen = rint([-edge(D, Z, *DOOR1) - 0.045, Z - foot, 1.3 - D, xs + 0.001], 0.04)
        roofwin = rint([D - 1.33, 1.7 - D, xs - 0.13, 0.6 - xs, Z - (ROOF - 0.3)], 0.06)
        chin = rint([D - 0.26, -edge(D, Z, *DOOR1) - 0.12, Z - ht(0.15), ht(0.38) - Z], 0.1)
        door1 = rint([edge(D, Z, *DOOR1), -edge(D, Z, *DOOR2), Z - SILL, HEAD - Z], 0.06)
        win1 = rint([edge(D, Z, *DOOR1) - 0.055, -edge(D, Z, *DOOR2) - 0.06, Z - WIN0, WIN1 - Z], 0.08)
        low1 = rint([edge(D, Z, *DOOR1) - 0.08, -edge(D, Z, *DOOR2) - 0.12, Z - ht(0.2), ht(0.38) - Z], 0.09)
        door2 = rint([edge(D, Z, *DOOR2) - 0.05, -edge(D, Z, *DOOR3), Z - SILL, HEAD - Z], 0.06)
        win2 = rint([edge(D, Z, *DOOR2) - 0.11, -edge(D, Z, *DOOR3) - 0.07, Z - WIN0, WIN1 - Z], 0.1)
        hatch = rint([D - 4.1, 4.75 - D, Z - ht(0.31), ht(0.66) - Z], 0.06)
        for f in (screen, np.minimum(roofwin, xs - 0.1), np.minimum(chin, xs - 0.3),
                  np.minimum(win1, side), np.minimum(low1, side), np.minimum(win2, side)):
            out.append((3, 5, f))
        if full:
            # the windscreen's centre post
            out.append((2, 6, np.minimum(0.022 - xs, screen)))
        if seams:
            for f in (door1, door2, hatch):
                out.append((2, 4, np.minimum(0.009 - np.abs(f), side)))
        # the anti-glare panel on the nose, under the windscreen's foot
        out.append((2, 3.5, rint([Z - (foot - 0.09), foot - Z + 0.02, 0.36 - xs, xs + 0.001, 0.6 - D], 0.03)))
    if seams:
        out.append((2, 4, 0.008 - np.abs(D - (NOSE - (RA - 1.62)))))  # the boom's joint
    if accent:
        out.append((4, 3, 0.022 - np.abs(Z - (SWEEP(D) + 0.065))))
    out.append((1, 2, SWEEP(D) - Z))
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
            edge_ = 2 * math.pi if qu > p[1] else 0.0
            yb = p[0] + (edge_ - p[1]) / (qu - p[1]) * (q[0] - p[0])
            cur.append((yb, edge_))
            out.append(cur)
            cur = [(yb, 2 * math.pi - edge_), q]
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
    fields = regions(X, Y, Z, Q["seams"], Q["accent"], Q["full"])
    polys = []
    for _, _, F in fields:
        for line in contours(F, ys, ths):
            for piece in split_seam(line):
                if len(piece) > 2 or (len(piece) == 2 and piece[0] != piece[1]):
                    polys.append(simplify(piece, Q["tol"], Q["seg"]))

    rows, y = [], Y_END
    while y < NOSE - 1e-6:
        rows.append(y)
        f = Q["boom"] if y < RA - 1.9 else (0.6 if y > aft(LT) else 1.0)
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
    best = np.full(len(faces), -1.0)
    for s, prio, F in regions(cx, cyy, cz, Q["seams"], Q["accent"], Q["full"]):
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
def pipe(name, points, r, m, Q, r_end=None):
    """A round tube along `points` (smoothed), its rings carried along the
    path without twisting, closed at both ends — a fixed number of sides at
    every cut, where a bevelled curve drops to a square at the game's."""
    P = catmull(points, False, Q["smooth"]) if len(points) > 2 else [Vector(p) for p in points]
    n = Q["pipe"]
    t0 = (P[1] - P[0]).normalized()
    up = Vector((0, 0, 1)) if abs(t0.z) < 0.9 else Vector((1, 0, 0))
    u = (up - t0 * up.dot(t0)).normalized()
    rings = []
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        u = (u - t * u.dot(t)).normalized()
        v = t.cross(u)
        rr = r if r_end is None else r + (r_end - r) * i / (len(P) - 1)
        rings.append([p + (u * math.cos(2 * math.pi * k / n) + v * math.sin(2 * math.pi * k / n)) * rr
                      for k in range(n)])
    return loft(name, rings, [m])


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


def oval(name, a, b, rx, rz, m, Q, rx2=None, rz2=None):
    """A duct of elliptical section from `a` to `b`, closed at both ends."""
    a, b = Vector(a), Vector(b)
    t = (b - a).normalized()
    u = Vector((0, 0, 1))
    u = (u - t * u.dot(t)).normalized()
    v = t.cross(u)
    n = max(10, Q["pipe"] + 4)
    rings = []
    for p, ex, ez in ((a, rx, rz), (b, rx2 or rx, rz2 or rz)):
        rings.append([p + v * (ex * math.cos(2 * math.pi * k / n)) + u * (ez * math.sin(2 * math.pi * k / n))
                      for k in range(n)])
    return loft(name, rings, [m])


# The cowling over the cabin's back, in the side view and the plan: the
# transmission's fairing rising off the roof ahead of the mast, flat over
# it, the engine's cowl behind falling into the shaft's fairing on the boom.
COWL0, COWL1 = RA + 0.98, RA - 1.68
fTc = pchip([(COWL1, BOOM_TOP + 0.12), (RA - 1.45, BOOM_TOP + 0.24), (RA - 1.2, ROOF + 0.19),
             (RA - 1.0, ROOF + 0.27), (RA + 0.6, ROOF + 0.3), (RA + 0.8, ROOF + 0.28),
             (RA + 0.92, ROOF + 0.18), (COWL0, ROOF + 0.03)])
fWc = pchip([(COWL1, 0.11), (RA - 1.3, 0.37), (RA - 1.0, 0.46), (RA + 0.55, 0.47), (RA + 0.85, 0.41),
             (COWL0, 0.27)])


def cowling(Q):
    """The hump over the cabin's back: flat-sided, its top rounded, its foot
    sunk in the skin wherever the skin is under it; the oil cooler's grille
    in its face, the engine's intakes either side, the exhaust duct out of
    its tail, the collar the mast leaves it through, and the drive shaft's
    fairing along the boom's top."""
    n = Q["cowl"]
    stations = [COWL0 + (COWL1 - COWL0) * (0.5 - 0.5 * math.cos(math.pi * k / n)) for k in range(n + 1)]
    seams = (RA + 0.62, RA - 0.95) if Q["seams"] else ()   # the cowl's panels' joints
    stations = sorted(set(stations) | {ys + e for ys in seams for e in (-0.009, 0.009)}, reverse=True)
    rings = []
    for y in stations:
        top = float(fTc(y))
        w = min(float(fWc(y)), 0.93 * float(section(y)[3]))
        zb = top_z(y, w) - 0.05
        zm = zb + 0.45 * (top - zb)
        ring = []
        for j in range(Q["ring"]):
            th = 2 * math.pi * j / Q["ring"]
            c, s = math.sin(th), -math.cos(th)
            ex = 4.0
            ring.append(Vector((w * math.copysign(abs(c) ** (2 / ex), c), y,
                                zm + (top - zm if s > 0 else zm - zb) * math.copysign(abs(s) ** (2 / ex), s))))
        rings.append(ring)
    loft("cowl", rings, [PAINT, DARK], face_mat=lambda c: int(any(abs(c.y - ys) < 0.009 for ys in seams)))
    # the oil cooler's grille in the fairing's face
    box("cooler", (0, COWL0 - 0.05, ROOF + 0.11), (0.3, 0.04, 0.1), DARK, bevel=0)
    # the engine's intakes: a grille either side, behind the mast
    for sx in (1, -1):
        y0, y1 = RA - 0.95, RA - 0.3
        w = float(fWc((y0 + y1) / 2))
        box("intake", (sx * (w + 0.002), (y0 + y1) / 2, ROOF + 0.16), (0.03, y1 - y0, 0.17), DARK, bevel=0)
        if Q["full"]:
            for k in range(6):
                yk = y0 + (k + 0.5) * (y1 - y0) / 6
                box("louvre", (sx * (w + 0.012), yk, ROOF + 0.16), (0.012, 0.022, 0.16), METAL, bevel=0)
    # the exhaust: a short oval duct out of the cowl's tail, turned up
    a = Vector((0.08, RA - 1.05, ROOF + 0.17))
    b = Vector((0.12, RA - 1.66, ROOF + 0.33))
    oval("exhaust", a, b, 0.2, 0.15, METAL, Q, rx2=0.22, rz2=0.18)
    oval("exhaust_in", b - (b - a).normalized() * 0.05, b + (b - a).normalized() * 0.002, 0.19, 0.155, DARK, Q)
    zt = float(fTc(RA))
    cyl("collar", (0, RA, zt - 0.06), (0, RA, zt + 0.06), 0.16, DARK, r2=0.12, seg=24)
    # the shaft's fairing along the boom's top, to the tail rotor's gearbox
    rings = []
    m = max(4, Q["spans"] * 3)
    for k in range(m + 1):
        y = COWL1 + 0.1 + (TAIL_HUB.y + 0.08 - COWL1 - 0.1) * k / m
        zt_, wf = float(fT(y)), 0.1 - 0.02 * k / m
        ring = []
        for j in range(12):
            th = 2 * math.pi * j / 12
            c, s = math.sin(th), -math.cos(th)
            ring.append(Vector((wf * math.copysign(abs(c) ** 0.5, c), y,
                                zt_ + 0.03 + 0.09 * math.copysign(abs(s) ** 0.5, s))))
        rings.append(ring)
    loft("shaft_fairing", rings, [PAINT])


def tail(Q):
    """The fins — the upper swept back off the boom's end, the ventral
    under it with its tail skid — the stabiliser across the boom with an end
    plate at each tip, the tail rotor's gearbox and the beacons."""
    zt = float(fT(TAIL_HUB.y)) - 0.03
    zb = float(fB(TAIL_HUB.y + 0.1)) + 0.03
    wing("fin", (0, TAIL_HUB.y - 0.12, zt), (0, Y_END + 0.02, zt), (0, TAIL + 0.33, FIN_TOP),
         (0, TAIL, FIN_TOP - 0.02), (1, 0, 0), 0.13, Q, PAINT)
    wing("ventral", (0, TAIL_HUB.y - 0.14, zb), (0, Y_END + 0.02, zb), (0, TAIL + 0.58, FIN_FOOT),
         (0, TAIL + 0.22, FIN_FOOT + 0.04), (1, 0, 0), 0.13, Q, PAINT)
    pipe("tailskid", [(0, TAIL + 0.62, FIN_FOOT + 0.12), (0, TAIL + 0.44, FIN_FOOT - 0.18),
                      (0, TAIL + 0.16, FIN_FOOT - 0.22), (0, TAIL - 0.02, FIN_FOOT - 0.12)], 0.016, METAL, Q)
    ys = TAIL_HUB.y + 1.35
    zs = float(section(ys)[0])
    span = 1.27
    for sx in (1, -1):
        wing("stab", (0, ys + 0.21, zs), (0, ys - 0.21, zs), (sx * span, ys + 0.19, zs),
             (sx * span, ys - 0.2, zs), (0, 0, 1), 0.14, Q, TRIM)
        wing("plate", (sx * span, ys + 0.22, zs - 0.16), (sx * span, ys - 0.26, zs - 0.16),
             (sx * span, ys + 0.02, zs + 0.36), (sx * span, ys - 0.34, zs + 0.36), (1, 0, 0), 0.1, Q, PAINT)
        ellipsoid("nav", (sx * (span + 0.035), ys - 0.05, zs + 0.02), (0.02, 0.04, 0.025),
                  LAMP_G if sx > 0 else LAMP)
    gx = TSIDE * 0.12
    cyl("gearbox", (0, TAIL_HUB.y, TAIL_HUB.z), (2 * gx, TAIL_HUB.y, TAIL_HUB.z), 0.14, PAINT, r2=0.09, seg=20)
    cyl("tr_shaft", (gx, TAIL_HUB.y, TAIL_HUB.z), (TAIL_HUB.x - TSIDE * 0.05, TAIL_HUB.y, TAIL_HUB.z),
        0.035, METAL, seg=16)
    ellipsoid("beacon", (0, TAIL + 0.17, FIN_TOP + 0.015), (0.035, 0.07, 0.03), LAMP)
    ellipsoid("tail_light", (0, TAIL - 0.01, FIN_TOP - 0.25), (0.02, 0.03, 0.04), METAL)


def skids(Q):
    """The two skids on their arched cross tubes — each tube rising out of
    its skid's saddle, rounding over and running in under the belly — the
    skids' toes turned up and shod where they bear; the right skid clear
    between the tubes for the skier."""
    f, b, z = SKID["front"], SKID["back"], SKID_Z
    r = SKID["tube"] * 1.15
    for sx in (1, -1):
        x = sx * TRACK
        pipe("skid", [(x, b - 0.04, z + 0.06), (x, b + 0.06, z + 0.005), (x, b + 0.3, z), (x, f - 0.3, z),
                      (x, f - 0.05, z + 0.02), (x, f + 0.16, z + 0.1), (x, f + 0.32, z + 0.25),
                      (x, f + 0.37, z + 0.38)], r, METAL, Q)
        for c in SKID["cross"]:
            box("shoe", (x, c, z - r + 0.004), (0.06, 0.4, 0.014), DARK, bevel=0)
            box("saddle", (x, c, z + 0.06), (0.1, 0.16, 0.1), DARK, bevel=0)
            box("fitting", (sx * (TRACK - 0.62), c, FLOOR - 0.03), (0.2, 0.14, 0.09), DARK, bevel=0)
        # the boarding step on the front tube, outboard — clear of the seat
        c0 = SKID["cross"][0]
        box("step", (x + sx * 0.06, c0, 0.34), (0.16, 0.26, 0.025), DARK, bevel=0)
        cyl("step_arm", (x, c0, 0.27), (x + sx * 0.12, c0, 0.33), 0.016, METAL, seg=8)
    for c in SKID["cross"]:
        half = [(TRACK, z + 0.04), (TRACK - 0.005, 0.24), (TRACK - 0.03, 0.42), (TRACK - 0.11, 0.56),
                (TRACK - 0.27, 0.64), (TRACK - 0.5, FLOOR - 0.06), (0, FLOOR - 0.075)]
        path = [(-x, zz) for x, zz in half] + [(x, zz) for x, zz in reversed(half[:-1])]
        pipe("cross", [(x, c, zz) for x, zz in path], 0.055, METAL, Q)


def basket(Q):
    """The ski basket on the LEFT skid: an aluminium cage outboard of it,
    braced to the cross tubes, a few skis in it."""
    x0, x1 = -(TRACK + 0.08), -(TRACK + 0.46)
    c0, c1 = SKID["cross"]
    y0, y1 = c1 - 0.55, c0 + 0.55
    z0, z1 = 0.16, 0.5
    rr = 0.016
    for x in (x0, x1):
        for zz in (z0, z1):
            cyl("rail", (x, y0, zz), (x, y1, zz), rr, METAL, seg=12)
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
        cyl("brace", (x0, c, z1), (-TRACK + 0.03, c, 0.4), 0.02, METAL, seg=12)
        cyl("brace", (x0, c, z0), (-TRACK, c, SKID_Z + 0.06), 0.02, METAL, seg=12)
    if Q["full"]:
        for k, (m, dx) in enumerate(((TRIM, 0.07), (PAINT, 0.15), (STRIPE, 0.23), (DARK, 0.3))):
            x = x0 - dx
            ya, yb = y0 + 0.15 + 0.05 * k, y0 + 0.15 + 0.05 * k + 1.75
            box("ski", (x, (ya + yb) / 2, z0 + 0.02 + 0.016 * (k % 2)), (0.085, yb - ya, 0.014), m, bevel=0)
            box("tip", (x, yb + 0.05, z0 + 0.05 + 0.016 * (k % 2)), (0.08, 0.13, 0.012), m,
                rot=(0.5, 0, 0), bevel=0)


def details(Q):
    """The doors' handles, the sliding door's rails on the right, the
    landing lights under the chin, the belly beacon, the antennas."""
    for sx in (1, -1):
        for d in (1.78, 2.62):
            y = aft(d)
            box("handle", (side_x(y, ht(0.4), sx) + sx * 0.012, y, ht(0.4)), (0.02, 0.13, 0.025), METAL, bevel=0)
    # the rear door slides aft along a rail under the cowl and one at the sill
    sx = TSIDE
    for zz, d0 in ((ht(0.82), 2.87), (SILL + 0.03, 2.75)):
        ya, yb = aft(d0), aft(4.0)
        xa, xb = side_x(ya, zz, sx), side_x(yb, zz, sx)
        cyl("rail", (xa + sx * 0.012, ya, zz), (xb + sx * 0.012, yb, zz), 0.014, DARK, seg=8)
    for sx in (1, -1):
        y = aft(1.05)
        cyl("landing", (sx * 0.22, y, FLOOR + 0.02), (sx * 0.22, y, FLOOR - 0.03), 0.07, METAL, seg=16)
        cyl("landing_lens", (sx * 0.22, y, FLOOR - 0.025), (sx * 0.22, y, FLOOR - 0.035), 0.055, GLASS, seg=16)
    ellipsoid("belly_beacon", (0, RA - 0.6, float(fB(RA - 0.6)) - 0.015), (0.04, 0.07, 0.03), LAMP)
    if Q["full"]:
        box("antenna", (0, RA - 0.6, float(fTc(RA - 0.6)) + 0.07), (0.012, 0.16, 0.13), DARK,
            rot=(0.3, 0, 0), bevel=0)
        box("antenna", (0, aft(2.3), ROOF + 0.06), (0.01, 0.12, 0.1), DARK, rot=(0.3, 0, 0), bevel=0)
        y = RA - 2.2
        cyl("whip", (0, y, float(fB(y)) + 0.02), (0, y - 0.45, float(fB(y)) - 0.38), 0.006, DARK, seg=6)


def rotor(Q):
    """The main rotor: the mast, the swashplate and its links, the three-
    armed star of the hub with an elastomer bearing and a sleeve to each
    arm, the dome over it, and the blades — chord 0.35 m, twisted 8 degrees
    from root to tip, the last 0.35 m swept and tapered, the tips banded in
    the livery."""
    R, nb = ROTOR["radius"], ROTOR["blades"]
    rs = {
        None: list(np.linspace(0.5, 0.8, 5)) + list(np.linspace(0.9, R - 0.4, 12))
        + list(np.linspace(R - 0.35, R, 8)),
        "lod0": [0.5, 0.62, 0.78, 1.5, 2.8, 4.0, 4.8, R - 0.3, R - 0.12, R],
        "lod1": [0.5, 0.78, 2.8, R - 0.3, R],
    }[Q["blade"]]
    c0, r0 = 0.35, rs[0]
    chord = lambda r: (0.17 + (c0 - 0.17) * float(sstep(r0, 0.8, r))) * (1 - 0.4 * float(sstep(R - 0.35, R, r)))
    pitch = lambda r: math.radians(9 - 8 * (r - r0) / (R - r0))
    thick = lambda r: 0.12 + 0.25 * (1 - float(sstep(r0, 0.8, r)))
    sweep = lambda r: 0.12 * float(sstep(R - 0.35, R, r)) ** 1.5
    zt = float(fTc(RA))
    cyl("mast", (0, RA, zt - 0.05), HUB + Vector((0, 0, -0.03)), 0.075, METAL, seg=20)
    cyl("swash", HUB + Vector((0, 0, -0.34)), HUB + Vector((0, 0, -0.29)), 0.23, DARK, seg=28)
    cyl("swash_top", HUB + Vector((0, 0, -0.29)), HUB + Vector((0, 0, -0.25)), 0.21, METAL, seg=28)
    cyl("hub", HUB + Vector((0, 0, -0.06)), HUB + Vector((0, 0, 0.02)), 0.17, METAL, seg=28)
    ellipsoid("cap", HUB + Vector((0, 0, 0.05)), (0.17, 0.17, 0.1), METAL)
    tip_from = R - 0.32
    for k in range(nb):
        ph = -math.pi / 2 + 2 * math.pi * k / nb
        e = Vector((math.cos(ph), math.sin(ph), 0))
        t = Vector((math.sin(ph), -math.cos(ph), 0))
        box("arm", HUB + e * 0.27, (0.52, 0.17, 0.035), DARK, rot=(0, 0, ph), bevel=0 if GAME else 0.006)
        cyl("bearing", HUB + e * 0.24 + Vector((0, 0, -0.07)), HUB + e * 0.24 + Vector((0, 0, 0.03)),
            0.06, DARK, seg=16)
        cyl("sleeve", HUB + e * 0.14 + Vector((0, 0, -0.08)), HUB + e * 0.56 + Vector((0, 0, -0.04)),
            0.06, METAL, r2=0.045, seg=16)
        box("adapter", HUB + e * 0.4 + Vector((0, 0, -0.11)), (0.13, 0.11, 0.07), DARK, rot=(0, 0, ph), bevel=0)
        horn = HUB + e * 0.34 + t * 0.11 + Vector((0, 0, -0.07))
        box("horn", horn, (0.05, 0.11, 0.03), METAL, rot=(0, 0, ph), bevel=0)
        if Q["full"]:
            lk = HUB + (e * math.cos(0.35) + t * math.sin(0.35)) * 0.2 + Vector((0, 0, -0.27))
            cyl("link", lk, horn, 0.013, METAL, seg=8)
        a = Vector((0, 0, 1))
        blade("blade", HUB + Vector((0, 0, -0.04)), e, t, a, [r for r in rs if r <= tip_from] + [tip_from],
              chord, pitch, thick, sweep, Q, ROTOR_M)
        blade("tipband", HUB + Vector((0, 0, -0.04)), e, t, a, [tip_from] + [r for r in rs if r > tip_from],
              chord, pitch, thick, sweep, Q, PAINT)


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
    """The studio's views of a machine 11 m long under a rotor 10.7 m across:
    the stills (three-quarter, side, front, rear, top, close-ups), the views
    the reference photographs were taken from, and three ORTHOGRAPHIC views
    at 100 px/m, the nose 95 px from the left (`oside` from the left side,
    `otop` with the right side up, `ofront`), to lay a three-view over."""
    for o in [o for o in COL.objects if o.type == "CAMERA"]:
        bpy.data.objects.remove(o)
    cams = {}
    views = {
        "three": ((8.0, 9.5, 4.0), (0, -1.0, 1.6), 32), "left3": ((-8.0, 9.5, 4.0), (0, -1.0, 1.6), 32),
        "side": ((24, -1.3, 1.8), (0, -1.3, 1.8), 50), "front": ((0, 26, 1.9), (0, 0, 1.7), 55),
        "rear3": ((7, -15, 4.5), (0, -2, 1.6), 35), "top": ((0, -1.0, 32), None, 45),
        "hub": ((2.2, 2.6, 3.9), (0, 0.1, 2.9), 40), "skid": ((4.2, 3.2, 1.3), (0.6, 0.2, 0.8), 30),
        "basket": ((-4.0, 3.5, 1.6), (-1.2, 0.1, 0.5), 32), "tail": ((3.5, -9.6, 2.4), (0, -6.0, 1.7), 40),
        # the photographs' own: a three-quarter from the front right, low
        # and close; the left side from a little ahead; the left side over
        # snow from a little above; the chase from behind and above
        "photo3": ((-4.0, 6.4, 0.95), (0, 0.6, 1.45), 22), "photoside": ((-15, 3.0, 1.4), (0, -1.4, 1.5), 42),
        "photosnow": ((-17, 5.5, 3.3), (0, -1.6, 1.5), 45), "chase": ((1.5, -17, 7.5), (0, -1.2, 1.7), 35),
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
    yc = NOSE - 5.45
    for name, loc, rot in (("oside", (-40, yc, 1.75), (math.pi / 2, 0, -math.pi / 2)),
                           ("otop", (0, yc, 40), (0, 0, -math.pi / 2)),
                           ("ofront", (0, 40, 1.75), (math.pi / 2, 0, math.pi))):
        cd = bpy.data.cameras.new(name)
        cd.type = "ORTHO"
        cd.ortho_scale = 12.8
        cd.clip_end = 300
        cam = bpy.data.objects.new(name, cd)
        COL.objects.link(cam)
        cam.location = loc
        cam.rotation_euler = rot
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

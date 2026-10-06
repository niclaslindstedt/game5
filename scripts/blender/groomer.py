# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE PISTE MACHINE MODELLED IN BLENDER off the game's own data: `GROOMER`
# (engine/game/defs/groomer.ts — the class's measures) and the layout it is
# drawn to (pwa/src/game/groomer-look.ts — the belts' wheels, the cab, the
# hood, the blade, the tiller and every lamp), handed in as one JSON file by
# `scripts/blender.mjs --kind=groomer`, the only way this runs. What is drawn
# is the largest groomer class at its true size: two belts 1.65 m wide of
# rubber bands with aluminium cleats bolted across them round an idler, five
# road wheels and a drive sprocket; a hull 2.5 m wide between them; the cab
# forward on it, glass all round in black pillars under a roof bar of LED
# lamps; the tall rounded engine housing behind it, the deck and its rail;
# the twelve-way BLADE out front on its push frame — a concave moldboard
# under a snow guard, its wings swung forward; the TILLER behind on its hitch
# — the drum under its hood and the corrugated finisher mat trailing on the
# snow, its side finishers drooping, flags on its corners; the amber beacon.
#
# THE FRAME is the ENGINE's (x right, y up, z forward, the origin on the snow
# under the middle of the tracks), written into Blender as (x, -z, y) so the
# glTF's own frame (y up, Blender's -y on +z) IS the engine's: whoever draws
# it hangs it on the machine's pose with no turn.
#
# RIGID NODES, no rig — the game moves each off the engine's readings:
#   `groomer_body`    everything that does not move: the hull, the belts'
#                     rubber and wheels, the cab, the hood, the deck, the
#                     beacon's base and dome, the body's lamps;
#   `groomer_cleats`  every cleat of both belts with ONE MORPH (`run`): each
#                     moved one pitch on round its loop the way the belt runs
#                     when the machine drives forward, so a weight run 0 → 1
#                     and wrapped runs the belts (`cleatPitch`, m, on the root);
#   `groomer_blade`   the blade, its push frame and its lamps — its origin
#                     the push frame's hinge, turned about x to lift it;
#   `groomer_heap`    the snow rolling ahead of the blade, shown while it works;
#   `groomer_tiller`  the tiller, its hood, mat, finishers, flags and lamps —
#                     its origin the hitch, turned about x to lift it;
#   `groomer_beacon`  the reflector turning inside the beacon's dome — its
#                     origin the beacon's middle, turned about y.
#
# THE MATERIALS, by name: `paint` (the livery's red), `black`, `dark`,
# `graphite` (the blade), `rubber`, `alu`, `steel`, `glass`, `seat`, `lamp`
# (the work lamps' lenses, emissive), `amber` (the beacon), `tail`,
# `orange` (the flags), `snow` (the heap). The game lights `lamp`, `glass`,
# `amber` and `tail` by the dark.

import json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
NAME = os.path.basename(argv[0]).removesuffix(".json")
K, L = DATA["groomer"], DATA["look"]

# ---------------------------------------------------------------- materials
PAINT = mat("paint", (0.6, 0.02, 0.018), rough=0.32, coat=0.8)
BLACK = mat("black", (0.014, 0.014, 0.016), rough=0.45, coat=0.3)
DARK = mat("dark", (0.05, 0.052, 0.056), metal=0.4, rough=0.55)
GRAPHITE = mat("graphite", (0.03, 0.031, 0.034), metal=0.3, rough=0.5)
RUBBER = mat("rubber", (0.012, 0.012, 0.013), rough=0.85)
ALU = mat("alu", (0.72, 0.73, 0.75), metal=1.0, rough=0.3)
STEEL = mat("steel", (0.55, 0.56, 0.58), metal=1.0, rough=0.22)
GLASS = mat("glass", (0.07, 0.1, 0.12), metal=0.1, rough=0.12)
SEAT = mat("seat", (0.03, 0.03, 0.034), rough=0.7)
LAMP = mat("lamp", (0.9, 0.92, 0.96), rough=0.05, emit=(0.92, 0.96, 1.0), emit_str=20.0)
AMBER = mat("amber", (1.0, 0.45, 0.03), rough=0.15, emit=(1.0, 0.45, 0.02), emit_str=6.0)
TAIL = mat("tail", (0.5, 0.0, 0.0), rough=0.2, emit=(1.0, 0.02, 0.01), emit_str=3.0)
ORANGE = mat("orange", (1.0, 0.25, 0.02), rough=0.6)
SNOW = mat("snow", (0.86, 0.9, 0.96), rough=0.9)


def W(x, y, z):
    """A point of the engine's frame (x right, y up, z forward) in Blender's."""
    return Vector((x, -z, y))


def E(v):
    """An engine-frame vector given as a tuple, as Blender's."""
    return W(v[0], v[1], v[2])


# Rigid parts are gathered by the node they belong to.
PARTS = {k: [] for k in ("body", "blade", "heap", "tiller", "beacon")}


def made_since(before):
    return [o for o in COL.objects if o not in before and o.type in ("MESH", "CURVE")]


class gather:
    """Every part made inside the block belongs to node `name`."""

    def __init__(self, name):
        self.name = name

    def __enter__(self):
        self.before = set(COL.objects)

    def __exit__(self, *a):
        PARTS[self.name] += made_since(self.before)


# ---------------------------------------------------------------- shapes
def obox(name, c, u, v, w, size, m, smooth=False):
    """A box about `c` (engine frame) along the engine-frame axes u, v, w,
    `size` long along each."""
    c, u, v, w = Vector(c), Vector(u).normalized(), Vector(v).normalized(), Vector(w).normalized()
    a, b, h = size[0] / 2, size[1] / 2, size[2] / 2
    pts = []
    for sw in (-1, 1):
        for sv in (-1, 1):
            for su in (-1, 1):
                p = c + u * su * a + v * sv * b + w * sw * h
                pts.append(W(*p))
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return mesh_obj(name, pts, faces, [m], smooth=smooth)


def bx(name, x, y, z, wx, hy, lz, m):
    """An upright box: its middle, its width across, height and length along."""
    return obox(name, (x, y, z), (1, 0, 0), (0, 1, 0), (0, 0, 1), (wx, hy, lz), m)


def prism(name, profile, x0, x1, m, mats=None, face_mat=None):
    """A side profile [(z, y)…] run across from x0 to x1."""
    rings = [[W(x, y, z) for z, y in profile] for x in (x0, x1)]
    return loft(name, rings, mats or [m], face_mat=face_mat, smooth=False)


def rod(name, a, b, r, m, seg=12):
    return cyl(name, E(a), E(b), r, m, seg=seg)


def hull2d(pts):
    """The convex hull of 2D points, counter-clockwise (monotone chain)."""
    pts = sorted(set(pts))

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cross(hi[-2], hi[-1], p) <= 0:
            hi.pop()
        hi.append(p)
    return lo[:-1] + hi[:-1]


# ---------------------------------------------------------------- the BELTS
B = L["belt"]
BX, BW = B["x"], B["width"]
RUB = B["rubber"]
H_KEEL = L["hull"]["keel"]


def belt_loop(n):
    """The belt's outer surface round the idler and the sprocket, as `n`
    points (z, y) evenly spaced, running the way the belt does under a
    machine driving forward (aft along the bottom), and its length."""
    samples = []
    for c in (B["idler"], B["sprocket"]):
        r = c["r"] + RUB
        for k in range(240):
            a = 2 * math.pi * k / 240
            samples.append((c["z"] + r * math.cos(a), c["y"] + r * math.sin(a)))
    hull = hull2d(samples)
    # The bottom run must go aft (z falling): the hull is counter-clockwise
    # in (z, y), which runs FORWARD along the bottom — so reverse it.
    hull = hull[::-1]
    pts = [Vector((z, y, 0)) for z, y in hull]
    path, total = resample(pts, total_step(pts, n))
    return [(p.x, p.y) for p in path][:n], total


def total_step(pts, n):
    length = sum((pts[(i + 1) % len(pts)] - pts[i]).length for i in range(len(pts)))
    return length / n


def at_loop(loop, total, s):
    """The point (z, y) and the outward normal a distance `s` round the loop."""
    n = len(loop)
    step = total / n
    f = (s % total) / step
    i = int(f) % n
    u = f - int(f)
    a, b = Vector(loop[i]), Vector(loop[(i + 1) % n])
    p = a.lerp(b, u)
    t = (b - a).normalized()
    # The loop runs clockwise in (z, y), so the outside is the tangent's left.
    o = Vector((t.y, -t.x))
    if (p - centre_of(loop)).dot(o) < 0:
        o = -o
    return p, t, o


_CENTRES = {}


def centre_of(loop):
    key = id(loop)
    if key not in _CENTRES:
        _CENTRES[key] = sum((Vector(p) for p in loop), Vector((0.0, 0.0))) / len(loop)
    return _CENTRES[key]


def build_belts():
    """Each belt's rubber bands round its loop, its road wheels, idler and
    sprocket, and the track frame they hang from."""
    n = 72 if GAME else 220
    loop, total = belt_loop(n)
    bands = B["bands"]
    lane = BW / bands
    for side in (-1, 1):
        cx = side * BX
        for k in range(bands):
            x0 = cx - BW / 2 + lane * k + lane * 0.08
            x1 = x0 + lane * 0.84
            rings = []
            for i in range(n):
                p, t, o = at_loop(loop, total, i * total / n)
                q = p - o * RUB
                rings.append([W(x0, p.y, p.x), W(x1, p.y, p.x), W(x1, q.y, q.x), W(x0, q.y, q.x)])
            loft("band", rings + [rings[0]], [RUBBER], closed=True, cap=False)
        # The road wheels, doubled across the belt as the class runs them,
        # the idler and the sprocket.
        W_ = B["wheels"]
        for z in W_["z"]:
            for dx in (-0.42, 0.42):
                a, b = (cx + dx - 0.2, W_["y"], z), (cx + dx + 0.2, W_["y"], z)
                rod("wheel", a, b, W_["r"], DARK, seg=40)
                rod("hub", (a[0] - 0.01, a[1], z), (b[0] + 0.01, b[1], z), W_["r"] * 0.45, ALU, seg=32)
            rod("axle", (cx - 0.7, W_["y"], z), (cx + 0.7, W_["y"], z), 0.06, STEEL, seg=10)
        for c, m in ((B["idler"], DARK), (B["sprocket"], BLACK)):
            for dx in (-0.45, 0.45):
                rod("roller", (cx + dx - 0.17, c["y"], c["z"]), (cx + dx + 0.17, c["y"], c["z"]),
                    c["r"] * 0.94, m, seg=48)
                rod("roller_hub", (cx + dx - 0.18, c["y"], c["z"]), (cx + dx + 0.18, c["y"], c["z"]),
                    c["r"] * 0.4, ALU, seg=32)
        # The sprocket's teeth, meshing with the bands.
        S = B["sprocket"]
        for k in range(14 if GAME else 20):
            a = 2 * math.pi * k / (14 if GAME else 20)
            r = S["r"] - 0.02
            for dx in (-0.45, 0.45):
                obox("tooth", (cx + dx, S["y"] + r * math.sin(a), S["z"] + r * math.cos(a)),
                     (1, 0, 0), (0, math.sin(a), math.cos(a)), (0, math.cos(a), -math.sin(a)),
                     (0.3, 0.07, 0.06), BLACK)
        # The track frame: a beam the wheels' arms hang from, into the hull.
        bx("track_beam", cx, 0.8, 0.0, 0.3, 0.14, 3.9, DARK)
        for z in W_["z"]:
            rod("swing_arm", (cx, 0.8, z + 0.14), (cx, W_["y"], z), 0.05, DARK, seg=10)
        for z in (-1.05, 1.05):
            rod("cross_tube", (side * H_KEEL, 0.8, z), (cx, 0.8, z), 0.08, DARK, seg=12)
    return loop, total


def build_cleats(loop, total):
    """Every cleat of both belts, each an aluminium bar across the belt with
    a grouser's edge, and the same set moved one pitch on as the `run` key."""
    n = round(total / B["pitch"])
    pitch = total / n
    h, d = B["cleat"]["height"], B["cleat"]["depth"]

    def cleat(s, side):
        p, t, o = at_loop(loop, total, s)
        cx = side * BX
        out = []
        # A bar on the rubber, and a narrower grouser standing proud of it.
        for (wid, hh, dd, lift) in ((BW * 0.99, h * 0.55, d, h * 0.275), (BW * 0.9, h * 0.45, d * 0.45, h * 0.775)):
            c = Vector((p.x, p.y)) + o * lift
            for sw in (-1, 1):
                for sv in (-1, 1):
                    for su in (-1, 1):
                        q = c + t * sv * dd / 2 + o * sw * hh / 2
                        out.append(W(cx + su * wid / 2, q.y, q.x))
        return out

    faces1 = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    verts, faces, moved = [], [], []
    for side in (-1, 1):
        for i in range(n):
            s = i * pitch
            here, there = cleat(s, side), cleat(s + pitch, side)
            for box_i in range(2):
                base = len(verts)
                verts += here[box_i * 8:(box_i + 1) * 8]
                moved += there[box_i * 8:(box_i + 1) * 8]
                faces += [tuple(base + k for k in f) for f in faces1]
    ob = mesh_obj("groomer_cleats", verts, faces, [ALU], smooth=False)
    return ob, moved, pitch


# ---------------------------------------------------------------- the HULL, CAB, HOOD and DECK
H = L["hull"]
C = L["cab"]
HD = L["hood"]
D = L["deck"]


def build_hull():
    # The keel between the belts, down to the belly.
    prism("keel", [(H["back"], H["belly"] + 0.1), (H["back"], H["top"]), (H["front"] - 0.1, H["top"]),
                   (H["front"], H["top"] - 0.25), (H["front"] - 0.25, H["belly"]),
                   (H["back"] + 0.15, H["belly"])], -H["keel"], H["keel"], DARK)
    # The deck plate over the belts' top run, the cab and the hood on it,
    # its edge a black skirt.
    prism("plate", [(H["back"] + 0.1, H["top"]), (H["back"] + 0.1, H["plate"]), (H["front"] - 0.05, H["plate"]),
                    (H["front"] + 0.05, H["top"])], -H["half"], H["half"], PAINT)
    for side in (-1, 1):
        bx("skirt", side * (H["half"] + 0.02), (H["top"] + H["plate"]) / 2, 0.05, 0.05, 0.14, 4.6, BLACK)
    # The front frame the push arms bolt to.
    bx("front_frame", 0, 0.75, H["front"] - 0.12, H["keel"] * 2, 0.45, 0.28, DARK)


def cab_ring(u, inset=0.0, lift=0.0):
    """The cab's glass at `u` (0 its back wall, 1 its screen): its four
    corners (x, y, z) — the sill, and the roof drawn in a little."""
    zb = C["back"] + (C["screen"]["foot"] - C["back"]) * u
    zt = C["back"] + (C["screen"]["head"] - C["back"]) * u
    sill = C["sill"]["back"] + (C["sill"]["front"] - C["sill"]["back"]) * u
    h, top = C["half"] - inset, C["roof"] - 0.08 + lift
    tuck = 0.07
    return [(-h, sill, zb), (h, sill, zb), (h - tuck, top, zt), (-h + tuck, top, zt)]


def build_cab():
    sf, sb = C["sill"]["front"], C["sill"]["back"]
    foot = C["screen"]["foot"]
    # The lower body, its front slanting in under the screen.
    prism("cab_lower", [(C["back"], C["floor"]), (foot + 0.05, C["floor"]), (foot + 0.05, sf - 0.12),
                        (foot, sf), (C["back"], sb)], -C["half"] - 0.02, C["half"] + 0.02, PAINT)
    bx("cab_stripe", 0, sf - 0.06, (C["back"] + foot) / 2 + 0.05, C["half"] * 2 + 0.06, 0.06,
       foot - C["back"] + 0.1, BLACK)
    # The glass: a box from the back wall to the raked screen.
    rings = [[W(*p) for p in cab_ring(u, 0.012)] for u in (0.0, 1.0)]
    loft("cab_glass", rings, [GLASS], smooth=False)
    # The pillars and rails, black.
    r = 0.045
    back, front = cab_ring(0.0), cab_ring(1.0)
    for i, j in ((0, 3), (1, 2)):
        rod("pillar_b", back[i], back[j], r, BLACK, seg=8)
        rod("pillar_a", front[i], front[j], r * 1.1, BLACK, seg=8)
    door = cab_ring(0.42)
    for i, j in ((0, 3), (1, 2)):
        rod("pillar_door", door[i], door[j], r * 0.75, BLACK, seg=8)
    for a, b in ((0, 1), (3, 2)):
        rod("rail_back", back[a], back[b], r, BLACK, seg=8)
        rod("rail_front", front[a], front[b], r, BLACK, seg=8)
    for k in range(4):
        rod("rail_side", back[k], front[k], r * 0.9, BLACK, seg=8)
    # The roof: a slab over it all, its lip forward over the screen.
    top = C["roof"]
    hz = C["screen"]["head"] + C["lip"]
    prism("roof", [(C["back"] - 0.06, top - 0.1), (C["back"] - 0.06, top), (hz, top), (hz + 0.02, top - 0.07),
                   (hz - 0.05, top - 0.11)], -C["half"] + 0.02, C["half"] - 0.02, BLACK)
    # Inside: the seat, the dash and the wheel, dark through the glass.
    bx("seat", 0.0, C["floor"] + 0.45, 1.2, 0.6, 0.12, 0.55, SEAT)
    obox("seat_back", (0.0, C["floor"] + 0.85, 0.92), (1, 0, 0), (0, 1, 0.25), (0, -0.25, 1), (0.6, 0.75, 0.12), SEAT)
    bx("dash", 0.0, sf + 0.02, foot - 0.25, C["half"] * 2 - 0.15, 0.2, 0.35, SEAT)
    rod("column", (0.0, sf, foot - 0.4), (0.0, sf + 0.3, foot - 0.62), 0.03, SEAT, seg=8)
    obox("wheel", (0.0, sf + 0.33, foot - 0.64), (1, 0, 0), (0, 0.8, 0.6), (0, -0.6, 0.8), (0.4, 0.04, 0.4), SEAT)
    obox("armrest", (0.4, C["floor"] + 0.62, 1.3), (1, 0, 0), (0, 1, 0), (0, 0, 1), (0.14, 0.12, 0.45), SEAT)
    # The wipers on the screen, and the mirrors out on their arms.
    for x in (-0.45, 0.45):
        a = Vector((x - 0.05, sf + 0.06, foot - 0.03))
        rod("wiper", a, (x + 0.12, sf + 0.75, foot - 0.03 - (foot - C["screen"]["head"]) * 0.65 / (C["roof"] - sf)),
            0.012, BLACK, seg=5)
    for s in (-1, 1):
        a = (s * (C["half"] + 0.02), C["roof"] - 0.35, C["screen"]["head"] + 0.05)
        b = (s * (C["half"] + 0.42), C["roof"] - 0.42, C["screen"]["head"] + 0.18)
        rod("mirror_arm", a, b, 0.018, BLACK, seg=6)
        bx("mirror", b[0] + s * 0.03, b[1] - 0.1, b[2], 0.06, 0.34, 0.24, BLACK)
    # The steps up to the door on the left, over the belt's front.
    for k, y in enumerate((0.75, 1.05)):
        bx("step", -H["half"] - 0.25, y, 1.6 - k * 0.05, 0.42, 0.04, 0.32, ALU)
    rod("handrail", (-C["half"] - 0.05, sb, 1.2), (-C["half"] - 0.05, C["roof"] - 0.25, 1.1), 0.02, ALU, seg=6)


def hood_ring(z, n):
    """The engine's housing across at `z`: a flat-bottomed superellipse."""
    t = (HD["front"] - z) / (HD["front"] - HD["back"])
    crown = HD["crown"] - 0.75 * max(0.0, t - 0.55) ** 1.6 - 0.08 * max(0.0, 0.12 - t) / 0.12
    half = HD["half"] - 0.12 * t ** 2
    base = H["plate"]
    pts = []
    for k in range(n + 1):
        a = math.pi * k / n
        c, s = math.cos(a), math.sin(a)
        x = math.copysign(abs(c) ** 0.45, c) * half
        y = base + (crown - base) * abs(s) ** 0.3
        pts.append(W(x, y, z))
    return pts


def build_hood():
    n = 14 if GAME else 32
    zs = [HD["front"] + (HD["back"] - HD["front"]) * (i / (9 if GAME else 20)) for i in range((9 if GAME else 20) + 1)]
    loft("hood", [hood_ring(z, n) for z in zs], [PAINT], closed=True, cap=True)
    # The vents along each flank, and the engine's grille aft.
    for s in (-1, 1):
        for k in range(5):
            obox("vent", (s * (HD["half"] - 0.06), 1.95 - k * 0.09, -0.35), (0, 0, 1), (0, 1, 0),
                 (s, 0, 0), (0.9, 0.04, 0.06), BLACK)
    bx("grille", 0, 1.75, HD["back"] - 0.02, 1.4, 0.55, 0.06, BLACK)
    # The stack.
    rod("stack", (0.62, 2.0, -0.95), (0.62, HD["crown"] + 0.05, -0.95), 0.07, BLACK, seg=12)


def build_deck():
    f, b, y = D["front"], D["back"], D["floor"]
    bx("deck", 0, y - 0.05, (f + b) / 2, H["half"] * 2 - 0.1, 0.1, f - b, BLACK)
    bx("deck_box", 0, (H["plate"] + y) / 2, (f + b) / 2, H["half"] * 2 - 0.3, y - H["plate"], f - b, PAINT)
    top = y + D["rail"]
    hw = H["half"] - 0.1
    corners = [(-hw, f), (-hw, b), (hw, b), (hw, f)]
    for x, z in corners:
        rod("rail_post", (x, y, z), (x, top, z), 0.025, BLACK, seg=6)
    for (x0, z0), (x1, z1) in zip(corners, corners[1:]):
        rod("rail", (x0, top, z0), (x1, top, z1), 0.025, BLACK, seg=6)
        rod("rail_mid", (x0, y + D["rail"] / 2, z0), (x1, y + D["rail"] / 2, z1), 0.018, BLACK, seg=6)
    T = L["tail"]
    for s in (-1, 1):
        bx("tail", s * T["x"], T["y"], T["z"], 0.26, 0.12, 0.05, TAIL)
    # The hitch's frame at the back the tiller hangs from.
    bx("hitch_frame", 0, 0.95, H["back"] - 0.05, 1.6, 0.35, 0.25, DARK)


# ---------------------------------------------------------------- the LAMPS
FACE = {"front": (0, 0, 1), "rear": (0, 0, -1)}


def lamp(l):
    if l["face"] == "side":
        f = Vector((1 if l["x"] > 0 else -1, 0, 0))
    else:
        f = Vector(FACE[l["face"]])
    c = Vector((l["x"], l["y"], l["z"]))
    up = Vector((0, 1, 0))
    across = up.cross(f).normalized()
    obox("lamp_housing", c - f * 0.06, across, up, f, (l["w"] + 0.04, l["h"] + 0.04, 0.11), BLACK)
    obox("lamp_lens", c + f * 0.0, across, up, f, (l["w"], l["h"], 0.012), LAMP)


def build_lamps(bars):
    for l in L["lamps"]:
        if l["bar"] in bars:
            lamp(l)


def build_roof_bars():
    """The bars the roof's lamps sit on: one over the screen, one at the back."""
    top = C["roof"]
    for z, w in ((2.3, 1.95), (0.52, 1.6)):
        bx("lamp_bar", 0, top + 0.015, z, w, 0.04, 0.08, BLACK)
        for x in (-w / 2 + 0.1, w / 2 - 0.1):
            bx("lamp_bar_foot", x, top - 0.01, z - (0.08 if z > 1 else -0.08), 0.06, 0.05, 0.2, BLACK)


# ---------------------------------------------------------------- the BEACON
BC = L["beacon"]


def build_beacon_base():
    rod("beacon_base", (BC["x"], C["roof"] - 0.01, BC["z"]), (BC["x"], BC["y"] - 0.06, BC["z"]), 0.11, BLACK, seg=16)
    ellipsoid("beacon_dome", W(BC["x"], BC["y"] - 0.02, BC["z"]), (0.095, 0.095, 0.13), AMBER)


def build_beacon():
    obox("beacon_mirror", (BC["x"], BC["y"], BC["z"] - 0.02), (1, 0, 0), (0, 1, 0), (0, 0, 1),
         (0.11, 0.1, 0.012), STEEL)
    obox("beacon_led", (BC["x"], BC["y"], BC["z"] + 0.01), (1, 0, 0), (0, 1, 0), (0, 0, 1),
         (0.05, 0.05, 0.03), AMBER)


# ---------------------------------------------------------------- the BLADE
BL = L["blade"]
TIP = BL["face"]
WING = (K["blade"]["width"] - BL["middle"]) / 2 / math.cos(BL["wing"])
MID_FACE = TIP - WING * math.sin(BL["wing"])
GUARD_Y = BL["height"] - BL["guard"]


def moldboard_section(n):
    """The moldboard's profile, (d back from the face, y up), round from the
    cutting edge up its concave face, over its top and down its back."""
    face = []
    for k in range(n + 1):
        t = k / n
        y = 0.03 + (GUARD_Y - 0.03) * t
        d = BL["depth"] * 0.62 * math.sin(math.pi * t) ** 0.9 * (1 - 0.35 * t)
        face.append((d, y))
    back = [(BL["depth"] * 0.62 + 0.08, GUARD_Y - 0.02), (BL["depth"], GUARD_Y * 0.55),
            (BL["depth"] * 0.55, 0.12), (0.05, 0.0)]
    return face + back


def blade_piece(name, start, along, length, n_across, m):
    """A moldboard `length` long from `start` along `along` (engine frame,
    level), its face to the forward side of `along`."""
    a = Vector(along).normalized()
    normal = Vector((-a.z, 0, a.x)) if a.x > 0 else Vector((a.z, 0, -a.x))
    if normal.z < 0:
        normal = -normal
    sec = moldboard_section(6 if GAME else 16)
    rings = []
    for i in range(n_across + 1):
        p = Vector(start) + a * length * i / n_across
        rings.append([W(*(p - normal * d + Vector((0, y, 0)))) for d, y in sec])
    loft(name, rings, [m], closed=True, cap=True)
    return a, normal


def guard(start, along, normal, length):
    """The snow guard over a moldboard: a frame of bars, see-through."""
    a = Vector(along).normalized()
    s = Vector(start) - normal * 0.12
    y0, y1 = GUARD_Y, BL["height"]
    p0, p1 = s, s + a * length
    for y in (y0 + 0.02, y1 - 0.02):
        rod("guard_rail", p0 + Vector((0, y, 0)), p1 + Vector((0, y, 0)), 0.025, GRAPHITE, seg=6)
    n = max(2, round(length / (0.16 if GAME else 0.1)))
    for k in range(n + 1):
        p = s + a * length * k / n
        obox("guard_bar", p + Vector((0, (y0 + y1) / 2, 0)), a, (0, 1, 0), normal, (0.035, y1 - y0, 0.03),
             GRAPHITE)


def build_blade():
    half = BL["middle"] / 2
    c, s = math.cos(BL["wing"]), math.sin(BL["wing"])
    pieces = [((-half, 0, MID_FACE), (1, 0, 0), BL["middle"], 8),
              ((half, 0, MID_FACE), (c, 0, s), WING, 3),
              ((-half, 0, MID_FACE), (-c, 0, s), WING, 3)]
    for start, along, length, n in pieces:
        a, normal = blade_piece("moldboard", start, along, length, n, GRAPHITE)
        guard(start, along, normal, length)
        # The cutting edge, steel, along the moldboard's foot.
        p = Vector(start) + a * length / 2 + normal * 0.0
        obox("cutting_edge", p + Vector((0, 0.05, 0)) - normal * 0.02, a, (0, 1, 0), normal,
             (length, 0.1, 0.035), STEEL)
        # The sections' hinges: a heavy steel knuckle at each joint.
    for x in (-half, half):
        rod("blade_hinge", (x, 0.05, MID_FACE - 0.2), (x, GUARD_Y, MID_FACE - 0.2), 0.06, STEEL, seg=10)
    # The end plates on the wings' tips.
    for sx in (-1, 1):
        tip = Vector((sx * (half + WING * c), 0, MID_FACE + WING * s))
        obox("end_plate", tip + Vector((0, BL["height"] * 0.48, -0.18)), (0, 0, 1), (0, 1, 0), (sx, 0, 0),
             (0.5, BL["height"] * 0.96, 0.03), ALU)
    # The push frame: two arms from the hinge on the hull, a cross beam at
    # the blade's back, the rams that lift it and the ones that swing the wings.
    hy, hz = BL["hinge"]["y"], BL["hinge"]["z"]
    back = MID_FACE - BL["depth"] - 0.12
    for sx in (-1, 1):
        rod("push_arm", (sx * 0.34, hy, hz), (sx * 1.05, 0.48, back), 0.1, DARK, seg=10)
        rod("lift_ram", (sx * 0.3, H["top"] - 0.08, H["front"] - 0.1), (sx * 0.5, 0.85, back), 0.07, DARK, seg=10)
        rod("lift_rod", (sx * 0.5, 0.85, back), (sx * 0.47, 1.0, back - 0.4), 0.045, STEEL, seg=10)
        rod("wing_ram", (sx * 1.1, 0.7, back), (sx * (half + 0.4), 0.7, MID_FACE - 0.1), 0.05, STEEL, seg=8)
    rod("push_beam", (-1.2, 0.5, back), (1.2, 0.5, back), 0.12, DARK, seg=10)
    obox("blade_mount", (0, 0.6, back + 0.08), (1, 0, 0), (0, 1, 0), (0, 0, 1), (1.4, 0.5, 0.15), DARK)
    build_lamps({"blade"})


def build_heap():
    """The snow rolling ahead of the blade: lumps along its face, the wings
    gathering it in."""
    half = BL["middle"] / 2
    c, s = math.cos(BL["wing"]), math.sin(BL["wing"])
    n = 18 if GAME else 40
    for k in range(n):
        u = (k + 0.5) / n
        x = -K["blade"]["width"] / 2 + K["blade"]["width"] * u
        z = MID_FACE + 0.25
        if abs(x) > half:
            z += (abs(x) - half) / c * s
        r = 0.24 + 0.12 * math.sin(k * 2.3) ** 2
        ellipsoid("heap", W(x, r * 0.4, z + 0.1 * math.cos(k * 1.7)), (r * 1.4, r * 1.1, r * 0.8), SNOW)


# ---------------------------------------------------------------- the TILLER
T = L["tiller"]


def build_tiller():
    hy, hz = T["hitch"]["y"], T["hitch"]["z"]
    dr = T["drum"]
    dz, dy = dr["z"], dr["y"]
    width = dr["width"]
    # The hitch's arms and the frame across.
    for sx in (-1, 1):
        rod("tiller_arm", (sx * 0.55, hy, hz), (sx * 0.62, dy + 0.42, dz + 0.35), 0.09, DARK, seg=10)
    rod("tiller_lift", (0.0, hy + 0.35, hz + 0.05), (0.0, dy + 0.6, dz + 0.3), 0.06, STEEL, seg=10)
    obox("tiller_frame", (0, dy + 0.55, dz + 0.25), (1, 0, 0), (0, 1, 0), (0, 0, 1), (1.6, 0.18, 0.3), DARK)
    # The drum.
    rod("drum", (-width / 2, dy, dz), (width / 2, dy, dz), dr["r"], DARK, seg=24)
    # The hood over it: a shell from in front, over the top, down the back.
    n = 10 if GAME else 28
    R = T["hood"]["r"]
    ring = []
    for k in range(n + 1):
        a = math.radians(-20 + 200 * k / n)  # from forward-low over the top to aft-low
        ring.append((dz + R * math.cos(a), dy + R * math.sin(a) * 0.82))
    inner = [(dz + (z - dz) * 0.94, dy + (y - dy) * 0.94) for z, y in reversed(ring)]
    prism("tiller_hood", ring + inner, -width / 2 - 0.05, width / 2 + 0.05, PAINT)
    for sx in (-1, 1):
        bx("tiller_end", sx * (width / 2 + 0.06), dy + 0.05, dz - 0.05, 0.05, 0.7, 1.25, BLACK)
    bx("hood_band", 0, dy + R * 0.82 - 0.02, dz, width + 0.1, 0.05, 0.25, BLACK)
    # The finisher mat: a corrugated rubber comb trailing on the snow, its
    # ribs along the way it goes — the corduroy's pen.
    M = T["mat"]
    mw = M["width"]
    ribs = 46 if GAME else 110
    sec = []
    for k in range(ribs * 2 + 1):
        x = -mw / 2 + mw * k / (ribs * 2)
        sec.append((x, 0.025 if k % 2 else 0.0))
    profile = [(M["from"], 0.32), (M["from"] - 0.25, 0.12), (M["from"] - 0.5, 0.035), (M["to"], 0.02)]
    rings = []
    for z, y in profile:
        top = [W(x, y + h, z) for x, h in sec]
        bot = [W(x, y + h - 0.03, z) for x, h in reversed(sec)]
        rings.append(top + bot)
    loft("finisher", rings, [RUBBER], closed=True, cap=True, smooth=False)
    # The side finishers: the mat's wings drooping out past the drum's ends.
    for sx in (-1, 1):
        x0 = sx * (width / 2 + 0.05)
        x1 = sx * (mw / 2 + 0.05)
        obox("side_finisher", ((x0 + x1) / 2, 0.22, M["from"] - 0.3), (sx, -0.35, 0), (0, 0, 1), (0.35 * sx, 1, 0),
             (abs(x1 - x0) * 1.06, 0.9, 0.03), RUBBER)
        bx("finisher_arm", (x0 + x1) / 2, 0.55, M["from"] + 0.05, abs(x1 - x0), 0.06, 0.06, DARK)
    # The corner flags.
    for sx in (-1, 1):
        x = sx * (width / 2 - 0.05)
        rod("flag_pole", (x, dy + 0.4, dz - 0.3), (x, dy + 1.95, dz - 0.3), 0.015, BLACK, seg=5)
        mesh_obj("flag", [W(x, dy + 1.92, dz - 0.3), W(x, dy + 1.62, dz - 0.3), W(x + sx * 0.02, dy + 1.77, dz - 0.75)],
                 [(0, 1, 2)], [ORANGE], smooth=False)
    build_lamps({"tiller"})


# ---------------------------------------------------------------- a FIGURE for scale (stills only)
def scale_figure():
    """A 1.8 m figure on skis beside the cab, in the stills only."""
    figs = []
    x, z = -3.0, 1.6
    figs.append(ellipsoid("fig_body", W(x, 1.15, z), (0.2, 0.15, 0.42), PAINT))
    figs.append(ellipsoid("fig_head", W(x, 1.68, z), (0.11, 0.12, 0.12), BLACK))
    for dx in (-0.12, 0.12):
        figs.append(cyl("fig_leg", W(x + dx, 0.05, z), W(x + dx, 0.8, z), 0.075, BLACK))
        figs.append(box("fig_ski", W(x + dx, 0.02, z + 0.2), (0.08, 1.7, 0.03), ALU, bevel=0))
    return figs


# ---------------------------------------------------------------- JOIN and EXPORT
def join(objs, name, origin):
    """Parts into one rigid mesh, its origin at `origin` (Blender frame) —
    modifiers applied, curves made meshes, triangulated in a fixed order."""
    lib._select_only(objs)
    bpy.ops.object.convert(target="MESH")
    lib._select_only(objs)
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = ob.data.name = name
    scene.cursor.location = (0.137, 9.71, 5.33)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.sort_elements(type="CURSOR_DISTANCE", elements={"VERT", "EDGE", "FACE"})
    bpy.ops.object.mode_set(mode="OBJECT")
    if "bone" in ob:
        del ob["bone"]
    ob.data.transform(Matrix.Translation(-Vector(origin)))
    ob.location = origin
    tri = ob.modifiers.new("tri", "TRIANGULATE")
    tri.quad_method, tri.ngon_method = "FIXED", "CLIP"
    if hasattr(tri, "keep_custom_normals"):
        tri.keep_custom_normals = True
    return ob


def build():
    """The machine: the root and its nodes."""
    with gather("body"):
        loop, total = build_belts()
        build_hull()
        build_cab()
        build_hood()
        build_deck()
        build_roof_bars()
        build_lamps({"roof", "nose", "rear", "side"})
        build_beacon_base()
    cleats, moved, pitch = build_cleats(loop, total)
    with gather("blade"):
        build_blade()
    with gather("heap"):
        build_heap()
    with gather("tiller"):
        build_tiller()
    with gather("beacon"):
        build_beacon()
    hinge = W(0, BL["hinge"]["y"], BL["hinge"]["z"])
    hitch = W(0, T["hitch"]["y"], T["hitch"]["z"])
    bc = W(BC["x"], BC["y"], BC["z"])
    body = join(PARTS["body"], "groomer_body", (0, 0, 0))
    blade = join(PARTS["blade"], "groomer_blade", tuple(hinge))
    heap = join(PARTS["heap"], "groomer_heap", (0, 0, 0))
    tiller = join(PARTS["tiller"], "groomer_tiller", tuple(hitch))
    beacon = join(PARTS["beacon"], "groomer_beacon", tuple(bc))
    # The cleats: the morph laid on them, the key the set moved one pitch on.
    if not cleats.data.shape_keys:
        cleats.shape_key_add(name="Basis")
    key = cleats.shape_key_add(name="run")
    for v, co in zip(key.data, moved):
        v.co = co
    root = bpy.data.objects.new("groomer", None)
    COL.objects.link(root)
    root["frame"] = "engine: x right, y up, z forward, the origin on the snow under the tracks' middle"
    root["cleatPitch"] = pitch
    nodes = (body, cleats, blade, heap, tiller, beacon)
    for o in nodes:
        o.parent = root
    counts = {o.name: lib._tri_count([o]) for o in nodes}
    print("TRIANGLES", "game" if GAME else "render", sum(counts.values()), counts)
    return root, nodes


def export(root, path):
    lib._select_only([root] + list(root.children_recursive))
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_apply=True, export_extras=True,
                              export_skins=False, export_animations=False, export_morph=True,
                              export_morph_normal=False)


cams = lib._studio((0, -0.2, 1.2), 9.6)
lib._cycles(SAMPLES)
# Two more views for a machine this size: square on the front, and from above.
for name, off, lens in (("front", (0.0, -22.0, 2.2), 50), ("top", (0.01, -0.2, 30.0), 35)):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cam = bpy.data.objects.new(name, cd)
    COL.objects.link(cam)
    cam.location = Vector(off)
    tt = cam.constraints.new("TRACK_TO")
    tt.target = bpy.data.objects["target"]
    tt.track_axis = "TRACK_NEGATIVE_Z"
    tt.up_axis = "UP_Y"
    cams[name] = cam
ONLY = [v for v in os.environ.get("VIEWS", "").split(",") if v]
views = [v for v in (ONLY or list(cams)) if v in cams and v != "none"]
root, _ = build()
tag = "game" if GAME else "render"
if views:
    scale_figure()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, f"{NAME}-{tag}.blend"))
for v in views:
    scene.camera = cams[v]
    scene.render.filepath = os.path.join(OUT, f"{NAME}-{tag}-{v}.png")
    bpy.ops.render.render(write_still=True)
if GAME:
    export(root, os.path.join(OUT, f"{NAME}-lod0.glb"))

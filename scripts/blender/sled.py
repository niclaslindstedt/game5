# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE MOUNTAIN SNOWMOBILE MODELLED IN BLENDER off the game's own data:
# `SLED` (engine/game/defs/sled.ts) and the mountain class's traced look
# (pwa/src/game/sled-look.ts), handed in as one JSON file by
# `scripts/blender.mjs --kind=sled` — the driver, and the only way this
# runs. The sibling sled game's builder for the same class, carried over
# and cut into rigid nodes: what is drawn is a long-track deep-snow machine
# — a narrow angular cowl with its lamps in pods, a tall riser putting the
# bars at a standing rider's waist with a loop over their middle, a short
# seat and a pack behind it, an open lightened tunnel over a 165-inch belt
# of 3-inch paddles, open running boards, and two short wide skis on a
# narrow stance — with a SKI RACK on the tunnel's left side carrying the
# rider's skis and poles while he rides.
#
# THE FRAME is the TRACE's: Blender x to the right, y forward from the
# tunnel's end (the trace's z), z up from the snow under the belt (the
# trace's y). glTF turns it to y up with the nose on -z; whoever draws it
# turns it back (a half turn about y puts the nose on the game's +z) and
# shifts it by `SLED.trace` onto the engine's body frame.
#
# RIGID NODES, no rig — the game moves each off the engine's readings:
#   `sled_body`     everything that does not move: the cowl, the seat, the
#                   tunnel, the boards, the bumpers, the front A-arms;
#   `sled_bars`     the post, the riser, the bar and its loop, the guards —
#                   its origin at the post's foot, turned about the post;
#   `sled_ski_l`, `sled_ski_r`   each ski on its spindle — its origin at the
#                   spindle's foot, lifted by the ski's compression and
#                   turned about the spindle by the bars;
#   `sled_track`    the rear suspension: the rails, the wheels, the belt —
#                   its origin at the drive sprocket, turned about it as the
#                   rear compresses;
#   `sled_lugs`     the belt's paddles, the track's child, with ONE MORPH
#                   (`run`): every lug moved on one pitch round the loop, so
#                   a weight run 0 → 1 and wrapped turns the belt;
#   `sled_rack`     the rider's skis and poles on the rack, shown while he
#                   rides it (`rack_ski` / `rack_trim` dressed in his pair's).
#
# THE MATERIALS, by name: `paint` (the livery's colour), `black_plastic`,
# `matte_black`, `white`, `aluminium`, `tunnel`, `rubber`, `seat`, `steel`,
# `spring`, `lamp` and `taillight` (emissive), `gauge`, `rack_ski`,
# `rack_trim`, `rack_base`.

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
SPEC, L = DATA["sled"], DATA["look"]

# ---------------------------------------------------------------- materials
PAINT = mat("paint", (0.62, 0.035, 0.02), rough=0.3, coat=1.0)
BLACK = mat("black_plastic", (0.018, 0.018, 0.02), rough=0.45, coat=0.3)
MATTE = mat("matte_black", (0.01, 0.01, 0.011), rough=0.8)
WHITE = mat("white", (0.85, 0.86, 0.88), rough=0.3, coat=1.0)
ALU = mat("aluminium", (0.82, 0.82, 0.84), metal=1.0, rough=0.28)
TUNNEL = mat("tunnel", (0.1, 0.1, 0.11), metal=0.85, rough=0.42)
RUBBER = mat("rubber", (0.012, 0.012, 0.013), rough=0.85)
SEAT_MAT = mat("seat", (0.025, 0.025, 0.03), rough=0.6, sheen=0.4)
LAMP = mat("lamp", (0.9, 0.9, 0.95), rough=0.05, emit=(0.9, 0.95, 1.0), emit_str=25.0)
TAIL = mat("taillight", (0.5, 0.0, 0.0), rough=0.2, emit=(1.0, 0.02, 0.01), emit_str=4.0)
STEEL = mat("steel", (0.55, 0.55, 0.57), metal=1.0, rough=0.2)
SPRING = mat("spring", (0.85, 0.72, 0.02), metal=0.3, rough=0.3, coat=0.5)
GAUGE = mat("gauge", (0.02, 0.03, 0.05), rough=0.1, emit=(0.2, 0.5, 0.9), emit_str=1.5)
RACK_SKI = mat("rack_ski", (0.08, 0.32, 0.62), rough=0.3, coat=1.0)
RACK_TRIM = mat("rack_trim", (0.9, 0.9, 0.9), rough=0.35, coat=0.6)
RACK_BASE = mat("rack_base", (0.01, 0.01, 0.012), rough=0.4, metal=0.2)

# Rigid parts are gathered by the node they belong to.
PARTS = {k: [] for k in ("body", "bars", "ski_l", "ski_r", "track", "rack")}
NODE = "body"


def into(node):
    global NODE
    NODE = node


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


# ---------------------------------------------------------------- the TRACE
def P(p):
    return float(p[0]), float(p[1])


def by_z(points):
    return sorted((P(p) for p in points), key=lambda p: p[0])


TW = L["tunnelWidth"] / 2
STANCE = SPEC["skiStance"]

hood = [P(p) for p in L["hood"]]
rear_i = min(range(len(hood)), key=lambda i: (hood[i][0], hood[i][1]))
HOOD_TOP = by_z(hood[: rear_i + 1])
HOOD_BOT = by_z(hood[rear_i:])
Z0 = max(HOOD_TOP[0][0], HOOD_BOT[0][0])
Z1 = min(HOOD_TOP[-1][0], HOOD_BOT[-1][0]) - 0.002
LEN = Z1 - Z0


def hood_w(z):
    """The cowl's half width: the class's hood width at the dash, a V in plan to the nose."""
    t = (z - Z0) / LEN
    half, tip = L["hoodWidth"] / 2, L["noseWidth"] * 0.3
    w = half - (half - tip) * t ** 1.5
    return w * (1 - 0.3 * max(0.0, (t - 0.9) / 0.1) ** 2)


KEYS = [(0.0, -1.0), (0.55, -1.0), (0.86, -0.9), (1.0, -0.5), (1.0, 0.0), (0.985, 0.09),
        (0.93, 0.35), (0.72, 0.74), (0.36, 0.88), (0.0, 1.0)]
SHOULDER, UPPER, BROW = 4, 6, 7
HALF = len(KEYS)
RING = KEYS + [(-x, v) for x, v in reversed(KEYS[1:-1])]
M = len(RING)


def section(z):
    top, bot = interp(HOOD_TOP, z), interp(HOOD_BOT, z)
    w, mid, h = hood_w(z), (top + bot) / 2, (top - bot) / 2
    t = (z - Z0) / LEN
    pts = []
    for x, v in RING:
        crown = 1 - 0.42 * max(v, 0) * t ** 1.3
        pts.append(Vector((x * w * crown, z, mid + v * h)))
    return pts


def cowl_face(j):
    k = j if j < HALF - 1 else M - 1 - j
    return 1 if k < SHOULDER else (2 if k == SHOULDER else 0)


def build_cowl():
    stations = [Z0 + LEN * (1 - (1 - i / 17) ** 1.5) for i in range(18)]
    cage = [section(z) for z in stations]
    verts = [v for r in cage for v in r]
    faces, fm = [], []
    for i in range(len(cage) - 1):
        a, b = i * M, (i + 1) * M
        for j in range(M):
            faces.append([a + j, a + (j + 1) % M, b + (j + 1) % M, b + j])
            fm.append(cowl_face(j))
    for ring_i in (0, len(cage) - 1):
        base = ring_i * M
        c = sum((verts[base + j] for j in range(M)), Vector()) / M
        ci = len(verts)
        verts.append(c)
        for j in range(M):
            faces.append([base + j, base + (j + 1) % M, ci])
            fm.append(cowl_face(j) if ring_i else 1)
    cowl = mesh_obj("cowl", verts, faces, [PAINT, BLACK, WHITE], fm)
    bm = bmesh.new()
    bm.from_mesh(cowl.data)
    crease = bm.edges.layers.float.get("crease_edge") or bm.edges.layers.float.new("crease_edge")
    for e in bm.edges:
        ia, ib = sorted(v.index for v in e.verts)
        if ib - ia == M and ib < len(cage) * M:
            k = ia % M
            k = k if k < HALF else M - k
            e[crease] = {SHOULDER: 1.0, BROW: 0.7, HALF - 1: 0.6}.get(k, 0.0)
    bm.to_mesh(cowl.data)
    bm.free()
    sub = cowl.modifiers.new("smooth", "SUBSURF")
    sub.levels = 1 if GAME else 2
    sub.render_levels = 1 if GAME else 3

    # The lamps: a pod on each upper shoulder, rising out of the hood and
    # ending in a lens that faces forward — proud of the cowl, not a decal.
    lamp_z = [Z1 - LEN * f for f in (0.338, 0.246, 0.172, 0.116, 0.079, 0.056)]
    for sx in (-1, 1):
        rings = []
        for i, z in enumerate(lamp_z):
            u = i / (len(lamp_z) - 1)
            a, b = (Vector((sx * abs(q.x), q.y, q.z)) for q in (section(z)[UPPER], section(z)[BROW]))
            n = Vector((sx, 0.0, 0.7)).normalized()
            lift = n * (0.008 + 0.05 * u ** 1.3) + Vector((0, 0.012 * u, 0))
            inset = -n * 0.015
            rings.append([a + inset, b + inset, b + lift + Vector((-sx * 0.006, 0, 0.004)), a + lift])
        pod = loft("lamp_pod", rings, [MATTE, LAMP], smooth=False,
                   face_mat=lambda c: 1 if c.y > lamp_z[-1] - 0.002 else 0)
        bev = pod.modifiers.new("bevel", "BEVEL")
        bev.width = 0.004
        bev.segments = 1

    # The intake under the nose, and slats in the lower flank's vent — the
    # angular, vented flank of a modern mountain cowl.
    zi = Z1 - 0.03 * LEN
    box("intake", (0, zi, interp(HOOD_BOT, zi) + 0.01), (L["noseWidth"] * 0.5, 0.02, 0.06), MATTE,
        rot=(math.radians(-40), 0, 0), bevel=0.006)
    for sx in (-1, 1):
        for i in range(4):
            z = Z0 + LEN * (0.275 + 0.05 * i)
            c = section(z)[3].lerp(section(z)[SHOULDER], 0.55)
            box("vent_slat", (sx * (abs(c.x) + 0.004), z, c.z), (0.008, 0.03, 0.12), MATTE,
                rot=(math.radians(-25), 0, 0), bevel=0.002)
        # A black side panel over the lower flank, behind the front wheel
        # well — the two-tone flank of the reference.
        z = Z0 + LEN * 0.16
        c = section(z)[2]
        box("side_panel", (sx * (abs(c.x) + 0.003), z, c.z + 0.07), (0.006, LEN * 0.22, 0.13), BLACK,
            rot=(math.radians(-12), 0, 0), bevel=0.002)

    # The bumper: a loop round the nose.
    bw, zb = L["bumperWidth"] / 2, Z1 - 0.1
    yb = interp(HOOD_BOT, zb) - 0.01
    tube("bumper", [(-bw * 0.84, zb, yb), (-bw * 0.94, Z1 + 0.014, yb + 0.03), (-bw * 0.52, Z1 + 0.1, yb + 0.055),
                    (bw * 0.52, Z1 + 0.1, yb + 0.055), (bw * 0.94, Z1 + 0.014, yb + 0.03), (bw * 0.84, zb, yb)],
         0.013, ALU, smooth_n=6)
    # A small smoked deflector over the dash: a mountain machine carries
    # none of a trail sled's screen.
    zd = P(L["post"])[0] + 0.23
    box("dash", (0, zd, interp(HOOD_TOP, zd) + 0.002), (0.26, 0.10, 0.05), BLACK, rot=(math.radians(-18), 0, 0))
    box("gauge", (0, zd - 0.005, interp(HOOD_TOP, zd) + 0.03), (0.13, 0.07, 0.006), GAUGE,
        rot=(math.radians(-38), 0, 0), bevel=0.002)


# ---------------------------------------------------------------- the BARS
GZ, GY = P(L["grip"])
PZ, PY = P(L["post"])
HB = L["barWidth"] / 2


def build_bars():
    rz, ry = GZ + 0.023, GY - 0.045
    tube("post", [(0, PZ, PY), (0, (PZ + rz) / 2, (PY + ry) / 2 - 0.01), (0, rz, ry)], 0.017, ALU)
    cyl("post_cover", (0, PZ + 0.004, PY - 0.04), (0, rz + 0.007, ry - 0.03), 0.042, BLACK, r2=0.028)
    box("riser", (0, rz, ry + 0.008), (0.08, 0.05, 0.035), BLACK)
    bar = [(s * HB, GZ - 0.017 + dz, GY + dy) for s, dz, dy in
           ((-1, 0, 0), (-0.757, 0.013, -0.005), (-0.46, 0.035, -0.027), (0, 0.045, -0.035),
            (0.46, 0.035, -0.027), (0.757, 0.013, -0.005), (1, 0, 0))]
    tube("handlebar", bar, 0.011, ALU, smooth_n=6)
    hw, hh = L["handle"]["width"] / 2, L["handle"]["height"]
    tube("mountain_handle", [(-hw, GZ + 0.02, GY - 0.03), (-hw * 0.8, GZ + 0.03, GY - 0.03 + hh),
                             (hw * 0.8, GZ + 0.03, GY - 0.03 + hh), (hw, GZ + 0.02, GY - 0.03)],
         0.011, ALU, smooth_n=4)
    tube("bar_brace", [(-HB * 0.38, GZ + 0.023, GY - 0.022), (HB * 0.38, GZ + 0.023, GY - 0.022)], 0.009, ALU)
    for sx in (-1, 1):
        end = Vector((sx * HB, GZ - 0.017, GY))
        cyl("grip", (sx * HB * 0.716, GZ - 0.004, GY - 0.005), end + Vector((sx * 0.005, 0, 0)), 0.018, RUBBER)
        cyl("bar_end", end + Vector((sx * 0.005, 0, 0)), end + Vector((sx * 0.02, 0, 0)), 0.02, ALU)
        path = catmull([end + Vector((sx * 0.02, 0, 0)), end + Vector((sx * 0.03, 0.06, 0.003)),
                        end + Vector((-sx * 0.04, 0.09, 0.003)), end + Vector((-sx * 0.12, 0.07, -0.005))], n=6)
        band = [[p + Vector((0, -0.01 * (dz > 0), dz)) for p in path] for dz in (-0.028, 0.0, 0.034)]
        g = loft("handguard", [list(r) for r in zip(*band)], [PAINT], closed=False, cap=False)
        g.modifiers.new("thick", "SOLIDIFY").thickness = 0.005
        box("lever", (sx * HB * 0.81, GZ + 0.028, GY - 0.012), (0.09, 0.012, 0.012), BLACK,
            rot=(0, 0, -sx * math.radians(12)), bevel=0.002)


# ---------------------------------------------------------------- SEAT, TUNNEL, BOARDS
SEAT = by_z(L["seat"])
SEAT_BASE = L["seatBase"]
TUN_TOP = [P(p) for p in L["tunnelTop"]] + [(Z0 + 0.06, SEAT_BASE - 0.04)]
TUN_BOT = by_z([P(p) for p in L["tunnelBottom"]] + [(Z0 + 0.06, interp(HOOD_BOT, Z0) + 0.01)])
BZ0, BZ1 = L["boards"]["from"], L["boards"]["to"]
BY = interp(TUN_BOT, (BZ0 + BZ1) / 2)


def build_chassis():
    rings = []
    s0, s1 = SEAT[0][0], SEAT[-1][0]
    for i in range(31):
        z = s0 + (s1 - s0) * i / 30
        top = interp(SEAT, z)
        hw = TW * (0.98 - 0.17 * i / 30)
        sec = superellipse(0, 0, hw, (top - SEAT_BASE) / 2, 4.0, 20 if GAME else 40, taper_top=0.18)
        rings.append([Vector((x, z, (top + SEAT_BASE) / 2 + v)) for x, v in sec])
    seat = loft("seat", rings, [SEAT_MAT])
    if not GAME:
        seat.modifiers.new("smooth", "SUBSURF").levels = 1
    # The pack behind the seat.
    pts = [P(p) for p in L["tailbox"]]
    z0, z1 = min(p[0] for p in pts), max(p[0] for p in pts)
    base = min(p[1] for p in pts)
    top_line = by_z(sorted(pts, key=lambda p: -p[1])[:2])
    rings = []
    for i in range(17):
        z = z0 + (z1 - z0) * i / 16
        top = interp(top_line, z)
        sec = superellipse(0, 0, TW * 0.9, (top - base) / 2, 5.0, 20 if GAME else 40, taper_top=0.15)
        rings.append([Vector((x, z, (top + base) / 2 + v)) for x, v in sec])
    loft("pack", rings, [BLACK])

    # The tunnel's sides — the plate cut with lightening holes along its
    # length, the open tunnel of a mountain machine — and its deck.
    outline = TUN_TOP + TUN_BOT[::-1]
    if TUN_TOP[0][0] > 1e-3:
        outline.append((0.0, TUN_TOP[0][1] - 0.09))
    tail_end = L["tunnelTop"][-1][0]
    for sx in (-1, 1):
        n = len(outline)
        verts = [Vector((sx * TW, z, y)) for z, y in outline] + \
                [Vector((sx * (TW + 0.004), z, y)) for z, y in outline]
        faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
        faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
        plate = mesh_obj("tunnel_side", verts, faces, [TUNNEL], smooth=False)
        holes = bpy.data.collections.new("tunnel_holes")
        cutters.children.link(holes)
        for f in (0.2, 0.36, 0.53, 0.70, 0.87):
            z = tail_end * f
            lo, hi = interp(TUN_BOT, z), interp(TUN_TOP, z)
            if hi - lo < 0.11:
                continue
            y = (lo + hi) / 2
            for dy in ((-0.035, 0.035) if hi - lo > 0.2 else (0.0,)):
                c = cutter_cyl((sx * (TW - 0.06), z, y + dy), (sx * (TW + 0.07), z, y + dy), 0.028)
                cutters.objects.unlink(c)
                holes.objects.link(c)
        boolean(plate, holes)
    deck = [[Vector((-TW - 0.004, z, y)), Vector((TW + 0.004, z, y))] for z, y in TUN_TOP]
    loft("tunnel_deck", deck, [TUNNEL], closed=False, cap=False, smooth=False).modifiers.new(
        "thick", "SOLIDIFY").thickness = 0.004

    t0, t1 = (P(p) for p in L["taillight"])
    for sx in (-1, 1):
        tube("taillight", [(sx * (TW + 0.006), *t0), (sx * (TW + 0.006), *t1)], 0.008, TAIL)
    ty = TUN_TOP[0][1]
    box("taillight_rear", (0, -0.005, ty - 0.014), (TW * 0.95, 0.012, 0.03), TAIL, rot=(math.radians(-12), 0, 0))
    tube("rear_bumper", [(-TW - 0.01, 0.22, ty - 0.03), (-TW - 0.02, 0.04, ty + 0.01), (-TW * 0.7, -0.02, ty + 0.03),
                         (TW * 0.7, -0.02, ty + 0.03), (TW + 0.02, 0.04, ty + 0.01), (TW + 0.01, 0.22, ty - 0.03)],
         0.012, ALU, smooth_n=5)
    # A short snow flap off the tunnel's tail.
    line = catmull([Vector((0.0, ty - 0.03)), Vector((-0.04, ty - 0.12)), Vector((-0.055, ty - 0.24))], n=4)
    f = loft("snow_flap", [[Vector((sx * (TW - 0.01), p.x, p.y)) for sx in (-1, 1)] for p in line],
             [RUBBER], closed=False, cap=False)
    f.modifiers.new("thick", "SOLIDIFY").thickness = 0.008

    # The open running boards, a raised lip outboard and a toe hold.
    for sx in (-1, 1):
        b = box("running_board", (sx * (TW + 0.125), (BZ0 + BZ1) / 2, BY), (0.25, BZ1 - BZ0, 0.012), TUNNEL,
                bevel=0.003)
        holes = bpy.data.collections.new("board_holes")
        cutters.children.link(holes)
        rows = 4 if GAME else 6
        for i in range(rows):
            for j in range(2):
                z = BZ0 + 0.07 + i * (BZ1 - BZ0 - 0.14) / (rows - 1)
                x = sx * (TW + 0.08 + 0.09 * j)
                c = cutter_cyl((x, z, BY - 0.05), (x, z, BY + 0.05), 0.024)
                cutters.objects.unlink(c)
                holes.objects.link(c)
        boolean(b, holes)
        xo = sx * (TW + 0.25)
        tube("board_lip", [(xo, BZ0, BY + 0.005), (xo + sx * 0.005, BZ0 + 0.1, BY + 0.03),
                           (xo + sx * 0.005, BZ1 - 0.1, BY + 0.03), (xo, BZ1, BY + 0.005)], 0.01, ALU, smooth_n=4)
        tube("toe_hold", [(sx * TW, BZ1 - 0.04, BY + 0.115), (sx * (TW + 0.09), BZ1 - 0.02, BY + 0.105),
                          (sx * (TW + 0.13), BZ1 - 0.005, BY + 0.065)], 0.009, ALU, smooth_n=4)
    # The SKI RACK on the tunnel's left side, behind the board: two uprights
    # off the tunnel with a cradle across each.
    for z, y in RACK_CRADLES:
        foot = interp(TUN_TOP, min(z, 0.85))
        tube("rack_post", [(-TW, z, foot - 0.1), (-TW - 0.07, z, foot - 0.02), (-TW - 0.085, z, y - 0.02)],
             0.011, BLACK, smooth_n=3)
        box("rack_cradle", (-TW - 0.1, z, y - 0.03), (0.07, 0.05, 0.03), RUBBER, bevel=0.004)


# ---------------------------------------------------------------- the SKIS ON THE RACK
# The rider's pair, base to base, tails down behind the board and tips up
# past the tunnel's end, strapped into the two cradles; the poles beside
# them. One generic all-mountain pair, dressed in the rider's colours.
RACK_LEN = 1.78
RACK_TILT = math.radians(15)
RACK_FRONT = (1.12, 0.6)        # the tails' end, behind the left board: (z, y)
RACK_CRADLES = [(RACK_FRONT[0] - d * math.cos(RACK_TILT), RACK_FRONT[1] + d * math.sin(RACK_TILT))
                for d in (0.3, 1.0)]


def build_rack():
    """The pair on edge against the tunnel's side, bases together, the
    topsheets out: each ski a beam with its sidecut and its tip and tail
    turned up (away from the tunnel), the bindings standing proud, the
    straps round both, and the poles beside them."""
    # The axis runs from the tails (forward, low) back to the tips (high).
    axis = Vector((0, -math.cos(RACK_TILT), math.sin(RACK_TILT)))
    mid = Vector((0, *RACK_FRONT)) + axis * (RACK_LEN / 2)
    up = Vector((0, -axis.z, axis.y))           # across the ski's width, in the side plane
    n = 14 if GAME else 30
    for side, x0 in ((0, -TW - 0.095), (1, -TW - 0.117)):
        rings = []
        for i in range(n + 1):
            u = i / n
            s = (u - 0.5) * RACK_LEN
            w = 0.05 + 0.014 * (abs(u - 0.5) * 2) ** 2
            rise = max(0.0, (u - 0.88) / 0.12) ** 2 * 0.06 + max(0.0, (0.07 - u) / 0.07) ** 2 * 0.03
            c = mid + axis * s + Vector((x0 - rise, 0, 0))
            t = 0.006
            rings.append([c + Vector((-t, 0, 0)) + up * -w, c + Vector((t, 0, 0)) + up * -w,
                          c + Vector((t, 0, 0)) + up * w, c + Vector((-t, 0, 0)) + up * w])
        loft("rack_ski", rings, [RACK_BASE, RACK_SKI, RACK_TRIM],
             face_mat=lambda c, x0=x0, side=side: 1 if (c.x < x0) == bool(side) else 0)
    for z, y in RACK_CRADLES:
        box("rack_strap", (-TW - 0.106, z, y), (0.05, 0.03, 0.135), RACK_TRIM, bevel=0.003)
    p = mid - axis * 0.12
    for x in (-TW - 0.083, -TW - 0.129):
        box("rack_binding", (x, p.y, p.z), (0.03, 0.26, 0.06), RACK_BASE, bevel=0.006)
    for dz in (0.035, -0.035):
        a = mid - axis * 0.6 + Vector((-TW - 0.16, 0, dz))
        b = mid + axis * 0.62 + Vector((-TW - 0.16, 0, dz))
        cyl("rack_pole", a, b, 0.008, ALU)
        cyl("rack_basket", a + axis * 0.08, a + axis * 0.095, 0.045, RACK_BASE)
        cyl("rack_grip", b - axis * 0.13, b, 0.014, RUBBER)


# ---------------------------------------------------------------- the TRACK
LUG = SPEC["lugHeight"]
HW, TH = SPEC["treadWidth"] / 2, 0.011
(IZ, _), IR = P(L["idler"]["at"]), L["idler"]["radius"]
(SZ, SY), SR = P(L["sprocket"]["at"]), L["sprocket"]["radius"]
C1 = L["contact"][1]
BY_TRACK = LUG + 0.016
IY = BY_TRACK + IR + TH


def build_track():
    """The belt over the idler and the drive, its run on the snow, the upper
    run back, the wheels, the rails and the arms. Returns the lugs' object
    and the metres one morph weight carries the belt round."""
    up = [P(p) for p in L["trackUp"]]
    around = [(IZ + (IR + TH) * math.cos(math.radians(a)), IY + (IR + TH) * math.sin(math.radians(a)))
              for a in (100, 150, 195, 240)]
    belt = ([(IZ, BY_TRACK), ((IZ + C1) / 2, BY_TRACK), (C1 - 0.2, BY_TRACK), (C1 - 0.07, BY_TRACK + 0.015),
             (C1 + 0.03, BY_TRACK + 0.07), (SZ + SR * 0.4, SY - SR * 0.95), (SZ + SR + 0.01, SY + 0.005),
             (SZ + SR * 0.6, SY + SR * 0.9), (SZ - 0.02, SY + SR + 0.03),
             ((SZ + up[-1][0]) / 2, max(SY + SR, up[-1][1]) + 0.02)] + up[::-1] + around)
    loop = catmull([Vector((0, z, y)) for z, y in belt], closed=True, n=10)
    path, belt_len = resample(loop, 0.035 if GAME else 0.012)
    N = len(path)

    def frame_at(i):
        t = (path[(i + 1) % N] - path[i - 1]).normalized()
        return t, Vector((0, t.z, -t.y))

    rings = []
    for i in range(N):
        t, o = frame_at(i)
        p = path[i]
        rings.append([p + o * TH + Vector((-HW, 0, 0)), p + o * TH + Vector((HW, 0, 0)),
                      p - o * TH + Vector((HW, 0, 0)), p - o * TH + Vector((-HW, 0, 0))])
    loft("belt", rings + [rings[0]], [RUBBER], closed=True, cap=False, smooth=False)

    # THE PADDLES: 3-inch lugs at a 3-inch pitch, laid twice — where each
    # stands, and where the one a STEP behind it stands: the morph that turns
    # the belt.
    count = int(belt_len / 0.0762)
    step = 2
    count -= count % step
    lv, lf, lrun = [], [], []
    for k in range(count):
        st = 0.02 if k % 2 else -0.02
        spans = ((-HW + 0.01, -0.06 + st), (0.06 + st, HW - 0.01)) if GAME else (
            (-HW + 0.01, -0.07 + st), (-0.05 + st, 0.05 + st), (0.07 + st, HW - 0.01))
        for x0, x1 in spans:
            base = len(lv)
            for kk, out in ((k, lv), ((k - step) % count, lrun)):
                i = int(kk * N / count)
                t, o = frame_at(i)
                p = path[i] + o * TH
                for dx, dt, dh in ((x0, -0.012, 0), (x1, -0.012, 0), (x1, 0.012, 0), (x0, 0.012, 0),
                                   (x0, -0.006, LUG), (x1, -0.006, LUG), (x1, 0.004, LUG), (x0, 0.004, LUG)):
                    out.append(p + Vector((dx, 0, 0)) + t * dt + o * dh)
            lf += [[base + a for a in f] for f in
                   ((0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0))]
    lugs = mesh_obj("sled_lugs", lv, lf, [RUBBER], smooth=False)
    LUGS_RUN[:] = [lrun]
    COL.objects.unlink(lugs)          # kept out of the joins: it is a node of its own
    hidden.objects.link(lugs)

    wy = BY_TRACK + TH + 0.06
    span = C1 - 0.2 - IZ
    nb = max(2, round(span / 0.35))
    wheels = [(IZ, IY, IR)] + [(IZ + span * k / nb, wy, 0.06) for k in range(1, nb + 1)]
    for z, y, r in wheels:
        for sx in (-1, 1):
            x = sx * (HW - 0.035)
            cyl("wheel", (x - sx * 0.02, z, y), (x + sx * 0.02, z, y), r, BLACK, seg=32)
            cyl("hub", (x + sx * 0.019, z, y), (x + sx * 0.024, z, y), r * 0.55, ALU, seg=24)
    cyl("idler_axle", (-HW, IZ, IY), (HW, IZ, IY), 0.015, STEEL)
    cyl("drive_axle", (-HW, SZ, SY), (HW, SZ, SY), 0.02, STEEL)
    for sx in (-1, 1):
        cyl("sprocket", (sx * 0.12 - 0.02, SZ, SY), (sx * 0.12 + 0.02, SZ, SY), SR, TUNNEL, seg=24)
        tube("rail", [(sx * 0.11, IZ + 0.04, BY_TRACK + 0.035), (sx * 0.11, C1 - 0.1, BY_TRACK + 0.035),
                      (sx * 0.11, C1, BY_TRACK + 0.06), (sx * 0.11, C1 + 0.08, BY_TRACK + 0.13)], 0.016, TUNNEL,
             smooth_n=4)
        zr = IZ + 0.54
        for foot, head in (((sx * 0.12, C1 - 0.05, BY_TRACK + 0.07), (sx * 0.14, C1 + 0.13, SY - 0.02)),
                           ((sx * 0.12, IZ + 0.29, BY_TRACK + 0.06), (sx * 0.15, zr, interp(TUN_BOT, zr) + 0.04))):
            tube("arm", [foot, head], 0.018, TUNNEL)
    zs = IZ + 0.86
    sa, sb = Vector((0, IZ + 0.36, BY_TRACK + 0.07)), Vector((0, zs, interp(TUN_BOT, zs) - 0.01))
    cyl("rear_shock", sa, sb, 0.024, BLACK)
    coil("rear_spring", sa.lerp(sb, 0.12), sa.lerp(sb, 0.8), 0.04, 0.007, 7, SPRING)
    return lugs, step * belt_len / count


# ---------------------------------------------------------------- the FRONT END and the SKIS
SKI = [P(p) for p in L["ski"]]
(S0Z, S0Y), (S1Z, S1Y) = (P(p) for p in L["spindle"])
TIPZ, TIPY = SKI[-1]


def build_ski(sx):
    """One ski on its spindle, with its loop and keel."""
    ski_line = catmull([Vector((0, z, y)) for z, y in SKI], n=8)
    k = SPEC["skiWidth"] / 0.15
    sec = [(x * k, y) for x, y in ((-0.075, 0.004), (-0.075, 0.024), (-0.062, 0.038), (-0.02, 0.043),
                                   (0.02, 0.043), (0.062, 0.038), (0.075, 0.024), (0.075, 0.004),
                                   (0.022, 0.0), (0.012, -0.014), (-0.012, -0.014), (-0.022, 0.0))]
    X = sx * STANCE / 2
    bot, top = Vector((X, S0Z, S0Y - 0.045)), Vector((X - sx * 0.02, S1Z, S1Y + 0.013))
    rings = []
    for i, p in enumerate(ski_line):
        t = (ski_line[min(i + 1, len(ski_line) - 1)] - ski_line[max(i - 1, 0)]).normalized()
        n = Vector((0, -t.z, t.y))
        rings.append([Vector((X + x, p.y, p.z)) + n * y for x, y in sec])
    loft("ski", rings, [BLACK])
    for lx in (-0.055 * k, 0.055 * k):
        tube("ski_loop", [(X + lx, TIPZ - 0.284, SKI[2][1] + 0.037), (X + lx * 1.1, TIPZ - 0.124, TIPY + 0.07),
                          (X + lx, TIPZ - 0.014, TIPY + 0.09), (X + lx * 0.9, TIPZ + 0.006, TIPY + 0.02)],
             0.011, PAINT)
    tube("ski_loop_bar", [(X - 0.06 * k, TIPZ - 0.014, TIPY + 0.09), (X + 0.06 * k, TIPZ - 0.014, TIPY + 0.09)],
         0.011, PAINT)
    tube("carbide", [(X, SKI[1][0] + 0.1, 0.0), (X, SKI[2][0] - 0.04, -0.001)], 0.006, STEEL)
    box("ski_saddle", (X, S0Z, 0.075), (0.05, 0.12, 0.06), ALU)
    cyl("spindle", bot, top, 0.022, TUNNEL)
    return bot


def build_front():
    """The A-arms, the coil-overs and the tie rods on the chassis — painted
    arms and gold springs, as the reference stands."""
    for sx in (-1, 1):
        X = sx * STANCE / 2
        bot, top = Vector((X, S0Z, S0Y - 0.045)), Vector((X - sx * 0.02, S1Z, S1Y + 0.013))
        for fz, rz, y_in, end in ((S0Z + 0.094, S0Z - 0.186, top.z, top + Vector((-sx * 0.01, 0, -0.01))),
                                  (S0Z + 0.114, S0Z - 0.206, bot.z + 0.12, bot + Vector((-sx * 0.01, 0, 0.07)))):
            tube("a_arm", [(sx * 0.16, fz, y_in), tuple(end), (sx * 0.16, rz, y_in)], 0.013, PAINT)
            cyl("pivot", (sx * 0.16, fz - 0.03, y_in), (sx * 0.16, rz + 0.03, y_in), 0.018, TUNNEL)
        sa = Vector((X - sx * 0.07, S0Z - 0.026, bot.z + 0.09))
        sb = Vector((sx * 0.21, S0Z - 0.126, interp(HOOD_BOT, S0Z - 0.126) + 0.2))
        cyl("shock_body", sb, sa.lerp(sb, 0.45), 0.024, BLACK)
        cyl("shock_reservoir", sb + Vector((sx * 0.035, 0.02, -0.03)),
            sb.lerp(sa, 0.3) + Vector((sx * 0.035, 0.02, 0)), 0.017, ALU)
        cyl("shock_shaft", sa, sa.lerp(sb, 0.5), 0.009, STEEL)
        coil("front_spring", sa.lerp(sb, 0.08), sa.lerp(sb, 0.72), 0.036, 0.0065, 6, SPRING)
        yt = (bot.z + top.z) / 2 + 0.04
        tube("tie_rod", [(sx * 0.08, top.y - 0.05, yt), (X - sx * 0.05, top.y - 0.024, yt - 0.01)], 0.008, STEEL)


# ---------------------------------------------------------------- JOIN and EXPORT
# The lugs' run positions, written by `build_track`, so the morph is laid
# after the lugs move to their node's origin.
LUGS_RUN = []
hidden = bpy.data.collections.new("held")
COL.children.link(hidden)


def join(objs, name, origin):
    """Parts into one rigid mesh, its origin at `origin` (modifiers applied,
    curves made meshes), triangulated on fixed diagonals, in a fixed order."""
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
    tri.quad_method, tri.ngon_method, tri.keep_custom_normals = "FIXED", "CLIP", True
    return ob


def build():
    """The snowmobile: the root and its nodes."""
    for k in PARTS:
        PARTS[k] = []
    with gather("body"):
        build_cowl()
        build_chassis()
        build_front()
    with gather("bars"):
        build_bars()
    with gather("ski_l"):
        bot_l = build_ski(-1)
    with gather("ski_r"):
        bot_r = build_ski(1)
    with gather("track"):
        lugs, run = build_track()
    with gather("rack"):
        build_rack()
    body = join(PARTS["body"], "sled_body", (0, 0, 0))
    bars = join(PARTS["bars"], "sled_bars", (0, PZ, PY))
    ski_l = join(PARTS["ski_l"], "sled_ski_l", tuple(bot_l))
    ski_r = join(PARTS["ski_r"], "sled_ski_r", tuple(bot_r))
    track = join(PARTS["track"], "sled_track", (0, SZ, SY))
    rack = join(PARTS["rack"], "sled_rack", (0, 0, 0))
    # The lugs: their own node under the track, the morph on them.
    hidden.objects.unlink(lugs)
    COL.objects.link(lugs)
    lugs.data.transform(Matrix.Translation(-Vector((0, SZ, SY))))
    lugs.location = (0, SZ, SY)
    run_at = [Vector(c) - Vector((0, SZ, SY)) for c in LUGS_RUN[0]]
    if not lugs.data.shape_keys:
        lugs.shape_key_add(name="Basis")
    key = lugs.shape_key_add(name="run")
    for v, co in zip(key.data, run_at):
        v.co = co
    root = bpy.data.objects.new("sled", None)
    COL.objects.link(root)
    root["frame"] = "trace: x right, y forward from the tunnel's end, z up from the snow"
    root["beltRunMetres"] = run
    for o in (body, bars, ski_l, ski_r, track, rack):
        o.parent = root
    lugs.parent = track
    lugs.location = (0, 0, 0)
    nodes = (body, bars, ski_l, ski_r, track, lugs, rack)
    counts = {o.name: lib._tri_count([o]) for o in nodes}
    print("TRIANGLES", "game" if GAME else "render", sum(counts.values()), counts)
    return root, nodes


def export(root, path):
    lib._select_only([root] + list(root.children_recursive))
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_apply=True, export_extras=True,
                              export_skins=False, export_animations=False, export_morph=True,
                              export_morph_normal=False)


cams = lib._studio((0, 1.6, 0.45), 3.3)
lib._cycles(SAMPLES)
ONLY = [v for v in os.environ.get("VIEWS", "").split(",") if v]
views = [v for v in (ONLY or list(cams)) if v in cams and v != "none"]
root, _ = build()
tag = "game" if GAME else "render"
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, f"{NAME}-{tag}.blend"))
for v in views:
    scene.camera = cams[v]
    scene.render.filepath = os.path.join(OUT, f"{NAME}-{tag}-{v}.png")
    bpy.ops.render.render(write_still=True)
if GAME:
    export(root, os.path.join(OUT, f"{NAME}-lod0.glb"))

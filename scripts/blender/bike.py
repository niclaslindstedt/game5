# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE DOWNHILL BIKE MODELLED IN BLENDER off the game's own data: the drawn
# bike's numbers (pwa/src/game/bike-look.ts — the tubes, the fork, the bar,
# the wheels, the shock, the cranks and pedals), every point the game hangs
# a part on (the steer axis, the head tube and the crowns, the grips, both
# axles, the main pivot, the shock's eyes, the saddle), the wheels' sizes
# off the engine and where each node stands at rest (bike-rig.ts's
# `BIKE_REST`), handed in as one JSON file by `scripts/blender.mjs
# --kind=bike`, the only way this runs.
#
# What is drawn is the class's racing bike at its true size, after its
# photographs: a hydroformed alloy front triangle — a big tapered head tube,
# a deep oval down tube, a top tube dropped onto the seat tube, a gusset
# under the head — a single-pivot swingarm whose yoke rises to the shock's
# rear eye, a coil shock with a piggyback reservoir, a dual-crown fork with
# its fender, a riser bar on a direct-mount stem, four-piston calipers on
# 200 mm rotors, a chain guide and bash guard over a single ring, a short
# cage derailleur, flat pedals with their pins, and two wheels — a 29-inch
# front and a 27.5 rear — of deep rims, laced spokes and knobbly tyres.
#
# THE FRAME is the ENGINE's (x right, y up, z forward, metres, the root at
# the bike's centre of mass), written into Blender as (x, -z, y) so the
# glTF's own frame IS the engine's: the game hangs it on the bike's pose
# with no turn. The drive side is the body frame's -x.
#
# RIGID NODES, no armature — the names are `BIKE_NODES` (bike-rig.ts), and
# each node's origin is its pivot, so the game moves it off the engine's
# readings exactly as it moves the code's bike (`bikeNodes`):
#   bike_frame       the front triangle, the BB cluster, the guide, the saddle;
#   bike_bars        crowns, stanchions, stem, bar, grips, levers (steered);
#   bike_fork        the lowers, the fender, the caliper (slid up the axis);
#   bike_wheel_f     the front wheel and its rotor (spun about x);
#   bike_swingarm    stays, yoke, dropouts, caliper, derailleur, chain;
#   bike_wheel_r     the rear wheel, its rotor and cassette;
#   bike_shock       the coil (its +z the eye-to-eye line, stretched in z);
#   bike_shock_body  the body and reservoir (held unstretched);
#   bike_shock_rod   the shaft and the rear eye (held unstretched);
#   bike_cranks      arms, spider, ring, spindle (turned about x);
#   bike_pedal_l/r   the pedals (turned back level).
# Two levels of detail, each built whole: LOD0 for the lens up close, LOD1
# (no pins, bolts, hoses or chain links; fewer knobs, spokes and segments)
# for the far rungs and the lift. THE CLIPS are the game's own (`bikeClips`),
# each node keyed a frame at a time onto an NLA track of the clip's name.
#
# THE MATERIALS, by name: `paint` (the frame's), `decal`, `black`, `dark`,
# `rubber`, `alloy`, `chrome`, `gold` (the stanchions), `spring`, `chain`.

import json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
NAME = os.path.basename(argv[0]).removesuffix(".json")
L, PT, REST, NODES = DATA["look"], DATA["points"], DATA["rest"], DATA["nodes"]
DRIVE = DATA["drive"]

# ---------------------------------------------------------------- materials
PAINT = mat("paint", (0.72, 0.16, 0.018), metal=0.25, rough=0.3, coat=0.9)
DECAL = mat("decal", (0.85, 0.86, 0.87), rough=0.35, coat=0.6)
BLACK = mat("black", (0.016, 0.016, 0.018), metal=0.2, rough=0.42, coat=0.2)
DARK = mat("dark", (0.07, 0.072, 0.078), metal=0.5, rough=0.5)
RUBBER = mat("rubber", (0.018, 0.018, 0.02), rough=0.88)
ALLOY = mat("alloy", (0.62, 0.63, 0.65), metal=1.0, rough=0.3)
CHROME = mat("chrome", (0.85, 0.86, 0.88), metal=1.0, rough=0.08)
GOLD = mat("gold", (0.78, 0.52, 0.16), metal=1.0, rough=0.2)
SPRING = mat("spring", (0.9, 0.78, 0.08), metal=0.3, rough=0.35, coat=0.6)
CHAIN = mat("chain", (0.2, 0.2, 0.21), metal=1.0, rough=0.45)


def V(p):
    """A point of the data ({x, y, z}) as an engine-frame Vector."""
    return Vector((p["x"], p["y"], p["z"]))


def W(v):
    """An engine-frame vector in Blender's frame."""
    return Vector((v[0], -v[2], v[1]))


def WQ(q):
    """An engine-frame turn ({x, y, z, w}) as Blender's quaternion."""
    return Quaternion((q["w"], q["x"], -q["z"], q["y"]))


X = Vector((1, 0, 0))
AXIS = V(PT["steerAxis"])                     # up and back along the head tube
EPS = math.atan2(AXIS.y, -AXIS.z)            # the head angle
OFF = Vector((0, math.cos(EPS), math.sin(EPS)))  # square to the axis, forward
STEER = V(PT["steerAt"])
AXLE_F, AXLE_R = V(PT["axleF"]), V(PT["axleR"])
PIVOT = V(L["pivot"])
SHOCK_F, SHOCK_R = V(L["shockFront"]), V(L["shockRear"])
S_LEN = DATA["shockRest"]
RF, RR = DATA["wheels"]["front"], DATA["wheels"]["rear"]
BB = V(PT["bb"])

# THE LEVEL being built: 0 the near model, 1 the far one.
LEVEL = 0


def seg(n):
    """A round part's segments at this level."""
    return max(6, n if LEVEL == 0 else n // 2)


# ---------------------------------------------------------------- shapes
# Everything is modelled in the BOTTOM BRACKET's frame (the frame node's),
# engine axes, and each node's parts are moved onto its pivot when joined.
PARTS = {k: [] for k in NODES}


class into:
    """Every part made inside the block belongs to node `key`."""

    def __init__(self, key):
        self.key = key

    def __enter__(self):
        self.before = set(COL.objects)

    def __exit__(self, *a):
        self.made = [o for o in COL.objects if o not in self.before and o.type in ("MESH", "CURVE")]
        PARTS[self.key] += self.made


class Batch:
    """Many small boxes in one mesh: knobs, pins, spokes, links."""

    def __init__(self, name, m):
        self.name, self.m, self.verts, self.faces = name, m, [], []

    def box(self, c, u, v, w, size):
        u, v, w = u.normalized(), v.normalized(), w.normalized()
        a, b, h = size[0] / 2, size[1] / 2, size[2] / 2
        base = len(self.verts)
        for sw in (-1, 1):
            for sv in (-1, 1):
                for su in (-1, 1):
                    self.verts.append(W(c + u * su * a + v * sv * b + w * sw * h))
        for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            self.faces.append(tuple(base + i for i in f))

    def rod(self, a, b, r):
        """A square-section rod from a to b (a spoke, a pin)."""
        d = b - a
        u = d.cross(X if abs(d.normalized().dot(X)) < 0.9 else Vector((0, 1, 0)))
        v = d.cross(u)
        self.box((a + b) / 2, u, v, d, (2 * r, 2 * r, d.length))

    def done(self):
        if self.faces:
            return mesh_obj(self.name, self.verts, self.faces, [self.m], smooth=False)


def basis(t, across=X):
    """Two axes square to direction `t`: across (x unless t runs along x) and the other."""
    t = t.normalized()
    a = across - t * across.dot(t)
    if a.length < 1e-6:
        a = Vector((0, 1, 0)) - t * t.y
    a.normalize()
    return a, t.cross(a).normalized()


def ring_at(c, t, hx, hv, n=2.0, M=16, across=X, roll=0.0):
    a, b = basis(t, across)
    if roll:
        a, b = a * math.cos(roll) + b * math.sin(roll), b * math.cos(roll) - a * math.sin(roll)
    out = []
    for k in range(M):
        th = 2 * math.pi * k / M
        ca, sa = math.cos(th), math.sin(th)
        x = math.copysign(abs(ca) ** (2 / n), ca) * hx
        y = math.copysign(abs(sa) ** (2 / n), sa) * hv
        out.append(W(c + a * x + b * y))
    return out


def sweep(name, pts, sections, m, n=2.0, M=16, across=X, cap=True, smooth_n=0):
    """A tube along `pts` (engine Vectors), each point's section (half
    across, half the other way) — a squared ellipse of exponent `n`."""
    if smooth_n:
        P = catmull(pts, False, smooth_n)
        S = [sections[min(len(sections) - 1, int(i / smooth_n))] for i in range(len(P))]
        # Sections between knots blended.
        S = []
        for i in range(len(P)):
            k = i / smooth_n
            j = min(int(k), len(sections) - 2)
            u = min(1.0, k - j)
            a, b = sections[j], sections[j + 1]
            S.append(tuple(x + (y - x) * u for x, y in zip(a, b)))
        pts, sections = P, S
    M = seg(M)
    rings = []
    for i, c in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)])
        hx, hv = sections[i][:2]
        rings.append(ring_at(c, t, hx, hv, n, M, across))
    return loft(name, rings, [m], cap=cap)


def rod(name, a, b, r, m, n=16, r2=None):
    return cyl(name, W(a), W(b), r, m, seg=seg(n), r2=r2)


def obox(name, c, u, v, w, size, m, bevel=0.0):
    bt = Batch(name, m)
    bt.box(c, u, v, w, size)
    ob = bt.done()
    if bevel and LEVEL == 0:
        mod = ob.modifiers.new("bevel", "BEVEL")
        mod.width, mod.segments = bevel, 2
    return ob


def plate(name, profile, x0, x1, m, bevel=0.0):
    """A side profile [(z, y)…] (a convex outline, in order) run across from x0 to x1."""
    verts = [W(Vector((x, y, z))) for x in (x0, x1) for z, y in profile]
    n = len(profile)
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    ob = mesh_obj(name, verts, faces, [m], smooth=False)
    if bevel and LEVEL == 0:
        mod = ob.modifiers.new("bevel", "BEVEL")
        mod.width, mod.segments = bevel, 2
    return ob


def revolve(name, centre, profile, m, M=48, cap=False):
    """A solid of revolution about the x axis through `centre`: the profile
    [(r, x)…] (closed) swept round."""
    M = seg(M)
    rings = []
    for r, x in profile + [profile[0]]:
        rings.append([W(centre + Vector((x, r * math.cos(2 * math.pi * k / M), r * math.sin(2 * math.pi * k / M))))
                      for k in range(M)])
    return loft(name, rings, [m], cap=cap)


def disc(name, centre, x, r, t, m, M=24, r_in=0.0):
    """A disc (or an annulus from r_in) square to x."""
    if r_in <= 0:
        return rod(name, centre + Vector((x - t / 2, 0, 0)), centre + Vector((x + t / 2, 0, 0)), r, m, M)
    return revolve(name, centre, [(r_in, x - t / 2), (r, x - t / 2), (r, x + t / 2), (r_in, x + t / 2)], m, M)


def hose(name, pts, r, m):
    if LEVEL:
        return None
    return tube(name, [W(p) for p in pts], r, m, smooth_n=6, res=1)


# ---------------------------------------------------------------- the FRAME
def build_frame():
    T = L["tube"]
    ht_b, ht_t = V(PT["headBottom"]) - AXIS * 0.012, V(PT["headTop"]) + AXIS * 0.008
    # The head tube, tapered, with its headset cups.
    rod("head_tube", ht_b, ht_t, 0.031, PAINT, 24, r2=0.027)
    rod("cup_lo", ht_b - AXIS * 0.008, ht_b + AXIS * 0.004, 0.033, BLACK, 24)
    rod("cup_hi", ht_t - AXIS * 0.004, ht_t + AXIS * 0.01, 0.029, BLACK, 24)
    # The down tube: deep and oval at the head, flattening and widening
    # into the bottom bracket, bowed a little under the tyre's sweep.
    down = [V(PT["headBottom"]) + AXIS * 0.03 - OFF * 0.012, Vector((0, 0.39, 0.37)), Vector((0, 0.2, 0.2)),
            Vector((0, 0.06, 0.07)), Vector((0, 0.025, 0.035))]
    sweep("down_tube", down, [(0.03, 0.044), (0.033, 0.04), (0.035, 0.036), (0.038, 0.032), (0.036, 0.03)],
          PAINT, n=2.4, M=20, smooth_n=4)
    # The top tube, dropped onto the seat tube, and the gusset under the head.
    top = [V(PT["headTop"]) - AXIS * 0.022 - OFF * 0.012, Vector((0, 0.56, 0.24)), Vector((0, 0.5, 0.02)),
           Vector((0, 0.42, -0.16))]
    sweep("top_tube", top, [(0.023, 0.032), (0.023, 0.028), (0.022, 0.026), (0.024, 0.026)], PAINT, n=2.3, M=18,
          smooth_n=4)
    hb, htp = V(PT["headBottom"]), V(PT["headTop"])
    plate("gusset", [(hb.z - 0.01, hb.y + 0.03), (htp.z - 0.03, htp.y - 0.04), (htp.z - 0.12, htp.y - 0.08),
                     (hb.z - 0.13, hb.y - 0.02)], -0.012, 0.012, PAINT, bevel=0.004)
    # The seat tube, bowed forward clear of the rear tyre at full travel,
    # its clamp and the post.
    st = [Vector((0, 0.03, -0.02)), Vector((0, 0.15, -0.055)), Vector((0, 0.3, -0.12)), V(L["seatTop"])]
    sweep("seat_tube", st, [(0.03, 0.034), (0.027, 0.03), (0.024, 0.025), (0.0235, 0.0235)],
          PAINT, M=18, smooth_n=4)
    seat_top, saddle = V(L["seatTop"]), V(L["saddle"]["at"])
    rod("clamp", seat_top - Vector((0, 0.012, -0.005)), seat_top + Vector((0, 0.012, -0.005)), 0.026, BLACK, 18)
    rod("post", seat_top - Vector((0, 0.02, -0.009)), saddle + Vector((0, 0.008, 0.004)), 0.0155, BLACK, 16)
    obox("post_head", saddle + Vector((0, 0.012, 0.004)), X, Vector((0, 1, 0)), Vector((0, 0, 1)), (0.04, 0.016, 0.05),
         BLACK, bevel=0.004)
    # The BB cluster: the shell, the plate tying it to the seat tube and
    # the main pivot's boss, and the boss itself.
    rod("bb_shell", Vector((-0.043, 0, 0)), Vector((0.043, 0, 0)), 0.026, PAINT, 20)
    for s in (-1, 1):
        rod("bb_cup", Vector((s * 0.043, 0, 0)), Vector((s * 0.05, 0, 0)), 0.023, BLACK, 18)
    plate("cluster", [(0.07, 0.0), (0.05, 0.06), (0.02, 0.12), (-0.035, 0.13), (-0.05, 0.05), (-0.03, -0.02),
                      (0.03, -0.025)], -0.03, 0.03, PAINT, bevel=0.005)
    rod("pivot_boss", Vector((-0.032, PIVOT.y, PIVOT.z)), Vector((0.032, PIVOT.y, PIVOT.z)), 0.024, PAINT, 18)
    # The shock's front mount: a clevis on the down tube's back.
    for s in (-1, 1):
        plate("clevis", [(SHOCK_F.z + 0.035, SHOCK_F.y - 0.075), (SHOCK_F.z + 0.03, SHOCK_F.y + 0.012),
                         (SHOCK_F.z - 0.012, SHOCK_F.y + 0.015), (SHOCK_F.z - 0.03, SHOCK_F.y - 0.01),
                         (SHOCK_F.z - 0.04, SHOCK_F.y - 0.12)], s * 0.013, s * 0.019, PAINT, bevel=0.002)
    rod("clevis_bolt", SHOCK_F - Vector((0.024, 0, 0)), SHOCK_F + Vector((0.024, 0, 0)), 0.0065, ALLOY, 12)
    # The decals: white bands laid on the down tube's sides and the top tube's.
    if LEVEL == 0:
        for name, path, secs, span in (("decal_down", down[1:4], [(0.0312, 0.0332), (0.0322, 0.0302), (0.0352, 0.0282)], 0.85),
                                       ("decal_top", top[1:3], [(0.0216, 0.0246), (0.0206, 0.0226)], 0.7)):
            P = catmull(path, False, 6)
            S = []
            for i in range(len(P)):
                k = i / 6
                j = min(int(k), len(secs) - 2)
                u = min(1.0, k - j)
                S.append(tuple(x + (y - x) * u for x, y in zip(secs[j], secs[j + 1])))
            for side in (-1, 1):
                rings = []
                for i, c in enumerate(P):
                    t = P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]
                    a, b = basis(t)
                    hx, hv = S[i]
                    arc = []
                    for k in range(7):
                        th = (k / 6 - 0.5) * span + (0 if side > 0 else math.pi)
                        ca, sa = math.cos(th), math.sin(th)
                        arc.append(W(c + a * math.copysign(abs(ca) ** (2 / 2.4), ca) * hx
                                       + b * math.copysign(abs(sa) ** (2 / 2.4), sa) * hv))
                    rings.append(arc)
                loft(name, rings, [DECAL], closed=False, cap=False)
    # The chain guide's upper slider and the bash guard over the ring.
    x = DRIVE * 0.058
    plate("iscg", [(0.02, -0.03), (0.055, 0.045), (0.0, 0.09), (-0.05, 0.06), (-0.03, -0.02)],
          x - DRIVE * 0.008, x - DRIVE * 0.012, BLACK)
    obox("guide", Vector((x, 0.083, -0.028)), X, Vector((0, 0.3, -1)), Vector((0, 1, 0.3)), (0.02, 0.06, 0.02),
         DARK, bevel=0.003)
    bash = []
    for k in range(0, 13):
        th = math.radians(-160 + 120 * k / 12)
        bash.append((math.cos(th), math.sin(th)))
    prof = [(0.088 * c, 0.088 * s) for c, s in bash] + [(0.074 * c, 0.074 * s) for c, s in reversed(bash)]
    verts = [W(Vector((x + DRIVE * d, y, z))) for d in (0.0, 0.006) for z, y in prof]
    n = len(prof)
    faces = [(i, i + 1, n + i + 1, n + i) for i in range(n - 1)] + [(n - 1, 0, n, 2 * n - 1)]
    half = n // 2
    for i in range(half - 1):
        for base in (0, n):
            faces.append((base + i, base + i + 1, base + n - 2 - i, base + n - 1 - i))
    mesh_obj("bash", verts, faces, [BLACK], smooth=False)
    # The saddle: a shell from its broad tail to its nose, on rails.
    sa = saddle + Vector((0, 0.022, 0))
    Ls, Ws = L["saddle"]["length"], L["saddle"]["width"]
    rows = [(-0.5, 0.42, 0.012), (-0.42, 0.5, 0.02), (-0.2, 0.46, 0.022), (0.05, 0.27, 0.018), (0.3, 0.17, 0.014),
            (0.5, 0.12, 0.008)]
    rings = []
    M = seg(16)
    for u, w, h in rows:
        c = sa + Vector((0, h * 0.6 + 0.004 * (u + 0.5), u * Ls))
        rings.append([W(c + Vector((math.cos(2 * math.pi * k / M) * w * Ws,
                                    max(-0.4, math.sin(2 * math.pi * k / M)) * h, 0))) for k in range(M)])
    loft("saddle", rings, [BLACK])
    for s in (-1, 1):
        rod("rail", sa + Vector((s * 0.022, -0.012, -0.09)), sa + Vector((s * 0.02, -0.012, 0.08)), 0.0035, ALLOY, 8)
    # The rear hose and the gear housing, along the down tube's underside.
    hose("hose_frame", [V(PT["headBottom"]) + Vector((0.03, -0.02, 0.0)), Vector((0.03, 0.33, 0.33)),
                        Vector((0.03, 0.12, 0.13)), Vector((0.035, 0.0, 0.04)), Vector((0.05, 0.03, -0.04))], 0.0028, BLACK)
    hose("housing_frame", [V(PT["headBottom"]) + Vector((-0.03, -0.02, 0.0)), Vector((-0.03, 0.33, 0.33)),
                           Vector((-0.03, 0.12, 0.13)), Vector((-0.035, 0.0, 0.04)), Vector((-0.05, 0.03, -0.04))],
         0.0024, BLACK)


# ---------------------------------------------------------------- the STEERED SIDE
def leg_line(s, t):
    """The fork's leg `s` (±1) at `t` m up the steer axis from the axle."""
    return AXLE_F + AXIS * t + Vector((s * L["forkHalf"], 0, 0))


def crown(name, c, thick):
    """A forged crown on the steerer at `c`, reaching forward to both legs."""
    leg = c + OFF * (AXLE_F - STEER).dot(OFF)
    mid = (c + leg) / 2
    half = L["forkHalf"]
    # The bridge: lofted across from leg to leg, deepest at the steerer.
    rings = []
    for x in [-half - 0.03, -half, -0.035, 0.0, 0.035, half, half + 0.03]:
        d = 0.034 if abs(x) < 0.05 else 0.026
        ring = []
        M = seg(12)
        for k in range(M):
            th = 2 * math.pi * k / M
            ring.append(W(mid + Vector((x, 0, 0)) + OFF * (d * math.cos(th) * 1.2) + AXIS * (thick / 2 * math.sin(th))))
        rings.append(ring)
    loft(name, rings, [BLACK])
    rod(name + "_steerer", c - AXIS * thick * 0.7, c + AXIS * thick * 0.7, 0.03, BLACK, 18)
    for s in (-1, 1):
        p = leg_line(s, (c - AXLE_F).dot(AXIS))
        rod(name + "_clamp", p - AXIS * thick * 0.6, p + AXIS * thick * 0.6, L["stanchion"]["r"] + 0.009, BLACK, 18)
        if LEVEL == 0:
            for k in (-1, 1):
                b = p + AXIS * (k * thick * 0.25) - OFF * 0.022
                rod("pinch", b + Vector((-0.012, 0, 0)), b + Vector((0.012, 0, 0)), 0.004, ALLOY, 8)


def build_bars():
    ct, cb = V(PT["crownTop"]), V(PT["crownBottom"])
    crown("crown_top", ct, 0.03)
    crown("crown_bottom", cb, 0.036)
    # The stanchions: from inside the lowers to a cap over the top crown.
    t_top = (ct - AXLE_F).dot(AXIS) + 0.04
    for s in (-1, 1):
        rod("stanchion", leg_line(s, 0.3), leg_line(s, t_top), L["stanchion"]["r"], GOLD, 24)
        rod("top_cap", leg_line(s, t_top), leg_line(s, t_top + 0.012), L["stanchion"]["r"] * 0.9, BLACK, 16)
    # The stem, direct-mounted on the top crown, clamping the bar.
    bm = V(PT["barMiddle"])
    base = ct + AXIS * 0.018
    obox("stem", (base + bm) / 2 - Vector((0, 0.004, 0)), X, Vector((0, (bm - base).normalized().z, -(bm - base).normalized().y)),
         bm - base, (0.05, 0.03, (bm - base).length + 0.03), BLACK, bevel=0.005)
    rod("stem_clamp", bm - Vector((0.026, 0, 0)), bm + Vector((0.026, 0, 0)), 0.022, BLACK, 18)
    if LEVEL == 0:
        for k in (-1, 1):
            b = bm + Vector((0, 0.008 * k, 0.022))
            rod("stem_bolt", b - Vector((0.03, 0, 0)), b + Vector((0.03, 0, 0)), 0.0035, ALLOY, 8)
    # The riser bar: the clamp's 31.8 mm, then up and swept back to the grips.
    g = [V(p) for p in PT["grips"]]
    half_w = L["barWidth"] / 2
    rod("bar_mid", bm - Vector((0.07, 0, 0)), bm + Vector((0.07, 0, 0)), 0.0159, BLACK, 16)
    for s, gp in ((-1, g[0]), (1, g[1])):
        path = [bm + Vector((s * 0.06, 0, 0)), bm + Vector((s * 0.13, 0.004, -0.003)),
                Vector((s * 0.2, gp.y - 0.002, gp.z + 0.012)), Vector((s * 0.27, gp.y, gp.z + 0.002)),
                Vector((s * half_w, gp.y, gp.z - 0.002))]
        sweep("bar", path, [(0.0145, 0.0145), (0.0125, 0.0125), (0.0112, 0.0112), (0.011, 0.011), (0.011, 0.011)],
              BLACK, M=12, smooth_n=3)
        # The grip, its lock-on ring and the bar's end plug.
        gl = L["grip"]
        a, b = gp - Vector((s * gl / 2, 0, 0)), gp + Vector((s * gl / 2, 0, 0))
        rod("grip", a, b, 0.0165, RUBBER, 16)
        if LEVEL == 0:
            for k in range(9):
                p = a + (b - a) * ((k + 1) / 10)
                rod("grip_rib", p - Vector((0.002, 0, 0)), p + Vector((0.002, 0, 0)), 0.0172, RUBBER, 16)
        rod("lock_ring", a - Vector((s * 0.008, 0, 0)), a + Vector((s * 0.002, 0, 0)), 0.0175, PAINT, 16)
        rod("bar_plug", b, b + Vector((s * 0.003, 0, 0)), 0.0155, BLACK, 12)
        # The brake: its master cylinder and reservoir on the bar, the lever
        # blade reaching out over the grip.
        mc = a - Vector((s * 0.03, 0, 0))
        rod("master", mc - Vector((s * 0.018, 0, 0)) + Vector((0, 0.0, 0.012)),
            mc + Vector((s * 0.022, 0, 0)) + Vector((0, 0.0, 0.012)), 0.013, BLACK, 12)
        obox("reservoir", mc + Vector((s * 0.002, 0.016, 0.004)), X, Vector((0, 1, 0)), Vector((0, 0, 1)),
             (0.03, 0.012, 0.03), BLACK, bevel=0.003)
        piv = mc + Vector((s * 0.02, -0.004, 0.03))
        blade = [piv, piv + Vector((s * 0.03, -0.006, 0.012)), piv + Vector((s * 0.075, -0.016, 0.004))]
        sweep("lever", blade, [(0.004, 0.009), (0.004, 0.007), (0.0035, 0.006)], ALLOY, n=3, M=8,
              across=Vector((0, 1, 0)))
        if s == DRIVE:
            # The shifter's pod under the bar on the drive side.
            obox("shifter", mc + Vector((-s * 0.02, -0.025, -0.004)), X, Vector((0, 1, 0)), Vector((0, 0, 1)),
                 (0.035, 0.022, 0.03), BLACK, bevel=0.003)
            rod("paddle", mc + Vector((-s * 0.005, -0.035, 0.01)), mc + Vector((s * 0.02, -0.04, 0.035)), 0.004, DARK, 8)
    # The hoses, looped forward off the levers: the front's down to its
    # caliper on the +x leg, the rear's and the gear's back into the frame.
    hb = V(PT["headBottom"])
    hose("hose_front", [g[1] + Vector((-0.07, 0.012, 0.01)), g[1] + Vector((-0.12, 0.03, 0.09)),
                        Vector((0.12, 0.62, 0.62)), leg_line(1, 0.48) + Vector((0.03, 0, 0)) - OFF * 0.03],
         0.0028, BLACK)
    hose("hose_rear", [g[0] + Vector((0.07, 0.012, 0.01)), g[0] + Vector((0.12, 0.04, 0.08)),
                       Vector((0.0, 0.66, 0.6)), hb + Vector((0.03, 0.0, 0.03))], 0.0028, BLACK)


def build_fork():
    lo = L["lower"]
    for s in (-1, 1):
        # The lower leg: a casting tapering to the dropout, its seal head.
        sweep("lower", [leg_line(s, -0.03), leg_line(s, 0.04), leg_line(s, lo["length"] - 0.04)],
              [(0.021, 0.026), (lo["r"], lo["r"]), (lo["r"], lo["r"])], BLACK, M=20)
        rod("seal", leg_line(s, lo["length"] - 0.04), leg_line(s, lo["length"] - 0.022), lo["r"] + 0.0015, DARK, 20)
        rod("seal_lip", leg_line(s, lo["length"] - 0.022), leg_line(s, lo["length"] - 0.016), lo["r"] - 0.004,
            BLACK, 20)
        # The axle's pinch at the foot.
        obox("foot", leg_line(s, 0.0) + Vector((s * 0.004, 0, 0)), X, OFF, AXIS, (0.028, 0.05, 0.045), BLACK, bevel=0.006)
        if LEVEL == 0:
            for k in (-1, 1):
                b = leg_line(s, 0.0) + AXIS * (0.012 * k) - OFF * 0.022 + Vector((s * 0.008, 0, 0))
                rod("pinch", b - Vector((0.008, 0, 0)), b + Vector((0.008, 0, 0)), 0.0035, ALLOY, 8)
    # The decal on each lower's outside.
    if LEVEL == 0:
        for s in (-1, 1):
            rings = []
            for t in (0.12, 0.3):
                c = leg_line(s, t)
                rings.append([W(c + X * (s * (lo["r"] + 0.0006) * math.cos(th)) + OFF * ((lo["r"] + 0.0006) * math.sin(th)))
                              for th in [(k / 6 - 0.5) * 1.3 for k in range(7)]])
            loft("decal_lower", rings, [DECAL], closed=False, cap=False)
    # The through axle and its lever.
    rod("axle_f", AXLE_F - Vector((0.1, 0, 0)), AXLE_F + Vector((0.1, 0, 0)), 0.0075, ALLOY, 12)
    rod("axle_lever", AXLE_F + Vector((0.1, 0, 0)), AXLE_F + Vector((0.11, -0.01, -0.05)), 0.005, BLACK, 8)
    # The fender bolted between the lowers' tops, over the tyre.
    top = leg_line(0, 0.24)
    c = AXLE_F
    up = (top - c).normalized()
    ahead = Vector((0, -up.z, up.y))
    rings = []
    for k in range(7):
        th = math.radians(-35 + 70 * k / 6)
        d = up * math.cos(th) + ahead * math.sin(th)
        p = c + d * (RF + 0.03)
        rings.append([W(p + X * (w * 0.045) + d * (0.006 * (1 - w * w))) for w in (-1, -0.6, 0, 0.6, 1)])
    loft("fender", rings, [BLACK], closed=False, cap=False)
    # The caliper, on the +x leg behind the axle, astride the rotor.
    x = 0.062
    ang = math.radians(120)  # behind and above the axle
    rp = AXLE_F + Vector((0, math.sin(ang), math.cos(ang))) * (L["rotor"] - 0.008)
    obox("caliper_f", Vector((x, rp.y, rp.z)), X, Vector((0, math.cos(ang), -math.sin(ang))),
         Vector((0, math.sin(ang), math.cos(ang))), (0.034, 0.075, 0.03), ALLOY, bevel=0.006)
    obox("caliper_mount_f", (Vector((x - 0.01, rp.y, rp.z)) + leg_line(1, 0.03)) / 2, X,
         Vector((0, 0, 1)), Vector((0, 1, 0)), (0.012, 0.03, 0.06), BLACK, bevel=0.003)


# ---------------------------------------------------------------- the WHEELS
def wheel(centre, rim, R, hub_x, cassette):
    """A wheel about x at `centre`: the tyre and its knobs, the rim, the
    spokes, the hub, the rotor (+x) and, on the rear, the cassette (drive side)."""
    h = R - rim - 0.006          # the casing's height; the knobs stand 6 mm on it
    w = L["tyre"] / 2
    prof = [(rim - 0.002, -0.013), (rim + 0.012, -0.024), (rim + h * 0.55, -w), (rim + h * 0.85, -w * 0.92),
            (rim + h, -w * 0.55), (rim + h + 0.0015, 0.0), (rim + h, w * 0.55), (rim + h * 0.85, w * 0.92),
            (rim + h * 0.55, w), (rim + 0.012, 0.024), (rim - 0.002, 0.013), (rim - 0.006, 0.0)]
    revolve("tyre", centre, prof, RUBBER, M=64 if LEVEL == 0 else 36)
    # The knobs: a centre row of paired blocks and a ramp, side knobs on
    # each shoulder canted out, transition knobs between — a ring at a time.
    knobs = Batch("knobs", RUBBER)
    n = L["knobs"] if LEVEL == 0 else L["knobs"] // 2
    for i in range(n):
        a = 2 * math.pi * i / n
        radial = Vector((0, math.cos(a), math.sin(a)))
        tangent = Vector((0, -math.sin(a), math.cos(a)))
        crown_r = rim + h + 0.0015
        if i % 2 == 0:
            for sx in (-1, 1):
                knobs.box(centre + Vector((sx * 0.009, 0, 0)) + radial * (crown_r + 0.003), X, radial, tangent,
                          (0.014, 0.007, 0.016))
        else:
            knobs.box(centre + radial * (crown_r + 0.003), X, radial, tangent, (0.024, 0.007, 0.012))
        for sx in (-1, 1):
            # Shoulder: canted on the casing's side.
            cant = math.radians(48)
            nrm = radial * math.cos(cant) + X * (sx * math.sin(cant))
            pos = centre + radial * (rim + h * 0.78) + X * (sx * w * 0.95) + nrm * 0.004
            across = X * math.cos(cant) - radial * (sx * math.sin(cant))
            knobs.box(pos, across, nrm, tangent, (0.016, 0.008, 0.013 if i % 2 else 0.018))
            if LEVEL == 0 and i % 2:
                tn = radial * math.cos(math.radians(22)) + X * (sx * math.sin(math.radians(22)))
                knobs.box(centre + radial * (rim + h * 0.97) + X * (sx * w * 0.6) + tn * 0.003, X, tn, tangent,
                          (0.01, 0.006, 0.01))
    knobs.done()
    # The rim: a deep box section, its bead hooks either side.
    revolve("rim", centre, [(rim - 0.022, -0.012), (rim - 0.003, -0.0155), (rim + 0.004, -0.0155),
                            (rim + 0.004, -0.012), (rim - 0.001, -0.011), (rim - 0.001, 0.011),
                            (rim + 0.004, 0.012), (rim + 0.004, 0.0155), (rim - 0.003, 0.0155),
                            (rim - 0.022, 0.012)], BLACK, M=64 if LEVEL == 0 else 32)
    # The rim's stickers: two arcs a side.
    if LEVEL == 0:
        for sx in (-1, 1):
            for a0 in (0.35, 0.35 + math.pi):
                arcs = []
                for r in (rim - 0.019, rim - 0.003):
                    arcs.append([W(centre + Vector((sx * 0.0158, r * math.cos(a0 + 1.1 * k / 16), r * math.sin(a0 + 1.1 * k / 16))))
                                 for k in range(17)])
                loft("rim_decal", arcs, [DECAL], closed=False, cap=False)
    # The hub: its shell, both flanges, the end caps.
    rod("hub", centre - Vector((hub_x, 0, 0)), centre + Vector((hub_x, 0, 0)), L["hub"] * 0.7, ALLOY, 16)
    for s in (-1, 1):
        disc("flange", centre, s * 0.033, 0.03, 0.004, ALLOY, 16)
    # The spokes, laced three-cross: each from a flange to the rim, leading
    # or trailing in turn.
    spokes = Batch("spokes", ALLOY)
    ns = L["spokes"] if LEVEL == 0 else L["spokes"] // 2
    for i in range(ns):
        a = 2 * math.pi * i / ns
        s = 1 if i % 2 else -1
        lead = 1 if (i // 2) % 2 else -1
        ah = a + lead * 0.55
        hub_p = centre + Vector((s * 0.033, 0.027 * math.cos(ah), 0.027 * math.sin(ah)))
        rim_p = centre + Vector((s * 0.004, (rim - 0.02) * math.cos(a), (rim - 0.02) * math.sin(a)))
        spokes.rod(hub_p, rim_p, 0.0011 if LEVEL == 0 else 0.0016)
        if LEVEL == 0:
            spokes.rod(rim_p, rim_p + (rim_p - hub_p).normalized() * 0.012, 0.0022)
    spokes.done()
    # The rotor: an annulus with its spider, on the +x side.
    rx = 0.06
    disc("rotor", centre, rx, L["rotor"], 0.0022, ALLOY, 48, r_in=L["rotor"] - 0.022)
    sp = Batch("spider", DARK)
    for k in range(6):
        a = 2 * math.pi * k / 6
        d = Vector((0, math.cos(a), math.sin(a)))
        sp.rod(centre + Vector((rx, 0, 0)) + d * 0.022, centre + Vector((rx, 0, 0)) + d * (L["rotor"] - 0.02), 0.004)
    sp.done()
    disc("rotor_hub", centre, rx, 0.026, 0.004, DARK, 16)
    if cassette:
        for k in range(10 if LEVEL == 0 else 4):
            r = L["cog"] - k * (L["cog"] - 0.022) / 9 if LEVEL == 0 else L["cog"] - k * 0.009
            disc("cog", centre, DRIVE * (0.058 - k * 0.0035 * (1 if LEVEL == 0 else 2.2)), r, 0.0018, CHAIN, 32)
    # The valve.
    if LEVEL == 0:
        rod("valve", centre + Vector((0, rim - 0.022, 0)), centre + Vector((0, rim - 0.04, 0)), 0.003, ALLOY, 8)


# ---------------------------------------------------------------- the SWINGARM
def build_swingarm():
    ax = AXLE_R
    for s in (-1, 1):
        # The chainstay, dipped under the chain's top run.
        cs = [Vector((s * 0.04, PIVOT.y - 0.005, PIVOT.z - 0.012)), Vector((s * 0.058, 0.035, -0.12)),
              Vector((s * 0.07, -0.03, -0.33)), Vector((s * 0.076, ax.y - 0.004, ax.z + 0.03))]
        sweep("chainstay", cs, [(0.018, 0.034), (0.017, 0.032), (0.015, 0.026), (0.013, 0.02)], PAINT, n=3.0, M=16,
              smooth_n=3)
        # The seatstay, up to the yoke's top at the shock's eye.
        ss = [Vector((s * 0.076, ax.y + 0.02, ax.z + 0.02)), Vector((s * 0.062, 0.12, -0.25)),
              Vector((s * 0.034, SHOCK_R.y - 0.015, SHOCK_R.z - 0.04))]
        sweep("seatstay", ss, [(0.011, 0.014), (L["tube"]["stay"], L["tube"]["stay"]), (0.016, 0.018)], PAINT,
              M=14, smooth_n=3)
        # The yoke: from the pivot's boss up to the shock's eye.
        yk = [Vector((s * 0.036, PIVOT.y + 0.01, PIVOT.z + 0.004)), Vector((s * 0.032, 0.2, 0.0)),
              Vector((s * 0.022, SHOCK_R.y - 0.008, SHOCK_R.z))]
        sweep("yoke", yk, [(0.013, 0.032), (0.012, 0.026), (0.01, 0.022)], PAINT, n=2.8, M=14, smooth_n=3)
        # The dropout plate round the axle.
        obox("dropout", Vector((s * 0.08, ax.y + 0.012, ax.z + 0.012)), X, Vector((0, 1, 0)), Vector((0, 0, 1)),
             (0.008, 0.05, 0.06), PAINT, bevel=0.006)
        rod("pivot_side", Vector((s * 0.032, PIVOT.y, PIVOT.z)), Vector((s * 0.05, PIVOT.y, PIVOT.z)), 0.022, PAINT, 18)
        rod("pivot_cap", Vector((s * 0.05, PIVOT.y, PIVOT.z)), Vector((s * 0.054, PIVOT.y, PIVOT.z)), 0.012, ALLOY, 12)
    # The braces: across the stays behind the seat tube, and the yoke's top.
    rod("brace_top", Vector((-0.04, SHOCK_R.y - 0.02, SHOCK_R.z - 0.05)),
        Vector((0.04, SHOCK_R.y - 0.02, SHOCK_R.z - 0.05)), 0.012, PAINT, 12)
    rod("brace_low", Vector((-0.05, 0.06, -0.06)), Vector((0.05, 0.06, -0.06)), 0.013, PAINT, 12)
    rod("eye_bolt_r", SHOCK_R - Vector((0.026, 0, 0)), SHOCK_R + Vector((0.026, 0, 0)), 0.0065, ALLOY, 12)
    rod("axle_r", ax - Vector((0.092, 0, 0)), ax + Vector((0.092, 0, 0)), 0.0075, ALLOY, 12)
    rod("axle_lever_r", ax + Vector((0.092, 0, 0)), ax + Vector((0.1, 0.01, 0.05)), 0.005, BLACK, 8)
    # The rear caliper on the +x chainstay, ahead of and over the axle.
    ang = math.radians(35)
    rp = ax + Vector((0, math.sin(ang), math.cos(ang))) * (L["rotor"] - 0.008)
    obox("caliper_r", Vector((0.062, rp.y, rp.z)), X, Vector((0, math.cos(ang), -math.sin(ang))),
         Vector((0, math.sin(ang), math.cos(ang))), (0.034, 0.075, 0.03), ALLOY, bevel=0.006)
    obox("caliper_mount_r", Vector((0.07, rp.y - 0.02, rp.z + 0.02)), X, Vector((0, 1, 0)), Vector((0, 0, 1)),
         (0.012, 0.03, 0.05), BLACK, bevel=0.003)
    hose("hose_arm", [Vector((0.05, 0.03, -0.04)), Vector((0.06, 0.06, -0.15)), Vector((0.072, 0.0, -0.3)),
                      Vector((0.07, rp.y + 0.01, rp.z - 0.02))], 0.0028, BLACK)
    # The derailleur: its hanger off the drive dropout, the body, the cage
    # and two jockey wheels hanging under the cassette.
    d = DRIVE
    hang = ax + Vector((d * 0.083, -0.02, -0.01))
    obox("hanger", hang, X, Vector((0, 1, 0)), Vector((0, 0, 1)), (0.005, 0.04, 0.025), BLACK)
    body = ax + Vector((d * 0.088, -0.045, -0.03))
    obox("mech", body, X, Vector((0, 1, -0.4)), Vector((0, 0.4, 1)), (0.024, 0.04, 0.05), BLACK, bevel=0.004)
    j1, j2 = ax + Vector((d * 0.058, -0.075, 0.005)), ax + Vector((d * 0.058, -0.135, 0.03))
    for j in (j1, j2):
        disc("jockey", j, 0, 0.016, 0.006, DARK, 12)
    plate("cage", [(j1.z - ax.z + 0.02, j1.y - ax.y + 0.02), (j2.z - ax.z + 0.03, j2.y - ax.y - 0.015),
                   (j2.z - ax.z - 0.002, j2.y - ax.y - 0.02), (j1.z - ax.z - 0.018, j1.y - ax.y)],
          d * 0.064, d * 0.068, BLACK)
    # The chain: the top run from the ring to the cassette's top, the
    # bottom from the ring's foot round both jockeys up to the cassette.
    cx = d * 0.055
    ring_c = Vector((cx, 0, 0))
    cog_c = Vector((cx, ax.y, ax.z))
    cr, gr = L["ring"] + 0.004, L["cog"] - 0.004
    top_a, top_b = ring_c + Vector((0, cr, 0.006)), cog_c + Vector((0, gr, 0.0))
    bot = [cog_c + Vector((0, -0.01, gr * 0.98)), Vector((cx, j1.y + 0.016, j1.z + 0.004)),
           Vector((cx, j1.y - 0.002, j1.z + 0.016)), Vector((cx, j2.y + 0.004, j2.z + 0.016)),
           Vector((cx, j2.y - 0.016, j2.z - 0.0)), Vector((cx, j2.y - 0.012, j2.z - 0.014)),
           ring_c + Vector((0, -cr, -0.004))]
    if LEVEL == 0:
        links = Batch("chain", CHAIN)
        for a, b in [(top_a, top_b)] + list(zip(bot, bot[1:])):
            n = max(1, int((b - a).length / 0.0127))
            for k in range(n):
                p, q = a.lerp(b, k / n), a.lerp(b, (k + 1) / n)
                t = (q - p)
                for side in (-1, 1):
                    links.box((p + q) / 2 + Vector((side * 0.0035, 0, 0)), X, t.cross(X), t, (0.0012, 0.0078, 0.0135))
        links.done()
        # The ring's wrap and the cassette's, as arcs of chain.
        for c, r, a0, a1 in ((ring_c, cr, -0.5, 2.6), (cog_c, gr, 0.0, 1.57)):
            arc = []
            for k in range(13):
                th = a0 + (a1 - a0) * k / 12
                arc.append(W(c + Vector((0, r * math.cos(th), -r * math.sin(th)))))
            tube("chain_wrap", arc, 0.0038, CHAIN, res=1)
    else:
        tube("chain", [W(top_a), W(top_b)], 0.004, CHAIN, res=0)
        tube("chain", [W(p) for p in bot], 0.004, CHAIN, res=0)


# ---------------------------------------------------------------- the SHOCK
# Built in the shock node's own frame: its origin the front eye, +z along
# the eye-to-eye line, y the side square to it that faces up.
def build_shock_coil():
    S = S_LEN
    turns = 7.5
    coil("coil", W(Vector((0, 0, S * 0.24))), W(Vector((0, 0, S * 0.86))), L["shock"]["coil"] + 0.004, 0.0052,
         turns, SPRING)


def build_shock_body():
    S = S_LEN
    rod("eye_f", Vector((-0.012, 0, 0)), Vector((0.012, 0, 0)), L["shock"]["eye"] + 0.004, ALLOY, 16)
    rod("body", Vector((0, 0, 0.012)), Vector((0, 0, S * 0.56)), L["shock"]["body"], BLACK, 20, r2=0.022)
    rod("collar", Vector((0, 0, S * 0.2)), Vector((0, 0, S * 0.24)), L["shock"]["coil"] + 0.01, ALLOY, 20)
    rod("body_cap", Vector((0, 0, S * 0.04)), Vector((0, 0, S * 0.1)), L["shock"]["body"] + 0.004, ALLOY, 20)
    # The piggyback reservoir over it, on its bridge.
    obox("bridge", Vector((0, 0.03, S * 0.08)), X, Vector((0, 1, 0)), Vector((0, 0, 1)), (0.03, 0.04, 0.04), BLACK,
         bevel=0.004)
    rod("reservoir", Vector((0, 0.05, S * 0.02)), Vector((0, 0.05, S * 0.42)), 0.016, BLACK, 18)
    rod("res_cap", Vector((0, 0.05, S * 0.42)), Vector((0, 0.05, S * 0.44)), 0.0145, ALLOY, 16)
    if LEVEL == 0:
        rod("knob", Vector((0.016, 0.03, S * 0.08)), Vector((0.026, 0.03, S * 0.08)), 0.011, PAINT, 14)
        rod("knob2", Vector((0, 0.05, S * 0.44)), Vector((0, 0.05, S * 0.47)), 0.009, DECAL, 14)
        # The coil's printed band.
        rod("body_band", Vector((0, 0, S * 0.3)), Vector((0, 0, S * 0.42)), L["shock"]["body"] + 0.0005, DECAL, 20)


def build_shock_rod():
    # Stated from the REAR eye (the rod node's origin), back along -z.
    S = S_LEN
    rod("eye_r", Vector((-0.012, 0, 0)), Vector((0.012, 0, 0)), L["shock"]["eye"] + 0.004, ALLOY, 16)
    rod("rod_end", Vector((0, 0, -0.012)), Vector((0, 0, -0.035)), 0.012, ALLOY, 16)
    rod("shaft", Vector((0, 0, -0.03)), Vector((0, 0, -S * 0.5)), 0.0075, CHROME, 14)
    rod("seat_r", Vector((0, 0, -S * 0.14)), Vector((0, 0, -S * 0.17)), L["shock"]["coil"] + 0.01, ALLOY, 20)
    rod("bumper", Vector((0, 0, -S * 0.17)), Vector((0, 0, -S * 0.22)), 0.013, BLACK, 14)


# ---------------------------------------------------------------- the CRANKS and PEDALS
def build_cranks():
    c = L["crank"]
    for i, s in enumerate((-1, 1)):
        z = c if i == 0 else -c
        root, end = Vector((s * 0.058, 0, 0)), Vector((s * 0.074, 0, z))
        sweep("crank", [root, (root + end) / 2 + Vector((s * 0.004, 0, 0)), end],
              [(0.012, 0.02), (0.01, 0.015), (0.011, 0.013)], BLACK, n=3, M=12,
              across=Vector((0, 1, 0)))
        rod("crank_boss", end - Vector((s * 0.008, 0, 0)), end + Vector((s * 0.006, 0, 0)), 0.014, BLACK, 14)
        rod("crank_root", root - Vector((s * 0.006, 0, 0)), root + Vector((s * 0.008, 0, 0)), 0.02, BLACK, 16)
    rod("spindle", Vector((-0.06, 0, 0)), Vector((0.06, 0, 0)), 0.0145, ALLOY, 14)
    # The ring with its teeth, and its spider.
    x = DRIVE * 0.055
    teeth = 34 if LEVEL == 0 else 17
    r = L["ring"]
    prof = []
    for k in range(teeth * 2):
        th = math.pi * k / teeth
        rr = r + (0.004 if k % 2 == 0 else -0.002)
        prof.append((rr * math.cos(th), rr * math.sin(th)))
    inner = [(0.052 * math.cos(math.pi * k / teeth), 0.052 * math.sin(math.pi * k / teeth)) for k in range(teeth * 2)]
    n = len(prof)
    verts = [W(Vector((x + d, y, z))) for d in (-0.0015, 0.0015) for z, y in prof + inner]
    faces = []
    for base in (0, 2 * n):
        for k in range(n):
            faces.append((base + k, base + (k + 1) % n, base + n + (k + 1) % n, base + n + k))
    for k in range(n):
        faces.append((k, 2 * n + k, 2 * n + (k + 1) % n, (k + 1) % n))
        faces.append((n + k, n + (k + 1) % n, 3 * n + (k + 1) % n, 3 * n + k))
    mesh_obj("ring", verts, faces, [DARK], smooth=False)
    arms = Batch("ring_spider", BLACK)
    for k in range(4):
        th = 2 * math.pi * k / 4 + 0.4
        arms.rod(Vector((x + DRIVE * 0.002, 0.016 * math.cos(th), 0.016 * math.sin(th))),
                 Vector((x, 0.054 * math.cos(th), 0.054 * math.sin(th))), 0.006)
    arms.done()


def build_pedal(key, s):
    """A flat pedal in its node's frame (its origin the pedal's middle)."""
    P = L["pedal"]
    w, l, t = P["width"], P["length"], P["thick"]
    # The body: two side rails, a leading and a trailing edge, the axle's hub.
    for z in (-l / 2 + 0.006, l / 2 - 0.006):
        obox("pedal_edge", Vector((0, 0, z)), X, Vector((0, 1, 0)), Vector((0, 0, 1)), (w, t, 0.012), BLACK, bevel=0.003)
    for x in (-w / 2 + 0.006, w / 2 - 0.006):
        obox("pedal_side", Vector((x, -0.001, 0)), X, Vector((0, 1, 0)), Vector((0, 0, 1)), (0.012, t * 0.8, l), BLACK,
             bevel=0.003)
    rod("pedal_hub", Vector((-w / 2, 0, 0)), Vector((w / 2, 0, 0)), 0.011, BLACK, 12)
    inner = -s * (L["q"] - 0.075)
    rod("pedal_axle", Vector((inner, 0, 0)), Vector((-s * w / 2, 0, 0)), 0.0065, CHROME, 10)
    if LEVEL == 0:
        pins = Batch("pins", ALLOY)
        for x in (-w / 2 + 0.006, w / 2 - 0.006):
            for z in (-l * 0.3, 0.0, l * 0.3):
                for up in (-1, 1):
                    pins.rod(Vector((x, up * t / 2, z)), Vector((x, up * (t / 2 + 0.005), z)), 0.0016)
        for z in (-l / 2 + 0.006, l / 2 - 0.006):
            for x in (-w * 0.25, w * 0.25):
                for up in (-1, 1):
                    pins.rod(Vector((x, up * t / 2, z)), Vector((x, up * (t / 2 + 0.005), z)), 0.0016)
        pins.done()


# ---------------------------------------------------------------- JOIN, NODES and CLIPS
def join(objs, name, origin):
    """Parts into one rigid mesh, its origin at `origin` (Blender frame) —
    modifiers applied, curves made meshes, sorted and triangulated in a
    fixed order so a build is the same file every time."""
    objs = [o for o in objs if o is not None]
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
    return ob


# Each node's pivot in the bottom bracket's frame (the frame node's), and
# its parent. The shock's own parts are built in its own frame (below).
PARENT = {"frame": None, "bars": "frame", "fork": "bars", "wheelF": "fork", "swingarm": "frame",
          "wheelR": "swingarm", "shock": "frame", "shockBody": "shock", "shockRod": "shock",
          "cranks": "frame", "pedalL": "cranks", "pedalR": "cranks"}


def shock_turn():
    """The shock node's rest turn, engine frame: +z onto the eyes' line."""
    d = (SHOCK_R - SHOCK_F).normalized()
    return Vector((0, 0, 1)).rotation_difference(d)


def build_bike():
    """One whole bike at the current LEVEL: its root and its nodes."""
    for k in PARTS:
        PARTS[k] = []
    with into("frame"):
        build_frame()
    with into("bars"):
        build_bars()
    with into("fork"):
        build_fork()
    with into("wheelF"):
        wheel(AXLE_F, L["rimF"], RF, 0.055, False)
    with into("swingarm"):
        build_swingarm()
    with into("wheelR"):
        wheel(AXLE_R, L["rimR"], RR, 0.072, True)
    with into("shock"):
        build_shock_coil()
    with into("shockBody"):
        build_shock_body()
    with into("shockRod"):
        build_shock_rod()
    with into("cranks"):
        build_cranks()
    for key, s in (("pedalL", -1), ("pedalR", 1)):
        with into(key):
            build_pedal(key, s)
    # Each node's pivot in the BB frame (engine), and the frame its parts were made in.
    pivot = {"frame": Vector((0, 0, 0)), "bars": STEER, "fork": STEER, "wheelF": AXLE_F, "swingarm": PIVOT,
             "wheelR": AXLE_R, "cranks": Vector((0, 0, 0))}
    obs = {}
    for key in PARTS:
        if key in ("shock", "shockBody", "shockRod", "pedalL", "pedalR"):
            # Made in the node's own frame about its origin.
            obs[key] = join(PARTS[key], NODES[key], (0, 0, 0))
        else:
            obs[key] = join(PARTS[key], NODES[key], tuple(W(pivot[key])))
    root = bpy.data.objects.new("bike", None)
    COL.objects.link(root)
    root.rotation_mode = "QUATERNION"
    root["frame"] = "engine: x right, y up, z forward, the origin at the bike's centre of mass"
    root["shockRest"] = S_LEN
    root["lod"] = LEVEL
    for key, ob in obs.items():
        ob.rotation_mode = "QUATERNION"
        par = PARENT[key]
        ob.parent = obs[par] if par else root
        if key in ("shock", "shockBody", "shockRod", "pedalL", "pedalR"):
            ob.location = W(V(REST[key]))
        else:
            ob.location = W(V(REST[key]))
        ob.matrix_parent_inverse.identity()
    obs["shock"].rotation_quaternion = WQ_from(shock_turn())
    # Every node at rest, in the game's numbers.
    counts = {NODES[k]: lib._tri_count([o]) for k, o in obs.items()}
    print("TRIANGLES", f"lod{LEVEL}", sum(counts.values()), counts)
    return root, obs


def WQ_from(q):
    """An engine-frame mathutils Quaternion as Blender's."""
    return Quaternion((q.w, q.x, -q.z, q.y))


def key_clips(root, obs):
    """Every clip keyed node by node onto an NLA track of its name."""
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
    fps = 15
    scene.render.fps = fps
    holders = [root] + list(obs.values())
    for o in holders:
        o.animation_data_create()
    names = []
    for c in DATA["clips"]:
        for o in holders:
            o.animation_data.action = bpy.data.actions.new(f"{c['name']}_{o.name}")
        for f, fr in enumerate(c["frames"]):
            for key, ob in obs.items():
                t = fr["nodes"][key]
                ob.location = W(V(t["p"]))
                ob.rotation_quaternion = WQ(t["q"])
                ob.scale = (t["s"]["x"], t["s"]["z"], t["s"]["y"])
                ob.keyframe_insert("location", frame=f)
                ob.keyframe_insert("rotation_quaternion", frame=f)
                ob.keyframe_insert("scale", frame=f)
            # The bike's own pitch (tips up positive) and roll (right side down).
            p, r = fr["root"]["pitch"], fr["root"]["roll"]
            q = Quaternion((0, 0, 1), 0) @ Quaternion((0, 1, 0), -r) @ Quaternion((1, 0, 0), p)
            root.rotation_quaternion = q
            root.keyframe_insert("rotation_quaternion", frame=f)
        for o in holders:
            track = o.animation_data.nla_tracks.new()
            track.name = c["name"]
            track.strips.new(c["name"], 0, o.animation_data.action)
            track.mute = True
            o.animation_data.action = None
        names.append(f"{c['name']} {c['seconds']:g}s")
    for o in holders:
        o.animation_data.use_nla = False
        for track in o.animation_data.nla_tracks:
            track.mute = False
    # Back to rest for the stills.
    root.rotation_quaternion = (1, 0, 0, 0)
    for key, ob in obs.items():
        ob.location = W(V(REST[key]))
        ob.rotation_quaternion = (1, 0, 0, 0)
        ob.scale = (1, 1, 1)
    obs["shock"].rotation_quaternion = WQ_from(shock_turn())
    print("CLIPS", ", ".join(names))


def export(root, path):
    lib._select_only([root] + list(root.children_recursive))
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_apply=True, export_extras=True,
                              export_skins=False, export_morph=False, export_animations=True,
                              export_animation_mode="NLA_TRACKS", export_force_sampling=True)


# ---------------------------------------------------------------- the STUDIO
floor = AXLE_F.y + BB.y - RF
cams = lib._studio((0, -0.1, floor + 0.55), 3.4, floor=floor)
lib._cycles(SAMPLES)
# The drive side square on, as the class is photographed, and a close look
# at the drivetrain and the shock.
for name, off, lens in (("drive", (-9.0, -0.15, 0.25), 85), ("cockpit", (0.0, -1.6, 0.95), 35),
                        ("drivetrain", (-1.3, 0.35, 0.05), 50)):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cam = bpy.data.objects.new(name, cd)
    COL.objects.link(cam)
    cam.location = Vector(off) + Vector((0, -0.1, floor + 0.55))
    tt = cam.constraints.new("TRACK_TO")
    tt.target = bpy.data.objects["target"]
    tt.track_axis = "TRACK_NEGATIVE_Z"
    tt.up_axis = "UP_Y"
    cams[name] = cam
ONLY = [v for v in os.environ.get("VIEWS", "").split(",") if v]
views = [v for v in (ONLY or list(cams)) if v in cams and v != "none"]
tag = "game" if GAME else "render"


def render(suffix=""):
    for v in views:
        scene.camera = cams[v]
        scene.render.filepath = os.path.join(OUT, f"{NAME}-{tag}{suffix}-{v}.png")
        bpy.ops.render.render(write_still=True)


root, obs = build_bike()
key_clips(root, obs)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, f"{NAME}-{tag}.blend"))
render()
if GAME:
    export(root, os.path.join(OUT, f"{NAME}-lod0.glb"))
    # The far model, built whole at its own level.
    for o in [root] + list(root.children_recursive):
        bpy.data.objects.remove(o, do_unlink=True)
    LEVEL = 1
    root, obs = build_bike()
    key_clips(root, obs)
    views = [v for v in views if v in ("chase", "three", "drive")]
    render("-lod1")
    export(root, os.path.join(OUT, f"{NAME}-lod1.glb"))

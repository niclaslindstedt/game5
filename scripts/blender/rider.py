# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE DOWNHILL BIKE'S RIDER MODELLED IN BLENDER off the game's own data: the
# pose the game's dressed figure is bound in and every bone's frame in it
# (`dress-loft.ts`'s `bindPose`), the grip in each hand's frame off the
# bike's riding pose, and every clip's bones off the bike's own clips
# (`bike-rig.ts`'s `bikeClips`) — handed in as one JSON file by
# `scripts/blender.mjs --kind=rider`, the only way this runs.
#
# THE FRAME is the ENGINE's (x right, y up, z forward), written into Blender
# as (x, -z, y) so the glTF's frame IS the game's: the game takes his skin
# and binds it to its own dressed skeleton, bone for bone by name, in the
# same bind pose — so its pose drives him wherever it drives the dressed
# skier (on the bike, pushing it, thrown off it) and nothing is solved twice.
# The clips are keyed in the bike's centre of mass's frame, so a host that
# plays them plays the bike's clip of the same name beside them.
#
# His KIT, after the class's photographs: a loose long-sleeved jersey
# hanging over the hips, baggy shorts to below the knee over hard-shelled
# knee and shin pads, long socks, flat-pedal shoes (a suede upper, a white
# midsole, a flat sticky sole), full-finger gloves closed round the grips,
# and a FULL-FACE helmet — the shell down over the ears, its chin bar, a
# peak over the eye port and goggles in it, their strap round the shell.
# The soft kit is lofted a piece a bone and remeshed into one skin weighted
# across each joint (as the skier's suit, `skier.py`); the hard kit rides
# one bone wholly.
#
# THE MATERIALS, by name — the game lays a kit's colours over them:
# `jersey`, `accent`, `shorts`, `sock`, `pad`, `shoe`, `sole`, `glove`,
# `helmet`, `trim` (the helmet's second colour), `peak`, `lens`, `strap`,
# `liner`.

import json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
POSE, FRAMES, GRIP = DATA["rest"]["pose"], DATA["rest"]["bones"], DATA["grip"]


def B(p):
    """A point or direction of the body frame, in Blender's."""
    return Vector((p["x"], -p["z"], p["y"]))


def colour(hexa):
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 for c in ((hexa >> 16) & 255, (hexa >> 8) & 255, hexa & 255))


# ---------------------------------------------------------------- materials
JERSEY = mat("jersey", colour(0x23272E), rough=0.72, sheen=0.3)
ACCENT = mat("accent", colour(0xE2571A), rough=0.68, sheen=0.3)
SHORTS = mat("shorts", colour(0x4A4F45), rough=0.8)
SOCK = mat("sock", colour(0x16181B), rough=0.9)
PAD = mat("pad", colour(0x1B1C1F), rough=0.5, coat=0.3)
SHOE = mat("shoe", colour(0x2F3237), rough=0.85)
SOLE = mat("sole", colour(0xE8E6E1), rough=0.7)
GLOVE = mat("glove", colour(0x1A1C20), rough=0.7)
HELMET = mat("helmet", colour(0xEDEDEA), rough=0.22, coat=1.0)
TRIM = mat("trim", colour(0xE2571A), rough=0.25, coat=1.0)
PEAK = mat("peak", colour(0x16171A), rough=0.35, coat=0.6)
LENS = mat("lens", colour(0xC77A2A), metal=0.75, rough=0.06)
STRAP = mat("strap", colour(0x111214), rough=0.7)
LINER = mat("liner", colour(0x2B2E34), rough=0.85)
SKIN = mat("skin", colour(0xC99A7E), rough=0.6, sheen=0.2)


# ---------------------------------------------------------------- the RIG
def frame(name):
    """A bone's frame — or the TRUNK's ("spine"): the chord from the hips
    to the neck the two spans of the back are bent about, facing the chest."""
    if name == "spine":
        hips, neck = B(FRAMES["pelvis"]["head"]), B(FRAMES["chest"]["head"]) + B(FRAMES["chest"]["y"]) * FRAMES["chest"]["length"]
        y = (neck - hips).normalized()
        z = B(FRAMES["chest"]["z"])
        z = (z - y * z.dot(y)).normalized()
        return hips, y.cross(z), y, z, (neck - hips).length
    f = FRAMES[name]
    return B(f["head"]), B(f["x"]), B(f["y"]), B(f["z"]), f["length"]


def local(name, p):
    """A point stated in bone `name`'s frame, in Blender's."""
    h, x, y, z, _ = frame(name)
    return h + x * p[0] + y * p[1] + z * p[2]


for name in FRAMES:
    head, _, y, z, length = frame(name)
    bone(name, head, head + y * length, roll_to=z)

HALF = {}
for s in "lr":
    HALF |= {("spine", f"thigh_{s}"): f"hip_{s}", (f"thigh_{s}", f"shin_{s}"): f"knee_{s}",
             ("spine", f"upperarm_{s}"): f"shoulder_{s}", (f"upperarm_{s}", f"forearm_{s}"): f"elbow_{s}"}

# The shin's segment runs on past the boot bone's head (the ski boot's cuff
# top) to the ANKLE, so the sock rides the shin to the shoe.
CUFF = 0.17


def seg_of(n):
    h, _, y, _, l = frame(n)
    return h, h + y * (l + (CUFF if n.startswith("shin") else 0.0))


SEGMENTS = {n: seg_of(n) for n in FRAMES
            if n not in ("pelvis", "chest") and n not in HALF.values()
            and not n.startswith(("hand", "boot")) and "_lo_" not in n}
SEGMENTS["spine"] = seg_of("spine")
NEAR = {"spine": ["head", "thigh_l", "thigh_r", "upperarm_l", "upperarm_r"], "head": ["spine"]}
for s in "lr":
    NEAR |= {f"thigh_{s}": ["spine", f"shin_{s}"], f"shin_{s}": [f"thigh_{s}"],
             f"upperarm_{s}": ["spine", f"forearm_{s}"], f"forearm_{s}": [f"upperarm_{s}"]}


def along(co, seg):
    a, b = seg
    d = b - a
    t = max(0.0, min(1.0, (co - a).dot(d) / d.length_squared))
    return t, (co - (a + d * t)).length


def nearest(co, among=None):
    return min(among or SEGMENTS, key=lambda n: along(co, SEGMENTS[n])[1])


BLEND = {"hinge": 0.04, "ball": 0.075}


def blend(a, b):
    trunk = "spine" in (a, b)
    limb = any(n.startswith(("thigh", "upperarm")) for n in (a, b))
    return BLEND["ball"] if trunk and limb else BLEND["hinge"]


def suit_weights(co):
    """Across a joint, shared between the bones that meet there (`skier.py`'s rule)."""
    b0 = nearest(co)
    d0 = along(co, SEGMENTS[b0])[1]
    w = {n: math.exp(-(along(co, SEGMENTS[n])[1] - d0) / blend(b0, n)) for n in [b0] + NEAR[b0]}
    top = sorted(w.items(), key=lambda kv: -kv[1])[:3]
    total = sum(v for _, v in top)
    out = {n: v / total for n, v in top}
    for (a, b), h in HALF.items():
        if a in out and b in out:
            wa, wb = out.pop(a), out.pop(b)
            c = wb / (wa + wb)
            out[a] = (wa + wb) * (1 - c) ** 2
            out[b] = (wa + wb) * c * c
            out[h] = out.get(h, 0.0) + (wa + wb) * 2 * c * (1 - c)
    if "spine" in out:
        t = along(co, SEGMENTS["spine"])[0]
        c = max(0.0, min(1.0, (t - 0.25) / 0.45))
        c = c * c * (3 - 2 * c)
        share = out.pop("spine")
        out["pelvis"] = out.get("pelvis", 0.0) + share * (1 - c)
        out["chest"] = out.get("chest", 0.0) + share * c
    # The upper arm and forearm each pass their share past their break
    # to the bone below it (`*_lo_*`), by how far along they lie, so a
    # broken arm hangs as the dressed skier's does.
    for part in ("upperarm", "forearm"):
        for s in "lr":
            n = f"{part}_{s}"
            if n in out:
                t = along(co, SEGMENTS[n])[0]
                lo = max(0.0, min(1.0, (t - 0.42) / 0.16))
                share = out.pop(n)
                out[n] = share * (1 - lo)
                out[f"{part}_lo_{s}"] = out.get(f"{part}_lo_{s}", 0.0) + share * lo
    top = sorted(out.items(), key=lambda kv: -kv[1])[:4]
    total = sum(v for _, v in top)
    return {n: v / total for n, v in top if v > 0}


# ---------------------------------------------------------------- the KIT
# THE BODY UNDER IT is the skier's man of the ANSUR II survey (`skier.py`).
ANSUR = {
    "trochanterion": 901, "crotch": 846, "waist_h": 1056, "tenth_rib_h": 1121, "chest_h": 1291,
    "axilla_h": 1329, "acromion_h": 1441, "cervicale": 1517,
    "hip_breadth": 346, "buttock_depth": 246, "waist_breadth": 326, "waist_depth": 238,
    "chest_breadth": 289, "chest_depth": 254, "biacromial": 416, "bideltoid": 510,
    "neck_base": 435, "thigh": 625, "lower_thigh": 409, "calf": 392, "ankle": 229,
    "biceps": 358, "forearm": 310, "wrist": 176, "forearm_length": 268,
}
MM = 0.001


def level(h):
    return (h - ANSUR["trochanterion"]) / (ANSUR["cervicale"] - ANSUR["trochanterion"])


def r_of(circ):
    return circ * MM / (2 * math.pi)


# What a downhill kit adds over the body, m a side: a jersey cut loose,
# baggy shorts, socks close.
EASE = {"front": 0.03, "back": 0.03, "side": 0.034, "hang": 0.028, "sleeve": 0.03, "shorts": 0.042,
        "sock": 0.004}
E = EASE
P = POSE
hips, neck, head_c = B(P["hips"]), B(P["neck"]), B(P["head"])
knees = [B(k) for k in P["knees"]]
shoulders, elbows = [B(k) for k in P["shoulders"]], [B(k) for k in P["elbows"]]
SEG = 16 if GAME else 28


def lofted(name, bone_name, sections, n=2.4):
    """A garment piece along a bone: rings at `t` (a share of its length),
    each `(t, half across, ahead, behind)` — ahead along the bone's +z."""
    head, x, y, z, length = frame(bone_name)
    rings = []
    for t, hx, front, back in sections:
        c = head + y * (t * length)
        ring = []
        for k in range(SEG):
            a = 2 * math.pi * k / SEG
            ca, sa = math.cos(a), math.sin(a)
            u = math.copysign(abs(ca) ** (2 / n), ca) * hx
            v = math.copysign(abs(sa) ** (2 / n), sa) * (front if sa > 0 else back)
            ring.append(c + x * u + z * v)
        rings.append(ring)
    return loft(name, rings, [JERSEY])


rides("chest")
pieces = []
bh, bd = ANSUR["hip_breadth"] / 2 * MM, ANSUR["buttock_depth"] * MM
wb, wd = ANSUR["waist_breadth"] / 2 * MM, ANSUR["waist_depth"] * MM
cb, cd = ANSUR["chest_breadth"] / 2 * MM, ANSUR["chest_depth"] * MM
TRUNK = [
    (level(ANSUR["crotch"]) - 0.06, bh * 0.82 + E["shorts"], bd * 0.32 + E["shorts"], bd * 0.46 + E["shorts"]),
    (level(ANSUR["crotch"]) + 0.04, bh + E["shorts"], bd * 0.42 + E["shorts"], bd * 0.55 + E["shorts"]),
    (0.06, bh + E["hang"], bd * 0.4 + E["hang"], bd * 0.48 + E["hang"]),
    (level(ANSUR["waist_h"]), wb + E["hang"], wd * 0.58 + E["hang"], wd * 0.47 + E["hang"]),
    (level(ANSUR["tenth_rib_h"]), wb + E["side"], wd * 0.58 + E["front"], wd * 0.48 + E["back"]),
    (0.52, cb * 1.05 + E["side"], cd * 0.52 + E["front"], cd * 0.49 + E["back"]),
    (level(ANSUR["chest_h"]), cb * 1.12 + E["side"], cd * 0.5 + E["front"], cd * 0.5 + E["back"]),
    (level(ANSUR["axilla_h"]), cb * 1.2 + E["side"], cd * 0.47 + E["front"], cd * 0.5 + E["back"]),
    (level(ANSUR["acromion_h"]) - 0.05, ANSUR["biacromial"] / 2 * MM * 0.92, cd * 0.4 + E["front"],
     cd * 0.44 + E["back"]),
    (0.95, r_of(ANSUR["neck_base"]) * 1.45 + 0.012, 0.09, 0.095),
    (1.0, r_of(ANSUR["neck_base"]) + 0.012, 0.075, 0.085),
]
pieces.append(lofted("trunk", "spine", TRUNK, n=2.6))
for i, s in enumerate("lr"):
    reach = ANSUR["bideltoid"] / 2 * MM - ANSUR["biacromial"] / 2 * MM
    out = (shoulders[i] - neck.lerp(hips, 0.12)).normalized()
    pieces.append(ellipsoid("shoulder", shoulders[i] + frame("spine")[2] * 0.005 + out * 0.004,
                            (reach + 0.02, reach + 0.024, reach + 0.022), JERSEY))
    # The sleeve: loose over the biceps and the forearm, gathered at the cuff.
    b = r_of(ANSUR["biceps"]) * 0.95
    S_ = E["sleeve"]
    pieces.append(lofted("sleeve", f"upperarm_{s}", [
        (-0.05, b * 1.25 + S_, b * 1.2 + S_, b * 1.2 + S_), (0.35, b + S_, b + S_, b * 1.05 + S_),
        (0.7, b * 0.94 + S_, b * 0.92 + S_, b * 0.96 + S_), (1.05, b * 0.88 + S_, b * 0.9 + S_, b * 0.84 + S_)]))
    f, w = r_of(ANSUR["forearm"]) * 0.95, r_of(ANSUR["wrist"])
    wrist_t = ANSUR["forearm_length"] * MM / frame(f"forearm_{s}")[4]
    pieces.append(lofted("sleeve", f"forearm_{s}", [
        (-0.08, f * 1.05 + S_, f + S_, f * 1.1 + S_), (0.3, f + S_ * 0.9, f + S_ * 0.9, f + S_ * 0.9),
        (wrist_t - 0.2, (f + w) / 2 + S_ * 0.7, (f + w) / 2 + S_ * 0.7, (f + w) / 2 + S_ * 0.7),
        (wrist_t - 0.06, w + 0.01, w + 0.01, w + 0.01)]))
    pieces.append(ellipsoid("elbow", elbows[i], (b + S_,) * 3, JERSEY))
    # The shorts: baggy to below the knee.
    th, lt = r_of(ANSUR["thigh"]), r_of(ANSUR["lower_thigh"])
    Sh = E["shorts"]
    pieces.append(lofted("shorts", f"thigh_{s}", [
        (-0.12, th * 1.05 + Sh, th + Sh, th * 1.1 + Sh), (0.2, th + Sh, th + Sh, th + Sh),
        (0.6, (th + lt) / 2 + Sh, (th + lt) / 2 + Sh, (th + lt) / 2 + Sh), (1.0, lt + Sh, lt + Sh * 1.1, lt + Sh)]))
    pieces.append(lofted("shorts", f"shin_{s}", [
        (-0.05, lt + Sh, lt + Sh * 1.1, lt + Sh), (0.18, lt + Sh * 0.9, lt + Sh, lt + Sh * 0.95),
        (0.24, lt + Sh * 0.5, lt + Sh * 0.5, lt + Sh * 0.5)]))
    pieces.append(ellipsoid("knee", knees[i], (lt + Sh,) * 3, SHORTS))
    # The leg in its sock, from under the shorts down to the ankle.
    ca, an = r_of(ANSUR["calf"]), r_of(ANSUR["ankle"])
    shin_l = frame(f"shin_{s}")[4]
    ank = (shin_l + CUFF) / shin_l
    Sk = E["sock"]
    pieces.append(lofted("leg", f"shin_{s}", [
        (0.2, lt * 0.95 + Sk, lt * 0.92 + Sk, lt + Sk), (0.45, ca * 0.88 + Sk, ca * 0.78 + Sk, ca * 1.12 + Sk),
        (0.75, ca * 0.8 + Sk, ca * 0.74 + Sk, ca * 0.95 + Sk), (ank - 0.12, an * 1.05 + Sk, an + Sk, an * 1.1 + Sk),
        (ank, an + Sk, an + Sk, an + Sk)]))

bpy.context.view_layer.objects.active = pieces[0]
for o in bpy.context.view_layer.objects:
    o.select_set(o in pieces)
bpy.ops.object.convert(target="MESH")
bpy.ops.object.join()
suit = bpy.context.view_layer.objects.active
suit.name = suit.data.name = "suit"
remesh = suit.modifiers.new("one", "REMESH")
remesh.mode, remesh.voxel_size = "VOXEL", 0.014 if GAME else 0.006
smooth = suit.modifiers.new("ease", "SMOOTH")
smooth.factor, smooth.iterations = 0.6, 2 if GAME else 4
bpy.ops.object.convert(target="MESH")
if GAME:
    thin = suit.modifiers.new("budget", "DECIMATE")
    thin.ratio = 4200 / max(1, len(suit.data.polygons) * 2)
    bpy.ops.object.convert(target="MESH")
suit.data.materials.clear()
for m in (JERSEY, ACCENT, SHORTS, SOCK):
    suit.data.materials.append(m)

# THE CLOTH'S FOLDS: a loose jersey and baggy shorts gather and wrinkle.
FOLDS = [  # bone kind, t from, t to, face, amp, pitch
    ("upperarm", 0.6, 1.0, -1, 0.009, 0.05), ("forearm", 0.0, 0.3, -1, 0.009, 0.05),
    ("forearm", 0.45, 0.75, 0, 0.006, 0.035),
    ("thigh", 0.7, 1.0, -1, 0.01, 0.055), ("thigh", 0.05, 0.4, 1, 0.008, 0.07),
    ("spine", 0.05, 0.45, 0, 0.007, 0.06), ("spine", 0.45, 0.75, -1, 0.006, 0.07),
]
bm = bmesh.new()
bm.from_mesh(suit.data)
bm.normal_update()
for v in bm.verts:
    b = nearest(v.co)
    t = along(v.co, SEGMENTS[b])[0]
    _, _, by, bz, bl = frame(b)
    for kind, t0, t1, face, amp, pitch in FOLDS:
        if not b.startswith(kind) or not t0 <= t <= t1:
            continue
        side = 1.0 if face == 0 else max(0.0, v.normal.dot(bz) * face)
        fade = math.sin(math.pi * (t - t0) / (t1 - t0))
        # A diagonal pull: the ridge's phase turned round the bone.
        twist = math.atan2(v.co.dot(frame(b)[1]), v.co.dot(bz)) * 0.25
        v.co += v.normal * (amp * side * fade * math.sin(2 * math.pi * t * bl / pitch + twist))
bm.to_mesh(suit.data)
bm.free()

# Where one colour meets the next, a PLANE the suit is cut along first.
UP = (neck - hips).normalized()
HEM = (hips - UP * 0.13, UP)
YOKE = (neck - UP * 0.11, UP)
CUFFS = [(frame(f"forearm_{s}")[0] + frame(f"forearm_{s}")[2] * frame(f"forearm_{s}")[4] * 0.62,
          frame(f"forearm_{s}")[2]) for s in "lr"]
LAPS = [(frame(f"thigh_{s}")[0] + frame(f"thigh_{s}")[2] * frame(f"thigh_{s}")[4] * 0.2, frame(f"thigh_{s}")[2])
        for s in "lr"]
HEMS = [(frame(f"shin_{s}")[0] + frame(f"shin_{s}")[2] * frame(f"shin_{s}")[4] * 0.21, frame(f"shin_{s}")[2])
        for s in "lr"]
bm = bmesh.new()
bm.from_mesh(suit.data)
for co, no in [HEM, YOKE] + CUFFS + LAPS + HEMS:
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)
bm.to_mesh(suit.data)
bm.free()


def above(co, plane):
    return (co - plane[0]).dot(plane[1]) > 0


def cloth_of(co):
    """The jersey over the trunk and arms (its yoke and cuffs
    in the second colour), the shorts below its hem and down the thighs,
    the socks below the shorts' hems."""
    b = nearest(co)
    if b.startswith("shin"):
        return 2 if not above(co, HEMS["lr".index(b[-1])]) else 3
    if b.startswith("thigh"):
        return 2 if above(co, LAPS["lr".index(b[-1])]) or not above(co, HEM) else 0
    if not above(co, HEM):
        return 2
    if b.startswith("upperarm"):
        return 1 if above(co, YOKE) else 0
    if b.startswith("forearm"):
        return 1 if above(co, CUFFS["lr".index(b[-1])]) else 0
    return 1 if above(co, YOKE) else 0
    return 0


suit.data.polygons.foreach_set("material_index", [cloth_of(p.center) for p in suit.data.polygons])
for p in suit.data.polygons:
    p.use_smooth = True
weights(suit, suit_weights)


# ---------------------------------------------------------------- PADS
for s in "lr":
    rides(f"shin_{s}")
    h, x, y, z, l = frame(f"shin_{s}")
    lt, ca = r_of(ANSUR["lower_thigh"]), r_of(ANSUR["calf"])
    # The hard cap over the knee and the shell down the shin, on their sleeve.
    cap = []
    for t, hx, fr, bk in ((-0.16, 0.05, 0.035, 0.03), (-0.05, 0.068, 0.072, 0.05), (0.08, 0.07, 0.082, 0.054),
                          (0.2, 0.064, 0.074, 0.06), (0.32, 0.06, 0.07, 0.064), (0.45, 0.057, 0.066, 0.063),
                          (0.56, 0.05, 0.058, 0.055)):
        c = h + y * (t * l)
        ring = []
        for k in range(SEG):
            a = 2 * math.pi * k / SEG
            ca_, sa = math.cos(a), math.sin(a)
            ring.append(c + x * (math.copysign(abs(ca_) ** 0.8, ca_) * hx) + z * (sa * (fr if sa > 0 else bk)))
        cap.append(ring)
    loft("pad_sleeve", cap, [PAD])
    shell = []
    for t, hx, fr in ((-0.12, 0.038, 0.06), (-0.02, 0.05, 0.082), (0.1, 0.05, 0.09), (0.18, 0.045, 0.082),
                      (0.24, 0.04, 0.078), (0.4, 0.038, 0.075), (0.52, 0.03, 0.065)):
        c = h + y * (t * l)
        ring = []
        for k in range(9):
            a = math.pi * (0.2 + 0.6 * k / 8)
            ring.append(c + x * (math.cos(a) * hx * 1.6) + z * (math.sin(a) * fr + 0.004))
        shell.append(ring)
    sh = loft("pad_shell", shell, [STRAP], closed=False, cap=False)
    so = sh.modifiers.new("thick", "SOLIDIFY")
    so.thickness = 0.006
    for t in (-0.1, 0.5):
        c = h + y * (t * l)
        loft("pad_strap", [[c + y * dy + x * (math.cos(2 * math.pi * k / SEG) * 0.056)
                            + z * (math.sin(2 * math.pi * k / SEG) * 0.06) for k in range(SEG)] for dy in (-0.012, 0.012)],
             [STRAP])

# ---------------------------------------------------------------- SHOES
# On the boot bone (its head the ski boot's cuff top: +y along the sole, +z
# up out of it): the ankle 17 cm under it (`CUFF`), the sole 9 cm under the
# ankle (`party-pose.ts`'s ANKLE) — so on the bike it stands on the pedal.
for s in "lr":
    rides(f"boot_{s}")
    o, bx, by, bz, _ = frame(f"boot_{s}")
    ank = o + by * -0.048 + bz * -0.163
    sole_z = -0.09
    rows = [  # along the foot from the ankle, half width, the upper's top over the sole, the toe's lift
        (-0.085, 0.034, 0.075), (-0.07, 0.044, 0.105), (-0.03, 0.047, 0.115), (0.03, 0.05, 0.095),
        (0.09, 0.054, 0.07), (0.15, 0.05, 0.05), (0.19, 0.04, 0.036), (0.205, 0.022, 0.026)]
    M = 18 if GAME else 28
    upper = []
    for u, hw, top in rows:
        c = ank + by * u + bz * sole_z
        ring = []
        for k in range(M):
            a = 2 * math.pi * k / M
            ca_, sa = math.cos(a), math.sin(a)
            ring.append(c + bx * (math.copysign(abs(ca_) ** 0.75, ca_) * hw)
                        + bz * (0.012 + (top - 0.012) * (0.5 + 0.5 * sa) ** 1.3))
        upper.append(ring)
    loft("shoe", upper, [SHOE])
    # The collar padding round the ankle, the tongue and the laces.
    loft("collar", [[ank + by * (-0.01) + bz * (dz - 0.09 + 0.105) + bx * (math.cos(2 * math.pi * k / M) * 0.047)
                     + by * (math.sin(2 * math.pi * k / M) * 0.06) for k in range(M)] for dz in (0.0, 0.012)], [SHOE])
    lace = Matrix((bx, by, bz)).transposed().to_euler()
    box("laces", ank + by * 0.06 + bz * (-0.09 + 0.093), (0.032, 0.09, 0.012), SOLE, rot=lace, bevel=0.003)
    # The sole: a white midsole band and the flat sticky outsole.
    for name, m_, z0, z1, grow in (("midsole", SOLE, 0.0, 0.022, 0.004), ("outsole", SHOE, -0.006, 0.004, 0.005)):
        ring_rows = []
        for u, hw, _ in rows:
            c = ank + by * u + bz * sole_z
            ring_rows.append([c + bx * (math.cos(2 * math.pi * k / M) * (hw + grow))
                              + by * 0.0 + bz * (z0 if math.sin(2 * math.pi * k / M) < 0 else z1) for k in range(M)])
        loft(name, ring_rows, [m_])

# ---------------------------------------------------------------- GLOVES
# A full-finger glove: its cuff over the jersey's, and the fist CLOSED ROUND
# THE BAR the bike puts in his hand (`GRIP`: the bar's line in the hand's
# own frame, the world's up and ahead there) — the palm over the grip's
# back, four fingers wrapped over its front and under, the thumb under.
for i, s in enumerate("lr"):
    rides(f"forearm_lo_{s}")
    e, fx, fy, fz, fl = frame(f"forearm_{s}")
    wrist_t = ANSUR["forearm_length"] * MM / fl
    cyl("glove_cuff", e + fy * (fl * (wrist_t - 0.13)), e + fy * (fl * (wrist_t + 0.02)), 0.041, GLOVE, r2=0.034)
    rides(f"hand_{s}")
    c, hx_, hy_, hz_, _ = frame(f"hand_{s}")
    g = GRIP[s]
    to = lambda d: (hx_ * d["x"] + hy_ * d["y"] + hz_ * d["z"]).normalized()
    A, up, ahead = to(g["axis"]), to(g["up"]), to(g["ahead"])
    up = (up - A * up.dot(A)).normalized()
    ahead = (ahead - A * ahead.dot(A)).normalized()
    R = 0.0165 + 0.006     # the grip's radius and the glove's palm
    # The back of the hand: over the grip's top and behind it, toward the wrist.
    back = (up * 0.85 - ahead * 0.5).normalized()
    turn = Matrix((A, back.cross(A), back)).transposed().to_euler()
    ellipsoid("palm", c + back * (R + 0.006) - ahead * 0.012, (0.046, 0.04, 0.02), GLOVE, rot=turn)
    for k in range(4):
        off = A * (-0.026 + 0.0175 * k)
        arc = []
        for deg in range(70, -200, -45 if GAME else -18):
            t_ = math.radians(deg)
            arc.append(c + off + (up * math.cos(t_) + ahead * math.sin(t_)) * (R + 0.002))
        tube("finger", arc, 0.0088 - 0.0005 * abs(k - 1.5), GLOVE, smooth_n=0 if GAME else 2)
    out_s = -1 if s == "l" else 1
    tube("thumb", [c - ahead * 0.02 + back * 0.012 - A * (out_s * 0.03), c - up * (R + 0.006) - A * (out_s * 0.03),
                   c - up * (R + 0.004) + ahead * 0.012 - A * (out_s * 0.012)], 0.0095, GLOVE,
         smooth_n=0 if GAME else 2)

# ---------------------------------------------------------------- the HELMET
# A FULL-FACE shell over the head bone (its origin at the eyes' level, +y
# up, +z ahead): lofted in levels from the chin bar's foot to the crown,
# the EYE PORT left open across the front between the brow and the chin
# bar, a peak over it, goggles in it and their strap round the shell.
rides("head")
hc, hx, hy, hz, _ = frame("head")


def hp(x, y, z):
    return hc + hx * x + hy * y + hz * z


LEVELS = [  # y, half width, ahead, behind
    (-0.165, 0.098, 0.15, 0.085), (-0.14, 0.11, 0.175, 0.105), (-0.105, 0.12, 0.185, 0.128),
    (-0.07, 0.126, 0.178, 0.142), (-0.04, 0.13, 0.17, 0.15), (-0.015, 0.131, 0.168, 0.152),
    (0.015, 0.133, 0.165, 0.156), (0.048, 0.132, 0.163, 0.158),
    (0.08, 0.126, 0.157, 0.154), (0.11, 0.112, 0.143, 0.142), (0.135, 0.088, 0.115, 0.115),
    (0.152, 0.052, 0.07, 0.07), (0.16, 0.012, 0.015, 0.015)]
# THE EYE PORT: the front cut out between the chin bar's top and the brow,
# its half width an angle round the front.
PORT = {"low": -0.07, "high": 0.048, "half": math.radians(56)}
NA = 40 if GAME else 72


def shell_ring(yv, hw, fr, bk, inset=0.0):
    pts = []
    for k in range(NA + 1):
        a = 2 * math.pi * k / NA
        sa, ca = math.sin(a), math.cos(a)
        r = 2 / 2.35
        x = math.copysign(abs(sa) ** r, sa) * (hw - inset)
        z = math.copysign(abs(ca) ** r, ca) * ((fr if ca > 0 else bk) - inset)
        pts.append(hp(x, yv, z))
    return pts


rings = [shell_ring(*l) for l in LEVELS]
shell = loft("helmet", rings, [HELMET], closed=False, cap=False)
# Cut the port: every face between its two levels whose middle lies inside
# its angle round the front.
bm = bmesh.new()
bm.from_mesh(shell.data)
cut = []
for f in bm.faces:
    c = f.calc_center_median() - hc
    y, ang = c.dot(hy), math.atan2(c.dot(hx), c.dot(hz))
    if PORT["low"] < y < PORT["high"] and abs(ang) < PORT["half"]:
        cut.append(f)
bmesh.ops.delete(bm, geom=cut, context="FACES")
bm.to_mesh(shell.data)
bm.free()
th = shell.modifiers.new("wall", "SOLIDIFY")
th.thickness, th.offset = 0.014, -1
th.material_offset = 1
shell.data.materials.append(LINER)
# His face in the port, behind the goggles: cheeks, nose and mouth under a
# balaclava's edge.
ellipsoid("face", hp(0, -0.035, 0.085), (0.075, 0.085, 0.07), SKIN)
# The second colour: a band over the crown, front to back, and the chin
# bar's lower band.
loft("helmet_band", [shell_ring(y, hw + 0.0012, fr + 0.0012, bk + 0.0012) for y, hw, fr, bk in LEVELS[7:12]],
     [TRIM], closed=False, cap=False)
loft("chin_band", [[hp(math.sin(a) * (hw + 0.0012), y, math.cos(a) * (fr + 0.0012)) for a in
                    [math.radians(-50 + 100 * k / 16) for k in range(17)]] for y, hw, fr, bk in LEVELS[1:4]],
     [TRIM], closed=False, cap=False)
# The chin bar's vents.
if not GAME:
    for k in (-1, 0, 1):
        box("vent", hp(k * 0.032, -0.11, 0.186), (0.018, 0.006, 0.03), STRAP,
            rot=Matrix((hx, hz, hy)).transposed().to_euler())
# The peak, over the port: curved across, tilted up off the brow.
peak = []
for j, (dz, dy, w) in enumerate(((0.0, 0.0, 0.12), (0.04, 0.012, 0.115), (0.075, 0.026, 0.1), (0.1, 0.038, 0.085))):
    row = []
    for k in range(13):
        a = math.radians(-58 + 116 * k / 12)
        row.append(hp(math.sin(a) * (0.133 + dz * 0.4) * w / 0.12 * 1.0, 0.052 + dy + 0.01 * math.cos(a),
                      0.135 + dz * math.cos(a) + 0.03 * math.cos(a)))
    peak.append(row)
pk = loft("peak", peak, [PEAK], closed=False, cap=False)
ps = pk.modifiers.new("thick", "SOLIDIFY")
ps.thickness = 0.006
# THE GOGGLES in the port: a frame round a curved lens, the strap round the shell.
frame_r = []
for k in range(25):
    a = math.radians(-62 + 124 * k / 24)
    frame_r.append((math.sin(a), math.cos(a)))
lens = []
for yv in (-0.026, 0.0, 0.03):
    lens.append([hp(sa * 0.122, yv + 0.004 * ca, ca * 0.158) for sa, ca in frame_r])
loft("lens", lens, [LENS], closed=False, cap=False)
for yv, hh in ((-0.03, 0.008), (0.034, 0.008)):
    loft("goggle_frame", [[hp(sa * 0.124, yv + dy + 0.004 * ca, ca * 0.161) for sa, ca in frame_r] for dy in (-hh / 2, hh / 2)],
         [STRAP], closed=False, cap=False)
loft("goggle_strap", [[hp(math.sin(a) * 0.1355, yv, math.cos(a) * (0.16 if math.cos(a) > 0 else 0.159))
                       for a in [math.radians(60 + 240 * k / 32) for k in range(33)]] for yv in (-0.006, 0.026)],
     [STRAP], closed=False, cap=False)
# His neck, under the helmet's open foot.
cyl("neck", hp(0, -0.24, -0.02), hp(0, -0.12, -0.0), 0.06, LINER)


# ---------------------------------------------------------------- the CLIPS
# Every clip is the bike's clip's rider: each frame every bone's frame, set
# as its matrix and keyed, in the bike's centre of mass's frame. The game
# never plays them — it poses his bones live — so they are keyed at the
# data's fifteen a second.
lib.FPS = 15


def keyed(frames):
    def at(t):
        f = frames[min(len(frames) - 1, round(t * 15))]
        out = {}
        for name, fr in f.items():
            m = Matrix((B(fr["x"]), B(fr["y"]), B(fr["z"]))).transposed().to_4x4()
            m.translation = B(fr["head"])
            out[name] = {"matrix": m}
        return out
    return at


for c in DATA["clips"]:
    clip(c["name"], c["seconds"], keyed(c["frames"]))

floor = min(local(f"boot_{s}", (0, -0.048, -0.253)).z for s in "lr") - 0.005
finish(os.path.basename(argv[0]).removesuffix(".json"), OUT, SAMPLES,
       centre=(0, 0, (floor + head_c.z + 0.2) / 2), size=3.0, floor=floor, extras={"frame": "body"})

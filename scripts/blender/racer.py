# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE WORLD CUP RACER MODELLED IN BLENDER off the game's own data: his body
# (`BODY`), the pose he is bound in and every bone's frame in it
# (`skier-rig.ts`'s `STANDING` and `skierBones`), the head in its helmet as
# the game's own triangles (`helmet-shape.ts`'s `helmetParts`) and every
# clip sampled off the game's own `skierPose` — handed in as one JSON file
# by `scripts/blender.mjs --kind=racer` (`kinds/racer.mjs`).
#
# The frame is the skier kind's (`skier.py`): the pair's body frame (x
# right, y up, z forward) laid as Blender's (-x, z, y), so the glTF's frame
# is the body frame turned half round about y.
#
# WHAT A TECHNICAL RACER WEARS, after the start lists' photographs (a
# slalom's finish area seen side-on and from behind) and the federation's
# equipment rules:
#
#   * a ONE-PIECE SUIT, skin tight, printed in a team's panels: the trunk
#     and the shoulders in the team's red, the forearms and the legs white,
#     a red sweep down the outside of each thigh and a dark side panel down
#     each flank, the knees and shins padded under darker panels;
#   * a BACK PROTECTOR under it, the hard plate from the shoulder blades
#     to the small of the back the speed events require, lifting the suit
#     in a long low hump;
#   * the BIB over it, a yellow tabard open at the sides, its number big on
#     the chest and the back under a dark band;
#   * SHIN GUARDS, a hard black shell down the front of each shin from
#     under the knee over the boot's cuff, its rim piped in yellow, two
#     straps round the calf; ARM GUARDS, low hard pads down the outside of
#     each forearm; HAND GUARDS, the red shields the slalom pole carries in
#     front of each fist;
#   * a SLALOM HELMET, gloss red, with its CHIN GUARD, and mirrored goggles;
#     race gloves.
#
# How the game wears him (`racer-model.ts`): his geometry, his materials and
# their baked maps are this file's; his SKIN WEIGHTS are re-cut in the game
# off the loom's own rule (`dress-loft.ts`' `clothWeights`), so he bends
# bone for bone exactly as the code's dress does, and the bib's flutter and
# the suit's ripple are the game's shader off his airflow. The weights laid
# here serve the studio's clips.

import json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
POSE, FRAMES, HELM, BREAKS = DATA["rest"]["pose"], DATA["rest"]["bones"], DATA["helmet"], DATA["breaks"]


def B(p):
    """A point or direction of the body frame, in Blender's."""
    return Vector((-p["x"], p["z"], p["y"]))


def colour(hexa):
    """An sRGB colour as linear."""
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 for c in ((hexa >> 16) & 255, (hexa >> 8) & 255, hexa & 255))


# THE TEAM'S COLOURS (sRGB): its red, the suit's white, the dark of the side
# panels and the guards, the bib's yellow.
RED, WHITE, DARK, YELLOW = 0xD3141E, 0xF2F3F5, 0x15171C, 0xF3D51C

# ---------------------------------------------------------------- materials
SUIT = mat("suit", (1, 1, 1), rough=0.34)
BIB = mat("bib", (1, 1, 1), rough=0.7)
GUARD = mat("guard", colour(0x0E0F12), rough=0.22, coat=1.0)
EDGE = mat("guard_edge", colour(YELLOW), rough=0.4)
SHIELD = mat("shield", colour(RED), rough=0.25, coat=1.0)
STRAP = mat("strap", colour(0x101114), rough=0.7)
GLOVE = mat("glove", colour(0xB5121B), rough=0.55)
PALM = mat("palm", colour(0x1A1B1F), rough=0.8)
HELMET = mat("helmet", colour(RED), rough=0.18, coat=1.0)
PEAK = mat("peak", colour(WHITE), rough=0.22, coat=1.0)
CHIN = mat("chin", colour(0x121316), rough=0.3, coat=0.6)
LENS = mat("lens", colour(0x3FA9F5), metal=0.75, rough=0.06)
LINER = mat("liner", colour(0x2B2E34), rough=0.85)
SKIN = mat("skin", colour(0xC68863), rough=0.6)


# ---------------------------------------------------------------- the RIG
def frame(name):
    """A bone's frame — or the TRUNK's ("spine"): the chord from the hips
    to the neck the two spans of the back bend about, facing the chest."""
    if name == "spine":
        hips, neck = B(FRAMES["pelvis"]["head"]), B(FRAMES["chest"]["head"]) + B(FRAMES["chest"]["y"]) * FRAMES["chest"]["length"]
        y = (neck - hips).normalized()
        z = B(FRAMES["chest"]["z"])
        z = (z - y * z.dot(y)).normalized()
        return hips, y.cross(z), y, z, (neck - hips).length
    f = FRAMES[name]
    return B(f["head"]), B(f["x"]), B(f["y"]), B(f["z"]), f["length"]


for name in FRAMES:
    head, _, y, z, length = frame(name)
    bone(name, head, head + y * length, roll_to=z)

HALF = {}
for s in "lr":
    HALF |= {("spine", f"thigh_{s}"): f"hip_{s}", (f"thigh_{s}", f"shin_{s}"): f"knee_{s}",
             ("spine", f"upperarm_{s}"): f"shoulder_{s}", (f"upperarm_{s}", f"forearm_{s}"): f"elbow_{s}"}
LOWER = {n for n in FRAMES if "_lo_" in n}
SEGMENTS = {n: (frame(n)[0], frame(n)[0] + frame(n)[2] * frame(n)[4]) for n in FRAMES
            if n not in ("pelvis", "chest") and n not in HALF.values() and n not in LOWER
            and not n.startswith("hand")}
SEGMENTS["spine"] = (frame("spine")[0], frame("spine")[0] + frame("spine")[2] * frame("spine")[4])
NEAR = {"spine": ["head", "thigh_l", "thigh_r", "upperarm_l", "upperarm_r"], "head": ["spine"]}
for s in "lr":
    NEAR |= {f"thigh_{s}": ["spine", f"shin_{s}"], f"shin_{s}": [f"thigh_{s}", f"boot_{s}"],
             f"boot_{s}": [f"shin_{s}"], f"upperarm_{s}": ["spine", f"forearm_{s}"],
             f"forearm_{s}": [f"upperarm_{s}"]}


def along(co, seg):
    """How far along a segment the point is (0..1), and how far off it, m."""
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


def suit_weights(co, among=None):
    """The loom's rule (`dress-loft.ts`' `clothWeights`): across a joint,
    shared by nearness, a hinge's pair laid over its half bone, the trunk
    split pelvis to chest, an arm's share past its break handed to the bone
    below it."""
    pool = among or [n for n in SEGMENTS if not n.startswith("boot")]
    b0 = nearest(co, pool)
    d0 = along(co, SEGMENTS[b0])[1]
    near = [n for n in NEAR[b0] if among is None or n in among]
    w = {n: math.exp(-(along(co, SEGMENTS[n])[1] - d0) / blend(b0, n)) for n in [b0] + near}
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
    for s in "lr":
        for b, at in ((f"upperarm_{s}", BREAKS["upper"]), (f"forearm_{s}", BREAKS["fore"])):
            share = out.get(b)
            if not share:
                continue
            a0, a1 = SEGMENTS[b]
            m = along(co, SEGMENTS[b])[0] * (a1 - a0).length
            c = max(0.0, min(1.0, (m - at + 0.03) / 0.06))
            c = c * c * (3 - 2 * c)
            if c <= 0:
                continue
            out[b] = share * (1 - c)
            out[b.replace("arm_", "arm_lo_")] = share * c
            if c >= 1:
                out.pop(b)
    top = sorted(out.items(), key=lambda kv: -kv[1])[:4]
    total = sum(v for _, v in top)
    return {n: v / total for n, v in top}


# ---------------------------------------------------------------- the BODY
# The ANSUR II men's means (mm), as `skier.py` lays them on the game's spine.
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


# A SKIN-TIGHT SUIT: a few millimetres over the body where a padded shell
# stands two to three centimetres off it (`skier.py`'s ease) — only the
# padding under the shins and forearms and the back protector stand
# proud.
EASE = {"trunk": 0.006, "limb": 0.004, "cap": 0.003}

P = POSE
hips, neck, head_c = B(P["hips"]), B(P["neck"]), B(P["head"])
knees, feet = [B(k) for k in P["knees"]], [B(f) for f in P["feet"]]
shoulders, elbows, hands = [B(k) for k in P["shoulders"]], [B(k) for k in P["elbows"]], [B(k) for k in P["hands"]]
SEG = 18 if GAME else 30


def section(hx, front, back, n, a):
    """A superellipse ring's point at angle `a` (0 his right, π/2 ahead)."""
    ca, sa = math.cos(a), math.sin(a)
    u = math.copysign(abs(ca) ** (2 / n), ca) * hx
    v = math.copysign(abs(sa) ** (2 / n), sa) * (front if sa > 0 else back)
    return u, v


def lofted(name, bone_name, sections, n=2.4, m=None):
    head, x, y, z, length = frame(bone_name)
    rings = []
    for t, hx, front, back in sections:
        c = head + y * (t * length)
        rings.append([c + x * u + z * v for u, v in (section(hx, front, back, n, 2 * math.pi * k / SEG)
                                                      for k in range(SEG))])
    return loft(name, rings, [m or SUIT])


rides("chest")
pieces = []
bh = ANSUR["hip_breadth"] / 2 * MM
bd = ANSUR["buttock_depth"] * MM
wb, wd = ANSUR["waist_breadth"] / 2 * MM, ANSUR["waist_depth"] * MM
cb, cd = ANSUR["chest_breadth"] / 2 * MM, ANSUR["chest_depth"] * MM
e = EASE["trunk"]
TRUNK = [
    (level(ANSUR["crotch"]) - 0.04, bh * 0.8 + e, bd * 0.3 + e, bd * 0.45 + e),
    (level(ANSUR["crotch"]) + 0.05, bh + e, bd * 0.4 + e, bd * 0.52 + e),
    (0.08, bh * 0.98 + e, bd * 0.4 + e, bd * 0.53 + e),
    (level(ANSUR["waist_h"]), wb * 0.96 + e, wd * 0.5 + e, wd * 0.45 + e),
    (level(ANSUR["tenth_rib_h"]), wb * 0.95 + e, wd * 0.53 + e, wd * 0.46 + e),
    (0.52, cb * 1.04 + e, cd * 0.5 + e, cd * 0.48 + e),
    (level(ANSUR["chest_h"]), cb * 1.1 + e, cd * 0.5 + e, cd * 0.5 + e),
    (level(ANSUR["axilla_h"]), cb * 1.16 + e, cd * 0.46 + e, cd * 0.5 + e),
    (level(ANSUR["acromion_h"]) - 0.05, ANSUR["biacromial"] / 2 * MM * 0.88, cd * 0.38 + e, cd * 0.42 + e),
    (0.95, r_of(ANSUR["neck_base"]) * 1.4 + 0.01, 0.085, 0.085),
    (1.0, r_of(ANSUR["neck_base"]) + 0.012, 0.072, 0.072),
]
pieces.append(lofted("trunk", "spine", TRUNK, n=2.7))
# The race suit's NECK: a close stand collar up to the helmet's rim.
collar = [neck.lerp(head_c, u) for u in (0.0, 0.16, 0.3)]
SX, UPV, CHEST = frame("spine")[1], frame("spine")[2], frame("spine")[3]
pieces.append(loft("collar", [[c + SX * (0.072 * math.cos(2 * math.pi * k / SEG))
                               + CHEST * (0.068 * math.sin(2 * math.pi * k / SEG)) for k in range(SEG)]
                              for c in collar], [SUIT]))
# THE BACK PROTECTOR under the suit: a plate from between the shoulder
# blades down to the small of the back, 30 cm across at the top and 22 at
# the foot, standing 2–3 cm off the back — the long low hump a speed racer
# carries under his bib.
bc, bx_, by_, bz_, bl = frame("spine")
plate = []
for t, half, depth in ((0.18, 0.09, 0.0), (0.28, 0.11, 0.018), (0.5, 0.13, 0.026), (0.72, 0.145, 0.026),
                       (0.84, 0.13, 0.014), (0.9, 0.1, 0.0)):
    lo = max(i for i in range(len(TRUNK)) if TRUNK[i][0] <= t)
    a, b = TRUNK[lo], TRUNK[min(lo + 1, len(TRUNK) - 1)]
    k = 0 if b[0] == a[0] else (t - a[0]) / (b[0] - a[0])
    back = a[3] + (b[3] - a[3]) * k
    c = bc + by_ * (t * bl)
    ring = []
    for j in range(SEG):
        ang = 2 * math.pi * j / SEG
        u = math.cos(ang) * half
        v = math.sin(ang) * 0.025
        ring.append(c + bx_ * u - bz_ * (back - 0.03 + depth + v))
    plate.append(ring)
pieces.append(loft("protector", plate, [SUIT]))

for i, s in enumerate("lr"):
    reach = ANSUR["bideltoid"] / 2 * MM - ANSUR["biacromial"] / 2 * MM
    out = (shoulders[i] - neck.lerp(hips, 0.12)).normalized()
    pieces.append(ellipsoid("shoulder", shoulders[i] + frame("spine")[2] * 0.008 + out * 0.003,
                            (reach + EASE["cap"] + 0.004, reach + EASE["cap"] + 0.008, reach + EASE["cap"] + 0.006), SUIT))
    l = EASE["limb"]
    b = r_of(ANSUR["biceps"]) * 0.93
    pieces.append(lofted("sleeve", f"upperarm_{s}", [
        (-0.05, b * 1.22 + l, b * 1.18 + l, b * 1.18 + l),
        (0.35, b + l, b + l, b * 1.04 + l),
        (0.7, b * 0.9 + l, b * 0.88 + l, b * 0.93 + l),
        (1.05, b * 0.82 + l, b * 0.86 + l, b * 0.78 + l)]))
    f, w = r_of(ANSUR["forearm"]) * 0.93, r_of(ANSUR["wrist"])
    wrist_t = ANSUR["forearm_length"] * MM / frame(f"forearm_{s}")[4]
    pieces.append(lofted("sleeve", f"forearm_{s}", [
        (-0.08, f * 1.02 + l, f + l, f * 1.08 + l),
        (0.3, f + l, f + l, f + l),
        (wrist_t - 0.2, (f + w) / 2 + l, (f + w) / 2 + l, (f + w) / 2 + l),
        (wrist_t - 0.04, w + l, w + l, w + l)]))
    pieces.append(ellipsoid("elbow", elbows[i], (b * 0.86 + l,) * 3, SUIT))
    th, lt = r_of(ANSUR["thigh"]) * 0.97, r_of(ANSUR["lower_thigh"])
    pieces.append(lofted("leg", f"thigh_{s}", [
        (-0.12, th * 1.04 + l, th + l, th * 1.1 + l),
        (0.2, th + l, th + l, th + l),
        (0.6, (th + lt) / 2 + l, (th + lt) / 2 + l, (th + lt) / 2 + l),
        (0.95, lt + l, lt + l, lt + l)]))
    ca, an = r_of(ANSUR["calf"]), r_of(ANSUR["ankle"])
    pieces.append(lofted("leg", f"shin_{s}", [
        (-0.05, lt + l, lt + l, lt + l),
        (0.3, ca * 0.88 + l, ca * 0.78 + l, ca * 1.12 + l),
        (0.55, ca * 0.8 + l, ca * 0.74 + l, ca * 0.92 + l),
        (0.68, an * 1.15 + l, an * 1.1 + l, an * 1.15 + l)]))
    pieces.append(ellipsoid("knee", knees[i], (lt + l + 0.003,) * 3, SUIT))

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
smooth.factor, smooth.iterations = 0.6, 3 if GAME else 4
bpy.ops.object.convert(target="MESH")
if GAME:
    thin = suit.modifiers.new("budget", "DECIMATE")
    thin.ratio = 3600 / max(1, len(suit.data.polygons) * 2)
    bpy.ops.object.convert(target="MESH")
for p in suit.data.polygons:
    p.use_smooth = True
weights(suit, suit_weights)


# ---------------------------------------------------------------- the BIB
# THE BIB: a tabard of light knit, a front and a back panel joined over the
# shoulders, open at the sides, laid a centimetre off the suit and hanging to
# the top of his hips. Its unwrap is its own: the front on the left half of
# its map, the back on the right, so its number is printed square.
def trunk_at(t):
    lo = max(i for i in range(len(TRUNK)) if TRUNK[i][0] <= t)
    a, b = TRUNK[lo], TRUNK[min(lo + 1, len(TRUNK) - 1)]
    k = 0 if b[0] == a[0] else (t - a[0]) / (b[0] - a[0])
    return [a[j] + (b[j] - a[j]) * k for j in range(4)]


BIB_ROWS = (0.1, 0.2, 0.32, 0.44, 0.56, 0.66, 0.74, 0.8, 0.85, 0.88)
BIB_COLS = 9 if GAME else 17
BIB_OFF = 0.013


def bib_point(t, a, lift=0.0):
    """A point on the bib at level `t` up the spine and angle `a` round it
    (0 his right, π/2 the chest), `BIB_OFF` m off the suit — and over the
    back protector's hump behind."""
    _, hx, front, back = trunk_at(t)
    u, v = section(hx, front, back, 2.7, a)
    if v < 0 and 0.15 < t < 0.93:
        hump = 0.03 * math.sin(math.pi * (t - 0.15) / 0.78) * max(0.0, -math.sin(a))
        v -= hump
    r = Vector((u, v))
    rn = r.normalized() if r.length > 1e-6 else Vector((0, 1))
    u, v = u + rn.x * (BIB_OFF + lift), v + rn.y * (BIB_OFF + lift)
    return bc + by_ * (t * bl) + bx_ * u + bz_ * v


def panel(front):
    """One panel: rows up the trunk, columns across it, its width narrowing
    to the shoulders' straps at its top."""
    verts, uvs = [], []
    for ri, t in enumerate(BIB_ROWS):
        # How far round from the middle the panel reaches at this level, rad.
        reach = 1.02 if t < 0.74 else 1.02 - (t - 0.74) * 2.2
        for ci in range(BIB_COLS):
            c = ci / (BIB_COLS - 1)
            a = math.pi / 2 + (c - 0.5) * 2 * reach
            if not front:
                a = -a
            verts.append(bib_point(t, a))
            # Read from outside: the front from his right to his left, the
            # back from his left to his right.
            u = 0.5 - c * 0.5 if front else 0.5 + c * 0.5
            uvs.append((u, (t - BIB_ROWS[0]) / (BIB_ROWS[-1] - BIB_ROWS[0]) * 0.86))
    return verts, uvs


def clear_of_suit(vs):
    """Every bib point lifted to at least `BIB_OFF` m off the suit as built
    (its remeshed shoulders and chest bulge past the analytic section), so
    no pose shows the suit through the bib."""
    to, back = suit.matrix_world.inverted(), suit.matrix_world
    out = []
    for p in vs:
        ok, at, n, _ = suit.closest_point_on_mesh(to @ p)
        at, n = back @ at, (back.to_3x3() @ n).normalized()
        if ok and (p - at).dot(n) < BIB_OFF:
            p = at + n * BIB_OFF
        out.append(p)
    return out


verts, uvs, faces = [], [], []
for front in (True, False):
    v, uv = panel(front)
    base = len(verts)
    verts += v
    uvs += uv
    for r in range(len(BIB_ROWS) - 1):
        for c in range(BIB_COLS - 1):
            a = base + r * BIB_COLS + c
            q = [a, a + 1, a + 1 + BIB_COLS, a + BIB_COLS]
            faces.append(q if front else q[::-1])
# THE SHOULDER STRAPS: from each panel's top corner over the shoulder to the
# other's, a strap of the bib's knit.
top = len(BIB_ROWS) - 1
for side in (0, BIB_COLS - 1):
    fa = top * BIB_COLS + side
    ba = len(BIB_ROWS) * BIB_COLS + top * BIB_COLS + side
    fb = fa + (1 if side == 0 else -1)
    bb = ba + (1 if side == 0 else -1)
    # Lifted over the shoulder: two rows between the panels' tops.
    mids = []
    for k in (1, 2):
        u = k / 3
        pf_a, pb_a = verts[fa], verts[ba]
        pf_b, pb_b = verts[fb], verts[bb]
        lift = by_ * (0.028 * math.sin(math.pi * u))
        mids.append((pf_a.lerp(pb_a, u) + lift, pf_b.lerp(pb_b, u) + lift))
    i0 = len(verts)
    for ma, mb in mids:
        verts += [ma, mb]
        uvs += [(0.5, 0.97), (0.5, 0.97)]
    chain = [(fa, fb), (i0, i0 + 1), (i0 + 2, i0 + 3), (ba, bb)]
    for (a0, a1), (b0, b1) in zip(chain, chain[1:]):
        faces.append([a0, a1, b1, b0])
verts = clear_of_suit(verts)
bib = mesh_obj("bib", verts, faces, [BIB])
lay = bib.data.uv_layers.new(name="UVMap")
for loop in bib.data.loops:
    lay.data[loop.index].uv = uvs[loop.vertex_index]
solid = bib.modifiers.new("cloth", "SOLIDIFY")
solid.thickness, solid.offset = 0.0025, 1.0
# Weighted as the suit UNDER it is — the weights of the nearest point of the
# suit, not of the bib's own place a centimetre out, which the loom's
# nearness can hand to another bone — so the two bend as one and the suit
# never shows through.
def bib_weights(co):
    ok, at, _, _ = suit.closest_point_on_mesh(suit.matrix_world.inverted() @ Vector(co))
    return suit_weights(suit.matrix_world @ at if ok else co)


weights(bib, bib_weights)


# ---------------------------------------------------------------- the HELMET
rides("head")
hc, hx, hy, hz, _ = frame("head")
PAINT = {"shell": HELMET, "stripe": PEAK, "frame": PEAK, "band": CHIN, "trim": STRAP, "strap": STRAP,
         "foam": STRAP, "liner": LINER, "knit": LINER, "lens": LENS, "skin": SKIN}


def head_point(p):
    return hc + hx * p[0] + hy * p[1] + hz * p[2]


ramp = bpy.data.images.new("lens_ramp", 8, 64)
pix = []
for j in range(64):
    v = j / 63
    g = min(1.0, 0.5 + 0.42 * v ** 1.4 + 0.22 * math.exp(-(((v - 0.76) / 0.07) ** 2)))
    pix += [g, g, g, 1.0] * 8
ramp.pixels = pix
ramp.pack()
lens_nt = LENS.node_tree
lens_tex = lens_nt.nodes.new("ShaderNodeTexImage")
lens_tex.image = ramp
lens_mix = lens_nt.nodes.new("ShaderNodeMix")
lens_mix.data_type, lens_mix.blend_type = "RGBA", "MULTIPLY"
lens_mix.inputs["Factor"].default_value = 1.0
lens_mix.inputs[7].default_value = (*colour(0x3FA9F5), 1.0)
lens_nt.links.new(lens_tex.outputs["Color"], lens_mix.inputs[6])
lens_nt.links.new(lens_mix.outputs[2], lens_nt.nodes.get("Principled BSDF").inputs["Base Color"])

for part in HELM["game" if GAME else "fine"]:
    Pp, N, I = part["position"], part["normal"], part["index"]
    hv = [head_point(Pp[k:k + 3]) for k in range(0, len(Pp), 3)]
    hf = [I[k:k + 3] for k in range(0, len(I), 3)]
    ob = mesh_obj(f"helmet_{part['material']}", hv, hf, [PAINT[part["material"]]], recalc=False)
    normals = [tuple(hx * N[k] + hy * N[k + 1] + hz * N[k + 2]) for k in range(0, len(N), 3)]
    ob.data.normals_split_custom_set_from_vertices(normals)
    if "uv" in part:
        layer = ob.data.uv_layers.new(name="UVMap")
        uv = part["uv"]
        for loop in ob.data.loops:
            k = loop.vertex_index
            layer.data[loop.index].uv = (uv[k * 2], uv[k * 2 + 1])

# THE CHIN GUARD: a bar from ear cover to ear cover round the chin (the
# path the code's slalom helmet draws, `dress-head.ts`), on two struts.
chin = [head_point(p) for p in ((-0.106, -0.062, 0.0), (-0.09, -0.09, 0.06), (-0.05, -0.112, 0.112),
                                (0, -0.12, 0.132), (0.05, -0.112, 0.112), (0.09, -0.09, 0.06),
                                (0.106, -0.062, 0.0))]
tube("chin_guard", chin, 0.017, CHIN, smooth_n=0 if GAME else 2)
for sx in (-1, 1):
    ellipsoid("chin_hinge", head_point((0.106 * sx, -0.062, 0.0)), (0.022, 0.026, 0.026), CHIN)


# ---------------------------------------------------------------- the GUARDS
def shell(name, bone_name, t0, t1, rows, half_angle, radius, standoff, m, face=1.0, flare=0.0):
    """A HARD SHELL down a bone: an open arc round its front (`face` +1 its
    +z, −1 its back) from `t0` to `t1` along it, `radius(t)` m off its line
    plus `standoff`, flared outward `flare` m at both ends; solidified. Its
    rim's every row returned for the piping."""
    head, x, y, z, length = frame(bone_name)
    cols = 9 if GAME else 17
    rings = []
    for r in range(rows):
        u = r / (rows - 1)
        t = t0 + (t1 - t0) * u
        c = head + y * (t * length)
        rr = radius(t) + standoff + flare * (max(0.0, 1 - u * 6) + max(0.0, u * 6 - 5))
        ring = []
        for k in range(cols):
            a = math.pi / 2 + (k / (cols - 1) - 0.5) * 2 * half_angle
            ring.append(c + x * (math.cos(a) * rr) + z * (math.sin(a) * rr * face))
        rings.append(ring)
    ob = loft(name, rings, [m], closed=False, cap=False)
    sd = ob.modifiers.new("shell", "SOLIDIFY")
    sd.thickness, sd.offset = 0.004, 1.0
    return ob, rings


for i, s in enumerate("lr"):
    # SHIN GUARDS: from a hand under the knee down over the boot's cuff.
    rides(f"shin_{s}")
    _, _, _, _, sl = frame(f"shin_{s}")
    ca, lt = r_of(ANSUR["calf"]), r_of(ANSUR["lower_thigh"])
    calf = lambda t: (lt * (1 - t) + ca * 0.82 * t) if t < 0.5 else ca * 0.78
    _, rim = shell("shin_guard", f"shin_{s}", 0.1, 0.98, 9, math.radians(72), calf, 0.018, GUARD, flare=0.008)
    # Its rim piped in yellow: up both edges and across the top.
    tube("shin_edge", [rw[0] for rw in rim], 0.0042, EDGE)
    tube("shin_edge", [rw[-1] for rw in rim], 0.0042, EDGE)
    tube("shin_edge", rim[-1], 0.0042, EDGE)
    tube("shin_edge", rim[0], 0.005, EDGE)
    # Two straps round the calf behind.
    h_, x_, y_, z_, _ = frame(f"shin_{s}")
    for t in (0.3, 0.62):
        c = h_ + y_ * (t * sl)
        r = calf(t) + 0.012
        ring = [c + x_ * (math.cos(a) * r) + z_ * (math.sin(a) * r)
                for a in (math.pi + math.pi * k / 10 for k in range(11))]
        tube("shin_strap", ring, 0.008, STRAP)
    # ARM GUARDS: low pads down the outside of each forearm.
    rides(f"forearm_lo_{s}")
    _, fx, _, _, fl = frame(f"forearm_{s}")
    fr = r_of(ANSUR["forearm"]) * 0.93
    out_ = fx if fx.dot(shoulders[i] - neck) > 0 else -fx
    arm_face = 1.0
    shell("arm_guard", f"forearm_{s}", 0.52, 0.8, 5, math.radians(60),
          lambda t: fr * (1 - 0.25 * (t - 0.52) / 0.28), 0.008, GUARD, face=arm_face)
    # THE HAND: a race glove closed round the grip, and the pole's HAND
    # GUARD — a red shield bowed in front of the knuckles.
    rides(f"forearm_lo_{s}")
    ee, fx_, fy_, fz_, fl_ = frame(f"forearm_{s}")
    wrist_t = ANSUR["forearm_length"] * MM / fl_
    cyl("cuff", ee + fy_ * (fl_ * (wrist_t - 0.12)), ee + fy_ * (fl_ * (wrist_t + 0.02)), 0.045, GLOVE, r2=0.041)
    rides(f"hand_{s}")
    c, hx_, hy_, hz_, _ = frame(f"hand_{s}")
    outh = hx_ if hx_.dot(shoulders[i] - neck) > 0 else -hx_
    turn = Matrix((outh, hy_, hz_)).transposed().to_euler()
    ellipsoid("palm", c - hy_ * 0.035 + outh * 0.012, (0.029, 0.048, 0.045), GLOVE, rot=turn)
    for k in range(4):
        along_g = hz_ * (0.028 - 0.019 * k)
        arc = [c + along_g + (hy_ * math.cos(t) + outh * math.sin(t)) * 0.022
               for t in (math.radians(a) for a in range(-110, 181, 58 if GAME else 20))]
        tube("finger", arc, 0.009 - 0.0008 * k, PALM if k else GLOVE, smooth_n=0 if GAME else 2)
    tube("thumb", [c - hy_ * 0.03 - outh * 0.018 + hz_ * 0.03, c - outh * 0.02 + hz_ * 0.046,
                   c + hy_ * 0.02 - outh * 0.012 + hz_ * 0.048], 0.0105, GLOVE, smooth_n=0 if GAME else 2)
    # The guard: a bowed plate ahead of the fist (the way +y of the hand
    # faces — the forearm's line, squared to the shaft), round the knuckles
    # from the shaft's top to the little finger.
    rows = []
    for v in (-0.055, -0.02, 0.015, 0.05):
        row = []
        for u in (-0.95, -0.5, 0.0, 0.5, 0.95):
            bow = 0.062 - 0.012 * u * u
            row.append(c + hz_ * (v * 0.95 - 0.004) + hy_ * (bow * math.cos(u * 0.9)) + outh * (bow * math.sin(u * 0.9) + 0.01))
        rows.append(row)
    g_ = loft("hand_guard", rows, [SHIELD], closed=False, cap=False)
    sd = g_.modifiers.new("shell", "SOLIDIFY")
    sd.thickness, sd.offset = 0.004, 0.0

    # THE FOOT IN THE BOOT'S LINER (`skier.py`'s): hidden in the shell on
    # the skis, his own when a crash throws him off them.
    rides(f"boot_{s}")
    o, bfx, bfy, bfz, _ = frame(f"boot_{s}")
    lean = 0.22

    def down(d):
        return o + bfy * (0.014 - d * math.sin(lean)) - bfz * (0.02 + d * math.cos(lean))

    axis = (bfz * math.cos(lean) + bfy * math.sin(lean)).normalized()
    ahead = (bfy - axis * bfy.dot(axis)).normalized()
    loft("liner", [[down(d) + bfx * (r * math.cos(2 * math.pi * k / 16)) + ahead * (r * 1.08 * math.sin(2 * math.pi * k / 16))
                    for k in range(16)] for d, r in ((0.0, 0.046), (0.06, 0.049), (0.14, 0.051), (0.2, 0.05))],
         [LINER])
    sole = o - bfz * 0.285 + bfy * -0.02
    FOOT = [(-0.125, 0.03, 0.014, 0.06), (-0.1, 0.04, 0.008, 0.088), (-0.04, 0.043, 0.008, 0.1),
            (0.03, 0.044, 0.008, 0.085), (0.09, 0.045, 0.008, 0.066), (0.13, 0.037, 0.01, 0.05),
            (0.15, 0.02, 0.016, 0.034)]
    loft("foot", [[sole + bfy * u + bfx * (w * math.cos(2 * math.pi * k / 16))
                   + bfz * ((lo + hi) / 2 + (hi - lo) / 2 * math.sin(2 * math.pi * k / 16)) for k in range(16)]
                  for u, w, lo, hi in FOOT], [LINER])

curves = [o for o in COL.objects if o.type == "CURVE"]
if curves:
    lib._select_only(curves)
    bpy.context.view_layer.objects.active = curves[0]
    bpy.ops.object.convert(target="MESH")

# ---------------------------------------------------------------- the PRINT
import racer_print  # noqa: E402

racer_print.paint(suit, bib, SUIT, BIB, dict(
    GAME=GAME, frame=frame, knees=knees, hips=hips, neck=neck, shoulders=shoulders, elbows=elbows,
    colours=dict(red=colour(RED), white=colour(WHITE), dark=colour(DARK), yellow=colour(YELLOW)),
    COL=COL))

# ---------------------------------------------------------------- the CLIPS
lib.FPS = 15
DATA_FPS = 30


def keyed(frames):
    def at(t):
        f = frames[min(len(frames) - 1, round(t * DATA_FPS))]
        out = {}
        for name, fr in f.items():
            head, x, y, z = B(fr["head"]), B(fr["x"]), B(fr["y"]), B(fr["z"])
            m = Matrix((x, y, z)).transposed().to_4x4()
            m.translation = head
            out[name] = {"matrix": m}
        return out
    return at


for c in DATA["clips"]:
    clip(c["name"], c["seconds"], keyed(c["frames"]))

floor = min(f.z for f in feet) - 0.06
finish(os.path.basename(argv[0]).removesuffix(".json"), OUT, SAMPLES,
       centre=(0, hips.y + 0.1, floor + 0.55), size=3.0, floor=floor, extras={"frame": "body"},
       lods=(("lod1", 0.5),))

# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE PARK RIDER MODELLED IN BLENDER off the game's own data: the pose he
# is bound in and every bone's frame in it (`dress-loft.ts`'s `bindPose`:
# `skier-rig.ts`'s `STANDING` and `skierBones`) and his bare head as the
# game's own triangles (`helmet-shape.ts`'s `bareHeadParts`) — handed in
# as one JSON file by `scripts/blender.mjs --kind=park`.
#
# He is dressed as the terrain park dresses, after photographs of park
# skiers on the rails and the kickers (kept local, never named): an
# OVERSIZED pullover hoodie cut as a tall tee, hanging to mid-thigh over
# the pants, its shoulders dropped, its sleeves wide and bunched at ribbed
# cuffs, a kangaroo pocket on the belly, the hood down on his back and its
# drawstrings hanging; BAGGY PANTS cut low in the crotch and stacked in
# folds over the boots; a cuffed knit BEANIE with the GOGGLES worn
# backwards over it (the lens on the back of his head, the strap across
# the brow); short leather PIPE GLOVES round the pole grips.
#
# The frame: the pair's body frame (x right, y up, z forward) laid as
# Blender's (-x, z, y), as `skier.py`'s, so the glTF comes out a half turn
# about y from the game's frame and `park-rider.ts` turns it back.
#
# NOT SKINNED HERE. Every part rides the root bone; what the game needs to
# skin him is written into the mesh's UV instead (u: how LOOSE the cloth is
# there — what flutters in the air past him; v: a TAG naming which bones a
# vertex rides, `TAGS`). The game weights him with the dressed skin's own
# rule (`dress-loft.ts`'s `clothWeights`, the half bones and the arm's
# bones below a break with it), so he bends exactly as the dressed skier
# does on every pose the game has, and the tags pin the rigid parts (the
# head, the hands) and the loose ones (the tall tee's skirt, the hood, the
# drawstrings) to the bones they hang from.

import json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
POSE, FRAMES, HEAD = DATA["rest"]["pose"], DATA["rest"]["bones"], DATA["head"]

# What a vertex rides, read by `park-rider.ts` (`PARK_TAGS`): the UV's v is
# (tag + 0.5) / 32.
TAGS = {"cloth": 0, "head": 1, "hand_l": 2, "hand_r": 3, "forearm_l": 4, "forearm_r": 5,
        "skirt": 6, "hood": 7, "boot_l": 8, "boot_r": 9, "legs": 10, "string": 11, "chest": 12}


def B(p):
    """A point or direction of the body frame, in Blender's."""
    return Vector((-p["x"], p["z"], p["y"]))


def colour(hexa):
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 for c in ((hexa >> 16) & 255, (hexa >> 8) & 255, hexa & 255))


# ---------------------------------------------------------------- materials
# The colourway: a deep teal hoodie with a cream band round the chest and
# the arms, a darker teal rib at the cuffs, the hem and the pocket; washed
# khaki pants; a burnt orange beanie; tan leather gloves; the goggles'
# black strap and an amber mirror. Every material is named: the game reads
# the colours off them and splits the HARD goods (the lens, the strap's
# clip, the aglets) from the cloth by name (`park-rider.ts`'s `HARD`).
HOODIE = mat("hoodie", colour(0x1F6F78), rough=0.9)
BAND = mat("band", colour(0xE9E1CC), rough=0.9)
RIB = mat("rib", colour(0x15474E), rough=0.95)
PANTS = mat("pants", colour(0x7E7A68), rough=0.92)
SEAM = mat("seam", colour(0x5E5B4D), rough=0.95)
BEANIE = mat("beanie", colour(0xC8551F), rough=0.95)
CUFF = mat("beanie_cuff", colour(0xA8461A), rough=0.95)
GLOVE = mat("glove", colour(0xA87A4E), rough=0.75)
PALM = mat("palm", colour(0x6E4B2D), rough=0.8)
STRAP = mat("strap", colour(0x111214), rough=0.7)
WEBBING = mat("webbing", colour(0x2E8C96), rough=0.8)
FRAME_ = mat("frame", colour(0x15171A), rough=0.4)
LENS = mat("lens", colour(0xE0902C), metal=0.7, rough=0.08)
STRING = mat("string", colour(0xE9E1CC), rough=0.8)
AGLET = mat("aglet", colour(0x1A1A1A), metal=0.6, rough=0.3)
SKIN = mat("skin", colour(0xC68863), rough=0.6)
HAIR = mat("hair", colour(0x3A2A1E), rough=0.9)
EYES = mat("eyes", colour(0x1A1210), rough=0.5)
LINER = mat("liner", colour(0x2B2E34), rough=0.85)


# ---------------------------------------------------------------- the frame
def frame(name):
    """A bone's frame — or the TRUNK's ("spine"): the chord from the hips to
    the neck, facing the chest."""
    if name == "spine":
        hips, neck = B(FRAMES["pelvis"]["head"]), B(FRAMES["chest"]["head"]) + B(FRAMES["chest"]["y"]) * FRAMES["chest"]["length"]
        y = (neck - hips).normalized()
        z = B(FRAMES["chest"]["z"])
        z = (z - y * z.dot(y)).normalized()
        return hips, y.cross(z), y, z, (neck - hips).length
    f = FRAMES[name]
    return B(f["head"]), B(f["x"]), B(f["y"]), B(f["z"]), f["length"]


# ANSUR II's mean man (US Army 2012), as `skier.py` cites it: the body the
# kit is cut over, mm.
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


P = POSE
hips, neck, head_c = B(P["hips"]), B(P["neck"]), B(P["head"])
knees, feet = [B(k) for k in P["knees"]], [B(f) for f in P["feet"]]
shoulders, elbows, hands = [B(k) for k in P["shoulders"]], [B(k) for k in P["elbows"]], [B(k) for k in P["hands"]]
SEG = 18 if GAME else 32
SX, UPS, CHEST = frame("spine")[1], frame("spine")[2], frame("spine")[3]
UP = (neck - hips).normalized()

# Every object's tag and the looseness of each of its vertices, written as
# its UV at the end (`stamp`).
TAGGED = {}


def tag(ob, name, loose=0.0):
    """`loose` a number, or a function of a vertex's position."""
    TAGGED[ob.name] = (TAGS[name], loose)
    return ob


def ring_at(c, x, z, hx, front, back, n=2.4, seg=None):
    seg = seg or SEG
    out = []
    for k in range(seg):
        a = 2 * math.pi * k / seg
        ca, sa = math.cos(a), math.sin(a)
        u = math.copysign(abs(ca) ** (2 / n), ca) * hx
        v = math.copysign(abs(sa) ** (2 / n), sa) * (front if sa > 0 else back)
        out.append(c + x * u + z * v)
    return out


def lofted(name, bone_name, sections, mats, n=2.4, cap=True):
    """A piece along a bone: rings at `t` (a share of its length), each
    `(t, half across, ahead, behind)`."""
    head, x, y, z, length = frame(bone_name)
    return loft(name, [ring_at(head + y * (t * length), x, z, hx, f, b, n) for t, hx, f, b in sections],
                mats, cap=cap)


# ---------------------------------------------------------------- THE BODY OF THE KIT
# One skin, remeshed: the hoodie's body to the hips, its dropped shoulders
# and wide sleeves, the baggy pants. Ease, m a side over the survey's man:
# a size or two up on purpose.
E = {"trunk": 0.055, "front": 0.06, "back": 0.065, "sleeve": 0.045, "pants": 0.05}
bh, bd = ANSUR["hip_breadth"] / 2 * MM, ANSUR["buttock_depth"] * MM
wb, wd = ANSUR["waist_breadth"] / 2 * MM, ANSUR["waist_depth"] * MM
cb, cd = ANSUR["chest_breadth"] / 2 * MM, ANSUR["chest_depth"] * MM
TRUNK = [
    # The pants' seat, cut LOW: the crotch hangs a hand under the body's.
    (level(ANSUR["crotch"]) - 0.1, bh * 0.85 + E["pants"], bd * 0.32 + E["pants"], bd * 0.45 + E["pants"]),
    (level(ANSUR["crotch"]) + 0.02, bh + E["pants"] + 0.01, bd * 0.42 + E["pants"], bd * 0.55 + E["pants"]),
    (0.1, bh + E["trunk"], bd * 0.45 + E["front"], bd * 0.55 + E["back"]),
    (level(ANSUR["waist_h"]), wb + E["trunk"] + 0.01, wd * 0.6 + E["front"], wd * 0.45 + E["back"]),
    (level(ANSUR["tenth_rib_h"]), wb + E["trunk"] + 0.01, wd * 0.58 + E["front"], wd * 0.46 + E["back"]),
    (level(ANSUR["chest_h"]), cb * 1.12 + E["trunk"], cd * 0.5 + E["front"], cd * 0.5 + E["back"]),
    (level(ANSUR["axilla_h"]), cb * 1.24 + E["trunk"], cd * 0.47 + E["front"], cd * 0.5 + E["back"]),
    # The shoulder's seam DROPPED off the point of the shoulder.
    (level(ANSUR["acromion_h"]) - 0.03, ANSUR["biacromial"] / 2 * MM + 0.02, cd * 0.42 + E["front"] * 0.8,
     cd * 0.46 + E["back"] * 0.8),
    (0.95, r_of(ANSUR["neck_base"]) * 1.55 + 0.03, 0.11, 0.12),
    (1.0, r_of(ANSUR["neck_base"]) + 0.035, 0.085, 0.1),
]
pieces = [lofted("trunk", "spine", TRUNK, [HOODIE], n=2.6)]
for i, s in enumerate("lr"):
    out = (shoulders[i] - neck.lerp(hips, 0.12)).normalized()
    reach = ANSUR["bideltoid"] / 2 * MM - ANSUR["biacromial"] / 2 * MM
    pieces.append(ellipsoid("shoulder", shoulders[i] - UP * 0.015 + out * 0.01,
                            (reach + 0.05, reach + 0.05, reach + 0.05), HOODIE))
    b = r_of(ANSUR["biceps"])
    S = E["sleeve"]
    pieces.append(lofted("sleeve", f"upperarm_{s}", [
        (-0.05, b * 1.3 + S, b * 1.25 + S, b * 1.25 + S), (0.35, b + S, b + S, b * 1.05 + S),
        (0.75, b * 0.95 + S, b * 0.95 + S, b + S), (1.05, b * 0.92 + S, b * 0.95 + S, b * 0.9 + S)], [HOODIE]))
    f, w = r_of(ANSUR["forearm"]), r_of(ANSUR["wrist"])
    wrist_t = ANSUR["forearm_length"] * MM / frame(f"forearm_{s}")[4]
    # The sleeve long: bunched in rolls down onto the cuff.
    pieces.append(lofted("sleeve", f"forearm_{s}", [
        (-0.08, f * 1.05 + S, f + S, f * 1.1 + S), (0.3, f + S, f + S, f + S),
        (wrist_t - 0.32, f + S * 0.95, f + S * 0.95, f + S * 0.95),
        (wrist_t - 0.16, (f + w) / 2 + S * 0.8, (f + w) / 2 + S * 0.8, (f + w) / 2 + S * 0.8),
        (wrist_t - 0.1, w + 0.012, w + 0.012, w + 0.012)], [HOODIE]))
    pieces.append(ellipsoid("elbow", elbows[i], (b + S,) * 3, HOODIE))
    th, lt = r_of(ANSUR["thigh"]), r_of(ANSUR["lower_thigh"])
    Pn = E["pants"]
    pieces.append(lofted("pants", f"thigh_{s}", [
        (-0.15, th * 1.05 + Pn, th + Pn, th * 1.1 + Pn), (0.2, th + Pn, th + Pn, th + Pn),
        (0.6, th * 0.95 + Pn, th * 0.92 + Pn, th * 0.95 + Pn), (0.98, lt + Pn + 0.012, lt + Pn + 0.015, lt + Pn + 0.012)],
        [PANTS]))
    ca = r_of(ANSUR["calf"])
    # The leg's width carried STRAIGHT down to the boot, where it stacks.
    pieces.append(lofted("pants", f"shin_{s}", [
        (-0.05, lt + Pn + 0.012, lt + Pn + 0.015, lt + Pn + 0.012),
        (0.35, ca * 0.95 + Pn + 0.012, ca * 0.9 + Pn + 0.012, ca + Pn + 0.012),
        (0.62, ca * 0.95 + Pn + 0.02, ca * 0.95 + Pn + 0.02, ca + Pn + 0.022),
        (0.8, ca * 0.95 + Pn + 0.034, ca * 0.95 + Pn + 0.038, ca + Pn + 0.036),
        # Down OVER the boot to the ankle, as a park rider wears them: the
        # shell's cuff never shows.
        (0.98, ca + Pn + 0.042, ca + Pn + 0.05, ca + Pn + 0.044)], [PANTS]))
    pieces.append(ellipsoid("knee", knees[i], (lt + Pn + 0.016,) * 3, PANTS))
# The neck between the hoodie's neckline and the head.
neck_rings = [neck.lerp(head_c, u) for u in (-0.15, 0.25, 0.6)]
pieces.append(loft("neck", [[c + SX * (0.058 * math.cos(2 * math.pi * k / SEG)) + CHEST * (0.06 * math.sin(2 * math.pi * k / SEG))
                             for k in range(SEG)] for c in neck_rings], [SKIN]))

bpy.context.view_layer.objects.active = pieces[0]
for o in bpy.context.view_layer.objects:
    o.select_set(o in pieces[:-1])
bpy.ops.object.convert(target="MESH")
bpy.ops.object.join()
suit = bpy.context.view_layer.objects.active
suit.name = suit.data.name = "suit"
remesh = suit.modifiers.new("one", "REMESH")
remesh.mode, remesh.voxel_size = "VOXEL", 0.015 if GAME else 0.006
smooth = suit.modifiers.new("ease", "SMOOTH")
smooth.factor, smooth.iterations = 0.6, 3 if GAME else 5
bpy.ops.object.convert(target="MESH")


def along(co, a, b):
    d = b - a
    t = max(0.0, min(1.0, (co - a).dot(d) / d.length_squared))
    return t, (co - (a + d * t)).length


SEGS = {n: (frame(n)[0], frame(n)[0] + frame(n)[2] * frame(n)[4])
        for n in ("upperarm_l", "upperarm_r", "forearm_l", "forearm_r", "thigh_l", "thigh_r", "shin_l", "shin_r")}
SEGS["spine"] = (frame("spine")[0], frame("spine")[0] + UPS * frame("spine")[4])


def nearest(co):
    return min(SEGS, key=lambda n: along(co, *SEGS[n])[1])


# THE FOLDS a baggy kit falls in, pressed along the surface's normal
# before the decimation: the sleeves bunched in rolls above the cuffs, the
# crook of each elbow, the pants STACKED in deep rolls over the boots, the
# back of each knee, and soft drape lines down the hoodie's body.
FOLDS = [  # bone kind, t from, t to, face, amp, pitch
    ("forearm", 0.35, 0.82, 0, 0.009, 0.045), ("upperarm", 0.72, 1.0, -1, 0.01, 0.045),
    ("forearm", 0.0, 0.2, -1, 0.009, 0.045),
    ("shin", 0.48, 1.0, 0, 0.018, 0.06), ("thigh", 0.75, 1.0, -1, 0.012, 0.05),
    ("shin", 0.0, 0.2, -1, 0.01, 0.05), ("thigh", 0.05, 0.35, 1, 0.008, 0.07),
]
bm = bmesh.new()
bm.from_mesh(suit.data)
bm.normal_update()
for v in bm.verts:
    b = nearest(v.co)
    t = along(v.co, *SEGS[b])[0]
    head, x, y, z, bl = frame(b)
    for kind, t0, t1, face, amp, pitch in FOLDS:
        if not b.startswith(kind) or not t0 <= t <= t1:
            continue
        side = 1.0 if face == 0 else max(0.0, v.normal.dot(z) * face)
        fade = math.sin(math.pi * (t - t0) / (t1 - t0))
        # A roll is not a ring: its line wanders round the limb.
        a = math.atan2((v.co - head).dot(z), (v.co - head).dot(x))
        wob = 0.25 * math.sin(2 * a + 1.3 * t * bl / pitch)
        v.co += v.normal * (amp * side * fade * math.sin(2 * math.pi * (t * bl / pitch + wob)))
    if b == "spine":
        # Drape: soft vertical folds down the body from the chest, deeper
        # toward the hem.
        rel = v.co - hips
        lvl = rel.dot(UP) / frame("spine")[4]
        if -0.1 < lvl < 0.62:
            a = math.atan2(rel.dot(CHEST), rel.dot(SX))
            k = (0.62 - lvl) / 0.72
            v.co += v.normal * (0.006 * k * math.sin(7 * a + 0.8))
bm.to_mesh(suit.data)
bm.free()
if GAME:
    thin = suit.modifiers.new("budget", "DECIMATE")
    thin.ratio = 4200 / max(1, len(suit.data.polygons) * 2)
    bpy.ops.object.convert(target="MESH")

# THE COLOURS on clean lines: the hoodie's hem plane (the body over the
# hips — the skirt below it is a piece of its own), the cream band round
# the chest and the arms, the ribbed cuffs.
HEM = (hips + UP * 0.07, UP)
BAND_LO = (hips + UP * (0.5 * frame("spine")[4]), UP)
BAND_HI = (hips + UP * (0.62 * frame("spine")[4]), UP)
CUFFS = {s: (frame(f"forearm_{s}")[0] + frame(f"forearm_{s}")[2] * (ANSUR["forearm_length"] * MM - 0.065),
             frame(f"forearm_{s}")[2]) for s in "lr"}
# The band carried down each arm as a ring a third of the way down the
# upper arm, the same two planes turned onto the arm's bone.
ARM_BAND = {s: [(frame(f"upperarm_{s}")[0] + frame(f"upperarm_{s}")[2] * (frame(f"upperarm_{s}")[4] * t),
                 frame(f"upperarm_{s}")[2]) for t in (0.3, 0.48)] for s in "lr"}
# Under the tall tee's skirt the kit is drawn in the hoodie's colour, so a
# fold of the seat or a thigh pushed through the skirt in a deep crouch
# never shows the pants' dark through it.
LAPS = {s: (frame(f"thigh_{s}")[0] + frame(f"thigh_{s}")[2] * frame(f"thigh_{s}")[4] * 0.36,
            frame(f"thigh_{s}")[2]) for s in "lr"}
bm = bmesh.new()
bm.from_mesh(suit.data)
cuts = [HEM, BAND_LO, BAND_HI] + list(CUFFS.values()) + [p for s in "lr" for p in ARM_BAND[s]] + list(LAPS.values())
for co, no in cuts:
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)
bm.to_mesh(suit.data)
bm.free()


def above(co, plane):
    return (co - plane[0]).dot(plane[1]) > 0


def cloth_of(co):
    b = nearest(co)
    if b.startswith("shin") or (b.startswith("thigh") and above(co, LAPS[b[-1]])):
        return 2
    if b == "spine":
        if (co - neck).length < 0.1 and (co - neck).dot(UP) > -0.02:
            return 0
        if not above(co, HEM):
            return 0
        return 1 if above(co, BAND_LO) and not above(co, BAND_HI) else 0
    if b.startswith("upperarm"):
        lo, hi = ARM_BAND[b[-1]]
        return 1 if above(co, lo) and not above(co, hi) else 0
    if b.startswith("forearm"):
        return 3 if above(co, CUFFS[b[-1]]) else 0
    return 0


suit.data.materials.clear()
for m in (HOODIE, BAND, PANTS, RIB):
    suit.data.materials.append(m)
suit.data.polygons.foreach_set("material_index", [cloth_of(p.center) for p in suit.data.polygons])
for p in suit.data.polygons:
    p.use_smooth = True


def suit_loose(co):
    """How loose the kit is here: the sleeves toward the cuffs, the pants
    toward the stack, the body's front and back."""
    b = nearest(co)
    t = along(co, *SEGS[b])[0]
    if b.startswith("forearm"):
        return 0.35 + 0.35 * t
    if b.startswith("upperarm"):
        return 0.35
    if b.startswith("shin"):
        return 0.4 + 0.5 * t
    if b.startswith("thigh"):
        return 0.35
    return 0.25


tag(suit, "cloth", suit_loose)
neckob = pieces[-1]
tag(neckob, "cloth", 0.0)

# ---------------------------------------------------------------- THE TALL TEE'S SKIRT
# The hoodie hangs on past the hips to mid-thigh: a skirt of cloth round
# the seat and the tops of the thighs, open at the foot, flaring a little,
# its hem a ribbed band — the loosest cloth on him, what the air past him
# lifts and flaps (`park-rider.ts`).
SPINE_L = frame("spine")[4]
SKIRT = [  # how far down from the hem's top, half across, ahead, behind
    (0.0, wb + E["trunk"] + 0.015, wd * 0.62 + E["front"] + 0.012, wd * 0.47 + E["back"] + 0.012),
    (0.075, bh + E["trunk"] + 0.02, bd * 0.48 + E["front"] + 0.012, bd * 0.58 + E["back"] + 0.014),
    (0.165, bh + E["trunk"] + 0.04, bd * 0.48 + E["front"] + 0.02, bd * 0.6 + E["back"] + 0.02),
    (0.245, bh + E["trunk"] + 0.055, bd * 0.5 + E["front"] + 0.026, bd * 0.62 + E["back"] + 0.026),
    (0.285, bh + E["trunk"] + 0.06, bd * 0.5 + E["front"] + 0.03, bd * 0.62 + E["back"] + 0.03),
]
# The cloth falls straight down behind him over the seat and, in front,
# over the tops of the thighs he is crouched over — each ring's point
# carried down the blend of the two.
THIGH = ((knees[0] + knees[1]) / 2 - hips).normalized()
SKIRT_TOP = hips + UP * 0.075
SKIRT_RINGS = []
seg_k = 24 if GAME else 48
for h, hx, fr, bk in SKIRT:
    ring = ring_at(SKIRT_TOP, SX, CHEST, hx, fr, bk, n=2.6, seg=seg_k)
    out = []
    for k, q in enumerate(ring):
        sa = math.sin(2 * math.pi * k / seg_k)
        front = max(0.0, sa) ** 1.2
        d = Vector((0, 0, -1)).lerp(THIGH, front).normalized()
        out.append(q + d * h)
    SKIRT_RINGS.append(out)
skirt = loft("skirt", SKIRT_RINGS, [HOODIE], cap=False)
bm = bmesh.new()
bm.from_mesh(skirt.data)
bm.normal_update()
for v in bm.verts:
    rel = v.co - SKIRT_TOP
    a = math.atan2(rel.dot(CHEST), rel.dot(SX))
    k = max(0.0, min(1.0, (-rel.dot(UP) - 0.02) / 0.26))
    # The drape: folds falling from the hips, deepening to the hem.
    radial = (SX * rel.dot(SX) + CHEST * rel.dot(CHEST)).normalized()
    v.co += radial * (0.011 * k * math.sin(9 * a + 0.4) + 0.006 * k * math.sin(4 * a + 2))
bm.to_mesh(skirt.data)
bm.free()
sol = skirt.modifiers.new("cloth", "SOLIDIFY")
sol.thickness, sol.offset = 0.008, 1.0
skirt.data.materials.append(RIB)
bm = bmesh.new()
bm.from_mesh(skirt.data)
bm.faces.ensure_lookup_table()
for f in bm.faces:
    if (f.calc_center_median() - SKIRT_TOP).dot(UP) < -0.235:
        f.material_index = 1
bm.to_mesh(skirt.data)
bm.free()
tag(skirt, "skirt", lambda co: max(0.2, min(1.0, 0.25 + (-(co - SKIRT_TOP).dot(UP)) / 0.27 * 0.75)))

# THE KANGAROO POCKET over the belly: a panel stood a few millimetres off
# the body with its two slanted openings, in the rib's darker teal.
belly = hips + UP * 0.12
reach_f = wd * 0.6 + E["front"] + 0.004
pocket_rings = []
for k, hz in enumerate((0.0, 0.05, 0.1, 0.15)):
    w = 0.16 - 0.035 * (hz / 0.15) ** 2
    ring = []
    for j in range(9):
        u = -1 + 2 * j / 8
        # On the trunk's own superellipse (`ring_at`'s), stood just proud.
        hxw = wb + E["trunk"] + 0.06
        y = reach_f * max(0.0, 1 - abs(u * w / hxw) ** 2.6) ** (1 / 2.6) + 0.014
        ring.append(belly + UP * (hz - 0.03) + SX * (u * w) + CHEST * y)
    pocket_rings.append(ring)
faces = [(r * 9 + j, r * 9 + j + 1, (r + 1) * 9 + j + 1, (r + 1) * 9 + j) for r in range(3) for j in range(8)]
pocket = mesh_obj("pocket", [p for ring in pocket_rings for p in ring], faces, [RIB])
pocket.modifiers.new("cloth", "SOLIDIFY").thickness = 0.005
tag(pocket, "cloth", 0.2)

# ---------------------------------------------------------------- THE HOOD
# Down on his back between the shoulder blades: two layers of cloth, its
# opening rolled toward the sky, lying in a soft heap off the neckline.
# Its own tag: the game hangs it off the chest and swings it on a spring.
BACK_DEPTH = ((0.0, 0.1), (0.03, 0.12), (0.08, 0.16), (0.15, 0.17), (0.3, 0.165))


def back_depth(u):
    for (u0, d0), (u1, d1) in zip(BACK_DEPTH, BACK_DEPTH[1:]):
        if u <= u1:
            return d0 + (d1 - d0) * (u - u0) / (u1 - u0)
    return BACK_DEPTH[-1][1]


HOOD = ((0.0, 0.07, 0.022), (0.03, 0.115, 0.04), (0.09, 0.135, 0.05), (0.16, 0.12, 0.045),
        (0.215, 0.08, 0.03), (0.24, 0.035, 0.014))
hood_rings = []
for u, w, t in HOOD:
    c = neck - UP * (u + 0.015) - CHEST * (back_depth(u + 0.015) + t * 0.55)
    ring = []
    for j in range(SEG):
        a = 2 * math.pi * j / SEG
        ca, sa = math.cos(a), math.sin(a)
        # Bulged out behind (−CHEST), flat against his back in front.
        bulge = t * (abs(sa) ** 0.8) * (1.0 if sa < 0 else 0.45)
        ring.append(c + SX * (w * math.copysign(abs(ca) ** 0.85, ca)) + CHEST * (math.copysign(bulge, sa)))
    hood_rings.append(ring)
hood = loft("hood", hood_rings, [HOODIE])
tag(hood, "hood", 0.8)
# Its lining showing at the rolled edge round the opening: the band's cream.
u0, w0, t0 = HOOD[1]
c0 = neck - UP * (u0 + 0.015) - CHEST * (back_depth(u0 + 0.015) + t0 * 0.55)
lip = [c0 + SX * (w0 * 0.92 * math.cos(math.pi * j / 10)) - CHEST * (t0 * 0.9 * math.sin(math.pi * j / 10)) + UP * 0.006
       for j in range(11)]
tag(tube("hood_lip", lip, 0.011, BAND), "hood", 0.8)

# THE DRAWSTRINGS: two cords out of the neckline's front, hanging down the
# chest with a metal aglet at the end of each — they swing.
for side in (-1, 1):
    # Out of the neckline and down over the chest's bulge, lying on it.
    pts = [neck - UP * (0.03 + 0.19 * u) + SX * (0.04 * side + 0.006 * side * u)
           + CHEST * (0.11 + 0.1 * min(1.0, u * 1.8)) for u in (0.0, 0.2, 0.45, 0.7, 1.0)]
    tag(tube("string", pts, 0.0045, STRING), "string", 1.0)
    tag(cyl("aglet", pts[-1], pts[-1] - UP * 0.025, 0.0055, AGLET, seg=8), "string", 1.0)

# THE RIBBED CUFFS: a short knit band round each wrist under the glove.
for i, s in enumerate("lr"):
    e, fx, fy, fz, fl = frame(f"forearm_{s}")
    wrist_t = ANSUR["forearm_length"] * MM / fl
    w = r_of(ANSUR["wrist"])
    tag(cyl("cuff", e + fy * (fl * (wrist_t - 0.13)), e + fy * (fl * (wrist_t - 0.04)), w + 0.016, RIB, r2=w + 0.012),
        f"forearm_{s}", 0.2)

# ---------------------------------------------------------------- THE HEAD
# His bare head as the game's own triangles: the face, the nose, the eyes
# and the hair (`bareHeadParts`), riding the head bone.
hc, hx, hy, hz, _ = frame("head")


def head_point(p):
    return hc + hx * p[0] + hy * p[1] + hz * p[2]


HPAINT = {"skin": SKIN, "knit": HAIR, "trim": EYES}
for part in HEAD["game" if GAME else "fine"]:
    Pp, N, I = part["position"], part["normal"], part["index"]
    verts = [head_point(Pp[k:k + 3]) for k in range(0, len(Pp), 3)]
    faces = [I[k:k + 3] for k in range(0, len(I), 3)]
    ob = mesh_obj(f"head_{part['material']}", verts, faces, [HPAINT.get(part["material"], SKIN)], recalc=False)
    normals = [tuple(hx * N[k] + hy * N[k + 1] + hz * N[k + 2]) for k in range(0, len(N), 3)]
    ob.data.normals_split_custom_set_from_vertices(normals)
    tag(ob, "head")

# THE BEANIE: a knit pulled down to the brow, its cuff turned up a few
# centimetres, the crown slouched a little back. The head's egg (the
# game's `HEAD`): radii 0.077 × 0.104 × 0.097 about (0, −0.014, −0.006).
EGG_R, EGG_AT = (0.077, 0.104, 0.097), (0.0, -0.014, -0.006)


def egg_ring(y, grow, back=0.0, seg=None):
    seg = seg or SEG
    u = (y - EGG_AT[1]) / EGG_R[1]
    k = math.sqrt(max(0.0, 1 - u * u))
    out = []
    for j in range(seg):
        a = 2 * math.pi * j / seg
        x = math.sin(a) * (EGG_R[0] * k + grow)
        z = math.cos(a) * (EGG_R[2] * k + grow) + EGG_AT[2] - back
        out.append(head_point((x, y, z)))
    return out


brow = 0.03
rings = [egg_ring(brow - 0.006, 0.021), egg_ring(brow + 0.032, 0.023)]
CUFF_OB = loft("beanie_cuff", rings, [CUFF], cap=False)
CUFF_OB.modifiers.new("knit", "SOLIDIFY").thickness = 0.009
tag(CUFF_OB, "head")
crown = []
for y, grow, back in ((brow + 0.026, 0.014, 0.0), (0.05, 0.019, 0.008), (0.065, 0.026, 0.02), (0.08, 0.031, 0.036),
                      (0.092, 0.03, 0.054), (0.102, 0.022, 0.072)):
    crown.append(egg_ring(y, grow, back))
top = head_point((0.0, 0.118, EGG_AT[2] - 0.09))
cap = loft("beanie", crown, [BEANIE], cap=False)
bm = bmesh.new()
bm.from_mesh(cap.data)
last = bm.verts[-SEG:]
tip = bm.verts.new(top)
for j in range(SEG):
    bm.faces.new((last[j], last[(j + 1) % SEG], tip))
bm.normal_update()
# The knit's ribs, running up the crown.
for v in bm.verts:
    rel = v.co - hc
    a = math.atan2(rel.dot(hx), rel.dot(hz))
    v.co += (rel.normalized()) * 0.0015 * math.cos(24 * a)
bm.to_mesh(cap.data)
bm.free()
tag(cap, "head")

# THE GOGGLES, BACKWARDS: the strap round the beanie at the brow with the
# frame and its amber mirror over the BACK of his head — the park's way of
# wearing them on a sunny day — the strap's buckle at his forehead.
gy = brow - 0.002
strap = egg_ring(gy, 0.027)
strap_hi = egg_ring(gy + 0.03, 0.029)
band = loft("goggle_strap", [strap, strap_hi], [STRAP], cap=False)
band.modifiers.new("strap", "SOLIDIFY").thickness = 0.003
tag(band, "head")
# The webbing's stripe across it.
stripe = loft("goggle_web", [egg_ring(gy + 0.011, 0.0302), egg_ring(gy + 0.019, 0.0306)], [WEBBING], cap=False)
tag(stripe, "head")
# The frame: a curved box over the back, wide as the head.
GOG = []
for j in range(13):
    a = math.pi + (j - 6) / 6 * 1.15
    GOG.append(a)


def back_pt(a, y, out):
    u = (y - EGG_AT[1]) / EGG_R[1]
    k = math.sqrt(max(0.0, 1 - u * u))
    return head_point((math.sin(a) * (EGG_R[0] * k + out), y, math.cos(a) * (EGG_R[2] * k + out) + EGG_AT[2]))


def shell(name, y0, y1, out, mats):
    verts, faces = [], []
    for j, a in enumerate(GOG):
        for y in (y0, y1):
            verts.append(back_pt(a, y, out))
    for j in range(len(GOG) - 1):
        faces.append((2 * j, 2 * j + 2, 2 * j + 3, 2 * j + 1))
    return mesh_obj(name, verts, faces, mats)


fr = shell("goggle_frame", gy - 0.014, gy + 0.044, 0.032, [FRAME_])
fr.modifiers.new("frame", "SOLIDIFY").thickness = 0.014
tag(fr, "head")
lens = shell("goggle_lens", gy - 0.006, gy + 0.036, 0.047, [LENS])
lens.modifiers.new("lens", "SOLIDIFY").thickness = 0.002
tag(lens, "head")

# ---------------------------------------------------------------- THE GLOVES
# Short leather PIPE GLOVES closed round the grip: a palm, four fingers
# round the shaft, a thumb over the top, a short cuff over the knit.
for i, s in enumerate("lr"):
    e, fx, fy, fz, fl = frame(f"forearm_{s}")
    wrist_t = ANSUR["forearm_length"] * MM / fl
    tag(cyl("glove_cuff", e + fy * (fl * (wrist_t - 0.08)), e + fy * (fl * (wrist_t + 0.01)), 0.044, GLOVE, r2=0.04),
        f"forearm_{s}")
    c, hx_, hy_, hz_, _ = frame(f"hand_{s}")
    out = hx_ if hx_.dot(shoulders[i] - neck) > 0 else -hx_
    turn = Matrix((out, hy_, hz_)).transposed().to_euler()
    tag(ellipsoid("palm", c - hy_ * 0.035 + out * 0.012, (0.03, 0.05, 0.047), GLOVE, rot=turn), f"hand_{s}")
    for k in range(4):
        along_g = hz_ * (0.028 - 0.019 * k)
        arc = [c + along_g + (hy_ * math.cos(t) + out * math.sin(t)) * 0.023
               for t in (math.radians(a) for a in range(-110, 181, 58 if GAME else 20))]
        tag(tube("finger", arc, 0.0098 - 0.0008 * k, PALM if k == 3 else GLOVE, smooth_n=0 if GAME else 2), f"hand_{s}")
    tag(tube("thumb", [c - hy_ * 0.03 - out * 0.018 + hz_ * 0.03, c - out * 0.02 + hz_ * 0.046,
                       c + hy_ * 0.02 - out * 0.012 + hz_ * 0.048], 0.011, GLOVE, smooth_n=0 if GAME else 2), f"hand_{s}")
    # THE FOOT IN THE BOOT'S LINER (the boot itself is the skis'): hidden in
    # the shell on his skis, his own when a crash takes him off them.
    o, fx_, fy_, fz_, _ = frame(f"boot_{s}")
    lean = 0.22

    def down(d):
        return o + fy_ * (0.014 - d * math.sin(lean)) - fz_ * (0.02 + d * math.cos(lean))

    axis = (fz_ * math.cos(lean) + fy_ * math.sin(lean)).normalized()
    ahead = (fy_ - axis * fy_.dot(axis)).normalized()
    tag(loft("liner", [[down(d) + fx_ * (r * math.cos(2 * math.pi * k / 16)) + ahead * (r * 1.08 * math.sin(2 * math.pi * k / 16))
                        for k in range(16)] for d, r in ((0.0, 0.046), (0.06, 0.049), (0.14, 0.051), (0.2, 0.05))],
             [LINER]), f"boot_{s}")
    sole = o - fz_ * 0.285 + fy_ * -0.02
    FOOT = [(-0.125, 0.03, 0.014, 0.06), (-0.1, 0.04, 0.008, 0.088), (-0.04, 0.043, 0.008, 0.1),
            (0.03, 0.044, 0.008, 0.085), (0.09, 0.045, 0.008, 0.066), (0.13, 0.037, 0.01, 0.05),
            (0.15, 0.02, 0.016, 0.034)]
    tag(loft("foot", [[sole + fy_ * u + fx_ * (w * math.cos(2 * math.pi * k / 16))
                       + fz_ * ((lo + hi) / 2 + (hi - lo) / 2 * math.sin(2 * math.pi * k / 16)) for k in range(16)]
                      for u, w, lo, hi in FOOT], [LINER]), f"boot_{s}")


# ---------------------------------------------------------------- the STAMP
def stamp():
    """Every part's tag and looseness written as its UV (after every
    modifier is applied, so the stamp is on the vertices exported)."""
    obs = [o for o in COL.objects if o.type in ("MESH", "CURVE")]
    curves = [o for o in obs if o.type == "CURVE"]
    if curves:
        lib._select_only(curves)
        bpy.ops.object.convert(target="MESH")
    obs = [o for o in COL.objects if o.type == "MESH"]
    lib._select_only(obs)
    bpy.ops.object.convert(target="MESH")
    for o in obs:
        t, loose = TAGGED.get(o.name, (TAGS["cloth"], 0.0))
        for layer in list(o.data.uv_layers):
            o.data.uv_layers.remove(layer)
        layer = o.data.uv_layers.new(name="UVMap")
        for loop in o.data.loops:
            co = o.data.vertices[loop.vertex_index].co
            u = loose(co) if callable(loose) else loose
            layer.data[loop.index].uv = (u, (t + 0.5) / 32)


stamp()
floor = min(f.z for f in feet) - 0.06
finish("park", OUT, SAMPLES, centre=(0, hips.y + 0.1, floor + 0.85), size=2.6, floor=floor,
       extras={"frame": "body"}, lods=())

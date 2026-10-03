# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE SKIER MODELLED IN BLENDER off the game's own data: his body
# (`BODY`), the pose he is bound in and every bone's frame in it
# (`skier-rig.ts`'s `STANDING` and `skierBones`), a start-line slot's kit
# (`SKI_STYLES`), the head in its helmet as the game's own triangles
# (`helmet-shape.ts`'s `helmetParts`), and every clip
# sampled off the game's own `skierPose` — handed in as one JSON file by
# `scripts/blender.mjs --kind=skier`, the driver and the only way this runs.
#
# The frame: the pair's body frame (x right, y up, z forward, the origin
# at the centre of gravity of skier and skis) laid as Blender's (-x, z, y)
# — a turn, not a mirror — so he faces +y as a modelled pair does, and the
# lab's one half turn about y sets both in the game's frame. His sides are
# the ENGINE's (`_l` is the body frame's x negative, the pose's index 0).
#
# He is one SUIT that bends — a man of the survey's measure (ANSUR II,
# below) in a racer's kit, lofted a piece a bone and remeshed into one
# skin, weighted across each joint between the two bones that meet there —
# and what does not bend rides one bone wholly: the helmet (the head), the
# pants' gaiter over the boot's cuff (the shin), the gloves (the forearm).
# THE BOOTS ARE THE SKIS' (`skis.py`, clamped in the bindings): the suit
# ends at the cuff, as the game's own does (`skier-figure.ts`), and his FEET
# in the boots' padded liners ride the boot bones — hidden in the shells
# while he stands on his skis, and his own when he is thrown off them. The bones
# are the game's spans (`skierBones`), so the game's pose drives him bone
# for bone, and the clips are that pose played.

import json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
STYLE, POSE, FRAMES, HELM = DATA["style"], DATA["rest"]["pose"], DATA["rest"]["bones"], DATA["helmet"]


def B(p):
    """A point or direction of the body frame, in Blender's."""
    return Vector((-p["x"], p["z"], p["y"]))


def colour(hexa):
    """A kit's sRGB colour as linear."""
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 for c in ((hexa >> 16) & 255, (hexa >> 8) & 255, hexa & 255))


# ---------------------------------------------------------------- materials
JACKET = mat("jacket", colour(STYLE["jacket"]), rough=0.62)
ACCENT = mat("accent", colour(STYLE.get("accent", STYLE["jacket"])), rough=0.6)
PANTS = mat("pants", colour(STYLE["pants"]), rough=0.8)
GLOVE = mat("glove", colour(0x17191D), rough=0.7)
HELMET = mat("helmet", colour(STYLE["helmet"]), rough=0.25, coat=1.0)
PEAK = mat("peak", colour(STYLE.get("peak", STYLE["helmet"])), rough=0.3, coat=1.0)
LENS = mat("lens", colour(STYLE["visor"]), metal=0.7, rough=0.08)
STRAP = mat("strap", colour(0x101114), rough=0.7)
LINER = mat("liner", colour(0x2b2e34), rough=0.85)


# ---------------------------------------------------------------- the RIG
def frame(name):
    """A bone's frame — or the TRUNK's ("spine"): the chord from the hips
    to the neck the two spans of the back are bent about, facing the
    chest. The suit is lofted and coloured along it and weighted across
    the pelvis and the chest by how far up it a point lies."""
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

# THE HALF BONES (`skierBones`): the joint each sits on, and the two bones
# it is turned half way between.
HALF = {}
for s in "lr":
    HALF |= {(f"spine", f"thigh_{s}"): f"hip_{s}", (f"thigh_{s}", f"shin_{s}"): f"knee_{s}",
             ("spine", f"upperarm_{s}"): f"shoulder_{s}", (f"upperarm_{s}", f"forearm_{s}"): f"elbow_{s}"}

# The segments a point of the suit is weighed against: every bone's, with
# the trunk's two spans as the one chord ("spine") they are split along.
SEGMENTS = {n: (frame(n)[0], frame(n)[0] + frame(n)[2] * frame(n)[4]) for n in FRAMES
            if n not in ("pelvis", "chest") and n not in HALF.values()}
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


# How wide the blend across a joint is, m: what 1/e of the share takes. A
# hinge (a knee, an elbow) is blended tight, or its cloth shrinks to a
# candy wrapper as it folds; a BALL joint (a hip, a shoulder — the trunk
# against a thigh or an arm) is blended wide, so the seat, the groin and
# the back between the blades spread a deep fold — the tuck's hips past a
# right angle, its arms driven ahead — over a hand's width rather than
# tearing along a seam.
BLEND = {"hinge": 0.04, "ball": 0.075}


def blend(a, b):
    trunk = "spine" in (a, b)
    limb = any(n.startswith(("thigh", "upperarm")) for n in (a, b))
    return BLEND["ball"] if trunk and limb else BLEND["hinge"]


def suit_weights(co):
    """Across a joint, shared between the bones that meet there by how much
    nearer each is (`BLEND`)."""
    b0 = nearest(co, [n for n in SEGMENTS if not n.startswith("boot")])
    d0 = along(co, SEGMENTS[b0])[1]
    w = {n: math.exp(-(along(co, SEGMENTS[n])[1] - d0) / blend(b0, n)) for n in [b0] + NEAR[b0]}
    top = sorted(w.items(), key=lambda kv: -kv[1])[:3]
    total = sum(v for _, v in top)
    out = {n: v / total for n, v in top}
    # Across a joint with a HALF BONE, the pair's share is laid over three
    # (the quadratic Bernstein weights of how far toward the far bone the
    # point is): the near bone's falls away as the half bone's peaks on the
    # seam and the far bone's rises — smooth, and summing to the pair's.
    for (a, b), h in HALF.items():
        if a in out and b in out:
            wa, wb = out.pop(a), out.pop(b)
            c = wb / (wa + wb)
            out[a] = (wa + wb) * (1 - c) ** 2
            out[b] = (wa + wb) * c * c
            out[h] = out.get(h, 0.0) + (wa + wb) * 2 * c * (1 - c)
    # The trunk's share split between the pelvis and the chest by how far
    # up the chord the point lies — a long blend across the small of the
    # back, so the jacket bends there as a back does rather than creasing.
    if "spine" in out:
        t = along(co, SEGMENTS["spine"])[0]
        c = max(0.0, min(1.0, (t - 0.25) / 0.45))
        c = c * c * (3 - 2 * c)
        share = out.pop("spine")
        out["pelvis"] = out.get("pelvis", 0.0) + share * (1 - c)
        out["chest"] = out.get("chest", 0.0) + share * c
    # A glTF vertex carries four influences: the four largest, summing to one.
    top = sorted(out.items(), key=lambda kv: -kv[1])[:4]
    total = sum(v for _, v in top)
    return {n: v / total for n, v in top}


# ---------------------------------------------------------------- the SUIT
# THE BODY UNDER IT is a man of the ANSUR II survey (US Army, 2012: 4,082
# men, the means below, mm): the game gives his bones (`BODY`), the survey
# gives the flesh round them — every breadth, depth and circumference, and
# where on the trunk each level falls (its height between the hip joint,
# `trochanterion`, and the base of the neck, `cervicale`, laid onto the
# game's spine). A circumference is a round section's; the trunk's are
# breadth by depth, a squared ellipse, the back flatter than the chest and
# the seat bulging behind.
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
    """A survey height as a share of the game's spine, hips 0 to neck 1."""
    return (h - ANSUR["trochanterion"]) / (ANSUR["cervicale"] - ANSUR["trochanterion"])


def r_of(circ):
    return circ * MM / (2 * math.pi)


# THE KIT OVER HIM, after what a skier on the piste wears: a fitted,
# lightly insulated shell jacket, quilted, hanging to just under the seat
# with a stood-up collar, a band across the chest and a stripe down the
# outside of each sleeve in the kit's second colour; softshell pants cut
# close through the thigh and knee and flared over the boot's cuff; gloves
# closed round the pole grips; the helmet, and goggles on the face under
# it. What the kit ADDS over the body, m a side:
EASE = {"chest_front": 0.03, "chest_back": 0.03, "trunk_side": 0.024, "bloused": 0.032,
        "sleeve": 0.022, "pants": 0.022, "cap": 0.008}

P = POSE
hips, neck, head_c = B(P["hips"]), B(P["neck"]), B(P["head"])
knees, feet = [B(k) for k in P["knees"]], [B(f) for f in P["feet"]]
shoulders, elbows, hands = [B(k) for k in P["shoulders"]], [B(k) for k in P["elbows"]], [B(k) for k in P["hands"]]
SEG = 16 if GAME else 28


def lofted(name, bone_name, sections, n=2.4):
    """A garment piece along a bone: rings in its frame at `t` (a share of
    its length), each `(t, half across, ahead, behind)` — ahead is the way
    the bone's +z faces (a knee's front, the chest, an elbow's point).
    Capped, always: the remesh fills VOLUMES, and drops an open tube."""
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
    return loft(name, rings, [JACKET])


rides("chest")
pieces = []
# The trunk: the survey's levels, each the body's half breadth, depth
# ahead of and behind the spine's line, and what the kit adds there.
bh = ANSUR["hip_breadth"] / 2 * MM
bd = ANSUR["buttock_depth"] * MM
wb, wd = ANSUR["waist_breadth"] / 2 * MM, ANSUR["waist_depth"] * MM
cb, cd = ANSUR["chest_breadth"] / 2 * MM, ANSUR["chest_depth"] * MM
E = EASE
TRUNK = [
    (level(ANSUR["crotch"]) - 0.04, bh * 0.8 + 0.025, bd * 0.3 + 0.025, bd * 0.45 + 0.025),
    (level(ANSUR["crotch"]) + 0.05, bh + 0.025, bd * 0.4 + 0.025, bd * 0.52 + 0.025),
    (0.08, bh + E["bloused"], bd * 0.42 + E["bloused"], bd * 0.55 + E["bloused"]),
    (level(ANSUR["waist_h"]), wb + E["bloused"], wd * 0.55 + E["bloused"], wd * 0.45 + E["bloused"]),
    (level(ANSUR["tenth_rib_h"]), wb * 0.97 + E["trunk_side"], wd * 0.55 + E["chest_front"],
     wd * 0.46 + E["chest_back"]),
    (0.52, cb * 1.05 + E["trunk_side"], cd * 0.51 + E["chest_front"], cd * 0.48 + E["chest_back"]),
    (level(ANSUR["chest_h"]), cb * 1.12 + E["trunk_side"], cd * 0.5 + E["chest_front"],
     cd * 0.5 + E["chest_back"]),
    (level(ANSUR["axilla_h"]), cb * 1.2 + E["trunk_side"], cd * 0.47 + E["chest_front"],
     cd * 0.5 + E["chest_back"]),
    (level(ANSUR["acromion_h"]) - 0.05, ANSUR["biacromial"] / 2 * MM * 0.9, cd * 0.4 + E["chest_front"],
     cd * 0.44 + E["chest_back"]),
    (0.95, r_of(ANSUR["neck_base"]) * 1.5 + 0.02, 0.1, 0.1),
    (1.0, r_of(ANSUR["neck_base"]) + 0.03, 0.09, 0.09),
]
pieces.append(lofted("trunk", "spine", TRUNK, n=2.7))
# The collar, stood up round the helmet's rim.
head_up = frame("head")[2]
collar = [neck.lerp(head_c, u) for u in (0.0, 0.18, 0.34)]
pieces.append(loft("collar", [[c + frame("spine")[1] * (0.1 * math.cos(2 * math.pi * k / SEG))
                               + frame("spine")[3] * (0.095 * math.sin(2 * math.pi * k / SEG)) for k in range(SEG)]
                              for c in collar], [JACKET]))
for i, s in enumerate("lr"):
    # The shoulder: the deltoid (the survey's bideltoid breadth) under the
    # chest protector's cap — the broad square shoulder of a racer's kit.
    reach = ANSUR["bideltoid"] / 2 * MM - ANSUR["biacromial"] / 2 * MM
    sx = frame(f"upperarm_{s}")
    out = (shoulders[i] - neck.lerp(hips, 0.12)).normalized()
    pieces.append(ellipsoid("shoulder", shoulders[i] + frame("spine")[2] * 0.01 + out * 0.005,
                            (reach + E["cap"] + 0.01, reach + E["cap"] + 0.014, reach + E["cap"] + 0.012), JACKET))
    # The arm: the survey's biceps, forearm and wrist, the sleeve over them
    # bunched toward the cuff under the gauntlet.
    b = r_of(ANSUR["biceps"]) * 0.95
    pieces.append(lofted("sleeve", f"upperarm_{s}", [
        (-0.05, b * 1.25 + E["sleeve"], b * 1.2 + E["sleeve"], b * 1.2 + E["sleeve"]),
        (0.35, b + E["sleeve"], b + E["sleeve"], b * 1.05 + E["sleeve"]),
        (0.7, b * 0.92 + E["sleeve"], b * 0.9 + E["sleeve"], b * 0.95 + E["sleeve"]),
        (1.05, b * 0.85 + E["sleeve"], b * 0.9 + E["sleeve"], b * 0.8 + E["sleeve"])]))
    f, w = r_of(ANSUR["forearm"]) * 0.95, r_of(ANSUR["wrist"])
    wrist_t = ANSUR["forearm_length"] * MM / frame(f"forearm_{s}")[4]
    pieces.append(lofted("sleeve", f"forearm_{s}", [
        (-0.08, f * 1.05 + E["sleeve"], f + E["sleeve"], f * 1.1 + E["sleeve"]),
        (0.3, f + E["sleeve"], f + E["sleeve"], f + E["sleeve"]),
        (wrist_t - 0.2, (f + w) / 2 + E["sleeve"] * 1.2, (f + w) / 2 + E["sleeve"], (f + w) / 2 + E["sleeve"]),
        (wrist_t - 0.08, w + E["sleeve"], w + E["sleeve"], w + E["sleeve"])]))
    pieces.append(ellipsoid("elbow", elbows[i], (b + E["sleeve"],) * 3, JACKET))
    # The leg: the survey's thigh and lower thigh, calf and ankle, the
    # pants baggy over them and flared over the boot's top.
    th, lt = r_of(ANSUR["thigh"]), r_of(ANSUR["lower_thigh"])
    pieces.append(lofted("pants", f"thigh_{s}", [
        (-0.12, th * 1.05 + E["pants"], th + E["pants"], th * 1.1 + E["pants"]),
        (0.2, th + E["pants"], th + E["pants"], th + E["pants"]),
        (0.6, (th + lt) / 2 + E["pants"], (th + lt) / 2 + E["pants"], (th + lt) / 2 + E["pants"]),
        (0.95, lt + E["pants"], lt + E["pants"], lt + E["pants"])]))
    ca, an = r_of(ANSUR["calf"]), r_of(ANSUR["ankle"])
    pieces.append(lofted("pants", f"shin_{s}", [
        (-0.05, lt + E["pants"], lt + E["pants"], lt + E["pants"]),
        (0.3, ca * 0.9 + E["pants"], ca * 0.8 + E["pants"], ca * 1.15 + E["pants"]),
        (0.5, ca * 0.85 + E["pants"] + 0.012, ca * 0.8 + E["pants"] + 0.012, ca + E["pants"] + 0.012),
        (0.6, ca * 0.9 + E["pants"] + 0.02, ca * 0.9 + E["pants"] + 0.02, ca + E["pants"] + 0.02)]))
    pieces.append(ellipsoid("knee", knees[i], (lt + E["pants"] + 0.006,) * 3, PANTS))

# One surface: the pieces joined and REMESHED into a single skin, so a
# shoulder flows into its sleeve and a seat into its thighs, then eased.
bpy.context.view_layer.objects.active = pieces[0]
for o in bpy.context.view_layer.objects:
    o.select_set(o in pieces)
bpy.ops.object.convert(target="MESH")
bpy.ops.object.join()
suit = bpy.context.view_layer.objects.active
suit.name = suit.data.name = "suit"
remesh = suit.modifiers.new("one", "REMESH")
remesh.mode, remesh.voxel_size = "VOXEL", 0.016 if GAME else 0.006
smooth = suit.modifiers.new("ease", "SMOOTH")
smooth.factor, smooth.iterations = 0.6, 2 if GAME else 4
bpy.ops.object.convert(target="MESH")
if GAME:
    thin = suit.modifiers.new("budget", "DECIMATE")
    thin.ratio = 3200 / max(1, len(suit.data.polygons) * 2)
    bpy.ops.object.convert(target="MESH")
suit.data.materials.clear()
for m in (JACKET, ACCENT, PANTS):
    suit.data.materials.append(m)

# THE CLOTH'S FOLDS, where a padded suit gathers as a joint bends: across
# the crook of each elbow and the back of each knee, over the fold of the
# hip, the sleeve bunched above the gauntlet, the pants over the boot, the
# jacket gathered over the belly. Each is ridges across its bone — `amp`
# m, one every `pitch` m — pressed along the surface's own normal, on the
# side `face` (along the bone's +z, −z, or all round with 0).
FOLDS = [  # bone kind, t from, t to, face, amp, pitch
    ("upperarm", 0.7, 1.0, -1, 0.008, 0.045), ("forearm", 0.0, 0.25, -1, 0.008, 0.045),
    ("forearm", 0.3, 0.62, 0, 0.004, 0.03),
    ("thigh", 0.75, 1.0, -1, 0.009, 0.05), ("shin", 0.0, 0.2, -1, 0.009, 0.05),
    ("thigh", 0.0, 0.18, 1, 0.006, 0.05), ("shin", 0.42, 0.62, 0, 0.005, 0.035),
    ("spine", 0.1, 0.4, 1, 0.005, 0.05),
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
        v.co += v.normal * (amp * side * fade * math.sin(2 * math.pi * t * bl / pitch))
bm.to_mesh(suit.data)
bm.free()

# Where one colour meets the next is a PLANE, and the suit is cut along
# each before it is coloured, so every colour stops on a clean line rather
# than on the stair of the faces it was laid in: the jacket's hem square
# to the spine over the hips, the yoke under the collar, the cuffs square
# to each forearm.
UP = (neck - hips).normalized()
# The hem hangs to just under the seat; the yoke is the collar's.
HEM = (hips - UP * 0.1, UP)
YOKE = (neck - UP * 0.07, UP)
# THE ZIP, down the middle of the jacket's front in the second colour:
# between two planes either side of the spine's own middle.
SX, CHEST = frame("spine")[1], frame("spine")[3]
ZIP = [(neck + SX * 0.009, SX), (neck - SX * 0.009, -SX)]
# THE SLEEVE STRIPES: down the outside of each arm, the far side of a
# plane along the bone a few centimetres out from it.
def outward(s, part):
    head, x, y, z, length = frame(f"{part}_{s}")
    out = x if x.dot(shoulders["lr".index(s)] - neck) > 0 else -x
    return (head + out * 0.06, out)
STRIPES = {(s, part): outward(s, part) for s in "lr" for part in ("upperarm", "forearm")}
CUFFS = [(frame(f"forearm_{s}")[0] + frame(f"forearm_{s}")[2] * frame(f"forearm_{s}")[4] * 0.8,
          frame(f"forearm_{s}")[2]) for s in "lr"]
# Where the jacket's front meets each thigh: square to the thigh a quarter
# down it, so a lap is the pants' on a clean line and not wherever the
# trunk's bone gives way to the thigh's.
LAPS = [(frame(f"thigh_{s}")[0] + frame(f"thigh_{s}")[2] * frame(f"thigh_{s}")[4] * 0.22,
         frame(f"thigh_{s}")[2]) for s in "lr"]
bm = bmesh.new()
bm.from_mesh(suit.data)
for co, no in [HEM, YOKE] + CUFFS + LAPS + ZIP + list(STRIPES.values()):
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)
bm.to_mesh(suit.data)
bm.free()


def above(co, plane):
    return (co - plane[0]).dot(plane[1]) > 0


def cloth_of(co):
    """What the suit is where: the pants below the jacket's hem, the
    jacket's yoke and collar in the kit's second colour, and its cuffs."""
    b = nearest(co)
    # A thigh is the pants' past its lap line whatever plane it is over:
    # crouched, his thighs lie above the hem's.
    if b.startswith(("shin", "boot")) or not above(co, HEM):
        return 2
    if b.startswith("thigh") and above(co, LAPS["lr".index(b[-1])]):
        return 2
    if b in ("head", "spine"):
        zipped = not above(co, ZIP[0]) and not above(co, ZIP[1]) and (co - neck).dot(CHEST) > 0
        return 1 if above(co, YOKE) or zipped else 0
    if b.startswith("upperarm"):
        return 1 if above(co, YOKE) or above(co, STRIPES[(b[-1], "upperarm")]) else 0
    if b.startswith("forearm"):
        cuff = above(co, CUFFS["lr".index(b[-1])])
        return 1 if cuff or above(co, STRIPES[(b[-1], "forearm")]) else 0
    return 0


suit.data.polygons.foreach_set("material_index", [cloth_of(p.center) for p in suit.data.polygons])
for p in suit.data.polygons:
    p.use_smooth = True
weights(suit, suit_weights)

# ---------------------------------------------------------------- the HELMET
# THE HEAD IN ITS HELMET is the game's own geometry (`helmet-shape.ts`'s
# `helmetParts`): the shell, its stripe and rolled rim, the liner, the
# vents, the goggles (frame, foam, the lens and its unwrap), the strap and
# its clip, his face, balaclava and chin strap — every triangle and normal
# handed in, a material a part, laid in the head's frame (z ahead, y up)
# and riding the head bone. The game quality takes the game's own cut
# (the code's figure draws the same), a still the finer one.
rides("head")
hc, hx, hy, hz, _ = frame("head")
SKIN = mat("skin", colour(STYLE.get("skin", 0xC68863)), rough=0.6)
PAINT = {"shell": HELMET, "stripe": PEAK, "frame": PEAK, "band": PEAK, "trim": STRAP, "strap": STRAP,
         "foam": STRAP, "liner": LINER, "knit": LINER, "lens": LENS, "skin": SKIN}


def head_point(p):
    return hc + hx * p[0] + hy * p[1] + hz * p[2]


# THE LENS'S MIRROR: a racer's goggle is a mirrored lens graded from bright
# at its brow to darker below, a band of sheen across its upper third —
# a grey ramp the kit's lens colour (`dressOf`'s "lens") is laid over.
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
lens_tex.interpolation = "Linear"
lens_nt.links.new(lens_tex.outputs["Color"], lens_nt.nodes.get("Principled BSDF").inputs["Base Color"])

for part in HELM["game" if GAME else "fine"]:
    P, N, I = part["position"], part["normal"], part["index"]
    verts = [head_point(P[k:k + 3]) for k in range(0, len(P), 3)]
    faces = [I[k:k + 3] for k in range(0, len(I), 3)]
    ob = mesh_obj(f"helmet_{part['material']}", verts, faces, [PAINT[part["material"]]], recalc=False)
    # The game's normals, turned into Blender's frame: the shell's are the
    # surface's own, so the stripe's cut and the rim's turn shade as one.
    normals = [tuple(hx * N[k] + hy * N[k + 1] + hz * N[k + 2]) for k in range(0, len(N), 3)]
    ob.data.normals_split_custom_set_from_vertices(normals)
    if "uv" in part:
        layer = ob.data.uv_layers.new(name="UVMap")
        uv = part["uv"]
        for loop in ob.data.loops:
            k = loop.vertex_index
            layer.data[loop.index].uv = (uv[k * 2], uv[k * 2 + 1])


# ---------------------------------------------------------------- GAITERS and GLOVES
# The gaiter: the pants' padded shaft down over the boot's cuff (the boot
# itself is the ski's), riding the shin. The gloves: a fist round the pole's
# grip and a cuff over the sleeve.
for i, s in enumerate("lr"):
    f, bx, by, bz, _ = frame(f"boot_{s}")
    rides(f"shin_{s}")
    up_shin = (knees[i] - feet[i]).normalized()
    sh = frame(f"shin_{s}")
    shaft = [(0.0, 0.066, 0.078, 0.074), (0.1, 0.07, 0.078, 0.074), (0.18, 0.074, 0.08, 0.076),
             (0.24, 0.07, 0.074, 0.07)]
    loft("gaiter", [[f + bz * -0.03 + up_shin * u + sh[1] * (w * math.cos(a))
                     + sh[3] * ((fr if math.sin(a) > 0 else bk) * math.sin(a))
                     for a in (2 * math.pi * k / 16 for k in range(16))] for u, w, fr, bk in shaft], [PANTS])
    # THE FOOT IN THE BOOT'S LINER, on the boot bone (its head 2 cm over
    # the cuff's top, +y along the sole, +z up out of it): the liner's shaft
    # down the cuff's own forward lean to the ankle, and the foot on the
    # sole — inside the shell (`skis.py`: 0.1 m wide, 0.32 long, the cuff
    # 0.058–0.066 m round) while he is on his skis, so nothing of it shows
    # until a crash takes him off them.
    rides(f"boot_{s}")
    o, fx_, fy_, fz_, _ = frame(f"boot_{s}")
    lean = 0.22

    def down(d):
        """A point `d` m down the cuff's axis from its top."""
        return o + fy_ * (0.014 - d * math.sin(lean)) - fz_ * (0.02 + d * math.cos(lean))

    axis = (fz_ * math.cos(lean) + fy_ * math.sin(lean)).normalized()
    ahead = (fy_ - axis * fy_.dot(axis)).normalized()
    loft("liner", [[down(d) + fx_ * (r * math.cos(2 * math.pi * k / 16)) + ahead * (r * 1.08 * math.sin(2 * math.pi * k / 16))
                    for k in range(16)] for d, r in ((0.0, 0.046), (0.06, 0.049), (0.14, 0.051), (0.2, 0.05))],
         [LINER])
    sole = o - fz_ * 0.285 + fy_ * -0.02
    FOOT = [(-0.125, 0.03, 0.014, 0.06), (-0.1, 0.04, 0.008, 0.088), (-0.04, 0.043, 0.008, 0.1),
            (0.03, 0.044, 0.008, 0.085), (0.09, 0.045, 0.008, 0.066), (0.13, 0.037, 0.01, 0.05),
            (0.15, 0.02, 0.016, 0.034)]
    loft("foot", [[sole + fy_ * u + fx_ * (w * math.cos(2 * math.pi * k / 16))
                   + fz_ * ((lo + hi) / 2 + (hi - lo) / 2 * math.sin(2 * math.pi * k / 16)) for k in range(16)]
                  for u, w, lo, hi in FOOT], [LINER])
    rides(f"forearm_{s}")
    e, fx, fy, fz, fl = frame(f"forearm_{s}")
    wrist_t = ANSUR["forearm_length"] * MM / fl
    cyl("gauntlet", e + fy * (fl * (wrist_t - 0.2)), e + fy * (fl * (wrist_t - 0.02)), 0.058, GLOVE, r2=0.046)
    # THE HAND, CLOSED ROUND THE GRIP, on its own bone (`skierBones`'s
    # hand: +z up the pole's shaft, +y the forearm's line squared to it):
    # the shaft runs through the fist, the back of the hand faces out,
    # four fingers wrap the shaft from the palm round the front, stacked
    # down it a finger's width apart, and the thumb lies over the top.
    rides(f"hand_{s}")
    c, hx_, hy_, hz_, _ = frame(f"hand_{s}")
    out = hx_ if hx_.dot(shoulders[i] - neck) > 0 else -hx_
    turn = Matrix((out, hy_, hz_)).transposed().to_euler()
    ellipsoid("palm", c - hy_ * 0.035 + out * 0.012, (0.03, 0.05, 0.047), GLOVE, rot=turn)
    for k in range(4):
        along_g = hz_ * (0.028 - 0.019 * k)
        arc = [c + along_g + (hy_ * math.cos(t) + out * math.sin(t)) * 0.023
               for t in (math.radians(a) for a in range(-110, 181, 58 if GAME else 20))]
        tube("finger", arc, 0.0095 - 0.0008 * k, GLOVE, smooth_n=0 if GAME else 2)
    tube("thumb", [c - hy_ * 0.03 - out * 0.018 + hz_ * 0.03, c - out * 0.02 + hz_ * 0.046,
                   c + hy_ * 0.02 - out * 0.012 + hz_ * 0.048], 0.011, GLOVE, smooth_n=0 if GAME else 2)


# ---------------------------------------------------------------- the CLOTH
# THE KIT'S FABRIC, as a shader first: a HEIGHT for every point of the suit
# in its own frame — the jacket QUILTED in channels round the body a hand
# apart, a ripstop's fine grid over every garment, the softshell pants
# mottled — pressed into the surface as a bump, and darkening the cloth a
# little in its hollows. The studio renders it as it stands. The game's
# build BAKES it onto the suit's own unwrap: a DETAIL map (the fabric's
# shade times the ambient occlusion — the kit's colour is the game's to lay
# over it, `dressOf`, so one model dresses every slot) and a NORMAL map, and
# the suit is exported with those in place of the shader.
TEX = 1024 if GAME else 0
CLOTH = {"jacket": ("quilt", 0.8), "accent": ("smooth", 0.35), "pants": ("soft", 0.45)}


def cloth_height(nt, kind):
    """The node giving the fabric's height at a point, 0..1."""
    n = nt.nodes
    co = n.new("ShaderNodeTexCoord")

    def wave(axis, scale, profile="SIN"):
        w = n.new("ShaderNodeTexWave")
        w.wave_type, w.bands_direction, w.wave_profile = "BANDS", axis, profile
        w.inputs["Scale"].default_value = scale
        nt.links.new(co.outputs["Object"], w.inputs["Vector"])
        return w.outputs["Fac"]

    def op(kind, a, b):
        m = n.new("ShaderNodeMath")
        m.operation = kind
        for k, v in enumerate((a, b)):
            if isinstance(v, float):
                m.inputs[k].default_value = v
            else:
                nt.links.new(v, m.inputs[k])
        return m.outputs[0]

    # RIPSTOP: a fine square grid, 8 mm, in the weave.
    grid = op("MINIMUM", wave("X", 39.0), wave("Y", 39.0))
    grid = op("POWER", grid, 0.3)
    if kind == "quilt":
        # CHANNELS round the body (Blender's z is his up), 8.5 cm apart:
        # full between the stitch lines, pinched at them.
        chan = op("POWER", wave("Z", 3.7), 0.35)
        return op("ADD", op("MULTIPLY", chan, 0.8), op("MULTIPLY", grid, 0.2))
    if kind == "soft":
        noise = n.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 60.0
        nt.links.new(co.outputs["Object"], noise.inputs["Vector"])
        return op("ADD", op("MULTIPLY", noise.outputs["Fac"], 0.6), op("MULTIPLY", grid, 0.3))
    return op("ADD", op("MULTIPLY", grid, 0.5), 0.3)


def cloth_shader(m, colour_rgb, image_detail=None, image_normal=None):
    """Rebuild a garment's shader: the kit's colour over the fabric, and its
    bump — procedurally, or off the baked maps."""
    nt = m.node_tree
    p = nt.nodes.get("Principled BSDF")
    kind, strength = CLOTH[m.name]
    tint = nt.nodes.new("ShaderNodeMix")
    tint.data_type, tint.blend_type = "RGBA", "MULTIPLY"
    tint.inputs["Factor"].default_value = 1.0
    tint.inputs[7].default_value = (*colour_rgb, 1.0)
    if image_detail is None:
        h = cloth_height(nt, kind)
        shade = nt.nodes.new("ShaderNodeMapRange")
        shade.inputs["To Min"].default_value = 0.78
        nt.links.new(h, shade.inputs["Value"])
        nt.links.new(shade.outputs["Result"], tint.inputs[6])
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = strength
        bump.inputs["Distance"].default_value = 0.004
        nt.links.new(h, bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    else:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = image_detail
        nt.links.new(tex.outputs["Color"], tint.inputs[6])
        nmap = nt.nodes.new("ShaderNodeTexImage")
        nmap.image = image_normal
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(nmap.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], p.inputs["Normal"])
    nt.links.new(tint.outputs[2], p.inputs["Base Color"])


KIT_RGB = {"jacket": colour(STYLE["jacket"]), "accent": colour(STYLE.get("accent", STYLE["jacket"])),
           "pants": colour(STYLE["pants"])}


def _bake(kind, image, **kw):
    """Bake into `image` through every garment's material."""
    for m in (JACKET, ACCENT, PANTS):
        t = m.node_tree.nodes.new("ShaderNodeTexImage")
        t.image = image
        for nd in m.node_tree.nodes:
            nd.select = False
        t.select = True
        m.node_tree.nodes.active = t
    bpy.ops.object.bake(type=kind, margin=8, **kw)


def _emitting(colour_of):
    """Every garment's shader swapped for an emission of `colour_of(m, nt)`
    (a node output)."""
    for m in (JACKET, ACCENT, PANTS):
        nt = m.node_tree
        for nd in list(nt.nodes):
            if nd.type != "OUTPUT_MATERIAL":
                nt.nodes.remove(nd)
        em = nt.nodes.new("ShaderNodeEmission")
        nt.links.new(colour_of(m, nt), em.inputs["Color"])
        nt.links.new(em.outputs["Emission"], nt.nodes.get("Material Output").inputs["Surface"])


def _pixels(image):
    import numpy as np
    buf = np.empty(TEX * TEX * 4, dtype=np.float32)
    image.pixels.foreach_get(buf)
    return buf.reshape(TEX, TEX, 4)


def garment_height(P, N, G):
    """THE KIT'S CONSTRUCTION, as a height (0..1) and a shade (0..1) at
    every texel, off where on him it lies (`P`, the suit's own frame — the
    pose he is bound in), which way it faces (`N`) and which garment it is
    (`G`: 0 the jacket, 1 its second colour, 2 the pants):

      * the WEAVE: a ripstop's 8 mm grid over everything; the jacket lightly
        quilted in channels a hand apart round the trunk; the softshell
        pants mottled;
      * the SEAMS, each a welt between two lines of stitching: down the
        jacket's sides and the pants' outsides; the knees' articulation
        darts above and below each knee on the front of the leg;
      * the ZIPS, a dark tape with its teeth: up the jacket's front, a
        chest pocket slanting over his left breast, a hand pocket over each
        hip;
      * the HEM, an elastic band ribbed at the foot of the jacket.

    Laid out in the body's own terms — across (`SX`), up the trunk (`UP`),
    ahead (`CHEST`), and where each knee is — so a seam stays on his side
    and a zip on his chest whatever the unwrap did to them."""
    import numpy as np
    S = np.ones(P.shape[:2], dtype=np.float32)
    H = np.full(P.shape[:2], 0.5, dtype=np.float32)
    v3 = lambda v: np.array([v.x, v.y, v.z], dtype=np.float32)
    up, across, ahead = v3(UP), v3(SX), v3(CHEST)
    h0 = v3(hips)
    spine = (neck - hips).length
    rel = P - h0
    lvl = rel @ up / spine          # 0 at the hips, 1 at the neck
    side = rel @ across             # m to his right (SX is the body's x)
    fwd = rel @ ahead
    nf, ns = N @ ahead, N @ across
    jacket = G < 2
    pants = G == 2

    def ridge(d, w):
        return np.exp(-((d / w) ** 2))

    def seam(d, along, live):
        """A welt on the line `d` = 0, stitched either side every 4 mm."""
        welt = 0.35 * ridge(d, 0.004)
        stitch = -0.28 * (ridge(np.abs(d) - 0.0065, 0.0012)) * (0.5 + 0.5 * np.cos(2 * np.pi * along / 0.004))
        return np.where(live, welt + stitch, 0.0)

    def zip_(d, along, live, half=0.006):
        """A zip on `d` = 0: a dark tape `half` m a side, its teeth across."""
        on = live & (np.abs(d) < half)
        teeth = 0.25 + 0.2 * (np.cos(2 * np.pi * along / 0.0035) > 0)
        return on, np.where(on, teeth * ridge(d, half * 0.9), 0.0)

    # The WEAVE.
    grid = np.minimum(np.abs(np.sin(np.pi * P[..., 0] / 0.008)), np.abs(np.sin(np.pi * P[..., 2] / 0.008))) ** 0.3
    H += 0.06 * (grid - 0.5)
    quilt = np.abs(np.sin(np.pi * (lvl * spine) / 0.085)) ** 0.35
    H += np.where(jacket & (lvl > -0.05), 0.22 * (quilt - 0.6), 0.0)
    # The softshell's mottle: value noise on a 2 cm lattice.
    rng = np.random.default_rng(7)
    lat = rng.random((64, 64, 64), dtype=np.float32)
    q = P / 0.02
    i0 = np.floor(q).astype(np.int64)
    f = q - i0
    f = f * f * (3 - 2 * f)
    def L(dx, dy, dz):
        return lat[(i0[..., 0] + dx) % 64, (i0[..., 1] + dy) % 64, (i0[..., 2] + dz) % 64]
    noise = 0.0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[..., 0] if dx else 1 - f[..., 0]) * (f[..., 1] if dy else 1 - f[..., 1]) * (f[..., 2] if dz else 1 - f[..., 2])
                noise = noise + w * L(dx, dy, dz)
    H += np.where(pants, 0.12 * (noise - 0.5), 0.0)
    S *= np.where(pants, 0.94 + 0.06 * noise, 1.0)

    trunk = jacket & (lvl > -0.25) & (lvl < 0.92)
    # SIDE SEAMS: where the trunk's skin turns from his front to his back.
    H += seam(nf * 0.12, lvl * spine, trunk & (np.abs(ns) > 0.6))
    # The HEM's elastic band, ribbed, the hand's breadth over the hem.
    hem = (rel @ up) - (HEM[0] - hips).dot(UP)
    band = jacket & (hem > 0) & (hem < 0.035)
    H += np.where(band, 0.12 * np.cos(2 * np.pi * side / 0.004) - 0.05, 0.0)
    H += np.where(jacket & (np.abs(hem - 0.035) < 0.0015), -0.25, 0.0)
    # THE ZIPS: up the front, a chest pocket over his left breast, a hand
    # pocket over each hip — each a slanting line in (side, up).
    front = trunk & (nf > 0.25)
    on, z = zip_(side, lvl * spine, front & (lvl > -0.2) & (lvl < 0.97), 0.007)
    H += z
    S = np.where(on, S * 0.45, S)

    def slant(x0, y0, x1, y1):
        dx, dy = x1 - x0, y1 - y0
        ln = math.hypot(dx, dy)
        ux, uy = dx / ln, dy / ln
        px, py = side - x0, lvl * spine - y0
        t = px * ux + py * uy
        d = px * -uy + py * ux
        return d, t, (t > 0) & (t < ln)

    for x0, y0, x1, y1 in ((-0.035, 0.42, -0.13, 0.33),   # the chest pocket, his left
                           (-0.07, 0.17, -0.15, 0.03),    # the hand pockets
                           (0.07, 0.17, 0.15, 0.03)):
        d, t, inside = slant(x0, y0, x1, y1)
        on, z = zip_(d, t, front & inside, 0.0045)
        H += z
        S = np.where(on, S * 0.5, S)
        # The pocket's bag under the zip, a little proud.
        H += np.where(front & inside & (d < -0.006) & (d > -0.09), 0.05, 0.0)

    # THE PANTS: the outside seam down each leg, and the knees' darts.
    for i, s_ in enumerate("lr"):
        hd, fx_, fy_, fz_, fl = frame(f"thigh_{s_}")
        out = fx_ if fx_.dot(hd - hips) > 0 else -fx_
        o = v3(out)
        nearleg = pants & (np.abs(rel @ across - (hd - hips).dot(SX)) < 0.25)
        H += seam((N @ o - 1.0) * 0.1 + 0.02, lvl * spine, nearleg & (N @ o > 0.75))
        k = v3(knees[i])
        sh = frame(f"shin_{s_}")
        ax = v3((sh[2] - fy_).normalized()) if (sh[2] - fy_).length > 1e-3 else v3(fy_)
        face = v3((fz_ + sh[3]).normalized())
        r = P - k
        s_along = r @ v3(fy_)
        lateral = r @ v3(out)
        knee_front = pants & (N @ face > 0.15) & (np.linalg.norm(r, axis=-1) < 0.2)
        for off in (-0.075, 0.065):
            H += seam(s_along - off - 0.9 * lateral ** 2, lateral, knee_front & (np.abs(lateral) < 0.08))
    return np.clip(H, 0, 1), np.clip(S, 0, 1)


def bake_cloth():
    """THE BAKE (the game's build): the suit unwrapped; where every texel of
    it lies on him, which way it faces and which garment it is, baked;
    the kit's construction worked out at every texel off those
    (`garment_height`); then the fabric's shade times the occlusion baked
    as the DETAIL and the height's bump as the NORMAL, and the shaders
    swapped for the maps. The top-right corner of both maps is left plain —
    white, flat — for every other part that wears a garment's material (the
    gaiters), whose unwrap is that corner."""
    import numpy as np
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 32
    lib._select_only([suit])
    bpy.context.view_layer.objects.active = suit
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004)
    bpy.ops.object.mode_set(mode="OBJECT")
    uv = suit.data.uv_layers.active.data
    for l in uv:
        l.uv = (l.uv[0] * 0.97, l.uv[1] * 0.97)
    detail = bpy.data.images.new("suit_detail", TEX, TEX)
    normal = bpy.data.images.new("suit_normal", TEX, TEX, is_data=True)
    normal.colorspace_settings.name = "Non-Color"

    # WHERE, WHICH WAY AND WHAT: the suit's own position (a quarter scale,
    # about the middle), its normal, and its garment, each baked as an
    # emission into a float map.
    def float_map(name):
        im = bpy.data.images.new(name, TEX, TEX, float_buffer=True, is_data=True)
        im.colorspace_settings.name = "Non-Color"
        return im

    def coord(kind, k, b):
        def out(m, nt):
            tc = nt.nodes.new("ShaderNodeTexCoord")
            mp = nt.nodes.new("ShaderNodeVectorMath")
            mp.operation = "MULTIPLY_ADD"
            mp.inputs[1].default_value = (k, k, k)
            mp.inputs[2].default_value = (b, b, b)
            nt.links.new(tc.outputs[kind], mp.inputs[0])
            return mp.outputs["Vector"]
        return out

    where, facing, which = float_map("suit_where"), float_map("suit_facing"), float_map("suit_which")
    _emitting(coord("Object", 0.25, 0.5))
    _bake("EMIT", where)
    _emitting(coord("Normal", 0.5, 0.5))
    _bake("EMIT", facing)
    ids = {"jacket": (1, 0, 0, 1), "accent": (0, 1, 0, 1), "pants": (0, 0, 1, 1)}

    def garment(m, nt):
        rgb = nt.nodes.new("ShaderNodeRGB")
        rgb.outputs[0].default_value = ids[m.name]
        return rgb.outputs[0]
    _emitting(garment)
    _bake("EMIT", which)
    P = (_pixels(where)[..., :3] - 0.5) / 0.25
    N = _pixels(facing)[..., :3] * 2 - 1
    N /= np.maximum(1e-6, np.linalg.norm(N, axis=-1, keepdims=True))
    G = np.argmax(_pixels(which)[..., :3], axis=-1)
    H, S = garment_height(P, N, G)
    height = float_map("suit_height")
    shade = float_map("suit_shade")
    height.pixels.foreach_set(np.dstack([H, H, H, np.ones_like(H)]).ravel())
    shade.pixels.foreach_set(np.dstack([S, S, S, np.ones_like(S)]).ravel())

    def tex(nt, image):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = image
        t.interpolation = "Linear"
        return t

    # The DETAIL: the shade times the occlusion.
    def shaded(m, nt):
        ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
        ao.inputs["Distance"].default_value = 0.25
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        nt.links.new(tex(nt, shade).outputs["Color"], mul.inputs[0])
        nt.links.new(ao.outputs["AO"], mul.inputs[1])
        return mul.outputs[0]
    _emitting(shaded)
    _bake("EMIT", detail)
    # The NORMAL: the height's bump on a plain diffuse.
    for m in (JACKET, ACCENT, PANTS):
        nt = m.node_tree
        for nd in list(nt.nodes):
            if nd.type != "OUTPUT_MATERIAL":
                nt.nodes.remove(nd)
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 1.0
        bump.inputs["Distance"].default_value = 0.006
        nt.links.new(tex(nt, height).outputs["Color"], bump.inputs["Height"])
        dif = nt.nodes.new("ShaderNodeBsdfDiffuse")
        nt.links.new(bump.outputs["Normal"], dif.inputs["Normal"])
        nt.links.new(dif.outputs["BSDF"], nt.nodes.get("Material Output").inputs["Surface"])
    _bake("NORMAL", normal, normal_space="TANGENT")
    # The plain corner, for everything else in a garment's material.
    for img, px in ((detail, (1.0, 1.0, 1.0, 1.0)), (normal, (0.5, 0.5, 1.0, 1.0))):
        pix = _pixels(img)
        lo = int(TEX * 0.975)
        pix[lo:, lo:] = px
        img.pixels.foreach_set(pix.ravel())
        img.pack()
    for im in (where, facing, which, height, shade):
        bpy.data.images.remove(im)
    # The shaders swapped for the maps: the Principled BSDF back on the
    # output, the kit's colour over the detail, the normal map on it.
    for m in (JACKET, ACCENT, PANTS):
        nt = m.node_tree
        for nd in list(nt.nodes):
            if nd.type != "OUTPUT_MATERIAL":
                nt.nodes.remove(nd)
        p = nt.nodes.new("ShaderNodeBsdfPrincipled")
        p.name = "Principled BSDF"
        p.inputs["Roughness"].default_value = {"jacket": 0.62, "accent": 0.6, "pants": 0.8}[m.name]
        nt.links.new(p.outputs["BSDF"], nt.nodes.get("Material Output").inputs["Surface"])
        cloth_shader(m, KIT_RGB[m.name], detail, normal)
    # Every other part's unwrap: the plain corner.
    for o in COL.objects:
        if o.type == "MESH" and o is not suit and not o.name.startswith("goggle_lens"):
            layer = o.data.uv_layers.new(name="UVMap") if not o.data.uv_layers else o.data.uv_layers.active
            for l in layer.data:
                l.uv = (0.99, 0.99)


curves = [o for o in COL.objects if o.type == "CURVE"]
if curves:
    lib._select_only(curves)
    bpy.context.view_layer.objects.active = curves[0]
    bpy.ops.object.convert(target="MESH")
if GAME:
    bake_cloth()
else:
    for m in (JACKET, ACCENT, PANTS):
        cloth_shader(m, KIT_RGB[m.name])


# ---------------------------------------------------------------- the CLIPS
# Every clip is the game's pose sampled: each frame every bone's frame,
# set as its matrix and keyed. The game never plays them — it poses his
# bones live off `skierPose` — so they are keyed at half the shelf's rate
# (the lab's clip sheets are all that read them), which keeps two dozen
# bones' tracks inside the model's budget. The data comes sampled at 30 a
# second (`skierClips`).
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

# ---------------------------------------------------------------- the STUDIO
floor = min(f.z for f in feet) - 0.06
finish(os.path.basename(argv[0]).removesuffix(".json"), OUT, SAMPLES,
       centre=(0, hips.y + 0.1, floor + 0.55), size=3.0, floor=floor, extras={"frame": "body"})

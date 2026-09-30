# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE SKIER MODELLED IN BLENDER off the game's own data: his body
# (`BODY`), the pose he is bound in and every bone's frame in it
# (`skier-rig.ts`'s `STANDING` and `skierBones`), a start-line slot's kit
# (`SKI_STYLES`), the helmet's MEASURED shell sampled on a grid
# (`skier-helmet.ts`'s `helmetReach` and `helmetPart`), and every clip
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
# THE BOOTS ARE THE SKIS' (`skis.py`, clamped in the bindings): the figure
# ends at the cuff, as the game's own does (`skier-figure.ts`). The bones
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


# ---------------------------------------------------------------- the RIG
def frame(name):
    f = FRAMES[name]
    return B(f["head"]), B(f["x"]), B(f["y"]), B(f["z"]), f["length"]


for name in FRAMES:
    head, _, y, z, length = frame(name)
    bone(name, head, head + y * length, roll_to=z)

SEGMENTS = {n: (frame(n)[0], frame(n)[0] + frame(n)[2] * frame(n)[4]) for n in FRAMES}
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


def suit_weights(co):
    """Across a joint, shared between the bones that meet there by how much
    nearer each is — 4 cm makes the difference between half and a third."""
    b0 = nearest(co, [n for n in SEGMENTS if not n.startswith("boot")])
    d0 = along(co, SEGMENTS[b0])[1]
    w = {n: math.exp(-(along(co, SEGMENTS[n])[1] - d0) / 0.04) for n in [b0] + NEAR[b0]}
    top = sorted(w.items(), key=lambda kv: -kv[1])[:3]
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


rides("spine")
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
# The measured shell (`helmetReach`, sampled round from dead behind and up
# from the chin), in the head's frame tipped nose-down as it is worn and
# sat up on the head (`HELMET_TILT`, `HELMET_SIT`); cut where the game's is
# cut (the neck), the goggles' lens in the port, the cap in the peak's
# colour and the goggle strap round the back at the port's height.
hc, hx, hy, hz, _ = frame("head")
tilt = HELM["tilt"]
STEP = 4 if GAME else 1
NA, NE = HELM["around"] // STEP, HELM["up"] // STEP


def worn(a, e, r):
    x, y, z = math.sin(a) * math.cos(e) * r, math.sin(e) * r, math.cos(a) * math.cos(e) * r
    y, z = y * math.cos(tilt) - z * math.sin(tilt), y * math.sin(tilt) + z * math.cos(tilt)
    return hc + hy * HELM["sit"] + hx * x + hy * y + hz * z


def ang(i, j):
    return -math.pi + 2 * math.pi * i / NA, -math.pi / 2 + math.pi * j / NE


rides("head")
def part_at(i, j):
    """What the shell is in cell (i, j) of this grid: the sampled cell at its middle."""
    return HELM["part"][j * STEP + STEP // 2][i * STEP + STEP // 2]


# THE FACE IS OPEN: a ski helmet's front rim is its brow, so everything of
# the measured surface under the port and across its width goes with it.
PORT = [ang(i + 0.5, j + 0.5) for j in range(NE) for i in range(NA) if part_at(i, j) == "port"]
PA0, PA1 = min(p[0] for p in PORT), max(p[0] for p in PORT)
PE0, PE1 = min(p[1] for p in PORT), max(p[1] for p in PORT)


def open_face(a, e):
    return PA0 <= a <= PA1 and e < PE1


port_e = [ang(0, j + 0.5)[1] for j in range(NE) for i in range(NA) if part_at(i, j) == "port"]
strap_e = sum(port_e) / len(port_e) if port_e else 0.1
verts = [worn(*ang(i, j), HELM["reach"][j * STEP][i * STEP]) for j in range(NE + 1) for i in range(NA)]
faces, fm = [], []
for j in range(NE):
    for i in range(NA):
        part = part_at(i, j)
        # An OPEN helmet: cut at the neck and at the face's port.
        a, e = ang(i + 0.5, j + 0.5)
        if part in ("neck", "port") or open_face(a, e):
            continue
        if part == "cap":
            m = 1
        elif abs(e - strap_e) < 0.07 and abs(a) > 1.9:
            m = 2
        else:
            m = 0
        i1 = (i + 1) % NA
        faces.append([j * NA + i, (j + 1) * NA + i, (j + 1) * NA + i1, j * NA + i1])
        fm.append(m)
shell = mesh_obj("helmet", verts, faces, [HELMET, PEAK, STRAP, LENS], fm)
# THE RIM SMOOTHED: the openings were cut a grid cell at a time, so their
# edges are stairs — eased along themselves, a few passes.
bm = bmesh.new()
bm.from_mesh(shell.data)
rim = [v for v in bm.verts if v.is_boundary]
for _ in range(6):
    moved = {}
    for v in rim:
        ring = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
        if len(ring) == 2:
            moved[v] = v.co * 0.5 + (ring[0].co + ring[1].co) * 0.25
    for v, co in moved.items():
        v.co = co
bm.to_mesh(shell.data)
bm.free()
# A rim to every opening: the port shows the shell's edge.
shell.modifiers.new("thick", "SOLIDIFY").thickness = -0.012
# THE HEAD in it, in a balaclava's dark knit: what the port shows under
# the goggles, down to the collar.
ellipsoid("head", hc + hy * 0.0 + hz * 0.004, (0.074, 0.108, 0.092), STRAP,
          rot=Matrix((hx, hy, hz)).transposed().to_euler())

# THE GOGGLES, ON THE FACE: a wide frame across the port and the lens in
# it, bent round the head on a cylinder about its own up — the curve a
# goggle's frame is moulded to — centred on the port, a little proud of the
# shell's rim, their corners rounded (a squared superellipse), held by the
# strap round the back.
ac, ec = (PA0 + PA1) / 2, (PE0 + PE1) / 2
eye = worn(ac, ec, HELM["reach"][int((ec + math.pi / 2) / math.pi * HELM["up"])][
    int((ac + math.pi) / (2 * math.pi) * HELM["around"]) % HELM["around"]])
axis = hc + hy * (eye - hc).dot(hy)
look = (eye - axis).normalized()
side = hy.cross(look).normalized()
R = (eye - axis).length


def goggle(name, proud, half, tall, mats, depth):
    GA, GE = (16, 6) if GAME else (48, 16)
    vs, fs = [], []
    for j in range(GE + 1):
        w = 2 * j / GE - 1
        # Each row as wide as the squared superellipse allows at its height:
        # the corners rounded by the outline itself, never by culled cells.
        reach = (1 - min(1.0, abs(w) ** 4)) ** (1 / 6)
        for i in range(GA + 1):
            t = (2 * i / GA - 1) * half * max(0.35, reach)
            v = w * tall / 2
            vs.append(axis + hy * (v + 0.004) + (look * math.cos(t) + side * math.sin(t)) * (R + proud))
    for j in range(GE):
        for i in range(GA):
            k = j * (GA + 1) + i
            fs.append([k, k + 1, k + GA + 2, k + GA + 1])
    ob = mesh_obj(name, vs, fs, mats)
    ob.modifiers.new("thick", "SOLIDIFY").thickness = depth
    return ob


goggle("goggle_frame", 0.012, 1.15, 0.092, [STRAP], 0.02)
goggle("goggle_lens", 0.034, 1.02, 0.07, [LENS], 0.004)


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
    rides(f"forearm_{s}")
    e, fx, fy, fz, fl = frame(f"forearm_{s}")
    wrist_t = ANSUR["forearm_length"] * MM / fl
    cyl("gauntlet", e + fy * (fl * (wrist_t - 0.2)), e + fy * (fl * (wrist_t - 0.02)), 0.058, GLOVE, r2=0.046)
    # THE HAND, CLOSED ROUND THE GRIP: the grip's shaft runs through the
    # fist along the bend's side (`fz`), the back of the hand faces out,
    # four fingers wrap the shaft from the palm round the front, stacked
    # down it a finger's width apart, and the thumb lies over the top.
    c = e + fy * fl
    out = fx if fx.dot(shoulders[i] - neck) > 0 else -fx
    turn = Matrix((out, fy, fz)).transposed().to_euler()
    ellipsoid("palm", c - fy * 0.035 + out * 0.012, (0.03, 0.05, 0.047), GLOVE, rot=turn)
    for k in range(4):
        along_g = fz * (0.028 - 0.019 * k)
        arc = [c + along_g + (fy * math.cos(t) + out * math.sin(t)) * 0.023
               for t in (math.radians(a) for a in range(-110, 181, 58 if GAME else 20))]
        tube("finger", arc, 0.0095 - 0.0008 * k, GLOVE, smooth_n=0 if GAME else 2)
    tube("thumb", [c - fy * 0.03 - out * 0.018 + fz * 0.03, c - out * 0.02 + fz * 0.046,
                   c + fy * 0.02 - out * 0.012 + fz * 0.048], 0.011, GLOVE, smooth_n=0 if GAME else 2)


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


def bake_cloth():
    """THE BAKE (the game's build): the suit unwrapped, the fabric's shade
    times the occlusion baked as the DETAIL, its bump as the NORMAL, and the
    shaders swapped for the maps. The top-right corner of both maps is left
    plain — white, flat — for every other part that wears a garment's
    material (the gaiters), whose unwrap is that corner."""
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

    def target(image):
        for m in (JACKET, ACCENT, PANTS):
            t = m.node_tree.nodes.new("ShaderNodeTexImage")
            t.image = image
            for nd in m.node_tree.nodes:
                nd.select = False
            t.select = True
            m.node_tree.nodes.active = t

    # The detail: emission of the fabric's shade times the occlusion.
    for m in (JACKET, ACCENT, PANTS):
        nt = m.node_tree
        out = nt.nodes.get("Material Output")
        h = cloth_height(nt, CLOTH[m.name][0])
        shade = nt.nodes.new("ShaderNodeMapRange")
        shade.inputs["To Min"].default_value = 0.78
        nt.links.new(h, shade.inputs["Value"])
        ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
        ao.inputs["Distance"].default_value = 0.25
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        nt.links.new(shade.outputs["Result"], mul.inputs[0])
        nt.links.new(ao.outputs["AO"], mul.inputs[1])
        em = nt.nodes.new("ShaderNodeEmission")
        nt.links.new(mul.outputs[0], em.inputs["Color"])
        m["_bake_out"] = em.name
        nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    target(detail)
    bpy.ops.object.bake(type="EMIT", margin=6)
    # The normal: the fabric's bump on a plain diffuse.
    for m in (JACKET, ACCENT, PANTS):
        nt = m.node_tree
        out = nt.nodes.get("Material Output")
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = CLOTH[m.name][1]
        bump.inputs["Distance"].default_value = 0.004
        nt.links.new(cloth_height(nt, CLOTH[m.name][0]), bump.inputs["Height"])
        dif = nt.nodes.new("ShaderNodeBsdfDiffuse")
        nt.links.new(bump.outputs["Normal"], dif.inputs["Normal"])
        nt.links.new(dif.outputs["BSDF"], out.inputs["Surface"])
    target(normal)
    bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT", margin=6)
    # The plain corner, for everything else in a garment's material.
    for img, px in ((detail, (1.0, 1.0, 1.0, 1.0)), (normal, (0.5, 0.5, 1.0, 1.0))):
        pix = list(img.pixels)
        lo = int(TEX * 0.975)
        for y in range(lo, TEX):
            for x in range(lo, TEX):
                k = 4 * (y * TEX + x)
                pix[k:k + 4] = px
        img.pixels = pix
        img.pack()
    # The shaders swapped for the maps: the Principled BSDF back on the
    # output, the kit's colour over the detail, the normal map on it.
    for m in (JACKET, ACCENT, PANTS):
        nt = m.node_tree
        for nd in list(nt.nodes):
            if nd.type not in ("BSDF_PRINCIPLED", "OUTPUT_MATERIAL"):
                nt.nodes.remove(nd)
        nt.links.new(nt.nodes.get("Principled BSDF").outputs["BSDF"],
                     nt.nodes.get("Material Output").inputs["Surface"])
        cloth_shader(m, KIT_RGB[m.name], detail, normal)
    # Every other part's unwrap: the plain corner.
    for o in COL.objects:
        if o.type == "MESH" and o is not suit:
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
# set as its matrix and keyed.
def keyed(frames):
    def at(t):
        f = frames[min(len(frames) - 1, round(t * lib.FPS))]
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

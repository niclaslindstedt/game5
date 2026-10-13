# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE RETRO SKIER MODELLED IN BLENDER: a rider of the late eighties — a
# fitted ONE-PIECE suit in loud colour blocks (a body colour, a chevron
# yoke over the padded shoulders, a band slanting across the chest and
# ringing the sleeves, a stripe down the outside of each leg, a belt at the
# waist), a striped KNIT BOBBLE HAT over a shaggy cut, MIRRORED WRAPAROUND
# SHADES, a long KNIT SCARF knotted at the throat with its two tails loose,
# and leather gloves — off the game's own data (`scripts/blender/kinds/
# retro.mjs`, the driver `scripts/blender.mjs --kind=retro`).
#
# THE RIG IS THE GAME'S: every bone of `skier-rig.ts`'s `SKIER_BONES`, laid
# where the game's dressed skin is bound (`dress-loft.ts`'s `bindPose`), so
# the game's pose drives this model bone for bone exactly as it drives its
# own dressed skier — every carve, tuck, grab, landing and fall is the same
# arithmetic, no clip of its own. Beside them, the PARTS THAT FLY get bones
# of their own (`retro-look.ts`'s `RETRO_CHAINS`): the scarf's two tails a
# chain each off the knot and the bobble on its stalk, laid hanging at rest
# and swung in the air by the game (`retro-wind.ts`).
#
# The frame: the body frame (x right, y up, z ahead) laid as Blender's
# (-x, z, y), as `skier.py`'s. The boots are the skis' model.

import json, math, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
LOOK, POSE, FRAMES = DATA["look"], DATA["rest"]["pose"], DATA["rest"]["bones"]
BREAK = DATA["broken"]
CHAINS = [("scarf_a", 6, 0.66), ("scarf_b", 5, 0.5), ("bobble", 1, 0.07)]


def B(p):
    """A point or direction of the body frame, in Blender's."""
    return Vector((-p["x"], p["z"], p["y"]))


def colour(hexa):
    """An sRGB colour as linear."""
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 for c in ((hexa >> 16) & 255, (hexa >> 8) & 255, hexa & 255))


# ---------------------------------------------------------------- materials
# The suit is NYLON with a sheen (the period's shiny stretch fabric), its
# four colours the colourway's; the knits matt wool; the shades a mirror.
SUIT = mat("suit", colour(LOOK["suit"]), rough=0.42, sheen=0.3)
YOKE = mat("yoke", colour(LOOK["yoke"]), rough=0.42, sheen=0.3)
STRIPE = mat("stripe", colour(LOOK["stripe"]), rough=0.42, sheen=0.3)
BELT = mat("belt", colour(LOOK["belt"]), rough=0.5)
CLOTHS = (SUIT, YOKE, STRIPE, BELT)
GLOVE = mat("glove", colour(LOOK["glove"]), rough=0.55)
KNIT = mat("knit", colour(LOOK["knit"]), rough=0.95, sheen=0.6)
KNIT2 = mat("knit2", colour(LOOK["knit2"]), rough=0.95, sheen=0.6)
BOBBLE = mat("bobble", colour(LOOK["bobble"]), rough=1.0, sheen=0.8)
FRAME = mat("frame", colour(LOOK["frame"]), rough=0.3, coat=0.6)
LENS = mat("lens", colour(LOOK["lens"]), metal=0.85, rough=0.06)
SKIN = mat("skin", colour(LOOK["skin"]), rough=0.6)
HAIR = mat("hair", colour(LOOK["hair"]), rough=0.75, sheen=0.4)
BUCKLE = mat("buckle", (0.8, 0.8, 0.82), metal=1.0, rough=0.25)
LINER = mat("liner", colour(0x2b2e34), rough=0.85)
# The face's own colours ride its vertices (`dress-face.ts`'s shades).
FACE = mat("face", (1, 1, 1), rough=0.6)
_fn = FACE.node_tree
_va = _fn.nodes.new("ShaderNodeVertexColor")
_va.layer_name = "Col"
_fn.links.new(_va.outputs["Color"], _fn.nodes.get("Principled BSDF").inputs["Base Color"])


# ---------------------------------------------------------------- the RIG
def frame(name):
    """A bone's frame — or the TRUNK's ("spine"): the chord from the hips to
    the neck the back is bent about, facing the chest."""
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
SKIP = set(HALF.values()) | {"pelvis", "chest"} | {n for n in FRAMES if "_lo_" in n or n.startswith("hand")}
SEGMENTS = {n: (frame(n)[0], frame(n)[0] + frame(n)[2] * frame(n)[4]) for n in FRAMES if n not in SKIP}
SEGMENTS["spine"] = (frame("spine")[0], frame("spine")[0] + frame("spine")[2] * frame("spine")[4])
NEAR = {"spine": ["head", "thigh_l", "thigh_r", "upperarm_l", "upperarm_r"], "head": ["spine"]}
for s in "lr":
    NEAR |= {f"thigh_{s}": ["spine", f"shin_{s}"], f"shin_{s}": [f"thigh_{s}", f"boot_{s}"],
             f"boot_{s}": [f"shin_{s}"], f"upperarm_{s}": ["spine", f"forearm_{s}"],
             f"forearm_{s}": [f"upperarm_{s}"]}


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
    """`skier.py`'s rule: across a joint, shared between the bones that meet
    there; a half bone over each hinge; the trunk split pelvis to chest —
    and past where a break would be, an arm's skin on the bone below it
    (`skier-broken.ts`), so a broken arm hangs as the dressed skier's does."""
    b0 = nearest(co, [n for n in SEGMENTS if not n.startswith("boot")])
    d0 = along(co, SEGMENTS[b0])[1]
    w = {n: math.exp(-(along(co, SEGMENTS[n])[1] - d0) / blend(b0, n)) for n in [b0] + NEAR[b0]}
    top = sorted(w.items(), key=lambda kv: -kv[1])[:3]
    total = sum(v for _, v in top)
    out = {n: v / total for n, v in top}
    # Below a break the arm's own bone gives way to the one below it.
    for s in "lr":
        for part, at in (("upperarm", BREAK["upper"]), ("forearm", BREAK["fore"])):
            n = f"{part}_{s}"
            if n in out and along(co, SEGMENTS[n])[0] * frame(n)[4] > at:
                out[f"{part}_lo_{s}"] = out.pop(n)
    for (a, b), h in HALF.items():
        a2 = a if a in out else a.replace("upperarm", "upperarm_lo")
        if a2 in out and b in out:
            wa, wb = out.pop(a2), out.pop(b)
            c = wb / (wa + wb)
            out[a2] = (wa + wb) * (1 - c) ** 2
            out[b] = (wa + wb) * c * c
            out[h] = out.get(h, 0.0) + (wa + wb) * 2 * c * (1 - c)
    if "spine" in out:
        t = along(co, SEGMENTS["spine"])[0]
        c = max(0.0, min(1.0, (t - 0.25) / 0.45))
        c = c * c * (3 - 2 * c)
        share = out.pop("spine")
        out["pelvis"] = out.get("pelvis", 0.0) + share * (1 - c)
        out["chest"] = out.get("chest", 0.0) + share * c
    top = sorted(out.items(), key=lambda kv: -kv[1])[:4]
    total = sum(v for _, v in top)
    return {n: v / total for n, v in top}


# ---------------------------------------------------------------- the SUIT
# The body under it is `skier.py`'s man of the ANSUR II survey (mm).
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


# THE ONE-PIECE: a stretch suit cut close through the legs and the waist
# (the belt cinches it), lightly padded and quilted over the chest and the
# back, the SHOULDERS built up square under it — the period's padded
# shoulder — and a stand collar. What it adds over the body, m a side:
EASE = {"chest_front": 0.028, "chest_back": 0.026, "trunk_side": 0.02, "waist": 0.012,
        "sleeve": 0.02, "legs": 0.012, "pad": 0.02}

P = POSE
hips, neck, head_c = B(P["hips"]), B(P["neck"]), B(P["head"])
knees, feet = [B(k) for k in P["knees"]], [B(f) for f in P["feet"]]
shoulders, elbows, hands = [B(k) for k in P["shoulders"]], [B(k) for k in P["elbows"]], [B(k) for k in P["hands"]]
SEG = 16 if GAME else 28


def lofted(name, bone_name, sections, n=2.4, m=SUIT):
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
    return loft(name, rings, [m])


rides("chest")
pieces = []
bh = ANSUR["hip_breadth"] / 2 * MM
bd = ANSUR["buttock_depth"] * MM
wb, wd = ANSUR["waist_breadth"] / 2 * MM, ANSUR["waist_depth"] * MM
cb, cd = ANSUR["chest_breadth"] / 2 * MM, ANSUR["chest_depth"] * MM
E = EASE
TRUNK = [  # level, half across, ahead, behind
    (level(ANSUR["crotch"]) - 0.04, bh * 0.8 + 0.02, bd * 0.3 + 0.02, bd * 0.45 + 0.02),
    (level(ANSUR["crotch"]) + 0.05, bh + 0.018, bd * 0.4 + 0.018, bd * 0.52 + 0.018),
    (0.08, bh + E["waist"], bd * 0.42 + E["waist"], bd * 0.55 + E["waist"]),
    (level(ANSUR["waist_h"]), wb + E["waist"] * 0.6, wd * 0.55 + E["waist"] * 0.6, wd * 0.45 + E["waist"] * 0.6),
    (level(ANSUR["tenth_rib_h"]), wb * 0.99 + E["trunk_side"], wd * 0.56 + E["chest_front"],
     wd * 0.47 + E["chest_back"]),
    (0.52, cb * 1.07 + E["trunk_side"], cd * 0.52 + E["chest_front"], cd * 0.49 + E["chest_back"]),
    (level(ANSUR["chest_h"]), cb * 1.15 + E["trunk_side"], cd * 0.51 + E["chest_front"],
     cd * 0.5 + E["chest_back"]),
    (level(ANSUR["axilla_h"]), cb * 1.24 + E["trunk_side"], cd * 0.48 + E["chest_front"],
     cd * 0.5 + E["chest_back"]),
    (level(ANSUR["acromion_h"]) - 0.05, ANSUR["biacromial"] / 2 * MM * 0.95 + E["pad"] * 0.5,
     cd * 0.41 + E["chest_front"], cd * 0.45 + E["chest_back"]),
    (0.95, r_of(ANSUR["neck_base"]) * 1.5 + 0.02, 0.1, 0.1),
    (1.0, r_of(ANSUR["neck_base"]) + 0.028, 0.088, 0.088),
]
pieces.append(lofted("trunk", "spine", TRUNK, n=2.7))
SP_O, SX, UP_S, CHEST, SPINE_L = frame("spine")


def trunk_at(lv):
    """The suit's (half across, ahead, behind) at a level of the trunk."""
    for (l0, *a), (l1, *b) in zip(TRUNK, TRUNK[1:]):
        if l0 <= lv <= l1:
            k = (lv - l0) / (l1 - l0)
            return [x + (y - x) * k for x, y in zip(a, b)]
    return TRUNK[0][1:] if lv < TRUNK[0][0] else TRUNK[-1][1:]


def on_trunk(lv):
    return SP_O + UP_S * (lv * SPINE_L)


# The stand collar, up round the throat.
collar = [neck.lerp(head_c, u) for u in (0.0, 0.16, 0.3)]
pieces.append(loft("collar", [[c + SX * (0.088 * math.cos(2 * math.pi * k / SEG))
                               + CHEST * (0.085 * math.sin(2 * math.pi * k / SEG)) for k in range(SEG)]
                              for c in collar], [SUIT]))
for i, s in enumerate("lr"):
    # The PADDED SHOULDER: the deltoid under a pad that squares it off.
    reach = ANSUR["bideltoid"] / 2 * MM - ANSUR["biacromial"] / 2 * MM
    out = (shoulders[i] - neck.lerp(hips, 0.12)).normalized()
    pieces.append(ellipsoid("shoulder", shoulders[i] + UP_S * 0.014 + out * 0.008,
                            (reach + E["pad"] + 0.012, reach + E["pad"] + 0.012, reach + E["pad"] + 0.006), SUIT))
    b = r_of(ANSUR["biceps"]) * 0.95
    pieces.append(lofted("sleeve", f"upperarm_{s}", [
        (-0.05, b * 1.3 + E["sleeve"], b * 1.2 + E["sleeve"], b * 1.2 + E["sleeve"]),
        (0.35, b + E["sleeve"], b + E["sleeve"], b * 1.05 + E["sleeve"]),
        (0.7, b * 0.92 + E["sleeve"], b * 0.9 + E["sleeve"], b * 0.95 + E["sleeve"]),
        (1.05, b * 0.85 + E["sleeve"], b * 0.9 + E["sleeve"], b * 0.8 + E["sleeve"])]))
    f, w = r_of(ANSUR["forearm"]) * 0.95, r_of(ANSUR["wrist"])
    wrist_t = ANSUR["forearm_length"] * MM / frame(f"forearm_{s}")[4]
    pieces.append(lofted("sleeve", f"forearm_{s}", [
        (-0.08, f * 1.05 + E["sleeve"], f + E["sleeve"], f * 1.1 + E["sleeve"]),
        (0.3, f + E["sleeve"], f + E["sleeve"], f + E["sleeve"]),
        (wrist_t - 0.2, (f + w) / 2 + E["sleeve"], (f + w) / 2 + E["sleeve"], (f + w) / 2 + E["sleeve"]),
        (wrist_t - 0.08, w + E["sleeve"], w + E["sleeve"], w + E["sleeve"])]))
    pieces.append(ellipsoid("elbow", elbows[i], (b + E["sleeve"],) * 3, SUIT))
    # The stretch legs, close through the thigh and knee, eased over the
    # boot's cuff where the suit's inner gaiter goes on over it.
    th, lt = r_of(ANSUR["thigh"]), r_of(ANSUR["lower_thigh"])
    pieces.append(lofted("legs", f"thigh_{s}", [
        (-0.12, th * 1.04 + E["legs"], th + E["legs"], th * 1.1 + E["legs"]),
        (0.2, th + E["legs"], th + E["legs"], th + E["legs"]),
        (0.6, (th + lt) / 2 + E["legs"], (th + lt) / 2 + E["legs"], (th + lt) / 2 + E["legs"]),
        (0.95, lt + E["legs"], lt + E["legs"], lt + E["legs"])]))
    ca, an = r_of(ANSUR["calf"]), r_of(ANSUR["ankle"])
    pieces.append(lofted("legs", f"shin_{s}", [
        (-0.05, lt + E["legs"], lt + E["legs"], lt + E["legs"]),
        (0.3, ca * 0.9 + E["legs"], ca * 0.8 + E["legs"], ca * 1.12 + E["legs"]),
        (0.5, ca * 0.85 + E["legs"] + 0.012, ca * 0.8 + E["legs"] + 0.012, ca + E["legs"] + 0.012),
        (0.6, ca * 0.9 + E["legs"] + 0.02, ca * 0.9 + E["legs"] + 0.02, ca + E["legs"] + 0.02)]))
    pieces.append(ellipsoid("knee", knees[i], (lt + E["legs"] + 0.005,) * 3, SUIT))

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
    thin.ratio = 3400 / max(1, len(suit.data.polygons) * 2)
    bpy.ops.object.convert(target="MESH")
suit.data.materials.clear()
for m in CLOTHS:
    suit.data.materials.append(m)

# The stretch fabric's folds: fewer and softer than a padded jacket's —
# behind the knee, in the crook of the elbow, bunched at the ankle and over
# the belt.
FOLDS = [
    ("upperarm", 0.7, 1.0, -1, 0.006, 0.045), ("forearm", 0.0, 0.25, -1, 0.006, 0.045),
    ("forearm", 0.3, 0.62, 0, 0.003, 0.03),
    ("thigh", 0.8, 1.0, -1, 0.007, 0.05), ("shin", 0.0, 0.18, -1, 0.007, 0.05),
    ("shin", 0.45, 0.62, 0, 0.005, 0.03),
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

# THE COLOUR BLOCKS, each cut along its planes first so a colour stops on
# a clean line:
#   * the YOKE: a chevron over the shoulders, its point at the breastbone
#     front and back — above both of two planes leaning in from each side;
#   * the BAND: a stripe slanting across the chest and back from his right
#     shoulder to his left hip, below the yoke;
#   * the SLEEVE RINGS: a band round each upper arm in the stripe's colour;
#   * the LEG STRIPES: down the outside of each leg in the stripe's colour;
#   * the CUFFS: in the belt's colour, knitted cuffs at the wrists.
V_PT = neck - UP_S * 0.2
YOKE_PLANES = [(V_PT, (UP_S * 1.0 + SX * 0.75).normalized()), (V_PT, (UP_S * 1.0 - SX * 0.75).normalized())]
BAND_N = (UP_S * math.cos(0.62) + SX * math.sin(0.62)).normalized()
BAND_MID = on_trunk(0.5)
BAND = [(BAND_MID - BAND_N * 0.055, BAND_N), (BAND_MID + BAND_N * 0.055, -BAND_N)]


def leg_band(s, part):
    """The racing stripe down the outside of a leg: 6 cm wide, between two
    planes either side of the line straight out from the leg's axis."""
    head, x, y, z, length = frame(f"{part}_{s}")
    away = head - hips
    away = (away - y * away.dot(y))
    out = (x if x.dot(away) > 0 else -x) if away.length < 1e-3 else away.normalized()
    fwd = y.cross(out).normalized()
    return [(head + out * 0.04, out), (head + fwd * 0.03, -fwd), (head - fwd * 0.03, fwd)]


LEG_STRIPES = {(s, part): leg_band(s, part) for s in "lr" for part in ("thigh", "shin")}
RINGS = {}
for s in "lr":
    head, _, y, _, length = frame(f"upperarm_{s}")
    RINGS[s] = [(head + y * (length * 0.5), y), (head + y * (length * 0.72), -y)]
CUFFS = [(frame(f"forearm_{s}")[0] + frame(f"forearm_{s}")[2] * frame(f"forearm_{s}")[4] * 0.8,
          frame(f"forearm_{s}")[2]) for s in "lr"]
bm = bmesh.new()
bm.from_mesh(suit.data)
for co, no in YOKE_PLANES + BAND + CUFFS + [p for b in LEG_STRIPES.values() for p in b] + [p for r in RINGS.values() for p in r]:
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)
bm.to_mesh(suit.data)
bm.free()


def above(co, plane):
    return (co - plane[0]).dot(plane[1]) > 0


def cloth_of(co):
    """0 the suit, 1 the yoke, 2 the stripe, 3 the cuffs."""
    b = nearest(co)
    if b.startswith(("thigh", "shin")):
        return 2 if all(above(co, p) for p in LEG_STRIPES[(b[-1], b.split("_")[0])]) else 0
    if b.startswith("forearm") and above(co, CUFFS["lr".index(b[-1])]):
        return 3
    yoke = all(above(co, p) for p in YOKE_PLANES)
    if b in ("spine", "head"):
        if yoke:
            return 1
        return 2 if all(above(co, p) for p in BAND) else 0
    if b.startswith("upperarm"):
        if yoke:
            return 1
        return 2 if all(above(co, p) for p in RINGS[b[-1]]) else 0
    return 0


suit.data.polygons.foreach_set("material_index", [cloth_of(p.center) for p in suit.data.polygons])
for p in suit.data.polygons:
    p.use_smooth = True
weights(suit, suit_weights)

# THE BELT: a band round the waist over the suit, a square buckle at the
# front — bending with the trunk as the suit does.
lw = level(ANSUR["waist_h"]) + 0.02
hx_, fr_, bk_ = trunk_at(lw)
belt_rings = []
for dl in (-0.022, 0.022):
    c = on_trunk(lw + dl / SPINE_L)
    ring = []
    for k in range(SEG):
        a = 2 * math.pi * k / SEG
        ca, sa = math.cos(a), math.sin(a)
        u = math.copysign(abs(ca) ** (2 / 2.7), ca) * (hx_ + 0.015)
        v = math.copysign(abs(sa) ** (2 / 2.7), sa) * ((fr_ if sa > 0 else bk_) + 0.015)
        ring.append(c + SX * u + CHEST * v)
    belt_rings.append(ring)
weights(loft("belt", belt_rings, [BELT]), suit_weights)
bc = on_trunk(lw) + CHEST * (fr_ + 0.02)
weights(box("buckle", bc, (0.07, 0.012, 0.05), BUCKLE, rot=Matrix((SX, CHEST, UP_S)).transposed().to_euler(), bevel=0.003),
        suit_weights)

# ---------------------------------------------------------------- the HEAD
# Bare under the hat: the game's own face (`dress-face.ts`, every triangle
# and its shade handed in), the skull's egg behind it (`helmet-shape.ts`'s
# head: radii 0.077, 0.104, 0.097 m about (0, −0.014, −0.006) in the head's
# frame), the ears, and a shaggy cut — a fringe under the hat's cuff and
# the back left long over the collar.
rides("head")
hc, hx, hy, hz, _ = frame("head")
EGG_R, EGG_AT = (0.077, 0.104, 0.097), (0.0, -0.014, -0.006)


def hp(p):
    return hc + hx * p[0] + hy * p[1] + hz * p[2]


def egg(theta, phi, grow=0.0):
    """The head's egg at `theta` up from the chin and `phi` round from
    ahead, pushed `grow` m out along its normal — in the head's frame."""
    s = math.sin(theta)
    d = (math.sin(phi) * s, -math.cos(theta), math.cos(phi) * s)
    n = Vector((d[0] / EGG_R[0], d[1] / EGG_R[1], d[2] / EGG_R[2])).normalized()
    p = Vector((d[0] * EGG_R[0] + EGG_AT[0], d[1] * EGG_R[1] + EGG_AT[1], d[2] * EGG_R[2] + EGG_AT[2]))
    return p + n * grow


def theta_at(y):
    return math.acos(max(-1.0, min(1.0, -(y - EGG_AT[1]) / EGG_R[1])))


FP, FC, FI = DATA["face"]["position"], DATA["face"]["color"], DATA["face"]["index"]
face_ob = mesh_obj("face", [B({"x": FP[k], "y": FP[k + 1], "z": FP[k + 2]}) for k in range(0, len(FP), 3)],
                   [FI[k:k + 3] for k in range(0, len(FI), 3)], [FACE])
col = face_ob.data.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
for k in range(len(FP) // 3):
    col.data[k].color = (FC[3 * k], FC[3 * k + 1], FC[3 * k + 2], 1.0)
ellipsoid("skull", hp(EGG_AT), tuple(r * 0.985 for r in EGG_R), SKIN,
          rot=Matrix((hx, hy, hz)).transposed().to_euler())
for sgn in (-1, 1):
    ellipsoid("ear", hp((sgn * 0.077, -0.03, -0.012)), (0.012, 0.03, 0.02), SKIN,
              rot=Matrix((hx, hy, hz)).transposed().to_euler())


def ring_on_egg(y_of_phi, grow, n=24, phis=None):
    phis = phis or [2 * math.pi * k / n for k in range(n)]
    return [hp(egg(theta_at(y_of_phi(ph)), ph, grow)) for ph in phis]


# THE HAT: a knit beanie pulled down to the brows in front and over the
# back of the skull, its turned-up cuff ribbed and in the second yarn, the
# crown banded in the two yarns, the bobble on a stalk of its own bone.
HAT_FRONT, HAT_BACK = 0.03, -0.05


def hat_base(ph):
    c = math.cos(ph)
    return HAT_BACK + (HAT_FRONT - HAT_BACK) * (0.5 + 0.5 * c) ** 1.4


NH = 20 if GAME else 40
phis = [2 * math.pi * k / NH for k in range(NH)]
crown_rings = []
LEVELS = 9 if GAME else 16
for j in range(LEVELS + 1):
    v = j / LEVELS
    ring = []
    for ph in phis:
        th0 = theta_at(hat_base(ph))
        th = th0 + (math.pi - 0.02 - th0) * v
        # A slouch: the crown carried a little back and up.
        p = egg(th, ph, 0.012 + 0.012 * v * v)
        p += Vector((0, 0.012, -0.012)) * (v ** 3)
        ring.append(hp(p))
    crown_rings.append(ring)
stripes = lambda c: 1 if int(((c - hp(EGG_AT)).dot(hy) + 0.2) / 0.026) % 2 else 0
loft("hat", crown_rings, [KNIT, KNIT2], face_mat=stripes)
cuff = []
for dy, grow in ((-0.006, 0.02), (0.012, 0.026), (0.034, 0.026), (0.046, 0.016)):
    ring = []
    for ph in phis:
        rib = 0.0025 * math.cos(ph * (NH // 2)) if not GAME else 0.0
        ring.append(hp(egg(theta_at(hat_base(ph) + dy), ph, grow + rib)))
    cuff.append(ring)
loft("cuff", cuff, [KNIT2])
top = hp(egg(math.pi - 0.02, 0, 0.024) + Vector((0, 0.012, -0.012)))

# THE CUT: a fringe under the cuff's front, and the back grown long over
# the collar — shaggy, its strands ridged and its edge ragged.
rnd = random.Random(80)
fringe = []
for dy in (0.0, -0.02):
    fringe.append([hp(egg(theta_at(hat_base(ph) - 0.004 + dy - 0.006 * rnd.random()), ph, 0.008 - dy * 0.2))
                   for ph in [-0.9 + 1.8 * k / 14 for k in range(15)]])
loft("fringe", fringe, [HAIR], closed=False, cap=False)
back = []
for j, (dy, grow) in enumerate(((0.0, 0.018), (-0.03, 0.02), (-0.06, 0.022), (-0.09, 0.02), (-0.115, 0.012))):
    ring = []
    for k in range(15):
        ph = math.pi * 0.42 + math.pi * 1.16 * k / 14
        jag = -0.012 * rnd.random() if j == 4 else 0.0
        y = hat_base(ph) - 0.004 + dy + jag
        # Below the egg, the hair hangs straight down off the nape.
        th = theta_at(max(y, EGG_AT[1] - EGG_R[1] * 0.75))
        p = egg(th, ph, grow + 0.004 * math.sin(k * 2.7 + j))
        p.y = y
        ring.append(hp(p))
    back.append(ring)
loft("mane", back, [HAIR], closed=False, cap=False)

# THE SHADES: one wraparound mirrored lens across the eyes, dipped at the
# bridge of the nose, its frame a bar along the top and the temples back
# to the ears under the hat.
LP = [-1.15 + 2.3 * k / (14 if GAME else 30) for k in range(15 if GAME else 31)]


def lens_top(ph):
    return 0.017 - 0.008 * ph * ph


def lens_bot(ph):
    return -0.03 + 0.012 * abs(ph) + 0.014 * math.exp(-((ph / 0.2) ** 2))


rows = []
for v in (0.0, 0.33, 0.66, 1.0):
    rows.append([hp(egg(theta_at(lens_bot(ph) + (lens_top(ph) - lens_bot(ph)) * v), ph, 0.02 + 0.004 * math.cos(ph)))
                 for ph in LP])
lens = loft("lens", rows, [LENS], closed=False, cap=False)
sol = lens.modifiers.new("thick", "SOLIDIFY")
sol.thickness = 0.003
bar = [hp(egg(theta_at(lens_top(ph) + 0.002), ph, 0.023 + 0.004 * math.cos(ph))) for ph in LP]
tube("frame", bar, 0.0035, FRAME)
for sgn in (-1, 1):
    a = hp(egg(theta_at(lens_top(sgn * 1.15)), sgn * 1.15, 0.022))
    tube("temple", [a, hp(egg(theta_at(0.0), sgn * 1.45, 0.012)), hp(egg(theta_at(-0.02), sgn * 1.75, 0.008))],
         0.003, FRAME)

# ---------------------------------------------------------------- the SCARF
# A long knit scarf, wound once round the throat over the collar and knotted
# at his left, its two tails loose: one down the chest, the other over the
# shoulder and down the back. The wrap rides the chest; each tail is a
# ribbon skinned along its own chain of bones (`retro-look.ts`'s
# `RETRO_CHAINS`), laid at rest along the suit, which the game swings.
rides("chest")
LEFT = -SX  # his left (the body frame's −x)
nc = neck.lerp(head_c, 0.12)
wrap = []
for k in range(12 if GAME else 20):
    a = 2 * math.pi * k / (12 if GAME else 20)
    wrap.append(nc + SX * (0.098 * math.cos(a)) + CHEST * (0.094 * math.sin(a)) + UP_S * (0.012 * math.sin(2 * a)))
tube("wrap", wrap, 0.026, KNIT, closed=True)
wrap2 = [p + UP_S * 0.03 + (p - nc).normalized() * -0.008 for p in wrap]
tube("wrap", wrap2, 0.022, KNIT2, closed=True)
knot_at = nc + CHEST * 0.088 + LEFT * 0.05 - UP_S * 0.018
ellipsoid("knot", knot_at, (0.04, 0.035, 0.032), KNIT)


def tail_line(back_side, n=40):
    """The tail's line at rest: from the knot down the chest (or over the
    shoulder and down the back), kept just off the suit."""
    pts = [knot_at]
    if back_side:
        pts.append(nc + LEFT * 0.12 + UP_S * 0.03)
        start = 0.92
    else:
        start = 0.95
    for k in range(n + 1):
        lv = start - 0.9 * k / n
        across, ahead, behind = trunk_at(lv)
        off = (-(behind + 0.016) * CHEST) if back_side else ((ahead + 0.016) * CHEST)
        pts.append(on_trunk(lv) + off + LEFT * (0.07 if back_side else 0.055))
    return pts


def resample_to(pts, length, n):
    """`n + 1` points `length / n` apart along the line."""
    seg = [(pts[i + 1] - pts[i]).length for i in range(len(pts) - 1)]
    out = []
    for k in range(n + 1):
        d = length * k / n
        i = 0
        while i < len(seg) - 1 and d > seg[i]:
            d -= seg[i]
            i += 1
        out.append(pts[i].lerp(pts[i + 1], min(1.0, d / seg[i])))
    return out


def chain_weights(name, links, length, start):
    """A tail's vertex shared between its chain's two nearest bones by its
    distance down the tail (`u`, stashed in the vertex's own position
    along the line), tent-wise about each bone's middle."""
    def fn(co):
        u = min(max(TAILS_U[name](co), 0.0), length - 1e-6) / (length / links)
        c = u - 0.5
        k0 = math.floor(c)
        sh = c - k0
        w = {}
        for k, x in ((k0, 1 - sh), (k0 + 1, sh)):
            k = min(max(k, 0), links - 1)
            w[f"{name}_{k}"] = w.get(f"{name}_{k}", 0.0) + x
        return w
    return fn


TAILS_U = {}
WIDTH = 0.15
for name, links, length in CHAINS[:2]:
    back_side = name == "scarf_b"
    line = resample_to(tail_line(back_side), length, links * 6)
    joints = line[::6]
    for k in range(links):
        bone(f"{name}_{k}", joints[k], joints[k + 1], extras={"chain": name},
             roll_to=(-CHEST if back_side else CHEST))
    # The ribbon: flat across his body, its fringe at the foot.
    rows = []
    for k, p in enumerate(line):
        flare = 1.0 + 0.08 * k / len(line)
        nrm = (-CHEST if back_side else CHEST)
        rows.append([p + LEFT * (WIDTH / 2 * flare * x) + nrm * (0.006 * abs(x) * 0) for x in (-1, -0.33, 0.33, 1)]
                    + [p + LEFT * (WIDTH / 2 * flare * x) - nrm * 0.012 for x in (1, 0.33, -0.33, -1)])
    stripe_of = lambda c, ln=line: 1 if int((min(range(len(ln)), key=lambda i: (ln[i] - c).length) / len(ln)) * 9) % 2 else 0
    ob = loft(f"tail_{name}", rows, [KNIT, KNIT2], face_mat=stripe_of)

    def u_of(co, ln=line, L=length):
        i = min(range(len(ln)), key=lambda i: (ln[i] - co).length)
        return L * i / (len(ln) - 1)
    TAILS_U[f"tail_{name}"] = u_of
    TAILS_U[name] = u_of
    weights(ob, chain_weights(name, links, length, 0))
    # The fringe: tassels hanging off the end.
    end, before = line[-1], line[-2]
    down = (end - before).normalized()
    for x in [-0.9 + 1.8 * k / (5 if GAME else 9) for k in range(6 if GAME else 10)]:
        a = end + LEFT * (WIDTH / 2 * x)
        t = tube(f"fringe_{name}", [a, a + down * 0.06], 0.004, KNIT2)
        weights(t, (lambda co, nm=name, ln=links: {f"{nm}_{ln - 1}": 1.0}))

# The bobble's stalk: one bone up off the crown, the bobble riding it — a
# ball of yarn, its tufts jittered.
rides("head")
bone("bobble_0", top, top + hy * 0.07, extras={"chain": "bobble"}, roll_to=hz)
rides("bobble_0")
bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=2 if GAME else 4, radius=0.046)
for v in bm.verts:
    v.co *= 1.0 + 0.12 * (rnd.random() - 0.5) + 0.06 * math.sin(v.co.x * 160) * math.sin(v.co.y * 170)
me = bpy.data.meshes.new("bobble")
bm.to_mesh(me)
bm.free()
me.materials.append(BOBBLE)
bob = link(bpy.data.objects.new("bobble", me))
bob.location = top + hy * 0.026
for p in me.polygons:
    p.use_smooth = True

# ---------------------------------------------------------------- GAITERS and GLOVES
# `skier.py`'s: the suit's inner gaiter down over the boot's cuff, the foot
# in the boot's liner, the gloves closed round the pole grips.
for i, s in enumerate("lr"):
    f, bx, by, bz, _ = frame(f"boot_{s}")
    rides(f"shin_{s}")
    up_shin = (knees[i] - feet[i]).normalized()
    sh = frame(f"shin_{s}")
    shaft = [(0.0, 0.066, 0.078, 0.074), (0.1, 0.07, 0.078, 0.074), (0.18, 0.074, 0.08, 0.076),
             (0.24, 0.07, 0.074, 0.07)]
    loft("gaiter", [[f + bz * -0.03 + up_shin * u + sh[1] * (w * math.cos(a))
                     + sh[3] * ((fr if math.sin(a) > 0 else bk) * math.sin(a))
                     for a in (2 * math.pi * k / 16 for k in range(16))] for u, w, fr, bk in shaft], [SUIT])
    rides(f"boot_{s}")
    o, fx_, fy_, fz_, _ = frame(f"boot_{s}")
    lean = 0.22

    def down(d):
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
    rides(f"forearm_lo_{s}")
    e, fx, fy, fz, fl = frame(f"forearm_{s}")
    wrist_t = ANSUR["forearm_length"] * MM / fl
    # A short leather cuff over the knitted cuff: the period's glove.
    cyl("gauntlet", e + fy * (fl * (wrist_t - 0.12)), e + fy * (fl * (wrist_t - 0.0)), 0.05, GLOVE, r2=0.044)
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
# THE SUIT'S FABRIC, as `skier.py`'s: a height at every point of the suit —
# a fine nylon weave over everything, the upper body QUILTED in channels
# round him a hand apart over the padding, the long front ZIP from the
# collar to the crotch, side seams down the legs — shaded in the studio,
# and in the game's build BAKED onto the suit's unwrap as a DETAIL map (the
# fabric's shade times the occlusion) and a NORMAL map. The colourway is
# the materials' own; the maps are white and flat but for the fabric.
TEX = 1024 if GAME else 0
UP = UP_S


def cloth_height(nt, quilted):
    n = nt.nodes
    co = n.new("ShaderNodeTexCoord")

    def wave(axis, scale):
        w = n.new("ShaderNodeTexWave")
        w.wave_type, w.bands_direction = "BANDS", axis
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

    grid = op("POWER", op("MINIMUM", wave("X", 52.0), wave("Y", 52.0)), 0.3)
    if quilted:
        chan = op("POWER", wave("Z", 4.2), 0.35)
        return op("ADD", op("MULTIPLY", chan, 0.8), op("MULTIPLY", grid, 0.2))
    return op("ADD", op("MULTIPLY", grid, 0.5), 0.3)


def cloth_shader(m, image_detail=None, image_normal=None):
    nt = m.node_tree
    p = nt.nodes.get("Principled BSDF")
    rgb = tuple(p.inputs["Base Color"].default_value)
    tint = nt.nodes.new("ShaderNodeMix")
    tint.data_type, tint.blend_type = "RGBA", "MULTIPLY"
    tint.inputs["Factor"].default_value = 1.0
    tint.inputs[7].default_value = rgb
    if image_detail is None:
        h = cloth_height(nt, m is not BELT)
        shade = nt.nodes.new("ShaderNodeMapRange")
        shade.inputs["To Min"].default_value = 0.82
        nt.links.new(h, shade.inputs["Value"])
        nt.links.new(shade.outputs["Result"], tint.inputs[6])
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.5
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


KIT_RGB = {m.name: tuple(m.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value)[:3] for m in CLOTHS}
ROUGH = {"suit": 0.42, "yoke": 0.42, "stripe": 0.42, "belt": 0.5}


def _bake(kind, image, **kw):
    for m in CLOTHS:
        t = m.node_tree.nodes.new("ShaderNodeTexImage")
        t.image = image
        for nd in m.node_tree.nodes:
            nd.select = False
        t.select = True
        m.node_tree.nodes.active = t
    bpy.ops.object.bake(type=kind, margin=8, **kw)


def _emitting(colour_of):
    for m in CLOTHS:
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
    """The suit's construction as a height and a shade at every texel, off
    where on him it lies (`P`), which way it faces (`N`) and which block
    it is (`G`: 0 suit, 1 yoke, 2 stripe, 3 belt and cuffs)."""
    import numpy as np
    S = np.ones(P.shape[:2], dtype=np.float32)
    H = np.full(P.shape[:2], 0.5, dtype=np.float32)
    v3 = lambda v: np.array([v.x, v.y, v.z], dtype=np.float32)
    up, across, ahead = v3(UP), v3(SX), v3(CHEST)
    h0 = v3(hips)
    rel = P - h0
    lvl = rel @ up / SPINE_L
    side = rel @ across
    nf, ns = N @ ahead, N @ across

    def ridge(d, w):
        return np.exp(-((d / w) ** 2))

    def seam(d, along, live):
        welt = 0.3 * ridge(d, 0.004)
        stitch = -0.25 * (ridge(np.abs(d) - 0.0065, 0.0012)) * (0.5 + 0.5 * np.cos(2 * np.pi * along / 0.004))
        return np.where(live, welt + stitch, 0.0)

    # THE WEAVE: a fine nylon taffeta, 6 mm.
    grid = np.minimum(np.abs(np.sin(np.pi * P[..., 0] / 0.006)), np.abs(np.sin(np.pi * P[..., 2] / 0.006))) ** 0.3
    H += 0.05 * (grid - 0.5)
    trunkish = (lvl > 0.28) & (lvl < 1.02) & (np.abs(side) < 0.32)
    # THE QUILTING over the chest, the back and the shoulders: channels a
    # hand apart round him, stitched, each puffed between its lines.
    quilt = np.abs(np.sin(np.pi * (lvl * SPINE_L) / 0.07)) ** 0.4
    H += np.where(trunkish & (G < 3), 0.28 * (quilt - 0.6), 0.0)
    S *= np.where(trunkish & (G < 3), 0.9 + 0.1 * quilt, 1.0)
    # A SEAM along the edge of every colour block: where G changes is where
    # a panel is sewn to the next; the map finds it by the block's own
    # neighbourhood.
    edge = np.zeros_like(H, dtype=bool)
    edge[1:, :] |= G[1:, :] != G[:-1, :]
    edge[:, 1:] |= G[:, 1:] != G[:, :-1]
    H += np.where(edge, -0.2, 0.0)
    S = np.where(edge, S * 0.8, S)
    # THE FRONT ZIP: collar to crotch down the middle of the front.
    front = (nf > 0.3) & (lvl > -0.12) & (lvl < 1.0) & (np.abs(side) < 0.2)
    on = front & (np.abs(side) < 0.006)
    H += np.where(on, 0.25 + 0.2 * (np.cos(2 * np.pi * lvl * SPINE_L / 0.0035) > 0), 0.0)
    S = np.where(on, S * 0.55, S)
    H += np.where(front & (np.abs(np.abs(side) - 0.012) < 0.002), -0.2, 0.0)
    # The BELT's leather: a grain, and its edges stitched.
    belt = G == 3
    rng = np.random.default_rng(3)
    H += np.where(belt, 0.04 * (rng.random(H.shape, dtype=np.float32) - 0.5), 0.0)
    # The legs' SIDE SEAMS: down the outside of each, by the stripe's edge.
    leg = lvl < -0.05
    H += seam(ns * 0.08 - np.sign(side) * 0.07, lvl * SPINE_L, leg & (np.abs(ns) > 0.85))
    return np.clip(H, 0, 1), np.clip(S, 0, 1)


def bake_cloth():
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
    for l in suit.data.uv_layers.active.data:
        l.uv = (l.uv[0] * 0.97, l.uv[1] * 0.97)
    detail = bpy.data.images.new("suit_detail", TEX, TEX)
    normal = bpy.data.images.new("suit_normal", TEX, TEX, is_data=True)
    normal.colorspace_settings.name = "Non-Color"

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

    def block(m, nt):
        rgb = nt.nodes.new("ShaderNodeRGB")
        g = (CLOTHS.index(m) + 0.5) / 4
        rgb.outputs[0].default_value = (g, g, g, 1)
        return rgb.outputs[0]
    _emitting(block)
    _bake("EMIT", which)
    P = (_pixels(where)[..., :3] - 0.5) / 0.25
    N = _pixels(facing)[..., :3] * 2 - 1
    N /= np.maximum(1e-6, np.linalg.norm(N, axis=-1, keepdims=True))
    G = np.clip(np.floor(_pixels(which)[..., 0] * 4), 0, 3).astype(np.int64)
    H, S = garment_height(P, N, G)
    height, shade = float_map("suit_height"), float_map("suit_shade")
    height.pixels.foreach_set(np.dstack([H, H, H, np.ones_like(H)]).ravel())
    shade.pixels.foreach_set(np.dstack([S, S, S, np.ones_like(S)]).ravel())

    def tex(nt, image):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = image
        t.interpolation = "Linear"
        return t

    def shaded(m, nt):
        ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
        ao.inputs["Distance"].default_value = 0.25
        # The suit's own folds only: the scarf, the hair and the hat lie
        # over it in the bind pose but fly off it in the wind, and a shade
        # baked under them would ride on his back as a dark patch.
        ao.only_local = True
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        nt.links.new(tex(nt, shade).outputs["Color"], mul.inputs[0])
        nt.links.new(ao.outputs["AO"], mul.inputs[1])
        return mul.outputs[0]
    _emitting(shaded)
    _bake("EMIT", detail)
    for m in CLOTHS:
        nt = m.node_tree
        for nd in list(nt.nodes):
            if nd.type != "OUTPUT_MATERIAL":
                nt.nodes.remove(nd)
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 1.0
        bump.inputs["Distance"].default_value = 0.005
        nt.links.new(tex(nt, height).outputs["Color"], bump.inputs["Height"])
        dif = nt.nodes.new("ShaderNodeBsdfDiffuse")
        nt.links.new(bump.outputs["Normal"], dif.inputs["Normal"])
        nt.links.new(dif.outputs["BSDF"], nt.nodes.get("Material Output").inputs["Surface"])
    _bake("NORMAL", normal, normal_space="TANGENT")
    for img, px in ((detail, (1.0, 1.0, 1.0, 1.0)), (normal, (0.5, 0.5, 1.0, 1.0))):
        pix = _pixels(img)
        lo = int(TEX * 0.975)
        pix[lo:, lo:] = px
        img.pixels.foreach_set(pix.ravel())
        img.pack()
    for im in (where, facing, which, height, shade):
        bpy.data.images.remove(im)
    for m in CLOTHS:
        nt = m.node_tree
        for nd in list(nt.nodes):
            if nd.type != "OUTPUT_MATERIAL":
                nt.nodes.remove(nd)
        p = nt.nodes.new("ShaderNodeBsdfPrincipled")
        p.name = "Principled BSDF"
        p.inputs["Roughness"].default_value = ROUGH[m.name]
        p.inputs["Base Color"].default_value = (*KIT_RGB[m.name], 1.0)
        nt.links.new(p.outputs["BSDF"], nt.nodes.get("Material Output").inputs["Surface"])
        cloth_shader(m, detail, normal)
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
    for m in CLOTHS:
        cloth_shader(m)

# Every part but the face carries a white colour attribute, so the joined
# skin's one attribute is the face's shades and white elsewhere.
for o in COL.objects:
    if o.type == "MESH" and o is not face_ob and "Col" not in o.data.color_attributes:
        c = o.data.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
        for d in c.data:
            d.color = (1, 1, 1, 1)

floor = min(f.z for f in feet) - 0.06
finish(os.path.basename(argv[0]).removesuffix(".json"), OUT, SAMPLES,
       centre=(0, hips.y + 0.1, floor + 0.88), size=3.1, floor=floor, extras={"frame": "body"})

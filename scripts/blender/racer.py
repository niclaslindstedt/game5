# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE TOP-LEVEL RACER MODELLED IN BLENDER, as a man (`racer`) or a woman
# (`racer-woman`): a national team's printed one-piece race suit over a back
# protector, the start bib over it, the slalom's hard shin guards, forearm
# pads and the poles' knuckle shields, a gloss race helmet with its chin
# guard and mirrored goggles, race gloves — built off the game's own data
# (`kinds/racer.mjs`): the body (`BODY`), the pose the dressed skier is
# bound in and every bone's frame in it (`dress-loft.ts`'s `bindPose`), the
# head in its helmet as the game's own triangles (`helmet-shape.ts`'s
# `helmetParts`), the person's sex and colours (`outfit.ts`'s `BODIES`) and
# the survey the body is cut to (`dress-body.ts`'s `SURVEY`). A woman is cut
# to the women's survey on the very same bones and wears her braid out from
# under the helmet, down her back over the bib.
#
# The frame is the skier's (`skier.py`): the body frame (x right, y up, z
# forward, the origin at the centre of gravity) laid as Blender's
# (-x, z, y); his sides are the ENGINE's (`_l` the body's x negative).
#
# WHAT A TECHNICAL RACER WEARS, after start lists, finish areas and the
# federation's equipment rules (kept local, never committed or named):
#
#   * a ONE-PIECE SUIT, skin tight and PRINTED: the trunk, the shoulders and
#     the arms in the team's red, a thread of white down the outside of each
#     upper arm, the red FADING down the thighs through a warm coral into
#     white by the knee (lower behind than in front), the forearms' inside
#     fading to white toward the cuff, the shins white with a cool grey cast;
#     a dark collar and cuffs;
#   * a BACK PROTECTOR under it, the long low hump from the shoulder blades
#     to the small of the back;
#   * the BIB over it, a yellow tabard open at the sides, its number big on
#     the chest and the back, the race's name in a row of marks over it, a
#     white band of marks along its foot;
#   * SHIN GUARDS, a hard fluorescent shell down the front of each shin over
#     the boot's cuff, black along its edges, strapped round the calf; ARM
#     PADS, low black shells down the outside of each forearm; the poles'
#     KNUCKLE SHIELDS bowed in front of each fist;
#   * a gloss red SLALOM HELMET with a white crown band, its CHIN GUARD on
#     two hinges, mirrored goggles; red race gloves, dark in the palm.
#
# What a discipline leaves off is the game's to say (`player-model.ts`'s
# kit, by these materials' names): a giant slalom's racer the shin guards,
# the shields and the chin guard; a speed racer the arm pads too, and he
# carries the AIRBAG speed events require under his suit — a fuller collar
# and yoke (`airbag`), drawn only on a speed pair.
#
# Every vertex's colour is its material's — or the PRINT's, worked out at
# that point in his own terms (up the spine, round each limb) — darkened by
# its own occlusion, so the game draws the model in one vertex-coloured skin
# as it draws the dressed one (`player-model.ts`). The bib's number and
# marks are thin decals laid on it, so they stay sharp with no texture. How
# loose a point is (the bib's hem and open sides, the braid's tail) rides the
# UV's u (`FLUTTER`), and how much of it is the skin-tight suit that shivers
# in the air the UV's v (`SHIVER`); the game's shader moves both.

import json, math, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
POSE, FRAMES, HELM = DATA["rest"]["pose"], DATA["rest"]["bones"], DATA["helmet"]
PERSON = DATA["person"]
FEMALE = bool(PERSON["female"])


def B(p):
    """A point or direction of the body frame, in Blender's."""
    return Vector((-p["x"], p["z"], p["y"]))


def srgb(hexa):
    """An sRGB colour as linear."""
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 for c in ((hexa >> 16) & 255, (hexa >> 8) & 255, hexa & 255))


# ---------------------------------------------------------------- materials
# THE TEAM'S COLOURS (sRGB): its red, the coral the red fades through, the
# suit's white and the cool grey low on the legs, the dark of the collar and
# the guards' edges, the bib's yellow and the guards' fluorescent yellow
# (more saturated than a photograph reads: the game's tone map pales it).
RED, CORAL, WHITE, MIST, DARK = 0xD9101C, 0xF06A55, 0xF4F5F7, 0xD9DEE6, 0x15171C
YELLOW, NEON = 0xF3D51C, 0xC6EC00
KIT = {
    # The cloth.
    "suit": (RED, 0.42, 0.0), "suit_dark": (DARK, 0.5, 0.0), "airbag": (RED, 0.42, 0.0),
    "bib": (YELLOW, 0.7, 0.0), "bib_band": (WHITE, 0.7, 0.0), "bib_print": (0x101114, 0.7, 0.0),
    "bib_red": (RED, 0.7, 0.0), "stripe": (WHITE, 0.42, 0.0),
    "guard_strap": (0x101114, 0.7, 0.0), "glove": (0xC8141C, 0.55, 0.0), "palm": (0x1A1B1F, 0.8, 0.0),
    "liner": (0x2B2E34, 0.85, 0.0), "skin": (PERSON["skin"], 0.6, 0.0),
    "knit": (PERSON["hair"], 0.9, 0.0), "plait": (PERSON["plait"], 0.9, 0.0), "trim": (0x15110E, 0.6, 0.0),
    # The hard goods: the helmet and its goggles, the guards, the shields.
    "helmet": (RED, 0.18, 0.0), "peak": (WHITE, 0.22, 0.0), "chin": (0x121316, 0.3, 0.0),
    "chin_guard": (0x121316, 0.3, 0.0), "lens": (0x3FA9F5, 0.06, 0.75),
    "shin_guard": (NEON, 0.28, 0.0), "guard_edge": (0x101114, 0.35, 0.0),
    "arm_guard": (0x0E0F12, 0.22, 0.0), "shield": (NEON, 0.25, 0.0),
}
M = {}
for name, (hexa, rough, metal) in KIT.items():
    m = mat(name, srgb(hexa), rough=rough, metal=metal)
    # The colour lives in the vertex colour (`paint`): the material shows
    # what it is handed, so the studio and the game draw one colour.
    nt = m.node_tree
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    nt.links.new(attr.outputs["Color"], nt.nodes.get("Principled BSDF").inputs["Base Color"])
    M[name] = m
FLUTTER = {}   # object name -> fn(co) -> 0..1, how loose a point is
SHIVER = set()  # objects of the skin-tight suit, which shivers in the air
PRINT = {}     # material name -> fn(co, normal) -> linear rgb, the print at a point


# ---------------------------------------------------------------- the RIG
def frame(name):
    """A bone's frame — or the TRUNK's ("spine"): the chord from the hips to
    the neck, facing the chest (as `skier.py`)."""
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
SEGMENTS = {n: (frame(n)[0], frame(n)[0] + frame(n)[2] * frame(n)[4]) for n in FRAMES
            if n not in ("pelvis", "chest") and n not in HALF.values() and "_lo_" not in n}
SEGMENTS["spine"] = (frame("spine")[0], frame("spine")[0] + frame("spine")[2] * frame("spine")[4])
NEAR = {"spine": ["head", "thigh_l", "thigh_r", "upperarm_l", "upperarm_r"], "head": ["spine"]}
for s in "lr":
    NEAR |= {f"thigh_{s}": ["spine", f"shin_{s}"], f"shin_{s}": [f"thigh_{s}", f"boot_{s}"],
             f"boot_{s}": [f"shin_{s}"], f"upperarm_{s}": ["spine", f"forearm_{s}"],
             f"forearm_{s}": [f"upperarm_{s}"]}
BLEND = {"hinge": 0.04, "ball": 0.075}


def along(co, seg):
    a, b = seg
    d = b - a
    t = max(0.0, min(1.0, (co - a).dot(d) / d.length_squared))
    return t, (co - (a + d * t)).length


def nearest(co, among=None):
    return min(among or SEGMENTS, key=lambda n: along(co, SEGMENTS[n])[1])


def blend(a, b):
    trunk = "spine" in (a, b)
    limb = any(n.startswith(("thigh", "upperarm")) for n in (a, b))
    return BLEND["ball"] if trunk and limb else BLEND["hinge"]


def suit_weights(co, among=None):
    """The cloth's weights, as `skier.py`'s: across a joint shared between
    the bones that meet there, the half bones laid over the pair, the trunk
    split pelvis to chest up the spine (an arm's break is the game's,
    `player-model.ts`)."""
    pool = among or [n for n in SEGMENTS if not n.startswith("boot")]
    b0 = nearest(co, pool)
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
    top = sorted(out.items(), key=lambda kv: -kv[1])[:4]
    total = sum(v for _, v in top)
    return {n: v / total for n, v in top}


# ---------------------------------------------------------------- the BODY
# The flesh round the game's bones is the skier's: ANSUR II's mean man or
# woman, the very table `dress-body.ts` cuts the code's dress to (`SURVEY`,
# handed in). A woman's trunk is shaped as the code's: the bust carrying the
# chest's depth ahead, the seat further behind, the chest narrower against
# hips as broad.
ANSUR = DATA["survey"]
MM = 0.001


def level(h):
    return (h - ANSUR["trochanterion"]) / (ANSUR["cervicale"] - ANSUR["trochanterion"])


def r_of(circ):
    return circ * MM / (2 * math.pi)


def sx(man, woman):
    """A shape factor: the man's, or the woman's (`dress-body.ts`'s ratios)."""
    return woman if FEMALE else man


# A SKIN-TIGHT SUIT: a few millimetres over the body where a padded shell
# stands two to three centimetres off it — only the back protector and the
# padding under the guards stand proud.
EASE = {"trunk": 0.006, "limb": 0.004, "cap": 0.003}

P = POSE
hips, neck, head_c = B(P["hips"]), B(P["neck"]), B(P["head"])
knees, feet = [B(k) for k in P["knees"]], [B(f) for f in P["feet"]]
shoulders, elbows, hands = [B(k) for k in P["shoulders"]], [B(k) for k in P["elbows"]], [B(k) for k in P["hands"]]
SEG = 18 if GAME else 30
SX, UP, CHEST, SPINE_L = frame("spine")[1], frame("spine")[2], frame("spine")[3], frame("spine")[4]


def T(lv, side=0.0, ahead=0.0):
    """A point of the trunk: `lv` up the spine (hips 0, neck 1), `side` m
    to his right, `ahead` m in front of the spine's line."""
    return hips + UP * (lv * SPINE_L) + SX * side + CHEST * ahead


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
    return loft(name, rings, [m or M["suit"]])


rides("chest")
pieces = []
bh = ANSUR["hip_breadth"] / 2 * MM
bd = ANSUR["buttock_depth"] * MM
wb, wd = ANSUR["waist_breadth"] / 2 * MM, ANSUR["waist_depth"] * MM
cb, cd = ANSUR["chest_breadth"] / 2 * MM, ANSUR["chest_depth"] * MM
e = EASE["trunk"]
BUST = sx(0.5, 0.6)
TRUNK = [
    (level(ANSUR["crotch"]) - 0.04, bh * 0.8 + e, bd * 0.3 + e, bd * 0.45 + e),
    (level(ANSUR["crotch"]) + 0.05, bh * sx(1, 1.05) + e, bd * 0.4 + e, bd * sx(0.52, 0.56) + e),
    (0.08, bh * sx(0.98, 1.03) + e, bd * 0.4 + e, bd * sx(0.53, 0.57) + e),
    (level(ANSUR["waist_h"]), wb * 0.96 + e, wd * 0.5 + e, wd * 0.45 + e),
    (level(ANSUR["tenth_rib_h"]), wb * 0.95 + e, wd * 0.53 + e, wd * 0.46 + e),
    (0.52, cb * 1.04 + e, cd * BUST + e, cd * 0.48 + e),
    (level(ANSUR["chest_h"]), cb * sx(1.1, 1.02) + e, cd * (BUST - 0.01) + e, cd * 0.5 + e),
    (level(ANSUR["axilla_h"]), cb * sx(1.16, 1.07) + e, cd * 0.46 + e, cd * 0.5 + e),
    (level(ANSUR["acromion_h"]) - 0.05, ANSUR["biacromial"] / 2 * MM * 0.88, cd * 0.38 + e, cd * 0.42 + e),
    (0.95, r_of(ANSUR["neck_base"]) * 1.4 + 0.01, 0.085 * sx(1, 0.92), 0.085 * sx(1, 0.92)),
    (1.0, r_of(ANSUR["neck_base"]) + 0.012, 0.072 * sx(1, 0.92), 0.072 * sx(1, 0.92)),
]
pieces.append(lofted("trunk", "spine", TRUNK, n=2.7))
# The race suit's NECK: a close stand collar up to the helmet's rim.
CR = sx(1.0, 0.92)
collar = [neck.lerp(head_c, u) for u in (0.0, 0.16, 0.3)]
pieces.append(loft("collar", [[c + SX * (0.072 * CR * math.cos(2 * math.pi * k / SEG))
                               + CHEST * (0.068 * CR * math.sin(2 * math.pi * k / SEG)) for k in range(SEG)]
                              for c in collar], [M["suit"]]))


def trunk_at(t):
    lo = max(i for i in range(len(TRUNK)) if TRUNK[i][0] <= t)
    a, b = TRUNK[lo], TRUNK[min(lo + 1, len(TRUNK) - 1)]
    k = 0 if b[0] == a[0] else (t - a[0]) / (b[0] - a[0])
    return [a[j] + (b[j] - a[j]) * k for j in range(4)]


# THE BACK PROTECTOR under the suit: a plate from between the shoulder
# blades down to the small of the back, 30 cm across at the top and 22 at
# the foot, standing 2–3 cm off the back.
plate = []
for t, half, depth in ((0.18, 0.09, 0.0), (0.28, 0.11, 0.018), (0.5, 0.13, 0.026), (0.72, 0.145, 0.026),
                       (0.84, 0.13, 0.014), (0.9, 0.1, 0.0)):
    back = trunk_at(t)[3]
    c = hips + UP * (t * SPINE_L)
    plate.append([c + SX * (math.cos(2 * math.pi * j / SEG) * half * sx(1, 0.92))
                  - CHEST * (back - 0.03 + depth + math.sin(2 * math.pi * j / SEG) * 0.025) for j in range(SEG)])
pieces.append(loft("protector", plate, [M["suit"]]))

for i, s in enumerate("lr"):
    reach = ANSUR["bideltoid"] / 2 * MM - ANSUR["biacromial"] / 2 * MM
    out = (shoulders[i] - neck.lerp(hips, 0.12)).normalized()
    pieces.append(ellipsoid("shoulder", shoulders[i] + UP * 0.008 + out * 0.003,
                            (reach + EASE["cap"] + 0.004, reach + EASE["cap"] + 0.008, reach + EASE["cap"] + 0.006), M["suit"]))
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
    pieces.append(ellipsoid("elbow", elbows[i], (b * 0.86 + l,) * 3, M["suit"]))
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
    pieces.append(ellipsoid("knee", knees[i], (lt + l + 0.003,) * 3, M["suit"]))

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
    thin.ratio = 4200 / max(1, len(suit.data.polygons) * 2)
    bpy.ops.object.convert(target="MESH")
suit.data.materials.clear()
suit.data.materials.append(M["suit"])
suit.data.materials.append(M["suit_dark"])

# THE CUT: the dark collar's rim and the cuffs, each a plane the suit is
# cut along so the colour's edge is a straight seam.
COLLAR_CUT = (neck + UP * 0.015, UP)
CUFFS = []
for s in "lr":
    h_, _, y_, _, l_ = frame(f"forearm_{s}")
    wrist_t = ANSUR["forearm_length"] * MM / l_
    CUFFS.append((h_ + y_ * (l_ * (wrist_t - 0.09)), y_))


def above(co, plane):
    return (co - plane[0]).dot(plane[1]) > 0


def near_faces(bm, at, reach):
    faces = [f for f in bm.faces if (f.calc_center_median() - at).length < reach]
    vs = {v for f in faces for v in f.verts}
    es = {e for f in faces for e in f.edges}
    return list(vs) + list(es) + faces


bm = bmesh.new()
bm.from_mesh(suit.data)
bmesh.ops.bisect_plane(bm, geom=near_faces(bm, neck, 0.16), plane_co=COLLAR_CUT[0], plane_no=COLLAR_CUT[1])
for co, no in CUFFS:
    bmesh.ops.bisect_plane(bm, geom=near_faces(bm, co, 0.12), plane_co=co, plane_no=no)
bm.to_mesh(suit.data)
bm.free()


def suit_mat(co):
    b = nearest(co)
    if b in ("spine", "head") and above(co, COLLAR_CUT):
        return 1
    if b.startswith("forearm") and above(co, CUFFS["lr".index(b[-1])]):
        return 1
    return 0


suit.data.polygons.foreach_set("material_index", [suit_mat(p.center) for p in suit.data.polygons])
for p in suit.data.polygons:
    p.use_smooth = True
weights(suit, suit_weights)
SHIVER.add(suit.name)


# THE PRINT, at a point of the suit (sublimated, so its colour edges are
# where the design puts them, not where seams fall): worked out in his own
# terms — up the spine, along and round each limb.
C = {k: srgb(v) for k, v in dict(red=RED, coral=CORAL, white=WHITE, mist=MIST).items()}


def mix(a, b, k):
    return tuple(a[j] + (b[j] - a[j]) * k for j in range(3))


def fade(k):
    """THE TEAM'S FADE: red at `k` 0, through the coral to white at 1."""
    k = max(0.0, min(1.0, k))
    k = k * k * (3 - 2 * k)
    return mix(C["red"], C["coral"], k * 2) if k < 0.5 else mix(C["coral"], C["white"], k * 2 - 1)


def suit_print(co, no):
    b = nearest(co, [n for n in SEGMENTS if n.startswith(("thigh", "shin", "upperarm", "forearm")) or n == "spine"])
    t = along(co, SEGMENTS[b])[0]
    if b == "spine":
        up = (co - hips).dot(UP)
        # Low on the hips the red already warms toward the legs' fade.
        return fade((0.08 * SPINE_L - up) / (0.5 * SPINE_L) * 0.18) if up < 0.08 * SPINE_L else C["red"]
    head, x, y, z, length = frame(b)
    rr = co - head
    if b.startswith("upperarm"):
        return C["red"]
    if b.startswith("forearm"):
        i = "lr".index(b[-1])
        out = x if x.dot(shoulders[i] - neck) > 0 else -x
        inside = max(0.0, -rr.dot(out) / max(1e-6, (rr - y * rr.dot(y)).length))
        return fade(max(0.0, min(1.0, (t - 0.15) / 0.75)) * (0.35 + 0.65 * inside) * 1.1)
    ahead = rr.dot(z) / max(1e-6, (rr - y * rr.dot(y)).length)
    if b.startswith("thigh"):
        # Red at the hip, coral by mid-thigh, white by the knee — lower behind.
        return fade((t - 0.3 - 0.12 * ahead) / 0.7)
    # THE SHIN: white, a cool grey cast low behind.
    mist = max(0.0, min(1.0, (t - 0.25) / 0.5)) * (1.0 if ahead < 0.3 else 0.0)
    return mix(C["white"], C["mist"], mist)


PRINT["suit"] = suit_print
PRINT["airbag"] = suit_print
suit_bvh = BVHTree.FromObject(suit, bpy.context.evaluated_depsgraph_get())


def on_suit(p, off, among=None):
    """`p` moved onto the suit along the ray out from its limb's line (or
    the spine's), `off` m proud."""
    a, b = SEGMENTS[nearest(p, among)]
    d = b - a
    t = max(0.0, min(1.0, (p - a).dot(d) / d.length_squared))
    o = a + d * t
    ray = (p - o).normalized()
    hit = suit_bvh.ray_cast(o, ray, 1.0)[0]
    return p if hit is None else hit + ray * off


# THE STRIPE: a thread of white down the outside of each upper arm, where
# the team prints its name — a ribbon laid on the sleeve.
for i, s in enumerate("lr"):
    h_, x_, y_, z_, l_ = frame(f"upperarm_{s}")
    out = x_ if x_.dot(shoulders[i] - neck) > 0 else -x_
    path = [on_suit(h_ + y_ * (l_ * t) + out * 0.05, 0.0015, [f"upperarm_{s}"]) for t in (0.15, 0.32, 0.5, 0.68, 0.85)]
    st = []
    for k, p in enumerate(path):
        a, c = path[max(0, k - 1)], path[min(len(path) - 1, k + 1)]
        tng = (c - a).normalized()
        n_ = (p - (h_ + y_ * (p - h_).dot(y_))).normalized()
        w_ = tng.cross(n_).normalized()
        st.append([p + w_ * 0.006, p - w_ * 0.006])
    verts = [v for r in st for v in r]
    faces = [[2 * k, 2 * k + 1, 2 * k + 3, 2 * k + 2] for k in range(len(st) - 1)]
    stripe = mesh_obj("stripe", verts, faces, [M["stripe"]])
    weights(stripe, lambda co: suit_weights(co, ["spine", "upperarm_l", "upperarm_r", "forearm_l", "forearm_r"]))

# THE AIRBAG a speed racer wears under his suit: a fuller collar and yoke
# over the shoulders and the top of the chest and back, the suit's print on
# it (drawn only on a speed pair).
bag = []
for t, k in ((0.74, 0.0), (0.82, 0.012), (0.9, 0.016), (0.97, 0.01), (1.0, 0.0)):
    _, hx, fr, bk = trunk_at(min(t, 0.999))
    c = hips + UP * (t * SPINE_L)
    ring = []
    for j in range(SEG):
        u, v = section(hx * (1 - 0.35 * max(0.0, t - 0.9) / 0.1), fr, bk, 2.7, 2 * math.pi * j / SEG)
        r = Vector((u, v))
        r = r + r.normalized() * (k + 0.004)
        ring.append(c + SX * r.x + CHEST * r.y)
    bag.append(ring)
airbag = loft("airbag", bag, [M["airbag"]], cap=False)
weights(airbag, lambda co: suit_weights(co, ["spine", "head"]))

# ---------------------------------------------------------------- the BIB
# THE BIB: a tabard of light knit, a front and a back panel joined over the
# shoulders, open at the sides, laid a centimetre off the suit and hanging
# to the top of his hips. Its rows at the white foot band's edges, so the
# band's colour edge is a row of the cloth.
BIB_ROWS = (0.1, 0.14, 0.24, 0.32, 0.44, 0.56, 0.66, 0.74, 0.8, 0.85, 0.88)
BAND = (0.14, 0.24)
BIB_COLS = 11 if GAME else 17
BIB_OFF = 0.013


def bib_point(t, a, lift=0.0):
    """A point on the bib at level `t` up the spine and angle `a` round it
    (0 his right, π/2 the chest), off the suit — and over the back
    protector's hump behind."""
    _, hx, front, back = trunk_at(t)
    u, v = section(hx, front, back, 2.7, a)
    if v < 0 and 0.15 < t < 0.93:
        v -= 0.03 * math.sin(math.pi * (t - 0.15) / 0.78) * max(0.0, -math.sin(a))
    r = Vector((u, v))
    rn = r.normalized() if r.length > 1e-6 else Vector((0, 1))
    u, v = u + rn.x * (BIB_OFF + lift), v + rn.y * (BIB_OFF + lift)
    return hips + UP * (t * SPINE_L) + SX * u + CHEST * v


def reach_at(t):
    """How far round from the middle the panel reaches at a level, rad."""
    return 1.02 if t < 0.74 else 1.02 - (t - 0.74) * 2.2


def panel(front):
    verts = []
    for t in BIB_ROWS:
        for ci in range(BIB_COLS):
            c = ci / (BIB_COLS - 1)
            a = math.pi / 2 + (c - 0.5) * 2 * reach_at(t)
            verts.append(bib_point(t, a if front else -a))
    return verts


def clear_of_suit(vs, off=BIB_OFF):
    """Every point lifted to at least `off` m off the suit as built (its
    remeshed shoulders and chest bulge past the analytic section), so no
    pose shows the suit through the bib — further up the chest, where the
    suit's bumps fall between the panel's coarse rows."""
    out = []
    for p in vs:
        t = (p - hips).dot(UP) / SPINE_L
        k = max(0.0, min(1.0, (t - 0.6) / 0.2))
        off_ = off + 0.012 * k * k * (3 - 2 * k)
        at, n, _, _ = suit_bvh.find_nearest(p)
        if at is not None and (p - at).dot(n) < off_:
            p = at + n * off_
        out.append(p)
    return out


verts, faces, fmat = [], [], []
for front in (True, False):
    base = len(verts)
    verts += panel(front)
    for r in range(len(BIB_ROWS) - 1):
        band = BAND[0] <= (BIB_ROWS[r] + BIB_ROWS[r + 1]) / 2 <= BAND[1]
        for c in range(BIB_COLS - 1):
            a = base + r * BIB_COLS + c
            q = [a, a + 1, a + 1 + BIB_COLS, a + BIB_COLS]
            faces.append(q if front else q[::-1])
            fmat.append(1 if band else 0)
# THE SHOULDER STRAPS: from each panel's top corner over the shoulder to the
# other's.
top = len(BIB_ROWS) - 1
for side in (0, BIB_COLS - 1):
    fa = top * BIB_COLS + side
    ba = len(BIB_ROWS) * BIB_COLS + top * BIB_COLS + side
    fb, bb = fa + (1 if side == 0 else -1), ba + (1 if side == 0 else -1)
    mids = []
    for k in (1, 2):
        u = k / 3
        lift = UP * (0.028 * math.sin(math.pi * u))
        mids.append((verts[fa].lerp(verts[ba], u) + lift, verts[fb].lerp(verts[bb], u) + lift))
    i0 = len(verts)
    for ma, mb in mids:
        verts += [ma, mb]
    chain = [(fa, fb), (i0, i0 + 1), (i0 + 2, i0 + 3), (ba, bb)]
    for (a0, a1), (b0, b1) in zip(chain, chain[1:]):
        faces.append([a0, a1, b1, b0])
        fmat.append(0)
verts = clear_of_suit(verts)
bib = mesh_obj("bib", verts, faces, [M["bib"], M["bib_band"]], face_mats=fmat)
solid = bib.modifiers.new("cloth", "SOLIDIFY")
solid.thickness, solid.offset = 0.0025, 1.0


# Weighted as the suit UNDER it is, so the two bend as one.
def under_suit(co):
    at, _, _, _ = suit_bvh.find_nearest(Vector(co))
    return suit_weights(at if at is not None else co)


weights(bib, under_suit)
TOP_T, HEM_T = 0.86, BIB_ROWS[0]


def bib_free(co):
    """HOW FREE A POINT OF THE BIB IS (0 pinned, 1 its loose hem's corner):
    held at the shoulders, free toward its hem, freest at its open sides."""
    t = (co - hips).dot(UP) / SPINE_L
    down = max(0.0, min(1.0, (TOP_T - t) / (TOP_T - HEM_T)))
    down = down * down * (3 - 2 * down)
    across = min(1.0, abs((co - hips).dot(SX)) / 0.16)
    return down ** 1.4 * (0.55 + 0.45 * across * across)


FLUTTER["bib"] = bib_free

# THE BIB'S PRINT as decals laid a millimetre and a half off its face: the
# number big on the chest and the back, the race's name a row of small
# marks over it, and on the white foot band a red chevron and four blocks.
bib_bvh = None


def bib_surface():
    global bib_bvh
    if bib_bvh is None:
        bib_bvh = BVHTree.FromObject(bib, bpy.context.evaluated_depsgraph_get())
    return bib_bvh


def on_bib(t, a):
    """The bib's outer face at level `t`, angle `a`: cast from the spine."""
    p = bib_point(t, a, 0.03)
    o = hips + UP * (t * SPINE_L)
    ray = (p - o).normalized()
    hit = bib_surface().ray_cast(p + ray * 0.05, -ray, 0.2)[0]
    return (hit if hit is not None else p) + ray * 0.0025


def decal(name, quads, front, m):
    """Flat quads in the panel's own terms — (x across 0..1 from his right
    as read from outside, y up the panel 0..1) — each cut into a few rows so
    it follows the bib's curve, laid on the bib."""
    vs, fs = [], []
    for q in quads:
        # Cut fine enough that a wide stroke's chords never sink into the
        # bib's curve over the chest.
        n = 5
        rows = []
        for r in range(n + 1):
            k = r / n
            left = (q[0][0] + (q[3][0] - q[0][0]) * k, q[0][1] + (q[3][1] - q[0][1]) * k)
            right = (q[1][0] + (q[2][0] - q[1][0]) * k, q[1][1] + (q[2][1] - q[1][1]) * k)
            row = []
            for cc in range(n + 1):
                j = cc / n
                X, Y = left[0] + (right[0] - left[0]) * j, left[1] + (right[1] - left[1]) * j
                t = BIB_ROWS[0] + Y * (BIB_ROWS[-1] - BIB_ROWS[0])
                # Read from outside: the front from his left across (as one
                # facing him reads it), the back from his right.
                X = 1.0 - X
                ang = math.pi / 2 + (X - 0.5) * 2 * reach_at(t) if front else -(math.pi / 2 + (0.5 - X) * 2 * reach_at(t))
                row.append(on_bib(t, ang))
            rows.append(row)
        base = len(vs)
        for row in rows:
            vs += row
        for r in range(n):
            for cc in range(n):
                a = base + r * (n + 1) + cc
                fs.append([a + n + 1, a + n + 2, a + 1, a])
    ob = mesh_obj(name, vs, fs, [m], recalc=False)
    weights(ob, under_suit)
    return ob


def box_q(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


# The number — a 7: its top bar and its stroke down to the left.
SEVEN = [box_q(0.3, 0.74, 0.7, 0.82), [(0.53, 0.33), (0.62, 0.33), (0.71, 0.74), (0.6, 0.74)]]
MARKS = [box_q(0.24 + k * 0.077, 0.86, 0.28 + k * 0.077, 0.92) for k in range(7)]
CHEV = [[(0.18, 0.07), (0.24, 0.07), (0.3, 0.118), (0.24, 0.118)], [(0.24, 0.118), (0.3, 0.118), (0.24, 0.165), (0.18, 0.165)]]
BLOCKS = [box_q(0.4 + k * 0.11, 0.09, 0.47 + k * 0.11, 0.145) for k in range(4)]
for front in (True, False):
    for nm, quads, m in (("bib_number", SEVEN, "bib_print"), ("bib_marks", MARKS, "bib_print"),
                         ("bib_chevron", CHEV, "bib_red"), ("bib_blocks", BLOCKS, "bib_print")):
        ob = decal(nm, quads, front, M[m])
        FLUTTER[ob.name] = bib_free

# ---------------------------------------------------------------- the HEAD
# The head in its race helmet as the game's own triangles (`helmetParts`):
# its gloss shell with a white crown band, the goggles, the face.
rides("head")
hc, hx, hy, hz, _ = frame("head")
HPAINT = {"shell": "helmet", "stripe": "peak", "frame": "peak", "band": "chin", "trim": "guard_strap",
          "strap": "guard_strap", "foam": "guard_strap", "liner": "liner", "knit": "knit", "lens": "lens",
          "skin": "skin"}


def head_point(p):
    return hc + hx * p[0] + hy * p[1] + hz * p[2]


for part in HELM["game" if GAME else "fine"]:
    Pp, N, I = part["position"], part["normal"], part["index"]
    hv = [head_point(Pp[k:k + 3]) for k in range(0, len(Pp), 3)]
    hf = [I[k:k + 3] for k in range(0, len(I), 3)]
    ob = mesh_obj(f"helmet_{part['material']}", hv, hf, [M[HPAINT[part["material"]]]], recalc=False)
    normals = [tuple(hx * N[k] + hy * N[k + 1] + hz * N[k + 2]) for k in range(0, len(N), 3)]
    ob.data.normals_split_custom_set_from_vertices(normals)


# The goggles' MIRROR: a ramp of light down the lens with a bright band
# across it, where the sky is caught.
def lens_print(co, no):
    v = max(0.0, min(1.0, ((co - hc).dot(hy) + 0.02) / 0.045))
    g = min(1.0, 0.5 + 0.42 * v ** 1.4 + 0.22 * math.exp(-(((v - 0.76) / 0.07) ** 2)))
    base = srgb(0x3FA9F5)
    return (base[0] * g, base[1] * g, base[2] * g)


PRINT["lens"] = lens_print

# THE CHIN GUARD: a bar from ear cover to ear cover round the chin on two
# hinges.
chin = [head_point(p) for p in ((-0.106, -0.062, 0.0), (-0.09, -0.09, 0.06), (-0.05, -0.112, 0.112),
                                (0, -0.12, 0.132), (0.05, -0.112, 0.112), (0.09, -0.09, 0.06),
                                (0.106, -0.062, 0.0))]
tube("chin_guard", chin, 0.017, M["chin_guard"], smooth_n=0 if GAME else 2)
for sd in (-1, 1):
    ellipsoid("chin_hinge", head_point((0.106 * sd, -0.062, 0.0)), (0.022, 0.026, 0.026), M["chin_guard"])

# A WOMAN'S BRAID, as the code's dress plaits it (`dress-head.ts`): out from
# under the helmet's nape and DOWN HER BACK over the bib, as a racer with no
# pack wears it. Three strands plaited: lobes in her hair's colour leaning
# side to side over a core in the partings' darker shade, a dark tie and a
# short tuft. Its top rides the head and the rest the chest, and its tail
# is loose: the air past her lifts and shakes it.
if FEMALE:
    rides("head")

    def lump(name, center, radii, m, rot=(0, 0, 0)):
        """`lib.py`'s ellipsoid on a coarser sphere (6 × 4)."""
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=6, v_segments=4, radius=1.0)
        bmesh.ops.scale(bm, vec=radii, verts=bm.verts)
        bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(center)) @ Euler(rot).to_matrix().to_4x4(), verts=bm.verts)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(m)
        for p in me.polygons:
            p.use_smooth = True
        return link(bpy.data.objects.new(name, me))

    back_d = trunk_at(0.9)[3]

    def on_back(t, off):
        """A point down the middle of her back at level `t`, laid on the bib."""
        return on_bib(t, -math.pi / 2) - CHEST * off if t <= BIB_ROWS[-1] else T(t, 0.0, -(back_d + BIB_OFF + off))

    path = catmull([head_point((0.0, -0.04, -0.105)), head_point((0.0, -0.1, -0.1)),
                    T(1.0, 0.0, -(back_d * 0.8 + 0.03)), on_back(0.86, 0.012), on_back(0.76, 0.012),
                    on_back(0.66, 0.012)], n=4)
    L = sum((b - a).length for a, b in zip(path, path[1:]))
    top = path[0]
    core = tube("braid_core", path, 0.0105, M["plait"], smooth_n=0)

    def at_len(u):
        acc = 0.0
        for a, b in zip(path, path[1:]):
            seg = (b - a).length
            if acc + seg >= u:
                return a.lerp(b, (u - acc) / seg), (b - a).normalized()
            acc += seg
        return path[-1], (path[-1] - path[-2]).normalized()

    lobes = []
    for q in range(int((L - 0.05) / 0.03)):
        u = 0.02 + q * 0.03
        c, t = at_len(u)
        w = 1.0 - 0.45 * u / L
        side = t.cross(CHEST).normalized()
        lean = side * (0.006 * (1 if q % 2 else -1))
        rot = (t.to_track_quat("Z", "Y") @ Quaternion(t, 0.5 if q % 2 else -0.5)).to_euler()
        lobes.append(lump("braid", c + lean, (0.02 * w, 0.015 * w, 0.024), M["knit"], rot=rot))
    tie, t_ = at_len(L - 0.035)
    lobes.append(ellipsoid("braid_tie", tie, (0.009, 0.009, 0.007), M["trim"], rot=t_.to_track_quat("Z", "Y").to_euler()))
    tuft, t_ = at_len(L - 0.015)
    lobes.append(ellipsoid("braid_tuft", tuft, (0.012, 0.008, 0.02), M["knit"], rot=t_.to_track_quat("Z", "Y").to_euler()))

    def braid_w(co):
        k = max(0.0, min(1.0, ((co - top).length - 0.05) / 0.08))
        k = k * k * (3 - 2 * k)
        return {"head": 1 - k, "chest": k} if 0 < k < 1 else ({"head": 1.0} if k <= 0 else {"chest": 1.0})

    def braid_free(co):
        k = ((co - top).length - 0.12) / max(0.05, L - 0.12)
        return max(0.0, min(1.0, k)) * 0.8

    for o in [core] + lobes:
        weights(o, braid_w)
        FLUTTER[o.name] = braid_free


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


HS = (ANSUR["wrist"] / 176) ** 0.7  # a woman's hand: the glove cut to her wrist
for i, s in enumerate("lr"):
    # SHIN GUARDS: from a hand under the knee down over the boot's cuff.
    rides(f"shin_{s}")
    _, _, _, _, sl = frame(f"shin_{s}")
    ca, lt = r_of(ANSUR["calf"]), r_of(ANSUR["lower_thigh"])
    calf = lambda t, ca=ca, lt=lt: (lt * (1 - t) + ca * 0.82 * t) if t < 0.5 else ca * 0.78
    _, rim = shell("shin_guard", f"shin_{s}", 0.1, 0.98, 9, math.radians(72), calf, 0.018, M["shin_guard"], flare=0.008)
    # Its rim edged in black, and a deeper black boot-end at its foot.
    for path_ in ([rw[0] for rw in rim], [rw[-1] for rw in rim], rim[-1], rim[0], rim[-2]):
        tube("guard_edge", path_, 0.006, M["guard_edge"])
    # Two straps round the calf behind.
    h_, x_, y_, z_, _ = frame(f"shin_{s}")
    for t in (0.3, 0.62):
        c = h_ + y_ * (t * sl)
        r = calf(t) + 0.012
        tube("guard_strap", [c + x_ * (math.cos(a) * r) + z_ * (math.sin(a) * r)
                             for a in (math.pi + math.pi * k / 10 for k in range(11))], 0.008, M["guard_strap"])
    # ARM GUARDS: low pads down the outside of each forearm.
    rides(f"forearm_{s}")
    fr = r_of(ANSUR["forearm"]) * 0.93
    shell("arm_guard", f"forearm_{s}", 0.52, 0.8, 5, math.radians(60),
          lambda t, fr=fr: fr * (1 - 0.25 * (t - 0.52) / 0.28), 0.008, M["arm_guard"])
    # THE HAND: a race glove closed round the grip, and the pole's KNUCKLE
    # SHIELD bowed in front of the fist.
    ee, fx_, fy_, fz_, fl_ = frame(f"forearm_{s}")
    wrist_t = ANSUR["forearm_length"] * MM / fl_
    cyl("cuff", ee + fy_ * (fl_ * (wrist_t - 0.12)), ee + fy_ * (fl_ * (wrist_t + 0.02)), 0.045 * HS, M["glove"], r2=0.041 * HS)
    rides(f"hand_{s}")
    c, hx_, hy_, hz_, _ = frame(f"hand_{s}")
    outh = hx_ if hx_.dot(shoulders[i] - neck) > 0 else -hx_
    turn = Matrix((outh, hy_, hz_)).transposed().to_euler()
    ellipsoid("palm", c - hy_ * 0.035 + outh * 0.012, (0.029 * HS, 0.048 * HS, 0.045 * HS), M["glove"], rot=turn)
    for k in range(4):
        along_g = hz_ * (0.028 - 0.019 * k)
        arc = [c + along_g + (hy_ * math.cos(t) + outh * math.sin(t)) * 0.022
               for t in (math.radians(a) for a in range(-110, 181, 58 if GAME else 20))]
        tube("finger", arc, (0.009 - 0.0008 * k) * HS, M["palm"] if k else M["glove"], smooth_n=0 if GAME else 2)
    tube("thumb", [c - hy_ * 0.03 - outh * 0.018 + hz_ * 0.03, c - outh * 0.02 + hz_ * 0.046,
                   c + hy_ * 0.02 - outh * 0.012 + hz_ * 0.048], 0.0105 * HS, M["glove"], smooth_n=0 if GAME else 2)
    rows = []
    for v in (-0.055, -0.02, 0.015, 0.05):
        row = []
        for u in (-0.95, -0.5, 0.0, 0.5, 0.95):
            bow = 0.062 - 0.012 * u * u
            row.append(c + hz_ * (v * 0.95 - 0.004) + hy_ * (bow * math.cos(u * 0.9)) + outh * (bow * math.sin(u * 0.9) + 0.01))
        rows.append(row)
    g_ = loft("shield", rows, [M["shield"]], closed=False, cap=False)
    sd_ = g_.modifiers.new("shell", "SOLIDIFY")
    sd_.thickness, sd_.offset = 0.004, 0.0

    # THE FOOT IN THE BOOT'S LINER: hidden in the shell on the skis, his own
    # when a crash throws him off them.
    rides(f"boot_{s}")
    o, bfx, bfy, bfz, _ = frame(f"boot_{s}")
    lean = 0.22

    def down(d, o=o, bfy=bfy, bfz=bfz):
        return o + bfy * (0.014 - d * math.sin(lean)) - bfz * (0.02 + d * math.cos(lean))

    axis = (bfz * math.cos(lean) + bfy * math.sin(lean)).normalized()
    ahead = (bfy - axis * bfy.dot(axis)).normalized()
    loft("liner", [[down(d) + bfx * (r * math.cos(2 * math.pi * k / 16)) + ahead * (r * 1.08 * math.sin(2 * math.pi * k / 16))
                    for k in range(16)] for d, r in ((0.0, 0.046), (0.06, 0.049), (0.14, 0.051), (0.2, 0.05))],
         [M["liner"]])
    sole = o - bfz * 0.285 + bfy * -0.02
    FOOT = [(-0.125, 0.03, 0.014, 0.06), (-0.1, 0.04, 0.008, 0.088), (-0.04, 0.043, 0.008, 0.1),
            (0.03, 0.044, 0.008, 0.085), (0.09, 0.045, 0.008, 0.066), (0.13, 0.037, 0.01, 0.05),
            (0.15, 0.02, 0.016, 0.034)]
    loft("foot", [[sole + bfy * u + bfx * (w * math.cos(2 * math.pi * k / 16))
                   + bfz * ((lo + hi) / 2 + (hi - lo) / 2 * math.sin(2 * math.pi * k / 16)) for k in range(16)]
                  for u, w, lo, hi in FOOT], [M["liner"]])

# ---------------------------------------------------------------- PAINT
# Every modifier baked in and every transform applied, then each vertex's
# OCCLUSION cast (rays into the hemisphere over it, against every part), and
# the vertex colour laid: the face's material colour (or the PRINT at the
# vertex) times that occlusion — a face-corner colour, so a colour edge
# stays sharp where two materials meet; how loose the point is (`FLUTTER`)
# and how much it shivers (`SHIVER`) on the one UV map.
curves = [o for o in COL.objects if o.type == "CURVE"]
if curves:
    lib._select_only(curves)
    bpy.context.view_layer.objects.active = curves[0]
    bpy.ops.object.convert(target="MESH")
meshes = [o for o in COL.objects if o.type == "MESH" and o.name != "cut"]
lib._select_only(meshes)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.convert(target="MESH")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
tris, vs = [], []
for o in meshes:
    me = o.data
    me.calc_loop_triangles()
    base = len(vs)
    vs += [v.co.copy() for v in me.vertices]
    tris += [tuple(base + i for i in t.vertices) for t in me.loop_triangles]
bvh = BVHTree.FromPolygons(vs, tris, epsilon=0.0)
rnd = random.Random(5)
DIRS = []
for k in range(14 if GAME else 24):
    z_ = rnd.random()
    a = 2 * math.pi * rnd.random()
    r_ = math.sqrt(max(0.0, 1 - z_ * z_))
    DIRS.append(Vector((r_ * math.cos(a), r_ * math.sin(a), z_)))
REACH = 0.09


def occlusion(co, no):
    t = no.to_track_quat("Z", "Y").to_matrix()
    hit = 0
    for d in DIRS:
        w = t @ d
        if bvh.ray_cast(co + no * 0.002 + w * 0.001, w, REACH)[0] is not None:
            hit += 1
    return 1.0 - 0.45 * hit / len(DIRS)


def base_name(name):
    return name.split(".")[0]


for o in meshes:
    me = o.data
    ao = [occlusion(v.co, v.normal) for v in me.vertices]
    fl_fn = FLUTTER.get(o.name) or FLUTTER.get(base_name(o.name))
    flt = [fl_fn(v.co) if fl_fn else 0.0 for v in me.vertices]
    shv = 1.0 if base_name(o.name) in SHIVER else 0.0
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    printed = {}
    data = []
    for poly in me.polygons:
        m = me.materials[poly.material_index] if me.materials else None
        pr = PRINT.get(m.name) if m else None
        rgb = srgb(KIT[m.name][0]) if m and m.name in KIT else (1, 1, 1)
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            if pr:
                if vi not in printed:
                    printed[vi] = pr(me.vertices[vi].co, me.vertices[vi].normal)
                c = printed[vi]
            else:
                c = rgb
            k = ao[vi]
            data += [c[0] * k, c[1] * k, c[2] * k, flt[vi]]
    attr.data.foreach_set("color", data)
    # The exporter writes the colour's RGB alone, so how loose a point is
    # rides the one UV map's u, and how much it shivers its v (`TEXCOORD_0`).
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    uv = me.uv_layers.new(name="UVMap")
    uv.data.foreach_set("uv", [c for li in range(len(me.loops)) for c in (flt[me.loops[li].vertex_index], shv)])
    me.color_attributes.active_color = attr
    try:
        me.color_attributes.render_color_index = me.color_attributes.active_color_index
    except Exception:
        pass

# ---------------------------------------------------------------- the STUDIO
floor = min(f.z for f in feet) - 0.06
finish(os.path.basename(argv[0]).removesuffix(".json"), OUT, SAMPLES,
       centre=(0, hips.y + 0.1, floor + 0.55), size=3.0, floor=floor, extras={"frame": "body"})

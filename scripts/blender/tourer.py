# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE NORDIC SKI TOURER MODELLED IN BLENDER: a skier out on a long day in
# the arctic fjord mountains or the high wilderness of the far north, skied
# back down to the shore — a pullover ANORAK of a waxed cotton blend in
# deep red, reinforced in dark olive over the shoulders, the forearms and
# the hem, a big zipped chest pocket and a half zip under a storm flap, its
# hood rolled down behind his neck; a knitted NECK GAITER; a WOOL BEANIE
# with a folded cuff and a pompom in place of a helmet; wrap SUNGLASSES;
# slim dark TOURING PANTS with black knee patches and gaiters over the
# boots; LEATHER WORK GLOVES with knitted cuffs; and a 35-litre TOURING
# PACK with an avalanche SHOVEL's blade strapped to its back, the shaft
# beside it and a rolled FOAM SIT PAD lashed under its lid. Built off the
# game's own data (`kinds/tourer.mjs`): his body (`BODY`), the pose the
# dressed skier is bound in and every bone's frame in it (`dress-loft.ts`'s
# `bindPose`), where an arm breaks (`skier-broken.ts`'s `BREAK`), and his
# head, face and hair as the game's own triangles (`helmet-shape.ts`'s
# `bareHeadParts`).
#
# The frame is the skier's (`skier.py`): the body frame (x right, y up, z
# forward, the origin at the centre of gravity) laid as Blender's
# (-x, z, y); his sides are the ENGINE's (`_l` the body's x negative).
#
# The game poses him as it poses the dressed skier — bone for bone off
# `skierBones`, the arm's halves below a break included — so every move
# the game has is his with no clip of his own (`tourer-model.ts`). What the
# game ADDS is what hangs off him: three SPRING BONES it swings off his own
# motion (`fx_pack`, the pack and all on it; `fx_hood`, the anorak's hood
# rolled down behind his neck; `fx_pom`, the beanie's pompom) and the
# FLUTTER every loose piece of cloth carries (the anorak's hem, the hem's
# drawcords, the straps' tails, the hood's edge), which the game's vertex
# shader shakes in the air past him. Every vertex's colour is its
# material's, darkened by its own occlusion (cast here, ray by ray), so the
# game draws him in one vertex-coloured skin as it draws the dressed one.

import json, math, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
POSE, FRAMES, HEAD = DATA["rest"]["pose"], DATA["rest"]["bones"], DATA["head"]
BREAK, CUT = DATA["broken"]["at"], DATA["broken"]["cut"]


def B(p):
    """A point or direction of the body frame, in Blender's."""
    return Vector((-p["x"], p["z"], p["y"]))


def srgb(hexa):
    """An sRGB colour as linear."""
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 for c in ((hexa >> 16) & 255, (hexa >> 8) & 255, hexa & 255))


def smooth01(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- materials
# After the photographs of tourers on the arctic coast's peaks and in the
# northern wilderness parks: the anorak a deep weathered red (the colour a
# party reads each other by on a white face), its wear patches a dark
# olive; dark slate pants patched black at the knee; a blue-grey pack with
# a black base; the shovel's blade anodised red; the sit pad's closed-cell
# foam a faded yellow; a cream wool beanie banded in red and navy; tan
# leather gloves. Each material's colour is baked into the vertex colours
# (`paint`), and the game reads those; the names say which draw a part
# joins (`tourer-model.ts`: the HARD goods a shine of their own).
KIT = {
    "anorak": (0xA02E28, 0.8, 0.0), "anorak_dark": (0x7E231F, 0.82, 0.0), "patch": (0x3B402F, 0.85, 0.0),
    "zip": (0x16181A, 0.5, 0.0), "pants": (0x323A44, 0.85, 0.0), "knee": (0x17191C, 0.8, 0.0),
    "gaiter_knit": (0x2F6E72, 0.9, 0.0), "gaiter_band": (0x9AA0A3, 0.9, 0.0),
    "leather": (0xA8743F, 0.7, 0.0), "leather_dark": (0x6E4A28, 0.75, 0.0), "cuff_knit": (0xE4DAC4, 0.95, 0.0),
    "liner": (0x2B2E34, 0.85, 0.0), "cord": (0x1A1B1D, 0.7, 0.0),
    "pack": (0x52667A, 0.75, 0.0), "pack_dark": (0x15181C, 0.78, 0.0), "pad": (0xD2B04A, 0.9, 0.0),
    "skin": (0xC68863, 0.6, 0.0), "hair": (0x5A3C26, 0.9, 0.0), "trim": (0x15110E, 0.6, 0.0),
    "beanie": (0xE6DCC6, 0.95, 0.0), "beanie_red": (0xA02E28, 0.95, 0.0), "beanie_navy": (0x1F2E4A, 0.95, 0.0),
    # The hard goods.
    "glasses": (0x161616, 0.3, 0.0), "glass_lens": (0x8A3A16, 0.06, 0.7), "metal": (0xB8BDC3, 0.3, 0.85),
    "blade": (0xB8322A, 0.3, 0.75), "shaft": (0x9AA2AA, 0.3, 0.85), "grip": (0x141618, 0.8, 0.0),
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
    split pelvis to chest up the spine."""
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
    # PAST A BREAK (`dress-loft.ts`'s `clothWeights`, the same rule): an arm
    # bone's share past where it would break goes to the bone below the
    # break, eased over a few centimetres — on a sound arm the two move as
    # one; broken, the cloth past it hangs with the arm.
    for s in "lr":
        for arm, at in ((f"upperarm_{s}", BREAK["upper"]), (f"forearm_{s}", BREAK["fore"])):
            share = out.get(arm)
            if not share:
                continue
            a0, a1 = SEGMENTS[arm]
            c = smooth01((along(co, SEGMENTS[arm])[0] * (a1 - a0).length - at + CUT) / (2 * CUT))
            if c <= 0:
                continue
            out[arm] = share * (1 - c)
            if out[arm] <= 1e-6:
                del out[arm]
            lo = arm.replace("arm_", "arm_lo_")
            out[lo] = out.get(lo, 0.0) + share * c
    top = sorted(out.items(), key=lambda kv: -kv[1])[:4]
    total = sum(v for _, v in top)
    return {n: v / total for n, v in top}


# ---------------------------------------------------------------- the BODY
# The flesh round the game's bones is the skier's: ANSUR II's mean man (US
# Army 2012), the very table `skier.py` cites — a tourer is a man of the
# same measure; only the kit over him differs.
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


# THE KIT'S EASE, m a side: an ANORAK is cut loose — a pullover has to go
# on over the head and over a wool layer, so it stands three centimetres
# off him through the body and blouses over the hips; its sleeves are
# roomy to the cuff. The touring pants are slim through the thigh and
# straight over the boot.
EASE = {"chest_front": 0.03, "chest_back": 0.03, "trunk_side": 0.028, "bloused": 0.034,
        "sleeve": 0.02, "pants": 0.013, "cap": 0.012}

P = POSE
hips, neck, head_c = B(P["hips"]), B(P["neck"]), B(P["head"])
knees, feet = [B(k) for k in P["knees"]], [B(f) for f in P["feet"]]
shoulders, elbows, hands = [B(k) for k in P["shoulders"]], [B(k) for k in P["elbows"]], [B(k) for k in P["hands"]]
SEG = 16 if GAME else 28
SX, UP_, SY, CHEST, SPINE_L = frame("spine")[1], frame("spine")[2], None, frame("spine")[3], frame("spine")[4]
UP = UP_


def T(lv, side=0.0, ahead=0.0):
    """A point of the trunk: `lv` up the spine (hips 0, neck 1), `side` m
    to his right, `ahead` m in front of the spine's line."""
    return hips + UP * (lv * SPINE_L) + SX * side + CHEST * ahead


def lofted(name, bone_name, sections, n=2.4, m=None):
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
    return loft(name, rings, [m or M["anorak"]])


def ring(c, X, Z, hx, hz, n=4.0, seg=SEG):
    """A superellipse ring about `c` across `X` and `Z`."""
    out = []
    for k in range(seg):
        a = 2 * math.pi * k / seg
        ca, sa = math.cos(a), math.sin(a)
        out.append(c + X * (math.copysign(abs(ca) ** (2 / n), ca) * hx) + Z * (math.copysign(abs(sa) ** (2 / n), sa) * hz))
    return out


def ribbon(name, path, width, thick, m, out_of, smooth=True):
    """A flat strap along `path`, `width` across and `thick` through, its
    flat face turned to `out_of(point)` (the way off his body there)."""
    rings = []
    for i, p in enumerate(path):
        a, b = path[max(0, i - 1)], path[min(len(path) - 1, i + 1)]
        t = (b - a).normalized()
        o = out_of(p)
        o = (o - t * o.dot(t)).normalized()
        w = t.cross(o).normalized()
        rings.append([p + w * (width / 2) + o * (thick / 2), p - w * (width / 2) + o * (thick / 2),
                      p - w * (width / 2) - o * (thick / 2), p + w * (width / 2) - o * (thick / 2)])
    return loft(name, rings, [m], smooth=smooth)


def off_trunk(p):
    """The way off his trunk at a point: out from the spine's line."""
    a, b = SEGMENTS["spine"]
    d = b - a
    t = max(0.0, min(1.0, (p - a).dot(d) / d.length_squared))
    v = p - (a + d * t)
    return v.normalized() if v.length > 1e-6 else CHEST


rides("chest")
pieces = []
bh = ANSUR["hip_breadth"] / 2 * MM
bd = ANSUR["buttock_depth"] * MM
wb, wd = ANSUR["waist_breadth"] / 2 * MM, ANSUR["waist_depth"] * MM
cb, cd = ANSUR["chest_breadth"] / 2 * MM, ANSUR["chest_depth"] * MM
E = EASE
# THE ANORAK'S BODY, hip length and loose: bloused over the hips where its
# drawcord gathers the hem, full through the chest over a wool layer, its
# shoulders dropped a little as a pullover's are.
TRUNK = [
    (level(ANSUR["crotch"]) - 0.04, bh * 0.8 + 0.016, bd * 0.3 + 0.016, bd * 0.45 + 0.016),
    (level(ANSUR["crotch"]) + 0.05, bh + 0.018, bd * 0.4 + 0.018, bd * 0.52 + 0.018),
    (0.08, bh + E["bloused"], bd * 0.42 + E["bloused"], bd * 0.55 + E["bloused"]),
    (level(ANSUR["waist_h"]), wb + E["bloused"], wd * 0.55 + E["bloused"], wd * 0.45 + E["bloused"]),
    (level(ANSUR["tenth_rib_h"]), wb * 0.97 + E["trunk_side"], wd * 0.55 + E["chest_front"], wd * 0.46 + E["chest_back"]),
    (0.52, cb * 1.05 + E["trunk_side"], cd * 0.51 + E["chest_front"], cd * 0.48 + E["chest_back"]),
    (level(ANSUR["chest_h"]), cb * 1.12 + E["trunk_side"], cd * 0.5 + E["chest_front"], cd * 0.5 + E["chest_back"]),
    (level(ANSUR["axilla_h"]), cb * 1.2 + E["trunk_side"], cd * 0.47 + E["chest_front"], cd * 0.5 + E["chest_back"]),
    (level(ANSUR["acromion_h"]) - 0.05, ANSUR["biacromial"] / 2 * MM * 0.93, cd * 0.42 + E["chest_front"], cd * 0.46 + E["chest_back"]),
    (0.95, r_of(ANSUR["neck_base"]) * 1.5 + 0.02, 0.098, 0.098),
    (1.0, r_of(ANSUR["neck_base"]) + 0.028, 0.088, 0.088),
]
pieces.append(lofted("trunk", "spine", TRUNK, n=2.6))
# THE NECK GAITER: a knitted tube pulled up round the neck out of the
# anorak's collar, to just under the jaw — it rides between the trunk and
# the head as the collar does.
collar = [neck.lerp(head_c, u) for u in (0.0, 0.2, 0.36)]
pieces.append(loft("collar", [[c + SX * (0.09 * math.cos(2 * math.pi * k / SEG)) + CHEST * (0.087 * math.sin(2 * math.pi * k / SEG))
                               for k in range(SEG)] for c in collar], [M["anorak"]]))
for i, s in enumerate("lr"):
    reach = ANSUR["bideltoid"] / 2 * MM - ANSUR["biacromial"] / 2 * MM
    out = (shoulders[i] - neck.lerp(hips, 0.12)).normalized()
    pieces.append(ellipsoid("shoulder", shoulders[i] + UP * 0.006 + out * 0.004,
                            (reach + E["cap"] + 0.008, reach + E["cap"] + 0.01, reach + E["cap"] + 0.009), M["anorak"]))
    b = r_of(ANSUR["biceps"]) * 0.95
    pieces.append(lofted("sleeve", f"upperarm_{s}", [
        (-0.05, b * 1.2 + E["sleeve"], b * 1.15 + E["sleeve"], b * 1.15 + E["sleeve"]),
        (0.35, b + E["sleeve"], b + E["sleeve"], b * 1.05 + E["sleeve"]),
        (0.7, b * 0.94 + E["sleeve"], b * 0.92 + E["sleeve"], b * 0.97 + E["sleeve"]),
        (1.05, b * 0.88 + E["sleeve"], b * 0.92 + E["sleeve"], b * 0.84 + E["sleeve"])]))
    f, w = r_of(ANSUR["forearm"]) * 0.95, r_of(ANSUR["wrist"])
    wrist_t = ANSUR["forearm_length"] * MM / frame(f"forearm_{s}")[4]
    # The sleeve full to a cuff closed by its tab round the glove's cuff.
    pieces.append(lofted("sleeve", f"forearm_{s}", [
        (-0.08, f * 1.08 + E["sleeve"], f + E["sleeve"], f * 1.12 + E["sleeve"]),
        (0.3, f + E["sleeve"], f + E["sleeve"], f + E["sleeve"]),
        (wrist_t - 0.22, (f + w) / 2 + E["sleeve"] + 0.006, (f + w) / 2 + E["sleeve"] + 0.006, (f + w) / 2 + E["sleeve"] + 0.006),
        (wrist_t - 0.08, w + E["sleeve"] + 0.008, w + E["sleeve"] + 0.008, w + E["sleeve"] + 0.008)]))
    pieces.append(ellipsoid("elbow", elbows[i], (b + E["sleeve"],) * 3, M["anorak"]))
    th, lt = r_of(ANSUR["thigh"]), r_of(ANSUR["lower_thigh"])
    pieces.append(lofted("pants", f"thigh_{s}", [
        (-0.12, th * 1.05 + E["pants"], th + E["pants"], th * 1.1 + E["pants"]),
        (0.2, th + E["pants"], th + E["pants"], th + E["pants"]),
        (0.6, (th + lt) / 2 + E["pants"], (th + lt) / 2 + E["pants"], (th + lt) / 2 + E["pants"]),
        (0.95, lt + E["pants"], lt + E["pants"], lt + E["pants"])], m=M["pants"]))
    ca, an = r_of(ANSUR["calf"]), r_of(ANSUR["ankle"])
    pieces.append(lofted("pants", f"shin_{s}", [
        (-0.05, lt + E["pants"], lt + E["pants"], lt + E["pants"]),
        (0.3, ca * 0.9 + E["pants"], ca * 0.8 + E["pants"], ca * 1.1 + E["pants"]),
        (0.5, ca * 0.82 + E["pants"] + 0.006, ca * 0.78 + E["pants"] + 0.006, ca * 0.95 + E["pants"] + 0.006),
        (0.6, ca * 0.85 + E["pants"] + 0.01, ca * 0.85 + E["pants"] + 0.01, ca * 0.95 + E["pants"] + 0.01)], m=M["pants"]))
    pieces.append(ellipsoid("knee", knees[i], (lt + E["pants"] + 0.004,) * 3, M["pants"]))

bpy.context.view_layer.objects.active = pieces[0]
for o in bpy.context.view_layer.objects:
    o.select_set(o in pieces)
bpy.ops.object.convert(target="MESH")
bpy.ops.object.join()
suit = bpy.context.view_layer.objects.active
suit.name = suit.data.name = "suit"
remesh = suit.modifiers.new("one", "REMESH")
remesh.mode, remesh.voxel_size = "VOXEL", 0.015 if GAME else 0.006
smooth = suit.modifiers.new("ease", "SMOOTH")
smooth.factor, smooth.iterations = 0.6, 2 if GAME else 4
bpy.ops.object.convert(target="MESH")
if GAME:
    thin = suit.modifiers.new("budget", "DECIMATE")
    thin.ratio = 4200 / max(1, len(suit.data.polygons) * 2)
    bpy.ops.object.convert(target="MESH")
suit.data.materials.clear()
SUIT_KEYS = ("anorak", "anorak_dark", "patch", "pants", "knee", "zip", "gaiter_knit", "gaiter_band")
for k in SUIT_KEYS:
    suit.data.materials.append(M[k])
SUIT_MAT = {k: i for i, k in enumerate(SUIT_KEYS)}

# The cloth's folds: a waxed cotton blend is stiffer than a softshell, so it
# breaks in fewer, deeper folds at the elbow and over the belt where the
# anorak blouses, and the pants crease behind the knee.
FOLDS = [
    ("upperarm", 0.7, 1.0, -1, 0.007, 0.05), ("forearm", 0.0, 0.25, -1, 0.007, 0.05),
    ("forearm", 0.55, 0.8, 0, 0.004, 0.03),
    ("thigh", 0.78, 1.0, -1, 0.006, 0.045), ("shin", 0.0, 0.18, -1, 0.006, 0.045),
    ("thigh", 0.0, 0.16, 1, 0.004, 0.045), ("spine", 0.1, 0.34, 1, 0.006, 0.05),
    ("spine", 0.1, 0.3, -1, 0.004, 0.06),
]
bm = bmesh.new()
bm.from_mesh(suit.data)
bm.normal_update()
for v in bm.verts:
    b = nearest(v.co)
    t = along(v.co, SEGMENTS[b])[0]
    _, _, by, bz, bl = frame(b)
    for kind_, t0, t1, face, amp, pitch in FOLDS:
        if not b.startswith(kind_) or not t0 <= t <= t1:
            continue
        side = 1.0 if face == 0 else max(0.0, v.normal.dot(bz) * face)
        fade = math.sin(math.pi * (t - t0) / (t1 - t0))
        v.co += v.normal * (amp * side * fade * math.sin(2 * math.pi * t * bl / pitch))
bm.to_mesh(suit.data)
bm.free()

# THE CUT: every colour edge a plane the cloth is cut along, so a colour
# meets the next along a clean seam. The anorak's hem is level all round (a
# pullover's, gathered by its drawcord), with a dark olive band above it;
# its wear patches cover the shoulders and the yoke where a pack's straps
# rub (`YOKE`) and the forearms from the elbow (`CUFFS`); the CHEST POCKET is
# a panel across the front under the yoke, zipped along its top
# (`POCKET_*`); the HALF ZIP runs down the front from the collar under its
# storm flap (`ZIP`, to `ZIP_END`). The neck gaiter is the collar's
# (`GAITER`), knitted teal with a grey band. The pants are slate with black
# knee patches (`KNEE_*`).
HEM_UP = UP
HEM = (hips - UP * 0.1, HEM_UP)
HEM_BAND = (hips - UP * 0.1 + HEM_UP * 0.04, HEM_UP)
YOKE = (neck - UP * 0.13, (UP + CHEST * 0.1).normalized())
GAITER = (neck + UP * 0.012, UP)
GAITER_BAND = [(neck.lerp(head_c, 0.17), UP), (neck.lerp(head_c, 0.24), UP)]
ZIP = [(neck + SX * 0.007, SX), (neck - SX * 0.007, -SX)]
ZIP_END = (T(0.7), UP)
POCKET_TOP = (T(0.74), UP)
POCKET_LO = (T(0.48), UP)
POCKET_SIDE = [(T(0.0, 0.125), SX), (T(0.0, -0.125), -SX)]
CUFFS = [(frame(f"forearm_{s}")[0] + frame(f"forearm_{s}")[2] * frame(f"forearm_{s}")[4] * 0.3,
          frame(f"forearm_{s}")[2]) for s in "lr"]
LAPS = [(frame(f"thigh_{s}")[0] + frame(f"thigh_{s}")[2] * frame(f"thigh_{s}")[4] * 0.22,
         frame(f"thigh_{s}")[2]) for s in "lr"]
KNEE_GUARD = [((frame(f"shin_{s}")[0] + frame(f"shin_{s}")[3] * 0.02), frame(f"shin_{s}")[3]) for s in "lr"]
ARMS = [(frame(f"upperarm_{s}")[0] + frame(f"upperarm_{s}")[2] * frame(f"upperarm_{s}")[4] * 0.28,
         frame(f"upperarm_{s}")[2]) for s in "lr"]
KNEE_HI = [(frame(f"thigh_{s}")[0] + frame(f"thigh_{s}")[2] * frame(f"thigh_{s}")[4] * 0.8, frame(f"thigh_{s}")[2]) for s in "lr"]
KNEE_LO = [(frame(f"shin_{s}")[0] + frame(f"shin_{s}")[2] * frame(f"shin_{s}")[4] * 0.24, frame(f"shin_{s}")[2]) for s in "lr"]
bm = bmesh.new()
bm.from_mesh(suit.data)
for co, no in ([HEM, HEM_BAND, YOKE, GAITER, ZIP_END, POCKET_TOP, POCKET_LO] + GAITER_BAND + CUFFS + LAPS + ZIP
               + POCKET_SIDE + KNEE_GUARD + KNEE_HI + KNEE_LO + ARMS):
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)
bm.to_mesh(suit.data)
bm.free()


def above(co, plane):
    return (co - plane[0]).dot(plane[1]) > 0


def front(co):
    return (co - hips).dot(CHEST) > 0


def cloth_of(co):
    b = nearest(co)
    if b.startswith(("thigh", "shin")):
        i = "lr".index(b[-1])
        if above(co, KNEE_HI[i]) and not above(co, KNEE_LO[i]) and above(co, KNEE_GUARD[i]):
            return "knee"
    if b.startswith(("shin", "boot")) or not above(co, HEM):
        return "pants"
    if b.startswith("thigh") and above(co, LAPS["lr".index(b[-1])]):
        return "pants"
    if not above(co, HEM_BAND):
        return "patch"
    if b in ("head", "spine"):
        if above(co, GAITER):
            if above(co, GAITER_BAND[0]) and not above(co, GAITER_BAND[1]):
                return "gaiter_band"
            return "gaiter_knit"
        zipped = not above(co, ZIP[0]) and not above(co, ZIP[1]) and front(co)
        if zipped and above(co, ZIP_END):
            return "zip"
        if (front(co) and above(co, POCKET_LO) and not above(co, POCKET_TOP)
                and not above(co, POCKET_SIDE[0]) and not above(co, POCKET_SIDE[1])):
            return "anorak_dark"
        return "patch" if above(co, YOKE) else "anorak"
    if b.startswith("upperarm"):
        return "patch" if above(co, YOKE) or not above(co, ARMS["lr".index(b[-1])]) else "anorak"
    if b.startswith("forearm"):
        return "patch" if above(co, CUFFS["lr".index(b[-1])]) else "anorak"
    return "anorak"


suit.data.polygons.foreach_set("material_index", [SUIT_MAT[cloth_of(p.center)] for p in suit.data.polygons])
for p in suit.data.polygons:
    p.use_smooth = True
weights(suit, suit_weights)


# THE HEM FLUTTERS: the anorak's loose skirt below the drawcord, all round.
def hem_flutter(co):
    h = (co - HEM[0]).dot(HEM[1])
    if h < -0.002 or nearest(co).startswith(("thigh", "shin")) and h < 0:
        return 0.0
    k = max(0.0, 1.0 - h / 0.1)
    return min(1.0, k * k * 0.85)


FLUTTER[suit.name] = hem_flutter

# The pocket's zip and the half zip's pull: a dark seam along the pocket's
# top, a puller hung off each.
rides("chest")
hx_p, hf_p, _ = None, None, None


def trunk_r(lv):
    """The anorak's half breadth, front and back off the spine's line at a level."""
    pts = TRUNK
    for (a, ha, fa, ba), (b2, hb, fb, bb) in zip(pts, pts[1:]):
        if a <= lv <= b2:
            u = (lv - a) / (b2 - a)
            return ha + (hb - ha) * u, fa + (fb - fa) * u, ba + (bb - ba) * u
    return pts[-1][1:]


def on_front(lv, side, proud=0.003):
    """A point on the anorak's front at a level, `side` m across."""
    hx2, hf2, _ = trunk_r(lv)
    u = max(-0.98, min(0.98, side / hx2))
    # The superellipse's front face at that side: n = 2.6.
    depth = hf2 * (1 - abs(u) ** 2.6) ** (1 / 2.6)
    return T(lv, side, depth + proud)


trims = []
pz = [on_front(0.74, x / 10 * 0.12, 0.004) for x in range(-10, 11, 2)]
trims.append(tube("pocket_zip", pz, 0.0035, M["zip"]))
trims.append(box("pocket_pull", on_front(0.74, 0.1, 0.008) - UP * 0.015, (0.008, 0.004, 0.026), M["metal"], bevel=0))
trims.append(box("zip_pull", on_front(0.95, 0.0, 0.012) - UP * 0.02, (0.01, 0.005, 0.03), M["metal"], bevel=0))
for o in trims:
    weights(o, lambda co: suit_weights(co, [n for n in SEGMENTS if n in ("spine", "head")]))

# THE HEM'S DRAWCORD: its two ends out of the hem at the front hips, each a
# cord with a toggle, swinging free.
rides("pelvis")
for sd in (-1, 1):
    hx2, hf2, _ = trunk_r(0.06)
    root = T(0.06, sd * hx2 * 0.55, hf2 * 0.86 + 0.006) - UP * 0.1 * SPINE_L * 0.0
    cord = [root - UP * (0.018 * k) + CHEST * (0.002 * k) for k in range(6)]
    tube("drawcord", cord, 0.0022, M["cord"])
    cyl("toggle", cord[-1], cord[-1] - UP * 0.022, 0.006, M["cord"], seg=10)
FLUTTER["drawcord"] = lambda co: 0.8
FLUTTER["toggle"] = lambda co: 0.9

# ---------------------------------------------------------------- the HOOD
# The anorak's hood, ROLLED DOWN: a soft bag of cloth lying on his upper back
# from the collar, its face's edge a darker hem. It hangs off its own spring
# bone (`fx_hood`) at the back of the collar, so it bounces on a landing and
# lifts in the air over his shoulders as he goes.
_, _, hb_back = trunk_r(0.93)
hood_root = T(0.985, 0.0, -0.075)
bone("fx_hood", hood_root, hood_root - UP * 0.16, parent="chest", roll_to=-CHEST)
rides("fx_hood")
HOOD = [  # down from the collar: level below the root, half across, out off the back, depth
    (0.0, 0.1, 0.0, 0.026), (0.04, 0.13, 0.006, 0.04), (0.09, 0.145, 0.012, 0.046),
    (0.14, 0.135, 0.014, 0.04), (0.18, 0.1, 0.012, 0.028), (0.2, 0.06, 0.01, 0.016)]
hood_rings = []
for dl, hx2, outwd, dp in HOOD:
    lv = 0.985 - dl
    _, _, bk = trunk_r(lv)
    # Laid on the back: its inner face on the anorak's back, its outer face
    # standing `dp` behind that.
    c = T(lv, 0.0, -(bk + outwd + dp * 0.5))
    hood_rings.append(ring(c, SX, CHEST, hx2, dp * 0.5, n=2.4))
hood = loft("hood", hood_rings, [M["anorak"], M["anorak_dark"]],
            face_mat=lambda c: 1 if (hood_root - c).dot(UP) > 0.17 else 0)
FLUTTER["hood"] = lambda co: min(1.0, max(0.0, ((hood_root - co).dot(UP) - 0.08) / 0.12)) * 0.45

# ---------------------------------------------------------------- the PACK
# A 35-litre touring pack: a body 46 cm high, 28 wide and 18 deep, worn low
# under the hood, its lid over the top and a black base; slim padded
# shoulder straps over the shoulders and down the chest with a sternum
# strap and a hip belt's wings; the straps' tails hanging free (they
# flutter). On its back the AVALANCHE SHOVEL's blade (a red alloy scoop
# 27 by 23 cm) is strapped flat in the stash pocket, its shaft and T-grip
# standing up beside the lid; a closed-cell FOAM SIT PAD rolled across
# under the lid's straps. It rides its own spring bone (`fx_pack`, hung at
# the top of the back), so it settles a little behind him as he moves.
PACK_LO, PACK_HI = 0.12, 0.84
pack_back = cd * 0.5 + E["chest_back"] + 0.002   # its face against his back, behind the spine's line
pack_top = T(PACK_HI, 0.0, -(pack_back + 0.06))
bone("fx_pack", pack_top, pack_top + UP * 0.1, parent="chest", roll_to=-CHEST)
rides("fx_pack")
SECTIONS = [  # level, half across, depth
    (PACK_LO, 0.11, 0.1), (PACK_LO + 0.05, 0.135, 0.15), (0.38, 0.14, 0.18), (0.62, 0.14, 0.175),
    (0.76, 0.13, 0.155), (PACK_HI - 0.015, 0.12, 0.12), (PACK_HI, 0.1, 0.07)]
rings_ = []
for lv, hx2, dp in SECTIONS:
    _, _, bk = trunk_r(lv)
    c = T(lv, 0.0, -(max(pack_back, bk + 0.004) + dp / 2))
    rings_.append(ring(c, SX, CHEST, hx2, dp / 2, n=3.2))
loft("pack", rings_, [M["pack"], M["pack_dark"]],
     face_mat=lambda c: 1 if (c - hips).dot(UP) < (PACK_LO + 0.07) * SPINE_L else 0)
# The lid: a domed cap over the top, a little proud of the body.
lid = []
for lv, hx2, dp in ((0.72, 0.138, 0.165), (0.79, 0.142, 0.175), (0.84, 0.128, 0.155), (0.87, 0.09, 0.1)):
    lid.append(ring(T(lv, 0.0, -(pack_back + 0.088)), SX, CHEST, hx2, dp / 2, n=3.0))
loft("pack_lid", lid, [M["pack_dark"]])
# Compression straps across the body, two a side (dark webbing).
for lv in (0.34, 0.56):
    for sd in (-1, 1):
        a = T(lv, sd * 0.142, -(pack_back + 0.04))
        b2 = T(lv + 0.02, sd * 0.142, -(pack_back + 0.15))
        box("compress", a.lerp(b2, 0.5), (0.008, 0.12, 0.022), M["pack_dark"], bevel=0)
# THE SHOVEL'S BLADE in the stash pocket on the pack's back: a shallow scoop
# (its face curved across), its top edge just under the lid, and the
# pocket's black mesh over its lower half.
back_face = pack_back + 0.18
blade = []
for lv in (0.3, 0.42, 0.54, 0.64):
    row = []
    for k in range(9):
        u = (k / 8 * 2 - 1)
        row.append(T(lv, u * 0.115, -(back_face + 0.004 + 0.014 * (1 - u * u))))
    blade.append(row)
bl = loft("shovel_blade", blade, [M["blade"]], closed=False, cap=False)
bs = bl.modifiers.new("thick", "SOLIDIFY")
bs.thickness, bs.offset = 0.004, -1
for lv in (0.3, 0.36):
    row = [T(lv, (k / 8 * 2 - 1) * 0.125, -(back_face + 0.022 + 0.016 * (1 - (k / 8 * 2 - 1) ** 2))) for k in range(9)]
    tube("stash_mesh", row, 0.008, M["pack_dark"])
# The shaft up beside the lid on his right, the T-grip over the shoulder.
sh_foot = T(0.3, 0.1, -(pack_back + 0.17))
sh_top = T(0.98, 0.115, -(pack_back + 0.15))
cyl("shovel_shaft", sh_foot, sh_top, 0.0135, M["shaft"], seg=12)
cyl("shovel_grip", sh_top - SX * 0.05, sh_top + SX * 0.05, 0.011, M["grip"], seg=10)
box("shovel_band", T(0.6, 0.1, -(pack_back + 0.17)), (0.04, 0.03, 0.012), M["pack_dark"], bevel=0)
# THE SIT PAD, rolled across under the lid's two straps.
pad_c = T(0.885, 0.0, -(pack_back + 0.09))
cyl("sit_pad", pad_c - SX * 0.2, pad_c + SX * 0.2, 0.052, M["pad"], seg=20)
for sd in (-1, 1):
    strap = [pad_c + SX * (sd * 0.12) + (UP * math.cos(a) - CHEST * math.sin(a)) * 0.056
             for a in (2 * math.pi * k / 12 for k in range(12))]
    tube("pad_strap", strap, 0.0045, M["pack_dark"], closed=True)

# THE SHOULDER STRAPS, riding him as the cloth does: from the pack's top
# over each shoulder and down his chest to the lower ribs, a sternum strap
# across them, each strap's tail hanging below its buckle; and the hip
# belt's slim wings round to the front of his hips.
rides("chest")
straps = []
for sd in (-1, 1):
    pth = [T(0.8, sd * 0.07, -(pack_back + 0.01)), T(0.97, sd * 0.1, -(cd * 0.44)), T(1.0, sd * 0.115, 0.0),
           T(0.93, sd * 0.11, cd * 0.42 + 0.024), T(0.76, sd * 0.105, cd * 0.53 + E["chest_front"] + 0.006),
           T(0.56, sd * 0.115, cd * 0.53 + E["chest_front"] + 0.004)]
    path = catmull(pth, n=4 if GAME else 8)
    straps.append(ribbon("strap", path, 0.055, 0.012, M["pack_dark"], off_trunk))
    lo = T(0.56, sd * 0.115, cd * 0.53 + E["chest_front"] + 0.012)
    tl = [lo - UP * (0.03 * k) + CHEST * 0.003 * k for k in range(6)]
    straps.append(ribbon("strap_tail", tl, 0.022, 0.003, M["pack_dark"], off_trunk))
    straps.append(ribbon("strap_low", [T(0.6, sd * 0.13, cd * 0.32 + E["chest_front"]), T(0.45, sd * 0.165, 0.0),
                                       T(PACK_LO + 0.08, sd * 0.14, -(pack_back + 0.01))],
                         0.022, 0.004, M["pack_dark"], off_trunk))
straps.append(box("sternum", on_front(0.86, 0.0, 0.012), (0.2, 0.004, 0.018), M["pack_dark"], bevel=0))
straps.append(box("sternum_buckle", on_front(0.86, 0.0, 0.016), (0.035, 0.008, 0.024), M["grip"], bevel=0))
for o in straps:
    weights(o, lambda co: suit_weights(co, [n for n in SEGMENTS if n in ("spine", "head")]))
for o in straps:
    if o.name.startswith("strap_tail"):
        top = max(v.co.dot(UP) for v in o.data.vertices)
        FLUTTER[o.name] = (lambda t: (lambda co: min(1.0, max(0.0, (t - co.dot(UP)) / 0.15))))(top)
# The hip belt's wings, riding the pelvis: a slim padded band from the pack's
# foot round each side of the anorak's bloused hips to a buckle in front.
rides("pelvis")
belt_lv = 0.12
hx2, hf2, hb2 = trunk_r(belt_lv)
belt = []
for dv in (-0.022, 0.0, 0.022):
    lv = belt_lv + dv / SPINE_L
    c = T(lv)
    belt.append([c + SX * (math.copysign(abs(math.cos(a)) ** (2 / 2.6), math.cos(a)) * (hx2 + 0.01))
                 + CHEST * (math.copysign(abs(math.sin(a)) ** (2 / 2.6), math.sin(a)) * ((hf2 if math.sin(a) > 0 else hb2) + 0.01))
                 for a in (2 * math.pi * k / 24 for k in range(24))])
hip_belt = loft("hip_belt", belt, [M["pack_dark"]])
weights(hip_belt, suit_weights)
box("hip_buckle", T(belt_lv, 0.0, hf2 + 0.018), (0.045, 0.012, 0.03), M["grip"], bevel=0)

# ---------------------------------------------------------------- the HEAD
# His head, face and hair are the game's own triangles (`bareHeadParts`),
# under a WOOL BEANIE — a knitted dome a little slouched over the crown,
# its cuff folded up at the brow, banded red and navy, ribbed up its sides,
# pulled down over the ears and low behind, a pompom on top riding its own
# spring bone (`fx_pom`) — and wrap SUNGLASSES: a dark frame, an orange
# mirrored lens wrapped round to the temples, the arms back over the ears
# and under the beanie.
rides("head")
hc, hx, hy, hz, _ = frame("head")
HPAINT = {"skin": M["skin"], "knit": M["hair"], "trim": M["trim"], "strap": M["glasses"],
          "lens": M["glass_lens"], "shell": M["beanie"]}


def hp(p):
    return hc + hx * p[0] + hy * p[1] + hz * p[2]


for part in HEAD["game" if GAME else "fine"]:
    Pp, N, I = part["position"], part["normal"], part["index"]
    verts = [hp(Pp[k:k + 3]) for k in range(0, len(Pp), 3)]
    faces = [I[k:k + 3] for k in range(0, len(I), 3)]
    ob = mesh_obj(f"head_{part['material']}", verts, faces, [HPAINT.get(part["material"], M["hair"])], recalc=False)
    normals = [tuple(hx * N[k] + hy * N[k + 1] + hz * N[k + 2]) for k in range(0, len(N), 3)]
    ob.data.normals_split_custom_set_from_vertices(normals)
# The beanie over the egg (`helmet-shape.ts`'s HEAD: 0.077 × 0.104 × 0.097
# about (0, −0.014, −0.006)), a centimetre off it and over the hair, its rim
# at the brow in front and low over the ears and the nape.
HC_ = (0.0, -0.014, -0.006)
HR = (0.088, 0.115, 0.108)
AROUND, DOWN = (24, 7) if GAME else (64, 18)


def rim_y(phi):
    """The rim's height round the head (phi 0 ahead): at the brow in front,
    down over the ears, lowest at the nape."""
    c = math.cos(phi)
    return 0.026 * c - 0.004 - 0.012 * max(0.0, -c)


def cap_pt(phi, u, grow=0.0, rib=0.0):
    """A point of the beanie: round from ahead by `phi`, `u` from the crown
    (0) to the rim (1), stood `grow` further off the head."""
    ry = rim_y(phi)
    top = HC_[1] + HR[1] + 0.012          # a little slouch over the crown
    yy = top + (ry - top) * u
    k = math.sqrt(max(0.0, 1 - ((yy - HC_[1]) / (HR[1] + 0.012 * (1 - u))) ** 2))
    r = grow + rib
    return hp((HC_[0] + math.sin(phi) * (HR[0] + r) * k, yy,
               HC_[2] + math.cos(phi) * (HR[2] + r) * k))


CUFF_U = 0.74   # where the folded cuff starts down the beanie
RIBS = 24
body_rings = []
for j in range(DOWN + 1):
    u = CUFF_U * ((j / DOWN) ** 1.15 if j else 0.02)
    body_rings.append([cap_pt(2 * math.pi * i / AROUND, u, 0.0,
                              0.0014 * math.cos(RIBS * 2 * math.pi * i / AROUND) * min(1.0, u * 3))
                       for i in range(AROUND)])
beanie = loft("beanie", body_rings, [M["beanie"], M["beanie_red"], M["beanie_navy"]], face_mat=lambda c: 0)
# The cuff: folded up, standing proud of the body, banded red between two
# navy stripes.
cuff_rings = [[cap_pt(2 * math.pi * i / AROUND, u, g,
                      0.0012 * math.cos(RIBS * 2 * math.pi * i / AROUND))
               for i in range(AROUND)]
              for u, g in ((CUFF_U - 0.02, 0.0), (CUFF_U, 0.007), (0.8, 0.009), (0.86, 0.009), (0.92, 0.009),
                           (0.98, 0.008), (1.0, 0.004), (1.0, -0.002))]


def cuff_band(c):
    """Which colour a band of the cuff is, by how far down it lies."""
    top = hp((0, HC_[1] + HR[1], 0))
    d = (top - c).dot(hy)
    span = HR[1] - rim_y(0)
    u = d / max(0.01, span)
    return 2 if 0.79 < u < 0.83 or 0.93 < u < 0.97 else 1 if 0.83 <= u <= 0.93 else 0


cuff = loft("beanie_cuff", cuff_rings, [M["beanie"], M["beanie_red"], M["beanie_navy"]], cap=False)
# The cuff's bands painted per face by the face's own place round the head.
cuff_bands = []
for p in cuff.data.polygons:
    c = p.center
    # Each face's height on the cuff, from the ring it starts on.
    cuff_bands.append(0)
ring_n = len(cuff_rings)
for fi, p in enumerate(cuff.data.polygons):
    if fi >= (ring_n - 1) * AROUND:
        break
    r = fi // AROUND
    cuff_bands[fi] = (0, 2, 1, 1, 2, 0, 0)[min(r, 6)]
cuff.data.polygons.foreach_set("material_index", cuff_bands)
# The pompom on top: a fluffy ball of yarn, its own spring bone so it bobs.
pom_root = cap_pt(0.0, 0.0, 0.0)
bone("fx_pom", pom_root, pom_root + hy * 0.06, parent="head", roll_to=hz)
rides("fx_pom")
pom_c = pom_root + hy * 0.032
bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=2 if GAME else 4, radius=0.036)
rnd_p = random.Random(11)
for v in bm.verts:
    v.co *= 1.0 + 0.16 * rnd_p.random() - 0.04
    v.co.z *= 0.9
bmesh.ops.translate(bm, verts=bm.verts, vec=pom_c)
me = bpy.data.meshes.new("pompom")
bm.to_mesh(me)
bm.free()
me.materials.append(M["beanie"])
me.materials.append(M["beanie_red"])
pom = link(bpy.data.objects.new("pompom", me))
pom.data.polygons.foreach_set("material_index", [1] * len(me.polygons))
for p in me.polygons:
    p.use_smooth = True
FLUTTER["pompom"] = lambda co: 0.2
rides("head")
# SUNGLASSES: a wrap of mirrored lens at the eyes (the face's eyes at y ≈ 0,
# 9 cm ahead), the frame along its top, the arms back to the ears under the
# beanie's rim.
LY0, LY1 = -0.018, 0.019
lens_rings = []
for phi_d in range(-78, 79, 13 if GAME else 4):
    phi = math.radians(phi_d)
    rr = 0.088 + 0.012 * math.cos(phi)
    col = []
    for yy in (LY0, (LY0 + LY1) / 2, LY1):
        dip = 0.007 * (1 - abs(phi_d) / 78) if yy == LY0 else 0.0
        col.append(hp((math.sin(phi) * (0.084 + 0.004 * math.cos(phi)), yy + dip, math.cos(phi) * rr - 0.006)))
    lens_rings.append(col)
gl = loft("glasses_lens", lens_rings, [M["glass_lens"]], closed=False, cap=False)
gs = gl.modifiers.new("thick", "SOLIDIFY")
gs.thickness = 0.003
frame_top = [hp((math.sin(math.radians(a)) * 0.0865, LY1 + 0.002, math.cos(math.radians(a)) * (0.088 + 0.012 * math.cos(math.radians(a))) - 0.004))
             for a in range(-80, 81, 20 if GAME else 6)]
tube("glasses_frame", frame_top, 0.003, M["glasses"])
for sd in (-1, 1):
    tube("glasses_arm", [hp((sd * 0.087, LY1 - 0.004, 0.012)), hp((sd * 0.087, 0.008, -0.04)), hp((sd * 0.081, -0.004, -0.07))],
         0.0024, M["glasses"])

# ---------------------------------------------------------------- GAITERS, FEET, GLOVES
# The pants' cuff straight down over the boot's cuff (the boot itself is
# the ski's, `skis.py`); the foot in its liner inside the shell; and
# LEATHER WORK GLOVES closed round the grips, the tourer's glove of the
# north — tan leather, darker over the palm, a knitted wool cuff pulled up
# under the anorak's sleeve. The glove's cuff rides the forearm's half
# below a break (`forearm_lo_*`), so a broken forearm swings the hand and
# the cuff together.
for i, s in enumerate("lr"):
    rides(f"shin_{s}")
    f, bx, by, bz, _ = frame(f"boot_{s}")
    up_shin = (knees[i] - feet[i]).normalized()
    sh = frame(f"shin_{s}")
    shaft = [(0.0, 0.064, 0.074, 0.07), (0.1, 0.066, 0.074, 0.07), (0.2, 0.068, 0.074, 0.07)]
    loft("gaiter", [[f + bz * -0.03 + up_shin * u + sh[1] * (w * math.cos(a))
                     + sh[3] * ((fr if math.sin(a) > 0 else bk) * math.sin(a))
                     for a in (2 * math.pi * k / 16 for k in range(16))] for u, w, fr, bk in shaft], [M["pants"]])
    rides(f"boot_{s}")
    o, fx_, fy_, fz_, _ = frame(f"boot_{s}")
    lean = 0.22

    def down(d):
        return o + fy_ * (0.014 - d * math.sin(lean)) - fz_ * (0.02 + d * math.cos(lean))

    axis = (fz_ * math.cos(lean) + fy_ * math.sin(lean)).normalized()
    ahead = (fy_ - axis * fy_.dot(axis)).normalized()
    loft("liner", [[down(d) + fx_ * (r * math.cos(2 * math.pi * k / 16)) + ahead * (r * 1.08 * math.sin(2 * math.pi * k / 16))
                    for k in range(16)] for d, r in ((0.0, 0.046), (0.06, 0.049), (0.14, 0.051), (0.2, 0.05))], [M["liner"]])
    sole = o - fz_ * 0.285 + fy_ * -0.02
    FOOT = [(-0.125, 0.03, 0.014, 0.06), (-0.1, 0.04, 0.008, 0.088), (-0.04, 0.043, 0.008, 0.1),
            (0.03, 0.044, 0.008, 0.085), (0.09, 0.045, 0.008, 0.066), (0.13, 0.037, 0.01, 0.05),
            (0.15, 0.02, 0.016, 0.034)]
    loft("foot", [[sole + fy_ * u + fx_ * (w * math.cos(2 * math.pi * k / 16))
                   + fz_ * ((lo + hi) / 2 + (hi - lo) / 2 * math.sin(2 * math.pi * k / 16)) for k in range(16)]
                  for u, w, lo, hi in FOOT], [M["liner"]])
    rides(f"forearm_lo_{s}")
    e, fx, fy, fz, fl = frame(f"forearm_{s}")
    wrist_t = ANSUR["forearm_length"] * MM / fl
    cyl("glove_cuff", e + fy * (fl * (wrist_t - 0.14)), e + fy * (fl * (wrist_t + 0.02)), 0.043, M["cuff_knit"], r2=0.04)
    rides(f"hand_{s}")
    c, hx_h, hy_h, hz_h, _ = frame(f"hand_{s}")
    out = hx_h if hx_h.dot(shoulders[i] - neck) > 0 else -hx_h
    turn = Matrix((out, hy_h, hz_h)).transposed().to_euler()
    ellipsoid("glove_back", c - hy_h * 0.033 + out * 0.012, (0.027, 0.047, 0.045), M["leather"], rot=turn)
    ellipsoid("glove_palm", c - hy_h * 0.03 - out * 0.008, (0.021, 0.041, 0.041), M["leather_dark"], rot=turn)
    for k in range(4):
        along_g = hz_h * (0.027 - 0.018 * k)
        arc = [c + along_g + (hy_h * math.cos(t) + out * math.sin(t)) * 0.022
               for t in (math.radians(a) for a in range(-110, 181, 58 if GAME else 20))]
        tube("finger", arc, 0.009 - 0.0007 * k, M["leather"], smooth_n=0 if GAME else 2)
    tube("thumb", [c - hy_h * 0.03 - out * 0.018 + hz_h * 0.03, c - out * 0.02 + hz_h * 0.045,
                   c + hy_h * 0.02 - out * 0.012 + hz_h * 0.047], 0.0105, M["leather"], smooth_n=0 if GAME else 2)


# ---------------------------------------------------------------- PAINT
# Every modifier baked in and every transform applied, then each vertex's
# OCCLUSION cast (rays into the hemisphere over it, against every part), and
# the vertex colour laid: the face's material colour times that occlusion
# in RGB, how loose the point is (`FLUTTER`) in alpha — a face-corner
# colour, so a colour edge stays sharp where two materials meet.
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
    return 1.0 - 0.55 * hit / len(DIRS)


def base_name(name):
    return name.split(".")[0]


for o in meshes:
    me = o.data
    me.calc_normals_split() if hasattr(me, "calc_normals_split") else None
    ao = [occlusion(v.co, v.normal) for v in me.vertices]
    fl_fn = FLUTTER.get(o.name) or FLUTTER.get(base_name(o.name))
    flt = [fl_fn(v.co) if fl_fn else 0.0 for v in me.vertices]
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    data = []
    for poly in me.polygons:
        m = me.materials[poly.material_index] if me.materials else None
        rgb = srgb(KIT[m.name][0]) if m and m.name in KIT else (1, 1, 1)
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            k = ao[vi]
            data += [rgb[0] * k, rgb[1] * k, rgb[2] * k, flt[vi]]
    attr.data.foreach_set("color", data)
    # The exporter writes the colour's RGB alone, so how loose a point is
    # rides the one UV map's u as well (`TEXCOORD_0`, which the game reads).
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    uv = me.uv_layers.new(name="UVMap")
    uv.data.foreach_set("uv", [c for li in range(len(me.loops)) for c in (flt[me.loops[li].vertex_index], 0.0)])
    me.color_attributes.active_color = attr
    try:
        me.color_attributes.render_color_index = me.color_attributes.active_color_index
    except Exception:
        pass

# ---------------------------------------------------------------- the STUDIO
floor = min(f.z for f in feet) - 0.06
finish(os.path.basename(argv[0]).removesuffix(".json"), OUT, SAMPLES,
       centre=(0, hips.y + 0.1, floor + 0.62), size=3.0, floor=floor, extras={"frame": "body"})

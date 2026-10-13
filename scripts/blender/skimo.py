# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE SKIMO RACER MODELLED IN BLENDER: a ski mountaineering racer as he
# comes over a col in a stage race — a one-piece race suit cut skin tight
# (acid-green chest and arms either side of a black zip band, black sides,
# black legs swept with acid on the outer thigh, blue piping along every
# panel, stirrup cuffs over the boots), his number on a bib stitched to the
# left thigh, the suit's hood stowed down his back, a neck gaiter, a slim
# race pack worn like a vest (a soft flask on the strap, a shovel's shaft
# up its side, bungee laced across its back, the ski-carry strap's loop
# hanging under it), an ultralight race helmet, wrap glasses with a mirror
# lens and thin race gloves — built off the game's own data
# (`kinds/skimo.mjs`): his body (`BODY`), the pose the dressed skier is
# bound in and every bone's frame in it (`dress-loft.ts`'s `bindPose`),
# where an arm breaks (`skier-broken.ts`'s `BREAK`), and his head, face and
# hair as the game's own triangles (`helmet-shape.ts`'s `bareHeadParts`).
#
# The frame is the skier's (`skier.py`): the body frame (x right, y up, z
# forward, the origin at the centre of gravity) laid as Blender's
# (-x, z, y); his sides are the ENGINE's (`_l` the body's x negative).
#
# The game poses him as it poses the dressed skier — bone for bone off
# `skierBones`, the arms' lower halves included, so a broken arm hangs from
# its break — and every move the game has is his with no clip of his own
# (`skimo-model.ts`). What the game ADDS is what hangs off him: three
# SPRING BONES it swings off the chest's own motion (`fx_pack`, the pack;
# `fx_hood`, the stowed hood on his back; `fx_strap`, the ski-carry strap's
# loop under the pack) and the FLUTTER every loose piece carries (the hood's
# rim, the strap's loop, the bib's free corners, the gaiter's tail), which
# the game's vertex shader shakes in the air past him. Every vertex's
# colour is its material's, darkened by its own occlusion (cast here, ray
# by ray), so the game draws him in one vertex-coloured skin as it draws
# the dressed one.

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
BREAKS = DATA["breaks"]


def B(p):
    """A point or direction of the body frame, in Blender's."""
    return Vector((-p["x"], p["z"], p["y"]))


def srgb(hexa):
    """An sRGB colour as linear."""
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 for c in ((hexa >> 16) & 255, (hexa >> 8) & 255, hexa & 255))


# ---------------------------------------------------------------- materials
# A racer's kit after the photographs of a stage race's cols: a suit that
# reads across a ridge (acid green over black, piped in blue), a white
# number bib, a charcoal race pack with acid trim and white bungee, a
# yellow helmet. Each material's colour is baked into the vertex colours
# (`paint`), and the game reads those; the names say which draw a part
# joins (`skimo-model.ts`: the HARD goods a shine of their own).
KIT = {
    "acid": (0xB4E000, 0.55, 0.0), "black": (0x15171B, 0.6, 0.0), "pipe": (0x1F6FE0, 0.5, 0.0),
    "mesh": (0x2C3036, 0.85, 0.0), "zip": (0x0D0E10, 0.4, 0.0), "cuff": (0x23262B, 0.8, 0.0),
    "bib": (0xF4F3EE, 0.7, 0.0), "bib_ink": (0x101114, 0.6, 0.0), "bib_band": (0x1F6FE0, 0.6, 0.0),
    "buff": (0x1B1D21, 0.85, 0.0), "buff_acid": (0xB4E000, 0.8, 0.0),
    "glove": (0x17191C, 0.7, 0.0), "glove_acid": (0xB4E000, 0.6, 0.0), "liner": (0x2B2E34, 0.85, 0.0),
    "pack": (0x2B2F35, 0.75, 0.0), "pack_dark": (0x15181B, 0.75, 0.0), "pack_acid": (0xB4E000, 0.6, 0.0),
    "bungee": (0xEDEDE6, 0.7, 0.0), "flask": (0x3E86C8, 0.3, 0.0), "strap": (0x1A1D21, 0.7, 0.0),
    "skin": (0xC68863, 0.6, 0.0), "knit": (0x4A3526, 0.9, 0.0), "trim": (0x15110E, 0.6, 0.0),
    # The hard goods.
    "helmet": (0xF2C40C, 0.3, 0.0), "helmet_dark": (0x1B1D20, 0.4, 0.0),
    "glasses": (0x121314, 0.3, 0.0), "glass_lens": (0xD2562A, 0.06, 0.7),
    "metal": (0xB8BDC3, 0.3, 0.85), "grip": (0x141618, 0.8, 0.0), "shaft": (0x8C9298, 0.3, 0.8),
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
    split_break(co, out)
    top = sorted(out.items(), key=lambda kv: -kv[1])[:4]
    total = sum(v for _, v in top)
    return {n: v / total for n, v in top}


def split_break(co, out):
    """PAST A BREAK (`skier-broken.ts`, `dress-loft.ts`'s `clothWeights`):
    an arm bone's share past where it would break goes to the bone below
    the break (`upperarm_lo_l` …), eased over a few centimetres — on a sound
    arm the two move as one; broken, the skin past it hangs with the arm."""
    for s in "lr":
        for b, at in ((f"upperarm_{s}", BREAKS["upper"]), (f"forearm_{s}", BREAKS["fore"])):
            share = out.get(b)
            if not share:
                continue
            a, e = SEGMENTS[b]
            m = along(co, SEGMENTS[b])[0] * (e - a).length
            c = max(0.0, min(1.0, (m - at + BREAKS["cut"]) / (2 * BREAKS["cut"])))
            c = c * c * (3 - 2 * c)
            if c <= 0:
                continue
            lo = b.replace("arm_", "arm_lo_")
            if c >= 1:
                out.pop(b)
            else:
                out[b] = share * (1 - c)
            out[lo] = out.get(lo, 0.0) + share * c


# ---------------------------------------------------------------- the BODY
# The flesh round the game's bones is the skier's: ANSUR II's mean man (US
# Army 2012), the very table `skier.py` cites — a guide is a man of the
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


# THE KIT'S EASE, m a side: a RACE SUIT is cut skin tight of a stretch
# knit — it stands a few millimetres off him everywhere (a piste jacket
# stands three centimetres), so what reads is the athlete under it.
EASE = {"chest_front": 0.006, "chest_back": 0.008, "trunk_side": 0.005, "bloused": 0.007,
        "sleeve": 0.005, "pants": 0.005, "cap": 0.003}

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
    return loft(name, rings, [m or M["black"]])


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
TRUNK = [
    (level(ANSUR["crotch"]) - 0.04, bh * 0.8 + 0.008, bd * 0.3 + 0.008, bd * 0.45 + 0.008),
    (level(ANSUR["crotch"]) + 0.05, bh + 0.008, bd * 0.4 + 0.008, bd * 0.52 + 0.008),
    (0.08, bh + E["bloused"], bd * 0.42 + E["bloused"], bd * 0.55 + E["bloused"]),
    (level(ANSUR["waist_h"]), wb + E["bloused"], wd * 0.55 + E["bloused"], wd * 0.45 + E["bloused"]),
    (level(ANSUR["tenth_rib_h"]), wb * 0.97 + E["trunk_side"], wd * 0.55 + E["chest_front"], wd * 0.46 + E["chest_back"]),
    (0.52, cb * 1.05 + E["trunk_side"], cd * 0.51 + E["chest_front"], cd * 0.48 + E["chest_back"]),
    (level(ANSUR["chest_h"]), cb * 1.12 + E["trunk_side"], cd * 0.5 + E["chest_front"], cd * 0.5 + E["chest_back"]),
    (level(ANSUR["axilla_h"]), cb * 1.2 + E["trunk_side"], cd * 0.47 + E["chest_front"], cd * 0.5 + E["chest_back"]),
    (level(ANSUR["acromion_h"]) - 0.05, ANSUR["biacromial"] / 2 * MM * 0.9, cd * 0.4 + E["chest_front"], cd * 0.44 + E["chest_back"]),
    (0.95, r_of(ANSUR["neck_base"]) * 1.4 + 0.008, 0.085, 0.085),
    (1.0, r_of(ANSUR["neck_base"]) + 0.012, 0.072, 0.072),
]
pieces.append(lofted("trunk", "spine", TRUNK, n=2.7))
for i, s in enumerate("lr"):
    reach = ANSUR["bideltoid"] / 2 * MM - ANSUR["biacromial"] / 2 * MM
    out = (shoulders[i] - neck.lerp(hips, 0.12)).normalized()
    pieces.append(ellipsoid("shoulder", shoulders[i] + UP * 0.006 + out * 0.003,
                            (reach + E["cap"] + 0.006, reach + E["cap"] + 0.008, reach + E["cap"] + 0.007), M["black"]))
    b = r_of(ANSUR["biceps"]) * 0.95
    pieces.append(lofted("sleeve", f"upperarm_{s}", [
        (-0.05, b * 1.18 + E["sleeve"], b * 1.12 + E["sleeve"], b * 1.12 + E["sleeve"]),
        (0.35, b + E["sleeve"], b + E["sleeve"], b * 1.05 + E["sleeve"]),
        (0.7, b * 0.92 + E["sleeve"], b * 0.9 + E["sleeve"], b * 0.95 + E["sleeve"]),
        (1.05, b * 0.85 + E["sleeve"], b * 0.9 + E["sleeve"], b * 0.8 + E["sleeve"])]))
    f, w = r_of(ANSUR["forearm"]) * 0.95, r_of(ANSUR["wrist"])
    wrist_t = ANSUR["forearm_length"] * MM / frame(f"forearm_{s}")[4]
    pieces.append(lofted("sleeve", f"forearm_{s}", [
        (-0.08, f * 1.05 + E["sleeve"], f + E["sleeve"], f * 1.1 + E["sleeve"]),
        (0.3, f + E["sleeve"], f + E["sleeve"], f + E["sleeve"]),
        (wrist_t - 0.2, (f + w) / 2 + E["sleeve"], (f + w) / 2 + E["sleeve"], (f + w) / 2 + E["sleeve"]),
        (wrist_t - 0.04, w + E["sleeve"] + 0.003, w + E["sleeve"] + 0.003, w + E["sleeve"] + 0.003)]))
    pieces.append(ellipsoid("elbow", elbows[i], (b + E["sleeve"],) * 3, M["black"]))
    th, lt = r_of(ANSUR["thigh"]), r_of(ANSUR["lower_thigh"])
    pieces.append(lofted("leg", f"thigh_{s}", [
        (-0.12, th * 1.05 + E["pants"], th + E["pants"], th * 1.1 + E["pants"]),
        (0.2, th + E["pants"], th + E["pants"], th + E["pants"]),
        (0.6, (th + lt) / 2 + E["pants"], (th + lt) / 2 + E["pants"], (th + lt) / 2 + E["pants"]),
        (0.95, lt + E["pants"], lt + E["pants"], lt + E["pants"])]))
    ca, an = r_of(ANSUR["calf"]), r_of(ANSUR["ankle"])
    pieces.append(lofted("leg", f"shin_{s}", [
        (-0.05, lt + E["pants"], lt + E["pants"], lt + E["pants"]),
        (0.3, ca * 0.9 + E["pants"], ca * 0.8 + E["pants"], ca * 1.1 + E["pants"]),
        (0.5, ca * 0.82 + E["pants"] + 0.004, ca * 0.78 + E["pants"] + 0.004, ca * 0.95 + E["pants"] + 0.004),
        (0.62, ca * 0.85 + E["pants"] + 0.008, ca * 0.85 + E["pants"] + 0.008, ca * 0.95 + E["pants"] + 0.008)]))
    pieces.append(ellipsoid("knee", knees[i], (lt + E["pants"] + 0.003,) * 3, M["black"]))

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
SUIT_KEYS = ("acid", "black", "pipe", "mesh", "zip", "cuff")
suit.data.materials.clear()
for k in SUIT_KEYS:
    suit.data.materials.append(M[k])
SUIT_MAT = {k: i for i, k in enumerate(SUIT_KEYS)}

# The knit's few small wrinkles where a joint folds it: a race suit is thin
# and stretched, so it creases in shallow ridges, never folds.
FOLDS = [
    ("upperarm", 0.72, 1.0, -1, 0.0025, 0.035), ("forearm", 0.0, 0.22, -1, 0.0025, 0.035),
    ("thigh", 0.78, 1.0, -1, 0.003, 0.04), ("shin", 0.0, 0.18, -1, 0.003, 0.04),
    ("thigh", 0.0, 0.16, 1, 0.002, 0.04), ("spine", 0.12, 0.38, 1, 0.0015, 0.04),
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

# THE CUT, every colour edge a plane the suit is cut along so it runs
# straight across the triangles, the blue PIPING a strip between a plane
# and its twin a few millimetres on. The trunk's front is a wedge either
# side of the chest (`FRONT`, 62° each way from straight ahead) in acid
# green, a black ZIP band up its middle; black below the WAIST, round the
# sides and over the back, a vented MESH panel between the shoulder blades
# (under the pack); the sleeves acid to a black CUFF; the legs black, the
# outer thigh swept by an acid band that runs from high behind down to
# the front of the knee (`SWEEP`).
PIPE = 0.006
WIDE = math.radians(62)
FRONT = [(SX * math.cos(WIDE) - CHEST * math.sin(WIDE)).normalized(),
         (-SX * math.cos(WIDE) - CHEST * math.sin(WIDE)).normalized()]
WAIST_UP = (UP + CHEST * 0.15).normalized()
WAIST_AT = T(level(ANSUR["waist_h"]) - 0.02)
CUFFS = [(frame(f"forearm_{s}")[0] + frame(f"forearm_{s}")[2] * frame(f"forearm_{s}")[4] * 0.8,
          frame(f"forearm_{s}")[2]) for s in "lr"]
# The RAGLAN seam: the sleeve's colour runs up over the shoulder to the
# collar on a straight diagonal from the armpit, front and back alike.
RAGLAN = []
for sd in (-1, 1):
    r0, r1 = T(0.98, sd * 0.075), T(0.68, sd * 0.175)
    d = (r1 - r0).normalized()
    RAGLAN.append((r0, (SX * sd - d * (SX * sd).dot(d)).normalized()))
# Under the armpit the sleeve's colour is cut straight down the arm (`XA`
# out from the spine), so the inside of the arm is a black underarm panel
# and the seam is a plane, never the ragged edge of which bone is nearest.
XA = 0.175
SWEEP = []
for i, s in enumerate("lr"):
    th_head, th_x, th_y, th_z, th_l = frame(f"thigh_{s}")
    outward = th_head - hips
    outward = (outward - th_y * outward.dot(th_y)).normalized()
    n = (th_y * math.cos(math.radians(38)) - th_z * math.sin(math.radians(38))).normalized()
    SWEEP.append({"head": th_head, "out": outward, "n": n, "lo": th_l * 0.3, "hi": th_l * 0.48})
bm = bmesh.new()
bm.from_mesh(suit.data)
planes = []
for nf in FRONT:
    planes += [(hips, nf), (hips + nf * PIPE, nf)]
planes += [(hips + SX * 0.018, SX), (hips - SX * 0.018, SX), (hips + SX * 0.004, SX), (hips - SX * 0.004, SX)]
planes += [(WAIST_AT, WAIST_UP), (WAIST_AT + WAIST_UP * PIPE, WAIST_UP)]
planes += [(T(0.5), UP), (T(0.88), UP), (hips + SX * 0.11, SX), (hips - SX * 0.11, SX)]
planes += CUFFS + [(c + d * PIPE, d) for c, d in CUFFS]
planes += RAGLAN + [(c - n * PIPE, n) for c, n in RAGLAN]
planes += [(hips + SX * XA, SX), (hips - SX * XA, SX)]
for sw in SWEEP:
    for d in (sw["lo"] - PIPE, sw["lo"], sw["hi"], sw["hi"] + PIPE):
        planes.append((sw["head"] + sw["n"] * d, sw["n"]))
    planes.append((sw["head"] - sw["out"] * 0.012, sw["out"]))
for co, no in planes:
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)
bm.to_mesh(suit.data)
bm.free()


def above(co, plane):
    return (co - plane[0]).dot(plane[1]) > 0


def cloth_of(co):
    b = nearest(co)
    if b.startswith(("shin", "boot")):
        return "black"
    if b.startswith("thigh"):
        sw = SWEEP["lr".index(b[-1])]
        if (co - sw["head"]).dot(sw["out"]) < -0.012:
            return "black"
        d = (co - sw["head"]).dot(sw["n"])
        if sw["lo"] <= d <= sw["hi"]:
            return "acid"
        if sw["lo"] - PIPE <= d < sw["lo"] or sw["hi"] < d <= sw["hi"] + PIPE:
            return "pipe"
        return "black"
    if b.startswith("forearm"):
        cuff = CUFFS["lr".index(b[-1])]
        if above(co, cuff):
            return "cuff" if above(co, (cuff[0] + cuff[1] * PIPE, cuff[1])) else "pipe"
        return "acid"
    r = co - hips
    lv = r.dot(UP) / SPINE_L
    if abs(r.dot(SX)) > XA and lv > 0.4:
        return "acid"
    rag = RAGLAN[0 if r.dot(SX) < 0 else 1]
    if above(co, rag):
        return "acid"
    if above(co, (rag[0] - rag[1] * PIPE, rag[1])):
        return "pipe"
    x = r.dot(SX)
    waist = (co - WAIST_AT).dot(WAIST_UP)
    out_r, out_l = r.dot(FRONT[0]), r.dot(FRONT[1])
    if out_r < 0 and out_l < 0 and r.dot(CHEST) > 0:
        if waist < 0:
            return "black"
        if waist < PIPE:
            return "pipe"
        if abs(x) < 0.004:
            return "zip"
        return "black" if abs(x) < 0.018 else "acid"
    if out_r < PIPE and out_l < PIPE and r.dot(CHEST) > 0 and waist > 0:
        return "pipe"
    if r.dot(CHEST) < 0 and abs(x) < 0.11 and 0.5 < lv < 0.88:
        return "mesh"
    return "black"


suit.data.polygons.foreach_set("material_index", [SUIT_MAT[cloth_of(p.center)] for p in suit.data.polygons])
for p in suit.data.polygons:
    p.use_smooth = True
weights(suit, suit_weights)

# ---------------------------------------------------------------- ON THE SUIT
# Everything strapped over the suit is laid ON it: a ray cast from inside
# him (the bone's line) out through the finished suit, the piece set a few
# millimetres past where it leaves — so a strap or the bib lies on the
# cloth as cut, never inside it and never floating off it.
_sv = [suit.matrix_world @ v.co for v in suit.data.vertices]
SUIT_BVH = BVHTree.FromPolygons(_sv, [tuple(p.vertices) for p in suit.data.polygons], epsilon=0.0)


def on_suit(base, d, gap):
    """The suit's outside along `d` from `base` inside him, `gap` m out."""
    d = d.normalized()
    hit = SUIT_BVH.ray_cast(base, d, 0.5)[0]
    return (hit if hit is not None else base + d * 0.1) + d * gap


def on_trunk(p, gap):
    """A trunk point `p` brought onto the suit, out from the spine's line."""
    a, b = SEGMENTS["spine"]
    d = b - a
    t = max(0.0, min(1.0, (p - a).dot(d) / d.length_squared))
    base = a + d * t
    return on_suit(base, p - base, gap)


def back_at(lv):
    """How far behind the spine's line his back (the suit) stands at a level."""
    return (on_suit(T(lv), -CHEST, 0.0) - T(lv)).dot(-CHEST)


# ---------------------------------------------------------------- the PACK
# A RACE PACK of 15–20 litres, worn tight as a vest: a slim body 40 cm high,
# 24 wide and 12 deep, charcoal with an acid band across its top and white
# bungee laced across its back (where the skins go between climbs), a
# shovel's shaft up its right side with its T-grip proud of the top; vest
# straps 6 cm wide over the shoulders and down the chest, two sternum
# straps, a soft flask on the right strap; and under it the ski-carry
# strap's loop, which hangs free. The body rides its own spring bone
# (`fx_pack`) and the loop one of its own (`fx_strap`).
PACK_LO, PACK_HI = 0.36, 0.895
pack_back = max(back_at(lv) for lv in (0.4, 0.55, 0.7, 0.85)) + 0.008
pack_top = T(PACK_HI, 0.0, -(pack_back + 0.06))
bone("fx_pack", pack_top, pack_top + UP * 0.1, parent="chest", roll_to=-CHEST)
rides("fx_pack")
SECTIONS = [  # level, half across, depth
    (PACK_LO, 0.085, 0.07), (PACK_LO + 0.04, 0.108, 0.11), (0.55, 0.12, 0.12), (0.75, 0.12, 0.118),
    (0.85, 0.112, 0.105), (PACK_HI - 0.015, 0.098, 0.075), (PACK_HI, 0.075, 0.04)]


def pack_mat(c):
    lv = (c - hips).dot(UP) / SPINE_L
    return 2 if 0.775 < lv < 0.815 else (1 if lv < PACK_LO + 0.045 else 0)


loft("pack", [ring(T(lv, 0.0, -(pack_back + dp / 2)), SX, CHEST, hx2, dp / 2, n=3.2) for lv, hx2, dp in SECTIONS],
     [M["pack"], M["pack_dark"], M["pack_acid"]], face_mat=pack_mat)
# The bungee: three crosses laced edge to edge over the back face, the
# hooks at the edges a little in from the face's middle (the body is
# rounded, `n` 3.2).
face = pack_back + 0.12 + 0.004
edge = pack_back + 0.06 + 0.06 * 0.853 + 0.003
for a, b2 in ((0.47, 0.57), (0.57, 0.67), (0.67, 0.77)):
    for sd in (-1, 1):
        tube("bungee", [T(a, sd * 0.09, -edge), T((a + b2) / 2, 0.0, -face), T(b2, -sd * 0.09, -edge)],
             0.0028, M["bungee"], smooth_n=0 if GAME else 3)
# The shovel's shaft in its sleeve up the right side, the T-grip across.
sh_foot, sh_top = T(0.42, 0.112, -(pack_back + 0.05)), T(PACK_HI + 0.05, 0.1, -(pack_back + 0.05))
cyl("shovel_shaft", sh_foot, sh_top, 0.0105, M["shaft"], seg=12)
cyl("shovel_grip", sh_top + UP * 0.004 - SX * 0.035, sh_top + UP * 0.004 + SX * 0.035, 0.011, M["grip"], seg=12)
cyl("shovel_sleeve", sh_foot + UP * 0.02, sh_foot + UP * 0.14, 0.0135, M["pack_dark"], seg=12)

# THE SKI-CARRY STRAP: a loop of webbing under the pack's foot (the skis'
# tails go in it when they are carried), hanging free on `fx_strap`.
strap_root = T(PACK_LO + 0.01, 0.0, -(pack_back + 0.035))
bone("fx_strap", strap_root, strap_root - UP * 0.2, parent="fx_pack", roll_to=-CHEST)
rides("fx_strap")
loop = [T(PACK_LO + 0.02, -0.06, -(pack_back + 0.03)), T(PACK_LO - 0.05, -0.065, -(pack_back + 0.04)),
        T(PACK_LO - 0.12, -0.02, -(pack_back + 0.05)), T(PACK_LO - 0.13, 0.03, -(pack_back + 0.05)),
        T(PACK_LO - 0.07, 0.07, -(pack_back + 0.04)), T(PACK_LO + 0.02, 0.065, -(pack_back + 0.03))]
ribbon("carry_strap", catmull(loop, n=3 if GAME else 6), 0.024, 0.003, M["strap"], lambda p: -CHEST)
FLUTTER["carry_strap"] = lambda co: min(1.0, max(0.0, (strap_root - co).dot(UP) / (0.13 * SPINE_L))) * 0.85

# THE VEST STRAPS, riding him as the cloth does: from the pack's top over
# each shoulder and down his chest to the lower ribs, the lower straps from
# the pack's sides under his arms, two sternum straps, the flask.
rides("chest")
straps = []
for sd in (-1, 1):
    pth = [T(0.87, sd * 0.07, -0.2), T(0.98, sd * 0.1, -0.2), T(1.03, sd * 0.11, 0.0),
           T(0.93, sd * 0.105, 0.2), T(0.75, sd * 0.1, 0.2), T(0.55, sd * 0.105, 0.2)]
    path = [on_trunk(p, 0.006) for p in catmull(pth, n=4 if GAME else 8)]
    straps.append(ribbon("strap", path, 0.06, 0.005, M["pack_dark"], off_trunk))
    low = [T(0.6, sd * 0.11, 0.2), T(0.56, sd * 0.2, 0.0), T(PACK_LO + 0.06, sd * 0.12, -0.2)]
    straps.append(ribbon("strap_low", [on_trunk(p, 0.005) for p in catmull(low, n=3 if GAME else 6)],
                         0.022, 0.004, M["strap"], off_trunk))
for lv in (0.84, 0.72):
    mid = on_trunk(T(lv, 0.0, 0.2), 0.016)
    straps.append(box("sternum", mid, (0.2, 0.004, 0.016), M["strap"], bevel=0,
                      rot=CHEST.to_track_quat("Y", "Z").to_euler()))
    straps.append(box("sternum_buckle", mid + CHEST * 0.004, (0.03, 0.008, 0.022), M["grip"], bevel=0,
                      rot=CHEST.to_track_quat("Y", "Z").to_euler()))
# The soft flask in the right strap's pocket: a squashed bottle, its cap up.
fl_at = on_trunk(T(0.7, 0.1, 0.2), 0.026)
fl_out = off_trunk(fl_at)
straps.append(ellipsoid("flask", fl_at, (0.034, 0.022, 0.06), M["flask"],
                        rot=fl_out.to_track_quat("Y", "Z").to_euler()))
straps.append(cyl("flask_cap", fl_at + UP * 0.055, fl_at + UP * 0.078, 0.009, M["grip"], seg=10))
for o in straps:
    weights(o, lambda co: suit_weights(co, [n for n in SEGMENTS if n in ("spine", "head")]))

# THE HOOD, stowed: the suit's hood rolled into the collar's back and hung
# down his upper back above the pack — a soft cup acid outside and black
# inside, its rim loose (`fx_hood`).
hood_c = T(0.905, 0.0, -(back_at(0.95) + 0.042))
bone("fx_hood", hood_c + UP * 0.075, hood_c + UP * 0.215, parent="chest", roll_to=-CHEST)
rides("fx_hood")
HOOD = [(0.0, 0.035, 0.012), (0.025, 0.075, 0.026), (0.05, 0.095, 0.034), (0.075, 0.1, 0.036)]
hood = loft("hood", [ring(hood_c + UP * h, SX, CHEST, hx2, hz2, n=2.6) for h, hx2, hz2 in HOOD],
            [M["acid"], M["black"]], cap=False)
hs = hood.modifiers.new("thick", "SOLIDIFY")
hs.thickness, hs.material_offset, hs.use_rim = 0.004, 1, True
tube("hood_rim", ring(hood_c + UP * 0.075, SX, CHEST, 0.1, 0.036, n=2.6), 0.0032, M["pipe"], closed=True)
FLUTTER["hood"] = lambda co: min(1.0, max(0.0, ((co - hood_c).dot(UP) - 0.03) / 0.045)) * 0.5
FLUTTER["hood_rim"] = lambda co: 0.5

# THE NECK GAITER: a tube of thin knit from the collar to the chin, black
# with an acid band round it, the top easing from the chest to the head.
rides("chest")
hc, hx, hy, hz, _ = frame("head")


def hp(p):
    return hc + hx * p[0] + hy * p[1] + hz * p[2]


neck_top = hp((0.0, -0.118, -0.012))
buff_rings = []
for k, (u, rx, rz) in enumerate(((0.0, 0.088, 0.09), (0.3, 0.078, 0.08), (0.65, 0.066, 0.072), (1.0, 0.062, 0.07))):
    c = T(0.975).lerp(neck_top, u)
    up_ = (neck_top - T(0.975)).normalized()
    fwd = (hz - up_ * hz.dot(up_)).normalized()
    buff_rings.append(ring(c, up_.cross(fwd).normalized(), fwd, rx, rz, n=2.2))
buff = loft("buff", buff_rings, [M["buff"], M["buff_acid"]], cap=False,
            face_mat=lambda c: 1 if 0.45 < (c - T(0.975)).dot((neck_top - T(0.975)).normalized()) / (neck_top - T(0.975)).length < 0.62 else 0)
bs = buff.modifiers.new("thick", "SOLIDIFY")
bs.thickness, bs.offset = 0.003, 1
weights(buff, lambda co: suit_weights(co, ["spine", "head"]))

# ---------------------------------------------------------------- the BIB
# His number, stitched to the left thigh as a stage race's are: a white
# panel 14 cm across and 11 tall wrapped round the front and outside of
# the thigh, a blue band across its top, three seven-segment black digits
# under it; it bends with the thigh, its lower corners a little loose.
bh_, bx_, by_, bz_, bl_ = frame("thigh_l")
b_out = SWEEP[0]["out"]
b_out = (b_out - by_ * b_out.dot(by_)).normalized()
A0, A1, BT0, BT1 = -0.4, 1.2, 0.27, 0.27 + 0.11 / bl_


def bib_pt(a, t, lift):
    base = bh_ + by_ * (t * bl_)
    return on_suit(base, bz_ * math.cos(a) + b_out * math.sin(a), 0.003 + lift)


NA, NT = (10, 5) if GAME else (24, 12)
verts, faces, fm = [], [], []
for j in range(NT + 1):
    for i in range(NA + 1):
        verts.append(bib_pt(A0 + (A1 - A0) * i / NA, BT0 + (BT1 - BT0) * j / NT, 0.0))
for j in range(NT):
    for i in range(NA):
        a = j * (NA + 1) + i
        faces.append([a, a + 1, a + NA + 2, a + NA + 1])
        fm.append(1 if j < max(1, NT // 5) else 0)
bib = mesh_obj("bib", verts, faces, [M["bib"], M["bib_band"]], fm)
bsol = bib.modifiers.new("thick", "SOLIDIFY")
bsol.thickness, bsol.offset = 0.0015, -1
SEVEN = {"a": ((0, 2), (1, 2)), "b": ((1, 2), (1, 1)), "c": ((1, 1), (1, 0)), "d": ((0, 0), (1, 0)),
         "e": ((0, 0), (0, 1)), "f": ((0, 1), (0, 2)), "g": ((0, 1), (1, 1))}
DIGITS = {"2": "abged", "1": "bc", "4": "fgbc", "7": "abc", "3": "abgcd"}
dv, df = [], []
CELL_A, CELL_T = 0.26, 0.022 / bl_      # a digit's width in angle, half its height along the thigh
STROKE_A, STROKE_T = 0.06, 0.005 / bl_
for k, ch in enumerate("214"):
    # The angle runs round from his front to his outside, which reads right
    # to left on his thigh: the digits laid from the far end, each mirrored.
    a0 = 0.4 + (1 - k) * 0.42 - CELL_A / 2
    t0 = BT1 - 0.016 / bl_            # the digits' foot, near the bib's lower edge
    for seg in DIGITS[ch]:
        (u0, v0), (u1, v1) = SEVEN[seg]
        pa = (a0 + (1 - u0) * CELL_A, t0 - v0 * CELL_T)
        pb = (a0 + (1 - u1) * CELL_A, t0 - v1 * CELL_T)
        if u0 == u1:   # an upright stroke
            quad = [(pa[0] - STROKE_A / 2, pa[1]), (pa[0] + STROKE_A / 2, pa[1]),
                    (pb[0] + STROKE_A / 2, pb[1]), (pb[0] - STROKE_A / 2, pb[1])]
        else:
            quad = [(pa[0], pa[1] - STROKE_T), (pb[0], pb[1] - STROKE_T), (pb[0], pb[1] + STROKE_T), (pa[0], pa[1] + STROKE_T)]
        base = len(dv)
        dv += [bib_pt(a, t, 0.0012) for a, t in quad]
        df.append([base, base + 1, base + 2, base + 3])
digits = mesh_obj("bib_digits", dv, df, [M["bib_ink"]])
FLUTTER["bib"] = lambda co: 0.3 * max(0.0, min(1.0, ((co - bh_).dot(by_) / bl_ - (BT1 - 0.06)) / 0.06)) * \
    (1.0 if abs(math.atan2((co - bh_).dot(b_out), (co - bh_).dot(bz_)) - (A0 + A1) / 2) > 0.55 else 0.0)
for o in (bib, digits):
    weights(o, lambda co: suit_weights(co, ["thigh_l", "spine", "shin_l"]))

# ---------------------------------------------------------------- the HEAD
# His head, face and hair are the game's own triangles (`bareHeadParts`),
# under an ULTRALIGHT RACE HELMET — a low, rounded shell two centimetres off
# the head, open at the brow and over the ears, vented in black slots, in
# the yellow a race's rules ask be seen — and WRAP GLASSES: one mirrored
# lens across both eyes on a thin frame, the arms back to the ears.
rides("head")
HPAINT = {"skin": M["skin"], "knit": M["knit"], "trim": M["trim"], "strap": M["helmet_dark"],
          "lens": M["glass_lens"], "shell": M["helmet"]}


for part in HEAD["game" if GAME else "fine"]:
    Pp, N, I = part["position"], part["normal"], part["index"]
    verts = [hp(Pp[k:k + 3]) for k in range(0, len(Pp), 3)]
    faces = [I[k:k + 3] for k in range(0, len(I), 3)]
    ob = mesh_obj(f"head_{part['material']}", verts, faces, [HPAINT.get(part["material"], M["knit"])], recalc=False)
    normals = [tuple(hx * N[k] + hy * N[k + 1] + hz * N[k + 2]) for k in range(0, len(N), 3)]
    ob.data.normals_split_custom_set_from_vertices(normals)
# The shell: an ellipsoid's cap over the egg (`helmet-shape.ts`'s HEAD:
# 0.077 × 0.104 × 0.097 about (0, −0.014, −0.006)), 2 cm off it, its rim at
# the brow in front, over the ears, dropped behind.
HC_ = (0.0, -0.012, -0.006)
HR = (0.097, 0.122, 0.118)
AROUND, DOWN = (20, 6) if GAME else (48, 14)


def rim_y(phi):
    """The rim's height round the head (phi 0 ahead)."""
    return 0.028 * math.cos(phi) + 0.01


def shell_pt(phi, u, grow=0.0):
    """A point of the shell: round from ahead by `phi`, `u` from the crown
    (0) to the rim (1)."""
    ry = rim_y(phi)
    top = HC_[1] + HR[1]
    yy = top + (ry - top) * u
    k = math.sqrt(max(0.0, 1 - ((yy - HC_[1]) / HR[1]) ** 2))
    return hp((HC_[0] + math.sin(phi) * (HR[0] + grow) * k, yy + grow * 0.3,
               HC_[2] + math.cos(phi) * (HR[2] + grow) * k))


shell_rings = [[shell_pt(2 * math.pi * i / AROUND, (j / DOWN) ** 1.3 if j else 0.02) for i in range(AROUND)] for j in range(DOWN + 1)]
shell = loft("helmet_shell", shell_rings, [M["helmet"], M["helmet_dark"]], face_mat=lambda c: 0)
# The loft winds its faces inward; turned out so the game's one-sided
# hard goods draw the outside of the shell, not the inside through it.
bm = bmesh.new()
bm.from_mesh(shell.data)
bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
bm.to_mesh(shell.data)
bm.free()
sol = shell.modifiers.new("thick", "SOLIDIFY")
sol.thickness, sol.offset = 0.008, -1
# The vents: long black slots down either side of the crown and across the
# back — a race shell is more hole than shell.
for sd in (-1, 1):
    for phi, u in ((0.35, 0.4), (0.8, 0.45), (1.3, 0.5), (1.85, 0.5), (2.45, 0.45)):
        c = shell_pt(sd * phi, u, 0.003)
        out = (c - hp(HC_)).normalized()
        ellipsoid("vent", c, (0.019, 0.0055, 0.0035), M["helmet_dark"],
                  rot=out.to_track_quat("Z", "Y").to_euler())
rim = [shell_pt(2 * math.pi * i / AROUND, 1.0, 0.002) for i in range(AROUND)]
tube("helmet_rim", rim, 0.004, M["helmet_dark"], closed=True)
# The chin strap, ear to ear under the jaw.
cs = []
for k in range(11):
    t = (k / 10 * 2 - 1) * (math.pi / 2)
    cs.append(hp((0.072 * math.sin(t), -0.056 - 0.058 * math.cos(t), 0.004 + 0.05 * math.cos(t))))
tube("chin_strap", [hp((-0.083, 0.008, -0.01))] + cs + [hp((0.083, 0.008, -0.01))], 0.0032, M["helmet_dark"])
# WRAP GLASSES: the lens a band across the eyes (the face's eyes at y ≈ 0,
# 9 cm ahead) curving back past the temples; a thin frame along its top;
# the arms to the ears, under the helmet's rim.
LY0, LY1 = -0.017, 0.018
lens_rings = []
for phi_d in range(-84, 85, 12 if GAME else 4):
    phi = math.radians(phi_d)
    rr = 0.087 + 0.012 * math.cos(phi)
    col = []
    for yy in (LY0, (LY0 + LY1) / 2, LY1):
        dip = 0.007 * (1 - abs(phi_d) / 84) if yy == LY0 else 0.0
        shrink = 0.004 * (abs(phi_d) / 84) ** 2 * (1 if yy == LY0 else -1 if yy == LY1 else 0)
        col.append(hp((math.sin(phi) * (0.083 + 0.004 * math.cos(phi)), yy + dip + shrink, math.cos(phi) * rr - 0.006)))
    lens_rings.append(col)
gl = loft("glasses_lens", lens_rings, [M["glass_lens"]], closed=False, cap=False)
gs = gl.modifiers.new("thick", "SOLIDIFY")
gs.thickness = 0.003
frame_top = [hp((math.sin(math.radians(a)) * 0.0855, LY1 + 0.001, math.cos(math.radians(a)) * (0.087 + 0.012 * math.cos(math.radians(a))) - 0.004))
             for a in range(-84, 85, 21 if GAME else 6)]
tube("glasses_frame", frame_top, 0.0024, M["glasses"])
for sd in (-1, 1):
    tube("glasses_arm", [hp((sd * 0.086, LY1 - 0.004, -0.004)), hp((sd * 0.087, 0.006, -0.045)), hp((sd * 0.081, -0.006, -0.07))],
         0.002, M["glasses"])

# ---------------------------------------------------------------- CUFFS, FEET, GLOVES
# The suit's STIRRUP CUFFS over the boot's cuff (the boot itself is the
# ski's, `skis.py`), a black band at their top; the foot in its liner
# inside the shell; and THIN RACE GLOVES — black with acid backs, a short
# cuff over the suit's, riding the forearm's lower half so a broken wrist
# takes the glove with it.
for i, s in enumerate("lr"):
    rides(f"shin_{s}")
    f, bx, by, bz, _ = frame(f"boot_{s}")
    up_shin = (knees[i] - feet[i]).normalized()
    sh = frame(f"shin_{s}")
    shaft = [(0.0, 0.062, 0.071, 0.068), (0.09, 0.063, 0.071, 0.068), (0.17, 0.064, 0.071, 0.068), (0.2, 0.062, 0.068, 0.066)]
    loft("gaiter", [[f + bz * -0.03 + up_shin * u + sh[1] * (w * math.cos(a))
                     + sh[3] * ((fr if math.sin(a) > 0 else bk) * math.sin(a))
                     for a in (2 * math.pi * k / 16 for k in range(16))] for u, w, fr, bk in shaft],
         [M["cuff"], M["black"]], face_mat=lambda c, f=f, up_shin=up_shin: 1 if (c - f).dot(up_shin) > 0.15 else 0)
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
    cyl("glove_cuff", e + fy * (fl * (wrist_t - 0.06)), e + fy * (fl * (wrist_t + 0.02)), 0.039, M["glove"], r2=0.036)
    rides(f"hand_{s}")
    c, hx_h, hy_h, hz_h, _ = frame(f"hand_{s}")
    out = hx_h if hx_h.dot(shoulders[i] - neck) > 0 else -hx_h
    turn = Matrix((out, hy_h, hz_h)).transposed().to_euler()
    ellipsoid("glove_back", c - hy_h * 0.033 + out * 0.012, (0.025, 0.045, 0.043), M["glove_acid"], rot=turn)
    ellipsoid("glove_palm", c - hy_h * 0.03 - out * 0.008, (0.019, 0.039, 0.039), M["glove"], rot=turn)
    for k in range(4):
        along_g = hz_h * (0.027 - 0.018 * k)
        arc = [c + along_g + (hy_h * math.cos(t) + out * math.sin(t)) * 0.022
               for t in (math.radians(a) for a in range(-110, 181, 58 if GAME else 20))]
        tube("finger", arc, 0.0084 - 0.0007 * k, M["glove"], smooth_n=0 if GAME else 2)
    tube("thumb", [c - hy_h * 0.03 - out * 0.018 + hz_h * 0.03, c - out * 0.02 + hz_h * 0.045,
                   c + hy_h * 0.02 - out * 0.012 + hz_h * 0.047], 0.0098, M["glove"], smooth_n=0 if GAME else 2)


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

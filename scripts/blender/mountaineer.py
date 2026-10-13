# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE MOUNTAIN GUIDE MODELLED IN BLENDER: a ski guide of the interior
# ranges' lodges and heli operations on the descent, after reference
# photographs of guides at work there — a black hardshell with mustard
# shoulders and sleeves over black shell pants, a white ripstop ski pack
# with the orange shovel handle and probe out of its top and a streamer of
# flagging tape tied to its tool loop, the airbag's trigger handle on the
# left strap, the guide's RADIO in a chest harness with its whip antenna
# and a speaker-mic clipped to the collar, a pale grey climbing helmet
# with mirrored goggles on its strap, and leather work gloves closed round
# the grips — built off the game's own data (`kinds/mountaineer.mjs`): his
# body (`BODY`), the pose the dressed skier is bound in and every bone's
# frame in it (`dress-loft.ts`'s `bindPose`), and his head, face and hair
# as the game's own triangles (`helmet-shape.ts`'s `bareHeadParts`).
#
# The frame is the skier's (`skier.py`): the body frame (x right, y up, z
# forward, the origin at the centre of gravity) laid as Blender's
# (-x, z, y); his sides are the ENGINE's (`_l` the body's x negative).
#
# The game poses him as it poses the dressed skier — bone for bone off
# `skierBones` — so every move the game has is his with no clip of his own
# (`player-model.ts`). What the game ADDS is what hangs off him: three
# SPRING BONES the game swings off the chest's own motion (`fx_pack`, the
# pack and what rides on it; `fx_ant`, the radio's whip antenna; `fx_flag`,
# the flagging tape off the pack) and the FLUTTER every loose piece of
# cloth carries (the jacket's hem, the straps' tails, the tape), which the
# game's vertex shader shakes in the air past him. Every vertex's colour is
# its material's, darkened by its own occlusion (cast here, ray by ray), so
# the game draws him in one vertex-coloured skin as it draws the dressed one.

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


def B(p):
    """A point or direction of the body frame, in Blender's."""
    return Vector((-p["x"], p["z"], p["y"]))


def srgb(hexa):
    """An sRGB colour as linear."""
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 for c in ((hexa >> 16) & 255, (hexa >> 8) & 255, hexa & 255))


# ---------------------------------------------------------------- materials
# A guide's kit after the photographs: a black hardshell with its shoulders
# and upper sleeves in mustard so the group reads him against the snow and
# the trees, black shell pants with darker scuff guards inside the ankles,
# a white ripstop pack with dark webbing and orange tools, a black radio
# harness, tan leather gloves. Each material's colour is baked into the
# vertex colours (`paint`), and the game reads those; the names say which
# draw a part joins (`player-model.ts`: the HARD goods a shine of their own).
KIT = {
    "shell": (0x1E2125, 0.62, 0.0), "panel": (0xD99A1E, 0.6, 0.0), "pants": (0x17191C, 0.8, 0.0),
    "scuff": (0x2E3237, 0.8, 0.0), "zip": (0x0E0F11, 0.5, 0.0), "glove": (0xA67A4B, 0.75, 0.0),
    "palm": (0x8A6237, 0.7, 0.0), "cuff_knit": (0x1A1B1E, 0.9, 0.0), "liner": (0x2B2E34, 0.85, 0.0),
    "webbing": (0x1B1D20, 0.7, 0.0),
    "pack": (0xE6E7E2, 0.75, 0.0), "pack_grid": (0xA9ADB0, 0.75, 0.0), "pack_dark": (0x1D2023, 0.75, 0.0),
    "flag": (0xF2502A, 0.65, 0.0), "radio_pouch": (0x16181A, 0.8, 0.0), "trigger": (0xD8302A, 0.55, 0.0),
    "skin": (0xC68863, 0.6, 0.0), "knit": (0x4A3526, 0.9, 0.0), "trim": (0x15110E, 0.6, 0.0),
    # The hard goods.
    "helmet": (0xD4D6D8, 0.3, 0.0), "helmet_dark": (0x23262A, 0.4, 0.0), "helmet_accent": (0xE8641E, 0.35, 0.0),
    "goggle": (0x141517, 0.4, 0.0), "goggle_lens": (0x2A5F9E, 0.06, 0.7), "radio": (0x2A2C2F, 0.45, 0.1),
    "antenna": (0x0D0E0F, 0.5, 0.0), "metal": (0xB8BDC3, 0.3, 0.85), "tool": (0xE8641E, 0.35, 0.3),
    "grip": (0x141618, 0.8, 0.0),
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
    top = sorted(out.items(), key=lambda kv: -kv[1])[:4]
    total = sum(v for _, v in top)
    return {n: v / total for n, v in top}


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


# THE KIT'S EASE, m a side: a SOFTSHELL is cut close — a climber's jacket
# moves with him and carries no insulation (a guide skis down in it over a
# thin fleece) — so it stands a centimetre or two off the body where a
# piste jacket stands three; the pants are slim through the thigh and
# straight over the boot, with no flare.
EASE = {"chest_front": 0.016, "chest_back": 0.018, "trunk_side": 0.014, "bloused": 0.02,
        "sleeve": 0.013, "pants": 0.012, "cap": 0.006}

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
    return loft(name, rings, [m or M["shell"]])


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
    (level(ANSUR["crotch"]) - 0.04, bh * 0.8 + 0.016, bd * 0.3 + 0.016, bd * 0.45 + 0.016),
    (level(ANSUR["crotch"]) + 0.05, bh + 0.016, bd * 0.4 + 0.016, bd * 0.52 + 0.016),
    (0.08, bh + E["bloused"], bd * 0.42 + E["bloused"], bd * 0.55 + E["bloused"]),
    (level(ANSUR["waist_h"]), wb + E["bloused"], wd * 0.55 + E["bloused"], wd * 0.45 + E["bloused"]),
    (level(ANSUR["tenth_rib_h"]), wb * 0.97 + E["trunk_side"], wd * 0.55 + E["chest_front"], wd * 0.46 + E["chest_back"]),
    (0.52, cb * 1.05 + E["trunk_side"], cd * 0.51 + E["chest_front"], cd * 0.48 + E["chest_back"]),
    (level(ANSUR["chest_h"]), cb * 1.12 + E["trunk_side"], cd * 0.5 + E["chest_front"], cd * 0.5 + E["chest_back"]),
    (level(ANSUR["axilla_h"]), cb * 1.2 + E["trunk_side"], cd * 0.47 + E["chest_front"], cd * 0.5 + E["chest_back"]),
    (level(ANSUR["acromion_h"]) - 0.05, ANSUR["biacromial"] / 2 * MM * 0.9, cd * 0.4 + E["chest_front"], cd * 0.44 + E["chest_back"]),
    (0.95, r_of(ANSUR["neck_base"]) * 1.45 + 0.016, 0.092, 0.092),
    (1.0, r_of(ANSUR["neck_base"]) + 0.024, 0.084, 0.084),
]
pieces.append(lofted("trunk", "spine", TRUNK, n=2.7))
# A climber's collar: stood up close round the neck, higher than a piste
# jacket's and snug, the stowed hood rolled into it behind.
collar = [neck.lerp(head_c, u) for u in (0.0, 0.2, 0.38)]
pieces.append(loft("collar", [[c + SX * (0.088 * math.cos(2 * math.pi * k / SEG)) + CHEST * (0.085 * math.sin(2 * math.pi * k / SEG))
                               for k in range(SEG)] for c in collar], [M["shell"]]))
for i, s in enumerate("lr"):
    reach = ANSUR["bideltoid"] / 2 * MM - ANSUR["biacromial"] / 2 * MM
    out = (shoulders[i] - neck.lerp(hips, 0.12)).normalized()
    pieces.append(ellipsoid("shoulder", shoulders[i] + UP * 0.008 + out * 0.004,
                            (reach + E["cap"] + 0.008, reach + E["cap"] + 0.01, reach + E["cap"] + 0.009), M["shell"]))
    b = r_of(ANSUR["biceps"]) * 0.95
    pieces.append(lofted("sleeve", f"upperarm_{s}", [
        (-0.05, b * 1.2 + E["sleeve"], b * 1.15 + E["sleeve"], b * 1.15 + E["sleeve"]),
        (0.35, b + E["sleeve"], b + E["sleeve"], b * 1.05 + E["sleeve"]),
        (0.7, b * 0.92 + E["sleeve"], b * 0.9 + E["sleeve"], b * 0.95 + E["sleeve"]),
        (1.05, b * 0.85 + E["sleeve"], b * 0.9 + E["sleeve"], b * 0.8 + E["sleeve"])]))
    f, w = r_of(ANSUR["forearm"]) * 0.95, r_of(ANSUR["wrist"])
    wrist_t = ANSUR["forearm_length"] * MM / frame(f"forearm_{s}")[4]
    pieces.append(lofted("sleeve", f"forearm_{s}", [
        (-0.08, f * 1.05 + E["sleeve"], f + E["sleeve"], f * 1.1 + E["sleeve"]),
        (0.3, f + E["sleeve"], f + E["sleeve"], f + E["sleeve"]),
        (wrist_t - 0.2, (f + w) / 2 + E["sleeve"], (f + w) / 2 + E["sleeve"], (f + w) / 2 + E["sleeve"]),
        (wrist_t - 0.06, w + E["sleeve"] + 0.004, w + E["sleeve"] + 0.004, w + E["sleeve"] + 0.004)]))
    pieces.append(ellipsoid("elbow", elbows[i], (b + E["sleeve"],) * 3, M["shell"]))
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
    thin.ratio = 3600 / max(1, len(suit.data.polygons) * 2)
    bpy.ops.object.convert(target="MESH")
suit.data.materials.clear()
for k in ("shell", "panel", "pants", "scuff", "zip"):
    suit.data.materials.append(M[k])
SUIT_MAT = {"shell": 0, "panel": 1, "pants": 2, "scuff": 3, "zip": 4}

# The cloth's folds at the joints, gentler than a padded suit's: a
# softshell is thin, so it creases in a few small ridges.
FOLDS = [
    ("upperarm", 0.72, 1.0, -1, 0.005, 0.04), ("forearm", 0.0, 0.22, -1, 0.005, 0.04),
    ("forearm", 0.62, 0.8, 0, 0.003, 0.025),
    ("thigh", 0.78, 1.0, -1, 0.006, 0.045), ("shin", 0.0, 0.18, -1, 0.006, 0.045),
    ("thigh", 0.0, 0.16, 1, 0.004, 0.045), ("spine", 0.12, 0.38, 1, 0.003, 0.045),
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

# THE CUT, as `skier.py`'s: every colour edge a plane the suit is cut along.
# A guide's hardshell is cut to the hip with a short drop behind, so the hem
# plane leans a little: lower behind than in front, never past the seat.
# The mustard covers the yoke over the shoulders where a pack's straps
# ride (`YOKE`) and the whole of each upper sleeve, the rest black; the
# pants carry darker scuff guards round the inside of each ankle, where the
# other boot's buckles catch.
HEM_UP = (UP - CHEST * 0.18).normalized()
HEM = (hips - UP * 0.065, HEM_UP)
HEM_BAND = (hips - UP * 0.11 + HEM_UP * 0.035, HEM_UP)
YOKE = (neck - UP * 0.12, (UP + CHEST * 0.12).normalized())
ZIP = [(neck + SX * 0.006, SX), (neck - SX * 0.006, -SX)]
CUFFS = [(frame(f"forearm_{s}")[0] + frame(f"forearm_{s}")[2] * frame(f"forearm_{s}")[4] * 0.35,
          frame(f"forearm_{s}")[2]) for s in "lr"]
LAPS = [(frame(f"thigh_{s}")[0] + frame(f"thigh_{s}")[2] * frame(f"thigh_{s}")[4] * 0.22,
         frame(f"thigh_{s}")[2]) for s in "lr"]
SCUFF = [(frame(f"shin_{s}")[0] + frame(f"shin_{s}")[2] * frame(f"shin_{s}")[4] * 0.42, frame(f"shin_{s}")[2]) for s in "lr"]
INSIDE = []
for i, s in enumerate("lr"):
    sh = frame(f"shin_{s}")
    inward = -sh[1] if sh[1].dot(feet[i] - hips) > 0 else sh[1]
    INSIDE.append((sh[0] + inward * 0.0, inward))
KNEE_GUARD = [((frame(f"shin_{s}")[0] + frame(f"shin_{s}")[3] * 0.02), frame(f"shin_{s}")[3]) for s in "lr"]
ARMS = [(frame(f"upperarm_{s}")[0] + frame(f"upperarm_{s}")[2] * frame(f"upperarm_{s}")[4] * 0.3,
         frame(f"upperarm_{s}")[2]) for s in "lr"]
# THE ARMSCYE: the sleeve's seam, a plane up through each shoulder joint,
# so the mustard sleeve stops at a straight seam instead of wherever the
# nearest bone changes under the armpit.
ARMSCYE = []
for s in "lr":
    head = frame(f"upperarm_{s}")[0]
    out = SX if (head - neck).dot(SX) > 0 else -SX
    ARMSCYE.append((head - out * 0.025, out))
# THE ELBOW: the mustard sleeve's other seam, square across the arm just
# above the joint, so it never follows the bones' change round the elbow.
ELBOW = []
for s in "lr":
    f = frame(f"upperarm_{s}")
    ELBOW.append((f[0] + f[2] * f[4] * 0.9, f[2]))
KNEE_HI = [(frame(f"thigh_{s}")[0] + frame(f"thigh_{s}")[2] * frame(f"thigh_{s}")[4] * 0.86, frame(f"thigh_{s}")[2]) for s in "lr"]
KNEE_LO = [(frame(f"shin_{s}")[0] + frame(f"shin_{s}")[2] * frame(f"shin_{s}")[4] * 0.2, frame(f"shin_{s}")[2]) for s in "lr"]
bm = bmesh.new()
bm.from_mesh(suit.data)
for co, no in [HEM, HEM_BAND, YOKE] + CUFFS + LAPS + ZIP + SCUFF + INSIDE + KNEE_GUARD + KNEE_HI + KNEE_LO + ARMS + ARMSCYE + ELBOW:
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)
bm.to_mesh(suit.data)
bm.free()


def above(co, plane):
    return (co - plane[0]).dot(plane[1]) > 0


def cloth_of(co):
    b = nearest(co)
    if b.startswith(("thigh", "shin")):
        i = "lr".index(b[-1])
        if above(co, KNEE_HI[i]) and not above(co, KNEE_LO[i]) and above(co, KNEE_GUARD[i]):
            return "pants"
    if b.startswith(("shin", "boot")) or not above(co, HEM):
        if b.startswith("shin"):
            i = "lr".index(b[-1])
            if not above(co, SCUFF[i]) and above(co, INSIDE[i]):
                return "scuff"
        return "pants"
    if b.startswith("thigh") and above(co, LAPS["lr".index(b[-1])]):
        return "pants"
    if b in ("head", "spine"):
        zipped = not above(co, ZIP[0]) and not above(co, ZIP[1]) and (co - neck).dot(CHEST) > 0
        if zipped and above(co, HEM_BAND):
            return "zip"
        return "panel" if above(co, YOKE) else "shell"
    if b.startswith(("upperarm", "forearm")):
        i = "lr".index(b[-1])
        sleeve = above(co, YOKE) or above(co, ARMSCYE[i])
        return "panel" if sleeve and not above(co, ELBOW[i]) else "shell"
    return "shell"


suit.data.polygons.foreach_set("material_index", [SUIT_MAT[cloth_of(p.center)] for p in suit.data.polygons])
for p in suit.data.polygons:
    p.use_smooth = True
weights(suit, suit_weights)
# THE HEM FLUTTERS: the bottom few centimetres of the jacket, most behind
# where the drop hangs free under the pack.
def hem_flutter(co):
    h = (co - HEM[0]).dot(HEM[1])
    behind = max(0.0, -(co - hips).dot(CHEST)) / 0.15
    if h < -0.002 or nearest(co).startswith(("thigh", "shin")) and h < 0:
        return 0.0
    k = max(0.0, 1.0 - h / 0.09)
    return min(1.0, k * k * (0.35 + 0.65 * min(1.0, behind)))
FLUTTER[suit.name] = hem_flutter

def trunk_r(lv):
    """The jacket's half breadth, front and back off the spine's line at a level."""
    pts = TRUNK
    for (a, ha, fa, ba), (b2, hb, fb, bb) in zip(pts, pts[1:]):
        if a <= lv <= b2:
            u = (lv - a) / (b2 - a)
            return ha + (hb - ha) * u, fa + (fb - fa) * u, ba + (bb - ba) * u
    return pts[-1][1:]


TURN = Matrix((SX, CHEST, UP)).transposed().to_euler()


def trunk_box(name, c, size, m, bevel=0.0):
    """A box laid on his trunk: `size` across, deep and tall in its frame."""
    return box(name, c, size, m, rot=TURN, bevel=bevel)


# ---------------------------------------------------------------- the PACK
# A guide's ski pack of 40 litres: white ripstop over a grey base, a tall
# narrow body 52 cm high, 28 wide and 17 deep, its top a lid with a dark
# zip; the shovel's orange shaft and black grip standing out of the
# avalanche pocket beside the lid; padded shoulder straps over the
# shoulders and down the chest with a sternum strap, the left one carrying
# the airbag's red trigger handle; the straps' tails hanging free (they
# flutter). It rides its own spring bone (`fx_pack`, hung at the top of the
# back), so it settles a little behind him as he moves; the flagging tape
# tied to its tool loop hangs off it on a bone of its own (`fx_flag`).
PACK_LO, PACK_HI = 0.2, 1.02
pack_back = cd * 0.5 + E["chest_back"] + 0.004   # the pack's face against his back, behind the spine's line
pack_top = T(PACK_HI, 0.0, -(pack_back + 0.07))
bone("fx_pack", pack_top, pack_top + UP * 0.1, parent="chest", roll_to=-CHEST)
rides("fx_pack")
SECTIONS = [  # level, half across, depth
    (PACK_LO, 0.11, 0.1), (PACK_LO + 0.06, 0.135, 0.15), (0.45, 0.14, 0.17), (0.75, 0.14, 0.165),
    (0.93, 0.13, 0.15), (PACK_HI - 0.015, 0.12, 0.12), (PACK_HI, 0.1, 0.07)]
rings_ = []
for lv, hx2, dp in SECTIONS:
    c = T(lv, 0.0, -(pack_back + dp / 2))
    rings_.append(ring(c, SX, CHEST, hx2, dp / 2, n=3.2))
pack = loft("pack", rings_, [M["pack"], M["pack_grid"]],
            face_mat=lambda c: 1 if (c - hips).dot(UP) < (PACK_LO + 0.1) * SPINE_L else 0)
# The lid: a domed cap over the top, a little proud of the body, its zip
# a dark seam across the back.
lid = []
for lv, hx2, dp in ((0.9, 0.138, 0.16), (0.97, 0.142, 0.17), (1.02, 0.128, 0.15), (1.05, 0.09, 0.1)):
    lid.append(ring(T(lv, 0.0, -(pack_back + 0.085)), SX, CHEST, hx2, dp / 2, n=3.0))
loft("pack_lid", lid, [M["pack"]])
lid_zip = [T(0.955, k * 0.022, -(pack_back + 0.173 - 0.004 * abs(k) ** 1.6 * 0.3)) for k in range(-5, 6)]
tube("lid_zip", lid_zip, 0.0035, M["pack_dark"])
# The avalanche pocket's zip down the pack's face, and the grid's seams.
tube("pocket_zip", [T(lv, 0.075, -(pack_back + 0.168)) for lv in (0.34, 0.5, 0.66, 0.84)], 0.0032, M["pack_dark"])
# Compression straps across the body, two a side (dark webbing).
for lv in (0.42, 0.66):
    for sd in (-1, 1):
        a = T(lv, sd * 0.142, -(pack_back + 0.04))
        b2 = T(lv + 0.02, sd * 0.142, -(pack_back + 0.14))
        box("compress", a.lerp(b2, 0.5), (0.008, 0.11, 0.022), M["pack_dark"], bevel=0)
# THE SHOVEL'S SHAFT out of the avalanche pocket: an orange alloy tube up
# past the lid on his right, its black T-grip on top; the PROBE's grey
# tip beside it.
sh_up = (UP + SX * 0.08 - CHEST * 0.05).normalized()
sh_foot = T(0.78, 0.085, -(pack_back + 0.11))
sh_top = sh_foot + sh_up * 0.36
cyl("shovel_shaft", sh_foot, sh_top, 0.0135, M["tool"], seg=12)
grip_x = sh_up.cross(CHEST).normalized()
cyl("shovel_grip", sh_top - grip_x * 0.055, sh_top + grip_x * 0.055, 0.014, M["grip"], seg=10)
cyl("probe_tip", T(0.9, 0.035, -(pack_back + 0.13)), T(0.9, 0.035, -(pack_back + 0.13)) + sh_up * 0.17,
    0.0065, M["metal"], seg=8, r2=0.004)
# The tool loop at the pack's foot on his left, and the FLAGGING TAPE tied
# to it: a ribbon of fluorescent tape 2.5 cm wide and 35 cm long, its two
# tails hanging down the pack's side, on its own bone (`fx_flag`).
loop_at = T(PACK_LO + 0.07, -0.118, -(pack_back + 0.155))
box("tool_loop", loop_at, (0.04, 0.025, 0.016), M["pack_dark"], bevel=0)
flag_root = loop_at - UP * 0.012 - CHEST * 0.012
bone("fx_flag", flag_root, flag_root - UP * 0.32, parent="fx_pack", roll_to=-CHEST)
rides("fx_flag")
FLAG_N = 8 if GAME else 14
for k_, (lean, ln) in enumerate(((-0.06, 0.34), (0.08, 0.28))):
    pts = [flag_root - UP * (ln * k / (FLAG_N - 1)) + SX * (lean * ln * k / (FLAG_N - 1) + 0.006 * math.sin(2.1 * k + k_))
           - CHEST * (0.006 * k / FLAG_N) for k in range(FLAG_N)]
    ribbon("flag", pts, 0.025, 0.0015, M["flag"], lambda p: -CHEST)
FLUTTER["flag"] = lambda co: min(1.0, max(0.0, (flag_root - co).dot(UP) / 0.12))
rides("fx_pack")

# THE SHOULDER STRAPS, riding him as the cloth does: from the pack's top
# over each shoulder and down his chest to the lower ribs, a sternum strap
# across them, and each strap's tail hanging below its buckle.
rides("chest")
straps = []
for sd in (-1, 1):
    pth = [T(0.9, sd * 0.07, -(pack_back + 0.01)), T(1.0, sd * 0.1, -(cd * 0.38)), T(1.02, sd * 0.11, 0.02),
           T(0.93, sd * 0.105, cd * 0.42 + 0.01), T(0.75, sd * 0.1, cd * 0.53 + E["chest_front"] + 0.006),
           T(0.55, sd * 0.11, cd * 0.53 + E["chest_front"] + 0.004)]
    path = catmull(pth, n=4 if GAME else 8)
    straps.append(ribbon("strap", path, 0.055, 0.012, M["pack_dark"], off_trunk))
    lo = T(0.55, sd * 0.11, cd * 0.53 + E["chest_front"] + 0.01)
    tl = [lo - UP * (0.03 * k) + CHEST * 0.003 * k for k in range(6)]
    straps.append(ribbon("strap_tail", tl, 0.022, 0.003, M["pack_dark"], off_trunk))
    # The strap's other end, into the pack's foot at the side.
    straps.append(ribbon("strap_low", [T(0.6, sd * 0.13, cd * 0.3), T(0.45, sd * 0.155, 0.0), T(PACK_LO + 0.05, sd * 0.14, -(pack_back + 0.01))],
                         0.022, 0.004, M["pack_dark"], off_trunk))
straps.append(box("sternum", T(0.84, 0.0, cd * 0.52 + E["chest_front"] + 0.012), (0.2, 0.004, 0.018), M["pack_dark"], bevel=0))
straps.append(box("sternum_buckle", T(0.84, 0.0, cd * 0.52 + E["chest_front"] + 0.016), (0.035, 0.008, 0.024), M["grip"], bevel=0))
for o in straps:
    weights(o, lambda co: suit_weights(co, [n for n in SEGMENTS if n in ("spine", "head")]))
FLUTTER["strap_tail"] = lambda co: 0.0  # set per object below (names are unique once made)
for o in straps:
    if o.name.startswith("strap_tail"):
        top = max(v.co.dot(UP) for v in o.data.vertices)
        FLUTTER[o.name] = (lambda t: (lambda co: min(1.0, max(0.0, (t - co.dot(UP)) / 0.15))))(top)

# THE AIRBAG'S TRIGGER on the left strap at his chest: a red handle on its
# grey housing, where a gloved hand finds it without looking.
rides("chest")
trig_front = cd * 0.53 + E["chest_front"] + 0.018
trig = [trunk_box("trigger_mount", T(0.8, -0.105, trig_front), (0.05, 0.018, 0.07), M["pack_grid"]),
        trunk_box("trigger", T(0.8, -0.105, trig_front + 0.016), (0.034, 0.026, 0.052), M["trigger"], bevel=0.004)]
for o in trig:
    weights(o, lambda co: suit_weights(co, [n for n in SEGMENTS if n in ("spine", "head")]))

# ---------------------------------------------------------------- the RADIO
# THE GUIDE'S RADIO in its CHEST HARNESS: a black pouch 9 cm wide and 14
# tall riding low on his sternum under the pack's sternum strap, held by
# narrow webbing over both shoulders and an elastic round his ribs; the
# radio standing in it with its knobs above the pouch's lip, and its WHIP
# ANTENNA up out of it — 15 cm of black flex on a spring bone of its own
# (`fx_ant`), so it nods into a turn and flicks on a landing. A coiled
# cable runs up to the SPEAKER-MIC clipped to the right strap at his collar.
RADIO_LV = 0.63
_, r_front, _ = trunk_r(RADIO_LV)
pouch_c = T(RADIO_LV, 0.0, r_front + 0.026)
radio_parts = [trunk_box("radio_pouch", pouch_c, (0.09, 0.046, 0.13), M["radio_pouch"], bevel=0.006)]
# The pouch's flap closures and its lid's piping.
radio_parts.append(trunk_box("pouch_lip", pouch_c + UP * 0.063 + CHEST * 0.006, (0.094, 0.05, 0.008), M["webbing"]))
for sd in (-1, 1):
    hp_ = [T(RADIO_LV + 0.1, sd * 0.042, r_front + 0.01), T(0.86, sd * 0.07, cd * 0.48 + E["chest_front"] + 0.004),
           T(0.98, sd * 0.085, cd * 0.2), T(0.99, sd * 0.09, -(cd * 0.25)), T(0.86, sd * 0.06, -(cd * 0.5 + E["chest_back"] - 0.002))]
    radio_parts.append(ribbon("radio_strap", catmull(hp_, n=3 if GAME else 6), 0.02, 0.003, M["webbing"], off_trunk))
    # The elastic round his ribs from the pouch's side.
    hx_r, hf_r, hb_r = trunk_r(RADIO_LV - 0.05)
    side = [T(RADIO_LV - 0.05, sd * 0.045, hf_r + 0.01)]
    for k in range(1, 6):
        a_ = math.radians(90 - 30 * k)
        side.append(T(RADIO_LV - 0.05, sd * math.cos(a_) * (hx_r + 0.004), math.sin(a_) * ((hf_r if a_ > 0 else hb_r) + 0.004)))
    radio_parts.append(ribbon("radio_elastic", catmull(side, n=2 if GAME else 4), 0.016, 0.003, M["webbing"], off_trunk))
for o in radio_parts:
    weights(o, lambda co: suit_weights(co, [n for n in SEGMENTS if n in ("spine", "head")]))
rides("chest")
radio_top = pouch_c + UP * 0.068 + SX * 0.012
trunk_box("radio", radio_top - UP * 0.01, (0.056, 0.032, 0.05), M["radio"], bevel=0.004)
cyl("radio_knob", radio_top + UP * 0.014 + SX * 0.014, radio_top + UP * 0.026 + SX * 0.014, 0.008, M["grip"], seg=10)
ant_base = radio_top + UP * 0.015 - SX * 0.016
ant_up = (UP + CHEST * 0.12).normalized()
cyl("antenna_root", ant_base, ant_base + ant_up * 0.03, 0.0065, M["antenna"], seg=8)
bone("fx_ant", ant_base + ant_up * 0.02, ant_base + ant_up * 0.17, parent="chest", roll_to=CHEST)
rides("fx_ant")
cyl("antenna", ant_base + ant_up * 0.025, ant_base + ant_up * 0.17, 0.0042, M["antenna"], seg=8, r2=0.003)
ellipsoid("antenna_tip", ant_base + ant_up * 0.172, (0.005, 0.005, 0.006), M["antenna"])
rides("chest")
mic_at = T(0.93, 0.105, cd * 0.42 + 0.03)
trunk_box("speaker_mic", mic_at, (0.04, 0.022, 0.06), M["radio"], bevel=0.004)
coil("mic_cable", radio_top + SX * 0.026 + UP * 0.01, mic_at - UP * 0.032, 0.007, 0.0016, 9, M["antenna"])


# ---------------------------------------------------------------- the HEAD
# His head, face and hair are the game's own triangles (`bareHeadParts`),
# under a light pale grey CLIMBING HELMET — a low, rounded shell standing
# two centimetres off the head, open at the brow and over the ears, its rim
# dropping behind, vented in dark slots, an orange flash on either side —
# and GOGGLES over the eyes: a wide frame, a blue mirrored lens, the strap
# round the helmet's shell.
rides("head")
hc, hx, hy, hz, _ = frame("head")
HPAINT = {"skin": M["skin"], "knit": M["knit"], "trim": M["trim"], "strap": M["helmet_dark"],
          "lens": M["goggle_lens"], "shell": M["helmet"]}


def hp(p):
    return hc + hx * p[0] + hy * p[1] + hz * p[2]


for part in HEAD["game" if GAME else "fine"]:
    Pp, N, I = part["position"], part["normal"], part["index"]
    verts = [hp(Pp[k:k + 3]) for k in range(0, len(Pp), 3)]
    faces = [I[k:k + 3] for k in range(0, len(I), 3)]
    ob = mesh_obj(f"head_{part['material']}", verts, faces, [HPAINT.get(part["material"], M["knit"])], recalc=False)
    normals = [tuple(hx * N[k] + hy * N[k + 1] + hz * N[k + 2]) for k in range(0, len(N), 3)]
    ob.data.normals_split_custom_set_from_vertices(normals)
# The helmet's shell: an ellipsoid's cap over the egg (`helmet-shape.ts`'s
# HEAD: 0.077 × 0.104 × 0.097 about (0, −0.014, −0.006)), 2 cm off it, its
# rim at the brow in front, over the ears, dropped behind.
HC_ = (0.0, -0.012, -0.006)
HR = (0.099, 0.124, 0.12)
AROUND, DOWN = (20, 6) if GAME else (48, 14)


def rim_y(phi):
    """The rim's height round the head (phi 0 ahead)."""
    c = math.cos(phi)
    return 0.026 * c + 0.012 - 0.014 * (1 - abs(c)) * 0.0


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
shell = loft("helmet_shell", shell_rings, [M["helmet"], M["helmet_dark"]],
             face_mat=lambda c: 0)
# The loft winds its faces inward; turned out so the game's one-sided
# hard goods draw the outside of the shell, not the inside through it.
bm = bmesh.new()
bm.from_mesh(shell.data)
bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
bm.to_mesh(shell.data)
bm.free()
sol = shell.modifiers.new("thick", "SOLIDIFY")
sol.thickness, sol.offset = 0.01, -1
# The vents: dark slots along either side of the crown and across the back.
for sd in (-1, 1):
    for phi, u in ((0.55, 0.45), (1.05, 0.5), (1.6, 0.5), (2.3, 0.45)):
        c = shell_pt(sd * phi, u, 0.004)
        out = (c - hp(HC_)).normalized()
        ellipsoid("vent", c, (0.016, 0.0065, 0.004), M["helmet_dark"],
                  rot=out.to_track_quat("Z", "Y").to_euler())
# The rim's dark edge, and an orange flash on either side of the crown.
rim = [shell_pt(2 * math.pi * i / AROUND, 1.0, 0.002) for i in range(AROUND)]
tube("helmet_rim", rim, 0.0045, M["helmet_dark"], closed=True)
for sd in (-1, 1):
    flash = [shell_pt(sd * math.radians(a), 0.38, 0.006) for a in (70, 82, 94)]
    tube("helmet_accent", flash, 0.0055, M["helmet_accent"])
# The chin strap, ear to ear under the jaw.
cs = []
for k in range(11):
    t = (k / 10 * 2 - 1) * (math.pi / 2)
    cs.append(hp((0.072 * math.sin(t), -0.056 - 0.058 * math.cos(t), 0.004 + 0.05 * math.cos(t))))
tube("chin_strap", [hp((-0.083, 0.008, -0.01))] + cs + [hp((0.083, 0.008, -0.01))], 0.0035, M["helmet_dark"])
# THE GOGGLES: a wide frame across the brow standing proud of the face (the
# face's eyes at y ≈ 0, 9 cm ahead), a blue mirrored lens in it, its foam
# against the face, and the strap round the helmet's shell behind.
GY0, GY1 = -0.03, 0.026
lens_rings, frame_rings = [], []
for phi_d in range(-80, 81, 10 if GAME else 4):
    phi = math.radians(phi_d)
    rr = 0.094 + 0.012 * math.cos(phi)
    dip = 0.008 * (1 - abs(phi_d) / 80) ** 2
    lens_rings.append([hp((math.sin(phi) * (0.09 + 0.006 * math.cos(phi)), yy, math.cos(phi) * rr - 0.004))
                       for yy in (GY0 + 0.006 + dip, (GY0 + GY1) / 2, GY1 - 0.006)])
    frame_rings.append([hp((math.sin(phi) * (0.087 + 0.006 * math.cos(phi) + d * 0.01), yy, math.cos(phi) * (rr - d * 0.014) - 0.004))
                        for d, yy in ((0, GY0 + dip), (1, GY0 + dip), (1, GY1), (0, GY1))])
gl = loft("goggle_lens", lens_rings, [M["goggle_lens"]], closed=False, cap=False)
gs = gl.modifiers.new("thick", "SOLIDIFY")
gs.thickness = 0.003
gf = loft("goggle_frame", [[r[0], r[1], r[2], r[3]] for r in frame_rings], [M["goggle"]], closed=True, cap=True)
strap = [shell_pt(math.radians(a), 0.8, 0.006) for a in range(100, 261, 16)]
ribbon("goggle_strap", [hp((-0.095, (GY0 + GY1) / 2 + 0.004, -0.02))] + strap + [hp((0.095, (GY0 + GY1) / 2 + 0.004, -0.02))],
       0.03, 0.003, M["goggle"], lambda p: (p - hp(HC_)).normalized())

# ---------------------------------------------------------------- GAITERS, FEET, GLOVES
# The pants' cuff straight down over the boot's cuff (the boot itself is
# the ski's, `skis.py`); the foot in its liner inside the shell; and the
# guide's LEATHER WORK GLOVES closed round the grips — tan cowhide with a
# darker palm and a black knit cuff under the sleeve, the glove a guide
# wears for shovelling, digging a pit and setting a rope as much as skiing.
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
    rides(f"forearm_{s}")
    e, fx, fy, fz, fl = frame(f"forearm_{s}")
    wrist_t = ANSUR["forearm_length"] * MM / fl
    cyl("glove_cuff", e + fy * (fl * (wrist_t - 0.06)), e + fy * (fl * (wrist_t + 0.02)), 0.041, M["cuff_knit"], r2=0.039)
    rides(f"hand_{s}")
    c, hx_h, hy_h, hz_h, _ = frame(f"hand_{s}")
    out = hx_h if hx_h.dot(shoulders[i] - neck) > 0 else -hx_h
    turn = Matrix((out, hy_h, hz_h)).transposed().to_euler()
    ellipsoid("glove_back", c - hy_h * 0.033 + out * 0.012, (0.026, 0.046, 0.044), M["glove"], rot=turn)
    ellipsoid("glove_palm", c - hy_h * 0.03 - out * 0.008, (0.02, 0.04, 0.04), M["palm"], rot=turn)
    for k in range(4):
        along_g = hz_h * (0.027 - 0.018 * k)
        arc = [c + along_g + (hy_h * math.cos(t) + out * math.sin(t)) * 0.022
               for t in (math.radians(a) for a in range(-110, 181, 58 if GAME else 20))]
        tube("finger", arc, 0.0088 - 0.0007 * k, M["glove"], smooth_n=0 if GAME else 2)
    tube("thumb", [c - hy_h * 0.03 - out * 0.018 + hz_h * 0.03, c - out * 0.02 + hz_h * 0.045,
                   c + hy_h * 0.02 - out * 0.012 + hz_h * 0.047], 0.0102, M["glove"], smooth_n=0 if GAME else 2)


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

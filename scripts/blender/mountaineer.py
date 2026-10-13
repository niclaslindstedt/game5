# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE SKI MOUNTAINEER MODELLED IN BLENDER: a high-alpine guide on a hut-to-hut
# glacier traverse, after photographs of guides leading rope teams — a short
# signal-red hardshell with black reinforced shoulders, forearms and hem,
# black bib pants with grey crampon guards and the gaiters built in, an
# alpine harness racked with locking carabiners, an ice screw and a rescue
# pulley, the RAPPEL ROPE carried the guide's way: shortened into loops worn
# over his left shoulder and across to his right hip, tied off with its tail
# hanging (a "kiwi coil"); a black 35-litre pack with yellow trim, crampons
# strapped to its face, an ice axe and a shovel's shaft beside the lid; a
# radio in a pouch on the right shoulder strap with its stub antenna; an
# anthracite climbing helmet with his goggles stowed round its back, glacier
# glasses on his face, and the tan leather work gloves guides wear for rope
# work — built off the game's own data (`kinds/mountaineer.mjs`): his body
# (`BODY`), the pose the dressed skier is bound in and every bone's frame in
# it (`dress-loft.ts`'s `bindPose`), and his head, face and hair as the
# game's own triangles (`helmet-shape.ts`'s `bareHeadParts`).
#
# The frame is the skier's (`skier.py`): the body frame (x right, y up, z
# forward, the origin at the centre of gravity) laid as Blender's
# (-x, z, y); his sides are the ENGINE's (`_l` the body's x negative).
#
# The game poses him as it poses the dressed skier — bone for bone off
# `skierBones` — so every move the game has is his with no clip of his own
# (`player-model.ts`). What the game ADDS is what hangs off him: three
# SPRING BONES the game swings off the chest's own motion (`fx_pack`, the
# pack and everything on it; `fx_coil`, the lowest loops of the rope's coil
# at his hip; `fx_tail`, the rope's tied-off tail hanging from it) and the
# FLUTTER every loose piece of cloth carries (the jacket's hem, the straps'
# tails, the rope's tail), which the game's vertex shader shakes in the air
# past him. Every vertex's colour is its material's, darkened by its own
# occlusion (cast here, ray by ray), so the game draws him in one
# vertex-coloured skin as it draws the dressed one.

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
# A glacier guide's kit after the photographs: the shell a deep signal red
# (a rope team reads its guide on a white glacier), the shoulders, the
# forearms and the hem band reinforced in black where a pack and a rope
# wear; black bib pants with grey crampon guards; grey harness webbing; a
# black pack trimmed in yellow; an orange rappel rope with a white fleck;
# an anthracite helmet; tan leather gloves. Each material's colour is baked
# into the vertex colours (`paint`), and the game reads those; the names say
# which draw a part joins (`player-model.ts`: the HARD goods a shine of
# their own).
KIT = {
    "shell": (0xB3202B, 0.6, 0.0), "panel": (0x17191C, 0.7, 0.0), "pants": (0x202328, 0.85, 0.0),
    "scuff": (0x5A6068, 0.8, 0.0), "zip": (0x0E0F11, 0.5, 0.0), "glove": (0xA8763F, 0.75, 0.0),
    "palm": (0x6E4A2A, 0.8, 0.0), "liner": (0x2B2E34, 0.85, 0.0), "webbing": (0x5B6168, 0.6, 0.0),
    "pack": (0x1E2124, 0.7, 0.0), "pack_dark": (0x0F1113, 0.75, 0.0), "pack_trim": (0xE3BC17, 0.6, 0.0),
    "rope": (0xE5701C, 0.6, 0.0), "rope_fleck": (0xF2F0E6, 0.6, 0.0), "skin": (0xC68863, 0.6, 0.0),
    "knit": (0x4A3526, 0.9, 0.0), "trim": (0x15110E, 0.6, 0.0), "radio": (0x141517, 0.6, 0.0),
    # The hard goods.
    "helmet": (0x3A3E43, 0.35, 0.0), "helmet_dark": (0x15171A, 0.4, 0.0), "lamp": (0x1E1F22, 0.35, 0.0),
    "lamp_lens": (0xF08A24, 0.1, 0.3), "glasses": (0x121212, 0.3, 0.0), "glass_lens": (0x1E2C40, 0.08, 0.6),
    "shield": (0x2A2420, 0.6, 0.0), "metal": (0xB8BDC3, 0.3, 0.85), "steel": (0x7E848A, 0.35, 0.9),
    "axe_shaft": (0xC9CDD2, 0.3, 0.7), "grip": (0x141618, 0.8, 0.0),
    "biner_gold": (0xC9A43C, 0.3, 0.85), "biner_red": (0xC2402F, 0.3, 0.7), "biner_blue": (0x2D7BD1, 0.3, 0.7),
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
# Which way along `SX` his LEFT side is (the engine's `_l`).
LEFT = 1.0 if (shoulders[0] - hips).dot(frame("spine")[1]) > 0 else -1.0
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
# A guide's hardshell is cut SHORT, to the top of the hip, so the harness
# and its rack sit clear under it — the hem a little lower behind than in
# front, never a tail. The black reinforcement covers the shoulders and
# the yoke where a pack's straps and the rope's coil wear (`YOKE`), the
# forearms past the elbow (`CUFFS`) and a band at the hem; the bib pants
# carry grey crampon guards round the inside of each ankle and a guard
# over each knee.
HEM_UP = (UP - CHEST * 0.12).normalized()
HEM = (hips - UP * 0.075, HEM_UP)
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
KNEE_HI = [(frame(f"thigh_{s}")[0] + frame(f"thigh_{s}")[2] * frame(f"thigh_{s}")[4] * 0.86, frame(f"thigh_{s}")[2]) for s in "lr"]
KNEE_LO = [(frame(f"shin_{s}")[0] + frame(f"shin_{s}")[2] * frame(f"shin_{s}")[4] * 0.2, frame(f"shin_{s}")[2]) for s in "lr"]
bm = bmesh.new()
bm.from_mesh(suit.data)
for co, no in [HEM, HEM_BAND, YOKE] + CUFFS + LAPS + ZIP + SCUFF + INSIDE + KNEE_GUARD + KNEE_HI + KNEE_LO + ARMS:
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
            return "scuff"
    if b.startswith(("shin", "boot")) or not above(co, HEM):
        if b.startswith("shin"):
            i = "lr".index(b[-1])
            if not above(co, SCUFF[i]) and above(co, INSIDE[i]):
                return "scuff"
        return "pants"
    if b.startswith("thigh") and above(co, LAPS["lr".index(b[-1])]):
        return "pants"
    if not above(co, HEM_BAND):
        return "panel"
    if b in ("head", "spine"):
        zipped = not above(co, ZIP[0]) and not above(co, ZIP[1]) and (co - neck).dot(CHEST) > 0
        if zipped and above(co, HEM_BAND):
            return "zip"
        return "panel" if above(co, YOKE) else "shell"
    if b.startswith("upperarm"):
        return "panel" if above(co, YOKE) or not above(co, ARMS["lr".index(b[-1])]) else "shell"
    if b.startswith("forearm"):
        return "panel" if above(co, CUFFS["lr".index(b[-1])]) else "shell"
    return "shell"


suit.data.polygons.foreach_set("material_index", [SUIT_MAT[cloth_of(p.center)] for p in suit.data.polygons])
for p in suit.data.polygons:
    p.use_smooth = True
weights(suit, suit_weights)
# THE HEM FLUTTERS: the bottom few centimetres of the jacket, most behind
# where it hangs free of the harness.
def hem_flutter(co):
    h = (co - HEM[0]).dot(HEM[1])
    behind = max(0.0, -(co - hips).dot(CHEST)) / 0.15
    if h < -0.002 or nearest(co).startswith(("thigh", "shin")) and h < 0:
        return 0.0
    k = max(0.0, 1.0 - h / 0.09)
    return min(1.0, k * k * (0.35 + 0.65 * min(1.0, behind)))
FLUTTER[suit.name] = hem_flutter

# ---------------------------------------------------------------- the HARNESS
# A light alpine harness: a waist belt over the jacket at the iliac crest
# (a padded band 6 cm tall with its buckle in front), leg loops round the
# top of each thigh, the belay loop joining them in front, and gear loops
# either side carrying carabiners and an ice screw. It bends with him as
# the cloth does.
WAIST = level(ANSUR["waist_h"]) - 0.06


def trunk_r(lv):
    """The jacket's half breadth, front and back off the spine's line at a level."""
    pts = TRUNK
    for (a, ha, fa, ba), (b2, hb, fb, bb) in zip(pts, pts[1:]):
        if a <= lv <= b2:
            u = (lv - a) / (b2 - a)
            return ha + (hb - ha) * u, fa + (fb - fa) * u, ba + (bb - ba) * u
    return pts[-1][1:]


harness = []
hx_, hf, hb_ = trunk_r(WAIST)
belt = []
for dv in (-0.03, 0.0, 0.03):
    lv = WAIST + dv / SPINE_L
    c = T(lv)
    belt.append([c + SX * (math.copysign(abs(math.cos(a)) ** (2 / 2.7), math.cos(a)) * (hx_ + 0.012))
                 + CHEST * (math.copysign(abs(math.sin(a)) ** (2 / 2.7), math.sin(a)) * ((hf if math.sin(a) > 0 else hb_) + 0.012))
                 for a in (2 * math.pi * k / 24 for k in range(24))])
harness.append(loft("harness_belt", belt, [M["webbing"]]))
buckle_at = T(WAIST, 0.0, hf + 0.024)
harness.append(box("harness_buckle", buckle_at, (0.05, 0.012, 0.04), M["metal"], bevel=0.003 if not GAME else 0))
th = r_of(ANSUR["thigh"])
for i, s in enumerate("lr"):
    head, x, y, z, length = frame(f"thigh_{s}")
    loops = []
    for t in (0.1, 0.16):
        c = head + y * (t * length)
        r = th + E["pants"] + 0.012
        loops.append([c + x * (r * math.cos(a)) + z * (r * math.sin(a)) for a in (2 * math.pi * k / 20 for k in range(20))])
    harness.append(loft("harness_leg", loops, [M["webbing"]]))
# The belay loop: from the belt's buckle down to between the leg loops.
crotch = (frame("thigh_l")[0] + frame("thigh_r")[0]) / 2 + CHEST * 0.1 - UP * 0.03
harness.append(tube("belay_loop", [buckle_at - UP * 0.01, crotch.lerp(buckle_at, 0.5) + CHEST * 0.025, crotch], 0.009, M["webbing"]))
for o in harness:
    weights(o, suit_weights)
# The gear loops and what hangs on them, riding the pelvis: carabiners (a
# D of a rod a few mm thick, 10 cm long) and one ice screw.
rides("pelvis")


def biner(name, top, down, across, m, size=0.1):
    """A carabiner hanging from `top`: a D in the plane of `down` and `across`."""
    pts = []
    for k in range(10 if GAME else 18):
        a = 2 * math.pi * k / (10 if GAME else 18)
        u, v = math.cos(a), math.sin(a)
        w = 0.026 * (1.0 if u > 0 else 0.7)
        pts.append(top + down * (size * 0.5 * (1 - v)) + across * (w * u))
    return tube(name, pts, 0.0035, m, closed=True)


rack = []
for side, kit in ((-1, ("biner_gold", "biner_red", "biner_blue")), (1, ("biner_blue", "biner_gold", "metal"))):
    for j, k in enumerate(kit):
        ang = math.radians(35 + 22 * j) * side
        out = (SX * math.sin(ang) + CHEST * math.cos(ang)).normalized()
        at = T(WAIST - 0.04 / SPINE_L) + out * (hx_ + 0.024) + SX * 0.0
        tang = UP.cross(out).normalized()
        rack.append(biner("biner", at, -UP, tang, M[k], size=0.085 + 0.012 * (j % 2)))
# The ice screw on the right side: a tube with its hanger and crank.
scr_top = T(WAIST - 0.03 / SPINE_L) + (SX * 0.98 + CHEST * -0.2).normalized() * (hx_ + 0.03)
rack.append(cyl("screw", scr_top - UP * 0.02, scr_top - UP * 0.15, 0.0085, M["steel"], seg=12))
rack.append(box("screw_hanger", scr_top - UP * 0.015, (0.03, 0.012, 0.025), M["biner_red"], bevel=0))

# ---------------------------------------------------------------- the PACK
# A guide's alpine pack of 35 litres: a tall narrow body 50 cm high, 28
# wide and 17 deep, its top a lid with a yellow-trimmed zip; slim padded
# shoulder straps over the shoulders and down the chest with a sternum
# strap; the straps' tails hanging free (they flutter). It rides its own
# spring bone (`fx_pack`, hung at the top of the back), so it settles a
# little behind him as he moves, with everything strapped to it.
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
pack = loft("pack", rings_, [M["pack"], M["pack_dark"]],
            face_mat=lambda c: 1 if (c - hips).dot(UP) < (PACK_LO + 0.07) * SPINE_L else 0)
# The lid: a domed cap over the top, a little proud of the body.
lid = []
for lv, hx2, dp in ((0.9, 0.138, 0.16), (0.97, 0.142, 0.17), (1.02, 0.128, 0.15), (1.05, 0.09, 0.1)):
    lid.append(ring(T(lv, 0.0, -(pack_back + 0.085)), SX, CHEST, hx2, dp / 2, n=3.0))
loft("pack_lid", lid, [M["pack_dark"]])
# Compression straps across the body, two a side (dark webbing).
for lv in (0.42, 0.66):
    for sd in (-1, 1):
        a = T(lv, sd * 0.142, -(pack_back + 0.04))
        b2 = T(lv + 0.02, sd * 0.142, -(pack_back + 0.14))
        box("compress", a.lerp(b2, 0.5), (0.008, 0.11, 0.022), M["pack_dark"], bevel=0)
# THE ICE AXE on the pack's back: the head up beside the lid, the pick
# across, the shaft down the pack's face to the spike held in the tool
# loop at its foot — a straight 50 cm shaft of anodised alloy with a rubber
# grip and a steel head (a pick and an adze), its head turned so the pick
# points across his back.
axe_up = (UP + SX * 0.12).normalized()
axe_head = T(PACK_HI + 0.05, -0.07, -(pack_back + 0.175))
axe_foot = axe_head - axe_up * 0.52
cyl("axe_shaft", axe_foot + axe_up * 0.15, axe_head, 0.0125, M["axe_shaft"], seg=12)
cyl("axe_grip", axe_foot + axe_up * 0.02, axe_foot + axe_up * 0.15, 0.0135, M["grip"], seg=12)
cyl("axe_spike", axe_foot - axe_up * 0.03, axe_foot + axe_up * 0.02, 0.011, M["steel"], seg=10, r2=0.012)
across = axe_up.cross(-CHEST).normalized()
pick = [axe_head + across * 0.01, axe_head + across * 0.08 - axe_up * 0.012, axe_head + across * 0.15 - axe_up * 0.035]
ribbon("axe_pick", pick, 0.024, 0.006, M["steel"], lambda p: -CHEST, smooth=False)
adze = [axe_head - across * 0.01, axe_head - across * 0.06 + axe_up * 0.004, axe_head - across * 0.09 + axe_up * 0.002]
ribbon("axe_adze", adze, 0.038, 0.005, M["steel"], lambda p: axe_up.cross(across), smooth=False)
box("axe_cap", axe_head + axe_up * 0.008, (0.03, 0.03, 0.03), M["steel"], bevel=0)
# The tool loop and the lid's strap holding the shaft.
box("tool_loop", axe_foot + axe_up * 0.05, (0.04, 0.025, 0.014), M["pack_dark"], bevel=0)
box("axe_strap", axe_head - axe_up * 0.2, (0.05, 0.02, 0.012), M["pack_dark"], bevel=0)

# The lid's zip, a yellow line round its rim, and a yellow trim down each
# side seam of the body — the colour a guide finds his pack by in a hut.
lid_zip = [T(0.955, 0.0, -(pack_back + 0.085)) + SX * (0.143 * math.cos(a)) + CHEST * (0.087 * math.sin(a))
           for a in (2 * math.pi * k / 20 for k in range(20))]
tube("pack_zip", lid_zip, 0.004, M["pack_trim"], closed=True)
for sd in (-1, 1):
    seam = [T(lv, sd * (hx2 + 0.002), -(pack_back + dp * 0.5)) for lv, hx2, dp in SECTIONS[1:-2]]
    tube("pack_seam", seam, 0.004, M["pack_trim"])
# THE CRAMPONS strapped flat to the pack's face, points in, one over the
# other as a guide carries them: each a steel frame the length of a boot
# sole (32 cm by 10), its front points jutting from the top, the rows of
# points under it, held by a yellow strap round the pack.
cr_face = pack_back + 0.168
for j, lv0 in enumerate((0.36, 0.38)):
    lv1 = lv0 + 0.31 / SPINE_L
    off = -(cr_face + 0.006 + 0.012 * j)
    for sd in (-1, 1):
        rail = [T(lv0 + (lv1 - lv0) * u, sd * (0.045 - 0.008 * abs(u - 0.5) * 2), off) for u in (0.0, 0.25, 0.5, 0.75, 1.0)]
        tube("crampon_rail", rail, 0.0035, M["steel"])
    for u in (0.08, 0.5, 0.92):
        tube("crampon_bar", [T(lv0 + (lv1 - lv0) * u, -0.045, off), T(lv0 + (lv1 - lv0) * u, 0.045, off)], 0.003, M["steel"])
    for u in (0.12, 0.3, 0.62, 0.84):
        for sd in (-1, 1):
            base_ = T(lv0 + (lv1 - lv0) * u, sd * 0.045, off)
            cyl("crampon_point", base_, base_ - CHEST * 0.028, 0.004, M["steel"], seg=6, r2=0.0005)
    for sd in (-1, 1):
        tip = T(lv1, sd * 0.02, off)
        cyl("crampon_point", tip, tip + UP * 0.035 - CHEST * 0.01, 0.0045, M["steel"], seg=6, r2=0.0006)
for lv in (0.43, 0.6):
    strap_ring = [T(lv, 0.0, -(pack_back + 0.085)) + SX * (0.15 * math.cos(a)) + CHEST * (0.1 * math.sin(a))
                  for a in (2 * math.pi * k / 18 for k in range(18))]
    tube("crampon_strap", strap_ring, 0.006, M["pack_trim"], closed=True)
# THE SHOVEL'S SHAFT up out of the pack beside the lid on the right, its
# T-grip just over the top, where a guide reaches it without unpacking.
sh_foot = T(0.72, 0.085, -(pack_back + 0.12))
sh_top = T(PACK_HI + 0.12, 0.095, -(pack_back + 0.13))
cyl("shovel_shaft", sh_foot, sh_top, 0.0135, M["axe_shaft"], seg=12)
box("shovel_grip", sh_top + UP * 0.012, (0.09, 0.022, 0.024), M["grip"], bevel=0)

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

# THE RADIO, in its pouch high on the right shoulder strap where a guide
# talks into it without stopping: a black block 6 × 11 × 3 cm, its stub
# antenna up beside his collar.
radio_side = -LEFT * 0.105
radio_at = T(0.9, radio_side, cd * 0.48 + E["chest_front"] + 0.035)
radio = box("radio", radio_at, (0.062, 0.03, 0.11), M["radio"], rot=Matrix((SX, CHEST, UP)).transposed().to_euler(), bevel=0.004 if not GAME else 0)
ant = cyl("radio_antenna", radio_at + UP * 0.05 - SX * 0.018, radio_at + UP * 0.13 - SX * 0.02, 0.006, M["radio"], seg=8, r2=0.004)
for o in (radio, ant):
    weights(o, lambda co: {"chest": 1.0})

# THE ROPE CARRIED THE GUIDE'S WAY: the rope shortened into loops worn
# over his LEFT shoulder and across his body to his RIGHT hip (a "kiwi
# coil"), so his hands are free and the rope is out in a moment. Each loop
# lies on the jacket — cast out from the middle of his trunk until it
# leaves the trunk's own sections (`TRUNK`), over the shoulder's cap and
# the strap — the outer loops a little proud of the inner and sagging a
# little lower at the hip, where they hang loose of his side on their own
# spring bone (`fx_coil`); the coil is tied off there with a few turns and
# its TAIL hangs from the knot (`fx_tail`).
def inside(p):
    """Whether a point is inside his trunk, his left shoulder or his neck."""
    d = p - hips
    lv = d.dot(UP) / SPINE_L
    sd, ah = d.dot(SX), d.dot(CHEST)
    if lv <= 0.94:
        hx_t, f_t, b_t = trunk_r(max(0.0, lv))
        u = abs(sd) / hx_t
        v = abs(ah) / (f_t if ah > 0 else b_t)
        if u ** 2.7 + v ** 2.7 < 1.0:
            return True
    # The shoulder's cap and the strap over it: a capsule from the neck's
    # side out to the shoulder's point.
    a_, b_ = neck + SX * (LEFT * 0.05), shoulders[0] + UP * 0.01
    t = max(0.0, min(1.0, (p - a_).dot(b_ - a_) / (b_ - a_).length_squared))
    if (p - (a_ + (b_ - a_) * t)).length < 0.068:
        return True
    return (p - neck).length < 0.075


sash_top = shoulders[0].lerp(neck, 0.45) + UP * 0.07
sash_fr = T(0.4, -LEFT * 0.13, 0.12)
sash_bk = T(0.4, -LEFT * 0.13, -0.12)
sash_n = (sash_fr - sash_top).cross(sash_bk - sash_top).normalized()
sash_c = T(0.62, -LEFT * 0.02, 0.0)
sash_c = sash_c - sash_n * (sash_c - sash_top).dot(sash_n)
e1 = (sash_top - sash_c).normalized()
e2 = sash_n.cross(e1).normalized()


def sash_at(th, grow):
    d = e1 * math.cos(th) + e2 * math.sin(th)
    r = 0.04
    while r < 0.6 and inside(sash_c + d * r):
        r += 0.003
    return sash_c + d * (r + grow)


low = min((sash_at(2 * math.pi * k / 48, 0.02) for k in range(48)), key=lambda q: q.dot(UP))
bone("fx_coil", low, low - UP * 0.16, parent="chest", roll_to=CHEST)
N_LOOP = 7 if GAME else 9
K = 36 if GAME else 72


def rope_w(co):
    w = suit_weights(co, ["spine"])
    k = max(0.0, 1.0 - (co - low).length / 0.22)
    k = k * k * (3 - 2 * k) * 0.8
    out = {b: v * (1 - k) for b, v in w.items()}
    out["fx_coil"] = out.get("fx_coil", 0.0) + k
    return out


for j in range(N_LOOP):
    off = (j - (N_LOOP - 1) / 2) * 0.0115
    grow = 0.013 + 0.0055 * (j % 3) + 0.0025 * abs(j - (N_LOOP - 1) / 2)
    pts = []
    for k in range(K):
        th = 2 * math.pi * k / K
        q = sash_at(th, grow) + sash_n * off
        # The loops sag loose of his side at the hip, the outer ones most.
        sag = max(0.0, 1.0 - (q - low).length / 0.2)
        q = q - UP * (sag * sag * (0.01 + 0.006 * abs(j - (N_LOOP - 1) / 2))) + (q - sash_c).normalized() * sag * 0.012
        pts.append(q)
    ob = tube("rope", pts, 0.0058, M["rope" if j % 3 else "rope_fleck"], closed=True)
    weights(ob, rope_w)
# The tie-off: three turns bound round the loops just above the hip, and
# the tail let out of it.
knot_c = low + UP * 0.05
for t in range(3):
    turn = [knot_c + UP * (0.012 * t) + sash_n * (0.05 * math.cos(a)) + (low - sash_c).normalized().cross(sash_n) * (0.024 * math.sin(a))
            + (low - sash_c).normalized() * 0.03 for a in (2 * math.pi * k / 14 for k in range(14))]
    weights(tube("rope_wrap", turn, 0.006, M["rope"], closed=True), rope_w)
tail_root = low + (low - sash_c).normalized() * 0.035 - UP * 0.01
bone("fx_tail", tail_root, tail_root - UP * 0.3, parent="fx_coil", roll_to=CHEST)
rides("fx_tail")
tail = [tail_root + CHEST * (0.006 * math.sin(k * 0.9)) - UP * (0.032 * k) + (low - sash_c).normalized() * (0.003 * k) for k in range(11)]
tube("rope_tail", tail, 0.0055, M["rope"], smooth_n=2)
FLUTTER["rope_tail"] = lambda co: min(1.0, max(0.0, (tail_root - co).dot(UP) / 0.3)) * 0.7

# ---------------------------------------------------------------- the HEAD
# His head, face and hair are the game's own triangles (`bareHeadParts`),
# under a light CLIMBING HELMET — a low, rounded shell standing two
# centimetres off the head, open at the brow and over the ears, its rim
# dropping behind, vented in dark slots — with a HEADLAMP on an elastic
# round it, and GLACIER GLASSES: a wrap of dark mirrored lens at the eyes,
# leather side shields, the arms back to the ears.
rides("head")
hc, hx, hy, hz, _ = frame("head")
HPAINT = {"skin": M["skin"], "knit": M["knit"], "trim": M["trim"], "strap": M["helmet_dark"],
          "lens": M["glass_lens"], "shell": M["helmet"]}


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
# The rim's dark edge, and his GOGGLES stowed round the back of the shell
# for the descent in cloud: the strap round the helmet, the frame and its
# orange lens over the nape, facing out behind him.
rim = [shell_pt(2 * math.pi * i / AROUND, 1.0, 0.002) for i in range(AROUND)]
tube("helmet_rim", rim, 0.0045, M["helmet_dark"], closed=True)
band = [shell_pt(2 * math.pi * i / AROUND, 0.7, 0.004) for i in range(AROUND)]
tube("goggle_strap", band, 0.0065, M["helmet_dark"], closed=True)
g_rings = []
for a in range(-60, 61, 15 if GAME else 6):
    phi = math.pi + math.radians(a)
    g_rings.append([shell_pt(phi, u, 0.012) for u in (0.6, 0.7, 0.8)])
gf = loft("goggle_frame", g_rings, [M["lamp"]], closed=False, cap=False)
gfs = gf.modifiers.new("thick", "SOLIDIFY")
gfs.thickness, gfs.offset = 0.012, 1
gl_rings = []
for a in range(-52, 53, 13 if GAME else 4):
    phi = math.pi + math.radians(a)
    gl_rings.append([shell_pt(phi, u, 0.025) for u in (0.62, 0.7, 0.78)])
gll = loft("goggle_lens", gl_rings, [M["lamp_lens"]], closed=False, cap=False)
gls = gll.modifiers.new("thick", "SOLIDIFY")
gls.thickness = 0.002
# A red stripe down the crown, the one mark on the helmet.
stripe = [shell_pt(0.0, u, 0.003) for u in (0.55, 0.3, 0.1)] + [shell_pt(math.pi, u, 0.003) for u in (0.1, 0.3, 0.5)]
tube("helmet_stripe", stripe, 0.006, M["biner_red"])
# The chin strap, ear to ear under the jaw.
cs = []
for k in range(11):
    t = (k / 10 * 2 - 1) * (math.pi / 2)
    cs.append(hp((0.072 * math.sin(t), -0.056 - 0.058 * math.cos(t), 0.004 + 0.05 * math.cos(t))))
tube("chin_strap", [hp((-0.083, 0.008, -0.01))] + cs + [hp((0.083, 0.008, -0.01))], 0.0035, M["helmet_dark"])
# GLACIER GLASSES: the lens a wrap at the eyes (the face's eyes at y ≈ 0,
# 9 cm ahead), its shields round the temples, the arms to the ears.
LY0, LY1 = -0.019, 0.02
lens_rings = []
for phi_d in range(-72, 73, 12 if GAME else 4):
    phi = math.radians(phi_d)
    rr = 0.087 + 0.012 * math.cos(phi)
    col = []
    for yy in (LY0, (LY0 + LY1) / 2, LY1):
        dip = 0.006 * (1 - abs(phi_d) / 72) if yy == LY0 else 0.0
        col.append(hp((math.sin(phi) * (0.083 + 0.004 * math.cos(phi)), yy + dip, math.cos(phi) * rr - 0.006)))
    lens_rings.append(col)
gl = loft("glasses_lens", lens_rings, [M["glass_lens"]], closed=False, cap=False)
gs = gl.modifiers.new("thick", "SOLIDIFY")
gs.thickness = 0.003
frame_top = [hp((math.sin(math.radians(a)) * 0.0855, LY1 + 0.002, math.cos(math.radians(a)) * (0.087 + 0.012 * math.cos(math.radians(a))) - 0.004))
             for a in range(-76, 77, 19 if GAME else 6)]
tube("glasses_frame", frame_top, 0.0028, M["glasses"])
for sd in (-1, 1):
    sh_rings = []
    for a in (80, 92, 104):
        phi = math.radians(a) * sd
        sh_rings.append([hp((math.sin(phi) * 0.0885, yy, math.cos(phi) * 0.09)) for yy in (LY0 + 0.004, LY1 - 0.002)])
    shld = loft("glasses_shield", sh_rings, [M["shield"]], closed=False, cap=False)
    ss = shld.modifiers.new("thick", "SOLIDIFY")
    ss.thickness = 0.003
    tube("glasses_arm", [hp((sd * 0.086, LY1 - 0.004, 0.0)), hp((sd * 0.086, 0.008, -0.045)), hp((sd * 0.08, -0.005, -0.07))],
         0.0022, M["glasses"])

# ---------------------------------------------------------------- GAITERS, FEET, GLOVES
# The pants' cuff straight down over the boot's cuff (the boot itself is
# the ski's, `skis.py`); the foot in its liner inside the shell; and LIGHT
# GLOVES closed round the grips — a guide skis down in thin softshell
# gloves with a leather palm, not a gauntlet: a short cuff under the sleeve.
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
    cyl("glove_cuff", e + fy * (fl * (wrist_t - 0.06)), e + fy * (fl * (wrist_t + 0.02)), 0.041, M["glove"], r2=0.039)
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

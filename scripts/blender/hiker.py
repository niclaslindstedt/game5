# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE HIKER MODELLED IN BLENDER: a mountain guide on the descent, as a man
# (`hiker`) or a woman (`hiker-woman`) — a red hardshell with black
# shoulders, slim charcoal touring pants with ARTICULATED, REINFORCED KNEES
# and kick patches inside the ankles, a lime climbing harness with its rack,
# a glacier rope coiled over the shoulder and across the chest in orange and
# white, a light alpine pack with a pale face panel and an ice axe on it, a
# radio, a climbing helmet with a headlamp, glacier glasses and light
# leather gloves — built off the game's own data (`kinds/hiker.mjs`): the
# body (`BODY`), the pose the dressed skier is bound in and every bone's
# frame in it (`dress-loft.ts`'s `bindPose`), the head, face and hair as the
# game's own triangles (`helmet-shape.ts`'s `bareHeadParts`), and the
# person's sex and colours (`outfit.ts`'s `BODIES`). A woman is cut to the
# women's survey on the very same bones (as `dress-body.ts` cuts the code's
# dress) and wears her braid out from under the helmet.
#
# The frame is the skier's (`skier.py`): the body frame (x right, y up, z
# forward, the origin at the centre of gravity) laid as Blender's
# (-x, z, y); his sides are the ENGINE's (`_l` the body's x negative).
#
# The game poses the model as it poses the dressed skier — bone for bone
# off `skierBones` — so every move the game has is the model's with no clip
# of its own (`player-model.ts`). What the game ADDS is what hangs off it:
# three SPRING BONES the game swings off the chest's own motion (`fx_pack`,
# the pack and the axe on it; `fx_coil`, the rope's coil at the tie-off;
# `fx_tail`, the rope's tail hanging off it) and the FLUTTER every loose
# piece of cloth carries (the jacket's dropped hem, the straps' tails, the
# coil's tail), which the game's vertex shader shakes in the air past it.
# Every vertex's colour is its material's, darkened by its own occlusion
# (cast here, ray by ray), so the game draws the model in one
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
PERSON = DATA["person"]
FEMALE = bool(PERSON["female"])


def B(p):
    """A point or direction of the body frame, in Blender's."""
    return Vector((-p["x"], p["z"], p["y"]))


def srgb(hexa):
    """An sRGB colour as linear."""
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 for c in ((hexa >> 16) & 255, (hexa >> 8) & 255, hexa & 255))


# ---------------------------------------------------------------- materials
# A valley guide's kit after the photographs of guides at work on the big
# glaciers: a HARDSHELL in a deep signal red (a client finds the guide by it
# on a glacier in cloud), its yoke over the shoulders and its forearms in
# black where the pack and the rope wear it; slim charcoal touring pants
# whose KNEES are a pre-bent panel of a tougher, darker double weave (the
# fabric a kneel on rock or a crampon's points wears through first),
# stitched round and darted across the joint, with kick patches of the same
# fabric round the inside of each ankle; a lime-green light alpine harness
# racked with screws and carabiners; a graphite pack with a pale grey face
# panel and dark daisy chains (a light face is what reads of a pack from
# behind, at a distance and against the light) and the ice axe in its loop;
# an orange 9 mm glacier rope with a white tracer carried COILED OVER THE
# SHOULDER and tied off across the chest; a radio on the left shoulder
# strap; worn tan leather work gloves; a pale grey helmet and black glacier
# glasses. Each material's colour is baked into the vertex colours
# (`paint`), and the game reads those; the names say which draw a part
# joins (`player-model.ts`: the HARD goods a shine of their own).
KIT = {
    "shell": (0xA3161F, 0.55, 0.0), "panel": (0x17181B, 0.65, 0.0), "pants": (0x34383E, 0.85, 0.0),
    "guard": (0x1B1D21, 0.95, 0.0), "seam": (0x0B0C0E, 0.9, 0.0),
    "zip": (0x0E0F11, 0.5, 0.0), "glove": (0x9C7650, 0.75, 0.0),
    "palm": (0x7A5A3A, 0.7, 0.0), "liner": (0x2B2E34, 0.85, 0.0), "webbing": (0x8CC63F, 0.6, 0.0),
    "pack": (0x43474D, 0.7, 0.0), "pack_dark": (0x1A1C1F, 0.75, 0.0), "pack_face": (0xC9CDD1, 0.75, 0.0),
    "rope": (0xF07A1E, 0.6, 0.0), "rope_fleck": (0xF2F0E6, 0.6, 0.0),
    "skin": (PERSON["skin"], 0.6, 0.0), "knit": (PERSON["hair"], 0.9, 0.0), "plait": (PERSON["plait"], 0.9, 0.0),
    "trim": (0x15110E, 0.6, 0.0), "cord": (0x2F7FD6, 0.6, 0.0),
    # The hard goods.
    "helmet": (0xB1B6BC, 0.35, 0.0), "helmet_dark": (0x23262A, 0.4, 0.0), "lamp": (0x1E1F22, 0.35, 0.0),
    "lamp_lens": (0xE9F4FF, 0.1, 0.0), "glasses": (0x121212, 0.3, 0.0), "glass_lens": (0x181A1E, 0.08, 0.6),
    "shield": (0x1A1A1A, 0.6, 0.0), "metal": (0xB8BDC3, 0.3, 0.85), "steel": (0x8A9096, 0.35, 0.9),
    "axe_shaft": (0x8A9096, 0.35, 0.6), "grip": (0x141618, 0.8, 0.0),
    "biner_gold": (0xC9A43C, 0.3, 0.85), "biner_red": (0xC2402F, 0.3, 0.7), "biner_blue": (0x2D7BD1, 0.3, 0.7),
    "radio": (0x202226, 0.5, 0.0),
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
# The flesh round the game's bones is the skier's: ANSUR II's mean man or
# woman (US Army 2012), the very table `dress-body.ts` cuts the code's dress
# to (`SURVEY`, handed in) — a guide is a person of the same measure; only
# the kit over the body differs. A woman's trunk is shaped as the code's
# (`dress-body.ts`'s `measure`): the bust carrying the chest's depth ahead,
# the seat further behind, the chest narrower against hips as broad.
ANSUR = DATA["survey"]
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


def sx(man, woman):
    """A shape factor: the man's, or the woman's (`dress-body.ts`'s ratios)."""
    return woman if FEMALE else man


BUST = sx(0.51, 0.6)
TRUNK = [
    (level(ANSUR["crotch"]) - 0.04, bh * 0.8 + 0.016, bd * 0.3 + 0.016, bd * 0.45 + 0.016),
    (level(ANSUR["crotch"]) + 0.05, bh * sx(1, 1.05) + 0.016, bd * 0.4 + 0.016, bd * sx(0.52, 0.56) + 0.016),
    (0.08, bh * sx(1, 1.04) + E["bloused"], bd * 0.42 + E["bloused"], bd * sx(0.55, 0.58) + E["bloused"]),
    (level(ANSUR["waist_h"]), wb + E["bloused"], wd * 0.55 + E["bloused"], wd * 0.45 + E["bloused"]),
    (level(ANSUR["tenth_rib_h"]), wb * 0.97 + E["trunk_side"], wd * 0.55 + E["chest_front"], wd * 0.46 + E["chest_back"]),
    (0.52, cb * 1.05 + E["trunk_side"], cd * BUST + E["chest_front"], cd * 0.48 + E["chest_back"]),
    (level(ANSUR["chest_h"]), cb * sx(1.12, 1.03) + E["trunk_side"], cd * (BUST - 0.01) + E["chest_front"], cd * 0.5 + E["chest_back"]),
    (level(ANSUR["axilla_h"]), cb * sx(1.2, 1.09) + E["trunk_side"], cd * 0.47 + E["chest_front"], cd * 0.5 + E["chest_back"]),
    (level(ANSUR["acromion_h"]) - 0.05, ANSUR["biacromial"] / 2 * MM * 0.9, cd * 0.4 + E["chest_front"], cd * 0.44 + E["chest_back"]),
    (0.95, r_of(ANSUR["neck_base"]) * 1.45 + 0.016, 0.092, 0.092),
    (1.0, r_of(ANSUR["neck_base"]) + 0.024, 0.084, 0.084),
]
pieces.append(lofted("trunk", "spine", TRUNK, n=2.7))
# A climber's collar: stood up close round the neck, higher than a piste
# jacket's and snug, the stowed hood rolled into it behind.
collar = [neck.lerp(head_c, u) for u in (0.0, 0.2, 0.38)]
CR = sx(1.0, 0.93)   # a woman's collar round her slimmer neck
pieces.append(loft("collar", [[c + SX * (0.088 * CR * math.cos(2 * math.pi * k / SEG)) + CHEST * (0.085 * CR * math.sin(2 * math.pi * k / SEG))
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
for k in ("shell", "panel", "pants", "guard", "zip", "seam"):
    suit.data.materials.append(M[k])
SUIT_MAT = {"shell": 0, "panel": 1, "pants": 2, "guard": 3, "zip": 4, "seam": 5}

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
# A guide's softshell is LONG, its hem dropped behind to cover the seat
# under a harness (a "drop tail"), so the hem plane leans: low behind,
# higher in front. The charcoal reinforcement covers the shoulders and the
# yoke where a pack's straps wear (`YOKE`), the forearms past the elbow
# (`CUFFS`, set further up than a piste jacket's cuff) and a band at the
# hem. The pants carry their REINFORCEMENT as touring pants do: a pre-bent
# KNEE PANEL of a darker double weave over the front of each knee (`KNEES`,
# an octagon of planes: straight seams round a rounded panel, stitched
# across its top and foot and darted across the joint), stood a few
# millimetres proud of the leg as a second layer is; and KICK PATCHES of the
# same fabric round the inside of each ankle, above the boot, where a ski's
# edge or a crampon catches. Every one of those edges is a plane cut only
# through the leg it belongs to, so nothing else is cut by it.
HEM_UP = (UP - CHEST * 0.16).normalized()
HEM = (hips - UP * 0.05, HEM_UP)
HEM_BAND = (hips - UP * 0.05 + HEM_UP * 0.03, HEM_UP)
YOKE = (neck - UP * 0.12, (UP + CHEST * 0.12).normalized())
ZIP = [(neck + SX * 0.006, SX), (neck - SX * 0.006, -SX)]
CUFFS = [(frame(f"forearm_{s}")[0] + frame(f"forearm_{s}")[2] * frame(f"forearm_{s}")[4] * 0.35,
          frame(f"forearm_{s}")[2]) for s in "lr"]
LAPS = [(frame(f"thigh_{s}")[0] + frame(f"thigh_{s}")[2] * frame(f"thigh_{s}")[4] * 0.22,
         frame(f"thigh_{s}")[2]) for s in "lr"]
ARMS = [(frame(f"upperarm_{s}")[0] + frame(f"upperarm_{s}")[2] * frame(f"upperarm_{s}")[4] * 0.3,
         frame(f"upperarm_{s}")[2]) for s in "lr"]


def knee_frame(i, s):
    """The knee's own axes: its point, down the leg (between the thigh and
    the shin), ahead (off the kneecap) and across it."""
    k = knees[i]
    down = (frame(f"thigh_{s}")[2] + frame(f"shin_{s}")[2]).normalized()
    ahead = CHEST - down * CHEST.dot(down)
    ahead = ahead.normalized()
    return k, down, ahead, down.cross(ahead).normalized()


# A knee panel's outline in the knee's axes, m: up the thigh and down the
# shin from the joint, half its breadth across the kneecap, how much of
# each corner is cut off, how far behind the kneecap its sides reach — and
# the seams across it: a stitched band under its top and over its foot,
# and the articulation dart across the joint just over the kneecap.
KNEE = {"top": 0.115, "foot": 0.1, "half": 0.066, "corner": 0.03, "back": 0.022, "band": 0.007,
        "dart": (-0.03, -0.021), "proud": 0.0028}
KNEES, KICKS = [], []
for i, s in enumerate("lr"):
    k, down, ahead, across = knee_frame(i, s)
    th_y, sh_y = frame(f"thigh_{s}")[2], frame(f"shin_{s}")[2]
    top_at, foot_at = k - th_y * KNEE["top"], k + sh_y * KNEE["foot"]
    # Each edge faces OUT of the panel: a point is on the panel when it is
    # behind every one of them.
    edges = [(top_at, -th_y), (foot_at, sh_y), (k + across * KNEE["half"], across),
             (k - across * KNEE["half"], -across), (k - ahead * KNEE["back"], -ahead)]
    for out, at in ((-th_y, top_at), (sh_y, foot_at)):
        for sd in (-1, 1):
            corner = at + across * (sd * KNEE["half"])
            edges.append((corner - out * KNEE["corner"], (out + across * sd).normalized()))
    seams = [(top_at + th_y * KNEE["band"], th_y), (foot_at - sh_y * KNEE["band"], -sh_y),
             (k + down * KNEE["dart"][0], down), (k + down * KNEE["dart"][1], down)]
    KNEES.append({"edges": edges, "seams": seams, "at": k, "down": down, "ahead": ahead})
    sh = frame(f"shin_{s}")
    inward = -sh[1] if sh[1].dot(feet[i] - hips) > 0 else sh[1]
    KICKS.append({"top": (sh[0] + sh[2] * (sh[4] * 0.42), sh[2]), "inside": (sh[0] + inward * 0.012, inward),
                  "at": sh[0] + sh[2] * (sh[4] * 0.55)})


def on_knee(co, i):
    """0 off the panel, 1 on its plain face, 2 on a seam across it."""
    kn = KNEES[i]
    if any(above(co, e) for e in kn["edges"]):
        return 0
    band_top, band_foot = kn["seams"][0], kn["seams"][1]
    dd = (co - kn["at"]).dot(kn["down"])
    if not above(co, band_top) or not above(co, band_foot) or KNEE["dart"][0] < dd < KNEE["dart"][1]:
        return 2
    return 1


def above(co, plane):
    return (co - plane[0]).dot(plane[1]) > 0


def near_faces(bm, at, reach):
    faces = [f for f in bm.faces if (f.calc_center_median() - at).length < reach]
    vs = {v for f in faces for v in f.verts}
    es = {e for f in faces for e in f.edges}
    return list(vs) + list(es) + faces


bm = bmesh.new()
bm.from_mesh(suit.data)
for co, no in [HEM, HEM_BAND, YOKE] + CUFFS + LAPS + ZIP + ARMS:
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)
for kn in KNEES:
    for co, no in kn["edges"] + kn["seams"]:
        bmesh.ops.bisect_plane(bm, geom=near_faces(bm, kn["at"], 0.2), plane_co=co, plane_no=no)
for kk in KICKS:
    for co, no in (kk["top"], kk["inside"]):
        bmesh.ops.bisect_plane(bm, geom=near_faces(bm, kk["at"], 0.16), plane_co=co, plane_no=no)
bm.to_mesh(suit.data)
bm.free()


def cloth_of(co):
    b = nearest(co)
    if b.startswith(("thigh", "shin")):
        knee = on_knee(co, "lr".index(b[-1]))
        if knee:
            return "seam" if knee == 2 else "guard"
    if b.startswith(("shin", "boot")) or not above(co, HEM):
        if b.startswith("shin"):
            kk = KICKS["lr".index(b[-1])]
            if above(co, kk["top"]) and above(co, kk["inside"]):
                return "guard"
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
# The reinforcement is a SECOND LAYER sewn over the pants: stood proud of
# them by its own thickness, its edge eased down onto them, its seams sunk
# a little into it as stitching pulls a seam in.
bm = bmesh.new()
bm.from_mesh(suit.data)
bm.normal_update()
LAYER = {SUIT_MAT["guard"]: 1.0, SUIT_MAT["seam"]: 0.55}
moves = []
for v in bm.verts:
    ks = [LAYER.get(f.material_index, 0.0) for f in v.link_faces]
    if ks and max(ks) > 0:
        moves.append((v, v.normal * (KNEE["proud"] * sum(ks) / len(ks))))
for v, d in moves:
    v.co += d
bm.to_mesh(suit.data)
bm.free()
for p in suit.data.polygons:
    p.use_smooth = True
weights(suit, suit_weights)
# THE DROPPED HEM FLUTTERS: the bottom few centimetres of the jacket, most
# behind where the tail hangs free of the harness.
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
# A light alpine pack of 30 litres: a tall narrow body 50 cm high, 28 wide
# and 17 deep, its top a lid; slim padded shoulder straps over the
# shoulders and down the chest with a sternum strap; the straps' tails
# hanging free (they flutter). It rides its own spring bone (`fx_pack`,
# hung at the top of the back), so it settles a little behind him as he
# moves; the rope's coil and its tail hang off it on bones of their own.
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
pack = loft("pack", rings_, [M["pack"], M["pack_dark"], M["pack_face"]])
# THE FACE PANEL: a pale grey panel over the pack's back between its side
# seams, from over its dark base to under the lid, cut along planes so its
# edges run straight — what reads of the pack from behind and against the
# light, where a graphite pack is a dark block.
FACE_X, FACE_LO, FACE_HI = 0.098, PACK_LO + 0.1, 0.86
bm = bmesh.new()
bm.from_mesh(pack.data)
for co, no in ((T(0, FACE_X), SX), (T(0, -FACE_X), SX), (T(FACE_LO), UP), (T(FACE_HI), UP),
               (T(PACK_LO + 0.07), UP)):
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)
bm.to_mesh(pack.data)
bm.free()


def pack_mat(c):
    lv = (c - hips).dot(UP) / SPINE_L
    if lv < PACK_LO + 0.07:
        return 1
    behind = -(c - T(lv, 0.0, -(pack_back + 0.085))).dot(CHEST)
    if FACE_LO < lv < FACE_HI and abs((c - hips).dot(SX)) < FACE_X and behind > 0.04:
        return 2
    return 0


pack.data.polygons.foreach_set("material_index", [pack_mat(p.center) for p in pack.data.polygons])
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
axe_up = (UP - SX * 0.12).normalized()
axe_head = T(PACK_HI + 0.05, 0.07, -(pack_back + 0.175))
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

# The crampons go INSIDE the pack (a guide's are in a bag in it on the way
# down): strapped on its face they read as a grille from behind.

# THE SHOULDER STRAPS, riding him as the cloth does: from the pack's top
# over each shoulder and down his chest to the lower ribs, a sternum strap
# across them, and each strap's tail hanging below its buckle.
rides("chest")
# Everything strapped over the jacket is LAID ON IT: a ray cast out from
# the spine's line through where the strap should run finds the finished
# cloth (remeshed, smoothed, creased — and a woman's bust), and the strap
# is set a few millimetres off it there, so it neither floats nor sinks.
suit_bvh = BVHTree.FromObject(suit, bpy.context.evaluated_depsgraph_get())


def lay(p, off):
    """`p` moved onto the jacket along the ray out from the spine, `off` m proud."""
    a, b = SEGMENTS["spine"]
    d = b - a
    t = max(0.0, min(1.0, (p - a).dot(d) / d.length_squared))
    o = a + d * t
    ray = (p - o).normalized()
    hit = suit_bvh.ray_cast(o, ray, 1.0)[0]
    return p if hit is None else hit + ray * off


straps = []
for sd in (-1, 1):
    pth = [T(0.9, sd * 0.07, -(pack_back + 0.01)), T(1.0, sd * 0.1, -(cd * 0.38)), T(1.02, sd * 0.11, 0.02),
           lay(T(0.93, sd * 0.105, cd * 0.42), 0.008), lay(T(0.75, sd * 0.1, cd * 0.5), 0.008),
           lay(T(0.55, sd * 0.11, cd * 0.5), 0.008)]
    path = catmull(pth, n=4 if GAME else 8)
    straps.append(ribbon("strap", path, 0.055, 0.012, M["pack_dark"], off_trunk))
    lo = lay(T(0.55, sd * 0.11, cd * 0.5), 0.014)
    tl = [lo - UP * (0.03 * k) + CHEST * 0.003 * k for k in range(6)]
    straps.append(ribbon("strap_tail", tl, 0.022, 0.003, M["pack_dark"], off_trunk))
    # The strap's other end, into the pack's foot at the side.
    straps.append(ribbon("strap_low", [T(0.6, sd * 0.13, cd * 0.3), T(0.45, sd * 0.155, 0.0), T(PACK_LO + 0.05, sd * 0.14, -(pack_back + 0.01))],
                         0.022, 0.004, M["pack_dark"], off_trunk))
sternum_at = lay(T(0.84, 0.0, cd * 0.5), 0.016)
straps.append(box("sternum", sternum_at, (0.2, 0.004, 0.024), M["pack_dark"], bevel=0))
straps.append(box("sternum_buckle", sternum_at + CHEST * 0.004, (0.04, 0.008, 0.03), M["grip"], bevel=0))
for o in straps:
    weights(o, lambda co: suit_weights(co, [n for n in SEGMENTS if n in ("spine", "head")]))
FLUTTER["strap_tail"] = lambda co: 0.0  # set per object below (names are unique once made)
for o in straps:
    if o.name.startswith("strap_tail"):
        top = max(v.co.dot(UP) for v in o.data.vertices)
        FLUTTER[o.name] = (lambda t: (lambda co: min(1.0, max(0.0, (t - co.dot(UP)) / 0.15))))(top)

# ---------------------------------------------------------------- the ROPE
# THE GLACIER ROPE CARRIED AS A GUIDE CARRIES IT: most of a 30 m length of
# rope (drawn 12 mm thick, as a 9 mm rope's bundle reads at a distance)
# taken up in COILS OVER HIS LEFT SHOULDER, a bandolier across his chest to under his right arm (the pack's straps under it in front,
# the pack worn over it behind, as a guide puts it on), the coils bound
# together by a few turns at the right hip — the tie-off — and the end
# clipped short to his harness. Each loop is laid round his trunk: `phi`
# goes round him (0 his right side, a quarter his chest), its level up the
# spine falling from his left shoulder to his right hip, its reach the
# jacket's own outline there and the clearance over the straps.
N_COIL = 11 if GAME else 14
ROPE_R = 0.006
COIL_HI, COIL_LO = 1.02, 0.36
TIE_PHI = math.radians(22)        # the tie-off: low on his right, a little ahead


def coil_point(phi, j):
    """Loop `j`'s point at `phi` round him."""
    # The level: highest over the left shoulder, lowest at the tie-off.
    c = math.cos(phi - TIE_PHI)
    lv = (COIL_HI + COIL_LO) / 2 - (COIL_HI - COIL_LO) / 2 * c
    lv += 0.006 * (j - N_COIL / 2) / SPINE_L
    hx, fr, bk = trunk_r(lv)
    cp, sp = math.cos(phi), math.sin(phi)
    n = 2.7
    u = math.copysign(abs(cp) ** (2 / n), cp) * hx
    v = math.copysign(abs(sp) ** (2 / n), sp) * (fr if sp > 0 else bk)
    out = SX * u + CHEST * v
    d = out.length
    # Off the jacket by the straps' depth and the bundle's own (each loop
    # a rope's width outside the last), a touch more over the shoulder.
    over = 0.026 + 0.0075 * (j % 4) + 0.01 * max(0.0, -c) ** 4
    # The bundle's loops a little apart along its length, and sagging
    # where they hang free below the tie-off's side.
    sag = 0.012 * max(0.0, c) ** 3
    return T(lv) + out * ((d + over) / d) - UP * sag + UP * (0.004 * math.sin(3 * phi + j))


rides("chest")
coil_parts = []
K = 24 if GAME else 56
for j in range(N_COIL):
    pts = [coil_point(2 * math.pi * k / K, j) for k in range(K)]
    # Every third loop the rope's white tracer side up: the coil reads as a
    # bundle of loops, not a band of orange, from the front and behind.
    coil_parts.append(tube("rope", pts, ROPE_R, M["rope_fleck" if j % 3 == 1 else "rope"], closed=True))
# The tie-off: a few turns round the bundle at the hip, and the end let out
# of it, clipped to the belay loop in front with a slack bight hanging.
tie_c = coil_point(TIE_PHI, N_COIL // 2)
tie_dir = (coil_point(TIE_PHI + 0.05, N_COIL // 2) - coil_point(TIE_PHI - 0.05, N_COIL // 2)).normalized()
tie_o = (tie_c - T(COIL_LO)).normalized()
tie_w = tie_dir.cross(tie_o).normalized()
for k in range(4):
    c0 = tie_c + tie_dir * (0.012 * (k - 1.5))
    turn = [c0 + tie_o * (0.019 * math.cos(2 * math.pi * q / 10)) + tie_w * (0.015 * math.sin(2 * math.pi * q / 10)) for q in range(10)]
    coil_parts.append(tube("rope_tie", turn, ROPE_R, M["rope"], closed=True))
bone("fx_coil", tie_c, tie_c - UP * 0.12, parent="chest", roll_to=-CHEST)
for o in coil_parts:
    # The coils ride his chest and, toward their low side, his hips — the
    # bight under the tie-off swung on its own spring (`fx_coil`).
    def coil_w(co):
        w = suit_weights(co, ["spine"])
        k = max(0.0, 1.0 - (co - tie_c).length / 0.14)
        k = k * k * 0.6
        out = {b: v * (1 - k) for b, v in w.items()}
        if k > 0:
            out["fx_coil"] = k
        return out
    weights(o, coil_w)
# The end: from the tie-off down and round to the harness's belay loop, a
# loose bight of it hanging below — and the short tail past the knot,
# loosest of all, on its spring (`fx_tail`).
bight = [tie_c - UP * 0.01, tie_c - UP * 0.07 + CHEST * 0.02, (tie_c + buckle_at) / 2 - UP * 0.09 + CHEST * 0.04,
         buckle_at - UP * 0.04 + CHEST * 0.02, buckle_at - UP * 0.015]
end = tube("rope_end", bight, ROPE_R, M["rope"], smooth_n=4)
weights(end, lambda co: suit_weights(co, ["spine"]))
tail_root = tie_c - UP * 0.015 + tie_o * 0.02
bone("fx_tail", tail_root, tail_root - UP * 0.22, parent="fx_coil", roll_to=-CHEST)
rides("fx_tail")
tail = [tail_root + tie_o * (0.006 * k) - UP * (0.026 * k) + CHEST * (0.004 * math.sin(k)) for k in range(9)]
tube("rope_tail", tail, ROPE_R * 0.95, M["rope"], smooth_n=2)
FLUTTER["rope_tail"] = lambda co: min(1.0, max(0.0, (tail_root - co).dot(UP) / 0.22)) * 0.7

# THE RADIO on the left shoulder strap, where a guide's handset is clipped
# to talk to the rope team and the valley: a dark box with its antenna.
rides("chest")
rd = lay(T(0.8, -0.1, cd * 0.5), 0.03)
radio = [box("radio", rd, (0.055, 0.03, 0.1), M["radio"], bevel=0 if GAME else 0.004),
         cyl("radio_aerial", rd + UP * 0.05 + SX * 0.015, rd + UP * 0.12 + SX * 0.02, 0.0045, M["radio"], seg=8)]
for o in radio:
    weights(o, lambda co: suit_weights(co, ["spine"]))

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
# The rim's dark edge, and the headlamp's elastic round the shell.
rim = [shell_pt(2 * math.pi * i / AROUND, 1.0, 0.002) for i in range(AROUND)]
tube("helmet_rim", rim, 0.0045, M["helmet_dark"], closed=True)
band = [shell_pt(2 * math.pi * i / AROUND, 0.72, 0.004) for i in range(AROUND)]
tube("lamp_band", band, 0.005, M["helmet_dark"], closed=True)
lamp_at = shell_pt(0.0, 0.66, 0.018)
box("lamp", lamp_at, (0.05, 0.026, 0.03), M["lamp"], rot=(hz.to_track_quat("Y", "Z").to_euler()), bevel=0)
cyl("lamp_lens", lamp_at + hz * 0.012, lamp_at + hz * 0.018, 0.011, M["lamp_lens"], seg=12)
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

# A WOMAN'S BRAID, as the code's dress plaits it (`dress-head.ts`): out
# from under the helmet's nape — and, the pack's lid sitting where it would
# hang, pulled forward over her RIGHT shoulder (the rope's coils are on the
# left) to lie down her chest over the strap, as a woman wearing a pack
# wears it: so it reads on the rider card and in profile, where a braid
# laid on the lid read as a hoop. Three strands plaited: lobes in her
# hair's colour leaning side to side over a core in the partings' darker
# shade, a dark tie and a short tuft. Its top rides the head and the rest
# the chest, so it lies on her when she bends.
if FEMALE:
    rides("head")

    def lump(name, center, radii, m, rot=(0, 0, 0)):
        """`lib.py`'s ellipsoid on a coarser sphere (6 × 4): a plait's lobe
        is a few pixels at the chase camera."""
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

    path = catmull([hp((0.0, -0.03, -0.1)), T(1.07, 0.05, -0.075), lay(T(1.03, 0.085, -0.01), 0.03),
                    lay(T(0.96, 0.075, cd * 0.42), 0.026), lay(T(0.88, 0.068, cd * 0.5), 0.03),
                    lay(T(0.8, 0.064, cd * 0.5), 0.03)], n=4)
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
    n_lobes = int((L - 0.05) / 0.03)
    for q in range(n_lobes):
        u = 0.02 + q * 0.03
        c, t = at_len(u)
        w = 1.0 - 0.45 * u / L
        side = t.cross(-CHEST if t.dot(UP) < 0.7 else UP).normalized()
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

    for o in [core] + lobes:
        weights(o, braid_w)

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
                     for a in (2 * math.pi * k / 16 for k in range(16))] for u, w, fr, bk in shaft],
         [M["pants"], M["guard"]], face_mat=lambda c: 1 if above(c, KICKS[i]["inside"]) else 0)
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
    # A woman's hand is the survey's smaller one: the glove cut to her wrist.
    HS = (ANSUR["wrist"] / 176) ** 0.7
    cyl("glove_cuff", e + fy * (fl * (wrist_t - 0.06)), e + fy * (fl * (wrist_t + 0.02)), 0.041 * HS, M["glove"], r2=0.039 * HS)
    rides(f"hand_{s}")
    c, hx_h, hy_h, hz_h, _ = frame(f"hand_{s}")
    out = hx_h if hx_h.dot(shoulders[i] - neck) > 0 else -hx_h
    turn = Matrix((out, hy_h, hz_h)).transposed().to_euler()
    ellipsoid("glove_back", c - hy_h * 0.033 + out * 0.012, (0.026 * HS, 0.046 * HS, 0.044 * HS), M["glove"], rot=turn)
    ellipsoid("glove_palm", c - hy_h * 0.03 - out * 0.008, (0.02 * HS, 0.04 * HS, 0.04 * HS), M["palm"], rot=turn)
    for k in range(4):
        along_g = hz_h * (0.027 - 0.018 * k)
        arc = [c + along_g + (hy_h * math.cos(t) + out * math.sin(t)) * 0.022
               for t in (math.radians(a) for a in range(-110, 181, 58 if GAME else 20))]
        tube("finger", arc, (0.0088 - 0.0007 * k) * HS, M["glove"], smooth_n=0 if GAME else 2)
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

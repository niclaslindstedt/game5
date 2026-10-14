# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE PARK RIDER MODELLED IN BLENDER, as a man (`freestyle`) or a woman
# (`freestyle-woman`): a slopestyle and halfpipe rider's kit — a TALL
# jacket hanging to mid-thigh, cut big through the body and the arms, with a
# colour-blocked yoke and chest band; BAGGY pants stacked over the boots; a
# low matt soft-shell park helmet under big frameless goggles; a neck gaiter;
# leather pipe gloves (his) or mitts (hers) — built off the game's own data
# (`kinds/freestyle.mjs`): the body (`BODY`), the pose the dressed skier is
# bound in and every bone's frame in it (`dress-loft.ts`'s `bindPose`), the
# head in its helmet as the game's own triangles (`helmet-shape.ts`'s
# `helmetParts`), the person's sex and colours (`outfit.ts`'s `BODIES`) and
# the survey the body is cut to (`dress-body.ts`'s `SURVEY`).
#
# WHAT A PARK RIDER WEARS, after photographs of slopestyle and halfpipe
# riders in competition and in the park (kept local, never committed or
# named): the outerwear is loose on purpose — a jacket cut long, past the
# seat to mid-thigh, its shoulders dropped and its sleeves long enough to
# bunch over the gloves; pants a size up, straight and wide, stacked in
# folds over the boot; a helmet-compatible HOOD, which he wears UP OVER THE
# HELMET with the goggles' strap round the outside of it, and she wears down
# on her back; a printed gaiter pulled up under the goggles; short leather
# "pipe" gloves or mitts. A back protector is common under it and is not
# drawn: nothing of it shows through a jacket this loose.
#
# The frame is the skier's (`skier.py`): the body frame (x right, y up, z
# forward, the origin at the centre of gravity) laid as Blender's
# (-x, z, y); his sides are the ENGINE's (`_l` the body's x negative).
#
# The game poses the model as it poses the dressed skier — bone for bone
# off `skierBones` — so every move the game has is the model's with no clip
# of its own (`player-model.ts`). What the game ADDS is what hangs off it:
# one SPRING BONE (`fx_hood`: her hood down on her back, the slack back of
# his hood up — swung off the
# chest's own motion) and the FLUTTER every loose piece of cloth carries —
# the long jacket's skirt, freest at its hem; the pants' wide legs over the
# boots; the hood — which the game's vertex shader trails and shakes in the
# air past him. Every vertex's colour is its material's (or the goggles'
# PRINT), darkened by its own occlusion (cast here, ray by ray), so the game
# draws the model in one vertex-coloured skin as it draws the dressed one.

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
# The colourways (sRGB), as a park kit is sold: muted, colour-blocked, never
# a team's print. HIS: a mustard jacket with a charcoal yoke and a sage band
# across the chest, loose olive-black pants, a matt black helmet, goggles
# with a white frame and a fire-mirror lens on a black and white strap, a
# gaiter in rust, black leather pipe gloves. HERS: a lilac jacket with a
# cream yoke and a teal band, wide sand pants, an off-white helmet, a
# rose-gold lens on a lilac strap, burgundy mitts.
if FEMALE:
    MAIN, YOKE_C, BAND_C, PANTS_C = 0xB49ADB, 0xEDE6D6, 0x2E8C8A, 0xD8CCB2
    HELMET_C, FRAME_C, STRAP_C, STRAP_B, GLOVE_C, PALM_C = 0xE9E5DC, 0xEDE6D6, 0x5B4A7A, 0xB49ADB, 0x7A2335, 0x4A1520
    LENS_LO, LENS_HI = 0xC2557A, 0xF2C46A
else:
    MAIN, YOKE_C, BAND_C, PANTS_C = 0xD49A26, 0x2B2D30, 0x8FA585, 0x34372E
    HELMET_C, FRAME_C, STRAP_C, STRAP_B, GLOVE_C, PALM_C = 0x1E2023, 0xF2F2EE, 0x17181A, 0xF2F2EE, 0x18191C, 0x2C2620
    LENS_LO, LENS_HI = 0xD8401E, 0xF7C531
KIT = {
    "shell": (MAIN, 0.85, 0.0), "panel": (YOKE_C, 0.85, 0.0), "band": (BAND_C, 0.85, 0.0),
    "rib": (YOKE_C, 0.95, 0.0), "zip": (0x0E0F11, 0.5, 0.0), "pants": (PANTS_C, 0.92, 0.0),
    "seam": (0x0B0C0E, 0.9, 0.0), "lining": (BAND_C, 0.9, 0.0), "gaiter": (0x9A3B22, 0.95, 0.0),
    "glove": (GLOVE_C, 0.6, 0.0), "palm": (PALM_C, 0.7, 0.0), "liner": (0x2B2E34, 0.85, 0.0),
    "strap": (STRAP_C, 0.8, 0.0), "strap_band": (STRAP_B, 0.8, 0.0),
    "skin": (PERSON["skin"], 0.6, 0.0), "knit": (PERSON["hair"], 0.9, 0.0), "plait": (PERSON["plait"], 0.9, 0.0),
    "trim": (0x15110E, 0.6, 0.0),
    # The hard goods: the helmet, its liner and trim, the goggles.
    "helmet": (HELMET_C, 0.62, 0.0), "helmet_dark": (0x1A1B1E, 0.7, 0.0),
    "frame": (FRAME_C, 0.4, 0.0), "lens": (LENS_HI, 0.06, 0.7),
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
    split pelvis to chest up the spine."""
    pool = among or [n for n in SEGMENTS if not n.startswith("boot")]
    b0 = nearest(co, pool)
    d0 = along(co, SEGMENTS[b0])[1]
    w = {n: math.exp(-(along(co, SEGMENTS[n])[1] - d0) / blend(b0, n)) for n in [b0] + [k for k in NEAR[b0] if k in pool]}
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
# to (`SURVEY`, handed in); only the kit over it differs.
ANSUR = DATA["survey"]
MM = 0.001


def level(h):
    return (h - ANSUR["trochanterion"]) / (ANSUR["cervicale"] - ANSUR["trochanterion"])


def r_of(circ):
    return circ * MM / (2 * math.pi)


# THE KIT'S EASE, m a side: a park kit is cut BIG — the jacket stands four
# or five centimetres off the trunk (a piste jacket's is three, a
# softshell's one or two), its sleeves wide; the pants a size up through the
# seat and the thigh and wider still at the foot, where they stack.
EASE = {"chest_front": 0.04, "chest_back": 0.045, "trunk_side": 0.04, "bloused": 0.05,
        "sleeve": 0.03, "pants": 0.03, "foot": 0.05, "cap": 0.018}

P = POSE
hips, neck, head_c = B(P["hips"]), B(P["neck"]), B(P["head"])
knees, feet = [B(k) for k in P["knees"]], [B(f) for f in P["feet"]]
shoulders, elbows, hands = [B(k) for k in P["shoulders"]], [B(k) for k in P["elbows"]], [B(k) for k in P["hands"]]
SEG = 16 if GAME else 28
SX, UP, CHEST, SPINE_L = frame("spine")[1], frame("spine")[2], frame("spine")[3], frame("spine")[4]


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


def off_trunk(p):
    """The way off his trunk at a point: out from the spine's line."""
    a, b = SEGMENTS["spine"]
    d = b - a
    t = max(0.0, min(1.0, (p - a).dot(d) / d.length_squared))
    v = p - (a + d * t)
    return v.normalized() if v.length > 1e-6 else CHEST


def sx(man, woman):
    """A shape factor: the man's, or the woman's (`dress-body.ts`'s ratios)."""
    return woman if FEMALE else man


rides("chest")
pieces = []
bh = ANSUR["hip_breadth"] / 2 * MM
bd = ANSUR["buttock_depth"] * MM
wb, wd = ANSUR["waist_breadth"] / 2 * MM, ANSUR["waist_depth"] * MM
cb, cd = ANSUR["chest_breadth"] / 2 * MM, ANSUR["chest_depth"] * MM
E = EASE
BUST = sx(0.51, 0.58)
# The jacket hangs STRAIGHT from the chest: no waist taken in, the trunk's
# sections as broad at the belly as under the arms.
TRUNK = [
    (level(ANSUR["crotch"]) - 0.04, bh * 0.8 + 0.03, bd * 0.3 + 0.03, bd * 0.45 + 0.03),
    (level(ANSUR["crotch"]) + 0.05, bh * sx(1, 1.05) + 0.03, bd * 0.42 + 0.03, bd * sx(0.52, 0.56) + 0.03),
    (0.08, bh * sx(1.02, 1.05) + E["bloused"], bd * 0.46 + E["bloused"], bd * sx(0.56, 0.6) + E["bloused"]),
    (level(ANSUR["waist_h"]), max(wb, bh * 0.98) + E["bloused"], wd * 0.6 + E["bloused"], wd * 0.5 + E["bloused"]),
    (level(ANSUR["tenth_rib_h"]), max(wb, cb) * 1.0 + E["trunk_side"], wd * 0.6 + E["chest_front"], wd * 0.5 + E["chest_back"]),
    (0.52, cb * 1.06 + E["trunk_side"], cd * BUST + E["chest_front"], cd * 0.48 + E["chest_back"]),
    (level(ANSUR["chest_h"]), cb * sx(1.12, 1.04) + E["trunk_side"], cd * (BUST - 0.01) + E["chest_front"], cd * 0.5 + E["chest_back"]),
    (level(ANSUR["axilla_h"]), cb * sx(1.2, 1.1) + E["trunk_side"], cd * 0.47 + E["chest_front"], cd * 0.5 + E["chest_back"]),
    # Dropped shoulders: the jacket's shoulder seam out past the bone's.
    (level(ANSUR["acromion_h"]) - 0.05, ANSUR["biacromial"] / 2 * MM * 0.98, cd * 0.42 + E["chest_front"] * 0.7, cd * 0.46 + E["chest_back"] * 0.7),
    (0.95, r_of(ANSUR["neck_base"]) * 1.5 + 0.024, 0.1, 0.1),
    (1.0, r_of(ANSUR["neck_base"]) + 0.034, 0.094, 0.094),
]
pieces.append(lofted("trunk", "spine", TRUNK, n=2.6))
# A funnel neck stood up round the gaiter, wide and soft.
collar = [neck.lerp(head_c, u) for u in (0.0, 0.18, 0.32)]
CR = sx(1.0, 0.94)
pieces.append(loft("collar", [[c + SX * (0.098 * CR * math.cos(2 * math.pi * k / SEG)) + CHEST * (0.096 * CR * math.sin(2 * math.pi * k / SEG))
                               for k in range(SEG)] for c in collar], [M["shell"]]))
for i, s in enumerate("lr"):
    reach = ANSUR["bideltoid"] / 2 * MM - ANSUR["biacromial"] / 2 * MM
    out = (shoulders[i] - neck.lerp(hips, 0.12)).normalized()
    pieces.append(ellipsoid("shoulder", shoulders[i] + UP * 0.006 + out * 0.008,
                            (reach + E["cap"] + 0.012, reach + E["cap"] + 0.012, reach + E["cap"] + 0.012), M["shell"]))
    b = r_of(ANSUR["biceps"]) * 0.95
    sl = E["sleeve"]
    pieces.append(lofted("sleeve", f"upperarm_{s}", [
        (-0.05, b * 1.25 + sl, b * 1.2 + sl, b * 1.2 + sl),
        (0.35, b * 1.08 + sl, b * 1.05 + sl, b * 1.1 + sl),
        (0.7, b * 1.0 + sl, b * 0.98 + sl, b * 1.02 + sl),
        (1.05, b * 0.95 + sl, b * 0.95 + sl, b * 0.95 + sl)]))
    f, w = r_of(ANSUR["forearm"]) * 0.95, r_of(ANSUR["wrist"])
    wrist_t = ANSUR["forearm_length"] * MM / frame(f"forearm_{s}")[4]
    # The sleeve runs long, past the wrist and over the glove's cuff.
    pieces.append(lofted("sleeve", f"forearm_{s}", [
        (-0.08, f * 1.12 + sl, f * 1.08 + sl, f * 1.16 + sl),
        (0.3, f * 1.04 + sl, f * 1.04 + sl, f * 1.04 + sl),
        (wrist_t - 0.22, (f + w) / 2 + sl, (f + w) / 2 + sl, (f + w) / 2 + sl),
        (wrist_t + 0.02, w + sl + 0.006, w + sl + 0.006, w + sl + 0.006)]))
    pieces.append(ellipsoid("elbow", elbows[i], (b * 0.98 + sl,) * 3, M["shell"]))
    th, lt = r_of(ANSUR["thigh"]), r_of(ANSUR["lower_thigh"])
    pe = E["pants"]
    # BAGGY PANTS: wide through the thigh, straight past the knee, flaring
    # wider to the foot where they stack over the boot (`CUFF`).
    pieces.append(lofted("pants", f"thigh_{s}", [
        (-0.12, th * 1.08 + pe, th * 1.02 + pe, th * 1.12 + pe),
        (0.2, th * 1.02 + pe, th + pe, th * 1.02 + pe),
        (0.6, th * 0.94 + pe, th * 0.92 + pe, th * 0.94 + pe),
        (0.95, th * 0.9 + pe, th * 0.88 + pe, th * 0.9 + pe)], m=M["pants"]))
    ca, an = r_of(ANSUR["calf"]), r_of(ANSUR["ankle"])
    pieces.append(lofted("pants", f"shin_{s}", [
        (-0.05, th * 0.9 + pe, th * 0.88 + pe, th * 0.9 + pe),
        (0.3, ca + pe + 0.012, ca + pe + 0.01, ca * 1.08 + pe + 0.012),
        (0.5, ca + E["foot"], ca + E["foot"], ca * 1.05 + E["foot"]),
        (0.6, ca + E["foot"] + 0.008, ca + E["foot"] + 0.008, ca * 1.05 + E["foot"] + 0.008)], m=M["pants"]))
    pieces.append(ellipsoid("knee", knees[i], (th * 0.9 + pe + 0.004,) * 3, M["pants"]))

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
    thin.ratio = 4200 / max(1, len(suit.data.polygons) * 2)
    bpy.ops.object.convert(target="MESH")
suit.data.materials.clear()
SUIT_KEYS = ("shell", "panel", "band", "pants", "zip", "seam", "rib")
for k in SUIT_KEYS:
    suit.data.materials.append(M[k])
SUIT_MAT = {k: i for i, k in enumerate(SUIT_KEYS)}

# THE FOLDS a loose cloth throws: deep soft ridges where a joint gathers it
# (the inside of the elbow and the knee, the seat), and the STACK — rings of
# fold down each pant leg's foot where the long leg bunches on the boot.
FOLDS = [
    ("upperarm", 0.65, 1.0, -1, 0.009, 0.05), ("forearm", 0.0, 0.3, -1, 0.009, 0.05),
    ("forearm", 0.6, 0.92, 0, 0.007, 0.035),
    ("thigh", 0.72, 1.0, -1, 0.011, 0.06), ("shin", 0.0, 0.22, -1, 0.011, 0.06),
    ("shin", 0.36, 0.62, 0, 0.012, 0.045),
    ("thigh", 0.0, 0.2, 1, 0.006, 0.05), ("spine", 0.15, 0.45, 1, 0.006, 0.06),
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
# The jacket's body runs down to its SKIRT (`skirt`, a piece of its own past
# the hips), so the suit's own hem plane only parts the jacket's colour from
# the pants' under it; the YOKE across the shoulders and down the sleeves'
# tops in the second colour, a BAND across the chest under it in the third,
# the zip down the front, RIB knit cuffs at the sleeves' ends.
HEM = (hips - UP * 0.02, UP)
YOKE = (neck - UP * 0.13, (UP + CHEST * 0.1).normalized())
BAND_HI = (neck - UP * 0.16, -UP)
BAND_LO = (neck - UP * 0.21, UP)
ZIP = [(neck + SX * 0.006, SX), (neck - SX * 0.006, -SX)]
CUFFS = [(frame(f"forearm_{s}")[0] + frame(f"forearm_{s}")[2] * (ANSUR["forearm_length"] * MM - 0.035),
          frame(f"forearm_{s}")[2]) for s in "lr"]
LAPS = [(frame(f"thigh_{s}")[0] + frame(f"thigh_{s}")[2] * frame(f"thigh_{s}")[4] * 0.42,
         frame(f"thigh_{s}")[2]) for s in "lr"]


def above(co, plane):
    return (co - plane[0]).dot(plane[1]) > 0


bm = bmesh.new()
bm.from_mesh(suit.data)
for co, no in [HEM, YOKE, BAND_HI, BAND_LO] + CUFFS + LAPS + ZIP:
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)
bm.to_mesh(suit.data)
bm.free()


def cloth_of(co):
    b = nearest(co)
    if b.startswith(("shin", "boot")):
        return "pants"
    if b.startswith("thigh"):
        # Under the skirt the cloth is drawn in the jacket's colour, so a
        # thigh pushed through it in a deep crouch reads as the jacket.
        return "pants" if above(co, LAPS["lr".index(b[-1])]) else "shell"
    if b in ("head", "spine"):
        if not above(co, HEM):
            return "shell"
        zipped = not above(co, ZIP[0]) and not above(co, ZIP[1]) and (co - neck).dot(CHEST) > 0
        if zipped:
            return "zip"
        if above(co, YOKE):
            return "panel"
        return "band" if (above(co, BAND_LO) and above(co, BAND_HI)) else "shell"
    if b.startswith("upperarm"):
        return "panel" if above(co, YOKE) else "shell"
    if b.startswith("forearm"):
        return "rib" if above(co, CUFFS["lr".index(b[-1])]) else "shell"
    return "shell"


suit.data.polygons.foreach_set("material_index", [SUIT_MAT[cloth_of(p.center)] for p in suit.data.polygons])
for p in suit.data.polygons:
    p.use_smooth = True
weights(suit, suit_weights)


# The PANTS' FEET flap: the wide leg over the boot is the loosest of the
# pants, held only by the stack on the cuff.
def leg_flutter(co):
    b = nearest(co)
    if not b.startswith("shin"):
        return 0.0
    t = along(co, SEGMENTS[b])[0]
    k = max(0.0, min(1.0, (t - 0.3) / 0.3))
    return 0.45 * k * k


FLUTTER[suit.name] = leg_flutter

# ---------------------------------------------------------------- THE SKIRT
# The jacket hangs on past the hips to MID-THIGH: a skirt round the seat and
# the tops of the thighs, open at the foot and flaring a little, its hem a
# band in the yoke's colour — the loosest cloth on him, what the air past
# him lifts and flaps. It falls straight down behind him over the seat and,
# in front, over the thighs he is crouched over — each ring's point carried
# down the blend of the two. It rides mostly his hips, the rest the leg it
# hangs over: a stride parts it a little and a crouch folds it over the
# thighs, never stretching it between the knees as the pants are.
SKIRT = [  # how far down from the hem's top, half across, ahead, behind
    (0.0, bh * 1.02 + E["bloused"], bd * 0.46 + E["bloused"], bd * sx(0.56, 0.6) + E["bloused"]),
    (0.08, bh * 1.05 + E["bloused"] + 0.006, bd * 0.48 + E["bloused"], bd * sx(0.6, 0.64) + E["bloused"]),
    (0.17, bh * 1.08 + E["bloused"] + 0.014, bd * 0.5 + E["bloused"] + 0.006, bd * sx(0.62, 0.66) + E["bloused"] + 0.008),
    (0.25, bh * 1.1 + E["bloused"] + 0.022, bd * 0.52 + E["bloused"] + 0.012, bd * sx(0.63, 0.67) + E["bloused"] + 0.014),
    (0.29, bh * 1.12 + E["bloused"] + 0.026, bd * 0.53 + E["bloused"] + 0.014, bd * sx(0.63, 0.67) + E["bloused"] + 0.016),
]
THIGH = ((knees[0] + knees[1]) / 2 - hips).normalized()
SKIRT_TOP = T(0.08)
SK = 24 if GAME else 48
skirt_rings = []
for h, hx, fr, bk in SKIRT:
    out = []
    for k in range(SK):
        a = 2 * math.pi * k / SK
        ca, sa = math.cos(a), math.sin(a)
        q = SKIRT_TOP + SX * (math.copysign(abs(ca) ** (2 / 2.6), ca) * hx) + CHEST * (math.copysign(abs(sa) ** (2 / 2.6), sa) * (fr if sa > 0 else bk))
        front = max(0.0, sa) ** 1.2
        d = (-UP).lerp(THIGH, front).normalized()
        out.append(q + d * h)
    skirt_rings.append(out)
skirt = loft("skirt", skirt_rings, [M["shell"], M["rib"]], cap=False)
bm = bmesh.new()
bm.from_mesh(skirt.data)
bm.normal_update()
for v in bm.verts:
    rel = v.co - SKIRT_TOP
    a = math.atan2(rel.dot(CHEST), rel.dot(SX))
    k = max(0.0, min(1.0, (-rel.dot(UP) - 0.02) / 0.26))
    radial = (SX * rel.dot(SX) + CHEST * rel.dot(CHEST)).normalized()
    v.co += radial * (0.011 * k * math.sin(9 * a + 0.4) + 0.006 * k * math.sin(4 * a + 2))
for f_ in bm.faces:
    if (f_.calc_center_median() - SKIRT_TOP).dot(UP) < -0.235:
        f_.material_index = 1
bm.to_mesh(skirt.data)
bm.free()
sol = skirt.modifiers.new("cloth", "SOLIDIFY")
sol.thickness, sol.offset = 0.008, 1.0


def skirt_weights(co):
    legs = suit_weights(co, ["spine", "thigh_l", "thigh_r"])
    lean = 0.45 if (co - hips).dot(CHEST) > 0 else 0.25
    out = {"pelvis": 1 - lean}
    for n, w in legs.items():
        out[n] = out.get(n, 0.0) + w * lean
    top = sorted(out.items(), key=lambda kv: -kv[1])[:4]
    total = sum(v for _, v in top)
    return {n: v / total for n, v in top}


weights(skirt, skirt_weights)
FLUTTER[skirt.name] = lambda co: max(0.15, min(1.0, 0.2 + (-(co - SKIRT_TOP).dot(UP)) / 0.29 * 0.8))

# Two hand-warmer POCKETS low on the front: a flap of the yoke's colour
# stood off the cloth at each hip, sloping as a pocket's mouth does.
for sd in (-1, 1):
    pk = SKIRT_TOP + SX * (sd * (bh * 0.62)) + CHEST * (bd * 0.46 + E["bloused"] + 0.006) - UP * 0.02
    pob = box("pocket", pk, (0.13, 0.006, 0.02), M["panel"], rot=(CHEST.to_track_quat("Y", "Z") @ Quaternion(CHEST, -0.35 * sd)).to_euler(), bevel=0)
    weights(pob, lambda co: suit_weights(co, ["spine"]))

# THE PANT LEGS' STACK over each boot: two loose rings of cloth bunched at
# the leg's foot, wider than the leg, which the air shakes.
for i, s in enumerate("lr"):
    rides(f"shin_{s}")
    sh = frame(f"shin_{s}")
    ca = r_of(ANSUR["calf"])
    stack = []
    for t, r in ((0.6, ca + E["foot"] + 0.008), (0.66, ca + E["foot"] + 0.02), (0.72, ca + E["foot"] + 0.014),
                 (0.78, ca + E["foot"] + 0.026), (0.84, ca + E["foot"] + 0.018)):
        c = sh[0] + sh[2] * (t * sh[4])
        stack.append([c + sh[1] * (r * math.cos(2 * math.pi * k / SEG)) + sh[3] * (r * 1.06 * math.sin(2 * math.pi * k / SEG))
                      for k in range(SEG)])
    cuff = loft("cuff", stack, [M["pants"]], cap=False)
    cs = cuff.modifiers.new("cloth", "SOLIDIFY")
    cs.thickness, cs.offset = 0.006, 1.0
    FLUTTER[cuff.name] = (lambda seg: (lambda co: 0.35 + 0.4 * max(0.0, min(1.0, (along(co, seg)[0] - 0.6) / 0.24))))(SEGMENTS[f"shin_{s}"])

# ---------------------------------------------------------------- the HEAD
# The head in its helmet as the game's own triangles (`helmetParts`),
# painted as a park helmet — a low matt soft shell, its liner dark — under
# big frameless goggles with a mirrored lens.
# THE HOOD'S SPRING BONE, hung at the top of his back.
back_d = cd * 0.5 + E["chest_back"]
hood_top = T(1.0, 0.0, -(back_d * 0.75))
bone("fx_hood", hood_top, hood_top - UP * 0.2, parent="chest", roll_to=-CHEST)
rides("head")
hc, hx, hy, hz, _ = frame("head")
HOOD_UP = not FEMALE
HPAINT = {"shell": "helmet", "stripe": "helmet", "frame": "frame", "band": "strap_band", "trim": "helmet_dark",
          "strap": "strap", "foam": "helmet_dark", "liner": "helmet_dark", "knit": "knit", "lens": "lens",
          "skin": "skin"}


def head_point(p):
    return hc + hx * p[0] + hy * p[1] + hz * p[2]


for part in HELM["game" if GAME else "fine"]:
    # Under his hood the goggles' strap goes round the OUTSIDE of it (laid
    # on it below), so the helmet's own strap is left off.
    if HOOD_UP and part["material"] in ("strap", "band"):
        continue
    Pp, N, I = part["position"], part["normal"], part["index"]
    hv = [head_point(Pp[k:k + 3]) for k in range(0, len(Pp), 3)]
    hf = [I[k:k + 3] for k in range(0, len(I), 3)]
    ob = mesh_obj(f"helmet_{part['material']}", hv, hf, [M[HPAINT[part["material"]]]], recalc=False)
    normals = [tuple(hx * N[k] + hy * N[k + 1] + hz * N[k + 2]) for k in range(0, len(N), 3)]
    ob.data.normals_split_custom_set_from_vertices(normals)


# THE LENS' MIRROR: a fire (his) or rose-gold (hers) mirror, ramping from
# its colour low on the lens to a gold high, a bright band where the sky is
# caught.
def lens_print(co, no):
    v = max(0.0, min(1.0, ((co - hc).dot(hy) + 0.025) / 0.05))
    lo, hi = srgb(LENS_LO), srgb(LENS_HI)
    g = 0.7 + 0.3 * math.exp(-(((v - 0.74) / 0.08) ** 2))
    return tuple(min(1.0, (lo[j] + (hi[j] - lo[j]) * v ** 1.2) * g + 0.15 * math.exp(-(((v - 0.74) / 0.06) ** 2))) for j in range(3))


PRINT["lens"] = lens_print

# THE HELMET'S SHELL as `helmet-shape.ts` lays it (`SHELL`, `shellAt`), to
# lay the hood over it: a superellipse section at each height, tapered
# below its widest.
S_WIDEST, S_CROWN, S_W, S_AHEAD, S_BEHIND, S_Z0, S_SQ = 0.012, 0.127, 0.112, 0.138, 0.138, -0.004, 2.25
TAPER = (0.09, 0.09, 0.12, 0.2)


def section(y):
    if y >= S_WIDEST:
        u = min(1.0, (y - S_WIDEST) / (S_CROWN - S_WIDEST))
        k = math.sqrt(max(0.0, 1 - u * u))
        return S_W * k, S_AHEAD * k, S_BEHIND * k
    u = (S_WIDEST - y) / TAPER[0]
    k = u * u
    return S_W * (1 - TAPER[1] * k), S_AHEAD * (1 - TAPER[2] * k), S_BEHIND * (1 - TAPER[3] * k)


def spow(c, p):
    return math.copysign(abs(c) ** p, c)


def hood_at(y, a, off):
    """The hood's point at head height `y`, `a` rad round from ahead: the
    shell's section grown by `off` — and below the shell's foot narrowing
    into his neck and the jacket's funnel."""
    p = 2 / S_SQ
    if y >= -0.074:
        w, f, b = section(min(y, S_CROWN))
        w, f, b = w + off, f + off, b + off
    else:
        w0, f0, b0 = section(-0.074)
        u = min(1.0, (-0.074 - y) / 0.09)
        e = u * u * (3 - 2 * u)
        w = (w0 + off) * (1 - e) + 0.098 * e
        f = (f0 + off) * (1 - e) + 0.09 * e
        b = (b0 + off) * (1 - e) + 0.115 * e
    c = math.cos(a)
    return head_point((spow(math.sin(a), p) * w, y + (off * 0.6 if y > S_CROWN - 0.03 else 0.0), S_Z0 + spow(c, p) * (f if c > 0 else b)))


# The face's opening in the hood: round the goggles and the chin, from the
# brow over the goggles' frame to under the chin, out to the temples.
OPEN_A, OPEN_TOP, OPEN_BOT = math.radians(66), 0.058, -0.17


def in_opening(y, a):
    yc, hy_ = (OPEN_TOP + OPEN_BOT) / 2, (OPEN_TOP - OPEN_BOT) / 2
    return (abs(a) / OPEN_A) ** 3 + (abs(y - yc) / hy_) ** 3 < 1


def hood_weights(co):
    y = (co - hc).dot(hy)
    k = max(0.0, min(1.0, (-0.06 - y) / 0.08))
    k = k * k * (3 - 2 * k)
    return {"head": 1 - k, "chest": k} if 0 < k < 1 else ({"head": 1.0} if k <= 0 else {"chest": 1.0})


if HOOD_UP:
    # HIS HOOD UP OVER THE HELMET, as a park rider wears it: its crown two
    # centimetres over the shell, falling round the helmet and the back of
    # his neck into the jacket's collar, open round the goggles and the
    # gaiter, its edge rolled in a lining of the band's colour.
    OFF = 0.02
    AR = 28 if GAME else 64
    ys = [S_CROWN - 0.004, 0.115, 0.095, 0.07, 0.045, 0.02, -0.01, -0.04, -0.074, -0.11, -0.15, -0.19]
    verts, faces = [], []
    for y in ys:
        for k in range(AR):
            verts.append(hood_at(y, 2 * math.pi * k / AR - math.pi, OFF))
    for j in range(len(ys) - 1):
        for k in range(AR):
            a0 = 2 * math.pi * (k + 0.5) / AR - math.pi
            yc = (ys[j] + ys[j + 1]) / 2
            if in_opening(yc, a0):
                continue
            k1 = (k + 1) % AR
            faces.append([j * AR + k, j * AR + k1, (j + 1) * AR + k1, (j + 1) * AR + k])
    # The crown shut over the top ring.
    top = sum(verts[:AR], Vector()) / AR + hy * 0.004
    verts.append(top)
    for k in range(AR):
        faces.append([len(verts) - 1, (k + 1) % AR, k])
    hood = mesh_obj("hood", verts, faces, [M["shell"]])
    hs = hood.modifiers.new("cloth", "SOLIDIFY")
    hs.thickness, hs.offset = 0.007, 1.0
    # The back of the hood, slack below the helmet behind his neck, hangs
    # partly on the spring (`fx_hood`): it bounces on a landing.
    def hood_back(co):
        w = hood_weights(co)
        y = (co - hc).dot(hy)
        k = max(0.0, min(1.0, (-0.1 - y) / 0.06)) * max(0.0, min(1.0, -(co - hc).dot(hz) / 0.06))
        if k <= 0:
            return w
        w = {n: v * (1 - 0.5 * k) for n, v in w.items()}
        w["fx_hood"] = 0.5 * k
        return w

    weights(hood, hood_back)
    FLUTTER[hood.name] = lambda co: 0.06 if (co - hc).dot(hy) < -0.03 else 0.0
    # The rolled edge round the opening, and the gaiter inside it.
    lip = []
    for k in range(37):
        t = 2 * math.pi * k / 36
        a = OPEN_A * spow(math.cos(t), 2 / 3) * 0.97
        y = (OPEN_TOP + OPEN_BOT) / 2 + (OPEN_TOP - OPEN_BOT) / 2 * spow(math.sin(t), 2 / 3) * 0.97
        if y < -0.16:
            continue
        lip.append(hood_at(y, a, OFF + 0.002))
    lipo = tube("hood_lip", lip, 0.008, M["lining"])
    weights(lipo, hood_weights)
    # THE GOGGLES' STRAP round the outside of the hood, from the frame's
    # ends at the temples round the back of his head.
    for lane, (wid, m) in enumerate(((0.042, M["strap"]), (0.016, M["strap_band"]))):
        pts = [hood_at(-0.004 + 0.012 * (abs(a) - math.radians(60)) / math.pi, a, OFF + 0.009 + 0.0015 * lane)
               for a in (math.radians(d) for d in range(62, 299, 9 if GAME else 4))]
        rings = [[q + hy * (wid / 2), q - hy * (wid / 2)] for q in pts]
        stp = loft("goggle_strap", rings, [m], closed=False, cap=False)
        stp.modifiers.new("t", "SOLIDIFY").thickness = 0.003
    # The strap's ends into the frame.
    for sd in (-1, 1):
        a = math.radians(60) * sd
        ellipsoid("strap_clip", hood_at(-0.004, a, OFF + 0.006), (0.009, 0.022, 0.012), M["frame"],
                  rot=((hood_at(-0.004, a, 0) - hc).normalized()).to_track_quat("Z", "Y").to_euler())

# THE GAITER, pulled up under the goggles (his) over the nose and chin and
# down into the collar: a printed tube of thin knit.
if HOOD_UP:
    gr = []
    for y, w, f, b in ((-0.03, 0.074, 0.118, 0.098), (-0.06, 0.074, 0.122, 0.1), (-0.1, 0.07, 0.112, 0.098),
                       (-0.14, 0.068, 0.09, 0.09), (-0.18, 0.07, 0.085, 0.09)):
        rr = []
        for k in range(SEG):
            a = 2 * math.pi * k / SEG
            ca, sa = math.cos(a), math.sin(a)
            rr.append(head_point((spow(sa, 0.85) * w, y - 0.006 * max(0.0, ca) ** 2, -0.006 + spow(ca, 0.85) * (f if ca > 0 else b))))
        gr.append(rr)
    g_ = loft("gaiter", gr, [M["gaiter"]], cap=False)
    weights(g_, hood_weights)

# HER HOOD DOWN on her back between the shoulder blades: two layers of
# cloth in a soft heap off the collar, its opening rolled toward the sky,
# lined in the band's colour — on a SPRING BONE of its own (`fx_hood`), so it
# bounces on a landing and swings out in a turn, its foot freest in the air.
rides("chest")
if not HOOD_UP:
    rides("fx_hood")
    HOODS = ((0.0, 0.08, 0.026), (0.03, 0.125, 0.045), (0.09, 0.145, 0.056), (0.16, 0.13, 0.05),
             (0.215, 0.09, 0.034), (0.245, 0.04, 0.016))
    rings_ = []
    for u, w, t in HOODS:
        lv = 1.0 - (u + 0.02) / SPINE_L
        c = T(lv, 0.0, -(back_d * (0.82 + 0.4 * min(1.0, u / 0.08)) + t * 0.55))
        rr = []
        for j in range(SEG):
            a = 2 * math.pi * j / SEG
            ca, sa = math.cos(a), math.sin(a)
            bulge = t * (abs(sa) ** 0.8) * (1.0 if sa < 0 else 0.45)
            rr.append(c + SX * (w * spow(ca, 0.85)) + CHEST * math.copysign(bulge, sa))
        rings_.append(rr)
    hd = loft("hood", rings_, [M["shell"]])
    FLUTTER[hd.name] = (lambda top: (lambda co: max(0.1, min(0.7, (top - co.dot(UP)) / 0.25 * 0.7))))(hood_top.dot(UP))
    # The rolled edge round its mouth, the hood's top ring.
    tube("hood_lip", rings_[0] + rings_[0][:1], 0.009, M["lining"])
    rides("chest")

# A WOMAN'S BRAID, as the code's dress plaits it (`dress-head.ts`): out from
# under the helmet's nape and — her hood lying where it would hang — pulled
# forward over her RIGHT shoulder to lie down her chest, as the hiker wears
# hers past her pack. Its top rides the head and the rest the chest, and its
# tail is loose: the air past her shakes it.
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

    path = catmull([head_point((0.04, -0.05, -0.1)), T(1.08, 0.07, -0.07), lay(T(1.03, 0.1, -0.01), 0.03),
                    lay(T(0.95, 0.09, cd * 0.42), 0.022), lay(T(0.87, 0.085, cd * 0.5), 0.022),
                    lay(T(0.79, 0.08, cd * 0.5), 0.022)], n=4)
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

    def braid_free(co):
        k = ((co - top).length - 0.14) / max(0.05, L - 0.14)
        return max(0.0, min(1.0, k)) * 0.5

    for o in [core] + lobes:
        weights(o, braid_w)
        FLUTTER[o.name] = braid_free

# ---------------------------------------------------------------- FEET, GLOVES
# The foot in its liner inside the boot's shell (the boot itself is the
# ski's, `skis.py`), his own when a crash throws him off the skis; and the
# hands: short leather PIPE GLOVES closed round the grips (his), or MITTS
# (hers), the jacket's long sleeve over the cuff.
HS = (ANSUR["wrist"] / 176) ** 0.7
for i, s in enumerate("lr"):
    rides(f"boot_{s}")
    o, fx_, fy_, fz_, _ = frame(f"boot_{s}")
    lean = 0.22

    def down(d, o=o, fy_=fy_, fz_=fz_):
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
    cyl("glove_cuff", e + fy * (fl * (wrist_t - 0.06)), e + fy * (fl * (wrist_t + 0.02)), 0.043 * HS, M["glove"], r2=0.041 * HS)
    rides(f"hand_{s}")
    c, hx_h, hy_h, hz_h, _ = frame(f"hand_{s}")
    out = hx_h if hx_h.dot(shoulders[i] - neck) > 0 else -hx_h
    turn = Matrix((out, hy_h, hz_h)).transposed().to_euler()
    if FEMALE:
        # A MITT: the four fingers in one pocket round the grip, the thumb
        # its own, a darker palm.
        ellipsoid("mitt_back", c - hy_h * 0.03 + out * 0.012, (0.034 * HS, 0.052 * HS, 0.05 * HS), M["glove"], rot=turn)
        ellipsoid("mitt_palm", c - hy_h * 0.026 - out * 0.01, (0.026 * HS, 0.046 * HS, 0.046 * HS), M["palm"], rot=turn)
        arc = [c + (hy_h * math.cos(t) + out * math.sin(t)) * 0.024
               for t in (math.radians(a) for a in range(-110, 181, 58 if GAME else 20))]
        for k in (0.012, -0.022):
            tube("mitt_fingers", [p_ + hz_h * k for p_ in arc], 0.019 * HS, M["glove"], smooth_n=0 if GAME else 2)
    else:
        ellipsoid("glove_back", c - hy_h * 0.033 + out * 0.012, (0.027 * HS, 0.047 * HS, 0.045 * HS), M["glove"], rot=turn)
        ellipsoid("glove_palm", c - hy_h * 0.03 - out * 0.008, (0.021 * HS, 0.041 * HS, 0.041 * HS), M["palm"], rot=turn)
        for k in range(4):
            along_g = hz_h * (0.027 - 0.018 * k)
            arc = [c + along_g + (hy_h * math.cos(t) + out * math.sin(t)) * 0.022
                   for t in (math.radians(a) for a in range(-110, 181, 58 if GAME else 20))]
            tube("finger", arc, (0.009 - 0.0007 * k) * HS, M["glove"], smooth_n=0 if GAME else 2)
    tube("thumb", [c - hy_h * 0.03 - out * 0.018 + hz_h * 0.03, c - out * 0.02 + hz_h * 0.045,
                   c + hy_h * 0.02 - out * 0.012 + hz_h * 0.047], 0.0108 * HS, M["glove"], smooth_n=0 if GAME else 2)


# ---------------------------------------------------------------- PAINT
# Every modifier baked in and every transform applied, then each vertex's
# OCCLUSION cast (rays into the hemisphere over it, against every part), and
# the vertex colour laid: the face's material colour (or the PRINT at the
# vertex) times that occlusion — a face-corner colour, so a colour edge
# stays sharp where two materials meet; how loose the point is (`FLUTTER`)
# on the one UV map's u (nothing of this kit shivers: its v is 0).
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
    return 1.0 - 0.5 * hit / len(DIRS)


def base_name(name):
    return name.split(".")[0]


for o in meshes:
    me = o.data
    ao = [occlusion(v.co, v.normal) for v in me.vertices]
    fl_fn = FLUTTER.get(o.name) or FLUTTER.get(base_name(o.name))
    flt = [fl_fn(v.co) if fl_fn else 0.0 for v in me.vertices]
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
    # rides the one UV map's u (`TEXCOORD_0`, which the game reads).
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

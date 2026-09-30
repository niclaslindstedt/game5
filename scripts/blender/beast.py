# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# AN ANIMAL MODELLED IN BLENDER off the game's own data: the roster's row
# (`pwa/src/game/beast-defs.ts` — its length, its height at the shoulder,
# its gait) and its style (`BEAST_STYLES` in `beast-shapes.ts` — every
# proportion the code's builder shapes it by), handed in as one JSON file
# by `scripts/blender.mjs --kind=beast` — the driver, and the only way this
# runs. What this adds is the MODELLING: a body lofted from the rump over
# the loins and the withers (the hump where the row has one) to the chest,
# deeper than it is wide; legs in two bones, the knee forward on the fore
# and the hock back on the hind, a paw or a hoof at the foot; a neck that
# swells into the chest; a skull with a muzzle; leaf-shaped ears; the
# antlers or the horns the row has; a tail with a brush where it has one.
#
# THE FRAME (`static.py`'s): metres, standing on z = 0 with the nose down
# -y (the game's +z), z up, x the animal's right — so the glTF's metres are
# the game's with no turn. It stands with its legs plumb and its head up,
# as the code's animal is built: the game swings the legs and lowers the
# head in its shader, about the hip and the pivot at the withers.
#
# SEVEN MESHES, one a PART the game moves: `body`; `head` (the neck, the
# skull, the ears, the antlers and horns — everything that goes down to
# graze); `leg_lf`, `leg_rf`, `leg_lh`, `leg_rh` (left and right, fore and
# hind, the animal's own sides); `tail`. The root carries the HIP height and
# the head's PIVOT (up, forward) — the numbers the shader swings about.
# NO COLOUR IN THE FILE: every face is a ROLE (its material's name) the
# game paints off `BEAST_STYLES`; the tone's R is a SHADE.

import json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import GAME
from static import *

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
SPEC, ST = DATA["spec"], DATA["style"]

L = SPEC["length"]
H = SPEC["height"]
DEPTH = ST["depth"] * H
BODY_Y = H - DEPTH / 2
RY = DEPTH / 2
RX = ST["width"] * H / 2
HUMP = ST.get("hump", 0.0) * H

ROLES = ("coat", "belly", "legs", "head", "ears", "tail", "tailtip", "antlers", "horns")
MATS = [
    role_mat("coat", srgb(ST["coat"])),
    role_mat("belly", srgb(ST["belly"])),
    role_mat("legs", srgb(ST["legs"])),
    role_mat("head", srgb(ST["head"])),
    role_mat("ears", srgb(ST["ears"])),
    role_mat("tail", srgb(ST["tail"])),
    role_mat("tailtip", srgb(ST.get("tailTip", ST["tail"]))),
    role_mat("antlers", srgb(ST.get("antlers", 0x9c8a6e)), rough=0.6),
    role_mat("horns", srgb(ST["horns"]["color"] if ST.get("horns") else 0x141210), rough=0.45),
]


def P(x, up, fwd):
    """A point stated as the game states it — right, up, forward."""
    return Vector((x, -fwd, up))


UP = Vector((0, 0, 1))
RIGHT = Vector((1, 0, 0))
made = []

# ---------------------------------------------------------------- the body
body = Sheet(ROLES, MATS)
SIDES = 10 if GAME else 16
HOOFED = SPEC["prints"]["pattern"] == "pairs"
# A deep, humped body hangs its coat to the snow in a skirt (the musk ox).
SKIRT = ST["depth"] >= 0.7 and HUMP > 0
# Along the spine: forward as a share of L, the section's half-width as a
# share of RX, how much deeper than that (the barrel, the brisket), and the
# centre's rise (m): the rump rounding down, the loins, the withers
# standing over them (the hump where the row has one), the chest.
stations = (
    (-0.52, 0.4, 0.95, -0.03),
    (-0.44, 0.78, 1.08, 0.0),
    (-0.3, 0.98, 1.16, 0.0),
    (-0.08, 1.0, 1.05, -0.01 + HUMP * 0.1),
    (0.14, 0.98, 1.12, 0.02 + HUMP * 0.55),
    (0.3, 0.94, 1.2, 0.03 + HUMP),
    (0.44, 0.72, 1.12, HUMP * 0.55),
    (0.52, 0.42, 0.9, HUMP * 0.25 - 0.05),
)


def barrel(centre, half, deep):
    """A section of the body: an oval, `half` wide and `half * deep` deep,
    its back flatter than its belly — and, on a skirted animal, its lower
    half squared off where the hair hangs."""
    ring = []
    for j in range(SIDES):
        a = 2 * math.pi * j / SIDES
        c, sn = math.cos(a), math.sin(a)
        r = 1.0 if sn > 0 else 1.0 + 0.12 * (-sn)
        z = sn * deep * (0.9 if sn > 0 else 1.0)
        if SKIRT and sn < 0:
            z = -deep * (0.55 + 0.5 * (-sn) ** 0.5)
            r = 1.0 + 0.1 * (-sn)
        ring.append(centre + RIGHT * (half * r * c) + UP * (half * z))
    return ring


rings = [barrel(P(0, BODY_Y + rise, fwd * L), RX * rs, (RY / RX) * deep) for fwd, rs, deep, rise in stations]


def side_of(k, j):
    a = 2 * math.pi * (j + 0.5) / SIDES
    return "coat" if math.sin(a) > -0.4 else "belly"


loft(body, rings, "coat", role_at=side_of, cap_start=True, cap_end=True,
     shade=lambda k, j: 0.9 if math.sin(2 * math.pi * j / SIDES) < -0.5 else 1.0)
made.append(body.object("body"))

# ---------------------------------------------------------------- the legs
LEG_R = ST["leg"] * H * 0.5
HIP_Y = BODY_Y
legs = (("leg_lf", -1, 0.36), ("leg_rf", 1, 0.36), ("leg_lh", -1, -0.38), ("leg_rh", 1, -0.38))
for name, side, zs in legs:
    sh = Sheet(ROLES, MATS)
    hind = zs < 0
    x = side * RX * 0.55
    fwd = zs * L
    # A bounder's hind leg is a haunch folded under it.
    top = LEG_R * ((2.1 if SPEC["gait"] == "bound" else 1.5) if hind else 1.15)
    # The joint half way down: the hock a hair back on a hind leg, the knee
    # a hair forward on a fore leg; the fetlock; the foot square on the
    # snow — a hoof on a hoofed animal, a paw on the rest.
    bend = H * 0.045 * (-1 if hind else 1) * (1 if ST["leg"] < 0.16 else 0.5)
    joint = HIP_Y * 0.5
    pts = [P(x, HIP_Y + top * 0.3, fwd - (0.06 * L if hind else 0)),
           P(x, HIP_Y * 0.78, fwd - bend * 0.3),
           P(x, joint, fwd + bend),
           P(x, HIP_Y * 0.18, fwd + bend * 0.2),
           P(x, 0.07 * H, fwd + 0.01 * H),
           P(x, 0.0, fwd + (0.03 if HOOFED else 0.05) * H)]
    radii = [top * 1.1, top, LEG_R * 0.75, LEG_R * 0.55, LEG_R * (0.6 if HOOFED else 0.7), LEG_R * (0.5 if HOOFED else 0.65)]
    tube(sh, pts, radii, 6 if GAME else 10, "legs", cap=True,
         tone=lambda k: ((0.55 if HOOFED else 0.85) if k >= 5 else 0.9 + 0.1 * (k > 1), 0.0), squash=0.9,
         role_at=lambda k, j: "coat" if k == 0 and not hind else "legs")
    made.append(sh.object(name))

# ---------------------------------------------------------------- the head: the neck, the skull, the ears, the crown's wear
head = Sheet(ROLES, MATS)
PIVOT_UP = BODY_Y + RY * 0.4 + HUMP * 0.5
PIVOT_FWD = L * 0.4
neck_len = ST["neck"] * L
lift = ST["carriage"]
head_base = P(0, PIVOT_UP + neck_len * lift, PIVOT_FWD + neck_len * math.sqrt(max(0.0, 1 - lift * lift)))
chest = P(0, PIVOT_UP - RY * 0.35, PIVOT_FWD - L * 0.06)
NS = 8 if GAME else 12
neck_pts = [chest, chest.lerp(head_base, 0.5) + UP * (RY * 0.06), head_base]
tube(head, neck_pts, [RY * 0.62, RY * 0.5, RY * 0.42], NS, "coat", squash=0.85,
     role_at=lambda k, j: "coat" if math.sin(2 * math.pi * (j + 0.5) / NS) > -0.3 else "belly")

hl = ST["headLength"] * L
hr = RY * 0.52
muzzle = P(0, head_base.z - hl * 0.3, -head_base.y + hl)
HS = 8 if GAME else 12
skull_pts = [head_base - P(0, 0, hr * 0.5), head_base + P(0, hr * 0.15, hr * 0.5),
             head_base.lerp(muzzle, 0.55) + UP * (hr * 0.05), muzzle]
tube(head, skull_pts, [hr * 0.85, hr * 1.0, hr * 0.7, hr * 0.45], HS, "head", cap=True, squash=0.95)
# The eyes, on the sides of the skull; the nose at the muzzle's end.
for side in (-1, 1):
    blob(head, head_base + P(side * hr * 0.8, hr * 0.28, hr * 0.5), hr * 0.13, "ears")
blob(head, muzzle + P(0, hr * 0.12, hr * 0.1), hr * 0.18, "ears")

# The ears: leaf-shaped, up and back off the crown, the tips their own
# colour (a hare's black, a lynx's tufts).
ear_len = ST["ear"] * H
for side in (-1, 1):
    root = head_base + P(side * hr * 0.55, hr * 0.55, hl * 0.08)
    tip = root + P(side * hr * 0.55, ear_len, -ear_len * 0.35)
    mid = root.lerp(tip, 0.5)
    fin(head, root, mid, hr * 0.3, "head", fan=0.9, both=True, up=P(side * 0.4, 0.0, -1))
    fin(head, mid, tip, hr * 0.27, "ears", fan=0.15, both=True, up=P(side * 0.4, 0.0, -1))

# Antlers: a beam up and back off each side of the crown, tines forward.
if ST.get("antlers"):
    beam = H * 0.55
    for side in (-1, 1):
        root = head_base + P(side * hr * 0.5, hr * 0.8, 0)
        bend = root + P(side * beam * 0.45, beam * 0.55, -beam * 0.25)
        top = root + P(side * beam * 0.35, beam, beam * 0.05)
        tube(head, [root, root.lerp(bend, 0.5) + UP * beam * 0.05, bend, top], [hr * 0.14, hr * 0.13, hr * 0.12, hr * 0.04],
             4 if GAME else 6, "antlers", cap=True)
        tube(head, [bend, bend + P(side * beam * 0.1, beam * 0.2, beam * 0.3)], [hr * 0.08, hr * 0.03], 3 if GAME else 5,
             "antlers", cap=True)
        tube(head, [root, root + P(side * hr * 0.1, beam * 0.2, beam * 0.3)], [hr * 0.08, hr * 0.03], 3 if GAME else 5,
             "antlers", cap=True)
        tube(head, [top, top + P(side * beam * 0.12, beam * 0.12, beam * 0.15)], [hr * 0.05, hr * 0.02], 3 if GAME else 5,
             "antlers", cap=True)

# Horns: a musk ox's boss, down the side of the face and up at the tips; a
# chamois's hooks, straight up and crooked back.
if ST.get("horns"):
    form = ST["horns"]["form"]
    for side in (-1, 1):
        root = head_base + P(side * hr * 0.35, hr * 0.75, -hl * 0.02)
        if form == "boss":
            out = root + P(side * hr * 1.0, -hr * 0.2, hl * 0.05)
            down = root + P(side * hr * 1.1, -hr * 1.2, hl * 0.2)
            tip = root + P(side * hr * 1.35, -hr * 0.9, hl * 0.45)
            tube(head, [root, out, down, tip], [hr * 0.32, hr * 0.26, hr * 0.16, hr * 0.03], 6 if GAME else 10,
                 "horns", cap=True)
        else:
            up = root + P(side * hr * 0.05, hr * 1.3, hl * 0.05)
            tip = root + P(side * hr * 0.07, hr * 1.4, -hl * 0.3)
            tube(head, [root, up, tip], [hr * 0.14, hr * 0.1, hr * 0.02], 5 if GAME else 8, "horns", cap=True)
made.append(head.object("head"))

# ---------------------------------------------------------------- the tail
tl = ST["tailLength"] * L
if tl > 0.01:
    tail = Sheet(ROLES, MATS)
    d = ST["droop"]
    root = P(0, BODY_Y + RY * 0.5, -L * 0.5)
    along = math.sqrt(max(0.0, 1 - d * d))
    tip = root + P(0, -tl * d, -tl * along)
    # A brush (a fox's, a squirrel's) is thick and bows; a stub hangs.
    thick = ST.get("tailThick", 0.22)
    bow = UP * (tl * 0.18 * (1 if d < 0 else -0.3)) if ST.get("tailThick") else Vector((0, 0, 0))
    pts = [root, root.lerp(tip, 0.5) + bow, tip]
    r0 = RY * thick * (1.0 if ST.get("tailThick") else 0.7)
    if ST.get("tailTip") is not None:
        end = tip + P(0, -tl * d * 0.25, -tl * along * 0.25)
        tube(tail, pts + [end], [r0 * 0.7, r0, r0 * 0.8, r0 * 0.15], 6 if GAME else 10, "tail", cap=True,
             role_at=lambda k, j: "tailtip" if k >= 2 else "tail")
    else:
        tube(tail, pts, [r0, r0 * (0.9 if ST.get("tailThick") else 0.5), r0 * (0.5 if ST.get("tailThick") else 0.12)],
             6 if GAME else 10, "tail", cap=True)
    made.append(tail.object("tail"))

publish(SPEC["id"], made, OUT,
        extras={"hip": HIP_Y, "pivotUp": PIVOT_UP, "pivotFwd": PIVOT_FWD, "length": L, "height": H, "frame": "static"},
        centre=(0, 0, H * 0.55), size=max(L, H) * 1.3, floor=0.0, samples=SAMPLES, views=("side", "three", "detail"))

# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# A BIRD MODELLED IN BLENDER off the game's own data: the roster's row
# (`pwa/src/game/bird-defs.ts` — the span, the length, how far the bill
# reaches ahead of the shoulders, the wing's plan, the glide's dihedral),
# handed in as one JSON file by `scripts/blender.mjs --kind=bird` — the
# driver, and the only way this runs. Every proportion is the row's, as
# `bird-shapes.ts` reads it; what this adds is the MODELLING: a body with
# a keeled breast and a flat back, tapering to the vent; a neck carrying an
# egg of a head where the row says, with a bill of the head's own measure
# and two eyes; wings that are real sections — an arm with bulk, a cambered
# hand thinning to a blunt tip, the trailing edge bowed over the
# secondaries — and, on a bird that soars (the row's dihedral), the
# primaries splayed into fingers; a fanned tail, wedged on a soarer.
#
# THE FRAME (`static.py`'s): metres, shoulders at the origin, the bill down
# -y (the game's +z), z up, x the bird's right — so the glTF's metres are
# the game's with no turn. The wings lie LEVEL, as the code's bird is
# built: the game flaps and folds them in its shader, hinged at the body's
# midline and at the wrist (`wrist` of the half-span, the row's).
#
# TWO MESHES: `body` (with the neck, the head, the bill and the tail) and
# `wing` (both wings), so `bird-models.ts` knows a wing vertex by the mesh
# it is in. NO COLOUR IN THE FILE: every face is a ROLE — its material's
# name — and the game paints it off `BIRD_STYLES`; a vertex's tone carries
# a SHADE in R. The stills are painted here in the species' own colours.

import json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import GAME
from static import *

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
SPEC, STYLE = DATA["spec"], DATA["style"]

S = SPEC["span"]
L = SPEC["length"]
NECK = SPEC["neck"] * L
BACK = (1 - SPEC["neck"]) * L
R = 0.12 * L
W = SPEC["wing"]
LONG_NECK = SPEC["neck"] > 0.4
BIG_HEAD = SPEC["neck"] < 0.2
# A bird that glides on a V spreads its primaries and carries a wedge of
# a tail — the raven, the eagle.
SOARS = SPEC["dihedral"] >= 0.06 and S >= 1.2

ROLES = ("back", "belly", "tip", "head", "bill", "tail", "tail_under")
MATS = [
    role_mat("back", srgb(STYLE["back"])),
    role_mat("belly", srgb(STYLE["belly"])),
    role_mat("tip", srgb(STYLE["tip"])),
    role_mat("head", srgb(STYLE["head"])),
    role_mat("bill", srgb(STYLE["bill"]), rough=0.4),
    role_mat("tail", srgb(STYLE.get("tail", STYLE["back"]))),
    role_mat("tail_under", srgb(STYLE.get("tail", STYLE["belly"]))),
]


def P(x, up, fwd):
    """A point stated as the game states it — right, up, forward."""
    return Vector((x, -fwd, up))


UP = Vector((0, 0, 1))
RIGHT = Vector((1, 0, 0))

# The head, sized first: an egg, its bill a measure of the head, reaching
# the row's own bill point — so the breast can stop short of it.
head_r = R * 0.62 * (1.3 if BIG_HEAD else 1.0)
bill_len = head_r * (1.1 if BIG_HEAD else 1.35)
# How far ahead of the shoulders the breast reaches: three tenths of the
# length, unless the bill point is nearer (a big-headed bird's head sits
# on its breast).
FRONT = min(0.3 * L, NECK - bill_len * 0.9)

# ---------------------------------------------------------------- the body
body = Sheet(ROLES, MATS)
SIDES = 10 if GAME else 16
# Along the spine: forward of the shoulders (m), the half-width as a share
# of R, the depth over that (the keel), and the section centre's rise.
stations = (
    (-0.7 * BACK, 0.22, 1.0, 0.1),
    (-0.5 * BACK, 0.62, 1.05, 0.06),
    (-0.22 * BACK, 0.92, 1.12, 0.0),
    (0.0, 1.0, 1.18, -0.04),
    (FRONT * 0.47, 0.94, 1.22, -0.12),
    (FRONT * 0.8, 0.7, 1.1, -0.06),
    (FRONT, 0.42, 0.9, 0.12),
)
rings = [ring_at(P(0, up * R, fwd), RIGHT, UP, R * rs, SIDES, deep) for fwd, rs, deep, up in stations]


def over(k, j):
    a = 2 * math.pi * (j + 0.5) / SIDES
    return "back" if math.sin(a) > -0.2 else "belly"


loft(body, rings, "back", role_at=over, cap_start=True, cap_end=True,
     shade=lambda k, j: 0.96 if math.sin(2 * math.pi * j / SIDES) < -0.3 else 1.0)

# The head: an egg, its crown a little behind its middle.
head_c = P(0, 0.5 * R, NECK - bill_len - head_r * 0.55)
HS = 8 if GAME else 12
skull = (
    (-head_r * 1.0, 0.42, -0.02),
    (-head_r * 0.55, 0.92, 0.04),
    (0.0, 1.0, 0.04),
    (head_r * 0.5, 0.82, -0.02),
    (head_r * 0.85, 0.45, -0.12),
)
head_rings = [ring_at(head_c + P(0, up * head_r, fwd), RIGHT, UP, head_r * rs, HS, 0.95 if BIG_HEAD else 1.05)
              for fwd, rs, up in skull]
loft(body, head_rings, "head", cap_start=True, cap_end=True)
# The eyes, set high on the sides of the skull.
for side in (-1, 1):
    blob(body, head_c + P(side * head_r * 0.78, head_r * 0.25, head_r * 0.2), head_r * 0.13, "bill")

# The neck, out of the throat to the nape; a long neck is thinner than a
# short one and carried a little higher before it comes down.
nape = head_c - P(0, 0.02 * head_r, head_r * 0.8)
throat = P(0, 0.12 * R, FRONT * 0.8)
nr = R * (0.32 if LONG_NECK else 0.46)
neck_pts = [throat, throat.lerp(nape, 0.45) + UP * (R * (0.3 if LONG_NECK else 0.06)), nape]
NS = 7 if GAME else 10
tube(body, neck_pts, [nr * 1.25, nr, nr * 0.9], NS, "back", squash=0.95,
     role_at=lambda k, j: "back" if math.sin(2 * math.pi * (j + 0.5) / NS) > -0.25 else "belly")

# The bill: a cone off the face, a flat one on a waterfowl, drooping a
# hair to its point.
bill_root = head_c + P(0, -0.08 * head_r, head_r * 0.75)
bill_tip = P(0, 0.5 * R - 0.22 * head_r, NECK)
flat = 0.62 if LONG_NECK else 0.95
tube(body, [bill_root, bill_root.lerp(bill_tip, 0.5) + UP * (0.03 * head_r), bill_tip],
     [head_r * 0.46, head_r * 0.3, head_r * 0.05], 6 if GAME else 8, "bill", cap=True, squash=flat)

# The tail: a fan of feathers out of the rump, its end scalloped, the outer
# feathers shorter — a wedge on a soarer, a round on the rest.
ROOT_FWD = -0.48 * BACK
tw = S * 0.07
FEATHERS = 6
for role, lift, wind in (("tail", 0.0015, 1), ("tail_under", -0.0015, -1)):
    cols = []
    for j in range(FEATHERS + 1):
        u = j / FEATHERS - 0.5
        rim = 1 - (0.28 if SOARS else 0.12) * abs(u * 2) ** (1.4 if SOARS else 2) - (0.03 if j % 2 else 0.0)
        cols.append((body.v(P(u * 0.5 * R, lift + 0.02 * R, ROOT_FWD), 1.0),
                     body.v(P(u * 2 * tw, lift - 0.06 * R, ROOT_FWD - (BACK + ROOT_FWD) * rim), 1.0)))
    for j in range(FEATHERS):
        a, b = cols[j], cols[j + 1]
        quad = (a[0], b[0], b[1], a[1])
        body.f(quad if wind < 0 else tuple(reversed(quad)), role)

# ---------------------------------------------------------------- the wings
wing = Sheet(ROLES, MATS)
HALF = S / 2
C0 = S * W["chord"]
TIP_FROM = 0.78
HAND = 0.8 if SOARS else 1.0


def edges(s):
    """The leading edge and the chord at a share `s` of the half-span: the
    row's plan, the trailing edge bowed out over the secondaries, the tip
    rounded off."""
    chord = C0 * (1 - (1 - W["taper"]) * s)
    chord *= 1 + 0.2 * math.sin(math.pi * min(1.0, s / 0.75)) * (1 - s)
    chord *= 1 - 0.8 * smoothstep(0.82, 1.0, s) ** 1.6
    lead = C0 * 0.45 - W["sweep"] * HALF * s ** 1.5 - C0 * 0.25 * smoothstep(0.85, 1.0, s) ** 2
    return lead, chord


def section(s, side):
    """The wing's section at a share `s` of the half-span: a closed ring —
    the leading edge, over the top, the trailing edge, back under — an
    arm's bulk at the root thinning to a sheet at the hand, cambered."""
    lead, chord = edges(s)
    t = chord * (0.13 * (1 - s) ** 1.8 + 0.014)
    camber = chord * 0.04 * (1 - s)
    x = side * s * HALF
    pts = (
        (lead, camber * 0.2),
        (lead - 0.28 * chord, t * 0.5 + camber),
        (lead - 0.66 * chord, t * 0.26 + camber * 0.75),
        (lead - chord, camber * 0.15),
        (lead - 0.66 * chord, -t * 0.2 + camber * 0.75),
        (lead - 0.28 * chord, -t * 0.4 + camber),
    )
    ring = [P(x, up, fwd) for fwd, up in pts]
    return ring if side > 0 else list(reversed(ring))


STATIONS = sorted({0.02, 0.2, W["wrist"], 0.62, 0.8, 0.9, 0.96, 1.0} if not SOARS else {0.02, 0.2, W["wrist"], 0.62, HAND})
for side in (1, -1):
    rings = [section(s, side) for s in STATIONS]

    def paint(k, j, side=side):
        if STATIONS[k + 1] > TIP_FROM + 1e-6:
            return "tip"
        jj = j if side > 0 else (5 - j) % 6
        return "back" if jj < 3 else "belly"

    loft(wing, rings, "back", role_at=paint, cap_start=True, cap_end=not SOARS,
         shade=lambda k, j, side=side: 1.0 if (j if side > 0 else (5 - j) % 6) < 3 else 0.97)
    if SOARS:
        # The primaries: five feathers fanned off the hand's end, the
        # outer ones swept back, each a blade with both faces.
        lead, chord = edges(HAND)
        n = 5
        for k in range(n):
            u = (k + 0.5) / n
            root = P(side * HAND * HALF, 0.0, lead - chord * u)
            reach = (1 - HAND) * HALF * (1.05 - 0.5 * u)
            tip = root + P(side * reach, -0.012 * HALF * u, -0.55 * HALF * (1 - HAND) * u ** 1.2)
            fin(wing, root, tip, chord / n * 0.62, "tip", fan=0.45, both=True,
                shade=(1.0, 0.95), up=UP)

made = [body.object("body"), wing.object("wing")]
publish(SPEC["id"], made, OUT, extras={"span": S, "length": L, "frame": "static"},
        centre=(0, 0.05 * L, 0), size=max(S, L * 1.4) * 0.9, floor=-max(S, L) * 3, samples=SAMPLES,
        views=("three", "under", "side"))

# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE COURSE'S MARKS MODELLED IN BLENDER off the game's own data (`GATE`
# and `ARCH` in `pwa/src/game/start-arch.ts`), handed in as one JSON file
# by `scripts/blender.mjs --kind=gate` — the driver, and the only way this
# runs. Two assets:
#
#   checkpoint   the banded stake a course crew plants (an octagonal pole
#                with a spike in the snow and a cap, its bands round it),
#                the pennant hung off its top, rippling as it streams, and
#                the MARKER that stands over the owed gate — a faceted
#                diamond. Three meshes, `pole`, `flag` and `marker`, each
#                where the game instances the code's own: the pole's foot
#                at the origin, the pennant's halyard corner at the origin
#                streaming along +x, the marker about its centre.
#   start-arch   the inflatable over the line: one fat sewn tube up a leg,
#                round the shoulder, across and down, in the organiser's
#                red with white piping, its panels scalloped as a blown-up
#                fabric is; at each foot the ballast skirt, its sandbags
#                and the blower with its hose. ONE mesh, `arch`, made at
#                `ARCH.modelReach` across with its feet on level ground
#                (z = 0 the ground, the tube's top at `ARCH.top`);
#                `gate-models.ts` stretches the straight span to the
#                line's own reach and each leg down to its own foot.
#
# THE FRAME (`static.py`'s): metres, x the rider's right across the track,
# -y along it (the game's +z), z up. NO COLOUR IN THE FILE: every face is a
# ROLE the game paints (`red`, `white`, `flag`, `marker`, `fabric`,
# `dark`); the tone's R is a SHADE.

import json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import GAME
from static import *

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
ID, ARCH, GATE = DATA["id"], DATA["arch"], DATA["gate"]
RED = srgb(int(DATA["flag"].lstrip("#"), 16))

ROLES = ("red", "white", "flag", "marker", "fabric", "dark")
MATS = [
    role_mat("red", RED, rough=0.6),
    role_mat("white", (0.9, 0.92, 0.94), rough=0.6),
    role_mat("flag", (0.85, 0.15, 0.1), rough=0.8),
    role_mat("marker", RED, rough=0.5),
    role_mat("fabric", RED, rough=0.45),
    role_mat("dark", (0.02, 0.022, 0.026), rough=0.8),
]
UP = Vector((0, 0, 1))
RIGHT = Vector((1, 0, 0))
ALONG = Vector((0, -1, 0))
made = []

if ID == "checkpoint":
    # ---------------------------------------------------------------- the stake
    pole = Sheet(ROLES, MATS)
    H = GATE["pole"]
    BANDS = GATE["bands"]
    S8 = 8
    band = H / BANDS
    zs = [-0.28, -0.05] + [band * k for k in range(BANDS + 1)]
    radii = [0.005, 0.05] + [0.055 - 0.01 * z / H for z in zs[2:]]
    pts = [Vector((0, 0, z)) for z in zs]
    # The bands: the top one red, as a course crew paints them.
    def band_of(k, j):
        if k < 1:
            return "dark"
        i = k - 2
        return "red" if (BANDS - 1 - i) % 2 == 0 else "white"
    tube(pole, pts, radii, S8, "red", role_at=band_of, tone=lambda k: (0.85 if k < 2 else 1.0, 0.0))
    # The cap: a shallow dome over the top.
    cap = ring_at(Vector((0, 0, H + 0.02)), RIGHT, Vector((0, 1, 0)), 0.035, S8)
    top = pole.v((0, 0, H + 0.045), 1.0)
    rim = [pole.v(p, 1.0) for p in ring_at(Vector((0, 0, H)), RIGHT, Vector((0, 1, 0)), 0.045, S8)]
    capi = [pole.v(p, 1.0) for p in cap]
    for j in range(S8):
        k = (j + 1) % S8
        pole.f((rim[j], rim[k], capi[k], capi[j]), "dark")
        pole.f((capi[j], capi[k], top), "dark")
    made.append(pole.object("pole"))

    # ---------------------------------------------------------------- the pennant
    flag = Sheet(ROLES, MATS)
    REACH, DROP = GATE["pennant"]["reach"], GATE["pennant"]["drop"]
    COLS = 5 if GAME else 9
    ROWS = 3
    grid = []
    for c in range(COLS + 1):
        u = c / COLS
        # The ripple grows with the distance from the halyard, in the
        # plane across the pennant.
        wave = math.sin(u * 2 * math.pi * 1.25) * 0.045 * u
        col = []
        # The pennant tapers from its hoist to its point.
        for r in range(ROWS + 1):
            v = r / ROWS
            z = -v * DROP * (1 - u) - u * DROP * 0.5
            col.append(flag.v((u * REACH, wave, z), 0.9 + 0.1 * u))
        grid.append(col)
    for c in range(COLS):
        for r in range(ROWS):
            if c == COLS - 1 and r != 1:
                continue
            a, b = grid[c], grid[c + 1]
            flag.f((a[r], a[r + 1], b[r + 1], b[r]), "flag")
    # The point: the last column's rows meet at the fly.
    a, b = grid[COLS - 1], grid[COLS]
    flag.f((a[0], a[1], b[1]), "flag")
    flag.f((a[2], a[3], b[2]), "flag")
    made.append(flag.object("flag"))

    # ---------------------------------------------------------------- the marker
    marker = Sheet(ROLES, MATS)
    W, MH = GATE["marker"]["width"] / 2, GATE["marker"]["height"]
    low = marker.v((0, 0, -MH / 2), 1.0)
    high = marker.v((0, 0, MH / 2), 1.0)
    waist = [marker.v(p, 1.0) for p in ring_at(Vector((0, 0, MH * 0.08)), RIGHT, Vector((0, 1, 0)), W, 4, phase=math.pi / 4)]
    crown = [marker.v(p, 1.0) for p in ring_at(Vector((0, 0, MH * 0.32)), RIGHT, Vector((0, 1, 0)), W * 0.45, 4, phase=math.pi / 4)]
    for j in range(4):
        k = (j + 1) % 4
        marker.f((waist[k], waist[j], low), "marker")
        marker.f((waist[j], waist[k], crown[k], crown[j]), "marker")
        marker.f((crown[j], crown[k], high), "marker")
    made.append(marker.object("marker", smooth=False))
    def stage():
        """For the stills: the pennant hung off the pole's top and the
        marker over it, where the game instances them."""
        made[1].location = (0, 0, H - 0.05)
        made[2].location = (0, 0, H + 1.3)

    publish(ID, made, OUT, extras={"pole": H, "frame": "static"}, centre=(0.3, 0, H * 0.6), size=H * 2.1,
            floor=0.0, samples=SAMPLES, views=("three", "detail"), stage=stage)

else:
    # ---------------------------------------------------------------- the arch
    arch = Sheet(ROLES, MATS)
    R = ARCH["modelReach"]
    T = ARCH["tube"]
    TOP = ARCH["top"]
    C = ARCH["corner"]
    SINK = ARCH["sink"]
    # The path: up the left leg, round the shoulder, across, round, down.
    def path_point(s):
        """A point along the path by arc length `s`, and its tangent."""
        leg = TOP - C + SINK
        arc = math.pi / 2 * C
        span = 2 * (R - C)
        if s < leg:
            return Vector((-R, 0, -SINK + s)), Vector((0, 0, 1))
        s -= leg
        if s < arc:
            a = s / C
            return (Vector((-R + C - C * math.cos(a), 0, TOP - C + C * math.sin(a))),
                    Vector((math.sin(a), 0, math.cos(a))))
        s -= arc
        if s < span:
            return Vector((-(R - C) + s, 0, TOP)), Vector((1, 0, 0))
        s -= span
        if s < arc:
            a = s / C
            return (Vector((R - C + C * math.sin(a), 0, TOP - C + C * math.cos(a))),
                    Vector((math.cos(a), 0, -math.sin(a))))
        s -= arc
        return Vector((R, 0, TOP - C - s)), Vector((0, 0, -1))

    total = 2 * (TOP - C + SINK) + math.pi * C + 2 * (R - C)
    step = 0.22 if GAME else 0.1
    SIDES = 12 if GAME else 24
    PANEL = 1.5
    PIPE = 0.05
    # The stations along the path: a regular step, and at every seam a
    # close pair either side of the piping so the white is one narrow ring.
    seams = [k * PANEL for k in range(1, int(total / PANEL) + 1)]
    ss = sorted({total * k / int(total / step) for k in range(int(total / step) + 1)}
                | {x - PIPE for x in seams} | {x + PIPE for x in seams})
    fixed = []
    piping = []
    prev = None
    for s_ in ss:
        p, d = path_point(s_)
        u, w = frame(d)
        if prev is not None:
            dn = d.normalized()
            u = (prev - dn * prev.dot(dn)).normalized()
            w = dn.cross(u)
        prev = u
        # The panels: a blown-up tube swells between its seams.
        r = T * (1 - 0.04 * (0.5 + 0.5 * math.cos(s_ / PANEL * 2 * math.pi)))
        fixed.append(ring_at(p, u, w, r, SIDES))
        piping.append(any(abs(s_ - x) <= PIPE + 1e-6 for x in seams))
    piping = [piping[k] and piping[k + 1] for k in range(len(fixed) - 1)] + [False]
    loft(arch, fixed, "fabric", cap_start=True, cap_end=True,
         role_at=lambda k, j: "white" if piping[k] else "fabric",
         shade=lambda k, j: 1.0)

    # At each foot: the ballast skirt, its sandbags, and the blower with
    # the hose that feeds the leg.
    for side in (-1, 1):
        fx = side * R
        skirt = [ring_at(Vector((fx, 0, z)), RIGHT, Vector((0, 1, 0)), r, SIDES)
                 for z, r in ((-0.2, T * 1.35), (0.25, T * 1.28), (0.6, T * 1.22), (0.66, T * 1.05))]
        loft(arch, skirt, "dark", cap_start=True, cap_end=True, shade=lambda k, j: 0.8 + 0.06 * k)
        for a in (0.3, 1.4, 2.5, 3.7, 4.9):
            bx, by = fx + math.cos(a) * T * 1.55, math.sin(a) * T * 1.55
            bag = [ring_at(Vector((bx, by, z)), Vector((math.cos(a), math.sin(a), 0)), Vector((-math.sin(a), math.cos(a), 0)),
                           r, 6, 1.6) for z, r in ((-0.15, 0.16), (0.05, 0.2), (0.22, 0.12))]
            loft(arch, bag, "dark", cap_start=True, cap_end=True, shade=lambda k, j: 0.9)
        bx = fx + side * 1.3
        box = [ring_at(Vector((bx, 0, z)), RIGHT, Vector((0, 1, 0)), r, 4, 1.25, phase=math.pi / 4)
               for z, r in ((-0.05, 0.3), (0.32, 0.3), (0.36, 0.26))]
        loft(arch, box, "dark", cap_start=True, cap_end=True, shade=lambda k, j: 0.85)
        hose = [Vector((bx, 0, 0.3)), Vector((bx - side * 0.45, 0, 0.42)), Vector((fx + side * T * 0.9, 0, 0.55))]
        tube(arch, hose, [0.07, 0.07, 0.07], 6 if GAME else 10, "dark", tone=lambda k: (0.75, 0.0))
    made.append(arch.object("arch"))
    publish(ID, made, OUT,
            extras={"reach": R, "top": TOP, "corner": C, "sink": SINK, "foot": 1.0, "frame": "static"},
            centre=(0, 0, TOP * 0.5), size=2 * R * 1.05, floor=0.0, samples=SAMPLES, views=("side", "three", "detail"))

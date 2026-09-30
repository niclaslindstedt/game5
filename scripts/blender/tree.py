# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE TREES MODELLED IN BLENDER: one KIND's ten variants, off the very rows
# the code's builder reads (`pwa/src/game/tree-variants.ts`, handed in as
# one JSON file by `scripts/blender.mjs --kind=tree` — the driver, and the
# only way this runs). Every number that makes a variant the variant it is
# (its tiers and boughs, its pads, its whorls, its sprays; its lean, its
# flag, its broken top) is the row's; what this adds is the MODELLING: a
# conifer's boughs as real drooping limbs with the snow lying along their
# tops over a dark core, a pine's needle pads as lobed cushions on branches
# off a flared stem, a larch's arms with their hanging twigs, a broadleaf's
# limbs forking into fans of twigs, the berries, the kept leaves.
#
# THE FRAME. Metres, at the REFERENCE tree (`TREE_REFERENCE`: its height
# and crown radius): Blender x across (the side a flagged tree's boughs
# grow on and a leaning one leans to, as the code's +x), y across, z up from
# the foot. glTF turns z up to y up; `tree-models.ts` divides the crown back
# out of x and z and the height out of y, into the unit frame the forest
# instances and scales every tree in. The root carries both as extras.
#
# EACH VARIANT IS TWO MESHES: `v<i>` (the full band's tree) and `v<i>_far`
# (the far band's hand-built sketch — the same tree at a tenth of the
# triangles, never a decimation). One glTF a kind, all twenty meshes in it.
#
# DRESSED BY THE GAME. A model carries no colour of its own: every face is
# one ROLE (its material's name — `needle`, `snow`, `bark`, `twig`,
# `accent`, `mark`) and every vertex three numbers in its colour attribute:
#   R  its SHADE, 0..1 — the dark inside a crown, the foot of a trunk
#   G  how far it goes from the role's first colour to its second — the
#      needles to the kind's dark, the snow to its shade, the bark to the
#      upper stem's, a twig to the bark it grows out of
#   B  (snow) the LOAD it needs: the region's `load` must reach it for the
#      piece to be drawn, so a thin-snowed country carries less
# `tree-models.ts` turns that into the region's colours as `tree-shapes.ts`
# paints its own. The needles and the snow carry VOLUME normals (out of the
# crown and up), so a crown is lit as a mass, as the code's are.

import json, math, os, random, sys
# WINDING: Blender's frame is z up, so a ring laid round by (cos a, sin a)
# in x and y runs ANTICLOCKWISE seen from above — the mirror of the code's
# builder, which lays it in x and z under y up. Every face here is wound
# for Blender's frame: a top faces up (the game culls the back).

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import *
from static import frame, norm, smoothstep

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
KIND = DATA["kind"]
H = DATA["reference"]["height"]
C = DATA["reference"]["crown"]
PAINT = DATA["paint"]

ROLES = ("needle", "snow", "bark", "twig", "accent", "mark")

# ---------------------------------------------------------------- materials
# The stills are painted with the kind's boreal colours through the same
# arithmetic the game dresses a model with; the glTF gets neutral
# materials, as the game reads only their names.
def role_mat(name, first, second, rough=0.9):
    m = mat(name, tuple(first) if not GAME else (0.5, 0.5, 0.5), rough=rough)
    if GAME:
        return m
    nt = m.node_tree
    p = nt.nodes.get("Principled BSDF")
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "tone"
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(attr.outputs["Color"], sep.inputs[0])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = (*first, 1)
    mix.inputs[7].default_value = (*second, 1)
    nt.links.new(sep.outputs[1], mix.inputs[0])
    shade = nt.nodes.new("ShaderNodeMix")
    shade.data_type = "RGBA"
    shade.blend_type = "MULTIPLY"
    shade.inputs[0].default_value = 1.0
    nt.links.new(mix.outputs[2], shade.inputs[6])
    nt.links.new(sep.outputs[0], shade.inputs[7])
    nt.links.new(shade.outputs[2], p.inputs["Base Color"])
    return m

P_ = PAINT
MATS = [
    role_mat("needle", P_["needle"], P_["dark"]),
    role_mat("snow", P_["snow"], P_["snowShade"], rough=0.6),
    role_mat("bark", P_["bark"], P_["upper"]),
    role_mat("twig", P_["twigs"], P_["bark"]),
    role_mat("accent", P_["accent"], P_["accent"], rough=0.5),
    role_mat("mark", P_["marks"], P_["marks"]),
]

# ---------------------------------------------------------------- the MESH being built
class Tree:
    """A mesh under construction: every vertex with its tone (shade, blend,
    load) and — for foliage and snow — its own normal; every face its role.
    The variant's LEAN shears every point over by its height, as the code's
    `Shape` does in the unit frame."""

    def __init__(self, lean):
        self.lean = lean
        self.co, self.tone, self.nrm, self.faces, self.roles = [], [], [], [], []

    def v(self, p, shade=1.0, blend=0.0, load=0.0, n=None):
        x, y, z = p
        self.co.append((x + z / H * self.lean * 4 * C, y, z))
        self.tone.append((max(0.0, min(1.0, shade)), max(0.0, min(1.0, blend)), max(0.0, min(1.0, load))))
        self.nrm.append(n)
        return len(self.co) - 1

    def f(self, idx, role):
        self.faces.append(tuple(idx))
        self.roles.append(ROLES.index(role))

    def object(self, name):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.co, [], self.faces)
        me.validate(clean_customdata=False)
        for m in MATS:
            me.materials.append(m)
        me.polygons.foreach_set("material_index", self.roles)
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
        tone = me.color_attributes.new("tone", "FLOAT_COLOR", "POINT")
        for i, (r, g, b) in enumerate(self.tone):
            tone.data[i].color = (r, g, b, 1.0)
        me.color_attributes.active_color = tone
        me.color_attributes.render_color_index = 0
        me.update()
        # A vertex with no normal of its own takes the surface's.
        smooth = [tuple(v.normal) for v in me.vertices]
        me.normals_split_custom_set_from_vertices(
            [n if n is not None else smooth[i] for i, n in enumerate(self.nrm)])
        ob = bpy.data.objects.new(name, me)
        COL.objects.link(ob)
        return ob

def tube(t, pts, radii, sides, role, tone=lambda k: (1.0, 0.0), cap=False, mark=None):
    """A tapering tube through `pts` (Vectors), `radii` at each; `tone(k)`
    the shade and blend of ring k; `mark(k, j)` true for a face in the
    `mark` role (a birch's dark lenticels)."""
    rings = []
    prev_u = None
    for k, p in enumerate(pts):
        d = (pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)])
        u, w = frame(d)
        if prev_u is not None:
            # Parallel transport: keep the seam from twisting.
            u = (prev_u - d.normalized() * prev_u.dot(d.normalized())).normalized()
            w = d.normalized().cross(u)
        prev_u = u
        s, b = tone(k)
        ring = []
        for j in range(sides):
            a = 2 * math.pi * j / sides
            off = u * math.cos(a) + w * math.sin(a)
            ring.append(t.v(p + off * radii[k], s, b))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for j in range(sides):
            j1 = (j + 1) % sides
            r = "mark" if mark and mark(k, j) else role
            t.f((rings[k][j], rings[k][j1], rings[k + 1][j1], rings[k + 1][j]), r)
    if cap:
        s, b = tone(len(pts) - 1)
        c = t.v(pts[-1] + (pts[-1] - pts[-2]).normalized() * radii[-1] * 0.5, s, b)
        for j in range(sides):
            t.f((rings[-1][j], rings[-1][(j + 1) % sides], c), role)

def fin(t, root, tip, w, role, shade=(0.8, 1.0), blend=(0.0, 0.0), fan=0.4, load=0.0, up=(0, 0, 1)):
    """A thin blade from `root` to `tip`, `w` wide at the root and `fan` of
    that at the tip (over one a spray of twigs fanning out), with BOTH
    faces — its own vertices each, so a twig reads from either side."""
    root, tip = Vector(root), Vector(tip)
    d = tip - root
    s = Vector((-d.y, d.x, 0))
    if s.length < 1e-6:
        s = Vector((1, 0, 0))
    s = s.normalized() * w
    quad = (root + s, tip + s * fan, tip - s * fan, root - s)
    tones = ((shade[0], blend[0]), (shade[1], blend[1]), (shade[1], blend[1]), (shade[0], blend[0]))
    # A twig is lit all round: both faces lean out along it and a little
    # up, never down, or a crown seen from under it goes black.
    out = Vector((d.x, d.y, 0)).normalized() if d.xy.length > 1e-6 else Vector((0, 0, 0))
    n = norm((out.x * 0.6, out.y * 0.6, 0.8))
    top = [t.v(q, a, b, load, n) for q, (a, b) in zip(quad, tones)]
    t.f(tuple(reversed(top)), role)
    nb = norm((out.x * 0.8, out.y * 0.8, 0.25))
    under = [t.v(q, a * 0.9, b, load, nb) for q, (a, b) in zip(quad, tones)]
    t.f(under, role)

def blob(t, at, r, role, blend=0.0, load=0.0):
    """A little octahedron: a berry cluster, a cone."""
    at = Vector(at)
    ps = [at + Vector(o) * r for o in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))]
    ix = [t.v(p, 0.8 + 0.2 * (p.z > at.z), blend, load, norm(tuple(p - at))) for p in ps]
    for a, b in ((0, 2), (2, 1), (1, 3), (3, 0)):
        t.f((ix[a], ix[b], ix[4]), role)
        t.f((ix[b], ix[a], ix[5]), role)

def trunk_points(z0, z1, n, at=lambda z: (0.0, 0.0)):
    return [Vector((*at(z0 + (z1 - z0) * k / n), z0 + (z1 - z0) * k / n)) for k in range(n + 1)]

def flare(r, z):
    """A stem's radius at height z over the snow: a root flare at its foot."""
    return r * (1 + 0.5 * math.exp(-z / 0.35))

# ---------------------------------------------------------------- a CONIFER
# The most boughs a conifer's whorls share (about 26 triangles each).
BOUGHS = 48

def tiers_of(count, base, top, taper):
    """The code's tiers (`tree-shapes.ts`): bottoms up the crown, tops
    overlapping the next, radii narrowing by `taper` (units of the crown)."""
    out, span = [], top - base
    for i in range(count):
        u = i / count
        bottom = base + span * u * 0.92
        out.append(dict(bottom=bottom, top=min(top, bottom + span * (1.9 / count)),
                        radius=(1 - u * 0.95) ** taper * (1 - 0.08 * u)))
    return out

def conifer(v, f, far, rng):
    t = Tree(v["lean"])
    base, top = v["base"] * H, v["top"] * H
    snow = f["snow"]

    def nod(z):
        return f["nod"] * C * max(0.0, (z - base) / max(1e-6, top - base)) ** 3

    count = 3 if far else f["tiers"]
    tiers = tiers_of(count, v["base"], v["top"], f["taper"] if far else v["taper"])
    for i, tr in enumerate(tiers):
        u = i / count
        r = tr["radius"] * v["width"]
        if i == 0:
            r *= 1 + f["skirt"]
        if f["flat"] > 0 and u > 0.55:
            r = max(r, f["flat"] * 0.55 * v["width"])
        r *= 1 + f["club"] * 1.4 * smoothstep(0.62, 0.9, u)
        tr.update(radius=r * C, bottom=tr["bottom"] * H, top=tr["top"] * H)
    widest = max(tr["radius"] for tr in tiers) or 1.0

    # The stem, up through the crown to the leader, following the nod.
    r0 = 0.045 * C
    pts = trunk_points(-0.3, top, 3 if far else 7, lambda z: (nod(z), 0.0))
    tube(t, pts, [flare(r0, p.z) * max(0.08, 1 - p.z / (top * 1.05)) for p in pts], 3 if far else 6,
         "bark", lambda k: (0.7 + 0.3 * k / (len(pts) - 1), k / (len(pts) - 1)), cap=True)

    if far:
        # THE SKETCH: three skirts, as the code draws its far band.
        for i, tr in enumerate(tiers):
            ox = nod(tr["bottom"])
            sides = 5
            apex = t.v((nod(tr["top"]), 0, tr["top"]), 1.0, 0.1, 0.0, (0, 0, 1))
            rim, mid = [], []
            for k in range(sides):
                a = 2 * math.pi * k / sides + i * 0.9
                rr = tr["radius"] * (1 + f["flag"] * math.cos(a) * 0.9 - f["flag"] * 0.25)
                droop = (tr["top"] - tr["bottom"]) * 0.18 * f["droop"]
                c, s = math.cos(a), math.sin(a)
                rim.append((ox + c * rr, s * rr, tr["bottom"] - droop, c, s))
                mid.append((ox + c * rr * 0.55, s * rr * 0.55, (tr["bottom"] + tr["top"]) / 2, c, s))
            for k in range(sides):
                j = (k + 1) % sides
                m1 = [t.v(p[:3], 1.0, 0.2, 0.0, norm((p[3] * 0.65, p[4] * 0.65, 0.9))) for p in (mid[k], mid[j])]
                t.f((apex, m1[0], m1[1]), "snow")
                a1 = [t.v(p[:3], 0.9, 0.0, 0.0, norm((p[3] * 0.65, p[4] * 0.65, 0.6))) for p in (mid[k], mid[j])]
                b1 = [t.v(p[:3], 0.8, (k % 2) * 0.8, 0.0, norm((p[3] * 0.65, p[4] * 0.65, 0.25))) for p in (rim[k], rim[j])]
                t.f((a1[0], b1[0], b1[1], a1[1]), "needle")
                u0 = t.v((ox, 0, tr["bottom"] + (tr["top"] - tr["bottom"]) * 0.15), 0.5, 1.0, 0.0, (0, 0, -1))
                ub = [t.v(p[:3], 0.6, 1.0, 0.0, norm((p[3] * 0.65, p[4] * 0.65, -0.1))) for p in (rim[k], rim[j])]
                t.f((u0, ub[1], ub[0]), "needle")
        return t

    # THE CORE: a dark cone of needles inside the crown, so a wood reads as
    # woods between the boughs rather than as a lattice of them.
    core_n = 6
    rings = []
    for k, tr in enumerate(tiers):
        z = tr["bottom"]
        rr = tr["radius"] * 0.42 * (0.0 if k in f["missing"] else 1.0) + 0.05
        ring = []
        for j in range(core_n):
            a = 2 * math.pi * j / core_n + k
            c, s = math.cos(a), math.sin(a)
            ring.append(t.v((nod(z) + c * rr, s * rr, z), 0.45, 1.0, 0.0, norm((c, s, 0.2))))
        rings.append(ring)
    tip = t.v((nod(top), 0, top), 0.6, 0.8, 0.0, (0, 0, 1))
    for k in range(len(rings) - 1):
        for j in range(core_n):
            j1 = (j + 1) % core_n
            t.f((rings[k][j], rings[k][j1], rings[k + 1][j1], rings[k + 1][j]), "needle")
    for j in range(core_n):
        t.f((rings[-1][j], rings[-1][(j + 1) % core_n], tip), "needle")

    # THE BOUGHS: every tier a whorl of drooping limbs, flattened and
    # ridged, the snow lying along the inner part of each and — where the
    # load reaches it — out towards the tip.
    # THE BUDGET: a tall many-tiered crown (a black spruce's, a juniper's)
    # shares out BOUGHS boughs rather than growing past them — its upper
    # whorls are small, and a few boughs fewer there is not seen.
    want = [0 if ti in f["missing"] else max(4, round(f["sides"] * (0.45 + 0.55 * tr["radius"] / widest)))
            for ti, tr in enumerate(tiers)]
    share = min(1.0, BOUGHS / max(1, sum(want)))
    for ti, tr in enumerate(tiers):
        if ti in f["missing"]:
            continue
        n = max(3, round(want[ti] * share))
        twist = ti * 0.9 + rng.random() * 0.5
        span = tr["top"] - tr["bottom"]
        for k in range(n):
            a = 2 * math.pi * (k + (rng.random() - 0.5) * 0.5) / n + twist
            jag = 1.0 if k % 2 == 0 else 0.78 + rng.random() * 0.12
            lee = 1 + f["flag"] * math.cos(a) * 0.9 - f["flag"] * 0.25
            ragged = 1 + f["rough"] * (rng.random() - 0.5) * 0.9
            L = tr["radius"] * jag * (0.9 + rng.random() * 0.2) * max(0.15, lee) * ragged
            if L < 0.12:
                continue
            droop = span * (0.12 + 0.1 * rng.random()) * jag * f["droop"]
            bough(t, a, L, tr["bottom"] + span * 0.78, tr["bottom"] - droop, nod, math.pi * L / n,
                  f, snow, rng)

    if f["twin"]:
        # A second leader off the top whorl, a little lower and to one side.
        z0 = base + (top - base) * 0.72
        off = 0.2 * max(0.5, v["width"]) * C
        for tr in tiers_of(3, z0 / H, v["top"] * 0.95, 1.2):
            rr = tr["radius"] * 0.35 * v["width"] * C
            for k in range(4):
                a = 2 * math.pi * k / 4 + rng.random()
                bough(t, a, rr, tr["top"] * H, tr["bottom"] * H, lambda z: off, math.pi * rr / 4 * 1.3,
                      f, snow, rng, root=0.02)
        tube(t, [Vector((0, 0, z0)), Vector((off, 0, v["top"] * 0.95 * H))], [0.05, 0.01], 4, "bark",
             lambda k: (0.8, 1.0))
    if f["spire"] > 0:
        # The dead spire a broken top leaves: bare wood over the last whorl.
        tube(t, [Vector((nod(top), 0, top - 0.3)), Vector((nod(top) + 0.03 * C, 0, top + f["spire"] * H))],
             [0.05, 0.01], 4, "bark", lambda k: (0.8, 1.0))
    return t

def bough(t, a, L, z0, z1, nod, hw, f, snow, rng, root=0.06):
    """One drooping limb of a whorl: out along azimuth `a`, `L` long, from
    `z0` at the stem to `z1` at the tip, `hw` wide a side at its widest —
    lofted ridged across its top and flat under, its tip pointed."""
    c, s = math.cos(a), math.sin(a)
    d = Vector((c, s, 0))
    side = Vector((-s, c, 0))
    hw = min(hw * 1.2, L * 0.55)
    sag = 1.2 + 0.4 * f["droop"]
    thick = 0.05 + 0.05 * L
    stations = (0.06, 0.42, 0.76)
    def at(u):
        z = z0 + (z1 - z0) * u ** sag
        return Vector((nod(z) + c * (root + L * u), s * (root + L * u), z))
    def width(u):
        return hw * (0.3 + 0.7 * math.sin(math.pi * (0.12 + 0.72 * u)))
    tipc = rng.random() * 0.35
    tops, unders = [], []
    for u in stations:
        p = at(u)
        w = width(u)
        up = 0.95 - 0.7 * u
        left = t.v(p + side * w - Vector((0, 0, w * 0.35)), 0.55 + 0.4 * u, 0.35 + tipc, 0.0,
                   norm((c * 0.65 - s * 0.3, s * 0.65 + c * 0.3, up * 0.7)))
        ridge = t.v(p + Vector((0, 0, thick)), 0.6 + 0.4 * u, tipc * 0.5, 0.0, norm((c * 0.65, s * 0.65, up)))
        right = t.v(p - side * w - Vector((0, 0, w * 0.35)), 0.55 + 0.4 * u, 0.35 + tipc, 0.0,
                    norm((c * 0.65 + s * 0.3, s * 0.65 - c * 0.3, up * 0.7)))
        tops.append((left, ridge, right))
        ul = t.v(p + side * w - Vector((0, 0, w * 0.35)), 0.5, 1.0, 0.0, norm((c * 0.5, s * 0.5, -0.3)))
        ur = t.v(p - side * w - Vector((0, 0, w * 0.35)), 0.5, 1.0, 0.0, norm((c * 0.5, s * 0.5, -0.3)))
        unders.append((ul, ur))
    # The tip: a blunt edge, not a point — a bough ends in a spray.
    tp = at(1.0)
    tw = width(1.0) * 0.55
    tl = t.v(tp + side * tw - Vector((0, 0, tw * 0.4)), 0.95, tipc + 0.2, 0.0,
             norm((c * 0.65 - s * 0.3, s * 0.65 + c * 0.3, 0.25)))
    tr_ = t.v(tp - side * tw - Vector((0, 0, tw * 0.4)), 0.95, tipc + 0.2, 0.0,
              norm((c * 0.65 + s * 0.3, s * 0.65 - c * 0.3, 0.25)))
    tip = t.v(tp + Vector((0, 0, thick * 0.4)), 0.95, tipc, 0.0, norm((c * 0.65, s * 0.65, 0.4)))
    ul_ = t.v(tp + side * tw - Vector((0, 0, tw * 0.4)), 0.5, 1.0, 0.0, norm((c * 0.5, s * 0.5, -0.3)))
    ur_ = t.v(tp - side * tw - Vector((0, 0, tw * 0.4)), 0.5, 1.0, 0.0, norm((c * 0.5, s * 0.5, -0.3)))
    for i in range(len(stations) - 1):
        l0, r0_, g0 = tops[i]
        l1, r1_, g1 = tops[i + 1]
        t.f((r0_, r1_, l1, l0), "needle")
        t.f((g0, g1, r1_, r0_), "needle")
        t.f((unders[i + 1][0], unders[i + 1][1], unders[i][1], unders[i][0]), "needle")
    l, r, g = tops[-1]
    t.f((r, tip, tl, l), "needle")
    t.f((g, tr_, tip, r), "needle")
    t.f((ul_, ur_, unders[-1][1], unders[-1][0]), "needle")
    # THE SNOW along the top: the inner pad always, the outer where the
    # region's load reaches this bough's share of the variant's snow.
    reach = rng.random() / max(snow, 1e-3)
    depth = 0.06 + 0.14 * snow
    def snow_ring(u, load):
        p = at(u) + Vector((0, 0, thick * 0.9))
        w = width(u) * (0.66 + 0.3 * snow)
        sh = 0.15 + 0.3 * rng.random()
        return (t.v(p + side * w - Vector((0, 0, w * 0.2)), 0.95, sh + 0.35, load, norm((c * 0.3 - s * 0.35, s * 0.3 + c * 0.35, 0.9))),
                t.v(p + Vector((0, 0, depth)), 1.0, sh, load, norm((c * 0.3, s * 0.3, 1))),
                t.v(p - side * w - Vector((0, 0, w * 0.2)), 0.95, sh + 0.35, load, norm((c * 0.3 + s * 0.35, s * 0.3 - c * 0.35, 0.9))))
    for (u0, u1, load) in ((0.04, 0.45, 0.0), (0.45, 0.72 + 0.26 * snow, reach)):
        if load > 1.0:
            continue
        a0, a1 = snow_ring(u0, load), snow_ring(u1, load)
        t.f((a0[1], a1[1], a1[0], a0[0]), "snow")
        t.f((a0[2], a1[2], a1[1], a0[1]), "snow")

# ---------------------------------------------------------------- a PINE
def pine(v, f, far, rng):
    t = Tree(v["lean"])
    snow = f["snow"]
    seed = v["index"] * 3 + 1
    stems = min(2, f["stems"]) if far else f["stems"]

    def kink_x(y):
        return min(1.0, (y - f["kink"]) / 0.12) * f["kinkBy"] if f["kink"] > 0 and y > f["kink"] else 0.0

    def stem_at(st, y):
        """Where stem `st` is at a share `y` of the height, m across."""
        if stems == 1:
            return kink_x(y) * C, 0.0
        a = st * 2.4 + seed
        tilt = f["splay"] * (0.3 if st == 0 else 1) * 1.6 * y
        return (kink_x(y) + math.cos(a) * tilt) * C, math.sin(a) * tilt * C

    r0 = 0.055 * C * (0.75 if stems > 1 else 1)
    for st in range(stems):
        reach = 0.95 if st == 0 else 0.8 + 0.1 * rng.random()
        joints = [0, 0.5, reach] if far else [0, 0.15, 0.3, 0.45, 0.6, f["kink"] or 0.75, reach]
        ys = sorted(set(y for y in joints if y <= reach))
        pts = [Vector((*stem_at(st, y), y * H)) for y in ys]
        pts[0].z = -0.3
        tube(t, pts, [flare(r0, p.z) * (1 - 0.7 * max(0, p.z) / H) for p in pts], 3 if far else 6, "bark",
             lambda k: (0.7 + 0.3 * k / (len(pts) - 1), smoothstep(0.35, 0.65, ys[k])), cap=True)

    pads = min(3 + stems, f["pads"]) if far else f["pads"]
    # A crown of many pads builds each of fewer sides.
    pad_sides = 5 if far else (8 if pads > 11 else 10)
    for i in range(pads):
        st = i % stems
        u = 0.5 if pads == 1 else i / (pads - 1)
        y = v["base"] + (v["top"] - v["base"] - f["thick"]) * (0.08 + 0.92 * u)
        a = i * 2.39996 + seed
        top_pad = i == pads - 1
        j = rng.random()
        reach = 0.05 if top_pad else f["spread"] * v["width"] * (0.35 + 0.65 * j) * (1 - f["young"] * u * 0.8)
        if f["layers"] > 0 and not top_pad:
            per = max(1, math.ceil((pads - 1) / f["layers"]))
            layer = i // per
            lu = 0.5 if f["layers"] == 1 else layer / (f["layers"] - 1)
            y = v["base"] + (v["top"] - v["base"] - f["thick"]) * (0.05 + 0.8 * lu)
            a = (i % per) / per * 2 * math.pi + layer * 1.1 + seed
            reach = f["spread"] * v["width"] * (0.95 - 0.55 * lu) * (0.85 + 0.3 * rng.random())
        sx, sy = stem_at(st, y)
        cx, cy = sx + math.cos(a) * reach * C, sy + math.sin(a) * reach * C
        pr = ((0.4 + 0.22 * rng.random()) * v["width"] * (1 - f["young"] * (u * 0.7 - 0.25))
              * (0.8 if stems > 1 else 1)) * C
        zc, th = y * H, f["thick"] * H
        if not top_pad and not far:
            # The branch out to the pad, forking under it.
            b0 = Vector((sx, sy, zc - th * 0.6))
            b1 = Vector((cx, cy, zc))
            tube(t, [b0, b0.lerp(b1, 0.5) + Vector((0, 0, th * 0.12)), b1], [0.05, 0.035, 0.02], 4, "bark",
                 lambda k: (0.8, 1.0))
        pad(t, cx, cy, zc, pr, th, pad_sides, snow, rng)
    return t

def pad(t, cx, cy, z, r, th, n, snow, rng):
    """A PAD of needles: a lobed cushion, its rim drooping, its top domed,
    a dark belly under it, and a cap of snow on it — the inner part always,
    the rest where the load reaches it."""
    rim, inner = [], []
    for j in range(n):
        a = 2 * math.pi * j / n + rng.random() * 0.4
        lobe = 1.0 if j % 2 == 0 else 0.78
        rr = r * lobe * (0.8 + 0.3 * rng.random())
        c, s = math.cos(a), math.sin(a)
        rim.append((cx + c * rr, cy + s * rr, z + th * 0.2 * rng.random(), c, s))
        inner.append((cx + c * rr * 0.6, cy + s * rr * 0.6, z + th * 0.8, c, s))
    crown = t.v((cx, cy, z + th), 0.9, 0.0, 0.0, (0, 0, 1))
    belly = t.v((cx, cy, z - th * 0.35), 0.45, 1.0, 0.0, (0, 0, -1))
    iv = [t.v(p[:3], 0.9, 0.1, 0.0, norm((p[3] * 0.5, p[4] * 0.5, 1))) for p in inner]
    rv = [t.v(p[:3], 0.75, 0.2 + 0.6 * (j % 2), 0.0, norm((p[3], p[4], 0.2))) for j, p in enumerate(rim)]
    ru = [t.v(p[:3], 0.55, 1.0, 0.0, norm((p[3], p[4], -0.4))) for p in rim]
    for j in range(n):
        k = (j + 1) % n
        t.f((crown, iv[j], iv[k]), "needle")
        t.f((iv[j], rv[j], rv[k], iv[k]), "needle")
        t.f((belly, ru[k], ru[j]), "needle")
    # The snow: a cap over the inner dome, a lip out towards the rim.
    lift = 0.04 + 0.06 * snow
    reach = rng.random() / max(snow, 1e-3)
    top = t.v((cx, cy, z + th + lift * 1.6), 1.0, 0.1, 0.0, (0, 0, 1))
    ci = [t.v((cx + (p[0] - cx) * 0.95, cy + (p[1] - cy) * 0.95, p[2] + lift), 1.0, 0.25, 0.0,
              norm((p[3] * 0.3, p[4] * 0.3, 1))) for p in inner]
    for j in range(n):
        t.f((top, ci[j], ci[(j + 1) % n]), "snow")
    if reach <= 1.0:
        ci2 = [t.v((cx + (p[0] - cx) * 0.95, cy + (p[1] - cy) * 0.95, p[2] + lift), 1.0, 0.25, reach,
                   norm((p[3] * 0.3, p[4] * 0.3, 1))) for p in inner]
        lip = [t.v((cx + (q[0] - cx) * 0.88, cy + (q[1] - cy) * 0.88, q[2] + (p[2] - q[2]) * 0.3 + lift), 0.95,
                   0.5, reach, norm((q[3] * 0.5, q[4] * 0.5, 0.8))) for p, q in zip(inner, rim)]
        for j in range(n):
            k = (j + 1) % n
            t.f((ci2[j], lip[j], lip[k], ci2[k]), "snow")

# ---------------------------------------------------------------- a LARCH, or a SNAG
ARMS = 56

def larch(v, f, far, rng):
    t = Tree(v["lean"])
    dead = f["dead"]
    top = v["top"] * H
    seed = v["index"] * 3 + 1
    pts = trunk_points(-0.3, top, 2 if far else 6)
    rb = (0.065 if dead else 0.045) * C
    rt = 0.02 * C if dead else 0.004 * C
    tube(t, pts, [flare(rb, p.z) + (rt - rb) * max(0, p.z) / top for p in pts], 3 if far else 6, "bark",
         lambda k: (0.7 + 0.3 * k / (len(pts) - 1), 0.0 if dead else k / (len(pts) - 1) * 0.6), cap=True)
    if dead and not far:
        # Where it broke: a splinter standing off the top.
        tube(t, [Vector((0, 0, top - 0.1)), Vector((0.06, 0.02, top + 0.5))], [rt * 0.8, 0.005], 3, "bark",
             lambda k: (0.9, 0.0))
    whorls = 4 if far else f["whorls"]
    arms = 4 if far else f["arms"]
    # THE BUDGET: at most ARMS arms (about 24 triangles each) — a dense
    # larch drops one here and there, which a haze of twigs never shows.
    keep = min(1.0, ARMS / (whorls * arms))
    for w in range(whorls):
        u = (w + 0.5) / whorls
        z = (v["base"] + (v["top"] - v["base"]) * u * 0.95) * H
        r = v["width"] * max(0.05, 1 - u * 0.95) ** v["taper"] * C
        for k in range(arms):
            if (dead and rng.random() < 0.3) or rng.random() > keep:
                continue
            a = 2 * math.pi * k / arms + w * 1.3 + rng.random() * 0.5 + seed
            c, s = math.cos(a), math.sin(a)
            reach = r * (0.8 + 0.3 * rng.random()) * (0.75 if dead else 1)
            tip_z = z + (-f["droop"] * 0.06 - reach / C * 0.02 + (1 - f["droop"]) * 0.03) * H
            root = Vector((c * 0.03, s * 0.03, z))
            tip = Vector((c * reach, s * reach, tip_z))
            mid = root.lerp(tip, 0.5) + Vector((0, 0, (1 - f["droop"]) * 0.1 * reach))
            wide = (0.07 + 0.06 * (1 - u)) * C * (1.3 if dead else 1)
            if far:
                fin(t, root, tip, wide * 0.7, "twig", (0.7, 0.9), (1.0, 0.0), 0.3)
                continue
            tube(t, [root, mid, tip], [0.075, 0.045, 0.015] if dead else [0.035, 0.02, 0.006], 3, "twig",
                 lambda k: (0.75 + 0.1 * k, 1.0 - 0.5 * k))
            load = rng.random() / max(f["snow"], 1e-3)
            if u < 0.75 and load <= 1.0:
                # Snow along the arm's top.
                q = Vector((-s, c, 0)) * 0.03
                lift = Vector((0, 0, 0.035))
                a0 = [t.v(p, 1.0, 0.3, load, (0, 0, 1)) for p in (root + q + lift, root - q + lift)]
                a1 = [t.v(p, 1.0, 0.3, load, (0, 0, 1)) for p in (mid + q * 0.7 + lift, mid - q * 0.7 + lift)]
                a2 = t.v(tip.lerp(mid, 0.35) + lift, 1.0, 0.4, load, (0, 0, 1))
                t.f((a0[1], a1[1], a1[0], a0[0]), "snow")
                t.f((a1[1], a2, a1[0]), "snow")
            if dead:
                continue
            # The larch's weeping twigs: a spray along the arm's outer part
            # and two hanging off it — a haze of them from any distance.
            fin(t, mid, tip, wide * 0.45, "twig", (0.85, 1.0), (0.3, 0.0), 0.8)
            for at in (0.65,):
                m = root.lerp(tip, at)
                side = rng.random() - 0.5
                hang = m + Vector((-m.y * side * 0.8, m.x * side * 0.8, -(0.03 + f["droop"] * 0.05) * H * 0.5))
                fin(t, m, hang, 0.008 * C, "twig", (0.9, 1.0), (0.0, 0.0), 2.5)
    return t

# ---------------------------------------------------------------- a BROADLEAF in winter
def broadleaf(v, f, far, rng):
    t = Tree(v["lean"])
    seed = v["index"] * 3 + 1
    stems = min(2, f["stems"]) if far else f["stems"]
    fins = 16 if far else f["fins"]
    for st in range(stems):
        sa = st * 2.4 + seed
        tilt = 0 if stems == 1 else f["splay"] * (0.4 if st == 0 else 1)
        dx, dy = math.sin(tilt) * math.cos(sa), math.sin(tilt) * math.sin(sa)
        # A unit of height is some four crown radii: the code's lean of a
        # stem, in metres.
        def along(z, dx=dx, dy=dy):
            return Vector((dx * z / H * C * 4 * 0.25, dy * z / H * C * 4 * 0.25, z))
        height = (1 if st == 0 else 0.8 + 0.15 * rng.random()) * v["top"] * H
        r = 0.045 * C * (1 if st == 0 else 0.8) * (0.7 if stems > 3 else 1)
        rings = 3 if far else (10 if stems <= 2 else 6)
        round_ = 3 if far else (7 if stems <= 2 else 5)
        pts = [along(-0.3 + (height * 0.86 + 0.3) * k / rings) for k in range(rings + 1)]
        marks = f["marks"]
        cells = {(k, j) for k in range(rings) for j in range(round_) if rng.random() < marks * 1.2}
        tube(t, pts, [flare(r, max(0.0, p.z)) * (1 - 0.6 * max(0.0, p.z) / height) for p in pts], round_,
             "bark", lambda k: (0.75 + 0.25 * k / rings, 0.0), cap=True,
             mark=None if far else (lambda k, j: (k, j) in cells and k > 0))
        own = round(fins / stems)
        for i in range(own):
            u = (i + 0.5) / own
            a = i * 2.39996 + seed + st
            base = (v["base"] + (0.8 - v["base"]) * u + (rng.random() - 0.5) * 0.06) * height
            outline = math.sin(math.pi * min(1.0, u * 1.1)) ** (1 - 0.7 * f["dome"])
            reach = ((0.35 + 0.75 * outline) * (0.75 + 0.5 * rng.random()) * v["width"]
                     * (0.75 if stems > 1 else 1)) * C
            rise = ((0.05 + 0.09 * u) * (1 - f["weep"]) * (1 - 0.4 * f["dome"])
                    - f["weep"] * 0.06 * (1 - u)) * H
            c, s = math.cos(a), math.sin(a)
            root = along(base) + Vector((c * 0.08, s * 0.08, 0))
            tip = root + Vector((c * reach, s * reach, rise))
            snowy = rng.random() / max(f["snow"], 1e-3)
            w = (0.05 + 0.035 * (1 - u)) * f["stiff"] * C / 2.88
            if far:
                fin(t, root, tip, w, "twig", (0.8, 0.95), (0.6, 0.0), 3.5 / max(0.6, f["stiff"]))
                continue
            limb(t, root, tip, u, f, w, snowy, rng)
    return t

def limb(t, root, tip, u, f, w, snowy, rng):
    """One limb off the stem, bowing up (or down, weeping), forking into a
    fan of twigs over its outer half; what the kind carries on its tips."""
    d = tip - root
    mid = root.lerp(tip, 0.55) + Vector((0, 0, abs(d.z) * 0.25 + 0.1 * (1 - f["weep"]) * d.length * 0.3))
    thick = 0.03 * f["stiff"] * (1.3 - 0.5 * u)
    # Bark where it leaves the stem, the kind's own twig colour (a willow's
    # orange, a birch's purple-brown) by its middle.
    tube(t, [root, mid], [thick, thick * 0.6], 3, "twig", lambda k: (0.8 + 0.1 * k, 0.65 - 0.6 * k))
    # The fan: three twigs off the limb's end, spread in plan, the weeping
    # ones hanging.
    side = Vector((-d.y, d.x, 0)).normalized() if d.xy.length > 1e-6 else Vector((1, 0, 0))
    spread = d.length * 0.35
    fan = 3.5 / max(0.6, f["stiff"])
    for k, off in enumerate((-1, 0, 1) if f["fins"] <= 44 else (-0.7, 0.7)):
        end = tip + side * off * spread + Vector((0, 0, (abs(off) * -0.1 - f["weep"] * 0.3) * d.length * 0.4))
        fin(t, mid, end, w * 0.6, "twig", (0.85, 1.0), (0.05, 0.0), fan * 0.7)
        if rng.random() < f["berries"] * 0.6:
            blob(t, end + Vector((0, 0, -0.08)), 0.12, "accent")
        if rng.random() < f["leaves"] * 0.8:
            at = mid.lerp(end, 0.5 + 0.35 * rng.random())
            hang = at + side * 0.15 + Vector((0, 0, -0.22))
            fin(t, at, hang, 0.09, "accent", (0.75, 0.9), (0.0, 0.0), 1.6)
    if u < 0.65 and snowy <= 1.0:
        # Snow along the limb's top.
        q = side * thick * 0.9
        lift = Vector((0, 0, thick + 0.02))
        a0 = [t.v(p, 1.0, 0.3, snowy, (0, 0, 1)) for p in (root + q + lift, root - q + lift)]
        a1 = t.v(mid + lift, 1.0, 0.4, snowy, (0, 0, 1))
        t.f((a0[1], a1, a0[0]), "snow")

# ---------------------------------------------------------------- the KIND: ten variants, two bands each
FORMS = {"conifer": conifer, "pine": pine, "larch": larch, "birch": broadleaf}
made = []
tris = {}
for v in DATA["variants"]:
    for far in (False, True):
        rng = random.Random(f"{KIND}/{v['index']}/{far}")
        name = f"v{v['index']}" + ("_far" if far else "")
        ob = FORMS[v["shape"]["form"]](v, v["shape"], far, rng).object(name)
        made.append(ob)
        tris[name] = sum(len(p.vertices) - 2 for p in ob.data.polygons)

root = bpy.data.objects.new(KIND, None)
COL.objects.link(root)
root["height"], root["crown"], root["frame"] = H, C, "tree"
for ob in made:
    ob.parent = root
full = [tris[f"v{i}"] for i in range(len(DATA["variants"]))]
fars = [tris[f"v{i}_far"] for i in range(len(DATA["variants"]))]
print("TRIANGLES", KIND, "full", min(full), "-", max(full), "far", min(fars), "-", max(fars),
      "total", sum(full) + sum(fars))

if GAME:
    lib._select_only([root] + made)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"{KIND}.glb"), use_selection=True, export_extras=True,
                              export_normals=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
                              export_animations=False, export_skins=False, export_morph=False,
                              export_materials="EXPORT")

# ---------------------------------------------------------------- the STUDIO: the ten in a row
only = [x for x in os.environ.get("VIEWS", "").split(",") if x]
views = [x for x in ("row", "far", "close") if (not only or x in only)] if (not GAME or only) else []
if only == ["none"]:
    views = []
if views:
    GAP = 2.6 * C
    for ob in made:
        i = int(ob.name[1:].split("_")[0])
        ob.location = (i * GAP, 0, 0)
    snow_mat = mat("ground", (0.86, 0.9, 0.96), rough=0.55)
    bpy.ops.mesh.primitive_plane_add(size=600, location=(4.5 * GAP, 0, -0.02))
    bpy.context.active_object.data.materials.append(snow_mat)
    world = bpy.data.worlds.new("sky")
    scene.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.42, 0.55, 0.78, 1)
    bg.inputs[1].default_value = 0.9
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 5.5
    sun.angle = math.radians(1.5)
    sun.color = (1.0, 0.95, 0.88)
    so = bpy.data.objects.new("sun", sun)
    COL.objects.link(so)
    so.rotation_euler = (math.radians(55), math.radians(8), math.radians(-35))
    lib._cycles(SAMPLES)
    scene.cycles.device = "CPU"
    scene.view_settings.exposure = 0.8
    tag = "game" if GAME else "render"
    for view in views:
        cd = bpy.data.cameras.new(view)
        cam = bpy.data.objects.new(view, cd)
        COL.objects.link(cam)
        if view == "close":
            # Variant 0 from the saddle: the rider's head, 14 m off.
            scene.render.resolution_x, scene.render.resolution_y = 900, 1200
            cd.lens = 24
            cam.location = (0, -14, 2.2)
            cam.rotation_euler = (math.radians(90 + 16), 0, 0)
        else:
            scene.render.resolution_x, scene.render.resolution_y = 2000, 340
            cd.type = "ORTHO"
            cd.ortho_scale = 10.2 * GAP
            cam.location = (4.5 * GAP, -80, H * 0.55)
            cam.rotation_euler = (math.radians(90), 0, 0)
        for ob in made:
            ob.hide_render = ob.name.endswith("_far") != (view == "far")
        scene.camera = cam
        scene.render.filepath = os.path.join(OUT, f"{KIND}-{tag}-{view}.png")
        bpy.ops.render.render(write_still=True)

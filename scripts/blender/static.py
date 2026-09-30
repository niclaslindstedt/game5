# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE STATIC SHELF: what a model with NO RIG is built from — the wildlife
# and the course's marks (`bird.py`, `beast.py`, `gate.py`), as the trees
# are. A `Sheet` is a mesh under construction: every vertex with its TONE
# (a shade, a blend, a spare number) and, where it wants one, its own
# normal; every face a ROLE — its material's name, which is all the colour
# a model carries: the game dresses it by that name (`bird-models.ts`,
# `beast-models.ts`, `gate-models.ts`) as `tree-models.ts` dresses a tree.
# The stills are painted here through the same arithmetic, in the
# species' own colours handed in for that alone.
#
# THE FRAME, for every static kind: Blender x is the game's x (the right),
# Blender z the game's y (up), and Blender -y the game's z (forward) — what
# the glTF exporter's own turn (x, y, z → x, z, -y) makes of the game's
# frame, so a loader reads the file's metres as the game's and turns
# nothing. A bird's bill and an animal's nose point down -y here; a stake's
# pennant streams out along +x.

import math, os

import bpy, bmesh
from mathutils import Vector

import lib
from lib import COL, GAME, mat, scene


def norm(v):
    l = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) or 1.0
    return (v[0] / l, v[1] / l, v[2] / l)


def smoothstep(a, b, x):
    u = max(0.0, min(1.0, (x - a) / (b - a)))
    return u * u * (3 - 2 * u)


def frame(d):
    """Two unit vectors across a direction `d`."""
    d = Vector(d).normalized()
    a = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    u = d.cross(a).normalized()
    return u, d.cross(u).normalized()


def srgb(hex_):
    """A style's sRGB hex as the linear RGB a Blender material takes."""
    c = [((hex_ >> s) & 255) / 255 for s in (16, 8, 0)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def role_mat(name, first, second=None, rough=0.85):
    """A role's material: in the game quality a neutral one the game
    dresses by NAME; in the render quality the role's colours through the
    tone attribute, as the game reads it (`first` to `second` by the
    blend, times the shade)."""
    second = second or first
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


class Sheet:
    """A mesh under construction, every face a role out of `roles` (the
    materials, in order) and every vertex a tone."""

    def __init__(self, roles, mats):
        self.roles, self.mats = list(roles), list(mats)
        self.co, self.tone, self.nrm, self.faces, self.idx = [], [], [], [], []

    def v(self, p, shade=1.0, blend=0.0, spare=0.0, n=None):
        self.co.append((float(p[0]), float(p[1]), float(p[2])))
        self.tone.append(tuple(max(0.0, min(1.0, x)) for x in (shade, blend, spare)))
        self.nrm.append(n)
        return len(self.co) - 1

    def f(self, idx, role):
        self.faces.append(tuple(idx))
        self.idx.append(self.roles.index(role))

    @property
    def triangles(self):
        return sum(len(f) - 2 for f in self.faces)

    def object(self, name, smooth=True):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.co, [], self.faces)
        me.validate(clean_customdata=False)
        for m in self.mats:
            me.materials.append(m)
        me.polygons.foreach_set("material_index", self.idx)
        me.polygons.foreach_set("use_smooth", [smooth] * len(me.polygons))
        tone = me.color_attributes.new("tone", "FLOAT_COLOR", "POINT")
        for i, (r, g, b) in enumerate(self.tone):
            tone.data[i].color = (r, g, b, 1.0)
        me.color_attributes.active_color = tone
        me.color_attributes.render_color_index = 0
        me.update()
        if any(n is not None for n in self.nrm):
            own = [tuple(v.normal) for v in me.vertices]
            me.normals_split_custom_set_from_vertices(
                [n if n is not None else own[i] for i, n in enumerate(self.nrm)])
        ob = bpy.data.objects.new(name, me)
        COL.objects.link(ob)
        return ob


def ring_at(centre, u, w, radius, sides, squash=1.0, phase=0.0):
    """`sides` points round `centre` in the plane of `u` and `w`, `radius`
    along `u` and `radius * squash` along `w`."""
    out = []
    for j in range(sides):
        a = 2 * math.pi * j / sides + phase
        out.append(Vector(centre) + u * (radius * math.cos(a)) + w * (radius * squash * math.sin(a)))
    return out


def loft(sh, rings, role, shade=None, blend=None, cap_start=False, cap_end=False, closed=True,
         role_at=None, normals=None):
    """Rings of points (Vectors, all the same count) into a skin: `role`
    on every face, or `role_at(k, j)` for ring k's face j; `shade(k, j)`
    and `blend(k, j)` a vertex's tone; `normals(k, j)` its own normal."""
    M = len(rings[0])
    ix = []
    for k, ring in enumerate(rings):
        ix.append([sh.v(p, shade(k, j) if shade else 1.0, blend(k, j) if blend else 0.0, 0.0,
                        normals(k, j) if normals else None) for j, p in enumerate(ring)])
    span = M if closed else M - 1
    for k in range(len(rings) - 1):
        for j in range(span):
            j1 = (j + 1) % M
            r = role_at(k, j) if role_at else role
            sh.f((ix[k][j], ix[k][j1], ix[k + 1][j1], ix[k + 1][j]), r)
    if cap_start:
        c = sh.v(sum(rings[0], Vector()) / M, shade(0, 0) if shade else 1.0, blend(0, 0) if blend else 0.0)
        for j in range(M):
            sh.f((ix[0][(j + 1) % M], ix[0][j], c), role_at(0, j) if role_at else role)
    if cap_end:
        k = len(rings) - 1
        c = sh.v(sum(rings[-1], Vector()) / M, shade(k, 0) if shade else 1.0, blend(k, 0) if blend else 0.0)
        for j in range(M):
            sh.f((ix[-1][j], ix[-1][(j + 1) % M], c), role_at(k - 1, j) if role_at else role)
    return ix


def tube(sh, pts, radii, sides, role, tone=lambda k: (1.0, 0.0), cap=False, squash=1.0, role_at=None):
    """A tapering tube through `pts` (Vectors), `radii` at each, its
    sections parallel-transported so the seam never twists; `tone(k)` the
    shade and blend of ring k; `squash` flattens each section across."""
    rings = []
    prev_u = None
    for k, p in enumerate(pts):
        d = pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]
        if d.length < 1e-9:
            d = Vector((0, 0, 1))
        u, w = frame(d)
        if prev_u is not None:
            dn = d.normalized()
            u = (prev_u - dn * prev_u.dot(dn)).normalized()
            w = dn.cross(u)
        prev_u = u
        rings.append(ring_at(p, u, w, radii[k], sides, squash))
    ix = loft(sh, rings, role, shade=lambda k, j: tone(k)[0], blend=lambda k, j: tone(k)[1], role_at=role_at)
    if cap:
        s, b = tone(len(pts) - 1)
        c = sh.v(pts[-1] + (pts[-1] - pts[-2]).normalized() * radii[-1] * 0.4, s, b)
        for j in range(sides):
            sh.f((ix[-1][j], ix[-1][(j + 1) % sides], c), role_at(len(pts) - 2, j) if role_at else role)
    return rings, ix


def fin(sh, root, tip, w, role, fan=0.4, shade=(1.0, 1.0), up=Vector((0, 0, 1)), both=True,
        under=None, curl=0.0):
    """A thin blade from `root` to `tip`, `w` wide at the root and `fan` of
    that at the tip, its two faces their own vertices (the game draws a
    sheet from either side); `under` the role of its underside, `curl`
    bows its tip along `up`."""
    root, tip = Vector(root), Vector(tip)
    d = tip - root
    s = d.cross(up)
    if s.length < 1e-6:
        s = Vector((1, 0, 0))
    s = s.normalized() * w
    quad = (root + s, tip + s * fan + up * curl, tip - s * fan + up * curl, root - s)
    n = d.cross(s).normalized()
    ix = [sh.v(q, shade[0] if k in (0, 3) else shade[1], 0.0, 0.0, tuple(n)) for k, q in enumerate(quad)]
    sh.f(ix, role)
    if both:
        ix = [sh.v(q, shade[0] if k in (0, 3) else shade[1], 0.0, 0.0, tuple(-n)) for k, q in enumerate(quad)]
        sh.f(tuple(reversed(ix)), under or role)


def blob(sh, at, r, role, shade=1.0):
    """A little octahedron."""
    at = Vector(at)
    ps = [at + Vector(o) * r for o in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))]
    ix = [sh.v(p, shade, 0.0, 0.0, norm(tuple(p - at))) for p in ps]
    for a, b in ((0, 2), (2, 1), (1, 3), (3, 0)):
        sh.f((ix[a], ix[b], ix[4]), role)
        sh.f((ix[b], ix[a], ix[5]), role)


def stills(name, out, centre, size, floor, samples, views, wanted):
    """The studio for a static asset: a snow floor at `floor`, the winter
    sky, the low sun and the fill `lib._studio` sets — and cameras of this
    shelf's own, each looking at `centre` from a direction, far enough to
    take `size` metres: `side` (from the right), `front` (down the nose),
    `three` (front-left, a little above), `under` (from below and ahead —
    where the snow sees a bird from), `back` (behind, above) and `detail`
    (close, front-right)."""
    lib._studio(centre, size, floor)
    lib._cycles(samples)
    scene.cycles.device = "CPU"
    c = Vector(centre)
    tag = "game" if GAME else "render"
    dirs = {
        "side": ((1, 0, 0.12), 1.15),
        "front": ((0.05, -1, 0.15), 1.15),
        "three": ((-0.8, -0.9, 0.45), 1.1),
        "under": ((0.35, -0.9, -0.6), 1.05),
        "back": ((0.7, 0.9, 0.5), 1.1),
        "detail": ((0.7, -0.9, 0.35), 0.55),
    }
    for v in wanted:
        d, k = dirs[v]
        d = Vector(d).normalized()
        cd = bpy.data.cameras.new(v)
        cd.lens = 50
        cam = bpy.data.objects.new(v, cd)
        COL.objects.link(cam)
        cam.location = c + d * (size * k * 1.45)
        cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
        scene.camera = cam
        scene.render.filepath = os.path.join(out, f"{name}-{tag}-{v}.png")
        bpy.ops.render.render(write_still=True)


def publish(name, made, out, extras=None, centre=(0, 0, 0), size=1.0, floor=0.0, samples=64,
            views=("side", "three", "detail"), stage=None):
    """Everything after the modelling: the parts under one root (carrying
    `extras`), the triangle count printed, the glTF exported in the game
    quality, and the studio stills (`stills`) — `views` of its cameras,
    after `stage()` has set the parts where the game would (a pennant
    hung on its pole) for the picture alone."""
    root = bpy.data.objects.new(name, None)
    COL.objects.link(root)
    root["frame"] = "static"
    for k, v in (extras or {}).items():
        root[k] = v
    for ob in made:
        ob.parent = root
    tris = {ob.name: sum(len(p.vertices) - 2 for p in ob.data.polygons) for ob in made}
    print("TRIANGLES", name, "game" if GAME else "render", sum(tris.values()),
          {k: v for k, v in sorted(tris.items(), key=lambda kv: -kv[1])[:6]})
    if GAME:
        lib._select_only([root] + list(made))
        bpy.ops.export_scene.gltf(filepath=os.path.join(out, f"{name}.glb"), use_selection=True,
                                  export_extras=True, export_normals=True, export_vertex_color="ACTIVE",
                                  export_all_vertex_colors=False, export_animations=False,
                                  export_skins=False, export_morph=False, export_materials="EXPORT")
    only = [x for x in os.environ.get("VIEWS", "").split(",") if x]
    if only == ["none"] or (GAME and not only):
        return
    wanted = [v for v in views if not only or v in only]
    if wanted:
        if stage:
            stage()
        stills(name, out, centre, size, floor, samples, views, wanted)

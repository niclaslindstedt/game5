# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE RACER'S PRINT (`racer.py`'s): the one-piece suit's sublimated panels
# and the bib's number, baked into maps.
#
# A race suit is PRINTED, not sewn of coloured cloth: its panels are inked
# into one stretch fabric, so the colour edges are where the design puts
# them, not where seams fall, and the only relief on it is the few seams
# that shape it and the padding under the shins and forearms. So the suit
# is unwrapped, where every texel lies on him and which way it faces is
# baked, the design is worked out at every texel in his own terms (up the
# spine, round each limb, out from his sides) — the COLOUR map — and its
# seams and pipings as a height, baked into a NORMAL map. The bib is a
# tabard with its own unwrap: red knit, a white band across its top, the
# number big front and back.

import math

import bpy
import numpy as np

import lib


def _pixels(image, tex):
    buf = np.empty(tex * tex * 4, dtype=np.float32)
    image.pixels.foreach_get(buf)
    return buf.reshape(tex, tex, 4)


def _emit_only(m, build):
    """`m`'s shader swapped for an emission of `build(nt)` (a node output)."""
    nt = m.node_tree
    for nd in list(nt.nodes):
        if nd.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(nd)
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(build(nt), em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], nt.nodes.get("Material Output").inputs["Surface"])


def _bake(m, kind, image, **kw):
    t = m.node_tree.nodes.new("ShaderNodeTexImage")
    t.image = image
    for nd in m.node_tree.nodes:
        nd.select = False
    t.select = True
    m.node_tree.nodes.active = t
    bpy.ops.object.bake(type=kind, margin=8, **kw)


def _float_map(name, tex):
    im = bpy.data.images.new(name, tex, tex, float_buffer=True, is_data=True)
    im.colorspace_settings.name = "Non-Color"
    return im


def _coords(kind, k, b):
    def build(nt):
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeVectorMath")
        mp.operation = "MULTIPLY_ADD"
        mp.inputs[1].default_value = (k, k, k)
        mp.inputs[2].default_value = (b, b, b)
        nt.links.new(tc.outputs[kind], mp.inputs[0])
        return mp.outputs["Vector"]
    return build


def design(P, N, G):
    """THE SUIT'S DESIGN at every texel: its colour (linear RGB) and its
    relief (0..1, 0.5 flat), off where on him it lies (`P`) and which way it
    faces (`N`), in Blender's frame of the pose he is bound in. `G` is the
    builder's frame, points and colours."""
    frame, hips, neck = G["frame"], G["hips"], G["neck"]
    C = G["colours"]
    v3 = lambda v: np.array([v.x, v.y, v.z], dtype=np.float32)
    H = np.full(P.shape[:2], 0.5, dtype=np.float32)
    rgb = np.zeros(P.shape[:2] + (3,), dtype=np.float32)

    # Which bone's line each texel is nearest — the trunk's chord, each
    # thigh, shin, upper arm and forearm.
    segs = {"spine": frame("spine")}
    for s in "lr":
        for part in ("thigh", "shin", "upperarm", "forearm"):
            segs[f"{part}_{s}"] = frame(f"{part}_{s}")
    names = list(segs)
    dist = np.empty(P.shape[:2] + (len(names),), dtype=np.float32)
    tpar = np.empty_like(dist)
    for k, n in enumerate(names):
        head, _, y, _, length = segs[n]
        rel = P - v3(head)
        t = np.clip(rel @ v3(y) / length, 0, 1)
        foot = v3(head)[None, None, :] + t[..., None] * (v3(y) * length)[None, None, :]
        dist[..., k] = np.linalg.norm(P - foot, axis=-1)
        tpar[..., k] = t
    near = np.argmin(dist, axis=-1)
    on = lambda n: near == names.index(n)

    def paint(mask, c):
        rgb[mask] = np.array(c, dtype=np.float32)

    def pipe(d, w, mask, depth=-0.18):
        """A seam's welt where `d` crosses 0, `w` m wide."""
        return np.where(mask, depth * np.exp(-((d / (w * 1.4)) ** 2)), 0.0)

    def pinstripe(arc, mask):
        """THE PINSTRIPE down the outside of a leg: a white
        line between two red bands, each edged white — `arc` the distance
        round the limb from its line, m."""
        a = np.abs(arc)
        paint(mask & (a < 0.0035), C["white"])
        paint(mask & (a >= 0.0035) & (a < 0.0125), C["red"])
        paint(mask & (a >= 0.0125) & (a < 0.016), C["white"])
        paint(mask & (a >= 0.016) & (a < 0.022), C["red"])

    # THE CLOTH: a deep navy, printed with a darker MOTTLE of soft blobs a
    # hand or two across — the sublimated texture a team suit carries.
    blob = (np.sin(P[..., 0] * 41 + np.sin(P[..., 2] * 23) * 2.1) + np.sin(P[..., 2] * 37 + P[..., 1] * 19)
            + np.sin((P[..., 0] + P[..., 2]) * 29 + np.sin(P[..., 1] * 31) * 1.7))
    m = 0.75 * np.clip((blob - 0.7) / 0.9, 0, 1)[..., None]
    rgb[...] = np.array(C["navy"], dtype=np.float32) * (1 - m) + np.array(C["deep"], dtype=np.float32) * m

    # THE TRUNK: navy (the bib covers most of it), a white roll neck at the
    # collar.
    spine = frame("spine")
    hc, SX, UP, AH, sl = v3(spine[0]), v3(spine[1]), v3(spine[2]), v3(spine[3]), spine[4]
    rel = P - hc
    up = rel @ UP
    trunk = on("spine")
    paint(trunk & (up > 0.975 * sl), C["white"])
    H += pipe(up - 0.975 * sl, 0.003, trunk)

    for i, s in enumerate("lr"):
        for part in ("upperarm", "forearm", "thigh", "shin"):
            n = f"{part}_{s}"
            head, x, y, z, length = segs[n]
            out = x if x.dot(head - hips) > 0 else -x
            if part == "forearm" or part == "upperarm":
                out = x if x.dot(G["shoulders"][i] - neck) > 0 else -x
            o, f, ax = v3(out), v3(z), v3(y)
            mask = on(n)
            t = tpar[..., names.index(n)]
            rr = P - v3(head)
            # The angle round the limb: 0 dead ahead (+z), +90° outward;
            # and the distance round it from its outside line, m.
            ang = np.degrees(np.arctan2(rr @ o, rr @ f))
            rad = dist[..., names.index(n)]
            arc = np.radians(((ang - 90 + 180) % 360) - 180) * rad
            along_ = rr @ ax
            if part in ("upperarm", "forearm"):
                # THE LADDER: fine white bars slanted across the outside of
                # the sleeve, from the elbow down the forearm and up the
                # upper arm's lower half.
                span = (t > 0.05) & (t < 0.78) if part == "forearm" else (t > 0.5) & (t < 0.96)
                bars = np.abs(((along_ + 0.45 * arc) / 0.021 + 0.5) % 1 - 0.5) * 0.021 < 0.0032
                paint(mask & span & (np.abs(arc) < 0.028) & bars, C["white"])
                if part == "forearm":
                    paint(mask & (t > 0.86), C["deep"])
            elif part == "thigh":
                pinstripe(arc, mask)
                H += pipe(np.abs(arc) - 0.022, 0.003, mask)
                # A white patch on the front of the left thigh: the
                # federation's mark, its letters left as dark bars.
                if s == "l":
                    farc = np.radians(((ang - 35 + 180) % 360) - 180) * rad
                    patch = mask & (np.abs(farc) < 0.045) & (t > 0.22) & (t < 0.34)
                    paint(patch, C["white"])
                    for k in (-1, 0, 1):
                        bar = patch & (np.abs(farc - k * 0.026) < 0.008) & (t > 0.25) & (t < 0.31)
                        paint(bar, C["deep"])
            else:
                # THE SHIN: the stripe runs on down its outside to the boot;
                # the padded panel down its front lies under the guard.
                pinstripe(arc, mask & (t < 0.7))
                pad = (np.abs(ang) < 70) & (t > 0.08)
                H += np.where(mask & pad, 0.12, 0.0)
            # The wrinkle of a stretch suit at the back of each crook: a few
            # soft ridges across the bone where the limb folds.
            crook = mask & ((part == "forearm") & (t < 0.18) | (part == "shin") & (t < 0.16))
            H += np.where(crook & (np.cos(np.radians(ang)) < -0.3),
                          0.08 * np.sin(2 * np.pi * along_ / 0.022), 0.0)
    # The fine knit of the fabric.
    grid = np.minimum(np.abs(np.sin(np.pi * P[..., 0] / 0.004)), np.abs(np.sin(np.pi * P[..., 2] / 0.004)))
    H += 0.03 * (grid - 0.5)
    return rgb, np.clip(H, 0, 1)


def _digit_seven(X, Y):
    """Whether (X, Y), each 0..1 across and up a digit's box, is on a 7."""
    poly = [(0.04, 1.0), (0.96, 1.0), (0.96, 0.86), (0.48, 0.0), (0.22, 0.0), (0.7, 0.83), (0.04, 0.83)]
    inside = np.zeros(X.shape, dtype=bool)
    j = len(poly) - 1
    for k in range(len(poly)):
        xi, yi = poly[k]
        xj, yj = poly[j]
        cross = ((yi > Y) != (yj > Y)) & (X < (xj - xi) * (Y - yi) / (yj - yi + 1e-9) + xi)
        inside ^= cross
        j = k
    return inside


def bib_image(C, size=512):
    """THE BIB'S PRINT: a race's red bib — a white band over its top with
    the race's marks in it, the number big in white on the red, a thin
    white rule along its foot."""
    W, Hh = size * 2, size
    u = (np.arange(W) + 0.5) / W
    v = (np.arange(Hh) + 0.5) / Hh
    U, V = np.meshgrid(u, v)
    img = np.empty((Hh, W, 4), dtype=np.float32)
    img[..., :3] = C["red"]
    img[..., 3] = 1.0
    dark = np.array(C["dark"], dtype=np.float32)
    white = np.array(C["white"], dtype=np.float32)
    band = (V > 0.72) & (V < 0.97)
    img[band, :3] = white
    img[(V < 0.06) & (V > 0.035), :3] = white
    for c0 in (0.25, 0.75):
        # The race's marks: dark blocks along the top band.
        for k in (-1.5, -0.5, 0.5, 1.5):
            blk = band & (np.abs(U - (c0 + k * 0.085)) < 0.03) & (V > 0.78) & (V < 0.91)
            img[blk, :3] = dark
        X = (U - (c0 - 0.11)) / 0.22
        Y = (V - 0.14) / 0.5
        box = (X >= 0) & (X <= 1) & (Y >= 0) & (Y <= 1)
        seven = box & _digit_seven(np.clip(X, 0, 1), np.clip(Y, 0, 1))
        img[seven, :3] = white
    return img


def paint(suit, bib, SUIT, BIB, G):
    tex = 1024 if G["GAME"] else 2048
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 16
    lib._select_only([suit])
    bpy.context.view_layer.objects.active = suit
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004)
    bpy.ops.object.mode_set(mode="OBJECT")
    where, facing = _float_map("suit_where", tex), _float_map("suit_facing", tex)
    _emit_only(SUIT, _coords("Object", 0.25, 0.5))
    _bake(SUIT, "EMIT", where)
    _emit_only(SUIT, _coords("Normal", 0.5, 0.5))
    _bake(SUIT, "EMIT", facing)
    P = (_pixels(where, tex)[..., :3] - 0.5) / 0.25
    N = _pixels(facing, tex)[..., :3] * 2 - 1
    N /= np.maximum(1e-6, np.linalg.norm(N, axis=-1, keepdims=True))
    rgb, H = design(P, N, G)
    colour = bpy.data.images.new("suit_colour", tex, tex)
    height = _float_map("suit_height", tex)
    colour.pixels.foreach_set(np.dstack([rgb, np.ones(rgb.shape[:2], dtype=np.float32)]).ravel())
    # The colour map is authored linear: stored as sRGB for the export.
    colour.colorspace_settings.name = "sRGB"
    lin = np.dstack([rgb, np.ones(rgb.shape[:2], dtype=np.float32)])
    srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(np.maximum(lin, 0), 1 / 2.4) - 0.055)
    srgb[..., 3] = 1.0
    colour.pixels.foreach_set(srgb.ravel())
    height.pixels.foreach_set(np.dstack([H, H, H, np.ones_like(H)]).ravel())
    # The NORMAL: the relief's bump on a plain diffuse, baked.
    normal = bpy.data.images.new("suit_normal", tex, tex, is_data=True)
    normal.colorspace_settings.name = "Non-Color"
    nt = SUIT.node_tree
    for nd in list(nt.nodes):
        if nd.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(nd)
    ht = nt.nodes.new("ShaderNodeTexImage")
    ht.image = height
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 1.0
    bump.inputs["Distance"].default_value = 0.004
    nt.links.new(ht.outputs["Color"], bump.inputs["Height"])
    dif = nt.nodes.new("ShaderNodeBsdfDiffuse")
    nt.links.new(bump.outputs["Normal"], dif.inputs["Normal"])
    nt.links.new(dif.outputs["BSDF"], nt.nodes.get("Material Output").inputs["Surface"])
    _bake(SUIT, "NORMAL", normal, normal_space="TANGENT")
    for im in (colour, normal):
        im.pack()
    bpy.data.images.remove(where)
    bpy.data.images.remove(facing)
    bpy.data.images.remove(height)
    # The suit's shader: the print on a satin stretch fabric.
    for nd in list(nt.nodes):
        if nd.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(nd)
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.name = "Principled BSDF"
    p.inputs["Roughness"].default_value = 0.34
    ct = nt.nodes.new("ShaderNodeTexImage")
    ct.image = colour
    nm_t = nt.nodes.new("ShaderNodeTexImage")
    nm_t.image = normal
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(nm_t.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], p.inputs["Normal"])
    nt.links.new(ct.outputs["Color"], p.inputs["Base Color"])
    nt.links.new(p.outputs["BSDF"], nt.nodes.get("Material Output").inputs["Surface"])

    # THE BIB's print, on its own unwrap.
    bimg = bpy.data.images.new("bib_print", 1024, 512)
    lin = bib_image(G["colours"], 512)
    srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(np.maximum(lin, 0), 1 / 2.4) - 0.055)
    srgb[..., 3] = 1.0
    bimg.pixels.foreach_set(srgb.ravel())
    bimg.pack()
    bt = BIB.node_tree
    bp = bt.nodes.get("Principled BSDF")
    t = bt.nodes.new("ShaderNodeTexImage")
    t.image = bimg
    bt.links.new(t.outputs["Color"], bp.inputs["Base Color"])
    # Every other part keeps a material of its own and needs no unwrap.
    for o in bpy.context.view_layer.objects:
        o.select_set(False)

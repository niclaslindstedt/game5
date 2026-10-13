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
# tabard with its own unwrap: yellow knit, a dark band across its top, the
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
        """A seam's welt where `d` crosses 0, `w` m wide; dark piping."""
        line = mask & (np.abs(d) < w)
        rgb[line] = np.array(C["dark"], dtype=np.float32)
        return np.where(mask, depth * np.exp(-((d / (w * 1.4)) ** 2)), 0.0)

    # THE TRUNK: red, the dark panel down each flank, white below the waist
    # band across the hips.
    spine = frame("spine")
    hc, SX, UP, AH, sl = v3(spine[0]), v3(spine[1]), v3(spine[2]), v3(spine[3]), spine[4]
    rel = P - hc
    up = rel @ UP
    trunk = on("spine")
    flank = np.abs(N @ SX)
    WAIST = 0.06 * sl
    paint(trunk, C["red"])
    paint(trunk & (up < WAIST), C["white"])
    paint(trunk & (flank > 0.82) & (up < 0.86 * sl), C["dark"])
    H += pipe(up - WAIST, 0.004, trunk & (flank < 0.82))
    H += pipe(flank - 0.82, 0.05, trunk & (up < 0.86 * sl))
    # The collar's dark rim.
    paint(trunk & (up > 0.985 * sl), C["dark"])

    for i, s in enumerate("lr"):
        # THE ARMS: the upper arm red to the elbow; the forearm white with a
        # red stripe down its outside and a dark padded panel over the guard.
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
            # The angle round the limb: 0 dead ahead (+z), +90° outward.
            ang = np.degrees(np.arctan2(rr @ o, rr @ f))
            if part == "upperarm":
                paint(mask, C["red"])
            elif part == "forearm":
                paint(mask, C["white"])
                stripe = np.abs(ang - 90) < 26
                paint(mask & stripe, C["red"])
                H += pipe(np.abs(ang - 90) - 26, 0.6 * 0.004 / 0.04 * 57, mask) * 0.0
                paint(mask & (t > 0.86), C["dark"])
            elif part == "thigh":
                # THE SWEEP: red from the hip's outside, swinging forward
                # down the thigh to the front of the knee, narrowing.
                paint(mask, C["white"])
                centre = 95 - 85 * np.clip(t, 0, 1)
                width = 48 - 28 * np.clip(t, 0, 1)
                d = np.abs(((ang - centre + 180) % 360) - 180) - width
                paint(mask & (d < 0) & (t < 0.92), C["red"])
                H += pipe(d * 0.0015, 0.0035, mask & (t < 0.92))
                # The dark side panel down the back of the outside.
                side = np.abs(((ang - 125 + 180) % 360) - 180) < 14
                paint(mask & side & (t < 0.85), C["dark"])
            else:
                # THE SHIN: the padded panel down its front, darker, under
                # the guard; the calf white.
                paint(mask, C["white"])
                pad = (np.abs(ang) < 70) & (t > 0.08)
                paint(mask & pad, (0.06, 0.065, 0.075))
                H += np.where(mask & pad, 0.12, 0.0)
                H += pipe(np.abs(ang) - 70, 0.6, mask & (t > 0.08)) * 0.0
            # The wrinkle of a stretch suit at the back of each crook: a few
            # soft ridges across the bone where the limb folds.
            crook = mask & ((part == "forearm") & (t < 0.18) | (part == "shin") & (t < 0.16))
            H += np.where(crook & (np.cos(np.radians(ang)) < -0.3),
                          0.08 * np.sin(2 * np.pi * (rr @ ax) / 0.022), 0.0)
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
    """THE BIB'S PRINT: yellow, a dark band over its top, the number in black
    on both panels, a white band of the race's marks along its foot."""
    W, Hh = size * 2, size
    u = (np.arange(W) + 0.5) / W
    v = (np.arange(Hh) + 0.5) / Hh
    U, V = np.meshgrid(u, v)
    img = np.empty((Hh, W, 4), dtype=np.float32)
    img[..., :3] = C["yellow"]
    img[..., 3] = 1.0
    dark = np.array(C["dark"], dtype=np.float32)
    white = np.array(C["white"], dtype=np.float32)
    band = (V > 0.7)
    img[band, :3] = dark
    foot = (V < 0.12) & (V > 0.03)
    img[foot, :3] = white
    for c0 in (0.25, 0.75):
        # The race's marks: three dark blocks along the foot's band.
        for k in (-1, 0, 1):
            blk = foot & (np.abs(U - (c0 + k * 0.11)) < 0.04) & (V > 0.055) & (V < 0.095)
            img[blk, :3] = dark
        # A thin white rule under the band.
        img[(np.abs(V - 0.68) < 0.008) & (np.abs(U - c0) < 0.24), :3] = white
        X = (U - (c0 - 0.1)) / 0.2
        Y = (V - 0.18) / 0.46
        box = (X >= 0) & (X <= 1) & (Y >= 0) & (Y <= 1)
        seven = box & _digit_seven(np.clip(X, 0, 1), np.clip(Y, 0, 1))
        img[seven, :3] = dark
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

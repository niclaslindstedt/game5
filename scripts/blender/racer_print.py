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


def _smooth(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def _halftone(P, N, b, pitch=0.009):
    """A HALFTONE of the share `b` (0 white, 1 the full ink): the dots a
    sublimated fade is printed in, on a lattice laid on whichever pair of
    axes the texel faces most squarely (a triplanar lattice, so a dot keeps
    its round on every face of him), each dot's area the share. 1 inked."""
    a = np.abs(N)
    pick = np.argmax(a, axis=-1)
    u = np.where(pick == 0, P[..., 1], P[..., 0])
    v = np.where(pick == 2, P[..., 1], P[..., 2])
    # Every other row half a pitch along: the printer's staggered screen.
    row = np.floor(v / pitch)
    u = u / pitch + 0.5 * (row % 2)
    v = v / pitch
    du, dv = u - np.floor(u) - 0.5, v - np.floor(v) - 0.5
    d = np.sqrt(du * du + dv * dv)
    r = np.sqrt(np.clip(b, 0, 1)) * 0.6
    return _smooth((r - d) / 0.06 + 0.5)


def design(P, N, G):
    """THE SUIT'S DESIGN at every texel: its colour (linear RGB) and its
    relief (0..1, 0.5 flat), off where on him it lies (`P`) and which way it
    faces (`N`), in Blender's frame of the pose he is bound in. `G` is the
    builder's frame, points and colours.

    The design is the AZURE team's fade, after its race suits seen at a
    finish and laid flat: one stretch fabric printed white over the
    shoulders and the chest, the ink coming in through a halftone below the
    chest to a deep azure over the waist, the seat and the thighs, and
    fading out again below the knee to white shins; the arms white at the
    shoulder and azure by the wrist. Over it a white zip down the front, the
    collar's tricolour at the nape, the team's badge on the left arm and
    the sponsors' wordmarks — plain blocks here, no name — down the outside
    of each leg."""
    frame = G["frame"]
    C = G["colours"]
    v3 = lambda v: np.array([v.x, v.y, v.z], dtype=np.float32)
    H = np.full(P.shape[:2], 0.5, dtype=np.float32)
    ink = np.zeros(P.shape[:2], dtype=np.float32)

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

    def seam(d, w, mask, depth=-0.16):
        """A seam's welt where `d` crosses 0, `w` wide: relief only, the
        print runs over it as a sublimated suit's does."""
        return np.where(mask, depth * np.exp(-((d / w) ** 2)), 0.0)

    # THE TRUNK: white over the chest, the ink in below it.
    spine = frame("spine")
    hc, SX, UP, AH, sl = v3(spine[0]), v3(spine[1]), v3(spine[2]), v3(spine[3]), spine[4]
    rel = P - hc
    up = rel @ UP / sl
    across = rel @ SX
    ahead = N @ AH
    trunk = on("spine")
    ink = np.where(trunk, 1.0 - _smooth((up - 0.3) / 0.42), ink)
    # The seams that shape a one-piece: down each flank and round the seat.
    H += seam(np.abs(N @ SX) - 0.86, 0.04, trunk & (up < 0.9))

    limbs = {}
    for i, s in enumerate("lr"):
        for part in ("upperarm", "forearm", "thigh", "shin"):
            n = f"{part}_{s}"
            head, x, y, z, length = segs[n]
            ref = G["hips"] if part in ("thigh", "shin") else G["neck"]
            base = G["shoulders"][i] if part in ("upperarm", "forearm") else head
            out = x if x.dot(base - ref) > 0 else -x
            o, f = v3(out), v3(z)
            mask = on(n)
            t = tpar[..., names.index(n)]
            rr = P - v3(head)
            ang = np.degrees(np.arctan2(rr @ o, rr @ f))
            limbs[n] = (mask, t, ang, rr, v3(y), length)
            if part == "upperarm":
                ink = np.where(mask, 0.45 * _smooth((t - 0.15) / 0.85), ink)
            elif part == "forearm":
                ink = np.where(mask, 0.45 + 0.55 * _smooth(t / 0.55), ink)
            elif part == "thigh":
                ink = np.where(mask, 1.0 - 0.4 * _smooth((t - 0.55) / 0.45), ink)
                H += seam(np.abs(((ang - 100 + 180) % 360) - 180) - 0.0, 3.0, mask)
            else:
                ink = np.where(mask, 0.6 * (1.0 - _smooth(t / 0.5)), ink)
                pad = (np.abs(ang) < 70) & (t > 0.08)
                H += np.where(mask & pad, 0.12, 0.0)
            crook = mask & ((part == "forearm") & (t < 0.18) | (part == "shin") & (t < 0.16))
            H += np.where(crook & (np.cos(np.radians(ang)) < -0.3),
                          0.08 * np.sin(2 * np.pi * (rr @ v3(y)) / 0.022), 0.0)

    # The ink as printed: solid where it is whole or nothing, a halftone
    # through the fade — and the azure deepening the heavier it is laid.
    dots = _halftone(P, N, ink)
    solid = (ink > 0.93) | (ink < 0.04)
    cover = np.where(solid, np.round(ink), 0.65 * dots + 0.35 * ink)
    white = np.array(C["white"], dtype=np.float32)
    light, deep = np.array(C["azure"], dtype=np.float32), np.array(C["deep"], dtype=np.float32)
    blue = light[None, None, :] + (deep - light)[None, None, :] * _smooth(ink)[..., None]
    rgb = white[None, None, :] + (blue - white[None, None, :]) * cover[..., None]

    def paint(mask, c):
        rgb[mask] = np.array(c, dtype=np.float32)

    # THE ZIP down the front, from the collar to the crotch: white tape and
    # its ridge.
    zip_ = trunk & (np.abs(across) < 0.005) & (ahead > 0.3) & (up < 0.985)
    paint(zip_, C["white"])
    H += np.where(trunk & (ahead > 0.3) & (up < 0.985), 0.14 * np.exp(-((across / 0.004) ** 2)), 0.0)
    # THE COLLAR: a navy rim, and the tricolour at the nape — green, white
    # and red across the back of the neck.
    collar = trunk & (up > 0.985)
    paint(trunk & (up > 1.085), C["navy"])
    nape = collar & (up < 1.075) & (ahead < -0.55)
    third = 0.014
    paint(nape & (across < -third / 2) & (across > -1.5 * third), C["green"])
    paint(nape & (np.abs(across) <= third / 2), C["white"])
    paint(nape & (across > third / 2) & (across < 1.5 * third), C["red"])

    # THE BADGE on the left arm: a navy hexagon ringed white, a white star of
    # three bars in it and the tricolour across its lower corner.
    mask, t, ang, rr, ax, length = limbs["upperarm_l"]
    cu = np.radians(ang - 90) * 0.05
    cv = (t - 0.42) * length
    hexd = np.maximum.reduce([np.abs(cu * np.cos(a) + cv * np.sin(a)) for a in np.radians([0, 60, 120])])
    R = 0.03
    badge = mask & (hexd < R)
    paint(badge, C["white"])
    paint(badge & (hexd < R - 0.0035), C["navy"])
    for a in np.radians([90, 30, 150]):
        bar = badge & (np.abs(-cu * np.sin(a) + cv * np.cos(a)) < 0.0024) & (np.hypot(cu, cv) < 0.6 * R)
        paint(bar, C["white"])
    corner = badge & (hexd < R - 0.0035) & (cv < -0.55 * R)
    for k, c in enumerate(("green", "white", "red")):
        paint(corner & (cu >= -R + k * 2 * R / 3) & (cu < -R + (k + 1) * 2 * R / 3), C[c])

    # THE WORDMARKS: a sponsor's name read down the outside of each thigh
    # (white on the azure) and each shin (navy on the white) — blocks the
    # height of a word's letters, no letters.
    rng = np.random.default_rng(7)
    for s in "lr":
        for part, t0, t1, c in (("thigh", 0.12, 0.8, "white"), ("shin", 0.3, 0.82, "navy")):
            mask, t, ang, rr, ax, length = limbs[f"{part}_{s}"]
            at = t * length
            cross_ = np.radians(ang - 90) * 0.06
            m = mask & (t > t0) & (t < t1) & (np.abs(cross_) < 0.016)
            x0 = t0 * length
            while x0 < t1 * length:
                w = rng.uniform(0.008, 0.016)
                tall = 0.016 if rng.random() < 0.75 else 0.024
                paint(m & (at > x0) & (at < x0 + w) & (cross_ > 0.016 - tall), C[c])
                x0 += w + 0.004 + (0.02 if rng.random() < 0.14 else 0.0)

    # The fine knit of the fabric.
    grid = np.minimum(np.abs(np.sin(np.pi * P[..., 0] / 0.004)), np.abs(np.sin(np.pi * P[..., 2] / 0.004)))
    H += 0.03 * (grid - 0.5)
    return rgb, np.clip(H, 0, 1)


def _poly(X, Y, poly):
    inside = np.zeros(X.shape, dtype=bool)
    j = len(poly) - 1
    for k in range(len(poly)):
        xi, yi = poly[k]
        xj, yj = poly[j]
        cross = ((yi > Y) != (yj > Y)) & (X < (xj - xi) * (Y - yi) / (yj - yi + 1e-9) + xi)
        inside ^= cross
        j = k
    return inside


DIGITS = {
    "1": [(0.4, 1.0), (0.66, 1.0), (0.66, 0.0), (0.4, 0.0), (0.4, 0.74), (0.2, 0.66), (0.2, 0.86)],
    "7": [(0.04, 1.0), (0.96, 1.0), (0.96, 0.86), (0.48, 0.0), (0.22, 0.0), (0.7, 0.83), (0.04, 0.83)],
}


def bib_image(C, size=512):
    """THE BIB'S PRINT: a red tabard, a navy band over its top ruled white
    with the tricolour under it, a white field with the number 17 in black
    on both panels, a white band of the race's marks along its foot."""
    W, Hh = size * 2, size
    u = (np.arange(W) + 0.5) / W
    v = (np.arange(Hh) + 0.5) / Hh
    U, V = np.meshgrid(u, v)
    img = np.empty((Hh, W, 4), dtype=np.float32)
    img[..., :3] = C["bib"]
    img[..., 3] = 1.0
    navy = np.array(C["navy"], dtype=np.float32)
    white = np.array(C["white"], dtype=np.float32)
    black = np.array(C["dark"], dtype=np.float32)
    img[V > 0.72, :3] = navy
    foot = (V < 0.12) & (V > 0.03)
    img[foot, :3] = white
    for c0 in (0.25, 0.75):
        for k in (-1, 0, 1):
            blk = foot & (np.abs(U - (c0 + k * 0.11)) < 0.04) & (V > 0.055) & (V < 0.095)
            img[blk, :3] = navy
        span = np.abs(U - c0) < 0.24
        img[(np.abs(V - 0.705) < 0.006) & span, :3] = white
        for k, c in enumerate(("green", "white", "red")):
            seg = (np.abs(V - 0.69) < 0.007) & (U >= c0 - 0.24 + k * 0.16) & (U < c0 - 0.24 + (k + 1) * 0.16)
            img[seg, :3] = C[c]
        field = (np.abs(U - c0) < 0.135) & (V > 0.2) & (V < 0.62)
        img[field, :3] = white
        for j, d in enumerate("17"):
            X = (U - (c0 - 0.12 + j * 0.12)) / 0.12
            Y = (V - 0.24) / 0.34
            box = (X >= 0) & (X <= 1) & (Y >= 0) & (Y <= 1)
            img[box & _poly(np.clip(X, 0, 1), np.clip(Y, 0, 1), DIGITS[d]), :3] = black
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

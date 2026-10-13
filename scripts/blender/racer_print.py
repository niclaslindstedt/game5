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
# tabard with its own unwrap: silver knit under a navy yoke ruled in red, the
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


def _hash(ix, iy, iz, salt=0):
    """A lattice point's value in 0..1 off its integer coordinates."""
    h = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (salt * 2654435761)
    h = (h ^ (h >> 13)) * 1274126177
    return ((h ^ (h >> 16)) & 0xFFFF).astype(np.float32) / 65535.0


def _noise(P, scale, salt=0):
    """Value noise over the body, -1..1, its cells `scale` m across."""
    Q = P / scale
    i = np.floor(Q).astype(np.int64)
    f = Q - i
    f = f * f * (3 - 2 * f)
    out = np.zeros(P.shape[:2], dtype=np.float32)
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[..., 0] if dx else 1 - f[..., 0]) * (f[..., 1] if dy else 1 - f[..., 1]) * (f[..., 2] if dz else 1 - f[..., 2])
                out += w * _hash(i[..., 0] + dx, i[..., 1] + dy, i[..., 2] + dz, salt)
    return out * 2 - 1


def _fbm(P, scale, octaves, salt=0):
    total, amp, norm = np.zeros(P.shape[:2], dtype=np.float32), 1.0, 0.0
    for o in range(octaves):
        total += amp * _noise(P, scale / 2 ** o, salt + o)
        norm += amp
        amp *= 0.55
    return total / norm


def _cracks(P, cell, salt=7):
    """How far each texel is from the nearest edge between two cells of a
    jittered lattice `cell` m across, m — the fine cracks of an ice sheet."""
    Q = P / cell
    i = np.floor(Q).astype(np.int64)
    d1 = np.full(P.shape[:2], 9.0, dtype=np.float32)
    d2 = np.full(P.shape[:2], 9.0, dtype=np.float32)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                c = i + np.array([dx, dy, dz])
                pt = c + np.stack([_hash(c[..., 0], c[..., 1], c[..., 2], salt + k) for k in range(3)], -1)
                d = np.linalg.norm(Q - pt, axis=-1)
                d2 = np.where(d < d1, d1, np.minimum(d2, d))
                d1 = np.minimum(d1, d)
    return (d2 - d1) * cell * 0.5


def _star(X, Y, r):
    """Whether (X, Y), m from a star's middle, is inside a five-point star
    of outer radius `r`."""
    a = np.arctan2(X, Y)
    k = np.abs(((a / (2 * np.pi / 5)) % 1.0) - 0.5) * 2
    rr = r * (0.42 + 0.58 * k ** 1.6)
    return np.hypot(X, Y) < rr


def design(P, N, G):
    """THE SUIT'S DESIGN at every texel: its colour (linear RGB) and its
    relief (0..1, 0.5 flat), off where on him it lies (`P`) and which way it
    faces (`N`), in Blender's frame of the pose he is bound in (x his LEFT,
    y ahead, z up). `G` is the builder's frame, points and colours.

    THE ICE FLOE: a white suit whose racer's LEFT side is flooded blue — his
    left arm deep blue to the glove, the blue reaching across his chest and
    belly and down the front of both thighs, its edge a broken coastline of
    floes (white islands in the blue, blue shards in the white), the blue
    pale at the coast and deepening inland, a few stars sunk in the belly's
    blue, and fine cracks running out over the white."""
    frame, hips, neck = G["frame"], G["hips"], G["neck"]
    C = G["colours"]
    v3 = lambda v: np.array([v.x, v.y, v.z], dtype=np.float32)
    H = np.full(P.shape[:2], 0.5, dtype=np.float32)
    rgb = np.zeros(P.shape[:2] + (3,), dtype=np.float32)

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

    def pipe(d, w, mask, depth=-0.18):
        """A seam's welt where `d` crosses 0, `w` m wide."""
        return np.where(mask, depth * np.exp(-((d / (w * 1.4)) ** 2)), 0.0)

    spine = frame("spine")
    hc, SX, UP, AH, sl = v3(spine[0]), v3(spine[1]), v3(spine[2]), v3(spine[3]), spine[4]
    rel = P - hc
    up = rel @ UP / sl          # 0 the hips, 1 the neck
    left = P[..., 0] - hc[0]    # m to his left of his middle
    ahead = N[..., 1]           # facing ahead (+1) or behind (-1)
    trunk = on("spine")
    flank = np.abs(N @ SX)

    # THE FIELD the blue is drawn from: above 0 blue, the higher the deeper.
    field = np.full(P.shape[:2], -1.0, dtype=np.float32)
    # The trunk: his left half flooded from the shoulder, the coast running
    # down across the sternum to his right hip; the belly blue across.
    tf = left * 7.5 + 0.35 * (0.62 - up) * 4 * np.clip(ahead, 0, 1) - 0.35
    tf = np.where((up < 0.62) & (up > 0.12), np.maximum(tf, 0.55 * np.clip(ahead, 0, 1) - 0.1), tf)
    tf = np.where(up < 0.12, tf - 0.4, tf)
    field = np.where(trunk, tf, field)
    for s in "lr":
        sign = 1.0 if s == "l" else -1.0
        for part in ("upperarm", "forearm", "thigh", "shin"):
            n = f"{part}_{s}"
            mask = on(n)
            t = tpar[..., names.index(n)]
            head, x, y, z, length = segs[n]
            rr = P - v3(head)
            inner = -sign * (rr[..., 0])  # m toward his middle
            front = rr @ v3(z) if part in ("thigh", "shin") else rr[..., 1]
            if part == "upperarm":
                f = 0.9 + 0.5 * t if s == "l" else -1.3 + 0.0 * t
            elif part == "forearm":
                f = np.full_like(t, 1.6) if s == "l" else np.full_like(t, -1.4)
            elif part == "thigh":
                base = 0.65 if s == "l" else 0.15
                f = base + 9 * inner + 6 * front - 0.9 * t
            else:
                base = 0.1 if s == "l" else -0.3
                f = base + 6 * inner + 4 * front - 1.6 * t
            field = np.where(mask, f, field)

    # The coast broken into floes.
    coast = field + 0.7 * _fbm(P, 0.14, 5, 3) + 0.22 * _noise(P, 0.028, 11)
    blue = coast > 0
    # White floes adrift in the blue near its coast, and blue shards out in
    # the white: each a cell of a coarse lattice kept or not.
    drift = _noise(P, 0.045, 23)
    blue = np.where((coast > 0) & (coast < 0.5) & (drift > 0.5), False, blue)
    blue = np.where((coast < 0) & (coast > -0.35) & (drift < -0.58), True, blue)
    deep = np.clip(field * 0.8 + 0.15 * _fbm(P, 0.09, 3, 17), 0, 1)
    ice, cobalt, navy = np.array(C["ice"]), np.array(C["blue"]), np.array(C["navy"])
    k1 = np.clip(deep * 2, 0, 1)[..., None]
    k2 = np.clip(deep * 2 - 1, 0, 1)[..., None]
    shade = ice * (1 - k1) + cobalt * k1
    shade = shade * (1 - k2) + navy * k2
    rgb[:] = np.array(C["white"], dtype=np.float32)
    rgb[blue] = shade[blue]
    # A pale rim of new ice along every floe's edge.
    rim = blue & (coast < 0.06)
    rgb[rim] = rgb[rim] * 0.45 + np.array(C["ice"]) * 0.55
    # The cracks out over the white near the coast, and fainter in the blue.
    cr = _cracks(P, 0.13)
    some = _noise(P, 0.11, 29) > 0.05
    near_coast = (coast > -0.55) & ~blue & some
    line = cr < 0.0009
    rgb[near_coast & line] = cobalt * 0.75 + ice * 0.25
    fine = blue & (cr < 0.0006) & (deep > 0.45) & some
    rgb[fine] = rgb[fine] * 0.6 + np.array(C["ice"]) * 0.4
    H += np.where((line & near_coast) | fine, -0.05, 0.0)

    # THE STARS sunk in the belly's blue: a jittered row across his front.
    belly = trunk & blue & (ahead > 0.35) & (up > 0.1) & (up < 0.6)
    gx, gz = 0.075, 0.085
    cx = np.floor(P[..., 0] / gx)
    cz = np.floor(P[..., 2] / gz)
    jx = (_hash(cx.astype(np.int64), cz.astype(np.int64), np.zeros_like(cx, dtype=np.int64), 31) - 0.5) * 0.4
    jz = (_hash(cx.astype(np.int64), cz.astype(np.int64), np.zeros_like(cx, dtype=np.int64), 37) - 0.5) * 0.4
    keep = _hash(cx.astype(np.int64), cz.astype(np.int64), np.ones_like(cx, dtype=np.int64), 41) > 0.45
    sx = P[..., 0] - (cx + 0.5 + jx) * gx
    sz = P[..., 2] - (cz + 0.5 + jz) * gz
    star = belly & keep & _star(sx, sz, 0.017)
    rgb[star] = rgb[star] * 0.55 + np.array(C["ice"]) * 0.45

    # THE CUT of the suit: the collar's navy rim, its side seams, the pads.
    rgb[trunk & (up > 0.985)] = navy
    H += pipe(flank - 0.86, 0.05, trunk & (up < 0.86))
    for i, s in enumerate("lr"):
        for part in ("forearm", "shin"):
            n = f"{part}_{s}"
            head, x, y, z, length = segs[n]
            o, f, ax = v3(x), v3(z), v3(y)
            mask = on(n)
            t = tpar[..., names.index(n)]
            rr = P - v3(head)
            ang = np.degrees(np.arctan2(rr @ o, rr @ f))
            if part == "shin":
                # The padded panel down its front, navy, under the guard.
                pad = (np.abs(ang) < 70) & (t > 0.08)
                rgb[mask & pad] = navy * 0.8
                H += np.where(mask & pad, 0.12, 0.0)
            else:
                rgb[mask & (t > 0.86)] = navy
            crook = mask & ((part == "forearm") & (t < 0.18) | (part == "shin") & (t < 0.16))
            H += np.where(crook & (np.cos(np.radians(ang)) < -0.3),
                          0.08 * np.sin(2 * np.pi * (rr @ ax) / 0.022), 0.0)
    # The fine knit of the fabric.
    grid = np.minimum(np.abs(np.sin(np.pi * P[..., 0] / 0.004)), np.abs(np.sin(np.pi * P[..., 2] / 0.004)))
    H += 0.03 * (grid - 0.5)
    return rgb, np.clip(H, 0, 1)


# The bib's number, a 4: its outline and the counter cut out of it, each
# 0..1 across and up the digit's box.
FOUR = [
    [(0.58, 1.0), (0.88, 1.0), (0.88, 0.36), (1.0, 0.36), (1.0, 0.19), (0.88, 0.19), (0.88, 0.0),
     (0.6, 0.0), (0.6, 0.19), (0.0, 0.19), (0.0, 0.37)],
    [(0.6, 0.36), (0.6, 0.7), (0.29, 0.36)],
]


def _digit(X, Y, polys=FOUR):
    """Whether (X, Y), each 0..1 across and up a digit's box, is inked (the
    even-odd rule over the digit's polygons)."""
    inside = np.zeros(X.shape, dtype=bool)
    for poly in polys:
        j = len(poly) - 1
        for k in range(len(poly)):
            xi, yi = poly[k]
            xj, yj = poly[j]
            cross = ((yi > Y) != (yj > Y)) & (X < (xj - xi) * (Y - yi) / (yj - yi + 1e-9) + xi)
            inside ^= cross
            j = k
    return inside


def bib_image(C, size=512):
    """THE BIB'S PRINT: silver-white knit, a navy yoke over its top with a
    red rule under it, the number big in navy on both panels, a navy band of
    the race's marks along its foot."""
    W, Hh = size * 2, size
    u = (np.arange(W) + 0.5) / W
    v = (np.arange(Hh) + 0.5) / Hh
    U, V = np.meshgrid(u, v)
    img = np.empty((Hh, W, 4), dtype=np.float32)
    img[..., :3] = C["silver"]
    img[..., 3] = 1.0
    navy = np.array(C["navy"], dtype=np.float32)
    white = np.array(C["white"], dtype=np.float32)
    red = np.array(C["red"], dtype=np.float32)
    img[V > 0.72, :3] = navy
    img[(V > 0.68) & (V <= 0.72), :3] = red
    foot = (V < 0.12) & (V > 0.03)
    img[foot, :3] = navy
    for c0 in (0.25, 0.75):
        for k in (-1, 0, 1):
            blk = foot & (np.abs(U - (c0 + k * 0.11)) < 0.04) & (V > 0.055) & (V < 0.095)
            img[blk, :3] = white
        X = (U - (c0 - 0.11)) / 0.22
        Y = (V - 0.18) / 0.45
        box = (X >= 0) & (X <= 1) & (Y >= 0) & (Y <= 1)
        img[box & _digit(np.clip(X, 0, 1), np.clip(Y, 0, 1)), :3] = navy
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

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


def _hash(ix, iy, iz, salt):
    """A cell's hash, 0..1, off its integer coordinates."""
    h = (ix.astype(np.int64) * 73856093) ^ (iy.astype(np.int64) * 19349663) ^ (iz.astype(np.int64) * 83492791)
    h = (h ^ (salt * 2654435761)) & 0xFFFFFFFF
    h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFFFF
    h = h ^ (h >> 16)
    return (h & 0xFFFFFF).astype(np.float32) / float(0xFFFFFF)


def shards(P, size, stretch, salt):
    """THE CAMOUFLAGE'S SHARDS: a Voronoi of jittered points over the body
    (`P`, m), its cells stretched along `stretch` (a scale a Blender axis)
    so they read as torn fragments rather than tiles. Returns each texel's
    cell hash (0..1) and how far it lies inside its cell (m to the edge,
    approximated by the gap between the two nearest points)."""
    Q = P / (np.array(stretch, dtype=np.float32) * size)
    base = np.floor(Q).astype(np.int64)
    best = np.full(Q.shape[:2], 1e9, dtype=np.float32)
    second = np.full(Q.shape[:2], 1e9, dtype=np.float32)
    cell = np.zeros(Q.shape[:2], dtype=np.float32)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                ix, iy, iz = base[..., 0] + dx, base[..., 1] + dy, base[..., 2] + dz
                jit = np.stack([_hash(ix, iy, iz, salt + k) for k in (1, 2, 3)], axis=-1)
                c = np.stack([ix, iy, iz], axis=-1).astype(np.float32) + 0.1 + 0.8 * jit
                d = np.linalg.norm(Q - c, axis=-1)
                closer = d < best
                second = np.where(closer, best, np.minimum(second, d))
                cell = np.where(closer, _hash(ix, iy, iz, salt + 7), cell)
                best = np.where(closer, d, best)
    return cell, (second - best) * size * 0.5


def design(P, N, G):
    """THE SUIT'S DESIGN at every texel: its colour (linear RGB) and its
    relief (0..1, 0.5 flat), off where on him it lies (`P`) and which way it
    faces (`N`), in Blender's frame of the pose he is bound in. `G` is the
    builder's frame, points and colours."""
    frame, hips, neck = G["frame"], G["hips"], G["neck"]
    C = {k: np.array(v, dtype=np.float32) for k, v in G["colours"].items()}
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
        rgb[mask] = c

    def seam(d, w, mask, depth=-0.14):
        """A seam's welt where `d` (m) crosses 0, `w` m wide: relief only —
        the print runs over it."""
        return np.where(mask, depth * np.exp(-((d / w) ** 2)), 0.0)

    def bump(mask, d, w, h):
        """A soft swell (a muscle under the stretch cloth, a pad), `h` high
        where `d` (m) is 0, gone a `w` out."""
        return np.where(mask, h * np.exp(-((d / w) ** 2)), 0.0)

    # THE GROUND: the wine red, and over it three layers of torn shards —
    # broad mid-red fragments, smaller bright ones, a few flaring splinters —
    # stretched up and down the body, thickest on the trunk and the thighs.
    paint(np.ones(P.shape[:2], dtype=bool), C["wine"])
    spine = frame("spine")
    hc, SX, UP, AH, sl = v3(spine[0]), v3(spine[1]), v3(spine[2]), v3(spine[3]), spine[4]
    rel = P - hc
    up = rel @ UP
    trunk = on("spine")
    thighs = on("thigh_l") | on("thigh_r")
    dense = np.where(trunk | thighs, 1.0, 0.55).astype(np.float32)
    # The shards fade off the lower legs and the forearms toward the cuffs.
    for layer, (size, stretch, salt, share, col, shade) in enumerate((
            (0.11, (0.7, 1.0, 1.6), 11, 0.42, "mid", 0.06),
            (0.065, (0.6, 1.0, 1.8), 23, 0.26, "bright", 0.05),
            (0.04, (0.5, 1.0, 2.2), 37, 0.09, "flare", 0.0))):
        cell, edge = shards(P, size, stretch, salt)
        on_ = cell < share * dense
        # Each fragment a shade of its own, and a darker torn rim inside its edge.
        k = 1.0 + shade * (2 * _hash(np.floor(cell * 997).astype(np.int64), np.int64(layer),
                                      np.int64(3), 5) - 1)
        c = C[col][None, None, :] * k[..., None]
        rim = on_ & (edge < 0.0035)
        rgb[on_] = c[on_]
        rgb[rim] = rgb[rim] * 0.82
        H += np.where(on_ & (edge < 0.002), 0.012, 0.0)

    # THE TRUNK: the zip's placket down the chest, the stand collar, the
    # raglan seams, the side seams, and the body under the cloth — the
    # chest, the shoulder blades over the plate, the seat.
    flank = N @ SX
    ahead = N @ AH
    across = rel @ SX
    zip_ = trunk & (ahead > 0.55) & (np.abs(across) < 0.013) & (up > 0.5 * sl) & (up < 0.97 * sl)
    paint(zip_, C["maroon"])
    teeth = zip_ & (np.abs(across) < 0.0035)
    paint(teeth, C["dark"])
    H += np.where(teeth, 0.1, 0.0) + seam(np.abs(across) - 0.013, 0.002, trunk & (ahead > 0.55) & (up > 0.5 * sl) & (up < 0.97 * sl))
    # The puller at its top.
    paint(trunk & (ahead > 0.55) & (np.abs(across) < 0.006) & (up > 0.9 * sl) & (up < 0.94 * sl), C["white"])
    paint(trunk & (up > 0.955 * sl), C["maroon"])
    H += seam(up - 0.955 * sl, 0.003, trunk)
    H += seam(np.abs(flank) - 0.93, 0.03, trunk & (up < 0.85 * sl), -0.1)
    chest = (up - 0.74 * sl)
    H += bump(trunk & (ahead > 0.3), np.hypot(chest, np.abs(across) - 0.075), 0.07, 0.07)
    H += bump(trunk & (ahead < -0.3), np.hypot(up - 0.06 * sl, np.abs(across) - 0.07), 0.07, 0.08)
    # A small white mark on his left chest, where a maker's would be.
    left = across > 0
    paint(trunk & left & (ahead > 0.4) & (np.abs(up - 0.82 * sl) < 0.011) & (np.abs(across - 0.075) < 0.03),
          C["white"])

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
            along_m = rr @ ax
            # The angle round the limb: 0 dead ahead (+z), +90° outward.
            ang = np.degrees(np.arctan2(rr @ o, rr @ f))
            if part == "upperarm":
                # THE WHITE PANEL down the outside, from the shoulder seam
                # to just past the elbow, its front edge curving forward
                # over the deltoid; a dark run of marks down its middle.
                half = 62 + 18 * (1 - np.clip(t / 0.3, 0, 1))
                d = np.abs(((ang - 100 + 180) % 360) - 180) - half
                white = mask & (d < 0)
                paint(white, C["white"])
                H += seam(d * 0.0012, 0.0025, mask)
                marks = white & (np.abs(((ang - 100 + 180) % 360) - 180) < 9) & (t > 0.22) & (t < 0.78)
                marks &= (np.sin(along_m / 0.0105 * np.pi) > -0.35)
                paint(marks, C["dark"])
                H += bump(mask, np.abs(((ang - 95 + 180) % 360) - 180) * 0.0012 + np.abs(t - 0.25) * 0.05, 0.05, 0.06)
            elif part == "forearm":
                # The panel runs on past the elbow and narrows away.
                d = np.abs(((ang - 100 + 180) % 360) - 180) - 50 * (1 - np.clip(t / 0.22, 0, 1))
                paint(mask & (d < 0) & (t < 0.22), C["white"])
                # The cuff under the glove's gauntlet.
                paint(mask & (t > 0.84), C["maroon"])
                H += seam(t * length - 0.84 * length, 0.003, mask)
            elif part == "thigh":
                # THE KNEE BAND starts above the knee: brighter red over
                # the pad, its top seam curving down to the back.
                top = 0.8 + 0.08 * np.clip(np.abs(ang) / 180, 0, 1)
                band = mask & (t > top)
                paint(band, C["red"])
                H += seam((t - top) * length, 0.003, mask)
                # The quadriceps under the cloth, the hamstrings behind.
                H += bump(mask, np.hypot(np.abs(ang) * 0.0011, (t - 0.45) * length * 0.6), 0.09, 0.11)
                H += bump(mask, np.hypot(np.abs(np.abs(ang) - 180) * 0.0011, (t - 0.4) * length * 0.6), 0.08, 0.06)
                # White marks down the front of the left thigh, slanted.
                if s == "l":
                    slant = ang * 0.0018 + along_m * 0.55
                    marks = mask & (np.abs(ang + 15) < 28) & (t > 0.25) & (t < 0.6)
                    marks &= (np.abs(((slant / 0.02) % 2) - 1) < 0.45) & (np.abs(ang + 15 - (t - 0.42) * 40) < 9)
                    paint(marks, C["white"])
                # The inside leg's seam.
                H += seam((np.abs(((ang + 90 + 180) % 360) - 180)) * 0.001, 0.002, mask & (t < top), -0.09)
            else:
                # THE SHIN: the knee band and its pad over the knee's front,
                # then the wine red down to the boot, and the calf's swell.
                band = mask & (t < 0.3 - 0.06 * np.clip(np.abs(ang) / 180, 0, 1))
                paint(band, C["red"])
                H += seam((t - (0.3 - 0.06 * np.clip(np.abs(ang) / 180, 0, 1))) * length, 0.003, mask)
                pad = mask & (np.abs(ang) < 55) & (t < 0.24)
                H += np.where(pad, 0.12, 0.0) + seam((np.abs(ang) - 55) * 0.0012, 0.002, mask & (t < 0.24))
                H += bump(mask, np.hypot(np.abs(np.abs(ang) - 170) * 0.0012, (t - 0.32) * length * 0.7), 0.06, 0.12)
                # A white mark down the outside of each shin.
                marks = mask & (np.abs(ang - 70) < 14) & (t > 0.42) & (t < 0.6)
                marks &= np.sin(along_m / 0.009 * np.pi) > -0.2
                paint(marks, C["white"])
            # The stretch cloth's soft ridges at the back of each crook,
            # where the limb folds.
            crook = mask & ((part == "forearm") & (t < 0.18) | (part == "shin") & (t < 0.16))
            H += np.where(crook & (np.cos(np.radians(ang)) < -0.3),
                          0.08 * np.sin(2 * np.pi * along_m / 0.022), 0.0)
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
    """THE BIB'S PRINT: white, a red band over its top, the number in black
    on both panels, a red band of the race's marks along its foot."""
    W, Hh = size * 2, size
    u = (np.arange(W) + 0.5) / W
    v = (np.arange(Hh) + 0.5) / Hh
    U, V = np.meshgrid(u, v)
    img = np.empty((Hh, W, 4), dtype=np.float32)
    img[..., :3] = C["white"]
    img[..., 3] = 1.0
    dark = np.array(C["dark"], dtype=np.float32)
    white = np.array(C["white"], dtype=np.float32)
    red = np.array(C["red"], dtype=np.float32)
    band = (V > 0.7)
    img[band, :3] = red
    foot = (V < 0.12) & (V > 0.03)
    img[foot, :3] = red
    for c0 in (0.25, 0.75):
        # The race's marks: three dark blocks along the foot's band.
        for k in (-1, 0, 1):
            blk = foot & (np.abs(U - (c0 + k * 0.11)) < 0.04) & (V > 0.055) & (V < 0.095)
            img[blk, :3] = white
        # A thin dark rule under the band, and a white mark in it.
        img[(np.abs(V - 0.68) < 0.008) & (np.abs(U - c0) < 0.24), :3] = dark
        img[(np.abs(V - 0.84) < 0.04) & (np.abs(U - c0) < 0.07), :3] = white
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

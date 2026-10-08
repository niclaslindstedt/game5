# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE TITLE SCENE'S WORLD: the mountain, the far ranges, the woods, the
# gates, the sky and the air — everything `title.py` stands the skier in.
#
# THE STYLE is the game's: a faceted, low-poly mountain (flat-shaded
# triangles sized to the lens, so a facet is the same few dozen pixels near
# and far), spruces that are the game's loaded conifers (a stack of drooping
# skirts, white where the snow lies on them, dark green under the lip —
# `tree-shapes.ts`'s read, at its variants' tiers, sides and taper), and
# the panel gates of a giant slalom in the palette's red and blue. THE
# LIGHT is a photograph's: a low sun, a sky that scatters it, snow that
# lets light into itself (subsurface), and air that fades every far slope
# toward the sky behind it — aerial perspective as a mix toward the haze
# by the view's own distance (`haze`), warmer looking into the sun.
#
# THE FRAME: Blender's, z up, metres. The skier stands at the origin on a
# face that rises to the right and away (`U`, the fall line's reverse,
# `layout`); the camera stands below him on the slope looking up and
# across it, the summit ridge filling the frame's top with a col cut in it
# on the sun's bearing from him, the face falling away to the left.

import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector, geometry

from lib import COL, link, mat



# ---------------------------------------------------------------- noise
def _hash(ix, iy, seed):
    h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFF) / float(0xFFFFFF)


def vnoise(x, y, seed=1):
    """Value noise in -1..1, smooth between integer lattice points."""
    x0, y0 = np.floor(x), np.floor(y)
    fx, fy = x - x0, y - y0
    ix, iy = x0.astype(np.int64), y0.astype(np.int64)
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = _hash(ix, iy, seed), _hash(ix + 1, iy, seed)
    c, d = _hash(ix, iy + 1, seed), _hash(ix + 1, iy + 1, seed)
    return (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy) * 2 - 1


def fbm(x, y, octaves=4, seed=1):
    out, amp, f, norm = 0.0, 1.0, 1.0, 0.0
    for o in range(octaves):
        out = out + amp * vnoise(x * f, y * f, seed + o * 17)
        norm += amp
        amp *= 0.5
        f *= 2.03
    return out / norm


def ridged(x, y, octaves=3, seed=5):
    """Sharp crests (1) between soft hollows (0): spurs and gullies."""
    out, amp, f, norm = 0.0, 1.0, 1.0, 0.0
    for o in range(octaves):
        out = out + amp * (1 - np.abs(vnoise(x * f, y * f, seed + o * 31))) ** 2
        norm += amp
        amp *= 0.5
        f *= 2.1
    return out / norm


# ---------------------------------------------------------------- the mountain
def _smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b + (a - b) * h - k * h * (1 - h)


def _smax(a, b, k):
    return -_smin(-a, -b, k)


def layout(P):
    """The scene's plan off the shot's bearings (° counter-clockwise off the
    lens's `P["yaw_cam"]`): the skier at the origin, the lens `cam_dist` m
    back off him along `skier_bearing`; the face rising along `up_bearing`
    (`U`) with `A` across it to its right. Writes the vectors into `P`."""
    yaw = math.radians(P["yaw_cam"])
    def unit(bearing):
        a = yaw + math.radians(bearing)
        return np.array([math.cos(a), math.sin(a)])
    U = unit(P["up_bearing"])
    P["U"], P["A"] = U, np.array([U[1], -U[0]])
    P["cam"] = -unit(P["skier_bearing"]) * P["cam_dist"]
    P["sun_az"] = yaw + math.radians(P["sun_bearing"])
    return P


def height(x, y, P):
    """The ground's height, m, about the skier's feet: ONE HERO FACE.

    Along the fall line (`u` m uphill of him) a concave profile, its pitch
    `t0` under his skis steepening to `t1` at the summit RIDGE `L` m up,
    where it breaks over a sharp crest (the cornice) onto a steep back
    side; below him it eases out into the valley floor `floor` m down.
    Across it (`a` m to the right) the ridge wanders, is cut by a deep
    `notch` (a col on the sun's bearing from him, off by `nb`° and `nw`°
    wide, that the low sun shines through, lighting a band of the
    face the skier carves in), and a SUMMIT stands on it, spurs and gullies run down the fall line, and past
    `shoulder` (m across, on one side) the face falls away into the valley. Noise breaks
    every surface into the facets' scale."""
    U, A = P["U"], P["A"]
    u = x * U[0] + y * U[1]
    a = x * A[0] + y * A[1]
    L, t0, t1 = P["face"]
    depth = -P["floor"]
    c = (t1 - t0) / (2 * L)
    up = np.maximum(u, 0)
    face = np.where(u >= 0, t0 * up + c * up * up, -depth * (1 - np.exp(t0 * np.minimum(u, 0) / depth)))
    # The ridge's line and the crest over it.
    # The notch: a col cut where the sun stands as seen from the skier.
    nb, nw, depth_n = P["notch"]
    phi = np.angle(np.exp(1j * (np.arctan2(y, x) - P["sun_az"] - math.radians(nb))))
    ridge_u = L + 90 * fbm(a / 420, 0.3, 3, seed=13) - depth_n * np.exp(-((phi / math.radians(nw)) ** 2))
    crest = t0 * ridge_u + c * ridge_u * ridge_u
    back = crest - 1.4 * np.maximum(u - ridge_u, 0)
    face = _smin(face, back + 40 * (u <= ridge_u), 6.0)
    face = np.minimum(face, crest + 4.0)
    # Spurs and gullies down the fall line, deepening up the face.
    rise = np.clip(u / L, 0, 1)
    face = face + (4 + 60 * rise) * (ridged(a / 140 + 0.2 * fbm(u / 300, a / 300, 2, seed=29), u / 900, 3, seed=19) - 0.45)
    # The summit on the ridge, left of the frame's middle.
    sa, sh, sr = P["summit"]
    face = face + sh * np.exp(-(((a - sa) / sr) ** 2 + ((u - ridge_u) / (1.6 * sr)) ** 2))
    # The shoulder: the face falling away to the right into the valley.
    w0, w1, side = P["shoulder"]
    m = np.clip((side * a - w0) / (w1 - w0), 0, 1)
    m = m * m * (3 - 2 * m)
    floor = -depth + 25 * fbm(x / 900, y / 900, 3, seed=3)
    z = face + (floor - face) * m
    z = np.maximum(z, floor)
    return z + 1.4 * fbm(x / 26, y / 26, 3, seed=41) + 2.5 * fbm(x / 130, y / 130, 2, seed=47) * np.clip(np.hypot(x, y) / 40, 0, 1)


def terrain(P, cam, yaw, half_fov, materials):
    """The mountain as ONE faceted mesh: points jittered over the view's
    wedge (and a margin for the shadows the crest casts), as dense as a
    facet of `P["facet"]` radians across at their distance from the lens,
    joined by a Delaunay triangulation and lifted by `height`; flat shaded,
    rock where a facet stands steeper than `P["rock"]` degrees."""
    rng = np.random.default_rng(7)
    pts = []
    r = 3.0
    while r < 16000:
        step = max(1.6, r * P["facet"])
        n = int(2 * (half_fov + 0.7) * r / step) + 1
        a = yaw + np.linspace(-(half_fov + 0.7), half_fov + 0.7, n)
        # Scattered through the ring's whole width and well across, so the
        # facets lie as a mosaic and never line up into rings.
        rr = r + rng.uniform(0, 1, n) * step
        aa = a + rng.uniform(-0.5, 0.5, n) * step / r
        pts.append(np.stack([cam[0] + rr * np.cos(aa), cam[1] + rr * np.sin(aa)], 1))
        r += step
    # Behind the lens a little, so the foreground has ground under it.
    for rr in np.linspace(1, 40, 14):
        a = np.linspace(0, 2 * math.pi, 24, endpoint=False)
        pts.append(np.stack([cam[0] + rr * np.cos(a), cam[1] + rr * np.sin(a)], 1))
    xy = np.concatenate(pts)
    verts2 = [Vector((float(a), float(b))) for a, b in xy]
    out = geometry.delaunay_2d_cdt(verts2, [], [], 0, 1e-4)
    vco, faces = out[0], out[2]
    # The CDT may merge or reorder points: lift each by its own height.
    vz = height(np.array([v.x for v in vco]), np.array([v.y for v in vco]), P)
    me = bpy.data.meshes.new("mountain")
    me.from_pydata([(v.x, v.y, float(h)) for v, h in zip(vco, vz)], [], [tuple(f) for f in faces])
    for m in materials:
        me.materials.append(m)
    cos_rock = math.cos(math.radians(P["rock"]))
    for poly in me.polygons:
        poly.use_smooth = False
        poly.material_index = 1 if poly.normal.z < cos_rock else 0
    ob = link(bpy.data.objects.new("mountain", me))
    return ob


def far_range(name, cam, dist, yaw0, yaw1, base, rise, seed, facet, materials):
    """A far range as a faceted wall of peaks along an arc `dist` m from the
    lens, from bearing `yaw0` to `yaw1`: a crest line of noise, its face
    falling to `base`, triangulated coarse."""
    n = max(8, int((yaw1 - yaw0) * dist / (dist * facet * 1.6)))
    rows = 7
    verts, faces = [], []
    for j in range(rows):
        t = j / (rows - 1)
        for i in range(n + 1):
            a = yaw0 + (yaw1 - yaw0) * i / n
            crest = rise * (0.55 + 0.45 * float(fbm(np.array(i / n * 6.0), np.array(seed * 1.0), 4, seed)))
            crest += rise * 0.35 * float(ridged(np.array(i / n * 13.0), np.array(seed * 2.0), 2, seed + 3))
            jitter = 0.03 * dist * float(vnoise(np.array(i * 1.7), np.array(j * 2.3), seed + 9))
            d = dist + t * dist * 0.18 + jitter
            zz = base + crest * (1 - t) ** 1.6 * (1 - 0.12 * t) - t * 60
            verts.append((cam[0] + d * math.cos(a), cam[1] + d * math.sin(a), zz))
    for j in range(rows - 1):
        for i in range(n):
            a0 = j * (n + 1) + i
            faces += [(a0, a0 + 1, a0 + n + 2), (a0, a0 + n + 2, a0 + n + 1)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    for m in materials:
        me.materials.append(m)
    for poly in me.polygons:
        poly.use_smooth = False
        poly.material_index = 1 if poly.normal.z < 0.62 else 0
    return link(bpy.data.objects.new(name, me))


# ---------------------------------------------------------------- materials
def haze(m, colour_near, colour_sun, sun_dir, reach):
    """Aerial perspective on material `m`: its surface mixed toward the
    haze by 1 − e^(−d / reach) of the view's distance, the haze warmer
    looking toward the sun."""
    nt = m.node_tree
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    surf = out.inputs["Surface"].links[0].from_socket
    cam = nt.nodes.new("ShaderNodeCameraData")
    k = nt.nodes.new("ShaderNodeMath")
    k.operation = "MULTIPLY"
    k.inputs[1].default_value = -1.0 / reach
    nt.links.new(cam.outputs["View Distance"], k.inputs[0])
    e = nt.nodes.new("ShaderNodeMath")
    e.operation = "EXPONENT"
    nt.links.new(k.outputs[0], e.inputs[0])
    fac = nt.nodes.new("ShaderNodeMath")
    fac.operation = "SUBTRACT"
    fac.inputs[0].default_value = 1.0
    fac.use_clamp = True
    nt.links.new(e.outputs[0], fac.inputs[1])
    # Toward the sun: the incoming ray points back at the lens.
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = tuple(-c for c in sun_dir)
    nt.links.new(geo.outputs["Incoming"], dot.inputs[0])
    pw = nt.nodes.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.use_clamp = True
    pw.inputs[1].default_value = 6.0
    nt.links.new(dot.outputs["Value"], pw.inputs[0])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = (*colour_near, 1)
    mix.inputs[7].default_value = (*colour_sun, 1)
    nt.links.new(pw.outputs[0], mix.inputs[0])
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(mix.outputs[2], em.inputs["Color"])
    ms = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fac.outputs[0], ms.inputs[0])
    nt.links.new(surf, ms.inputs[1])
    nt.links.new(em.outputs[0], ms.inputs[2])
    nt.links.new(ms.outputs[0], out.inputs["Surface"])
    return m


def aov(m, name, value=1.0, socket=None):
    """An AOV the plates read (`snow`, `glow`): a constant or a socket."""
    nt = m.node_tree
    a = nt.nodes.new("ShaderNodeOutputAOV")
    a.aov_name = name
    if socket is not None:
        nt.links.new(socket, a.inputs["Value"])
    else:
        a.inputs["Value"].default_value = value
    return m


def snow_material(name, colour, shadow_tint):
    """Snow: a bright diffuse that lets light in (subsurface, its mean free
    path bluer than red, as ice's absorption has it), a soft sheen of
    specular, a faint grain bumped in."""
    m = mat(name, colour, rough=0.42)
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Subsurface Weight"].default_value = 0.35
    p.inputs["Subsurface Radius"].default_value = (0.35, 0.65, 1.0)
    p.inputs["Subsurface Scale"].default_value = 0.06
    p.inputs["Specular IOR Level"].default_value = 0.35
    nt = m.node_tree
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 140.0
    tex.inputs["Detail"].default_value = 3.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    nt.links.new(tex.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    return aov(m, "snow")


def rock_material(name, colour):
    """Rock in the cold shade of a winter face, dusted where it lies flatter."""
    return mat(name, colour, rough=0.85)


# ---------------------------------------------------------------- the woods
def spruce_mesh(name, form, needle, needle_dark, snow, rng):
    """A loaded spruce of unit height: `tiers` drooping skirts of `sides`
    boughs, narrowing up the tree by `taper`, each skirt WHITE on its upper
    face (the snow on it) and dark green under its lip, over a trunk —
    the game's conifer read (`tree-shapes.ts`), cut chunky."""
    tiers, sides, taper = form["tiers"], form["sides"], form["taper"]
    load = form.get("snow", 0.8)
    droop = 0.11 * form.get("droop", 1.0)
    bm = bmesh.new()
    mats = [needle, needle_dark, snow, mat(name + "-bark", (0.06, 0.04, 0.03), rough=0.9)]
    base, top = 0.12, 1.0
    for t in range(tiers):
        f0 = t / tiers
        y0 = base + (top - base) * f0 * 0.92
        y1 = y0 + (top - base) / tiers * 1.9
        rad = 0.42 * (1 - f0) ** (taper * 0.85) + 0.05
        rot = rng.uniform(0, 2 * math.pi)
        rim, lip, cap = [], [], []
        for i in range(sides):
            a = rot + 2 * math.pi * i / sides
            rr = rad * (1 + rng.uniform(-0.18, 0.12))
            rim.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), y0 - droop * rad)))
            cap.append(bm.verts.new((0.55 * rr * math.cos(a + 0.3), 0.55 * rr * math.sin(a + 0.3), y0 + (y1 - y0) * 0.35)))
            lip.append(bm.verts.new((0.4 * rr * math.cos(a), 0.4 * rr * math.sin(a), y0 + 0.02)))
        apex = bm.verts.new((rng.uniform(-0.01, 0.01), rng.uniform(-0.01, 0.01), y1))
        for i in range(sides):
            j = (i + 1) % sides
            # The skirt's top: snow over the outer half where the load is.
            f = bm.faces.new((rim[i], rim[j], cap[j], cap[i]))
            f.material_index = 2 if rng.uniform() < load else 0
            g = bm.faces.new((cap[i], cap[j], apex))
            g.material_index = 2 if rng.uniform() < load * 0.7 else 0
            # Under the lip: the dark of the needles out of the light.
            h = bm.faces.new((rim[j], rim[i], lip[i], lip[j]))
            h.material_index = 1
    trunk = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.03, radius2=0.02, depth=0.3)
    for v in trunk["verts"]:
        v.co.z += 0.12
    for f in bm.faces:
        if all(v in trunk["verts"] for v in f.verts):
            f.material_index = 3
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = False
    ob = bpy.data.objects.new(name, me)
    return ob


def spruce_collection(forms, needle, needle_dark, snow):
    """Each spruce variant as a collection to instance."""
    rng = np.random.default_rng(3)
    cols = []
    for i, form in enumerate(forms):
        c = bpy.data.collections.new(f"spruce{i}")
        ob = spruce_mesh(f"spruce{i}", form, needle, needle_dark, snow, rng)
        c.objects.link(ob)
        cols.append(c)
    return cols


def plant(cols, spots, rng):
    """A spruce of a random variant at each `(x, y, z, h)`."""
    holder = bpy.data.objects.new("woods", None)
    COL.objects.link(holder)
    for k, (x, y, z, h) in enumerate(spots):
        e = bpy.data.objects.new(f"tree{k}", None)
        e.instance_type = "COLLECTION"
        e.instance_collection = cols[int(rng.integers(len(cols)))]
        e.location = (x, y, z - 0.08 * h)
        w = h * rng.uniform(0.8, 1.15)
        e.scale = (w * 0.95, w * 0.95, h)
        e.rotation_euler = (rng.normal(0, 0.03), rng.normal(0, 0.03), rng.uniform(0, 2 * math.pi))
        e.parent = holder
        COL.objects.link(e)
    return holder


# ---------------------------------------------------------------- the gates
def gate(name, foot, fall, side, panel_mat, pole_mat):
    """A giant slalom gate: two poles 0.75 m apart across the fall line with
    a panel stretched between them, standing a little off plumb."""
    across = Vector((-fall.y, fall.x, 0)).normalized() * side
    parts = []
    for k in (0, 1):
        a = foot + across * (0.75 * k)
        b = a + Vector((0, 0, 1.8)) + fall * 0.06
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.016, radius2=0.016, depth=1.8)
        me = bpy.data.meshes.new(f"{name}-pole{k}")
        bm.to_mesh(me)
        bm.free()
        me.materials.append(pole_mat)
        ob = link(bpy.data.objects.new(f"{name}-pole{k}", me))
        ob.location = (a + b) / 2
        ob.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
        parts.append(ob)
    lo = foot + Vector((0, 0, 0.95))
    corners = [lo, lo + across * 0.75, lo + across * 0.75 + Vector((0, 0, 0.62)), lo + Vector((0, 0, 0.62))]
    me = bpy.data.meshes.new(f"{name}-panel")
    me.from_pydata([tuple(c + fall * 0.04) for c in corners], [], [(0, 1, 2, 3)])
    me.materials.append(panel_mat)
    parts.append(link(bpy.data.objects.new(f"{name}-panel", me)))
    return parts


def hexlin(h):
    """A palette colour (`#rrggbb` or an int) as linear RGB."""
    if isinstance(h, str):
        h = int(h.lstrip("#"), 16)
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 for c in ((h >> 16) & 255, (h >> 8) & 255, h & 255))


def sun_vector(elevation, azimuth):
    """The direction TOWARD the sun, from its elevation and its bearing
    (radians, counter-clockwise from +x)."""
    return Vector((math.cos(elevation) * math.cos(azimuth), math.cos(elevation) * math.sin(azimuth), math.sin(elevation)))


def sky(P, sun_dir, tint_zenith, halo=(1.0, 0.7, 0.45)):
    """The world: a multiple-scattering sky under the sun's elevation and
    bearing — the sun's disc shown only to the camera (the lamp lights the
    scene), the zenith deepened toward the palette's dusk."""
    w = bpy.data.worlds.new("sky")
    bpy.context.scene.world = w
    nt = w.node_tree
    nt.nodes.clear()
    el = math.asin(sun_dir.z)
    rot = math.pi / 2 - math.atan2(sun_dir.y, sun_dir.x)  # the sky's bearing runs clockwise from +y
    def skytex(disc):
        s = nt.nodes.new("ShaderNodeTexSky")
        s.sky_type = "MULTIPLE_SCATTERING"
        s.sun_disc = disc
        s.sun_size = math.radians(0.7)
        s.sun_intensity = P["disc"]
        s.sun_elevation = el
        s.sun_rotation = rot
        s.altitude = P["altitude"]
        s.air_density = P["air"]
        s.aerosol_density = P["dust"]
        s.ozone_density = 1.0
        return s
    lit, seen = skytex(False), skytex(True)
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    def bg(s, k):
        b = nt.nodes.new("ShaderNodeBackground")
        b.inputs["Strength"].default_value = k
        # The zenith pulled toward the palette's dusk, the horizon kept.
        geo = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(geo.outputs["Generated"], sep.inputs[0])
        ramp = nt.nodes.new("ShaderNodeMapRange")
        ramp.inputs["From Min"].default_value = 0.02
        ramp.inputs["From Max"].default_value = 0.3
        nt.links.new(sep.outputs["Z"], ramp.inputs["Value"])
        m = nt.nodes.new("ShaderNodeMix")
        m.data_type = "RGBA"
        m.blend_type = "MULTIPLY"
        m.inputs[7].default_value = (*tint_zenith, 1)
        nt.links.new(ramp.outputs["Result"], m.inputs[0])
        nt.links.new(s.outputs["Color"], m.inputs[6])
        # The glow round a low sun through the valley's air: a warm halo
        # falling off as a power of the angle from the disc.
        dot = nt.nodes.new("ShaderNodeVectorMath")
        dot.operation = "DOT_PRODUCT"
        dot.inputs[1].default_value = tuple(sun_dir)
        nt.links.new(geo.outputs["Generated"], dot.inputs[0])
        pw = nt.nodes.new("ShaderNodeMath")
        pw.operation = "POWER"
        pw.use_clamp = True
        pw.inputs[1].default_value = P["halo"][1]
        nt.links.new(dot.outputs["Value"], pw.inputs[0])
        glow = nt.nodes.new("ShaderNodeMix")
        glow.data_type = "RGBA"
        glow.blend_type = "ADD"
        glow.inputs[7].default_value = tuple(P["halo"][0] * c for c in halo) + (1,)
        nt.links.new(pw.outputs[0], glow.inputs[0])
        nt.links.new(m.outputs[2], glow.inputs[6])
        nt.links.new(glow.outputs[2], b.inputs["Color"])
        return b
    # The sky the scene is lit by is dimmer than the sky the lens sees, so
    # the shade stays deep and blue under a luminous sky.
    b_lit, b_seen = bg(lit, P["fill"]), bg(seen, P["sky"])
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
    nt.links.new(b_lit.outputs[0], mix.inputs[1])
    nt.links.new(b_seen.outputs[0], mix.inputs[2])
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return w


def sun_lamp(sun_dir, P):
    """The sun: a warm key (a blackbody of `P["kelvin"]`), a little wider
    than the true disc so the shadows' edges soften with distance."""
    lamp = bpy.data.lights.new("sun", "SUN")
    lamp.energy = P["sun"]
    lamp.angle = math.radians(0.9)
    lamp.use_nodes = True
    nt = lamp.node_tree
    bb = nt.nodes.new("ShaderNodeBlackbody")
    bb.inputs["Temperature"].default_value = P["kelvin"]
    nt.links.new(bb.outputs["Color"], nt.nodes["Emission"].inputs["Color"])
    ob = bpy.data.objects.new("sun", lamp)
    COL.objects.link(ob)
    ob.rotation_euler = (-sun_dir).to_track_quat("-Z", "Y").to_euler()
    return ob

# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# WHAT THE TITLE SCENE'S SKIER LEAVES: his TRACKS — the logo's own double
# S (`MARK_TRAILS`, `app-mark.ts`) laid down the face behind him as two
# grooves a ski's width apart — and the SPRAY his outside edge throws, the
# hero of the backlit frame: a crescent of grains flown off the edge and a
# mist of fine powder round it, frozen mid-arc.
#
# The tracks are ribbons draped on the snow (raycast onto the faceted
# mesh), their width held to a few pixels at any distance so the line up
# the face reads as the mark does; a groove is a bump across the ribbon,
# shadowed on one wall and lit on the other by the low sun.
#
# The spray is BALLISTIC, not painted: every grain left the edge some
# fraction of a second ago with the speed the edge shears it off at (out
# of the turn, up, and carrying a share of the skier's own speed), and has
# flown since under gravity and the air's drag, as the snow cloud's plan
# flies its puffs (`snow-cloud-plan.ts`); the grains are a point cloud the
# renderer draws as spheres, the mist a volume grown off a sparser cut of
# the same points.

import math
import re

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from lib import COL, link


# ---------------------------------------------------------------- the mark
def _arc_points(x0, y0, r, large, sweep, x1, y1, n):
    """An SVG circular arc (rx = ry, no rotation) as `n` points."""
    dx, dy = (x0 - x1) / 2, (y0 - y1) / 2
    d2 = dx * dx + dy * dy
    k = math.sqrt(max(0.0, (r * r - d2) / d2))
    if large == sweep:
        k = -k
    cx, cy = k * dy + (x0 + x1) / 2, -k * dx + (y0 + y1) / 2
    a0 = math.atan2(y0 - cy, x0 - cx)
    a1 = math.atan2(y1 - cy, x1 - cx)
    da = a1 - a0
    if sweep and da < 0:
        da += 2 * math.pi
    if not sweep and da > 0:
        da -= 2 * math.pi
    return [(cx + r * math.cos(a0 + da * i / n), cy + r * math.sin(a0 + da * i / n)) for i in range(1, n + 1)]


def mark_path(d, n=40):
    """One of the mark's trails (`M … A … A …`) as a polyline."""
    nums = [float(t) for t in re.findall(r"-?\d+(?:\.\d+)?", d)]
    x, y = nums[0], nums[1]
    out = [(x, y)]
    i = 2
    while i + 7 <= len(nums):
        r, _, _, large, sweep, x1, y1 = nums[i:i + 7]
        out += _arc_points(x, y, r, int(large), int(sweep), x1, y1, n)
        x, y = x1, y1
        i += 7
    return np.array(out)


def centreline(trails):
    """The S between the mark's two trails, from its top to its foot,
    resampled evenly along its length."""
    a, b = mark_path(trails[0]), mark_path(trails[1])
    m = min(len(a), len(b))
    mid = (a[:m] + b[:m]) / 2
    seg = np.linalg.norm(np.diff(mid, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    t = np.linspace(0, s[-1], 400)
    return np.stack([np.interp(t, s, mid[:, 0]), np.interp(t, s, mid[:, 1])], 1)


# ---------------------------------------------------------------- the tracks
def bvh_of(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    return BVHTree.FromObject(ob, dg)


def drape(bvh, x, y):
    hit = bvh.ray_cast(Vector((x, y, 5000.0)), Vector((0, 0, -1)))
    return (hit[0], hit[1]) if hit[0] is not None else (None, None)


def tracks(mark, foot_uv, top_uv, ray_of, bvh, cam, material, squash=1.0, stance=0.26, sink=0.025):
    """The mark's S cut into the snow AS THE LENS SEES IT: its centreline
    laid in the frame from `foot_uv` (behind his tails) up to `top_uv`
    (under the summit) — turned and stretched so its chord spans the two,
    narrowed across it by `squash` — and every point of it cast through
    the lens onto the snow (`ray_of(u, v)` the world ray), so the logo's
    own S reads in the picture however the face is foreshortened. Two
    grooves `stance` apart (wider far off, so a far track still reads),
    each a ribbon with u along it and v across."""
    c = centreline(mark["trails"])[::-1]  # from the foot up; y is down, as the frame's v
    c = c - c[0]
    chord = np.array(top_uv) - np.array(foot_uv)
    z = complex(*chord) / complex(*c[-1])
    w = (c[:, 0] + 1j * c[:, 1]) * z
    ch = complex(*chord) / abs(complex(*chord))
    along = (w * ch.conjugate()).real
    across = (w * ch.conjugate()).imag * squash
    w = (along + 1j * across) * ch
    uv = np.stack([w.real, w.imag], 1) + np.array(foot_uv)
    # Resample evenly in the frame, then onto the snow.
    seg = np.linalg.norm(np.diff(uv, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    samples = []
    for t in np.arange(0, s[-1], 0.0015):
        p = (float(np.interp(t, s, uv[:, 0])), float(np.interp(t, s, uv[:, 1])))
        hit = bvh.ray_cast(cam, ray_of(*p))[0]
        if hit is not None:
            samples.append(np.array(hit))
    objs = []
    for k, off in enumerate((-stance / 2, stance / 2)):
        verts, faces, uvs = [], [], []
        for i, p in enumerate(samples):
            q = samples[min(i + 1, len(samples) - 1)] - samples[max(i - 1, 0)]
            q = Vector(tuple(q)).normalized()
            hit, n = drape(bvh, p[0], p[1])
            if hit is None:
                hit, n = Vector(tuple(p)), Vector((0, 0, 1))
            across_w = n.cross(q).normalized()
            d = (hit - cam).length
            wd = max(0.08, d * 0.0022)
            gap = max(off, math.copysign(wd * 1.1, off), key=abs)
            for j, side in enumerate((-0.5, 0.5)):
                xy = hit + across_w * (gap + side * wd)
                h2, n2 = drape(bvh, xy.x, xy.y)
                verts.append(tuple((h2 if h2 is not None else xy) + n * sink))
                uvs.append((i * 0.5, j))
        for i in range(len(samples) - 1):
            a = 2 * i
            # A jump across an occluding edge is left open.
            if (Vector(verts[a + 2]) - Vector(verts[a])).length > 40:
                continue
            faces.append((a, a + 2, a + 3, a + 1))
        me = bpy.data.meshes.new(f"track{k}")
        me.from_pydata(verts, [], faces)
        uvl = me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            for li in poly.loop_indices:
                uvl.data[li].uv = uvs[me.loops[li].vertex_index]
        me.materials.append(material)
        objs.append(link(bpy.data.objects.new(f"track{k}", me)))
    return objs


def groove_material(base):
    """The snow, with a groove pressed across the ribbon's v: its floor and
    the wall away from the sun darker (in their own shade), its lip bright."""
    m = base.copy()
    m.name = "groove"
    nt = m.node_tree
    p = nt.nodes.get("Principled BSDF")
    uv = nt.nodes.new("ShaderNodeUVMap")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(uv.outputs["UV"], sep.inputs[0])
    # height = -(1 - (2v - 1)²): a round groove across the ribbon
    a = nt.nodes.new("ShaderNodeMath"); a.operation = "MULTIPLY_ADD"
    a.inputs[1].default_value = 2.0; a.inputs[2].default_value = -1.0
    nt.links.new(sep.outputs["Y"], a.inputs[0])
    sq = nt.nodes.new("ShaderNodeMath"); sq.operation = "MULTIPLY"
    nt.links.new(a.outputs[0], sq.inputs[0]); nt.links.new(a.outputs[0], sq.inputs[1])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.03
    nt.links.new(sq.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    # The groove's floor holds its own shade.
    dark = nt.nodes.new("ShaderNodeMix"); dark.data_type = "RGBA"
    dark.inputs[6].default_value = (0.3, 0.4, 0.58, 1)
    dark.inputs[7].default_value = tuple(p.inputs["Base Color"].default_value)
    nt.links.new(sq.outputs[0], dark.inputs[0])
    nt.links.new(dark.outputs[2], p.inputs["Base Color"])
    return m


# ---------------------------------------------------------------- the spray
def spray_points(emit, along, out, up, speed, n, rng, g=9.81):
    """`n` grains of the rooster tail: each left the edge somewhere between
    the boot and the tail (`emit` ± `along`) a moment ago, sheared off out
    of the turn and up with a share of his speed kept forward, and has
    flown since under gravity and the air's drag (a grain's terminal speed
    of a few metres a second). Positions in the world, radii in metres,
    ages in seconds."""
    age = rng.uniform(0, 1, n) ** 1.6 * 0.75
    s = rng.uniform(-0.4, 1.0, n)
    # The shear's velocity: out and up, faster for the grains thrown early
    # in a stroke, a cone of scatter round it.
    v_out = rng.normal(4.6, 1.1, n)
    v_up = rng.normal(4.2, 1.0, n)
    v_fwd = speed * rng.uniform(0.15, 0.4, n)
    v_side = rng.normal(0, 0.6, n)
    drag = 1.6  # 1/s: a grain's speed falls by e in ~0.6 s
    k = (1 - np.exp(-drag * age)) / drag
    # Seen from the skier the grains are left behind at his speed, less
    # the share each kept.
    rel_back = speed * age - v_fwd * k
    fall = g * (age - k) / drag
    pos = (emit[None, :] + along[None, :] * s[:, None] * 0.45
           + out[None, :] * (v_out * k)[:, None]
           + up[None, :] * (v_up * k - fall)[:, None]
           - along[None, :] * rel_back[:, None]
           + np.cross(up, out)[None, :] * (v_side * k)[:, None])
    rad = np.where(rng.uniform(0, 1, n) < 0.06, rng.uniform(0.012, 0.03, n), rng.uniform(0.0025, 0.009, n))
    rad *= np.clip(1.15 - age * 0.9, 0.35, 1)
    return pos, rad, age


def point_object(name, pos, rad, material, as_volume=False, density=1.0, voxel=0.05):
    """Points as a mesh's vertices, drawn as spheres (or grown into a
    volume) through a geometry-nodes tree."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p) for p in pos], [], [])
    attr = me.attributes.new("radius", "FLOAT", "POINT")
    attr.data.foreach_set("value", rad.astype(np.float32))
    ob = link(bpy.data.objects.new(name, me))
    ng = bpy.data.node_groups.new(name + "-nodes", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    gi = ng.nodes.new("NodeGroupInput")
    go = ng.nodes.new("NodeGroupOutput")
    m2p = ng.nodes.new("GeometryNodeMeshToPoints")
    ra = ng.nodes.new("GeometryNodeInputNamedAttribute")
    ra.data_type = "FLOAT"
    ra.inputs["Name"].default_value = "radius"
    ng.links.new(gi.outputs[0], m2p.inputs["Mesh"])
    ng.links.new(ra.outputs["Attribute"], m2p.inputs["Radius"])
    last = m2p.outputs[0]
    if as_volume:
        p2v = ng.nodes.new("GeometryNodePointsToVolume")
        p2v.inputs["Density"].default_value = density
        try:
            p2v.inputs["Resolution Mode"].default_value = "Size"
        except Exception:
            p2v.resolution_mode = "VOXEL_SIZE"
        p2v.inputs["Voxel Size"].default_value = voxel
        ng.links.new(last, p2v.inputs["Points"])
        ng.links.new(ra.outputs["Attribute"], p2v.inputs["Radius"])
        last = p2v.outputs[0]
    sm = ng.nodes.new("GeometryNodeSetMaterial")
    sm.inputs["Material"].default_value = material
    ng.links.new(last, sm.inputs["Geometry"])
    ng.links.new(sm.outputs[0], go.inputs[0])
    mod = ob.modifiers.new("points", "NODES")
    mod.node_group = ng
    return ob


def grain_material(aov):
    """Ice grains: white, part translucent so the low sun comes THROUGH a
    backlit sheet of them, part a rough glossy that catches it."""
    m = bpy.data.materials.new("spray")
    nt = m.node_tree
    p = nt.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (0.95, 0.97, 1.0, 1)
    p.inputs["Roughness"].default_value = 0.35
    p.inputs["Subsurface Weight"].default_value = 0.0
    tr = nt.nodes.new("ShaderNodeBsdfTranslucent")
    tr.inputs["Color"].default_value = (1.0, 0.98, 0.95, 1)
    mix = nt.nodes.new("ShaderNodeMixShader")
    mix.inputs[0].default_value = 0.55
    out = nt.nodes.get("Material Output")
    nt.links.new(p.outputs[0], mix.inputs[1])
    nt.links.new(tr.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    aov(m, "glow")
    return m


def mist_material():
    """The fine powder round the grains: a volume that scatters forward (a
    backlit cloud glows), broken up by noise."""
    m = bpy.data.materials.new("mist")
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (0.97, 0.98, 1.0, 1)
    vol.inputs["Anisotropy"].default_value = 0.72
    vol.inputs["Absorption Color"].default_value = (0.9, 0.93, 0.97, 1)
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "density"
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2.2
    noise.inputs["Detail"].default_value = 6.0
    ramp = nt.nodes.new("ShaderNodeMapRange")
    ramp.inputs["From Min"].default_value = 0.42
    ramp.inputs["From Max"].default_value = 0.75
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Value"])
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    nt.links.new(attr.outputs["Fac"], mul.inputs[0])
    nt.links.new(ramp.outputs["Result"], mul.inputs[1])
    k = nt.nodes.new("ShaderNodeMath")
    k.operation = "MULTIPLY"
    k.inputs[1].default_value = 2.0
    nt.links.new(mul.outputs[0], k.inputs[0])
    nt.links.new(k.outputs[0], vol.inputs["Density"])
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    return m

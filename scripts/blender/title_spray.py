# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# WHAT THE TITLE SCENE'S SKIER THROWS: the SPRAY his outside edge throws,
# the hero of the backlit frame: a crescent of grains flown off the edge
# and a mist of fine powder round it, frozen mid-arc. No track is cut
# behind him — the spray hides where it would be.
#
# The spray is BALLISTIC, not painted: every grain left the edge some
# fraction of a second ago with the speed the edge shears it off at (out
# of the turn, up, and carrying a share of the skier's own speed), and has
# flown since under gravity and the air's drag, as the snow cloud's plan
# flies its puffs (`snow-cloud-plan.ts`); the grains are a point cloud the
# renderer draws as spheres, the mist a volume grown off a sparser cut of
# the same points.
#
# Where a POLE meets the snow it leaves its own mark (`pole_plant`): the
# hole its tip and basket punch, the short furrow the tip drags behind it
# as he carries on, the clods it throws up along both lips and a small
# puff of grains kicked off the tip — the same ballistic grains, thrown
# softer, left behind at his speed.

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from lib import link, loft


# ---------------------------------------------------------------- the snow
def bvh_of(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    return BVHTree.FromObject(ob, dg)


def drape(bvh, x, y):
    hit = bvh.ray_cast(Vector((x, y, 5000.0)), Vector((0, 0, -1)))
    return (hit[0], hit[1]) if hit[0] is not None else (None, None)


# ---------------------------------------------------------------- the spray
def spray_points(emit, along, out, up, speed, n, rng, g=9.81, strength=1.0):
    """`n` grains of the rooster tail: each left the edge somewhere between
    the boot and the tail (`emit` ± `along`) a moment ago, sheared off out
    of the turn and up with a share of his speed kept forward, and has
    flown since under gravity and the air's drag (a grain's terminal speed
    of a few metres a second). Positions in the world, radii in metres,
    ages in seconds. `strength` scales the shear: the inside ski, carrying
    a third of his weight, throws a lower, shorter sheet than the outside."""
    age = rng.uniform(0, 1, n) ** 1.6 * 0.75
    s = rng.uniform(-0.4, 1.0, n)
    # The shear's velocity: out and up, faster for the grains thrown early
    # in a stroke, a cone of scatter round it.
    v_out = rng.normal(4.6, 1.1, n) * strength
    v_up = rng.normal(4.2, 1.0, n) * strength
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


# ---------------------------------------------------------------- a pole plant
def _ring(c, a, b, r, n=16):
    return [c + (a * np.cos(t) + b * np.sin(t)) * r for t in np.linspace(0, 2 * np.pi, n, endpoint=False)]


def pole_plant(bvh, top, axis, length, travel, normal, speed, rng, snow_mat, cut_mat=None):
    """The mark a pole leaves where its shaft goes into the snow: the hole
    (a funnel along the shaft as wide as the basket at the surface), the
    furrow the tip drags back along his line, both cut out of the
    mountain by the returned cutters; the clods heaped along the lips and
    round the hole and the puff of grains kicked off the tip, as points.
    None when the shaft stays clear of the snow."""
    hit = bvh.ray_cast(top, axis, length)
    if hit[0] is None:
        return None
    p, n = hit[0], hit[1].normalized()
    buried = length - (p - top).length
    along = (travel - n * travel.dot(n)).normalized()
    across = n.cross(along)
    u = axis.orthogonal().normalized()
    v = axis.cross(u)
    # The hole, along the shaft: the basket's width at the surface,
    # narrowing to the tip.
    r0 = 0.05 if buried > 0.09 else 0.03
    hole = [_ring(p - axis * 0.06, u, v, r0 * 1.1)]
    for k in np.linspace(0, 1, 5):
        hole.append(_ring(p + axis * (buried + 0.02) * k, u, v, r0 + (0.012 - r0) * k ** 1.5))
    cuts = [loft("pole-hole", hole, [cut_mat or snow_mat], smooth=False)]
    # The furrow the tip dragged back along his line: draped onto the snow,
    # deepest at the hole and shallowing out behind it.
    reach = 0.75
    rings, rims = [], []
    for t in np.linspace(0, 1, 14):
        q = p - along * reach * t
        h = bvh.ray_cast(q + n * 0.5, -n, 1.0)
        q = h[0] if h[0] is not None else q
        r = 0.032 * (1 - 0.7 * t) + 0.004
        rings.append(_ring(q + n * r * 0.25, across, n, r, 10))
        rims.append((q, r))
    cuts.append(loft("pole-furrow", rings, [cut_mat or snow_mat], smooth=False))
    # The clods: thrown out along both lips of the furrow and heaped round
    # the hole, small lumps sitting half sunk in the snow.
    pts, rad = [], []
    for q, r in rims:
        for side in (-1, 1):
            for _ in range(int(rng.integers(5, 10))):
                off = r * (1.0 + rng.uniform(0.1, 1.8))
                pts.append(q + across * side * off - along * rng.uniform(-0.03, 0.03) + n * 0.003)
                rad.append(rng.uniform(0.004, 0.012) * (1.4 - 0.6 * off / 0.07))
    for k in range(70):
        a = rng.uniform(0, 2 * np.pi)
        d = r0 * rng.uniform(1.05, 2.4)
        # Heaped up ahead of the shaft and out to its sides: the basket
        # ploughs the snow as he carries the pole forward.
        q = p + (across * np.cos(a) + along * abs(np.sin(a)) * 1.3) * d
        pts.append(q + n * 0.004)
        rad.append(rng.uniform(0.005, 0.016))
    clods = (np.array([tuple(x) for x in pts]), np.clip(np.array(rad), 0.003, 0.02))
    # The puff kicked off the tip: a few thousand grains thrown up and out
    # of the turn softly, a tenth of a second old at most, left behind at
    # his speed as the ski's spray is.
    m = 2500
    age = rng.uniform(0, 1, m) ** 1.8 * 0.1
    drag = 1.6
    k = (1 - np.exp(-drag * age)) / drag
    vu = rng.normal(1.3, 0.45, m)
    vs = rng.normal(0, 0.7, m)
    vf = speed * rng.uniform(0.6, 0.9, m)
    back = speed * age - vf * k
    g = 9.81 * (age - k) / drag
    P0, A, C, N = (np.array(tuple(x)) for x in (p + n * 0.02, along, across, n))
    pos = (P0[None, :] - A[None, :] * back[:, None]
           + C[None, :] * (vs * k)[:, None] + N[None, :] * (vu * k - g)[:, None])
    grad = np.where(rng.uniform(0, 1, m) < 0.08, rng.uniform(0.008, 0.016, m), rng.uniform(0.002, 0.006, m))
    return cuts, clods, (pos, grad, age)

# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE TITLE SCENE'S SKIER: the game's own dressed skier — the very skin the
# game draws him in, cut by its loom and written skinned by
# `scripts/dressed-skier.mjs` (`previews/blender/dressed-skier.glb`, its
# colours on its vertices) — on the reference pair's model
# (`pwa/models/<pair>.glb`), posed bone for bone at the frame of a carve the
# engine skied (`kinds/title.mjs`), each pole run through its fist (the
# grip in the glove, a basket above the tip).
#
# The frames. Both models come back from glTF in the frame they were
# built in: the skier in the body frame laid as Blender's (-x, z, y), his
# centre of gravity at the origin; the pair in its trace's frame (x across,
# y forward from the tails, z up from the snow), which stands under him
# moved by the trace's tail along and the CoG's height down — what the
# skis lab does (`skis-harness.ts`). A bone is posed by the move from its
# bound frame to its hero frame (both the game's, `skierBones`) laid on
# its rest matrix, and each ski is carried by the move of the boot it is
# clamped to — matched by the side it stands on, never by name (a pair's
# `_l` is the trace's x negative, the skier's the body's).

import math

import bpy
from mathutils import Matrix, Vector

from lib import COL, cyl, mat


def B(p):
    """A point or direction of the body frame (or the engine's world), in Blender's."""
    return Vector((-p["x"], p["z"], p["y"]))


def frame_matrix(f):
    m = Matrix((B(f["x"]), B(f["y"]), B(f["z"]))).transposed().to_4x4()
    m.translation = B(f["head"])
    return m


def quat_matrix(q):
    """The engine's world turn of the body frame, as Blender's (the same
    turn seen through `B`, which is itself a turn)."""
    import mathutils
    r = mathutils.Quaternion((q["w"], q["x"], q["y"], q["z"])).to_matrix()
    b = Matrix(((-1, 0, 0), (0, 0, 1), (0, 1, 0)))
    return (b @ r @ b.transposed()).to_4x4()


def _import(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    # The importer's bone-shape helper is not part of the model.
    for o in [o for o in new if o.type == "MESH" and o.name.startswith("Icosphere")]:
        bpy.data.objects.remove(o, do_unlink=True)
    new = [o for o in bpy.data.objects if o not in before]
    root = next(o for o in new if o.parent is None)
    arm = next(o for o in new if o.type == "ARMATURE")
    mesh = next(o for o in new if o.type == "MESH")
    # The model's clips come with it, its first action bound: left there it
    # would re-pose every keyed bone at the render's first frame change and
    # the hero pose (and the poles laid off its fists) would be lost.
    arm.animation_data_clear()
    return root, arm, mesh


def _pose(arm, moves):
    """Every bone of `arm` moved by its `moves[name]` (armature space),
    parents first so each child is laid on its parent's new place."""
    bpy.context.view_layer.update()
    order = sorted(arm.pose.bones, key=lambda pb: len(pb.parent_recursive))
    for pb in order:
        d = moves.get(pb.name)
        if d is None:
            continue
        pb.matrix = d @ pb.bone.matrix_local
        bpy.context.view_layer.update()


def _dress(meshes):
    """The dressed skin's materials for Cycles: each reads the mesh's own
    vertex colours (linear, as the game's loom writes them) as its base
    colour; the cloth stays matte, the hard parts (the helmet, the goggles,
    the boots' liners) take a clear coat."""
    for o in meshes:
        attr = o.data.color_attributes[0].name if o.data.color_attributes else None
        for m in o.data.materials:
            nt = m.node_tree
            bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
            if attr and not bsdf.inputs["Base Color"].is_linked:
                col = nt.nodes.new("ShaderNodeVertexColor")
                col.layer_name = attr
                nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
            if m.name.startswith("hard"):
                bsdf.inputs["Coat Weight"].default_value = 0.6
                bsdf.inputs["Coat Roughness"].default_value = 0.1
            else:
                bsdf.inputs["Sheen Weight"].default_value = 0.2


def _hexlin(h):
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 for c in ((h >> 16) & 255, (h >> 8) & 255, h & 255))


def build_rider(data, skier_glb, pair_glb):
    """The posed skier and his pair under one empty at his centre of gravity,
    in the body frame laid as Blender's; returns it and the meshes."""
    pose = data["pose"]
    sroot, sarm, smesh = _import(skier_glb)
    _dress([o for o in sarm.children if o.type == "MESH"])
    proot, parm, pmesh = _import(pair_glb)
    # Under him: along by the trace's tail, down by the CoG's height.
    proot.location = Vector((0, data["pair"]["tail"], -data["pair"]["cog"]))
    bpy.context.view_layer.update()

    moves = {n: frame_matrix(pose["hero"][n]) @ frame_matrix(pose["rest"][n]).inverted() for n in pose["hero"]}
    _pose(sarm, moves)

    # Each ski carried by its boot's move, matched by the side it stands on.
    to_pair = parm.matrix_world.inverted()
    pmoves = {}
    for pb in parm.pose.bones:
        if not pb.name.startswith("ski_"):
            continue
        side_x = (parm.matrix_world @ pb.bone.head_local).x
        boot = min(("boot_l", "boot_r"), key=lambda n: abs(B(pose["rest"][n]["head"]).x - side_x))
        pmoves[pb.name] = to_pair @ moves[boot] @ parm.matrix_world
    _pose(parm, pmoves)

    rider = bpy.data.objects.new("rider", None)
    COL.objects.link(rider)
    for o in (sroot, proot):
        o.parent = rider
    return rider, [smesh, pmesh]


def place_rider(rider, data, ground, normal, downhill, yaw):
    """The rider set on the snow: his turn in the engine's world laid onto
    the slope at `ground` (the synthetic slope's normal and fall line turned
    onto this one's, then `yaw` about the normal), dropped until the lowest
    point of his skis meets the snow."""
    g = data["pose"]["grade"]
    n_e = Vector((0, math.sin(g), math.cos(g)))
    f_e = Vector((0, math.cos(g), -math.sin(g)))
    def basis(n, f):
        f = (f - n * f.dot(n)).normalized()
        return Matrix((f, n.cross(f), n)).transposed()
    align = basis(normal, downhill) @ basis(n_e, f_e).transposed()
    turn = Matrix.Rotation(yaw, 3, normal)
    rot = (turn @ align).to_4x4() @ quat_matrix(data["pose"]["q"])
    rider.matrix_world = Matrix.Translation(ground) @ rot
    bpy.context.view_layer.update()
    return rot


def _armature(rider):
    stack = list(rider.children)
    while stack:
        o = stack.pop()
        if o.type == "ARMATURE" and "hand_l" in o.pose.bones:
            return o
        stack.extend(o.children)
    raise RuntimeError("no skier armature under the rider")


def build_poles(rider, data, normal, length=1.22, wrist=0.6):
    """THE POLES, through the fists. Each is held where the game's pose
    holds it — the shaft along the hand bone's +z, through the closed
    glove — but the pose is stated in his body frame, which a carve lays
    50° over, so the shaft is bent toward how a racer carries it at the
    apex: the inside pole low and near, its tip just off the snow and
    ready to plant, the outside one trailing back along his line. The
    HAND turns with it (at most `wrist` of the way to the carried line,
    about the fist), so the fingers stay wrapped round the shaft and the
    grip never leaves the glove. A shaft from above the fist to the tip,
    the grip in the glove, a basket over the tip."""
    arm = _armature(rider)
    m = rider.matrix_world
    fwd = (m.to_3x3() @ Vector((0, 1, 0))).normalized()
    fwd = (fwd - normal * fwd.dot(normal)).normalized()
    bones = [arm.pose.bones[f"hand_{s}"] for s in "lr"]
    hands = [arm.matrix_world @ pb.head for pb in bones]
    # Laid over into the turn, the inside fist is the lower one.
    inside = 0 if hands[0].dot(normal) < hands[1].dot(normal) else 1
    pole_mat = mat("pole", _hexlin(data["outfit"]["pole"]), metal=0.8, rough=0.3)
    grip_mat = mat("grip", (0.02, 0.02, 0.025), rough=0.6)
    to_arm = arm.matrix_world.inverted()
    out = []
    for i, (pb, hand) in enumerate(zip(bones, hands)):
        held = -(arm.matrix_world.to_3x3() @ pb.matrix.to_3x3() @ Vector((0, 0, 1))).normalized()
        away = (hand - (hands[0] + hands[1]) / 2).normalized()
        away = (away - normal * away.dot(normal)).normalized()
        if i == inside:
            carried = (-fwd * 0.55 - normal * 0.75 + away * 0.25).normalized()
        else:
            carried = (-fwd * 0.85 - normal * 0.35 + away * 0.3).normalized()
        axis = held.slerp(carried, wrist) if held.dot(carried) > -0.99 else carried
        # The hand turned about the fist onto the shaft's line.
        turn = held.rotation_difference(axis).to_matrix().to_4x4()
        c = to_arm @ hand
        r_arm = to_arm.to_3x3() @ turn.to_3x3() @ arm.matrix_world.to_3x3()
        pb.matrix = Matrix.Translation(c) @ r_arm.to_4x4() @ Matrix.Translation(-c) @ pb.matrix
        bpy.context.view_layer.update()
        tip = hand + axis * length
        top = hand - axis * 0.06
        out.append(cyl(f"pole{i}", top, tip, 0.009, pole_mat, seg=10))
        out.append(cyl(f"grip{i}", top, hand + axis * 0.07, 0.016, grip_mat, seg=10))
        basket = tip - axis * 0.09
        out.append(cyl(f"basket{i}", basket - axis * 0.006, basket + axis * 0.006, 0.05, pole_mat, seg=14))
    return out

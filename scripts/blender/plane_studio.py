# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE JUMP PLANE'S STUDIO (`plane.py`): the cameras its stills and its
# three-view are rendered through, the render, the glTF export and the
# clearing of a built cut — stated apart so the builder stays the airframe.

import math

import bpy

import lib


def cameras(COL, NOSE):
    """The studio's views of a machine 11 m long under a wing 15.9 m across:
    the stills (three-quarters from either side, the side, the front, the
    rear, the top, close-ups of the door, the nose and the tail, and the
    chase), and three ORTHOGRAPHIC views at 64 px/m (`oside` from the right
    side, `otop`, `ofront`) to lay a three-view over."""
    for o in [o for o in COL.objects if o.type == "CAMERA"]:
        bpy.data.objects.remove(o)
    cams = {}
    views = {
        "three": ((11.5, 10.5, 4.6), (0, -1.6, 2.0), 28), "left3": ((-11.5, 10.5, 4.6), (0, -1.6, 2.0), 28),
        "side": ((32, -1.9, 2.1), (0, -1.9, 2.1), 50), "front": ((0, 34, 2.4), (0, 0, 2.2), 55),
        "rear": ((9, -20, 5.0), (0, -2.0, 2.0), 30), "top": ((0, -1.8, 40), None, 45),
        "door": ((4.6, -0.2, 1.9), (0.4, -0.9, 1.6), 30), "nose": ((3.4, 5.6, 2.3), (0, 2.4, 1.9), 30),
        "tail": ((4.5, -10.5, 3.6), (0, -6.6, 2.7), 35), "chase": ((1.5, -24, 8.5), (0, -1.5, 2.2), 32),
        "low3": ((-6.5, 8.5, 0.8), (0, 0.3, 1.8), 24),
    }
    for name, (loc, target, lens) in views.items():
        cd = bpy.data.cameras.new(name)
        cd.lens = lens
        cd.clip_end = 300
        cam = bpy.data.objects.new(name, cd)
        COL.objects.link(cam)
        cam.location = loc
        if target is None:
            cam.rotation_euler = (0, 0, 0)
        else:
            empty = bpy.data.objects.new(f"{name}_at", None)
            COL.objects.link(empty)
            empty.location = target
            tt = cam.constraints.new("TRACK_TO")
            tt.target = empty
            tt.track_axis = "TRACK_NEGATIVE_Z"
            tt.up_axis = "UP_Y"
        cams[name] = cam
    # 64 px/m: 20 m across a 1280 px frame; the nose's ring 120 px from the
    # frame's left in the side view, so a drawing can be laid over it.
    yc = NOSE + 120 / 64 - 10
    for name, loc, rot in (("oside", (40, yc, 2.6), (math.pi / 2, 0, math.pi / 2)),
                           ("otop", (0, yc, 40), (0, 0, -math.pi / 2)),
                           ("ofront", (0, 40, 2.6), (math.pi / 2, 0, math.pi))):
        cd = bpy.data.cameras.new(name)
        cd.type = "ORTHO"
        cd.ortho_scale = 20
        cd.clip_end = 300
        cam = bpy.data.objects.new(name, cd)
        COL.objects.link(cam)
        cam.location = loc
        cam.rotation_euler = rot
        cams[name] = cam
    return cams


def render(scene, cams, views, stem):
    for v in views:
        scene.camera = cams[v]
        scene.render.filepath = f"{stem}-{v}.png"
        bpy.ops.render.render(write_still=True)


def export(root, path):
    lib._select_only([root] + list(root.children))
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_apply=True, export_extras=True,
                              export_skins=False, export_animations=False, export_morph=False)


def remove(root):
    for o in [root] + list(root.children):
        bpy.data.objects.remove(o)
    for me in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(me)

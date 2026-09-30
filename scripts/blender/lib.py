# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE BLENDER SHELF: what every modelled asset is built from — the scene, the
# materials, the lofts and tubes and boxes a part is made of, the studio it is
# photographed in, and the export to the game's budget with its LODs. One
# builder per KIND of asset (`skis.py`, …) imports it; `scripts/blender.mjs`
# is how any of them is run, and the `blender-assets` skill owns the loop.
#
# Every builder states its asset in the frame the game's own data is in and
# leaves the turn onto the game's frame to whoever loads the glTF.
#
#   QUALITY=render   studio stills: subdivided, bevelled, holes cut
#   QUALITY=game     the real-time budget: GAME is true, and every helper
#                    spends fewer segments
#   VIEWS=a,b        only these cameras (`none`: no stills at all — `make models`,
#                    and CI, which only wants the glTFs)
#
# THE RIG. An asset is exported SKINNED: every part rides one bone, rigidly
# (every vertex weighted 1 to its part's bone), so the game poses it the way
# it poses its own figures (`posed-merge.ts`). A builder says which bone the
# parts it makes ride (`rides`), registers each bone (`bone`) — a DRIVER the
# game sets off the engine's readings, or a LINKAGE aimed at a target on
# another part, rigid or stretched, whose target is written into the glTF as
# the bone's extras (`aim`, `stretch`) so the game can re-lay it — and
# registers the CLIPS (`clip`) that play the drivers over time, baked with
# the linkages following, one glTF animation each.

import bpy, bmesh, math, os
from mathutils import Euler, Matrix, Quaternion, Vector

GAME = os.environ.get("QUALITY") == "game"
FPS = 30
RIDES = "body"
BONES = {"body": dict(head=(0, 0, 0), tail=(0, 0.3, 0), parent=None, deform=True)}
CLIPS = []
MORPHS = {}
WEIGHTS = {}

def rides(name):
    """Every object made from here on rides this bone."""
    global RIDES
    RIDES = name
    return name

def bone(name, head, tail, parent="body", aim=None, stretch=False, deform=True, extras=None, roll_to=None):
    """A bone of the rig, in the asset's frame. A LINKAGE names the bone it
    AIMS at (its tail laid on that bone's head, which must be where the
    tail stands at rest), and whether it STRETCHES to reach it or only turns.
    `extras` are written into the glTF on the bone's node; `roll_to` turns
    the bone's +z toward a direction."""
    BONES[name] = dict(head=tuple(head), tail=tuple(tail), parent=parent, aim=aim, stretch=stretch,
                       deform=deform, extras=extras or {}, roll_to=roll_to)
    return name

def marker(name, at, parent):
    """A target a linkage aims at: a short bone riding `parent`, its head `at`."""
    return bone(name, at, Vector(at) + Vector((0, 0, 0.03)), parent, deform=False)

def clip(name, seconds, at):
    """A clip: `at(t)` gives, for every driver it moves, a `lift` (m, up the
    asset's z) and a `turn` (rad, about the bone's own axis) — or its whole
    `matrix` in the armature's frame — and for a morphed object (`morph(...)`)
    its weight, keyed as `{object: w}` under "morph"."""
    CLIPS.append((name, seconds, at))

def weights(ob, fn):
    """A part that BENDS: `fn(co)` gives each vertex's `{bone: weight}` —
    where every other part rides its one bone wholly."""
    WEIGHTS[ob.name] = fn
    return ob

def morph(ob, key, coords):
    """A shape key `key` on `ob`, its vertices at `coords` — added after the
    modifiers are baked in, which a key would forbid."""
    MORPHS[ob.name] = (ob, key, coords)
# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
COL = scene.collection

# ---------------------------------------------------------------- materials
def mat(name, color, metal=0.0, rough=0.5, coat=0.0, emit=None, emit_str=0.0,
        glass=False, sheen=0.0):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    p = m.node_tree.nodes.get("Principled BSDF")
    def s(key, val):
        if key in p.inputs:
            p.inputs[key].default_value = val
    s("Base Color", (*color, 1.0))
    s("Metallic", metal)
    s("Roughness", rough)
    s("Coat Weight", coat)
    s("Coat Roughness", 0.04)
    s("Sheen Weight", sheen)
    if emit:
        s("Emission Color", (*emit, 1.0))
        s("Emission Strength", emit_str)
    if glass:
        s("Transmission Weight", 1.0)
        s("IOR", 1.5)
    m.diffuse_color = (*color, 1.0)
    return m


# ---------------------------------------------------------------- helpers
def interp(pts, t):
    if t <= pts[0][0]:
        return pts[0][1]
    for (a, va), (b, vb) in zip(pts, pts[1:]):
        if t <= b:
            u = (t - a) / (b - a)
            u = u * u * (3 - 2 * u)  # smoothstep between knots
            return va + (vb - va) * u
    return pts[-1][1]

def catmull(points, closed=False, n=8):
    P = [Vector(p) for p in points]
    out = []
    count = len(P) if closed else len(P) - 1
    for i in range(count):
        p0 = P[(i - 1) % len(P)] if (closed or i > 0) else P[i]
        p1 = P[i]
        p2 = P[(i + 1) % len(P)]
        p3 = P[(i + 2) % len(P)] if (closed or i + 2 < len(P)) else P[(i + 1) % len(P)]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if not closed:
        out.append(P[-1])
    return out

def resample(poly, step, closed=True):
    pts = poly + ([poly[0]] if closed else [])
    lens = [0.0]
    for a, b in zip(pts, pts[1:]):
        lens.append(lens[-1] + (b - a).length)
    total = lens[-1]
    n = max(2, int(total / step))
    out = []
    j = 0
    for i in range(n if closed else n + 1):
        d = total * i / n
        while j < len(lens) - 2 and lens[j + 1] < d:
            j += 1
        seg = lens[j + 1] - lens[j]
        u = 0 if seg == 0 else (d - lens[j]) / seg
        out.append(pts[j].lerp(pts[j + 1], u))
    return out, total

def link(ob):
    COL.objects.link(ob)
    ob["bone"] = RIDES
    return ob

def mesh_obj(name, verts, faces, mats, face_mats=None, smooth=True, recalc=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    if recalc:
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
    for m in mats:
        me.materials.append(m)
    if face_mats:
        me.polygons.foreach_set("material_index", face_mats)
    me.polygons.foreach_set("use_smooth", [smooth] * len(me.polygons))
    me.update()
    return link(bpy.data.objects.new(name, me))

def loft(name, rings, mats, closed=True, cap=True, face_mat=None, smooth=True):
    M = len(rings[0])
    verts = [v for r in rings for v in r]
    faces, fm = [], []
    span = M if closed else M - 1
    for i in range(len(rings) - 1):
        a, b = i * M, (i + 1) * M
        for j in range(span):
            j1 = (j + 1) % M
            faces.append([a + j, a + j1, b + j1, b + j])
            if face_mat:
                c = sum((verts[k] for k in faces[-1]), Vector()) / 4
                fm.append(face_mat(c))
    if cap:
        for ring_i in (0, len(rings) - 1):
            base = ring_i * M
            c = sum((verts[base + j] for j in range(M)), Vector()) / M
            ci = len(verts)
            verts.append(c)
            for j in range(M):
                faces.append([base + j, base + (j + 1) % M, ci])
                if face_mat:
                    fm.append(face_mat(c))
    return mesh_obj(name, verts, faces, mats, fm or None, smooth)

def superellipse(cx, cz, w, h, n, M, taper_top=0.0, taper_bot=0.0):
    ring = []
    for k in range(M):
        th = 2 * math.pi * k / M
        c, s = math.cos(th), math.sin(th)
        x = math.copysign(abs(c) ** (2 / n), c)
        v = math.copysign(abs(s) ** (2 / n), s)
        x *= 1 - taper_top * max(v, 0) ** 1.5 - taper_bot * max(-v, 0) ** 1.5
        ring.append((x * w, v * h))
    return ring

def tube(name, points, r, m, smooth_n=0, closed=False, res=4):
    if GAME:
        smooth_n = min(smooth_n, 3)
        res = min(res, 1)
    pts = catmull(points, closed, smooth_n) if smooth_n else [Vector(p) for p in points]
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = res
    cu.use_fill_caps = not closed
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (co.x, co.y, co.z, 1.0)
    sp.use_cyclic_u = closed
    sp.use_smooth = True
    cu.materials.append(m)
    return link(bpy.data.objects.new(name, cu))

def orient(a, b):
    d = (Vector(b) - Vector(a))
    return d.length, d.to_track_quat("Z", "Y").to_matrix().to_4x4()

def cyl(name, a, b, r, m, seg=24, r2=None, smooth=True):
    if GAME:
        seg = max(6, seg // 3) if r < 0.03 else max(10, seg // 2)
    L, R = orient(a, b)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r,
                          radius2=r if r2 is None else r2, depth=L)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, L / 2))
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(a)) @ R, verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(m)
    ob = link(bpy.data.objects.new(name, me))
    if smooth:
        for p in me.polygons:
            p.use_smooth = abs(p.normal.dot((R.to_3x3() @ Vector((0, 0, 1))))) < 0.9
    return ob

def box(name, center, size, m, rot=(0, 0, 0), bevel=0.004):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(center)) @ Euler(rot).to_matrix().to_4x4(),
                        verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(m)
    ob = link(bpy.data.objects.new(name, me))
    if bevel:
        mod = ob.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    return ob

def ellipsoid(name, center, radii, m, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=10 if GAME else 24, v_segments=6 if GAME else 12, radius=1.0)
    bmesh.ops.scale(bm, vec=radii, verts=bm.verts)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(center)) @ Euler(rot).to_matrix().to_4x4(),
                        verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    return link(bpy.data.objects.new(name, me))

def coil(name, a, b, r, wire, turns, m):
    L, R = orient(a, b)
    pts = []
    N = int(turns * (8 if GAME else 24))
    for i in range(N + 1):
        t = i / N
        th = 2 * math.pi * turns * t
        pts.append(Matrix.Translation(Vector(a)) @ R @ Vector((r * math.cos(th), r * math.sin(th), L * t)))
    return tube(name, pts, wire, m, res=0 if GAME else 3)

_CUT = bpy.data.materials.new("cutter")
cutters = bpy.data.collections.new("cutters")
COL.children.link(cutters)
cutters.hide_render = True
cutters.hide_viewport = True

def cutter_cyl(a, b, r):
    ob = cyl("cut", a, b, r, _CUT, seg=20, smooth=False)
    COL.objects.unlink(ob)
    cutters.objects.link(ob)
    return ob

def boolean(ob, coll):
    mod = ob.modifiers.new("holes", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.operand_type = "COLLECTION"
    mod.collection = coll
    mod.solver = "EXACT"

# ---------------------------------------------------------------- the STUDIO and the EXPORT
def _tri_count(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    n = 0
    for o in objs:
        if o.type == "MESH":
            me = o.evaluated_get(dg).to_mesh()
            me.calc_loop_triangles()
            n += len(me.loop_triangles)
            o.evaluated_get(dg).to_mesh_clear()
    return n

def _select_only(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

def _studio(centre, size, floor=0.0):
    """A snow floor, a winter sky, a low sun and a fill, and five cameras
    round `centre`, at distances in proportion to the asset's `size` (m)."""
    snow = mat("snow", (0.86, 0.9, 0.96), rough=0.55)
    bpy.ops.mesh.primitive_plane_add(size=60, location=(centre[0], centre[1], floor - 0.001))
    bpy.context.active_object.data.materials.append(snow)
    world = bpy.data.worlds.new("sky")
    scene.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.42, 0.55, 0.78, 1)
    bg.inputs[1].default_value = 0.9
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 4.5
    sun.angle = math.radians(1.5)
    sun.color = (1.0, 0.95, 0.88)
    COL.objects.link(so := bpy.data.objects.new("sun", sun))
    so.rotation_euler = (math.radians(50), math.radians(10), math.radians(145))
    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy = 300
    fill.size = 4
    COL.objects.link(fo := bpy.data.objects.new("fill", fill))
    fo.location = (-4, 4, 3)
    fo.rotation_euler = (math.radians(60), 0, math.radians(-130))
    target = bpy.data.objects.new("target", None)
    COL.objects.link(target)
    target.location = centre
    k = size / 3.2   # the distances were set on a 3.2 m machine
    c = Vector(centre)
    cams = {}
    for name, off, lens in (("side", (9.5, 0, 0.17), 85), ("three", (-3.4, 3.15, 1.1), 50),
                            ("rear3", (3.2, -3.85, 1.05), 50), ("chase", (0, -6.65, 1.65), 45),
                            ("detail", (1.2, 2.85, 0.75), 35)):
        cd = bpy.data.cameras.new(name)
        cd.lens = lens
        cam = bpy.data.objects.new(name, cd)
        COL.objects.link(cam)
        cam.location = c + Vector(off) * k
        tt = cam.constraints.new("TRACK_TO")
        tt.target = target
        tt.track_axis = "TRACK_NEGATIVE_Z"
        tt.up_axis = "UP_Y"
        cams[name] = cam
    return cams

def _cycles(samples):
    scene.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for dv in prefs.devices:
            dv.use = True
        scene.cycles.device = "GPU"
    except Exception as e:
        print("GPU setup failed, on the CPU:", e)
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"

def _weigh(o):
    """Every vertex of a part to its own bone, wholly: rigid skinning — or,
    for a part that bends (`weights`), to the bones its function names."""
    fn = WEIGHTS.get(o.name)
    if not fn:
        vg = o.vertex_groups.new(name=o["bone"])
        vg.add(range(len(o.data.vertices)), 1.0, "REPLACE")
        return
    groups = {}
    for v in o.data.vertices:
        for b, w in fn(v.co).items():
            if b not in groups:
                groups[b] = o.vertex_groups.get(b) or o.vertex_groups.new(name=b)
            groups[b].add([v.index], w, "REPLACE")

def _rig(root):
    """The armature from `BONES`, every mesh skinned to it, every linkage
    constrained to its target and its target written into its extras."""
    arm_data = bpy.data.armatures.new("rig")
    arm = bpy.data.objects.new("rig", arm_data)
    COL.objects.link(arm)
    arm.parent = root
    _select_only([arm])
    bpy.ops.object.mode_set(mode="EDIT")
    for n, b in BONES.items():
        eb = arm_data.edit_bones.new(n)
        eb.head, eb.tail = b["head"], b["tail"]
        eb.use_deform = b["deform"]
        if b.get("roll_to") is not None:
            eb.align_roll(Vector(b["roll_to"]))
    for n, b in BONES.items():
        if b["parent"]:
            arm_data.edit_bones[n].parent = arm_data.edit_bones[b["parent"]]
    bpy.ops.object.mode_set(mode="OBJECT")
    for n, b in BONES.items():
        pb = arm.pose.bones[n]
        pb.rotation_mode = "QUATERNION"
        for holder in (pb, arm_data.bones[n]):
            for k, v in b.get("extras", {}).items():
                holder[k] = v
        if b.get("aim"):
            for holder in (pb, arm_data.bones[n]):
                holder["aim"] = b["aim"]
                holder["stretch"] = 1 if b["stretch"] else 0
            c = pb.constraints.new("STRETCH_TO" if b["stretch"] else "DAMPED_TRACK")
            c.target, c.subtarget = arm, b["aim"]
            if b["stretch"]:
                c.volume = "NO_VOLUME"
                c.rest_length = (Vector(b["tail"]) - Vector(b["head"])).length
    for o in list(root.children):
        if o.type == "MESH":
            o.parent = arm
            m = o.modifiers.new("skin", "ARMATURE")
            m.object = arm
            o.modifiers.move(len(o.modifiers) - 1, 0)
    return arm

def _clips(arm):
    """Every registered clip keyed on its drivers a frame at a time, baked
    with the linkages following, and laid on an NLA track of its name — one
    glTF animation each. The rest pose is left live for the stills."""
    if not CLIPS:
        return
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
    scene.render.fps = FPS
    arm.animation_data_create()
    names = []
    for name, seconds, at in CLIPS:
        n = round(seconds * FPS)
        act = bpy.data.actions.new(name)
        arm.animation_data.action = act
        keyed = {}
        for f in range(n + 1):
            pose = at(f / FPS)
            for m_name, w in pose.pop("morph", {}).items():
                ob = MORPHS[m_name][0]
                kb = ob.data.shape_keys.key_blocks[MORPHS[m_name][1]]
                kd = ob.data.shape_keys
                if m_name not in keyed:
                    kd.animation_data_create()
                    kd.animation_data.action = bpy.data.actions.new(f"{name}_{m_name}")
                    keyed[m_name] = kd
                kb.value = w
                kb.keyframe_insert("value", frame=f)
            for b_name, d in pose.items():
                pb = arm.pose.bones[b_name]
                if "matrix" in d:
                    pb.matrix = d["matrix"]
                else:
                    rest = arm.data.bones[b_name].matrix_local.to_3x3()
                    pb.location = rest.inverted() @ Vector((0, 0, d.get("lift", 0.0)))
                    pb.rotation_quaternion = Quaternion((0, 1, 0), d.get("turn", 0.0))
                pb.keyframe_insert("location", frame=f)
                pb.keyframe_insert("rotation_quaternion", frame=f)
        scene.frame_start, scene.frame_end = 0, n
        _select_only([arm])
        bpy.ops.object.mode_set(mode="POSE")
        bpy.ops.nla.bake(frame_start=0, frame_end=n, only_selected=False, visual_keying=True,
                         clear_constraints=False, use_current_action=True, bake_types={"POSE"})
        bpy.ops.object.mode_set(mode="OBJECT")
        for holder in [arm.animation_data] + [k.animation_data for k in keyed.values()]:
            track = holder.nla_tracks.new()
            track.name = name
            track.strips.new(name, 0, holder.action)
            track.mute = True       # or it plays under the next clip's bake
            holder.action = None
        for pb in arm.pose.bones:
            pb.location, pb.rotation_quaternion = (0, 0, 0), (1, 0, 0, 0)
        for ob, key, _ in MORPHS.values():
            ob.data.shape_keys.key_blocks[key].value = 0.0
        names.append(f"{name} {seconds:g}s")
    for holder in [arm.animation_data] + [ob.data.shape_keys.animation_data for ob, _, _ in MORPHS.values()
                                          if ob.data.shape_keys.animation_data]:
        holder.use_nla = False     # the stills are of the machine at rest
        for track in holder.nla_tracks:
            track.mute = False
    scene.frame_set(0)
    print("CLIPS", ", ".join(names))

def finish(name, out, samples, centre, size, lods=(("lod1", 0.35), ("lod2", 0.1)), extras=None, floor=0.0):
    """Everything after the modelling: curves to meshes, the parts under one
    root (carrying `extras`), the rig and its clips, the studio, the renders,
    and — in the game quality — the parts joined into one skinned mesh, LOD0
    and the decimated LODs exported as glTF, every count printed (`BONES`,
    `CLIPS`, `TRIANGLES`)."""
    curves = [o for o in COL.objects if o.type == "CURVE"]
    if curves:
        _select_only(curves)
        bpy.ops.object.convert(target="MESH")
    root = bpy.data.objects.new(name, None)
    COL.objects.link(root)
    for k, v in (extras or {}).items():
        root[k] = v
    for o in list(COL.objects):
        if o is not root and o.parent is None:
            o.parent = root
    if GAME:
        # Bake every modifier in, then ONE skinned mesh (a morphed part keeps
        # its own mesh: a key would stop the join's modifiers being applied).
        _select_only([o for o in root.children if o.type == "MESH"])
        bpy.ops.object.convert(target="MESH")
        counts = {}
        for o in root.children:
            counts[o["bone"]] = counts.get(o["bone"], 0) + _tri_count([o])
        print("BONES", len(BONES), {k: v for k, v in sorted(counts.items(), key=lambda kv: -kv[1])[:6]})
        for o in root.children:
            _weigh(o)
        joined = [o for o in root.children if o.type == "MESH" and o.name not in MORPHS]
        _select_only(joined)
        bpy.ops.object.join()
        o = bpy.context.view_layer.objects.active
        o.name = o.data.name = "machine"
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
        bm.to_mesh(o.data)
        bm.free()
    else:
        for o in root.children:
            if o.type == "MESH":
                _weigh(o)
    for ob, key, coords in MORPHS.values():
        ob.shape_key_add(name="Basis")
        k = ob.shape_key_add(name=key)
        for v, co in zip(k.data, coords):
            v.co = co
    arm = _rig(root)
    _clips(arm)
    cams = _studio(centre, size, floor)
    _cycles(samples)
    tag = "game" if GAME else "render"
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, f"{name}-{tag}.blend"))

    def render(views, suffix=""):
        for v in views:
            scene.camera = cams[v]
            scene.render.filepath = os.path.join(out, f"{name}-{tag}{suffix}-{v}.png")
            bpy.ops.render.render(write_still=True)

    only = [v for v in os.environ.get("VIEWS", "").split(",") if v]
    render([v for v in cams if not only or v in only])
    parts = [o for o in root.children_recursive if o.type == "MESH"]
    print("TRIANGLES", tag, "lod0", _tri_count(parts))
    if not GAME:
        return

    def export(path):
        _select_only([root] + list(root.children_recursive))
        bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_apply=True, export_extras=True,
                                  export_skins=True, export_morph=True, export_animations=True,
                                  export_animation_mode="NLA_TRACKS", export_def_bones=False)

    export(os.path.join(out, f"{name}-lod0.glb"))
    # The lower LODs are a blind decimation: fine at range, torn up close.
    for lod, ratio in lods:
        # A morphed part is left whole: a key forbids the decimation's apply,
        # and the lugs are a few hundred triangles.
        thinned = [o for o in parts if o.name not in MORPHS]
        for o in thinned:
            d = o.modifiers.new("lod", "DECIMATE")
            d.ratio = ratio
            d.use_collapse_triangulate = True
            o.modifiers.move(len(o.modifiers) - 1, 0)   # before the skin, which the export leaves live
        print("TRIANGLES", tag, lod, _tri_count(parts))
        export(os.path.join(out, f"{name}-{lod}.glb"))
        render([v for v in ("chase", "three") if not only or v in only], "-" + lod)
        for o in thinned:
            o.modifiers.remove(o.modifiers["lod"])

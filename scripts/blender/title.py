# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE TITLE SCENE — the game's key art, path-traced: "first light on the
# fall line". A skier alone on a big faceted face, laid over in a carve,
# his outside edge throwing a backlit rooster tail of spray, the logo's own
# double S cut into the snow behind him up the face to under its summit,
# the low sun in a col of the ridge beside it; the steep face and its rock
# in cold blue shadow, his long shadow thrown at the lens, the crests and
# the spray lit gold. Built by `scripts/blender.mjs --kind=title`
# (`make title-scene`) off `kinds/title.mjs`; its plates are published by
# `scripts/title-plates.mjs` into `pwa/src/title/`, where the title stage
# composites them live (parallax off the depth, the sparkle, the spindrift
# off the ridge, the god rays from the sun, the spray's grains breathing).
#
# ONE SQUARE PLATE for every screen: a 16:9 band across it for a wide
# screen (the menu over its left third, the logo in the sky at its upper
# left — so the skier stands right of centre) and a tall 9:19.5 column for
# a phone upright (the logo at its top, the menu over its lower half — so
# the skier stands in its upper middle). `title_plates.py` writes both
# crops into the JSON and draws them, with the UI's zones over them, on a
# contact sheet (`previews/blender/title-crops.png`) to judge the frame by.
#
# Outputs, in `previews/blender/`: `title-colour.png` (the frame, 16-bit,
# the view transform baked), `title-passes.exr` (depth, the snow's direct
# light, the AOVs), `title-colour.webp`, `title-aux.webp`, `title-plate.json`,
# `title-crops.png`, `title-aux-sheet.png` and `title-render.blend`.
#
#   TITLE_SIZE=768 node scripts/blender.mjs --kind=title --quality=render --samples=32   a draft
#   node scripts/blender.mjs --kind=title --quality=render --samples=256                  the plates

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402  (resets the scene)
from lib import COL, mat, scene  # noqa: E402
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

import title_world as W  # noqa: E402
import title_rider as R  # noqa: E402
import title_spray as S  # noqa: E402
import title_plates as PL  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
DATA = json.load(open(argv[0]))
OUT = argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 256
SIZE = int(os.environ.get("TITLE_SIZE", "2304"))
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PAL = {k: W.hexlin(v) for k, v in DATA["palette"].items()}

# THE SHOT — every number the frame is set by, in one place.
P = {
    # The plan, as bearings off the lens's own (°, counter-clockwise) and
    # distances (m): the lens looks along `yaw_cam`, pitched up by `pitch`
    # and rolled by `dutch`, `cam_height` over the snow; the skier stands
    # `cam_dist` off it on `skier_bearing`; the face rises along
    # `up_bearing`.
    "yaw_cam": 40.0, "pitch": 4.0, "dutch": -4.0, "cam_height": 1.3,
    "skier_bearing": -3.0, "cam_dist": 10.0, "up_bearing": -60.0,
    # The face: its ridge (m up the fall line from him), its pitch under
    # him and at the ridge; the summit on it (m across, m high, m wide);
    # where it falls away (m across, and to which side); the col cut on
    # the sun's bearing from him (° off it, ° wide, m deep); the valley's
    # floor (m under him); the facets' size (radians at their distance),
    # the steepness rock shows at (°), the tree line (m over the floor).
    "face": (900.0, 0.3, 1.0), "summit": (-1800.0, 260.0, 380.0),
    "shoulder": (3000.0, 5500.0, -1), "notch": (0.0, 4.0, 800.0), "floor": -420.0,
    "facet": 0.012, "rock": 41.0, "tree_line": 380.0,
    # Where the lens sees them (plate UV): the top of his S (under the
    # summit) and how wide it is laid across its chord; the two slalom
    # gates; the box the near stand of spruces stands in (u0, v0, u1, v1).
    "track_aim": (0.52, 0.17), "track_squash": 1.2,
    "gates": ((0.37, 0.545), (0.25, 0.585)), "stand": (0.0, 0.5, 0.25, 0.57),
    # The sun: its elevation and bearing off the lens's (°), strength and
    # colour; the sky's scattering.
    "sun_el": 19.0, "sun_bearing": -16.0, "sun": 10.0, "kelvin": 3800.0,
    "disc": 1.0, "altitude": 2000.0, "air": 1.0, "dust": 0.5, "sky": 0.4, "fill": 0.15,
    "halo": (14.0, 40.0),
    # The air: how far the haze reaches (m).
    "haze": 12000.0,
    # The skier's turn about the snow's normal off the engine's heading.
    "yaw": 20.0,
    "lens": 50.0, "fstop": 3.2,
}

# ---------------------------------------------------------------- materials
snow = W.snow_material("snow", PAL["snow"], PAL["ice"])
rock = W.rock_material("rock", (0.045, 0.05, 0.06))
W.layout(P)
sun_dir = W.sun_vector(math.radians(P["sun_el"]), math.radians(P["yaw_cam"] + P["sun_bearing"]))
haze_near = tuple(0.28 * c for c in PAL["skyHigh"])
haze_sun = tuple(0.35 * (a + b) for a, b in zip(PAL["alpenglow"], PAL["sky"]))
for m in (snow, rock):
    W.haze(m, haze_near, haze_sun, sun_dir, P["haze"])

# ---------------------------------------------------------------- the lens
foot = Vector((0.0, 0.0, float(W.height(np.array(0.0), np.array(0.0), P))))
cam_xy = Vector((P["cam"][0], P["cam"][1], 0.0))
cam_xy.z = float(W.height(np.array(cam_xy.x), np.array(cam_xy.y), P)) + P["cam_height"]
yaw, pitch = math.radians(P["yaw_cam"]), math.radians(P["pitch"])
fwd = Vector((math.cos(yaw) * math.cos(pitch), math.sin(yaw) * math.cos(pitch), math.sin(pitch)))
half_fov = math.atan(18.0 / P["lens"])

# ---------------------------------------------------------------- the world
mountain = W.terrain(P, cam_xy, yaw, half_fov, [snow, rock])
for k, (dist, a0, a1, base, rise) in enumerate((
        (7000, -0.3, 1.2, -600, 900), (12000, -0.4, 1.3, -700, 1600), (20000, -0.5, 1.4, -900, 2400))):
    W.far_range(f"range{k}", cam_xy, dist, yaw + a0, yaw + a1, base, rise, 50 + k, 0.03, [snow, rock])
W.sky(P, sun_dir, tuple(0.2 + 0.8 * c / max(PAL["dusk"]) for c in PAL["dusk"]), PAL["alpenglow"])
W.sun_lamp(sun_dir, P)
bvh = S.bvh_of(mountain)

# ---------------------------------------------------------------- the skier
rider, rider_meshes = R.build_rider(
    DATA, os.path.join(OUT, "skier0-lod0.glb"), os.path.join(ROOT, "pwa", "models", f"{DATA['pair']['id']}.glb"))
hit, normal = S.drape(bvh, foot.x, foot.y)
fall = Vector((normal.x, normal.y, 0)).normalized()
fall = (fall - normal * fall.dot(normal)).normalized()
R.place_rider(rider, DATA, hit, normal, fall, P["yaw"])
# Down onto the snow: the lowest point of his skis a little into it (the
# edge cuts in), measured on the posed meshes.
dg = bpy.context.evaluated_depsgraph_get()
pair_mesh = rider_meshes[1].evaluated_get(dg)
low = min((pair_mesh.matrix_world @ v.co - hit).dot(normal) for v in pair_mesh.data.vertices)
rider.location -= normal * (low + 0.03)
bpy.context.view_layer.update()
poles = R.build_poles(rider, DATA, normal)
cog = rider.matrix_world.translation.copy()
travel = (rider.matrix_world.to_3x3() @ Vector((0, 1, 0)))
travel = (travel - normal * travel.dot(normal)).normalized()

# ---------------------------------------------------------------- the camera
cd = bpy.data.cameras.new("lens")
cd.lens = P["lens"]
cd.sensor_width = 36.0
cd.sensor_fit = "HORIZONTAL"
cd.dof.use_dof = True
cd.dof.aperture_fstop = P["fstop"]
cd.dof.focus_distance = (cog - cam_xy).length
cd.clip_end = 60000
cam = bpy.data.objects.new("lens", cd)
COL.objects.link(cam)
cam.location = cam_xy
q = fwd.to_track_quat("-Z", "Y")
cam.rotation_euler = q.to_euler()
cam.rotation_euler.rotate_axis("Z", math.radians(P["dutch"]))
scene.camera = cam
scene.render.resolution_x = scene.render.resolution_y = SIZE
bpy.context.view_layer.update()

# ---------------------------------------------------------------- his marks
groove = S.groove_material(snow)
# The track leaves the snow just behind his boots.
tails = hit - travel * 0.9
# The S up the face to where the lens sees it under the summit.
tr, br, bl, tl = cd.view_frame(scene=scene)
def ray_of(u, v):
    return (cam.matrix_world.to_3x3() @ (tl + (tr - tl) * u + (bl - tl) * v)).normalized()
S.tracks(DATA["mark"], PL.uv_of(cam, tails), P["track_aim"], ray_of, bvh, cam_xy, groove, P["track_squash"])
# The outside ski: the one further from his centre of gravity across his line.
side = normal.cross(travel)
pair_arm = next(o for o in bpy.data.objects if o.type == "ARMATURE" and o.parent and o.parent.name == DATA["pair"]["id"])
skis = [pair_arm.matrix_world @ pb.head for pb in pair_arm.pose.bones if pb.name.startswith("ski_")]
outside = max(skis, key=lambda p: abs((p - cog).dot(side)))
out_dir = side * (1 if (outside - cog).dot(side) > 0 else -1)
rng = np.random.default_rng(11)
emit = np.array(outside - travel * 0.25 + normal * 0.02)
n_grains = 90000 if SAMPLES >= 128 else 30000
pos, rad, age = S.spray_points(emit, np.array(travel), np.array(out_dir), np.array(normal),
                               DATA["pose"]["speed"] * 0.55, n_grains, rng)
grains = S.point_object("spray", pos, rad, S.grain_material(W.aov))
mist_pick = rng.uniform(0, 1, len(pos)) < 0.05
mist = S.point_object("mist", pos[mist_pick], 0.12 + 0.25 * age[mist_pick], S.mist_material(),
                      as_volume=True, density=1.0, voxel=0.06)

# ---------------------------------------------------------------- the woods
needle, needle_dark = W.mat("needle", PAL["pine"], rough=0.8), W.mat("needle-dark", PAL["pineDark"], rough=0.85)
tree_snow = mat("tree-snow", PAL["snow"], rough=0.5)
for m in (needle, needle_dark, tree_snow):
    W.haze(m, haze_near, haze_sun, sun_dir, P["haze"])
cols = W.spruce_collection(DATA["spruce"], needle, needle_dark, tree_snow)
spots = PL.wood_spots(P, foot, cam_xy, fwd, bvh, rng, W) + PL.stand_spots(P, ray_of, cam_xy, foot, bvh, rng, W)
W.plant(cols, spots, rng)

# ---------------------------------------------------------------- the gates
panel_red = mat("panel-red", PAL["flag"], rough=0.6)
panel_blue = mat("panel-blue", PAL["gateBlue"], rough=0.6)
gate_pole = mat("gate-pole", (0.8, 0.8, 0.8), rough=0.4)
# Where the lens sees them, below him toward the frame's foot.
for k, ((gu, gv), pm, sd) in enumerate(zip(P["gates"], (panel_red, panel_blue), (1, -1))):
    h = bvh.ray_cast(cam_xy, ray_of(gu, gv))[0]
    if h is not None:
        W.gate(f"gate{k}", h, Vector((fall.x, fall.y, 0)).normalized(), sd, pm, gate_pole)

# ---------------------------------------------------------------- the render
PL.render_setup(SIZE, SAMPLES)
paths = PL.render_and_save(OUT)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "title-render.blend"))
PL.publish(OUT, paths, cam, {
    "sun": cam_xy + sun_dir * 50000,
    "subject": cog,
    "spray": Vector(tuple(emit)) + Vector(tuple(out_dir)) * 1.6 + normal * 1.0 - travel * 2.0,
    "spray_edge": Vector(tuple(emit)) + Vector(tuple(out_dir)) * 3.2,
}, P)

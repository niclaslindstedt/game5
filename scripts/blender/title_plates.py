# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE TITLE SCENE'S PLATES: the render set up, saved and packed into what
# the title stage reads (`pwa/src/title/`, published by
# `scripts/title-plates.mjs`):
#
#   title-colour.webp  2048², the frame with the view transform baked in
#   title-aux.webp     1024² RGBA: R the DEPTH (0 at the lens … 1 the sky,
#                      log-spaced so the near ground keeps its steps), G the
#                      SPARKLE (sunlit snow: how much direct sun it takes, 0
#                      in shade), B the SKY, A the GLOW (the spray, and
#                      anything the sun has driven past white)
#   title-plate.json   the points the stage animates from, projected
#                      through the camera into the plate's (u, v) — 0..1,
#                      v DOWN from the top as an image is read: the sun, the
#                      skyline (the spindrift's source), the spray's
#                      emitter, the subject — the two SAFE CROPS, and the lens
#
# And for judging: `title-crops.png` (the plate with both crops, then each
# crop with the UI's zones over it) and `title-aux-sheet.png` (the four aux
# channels side by side). Images are read and written with the OpenImageIO
# Blender carries; no other encoder is needed.

import json
import math
import os

import bpy
import numpy as np
import OpenImageIO as oiio
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

scene = bpy.context.scene

# The plates' sizes and their budgets' first tries (the quality is lowered
# until each fits its budget).
COLOUR = 2048
AUX = 1024
COLOUR_KB = 750
AUX_KB = 220
# A wide screen and a phone upright, as shares of the square.
LANDSCAPE_H = 9 / 16
PORTRAIT_W = 9 / 19.5
# Depth: the nearest and farthest distances the log scale spans, m.
NEAR, FAR = 2.0, 30000.0


def render_setup(size, samples):
    r = scene.render
    r.engine = "CYCLES"
    r.resolution_x = r.resolution_y = size
    r.resolution_percentage = 100
    c = scene.cycles
    c.device = "CPU"
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.02
    c.use_denoising = True
    c.denoiser = "OPENIMAGEDENOISE"
    c.max_bounces = 8
    c.diffuse_bounces = 3
    c.glossy_bounces = 2
    c.transmission_bounces = 6
    c.volume_bounces = 1
    c.transparent_max_bounces = 8
    c.volume_step_rate = 2.0
    c.caustics_reflective = c.caustics_refractive = False
    c.blur_glossy = 1.0
    r.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Punchy"
    scene.view_settings.exposure = 0.0
    vl = scene.view_layers[0]
    vl.use_pass_z = True
    vl.use_pass_diffuse_direct = True
    for name in ("snow", "glow"):
        a = vl.aovs.add()
        a.name = name
        a.type = "VALUE"


def render_and_save(out):
    """One render: every pass written as a multilayer EXR (linear), then
    the frame read back out of it and saved as a 16-bit PNG through the
    scene's view transform."""
    s = scene.render.image_settings
    passes = os.path.join(out, "title-passes.exr")
    # Blender 5 offers a multilayer EXR only under its media type.
    if hasattr(s, "media_type"):
        s.media_type = "MULTI_LAYER_IMAGE"
    s.file_format = "OPEN_EXR_MULTILAYER"
    s.color_depth = "32"
    s.exr_codec = "ZIP"
    scene.render.filepath = passes
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(passes)
    if hasattr(s, "media_type"):
        s.media_type = "IMAGE"
    s.file_format = "PNG"
    s.color_depth = "16"
    s.color_mode = "RGB"
    colour = os.path.join(out, "title-colour.png")
    img.save_render(colour, scene=scene)
    return {"colour": colour, "passes": passes}


def _channels(path):
    """Every channel of a multilayer EXR by its name, top row first — a
    pass a part of its own (Blender writes the layers as EXR parts)."""
    inp = oiio.ImageInput.open(path)
    out, k = {}, 0
    while inp.seek_subimage(k, 0):
        spec = inp.spec()
        px = inp.read_image(k, 0, 0, spec.nchannels, "float")
        out |= {n: px[:, :, i] for i, n in enumerate(spec.channelnames)}
        k += 1
    inp.close()
    return out


def _find(ch, *keys):
    for n, a in ch.items():
        if all(k in n for k in keys):
            return a
    raise KeyError(f"no pass with {keys} in {list(ch)}")


def _resize(a, size):
    """A float image (H, W, C) to size², area-averaged."""
    spec = oiio.ImageSpec(a.shape[1], a.shape[0], a.shape[2], "float")
    buf = oiio.ImageBuf(spec)
    buf.set_pixels(oiio.ROI(), a.astype(np.float32))
    out = oiio.ImageBufAlgo.resize(buf, roi=oiio.ROI(0, size, 0, size, 0, 1, 0, a.shape[2]))
    return out.get_pixels("float")


def _webp(a, path, budget_kb, quality, dither=False):
    """`a` (0..1, H×W×C) as a lossy WebP, the quality stepped down until it
    fits `budget_kb`; `dither` adds a triangular noise of one step before
    the 8-bit cut, so a long soft gradient (the sky, the haze) does not band."""
    if dither:
        rng = np.random.default_rng(3)
        a = a + (rng.uniform(0, 1, a.shape) - rng.uniform(0, 1, a.shape)) / 255
    u8 = (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)
    while True:
        spec = oiio.ImageSpec(u8.shape[1], u8.shape[0], u8.shape[2], "uint8")
        spec.attribute("compression", f"webp:{quality}")
        spec.attribute("oiio:ColorSpace", "sRGB")
        o = oiio.ImageOutput.create(path)
        o.open(path, spec)
        o.write_image(u8)
        o.close()
        kb = os.path.getsize(path) / 1024
        if kb <= budget_kb or quality <= 40:
            return quality, kb
        quality -= 4


def uv_of(cam, p):
    """A world point in the plate's (u, v), v down from the top."""
    c = world_to_camera_view(scene, cam, Vector(p))
    return [round(float(c.x), 5), round(float(1 - c.y), 5)]


def _crop_rects(subject):
    """The two safe crops round the subject: the wide band holding him a
    little below its middle (the summit and the logo's sky above, the menu
    down its left third), the tall column centred on him (the logo above,
    the menu under his feet)."""
    sx, sy = subject
    y0 = min(max(sy - 0.68 * LANDSCAPE_H, 0), 1 - LANDSCAPE_H)
    x0 = min(max(sx - 0.5 * PORTRAIT_W, 0), 1 - PORTRAIT_W)
    return {
        "landscape": [0.0, round(y0, 5), 1.0, round(LANDSCAPE_H, 5)],
        "portrait": [round(x0, 5), 0.0, round(PORTRAIT_W, 5), 1.0],
    }


# The UI's zones over each crop, as shares of the crop: the logo and the
# menu (part 5's layout), drawn over the contact sheet to judge the frame.
UI_ZONES = {
    "landscape": [("logo", (0.04, 0.06, 0.34, 0.3)), ("menu", (0.0, 0.0, 0.35, 1.0))],
    "portrait": [("logo", (0.1, 0.04, 0.8, 0.14)), ("menu", (0.0, 0.55, 1.0, 0.45))],
}


def publish(out, paths, cam, points, P):
    """The plates, the JSON and the sheets off the saved render."""
    inp = oiio.ImageInput.open(paths["colour"])
    spec = inp.spec()
    colour = inp.read_image(0, 0, 0, 3, "float")
    inp.close()
    q, kb = _webp(_resize(colour, COLOUR), os.path.join(out, "title-colour.webp"), COLOUR_KB, 84, dither=True)
    print(f"PLATE colour {COLOUR}² q{q} {kb:.0f} KB")
    print(f"Saved: '{os.path.join(out, 'title-colour.webp')}'")

    ch = _channels(paths["passes"])
    z = _find(ch, "Depth", ".Z")
    sky = (z > 1e9).astype(np.float32)
    zc = np.clip(z, NEAR, FAR)
    depth = np.where(sky > 0, 1.0, np.log(zc / NEAR) / math.log(FAR / NEAR))
    snow = np.clip(_find(ch, "snow"), 0, 1)
    direct = sum(_find(ch, "Diffuse Direct", c) for c in (".R", ".G", ".B")) / 3
    lit = np.clip(direct / max(1e-4, np.percentile(direct[snow > 0.5], 99) if (snow > 0.5).any() else 1), 0, 1)
    sparkle = snow * lit ** 0.8
    lum = colour.mean(axis=2)
    glow = np.clip(_find(ch, "glow"), 0, 1) * np.clip(lum * 1.4, 0, 1)
    glow = np.maximum(glow, np.clip((lum - 0.86) / 0.12, 0, 1))
    aux = np.stack([depth, sparkle, sky, glow], 2).astype(np.float32)
    aux_small = _resize(aux, AUX)
    qa, kba = _webp(aux_small, os.path.join(out, "title-aux.webp"), AUX_KB, 90)
    print(f"PLATE aux {AUX}² q{qa} {kba:.0f} KB")
    print(f"Saved: '{os.path.join(out, 'title-aux.webp')}'")

    # The skyline: the first non-sky pixel down each column, in (u, v).
    h, w = sky.shape
    ridge = []
    for i in range(65):
        x = min(w - 1, int(i / 64 * (w - 1)))
        col = sky[:, x]
        top = int(np.argmin(col)) if col.min() < 0.5 else h - 1
        ridge.append([round(x / (w - 1), 5), round(top / (h - 1), 5), round(float(depth[min(h - 1, top + 2), x]), 4)])
    subject = uv_of(cam, points["subject"])
    spray = uv_of(cam, points["spray"])
    edge = uv_of(cam, points["spray_edge"])
    crops = _crop_rects(subject)
    plate = {
        "size": COLOUR,
        "aux": AUX,
        "sun": uv_of(cam, points["sun"]),
        "sunElevation": round(P["sun_el"], 3),
        "ridge": ridge,
        "spray": {"uv": spray, "radius": round(math.dist(spray, edge), 5)},
        "subject": subject,
        "crops": crops,
        "camera": {"lens": cam.data.lens, "sensor": cam.data.sensor_width, "fstop": cam.data.dof.aperture_fstop},
        "depth": {"near": NEAR, "far": FAR, "scale": "log"},
    }
    with open(os.path.join(out, "title-plate.json"), "w") as f:
        json.dump(plate, f, indent=2)
        f.write("\n")
    print("PLATE json", json.dumps({k: plate[k] for k in ("sun", "subject", "crops")}))
    _crops_sheet(colour, plate, os.path.join(out, "title-crops.png"))
    _aux_sheet(aux_small, os.path.join(out, "title-aux-sheet.png"))


def _box(img, x0, y0, x1, y1, rgb, alpha, edge=2):
    h, w = img.shape[:2]
    x0, x1 = max(0, int(x0)), min(w, int(x1))
    y0, y1 = max(0, int(y0)), min(h, int(y1))
    img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * (1 - alpha) + np.array(rgb) * alpha
    for a, b, c, d in ((y0, y0 + edge, x0, x1), (y1 - edge, y1, x0, x1), (y0, y1, x0, x0 + edge), (y0, y1, x1 - edge, x1)):
        img[max(0, a):max(0, b), max(0, c):max(0, d)] = rgb


def _write_png(img, path):
    u8 = (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)
    o = oiio.ImageOutput.create(path)
    o.open(path, oiio.ImageSpec(u8.shape[1], u8.shape[0], 3, "uint8"))
    o.write_image(u8)
    o.close()


def _crops_sheet(colour, plate, path):
    """The square at 1024 with both crops outlined, then the wide crop and
    the tall one, each with the logo's and the menu's zones laid over it."""
    S = 1024
    sq = _resize(colour, S)
    full = sq.copy()
    (lx, ly, lw, lh), (px, py, pw, ph) = plate["crops"]["landscape"], plate["crops"]["portrait"]
    _box(full, lx * S, ly * S, (lx + lw) * S, (ly + lh) * S, (1, 0.8, 0.2), 0.0, 3)
    _box(full, px * S, py * S, (px + pw) * S, (py + ph) * S, (0.3, 0.8, 1), 0.0, 3)
    sx, sy = plate["subject"]
    _box(full, sx * S - 6, sy * S - 6, sx * S + 6, sy * S + 6, (1, 0, 0), 1.0)
    ux, uy = plate["sun"]
    _box(full, ux * S - 6, uy * S - 6, ux * S + 6, uy * S + 6, (1, 1, 0), 1.0)
    land = sq[int(ly * S):int((ly + lh) * S), :].copy()
    port = sq[:, int(px * S):int((px + pw) * S)].copy()
    for img, kind in ((land, "landscape"), (port, "portrait")):
        h, w = img.shape[:2]
        for name, (zx, zy, zw, zh) in UI_ZONES[kind]:
            rgb = (0.1, 0.9, 0.5) if name == "logo" else (0.2, 0.4, 1.0)
            _box(img, zx * w, zy * h, (zx + zw) * w, (zy + zh) * h, rgb, 0.22)
    H = S
    sheet = np.ones((H, S + S + port.shape[1] + 40, 3), np.float32) * 0.08
    sheet[:, :S] = full
    sheet[: land.shape[0], S + 20:S + 20 + land.shape[1]] = land
    sheet[:, S + S + 40:S + S + 40 + port.shape[1]] = port
    _write_png(sheet, path)


def _aux_sheet(aux, path):
    """The four aux channels side by side, each as grey."""
    S = aux.shape[0]
    sheet = np.zeros((S, S * 4, 3), np.float32)
    for i in range(4):
        sheet[:, i * S:(i + 1) * S] = aux[:, :, i:i + 1]
    _write_png(sheet, path)


def wood_spots(P, foot, cam, fwd, bvh, rng, W):
    """Where the spruces stand: in clumps over the view's wedge, on ground
    gentle enough to hold them and below the tree line (thinning toward
    it), never within 30 m of the lens nor on the skier's own pitch, and a
    stand close in at the frame's lower left."""
    spots = []
    yaw = math.atan2(fwd.y, fwd.x)
    line = P["floor"] + P["tree_line"]
    def put(d, b, size):
        x, y = cam.x + d * math.cos(yaw + b), cam.y + d * math.sin(yaw + b)
        hit, n = bvh.ray_cast(Vector((x, y, 9000.0)), Vector((0, 0, -1)))[:2]
        if hit is None or n.z < 0.72:
            return
        if math.hypot(x - foot.x, y - foot.y) < 45:
            return
        if rng.uniform() > np.clip((line - hit.z) / 160, 0, 1):
            return
        if W.fbm(np.array(x / 140), np.array(y / 140), 3, seed=61) < -0.05:
            return
        spots.append((x, y, hit.z, size))
    for _ in range(16000):
        put(math.exp(rng.uniform(math.log(60), math.log(4000))), rng.uniform(-0.42, 0.42), rng.uniform(10, 22))
    return spots


def stand_spots(P, ray_of, cam, foot, bvh, rng, W):
    """A stand of spruces where the lens sees `P["stand"]` (a box in plate
    UV): clumped, never within 35 m of the lens nor 30 m of the skier."""
    u0, v0, u1, v1 = P["stand"]
    spots = []
    for _ in range(900):
        hit = bvh.ray_cast(cam, ray_of(rng.uniform(u0, u1), rng.uniform(v0, v1)))[0]
        if hit is None or (hit - cam).length < 35 or (hit - foot).length < 30:
            continue
        if W.fbm(np.array(hit.x / 30), np.array(hit.y / 30), 3, seed=67) < 0.05:
            continue
        if any(math.hypot(hit.x - x, hit.y - y) < 0.35 * h for x, y, _, h in spots):
            continue
        spots.append((hit.x, hit.y, hit.z, rng.uniform(3.5, 7)))
        if len(spots) >= 60:
            break
    return spots

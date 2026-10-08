---
title: Blender 5 writes a multilayer EXR's passes as separate PARTS — set media_type before the format, render with write_still, read each part with seek_subimage
date: 2026-10-08
scope: scripts/blender/title_plates.py
concepts: render-passes, exr, headless, aov
---

In Blender 5, `image_settings.file_format = "OPEN_EXR_MULTILAYER"` is refused until `image_settings.media_type = "MULTI_LAYER_IMAGE"` is set first. `save_render` on the Render Result writes only Combined; render with `bpy.ops.render.render(write_still=True)` straight to the multilayer EXR instead. The file holds one EXR PART (subimage) per pass — Combined, Depth, Diffuse Direct, each AOV — so OpenImageIO (bundled in Blender's Python, with numpy and a WebP writer) reads them with `seek_subimage(i, 0)`, channels named `ViewLayer.Depth.Z`, `ViewLayer.<aov>.X`. Reading only subimage 0 looks like "the passes were never written". The PNG through the view transform is the reloaded EXR's `save_render`. The GPU compositor crashes headless (no libEGL); none of this needs it.

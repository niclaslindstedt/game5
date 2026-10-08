---
title: A rigged glTF imports with its first clip BOUND — clear the armature's animation data before posing it by hand, or the render re-poses it
date: 2026-10-08
scope: scripts/blender/title_rider.py
concepts: gltf-import, armature, pose, action, render
---

`bpy.ops.import_scene.gltf` on a model with clips (the skier's `ride`, `carve`, `plant`…) leaves the armature with an action bound. A pose set bone by bone with `pb.matrix` reads back correctly in the script, but the first frame change — `frame_set`, or the render itself — evaluates the action and overwrites every keyed bone, so the picture shows the clip's pose while anything laid off the scripted pose (poles off the fists) floats free of it. Call `arm.animation_data_clear()` right after the import. To catch it: compare a bone's head before and after `scene.frame_set(1)`, and render a close-up of what should be touching.

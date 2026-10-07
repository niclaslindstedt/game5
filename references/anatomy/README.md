# Anatomy references

The HUD body's figure (`pwa/src/game/body-model.ts`) and the X-ray cam's skeleton (`pwa/src/game/xray-model.ts`) are made from a 3D body, and this page says where that body comes from. Only material that is free to keep in a public repository is stored here.

## The 3D body — fetched, and one thinned adaptation committed

`make hud-body` (`scripts/hud-body.mjs`) builds the figure from **BodyParts3D**: a whole human body segmented out of one man's CT scan, with every bone, every organ and the skin as separate meshes. The lab downloads it — both of its published sets, the part-of tree and the is-a tree (the spleen is only in the second) — the first time it runs into the gitignored `previews/.bodyparts3d/`. No mesh is committed. The figure is traced off it: the skin's silhouette, each bone's and each organ's silhouette and shading bands, a few hundred corners each. The organs drawn are the brain, the heart, the lungs, the liver, the spleen, the stomach, the bowel, the kidneys and the bladder; this body has no surface for the lungs, only their airways and vessels, so their outline is that tree closed into one shape.

`make xray-body` (`scripts/xray-body.mjs`) reads the same download for the X-RAY CAM: every bone and organ the HUD names, thinned by vertex clustering to about 15,700 triangles in all (the lungs closed into their convex hulls), turned into the game's frame, scaled to the skier's rig and fitted bone by bone onto it. That thinned set IS committed, as the generated `pwa/src/game/xray-model.ts`: it is an adaptation of BodyParts3D, so it carries the same licence (CC BY-SA 2.1 Japan, its SPDX header says so) and the attribution below, and the rest of the tree is not touched by it. The full meshes stay in the gitignored download.

> BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan — <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/>

## Kept here

| File | What it is | Licence | Source |
| --- | --- | --- | --- |
| `skeleton-front.svg` | A labelled front view of the human skeleton, every bone its own labelled group | Public domain — released by its author (LadyofHats) for any purpose, without conditions | <https://commons.wikimedia.org/wiki/File:Human_skeleton_front_en.svg> |

The file is kept byte for byte as published. The first HUD figure's bones were traced off it. No lab reads it now; it is kept as a reference drawing for checking a bone's shape by eye.

`make damage ARGS="--refs=DIR"` lays any local reference image under the figure. Local references are never committed.

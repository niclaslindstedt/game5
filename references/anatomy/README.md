# Anatomy references

The HUD body's figure (`pwa/src/game/body-model.ts`) is made from a 3D body, and this page says where that body comes from. Only material that is free to keep in a public repository is stored here.

## The 3D body — fetched, never stored

`make hud-body` (`scripts/hud-body.mjs`) builds the figure from **BodyParts3D**: a whole human body segmented out of one man's CT scan, with every bone and the skin as separate meshes. The lab downloads it the first time it runs into the gitignored `previews/.bodyparts3d/`. No mesh is committed. The figure is traced off it: the skin's silhouette, each bone's silhouette and the bone's shading bands, a few hundred corners per bone.

> BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan — <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/>

## Kept here

| File | What it is | Licence | Source |
| --- | --- | --- | --- |
| `skeleton-front.svg` | A labelled front view of the human skeleton, every bone its own labelled group | Public domain — released by its author (LadyofHats) for any purpose, without conditions | <https://commons.wikimedia.org/wiki/File:Human_skeleton_front_en.svg> |

The file is kept byte for byte as published. The first HUD figure's bones were traced off it. No lab reads it now; it is kept as a reference drawing for checking a bone's shape by eye.

`make damage ARGS="--refs=DIR"` lays any local reference image under the figure. Local references are never committed.

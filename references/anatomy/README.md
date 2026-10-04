# Anatomy references

Pictures the HUD's body figure is traced and checked against. Only material that is free to keep in a public repository lives here.

| File | What it is | Licence | Source |
| --- | --- | --- | --- |
| `skeleton-front.svg` | A labelled front view of the human skeleton, every bone its own labelled group | Public domain — released by its author (LadyofHats) for any purpose, without conditions | <https://commons.wikimedia.org/wiki/File:Human_skeleton_front_en.svg> |

The file is kept byte for byte as published.

**What uses it:** `make anatomy` (`scripts/anatomy-preview.mjs`). The lab traces every bone off this plate, lays each one into the HUD's figure joint by joint (`pwa/src/tools/anatomy-map.ts`), and writes the result as the generated `pwa/src/game/body-bones.ts`. It then draws the plate's own drawing of each bone, warped by that bone's map, under our bone, so a bone that is wrong shows as two that disagree.

**The body's outline is not traced from anything here.** It was traced off a photograph of a man in the anatomical position, and that photograph is not kept. `make damage ARGS="--refs=DIR"` lays any local reference under the figure for a session that needs one. A local reference is never committed.

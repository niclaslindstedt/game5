---
title: Make the HUD body from a whole 3D body (`make hud-body`), never by laying a 2D plate into a photographed outline
date: 2026-10-04
scope: scripts/hud-body.mjs, scripts/lib/bodyparts3d.mjs, pwa/src/game/body-model.ts
concepts: [body-figure, anatomy, tracing, proportions]
---

Fitting a front-view skeleton plate into an outline traced off someone else's photograph took a dozen passes and still failed. The forearms twisted, the hands and feet spilled out of the flesh, the feet looked webbed, and the proportions were neither man's. A segmented CT body (bones and skin from one man) fixes all of that by construction. The skin's silhouette is the outline and every bone sits where it sits in him. What the lab still has to decide:

- **The feet** seen straight from the front are end on, so the metatarsals overlap. Turn them down about the ankle (`--foot`, 58°) and blend the skin over a few cm, as plates do.
- **The trunk** seen whole is a lattice of the ribs' backs and the spine's arches. Cut it along the spine (a coronal section through the middle of the vertebral bodies). The front then shows the front's bones and the back view shows the rest. Limbs and skull stay whole.
- **The armpit** cannot be read off the silhouette: the upper arm lies on the chest and the first air is at the elbow. Read it off the bones (a fifth down the humerus, between the rib cage and the humerus).
- **The seam below the crotch** starts in the air between the legs. Step past that air and the leg before looking for the gap to the arm.
- **Crop every bone to its own box** before blurring and tracing: 207 s became 37 s.
- **Generated paths go out as one string per field**, never arrays: prettier puts every array item on its own line and the module broke the 1000-line cap.

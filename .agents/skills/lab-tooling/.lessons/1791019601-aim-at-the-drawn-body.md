---
title: A harness that frames the skier must aim at the DRAWN body, not the engine's centre of gravity
date: 2026-10-03
scope: pwa/src/tools/skier-harness.ts, pwa/src/tools/turns-harness.ts
concepts: [harness, framing, labs]
---

Once the drawn body turns about its feet (`ski-stand.ts`), it leans up to
0.7 m inside the engine's centre of gravity in a hard turn, and the skier
lab's close-ups — aimed at `c.x, c.y` — cut him out of frame at the apex and
in a hockey stop. Aim at `model.root.position`, which is where the game
draws him; the engine's point is the camera rig's, not the figure's.

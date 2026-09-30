---
title: Pace is optical flow — keep the skier's size as the fov widens, and give the near field something to stream past
date: 2026-09-24
scope: pwa/src/game/camera-rigs.ts, pwa/src/game/snowfall.ts, pwa/src/game/snow-glsl.ts
concepts: [sense-of-speed, camera, fov, tremor, optical-flow]
---

"100 km/h feels like 50" had three causes, none in the physics: the chase
boom ran OUT with speed while the fov widened, so the skier shrank by a third
at pace (reads as slow); open snow and clear air had nothing close to stream
past; and the lens was glass. `PACE` in `camera-rigs.ts` answers the first
with `hold` (the arm pulled in along its line by a share of the fov's
widening — 0.45 on chase; higher puts rivals running alongside inside the arm)
plus a surge and a tremor, `snowfall.ts`'s air crystals and the shader's fine
grain answer the second. Stills cannot judge any of it; judge the SIZE of the
skier across speeds in stills and the rest by skiing. In `make world` the
PLAYER is the RED slot — a yellow skier at the lens is a rival, not the rig
misframing.

The tremor first shipped at 3 cm of lens travel (0.0035 rad of aim and
roll) and was played as shaking far too much; a third of that — 1 cm,
0.0012 rad — is the level asked for. A shake is felt long before it is seen
in a still, so size it by skiing, from well under what a still suggests.

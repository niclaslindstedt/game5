---
title: A culling box that touches the lens or spans the whole mountain's height passes the frustum test from every side — count what is drawn after a cull, never trust it
date: 2026-10-05
scope: pwa/src/game/terrain.ts
concepts: [performance, culling, measurement, terrain]
---

The ground's clipmap cull culled nothing twice before it worked. Cut into quarters, every quarter of a level met at the level's centre, where the lens stands, so every quarter's box touched the frustum. Cut into wedges of a ring (which never reaches the centre), each wedge was boxed over the map's whole height range plus the rim's rise, about 1.4 km, and three's `Frustum.intersectsBox` tests a box plane by plane: a box that tall has a corner inside each plane in turn whichever way the lens looks. Bounding each wedge by the ground under it (a min/max grid of the heightfield in 32-sample blocks) took the near rings from every triangle to about 40%. The screenshots were pixel-identical all three times, so a cull that does nothing looks exactly like one that works: count what it leaves drawn (`make cpu-cost ARGS="--suite terrain"`, or the frame's `triangles` — not the scene tally, which reads an index's whole length and ignores a draw range).

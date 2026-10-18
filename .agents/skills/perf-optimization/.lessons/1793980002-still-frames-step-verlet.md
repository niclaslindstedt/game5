---
title: A position-Verlet body carries its last step's way whatever the dt — a still frame drawn to be timed throws it a whole frame on
date: 2026-10-18
scope: pwa/src/game/gore-gibs.ts, pwa/src/game/gore-lumps.ts
concepts: [performance, labs, verlet, measurement]
---

The gibs, the torn pieces and the guts are stepped with `p += (p - last)`,
so a draw at `dt = 1e-4` (the gore lab's stills, the cost lab's twins) moved
every one of them a full frame and read their speed as huge. The cost lab's
first bake of resting lumps never fired for it. A step under a millisecond
now flies nothing (`STILL_STEP`), and rest is judged only on a real frame's
step, by SPEED (a lump on the snow creeps 1–2 cm/s for ever, so "has not
moved" never comes true): under 5 cm/s and 0.5 rad/s for a second, it is
baked.

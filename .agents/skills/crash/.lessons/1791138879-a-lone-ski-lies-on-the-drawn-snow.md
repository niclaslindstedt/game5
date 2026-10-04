---
title: Anything left lying in a fall must be laid on the DRAWN snow — powder is drawn a hand over the engine's ground, so a body at the ground reads as buried
date: 2026-10-04
scope: engine/game/lone-skis.ts, pwa/src/game/skis-body.ts
concepts: [yard-sale, skis, powder, presentation, contact]
---

The skis let go were first given a powder sink like the ragdoll's and
vanished in the world lab on seed 38: placed right (the bones' world
positions checked out) but under the snow. Two separate depths were
stacked: the engine's own sink, and `LOOSE` — the drawn loose cover stands
0.1 m over the engine's ground on virgin powder (`snow-glsl.ts`). A lone
ski is light and broad and built to rise: the engine floors it at the
ground with no sink (ends AND middle — a crest comes up between two end
points), and the drawer lifts it by `LOOSE * (1 - packed)`. Also: settle
the roll only once the ski is free — a ski touching the snow while still
in its binding had its spin laid flat before it ever left — and give a
held ski its wrench at the release, not at the throw, or the foot's carry
overwrites it. LOOK with `make world ARGS=--views=yard-0.4,yard-3`; the
fall views frame only the body and will not show the skis.

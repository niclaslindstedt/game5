---
title: Hundreds of STILL lamps are a baked map, never more lamp slots — and a sports flood is cut off above its aim, or it lights the woods
date: 2026-10-04
scope: pwa/src/game
concepts: [lamps, night, piste-lights, shaders]
---

The six `LAMP_SLOTS` are a per-pixel loop for the lamps that MOVE (the
headlamps, the arena's floods). The piste lights are hundreds of masts that
never move, so their light is baked once a map into a VECTOR irradiance texture
(Σ I/d² · the unit way to the lamp, `bakePisteLight`): `max(dot(n, v), 0)` is
the light on any face and `length(v)` all of it for a flake or the cloud — one
texture read where a slot loop would be hundreds. Bake it the first time the
lamps come on, not at load: a day map never pays the quarter-second.

A round 60° beam tipped down onto a piste throws its top edge nearly level, so
it laid 3–5 lx tens of metres into the woods and "off piste stays dark" failed.
Real slope floods are asymmetric — the peak thrown out at the aim, slow toward
the mast's foot, cut off sharply above (`beamShare`) — and with that cut the
snow 30 m past the edge is under 1 lx. Measure a layout with the one-point sum
(`illuminanceAt`) across the piste and past its edges before looking at a frame;
`tests/piste_lights_test.ts` is that survey.

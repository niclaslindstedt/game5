---
title: A dead rider's modelled skis are one skinned mesh in his statue — split it before moving a ski
date: 2026-10-20
scope: pwa/src/game/police-kit.ts, pwa/src/game/police-remains.ts, pwa/src/game/gore-remains.ts
concepts: [police, remains, statue, skis, lab]
---

The statue `gore-remains.ts` bakes is every drawn mesh, and the modelled
pair is ONE merged skinned mesh (`model-merged`, both skis, flagged `skin`)
whose bounding sphere spans both skis however far apart they lie. A test by
"not his skin" or by the sphere's middle never finds the ski at his feet.
Split the mesh into its pieces (triangles sharing a vertex, then pieces
whose boxes touch) and move only the piece in the way (`police-kit.ts`).

The police lab shoots its wide frames first and then goes back in time for
the close ones. State kept "for good" in a WeakSet hides a thing in every
frame shot after the latest one. Derive what is shown from the call's clock
each frame instead.
